'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { designTokens } from './tokens';

type Breakpoint = keyof typeof designTokens.breakpoints;

interface ResponsiveContextType {
  breakpoint: Breakpoint;
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLarge: boolean;
  orientation: 'portrait' | 'landscape';
  pixelRatio: number;
  prefersTouch: boolean;
  prefersHover: boolean;
}

const ResponsiveContext = createContext<ResponsiveContextType | undefined>(undefined);

function getBreakpoint(width: number): Breakpoint {
  if (width < 640) return 'xs';
  if (width < 768) return 'sm';
  if (width < 1024) return 'md';
  if (width < 1280) return 'lg';
  if (width < 1536) return 'xl';
  return '2xl';
}

function getDeviceCapabilities() {
  if (typeof window === 'undefined') {
    return {
      prefersTouch: false,
      prefersHover: true,
    };
  }

  return {
    prefersTouch: window.matchMedia('(pointer: coarse)').matches,
    prefersHover: window.matchMedia('(hover: hover)').matches,
  };
}

interface ResponsiveProviderProps {
  children: React.ReactNode;
  debounceMs?: number;
}

export function ResponsiveProvider({ 
  children, 
  debounceMs = 150 
}: ResponsiveProviderProps) {
  const [dimensions, setDimensions] = useState(() => {
    if (typeof window === 'undefined') {
      return {
        width: 1280,
        height: 800,
        pixelRatio: 1,
        orientation: 'landscape' as const,
      };
    }

    return {
      width: window.innerWidth,
      height: window.innerHeight,
      pixelRatio: window.devicePixelRatio || 1,
      orientation: window.innerHeight > window.innerWidth ? 'portrait' as const : 'landscape' as const,
    };
  });

  const [capabilities, setCapabilities] = useState(() => getDeviceCapabilities());

  const breakpoint = getBreakpoint(dimensions.width);

  // Debounced resize handler
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let timeoutId: NodeJS.Timeout;

    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setDimensions({
          width: window.innerWidth,
          height: window.innerHeight,
          pixelRatio: window.devicePixelRatio || 1,
          orientation: window.innerHeight > window.innerWidth ? 'portrait' : 'landscape',
        });
      }, debounceMs);
    };

    const handleCapabilityChange = () => {
      setCapabilities(getDeviceCapabilities());
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    // Listen for capability changes (rare, but possible)
    const touchQuery = window.matchMedia('(pointer: coarse)');
    const hoverQuery = window.matchMedia('(hover: hover)');
    
    touchQuery.addEventListener('change', handleCapabilityChange);
    hoverQuery.addEventListener('change', handleCapabilityChange);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      touchQuery.removeEventListener('change', handleCapabilityChange);
      hoverQuery.removeEventListener('change', handleCapabilityChange);
    };
  }, [debounceMs]);

  const contextValue: ResponsiveContextType = {
    breakpoint,
    width: dimensions.width,
    height: dimensions.height,
    isMobile: breakpoint === 'xs' || breakpoint === 'sm',
    isTablet: breakpoint === 'md',
    isDesktop: breakpoint === 'lg' || breakpoint === 'xl' || breakpoint === '2xl',
    isLarge: breakpoint === 'xl' || breakpoint === '2xl',
    orientation: dimensions.orientation,
    pixelRatio: dimensions.pixelRatio,
    prefersTouch: capabilities.prefersTouch,
    prefersHover: capabilities.prefersHover,
  };

  return (
    <ResponsiveContext.Provider value={contextValue}>
      {children}
    </ResponsiveContext.Provider>
  );
}

export function useResponsive() {
  const context = useContext(ResponsiveContext);
  if (context === undefined) {
    throw new Error('useResponsive must be used within a ResponsiveProvider');
  }
  return context;
}

// Utility components for responsive design
interface ShowProps {
  children: React.ReactNode;
  above?: Breakpoint;
  below?: Breakpoint;
  only?: Breakpoint | Breakpoint[];
}

export function Show({ children, above, below, only }: ShowProps) {
  const { breakpoint } = useResponsive();
  
  const breakpointValues = {
    xs: 320,
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    '2xl': 1536,
  };

  const currentValue = breakpointValues[breakpoint];

  let shouldShow = true;

  if (above) {
    shouldShow = shouldShow && currentValue >= breakpointValues[above];
  }

  if (below) {
    shouldShow = shouldShow && currentValue < breakpointValues[below];
  }

  if (only) {
    const onlyArray = Array.isArray(only) ? only : [only];
    shouldShow = shouldShow && onlyArray.includes(breakpoint);
  }

  return shouldShow ? <>{children}</> : null;
}

interface HideProps {
  children: React.ReactNode;
  above?: Breakpoint;
  below?: Breakpoint;
  only?: Breakpoint | Breakpoint[];
}

export function Hide({ children, above, below, only }: HideProps) {
  const { breakpoint } = useResponsive();
  
  const breakpointValues = {
    xs: 320,
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    '2xl': 1536,
  };

  const currentValue = breakpointValues[breakpoint];

  let shouldHide = false;

  if (above) {
    shouldHide = shouldHide || currentValue >= breakpointValues[above];
  }

  if (below) {
    shouldHide = shouldHide || currentValue < breakpointValues[below];
  }

  if (only) {
    const onlyArray = Array.isArray(only) ? only : [only];
    shouldHide = shouldHide || onlyArray.includes(breakpoint);
  }

  return shouldHide ? null : <>{children}</>;
}

// Responsive container component
interface ResponsiveContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  maxWidth?: Breakpoint | 'full' | 'none';
  fluid?: boolean;
  centered?: boolean;
  padding?: boolean | Breakpoint;
}

export const ResponsiveContainer = React.forwardRef<HTMLDivElement, ResponsiveContainerProps>(
  ({ 
    children, 
    maxWidth = '2xl',
    fluid = false,
    centered = true,
    padding = true,
    className,
    ...props 
  }, ref) => {
    const { breakpoint, isMobile } = useResponsive();
    
    let containerClasses = 'w-full';
    
    if (!fluid && maxWidth !== 'none') {
      if (maxWidth === 'full') {
        containerClasses += ' max-w-full';
      } else {
        const maxWidths = {
          xs: 'max-w-xs',
          sm: 'max-w-sm',
          md: 'max-w-md',
          lg: 'max-w-lg',
          xl: 'max-w-xl',
          '2xl': 'max-w-2xl',
        };
        containerClasses += ` ${maxWidths[maxWidth]}`;
      }
    }

    if (centered) {
      containerClasses += ' mx-auto';
    }

    if (padding) {
      if (padding === true) {
        containerClasses += ' px-4 sm:px-6 lg:px-8';
      } else {
        const paddingValues = {
          xs: 'px-2',
          sm: 'px-4',
          md: 'px-6',
          lg: 'px-8',
          xl: 'px-10',
          '2xl': 'px-12',
        };
        containerClasses += ` ${paddingValues[padding]}`;
      }
    }

    return (
      <div 
        ref={ref}
        className={`${containerClasses} ${className || ''}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

ResponsiveContainer.displayName = 'ResponsiveContainer';

// Responsive grid component
interface ResponsiveGridProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
    '2xl'?: number;
  };
  gap?: number | string;
  alignItems?: 'start' | 'center' | 'end' | 'stretch';
  justifyContent?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
}

export const ResponsiveGrid = React.forwardRef<HTMLDivElement, ResponsiveGridProps>(
  ({ 
    children,
    columns = { xs: 1, sm: 2, md: 3, lg: 4 },
    gap = 4,
    alignItems,
    justifyContent,
    className,
    ...props 
  }, ref) => {
    const { breakpoint } = useResponsive();
    
    // Get the current number of columns based on breakpoint
    const currentColumns = columns[breakpoint] || 
                          columns.lg || 
                          columns.md || 
                          columns.sm || 
                          columns.xs || 
                          1;

    const gridClasses = [
      'grid',
      `grid-cols-${currentColumns}`,
      typeof gap === 'number' ? `gap-${gap}` : `gap-[${gap}]`,
      alignItems && `items-${alignItems}`,
      justifyContent && `justify-${justifyContent}`,
    ].filter(Boolean).join(' ');

    return (
      <div 
        ref={ref}
        className={`${gridClasses} ${className || ''}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

ResponsiveGrid.displayName = 'ResponsiveGrid';

// Hook for media queries
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
    media.addEventListener('change', listener);

    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}

// Common media query hooks
export const useIsMobile = () => useMediaQuery('(max-width: 767px)');
export const useIsTablet = () => useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');
export const usePrefersDarkMode = () => useMediaQuery('(prefers-color-scheme: dark)');
export const usePrefersReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');
export const usePrefersHighContrast = () => useMediaQuery('(prefers-contrast: high)');
export const useIsPortrait = () => useMediaQuery('(orientation: portrait)');
export const useIsLandscape = () => useMediaQuery('(orientation: landscape)');