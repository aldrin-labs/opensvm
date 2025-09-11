import React, { Component, ReactNode } from 'react';
import { track } from '../../../lib/ai/telemetry';

interface ChatErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ChatErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
}

class ChatErrorBoundary extends Component<ChatErrorBoundaryProps, ChatErrorBoundaryState> {
    private retryCount = 0;
    private maxRetries = 3;

    constructor(props: ChatErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): ChatErrorBoundaryState {
        return {
            hasError: true,
            error,
            errorInfo: null,
        };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ChatUI Error Boundary caught an error:', error, errorInfo);

        this.setState({
            error,
            errorInfo,
        });

        // Track error for telemetry
        track('chat_error_boundary', {
            error: error.message,
            stack: error.stack?.slice(0, 500), // Limit stack trace size
            componentStack: errorInfo.componentStack?.slice(0, 500),
            retryCount: this.retryCount,
        });

        // Call custom error handler if provided
        this.props.onError?.(error, errorInfo);
    }

    handleRetry = () => {
        if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            this.setState({
                hasError: false,
                error: null,
                errorInfo: null,
            });

            track('chat_error_boundary_retry', {
                retryCount: this.retryCount,
            });
        }
    };

    handleReset = () => {
        this.retryCount = 0;
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });

        track('chat_error_boundary_reset', {});
    };

    render() {
        if (this.state.hasError) {
            // Use custom fallback if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default error UI
            return (
                <div className="flex flex-col items-center justify-center h-full p-8 bg-black text-white">
                    <div className="max-w-md text-center space-y-4">
                        <div className="text-red-400 text-6xl mb-4">⚠️</div>
                        <h2 className="text-xl font-semibold text-red-400">Chat Interface Error</h2>
                        <p className="text-white/80">
                            Something went wrong with the chat interface. This is usually temporary.
                        </p>

                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <details className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded text-left">
                                <summary className="cursor-pointer text-red-300 text-sm font-medium">
                                    Error Details (Development Only)
                                </summary>
                                <div className="mt-2 text-xs text-red-200 font-mono">
                                    <div className="mb-2">
                                        <strong>Error:</strong> {this.state.error.message}
                                    </div>
                                    {this.state.error.stack && (
                                        <div className="mb-2">
                                            <strong>Stack:</strong>
                                            <pre className="whitespace-pre-wrap mt-1 text-xs">
                                                {this.state.error.stack}
                                            </pre>
                                        </div>
                                    )}
                                    {this.state.errorInfo?.componentStack && (
                                        <div>
                                            <strong>Component Stack:</strong>
                                            <pre className="whitespace-pre-wrap mt-1 text-xs">
                                                {this.state.errorInfo.componentStack}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            </details>
                        )}

                        <div className="flex gap-3 justify-center mt-6">
                            {this.retryCount < this.maxRetries && (
                                <button
                                    onClick={this.handleRetry}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    Try Again {this.retryCount > 0 && `(${this.maxRetries - this.retryCount} left)`}
                                </button>
                            )}
                            <button
                                onClick={this.handleReset}
                                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
                            >
                                Reset Chat
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                            >
                                Reload Page
                            </button>
                        </div>

                        <p className="text-white/60 text-sm mt-4">
                            If this problem persists, try refreshing the page or clearing your browser cache.
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export { ChatErrorBoundary };
