/**
 * Centralized logging utility with environment-based control
 * 
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.debug('Debug message', data);
 *   logger.info('Info message', data);
 *   logger.warn('Warning message', data);
 *   logger.error('Error message', error);
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  enabled: boolean;
  level: LogLevel;
  enabledInProduction: boolean;
}

class Logger {
  private config: LoggerConfig;

  constructor() {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isTest = process.env.NODE_ENV === 'test';
    
    this.config = {
      enabled: isDevelopment || isTest,
      level: (process.env.NEXT_PUBLIC_LOG_LEVEL as LogLevel) || 'info',
      enabledInProduction: process.env.NEXT_PUBLIC_ENABLE_PRODUCTION_LOGS === 'true',
    };
  }

  private shouldLog(level: LogLevel): boolean {
    if (process.env.NODE_ENV === 'production' && !this.config.enabledInProduction) {
      return level === 'error' || level === 'warn';
    }

    if (!this.config.enabled) {
      return false;
    }

    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);

    return messageLevelIndex >= currentLevelIndex;
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }

  // Specialized loggers for specific subsystems
  rpc = {
    debug: (message: string, ...args: any[]) => this.debug(`[RPC] ${message}`, ...args),
    info: (message: string, ...args: any[]) => this.info(`[RPC] ${message}`, ...args),
    warn: (message: string, ...args: any[]) => this.warn(`[RPC] ${message}`, ...args),
    error: (message: string, ...args: any[]) => this.error(`[RPC] ${message}`, ...args),
  };

  performance = {
    debug: (message: string, ...args: any[]) => this.debug(`[PERF] ${message}`, ...args),
    info: (message: string, ...args: any[]) => this.info(`[PERF] ${message}`, ...args),
  };

  wallet = {
    debug: (message: string, ...args: any[]) => this.debug(`[WALLET] ${message}`, ...args),
    info: (message: string, ...args: any[]) => this.info(`[WALLET] ${message}`, ...args),
    error: (message: string, ...args: any[]) => this.error(`[WALLET] ${message}`, ...args),
  };

  chat = {
    debug: (message: string, ...args: any[]) => this.debug(`[CHAT] ${message}`, ...args),
    info: (message: string, ...args: any[]) => this.info(`[CHAT] ${message}`, ...args),
  };

  graph = {
    debug: (message: string, ...args: any[]) => this.debug(`[GRAPH] ${message}`, ...args),
    info: (message: string, ...args: any[]) => this.info(`[GRAPH] ${message}`, ...args),
    warn: (message: string, ...args: any[]) => this.warn(`[GRAPH] ${message}`, ...args),
    error: (message: string, ...args: any[]) => this.error(`[GRAPH] ${message}`, ...args),
  };
}

export const logger = new Logger();
