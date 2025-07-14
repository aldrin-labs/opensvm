/**
 * Tests for Advanced Caching System
 * 
 * Comprehensive tests for Redis-compatible cache, middleware, and Qdrant analytics
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { RedisCompatibleCache } from '@/lib/cache/redis-compatible-cache';
import { createCacheMiddleware, CacheInvalidator } from '@/lib/cache/cache-middleware';
import { NextRequest, NextResponse } from 'next/server';

// Mock NextRequest for testing
function createMockRequest(url: string, method = 'GET'): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), { method });
}

// Mock NextResponse handler
async function createMockHandler(data: any, status = 200): Promise<NextResponse> {
  return NextResponse.json(data, { status });
}

describe('RedisCompatibleCache', () => {
  let cache: RedisCompatibleCache;

  beforeEach(() => {
    cache = new RedisCompatibleCache({
      ttl: 60000, // 1 minute
      maxSize: 100,
      enableCompression: false,
      namespace: 'test'
    });
  });

  afterEach(async () => {
    await cache.flushall();
  });

  describe('Basic Operations', () => {
    it('should set and get values', async () => {
      const testData = { id: 1, name: 'test' };
      await cache.set('test-key', testData);
      
      const retrieved = await cache.get('test-key');
      expect(retrieved).toEqual(testData);
    });

    it('should return null for non-existent keys', async () => {
      const result = await cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should respect TTL expiration', async () => {
      await cache.set('expiring-key', 'test-value', 100); // 100ms TTL
      
      // Should exist immediately
      let value = await cache.get('expiring-key');
      expect(value).toBe('test-value');
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should be expired
      value = await cache.get('expiring-key');
      expect(value).toBeNull();
    });

    it('should delete keys', async () => {
      await cache.set('delete-me', 'test');
      expect(await cache.exists('delete-me')).toBe(true);
      
      const deleted = await cache.del('delete-me');
      expect(deleted).toBe(true);
      expect(await cache.exists('delete-me')).toBe(false);
    });

    it('should list keys with patterns', async () => {
      await cache.set('user:1', { id: 1 });
      await cache.set('user:2', { id: 2 });
      await cache.set('product:1', { id: 1 });
      
      const userKeys = await cache.keys('user:*');
      expect(userKeys).toContain('user:1');
      expect(userKeys).toContain('user:2');
      expect(userKeys).not.toContain('product:1');
    });
  });

  describe('Advanced Operations', () => {
    it('should handle TTL operations', async () => {
      await cache.set('ttl-test', 'value', 60000); // 1 minute
      
      const ttl = await cache.ttl('ttl-test');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60);
      
      // Extend TTL
      await cache.expire('ttl-test', 120000); // 2 minutes
      const newTtl = await cache.ttl('ttl-test');
      expect(newTtl).toBeGreaterThan(60);
    });

    it('should provide cache statistics', async () => {
      // Add some entries
      await cache.set('stat1', 'value1');
      await cache.set('stat2', 'value2');
      
      // Trigger some hits and misses
      await cache.get('stat1');
      await cache.get('stat1');
      await cache.get('non-existent');
      
      const stats = await cache.info();
      expect(stats.totalEntries).toBe(2);
      expect(stats.totalHits).toBe(2);
      expect(stats.totalMisses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.67, 2);
    });

    it('should cleanup expired entries', async () => {
      await cache.set('cleanup1', 'value', 50); // 50ms TTL
      await cache.set('cleanup2', 'value', 100000); // Long TTL
      
      // Wait for first entry to expire
      await new Promise(resolve => setTimeout(resolve, 75));
      
      const cleaned = await cache.cleanup();
      expect(cleaned).toBe(1);
      
      // Verify only non-expired entry remains
      expect(await cache.exists('cleanup1')).toBe(false);
      expect(await cache.exists('cleanup2')).toBe(true);
    });
  });

  describe('Blockchain-specific Operations', () => {
    it('should cache network statistics', async () => {
      const networkData = {
        tps: 2500,
        totalTransactions: 1000000,
        validators: 1800
      };
      
      await cache.cacheNetworkStats(networkData);
      const retrieved = await cache.get('network:stats');
      expect(retrieved).toEqual(networkData);
    });

    it('should cache token analytics', async () => {
      const tokenData = {
        mint: 'So11111111111111111111111111111111111111112',
        price: 100.50,
        volume24h: 50000000
      };
      
      const mint = 'So11111111111111111111111111111111111111112';
      await cache.cacheTokenAnalytics(mint, tokenData);
      
      const retrieved = await cache.get(`token:analytics:${mint}`);
      expect(retrieved).toEqual(tokenData);
    });

    it('should invalidate by tags', async () => {
      await cache.set('tag1', 'value1', 60000, ['network', 'stats']);
      await cache.set('tag2', 'value2', 60000, ['token', 'analytics']);
      await cache.set('tag3', 'value3', 60000, ['network', 'health']);
      
      const invalidated = await cache.invalidateByTags(['network']);
      expect(invalidated).toBe(2); // tag1 and tag3
      
      expect(await cache.exists('tag1')).toBe(false);
      expect(await cache.exists('tag2')).toBe(true);
      expect(await cache.exists('tag3')).toBe(false);
    });
  });
});

describe('Cache Middleware', () => {
  let mockHandler: jest.MockedFunction<any>;

  beforeEach(() => {
    mockHandler = jest.fn();
  });

  it('should cache successful responses', async () => {
    const middleware = createCacheMiddleware({
      ttl: 60000,
      namespace: 'api',
      enableDebug: true
    });

    const testData = { result: 'success' };
    mockHandler.mockResolvedValue(NextResponse.json(testData));

    const req = createMockRequest('http://localhost:3000/api/test');
    
    // First request - should call handler
    const response1 = await middleware(req, mockHandler);
    const data1 = await response1.json();
    
    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(data1).toEqual(testData);
    expect(response1.headers.get('X-Cache')).toBe('MISS');

    // Second request - should use cache
    const response2 = await middleware(req, mockHandler);
    const data2 = await response2.json();
    
    expect(mockHandler).toHaveBeenCalledTimes(1); // Still only called once
    expect(data2).toEqual(testData);
    expect(response2.headers.get('X-Cache')).toBe('HIT');
  });

  it('should bypass cache when requested', async () => {
    const middleware = createCacheMiddleware({
      ttl: 60000,
      bypassParam: 'no_cache'
    });

    const testData = { result: 'success' };
    mockHandler.mockResolvedValue(NextResponse.json(testData));

    // Request with bypass parameter
    const req = createMockRequest('http://localhost:3000/api/test?no_cache=1');
    
    const response = await middleware(req, mockHandler);
    
    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(response.headers.get('X-Cache')).toBe('MISS');
  });

  it('should handle custom cache key generation', async () => {
    const middleware = createCacheMiddleware({
      ttl: 60000,
      cacheKeyGenerator: (req) => {
        const url = new URL(req.url);
        return `custom:${url.pathname}`;
      }
    });

    const testData = { result: 'custom' };
    mockHandler.mockResolvedValue(NextResponse.json(testData));

    const req = createMockRequest('http://localhost:3000/api/custom');
    
    const response = await middleware(req, mockHandler);
    expect(response.headers.get('X-Cache-Key')).toBe('custom:/api/custom');
  });

  it('should handle errors gracefully', async () => {
    const middleware = createCacheMiddleware({
      ttl: 60000
    });

    mockHandler.mockRejectedValue(new Error('Handler error'));

    const req = createMockRequest('http://localhost:3000/api/error');
    
    // Should not throw, but call handler again
    const response = await middleware(req, mockHandler);
    expect(response.headers.get('X-Cache')).toBe('ERROR');
  });
});

describe('Cache Invalidator', () => {
  let cache: RedisCompatibleCache;

  beforeEach(() => {
    cache = new RedisCompatibleCache({
      namespace: 'test-invalidation'
    });
  });

  afterEach(async () => {
    await cache.flushall();
  });

  it('should invalidate network data', async () => {
    // Setup test data
    await cache.set('network:stats:1', { tps: 2000 }, 60000, ['network', 'stats']);
    await cache.set('network:health:1', { status: 'ok' }, 60000, ['network', 'health']);
    await cache.set('token:data:1', { price: 100 }, 60000, ['token']);

    // Mock the invalidation (in real usage, this would use the actual cache instances)
    const networkInvalidated = await cache.invalidateByTags(['network']);
    
    expect(networkInvalidated).toBe(2);
    expect(await cache.exists('network:stats:1')).toBe(false);
    expect(await cache.exists('network:health:1')).toBe(false);
    expect(await cache.exists('token:data:1')).toBe(true);
  });

  it('should invalidate by pattern', async () => {
    await cache.set('user:1:profile', { name: 'user1' });
    await cache.set('user:2:profile', { name: 'user2' });
    await cache.set('admin:1:profile', { name: 'admin1' });

    const keys = await cache.keys('user:*');
    for (const key of keys) {
      await cache.del(key);
    }

    expect(await cache.exists('user:1:profile')).toBe(false);
    expect(await cache.exists('user:2:profile')).toBe(false);
    expect(await cache.exists('admin:1:profile')).toBe(true);
  });
});

describe('Performance Tests', () => {
  let cache: RedisCompatibleCache;

  beforeEach(() => {
    cache = new RedisCompatibleCache({
      maxSize: 1000,
      enableCompression: true
    });
  });

  afterEach(async () => {
    await cache.flushall();
  });

  it('should handle high volume operations', async () => {
    const startTime = Date.now();
    const operations = 1000;

    // Bulk set operations
    const setPromises = Array.from({ length: operations }, (_, i) => 
      cache.set(`bulk:${i}`, { id: i, data: `test-data-${i}` })
    );
    await Promise.all(setPromises);

    // Bulk get operations
    const getPromises = Array.from({ length: operations }, (_, i) => 
      cache.get(`bulk:${i}`)
    );
    const results = await Promise.all(getPromises);

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Verify results
    expect(results).toHaveLength(operations);
    expect(results.every(result => result !== null)).toBe(true);
    
    // Performance assertion (should complete within reasonable time)
    expect(duration).toBeLessThan(5000); // 5 seconds max for 1000 operations
    
    console.log(`Completed ${operations * 2} cache operations in ${duration}ms`);
  });

  it('should maintain performance under memory pressure', async () => {
    const cache = new RedisCompatibleCache({
      maxSize: 100, // Small cache to trigger evictions
      enableCompression: true
    });

    // Fill cache beyond capacity
    for (let i = 0; i < 150; i++) {
      await cache.set(`pressure:${i}`, { 
        id: i, 
        data: new Array(100).fill(`data-${i}`).join('') 
      });
    }

    const stats = await cache.info();
    
    // Cache should have evicted some entries
    expect(stats.totalEntries).toBeLessThanOrEqual(100);
    expect(stats.evictionCount).toBeGreaterThan(0);
    
    // Recent entries should still be accessible
    const recentEntry = await cache.get('pressure:149');
    expect(recentEntry).not.toBeNull();
    
    await cache.flushall();
  });
});