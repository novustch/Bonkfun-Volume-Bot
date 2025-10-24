/**
 * TradingEngine - Core trading logic and execution
 * 
 * Handles the execution of trading strategies, transaction management,
 * and coordination with external services.
 */

import { Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { ConfigManager } from '../core/ConfigManager';
import { MetricsCollector } from '../utils/MetricsCollector';
import { Logger } from '../utils/Logger';
import { TradingSession, TransactionResult, BotError, ErrorType } from '../types';
import { WalletManager } from '../managers/WalletManager';
import { TransactionManager } from '../managers/TransactionManager';
import { PoolManager } from '../managers/PoolManager';
import chalk from 'chalk';

export class TradingEngine {
  private logger: Logger;
  private configManager: ConfigManager;
  private metricsCollector: MetricsCollector;
  private walletManager: WalletManager;
  private transactionManager: TransactionManager;
  private poolManager: PoolManager;
  private isRunning: boolean = false;

  constructor(configManager: ConfigManager, metricsCollector: MetricsCollector) {
    this.logger = new Logger('TradingEngine');
    this.configManager = configManager;
    this.metricsCollector = metricsCollector;
    this.walletManager = new WalletManager(configManager);
    this.transactionManager = new TransactionManager(configManager);
    this.poolManager = new PoolManager(configManager);
  }

  /**
   * Execute a trading session
   */
  async executeSession(session: TradingSession): Promise<void> {
    this.logger.info('Starting trading session', { sessionId: session.id });
    
    try {
      session.isActive = true;
      this.isRunning = true;

      // Validate pool exists
      const poolInfo = await this.poolManager.getPoolInfo(session.config.tokenMint);
      if (!poolInfo) {
        throw new BotError(
          `Pool not found for token: ${session.config.tokenMint}`,
          ErrorType.VALIDATION_ERROR
        );
      }

      this.logger.info('Pool validated', { 
        poolId: poolInfo.poolId.toString(),
        baseMint: poolInfo.baseMint.toString(),
        quoteMint: poolInfo.quoteMint.toString()
      });

      // Execute trading cycles
      for (let cycle = 0; cycle < session.config.cycles; cycle++) {
        if (!this.isRunning) {
          this.logger.info('Trading session stopped by user');
          break;
        }

        await this.executeTradingCycle(session, cycle + 1);
        
        // Delay between cycles
        const delay = this.getRandomDelay(session.config.delay);
        this.logger.debug(`Waiting ${delay} seconds before next cycle`);
        await this.delay(delay * 1000);
      }

      session.isActive = false;
      session.endTime = new Date();
      
      this.logger.info('Trading session completed', {
        sessionId: session.id,
        duration: session.getDuration(),
        totalTransactions: session.totalTransactions,
        successRate: session.getSuccessRate()
      });

    } catch (error) {
      session.isActive = false;
      session.endTime = new Date();
      
      this.logger.error('Trading session failed', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Execute a single trading cycle
   */
  private async executeTradingCycle(session: TradingSession, cycleNumber: number): Promise<void> {
    this.logger.info(`Executing trading cycle ${cycleNumber}/${session.config.cycles}`);

    try {
      // Generate random parameters for this cycle
      const buyAmount = this.getRandomAmount(session.config.buyAmount);
      const walletCount = this.getRandomWalletCount(session.config.walletCount);
      
      this.logger.info('Cycle parameters', {
        cycle: cycleNumber,
        buyAmount,
        walletCount
      });

      // Create wallets for this cycle
      const wallets = await this.walletManager.createWallets(walletCount);
      this.logger.info(`Created ${wallets.length} wallets for cycle ${cycleNumber}`);

      // Execute buy transactions
      await this.executeBuyTransactions(session, wallets, buyAmount);

      // Wait for transactions to settle
      await this.delay(5000);

      // Execute sell transactions for older wallets
      await this.executeSellTransactions(session);

      this.logger.info(`Completed trading cycle ${cycleNumber}`);

    } catch (error) {
      this.logger.error(`Trading cycle ${cycleNumber} failed`, error);
      throw error;
    }
  }

  /**
   * Execute buy transactions
   */
  private async executeBuyTransactions(
    session: TradingSession, 
    wallets: Keypair[], 
    buyAmount: number
  ): Promise<void> {
    this.logger.info(`Executing buy transactions for ${wallets.length} wallets`);

    const transactions: Promise<TransactionResult>[] = [];

    for (const wallet of wallets) {
      const transactionPromise = this.executeBuyTransaction(
        session.config.tokenMint,
        buyAmount,
        wallet
      );
      transactions.push(transactionPromise);
    }

    // Execute all buy transactions
    const results = await Promise.allSettled(transactions);
    
    // Process results
    for (const result of results) {
      if (result.status === 'fulfilled') {
        session.totalTransactions++;
        if (result.value.success) {
          session.successfulTransactions++;
          session.totalVolume += buyAmount;
        } else {
          session.failedTransactions++;
        }
        this.metricsCollector.recordTransaction(result.value);
      } else {
        session.failedTransactions++;
        this.logger.error('Buy transaction failed', result.reason);
      }
    }

    this.logger.info(`Buy transactions completed`, {
      successful: session.successfulTransactions,
      failed: session.failedTransactions
    });
  }

  /**
   * Execute a single buy transaction
   */
  private async executeBuyTransaction(
    tokenMint: string,
    amount: number,
    wallet: Keypair
  ): Promise<TransactionResult> {
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Executing buy transaction`, {
        wallet: wallet.publicKey.toString(),
        amount,
        tokenMint
      });

      // Get swap instruction
      const swapInstruction = await this.poolManager.getSwapInstruction(
        tokenMint,
        amount,
        wallet.publicKey
      );

      if (!swapInstruction) {
        throw new BotError('Failed to get swap instruction', ErrorType.TRANSACTION_ERROR);
      }

      // Execute transaction
      const signature = await this.transactionManager.executeTransaction(
        [swapInstruction],
        [wallet]
      );

      const executionTime = Date.now() - startTime;

      this.logger.info(`Buy transaction successful`, {
        signature,
        wallet: wallet.publicKey.toString(),
        executionTime
      });

      return {
        signature,
        success: true,
        executionTime,
        volume: amount
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      this.logger.error('Buy transaction failed', error);
      
      return {
        signature: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime
      };
    }
  }

  /**
   * Execute sell transactions for older wallets
   */
  private async executeSellTransactions(session: TradingSession): Promise<void> {
    this.logger.info('Executing sell transactions for older wallets');

    try {
      const sellWallets = await this.walletManager.getWalletsForSelling(session.config.tokenMint);
      
      if (sellWallets.length === 0) {
        this.logger.info('No wallets available for selling');
        return;
      }

      this.logger.info(`Found ${sellWallets.length} wallets for selling`);

      // Process wallets in batches
      const batchSize = 5;
      for (let i = 0; i < sellWallets.length; i += batchSize) {
        const batch = sellWallets.slice(i, i + batchSize);
        await this.executeSellBatch(session, batch);
        
        // Small delay between batches
        await this.delay(1000);
      }

    } catch (error) {
      this.logger.error('Sell transactions failed', error);
      throw error;
    }
  }

  /**
   * Execute a batch of sell transactions
   */
  private async executeSellBatch(session: TradingSession, wallets: Keypair[]): Promise<void> {
    this.logger.info(`Executing sell batch for ${wallets.length} wallets`);

    const transactions: Promise<TransactionResult>[] = [];

    for (const wallet of wallets) {
      const sellAmount = this.getRandomAmount(session.config.sellAmount);
      const transactionPromise = this.executeSellTransaction(
        session.config.tokenMint,
        sellAmount,
        wallet
      );
      transactions.push(transactionPromise);
    }

    // Execute all sell transactions
    const results = await Promise.allSettled(transactions);
    
    // Process results
    for (const result of results) {
      if (result.status === 'fulfilled') {
        session.totalTransactions++;
        if (result.value.success) {
          session.successfulTransactions++;
          session.totalVolume += result.value.volume || 0;
        } else {
          session.failedTransactions++;
        }
        this.metricsCollector.recordTransaction(result.value);
      } else {
        session.failedTransactions++;
        this.logger.error('Sell transaction failed', result.reason);
      }
    }
  }

  /**
   * Execute a single sell transaction
   */
  private async executeSellTransaction(
    tokenMint: string,
    amount: number,
    wallet: Keypair
  ): Promise<TransactionResult> {
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Executing sell transaction`, {
        wallet: wallet.publicKey.toString(),
        amount,
        tokenMint
      });

      // Get swap instruction
      const swapInstruction = await this.poolManager.getSwapInstruction(
        tokenMint,
        amount,
        wallet.publicKey,
        true // isSell
      );

      if (!swapInstruction) {
        throw new BotError('Failed to get sell instruction', ErrorType.TRANSACTION_ERROR);
      }

      // Execute transaction
      const signature = await this.transactionManager.executeTransaction(
        [swapInstruction],
        [wallet]
      );

      const executionTime = Date.now() - startTime;

      this.logger.info(`Sell transaction successful`, {
        signature,
        wallet: wallet.publicKey.toString(),
        executionTime
      });

      return {
        signature,
        success: true,
        executionTime,
        volume: amount
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      this.logger.error('Sell transaction failed', error);
      
      return {
        signature: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime
      };
    }
  }

  /**
   * Retrieve funds from all wallets
   */
  async retrieveFunds(tokenMint: string, delayMs: number = 300): Promise<void> {
    this.logger.info('Starting fund retrieval', { tokenMint, delayMs });

    try {
      const wallets = await this.walletManager.getAllWallets(tokenMint);
      
      if (wallets.length === 0) {
        this.logger.info('No wallets found for fund retrieval');
        return;
      }

      this.logger.info(`Retrieving funds from ${wallets.length} wallets`);

      // Process wallets in batches
      const batchSize = 5;
      for (let i = 0; i < wallets.length; i += batchSize) {
        const batch = wallets.slice(i, i + batchSize);
        await this.retrieveFundsBatch(batch, delayMs);
        
        // Delay between batches
        await this.delay(delayMs);
      }

      this.logger.info('Fund retrieval completed');

    } catch (error) {
      this.logger.error('Fund retrieval failed', error);
      throw error;
    }
  }

  /**
   * Retrieve funds from a batch of wallets
   */
  private async retrieveFundsBatch(wallets: Keypair[], delayMs: number): Promise<void> {
    this.logger.info(`Retrieving funds from batch of ${wallets.length} wallets`);

    for (const wallet of wallets) {
      try {
        await this.walletManager.retrieveFunds(wallet);
        await this.delay(delayMs);
      } catch (error) {
        this.logger.error('Failed to retrieve funds from wallet', {
          wallet: wallet.publicKey.toString(),
          error
        });
      }
    }
  }

  /**
   * Get random amount within range
   */
  private getRandomAmount(range: { min: number; max: number }): number {
    const rangeSize = range.max - range.min;
    const randomValue = Math.random() * rangeSize;
    return range.min + randomValue;
  }

  /**
   * Get random wallet count within range
   */
  private getRandomWalletCount(range: { min: number; max: number }): number {
    const rangeSize = range.max - range.min;
    const randomValue = Math.random() * rangeSize;
    return Math.floor(range.min + randomValue);
  }

  /**
   * Get random delay within range
   */
  private getRandomDelay(range: { min: number; max: number }): number {
    const rangeSize = range.max - range.min;
    const randomValue = Math.random() * rangeSize;
    return range.min + randomValue;
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Stop the trading engine
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping trading engine');
    this.isRunning = false;
  }

  /**
   * Check if the engine is running
   */
  isEngineRunning(): boolean {
    return this.isRunning;
  }
}
