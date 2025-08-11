import { useState, useRef, useCallback } from 'react';

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

interface UseHoverCacheReturn<T> {
    getCachedData: (key: string) => T | null;
    setCachedData: (key: string, data: T, ttl?: number) => void;
    clearCache: () => void;
    clearExpired: () => void;
    cacheSize: number;
}

export function useHoverCache<T>(defaultTtl: number = 30000): UseHoverCacheReturn<T> {
    const cache = useRef<Map<string, CacheEntry<T>>>(new Map());
    const [, setCacheVersion] = useState(0);

    const getCachedData = useCallback((key: string): T | null => {
        const entry = cache.current.get(key);
        if (!entry) return null;

        const now = Date.now();
        if (now - entry.timestamp > entry.ttl) {
            // Expired, remove from cache
            cache.current.delete(key);
            setCacheVersion(prev => prev + 1);
            return null;
        }

        return entry.data;
    }, []);

    const setCachedData = useCallback((key: string, data: T, ttl: number = defaultTtl) => {
        const entry: CacheEntry<T> = {
            data,
            timestamp: Date.now(),
            ttl
        };
        cache.current.set(key, entry);
        setCacheVersion(prev => prev + 1);
    }, [defaultTtl]);

    const clearCache = useCallback(() => {
        cache.current.clear();
        setCacheVersion(prev => prev + 1);
    }, []);

    const clearExpired = useCallback(() => {
        const now = Date.now();
        for (const [key, entry] of cache.current.entries()) {
            if (now - entry.timestamp > entry.ttl) {
                cache.current.delete(key);
            }
        }
        setCacheVersion(prev => prev + 1);
    }, []);

    return {
        getCachedData,
        setCachedData,
        clearCache,
        clearExpired,
        cacheSize: cache.current.size
    };
}
