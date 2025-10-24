/**
 * Type definitions for the Bonk.fun Volume Bot
 */

import { PublicKey, Keypair } from '@solana/web3.js';

/**
 * Main bot configuration interface
 */
export interface BotConfig {
  tokenMint: string;
  buyAmount: {
    min: number;
    max: number;
  };
  sellAmount: {
    min: number;
    max: number;
  };
  walletCount: {
    min: number;
    max: number;
  };
  delay: {
    min: number;
    max: number;
  };
  cycles: number;
  jitoTip: number;
  dryRun?: boolean;
}

/**
 * Network configuration
 */
export interface NetworkConfig {
  rpcUrl: string;
  wsEndpoint?: string;
  commitment: 'processed' | 'confirmed' | 'finalized';
  isMainnet: boolean;
}

/**
 * Trading session interface
 */
export class TradingSession {
  public readonly id: string;
  public readonly config: BotConfig;
  public readonly startTime: Date;
  public endTime?: Date;
  public isActive: boolean = false;
  public totalTransactions: number = 0;
  public successfulTransactions: number = 0;
  public failedTransactions: number = 0;
  public totalVolume: number = 0;

  constructor(config: BotConfig) {
    this.id = this.generateSessionId();
    this.config = config;
    this.startTime = new Date();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public getDuration(): number {
    const endTime = this.endTime || new Date();
    return endTime.getTime() - this.startTime.getTime();
  }

  public getSuccessRate(): number {
    if (this.totalTransactions === 0) return 0;
    return (this.successfulTransactions / this.totalTransactions) * 100;
  }
}

/**
 * Wallet information interface
 */
export interface WalletInfo {
  keypair: Keypair;
  publicKey: PublicKey;
  balance: number;
  tokenBalance: number;
  createdAt: Date;
  lastUsed?: Date;
  transactionCount: number;
}

/**
 * Trading metrics interface
 */
export interface TradingMetrics {
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  successRate: number;
  totalVolume: number;
  averageTransactionTime: number;
  totalFees: number;
  profitLoss: number;
}

/**
 * Transaction result interface
 */
export interface TransactionResult {
  signature: string;
  success: boolean;
  error?: string;
  executionTime: number;
  gasUsed?: number;
  volume?: number;
}

/**
 * Pool information interface
 */
export interface PoolInfo {
  poolId: PublicKey;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  baseVault: PublicKey;
  quoteVault: PublicKey;
  baseDecimals: number;
  quoteDecimals: number;
  virtualBase: number;
  virtualQuote: number;
  realBase: number;
  realQuote: number;
  globalConfig: PublicKey;
  platformConfig: PublicKey;
}

/**
 * Swap quote interface
 */
export interface SwapQuote {
  inputAmount: number;
  outputAmount: number;
  priceImpact: number;
  fee: number;
  slippage: number;
  minimumAmountOut: number;
}

/**
 * Error types
 */
export enum ErrorType {
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TRANSACTION_ERROR = 'TRANSACTION_ERROR',
  WALLET_ERROR = 'WALLET_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Custom error class
 */
export class BotError extends Error {
  public readonly type: ErrorType;
  public readonly timestamp: Date;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    type: ErrorType = ErrorType.UNKNOWN_ERROR,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = 'BotError';
    this.type = type;
    this.timestamp = new Date();
    this.context = context;
  }
}

/**
 * Log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Log entry interface
 */
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: Error;
}

/**
 * Event types for the event system
 */
export enum EventType {
  SESSION_STARTED = 'SESSION_STARTED',
  SESSION_ENDED = 'SESSION_ENDED',
  TRANSACTION_SENT = 'TRANSACTION_SENT',
  TRANSACTION_CONFIRMED = 'TRANSACTION_CONFIRMED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  WALLET_CREATED = 'WALLET_CREATED',
  WALLET_DELETED = 'WALLET_DELETED',
  ERROR_OCCURRED = 'ERROR_OCCURRED',
  METRICS_UPDATED = 'METRICS_UPDATED',
}

/**
 * Event interface
 */
export interface BotEvent {
  type: EventType;
  timestamp: Date;
  data?: Record<string, any>;
}

/**
 * Event listener function type
 */
export type EventListener = (event: BotEvent) => void | Promise<void>;

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
};
