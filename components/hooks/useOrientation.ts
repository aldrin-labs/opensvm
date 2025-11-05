/**
 * useOrientation Hook
 * 
 * Detects device orientation changes (portrait vs landscape).
 * Useful for optimizing layouts on tablets and mobile devices.
 * 
 * @module hooks/useOrientation
 */

'use client';

import { useState, useEffect } from 'react';

export type Orientation = 'portrait' | 'landscape';

/**
 * Hook for detecting device orientation
 * 
 * @returns Current device orientation ('portrait' or 'landscape')
 * 
 * @example
 * ```tsx
 * const orientation = useOrientation();
 * 
 * return (
 *   <div className={orientation === 'portrait' ? 'flex-col' : 'flex-row'}>
 *     {children}
 *   </div>
 * );
 * ```
 */
export function useOrientation(): Orientation {
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Only run on client side
    if (typeof window === 'undefined') {
      return;
    }

    const getOrientation = (): Orientation => {
      // Use screen.orientation API if available
      if (window.screen?.orientation) {
        return window.screen.orientation.type.includes('portrait') 
          ? 'portrait' 
          : 'landscape';
      }
      
      // Fallback to window dimensions
      return window.innerWidth < window.innerHeight ? 'portrait' : 'landscape';
    };

    // Set initial orientation
    setOrientation(getOrientation());

    // Listen for orientation changes
    const handleOrientationChange = () => {
      setOrientation(getOrientation());
    };

    // Modern API
    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', handleOrientationChange);
    }

    // Also listen to resize as fallback
    window.addEventListener('resize', handleOrientationChange);

    // Cleanup
    return () => {
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener('change', handleOrientationChange);
      }
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, []);

  // Return portrait during SSR to avoid hydration mismatch
  return mounted ? orientation : 'portrait';
}

/**
 * Hook for checking if device is in portrait mode
 */
export function useIsPortrait(): boolean {
  return useOrientation() === 'portrait';
}

/**
 * Hook for checking if device is in landscape mode
 */
export function useIsLandscape(): boolean {
  return useOrientation() === 'landscape';
}
