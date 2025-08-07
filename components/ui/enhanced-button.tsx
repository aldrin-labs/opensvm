'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { useTheme } from '@/lib/design-system/theme-provider';

const buttonVariants = cva(
  [
    // Base styles
    'inline-flex items-center justify-center gap-2',
    'whitespace-nowrap rounded-md text-sm font-medium',
    'transition-all duration-200 ease-in-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    'relative overflow-hidden',
    // Accessibility enhancements
    'select-none touch-manipulation',
    'active:scale-[0.98] active:transition-transform active:duration-75',
    // High contrast support
    'high-contrast:border-2 high-contrast:border-current',
  ],
  {
    variants: {
      variant: {
        default: [
          'bg-primary text-primary-foreground',
          'hover:bg-primary/90 hover:shadow-md',
          'active:bg-primary/95',
          'dark:shadow-lg dark:shadow-primary/25',
        ],
        destructive: [
          'bg-destructive text-destructive-foreground',
          'hover:bg-destructive/90 hover:shadow-md',
          'active:bg-destructive/95',
          'dark:shadow-lg dark:shadow-destructive/25',
        ],
        outline: [
          'border border-input bg-background',
          'text-foreground',
          'hover:bg-accent hover:text-accent-foreground hover:border-accent-foreground/20',
          'active:bg-accent/80',
          'shadow-sm hover:shadow-md',
        ],
        secondary: [
          'bg-secondary text-secondary-foreground',
          'hover:bg-secondary/80 hover:shadow-md',
          'active:bg-secondary/90',
          'border border-secondary-foreground/10',
        ],
        ghost: [
          'text-foreground',
          'hover:bg-accent hover:text-accent-foreground',
          'active:bg-accent/80',
          'data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
        ],
        link: [
          'text-primary underline-offset-4',
          'hover:underline hover:text-primary/80',
          'active:text-primary/90',
          'p-0 h-auto font-normal',
        ],
        gradient: [
          'bg-gradient-to-r from-primary to-primary/80',
          'text-primary-foreground',
          'hover:from-primary/90 hover:to-primary/70 hover:shadow-lg',
          'active:from-primary/95 active:to-primary/75',
          'shadow-md',
        ],
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 py-1 text-xs',
        lg: 'h-12 px-6 py-3 text-base',
        xl: 'h-14 px-8 py-4 text-lg',
        icon: 'h-10 w-10 p-0',
        'icon-sm': 'h-8 w-8 p-0',
        'icon-lg': 'h-12 w-12 p-0',
      },
      loading: {
        true: 'cursor-not-allowed',
        false: '',
      },
      fullWidth: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      loading: false,
      fullWidth: false,
    },
  }
);

// Loading spinner component
const LoadingSpinner = ({ size = 16 }: { size?: number }) => (
  <svg
    className="animate-spin"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
      className="opacity-25"
    />
    <path
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      className="opacity-75"
    />
  </svg>
);

export interface EnhancedButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  tooltip?: string;
}

const EnhancedButton = React.forwardRef<HTMLButtonElement, EnhancedButtonProps>(
  (
    {
      className,
      variant,
      size,
      loading = false,
      loadingText,
      leftIcon,
      rightIcon,
      fullWidth,
      asChild = false,
      disabled,
      children,
      tooltip,
      'aria-label': ariaLabel,
      ...props
    },
    ref
  ) => {
    const { config } = useTheme();
    const Comp = asChild ? Slot : 'button';
    
    const isDisabled = disabled || loading;
    const spinnerSize = size === 'sm' || size === 'icon-sm' ? 12 : size === 'lg' || size === 'xl' ? 20 : 16;

    // Enhance accessibility
    const accessibilityProps = {
      'aria-label': ariaLabel,
      'aria-disabled': isDisabled,
      'aria-busy': loading,
      title: tooltip,
      tabIndex: isDisabled ? -1 : 0,
    };

    // Reduce motion if user prefers
    const motionClass = config.reducedMotion ? 'transition-none' : '';

    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, loading, fullWidth }),
          motionClass,
          className
        )}
        ref={ref}
        disabled={isDisabled}
        {...accessibilityProps}
        {...props}
      >
        {/* Left icon or loading spinner */}
        {loading ? (
          <LoadingSpinner size={spinnerSize} />
        ) : leftIcon ? (
          <span className="flex-shrink-0" aria-hidden="true">
            {leftIcon}
          </span>
        ) : null}

        {/* Button content */}
        <span className={cn(
          'flex-1 truncate',
          loading && 'opacity-70'
        )}>
          {loading && loadingText ? loadingText : children}
        </span>

        {/* Right icon */}
        {rightIcon && !loading && (
          <span className="flex-shrink-0" aria-hidden="true">
            {rightIcon}
          </span>
        )}

        {/* Focus indicator for keyboard navigation */}
        <span
          className={cn(
            'absolute inset-0 rounded-md',
            'ring-2 ring-transparent',
            'focus-visible:ring-offset-2 focus-visible:ring-ring',
            'pointer-events-none'
          )}
          aria-hidden="true"
        />
      </Comp>
    );
  }
);

EnhancedButton.displayName = 'EnhancedButton';

// Button group component for related actions
export interface ButtonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
  size?: VariantProps<typeof buttonVariants>['size'];
  variant?: VariantProps<typeof buttonVariants>['variant'];
  attached?: boolean;
}

const ButtonGroup = React.forwardRef<HTMLDivElement, ButtonGroupProps>(
  ({ 
    className, 
    orientation = 'horizontal', 
    attached = false,
    children, 
    ...props 
  }, ref) => {
    return (
      <div
        ref={ref}
        role="group"
        className={cn(
          'inline-flex',
          {
            'flex-row': orientation === 'horizontal',
            'flex-col': orientation === 'vertical',
            // Attached button styles
            '[&>*:not(:first-child):not(:last-child)]:rounded-none': attached,
            '[&>*:first-child]:rounded-r-none': attached && orientation === 'horizontal',
            '[&>*:last-child]:rounded-l-none': attached && orientation === 'horizontal',
            '[&>*:first-child]:rounded-b-none': attached && orientation === 'vertical',
            '[&>*:last-child]:rounded-t-none': attached && orientation === 'vertical',
            // Spacing for non-attached buttons
            'gap-2': !attached,
          },
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

ButtonGroup.displayName = 'ButtonGroup';

export { EnhancedButton, ButtonGroup, buttonVariants };