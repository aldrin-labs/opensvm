/**
 * Debug Logger Utility
 * Provides logging functions used throughout the application
 */

export interface Logger {
  debug: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
}

export function createLogger(namespace: string): Logger {
  const isDev = process.env.NODE_ENV === 'development';
  
  return {
    debug: (message: string, ...args: any[]) => {
      if (isDev) {
        console.debug(`[${namespace}] ${message}`, ...args);
      }
    },
    info: (message: string, ...args: any[]) => {
      console.info(`[${namespace}] ${message}`, ...args);
    },
    warn: (message: string, ...args: any[]) => {
      console.warn(`[${namespace}] ${message}`, ...args);
    },
    error: (message: string, ...args: any[]) => {
      console.error(`[${namespace}] ${message}`, ...args);
    }
  };
}

// Global logger functions for backward compatibility
export function debugLog(message: string, ...args: any[]): void {
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[DEBUG] ${message}`, ...args);
  }
}

export function errorLog(message: string, ...args: any[]): void {
  console.error(`[ERROR] ${message}`, ...args);
}

export function infoLog(message: string, ...args: any[]): void {
  console.info(`[INFO] ${message}`, ...args);
}

export function warnLog(message: string, ...args: any[]): void {
  console.warn(`[WARN] ${message}`, ...args);
}
