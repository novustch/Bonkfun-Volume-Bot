/**
 * TransactionManager - Handles transaction creation and execution
 * 
 * Manages transaction building, signing, and submission with retry logic.
 */

import { 
  TransactionInstruction, 
  VersionedTransaction, 
  TransactionMessage,
  PublicKey,
  Keypair,
  Connection,
  SendOptions
} from '@solana/web3.js';
import { ConfigManager } from '../core/ConfigManager';
import { Logger } from '../utils/Logger';
import { BotError, ErrorType, DEFAULT_RETRY_CONFIG } from '../types';

export class TransactionManager {
  private logger: Logger;
  private configManager: ConfigManager;
  private connection: Connection;

  constructor(configManager: ConfigManager) {
    this.logger = new Logger('TransactionManager');
    this.configManager = configManager;
    this.connection = configManager.getConnection();
  }

  /**
   * Execute a transaction with retry logic
   */
  async executeTransaction(
    instructions: TransactionInstruction[],
    signers: Keypair[],
    options?: SendOptions
  ): Promise<string> {
    const maxAttempts = DEFAULT_RETRY_CONFIG.maxAttempts;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.logger.debug(`Executing transaction (attempt ${attempt}/${maxAttempts})`);
        
        const signature = await this.sendTransaction(instructions, signers, options);
        
        this.logger.info(`Transaction successful`, {
          signature,
          attempt,
          instructions: instructions.length
        });
        
        return signature;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`Transaction attempt ${attempt} failed`, {
          error: lastError.message,
          attempt,
          maxAttempts
        });

        if (attempt < maxAttempts) {
          const delay = this.calculateRetryDelay(attempt);
          this.logger.debug(`Retrying in ${delay}ms`);
          await this.delay(delay);
        }
      }
    }

    this.logger.error(`Transaction failed after ${maxAttempts} attempts`, lastError);
    throw new BotError(
      `Transaction failed after ${maxAttempts} attempts: ${lastError?.message}`,
      ErrorType.TRANSACTION_ERROR,
      { lastError: lastError?.message }
    );
  }

  /**
   * Send a transaction
   */
  private async sendTransaction(
    instructions: TransactionInstruction[],
    signers: Keypair[],
    options?: SendOptions
  ): Promise<string> {
    // Get latest blockhash
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
    
    // Build transaction message
    const message = new TransactionMessage({
      payerKey: signers[0].publicKey,
      recentBlockhash: blockhash,
      instructions
    }).compileToV0Message();

    // Create and sign transaction
    const transaction = new VersionedTransaction(message);
    transaction.sign(signers);

    // Simulate transaction if in debug mode
    if (this.configManager.isDebugMode()) {
      await this.simulateTransaction(transaction);
    }

    // Send transaction
    const signature = await this.connection.sendTransaction(transaction, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: 0, // We handle retries ourselves
      ...options
    });

    // Wait for confirmation
    await this.confirmTransaction(signature, blockhash, lastValidBlockHeight);
    
    return signature;
  }

  /**
   * Simulate a transaction
   */
  private async simulateTransaction(transaction: VersionedTransaction): Promise<void> {
    try {
      const simulation = await this.connection.simulateTransaction(transaction, {
        commitment: 'confirmed'
      });

      if (simulation.value.err) {
        throw new BotError(
          `Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`,
          ErrorType.TRANSACTION_ERROR
        );
      }

      this.logger.debug('Transaction simulation successful', {
        computeUnitsConsumed: simulation.value.unitsConsumed,
        logs: simulation.value.logs
      });
    } catch (error) {
      this.logger.error('Transaction simulation failed', error);
      throw error;
    }
  }

  /**
   * Confirm a transaction
   */
  private async confirmTransaction(
    signature: string,
    blockhash: string,
    lastValidBlockHeight: number
  ): Promise<void> {
    try {
      const confirmation = await this.connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');

      if (confirmation.value.err) {
        throw new BotError(
          `Transaction confirmation failed: ${JSON.stringify(confirmation.value.err)}`,
          ErrorType.TRANSACTION_ERROR
        );
      }

      this.logger.debug('Transaction confirmed', { signature });
    } catch (error) {
      this.logger.error('Transaction confirmation failed', error);
      throw error;
    }
  }

  /**
   * Execute multiple transactions in parallel
   */
  async executeTransactionsParallel(
    transactions: Array<{
      instructions: TransactionInstruction[];
      signers: Keypair[];
      options?: SendOptions;
    }>
  ): Promise<Array<{ success: boolean; signature?: string; error?: string }>> {
    this.logger.info(`Executing ${transactions.length} transactions in parallel`);

    const promises = transactions.map(async (tx, index) => {
      try {
        const signature = await this.executeTransaction(
          tx.instructions,
          tx.signers,
          tx.options
        );
        
        this.logger.debug(`Parallel transaction ${index + 1} successful`, { signature });
        return { success: true, signature };
      } catch (error) {
        this.logger.error(`Parallel transaction ${index + 1} failed`, error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    const results = await Promise.all(promises);
    
    const successful = results.filter(r => r.success).length;
    this.logger.info(`Parallel execution completed: ${successful}/${transactions.length} successful`);
    
    return results;
  }

  /**
   * Execute multiple transactions sequentially
   */
  async executeTransactionsSequential(
    transactions: Array<{
      instructions: TransactionInstruction[];
      signers: Keypair[];
      options?: SendOptions;
    }>,
    delayMs: number = 1000
  ): Promise<Array<{ success: boolean; signature?: string; error?: string }>> {
    this.logger.info(`Executing ${transactions.length} transactions sequentially`);

    const results: Array<{ success: boolean; signature?: string; error?: string }> = [];

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      
      try {
        this.logger.debug(`Executing sequential transaction ${i + 1}/${transactions.length}`);
        
        const signature = await this.executeTransaction(
          tx.instructions,
          tx.signers,
          tx.options
        );
        
        results.push({ success: true, signature });
        this.logger.debug(`Sequential transaction ${i + 1} successful`, { signature });
        
        // Delay between transactions
        if (i < transactions.length - 1) {
          await this.delay(delayMs);
        }
      } catch (error) {
        this.logger.error(`Sequential transaction ${i + 1} failed`, error);
        results.push({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    this.logger.info(`Sequential execution completed: ${successful}/${transactions.length} successful`);
    
    return results;
  }

  /**
   * Create a transaction with compute budget instructions
   */
  createTransactionWithComputeBudget(
    instructions: TransactionInstruction[],
    computeUnits: number = 200000,
    microLamports: number = 10000
  ): TransactionInstruction[] {
    const { ComputeBudgetProgram } = require('@solana/web3.js');
    
    return [
      ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports }),
      ...instructions
    ];
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    const baseDelay = DEFAULT_RETRY_CONFIG.baseDelay;
    const maxDelay = DEFAULT_RETRY_CONFIG.maxDelay;
    const multiplier = DEFAULT_RETRY_CONFIG.backoffMultiplier;
    
    const delay = baseDelay * Math.pow(multiplier, attempt - 1);
    return Math.min(delay, maxDelay);
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(signature: string): Promise<{
    confirmed: boolean;
    success: boolean;
    error?: string;
  }> {
    try {
      const status = await this.connection.getSignatureStatus(signature);
      
      if (!status.value) {
        return { confirmed: false, success: false };
      }
      
      return {
        confirmed: status.value.confirmationStatus !== null,
        success: status.value.err === null,
        error: status.value.err ? JSON.stringify(status.value.err) : undefined
      };
    } catch (error) {
      this.logger.error('Failed to get transaction status', error);
      return { confirmed: false, success: false, error: 'Failed to check status' };
    }
  }

  /**
   * Get transaction details
   */
  async getTransactionDetails(signature: string): Promise<any> {
    try {
      const transaction = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });
      
      return transaction;
    } catch (error) {
      this.logger.error('Failed to get transaction details', error);
      throw error;
    }
  }
}
