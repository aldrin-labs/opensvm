import { AdvancedRateLimiter } from '../lib/rate-limiter';

// Mock the cache at the actual import path used by rate-limiter
jest.mock('../lib/caching/cache', () => ({
  memoryCache: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn()
  }
}));

// Import the mocked module to access mock functions
import { memoryCache } from '../lib/caching/cache';

describe('AdvancedRateLimiter', () => {
  let rateLimiter: AdvancedRateLimiter;
  const mockCache = memoryCache as jest.Mocked<typeof memoryCache>;

  beforeEach(() => {
    mockCache.get.mockClear();
    mockCache.set.mockClear();

    rateLimiter = new AdvancedRateLimiter({
      maxRequests: 10,
      windowMs: 60000, // 1 minute
      burstLimit: 15,
      burstRefillRate: 0.167, // ~10 per minute
      keyPrefix: 'test'
    });
  });

  afterEach(() => {
    rateLimiter.destroy();
  });

  describe('Basic Rate Limiting', () => {
    it('should allow requests within limit', async () => {
      // Mock empty cache (new user)
      mockCache.get.mockReturnValue(null);

      const result = await rateLimiter.checkLimit('user1');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9); // 10 - 1
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('should deny requests when burst tokens exhausted', async () => {
      const now = Date.now();
      // Mock existing entry with no burst tokens
      mockCache.get.mockReturnValue({
        requests: Array(5).fill(now),
        totalRequests: 5,
        windowStart: now,
        burstTokens: 0, // No burst tokens left
        lastRefill: now
      });

      const result = await rateLimiter.checkLimit('user1');

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should handle cost parameter correctly', async () => {
      mockCache.get.mockReturnValue(null);

      const result = await rateLimiter.checkLimit('user1', 5);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5); // 10 - 5
    });
  });

  describe('Sliding Window Algorithm', () => {
    it('should clean expired requests', async () => {
      const now = Date.now();
      const oldTime = now - 70000; // 70 seconds ago (outside 60s window)
      
      mockCache.get.mockReturnValue({
        requests: [oldTime, oldTime, now], // 2 expired, 1 current
        totalRequests: 3,
        windowStart: oldTime,
        burstTokens: 15,
        lastRefill: now
      });

      const result = await rateLimiter.checkLimit('user1');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(8); // Should only count current request (1) + new (1) = 2 total
    });

    it('should update window start correctly', async () => {
      const now = Date.now();
      mockCache.get.mockReturnValue({
        requests: [],
        totalRequests: 0,
        windowStart: now - 70000, // Old window start
        burstTokens: 15,
        lastRefill: now
      });

      await rateLimiter.checkLimit('user1');

      // Should update cache with new window start
      const setCalls = mockCache.set.mock.calls;
      const updatedEntry = setCalls[setCalls.length - 1][1];
      expect(updatedEntry.windowStart).toBeCloseTo(now, -2); // Within 100ms
    });
  });

  describe('Burst Protection', () => {
    it('should refill burst tokens over time', async () => {
      const now = Date.now();
      const pastTime = now - 10000; // 10 seconds ago
      
      mockCache.get.mockReturnValue({
        requests: [],
        totalRequests: 0,
        windowStart: now,
        burstTokens: 10, // Started with 10
        lastRefill: pastTime // 10 seconds ago
      });

      await rateLimiter.checkLimit('user1');

      // Should refill ~1.67 tokens (10 seconds * 0.167 tokens/second)
      const setCalls = mockCache.set.mock.calls;
      const updatedEntry = setCalls[setCalls.length - 1][1];
      expect(updatedEntry.burstTokens).toBeGreaterThan(10);
      expect(updatedEntry.burstTokens).toBeLessThanOrEqual(15); // Max burst limit
    });

    it('should not exceed burst limit when refilling', async () => {
      const now = Date.now();
      const pastTime = now - 100000; // 100 seconds ago (should refill 16+ tokens)
      
      mockCache.get.mockReturnValue({
        requests: [],
        totalRequests: 0,
        windowStart: now,
        burstTokens: 5,
        lastRefill: pastTime
      });

      await rateLimiter.checkLimit('user1');

      const setCalls = mockCache.set.mock.calls;
      const updatedEntry = setCalls[setCalls.length - 1][1];
      expect(updatedEntry.burstTokens).toBe(14); // 15 (max) - 1 (used) = 14
    });

    it('should handle burst requests correctly', async () => {
      mockCache.get.mockReturnValue({
        requests: [],
        totalRequests: 0,
        windowStart: Date.now(),
        burstTokens: 15,
        lastRefill: Date.now()
      });

      // Make 12 requests (exceeds regular limit of 10 but within burst of 15)
      const result = await rateLimiter.checkLimit('user1', 12);

      expect(result.allowed).toBe(true);
      expect(result.burstRemaining).toBe(3); // 15 - 12 = 3
    });
  });

  describe('Error Handling', () => {
    it('should handle cache errors gracefully', async () => {
      mockCache.get.mockImplementation(() => {
        throw new Error('Cache error');
      });

      const result = await rateLimiter.checkLimit('user1');

      // Should create new entry despite cache error
      expect(result.allowed).toBe(true);
    });

    it('should validate cost parameter', async () => {
      mockCache.get.mockReturnValue(null);

      const result = await rateLimiter.checkLimit('user1', 0);
      expect(result.allowed).toBe(true);

      const result2 = await rateLimiter.checkLimit('user1', -1);
      expect(result2.allowed).toBe(true); // Should handle negative cost gracefully
    });
  });

  describe('Utility Methods', () => {
    it('should return remaining requests correctly', async () => {
      mockCache.get.mockReturnValue({
        requests: Array(3).fill(Date.now()),
        totalRequests: 3,
        windowStart: Date.now(),
        burstTokens: 15,
        lastRefill: Date.now()
      });

      const remaining = await rateLimiter.getRemainingRequests('user1');
      expect(remaining).toBe(7); // 10 - 3 = 7
    });

    it('should return burst remaining correctly', async () => {
      mockCache.get.mockReturnValue({
        requests: [],
        totalRequests: 0,
        windowStart: Date.now(),
        burstTokens: 12,
        lastRefill: Date.now()
      });

      const burstRemaining = await rateLimiter.getBurstRemaining('user1');
      expect(burstRemaining).toBe(12);
    });

    it('should reset limits correctly', async () => {
      await rateLimiter.resetLimit('user1');
      expect(mockCache.delete).toHaveBeenCalledWith('test:user1');
    });

    it('should return comprehensive stats', async () => {
      const now = Date.now();
      mockCache.get.mockReturnValue({
        requests: Array(5).fill(now),
        totalRequests: 5,
        windowStart: now,
        burstTokens: 10,
        lastRefill: now
      });

      const stats = await rateLimiter.getStats('user1');

      expect(stats.requests).toBe(5);
      expect(stats.remaining).toBe(5);
      expect(stats.resetTime).toBe(now + 60000);
      expect(stats.windowStart).toBe(now);
      // Use approximate matching for burstRemaining due to refill calculations
      expect(stats.burstRemaining).toBeCloseTo(10, 1);
    });
  });

  describe('Configuration', () => {
    it('should use default values correctly', () => {
      const defaultLimiter = new AdvancedRateLimiter({
        maxRequests: 100,
        windowMs: 60000
      });

      expect(defaultLimiter.config.burstLimit).toBe(150); // 100 * 1.5
      expect(defaultLimiter.config.burstRefillRate).toBeCloseTo(1.67, 2); // 100 / 60
      expect(defaultLimiter.config.keyPrefix).toBe('rate_limit');

      defaultLimiter.destroy();
    });

    it('should respect custom configuration', () => {
      const customLimiter = new AdvancedRateLimiter({
        maxRequests: 50,
        windowMs: 30000,
        burstLimit: 60,
        burstRefillRate: 2.0,
        keyPrefix: 'custom'
      });

      expect(customLimiter.config.maxRequests).toBe(50);
      expect(customLimiter.config.windowMs).toBe(30000);
      expect(customLimiter.config.burstLimit).toBe(60);
      expect(customLimiter.config.burstRefillRate).toBe(2.0);
      expect(customLimiter.config.keyPrefix).toBe('custom');

      customLimiter.destroy();
    });
  });

  describe('Memory Management', () => {
    it('should use cache with appropriate TTL', async () => {
      mockCache.get.mockReturnValue(null);

      await rateLimiter.checkLimit('user1');

      expect(mockCache.set).toHaveBeenCalledWith(
        'test:user1',
        expect.any(Object),
        expect.any(Number) // TTL in seconds
      );

      const ttl = mockCache.set.mock.calls[0][2];
      expect(ttl).toBeGreaterThan(600); // At least 10 minutes
    });

    it('should cleanup on destroy', () => {
      const limiter = new AdvancedRateLimiter({
        maxRequests: 10,
        windowMs: 60000
      });

      // Should not throw
      expect(() => limiter.destroy()).not.toThrow();
    });
  });
});