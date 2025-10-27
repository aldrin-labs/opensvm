/**
 * Success Toast Component
 * Provides visual feedback for successful operations
 */

'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SuccessToastProps {
  message: string;
  description?: string;
  duration?: number;
  onClose?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function SuccessToast({
  message,
  description,
  duration = 3000,
  onClose,
  action,
}: SuccessToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, 300);
  };

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50 pointer-events-auto',
        'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800',
        'rounded-lg shadow-lg p-4 min-w-[300px] max-w-md',
        'animate-in slide-in-from-bottom-4 fade-in-0 duration-300',
        isExiting && 'animate-out slide-out-to-bottom-4 fade-out-0 duration-300'
      )}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" aria-hidden="true" />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-green-900 dark:text-green-100">
            {message}
          </p>
          {description && (
            <p className="mt-1 text-sm text-green-700 dark:text-green-300">
              {description}
            </p>
          )}
          
          {action && (
            <button
              onClick={() => {
                action.onClick();
                handleClose();
              }}
              className="mt-2 text-sm font-medium text-green-600 dark:text-green-400 hover:text-green-500 dark:hover:text-green-300 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 rounded"
            >
              {action.label}
            </button>
          )}
        </div>

        <button
          onClick={handleClose}
          className="flex-shrink-0 text-green-400 hover:text-green-300 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 rounded p-1"
          aria-label="Close notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Success Toast Manager Hook
 */
export function useSuccessToast() {
  const [toasts, setToasts] = useState<Array<SuccessToastProps & { id: string }>>([]);

  const showSuccess = (props: SuccessToastProps) => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { ...props, id }]);
  };

  const hideToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return {
    showSuccess,
    toasts,
    hideToast,
  };
}

/**
 * Quick success message helpers
 */
export const showQuickSuccess = (message: string) => {
  // Create and auto-remove a toast
  const container = document.createElement('div');
  document.body.appendChild(container);
  
  const root = (React as any).createRoot?.(container);
  if (!root) return; // Fallback for older React versions
  
  root.render(
    <SuccessToast
      message={message}
      duration={2000}
      onClose={() => {
        setTimeout(() => {
          root.unmount();
          document.body.removeChild(container);
        }, 300);
      }}
    />
  );
};
