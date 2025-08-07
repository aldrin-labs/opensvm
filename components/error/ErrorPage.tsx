'use client';

import React from 'react';
import { RefreshCw, Home, Mail, AlertTriangle, ExternalLink } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useAccessibility } from '@/lib/accessibility';
import { ErrorInfo } from '@/lib/error-handling';

interface ErrorPageProps {
  error?: ErrorInfo;
  title?: string;
  description?: string;
  showRetry?: boolean;
  showHomeButton?: boolean;
  showSupportContact?: boolean;
  onRetry?: () => void;
}

export function ErrorPage({
  error,
  title,
  description,
  showRetry = true,
  showHomeButton = true,
  showSupportContact = true,
  onRetry,
}: ErrorPageProps) {
  const { t } = useI18n();
  const { announceToScreenReader } = useAccessibility();

  const handleRetry = () => {
    if (onRetry) {
      announceToScreenReader('Retrying...', 'polite');
      onRetry();
    } else {
      window.location.reload();
    }
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  const errorTitle = title || (error ? 
    `${error.severity === 'critical' ? 'Critical ' : ''}System Error` : 
    'Something Went Wrong'
  );

  const errorDescription = description || (error ?
    error.message :
    'An unexpected error occurred. Please try again or contact support if the problem persists.'
  );

  const getSeverityIcon = () => {
    if (!error) return AlertTriangle;
    
    switch (error.severity) {
      case 'critical':
        return AlertTriangle;
      case 'high':
        return AlertTriangle;
      default:
        return AlertTriangle;
    }
  };

  const getSeverityColor = () => {
    if (!error) return 'text-red-600 dark:text-red-400';
    
    switch (error.severity) {
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

  const Icon = getSeverityIcon();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="text-center max-w-2xl w-full">
        {/* Error Icon */}
        <div className="w-24 h-24 mx-auto mb-8 flex items-center justify-center bg-destructive/10 rounded-full">
          <Icon 
            className={`w-12 h-12 ${getSeverityColor()}`}
            aria-hidden="true"
          />
        </div>
        
        {/* Error Title */}
        <h1 className="text-4xl font-bold text-foreground mb-4">
          {errorTitle}
        </h1>
        
        {/* Error Description */}
        <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
          {errorDescription}
        </p>

        {/* Error Code */}
        {error && (
          <div className="mb-8">
            <span className="inline-block px-3 py-1 bg-muted text-muted-foreground text-sm rounded-full font-mono">
              {t('error.errorCode', 'Error Code')}: {error.code}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
          {showRetry && (
            <button
              onClick={handleRetry}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <RefreshCw className="w-5 h-5" />
              <span>{t('error.tryAgain', 'Try Again')}</span>
            </button>
          )}
          
          {showHomeButton && (
            <button
              onClick={handleGoHome}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors focus:ring-2 focus:ring-secondary focus:ring-offset-2"
            >
              <Home className="w-5 h-5" />
              <span>{t('error.goHome', 'Go Home')}</span>
            </button>
          )}
        </div>

        {/* Support Section */}
        {showSupportContact && (
          <div className="border-t border-border pt-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {t('error.needHelp', 'Need Help?')}
            </h2>
            
            <p className="text-muted-foreground mb-6">
              {t('error.supportDescription', 
                'If this problem continues, please contact our support team. Include the error code above in your message.'
              )}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={`mailto:support@opensvm.com?subject=Error Report: ${error?.code || 'Unknown'}&body=${encodeURIComponent(
                  `Error Details:\n${error ? `ID: ${error.id}\nCode: ${error.code}\nMessage: ${error.message}\nTimestamp: ${error.timestamp.toISOString()}` : 'No error details available'}\n\nPlease describe what you were doing when this error occurred:`
                )}`}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
              >
                <Mail className="w-5 h-5" />
                <span>{t('error.contactSupport', 'Contact Support')}</span>
              </a>

              <a
                href="https://help.opensvm.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors focus:ring-2 focus:ring-green-600 focus:ring-offset-2"
              >
                <ExternalLink className="w-5 h-5" />
                <span>{t('error.helpCenter', 'Help Center')}</span>
              </a>
            </div>
          </div>
        )}

        {/* Development Mode Details */}
        {process.env.NODE_ENV === 'development' && error && (
          <details className="mt-8 text-left bg-muted p-6 rounded-lg">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground mb-4">
              {t('error.developmentDetails', 'Development Details')}
            </summary>
            
            <div className="space-y-4 text-sm">
              <div>
                <span className="font-semibold text-foreground">Error ID:</span>
                <span className="ml-2 font-mono text-muted-foreground">{error.id}</span>
              </div>
              
              <div>
                <span className="font-semibold text-foreground">Timestamp:</span>
                <span className="ml-2 text-muted-foreground">{error.timestamp.toISOString()}</span>
              </div>

              <div>
                <span className="font-semibold text-foreground">Category:</span>
                <span className="ml-2 text-muted-foreground">{error.category}</span>
              </div>

              <div>
                <span className="font-semibold text-foreground">Severity:</span>
                <span className="ml-2 text-muted-foreground">{error.severity}</span>
              </div>

              {error.context && Object.keys(error.context).length > 0 && (
                <div>
                  <span className="font-semibold text-foreground">Context:</span>
                  <pre className="mt-2 p-3 bg-background border rounded text-xs font-mono overflow-auto max-h-40">
                    {JSON.stringify(error.context, null, 2)}
                  </pre>
                </div>
              )}

              {error.stack && (
                <div>
                  <span className="font-semibold text-foreground">Stack Trace:</span>
                  <pre className="mt-2 p-3 bg-background border rounded text-xs font-mono overflow-auto max-h-60 whitespace-pre-wrap">
                    {error.stack}
                  </pre>
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

// Specific error pages for common scenarios
export function NetworkErrorPage({ onRetry }: { onRetry?: () => void }) {
  const { t } = useI18n();
  
  return (
    <ErrorPage
      title={t('error.networkError', 'Network Connection Error')}
      description={t('error.networkErrorDescription', 
        'Unable to connect to our servers. Please check your internet connection and try again.'
      )}
      onRetry={onRetry}
      showSupportContact={false}
    />
  );
}

export function MaintenanceErrorPage() {
  const { t } = useI18n();
  
  return (
    <ErrorPage
      title={t('error.maintenance', 'Under Maintenance')}
      description={t('error.maintenanceDescription',
        'Our service is temporarily unavailable due to scheduled maintenance. Please try again later.'
      )}
      showRetry={false}
      showHomeButton={false}
    />
  );
}

export function NotFoundErrorPage() {
  const { t } = useI18n();
  
  return (
    <ErrorPage
      title={t('error.pageNotFound', 'Page Not Found')}
      description={t('error.pageNotFoundDescription',
        'The page you are looking for does not exist or has been moved.'
      )}
      showRetry={false}
    />
  );
}

export function UnauthorizedErrorPage({ onRetry }: { onRetry?: () => void }) {
  const { t } = useI18n();
  
  return (
    <ErrorPage
      title={t('error.unauthorized', 'Access Denied')}
      description={t('error.unauthorizedDescription',
        'You do not have permission to access this resource. Please contact your administrator if you believe this is an error.'
      )}
      onRetry={onRetry}
      showHomeButton={true}
    />
  );
}