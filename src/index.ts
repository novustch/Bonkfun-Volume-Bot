/**
 * Bonk.fun Volume Bot - Professional Entry Point
 * 
 * A high-performance automated trading bot for Bonk.fun tokens on Raydium LaunchLab.
 * This is the main entry point for the application.
 * 
 * @author NovusTech LLC
 * @version 2.0.0
 */

import { program } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import { BotManager } from './core/BotManager';
import { ConfigManager } from './core/ConfigManager';
import { Logger } from './utils/Logger';
import { version } from '../package.json';

// Suppress specific warning types
process.env.NODE_NO_WARNINGS = "1";
process.env.NODE_OPTIONS = "--no-warnings";
process.removeAllListeners("warning");
process.removeAllListeners("ExperimentalWarning");

// Ensure UTF-8 encoding for input and output
process.stdin.setEncoding("utf8");
process.stdout.setEncoding("utf8");

const logger = new Logger('Main');

async function displayBanner() {
  const asciiArt = figlet.textSync("Bonk.fun Volume Bot", {
    font: "Standard",
    horizontalLayout: "default",
    verticalLayout: "default",
    width: 80,
    whitespaceBreak: true,
  });
  
  console.log(chalk.cyan(asciiArt));
  console.log(chalk.green(`Version: ${version}`));
  console.log(chalk.green("Professional Trading Bot for Raydium LaunchLab\n"));
}

async function main() {
  try {
    await displayBanner();
    
    // Initialize configuration
    const configManager = new ConfigManager();
    await configManager.loadConfig();
    
    // Initialize bot manager
    const botManager = new BotManager(configManager);
    
    // Parse command line arguments
    program
      .name('bonk-volume-bot')
      .description('Professional trading bot for Bonk.fun tokens')
      .version(version)
      .option('-c, --config <path>', 'Path to configuration file')
      .option('-d, --debug', 'Enable debug mode')
      .option('--dry-run', 'Run in simulation mode without executing trades')
      .option('--interactive', 'Run in interactive mode')
      .parse();

    const options = program.opts();
    
    if (options.debug) {
      logger.setLevel('debug');
    }
    
    if (options.dryRun) {
      logger.info('Running in dry-run mode - no actual trades will be executed');
    }
    
    if (options.interactive || !options.config) {
      await botManager.runInteractive();
    } else {
      await botManager.runWithConfig(options.config);
    }
    
  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

if (require.main === module) {
  main().catch((error) => {
    logger.error('Application failed to start:', error);
    process.exit(1);
  });
}

export { BotManager, ConfigManager, Logger };
