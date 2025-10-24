/**
 * ConfigManager - Handles configuration loading and validation
 * 
 * Manages environment variables, configuration files, and validation.
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import NodeWallet from '@coral-xyz/anchor/dist/cjs/nodewallet';
import bs58 from 'bs58';
import dotenv from 'dotenv';
import { Logger } from '../utils/Logger';
import { BotConfig, NetworkConfig } from '../types';
import fs from 'fs';
import path from 'path';

export class ConfigManager {
  private logger: Logger;
  private connection: Connection | null = null;
  private wallet: Keypair | null = null;
  private provider: anchor.AnchorProvider | null = null;
  private config: BotConfig | null = null;

  constructor() {
    this.logger = new Logger('ConfigManager');
  }

  /**
   * Load configuration from environment and files
   */
  async loadConfig(): Promise<void> {
    this.logger.info('Loading configuration');
    
    // Load environment variables
    dotenv.config();
    
    // Validate required environment variables
    this.validateEnvironmentVariables();
    
    // Initialize connection
    await this.initializeConnection();
    
    // Initialize wallet
    this.initializeWallet();
    
    // Initialize provider
    this.initializeProvider();
    
    this.logger.info('Configuration loaded successfully');
  }

  /**
   * Load configuration from a specific file
   */
  async loadConfigFromFile(configPath: string): Promise<BotConfig> {
    this.logger.info(`Loading configuration from file: ${configPath}`);
    
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }
    
    const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const config = this.validateConfig(configData);
    
    this.config = config;
    return config;
  }

  /**
   * Validate required environment variables
   */
  private validateEnvironmentVariables(): void {
    const requiredVars = ['RPC', 'SECRET_KEY', 'API_KEY'];
    const missingVars: string[] = [];

    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        missingVars.push(varName);
      }
    }

    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
  }

  /**
   * Initialize Solana connection
   */
  private async initializeConnection(): Promise<void> {
    const rpcUrl = process.env.RPC!;
    
    this.logger.info(`Connecting to RPC: ${rpcUrl}`);
    
    this.connection = new Connection(rpcUrl, {
      commitment: 'confirmed',
      wsEndpoint: process.env.WS_ENDPOINT,
    });

    // Test connection
    try {
      const version = await this.connection.getVersion();
      this.logger.info(`Connected to Solana cluster: ${version['solana-core']}`);
    } catch (error) {
      throw new Error(`Failed to connect to Solana RPC: ${error}`);
    }
  }

  /**
   * Initialize wallet from secret key
   */
  private initializeWallet(): void {
    const secretKey = process.env.SECRET_KEY!;
    
    try {
      this.wallet = Keypair.fromSecretKey(bs58.decode(secretKey));
      this.logger.info(`Wallet initialized: ${this.wallet.publicKey.toString()}`);
    } catch (error) {
      throw new Error(`Failed to initialize wallet: ${error}`);
    }
  }

  /**
   * Initialize Anchor provider
   */
  private initializeProvider(): void {
    if (!this.connection || !this.wallet) {
      throw new Error('Connection and wallet must be initialized before creating provider');
    }

    const providerWallet = new NodeWallet(this.wallet);
    this.provider = new anchor.AnchorProvider(this.connection, providerWallet, {
      commitment: 'confirmed',
    });

    this.logger.info('Anchor provider initialized');
  }

  /**
   * Validate configuration object
   */
  private validateConfig(config: any): BotConfig {
    const errors: string[] = [];

    // Validate token mint
    if (!config.tokenMint || typeof config.tokenMint !== 'string') {
      errors.push('tokenMint is required and must be a string');
    } else {
      try {
        new PublicKey(config.tokenMint);
      } catch {
        errors.push('tokenMint must be a valid Solana public key');
      }
    }

    // Validate buy amount
    if (!config.buyAmount || typeof config.buyAmount !== 'object') {
      errors.push('buyAmount is required and must be an object');
    } else {
      if (typeof config.buyAmount.min !== 'number' || config.buyAmount.min <= 0) {
        errors.push('buyAmount.min must be a positive number');
      }
      if (typeof config.buyAmount.max !== 'number' || config.buyAmount.max <= 0) {
        errors.push('buyAmount.max must be a positive number');
      }
      if (config.buyAmount.min > config.buyAmount.max) {
        errors.push('buyAmount.min must be less than or equal to buyAmount.max');
      }
    }

    // Validate sell amount
    if (!config.sellAmount || typeof config.sellAmount !== 'object') {
      errors.push('sellAmount is required and must be an object');
    } else {
      if (typeof config.sellAmount.min !== 'number' || config.sellAmount.min <= 0) {
        errors.push('sellAmount.min must be a positive number');
      }
      if (typeof config.sellAmount.max !== 'number' || config.sellAmount.max <= 0) {
        errors.push('sellAmount.max must be a positive number');
      }
      if (config.sellAmount.min > config.sellAmount.max) {
        errors.push('sellAmount.min must be less than or equal to sellAmount.max');
      }
    }

    // Validate wallet count
    if (!config.walletCount || typeof config.walletCount !== 'object') {
      errors.push('walletCount is required and must be an object');
    } else {
      if (typeof config.walletCount.min !== 'number' || config.walletCount.min <= 0) {
        errors.push('walletCount.min must be a positive number');
      }
      if (typeof config.walletCount.max !== 'number' || config.walletCount.max <= 0) {
        errors.push('walletCount.max must be a positive number');
      }
      if (config.walletCount.min > config.walletCount.max) {
        errors.push('walletCount.min must be less than or equal to walletCount.max');
      }
    }

    // Validate delay
    if (!config.delay || typeof config.delay !== 'object') {
      errors.push('delay is required and must be an object');
    } else {
      if (typeof config.delay.min !== 'number' || config.delay.min < 0) {
        errors.push('delay.min must be a non-negative number');
      }
      if (typeof config.delay.max !== 'number' || config.delay.max < 0) {
        errors.push('delay.max must be a non-negative number');
      }
      if (config.delay.min > config.delay.max) {
        errors.push('delay.min must be less than or equal to delay.max');
      }
    }

    // Validate cycles
    if (typeof config.cycles !== 'number' || config.cycles <= 0) {
      errors.push('cycles must be a positive number');
    }

    // Validate jito tip
    if (typeof config.jitoTip !== 'number' || config.jitoTip < 0) {
      errors.push('jitoTip must be a non-negative number');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }

    return config as BotConfig;
  }

  /**
   * Get the Solana connection
   */
  getConnection(): Connection {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }
    return this.connection;
  }

  /**
   * Get the wallet keypair
   */
  getWallet(): Keypair {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }
    return this.wallet;
  }

  /**
   * Get the Anchor provider
   */
  getProvider(): anchor.AnchorProvider {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }
    return this.provider;
  }

  /**
   * Get the current configuration
   */
  getConfig(): BotConfig | null {
    return this.config;
  }

  /**
   * Get network configuration
   */
  getNetworkConfig(): NetworkConfig {
    return {
      rpcUrl: process.env.RPC!,
      wsEndpoint: process.env.WS_ENDPOINT,
      commitment: 'confirmed',
      isMainnet: process.env.NETWORK !== 'devnet',
    };
  }

  /**
   * Get Jito configuration
   */
  getJitoConfig(): { apiKey: string; tipAccount: string } {
    return {
      apiKey: process.env.API_KEY!,
      tipAccount: process.env.TIP_ACCOUNT || 'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
    };
  }

  /**
   * Check if debug mode is enabled
   */
  isDebugMode(): boolean {
    return process.env.DEBUG?.toLowerCase() === 'true';
  }

  /**
   * Save configuration to file
   */
  async saveConfig(config: BotConfig, filePath: string): Promise<void> {
    this.logger.info(`Saving configuration to: ${filePath}`);
    
    const configDir = path.dirname(filePath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
    this.logger.info('Configuration saved successfully');
  }
}
