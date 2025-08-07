'use client';

import React, { useEffect, useState } from 'react';
import { X, AlertCircle, AlertTriangle, Info, CheckCircle, RefreshCw } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useAccessibility } from '@/lib/accessibility';
import { ErrorSeverity, ErrorRecoveryAction } from '@/lib/error-handling';
import { cva } from 'class-variance-authority';

interface ErrorToastProps {
  id: string;
  title: string;
  message: string;
  severity: ErrorSeverity;
  autoHide?: number;
  dismissible?: boolean;
  recoveryActions?: ErrorRecoveryAction[];
  onDismiss: () => void;
  onRetry?: () => void;
}

const toastVariants = cva(
  [
    'fixed top-4 right-4 z-50 min-w-80 max-w-md',
    'bg-background border border-border rounded-lg shadow-lg',
    'transform transition-all duration-300 ease-in-out',
    'animate-in slide-in-from-right-full fade-in',
  ],
  {
    variants: {
      severity: {
        low: 'border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800',
        medium: 'border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800',
        high: 'border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800',
        critical: 'border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800',
      },
    },
  }
);

const iconVariants = cva('h-5 w-5', {
  variants: {
    severity: {
      low: 'text-blue-600 dark:text-blue-400',
      medium: 'text-yellow-600 dark:text-yellow-400',
      high: 'text-orange-600 dark:text-orange-400',
      critical: 'text-red-600 dark:text-red-400',
    },
  },
});

function getIconForSeverity(severity: ErrorSeverity) {
  switch (severity) {
    case 'low':
      return Info;
    case 'medium':
      return AlertCircle;
    case 'high':
      return AlertTriangle;
    case 'critical':
      return AlertTriangle;
    default:
      return AlertCircle;
  }
}

export function ErrorToast({
  id,
  title,
  message,
  severity,
  autoHide,
  dismissible = true,
  recoveryActions = [],
  onDismiss,
  onRetry,
}: ErrorToastProps) {
  const { t } = useI18n();
  const { announceToScreenReader } = useAccessibility();
  const [isVisible, setIsVisible] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);

  const Icon = getIconForSeverity(severity);

  // Auto-hide functionality
  useEffect(() => {
    if (autoHide && autoHide > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, autoHide);

      return () => clearTimeout(timer);
    }
  }, [autoHide]);

  // Announce to screen reader when toast appears
  useEffect(() => {
    const announcement = `${severity} error: ${title}. ${message}`;
    announceToScreenReader(announcement, severity === 'critical' ? 'assertive' : 'polite');
  }, [title, message, severity, announceToScreenReader]);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => {
      onDismiss();
    }, 300); // Wait for exit animation
  };

  const handleRetry = async () => {
    if (onRetry) {
      setIsRetrying(true);
      try {
        await onRetry();
        handleDismiss();
      } catch (error) {
        console.error('Retry failed:', error);
      } finally {
        setIsRetrying(false);
      }
    }
  };

  const handleActionClick = async (action: ErrorRecoveryAction) => {
    try {
      await action.action();
      handleDismiss();
    } catch (error) {
      console.error('Recovery action failed:', error);
    }
  };

  // Keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && dismissible) {
      handleDismiss();
    }
  };

  if (!isVisible) return null;

  return (
    <div
      id={`error-toast-${id}`}
      className={toastVariants({ severity })}
      role="alert"
      aria-live={severity === 'critical' ? 'assertive' : 'polite'}
      aria-labelledby={`toast-title-${id}`}
      aria-describedby={`toast-message-${id}`}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start space-x-3">
          <Icon className={iconVariants({ severity })} aria-hidden="true" />
          
          <div className="flex-1 min-w-0">
            <h3 
              id={`toast-title-${id}`}
              className="text-sm font-semibold text-foreground"
            >
              {title}
            </h3>
            <p 
              id={`toast-message-${id}`}
              className="mt-1 text-sm text-muted-foreground"
            >
              {message}
            </p>
          </div>

          {dismissible && (
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 p-1 rounded-md hover:bg-muted transition-colors"
              aria-label={t('error.dismiss', 'Dismiss error')}
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Recovery Actions */}
        {(recoveryActions.length > 0 || onRetry) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {onRetry && (
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw 
                  className={`h-3 w-3 ${isRetrying ? 'animate-spin' : ''}`} 
                  aria-hidden="true"
                />
                <span>
                  {isRetrying 
                    ? t('error.retrying', 'Retrying...') 
                    : t('error.retry', 'Retry')
                  }
                </span>
              </button>
            )}

            {recoveryActions.map((action, index) => (
              <button
                key={index}
                onClick={() => handleActionClick(action)}
                className={`inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  action.primary
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                {action.icon && (
                  <span className="h-3 w-3" aria-hidden="true">
                    {action.icon}
                  </span>
                )}
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Progress indicator for auto-hide */}
      {autoHide && autoHide > 0 && (
        <div className="h-1 bg-border overflow-hidden">
          <div 
            className="h-full bg-primary transition-all ease-linear"
            style={{
              animation: `shrink ${autoHide}ms linear`,
            }}
          />
        </div>
      )}

      <style jsx>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}

// Toast manager component
interface Toast {
  id: string;
  title: string;
  message: string;
  severity: ErrorSeverity;
  autoHide?: number;
  dismissible?: boolean;
  recoveryActions?: ErrorRecoveryAction[];
  onRetry?: () => void;
}

interface ErrorToastManagerProps {
  toasts: Toast[];
  onDismissToast: (id: string) => void;
}

export function ErrorToastManager({ toasts, onDismissToast }: ErrorToastManagerProps) {
  return (
    <div className="fixed top-0 right-0 z-50 p-4 space-y-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ErrorToast
            {...toast}
            onDismiss={() => onDismissToast(toast.id)}
          />
        </div>
      ))}
    </div>
  );
}