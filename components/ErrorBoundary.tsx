"use client";

import React, { Component, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`Error in ${this.props.componentName || 'component'}:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle size={16} />
            <span>Something went wrong in {this.props.componentName || 'this component'}</span>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
