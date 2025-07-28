'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="container mx-auto px-4 py-8">
          <div className="bg-background rounded-lg p-6 shadow-lg border border-destructive/20">
            <h2 className="text-xl font-semibold text-destructive mb-4">Something went wrong</h2>
            <p className="text-foreground mb-4 whitespace-pre-wrap">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <div className="mt-6">
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.location.reload();
                  }
                }}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}