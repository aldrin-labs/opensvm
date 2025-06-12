/**
 * Token Bucket Rate Limiter
 * 
 * Implements a more sophisticated rate limiting algorithm than simple counting.
 * Uses the Token Bucket algorithm for smooth rate limiting with burst capacity.
 */

export interface TokenBucketConfig {
  capacity: number;        // Maximum tokens in bucket
  refillRate: number;      // Tokens added per second
  windowMs: number;        // Time window for rate limiting
}

export interface RateLimitResult {
  allowed: boolean;
  remainingTokens: number;
  resetTime: number;
  retryAfter?: number;
}

export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRate: number;
  private readonly windowMs: number;
  private refillTimer: NodeJS.Timeout | null = null;

  constructor(config: TokenBucketConfig) {
    this.capacity = config.capacity;
    this.refillRate = config.refillRate;
    this.windowMs = config.windowMs;
    this.tokens = config.capacity;
    this.lastRefill = Date.now();
    this.startRefillTimer();
  }

  /**
   * Start timer-based token refill for better accuracy
   */
  private startRefillTimer(): void {
    if (this.refillTimer) {
      clearInterval(this.refillTimer);
    }
    
    // Refill every 100ms for smooth rate limiting
    this.refillTimer = setInterval(() => {
      this.timerBasedRefill();
    }, 100);
  }

  /**
   * Timer-based refill with improved semantics
   */
  private timerBasedRefill(): void {
    const now = Date.now();
    const timeSinceLastRefill = (now - this.lastRefill) / 1000; // seconds
    
    if (timeSinceLastRefill > 0) {
      const tokensToAdd = timeSinceLastRefill * this.refillRate;
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  /**
   * Attempt to consume tokens from the bucket
   */
  consume(tokens: number = 1): RateLimitResult {
    this.timerBasedRefill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return {
        allowed: true,
        remainingTokens: this.tokens,
        resetTime: this.getResetTime()
      };
    }

    return {
      allowed: false,
      remainingTokens: this.tokens,
      resetTime: this.getResetTime(),
      retryAfter: this.getRetryAfter()
    };
  }

  /**
   * Check if tokens are available without consuming them
   */
  check(tokens: number = 1): RateLimitResult {
    this.timerBasedRefill();

    return {
      allowed: this.tokens >= tokens,
      remainingTokens: this.tokens,
      resetTime: this.getResetTime(),
      retryAfter: this.tokens < tokens ? this.getRetryAfter() : undefined
    };
  }

  /**
   * Get current bucket state
   */
  getState() {
    this.timerBasedRefill();
    return {
      tokens: this.tokens,
      capacity: this.capacity,
      refillRate: this.refillRate,
      lastRefill: this.lastRefill
    };
  }

  /**
   * Clean up timer when bucket is destroyed
   */
  destroy(): void {
    if (this.refillTimer) {
      clearInterval(this.refillTimer);
      this.refillTimer = null;
    }
  }

  private refill(): void {
    // Keep legacy refill method for immediate needs
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000; // seconds
    
    if (timePassed > 0) {
      const tokensToAdd = timePassed * this.refillRate;
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  private getResetTime(): number {
    const tokensNeeded = this.capacity - this.tokens;
    const timeToFill = tokensNeeded / this.refillRate * 1000; // milliseconds
    return Date.now() + timeToFill;
  }

  private getRetryAfter(): number {
    const timeToNextToken = (1 / this.refillRate) * 1000; // milliseconds
    return Math.ceil(timeToNextToken / 1000); // seconds
  }
}

/**
 * Rate Limiter Manager with multiple bucket types
 */
export class RateLimiterManager {
  private buckets = new Map<string, TokenBucket>();
  private configs = new Map<string, TokenBucketConfig>();

  constructor() {
    // Default configurations for different rate limit types
    this.setConfig('api_requests', {
      capacity: 100,        // 100 requests burst
      refillRate: 10,       // 10 requests per second sustained
      windowMs: 60000       // 1 minute window
    });

    this.setConfig('websocket_connections', {
      capacity: 10,         // 10 concurrent connections
      refillRate: 1,        // 1 new connection per second
      windowMs: 60000       // 1 minute window
    });

    this.setConfig('authentication', {
      capacity: 5,          // 5 auth attempts burst
      refillRate: 0.1,      // 1 auth attempt per 10 seconds sustained
      windowMs: 300000      // 5 minute window
    });

    this.setConfig('anomaly_analysis', {
      capacity: 50,         // 50 analysis requests burst
      refillRate: 5,        // 5 analyses per second sustained
      windowMs: 60000       // 1 minute window
    });
  }

  /**
   * Set configuration for a rate limit type
   */
  setConfig(type: string, config: TokenBucketConfig): void {
    this.configs.set(type, config);
  }

  /**
   * Get or create a bucket for a client and type
   */
  private getBucket(clientId: string, type: string): TokenBucket {
    const key = `${clientId}:${type}`;
    
    if (!this.buckets.has(key)) {
      const config = this.configs.get(type);
      if (!config) {
        throw new Error(`No configuration found for rate limit type: ${type}`);
      }
      this.buckets.set(key, new TokenBucket(config));
    }

    return this.buckets.get(key)!;
  }

  /**
   * Check rate limit for a client and type
   */
  checkRateLimit(clientId: string, type: string, tokens: number = 1): RateLimitResult {
    const bucket = this.getBucket(clientId, type);
    return bucket.consume(tokens);
  }

  /**
   * Check rate limit without consuming tokens
   */
  peekRateLimit(clientId: string, type: string, tokens: number = 1): RateLimitResult {
    const bucket = this.getBucket(clientId, type);
    return bucket.check(tokens);
  }

  /**
   * Get bucket state for debugging
   */
  getBucketState(clientId: string, type: string): any {
    const bucket = this.getBucket(clientId, type);
    return bucket.getState();
  }

  /**
   * Clean up old buckets to prevent memory leaks
   */
  cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [key, bucket] of this.buckets.entries()) {
      const state = bucket.getState();
      if (now - state.lastRefill > maxAge) {
        bucket.destroy(); // Clean up timer
        this.buckets.delete(key);
      }
    }
  }

  /**
   * Get rate limiting statistics
   */
  getStats(): any {
    const stats = {
      totalBuckets: this.buckets.size,
      configurations: Object.fromEntries(this.configs),
      activeBuckets: {}
    };

    for (const [key, bucket] of this.buckets.entries()) {
      const [clientId, type] = key.split(':');
      if (!stats.activeBuckets[type]) {
        stats.activeBuckets[type] = 0;
      }
      stats.activeBuckets[type]++;
    }

    return stats;
  }

  /**
   * Reset rate limits for a client (admin function)
   */
  resetClientLimits(clientId: string): void {
    const keysToDelete = [];
    for (const key of this.buckets.keys()) {
      if (key.startsWith(`${clientId}:`)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.buckets.delete(key));
  }
}

// Global rate limiter instance
let globalRateLimiter: RateLimiterManager | null = null;

export function getRateLimiter(): RateLimiterManager {
  if (!globalRateLimiter) {
    globalRateLimiter = new RateLimiterManager();
    
    // Set up periodic cleanup
    setInterval(() => {
      globalRateLimiter?.cleanup();
    }, 60 * 60 * 1000); // Clean up every hour
  }
  
  return globalRateLimiter;
}

/**
 * Middleware function for rate limiting
 */
export function createRateLimitMiddleware(type: string, tokens: number = 1) {
  return (clientId: string): RateLimitResult => {
    const rateLimiter = getRateLimiter();
    return rateLimiter.checkRateLimit(clientId, type, tokens);
  };
}

/**
 * Express-like middleware for rate limiting
 */
export function rateLimitMiddleware(options: { type: string; tokens?: number }) {
  return (req: any, res: any, next: any) => {
    const clientId = req.clientId || req.ip || 'anonymous';
    const result = createRateLimitMiddleware(options.type, options.tokens)(clientId);
    
    if (!result.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        remainingTokens: result.remainingTokens,
        resetTime: result.resetTime,
        retryAfter: result.retryAfter
      });
    }
    
    // Add rate limit headers
    res.setHeader('X-RateLimit-Remaining', result.remainingTokens);
    res.setHeader('X-RateLimit-Reset', result.resetTime);
    
    next();
  };
}