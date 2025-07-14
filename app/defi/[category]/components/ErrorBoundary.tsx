'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Log error to console in development with more context
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Error caught by boundary');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Component:', this.props.componentName || 'Unknown');
      console.error('Stack:', error.stack);
      console.groupEnd();
    }

    // In production, you might want to log to an error reporting service
    // e.g., Sentry, LogRocket, etc.
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry.captureException(error, { contexts: { errorInfo } });
      console.warn('Production error caught:', {
        message: error.message,
        component: this.props.componentName || 'Unknown',
        timestamp: new Date().toISOString()
      });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="flex items-center justify-center min-h-[400px] p-6">
          <div className="max-w-md w-full">
            <Card className="p-6 bg-destructive/10 border border-destructive/20">
              <div className="flex items-start gap-3 mb-4">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-lg font-semibold text-destructive mb-2">
                    Something went wrong
                  </h3>
                  <p className="text-sm text-destructive/80">
                    {this.props.componentName
                      ? `There was an error loading the ${this.props.componentName} section. `
                      : 'There was an error loading this content. '
                    }
                    Please try refreshing the page or contact support if the problem persists.
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={this.handleRetry} variant="outline" className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
                <Button
                  onClick={() => window.location.reload()}
                  variant="default"
                >
                  Refresh Page
                </Button>
              </div>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                    Error Details (Development Only)
                  </summary>
                  <pre className="mt-2 p-4 bg-muted rounded-md text-xs overflow-auto max-h-40">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
            </Card>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
