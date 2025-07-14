/**
 * Cache-first data retrieval hooks for OpenSVM
 * 
 * Provides React hooks that check DuckDB cache before making API calls,
 * significantly improving performance and reducing API load.
 */

import { useState, useEffect, useCallback } from 'react';
import { cacheManager } from '../cache/duckdb-cache-manager';

export interface CacheFirstOptions {
  ttl?: number;
  forceRefresh?: boolean;
  cacheKey?: string;
  enableCache?: boolean;
}

export interface CacheFirstResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  fromCache: boolean;
  refresh: () => Promise<void>;
  cacheStats: {
    hit: boolean;
    cacheAge?: number;
  };
}

/**
 * Generic cache-first data fetching hook
 */
export function useCacheFirst<T>(
  fetchFn: () => Promise<T>,
  key: string,
  options: CacheFirstOptions = {}
): CacheFirstResult<T> {
  const {
    ttl = 30 * 60 * 1000, // 30 minutes default
    forceRefresh = false,
    enableCache = true
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [cacheStats, setCacheStats] = useState<{ hit: boolean; cacheAge?: number }>({ hit: false });

  const fetchData = useCallback(async (skipCache = false) => {
    setLoading(true);
    setError(null);

    try {
      let cachedData: T | null = null;
      let cacheHit = false;
      let cacheAge: number | undefined;

      // Try cache first if enabled and not forcing refresh
      if (enableCache && !skipCache && !forceRefresh) {
        try {
          await cacheManager.initialize();
          cachedData = await cacheManager.get<T>(key);
          if (cachedData) {
            cacheHit = true;
            // Calculate cache age (simplified - would need timestamp in cache)
            cacheAge = 0; // Would be calculated from cache metadata
          }
        } catch (cacheError) {
          console.warn('Cache read error:', cacheError);
        }
      }

      if (cachedData) {
        setData(cachedData);
        setFromCache(true);
        setCacheStats({ hit: true, cacheAge });
      } else {
        // Fetch from API
        const freshData = await fetchFn();
        setData(freshData);
        setFromCache(false);
        setCacheStats({ hit: false });

        // Cache the result if caching is enabled
        if (enableCache) {
          try {
            await cacheManager.set(key, freshData, ttl);
          } catch (cacheError) {
            console.warn('Cache write error:', cacheError);
          }
        }
      }
    } catch (err) {
      setError(err as Error);
      setData(null);
      setFromCache(false);
      setCacheStats({ hit: false });
    } finally {
      setLoading(false);
    }
  }, [key, fetchFn, ttl, forceRefresh, enableCache]);

  const refresh = useCallback(async () => {
    await fetchData(true); // Skip cache for refresh
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    fromCache,
    refresh,
    cacheStats
  };
}

/**
 * Cache-first hook for transaction data
 */
export function useCachedTransaction(signature: string, options: CacheFirstOptions = {}) {
  const fetchTransaction = useCallback(async () => {
    const response = await fetch(`/api/transaction/${signature}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch transaction: ${response.statusText}`);
    }
    return response.json();
  }, [signature]);

  // First try blockchain-specific cache
  const [blockchainCacheData, setBlockchainCacheData] = useState<any | null>(null);
  const [blockchainCacheChecked, setBlockchainCacheChecked] = useState(false);

  useEffect(() => {
    const checkBlockchainCache = async () => {
      try {
        await cacheManager.initialize();
        const cached = await cacheManager.getTransaction(signature);
        setBlockchainCacheData(cached);
      } catch (error) {
        console.warn('Blockchain cache error:', error);
      } finally {
        setBlockchainCacheChecked(true);
      }
    };

    checkBlockchainCache();
  }, [signature]);

  const result = useCacheFirst(
    fetchTransaction,
    `transaction:${signature}`,
    {
      ...options,
      enableCache: !blockchainCacheData && options.enableCache !== false
    }
  );

  // Cache successful API result in blockchain-specific cache
  useEffect(() => {
    if (result.data && !result.fromCache && !result.loading) {
      cacheManager.setTransaction(signature, result.data);
    }
  }, [result.data, result.fromCache, result.loading, signature]);

  // Return blockchain cache data if available and checked
  if (blockchainCacheData && blockchainCacheChecked) {
    return {
      ...result,
      data: blockchainCacheData,
      loading: false,
      fromCache: true,
      cacheStats: { hit: true }
    };
  }

  return result;
}

/**
 * Cache-first hook for block data
 */
export function useCachedBlock(slot: number, options: CacheFirstOptions = {}) {
  const fetchBlock = useCallback(async () => {
    const response = await fetch(`/api/block/${slot}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch block: ${response.statusText}`);
    }
    return response.json();
  }, [slot]);

  // Check blockchain-specific cache first
  const [blockchainCacheData, setBlockchainCacheData] = useState<any | null>(null);
  const [blockchainCacheChecked, setBlockchainCacheChecked] = useState(false);

  useEffect(() => {
    const checkBlockchainCache = async () => {
      try {
        await cacheManager.initialize();
        const cached = await cacheManager.getBlock(slot);
        setBlockchainCacheData(cached);
      } catch (error) {
        console.warn('Blockchain cache error:', error);
      } finally {
        setBlockchainCacheChecked(true);
      }
    };

    checkBlockchainCache();
  }, [slot]);

  const result = useCacheFirst(
    fetchBlock,
    `block:${slot}`,
    {
      ...options,
      enableCache: !blockchainCacheData && options.enableCache !== false
    }
  );

  // Cache in blockchain-specific table
  useEffect(() => {
    if (result.data && !result.fromCache && !result.loading) {
      cacheManager.setBlock(slot, result.data);
    }
  }, [result.data, result.fromCache, result.loading, slot]);

  // Return blockchain cache data if available and checked
  if (blockchainCacheData && blockchainCacheChecked) {
    return {
      ...result,
      data: blockchainCacheData,
      loading: false,
      fromCache: true,
      cacheStats: { hit: true }
    };
  }

  return result;
}

/**
 * Cache-first hook for account data
 */
export function useCachedAccount(address: string, options: CacheFirstOptions = {}) {
  const fetchAccount = useCallback(async () => {
    const response = await fetch(`/api/account/${address}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch account: ${response.statusText}`);
    }
    return response.json();
  }, [address]);

  // Check blockchain-specific cache with shorter TTL for accounts
  const [blockchainCacheData, setBlockchainCacheData] = useState<any | null>(null);
  const [blockchainCacheChecked, setBlockchainCacheChecked] = useState(false);

  useEffect(() => {
    const checkBlockchainCache = async () => {
      try {
        await cacheManager.initialize();
        const cached = await cacheManager.getAccount(address);
        setBlockchainCacheData(cached);
      } catch (error) {
        console.warn('Blockchain cache error:', error);
      } finally {
        setBlockchainCacheChecked(true);
      }
    };

    checkBlockchainCache();
  }, [address]);

  const result = useCacheFirst(
    fetchAccount,
    `account:${address}`,
    {
      ttl: 5 * 60 * 1000, // 5 minutes for accounts (more dynamic)
      ...options,
      enableCache: !blockchainCacheData && options.enableCache !== false
    }
  );

  // Cache in account-specific table
  useEffect(() => {
    if (result.data && !result.fromCache && !result.loading) {
      cacheManager.setAccount(address, result.data);
    }
  }, [result.data, result.fromCache, result.loading, address]);

  // Return blockchain cache data if available and checked
  if (blockchainCacheData && blockchainCacheChecked) {
    return {
      ...result,
      data: blockchainCacheData,
      loading: false,
      fromCache: true,
      cacheStats: { hit: true }
    };
  }

  return result;
}

/**
 * Cache-first hook for token data
 */
export function useCachedToken(mint: string, options: CacheFirstOptions = {}) {
  const fetchToken = useCallback(async () => {
    const response = await fetch(`/api/token/${mint}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch token: ${response.statusText}`);
    }
    return response.json();
  }, [mint]);

  return useCacheFirst(
    fetchToken,
    `token:${mint}`,
    {
      ttl: 60 * 60 * 1000, // 1 hour for token metadata (fairly stable)
      ...options
    }
  );
}

/**
 * Cache-first hook for search results
 */
export function useCachedSearch(query: string, options: CacheFirstOptions = {}) {
  const fetchSearch = useCallback(async () => {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`);
    }
    return response.json();
  }, [query]);

  return useCacheFirst(
    fetchSearch,
    `search:${query}`,
    {
      ttl: 10 * 60 * 1000, // 10 minutes for search results
      ...options
    }
  );
}

/**
 * Cache-first hook for blockchain statistics
 */
export function useCachedStats(options: CacheFirstOptions = {}) {
  const fetchStats = useCallback(async () => {
    const response = await fetch('/api/stats');
    if (!response.ok) {
      throw new Error(`Failed to fetch stats: ${response.statusText}`);
    }
    return response.json();
  }, []);

  return useCacheFirst(
    fetchStats,
    'blockchain:stats',
    {
      ttl: 2 * 60 * 1000, // 2 minutes for live stats
      ...options
    }
  );
}

/**
 * Cache-first hook for program data
 */
export function useCachedProgram(programId: string, options: CacheFirstOptions = {}) {
  const fetchProgram = useCallback(async () => {
    const response = await fetch(`/api/program/${programId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch program: ${response.statusText}`);
    }
    return response.json();
  }, [programId]);

  return useCacheFirst(
    fetchProgram,
    `program:${programId}`,
    {
      ttl: 60 * 60 * 1000, // 1 hour for program data (stable)
      ...options
    }
  );
}

/**
 * Hook to get cache statistics and management
 */
export function useCacheManager() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const refreshStats = useCallback(async () => {
    setLoading(true);
    try {
      await cacheManager.initialize();
      const cacheStats = await cacheManager.getStats();
      setStats(cacheStats);
    } catch (error) {
      console.error('Failed to get cache stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearCache = useCallback(async () => {
    try {
      await cacheManager.clear();
      await refreshStats();
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }, [refreshStats]);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  return {
    stats,
    loading,
    refreshStats,
    clearCache,
    cacheManager
  };
}

/**
 * Hook for bulk cache operations
 */
export function useBulkCache() {
  const preloadTransactions = useCallback(async (signatures: string[]) => {
    await cacheManager.initialize();
    
    const promises = signatures.map(async (signature) => {
      const cached = await cacheManager.getTransaction(signature);
      if (!cached) {
        try {
          const response = await fetch(`/api/transaction/${signature}`);
          if (response.ok) {
            const data = await response.json();
            await cacheManager.setTransaction(signature, data);
          }
        } catch (error) {
          console.warn(`Failed to preload transaction ${signature}:`, error);
        }
      }
    });

    await Promise.allSettled(promises);
  }, []);

  const preloadBlocks = useCallback(async (slots: number[]) => {
    await cacheManager.initialize();
    
    const promises = slots.map(async (slot) => {
      const cached = await cacheManager.getBlock(slot);
      if (!cached) {
        try {
          const response = await fetch(`/api/block/${slot}`);
          if (response.ok) {
            const data = await response.json();
            await cacheManager.setBlock(slot, data);
          }
        } catch (error) {
          console.warn(`Failed to preload block ${slot}:`, error);
        }
      }
    });

    await Promise.allSettled(promises);
  }, []);

  const preloadAccounts = useCallback(async (addresses: string[]) => {
    await cacheManager.initialize();
    
    const promises = addresses.map(async (address) => {
      const cached = await cacheManager.getAccount(address);
      if (!cached) {
        try {
          const response = await fetch(`/api/account/${address}`);
          if (response.ok) {
            const data = await response.json();
            await cacheManager.setAccount(address, data);
          }
        } catch (error) {
          console.warn(`Failed to preload account ${address}:`, error);
        }
      }
    });

    await Promise.allSettled(promises);
  }, []);

  return {
    preloadTransactions,
    preloadBlocks,
    preloadAccounts
  };
}