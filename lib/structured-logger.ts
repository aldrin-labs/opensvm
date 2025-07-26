/**
 * Structured Logging System
 * 
 * Provides comprehensive logging functionality with:
 * - Structured log format for better parsing
 * - Multiple log levels and contexts
 * - Performance monitoring integration
 * - Error tracking and reporting
 * - Development vs production modes
 * 
 * @see docs/architecture/development-guidelines.md#logging-patterns
 */

/**
 * Log levels in order of severity
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

/**
 * Log contexts for categorizing logs
 */
export enum LogContext {
  API = 'api',
  AUTH = 'auth',
  BLOCKCHAIN = 'blockchain',
  CACHE = 'cache',
  DATABASE = 'database',
  PERFORMANCE = 'performance',
  SECURITY = 'security',
  UI = 'ui',
  WEBSOCKET = 'websocket',
  AI = 'ai',
  TRANSACTION = 'transaction',
  SEARCH = 'search',
  ANALYTICS = 'analytics'
}

/**
 * Structured log entry interface
 */
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  levelName: string;
  context: LogContext;
  message: string;
  data?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  performance?: {
    duration: number;
    memory?: number;
    cpu?: number;
  };
  request?: {
    id: string;
    method: string;
    url: string;
    userAgent?: string;
    ip?: string;
  };
  user?: {
    id?: string;
    wallet?: string;
    session?: string;
  };
  metadata?: Record<string, any>;
}

/**
 * Logger configuration
 */
interface LoggerConfig {
  /** Minimum log level to output */
  minLevel: LogLevel;
  /** Whether to include stack traces */
  includeStackTrace: boolean;
  /** Whether to log to console */
  logToConsole: boolean;
  /** Whether to send logs to external service */
  logToService: boolean;
  /** External logging service URL */
  serviceUrl?: string;
  /** API key for external service */
  serviceApiKey?: string;
  /** Maximum log entries to buffer */
  maxBufferSize: number;
  /** Flush interval in milliseconds */
  flushInterval: number;
  /** Whether to enable performance logging */
  enablePerformanceLogging: boolean;
  /** Sensitive fields to redact */
  redactFields: string[];
}

/**
 * Default logger configuration
 */
const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
  includeStackTrace: process.env.NODE_ENV !== 'production',
  logToConsole: true,
  logToService: process.env.NODE_ENV === 'production',
  maxBufferSize: 1000,
  flushInterval: 5000,
  enablePerformanceLogging: true,
  redactFields: ['password', 'token', 'apiKey', 'privateKey', 'secret']
};

/**
 * Performance timer for measuring execution time
 */
class PerformanceTimer {
  private startTime: number;
  private startMemory?: number;

  constructor() {
    this.startTime = performance.now();
    
    if (typeof process !== 'undefined' && process.memoryUsage) {
      this.startMemory = process.memoryUsage().heapUsed;
    }
  }

  /**
   * Get elapsed time and memory usage
   */
  getMetrics(): { duration: number; memory?: number } {
    const duration = performance.now() - this.startTime;
    let memory: number | undefined;

    if (this.startMemory && typeof process !== 'undefined' && process.memoryUsage) {
      memory = process.memoryUsage().heapUsed - this.startMemory;
    }

    return { duration, memory };
  }
}

/**
 * Structured Logger class
 */
export class StructuredLogger {
  private config: LoggerConfig;
  private buffer: LogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;
  private requestId?: string;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startFlushTimer();
  }

  /**
   * Set request ID for request correlation
   */
  setRequestId(requestId: string): void {
    this.requestId = requestId;
  }

  /**
   * Create a performance timer
   */
  startTimer(): PerformanceTimer {
    return new PerformanceTimer();
  }

  /**
   * Log debug message
   */
  debug(context: LogContext, message: string, data?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, context, message, data);
  }

  /**
   * Log info message
   */
  info(context: LogContext, message: string, data?: Record<string, any>): void {
    this.log(LogLevel.INFO, context, message, data);
  }

  /**
   * Log warning message
   */
  warn(context: LogContext, message: string, data?: Record<string, any>): void {
    this.log(LogLevel.WARN, context, message, data);
  }

  /**
   * Log error message
   */
  error(context: LogContext, message: string, error?: Error, data?: Record<string, any>): void {
    this.log(LogLevel.ERROR, context, message, data, error);
  }

  /**
   * Log fatal error message
   */
  fatal(context: LogContext, message: string, error?: Error, data?: Record<string, any>): void {
    this.log(LogLevel.FATAL, context, message, data, error);
  }

  /**
   * Log performance metrics
   */
  performance(
    context: LogContext,
    operation: string,
    timer: PerformanceTimer,
    data?: Record<string, any>
  ): void {
    if (!this.config.enablePerformanceLogging) return;

    const metrics = timer.getMetrics();
    this.log(LogLevel.INFO, context, `Performance: ${operation}`, {
      ...data,
      operation
    }, undefined, metrics);
  }

  /**
   * Log API request
   */
  apiRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    data?: Record<string, any>
  ): void {
    const level = statusCode >= 500 ? LogLevel.ERROR : 
                 statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
    
    this.log(level, LogContext.API, `${method} ${url} - ${statusCode}`, {
      ...data,
      method,
      url,
      statusCode
    }, undefined, { duration });
  }

  /**
   * Log blockchain operation
   */
  blockchain(
    operation: string,
    signature?: string,
    data?: Record<string, any>,
    error?: Error
  ): void {
    const level = error ? LogLevel.ERROR : LogLevel.INFO;
    this.log(level, LogContext.BLOCKCHAIN, `Blockchain: ${operation}`, {
      ...data,
      operation,
      signature
    }, error);
  }

  /**
   * Log authentication event
   */
  auth(
    event: string,
    userId?: string,
    wallet?: string,
    success: boolean = true,
    data?: Record<string, any>
  ): void {
    const level = success ? LogLevel.INFO : LogLevel.WARN;
    this.log(level, LogContext.AUTH, `Auth: ${event}`, {
      ...data,
      event,
      success
    }, undefined, undefined, { id: userId, wallet });
  }

  /**
   * Log security event
   */
  security(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    data?: Record<string, any>
  ): void {
    const level = severity === 'critical' ? LogLevel.FATAL :
                 severity === 'high' ? LogLevel.ERROR :
                 severity === 'medium' ? LogLevel.WARN : LogLevel.INFO;
    
    this.log(level, LogContext.SECURITY, `Security: ${event}`, {
      ...data,
      event,
      severity
    });
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    context: LogContext,
    message: string,
    data?: Record<string, any>,
    error?: Error,
    performance?: { duration: number; memory?: number },
    user?: { id?: string; wallet?: string; session?: string }
  ): void {
    if (level < this.config.minLevel) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      levelName: LogLevel[level],
      context,
      message,
      data: data ? this.redactSensitiveData(data) : undefined,
      error: error ? this.formatError(error) : undefined,
      performance,
      request: this.requestId ? {
        id: this.requestId,
        method: '',
        url: ''
      } : undefined,
      user,
      metadata: {
        nodeEnv: process.env.NODE_ENV,
        version: process.env.npm_package_version,
        pid: typeof process !== 'undefined' ? process.pid : undefined
      }
    };

    this.addToBuffer(entry);

    if (this.config.logToConsole) {
      this.logToConsole(entry);
    }
  }

  /**
   * Format error for logging
   */
  private formatError(error: Error): LogEntry['error'] {
    return {
      name: error.name,
      message: error.message,
      stack: this.config.includeStackTrace ? error.stack : undefined,
      code: (error as any).code
    };
  }

  /**
   * Redact sensitive data from logs
   */
  private redactSensitiveData(data: Record<string, any>): Record<string, any> {
    const redacted = { ...data };
    
    const redactValue = (obj: any, key: string): void => {
      if (this.config.redactFields.some(field => 
        key.toLowerCase().includes(field.toLowerCase())
      )) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.redactObject(obj[key]);
      }
    };

    const redactObject = (obj: any): void => {
      if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          if (typeof item === 'object' && item !== null) {
            redactObject(item);
          }
        });
      } else {
        Object.keys(obj).forEach(key => redactValue(obj, key));
      }
    };

    redactObject(redacted);
    return redacted;
  }

  /**
   * Add entry to buffer
   */
  private addToBuffer(entry: LogEntry): void {
    this.buffer.push(entry);
    
    if (this.buffer.length >= this.config.maxBufferSize) {
      this.flush();
    }
  }

  /**
   * Log to console with appropriate formatting
   */
  private logToConsole(entry: LogEntry): void {
    const { timestamp, levelName, context, message, data, error } = entry;
    const prefix = `[${timestamp}] ${levelName} [${context}]`;
    
    const consoleMethod = entry.level >= LogLevel.ERROR ? 'error' :
                         entry.level >= LogLevel.WARN ? 'warn' : 'log';
    
    if (process.env.NODE_ENV === 'development') {
      // Pretty format for development
      console[consoleMethod](`${prefix} ${message}`);
      if (data) console[consoleMethod]('Data:', data);
      if (error) console[consoleMethod]('Error:', error);
    } else {
      // JSON format for production
      console[consoleMethod](JSON.stringify(entry));
    }
  }

  /**
   * Flush buffer to external service
   */
  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    if (this.config.logToService && this.config.serviceUrl) {
      try {
        await fetch(this.config.serviceUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.config.serviceApiKey && {
              'Authorization': `Bearer ${this.config.serviceApiKey}`
            })
          },
          body: JSON.stringify({ logs: entries })
        });
      } catch (error) {
        // Fallback to console if service fails
        console.error('Failed to send logs to service:', error);
        entries.forEach(entry => this.logToConsole(entry));
      }
    }
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  /**
   * Stop flush timer and flush remaining logs
   */
  async destroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flush();
  }
}

/**
 * Global logger instance
 */
export const logger = new StructuredLogger();

/**
 * Convenience functions for common logging patterns
 */
export const log = {
  debug: (context: LogContext, message: string, data?: Record<string, any>) =>
    logger.debug(context, message, data),
  
  info: (context: LogContext, message: string, data?: Record<string, any>) =>
    logger.info(context, message, data),
  
  warn: (context: LogContext, message: string, data?: Record<string, any>) =>
    logger.warn(context, message, data),
  
  error: (context: LogContext, message: string, error?: Error, data?: Record<string, any>) =>
    logger.error(context, message, error, data),
  
  fatal: (context: LogContext, message: string, error?: Error, data?: Record<string, any>) =>
    logger.fatal(context, message, error, data),
  
  performance: (context: LogContext, operation: string, timer: PerformanceTimer, data?: Record<string, any>) =>
    logger.performance(context, operation, timer, data),
  
  api: (method: string, url: string, statusCode: number, duration: number, data?: Record<string, any>) =>
    logger.apiRequest(method, url, statusCode, duration, data),
  
  blockchain: (operation: string, signature?: string, data?: Record<string, any>, error?: Error) =>
    logger.blockchain(operation, signature, data, error),
  
  auth: (event: string, userId?: string, wallet?: string, success?: boolean, data?: Record<string, any>) =>
    logger.auth(event, userId, wallet, success, data),
  
  security: (event: string, severity: 'low' | 'medium' | 'high' | 'critical', data?: Record<string, any>) =>
    logger.security(event, severity, data),
  
  timer: () => logger.startTimer()
};

/**
 * Decorator for automatic performance logging
 */
export function logPerformance(context: LogContext, operation?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const operationName = operation || `${target.constructor.name}.${propertyName}`;

    descriptor.value = async function (...args: any[]) {
      const timer = logger.startTimer();
      try {
        const result = await method.apply(this, args);
        logger.performance(context, operationName, timer, { args: args.length });
        return result;
      } catch (error) {
        logger.performance(context, operationName, timer, { 
          args: args.length, 
          error: true 
        });
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Hook for React components to use structured logging
 */
export function useStructuredLogger() {
  return logger;
}

// Cleanup on process exit
if (typeof process !== 'undefined') {
  process.on('exit', () => {
    logger.destroy();
  });
  
  process.on('SIGINT', () => {
    logger.destroy().then(() => process.exit(0));
  });
  
  process.on('SIGTERM', () => {
    logger.destroy().then(() => process.exit(0));
  });
}