'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertTriangle,
  RefreshCw,
  Bug,
  ExternalLink,
  Copy,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  signature?: string;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  retryCount: number;
}

export class TransactionErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Transaction component error:', error, errorInfo);

    this.setState({
      error,
      errorInfo
    });

    // Call the onError callback if provided
    this.props.onError?.(error, errorInfo);

    // Report to error tracking service
    this.reportError(error, errorInfo);
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    // In a real implementation, this would send to an error tracking service
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      signature: this.props.signature,
      componentName: this.props.componentName,
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown'
    };

    console.error('Error report:', errorReport);

    // Send to error tracking service
    this.sendToErrorTrackingService(errorReport);
  };

  private handleRetry = () => {
    const { retryCount } = this.state;
    const maxRetries = 3;

    if (retryCount >= maxRetries) {
      return;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      retryCount: retryCount + 1
    });

    // Add a small delay before retry to prevent immediate re-error
    this.retryTimeoutId = setTimeout(() => {
      // Force a re-render by updating state
      this.forceUpdate();
    }, 100);
  };

  private handleCopyError = () => {
    const { error, errorInfo } = this.state;
    const errorText = `Error: ${error?.message}\n\nStack: ${error?.stack}\n\nComponent Stack: ${errorInfo?.componentStack}`;

    if (typeof window !== 'undefined' && window.navigator.clipboard) {
      window.navigator.clipboard.writeText(errorText);
    }
  };

  private toggleDetails = () => {
    this.setState(prevState => ({
      showDetails: !prevState.showDetails
    }));
  };

  private getErrorSeverity = (error: Error): 'low' | 'medium' | 'high' => {
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return 'medium';
    }

    if (message.includes('chunk') || message.includes('loading')) {
      return 'low';
    }

    return 'high';
  };

  private getErrorCategory = (error: Error): string => {
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('fetch')) {
      return 'Network Error';
    }

    if (message.includes('chunk') || message.includes('loading')) {
      return 'Loading Error';
    }

    if (message.includes('render') || message.includes('component')) {
      return 'Rendering Error';
    }

    if (message.includes('parse') || message.includes('json')) {
      return 'Data Error';
    }

    return 'Application Error';
  };

  private sendToErrorTrackingService = (errorReport: any) => {
    try {
      // Send error report to external tracking service
      // In production, this would send to Sentry, LogRocket, or similar
      if (typeof window !== 'undefined') {
        fetch('/api/error-tracking', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(errorReport),
        }).catch(err => {
          console.error('Failed to send error to tracking service:', err);
        });
      }
    } catch (err) {
      console.error('Error sending to tracking service:', err);
    }
  };

  private getSuggestions = (error: Error): string[] => {
    const message = error.message.toLowerCase();
    const suggestions: string[] = [];

    if (message.includes('network') || message.includes('fetch')) {
      suggestions.push('Check your internet connection');
      suggestions.push('Try refreshing the page');
      suggestions.push('The blockchain RPC might be temporarily unavailable');
    }

    if (message.includes('chunk') || message.includes('loading')) {
      suggestions.push('Clear your browser cache');
      suggestions.push('Try refreshing the page');
      suggestions.push('Check if you have a stable internet connection');
    }

    if (message.includes('parse') || message.includes('json')) {
      suggestions.push('The transaction data might be corrupted');
      suggestions.push('Try viewing a different transaction');
      suggestions.push('Contact support if this persists');
    }

    if (suggestions.length === 0) {
      suggestions.push('Try refreshing the page');
      suggestions.push('Clear your browser cache');
      suggestions.push('Contact support if the problem persists');
    }

    return suggestions;
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, showDetails, retryCount } = this.state;
      const { signature, componentName } = this.props;

      if (this.props.fallback) {
        return this.props.fallback;
      }

      const severity = error ? this.getErrorSeverity(error) : 'medium';
      const category = error ? this.getErrorCategory(error) : 'Application Error';
      const suggestions = error ? this.getSuggestions(error) : [];
      const maxRetries = 3;

      return (
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {componentName ? `${componentName} Error` : 'Component Error'}
              <Badge variant={severity === 'high' ? 'destructive' : severity === 'medium' ? 'default' : 'secondary'}>
                {severity.toUpperCase()}
              </Badge>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <Alert>
              <Bug className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p><strong>{category}:</strong> {error?.message || 'An unexpected error occurred'}</p>
                  {signature && (
                    <p className="text-sm">
                      <strong>Transaction:</strong>
                      <code className="ml-1 text-xs bg-muted px-1 py-0.5 rounded">
                        {signature.slice(0, 8)}...{signature.slice(-8)}
                      </code>
                    </p>
                  )}
                </div>
              </AlertDescription>
            </Alert>

            {suggestions.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Suggested Solutions:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {suggestions.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              {retryCount < maxRetries && (
                <Button onClick={this.handleRetry} size="sm" className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Retry {retryCount > 0 && `(${retryCount}/${maxRetries})`}
                </Button>
              )}

              <Button variant="outline" size="sm" onClick={this.handleCopyError} className="flex items-center gap-2">
                <Copy className="h-4 w-4" />
                Copy Error
              </Button>

              <Button variant="outline" size="sm" onClick={this.toggleDetails} className="flex items-center gap-2">
                {showDetails ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {showDetails ? 'Hide' : 'Show'} Details
              </Button>

              <Button variant="outline" size="sm">
                <a
                  href="https://github.com/your-repo/issues/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Report Issue
                </a>
              </Button>
            </div>

            {showDetails && error && (
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium mb-2">Error Details:</h4>
                  <div className="bg-muted p-3 rounded-md text-sm font-mono overflow-x-auto">
                    <div className="whitespace-pre-wrap break-all">
                      {error.message}
                    </div>
                  </div>
                </div>

                {error.stack && (
                  <div>
                    <h4 className="font-medium mb-2">Stack Trace:</h4>
                    <div className="bg-muted p-3 rounded-md text-xs font-mono overflow-x-auto max-h-40 overflow-y-auto">
                      <div className="whitespace-pre-wrap break-all">
                        {error.stack}
                      </div>
                    </div>
                  </div>
                )}

                {errorInfo?.componentStack && (
                  <div>
                    <h4 className="font-medium mb-2">Component Stack:</h4>
                    <div className="bg-muted p-3 rounded-md text-xs font-mono overflow-x-auto max-h-40 overflow-y-auto">
                      <div className="whitespace-pre-wrap break-all">
                        {errorInfo.componentStack}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {retryCount >= maxRetries && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Maximum retry attempts reached. Please refresh the page or contact support if the issue persists.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for easier usage
export function withTransactionErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName?: string
) {
  const WithErrorBoundary = (props: P & { signature?: string }) => {
    return (
      <TransactionErrorBoundary
        componentName={componentName || WrappedComponent.displayName || WrappedComponent.name}
        signature={props.signature}
      >
        <WrappedComponent {...props} />
      </TransactionErrorBoundary>
    );
  };

  WithErrorBoundary.displayName = `withTransactionErrorBoundary(${componentName || WrappedComponent.displayName || WrappedComponent.name})`;

  return WithErrorBoundary;
}

// Specific error boundary for transaction analysis
export function TransactionAnalysisErrorBoundary({
  children,
  signature
}: {
  children: ReactNode;
  signature: string;
}) {
  return (
    <TransactionErrorBoundary
      signature={signature}
      componentName="Transaction Analysis"
      onError={(error, errorInfo) => {
        // Custom error handling for transaction analysis
        console.error('Transaction analysis error:', {
          signature,
          error: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack
        });
      }}
    >
      {children}
    </TransactionErrorBoundary>
  );
}