'use client';

import { useRef, useCallback, useState } from 'react';

interface PrefetchState {
  account: string;
  status: 'pending' | 'fetching' | 'complete' | 'error';
  data?: any;
  timestamp: number;
}

// Prefetch cache with TTL
const PREFETCH_TTL = 5 * 60 * 1000; // 5 minutes
const PREFETCH_DELAY = 300; // Wait 300ms before prefetching (avoid rapid hovers)
const MAX_PREFETCH_QUEUE = 5;

/**
 * Hook for prefetching account graph data on hover
 * Anticipates user navigation for near-instant loading
 */
export function usePrefetchAccounts() {
  const prefetchCacheRef = useRef<Map<string, PrefetchState>>(new Map());
  const prefetchQueueRef = useRef<Set<string>>(new Set());
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  const [prefetchStats, setPrefetchStats] = useState({
    total: 0,
    hits: 0,
    misses: 0
  });

  /**
   * Check if account data is already prefetched and valid
   */
  const isPrefetched = useCallback((account: string): boolean => {
    const cached = prefetchCacheRef.current.get(account);
    if (!cached) return false;
    if (Date.now() - cached.timestamp > PREFETCH_TTL) {
      prefetchCacheRef.current.delete(account);
      return false;
    }
    return cached.status === 'complete';
  }, []);

  /**
   * Get prefetched data for an account
   */
  const getPrefetchedData = useCallback((account: string): any | null => {
    const cached = prefetchCacheRef.current.get(account);
    if (!cached || cached.status !== 'complete') {
      setPrefetchStats(prev => ({ ...prev, total: prev.total + 1, misses: prev.misses + 1 }));
      return null;
    }
    if (Date.now() - cached.timestamp > PREFETCH_TTL) {
      prefetchCacheRef.current.delete(account);
      setPrefetchStats(prev => ({ ...prev, total: prev.total + 1, misses: prev.misses + 1 }));
      return null;
    }
    setPrefetchStats(prev => ({ ...prev, total: prev.total + 1, hits: prev.hits + 1 }));
    return cached.data;
  }, []);

  /**
   * Prefetch account data in background
   */
  const prefetchAccount = useCallback(async (account: string): Promise<void> => {
    // Skip if already prefetched or fetching
    if (isPrefetched(account)) return;
    const cached = prefetchCacheRef.current.get(account);
    if (cached?.status === 'fetching') return;

    // Limit queue size
    if (prefetchQueueRef.current.size >= MAX_PREFETCH_QUEUE) {
      // Remove oldest from queue
      const first = prefetchQueueRef.current.values().next().value;
      if (first) {
        prefetchQueueRef.current.delete(first);
        const controller = abortControllersRef.current.get(first);
        if (controller) {
          controller.abort();
          abortControllersRef.current.delete(first);
        }
      }
    }

    // Add to queue
    prefetchQueueRef.current.add(account);

    // Create abort controller
    const controller = new AbortController();
    abortControllersRef.current.set(account, controller);

    // Mark as fetching
    prefetchCacheRef.current.set(account, {
      account,
      status: 'fetching',
      timestamp: Date.now()
    });

    try {
      // Fetch account transfers data (same as main graph fetch)
      const params = new URLSearchParams({ limit: '20' });
      const response = await fetch(`/api/account-transfers/${account}?${params.toString()}`, {
        signal: controller.signal,
        headers: {
          'X-Prefetch': 'true'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to prefetch: ${response.statusText}`);
      }

      const data = await response.json();

      // Store in cache
      prefetchCacheRef.current.set(account, {
        account,
        status: 'complete',
        data,
        timestamp: Date.now()
      });

      console.log(`Prefetched account data: ${account.slice(0, 8)}...`);

    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // Request was cancelled, remove from cache
        prefetchCacheRef.current.delete(account);
      } else {
        // Mark as error
        prefetchCacheRef.current.set(account, {
          account,
          status: 'error',
          timestamp: Date.now()
        });
        console.warn(`Failed to prefetch ${account.slice(0, 8)}...:`, error);
      }
    } finally {
      prefetchQueueRef.current.delete(account);
      abortControllersRef.current.delete(account);
    }
  }, [isPrefetched]);

  /**
   * Handle hover start - schedule prefetch after delay
   */
  const onAccountHoverStart = useCallback((account: string) => {
    // Clear any pending prefetch
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    // Skip if already prefetched
    if (isPrefetched(account)) return;

    // Schedule prefetch after delay
    hoverTimeoutRef.current = setTimeout(() => {
      prefetchAccount(account);
    }, PREFETCH_DELAY);
  }, [isPrefetched, prefetchAccount]);

  /**
   * Handle hover end - cancel pending prefetch
   */
  const onAccountHoverEnd = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  /**
   * Prefetch multiple accounts (e.g., all visible in current view)
   */
  const prefetchMultiple = useCallback(async (accounts: string[]) => {
    // Filter to only non-prefetched accounts
    const toPrefetch = accounts.filter(a => !isPrefetched(a));

    // Prefetch in batches of 3
    const batchSize = 3;
    for (let i = 0; i < toPrefetch.length; i += batchSize) {
      const batch = toPrefetch.slice(i, i + batchSize);
      await Promise.all(batch.map(account => prefetchAccount(account)));
    }
  }, [isPrefetched, prefetchAccount]);

  /**
   * Cancel all pending prefetches
   */
  const cancelAllPrefetches = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    abortControllersRef.current.forEach(controller => controller.abort());
    abortControllersRef.current.clear();
    prefetchQueueRef.current.clear();
  }, []);

  /**
   * Clear prefetch cache
   */
  const clearPrefetchCache = useCallback(() => {
    cancelAllPrefetches();
    prefetchCacheRef.current.clear();
    setPrefetchStats({ total: 0, hits: 0, misses: 0 });
  }, [cancelAllPrefetches]);

  /**
   * Get prefetch cache stats
   */
  const getCacheStats = useCallback(() => ({
    cacheSize: prefetchCacheRef.current.size,
    queueSize: prefetchQueueRef.current.size,
    ...prefetchStats,
    hitRate: prefetchStats.total > 0
      ? Math.round((prefetchStats.hits / prefetchStats.total) * 100)
      : 0
  }), [prefetchStats]);

  return {
    isPrefetched,
    getPrefetchedData,
    prefetchAccount,
    onAccountHoverStart,
    onAccountHoverEnd,
    prefetchMultiple,
    cancelAllPrefetches,
    clearPrefetchCache,
    getCacheStats
  };
}

export default usePrefetchAccounts;
