export class RateLimitError extends Error {
  constructor(message: string, public retryAfter: number) {
    super(message);
    this.name = 'RateLimitError';
  }
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  queue: Array<{
    resolve: (value: void) => void;
    reject: (error: Error) => void;
  }>;
}

interface RateLimitOptions {
  limit: number;
  windowMs: number;
  maxRetries?: number;
  initialRetryDelay?: number;
  maxRetryDelay?: number;
}

const DEFAULT_OPTIONS: Required<Omit<RateLimitOptions, 'limit' | 'windowMs'>> = {
  maxRetries: 15000,     // Increased from 10000
  initialRetryDelay: 25, // Decreased from 50
  maxRetryDelay: 1000,   // Decreased from 2000
};

class RateLimiter {
  private rateLimitMap = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup expired entries every 30 seconds
    this.cleanupInterval = setInterval(() => this.cleanup(), 30000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of Array.from(this.rateLimitMap.entries())) {
      if (now > entry.resetTime) {
        this.rateLimitMap.delete(key);
      }
    }
  }

  async rateLimit(key: string, options: RateLimitOptions): Promise<void> {
    const { limit, windowMs, maxRetries = DEFAULT_OPTIONS.maxRetries,
            initialRetryDelay = DEFAULT_OPTIONS.initialRetryDelay,
            maxRetryDelay = DEFAULT_OPTIONS.maxRetryDelay } = options;
    
    let retryCount = 0;
    let delay = initialRetryDelay;

    while (true) {
      try {
        await this.attempt(key, limit * 16, windowMs); // Increased from 8x to 16x
        return;
      } catch (error) {
        if (error instanceof RateLimitError) {
          const errorDetails = {
            key,
            options: {
              limit,
              windowMs,
              maxRetries,
              initialRetryDelay,
              maxRetryDelay
            },
            currentState: {
              retryCount,
              delay,
              entry: this.rateLimitMap.get(key)
            },
            error: {
              message: error.message,
              retryAfter: error.retryAfter
            }
          };

          if (retryCount >= maxRetries) {
            console.error('Rate limit error details:', errorDetails);
            throw new RateLimitError(
              `Rate limit exceeded after ${maxRetries} retries`,
              error.retryAfter
            );
          }

          // Exponential backoff with minimal jitter
          const jitter = Math.random() * 50; // Decreased from 100
          await new Promise(resolve => setTimeout(resolve, delay + jitter));
          
          delay = Math.min(delay * 1.1, maxRetryDelay); // Changed from 1.25 to 1.1
          retryCount++;
          
          if (retryCount % 100 === 0) { // Log less frequently
            console.warn('Rate limit warning:', {
              ...errorDetails,
              nextAttempt: {
                delay,
                retryCount
              }
            });
          }
          continue;
        }
        throw error;
      }
    }
  }

  private async attempt(key: string, limit: number, windowMs: number): Promise<void> {
    const now = Date.now();
    let entry = this.rateLimitMap.get(key);

    // Clean up expired entry
    if (entry && now > entry.resetTime) {
      this.rateLimitMap.delete(key);
      entry = undefined;
    }

    // Initialize new entry
    if (!entry) {
      this.rateLimitMap.set(key, {
        count: 1,
        resetTime: now + windowMs,
        queue: [],
      });
      return;
    }

    // Handle rate limit
    if (entry.count >= limit) {
      const retryAfter = entry.resetTime - now;
      
      // If close to reset, wait for it
      if (retryAfter < 2000) { // Increased from 1000
        await new Promise(resolve => setTimeout(resolve, retryAfter));
        return this.attempt(key, limit, windowMs);
      }

      throw new RateLimitError(
        `Rate limit exceeded. Try again in ${Math.ceil(retryAfter / 1000)}s`,
        retryAfter
      );
    }

    entry.count++;
  }

  destroy() {
    clearInterval(this.cleanupInterval);
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();

// Export convenience method
export async function rateLimit(
  key: string,
  options: RateLimitOptions
): Promise<void> {
  return rateLimiter.rateLimit(key, options);
}
