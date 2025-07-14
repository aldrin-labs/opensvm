'use client';

import React from 'react';
import { createLogger } from '@/lib/debug-logger';

const logger = createLogger('VIRTUAL_TABLE_ERROR_BOUNDARY');

interface VirtualTableErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface VirtualTableErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
  lastErrorTime: number;
}

export class VirtualTableErrorBoundary extends React.Component<
  VirtualTableErrorBoundaryProps,
  VirtualTableErrorBoundaryState
> {
  private errorFrequencyTracker: Map<string, number> = new Map();
  private readonly MAX_ERROR_FREQUENCY = 5; // Max 5 errors per minute
  private readonly ERROR_FREQUENCY_WINDOW = 60000; // 1 minute

  constructor(props: VirtualTableErrorBoundaryProps) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorCount: 0, 
      lastErrorTime: 0 
    };
  }

  static getDerivedStateFromError(error: Error): Partial<VirtualTableErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return { 
      hasError: true, 
      error,
      lastErrorTime: Date.now()
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const now = Date.now();
    const errorKey = error.message.substring(0, 100); // Use first 100 chars as key
    
    // Track error frequency
    const currentCount = this.errorFrequencyTracker.get(errorKey) || 0;
    this.errorFrequencyTracker.set(errorKey, currentCount + 1);

    // Clean up old entries (older than window)
    setTimeout(() => {
      this.errorFrequencyTracker.delete(errorKey);
    }, this.ERROR_FREQUENCY_WINDOW);

    // Check if this is a high-frequency error
    const isHighFrequency = currentCount >= this.MAX_ERROR_FREQUENCY;
    
    // Enhanced error classification
    const isDOMError = error.message.includes('removeChild') || 
                      error.message.includes('appendChild') ||
                      error.message.includes('insertBefore') ||
                      error.message.includes('replaceChild');
    
    const isRenderError = error.message.includes('render') ||
                         error.message.includes('unmount') ||
                         error.message.includes('setState');

    // Update state with error count
    this.setState(prevState => ({
      errorCount: prevState.errorCount + 1
    }));

    // Log appropriately based on error type and frequency
    if (isHighFrequency) {
      logger.error('High frequency VirtualTable error detected:', {
        error: error.message,
        stack: error.stack,
        errorInfo,
        frequency: currentCount,
        errorType: isDOMError ? 'DOM' : isRenderError ? 'RENDER' : 'UNKNOWN'
      });
      
      // Alert if happening too often
      this.alertHighFrequencyErrors(errorKey, currentCount);
    } else if (!isDOMError) {
      // Log non-DOM errors for investigation
      logger.warn('VirtualTable error:', {
        error: error.message,
        stack: error.stack,
        errorInfo,
        errorType: isRenderError ? 'RENDER' : 'UNKNOWN'
      });
    } else {
      // Just debug log DOM errors (they're usually harmless)
      logger.debug('DOM manipulation error in VirtualTable:', error.message);
    }

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  private alertHighFrequencyErrors(errorKey: string, frequency: number) {
    // In production, this could send alerts to monitoring systems
    logger.error(`VirtualTable error frequency alert: "${errorKey}" occurred ${frequency} times`);
    
    // Could trigger monitoring alerts here
    if (typeof window !== 'undefined' && 'localStorage' in window) {
      try {
        const alertKey = `vtable_error_alert_${Date.now()}`;
        localStorage.setItem(alertKey, JSON.stringify({
          errorKey,
          frequency,
          timestamp: Date.now(),
          component: 'VirtualTableErrorBoundary'
        }));
      } catch (e) {
        // Ignore localStorage errors
      }
    }
  }

  private handleRetry = () => {
    logger.debug('Retrying VirtualTable render');
    this.setState({ 
      hasError: false, 
      error: null 
    });
  };

  private handleForceReload = () => {
    logger.debug('Force reloading due to VirtualTable errors');
    // Force a re-render after a short delay
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }, 100);
  };

  render() {
    if (this.state.hasError) {
      // Show different UI based on error frequency
      const isRepeatedError = this.state.errorCount > 3;
      
      // Fallback UI for virtual table errors
      return this.props.fallback || (
        <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            <p className="text-sm font-medium text-foreground">
              Table Rendering Issue
            </p>
          </div>
          
          <p className="text-sm text-muted-foreground mb-3">
            {isRepeatedError 
              ? `Multiple rendering errors detected (${this.state.errorCount}). This may indicate a data or compatibility issue.`
              : 'Temporary rendering error. This usually resolves automatically.'
            }
          </p>
          
          <div className="flex gap-2">
            <button
              onClick={this.handleRetry}
              className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Retry
            </button>
            
            {isRepeatedError && (
              <button
                onClick={this.handleForceReload}
                className="px-3 py-1 text-xs border border-border rounded text-muted-foreground hover:bg-muted"
              >
                Force Reload
              </button>
            )}
          </div>
          
          {this.state.error && (
            <details className="mt-3">
              <summary className="text-xs text-muted-foreground cursor-pointer">
                Error Details
              </summary>
              <pre className="mt-1 text-xs text-muted-foreground overflow-x-auto">
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}