import { useState, useEffect } from 'react';

/**
 * useDebounce
 * Simple debounce hook returning a debounced copy of a value after `delay` ms.
 * - Updates only after user pauses typing -> good for expensive suggestion generation.
 */
export interface UseDebounceOptions {
    /** Changes to this value cancel the pending debounce without updating. */
    cancel?: any;
    /** Changes to this value immediately flush current value (skips delay). */
    flush?: any;
}

/**
 * useDebounce with optional cancel / flush controls.
 * - cancel: when changed, pending timer is cleared and value is NOT updated.
 * - flush: when changed, debounced value is set immediately (no delay).
 */
export function useDebounce<T>(value: T, delay: number, options?: UseDebounceOptions): T {
    const { cancel, flush } = options || {};
    const [debounced, setDebounced] = useState(value);

    // Core debounce effect (restarts on value / delay / cancel changes)
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay, cancel]);

    // Flush effect (immediate update when flush token changes)
    useEffect(() => {
        if (flush !== undefined) {
            setDebounced(value);
        }
    }, [flush, value]);

    return debounced;
}
