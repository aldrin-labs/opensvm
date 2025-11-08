'use client';

import React from 'react';

interface AlertProps {
  variant?: 'default' | 'destructive' | 'success' | 'warning';
  children: React.ReactNode;
  className?: string;
}

interface AlertDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ variant = 'default', children, className = '', ...props }, ref) => {
    const baseClasses = 'relative w-full rounded-lg border p-4';
    
    const variantClasses = {
      default: 'bg-background text-foreground border-border',
      destructive: 'border-destructive/50 bg-destructive/10 text-destructive-foreground',
      success: 'border-success/50 bg-success/10 text-success-foreground',
      warning: 'border-warning/50 bg-warning/10 text-warning-foreground'
    };

    return (
      <div
        ref={ref}
        className={`${baseClasses} ${variantClasses[variant]} ${className}`}
        role="alert"
        {...props}
      >
        {children}
      </div>
    );
  }
);

Alert.displayName = 'Alert';

const AlertDescription = React.forwardRef<HTMLParagraphElement, AlertDescriptionProps>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`text-sm [&_p]:leading-relaxed ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

AlertDescription.displayName = 'AlertDescription';

const AlertTitle = React.forwardRef<HTMLHeadingElement, AlertDescriptionProps>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <h5
        ref={ref}
        className={`mb-1 font-medium leading-none tracking-tight ${className}`}
        {...props}
      >
        {children}
      </h5>
    );
  }
);

AlertTitle.displayName = 'AlertTitle';

export { Alert, AlertDescription, AlertTitle };
