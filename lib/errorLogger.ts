/**
 * Centralized client-side error logging utility
 * This can be extended to integrate with external services like Sentry, LogRocket, etc.
 */

interface ErrorLogEntry {
  timestamp: number;
  level: 'error' | 'warn' | 'info';
  message: string;
  error?: Error;
  context?: Record<string, any>;
  userAgent?: string;
  url?: string;
}

class ErrorLogger {
  private logs: ErrorLogEntry[] = [];
  private maxLogs = 100; // Keep only last 100 logs in memory
  private isDebugMode = process.env.NODE_ENV === 'development' || 
                        (typeof window !== 'undefined' && window.localStorage?.getItem('debug') === 'true');

  /**
   * Log an error with context
   */
  error(message: string, error?: Error, context?: Record<string, any>) {
    this.log('error', message, error, context);
  }

  /**
   * Log a warning
   */
  warn(message: string, context?: Record<string, any>) {
    this.log('warn', message, undefined, context);
  }

  /**
   * Log an info message (only in debug mode)
   */
  info(message: string, context?: Record<string, any>) {
    if (this.isDebugMode) {
      this.log('info', message, undefined, context);
    }
  }

  /**
   * Internal logging method
   */
  private log(level: 'error' | 'warn' | 'info', message: string, error?: Error, context?: Record<string, any>) {
    const entry: ErrorLogEntry = {
      timestamp: Date.now(),
      level,
      message,
      error,
      context,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    };

    // Add to in-memory logs
    this.logs.push(entry);
    
    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console output in development
    if (this.isDebugMode) {
      const logMethod = level === 'error' ? console.error : 
                       level === 'warn' ? console.warn : console.log;
      
      logMethod(`[${level.toUpperCase()}] ${message}`, {
        error,
        context,
        timestamp: new Date(entry.timestamp).toISOString()
      });
    }

    // In production, you would send to external service here
    // Example:
    // if (level === 'error' && !this.isDebugMode) {
    //   this.sendToExternalService(entry);
    // }
  }

  /**
   * Get recent logs (for debugging)
   */
  getRecentLogs(count: number = 10): ErrorLogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * Send logs to external service (placeholder for future implementation)
   */
  private async sendToExternalService(entry: ErrorLogEntry) {
    // Placeholder for sending to Sentry, LogRocket, or custom endpoint
    // Example:
    // await fetch('/api/logs', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(entry)
    // });
  }

  /**
   * Set up global error handlers
   */
  setupGlobalErrorHandlers() {
    if (typeof window === 'undefined') return;

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.error('Unhandled promise rejection', new Error(event.reason), {
        reason: event.reason,
        promise: event.promise?.toString?.()
      });
    });

    // Handle uncaught errors
    window.addEventListener('error', (event) => {
      this.error('Uncaught error', event.error, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        message: event.message
      });
    });
  }
}

// Create singleton instance
export const errorLogger = new ErrorLogger();

// Auto-setup global handlers
if (typeof window !== 'undefined') {
  errorLogger.setupGlobalErrorHandlers();
}

// Export convenience functions
export const logError = (message: string, error?: Error, context?: Record<string, any>) => 
  errorLogger.error(message, error, context);

export const logWarn = (message: string, context?: Record<string, any>) => 
  errorLogger.warn(message, context);

export const logInfo = (message: string, context?: Record<string, any>) => 
  errorLogger.info(message, context);