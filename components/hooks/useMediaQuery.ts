/**
 * useMediaQuery Hook
 * 
 * Detects screen size changes and returns whether a media query matches.
 * Useful for responsive layouts and conditional rendering based on viewport size.
 * 
 * @module hooks/useMediaQuery
 */

'use client';

import { useState, useEffect } from 'react';

/**
 * Hook for detecting media query matches
 * 
 * @param query - CSS media query string (e.g., '(min-width: 768px)')
 * @returns boolean indicating if the query matches
 * 
 * @example
 * ```tsx
 * const isMobile = useMediaQuery('(max-width: 767px)');
 * const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
 * const isDesktop = useMediaQuery('(min-width: 1024px)');
 * 
 * if (isMobile) {
 *   return <MobileLayout />;
 * }
 * ```
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Only run on client side
    if (typeof window === 'undefined') {
      return;
    }

    const media = window.matchMedia(query);
    
    // Set initial value
    setMatches(media.matches);

    // Create event listener
    const listener = (e: MediaQueryListEvent) => {
      setMatches(e.matches);
    };

    // Modern browsers
    if (media.addEventListener) {
      media.addEventListener('change', listener);
    } else {
      // Legacy browsers
      media.addListener(listener);
    }

    // Cleanup
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', listener);
      } else {
        media.removeListener(listener);
      }
    };
  }, [query]);

  // Return false during SSR to avoid hydration mismatch
  return mounted ? matches : false;
}

/**
 * Preset breakpoint hooks for common use cases
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)');
}

export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
}

export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}

export function useIsLargeDesktop(): boolean {
  return useMediaQuery('(min-width: 1920px)');
}

/**
 * Hook for getting current breakpoint name
 */
export type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'large-desktop';

export function useBreakpoint(): Breakpoint {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const isLargeDesktop = useIsLargeDesktop();

  if (isMobile) return 'mobile';
  if (isTablet) return 'tablet';
  if (isLargeDesktop) return 'large-desktop';
  return 'desktop';
}
