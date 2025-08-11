import { LogEntry } from '../performance/types';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  level: LogLevel;
  enabledInProduction: boolean;
  persistLogs: boolean;
  maxLogEntries: number;
  includeStackTrace: boolean;
  includePerformanceData: boolean;
}

interface LogContext {
  component?: string;
  userId?: string;
  sessionId?: string;
  transactionSignature?: string;
  requestId?: string;
  message?: string;  // For error events
  reason?: string;   // For unhandledrejection events
  filename?: string; // For error events
  lineno?: number;   // For error events
  colno?: number;    // For error events
  error?: string;    // For error stack traces
  promise?: Promise<any>; // For unhandledrejection events
  metadata?: Record<string, any>;
}

class StructuredLogger {
  private static instance: StructuredLogger;
  private logs: LogEntry[] = [];
  private pendingLogs: LogEntry[] = []; // Batch for sending to logging service
  private config: LoggerConfig;
  private batchTimer: NodeJS.Timeout | null = null;

  private readonly defaultConfig: LoggerConfig = {
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    enabledInProduction: true,
    persistLogs: true,
    maxLogEntries: 10000,
    includeStackTrace: process.env.NODE_ENV === 'development',
    includePerformanceData: true,
  };

  private readonly levelOrder: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  private constructor(config?: Partial<LoggerConfig>) {
    this.config = { ...this.defaultConfig, ...config };

    // Setup error capture
    this.setupGlobalErrorHandling();

    // Setup periodic log cleanup
    this.setupLogCleanup();

    // Setup batch logging timer (once per minute)
    this.setupBatchLogging();
  }

  static getInstance(config?: Partial<LoggerConfig>): StructuredLogger {
    if (!StructuredLogger.instance) {
      StructuredLogger.instance = new StructuredLogger(config);
    }
    return StructuredLogger.instance;
  }

  private setupGlobalErrorHandling(): void {
    if (typeof window === 'undefined') return;

    // Catch unhandled errors
    window.addEventListener('error', (event) => {
      this.error('Unhandled Error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.stack,
      });
    });

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.error('Unhandled Promise Rejection', {
        reason: event.reason,
        promise: event.promise,
      });
    });
  }

  private setupLogCleanup(): void {
    // Clean up logs periodically to prevent memory leaks
    setInterval(() => {
      if (this.logs.length > this.config.maxLogEntries) {
        const excess = this.logs.length - this.config.maxLogEntries;
        this.logs.splice(0, excess);
      }
    }, 60000); // Check every minute
  }

  private setupBatchLogging(): void {
    // Batch and send logs once per minute to reduce API calls
    setInterval(() => {
      this.flushPendingLogs();
    }, 60000); // Send logs every minute
  }

  private flushPendingLogs(): void {
    if (this.pendingLogs.length === 0) return;

    if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined') {
      try {
        // Send batched logs to external logging service
        fetch('/api/logging', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            logs: this.pendingLogs,
            batchSize: this.pendingLogs.length,
            timestamp: new Date().toISOString()
          }),
        }).catch(error => {
          console.error('Failed to send batch logs to service:', error);
        });
      } catch (error) {
        console.error('Error in batch log submission:', error);
      }
    }

    // Clear the batch after sending
    this.pendingLogs = [];
  }

  private shouldLog(level: LogLevel): boolean {
    if (process.env.NODE_ENV === 'production' && !this.config.enabledInProduction) {
      return level === 'error'; // Only errors in production if disabled
    }

    return this.levelOrder[level] >= this.levelOrder[this.config.level];
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext
  ): LogEntry {
    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      component: context?.component,
      metadata: {
        ...context?.metadata,
        userId: context?.userId,
        sessionId: context?.sessionId,
        transactionSignature: context?.transactionSignature,
        requestId: context?.requestId,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        userAgent: typeof window !== 'undefined' ? navigator.userAgent : undefined,
      },
    };

    // Add stack trace for errors and warnings in development
    if (this.config.includeStackTrace && (level === 'error' || level === 'warn')) {
      entry.trace = new Error().stack;
    }

    // Add performance data if available
    if (this.config.includePerformanceData) {
      try {
        const performanceMonitor = (window as any).__performanceMonitor;
        if (performanceMonitor) {
          entry.performance = performanceMonitor.getLatestMetrics();
        }
      } catch (error) {
        // Ignore performance data collection errors
      }
    }

    return entry;
  }

  private writeLog(entry: LogEntry): void {
    // Store log entry
    if (this.config.persistLogs) {
      this.logs.push(entry);
    }

    // Console output with appropriate styling
    this.outputToConsole(entry);

    // Send to external logging service in production
    this.sendToLoggingService(entry);

    // Emit log event for subscribers
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('structured-log', { detail: entry }));
    }
  }

  private outputToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const component = entry.component ? `[${entry.component}]` : '';
    const logMessage = `${timestamp} ${component} ${entry.message}`;

    switch (entry.level) {
      case 'debug':
        console.debug(`🔍 ${logMessage}`, entry.metadata);
        break;
      case 'info':
        console.info(`ℹ️ ${logMessage}`, entry.metadata);
        break;
      case 'warn':
        console.warn(`⚠️ ${logMessage}`, entry.metadata);
        break;
      case 'error':
        console.error(`❌ ${logMessage}`, entry.metadata);
        if (entry.trace) {
          console.error('Stack trace:', entry.trace);
        }
        break;
    }
  }

  private sendToLoggingService(entry: LogEntry): void {
    if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined') {
      // Add to batch instead of sending immediately
      this.pendingLogs.push(entry);

      // Optional: If batch gets too large, flush immediately
      if (this.pendingLogs.length >= 100) {
        this.flushPendingLogs();
      }
    }
  }

  // Public logging methods
  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      const entry = this.createLogEntry('debug', message, context);
      this.writeLog(entry);
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      const entry = this.createLogEntry('info', message, context);
      this.writeLog(entry);
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      const entry = this.createLogEntry('warn', message, context);
      this.writeLog(entry);
    }
  }

  error(message: string, context?: LogContext): void {
    if (this.shouldLog('error')) {
      const entry = this.createLogEntry('error', message, context);
      this.writeLog(entry);
    }
  }

  // Specialized logging methods
  apiRequest(method: string, url: string, duration: number, status: number, context?: LogContext): void {
    this.info(`API ${method.toUpperCase()} ${url} (${duration}ms) - ${status}`, {
      ...context,
      metadata: {
        ...context?.metadata,
        apiMethod: method,
        apiUrl: url,
        apiDuration: duration,
        apiStatus: status,
      },
    });
  }

  apiError(method: string, url: string, error: Error, context?: LogContext): void {
    this.error(`API ${method.toUpperCase()} ${url} failed: ${error.message}`, {
      ...context,
      metadata: {
        ...context?.metadata,
        apiMethod: method,
        apiUrl: url,
        errorName: error.name,
        errorStack: error.stack,
      },
    });
  }

  componentMount(componentName: string, mountTime: number, context?: LogContext): void {
    this.debug(`Component ${componentName} mounted (${mountTime}ms)`, {
      ...context,
      component: componentName,
      metadata: {
        ...context?.metadata,
        mountTime,
        event: 'component-mount',
      },
    });
  }

  componentError(componentName: string, error: Error, context?: LogContext): void {
    this.error(`Component ${componentName} error: ${error.message}`, {
      ...context,
      component: componentName,
      metadata: {
        ...context?.metadata,
        errorName: error.name,
        errorStack: error.stack,
        event: 'component-error',
      },
    });
  }

  transactionProcessing(signature: string, step: string, duration?: number, context?: LogContext): void {
    this.info(`Transaction ${signature.slice(0, 8)}... ${step}${duration ? ` (${duration}ms)` : ''}`, {
      ...context,
      transactionSignature: signature,
      metadata: {
        ...context?.metadata,
        processingStep: step,
        processingDuration: duration,
        event: 'transaction-processing',
      },
    });
  }

  userInteraction(type: string, element: string, context?: LogContext): void {
    this.debug(`User ${type} on ${element}`, {
      ...context,
      metadata: {
        ...context?.metadata,
        interactionType: type,
        interactionElement: element,
        event: 'user-interaction',
      },
    });
  }

  performanceAlert(alertType: string, metric: string, value: number, context?: LogContext): void {
    this.warn(`Performance Alert: ${alertType} - ${metric} = ${value}`, {
      ...context,
      metadata: {
        ...context?.metadata,
        alertType,
        alertMetric: metric,
        alertValue: value,
        event: 'performance-alert',
      },
    });
  }

  // Query methods
  getLogs(options?: {
    level?: LogLevel;
    component?: string;
    limit?: number;
    since?: number;
  }): LogEntry[] {
    let filteredLogs = [...this.logs];

    if (options?.level) {
      const minLevel = this.levelOrder[options.level];
      filteredLogs = filteredLogs.filter(log => this.levelOrder[log.level] >= minLevel);
    }

    if (options?.component) {
      filteredLogs = filteredLogs.filter(log => log.component === options.component);
    }

    if (options?.since) {
      filteredLogs = filteredLogs.filter(log => log.timestamp >= options.since!);
    }

    if (options?.limit) {
      filteredLogs = filteredLogs.slice(-options.limit);
    }

    return filteredLogs.sort((a, b) => b.timestamp - a.timestamp);
  }

  getLogStats(): {
    total: number;
    byLevel: Record<LogLevel, number>;
    byComponent: Record<string, number>;
    recentCount: number;
  } {
    const stats = {
      total: this.logs.length,
      byLevel: { debug: 0, info: 0, warn: 0, error: 0 },
      byComponent: {} as Record<string, number>,
      recentCount: 0,
    };

    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    this.logs.forEach(log => {
      stats.byLevel[log.level]++;

      if (log.component) {
        stats.byComponent[log.component] = (stats.byComponent[log.component] || 0) + 1;
      }

      if (log.timestamp >= oneHourAgo) {
        stats.recentCount++;
      }
    });

    return stats;
  }

  clearLogs(): void {
    this.logs = [];
  }

  exportLogs(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.logs, null, 2);
    }

    // CSV format
    const headers = ['timestamp', 'level', 'component', 'message', 'metadata'];
    const csvRows = [
      headers.join(','),
      ...this.logs.map(log => [
        new Date(log.timestamp).toISOString(),
        log.level,
        log.component || '',
        `"${log.message.replace(/"/g, '""')}"`,
        `"${JSON.stringify(log.metadata || {}).replace(/"/g, '""')}"`,
      ].join(','))
    ];

    return csvRows.join('\n');
  }

  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  // Cleanup method for proper disposal
  cleanup(): void {
    // Flush any remaining logs
    this.flushPendingLogs();

    // Clear batch timer
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    // Clear logs
    this.logs = [];
    this.pendingLogs = [];
  }
}

// Create singleton instance
const logger = StructuredLogger.getInstance();

export default logger;

// Convenience exports for easier usage
export const log = logger;
export const debug = (message: string, context?: LogContext) => logger.debug(message, context);
export const info = (message: string, context?: LogContext) => logger.info(message, context);
export const warn = (message: string, context?: LogContext) => logger.warn(message, context);
export const error = (message: string, context?: LogContext) => logger.error(message, context);