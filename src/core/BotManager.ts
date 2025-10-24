/**
 * BotManager - Central management class for the trading bot
 * 
 * Handles bot lifecycle, configuration, and execution coordination.
 */

import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { ConfigManager } from './ConfigManager';
import { TradingEngine } from '../engines/TradingEngine';
import { WalletManager } from '../managers/WalletManager';
import { Logger } from '../utils/Logger';
import { MetricsCollector } from '../utils/MetricsCollector';
import { BotConfig, TradingSession } from '../types';
import chalk from 'chalk';
import promptSync from 'prompt-sync';

const prompt = promptSync();

export class BotManager {
  private logger: Logger;
  private configManager: ConfigManager;
  private tradingEngine: TradingEngine;
  private walletManager: WalletManager;
  private metricsCollector: MetricsCollector;
  private isRunning: boolean = false;

  constructor(configManager: ConfigManager) {
    this.logger = new Logger('BotManager');
    this.configManager = configManager;
    this.metricsCollector = new MetricsCollector();
    this.tradingEngine = new TradingEngine(configManager, this.metricsCollector);
    this.walletManager = new WalletManager(configManager);
  }

  /**
   * Run the bot in interactive mode
   */
  async runInteractive(): Promise<void> {
    this.logger.info('Starting interactive mode');
    
    while (true) {
      try {
        await this.displayMainMenu();
        const choice = prompt(chalk.yellow('Choose an option: '));
        
        switch (choice) {
          case '1':
            await this.startTradingSession();
            break;
          case '2':
            await this.retrieveFunds();
            break;
          case '3':
            await this.viewMetrics();
            break;
          case '4':
            await this.updateConfiguration();
            break;
          case '5':
            await this.viewWalletStatus();
            break;
          case 'exit':
          case 'quit':
            this.logger.info('Exiting application');
            return;
          default:
            console.log(chalk.red('Invalid option, please try again.'));
        }
      } catch (error) {
        this.logger.error('Error in interactive mode:', error);
        console.log(chalk.red('An error occurred. Please try again.'));
      }
    }
  }

  /**
   * Run the bot with a configuration file
   */
  async runWithConfig(configPath: string): Promise<void> {
    this.logger.info(`Loading configuration from: ${configPath}`);
    
    try {
      const config = await this.configManager.loadConfigFromFile(configPath);
      await this.executeTradingSession(config);
    } catch (error) {
      this.logger.error('Failed to run with config:', error);
      throw error;
    }
  }

  /**
   * Display the main menu
   */
  private async displayMainMenu(): Promise<void> {
    console.clear();
    console.log(chalk.cyan('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║                    Bonk.fun Volume Bot                      ║'));
    console.log(chalk.cyan('║                    Professional Edition                      ║'));
    console.log(chalk.cyan('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');

    const balance = await this.getMainWalletBalance();
    console.log(chalk.green(`Main Wallet Balance: ${balance.toFixed(4)} SOL`));
    console.log('');

    console.log(chalk.green('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.green('║                         Main Menu                           ║'));
    console.log(chalk.green('╠══════════════════════════════════════════════════════════════╣'));
    console.log(chalk.green('║ 1. Start Trading Session                                    ║'));
    console.log(chalk.green('║ 2. Retrieve Funds from Wallets                             ║'));
    console.log(chalk.green('║ 3. View Trading Metrics                                     ║'));
    console.log(chalk.green('║ 4. Update Configuration                                      ║'));
    console.log(chalk.green('║ 5. View Wallet Status                                       ║'));
    console.log(chalk.green('║                                                              ║'));
    console.log(chalk.green('║ Type "exit" to quit                                         ║'));
    console.log(chalk.green('╚══════════════════════════════════════════════════════════════╝'));
  }

  /**
   * Start a new trading session
   */
  private async startTradingSession(): Promise<void> {
    this.logger.info('Starting trading session');
    
    try {
      const config = await this.promptTradingConfiguration();
      await this.executeTradingSession(config);
    } catch (error) {
      this.logger.error('Failed to start trading session:', error);
      console.log(chalk.red('Failed to start trading session. Please check your configuration.'));
    }
  }

  /**
   * Prompt user for trading configuration
   */
  private async promptTradingConfiguration(): Promise<BotConfig> {
    console.log(chalk.cyan('\n═══════════════════════════════════════════════════════════════'));
    console.log(chalk.cyan('                    Trading Configuration                       '));
    console.log(chalk.cyan('═══════════════════════════════════════════════════════════════'));

    const tokenMint = prompt(chalk.cyan('Token Mint Address: '));
    const buyAmountMin = parseFloat(prompt(chalk.cyan('Minimum Buy Amount (SOL): ')));
    const buyAmountMax = parseFloat(prompt(chalk.cyan('Maximum Buy Amount (SOL): ')));
    const sellAmountMin = parseFloat(prompt(chalk.cyan('Minimum Sell Amount (SOL): ')));
    const sellAmountMax = parseFloat(prompt(chalk.cyan('Maximum Sell Amount (SOL): ')));
    const walletCountMin = parseInt(prompt(chalk.cyan('Minimum Wallets per Cycle: ')));
    const walletCountMax = parseInt(prompt(chalk.cyan('Maximum Wallets per Cycle: ')));
    const delayMin = parseInt(prompt(chalk.cyan('Minimum Delay (seconds): ')));
    const delayMax = parseInt(prompt(chalk.cyan('Maximum Delay (seconds): ')));
    const cycles = parseInt(prompt(chalk.cyan('Number of Cycles: ')));
    const jitoTip = parseFloat(prompt(chalk.cyan('Jito Tip (SOL): ')));

    return {
      tokenMint,
      buyAmount: { min: buyAmountMin, max: buyAmountMax },
      sellAmount: { min: sellAmountMin, max: sellAmountMax },
      walletCount: { min: walletCountMin, max: walletCountMax },
      delay: { min: delayMin, max: delayMax },
      cycles,
      jitoTip,
      dryRun: false
    };
  }

  /**
   * Execute a trading session
   */
  private async executeTradingSession(config: BotConfig): Promise<void> {
    this.logger.info('Executing trading session', { config });
    
    try {
      this.isRunning = true;
      const session = new TradingSession(config);
      
      await this.tradingEngine.executeSession(session);
      
      this.logger.info('Trading session completed successfully');
    } catch (error) {
      this.logger.error('Trading session failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Retrieve funds from all wallets
   */
  private async retrieveFunds(): Promise<void> {
    this.logger.info('Starting fund retrieval');
    
    try {
      const tokenMint = prompt(chalk.cyan('Token Mint Address: '));
      const delayMs = parseInt(prompt(chalk.cyan('Delay between sells (ms): ')));
      
      await this.tradingEngine.retrieveFunds(tokenMint, delayMs);
      
      console.log(chalk.green('Fund retrieval completed successfully'));
    } catch (error) {
      this.logger.error('Fund retrieval failed:', error);
      console.log(chalk.red('Fund retrieval failed. Please check the logs.'));
    }
  }

  /**
   * View trading metrics
   */
  private async viewMetrics(): Promise<void> {
    console.log(chalk.cyan('\n═══════════════════════════════════════════════════════════════'));
    console.log(chalk.cyan('                        Trading Metrics                        '));
    console.log(chalk.cyan('═══════════════════════════════════════════════════════════════'));
    
    const metrics = this.metricsCollector.getMetrics();
    
    console.log(chalk.green(`Total Transactions: ${metrics.totalTransactions}`));
    console.log(chalk.green(`Successful Transactions: ${metrics.successfulTransactions}`));
    console.log(chalk.green(`Failed Transactions: ${metrics.failedTransactions}`));
    console.log(chalk.green(`Success Rate: ${metrics.successRate.toFixed(2)}%`));
    console.log(chalk.green(`Total Volume: ${metrics.totalVolume.toFixed(4)} SOL`));
    console.log(chalk.green(`Average Transaction Time: ${metrics.averageTransactionTime.toFixed(2)}ms`));
    
    prompt(chalk.yellow('\nPress Enter to continue...'));
  }

  /**
   * Update configuration
   */
  private async updateConfiguration(): Promise<void> {
    console.log(chalk.cyan('\nConfiguration update not implemented yet.'));
    prompt(chalk.yellow('Press Enter to continue...'));
  }

  /**
   * View wallet status
   */
  private async viewWalletStatus(): Promise<void> {
    console.log(chalk.cyan('\n═══════════════════════════════════════════════════════════════'));
    console.log(chalk.cyan('                        Wallet Status                         '));
    console.log(chalk.cyan('═══════════════════════════════════════════════════════════════'));
    
    const status = await this.walletManager.getWalletStatus();
    
    console.log(chalk.green(`Main Wallet Balance: ${status.mainWalletBalance.toFixed(4)} SOL`));
    console.log(chalk.green(`Active Wallets: ${status.activeWallets}`));
    console.log(chalk.green(`Total Wallets: ${status.totalWallets}`));
    
    prompt(chalk.yellow('\nPress Enter to continue...'));
  }

  /**
   * Get main wallet balance
   */
  private async getMainWalletBalance(): Promise<number> {
    try {
      const wallet = this.configManager.getWallet();
      const balance = await this.configManager.getConnection().getBalance(wallet.publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      this.logger.error('Failed to get wallet balance:', error);
      return 0;
    }
  }

  /**
   * Check if the bot is currently running
   */
  public isBotRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Stop the bot gracefully
   */
  public async stop(): Promise<void> {
    this.logger.info('Stopping bot...');
    this.isRunning = false;
    await this.tradingEngine.stop();
  }
}
