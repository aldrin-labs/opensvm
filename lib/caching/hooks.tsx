'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useCache } from './index';

// Hook for caching API responses with SWR-like behavior
export function useCachedQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    ttl?: number;
    staleTime?: number;
    revalidateOnFocus?: boolean;
    revalidateOnReconnect?: boolean;
    enabled?: boolean;
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
  } = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const cache = useCache();
  const lastFetchTime = useRef<number>(0);
  
  const {
    ttl = cache.config.defaultTTL,
    staleTime = ttl * 0.8, // 80% of TTL
    revalidateOnFocus = true,
    revalidateOnReconnect = true,
    enabled = true,
    onSuccess,
    onError
  } = options;

  const isStale = useCallback((timestamp: number) => {
    return Date.now() - timestamp > staleTime;
  }, [staleTime]);

  const fetchData = useCallback(async (force = false) => {
    if (!enabled) return;

    setError(null);
    
    // Check cache first unless force refresh
    if (!force) {
      try {
        const cached = await cache.get<T>(key);
        if (cached) {
          setData(cached);
          
          // If data is fresh enough, don't revalidate
          if (!isStale(lastFetchTime.current)) {
            return;
          }
          
          // Data is stale, revalidate in background
          setIsValidating(true);
        } else {
          setIsLoading(true);
        }
      } catch (cacheError) {
        console.warn('Cache read error:', cacheError);
        setIsLoading(true);
      }
    } else {
      setIsLoading(true);
    }

    try {
      const freshData = await fetcher();
      
      // Cache the fresh data
      await cache.set(key, freshData, { 
        ttl,
        metadata: { source: 'query' }
      });
      
      setData(freshData);
      lastFetchTime.current = Date.now();
      onSuccess?.(freshData);
      
    } catch (fetchError) {
      const errorObj = fetchError instanceof Error ? fetchError : new Error(String(fetchError));
      setError(errorObj);
      onError?.(errorObj);
    } finally {
      setIsLoading(false);
      setIsValidating(false);
    }
  }, [key, fetcher, cache, ttl, enabled, isStale, onSuccess, onError]);

  const mutate = useCallback(async (
    updater?: T | ((current: T | null) => T | null),
    options: { revalidate?: boolean } = {}
  ) => {
    const { revalidate = true } = options;
    
    if (typeof updater === 'function') {
      const newData = (updater as (current: T | null) => T | null)(data);
      if (newData) {
        setData(newData);
        await cache.set(key, newData, { ttl, metadata: { source: 'mutation' } });
      }
    } else if (updater !== undefined) {
      setData(updater);
      if (updater) {
        await cache.set(key, updater, { ttl, metadata: { source: 'mutation' } });
      }
    }
    
    if (revalidate) {
      await fetchData(true);
    }
  }, [data, cache, key, ttl, fetchData]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Revalidate on focus
  useEffect(() => {
    if (!revalidateOnFocus) return;

    const handleFocus = () => {
      if (isStale(lastFetchTime.current)) {
        fetchData();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [revalidateOnFocus, fetchData, isStale]);

  // Revalidate on reconnect
  useEffect(() => {
    if (!revalidateOnReconnect) return;

    const handleOnline = () => {
      if (isStale(lastFetchTime.current)) {
        fetchData();
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [revalidateOnReconnect, fetchData, isStale]);

  return {
    data,
    error,
    isLoading,
    isValidating,
    mutate,
    revalidate: () => fetchData(true)
  };
}

// Hook for infinite queries with caching
export function useCachedInfiniteQuery<T>(
  getKey: (pageIndex: number, previousPageData: T | null) => string,
  fetcher: (key: string) => Promise<T>,
  options: {
    ttl?: number;
    enabled?: boolean;
    onSuccess?: (data: T[], pageIndex: number) => void;
    onError?: (error: Error, pageIndex: number) => void;
  } = {}
) {
  const [pages, setPages] = useState<T[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(true);
  const cache = useCache();

  const {
    ttl = cache.config.defaultTTL,
    enabled = true,
    onSuccess,
    onError
  } = options;

  const loadPage = useCallback(async (pageIndex: number) => {
    if (!enabled) return null;

    const previousPageData = pageIndex > 0 ? pages[pageIndex - 1] : null;
    const key = getKey(pageIndex, previousPageData);
    
    if (!key) {
      setHasNextPage(false);
      return null;
    }

    try {
      // Check cache first
      let pageData = await cache.get<T>(key);
      
      if (!pageData) {
        // Fetch from network
        pageData = await fetcher(key);
        
        // Cache the data
        await cache.set(key, pageData, { 
          ttl,
          metadata: { source: 'infinite-query', pageIndex }
        });
      }

      onSuccess?.(pages.concat(pageData), pageIndex);
      return pageData;

    } catch (fetchError) {
      const errorObj = fetchError instanceof Error ? fetchError : new Error(String(fetchError));
      setError(errorObj);
      onError?.(errorObj, pageIndex);
      return null;
    }
  }, [getKey, fetcher, cache, ttl, enabled, pages, onSuccess, onError]);

  const fetchNextPage = useCallback(async () => {
    if (!hasNextPage || isLoadingMore) return;

    setIsLoadingMore(true);
    setError(null);

    const nextPageData = await loadPage(pages.length);
    
    if (nextPageData) {
      setPages(prev => [...prev, nextPageData]);
    } else {
      setHasNextPage(false);
    }

    setIsLoadingMore(false);
  }, [hasNextPage, isLoadingMore, loadPage, pages.length]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setPages([]);
    setHasNextPage(true);

    // Invalidate all cached pages
    for (let i = 0; i < pages.length; i++) {
      const key = getKey(i, i > 0 ? pages[i - 1] : null);
      if (key) {
        await cache.delete(key);
      }
    }

    // Load first page
    const firstPageData = await loadPage(0);
    if (firstPageData) {
      setPages([firstPageData]);
    }

    setIsLoading(false);
  }, [loadPage, pages, getKey, cache]);

  // Initial load
  useEffect(() => {
    if (pages.length === 0) {
      setIsLoading(true);
      loadPage(0).then(data => {
        if (data) {
          setPages([data]);
        }
        setIsLoading(false);
      });
    }
  }, [loadPage, pages.length]);

  return {
    data: pages,
    error,
    isLoading,
    isLoadingMore,
    hasNextPage,
    fetchNextPage,
    refresh
  };
}

// Hook for optimistic updates with cache
export function useCachedMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: {
    onSuccess?: (data: TData, variables: TVariables) => void;
    onError?: (error: Error, variables: TVariables) => void;
    onSettled?: (data: TData | null, error: Error | null, variables: TVariables) => void;
    invalidateKeys?: string[];
    updateCache?: (variables: TVariables) => Array<{
      key: string;
      updater: (oldData: any) => any;
    }>;
  } = {}
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const cache = useCache();

  const {
    onSuccess,
    onError,
    onSettled,
    invalidateKeys = [],
    updateCache
  } = options;

  const mutate = useCallback(async (variables: TVariables) => {
    setIsLoading(true);
    setError(null);

    // Optimistically update cache if updater provided
    const rollbackFunctions: Array<() => Promise<void>> = [];
    
    if (updateCache) {
      const updates = updateCache(variables);
      
      for (const { key, updater } of updates) {
        const oldData = await cache.get(key);
        if (oldData) {
          rollbackFunctions.push(() => cache.set(key, oldData));
          const newData = updater(oldData);
          await cache.set(key, newData, { metadata: { source: 'optimistic-mutation' } });
        }
      }
    }

    try {
      const result = await mutationFn(variables);
      
      // Invalidate specified keys
      for (const key of invalidateKeys) {
        await cache.delete(key);
      }
      
      onSuccess?.(result, variables);
      onSettled?.(result, null, variables);
      
      return result;

    } catch (mutationError) {
      // Rollback optimistic updates
      for (const rollback of rollbackFunctions) {
        try {
          await rollback();
        } catch (rollbackError) {
          console.warn('Rollback failed:', rollbackError);
        }
      }
      
      const errorObj = mutationError instanceof Error 
        ? mutationError 
        : new Error(String(mutationError));
      
      setError(errorObj);
      onError?.(errorObj, variables);
      onSettled?.(null, errorObj, variables);
      
      throw errorObj;

    } finally {
      setIsLoading(false);
    }
  }, [mutationFn, cache, invalidateKeys, updateCache, onSuccess, onError, onSettled]);

  const reset = useCallback(() => {
    setError(null);
  }, []);

  return {
    mutate,
    isLoading,
    error,
    reset
  };
}

// Hook for prefetching data
export function useCachePrefetch() {
  const cache = useCache();

  const prefetch = useCallback(async <T,>(
    key: string,
    fetcher: () => Promise<T>,
    options: { ttl?: number } = {}
  ) => {
    const { ttl = cache.config.defaultTTL } = options;
    
    // Only prefetch if not already cached
    if (!(await cache.has(key))) {
      try {
        const data = await fetcher();
        await cache.set(key, data, { 
          ttl,
          metadata: { source: 'prefetch' }
        });
      } catch (error) {
        // Ignore prefetch errors
        console.warn('Prefetch failed for key:', key, error);
      }
    }
  }, [cache]);

  const prefetchMany = useCallback(async (
    items: Array<{
      key: string;
      fetcher: () => Promise<any>;
      ttl?: number;
    }>
  ) => {
    const promises = items.map(({ key, fetcher, ttl }) => 
      prefetch(key, fetcher, { ttl })
    );
    
    await Promise.allSettled(promises);
  }, [prefetch]);

  return {
    prefetch,
    prefetchMany
  };
}

// Hook for cache invalidation patterns
export function useCacheInvalidation() {
  const cache = useCache();

  const invalidateByPattern = useCallback(async (pattern: string | RegExp) => {
    await cache.invalidate(pattern);
  }, [cache]);

  const invalidateByKeys = useCallback(async (keys: string[]) => {
    const promises = keys.map(key => cache.delete(key));
    await Promise.allSettled(promises);
  }, [cache]);

  const invalidateByPrefix = useCallback(async (prefix: string) => {
    await cache.invalidate(new RegExp(`^${prefix}`));
  }, [cache]);

  const invalidateBySuffix = useCallback(async (suffix: string) => {
    await cache.invalidate(new RegExp(`${suffix}$`));
  }, [cache]);

  return {
    invalidateByPattern,
    invalidateByKeys,
    invalidateByPrefix,
    invalidateBySuffix
  };
}

const CachingHooks = {
  useCachedQuery,
  useCachedInfiniteQuery,
  useCachedMutation,
  useCachePrefetch,
  useCacheInvalidation
};

export default CachingHooks;