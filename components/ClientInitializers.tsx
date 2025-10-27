'use client';

import { useEffect } from 'react';

/**
 * Client-side initialization component
 * Handles browser-only initialization logic
 */
export function ClientInitializers() {
  useEffect(() => {
    // Bug #9 fix - Suppress auto-scroll warnings for sticky/fixed positioned elements
    const originalWarn = console.warn;
    console.warn = function (...args: any[]) {
      const message = args[0];
      
      // Skip auto-scroll warnings (expected behavior for sticky/fixed elements)
      if (
        typeof message === 'string' &&
        message.includes('auto-scroll behavior') &&
        (message.includes('position: sticky') || message.includes('position: fixed'))
      ) {
        return;
      }
      
      // Pass through all other warnings
      originalWarn.apply(console, args);
    };

    // Cleanup on unmount (restore original console.warn)
    return () => {
      console.warn = originalWarn;
    };
  }, []);

  return null; // This component doesn't render anything
}

export default ClientInitializers;
