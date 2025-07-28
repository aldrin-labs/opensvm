// Simple in-memory rate limiter
interface RateLimitEntry {
  requests: number;
  resetTime: number;
}

class RateLimiter {
  private requests: Map<string, RateLimitEntry> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 60, windowMs: number = 60000) { // 60 requests per minute
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const entry = this.requests.get(identifier);

    if (!entry || now > entry.resetTime) {
      // New window or expired entry
      this.requests.set(identifier, {
        requests: 1,
        resetTime: now + this.windowMs
      });
      return true;
    }

    if (entry.requests >= this.maxRequests) {
      return false; // Rate limit exceeded
    }

    // Increment request count
    entry.requests++;
    return true;
  }

  getRemainingRequests(identifier: string): number {
    const entry = this.requests.get(identifier);
    if (!entry || Date.now() > entry.resetTime) {
      return this.maxRequests;
    }
    return Math.max(0, this.maxRequests - entry.requests);
  }

  // Cleanup expired entries periodically
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.requests.entries()) {
      if (now > entry.resetTime) {
        this.requests.delete(key);
      }
    }
  }
}

// Export rate limiter instances
export const burnRateLimiter = new RateLimiter(10, 60000); // 10 burns per minute
export const generalRateLimiter = new RateLimiter(60, 60000); // 60 requests per minute

// Cleanup expired entries every 5 minutes
setInterval(() => {
  burnRateLimiter.cleanup();
  generalRateLimiter.cleanup();
}, 5 * 60 * 1000);