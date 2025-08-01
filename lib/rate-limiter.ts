// Production-ready rate limiter with sliding window algorithm
import { memoryCache } from './cache';

interface RateLimitEntry {
  requests: number[];
  totalRequests: number;
  windowStart: number;
  burstTokens: number;
  lastRefill: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  burstLimit?: number;
  burstRefillRate?: number; // tokens per second
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyPrefix?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
  burstRemaining?: number;
}

class AdvancedRateLimiter {
  private config: Required<RateLimitConfig>;
  private cleanupInterval: NodeJS.Timeout;

  constructor(config: RateLimitConfig) {
    this.config = {
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
      burstLimit: config.burstLimit || Math.ceil(config.maxRequests * 1.5),
      burstRefillRate: config.burstRefillRate || config.maxRequests / (config.windowMs / 1000),
      skipSuccessfulRequests: config.skipSuccessfulRequests || false,
      skipFailedRequests: config.skipFailedRequests || false,
      keyPrefix: config.keyPrefix || 'rate_limit'
    };

    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  private getCacheKey(identifier: string): string {
    return `${this.config.keyPrefix}:${identifier}`;
  }

  private getEntry(identifier: string): RateLimitEntry {
    const key = this.getCacheKey(identifier);
    const existing = memoryCache.get<RateLimitEntry>(key);

    if (existing) {
      return existing;
    }

    const now = Date.now();
    const newEntry: RateLimitEntry = {
      requests: [],
      totalRequests: 0,
      windowStart: now,
      burstTokens: this.config.burstLimit,
      lastRefill: now
    };

    // Cache for window duration + 10 minutes buffer
    memoryCache.set(key, newEntry, Math.ceil((this.config.windowMs + 600000) / 1000));
    return newEntry;
  }

  private updateEntry(identifier: string, entry: RateLimitEntry): void {
    const key = this.getCacheKey(identifier);
    memoryCache.set(key, entry, Math.ceil((this.config.windowMs + 600000) / 1000));
  }

  private refillBurstTokens(entry: RateLimitEntry): void {
    const now = Date.now();
    const timePassed = (now - entry.lastRefill) / 1000; // seconds
    const tokensToAdd = Math.floor(timePassed * this.config.burstRefillRate);

    if (tokensToAdd > 0) {
      entry.burstTokens = Math.min(
        this.config.burstLimit,
        entry.burstTokens + tokensToAdd
      );
      entry.lastRefill = now;
    }
  }

  private cleanExpiredRequests(entry: RateLimitEntry, now: number): void {
    const cutoff = now - this.config.windowMs;
    const originalLength = entry.requests.length;

    // Remove requests older than window
    entry.requests = entry.requests.filter(timestamp => timestamp > cutoff);

    // Update total if requests were removed
    if (entry.requests.length !== originalLength) {
      entry.totalRequests = entry.requests.length;
    }

    // Update window start if needed
    if (entry.requests.length === 0) {
      entry.windowStart = now;
    } else if (entry.windowStart < cutoff) {
      entry.windowStart = entry.requests[0];
    }
  }

  async checkLimit(identifier: string, cost: number = 1): Promise<RateLimitResult> {
    const now = Date.now();
    const entry = this.getEntry(identifier);

    // Clean expired requests
    this.cleanExpiredRequests(entry, now);

    // Refill burst tokens
    this.refillBurstTokens(entry);

    // Calculate remaining capacity
    const remaining = Math.max(0, this.config.maxRequests - entry.totalRequests);
    const windowEnd = entry.windowStart + this.config.windowMs;
    const resetTime = windowEnd;

    // Check if request would exceed limits
    const wouldExceedRegular = (entry.totalRequests + cost) > this.config.maxRequests;
    const wouldExceedBurst = cost > entry.burstTokens;

    let allowed = false;
    let retryAfter: number | undefined;

    if (!wouldExceedBurst) {
      // Allow request - sufficient burst tokens available
      allowed = true;
      entry.requests.push(...Array(cost).fill(now));
      entry.totalRequests += cost;
      entry.burstTokens -= cost;
    } else {
      // Request denied
      allowed = false;

      // Calculate retry after time
      if (wouldExceedRegular) {
        // Wait until oldest request expires
        const oldestRequest = entry.requests[0];
        retryAfter = Math.ceil((oldestRequest + this.config.windowMs - now) / 1000);
      } else if (wouldExceedBurst) {
        // Wait until enough burst tokens refill
        const tokensNeeded = cost - entry.burstTokens;
        retryAfter = Math.ceil(tokensNeeded / this.config.burstRefillRate);
      }
    }

    // Update entry in cache
    this.updateEntry(identifier, entry);

    return {
      allowed,
      remaining: Math.max(0, this.config.maxRequests - entry.totalRequests),
      resetTime,
      retryAfter,
      burstRemaining: entry.burstTokens
    };
  }

  async isAllowed(identifier: string, cost: number = 1): Promise<boolean> {
    const result = await this.checkLimit(identifier, cost);
    return result.allowed;
  }

  async getRemainingRequests(identifier: string): Promise<number> {
    const result = await this.checkLimit(identifier, 0); // Check without consuming
    return result.remaining;
  }

  async getBurstRemaining(identifier: string): Promise<number> {
    const result = await this.checkLimit(identifier, 0);
    return result.burstRemaining || 0;
  }

  async resetLimit(identifier: string): Promise<void> {
    const key = this.getCacheKey(identifier);
    memoryCache.delete(key);
  }

  async getStats(identifier: string): Promise<{
    requests: number;
    remaining: number;
    resetTime: number;
    burstRemaining: number;
    windowStart: number;
  }> {
    const entry = this.getEntry(identifier);
    const now = Date.now();

    this.cleanExpiredRequests(entry, now);
    this.refillBurstTokens(entry);

    return {
      requests: entry.totalRequests,
      remaining: Math.max(0, this.config.maxRequests - entry.totalRequests),
      resetTime: entry.windowStart + this.config.windowMs,
      burstRemaining: entry.burstTokens,
      windowStart: entry.windowStart
    };
  }

  private cleanup(): void {
    // The memory cache handles TTL cleanup automatically
    // This method is kept for compatibility and future enhancements
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Middleware helper for Next.js API routes
export function createRateLimitMiddleware(limiter: AdvancedRateLimiter) {
  return async (request: Request, identifier?: string) => {
    const clientId = identifier ||
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const result = await limiter.checkLimit(clientId);

    if (!result.allowed) {
      const headers = new Headers({
        'X-RateLimit-Limit': limiter.config.maxRequests.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
      });

      if (result.retryAfter) {
        headers.set('Retry-After', result.retryAfter.toString());
      }

      if (result.burstRemaining !== undefined) {
        headers.set('X-RateLimit-Burst-Remaining', result.burstRemaining.toString());
      }

      return {
        allowed: false,
        response: new Response(JSON.stringify({
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: result.retryAfter
        }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            ...Object.fromEntries(headers.entries())
          }
        })
      };
    }

    return { allowed: true };
  };
}

// Pre-configured rate limiters for different use cases
export const burnRateLimiter = new AdvancedRateLimiter({
  maxRequests: 10,
  windowMs: 60 * 1000, // 1 minute
  burstLimit: 15, // Allow up to 15 burns in burst
  burstRefillRate: 0.167, // ~10 per minute refill
  keyPrefix: 'burn_limit'
});

export const generalRateLimiter = new AdvancedRateLimiter({
  maxRequests: 100,
  windowMs: 60 * 1000, // 1 minute
  burstLimit: 150,
  burstRefillRate: 1.67, // ~100 per minute refill
  keyPrefix: 'general_limit'
});

export const strictRateLimiter = new AdvancedRateLimiter({
  maxRequests: 5,
  windowMs: 60 * 1000, // 1 minute
  burstLimit: 7,
  burstRefillRate: 0.083, // ~5 per minute refill
  keyPrefix: 'strict_limit'
});

// Export the class for custom implementations
export { AdvancedRateLimiter };

// Cleanup on process exit
process.on('SIGTERM', () => {
  burnRateLimiter.destroy();
  generalRateLimiter.destroy();
  strictRateLimiter.destroy();
});

process.on('SIGINT', () => {
  burnRateLimiter.destroy();
  generalRateLimiter.destroy();
  strictRateLimiter.destroy();
});