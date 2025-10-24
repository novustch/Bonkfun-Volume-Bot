/**
 * Logger - Professional logging utility
 * 
 * Provides structured logging with different levels and output formats.
 */

import { LogLevel, LogEntry } from '../types';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

export class Logger {
  private context: string;
  private level: LogLevel;
  private logFile: string;
  private maxLogSize: number;
  private maxLogFiles: number;

  constructor(context: string, level: LogLevel = 'info') {
    this.context = context;
    this.level = level;
    this.logFile = path.join(process.cwd(), 'logs', 'bot.log');
    this.maxLogSize = 10 * 1024 * 1024; // 10MB
    this.maxLogFiles = 5;

    this.ensureLogDirectory();
  }

  /**
   * Set the log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get the current log level
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: Record<string, any>): void {
    this.log('debug', message, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error | any, context?: Record<string, any>): void {
    this.log('error', message, { ...context, error: error?.message || error });
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
    };

    // Console output
    this.logToConsole(logEntry);

    // File output
    this.logToFile(logEntry);
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.level);
    const messageLevelIndex = levels.indexOf(level);
    
    return messageLevelIndex >= currentLevelIndex;
  }

  /**
   * Log to console with colors
   */
  private logToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const levelColor = this.getLevelColor(entry.level);
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
    
    const logMessage = `[${timestamp}] ${levelColor(`[${entry.level.toUpperCase()}]`)} [${this.context}] ${entry.message}${contextStr}`;
    
    console.log(logMessage);
  }

  /**
   * Get color for log level
   */
  private getLevelColor(level: LogLevel): (text: string) => string {
    switch (level) {
      case 'debug':
        return chalk.gray;
      case 'info':
        return chalk.blue;
      case 'warn':
        return chalk.yellow;
      case 'error':
        return chalk.red;
      default:
        return chalk.white;
    }
  }

  /**
   * Log to file
   */
  private logToFile(entry: LogEntry): void {
    try {
      const logLine = JSON.stringify(entry) + '\n';
      
      // Check if log rotation is needed
      this.rotateLogIfNeeded();
      
      fs.appendFileSync(this.logFile, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Ensure log directory exists
   */
  private ensureLogDirectory(): void {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  /**
   * Rotate log file if it exceeds max size
   */
  private rotateLogIfNeeded(): void {
    try {
      if (fs.existsSync(this.logFile)) {
        const stats = fs.statSync(this.logFile);
        if (stats.size > this.maxLogSize) {
          this.rotateLog();
        }
      }
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  /**
   * Rotate log files
   */
  private rotateLog(): void {
    try {
      // Move existing log files
      for (let i = this.maxLogFiles - 1; i > 0; i--) {
        const oldFile = `${this.logFile}.${i}`;
        const newFile = `${this.logFile}.${i + 1}`;
        
        if (fs.existsSync(oldFile)) {
          if (i === this.maxLogFiles - 1) {
            fs.unlinkSync(oldFile);
          } else {
            fs.renameSync(oldFile, newFile);
          }
        }
      }

      // Move current log file
      if (fs.existsSync(this.logFile)) {
        fs.renameSync(this.logFile, `${this.logFile}.1`);
      }
    } catch (error) {
      console.error('Failed to rotate log files:', error);
    }
  }

  /**
   * Get log file path
   */
  getLogFile(): string {
    return this.logFile;
  }

  /**
   * Clear log file
   */
  clearLog(): void {
    try {
      if (fs.existsSync(this.logFile)) {
        fs.unlinkSync(this.logFile);
      }
    } catch (error) {
      console.error('Failed to clear log file:', error);
    }
  }

  /**
   * Get recent log entries
   */
  getRecentLogs(count: number = 100): LogEntry[] {
    try {
      if (!fs.existsSync(this.logFile)) {
        return [];
      }

      const logContent = fs.readFileSync(this.logFile, 'utf8');
      const lines = logContent.trim().split('\n');
      const recentLines = lines.slice(-count);
      
      return recentLines
        .map(line => {
          try {
            return JSON.parse(line) as LogEntry;
          } catch {
            return null;
          }
        })
        .filter((entry): entry is LogEntry => entry !== null);
    } catch (error) {
      console.error('Failed to read log file:', error);
      return [];
    }
  }
}
