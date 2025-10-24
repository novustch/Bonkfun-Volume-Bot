/**
 * WalletManager - Manages wallet creation, storage, and operations
 * 
 * Handles wallet lifecycle, keypair management, and fund operations.
 */

import { Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { ConfigManager } from '../core/ConfigManager';
import { Logger } from '../utils/Logger';
import { WalletInfo } from '../types';
import fs from 'fs';
import path from 'path';

export class WalletManager {
  private logger: Logger;
  private configManager: ConfigManager;
  private walletsDir: string;
  private backupDir: string;

  constructor(configManager: ConfigManager) {
    this.logger = new Logger('WalletManager');
    this.configManager = configManager;
    this.walletsDir = path.join(process.cwd(), 'data', 'wallets');
    this.backupDir = path.join(process.cwd(), 'data', 'backup');
    
    this.ensureDirectories();
  }

  /**
   * Create multiple wallets
   */
  async createWallets(count: number): Promise<Keypair[]> {
    this.logger.info(`Creating ${count} wallets`);
    
    const wallets: Keypair[] = [];
    
    for (let i = 0; i < count; i++) {
      try {
        const wallet = Keypair.generate();
        await this.saveWallet(wallet);
        wallets.push(wallet);
        
        this.logger.debug(`Created wallet ${i + 1}/${count}`, {
          publicKey: wallet.publicKey.toString()
        });
      } catch (error) {
        this.logger.error(`Failed to create wallet ${i + 1}`, error);
      }
    }
    
    this.logger.info(`Successfully created ${wallets.length}/${count} wallets`);
    return wallets;
  }

  /**
   * Save wallet to disk
   */
  private async saveWallet(wallet: Keypair, tokenMint?: string): Promise<void> {
    const walletInfo: WalletInfo = {
      keypair: wallet,
      publicKey: wallet.publicKey,
      balance: 0,
      tokenBalance: 0,
      createdAt: new Date(),
      transactionCount: 0
    };

    const filename = `wallet_${wallet.publicKey.toString()}.json`;
    const filePath = path.join(this.walletsDir, filename);
    
    // Save wallet data (excluding the keypair for security)
    const walletData = {
      publicKey: wallet.publicKey.toString(),
      secretKey: Array.from(wallet.secretKey),
      balance: walletInfo.balance,
      tokenBalance: walletInfo.tokenBalance,
      createdAt: walletInfo.createdAt.toISOString(),
      transactionCount: walletInfo.transactionCount
    };

    fs.writeFileSync(filePath, JSON.stringify(walletData, null, 2));
    
    this.logger.debug(`Wallet saved`, {
      publicKey: wallet.publicKey.toString(),
      filePath
    });
  }

  /**
   * Load wallet from disk
   */
  async loadWallet(publicKey: string): Promise<Keypair | null> {
    try {
      const filename = `wallet_${publicKey}.json`;
      const filePath = path.join(this.walletsDir, filename);
      
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const walletData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const keypair = Keypair.fromSecretKey(new Uint8Array(walletData.secretKey));
      
      this.logger.debug(`Wallet loaded`, { publicKey });
      return keypair;
    } catch (error) {
      this.logger.error(`Failed to load wallet ${publicKey}`, error);
      return null;
    }
  }

  /**
   * Get wallets for selling (older than 30 seconds)
   */
  async getWalletsForSelling(tokenMint: string): Promise<Keypair[]> {
    this.logger.info(`Getting wallets for selling (token: ${tokenMint})`);
    
    const wallets: Keypair[] = [];
    const tokenWalletsDir = path.join(this.walletsDir, tokenMint);
    
    if (!fs.existsSync(tokenWalletsDir)) {
      this.logger.info('No wallets directory found for token');
      return wallets;
    }

    const files = fs.readdirSync(tokenWalletsDir);
    const now = Date.now();
    const minAge = 30000; // 30 seconds

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const filePath = path.join(tokenWalletsDir, file);
        const stats = fs.statSync(filePath);
        const age = now - stats.birthtime.getTime();

        if (age >= minAge) {
          const walletData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          const keypair = Keypair.fromSecretKey(new Uint8Array(walletData.secretKey));
          wallets.push(keypair);
        }
      } catch (error) {
        this.logger.error(`Failed to process wallet file ${file}`, error);
      }
    }

    this.logger.info(`Found ${wallets.length} wallets ready for selling`);
    return wallets;
  }

  /**
   * Get all wallets for a token
   */
  async getAllWallets(tokenMint: string): Promise<Keypair[]> {
    this.logger.info(`Getting all wallets for token: ${tokenMint}`);
    
    const wallets: Keypair[] = [];
    const tokenWalletsDir = path.join(this.walletsDir, tokenMint);
    
    if (!fs.existsSync(tokenWalletsDir)) {
      return wallets;
    }

    const files = fs.readdirSync(tokenWalletsDir);

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const filePath = path.join(tokenWalletsDir, file);
        const walletData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const keypair = Keypair.fromSecretKey(new Uint8Array(walletData.secretKey));
        wallets.push(keypair);
      } catch (error) {
        this.logger.error(`Failed to load wallet from ${file}`, error);
      }
    }

    this.logger.info(`Loaded ${wallets.length} wallets for token ${tokenMint}`);
    return wallets;
  }

  /**
   * Retrieve funds from a wallet
   */
  async retrieveFunds(wallet: Keypair): Promise<void> {
    this.logger.info(`Retrieving funds from wallet: ${wallet.publicKey.toString()}`);
    
    try {
      const connection = this.configManager.getConnection();
      const mainWallet = this.configManager.getWallet();
      
      // Get wallet balance
      const balance = await connection.getBalance(wallet.publicKey);
      
      if (balance <= 5000) { // Less than rent exemption
        this.logger.debug(`Wallet has insufficient balance: ${balance} lamports`);
        return;
      }

      // Transfer remaining balance to main wallet
      const transferAmount = balance - 5000; // Leave some for rent
      
      const { SystemProgram } = await import('@solana/web3.js');
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: mainWallet.publicKey,
        lamports: transferAmount
      });

      const { TransactionMessage, VersionedTransaction } = await import('@solana/web3.js');
      const blockhash = await connection.getLatestBlockhash();
      
      const message = new TransactionMessage({
        payerKey: wallet.publicKey,
        recentBlockhash: blockhash.blockhash,
        instructions: [transferInstruction]
      }).compileToV0Message();

      const transaction = new VersionedTransaction(message);
      transaction.sign([wallet]);

      const signature = await connection.sendTransaction(transaction);
      await connection.confirmTransaction(signature);

      this.logger.info(`Funds retrieved successfully`, {
        signature,
        amount: transferAmount / LAMPORTS_PER_SOL,
        wallet: wallet.publicKey.toString()
      });

    } catch (error) {
      this.logger.error(`Failed to retrieve funds from wallet ${wallet.publicKey.toString()}`, error);
      throw error;
    }
  }

  /**
   * Delete wallet file
   */
  async deleteWallet(wallet: Keypair, tokenMint?: string): Promise<void> {
    const filename = `wallet_${wallet.publicKey.toString()}.json`;
    const filePath = path.join(this.walletsDir, filename);
    
    try {
      if (fs.existsSync(filePath)) {
        // Backup before deletion
        await this.backupWallet(wallet);
        fs.unlinkSync(filePath);
        
        this.logger.debug(`Wallet deleted`, {
          publicKey: wallet.publicKey.toString(),
          filePath
        });
      }
    } catch (error) {
      this.logger.error(`Failed to delete wallet ${wallet.publicKey.toString()}`, error);
    }
  }

  /**
   * Backup wallet before deletion
   */
  private async backupWallet(wallet: Keypair): Promise<void> {
    try {
      const filename = `wallet_${wallet.publicKey.toString()}.json`;
      const sourcePath = path.join(this.walletsDir, filename);
      const backupPath = path.join(this.backupDir, filename);
      
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, backupPath);
        this.logger.debug(`Wallet backed up`, { backupPath });
      }
    } catch (error) {
      this.logger.error(`Failed to backup wallet ${wallet.publicKey.toString()}`, error);
    }
  }

  /**
   * Get wallet status
   */
  async getWalletStatus(): Promise<{
    mainWalletBalance: number;
    activeWallets: number;
    totalWallets: number;
  }> {
    try {
      const connection = this.configManager.getConnection();
      const mainWallet = this.configManager.getWallet();
      
      const mainBalance = await connection.getBalance(mainWallet.publicKey);
      
      // Count active wallets
      let activeWallets = 0;
      let totalWallets = 0;
      
      if (fs.existsSync(this.walletsDir)) {
        const files = fs.readdirSync(this.walletsDir);
        totalWallets = files.filter(file => file.endsWith('.json')).length;
        
        // Count wallets with balance > 0
        for (const file of files) {
          if (!file.endsWith('.json')) continue;
          
          try {
            const filePath = path.join(this.walletsDir, file);
            const walletData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const keypair = Keypair.fromSecretKey(new Uint8Array(walletData.secretKey));
            const balance = await connection.getBalance(keypair.publicKey);
            
            if (balance > 0) {
              activeWallets++;
            }
          } catch (error) {
            // Skip invalid wallets
          }
        }
      }
      
      return {
        mainWalletBalance: mainBalance / LAMPORTS_PER_SOL,
        activeWallets,
        totalWallets
      };
    } catch (error) {
      this.logger.error('Failed to get wallet status', error);
      return {
        mainWalletBalance: 0,
        activeWallets: 0,
        totalWallets: 0
      };
    }
  }

  /**
   * Clean up old wallets
   */
  async cleanupOldWallets(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
    this.logger.info(`Cleaning up wallets older than ${maxAge}ms`);
    
    if (!fs.existsSync(this.walletsDir)) {
      return;
    }

    const files = fs.readdirSync(this.walletsDir);
    const now = Date.now();
    let cleanedCount = 0;

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const filePath = path.join(this.walletsDir, file);
        const stats = fs.statSync(filePath);
        const age = now - stats.birthtime.getTime();

        if (age > maxAge) {
          const walletData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          const keypair = Keypair.fromSecretKey(new Uint8Array(walletData.secretKey));
          
          await this.deleteWallet(keypair);
          cleanedCount++;
        }
      } catch (error) {
        this.logger.error(`Failed to clean up wallet file ${file}`, error);
      }
    }

    this.logger.info(`Cleaned up ${cleanedCount} old wallets`);
  }

  /**
   * Ensure required directories exist
   */
  private ensureDirectories(): void {
    const dirs = [this.walletsDir, this.backupDir];
    
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        this.logger.debug(`Created directory: ${dir}`);
      }
    }
  }
}
