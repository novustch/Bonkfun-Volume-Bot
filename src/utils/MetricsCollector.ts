/**
 * MetricsCollector - Collects and manages trading metrics
 * 
 * Tracks performance metrics, transaction statistics, and system health.
 */

import { TradingMetrics, TransactionResult } from '../types';
import { Logger } from './Logger';

export class MetricsCollector {
  private logger: Logger;
  private metrics: TradingMetrics;
  private transactionTimes: number[];
  private startTime: Date;

  constructor() {
    this.logger = new Logger('MetricsCollector');
    this.metrics = {
      totalTransactions: 0,
      successfulTransactions: 0,
      failedTransactions: 0,
      successRate: 0,
      totalVolume: 0,
      averageTransactionTime: 0,
      totalFees: 0,
      profitLoss: 0,
    };
    this.transactionTimes = [];
    this.startTime = new Date();
  }

  /**
   * Record a transaction result
   */
  recordTransaction(result: TransactionResult): void {
    this.metrics.totalTransactions++;
    
    if (result.success) {
      this.metrics.successfulTransactions++;
    } else {
      this.metrics.failedTransactions++;
    }

    // Update success rate
    this.metrics.successRate = this.calculateSuccessRate();

    // Record transaction time
    this.transactionTimes.push(result.executionTime);
    this.metrics.averageTransactionTime = this.calculateAverageTransactionTime();

    // Record volume if available
    if (result.volume) {
      this.metrics.totalVolume += result.volume;
    }

    // Record fees if available
    if (result.gasUsed) {
      this.metrics.totalFees += result.gasUsed;
    }

    this.logger.debug('Transaction recorded', {
      signature: result.signature,
      success: result.success,
      executionTime: result.executionTime,
      volume: result.volume,
    });
  }

  /**
   * Record a volume transaction
   */
  recordVolume(volume: number): void {
    this.metrics.totalVolume += volume;
    this.logger.debug('Volume recorded', { volume, totalVolume: this.metrics.totalVolume });
  }

  /**
   * Record fees
   */
  recordFees(fees: number): void {
    this.metrics.totalFees += fees;
    this.logger.debug('Fees recorded', { fees, totalFees: this.metrics.totalFees });
  }

  /**
   * Record profit/loss
   */
  recordProfitLoss(amount: number): void {
    this.metrics.profitLoss += amount;
    this.logger.debug('Profit/Loss recorded', { amount, totalProfitLoss: this.metrics.profitLoss });
  }

  /**
   * Get current metrics
   */
  getMetrics(): TradingMetrics {
    return { ...this.metrics };
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(): string {
    const uptime = this.getUptime();
    const transactionsPerMinute = this.metrics.totalTransactions / (uptime / 60000);
    
    return `
╔══════════════════════════════════════════════════════════════╗
║                    Trading Metrics Summary                  ║
╠══════════════════════════════════════════════════════════════╣
║ Total Transactions: ${this.metrics.totalTransactions.toString().padEnd(40)} ║
║ Successful: ${this.metrics.successfulTransactions.toString().padEnd(45)} ║
║ Failed: ${this.metrics.failedTransactions.toString().padEnd(48)} ║
║ Success Rate: ${this.metrics.successRate.toFixed(2)}%${' '.repeat(37)} ║
║ Total Volume: ${this.metrics.totalVolume.toFixed(4)} SOL${' '.repeat(33)} ║
║ Average TX Time: ${this.metrics.averageTransactionTime.toFixed(2)}ms${' '.repeat(30)} ║
║ Total Fees: ${this.metrics.totalFees.toFixed(6)} SOL${' '.repeat(35)} ║
║ Profit/Loss: ${this.metrics.profitLoss.toFixed(4)} SOL${' '.repeat(33)} ║
║ Uptime: ${this.formatUptime(uptime).padEnd(44)} ║
║ TX/Minute: ${transactionsPerMinute.toFixed(2)}${' '.repeat(36)} ║
╚══════════════════════════════════════════════════════════════╝
    `.trim();
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = {
      totalTransactions: 0,
      successfulTransactions: 0,
      failedTransactions: 0,
      successRate: 0,
      totalVolume: 0,
      averageTransactionTime: 0,
      totalFees: 0,
      profitLoss: 0,
    };
    this.transactionTimes = [];
    this.startTime = new Date();
    this.logger.info('Metrics reset');
  }

  /**
   * Export metrics to JSON
   */
  exportMetrics(): string {
    const exportData = {
      ...this.metrics,
      uptime: this.getUptime(),
      startTime: this.startTime.toISOString(),
      transactionTimes: this.transactionTimes,
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Calculate success rate
   */
  private calculateSuccessRate(): number {
    if (this.metrics.totalTransactions === 0) return 0;
    return (this.metrics.successfulTransactions / this.metrics.totalTransactions) * 100;
  }

  /**
   * Calculate average transaction time
   */
  private calculateAverageTransactionTime(): number {
    if (this.transactionTimes.length === 0) return 0;
    return this.transactionTimes.reduce((sum, time) => sum + time, 0) / this.transactionTimes.length;
  }

  /**
   * Get uptime in milliseconds
   */
  private getUptime(): number {
    return Date.now() - this.startTime.getTime();
  }

  /**
   * Format uptime as human-readable string
   */
  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    transactionsPerSecond: number;
    volumePerSecond: number;
    averageTransactionTime: number;
    successRate: number;
  } {
    const uptime = this.getUptime() / 1000; // Convert to seconds
    
    return {
      transactionsPerSecond: this.metrics.totalTransactions / uptime,
      volumePerSecond: this.metrics.totalVolume / uptime,
      averageTransactionTime: this.metrics.averageTransactionTime,
      successRate: this.metrics.successRate,
    };
  }

  /**
   * Check if metrics indicate healthy operation
   */
  isHealthy(): boolean {
    const stats = this.getPerformanceStats();
    
    // Consider healthy if:
    // - Success rate is above 80%
    // - Average transaction time is below 30 seconds
    // - We have at least some transactions
    return (
      this.metrics.totalTransactions > 0 &&
      this.metrics.successRate >= 80 &&
      this.metrics.averageTransactionTime <= 30000
    );
  }
}
