'use client';

import React from 'react';
import { cn } from "@/lib/utils";

export interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  showValue?: boolean;
  className?: string;
  variant?: 'default' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

/**
 * ProgressBar component for displaying progress of operations
 * 
 * @example
 * ```tsx
 * // Basic usage
 * <ProgressBar value={50} max={100} />
 * 
 * // With label and value display
 * <ProgressBar value={75} max={100} label="Loading..." showValue />
 * 
 * // With different variant and size
 * <ProgressBar value={30} max={100} variant="warning" size="lg" />
 * ```
 */
export function ProgressBar({
  value,
  max,
  label,
  showValue = false,
  className,
  variant = 'default',
  size = 'md',
  animated = true,
}: ProgressBarProps) {
  const percentage = Math.round((value / max) * 100);
  
  return (
    <div className={cn("w-full", className)}>
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-1">
          {label && (
            <span className="text-sm font-medium">{label}</span>
          )}
          {showValue && (
            <span className="text-sm text-muted-foreground">{percentage}%</span>
          )}
        </div>
      )}
      <div 
        className={cn(
          "w-full bg-muted rounded-full overflow-hidden",
          {
            "h-1": size === 'sm',
            "h-2": size === 'md',
            "h-3": size === 'lg',
          }
        )}
      >
        <div 
          className={cn(
            "h-full",
            {
              "bg-primary": variant === 'default',
              "bg-green-500": variant === 'success',
              "bg-yellow-500": variant === 'warning',
              "bg-red-500": variant === 'error',
              "transition-all duration-300 ease-in-out": true,
              "animate-pulse": animated && percentage < 100,
            }
          )}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={label}
        />
      </div>
    </div>
  );
}