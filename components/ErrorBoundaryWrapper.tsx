'use client';

import React from 'react';
import ErrorBoundary from './ErrorBoundary';

interface ErrorBoundaryWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

// Simple wrapper component for ErrorBoundary to avoid JSX identifier issues
export function ErrorBoundaryWrapper({ children, fallback }: ErrorBoundaryWrapperProps) {
  return (
    <ErrorBoundary fallback={fallback}>
      {children}
    </ErrorBoundary>
  );
}

export default ErrorBoundaryWrapper;