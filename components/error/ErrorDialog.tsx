'use client';

import React, { useEffect, useState } from 'react';
import { X, AlertTriangle, RefreshCw, Copy, ExternalLink, ChevronDown, ChevronUp, Bug } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useAccessibility } from '@/lib/accessibility';
import { ErrorInfo, ErrorRecoveryAction } from '@/lib/error-handling';

interface ErrorDialogProps {
  error: ErrorInfo;
  isOpen: boolean;
  onClose: () => void;
  recoveryActions?: ErrorRecoveryAction[];
  showTechnicalDetails?: boolean;
  onRetry?: () => void;
}

export function ErrorDialog({
  error,
  isOpen,
  onClose,
  recoveryActions = [],
  showTechnicalDetails = false,
  onRetry,
}: ErrorDialogProps) {
  const { t } = useI18n();
  const { announceToScreenReader, focusElement } = useAccessibility();
  const [showDetails, setShowDetails] = useState(showTechnicalDetails);
  const [isRetrying, setIsRetrying] = useState(false);
  const [copied, setCopied] = useState(false);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      const dialog = document.getElementById('error-dialog');
      if (dialog) {
        focusElement(dialog);
        announceToScreenReader(
          `Error dialog opened: ${error.message}`,
          'assertive'
        );
      }
    }
  }, [isOpen, error.message, focusElement, announceToScreenReader]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleRetry = async () => {
    if (onRetry) {
      setIsRetrying(true);
      try {
        await onRetry();
        onClose();
      } catch (retryError) {
        console.error('Retry failed:', retryError);
      } finally {
        setIsRetrying(false);
      }
    }
  };

  const handleActionClick = async (action: ErrorRecoveryAction) => {
    try {
      await action.action();
      onClose();
    } catch (actionError) {
      console.error('Recovery action failed:', actionError);
    }
  };

  const copyErrorDetails = async () => {
    const details = {
      id: error.id,
      code: error.code,
      message: error.message,
      category: error.category,
      severity: error.severity,
      timestamp: error.timestamp.toISOString(),
      stack: error.stack,
      context: error.context,
      url: error.url,
      userAgent: error.userAgent,
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(details, null, 2));
      setCopied(true);
      announceToScreenReader('Error details copied to clipboard', 'polite');
      setTimeout(() => setCopied(false), 2000);
    } catch (copyError) {
      console.error('Failed to copy error details:', copyError);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low':
        return 'text-blue-600 dark:text-blue-400';
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'high':
        return 'text-orange-600 dark:text-orange-400';
      case 'critical':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case 'low':
        return 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800';
      case 'medium':
        return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800';
      case 'high':
        return 'bg-orange-50 border-orange-200 dark:bg-orange-950 dark:border-orange-800';
      case 'critical':
        return 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800';
      default:
        return 'bg-gray-50 border-gray-200 dark:bg-gray-950 dark:border-gray-800';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        id="error-dialog"
        className="relative bg-background border border-border rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
        role="dialog"
        aria-labelledby="error-dialog-title"
        aria-describedby="error-dialog-description"
        tabIndex={-1}
      >
        {/* Header */}
        <div className={`px-6 py-4 border-b border-border ${getSeverityBg(error.severity)}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <AlertTriangle 
                className={`h-6 w-6 ${getSeverityColor(error.severity)}`}
                aria-hidden="true"
              />
              <div>
                <h2 
                  id="error-dialog-title"
                  className="text-lg font-semibold text-foreground"
                >
                  {t('error.errorOccurred', 'An Error Occurred')}
                </h2>
                <div className="flex items-center space-x-2 mt-1">
                  <span className={`text-xs font-medium px-2 py-1 rounded ${getSeverityBg(error.severity)} ${getSeverityColor(error.severity)}`}>
                    {error.severity.toUpperCase()}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {error.category.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-md hover:bg-muted transition-colors"
              aria-label={t('error.closeDialog', 'Close error dialog')}
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto max-h-96">
          <p 
            id="error-dialog-description"
            className="text-foreground mb-4"
          >
            {error.message}
          </p>

          {/* Error Code */}
          <div className="mb-4">
            <span className="text-sm text-muted-foreground">
              {t('error.errorCode', 'Error Code')}: 
            </span>
            <code className="ml-2 px-2 py-1 bg-muted rounded text-sm font-mono">
              {error.code}
            </code>
          </div>

          {/* Timestamp */}
          <div className="mb-6">
            <span className="text-sm text-muted-foreground">
              {t('error.occurred', 'Occurred')}: 
            </span>
            <span className="ml-2 text-sm">
              {error.timestamp.toLocaleString()}
            </span>
          </div>

          {/* Technical Details Toggle */}
          <div className="mb-4">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center space-x-2 text-sm text-primary hover:text-primary/80 transition-colors"
              aria-expanded={showDetails}
              aria-controls="error-technical-details"
            >
              {showDetails ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              <span>
                {showDetails 
                  ? t('error.hideTechnicalDetails', 'Hide Technical Details')
                  : t('error.showTechnicalDetails', 'Show Technical Details')
                }
              </span>
            </button>
          </div>

          {/* Technical Details */}
          {showDetails && (
            <div
              id="error-technical-details"
              className="mb-6 p-4 bg-muted rounded-lg"
              role="region"
              aria-labelledby="technical-details-heading"
            >
              <h3 
                id="technical-details-heading"
                className="text-sm font-semibold text-foreground mb-3 flex items-center"
              >
                <Bug className="h-4 w-4 mr-2" />
                {t('error.technicalDetails', 'Technical Details')}
              </h3>

              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-medium text-foreground">ID:</span>
                  <span className="ml-2 font-mono text-muted-foreground">{error.id}</span>
                </div>

                {error.url && (
                  <div>
                    <span className="font-medium text-foreground">URL:</span>
                    <span className="ml-2 font-mono text-muted-foreground break-all">{error.url}</span>
                  </div>
                )}

                {error.context && Object.keys(error.context).length > 0 && (
                  <div>
                    <span className="font-medium text-foreground">Context:</span>
                    <pre className="mt-1 p-2 bg-background border rounded text-xs font-mono overflow-x-auto">
                      {JSON.stringify(error.context, null, 2)}
                    </pre>
                  </div>
                )}

                {error.stack && (
                  <div>
                    <span className="font-medium text-foreground">Stack Trace:</span>
                    <pre className="mt-1 p-2 bg-background border rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                      {error.stack}
                    </pre>
                  </div>
                )}

                {error.userAgent && (
                  <div>
                    <span className="font-medium text-foreground">User Agent:</span>
                    <span className="ml-2 text-xs text-muted-foreground break-all">{error.userAgent}</span>
                  </div>
                )}
              </div>

              {/* Copy Details Button */}
              <div className="mt-4 flex justify-end">
                <button
                  onClick={copyErrorDetails}
                  className="inline-flex items-center space-x-2 px-3 py-1.5 text-xs bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
                >
                  <Copy className="h-3 w-3" />
                  <span>
                    {copied 
                      ? t('error.copied', 'Copied!')
                      : t('error.copyDetails', 'Copy Details')
                    }
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-border bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {onRetry && (
                <button
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <RefreshCw 
                    className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} 
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
                  className={`inline-flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${
                    action.primary
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                >
                  {action.icon && (
                    <span className="h-4 w-4">
                      {action.icon}
                    </span>
                  )}
                  <span>{action.label}</span>
                </button>
              ))}

              <a
                href={`mailto:support@opensvm.com?subject=Error Report: ${error.code}&body=${encodeURIComponent(
                  `Error ID: ${error.id}\nError Code: ${error.code}\nMessage: ${error.message}\nTimestamp: ${error.timestamp.toISOString()}\n\nPlease describe what you were doing when this error occurred:`
                )}`}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                <span>{t('error.reportError', 'Report Error')}</span>
              </a>
            </div>

            <button
              onClick={onClose}
              className="px-4 py-2 bg-muted text-muted-foreground rounded-md hover:bg-muted/80 transition-colors"
            >
              {t('common.close', 'Close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}