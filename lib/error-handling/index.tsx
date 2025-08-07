'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useI18n } from '@/lib/i18n';
import { useAccessibility } from '@/lib/accessibility';
import { useRBAC } from '@/lib/rbac';

// Error types and severity levels
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ErrorCategory = 
  | 'network'
  | 'api'
  | 'validation'
  | 'authentication'
  | 'authorization'
  | 'data'
  | 'ui'
  | 'system'
  | 'performance'
  | 'security';

export interface ErrorInfo {
  id: string;
  code: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  timestamp: Date;
  context?: Record<string, any>;
  stack?: string;
  userId?: string;
  tenantId?: string;
  userAgent?: string;
  url?: string;
  metadata?: Record<string, any>;
}

export interface ErrorRecoveryAction {
  label: string;
  action: () => void | Promise<void>;
  primary?: boolean;
  icon?: React.ReactNode;
}

export interface ErrorDisplayOptions {
  title?: string;
  description?: string;
  recoveryActions?: ErrorRecoveryAction[];
  showDetails?: boolean;
  dismissible?: boolean;
  autoHide?: number; // milliseconds
}

// Error handling context
interface ErrorHandlingContextType {
  // Error state
  errors: ErrorInfo[];
  currentError: ErrorInfo | null;
  
  // Error management
  reportError: (error: Error | ErrorInfo, context?: Record<string, any>) => void;
  clearError: (errorId: string) => void;
  clearAllErrors: () => void;
  
  // Error recovery
  retryLastAction: () => Promise<void>;
  setRetryAction: (action: () => Promise<void>) => void;
  
  // User feedback
  showErrorToast: (message: string, options?: Partial<ErrorDisplayOptions>) => void;
  showErrorDialog: (error: ErrorInfo, options?: ErrorDisplayOptions) => void;
  dismissCurrentError: () => void;
  
  // Error reporting settings
  enableErrorReporting: boolean;
  setEnableErrorReporting: (enabled: boolean) => void;
  
  // Error analytics
  getErrorStatistics: () => ErrorStatistics;
  getRecentErrors: (limit?: number) => ErrorInfo[];
  
  // Network status
  isOnline: boolean;
  networkError: boolean;
}

interface ErrorStatistics {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  recentErrorRate: number;
  mostCommonErrors: Array<{ code: string; count: number }>;
}

const ErrorHandlingContext = createContext<ErrorHandlingContextType | undefined>(undefined);

// Error boundary component
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorId: string | null;
}

export class EnhancedErrorBoundary extends React.Component<
  { 
    children: React.ReactNode;
    fallback?: React.ComponentType<{ error: Error; errorId: string; retry: () => void }>;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  },
  ErrorBoundaryState
> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: any) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const errorId = `boundary-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    
    // Report error
    const errorReport: ErrorInfo = {
      id: this.state.errorId || `boundary-${Date.now()}`,
      code: 'REACT_ERROR_BOUNDARY',
      message: error.message,
      category: 'ui',
      severity: 'high',
      timestamp: new Date(),
      stack: error.stack,
      context: {
        componentStack: errorInfo.componentStack,
        errorBoundary: true,
      },
    };

    // Call onError callback
    this.props.onError?.(error, errorInfo);
    
    // Report to error service
    this.reportToErrorService(errorReport);
  }

  private reportToErrorService = (errorInfo: ErrorInfo) => {
    try {
      // Send to error reporting service
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('error:report', { detail: errorInfo }));
      }
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  };

  private retry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };

  private scheduleAutoRetry = () => {
    // Auto-retry after 5 seconds for certain error types
    if (this.state.error && this.isRetriableError(this.state.error)) {
      this.retryTimeoutId = setTimeout(() => {
        this.retry();
      }, 5000);
    }
  };

  private isRetriableError = (error: Error): boolean => {
    // Define which errors are safe to auto-retry
    return error.name === 'ChunkLoadError' || 
           error.message.includes('Loading chunk') ||
           error.message.includes('Network request failed');
  };

  componentDidUpdate(prevProps: any, prevState: ErrorBoundaryState) {
    if (this.state.hasError && !prevState.hasError) {
      this.scheduleAutoRetry();
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const { fallback: FallbackComponent } = this.props;
      
      if (FallbackComponent) {
        return (
          <FallbackComponent 
            error={this.state.error} 
            errorId={this.state.errorId || 'unknown'}
            retry={this.retry}
          />
        );
      }
      
      return <DefaultErrorFallback error={this.state.error} retry={this.retry} />;
    }

    return this.props.children;
  }
}

// Default error fallback component
function DefaultErrorFallback({ 
  error, 
  retry 
}: { 
  error: Error; 
  retry: () => void;
}) {
  const { t } = useI18n();
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-destructive/10 rounded-full">
          <svg
            className="w-8 h-8 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        
        <h1 className="text-2xl font-bold text-foreground mb-2">
          {t('error.somethingWentWrong', 'Something went wrong')}
        </h1>
        
        <p className="text-muted-foreground mb-6">
          {t('error.unexpectedError', 'An unexpected error occurred. Our team has been notified and is working on a fix.')}
        </p>
        
        <div className="space-x-3">
          <button
            onClick={retry}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
          >
            {t('error.tryAgain', 'Try Again')}
          </button>
          
          <button
            onClick={() => window.location.href = '/'}
            className="bg-muted text-muted-foreground px-4 py-2 rounded-md hover:bg-muted/80 transition-colors"
          >
            {t('error.goHome', 'Go Home')}
          </button>
        </div>
        
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
              {t('error.technicalDetails', 'Technical Details')}
            </summary>
            <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-auto max-h-40">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

// Error service for reporting and analytics
class ErrorService {
  private static errors: ErrorInfo[] = [];
  private static listeners: Set<(errors: ErrorInfo[]) => void> = new Set();
  private static reportingEnabled = true;

  static addError(errorInfo: ErrorInfo) {
    // Add timestamp if not provided
    if (!errorInfo.timestamp) {
      errorInfo.timestamp = new Date();
    }

    // Add user context if available
    if (typeof window !== 'undefined') {
      errorInfo.userAgent = navigator.userAgent;
      errorInfo.url = window.location.href;
    }

    this.errors.push(errorInfo);
    
    // Keep only last 100 errors to prevent memory leaks
    if (this.errors.length > 100) {
      this.errors = this.errors.slice(-100);
    }
    
    this.notifyListeners();
    
    if (this.reportingEnabled) {
      this.reportToExternalService(errorInfo);
    }
  }

  static removeError(errorId: string) {
    this.errors = this.errors.filter(error => error.id !== errorId);
    this.notifyListeners();
  }

  static clearAllErrors() {
    this.errors = [];
    this.notifyListeners();
  }

  static getErrors(): ErrorInfo[] {
    return [...this.errors];
  }

  static getRecentErrors(limit: number = 10): ErrorInfo[] {
    return this.errors
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  static getErrorStatistics(): ErrorStatistics {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const recentErrors = this.errors.filter(e => e.timestamp.getTime() > oneHourAgo);
    
    const errorsByCategory = this.errors.reduce((acc, error) => {
      acc[error.category] = (acc[error.category] || 0) + 1;
      return acc;
    }, {} as Record<ErrorCategory, number>);

    const errorsBySeverity = this.errors.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1;
      return acc;
    }, {} as Record<ErrorSeverity, number>);

    const errorCounts = this.errors.reduce((acc, error) => {
      acc[error.code] = (acc[error.code] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostCommonErrors = Object.entries(errorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([code, count]) => ({ code, count }));

    return {
      totalErrors: this.errors.length,
      errorsByCategory,
      errorsBySeverity,
      recentErrorRate: recentErrors.length,
      mostCommonErrors,
    };
  }

  static subscribe(listener: (errors: ErrorInfo[]) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  static setReportingEnabled(enabled: boolean) {
    this.reportingEnabled = enabled;
  }

  static isReportingEnabled(): boolean {
    return this.reportingEnabled;
  }

  private static notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener([...this.errors]);
      } catch (error) {
        console.error('Error listener failed:', error);
      }
    });
  }

  private static async reportToExternalService(errorInfo: ErrorInfo) {
    try {
      // In a real application, this would send to your error reporting service
      // (e.g., Sentry, Bugsnag, LogRocket, etc.)
      console.error('[Error Service] Reported error:', errorInfo);
      
      // Example API call
      if (errorInfo.severity === 'critical' || errorInfo.severity === 'high') {
        // Send to external service immediately for critical errors
        await fetch('/api/errors/report', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(errorInfo),
        }).catch(err => {
          console.error('Failed to report error to external service:', err);
        });
      }
    } catch (error) {
      console.error('Error reporting failed:', error);
    }
  }
}

// Error handling provider
export function ErrorHandlingProvider({ children }: { children: React.ReactNode }) {
  const [errors, setErrors] = useState<ErrorInfo[]>([]);
  const [currentError, setCurrentError] = useState<ErrorInfo | null>(null);
  const [retryAction, setRetryAction] = useState<(() => Promise<void>) | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [networkError, setNetworkError] = useState(false);
  const [enableErrorReporting, setEnableErrorReporting] = useState(true);

  const { announceToScreenReader } = useAccessibility();
  
  // Handle RBAC context safely - wrap in try-catch to handle SSR
  let currentUser = null;
  let currentTenant = null;
  let rbacLogAction: (action: string, details?: Record<string, any>) => void = () => {};
  try {
    const rbac = useRBAC();
    currentUser = rbac.currentUser;
    currentTenant = rbac.currentTenant;
    rbacLogAction = rbac.logAction;
  } catch (error) {
    // RBAC context not available during SSR, continue with null values
    currentUser = null;
    currentTenant = null;
    rbacLogAction = () => {}; // noop function
  }

  // Memoize logAction to prevent recreating on every render
  const logAction = useCallback(rbacLogAction, []);

  // Subscribe to error service
  useEffect(() => {
    const unsubscribe = ErrorService.subscribe(setErrors);
    return () => unsubscribe();
  }, []);

  // Update error reporting setting
  useEffect(() => {
    ErrorService.setReportingEnabled(enableErrorReporting);
  }, [enableErrorReporting]);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setNetworkError(false);
      announceToScreenReader('Connection restored', 'polite');
    };

    const handleOffline = () => {
      setIsOnline(false);
      setNetworkError(true);
      announceToScreenReader('Connection lost', 'assertive');
      
      // Report network error
      reportError({
        id: `network-${Date.now()}`,
        code: 'NETWORK_OFFLINE',
        message: 'Network connection lost',
        category: 'network',
        severity: 'medium',
        timestamp: new Date(),
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial state
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [announceToScreenReader]); // eslint-disable-line react-hooks/exhaustive-deps

  // Global error handlers
  useEffect(() => {
    const handleUnhandledError = (event: ErrorEvent) => {
      reportError({
        id: `unhandled-${Date.now()}`,
        code: 'UNHANDLED_ERROR',
        message: event.message,
        category: 'system',
        severity: 'high',
        timestamp: new Date(),
        stack: event.error?.stack,
        context: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      reportError({
        id: `rejection-${Date.now()}`,
        code: 'UNHANDLED_PROMISE_REJECTION',
        message: event.reason?.message || 'Unhandled promise rejection',
        category: 'system',
        severity: 'high',
        timestamp: new Date(),
        stack: event.reason?.stack,
      });
    };

    window.addEventListener('error', handleUnhandledError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleUnhandledError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const reportError = useCallback((
    error: Error | ErrorInfo, 
    context?: Record<string, any>
  ) => {
    let errorInfo: ErrorInfo;

    if (error instanceof Error) {
      // Convert Error object to ErrorInfo
      errorInfo = {
        id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        code: error.name || 'UNKNOWN_ERROR',
        message: error.message,
        category: 'system',
        severity: 'medium',
        timestamp: new Date(),
        stack: error.stack,
        context,
        userId: currentUser?.id,
        tenantId: currentTenant?.id,
      };
    } else {
      // Already an ErrorInfo object
      errorInfo = {
        ...error,
        userId: error.userId || currentUser?.id,
        tenantId: error.tenantId || currentTenant?.id,
        context: { ...error.context, ...context },
      };
    }

    ErrorService.addError(errorInfo);

    // Log action for audit trail
    if (currentUser && currentTenant) {
      logAction('error:reported', {
        errorId: errorInfo.id,
        errorCode: errorInfo.code,
        severity: errorInfo.severity,
        category: errorInfo.category,
      });
    }

    // Announce high severity errors to screen readers
    if (errorInfo.severity === 'high' || errorInfo.severity === 'critical') {
      announceToScreenReader(
        `Error occurred: ${errorInfo.message}`,
        'assertive'
      );
    }
  }, [currentUser, currentTenant, logAction, announceToScreenReader]);

  const clearError = useCallback((errorId: string) => {
    ErrorService.removeError(errorId);
    if (currentError?.id === errorId) {
      setCurrentError(null);
    }
  }, [currentError]);

  const clearAllErrors = useCallback(() => {
    ErrorService.clearAllErrors();
    setCurrentError(null);
  }, []);

  const retryLastAction = useCallback(async () => {
    if (retryAction) {
      try {
        await retryAction();
        setRetryAction(null);
      } catch (error) {
        reportError(error as Error, { action: 'retry' });
      }
    }
  }, [retryAction, reportError]);

  const showErrorToast = useCallback((
    message: string, 
    options?: Partial<ErrorDisplayOptions>
  ) => {
    // This would integrate with your toast notification system
    console.log('[Error Toast]', message, options);
  }, []);

  const showErrorDialog = useCallback((
    error: ErrorInfo, 
    options?: ErrorDisplayOptions
  ) => {
    setCurrentError(error);
  }, []);

  const dismissCurrentError = useCallback(() => {
    setCurrentError(null);
  }, []);

  const getErrorStatistics = useCallback(() => {
    return ErrorService.getErrorStatistics();
  }, []);

  const getRecentErrors = useCallback((limit?: number) => {
    return ErrorService.getRecentErrors(limit);
  }, []);

  const contextValue: ErrorHandlingContextType = {
    errors,
    currentError,
    reportError,
    clearError,
    clearAllErrors,
    retryLastAction,
    setRetryAction,
    showErrorToast,
    showErrorDialog,
    dismissCurrentError,
    enableErrorReporting,
    setEnableErrorReporting,
    getErrorStatistics,
    getRecentErrors,
    isOnline,
    networkError,
  };

  return (
    <ErrorHandlingContext.Provider value={contextValue}>
      {children}
    </ErrorHandlingContext.Provider>
  );
}

export function useErrorHandling() {
  const context = useContext(ErrorHandlingContext);
  if (context === undefined) {
    throw new Error('useErrorHandling must be used within an ErrorHandlingProvider');
  }
  return context;
}

// Utility functions for common error scenarios
export function createNetworkError(message: string, status?: number): ErrorInfo {
  return {
    id: `network-${Date.now()}`,
    code: `NETWORK_ERROR_${status || 'UNKNOWN'}`,
    message,
    category: 'network',
    severity: status && status >= 500 ? 'high' : 'medium',
    timestamp: new Date(),
    context: { status },
  };
}

export function createValidationError(field: string, message: string): ErrorInfo {
  return {
    id: `validation-${Date.now()}`,
    code: 'VALIDATION_ERROR',
    message,
    category: 'validation',
    severity: 'low',
    timestamp: new Date(),
    context: { field },
  };
}

export function createApiError(endpoint: string, status: number, message: string): ErrorInfo {
  return {
    id: `api-${Date.now()}`,
    code: `API_ERROR_${status}`,
    message,
    category: 'api',
    severity: status >= 500 ? 'high' : status >= 400 ? 'medium' : 'low',
    timestamp: new Date(),
    context: { endpoint, status },
  };
}

// Error boundary wrapper for specific components
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: {
    fallback?: React.ComponentType<{ error: Error; errorId: string; retry: () => void }>;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  }
) {
  return function WrappedComponent(props: P) {
    return (
      <EnhancedErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </EnhancedErrorBoundary>
    );
  };
}

export default ErrorHandlingProvider;