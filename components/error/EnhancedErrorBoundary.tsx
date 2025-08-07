'use client';

import React, { Component, ReactNode, ErrorInfo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, RefreshCw, Bug, Copy, ExternalLink, 
  ChevronDown, ChevronRight, Shield, Zap 
} from 'lucide-react';
import { ErrorBoundaryService, ErrorBoundaryConfig } from '@/lib/error/error-boundary-service';
import logger from '@/lib/logging/logger';

interface Props {
  children: ReactNode;
  config?: Partial<ErrorBoundaryConfig>;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo, errorId: string) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  retryCount: number;
  showDetails: boolean;
}

export class EnhancedErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: NodeJS.Timeout | null = null;
  private errorService = ErrorBoundaryService.getInstance();
  private config: ErrorBoundaryConfig;

  constructor(props: Props) {
    super(props);
    
    this.config = {
      name: 'EnhancedErrorBoundary',
      enableReporting: true,
      enableRetry: true,
      maxRetries: 3,
      autoRetryDelay: 1000,
      captureProps: process.env.NODE_ENV === 'development',
      captureState: process.env.NODE_ENV === 'development',
      ...props.config
    };

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
      showDetails: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.componentError(this.config.name, error, {
      metadata: {
        componentStack: errorInfo.componentStack,
        errorBoundary: this.config.name,
        retryCount: this.state.retryCount
      }
    });

    // Report to error service
    const errorId = this.errorService.reportError(error, errorInfo, {
      component: this.config.name,
      errorBoundary: this.config.name,
      props: this.config.captureProps ? this.props : undefined,
      state: this.config.captureState ? this.state : undefined
    });

    this.setState({
      error,
      errorInfo,
      errorId
    });

    // Call custom error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo, errorId);
    }

    // Auto-retry if enabled and within limits
    if (this.config.enableRetry && this.state.retryCount < this.config.maxRetries) {
      this.scheduleRetry();
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  private scheduleRetry = () => {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }

    this.retryTimeoutId = setTimeout(() => {
      this.handleRetry();
    }, this.config.autoRetryDelay);
  };

  private handleRetry = () => {
    const newRetryCount = this.state.retryCount + 1;
    
    logger.info(`Error boundary retry attempt ${newRetryCount}`, {
      component: this.config.name,
      metadata: {
        errorId: this.state.errorId,
        retryCount: newRetryCount,
        maxRetries: this.config.maxRetries
      }
    });

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: newRetryCount,
      showDetails: false
    });
  };

  private handleManualRetry = () => {
    if (this.state.retryCount >= this.config.maxRetries) {
      // Reset retry count for manual retries
      this.setState({ retryCount: 0 });
    }
    this.handleRetry();
  };

  private toggleDetails = () => {
    this.setState(prevState => ({
      showDetails: !prevState.showDetails
    }));
  };

  private copyError = () => {
    if (!this.state.error || !this.state.errorInfo) return;

    const errorText = `Error: ${this.state.error.message}\n\nStack: ${this.state.error.stack}\n\nComponent Stack: ${this.state.errorInfo.componentStack}`;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(errorText).then(() => {
        logger.debug('Error details copied to clipboard', {
          component: this.config.name,
          metadata: { errorId: this.state.errorId }
        });
      });
    }
  };

  private reportIssue = () => {
    if (!this.state.errorId) return;

    // In a real implementation, this would open a bug report form
    // or redirect to an issue tracker with pre-filled data
    const issueUrl = `https://github.com/your-repo/issues/new?title=Error: ${encodeURIComponent(this.state.error?.message || 'Unknown error')}&body=Error ID: ${this.state.errorId}`;
    window.open(issueUrl, '_blank');
  };

  private getSeverityBadge = (error: Error) => {
    // Determine severity based on error type
    if (error.name === 'ChunkLoadError' || error.message.includes('Loading')) {
      return <Badge variant="secondary">Low</Badge>;
    }
    if (error.name === 'TypeError' || error.name === 'ReferenceError') {
      return <Badge variant="destructive">High</Badge>;
    }
    return <Badge variant="outline">Medium</Badge>;
  };

  private getErrorCategory = (error: Error): string => {
    if (error.name.includes('Chunk') || error.message.includes('Loading')) {
      return 'Loading Error';
    }
    if (error.name === 'TypeError' || error.name === 'ReferenceError') {
      return 'Runtime Error';
    }
    if (error.message.includes('Network') || error.message.includes('fetch')) {
      return 'Network Error';
    }
    return 'Application Error';
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo, errorId, retryCount, showDetails } = this.state;
      const canRetry = this.config.enableRetry && retryCount < this.config.maxRetries;

      return (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <span>Component Error</span>
                {this.getSeverityBadge(error)}
              </div>
              <Badge variant="outline" className="text-xs">
                {this.config.name}
              </Badge>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Error Summary */}
            <Alert>
              <Bug className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <div>
                    <strong>{this.getErrorCategory(error)}:</strong> {error.message}
                  </div>
                  {errorId && (
                    <div className="text-xs text-muted-foreground">
                      Error ID: <code className="bg-muted px-1 py-0.5 rounded">{errorId}</code>
                    </div>
                  )}
                  {retryCount > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Retry attempts: {retryCount} / {this.config.maxRetries}
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {canRetry ? (
                <Button onClick={this.handleManualRetry} size="sm" className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </Button>
              ) : retryCount >= this.config.maxRetries ? (
                <Button onClick={this.handleManualRetry} variant="outline" size="sm" className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
              ) : (
                <Button onClick={() => window.location.reload()} size="sm" className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Reload Page
                </Button>
              )}

              <Button variant="outline" size="sm" onClick={this.copyError} className="flex items-center gap-2">
                <Copy className="h-4 w-4" />
                Copy Error
              </Button>

              <Button variant="outline" size="sm" onClick={this.toggleDetails} className="flex items-center gap-2">
                {showDetails ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {showDetails ? 'Hide' : 'Show'} Details
              </Button>

              {process.env.NODE_ENV === 'development' && (
                <Button variant="outline" size="sm" onClick={this.reportIssue} className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Report Issue
                </Button>
              )}
            </div>

            {/* Error Details */}
            {showDetails && (
              <div className="space-y-3 pt-3 border-t">
                {/* Error Message and Stack */}
                <div>
                  <h4 className="font-medium mb-2 text-sm">Error Details</h4>
                  <div className="bg-muted p-3 rounded-md text-sm font-mono overflow-x-auto">
                    <div className="text-destructive font-semibold mb-2">
                      {error.name}: {error.message}
                    </div>
                    {error.stack && (
                      <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                        {error.stack}
                      </pre>
                    )}
                  </div>
                </div>

                {/* Component Stack */}
                {errorInfo?.componentStack && (
                  <div>
                    <h4 className="font-medium mb-2 text-sm">Component Stack</h4>
                    <div className="bg-muted p-3 rounded-md text-xs font-mono overflow-x-auto">
                      <pre className="whitespace-pre-wrap text-muted-foreground">
                        {errorInfo.componentStack}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Development Info */}
                {process.env.NODE_ENV === 'development' && (
                  <div>
                    <h4 className="font-medium mb-2 text-sm">Development Info</h4>
                    <div className="bg-muted p-3 rounded-md text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-muted-foreground">Boundary:</span>
                          <span className="ml-2 font-mono">{this.config.name}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Retry Count:</span>
                          <span className="ml-2 font-mono">{retryCount}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Error ID:</span>
                          <span className="ml-2 font-mono text-xs">{errorId}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Timestamp:</span>
                          <span className="ml-2 font-mono text-xs">
                            {new Date().toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Max Retries Warning */}
            {retryCount >= this.config.maxRetries && (
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Maximum retry attempts reached. This error has been reported automatically.
                  Please refresh the page or contact support if the issue persists.
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

// Higher-order component for easy wrapping
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  config?: Partial<ErrorBoundaryConfig>
) {
  const WithErrorBoundaryComponent = (props: P) => (
    <EnhancedErrorBoundary 
      config={{
        name: `ErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`,
        ...config
      }}
    >
      <WrappedComponent {...props} />
    </EnhancedErrorBoundary>
  );

  WithErrorBoundaryComponent.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return WithErrorBoundaryComponent;
}

// Specialized error boundaries for common use cases
export function AsyncErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <EnhancedErrorBoundary
      config={{
        name: 'AsyncErrorBoundary',
        enableRetry: true,
        maxRetries: 2,
        autoRetryDelay: 2000
      }}
      fallback={
        <div className="flex items-center justify-center p-8 text-center">
          <div>
            <Zap className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading failed. Retrying...</p>
          </div>
        </div>
      }
    >
      {children}
    </EnhancedErrorBoundary>
  );
}

export function CriticalErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <EnhancedErrorBoundary
      config={{
        name: 'CriticalErrorBoundary',
        enableRetry: false,
        enableReporting: true
      }}
      fallback={
        <div className="min-h-[400px] flex items-center justify-center">
          <Card className="max-w-md">
            <CardContent className="p-6 text-center">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Critical Error</h3>
              <p className="text-muted-foreground mb-4">
                A critical error occurred that prevents this component from functioning.
                The error has been reported automatically.
              </p>
              <Button onClick={() => window.location.reload()}>
                Reload Application
              </Button>
            </CardContent>
          </Card>
        </div>
      }
    >
      {children}
    </EnhancedErrorBoundary>
  );
}

export default EnhancedErrorBoundary;