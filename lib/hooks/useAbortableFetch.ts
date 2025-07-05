'use client';

import { useCallback, useRef, useEffect } from 'react';

/**
 * Custom hook for making abortable fetch requests
 * Automatically cancels requests when component unmounts or new request is made
 */
export function useAbortableFetch() {
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetch = useCallback(async <T = any>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> => {
    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    // Merge the abort signal with user options
    const fetchOptions: RequestInit = {
      ...options,
      signal: abortControllerRef.current.signal,
    };

    try {
      const response = await window.fetch(url, fetchOptions);
      
      // Check if request was aborted
      if (abortControllerRef.current.signal.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      // Re-throw abort errors without logging
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      
      // Log other errors only in development
      if (process.env.NODE_ENV === 'development') {
        console.error('Fetch error:', error);
      }
      
      throw error;
    }
  }, []);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return { fetch, abort };
}

/**
 * Hook for making debounced fetch requests with automatic abort
 */
export function useDebouncedAbortableFetch(delay: number = 500) {
  const { fetch: abortableFetch, abort } = useAbortableFetch();
  const timeoutRef = useRef<NodeJS.Timeout>();

  const debouncedFetch = useCallback(
    async <T = any>(url: string, options: RequestInit = {}): Promise<T> => {
      return new Promise((resolve, reject) => {
        // Clear existing timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        // Set new timeout
        timeoutRef.current = setTimeout(async () => {
          try {
            const result = await abortableFetch<T>(url, options);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        }, delay);
      });
    },
    [abortableFetch, delay]
  );

  const cancelDebounce = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    abort();
  }, [abort]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { fetch: debouncedFetch, abort: cancelDebounce };
}