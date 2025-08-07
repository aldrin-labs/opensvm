'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useErrorHandling } from '@/lib/error-handling';
import { useAccessibility } from '@/lib/accessibility';

// Cache configuration types
export type CacheStrategy = 'cache-first' | 'network-first' | 'cache-only' | 'network-only' | 'stale-while-revalidate';
export type CacheLocation = 'memory' | 'localStorage' | 'sessionStorage' | 'indexedDB';
export type CompressionType = 'none' | 'gzip' | 'lz4';

export interface CacheConfig {
  defaultTTL: number; // Time to live in milliseconds
  maxMemorySize: number; // Maximum memory cache size in bytes
  maxStorageSize: number; // Maximum storage size in bytes
  compressionThreshold: number; // Compress items larger than this size
  compressionType: CompressionType;
  enableCompression: boolean;
  enablePrefetch: boolean;
  enableBackgroundSync: boolean;
  enableAnalytics: boolean;
  strategy: CacheStrategy;
  locations: CacheLocation[];
}

export interface CacheItem<T = any> {
  key: string;
  data: T;
  timestamp: number;
  ttl: number;
  size: number;
  compressed: boolean;
  version: string;
  metadata: {
    source: string;
    contentType?: string;
    etag?: string;
    lastModified?: string;
    accessCount: number;
    lastAccessed: number;
  };
}

export interface CacheStats {
  hitRate: number;
  missRate: number;
  totalRequests: number;
  totalHits: number;
  totalMisses: number;
  memoryUsage: number;
  storageUsage: number;
  itemCount: number;
  avgResponseTime: number;
}

// Default cache configuration
const defaultCacheConfig: CacheConfig = {
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  maxMemorySize: 50 * 1024 * 1024, // 50MB
  maxStorageSize: 100 * 1024 * 1024, // 100MB
  compressionThreshold: 1024, // 1KB
  compressionType: 'gzip',
  enableCompression: true,
  enablePrefetch: true,
  enableBackgroundSync: true,
  enableAnalytics: true,
  strategy: 'stale-while-revalidate',
  locations: ['memory', 'localStorage', 'indexedDB'],
};

// Cache context
interface CacheContextType {
  config: CacheConfig;
  stats: CacheStats;

  // Core cache operations
  get: <T>(key: string) => Promise<T | null>;
  set: <T>(key: string, data: T, options?: Partial<CacheItem>) => Promise<void>;
  has: (key: string) => Promise<boolean>;
  delete: (key: string) => Promise<boolean>;
  clear: (location?: CacheLocation) => Promise<void>;

  // Advanced operations
  prefetch: (keys: string[], fetcher: (key: string) => Promise<any>) => Promise<void>;
  warmup: (keys: string[], fetcher: (key: string) => Promise<any>) => Promise<void>;
  invalidate: (pattern: string | RegExp) => Promise<void>;

  // Configuration
  updateConfig: (newConfig: Partial<CacheConfig>) => void;

  // Analytics
  getStats: () => CacheStats;
  resetStats: () => void;

  // Maintenance
  cleanup: () => Promise<void>;
  optimize: () => Promise<void>;
}

const CacheContext = createContext<CacheContextType | undefined>(undefined);

// In-memory cache implementation
class MemoryCache {
  private cache = new Map<string, CacheItem>();
  private maxSize: number;
  private currentSize = 0;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  async get<T>(key: string): Promise<CacheItem<T> | null> {
    const item = this.cache.get(key);
    if (!item) return null;

    // Check if item has expired
    if (Date.now() > item.timestamp + item.ttl) {
      this.cache.delete(key);
      this.currentSize -= item.size;
      return null;
    }

    // Update access metadata
    item.metadata.accessCount++;
    item.metadata.lastAccessed = Date.now();

    return item as CacheItem<T>;
  }

  async set<T>(key: string, item: CacheItem<T>): Promise<void> {
    // Remove existing item if it exists
    const existing = this.cache.get(key);
    if (existing) {
      this.currentSize -= existing.size;
    }

    // Check size limits and evict if necessary
    while (this.currentSize + item.size > this.maxSize && this.cache.size > 0) {
      await this.evictLRU();
    }

    this.cache.set(key, item);
    this.currentSize += item.size;
  }

  async has(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  async delete(key: string): Promise<boolean> {
    const item = this.cache.get(key);
    if (item) {
      this.currentSize -= item.size;
      return this.cache.delete(key);
    }
    return false;
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.currentSize = 0;
  }

  private async evictLRU(): Promise<void> {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, item] of this.cache.entries()) {
      if (item.metadata.lastAccessed < oldestTime) {
        oldestTime = item.metadata.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      await this.delete(oldestKey);
    }
  }

  getSize(): number {
    return this.currentSize;
  }

  getItemCount(): number {
    return this.cache.size;
  }

  getAllKeys(): string[] {
    return Array.from(this.cache.keys());
  }
}

// IndexedDB cache implementation
class IndexedDBCache {
  private dbName = 'opensvm-cache';
  private version = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('cache')) {
          const store = db.createObjectStore('cache', { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp');
          store.createIndex('ttl', ['timestamp', 'ttl']);
        }
      };
    });
  }

  async get<T>(key: string): Promise<CacheItem<T> | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const item = request.result;
        if (!item) {
          resolve(null);
          return;
        }

        // Check if item has expired
        if (Date.now() > item.timestamp + item.ttl) {
          this.delete(key);
          resolve(null);
          return;
        }

        // Update access metadata
        item.metadata.accessCount++;
        item.metadata.lastAccessed = Date.now();

        // Save updated metadata
        this.set(key, item);

        resolve(item);
      };
    });
  }

  async set<T>(key: string, item: CacheItem<T>): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.put(item);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async has(key: string): Promise<boolean> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      const request = store.count(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result > 0);
    });
  }

  async delete(key: string): Promise<boolean> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(true);
    });
  }

  async clear(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getAllKeys(): Promise<string[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      const request = store.getAllKeys();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as string[]);
    });
  }

  async getSize(): Promise<number> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const items = request.result as CacheItem[];
        const totalSize = items.reduce((sum, item) => sum + item.size, 0);
        resolve(totalSize);
      };
    });
  }
}

// Storage cache implementation (localStorage/sessionStorage)
class StorageCache {
  private storage: Storage;
  private prefix: string;

  constructor(storage: Storage, prefix = 'opensvm-cache-') {
    this.storage = storage;
    this.prefix = prefix;
  }

  async get<T>(key: string): Promise<CacheItem<T> | null> {
    try {
      const item = this.storage.getItem(this.prefix + key);
      if (!item) return null;

      const parsed: CacheItem<T> = JSON.parse(item);

      // Check if item has expired
      if (Date.now() > parsed.timestamp + parsed.ttl) {
        this.storage.removeItem(this.prefix + key);
        return null;
      }

      // Update access metadata
      parsed.metadata.accessCount++;
      parsed.metadata.lastAccessed = Date.now();

      // Save updated metadata
      this.storage.setItem(this.prefix + key, JSON.stringify(parsed));

      return parsed;
    } catch (error) {
      return null;
    }
  }

  async set<T>(key: string, item: CacheItem<T>): Promise<void> {
    try {
      this.storage.setItem(this.prefix + key, JSON.stringify(item));
    } catch (error) {
      // Handle storage quota exceeded
      await this.cleanup();
      try {
        this.storage.setItem(this.prefix + key, JSON.stringify(item));
      } catch (secondError) {
        throw new Error('Unable to store item in storage cache');
      }
    }
  }

  async has(key: string): Promise<boolean> {
    return this.storage.getItem(this.prefix + key) !== null;
  }

  async delete(key: string): Promise<boolean> {
    const existed = this.storage.getItem(this.prefix + key) !== null;
    this.storage.removeItem(this.prefix + key);
    return existed;
  }

  async clear(): Promise<void> {
    const keys = [];
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key && key.startsWith(this.prefix)) {
        keys.push(key);
      }
    }
    keys.forEach(key => this.storage.removeItem(key));
  }

  async getAllKeys(): Promise<string[]> {
    const keys: string[] = [];
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key && key.startsWith(this.prefix)) {
        keys.push(key.substring(this.prefix.length));
      }
    }
    return keys;
  }

  async getSize(): Promise<number> {
    let totalSize = 0;
    const keys = await this.getAllKeys();

    for (const key of keys) {
      try {
        const item = this.storage.getItem(this.prefix + key);
        if (item) {
          const parsed: CacheItem = JSON.parse(item);
          totalSize += parsed.size;
        }
      } catch (error) {
        // Skip invalid items
      }
    }

    return totalSize;
  }

  private async cleanup(): Promise<void> {
    const items: Array<{ key: string; item: CacheItem }> = [];

    // Collect all cache items
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key && key.startsWith(this.prefix)) {
        try {
          const item = JSON.parse(this.storage.getItem(key)!);
          items.push({ key, item });
        } catch (error) {
          // Remove invalid items
          this.storage.removeItem(key);
        }
      }
    }

    // Sort by last accessed time (oldest first)
    items.sort((a, b) => a.item.metadata.lastAccessed - b.item.metadata.lastAccessed);

    // Remove oldest 25% of items
    const toRemove = Math.floor(items.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      this.storage.removeItem(items[i].key);
    }
  }
}

// Main cache provider
export function CacheProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<CacheConfig>(defaultCacheConfig);
  const [stats, setStats] = useState<CacheStats>({
    hitRate: 0,
    missRate: 0,
    totalRequests: 0,
    totalHits: 0,
    totalMisses: 0,
    memoryUsage: 0,
    storageUsage: 0,
    itemCount: 0,
    avgResponseTime: 0,
  });

  const { reportError } = useErrorHandling();
  const { announceToScreenReader } = useAccessibility();

  // Cache implementations - memoize to prevent recreation on every render
  const memoryCache = useMemo(() => new MemoryCache(config.maxMemorySize), [config.maxMemorySize]);
  const indexedDBCache = useMemo(() => new IndexedDBCache(), []);
  const localStorageCache = useMemo(() => {
    // Check if we're in a browser environment
    if (typeof window !== 'undefined' && window.localStorage) {
      return new StorageCache(localStorage);
    }
    // Return a no-op cache for SSR
    return new MemoryCache(1024); // Small fallback cache
  }, []);
  const sessionStorageCache = useMemo(() => {
    // Check if we're in a browser environment
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return new StorageCache(sessionStorage);
    }
    // Return a no-op cache for SSR
    return new MemoryCache(1024); // Small fallback cache
  }, []);

  // Initialize IndexedDB on mount
  useEffect(() => {
    if (config.locations.includes('indexedDB')) {
      indexedDBCache.init().catch(error => {
        reportError(error, { component: 'CacheProvider', operation: 'indexedDB-init' });
      });
    }
  }, [config.locations, reportError, indexedDBCache]);

  // getCacheByLocation function memoized to prevent recreation
  const getCacheByLocation = useCallback((location: CacheLocation) => {
    switch (location) {
      case 'memory': return memoryCache;
      case 'localStorage': return localStorageCache;
      case 'sessionStorage': return sessionStorageCache;
      case 'indexedDB': return indexedDBCache;
    }
  }, [memoryCache, localStorageCache, sessionStorageCache, indexedDBCache]);

  const updateStats = useCallback((isHit: boolean, responseTime: number) => {
    setStats(prev => {
      const totalRequests = prev.totalRequests + 1;
      const totalHits = prev.totalHits + (isHit ? 1 : 0);
      const totalMisses = prev.totalMisses + (isHit ? 0 : 1);

      return {
        ...prev,
        totalRequests,
        totalHits,
        totalMisses,
        hitRate: totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0,
        missRate: totalRequests > 0 ? (totalMisses / totalRequests) * 100 : 0,
        avgResponseTime: (prev.avgResponseTime * (totalRequests - 1) + responseTime) / totalRequests,
      };
    });
  }, []);

  const calculateSize = (data: any): number => {
    return new TextEncoder().encode(JSON.stringify(data)).length;
  };

  const compress = async (data: any): Promise<{ data: any; compressed: boolean }> => {
    if (!config.enableCompression) return { data, compressed: false };

    const size = calculateSize(data);
    if (size < config.compressionThreshold) return { data, compressed: false };

    // Simple compression simulation - in real implementation, use actual compression
    return { data: JSON.stringify(data), compressed: true };
  };

  const decompress = async (data: any, compressed: boolean): Promise<any> => {
    if (!compressed) return data;
    // Simple decompression simulation
    return JSON.parse(data);
  };

  const get = async <T,>(key: string): Promise<T | null> => {
    const startTime = performance.now();
    let found = false;

    try {
      // Try each cache location in order
      for (const location of config.locations) {
        const cache = getCacheByLocation(location);
        const item = await cache.get<T>(key);

        if (item) {
          const decompressed = await decompress(item.data, item.compressed);
          found = true;
          updateStats(true, performance.now() - startTime);
          return decompressed;
        }
      }

      updateStats(false, performance.now() - startTime);
      return null;
    } catch (error) {
      reportError(error as Error, { component: 'Cache', operation: 'get', key });
      updateStats(false, performance.now() - startTime);
      return null;
    }
  };

  const set = async <T,>(key: string, data: T, options: Partial<CacheItem> = {}): Promise<void> => {
    try {
      const { data: compressedData, compressed } = await compress(data);
      const size = calculateSize(compressedData);

      const item: CacheItem<T> = {
        key,
        data: compressedData,
        timestamp: Date.now(),
        ttl: options.ttl || config.defaultTTL,
        size,
        compressed,
        version: options.version || '1.0.0',
        metadata: {
          source: options.metadata?.source || 'manual',
          contentType: options.metadata?.contentType,
          etag: options.metadata?.etag,
          lastModified: options.metadata?.lastModified,
          accessCount: 0,
          lastAccessed: Date.now(),
          ...options.metadata
        }
      };

      // Set in all configured cache locations
      const promises = config.locations.map(location =>
        getCacheByLocation(location).set(key, item)
      );

      await Promise.allSettled(promises);

      // Update stats
      setStats(prev => ({
        ...prev,
        itemCount: prev.itemCount + 1
      }));
    } catch (error) {
      reportError(error as Error, { component: 'Cache', operation: 'set', key });
    }
  };

  const has = async (key: string): Promise<boolean> => {
    try {
      for (const location of config.locations) {
        const cache = getCacheByLocation(location);
        if (await cache.has(key)) return true;
      }
      return false;
    } catch (error) {
      reportError(error as Error, { component: 'Cache', operation: 'has', key });
      return false;
    }
  };

  const deleteItem = async (key: string): Promise<boolean> => {
    try {
      let deleted = false;

      const promises = config.locations.map(async location => {
        const cache = getCacheByLocation(location);
        const result = await cache.delete(key);
        if (result) deleted = true;
        return result;
      });

      await Promise.allSettled(promises);

      if (deleted) {
        setStats(prev => ({
          ...prev,
          itemCount: Math.max(0, prev.itemCount - 1)
        }));
      }

      return deleted;
    } catch (error) {
      reportError(error as Error, { component: 'Cache', operation: 'delete', key });
      return false;
    }
  };

  const clear = async (location?: CacheLocation): Promise<void> => {
    try {
      const locations = location ? [location] : config.locations;

      const promises = locations.map(loc =>
        getCacheByLocation(loc).clear()
      );

      await Promise.allSettled(promises);

      if (!location) {
        setStats(prev => ({
          ...prev,
          itemCount: 0,
          memoryUsage: 0,
          storageUsage: 0
        }));

        announceToScreenReader('Cache cleared successfully', 'polite');
      }
    } catch (error) {
      reportError(error as Error, { component: 'Cache', operation: 'clear', location });
    }
  };

  const prefetch = async (keys: string[], fetcher: (key: string) => Promise<any>): Promise<void> => {
    if (!config.enablePrefetch) return;

    const promises = keys.map(async key => {
      if (await has(key)) return; // Skip if already cached

      try {
        const data = await fetcher(key);
        await set(key, data, { metadata: { source: 'prefetch', accessCount: 0, lastAccessed: Date.now() } });
      } catch (error) {
        // Ignore prefetch errors
      }
    });

    await Promise.allSettled(promises);
  };

  const warmup = async (keys: string[], fetcher: (key: string) => Promise<any>): Promise<void> => {
    // Force refresh all keys regardless of current cache state
    const promises = keys.map(async key => {
      try {
        const data = await fetcher(key);
        await set(key, data, { metadata: { source: 'warmup', accessCount: 0, lastAccessed: Date.now() } });
      } catch (error) {
        reportError(error as Error, { component: 'Cache', operation: 'warmup', key });
      }
    });

    await Promise.allSettled(promises);
  };

  const invalidate = async (pattern: string | RegExp): Promise<void> => {
    try {
      const allKeys: string[] = [];

      // Collect all keys from all cache locations
      for (const location of config.locations) {
        const cache = getCacheByLocation(location);
        if (cache.getAllKeys) {
          const keys = await cache.getAllKeys();
          allKeys.push(...keys);
        }
      }

      // Filter keys based on pattern
      const keysToDelete = allKeys.filter(key => {
        if (typeof pattern === 'string') {
          return key.includes(pattern);
        } else {
          return pattern.test(key);
        }
      });

      // Delete matching keys
      const promises = keysToDelete.map(key => deleteItem(key));
      await Promise.allSettled(promises);

      announceToScreenReader(`Invalidated ${keysToDelete.length} cache entries`, 'polite');
    } catch (error) {
      reportError(error as Error, { component: 'Cache', operation: 'invalidate', pattern });
    }
  };

  const cleanup = useCallback(async (): Promise<void> => {
    try {
      // Remove expired items from all cache locations
      for (const location of config.locations) {
        const cache = getCacheByLocation(location);
        if (cache.getAllKeys) {
          const keys = await cache.getAllKeys();

          for (const key of keys) {
            const item = await cache.get(key);
            if (item && Date.now() > item.timestamp + item.ttl) {
              await cache.delete(key);
            }
          }
        }
      }

      announceToScreenReader('Cache cleanup completed', 'polite');
    } catch (error) {
      reportError(error as Error, { component: 'Cache', operation: 'cleanup' });
    }
  }, [config.locations, getCacheByLocation, announceToScreenReader, reportError]);

  const optimize = async (): Promise<void> => {
    try {
      // Run cleanup first
      await cleanup();

      // Update memory usage stats
      const memoryUsage = memoryCache.getSize();
      const itemCount = memoryCache.getItemCount();

      setStats(prev => ({
        ...prev,
        memoryUsage,
        itemCount
      }));

      announceToScreenReader('Cache optimization completed', 'polite');
    } catch (error) {
      reportError(error as Error, { component: 'Cache', operation: 'optimize' });
    }
  };

  // Periodic cleanup
  useEffect(() => {
    const interval = setInterval(() => {
      cleanup();
    }, 5 * 60 * 1000); // Every 5 minutes

    return () => clearInterval(interval);
  }, [cleanup]);

  const contextValue: CacheContextType = {
    config,
    stats,
    get,
    set,
    has,
    delete: deleteItem,
    clear,
    prefetch,
    warmup,
    invalidate,
    updateConfig: (newConfig: Partial<CacheConfig>) => {
      setConfig(prev => ({ ...prev, ...newConfig }));
    },
    getStats: () => stats,
    resetStats: () => setStats({
      hitRate: 0,
      missRate: 0,
      totalRequests: 0,
      totalHits: 0,
      totalMisses: 0,
      memoryUsage: 0,
      storageUsage: 0,
      itemCount: 0,
      avgResponseTime: 0,
    }),
    cleanup,
    optimize,
  };

  return (
    <CacheContext.Provider value={contextValue}>
      {children}
    </CacheContext.Provider>
  );
}

export function useCache() {
  const context = useContext(CacheContext);
  if (context === undefined) {
    throw new Error('useCache must be used within a CacheProvider');
  }
  return context;
}

export default CacheProvider;