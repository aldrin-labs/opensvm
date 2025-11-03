/**
 * Responsive Container Component
 * Provides consistent responsive behavior across the platform
 */

'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ResponsiveContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  mobileFullWidth?: boolean;
}

const maxWidthClasses = {
  'sm': 'max-w-screen-sm',
  'md': 'max-w-screen-md',
  'lg': 'max-w-screen-lg',
  'xl': 'max-w-screen-xl',
  '2xl': 'max-w-screen-2xl',
  'full': 'max-w-full',
};

const paddingClasses = {
  'none': '',
  'sm': 'px-2 sm:px-4',
  'md': 'px-4 sm:px-6 md:px-8',
  'lg': 'px-4 sm:px-8 md:px-12 lg:px-16',
};

export function ResponsiveContainer({
  children,
  className,
  maxWidth = 'xl',
  padding = 'md',
  mobileFullWidth = false,
}: ResponsiveContainerProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full',
        maxWidthClasses[maxWidth],
        paddingClasses[padding],
        mobileFullWidth && 'sm:max-w-none sm:px-0',
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Mobile-optimized grid component
 */
export interface ResponsiveGridProps {
  children: React.ReactNode;
  columns?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

const gapClasses = {
  'sm': 'gap-2 sm:gap-3',
  'md': 'gap-3 sm:gap-4 md:gap-6',
  'lg': 'gap-4 sm:gap-6 md:gap-8',
};

export function ResponsiveGrid({
  children,
  columns = { mobile: 1, tablet: 2, desktop: 3 },
  gap = 'md',
  className,
}: ResponsiveGridProps) {
  const gridCols = `grid-cols-${columns.mobile || 1} sm:grid-cols-${columns.tablet || 2} lg:grid-cols-${columns.desktop || 3}`;
  
  return (
    <div
      className={cn(
        'grid',
        gridCols,
        gapClasses[gap],
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Stack component for consistent vertical spacing
 */
export interface StackProps {
  children: React.ReactNode;
  spacing?: 'sm' | 'md' | 'lg';
  direction?: 'vertical' | 'horizontal';
  align?: 'start' | 'center' | 'end';
  className?: string;
}

const spacingClasses = {
  vertical: {
    'sm': 'space-y-2',
    'md': 'space-y-4',
    'lg': 'space-y-6',
  },
  horizontal: {
    'sm': 'space-x-2',
    'md': 'space-x-4',
    'lg': 'space-x-6',
  },
};

const alignClasses = {
  'start': 'items-start',
  'center': 'items-center',
  'end': 'items-end',
};

export function Stack({
  children,
  spacing = 'md',
  direction = 'vertical',
  align = 'start',
  className,
}: StackProps) {
  return (
    <div
      className={cn(
        'flex',
        direction === 'vertical' ? 'flex-col' : 'flex-row',
        spacingClasses[direction][spacing],
        alignClasses[align],
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Mobile-aware section with collapsible header
 */
export interface MobileSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export function MobileSection({
  title,
  children,
  defaultOpen = true,
  icon,
  className,
  headerClassName,
}: MobileSectionProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <section className={cn('border rounded-lg overflow-hidden', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between p-4 bg-card hover:bg-muted transition-colors',
          'sm:cursor-default sm:hover:bg-card', // Not collapsible on desktop
          headerClassName
        )}
        aria-expanded={isOpen}
        aria-label={isOpen ? `Collapse ${title}` : `Expand ${title}`}
      >
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="font-semibold text-lg">{title}</h2>
        </div>
        <ChevronRight
          className={cn(
            'h-5 w-5 transition-transform duration-200 sm:hidden',
            isOpen && 'rotate-90'
          )}
          aria-hidden="true"
        />
      </button>
      
      <div
        className={cn(
          'transition-all duration-200 overflow-hidden',
          isOpen ? 'max-h-screen' : 'max-h-0 sm:max-h-screen'
        )}
      >
        <div className="p-4 border-t">
          {children}
        </div>
      </div>
    </section>
  );
}

/**
 * Responsive card that adapts to mobile
 */
export interface ResponsiveCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
  hover?: boolean;
}

const cardPaddingClasses = {
  'sm': 'p-3 sm:p-4',
  'md': 'p-4 sm:p-6',
  'lg': 'p-6 sm:p-8',
};

export function ResponsiveCard({
  children,
  className,
  padding = 'md',
  hover = false,
}: ResponsiveCardProps) {
  return (
    <div
      className={cn(
        'bg-card border border-border rounded-lg',
        cardPaddingClasses[padding],
        hover && 'transition-shadow duration-200 hover:shadow-md',
        className
      )}
    >
      {children}
    </div>
  );
}
