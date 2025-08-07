'use client';

import React from 'react';
import { useErrorHandling, ErrorInfo, ErrorRecoveryAction } from './index';
import { useI18n } from '@/lib/i18n';
import { useRBAC } from '@/lib/rbac';
import { RefreshCw, Home, LogOut, Settings, Wifi, WifiOff } from 'lucide-react';

// Recovery strategy types
export type RecoveryStrategy = 
  | 'retry'
  | 'refresh'
  | 'redirect'
  | 'logout'
  | 'fallback'
  | 'offline'
  | 'custom';

// Recovery action factory
export class ErrorRecoveryFactory {
  private static t: ReturnType<typeof useI18n>['t'] | null = null;
  private static rbac: ReturnType<typeof useRBAC> | null = null;

  static initialize(t: ReturnType<typeof useI18n>['t'], rbac: ReturnType<typeof useRBAC>) {
    this.t = t;
    this.rbac = rbac;
  }

  static createRetryAction(retryFn: () => Promise<void>): ErrorRecoveryAction {
    return {
      label: this.t?.('error.retry', 'Retry') || 'Retry',
      action: retryFn,
      primary: true,
      icon: <RefreshCw className="h-4 w-4" />,
    };
  }

  static createRefreshAction(): ErrorRecoveryAction {
    return {
      label: this.t?.('error.refresh', 'Refresh Page') || 'Refresh Page',
      action: () => window.location.reload(),
      primary: true,
      icon: <RefreshCw className="h-4 w-4" />,
    };
  }

  static createHomeAction(): ErrorRecoveryAction {
    return {
      label: this.t?.('error.goHome', 'Go Home') || 'Go Home',
      action: () => { window.location.href = '/'; },
      icon: <Home className="h-4 w-4" />,
    };
  }

  static createLogoutAction(): ErrorRecoveryAction {
    return {
      label: this.t?.('error.logout', 'Sign Out') || 'Sign Out',
      action: async () => {
        if (this.rbac?.logout) {
          await this.rbac.logout();
        }
        window.location.href = '/login';
      },
      icon: <LogOut className="h-4 w-4" />,
    };
  }

  static createSettingsAction(): ErrorRecoveryAction {
    return {
      label: this.t?.('error.settings', 'Settings') || 'Settings',
      action: () => { window.location.href = '/settings'; },
      icon: <Settings className="h-4 w-4" />,
    };
  }

  static createOfflineModeAction(): ErrorRecoveryAction {
    return {
      label: this.t?.('error.offlineMode', 'Continue Offline') || 'Continue Offline',
      action: async () => {
        // Switch to offline mode
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'FORCE_OFFLINE_MODE',
          });
        }
      },
      icon: <WifiOff className="h-4 w-4" />,
    };
  }

  static createReconnectAction(): ErrorRecoveryAction {
    return {
      label: this.t?.('error.reconnect', 'Try to Reconnect') || 'Try to Reconnect',
      action: async () => {
        // Force a network check
        if (navigator.onLine) {
          window.location.reload();
        }
      },
      primary: true,
      icon: <Wifi className="h-4 w-4" />,
    };
  }

  static createCustomAction(
    label: string,
    action: () => void | Promise<void>,
    options: { primary?: boolean; icon?: React.ReactNode } = {}
  ): ErrorRecoveryAction {
    return {
      label,
      action,
      primary: options.primary,
      icon: options.icon,
    };
  }
}

// Error recovery strategies based on error type
export function getRecoveryStrategiesForError(error: ErrorInfo): ErrorRecoveryAction[] {
  const strategies: ErrorRecoveryAction[] = [];

  switch (error.category) {
    case 'network':
      if (error.code.includes('OFFLINE')) {
        strategies.push(
          ErrorRecoveryFactory.createReconnectAction(),
          ErrorRecoveryFactory.createOfflineModeAction(),
          ErrorRecoveryFactory.createRefreshAction()
        );
      } else {
        strategies.push(
          ErrorRecoveryFactory.createRetryAction(async () => window.location.reload()),
          ErrorRecoveryFactory.createRefreshAction()
        );
      }
      break;

    case 'authentication':
      strategies.push(
        ErrorRecoveryFactory.createLogoutAction(),
        ErrorRecoveryFactory.createHomeAction()
      );
      break;

    case 'authorization':
      strategies.push(
        ErrorRecoveryFactory.createHomeAction(),
        ErrorRecoveryFactory.createLogoutAction()
      );
      break;

    case 'validation':
      strategies.push(
        ErrorRecoveryFactory.createRetryAction(async () => window.history.back())
      );
      break;

    case 'api':
      if (error.severity === 'critical' || error.severity === 'high') {
        strategies.push(
          ErrorRecoveryFactory.createRefreshAction(),
          ErrorRecoveryFactory.createHomeAction()
        );
      } else {
        strategies.push(
          ErrorRecoveryFactory.createRetryAction(async () => window.location.reload())
        );
      }
      break;

    case 'ui':
    case 'system':
      strategies.push(
        ErrorRecoveryFactory.createRefreshAction(),
        ErrorRecoveryFactory.createHomeAction()
      );
      break;

    default:
      strategies.push(
        ErrorRecoveryFactory.createRefreshAction(),
        ErrorRecoveryFactory.createHomeAction()
      );
      break;
  }

  return strategies;
}

// Hook for automatic error recovery
export function useErrorRecovery() {
  const { reportError, setRetryAction } = useErrorHandling();
  const { t } = useI18n();
  const rbac = useRBAC();

  React.useEffect(() => {
    ErrorRecoveryFactory.initialize(t, rbac);
  }, [t, rbac]);

  const createRecoveryAction = React.useCallback(
    (strategy: RecoveryStrategy, customFn?: () => Promise<void>) => {
      switch (strategy) {
        case 'retry':
          return customFn ? ErrorRecoveryFactory.createRetryAction(customFn) : null;
        case 'refresh':
          return ErrorRecoveryFactory.createRefreshAction();
        case 'redirect':
          return ErrorRecoveryFactory.createHomeAction();
        case 'logout':
          return ErrorRecoveryFactory.createLogoutAction();
        case 'offline':
          return ErrorRecoveryFactory.createOfflineModeAction();
        default:
          return null;
      }
    },
    []
  );

  const handleAsyncError = React.useCallback(
    async (asyncFn: () => Promise<void>, fallbackFn?: () => Promise<void>) => {
      try {
        await asyncFn();
      } catch (error) {
        reportError(error as Error, { async: true });
        
        if (fallbackFn) {
          setRetryAction(fallbackFn);
        }
      }
    },
    [reportError, setRetryAction]
  );

  const withErrorBoundary = React.useCallback(
    <T extends any[], R>(
      fn: (...args: T) => Promise<R>,
      recoveryStrategies: RecoveryStrategy[] = ['retry', 'refresh']
    ) => {
      return async (...args: T): Promise<R | null> => {
        try {
          return await fn(...args);
        } catch (error) {
          reportError(error as Error, { 
            function: fn.name,
            arguments: args,
          });
          
          // Set up recovery actions
          const actions = recoveryStrategies
            .map(strategy => createRecoveryAction(strategy))
            .filter((action): action is ErrorRecoveryAction => action !== null);
          
          if (actions.length > 0 && actions[0]) {
            setRetryAction(async () => {
              try {
                return await fn(...args);
              } catch (retryError) {
                reportError(retryError as Error, { retry: true });
                throw retryError;
              }
            });
          }
          
          return null;
        }
      };
    },
    [reportError, setRetryAction, createRecoveryAction]
  );

  return {
    createRecoveryAction,
    handleAsyncError,
    withErrorBoundary,
    getRecoveryStrategiesForError,
  };
}

// Error recovery component for manual recovery UI
interface ErrorRecoveryProps {
  error: ErrorInfo;
  customStrategies?: ErrorRecoveryAction[];
  onRecovery?: () => void;
}

export function ErrorRecoveryActions({ 
  error, 
  customStrategies,
  onRecovery 
}: ErrorRecoveryProps) {
  const { t } = useI18n();
  const strategies = customStrategies || getRecoveryStrategiesForError(error);

  const handleRecoveryAction = async (action: ErrorRecoveryAction) => {
    try {
      await action.action();
      onRecovery?.();
    } catch (recoveryError) {
      console.error('Recovery action failed:', recoveryError);
    }
  };

  if (strategies.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 mt-4">
      {strategies.map((strategy, index) => (
        <button
          key={index}
          onClick={() => handleRecoveryAction(strategy)}
          className={`inline-flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${
            strategy.primary
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
        >
          {strategy.icon && (
            <span className="h-4 w-4">
              {strategy.icon}
            </span>
          )}
          <span>{strategy.label}</span>
        </button>
      ))}
    </div>
  );
}

// Automatic error recovery based on error patterns
export class AutoRecoveryManager {
  private static recoveryAttempts = new Map<string, number>();
  private static maxAutoRetries = 3;
  private static recoveryTimeouts = new Map<string, NodeJS.Timeout>();

  static async attemptAutoRecovery(error: ErrorInfo): Promise<boolean> {
    const errorKey = `${error.code}-${error.category}`;
    const attempts = this.recoveryAttempts.get(errorKey) || 0;

    if (attempts >= this.maxAutoRetries) {
      return false;
    }

    this.recoveryAttempts.set(errorKey, attempts + 1);

    // Clear previous timeout
    const existingTimeout = this.recoveryTimeouts.get(errorKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Reset attempts after 5 minutes
    const timeout = setTimeout(() => {
      this.recoveryAttempts.delete(errorKey);
      this.recoveryTimeouts.delete(errorKey);
    }, 5 * 60 * 1000);
    
    this.recoveryTimeouts.set(errorKey, timeout);

    try {
      switch (error.category) {
        case 'network':
          if (error.code.includes('OFFLINE')) {
            // Wait for connection to be restored
            await this.waitForConnection();
            return true;
          }
          break;

        case 'api':
          if (error.code.includes('500') || error.code.includes('502')) {
            // Retry after exponential backoff
            await this.delay(Math.pow(2, attempts) * 1000);
            return true;
          }
          break;

        default:
          return false;
      }
    } catch (recoveryError) {
      console.error('Auto recovery failed:', recoveryError);
      return false;
    }

    return false;
  }

  private static async waitForConnection(): Promise<void> {
    return new Promise((resolve) => {
      if (navigator.onLine) {
        resolve();
        return;
      }

      const handleOnline = () => {
        window.removeEventListener('online', handleOnline);
        resolve();
      };

      window.addEventListener('online', handleOnline);
    });
  }

  private static async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static clearRecoveryAttempts(errorKey?: string) {
    if (errorKey) {
      this.recoveryAttempts.delete(errorKey);
      const timeout = this.recoveryTimeouts.get(errorKey);
      if (timeout) {
        clearTimeout(timeout);
        this.recoveryTimeouts.delete(errorKey);
      }
    } else {
      this.recoveryAttempts.clear();
      this.recoveryTimeouts.forEach(timeout => clearTimeout(timeout));
      this.recoveryTimeouts.clear();
    }
  }
}

export default useErrorRecovery;