import { NextRequest, NextResponse } from 'next/server';
import { AdvancedRateLimiter } from '../rate-limiter';
import { getClientIP, generateClientFingerprint } from '../utils/client-ip';

export interface RateLimitOptions {
  limiter: AdvancedRateLimiter;
  keyGenerator?: (request: NextRequest) => string;
  onRateLimit?: (request: NextRequest, result: any) => NextResponse;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export function withRateLimit(options: RateLimitOptions) {
  return async function rateLimitMiddleware(
    request: NextRequest,
    handler: (request: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> {
    const { limiter, keyGenerator, onRateLimit, skipSuccessfulRequests, skipFailedRequests } = options;

    // Generate identifier for rate limiting
    const identifier = keyGenerator ? keyGenerator(request) : getClientIP(request);

    // Check rate limit
    const result = await limiter.checkLimit(identifier);

    if (!result.allowed) {
      // Handle rate limit exceeded
      if (onRateLimit) {
        return onRateLimit(request, result);
      }

      // Default rate limit response
      const headers: Record<string, string> = {
        'X-RateLimit-Limit': limiter.config.maxRequests.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
        'Content-Type': 'application/json'
      };

      if (result.retryAfter) {
        headers['Retry-After'] = result.retryAfter.toString();
      }

      if (result.burstRemaining !== undefined) {
        headers['X-RateLimit-Burst-Remaining'] = result.burstRemaining.toString();
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: result.retryAfter,
          remaining: result.remaining
        },
        {
          status: 429,
          headers
        }
      );
    }

    // Execute the handler
    const response = await handler(request);

    // Add rate limit headers to successful responses
    response.headers.set('X-RateLimit-Limit', limiter.config.maxRequests.toString());
    response.headers.set('X-RateLimit-Remaining', (result.remaining - 1).toString());
    response.headers.set('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

    if (result.burstRemaining !== undefined) {
      response.headers.set('X-RateLimit-Burst-Remaining', (result.burstRemaining - 1).toString());
    }

    return response;
  };
}

// Predefined middleware functions for common use cases
export const withGeneralRateLimit = (limiter: AdvancedRateLimiter) =>
  withRateLimit({
    limiter,
    keyGenerator: (request) => getClientIP(request)
  });

export const withStrictRateLimit = (limiter: AdvancedRateLimiter) =>
  withRateLimit({
    limiter,
    keyGenerator: (request) => generateClientFingerprint(request)
  });

export const withUserBasedRateLimit = (limiter: AdvancedRateLimiter, getUserId: (request: NextRequest) => string) =>
  withRateLimit({
    limiter,
    keyGenerator: (request) => {
      const userId = getUserId(request);
      return userId || getClientIP(request);
    }
  });

// Helper to create custom rate limit responses
export function createRateLimitResponse(
  message: string = 'Rate limit exceeded',
  retryAfter?: number,
  additionalData?: Record<string, any>
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (retryAfter) {
    headers['Retry-After'] = retryAfter.toString();
  }

  return NextResponse.json(
    {
      success: false,
      error: message,
      retryAfter,
      ...additionalData
    },
    {
      status: 429,
      headers
    }
  );
}

// Rate limit by wallet address for authenticated operations
export function withWalletRateLimit(
  limiter: AdvancedRateLimiter,
  getWalletAddress: (request: NextRequest) => string | null
) {
  return withRateLimit({
    limiter,
    keyGenerator: (request) => {
      const wallet = getWalletAddress(request);
      if (wallet) {
        return `wallet:${wallet}`;
      }
      // Fallback to IP-based limiting for unauthenticated requests
      return `ip:${getClientIP(request)}`;
    },
    onRateLimit: (request, result) => {
      const wallet = getWalletAddress(request);
      const message = wallet 
        ? `Rate limit exceeded for wallet ${wallet.slice(0, 8)}...`
        : 'Rate limit exceeded. Please connect your wallet for higher limits.';
      
      return createRateLimitResponse(message, result.retryAfter, {
        wallet: wallet ? `${wallet.slice(0, 8)}...${wallet.slice(-4)}` : null
      });
    }
  });
}

// Adaptive rate limiting based on request patterns
export class AdaptiveRateLimiter {
  private suspiciousIPs = new Set<string>();
  private strictLimiter: AdvancedRateLimiter;
  private normalLimiter: AdvancedRateLimiter;

  constructor(
    normalLimiter: AdvancedRateLimiter,
    strictLimiter: AdvancedRateLimiter
  ) {
    this.normalLimiter = normalLimiter;
    this.strictLimiter = strictLimiter;
  }

  markSuspicious(identifier: string) {
    this.suspiciousIPs.add(identifier);
    // Auto-remove after 1 hour
    setTimeout(() => {
      this.suspiciousIPs.delete(identifier);
    }, 60 * 60 * 1000);
  }

  async checkLimit(identifier: string, cost: number = 1) {
    const limiter = this.suspiciousIPs.has(identifier) 
      ? this.strictLimiter 
      : this.normalLimiter;
    
    return limiter.checkLimit(identifier, cost);
  }
}

export default withRateLimit;