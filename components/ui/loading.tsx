'use client';

import React from 'react';
import { Loader2, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Loading spinner variants
const spinnerVariants = cva(
  "animate-spin",
  {
    variants: {
      size: {
        xs: "w-3 h-3",
        sm: "w-4 h-4",
        md: "w-5 h-5",
        lg: "w-6 h-6",
        xl: "w-8 h-8",
        "2xl": "w-10 h-10",
      },
      variant: {
        default: "text-muted-foreground",
        primary: "text-primary",
        secondary: "text-secondary-foreground",
        destructive: "text-destructive",
        success: "text-green-600",
        warning: "text-yellow-600",
      }
    },
    defaultVariants: {
      size: "md",
      variant: "default"
    }
  }
);

interface LoadingSpinnerProps extends VariantProps<typeof spinnerVariants> {
  className?: string;
  icon?: 'loader' | 'refresh';
}

export function LoadingSpinner({ 
  className, 
  size, 
  variant, 
  icon = 'loader' 
}: LoadingSpinnerProps) {
  const Icon = icon === 'refresh' ? RefreshCw : Loader2;
  
  return (
    <Icon 
      className={cn(spinnerVariants({ size, variant }), className)}
      aria-hidden="true"
    />
  );
}

// Loading state variants
const loadingStateVariants = cva(
  "flex items-center justify-center",
  {
    variants: {
      size: {
        sm: "p-4",
        md: "p-8",
        lg: "p-12",
        xl: "p-16",
        full: "min-h-screen"
      },
      variant: {
        default: "",
        card: "bg-card border border-border rounded-lg",
        overlay: "fixed inset-0 bg-background/80 backdrop-blur-sm z-50",
        inline: "w-full",
      }
    },
    defaultVariants: {
      size: "md",
      variant: "default"
    }
  }
);

interface LoadingStateProps extends VariantProps<typeof loadingStateVariants> {
  className?: string;
  children?: React.ReactNode;
  message?: string;
  showSpinner?: boolean;
  spinnerSize?: VariantProps<typeof spinnerVariants>['size'];
  spinnerVariant?: VariantProps<typeof spinnerVariants>['variant'];
}

export function LoadingState({
  className,
  size,
  variant,
  children,
  message = "Loading...",
  showSpinner = true,
  spinnerSize,
  spinnerVariant,
}: LoadingStateProps) {
  return (
    <div className={cn(loadingStateVariants({ size, variant }), className)}>
      <div className="flex flex-col items-center space-y-4 text-center">
        {showSpinner && (
          <LoadingSpinner 
            size={spinnerSize || (size === 'full' ? '2xl' : 'lg')} 
            variant={spinnerVariant}
          />
        )}
        {(message || children) && (
          <div className="space-y-2">
            {message && (
              <p className="text-sm text-muted-foreground font-medium">
                {message}
              </p>
            )}
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

// Page loading component
export function PageLoader({ message }: { message?: string }) {
  return (
    <LoadingState
      size="full"
      message={message}
      className="bg-background"
    />
  );
}

// Inline loading component
export function InlineLoader({ 
  className, 
  message 
}: { 
  className?: string; 
  message?: string;
}) {
  return (
    <LoadingState
      variant="inline"
      size="sm"
      message={message}
      className={className}
      spinnerSize="sm"
    />
  );
}

// Button loading state
interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}

export function LoadingButton({ 
  loading = false, 
  loadingText, 
  children, 
  disabled,
  className,
  ...props 
}: LoadingButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center space-x-2",
        className
      )}
    >
      {loading && <LoadingSpinner size="sm" />}
      <span>{loading && loadingText ? loadingText : children}</span>
    </button>
  );
}

// Progress indicator
interface ProgressIndicatorProps {
  progress: number;
  className?: string;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'error';
  label?: string;
}

export function ProgressIndicator({
  progress,
  className,
  showPercentage = true,
  size = 'md',
  variant = 'default',
  label
}: ProgressIndicatorProps) {
  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };

  const variantClasses = {
    default: 'bg-primary',
    success: 'bg-green-600',
    warning: 'bg-yellow-600',
    error: 'bg-red-600'
  };

  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-foreground">
          {label || "Progress"}
        </span>
        {showPercentage && (
          <span className="text-sm text-muted-foreground">
            {Math.round(clampedProgress)}%
          </span>
        )}
      </div>
      <div className={cn("w-full bg-muted rounded-full overflow-hidden", sizeClasses[size])}>
        <div
          className={cn(
            "transition-all duration-300 ease-out rounded-full",
            sizeClasses[size],
            variantClasses[variant]
          )}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
}

// Loading overlay for specific elements
interface LoadingOverlayProps {
  loading: boolean;
  children: React.ReactNode;
  message?: string;
  className?: string;
}

export function LoadingOverlay({
  loading,
  children,
  message = "Loading...",
  className
}: LoadingOverlayProps) {
  return (
    <div className={cn("relative", className)}>
      {children}
      {loading && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
          <LoadingState
            message={message}
            className="bg-card border border-border rounded-lg shadow-lg"
            size="sm"
            spinnerSize="md"
          />
        </div>
      )}
    </div>
  );
}

// Status indicators
interface StatusIndicatorProps {
  status: 'loading' | 'success' | 'error' | 'idle';
  message?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusIndicator({
  status,
  message,
  className,
  size = 'md'
}: StatusIndicatorProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5', 
    lg: 'w-6 h-6'
  };

  const getIcon = () => {
    switch (status) {
      case 'loading':
        return <LoadingSpinner size={size} variant="primary" />;
      case 'success':
        return <CheckCircle className={cn(sizeClasses[size], "text-green-600")} />;
      case 'error':
        return <AlertCircle className={cn(sizeClasses[size], "text-red-600")} />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'loading':
        return 'text-primary';
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-muted-foreground';
    }
  };

  if (status === 'idle' && !message) return null;

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      {getIcon()}
      {message && (
        <span className={cn("text-sm font-medium", getStatusColor())}>
          {message}
        </span>
      )}
    </div>
  );
}

// Loading dots indicator
export function LoadingDots({ className }: { className?: string }) {
  return (
    <div className={cn("flex space-x-1", className)}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 bg-primary rounded-full animate-bounce"
          style={{
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}

// Pulse loader
export function PulseLoader({ className }: { className?: string }) {
  return (
    <div className={cn("flex space-x-2", className)}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-3 h-3 bg-primary rounded-full animate-pulse"
          style={{
            animationDelay: `${i * 0.2}s`,
            animationDuration: '1.4s'
          }}
        />
      ))}
    </div>
  );
}

// Skeleton loader (simple version)
export function SkeletonLoader({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse", className)}>
      <div className="flex space-x-4">
        <div className="rounded-full bg-muted h-12 w-12"></div>
        <div className="flex-1 space-y-2 py-1">
          <div className="h-4 bg-muted rounded w-3/4"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
      </div>
    </div>
  );
}

// Pulsing dots indicator
export function PulsingDots({ className }: { className?: string }) {
  return (
    <div className={cn("flex space-x-1", className)}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-pulse"
          style={{
            animationDelay: `${i * 0.3}s`,
            animationDuration: '1.4s'
          }}
        />
      ))}
    </div>
  );
}

// Skeleton loading placeholder
export function LoadingPlaceholder({ 
  className,
  lines = 3,
  avatar = false
}: { 
  className?: string;
  lines?: number;
  avatar?: boolean;
}) {
  return (
    <div className={cn("animate-pulse", className)}>
      <div className="flex items-center space-x-4">
        {avatar && (
          <div className="w-12 h-12 bg-muted rounded-full" />
        )}
        <div className="flex-1 space-y-2">
          {Array.from({ length: lines }).map((_, i) => (
            <div
              key={i}
              className="bg-muted rounded h-4"
              style={{ width: `${Math.random() * 40 + 60}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default LoadingSpinner;