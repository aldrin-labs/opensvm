import logger from '@/lib/logging/logger';

export interface ErrorReport {
  id: string;
  timestamp: number;
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  errorInfo: {
    componentStack: string;
  };
  context: {
    component?: string;
    userId?: string;
    sessionId?: string;
    url: string;
    userAgent: string;
    errorBoundary: string;
    props?: Record<string, any>;
    state?: Record<string, any>;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'rendering' | 'network' | 'logic' | 'data' | 'performance' | 'security' | 'unknown';
  fingerprint: string;
  occurenceCount: number;
  firstOccurrence: number;
  lastOccurrence: number;
  resolved: boolean;
  metadata?: Record<string, any>;
}

export interface ErrorBoundaryConfig {
  name: string;
  fallbackComponent?: React.ComponentType<any>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  enableReporting: boolean;
  enableRetry: boolean;
  maxRetries: number;
  autoRetryDelay: number;
  captureProps: boolean;
  captureState: boolean;
}

class ErrorBoundaryService {
  private static instance: ErrorBoundaryService;
  private errors = new Map<string, ErrorReport>();
  private maxErrors = 1000; // Keep last 1000 errors
  private retentionTime = 7 * 24 * 60 * 60 * 1000; // 7 days

  static getInstance(): ErrorBoundaryService {
    if (!ErrorBoundaryService.instance) {
      ErrorBoundaryService.instance = new ErrorBoundaryService();
    }
    return ErrorBoundaryService.instance;
  }

  private constructor() {
    // Clean up old errors periodically
    setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000); // Every hour

    // Set up global error handlers
    this.setupGlobalErrorHandling();
  }

  private setupGlobalErrorHandling(): void {
    if (typeof window === 'undefined') return;

    // Unhandled JavaScript errors
    window.addEventListener('error', (event) => {
      this.reportError(new Error(event.message), {
        componentStack: `at ${event.filename}:${event.lineno}:${event.colno}`
      }, {
        component: 'GlobalErrorHandler',
        errorBoundary: 'window-error',
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      });
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason instanceof Error 
        ? event.reason 
        : new Error(String(event.reason));
      
      this.reportError(error, {
        componentStack: 'Unhandled Promise Rejection'
      }, {
        component: 'GlobalErrorHandler',
        errorBoundary: 'unhandled-rejection',
        metadata: {
          promise: event.promise
        }
      });
    });
  }

  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.retentionTime;
    
    // Remove old errors
    for (const [id, error] of this.errors.entries()) {
      if (error.timestamp < cutoff) {
        this.errors.delete(id);
      }
    }

    // Keep only the most recent errors if we exceed max
    if (this.errors.size > this.maxErrors) {
      const entries = Array.from(this.errors.entries())
        .sort(([, a], [, b]) => b.timestamp - a.timestamp)
        .slice(0, this.maxErrors);
      
      this.errors.clear();
      for (const [id, error] of entries) {
        this.errors.set(id, error);
      }
    }
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateFingerprint(error: Error, componentStack: string, component?: string): string {
    // Create a unique fingerprint for similar errors
    const key = `${error.name}:${error.message}:${component}:${componentStack.split('\n')[0]}`;
    return btoa(key).replace(/[+/=]/g, '').substring(0, 16);
  }

  private categorizeError(error: Error): ErrorReport['category'] {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    if (name.includes('syntax') || message.includes('parse')) {
      return 'logic';
    }
    if (name.includes('network') || message.includes('fetch') || message.includes('network')) {
      return 'network';
    }
    if (message.includes('render') || message.includes('component')) {
      return 'rendering';
    }
    if (message.includes('data') || message.includes('json') || message.includes('undefined')) {
      return 'data';
    }
    if (message.includes('memory') || message.includes('performance')) {
      return 'performance';
    }
    if (message.includes('permission') || message.includes('security') || message.includes('unauthorized')) {
      return 'security';
    }
    
    return 'unknown';
  }

  private calculateSeverity(error: Error, category: ErrorReport['category']): ErrorReport['severity'] {
    // Critical errors
    if (
      error.name === 'SecurityError' ||
      error.message.includes('CRITICAL') ||
      category === 'security'
    ) {
      return 'critical';
    }

    // High severity errors
    if (
      error.name === 'TypeError' ||
      error.name === 'ReferenceError' ||
      category === 'rendering' ||
      error.message.includes('Cannot read properties')
    ) {
      return 'high';
    }

    // Medium severity errors
    if (
      category === 'network' ||
      category === 'data' ||
      error.name === 'Error'
    ) {
      return 'medium';
    }

    return 'low';
  }

  public reportError(
    error: Error, 
    errorInfo: React.ErrorInfo, 
    context: Partial<ErrorReport['context']> = {}
  ): string {
    const timestamp = Date.now();
    const errorId = this.generateErrorId();
    const fingerprint = this.generateFingerprint(error, errorInfo.componentStack, context.component);
    const category = this.categorizeError(error);
    const severity = this.calculateSeverity(error, category);

    // Check if we already have this error
    const existingError = Array.from(this.errors.values()).find(e => e.fingerprint === fingerprint);
    
    if (existingError) {
      // Update existing error
      existingError.occurenceCount++;
      existingError.lastOccurrence = timestamp;
      
      logger.warn('Recurring error reported', {
        component: 'ErrorBoundaryService',
        metadata: {
          errorId: existingError.id,
          fingerprint,
          occurenceCount: existingError.occurenceCount,
          component: context.component,
          severity,
          category
        }
      });

      return existingError.id;
    }

    // Create new error report
    const report: ErrorReport = {
      id: errorId,
      timestamp,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      errorInfo: {
        componentStack: errorInfo.componentStack
      },
      context: {
        component: context.component,
        userId: context.userId || this.getUserId(),
        sessionId: context.sessionId || this.getSessionId(),
        url: typeof window !== 'undefined' ? window.location.href : 'unknown',
        userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'unknown',
        errorBoundary: context.errorBoundary || 'unknown',
        props: context.props,
        state: context.state,
        ...context
      },
      severity,
      category,
      fingerprint,
      occurenceCount: 1,
      firstOccurrence: timestamp,
      lastOccurrence: timestamp,
      resolved: false,
      metadata: context.metadata
    };

    this.errors.set(errorId, report);

    // Log the error
    logger.error('Error reported to ErrorBoundaryService', {
      component: 'ErrorBoundaryService',
      metadata: {
        errorId,
        fingerprint,
        errorName: error.name,
        errorMessage: error.message,
        component: context.component,
        severity,
        category,
        errorBoundary: context.errorBoundary
      }
    });

    // Send to external error tracking service in production
    if (process.env.NODE_ENV === 'production') {
      this.sendToExternalService(report);
    }

    // Emit error event for subscribers
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('error-boundary-report', { detail: report }));
    }

    return errorId;
  }

  private getUserId(): string | undefined {
    // Try to extract user ID from various sources
    try {
      if (typeof window !== 'undefined') {
        return localStorage.getItem('userId') || undefined;
      }
    } catch (error) {
      // Ignore localStorage errors
    }
    return undefined;
  }

  private getSessionId(): string | undefined {
    // Try to extract session ID from various sources
    try {
      if (typeof window !== 'undefined') {
        return sessionStorage.getItem('sessionId') || 
               document.cookie.match(/session[_-]?id=([^;]+)/i)?.[1] ||
               undefined;
      }
    } catch (error) {
      // Ignore storage/cookie errors
    }
    return undefined;
  }

  private async sendToExternalService(report: ErrorReport): Promise<void> {
    try {
      // In a real implementation, this would send to Sentry, LogRocket, etc.
      await fetch('/api/error-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report)
      });
    } catch (error) {
      // Don't let error reporting errors crash the app
      console.warn('Failed to send error to external service:', error);
    }
  }

  public getErrors(options?: {
    severity?: ErrorReport['severity'];
    category?: ErrorReport['category'];
    component?: string;
    resolved?: boolean;
    since?: number;
    limit?: number;
  }): ErrorReport[] {
    let errors = Array.from(this.errors.values());

    // Apply filters
    if (options?.severity) {
      errors = errors.filter(e => e.severity === options.severity);
    }
    if (options?.category) {
      errors = errors.filter(e => e.category === options.category);
    }
    if (options?.component) {
      errors = errors.filter(e => e.context.component === options.component);
    }
    if (options?.resolved !== undefined) {
      errors = errors.filter(e => e.resolved === options.resolved);
    }
    if (options?.since) {
      errors = errors.filter(e => e.timestamp >= options.since!);
    }

    // Sort by timestamp (newest first)
    errors.sort((a, b) => b.timestamp - a.timestamp);

    // Apply limit
    if (options?.limit) {
      errors = errors.slice(0, options.limit);
    }

    return errors;
  }

  public getErrorById(errorId: string): ErrorReport | undefined {
    return this.errors.get(errorId);
  }

  public resolveError(errorId: string): boolean {
    const error = this.errors.get(errorId);
    if (error) {
      error.resolved = true;
      logger.info('Error resolved', {
        component: 'ErrorBoundaryService',
        metadata: { errorId, fingerprint: error.fingerprint }
      });
      return true;
    }
    return false;
  }

  public getErrorStats(timeframe: number = 24 * 60 * 60 * 1000): {
    total: number;
    bySeverity: Record<ErrorReport['severity'], number>;
    byCategory: Record<ErrorReport['category'], number>;
    byComponent: Record<string, number>;
    resolved: number;
    unresolved: number;
    topErrors: Array<{ fingerprint: string; count: number; message: string }>;
  } {
    const since = Date.now() - timeframe;
    const recentErrors = this.getErrors({ since });

    const stats = {
      total: recentErrors.length,
      bySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
      byCategory: { rendering: 0, network: 0, logic: 0, data: 0, performance: 0, security: 0, unknown: 0 },
      byComponent: {} as Record<string, number>,
      resolved: 0,
      unresolved: 0,
      topErrors: [] as Array<{ fingerprint: string; count: number; message: string }>
    };

    // Count by fingerprint for top errors
    const fingerprintCounts = new Map<string, { count: number; message: string }>();

    for (const error of recentErrors) {
      stats.bySeverity[error.severity]++;
      stats.byCategory[error.category]++;
      
      const component = error.context.component || 'unknown';
      stats.byComponent[component] = (stats.byComponent[component] || 0) + 1;
      
      if (error.resolved) {
        stats.resolved++;
      } else {
        stats.unresolved++;
      }

      // Count by fingerprint
      const existing = fingerprintCounts.get(error.fingerprint);
      if (existing) {
        existing.count += error.occurenceCount;
      } else {
        fingerprintCounts.set(error.fingerprint, {
          count: error.occurenceCount,
          message: error.error.message
        });
      }
    }

    // Get top errors
    stats.topErrors = Array.from(fingerprintCounts.entries())
      .map(([fingerprint, data]) => ({ fingerprint, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return stats;
  }

  public clearErrors(): void {
    this.errors.clear();
    logger.info('Error boundary service cleared', {
      component: 'ErrorBoundaryService'
    });
  }

  public clearResolvedErrors(): void {
    for (const [id, error] of this.errors.entries()) {
      if (error.resolved) {
        this.errors.delete(id);
      }
    }
    logger.info('Resolved errors cleared from error boundary service', {
      component: 'ErrorBoundaryService'
    });
  }
}

export { ErrorBoundaryService };
export default ErrorBoundaryService;