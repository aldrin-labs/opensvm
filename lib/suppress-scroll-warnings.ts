/**
 * Suppress auto-scroll behavior warnings for fixed/sticky elements
 * 
 * This utility suppresses browser warnings about skipping auto-scroll behavior
 * when elements have position: sticky or position: fixed. These warnings are
 * expected and do not affect functionality.
 * 
 * Bug #9 fix - Reduces console noise
 */

export function suppressAutoScrollWarnings() {
  if (typeof window === 'undefined') return;

  // Override console.warn to filter out auto-scroll warnings
  const originalWarn = console.warn;
  console.warn = function (...args: any[]) {
    const message = args[0];
    
    // Skip auto-scroll warnings
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
}

// Auto-initialize on import
if (typeof window !== 'undefined') {
  suppressAutoScrollWarnings();
}

export default suppressAutoScrollWarnings;
