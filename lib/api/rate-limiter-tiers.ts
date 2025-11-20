/**
 * Tiered Rate Limiting System
 * Different rate limits for different endpoint categories
 */

import { Redis } from 'ioredis';
import { getRedisClient } from '../caching/cache';
import { NextRequest } from 'next/server';

export interface RateLimitTier {
  name: string;
  maxRequests: number;
  windowMs: number;
  burstLimit?: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

// Define rate limit tiers for different endpoint categories
export const RATE_LIMIT_TIERS: Record<string, RateLimitTier> = {
  // Public endpoints - more permissive
  public: {
    name: 'public',
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
    burstLimit: 150
  },
  
  // Search endpoints - moderate limits
  search: {
    name: 'search',
    maxRequests: 60,
    windowMs: 60 * 1000,
    burstLimit: 80
  },
  
  // Analytics endpoints - lower limits due to computational cost
  analytics: {
    name: 'analytics',
    maxRequests: 30,
    windowMs: 60 * 1000,
    burstLimit: 40
  },
  
  // AI endpoints - strict limits and longer window
  ai: {
    name: 'ai',
    maxRequests: 10,
    windowMs: 5 * 60 * 1000, // 5 minutes
    burstLimit: 15
  },
  
  // Real-time/streaming endpoints - special handling
  realtime: {
    name: 'realtime',
    maxRequests: 5, // Connections, not requests
    windowMs: 60 * 1000,
    burstLimit: 10
  },
  
  // Admin/User service endpoints - requires auth
  admin: {
    name: 'admin',
    maxRequests: 50,
    windowMs: 60 * 1000,
    burstLimit: 75,
    skipSuccessfulRequests: true // Don't count successful authenticated requests
  },
  
  // Health check endpoints - exempt from rate limiting
  health: {
    name: 'health',
    maxRequests: 1000,
    windowMs: 60 * 1000,
    burstLimit: 1500
  }
};

// Map endpoints to their tiers
export const ENDPOINT_TIERS: Record<string, string> = {
  // Search & Discovery
  '/api/universal-search': 'search',
  '/api/search-accounts': 'search',
  '/api/search': 'search',
  '/api/program-registry': 'public',
  '/api/program-info': 'public',
  
  // Account & Wallet
  '/api/account-stats': 'public',
  '/api/account-transactions': 'public',
  '/api/account-token-stats': 'public',
  '/api/check-account-type': 'public',
  '/api/account-balance': 'public',
  '/api/account-info': 'public',
  
  // Transactions
  '/api/transaction': 'public',
  '/api/batch-transactions': 'public',
  '/api/filter-transactions': 'public',
  '/api/analyze-transaction': 'analytics',
  '/api/explain-transaction': 'analytics',
  
  // Blockchain
  '/api/block': 'public',
  '/api/blocks': 'public',
  '/api/blocks/stats': 'analytics',
  '/api/slots': 'public',
  '/api/epoch': 'public',
  '/api/supply': 'public',
  
  // Tokens & NFTs
  '/api/token-info': 'public',
  '/api/token-metadata': 'public',
  '/api/nft-collections': 'public',
  '/api/trending-nfts': 'analytics',
  
  // Analytics
  '/api/analytics/defi-overview': 'analytics',
  '/api/analytics/dex': 'analytics',
  '/api/analytics/defi-health': 'analytics',
  '/api/analytics/validators': 'analytics',
  '/api/analytics/trending-validators': 'analytics',
  '/api/analytics/network': 'analytics',
  '/api/analytics/ecosystem': 'analytics',
  
  // AI-Powered
  '/api/getAnswer': 'ai',
  '/api/chat': 'ai',
  '/api/ai-analyze': 'ai',
  '/api/ai-predict': 'ai',
  '/api/ai-classify': 'ai',
  '/api/ai-summarize': 'ai',
  
  // Real-Time
  '/api/stream/transactions': 'realtime',
  '/api/stream/blocks': 'realtime',
  '/api/websocket-info': 'realtime',
  '/api/feed/latest': 'realtime',
  '/api/notifications': 'realtime',
  '/api/alerts': 'realtime',
  '/api/live-stats': 'realtime',
  '/api/mempool': 'realtime',
  
  // User Services (Admin)
  '/api/usage-stats': 'admin',
  '/api/api-keys': 'admin',
  '/api/metrics': 'admin',
  '/api/error-report': 'admin',
  '/api/health': 'health',
  '/api/status': 'health',
  '/api/version': 'admin',
  '/api/config': 'admin',
  '/api/docs/openapi': 'public'
};

/**
 * Get client identifier (IP or API key)
 */
export function getClientIdentifier(req: NextRequest): string {
  // Check for API key first
  const apiKey = req.headers.get('x-api-key');
  if (apiKey) {
    return `key:${apiKey}`;
  }
  
  // Fall back to IP address
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 
             req.headers.get('x-real-ip') || 
             'unknown';
  
  return `ip:${ip}`;
}

/**
 * Check if request should skip rate limiting
 */
export function shouldSkipRateLimit(req: NextRequest): boolean {
  // Skip for internal requests
  const host = req.headers.get('host');
  if (host?.includes('localhost') || host?.includes('127.0.0.1')) {
    const userAgent = req.headers.get('user-agent');
    if (userAgent?.includes('Next.js') || userAgent?.includes('node-fetch')) {
      return true;
    }
  }
  
  // Skip for health checks from monitoring services
  const path = req.nextUrl.pathname;
  if (path === '/api/health' || path === '/api/status') {
    const userAgent = req.headers.get('user-agent');
    if (userAgent?.includes('UptimeRobot') || 
        userAgent?.includes('Pingdom') ||
        userAgent?.includes('StatusCake')) {
      return true;
    }
  }
  
  return false;
}

/**
 * Enhanced rate limiter with tiers
 */
export class TieredRateLimiter {
  private redis: Redis | null;
  
  constructor() {
    this.redis = getRedisClient();
  }
  
  /**
   * Check rate limit for a request
   */
  async checkLimit(
    req: NextRequest,
    tierOverride?: string
  ): Promise<{
    allowed: boolean;
    limit: number;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
  }> {
    // Skip rate limiting for certain requests
    if (shouldSkipRateLimit(req)) {
      return {
        allowed: true,
        limit: 9999,
        remaining: 9999,
        resetTime: Date.now() + 60000
      };
    }
    
    const path = req.nextUrl.pathname;
    const tierName = tierOverride || this.getTierForEndpoint(path);
    const tier = RATE_LIMIT_TIERS[tierName] || RATE_LIMIT_TIERS.public;
    
    const clientId = getClientIdentifier(req);
    const key = `ratelimit:${tierName}:${clientId}`;
    
    if (!this.redis) {
      // If Redis is not available, allow the request but log warning
      console.warn('Rate limiting unavailable - Redis not connected');
      return {
        allowed: true,
        limit: tier.maxRequests,
        remaining: tier.maxRequests,
        resetTime: Date.now() + tier.windowMs
      };
    }
    
    try {
      const now = Date.now();
      const window = Math.floor(now / tier.windowMs);
      const resetTime = (window + 1) * tier.windowMs;
      
      const windowKey = `${key}:${window}`;
      
      // Get current count
      const currentCount = await this.redis.get(windowKey);
      const count = currentCount ? parseInt(currentCount) : 0;
      
      // Check burst limit if configured
      if (tier.burstLimit) {
        const burstKey = `${key}:burst`;
        const burstCount = await this.redis.get(burstKey);
        const burst = burstCount ? parseInt(burstCount) : 0;
        
        if (burst >= tier.burstLimit) {
          return {
            allowed: false,
            limit: tier.maxRequests,
            remaining: 0,
            resetTime,
            retryAfter: Math.ceil((resetTime - now) / 1000)
          };
        }
      }
      
      // Check regular limit
      if (count >= tier.maxRequests) {
        return {
          allowed: false,
          limit: tier.maxRequests,
          remaining: 0,
          resetTime,
          retryAfter: Math.ceil((resetTime - now) / 1000)
        };
      }
      
      // Increment counters
      const pipeline = this.redis.pipeline();
      pipeline.incr(windowKey);
      pipeline.expire(windowKey, Math.ceil(tier.windowMs / 1000));
      
      if (tier.burstLimit) {
        const burstKey = `${key}:burst`;
        pipeline.incr(burstKey);
        pipeline.expire(burstKey, 1); // 1 second burst window
      }
      
      await pipeline.exec();
      
      return {
        allowed: true,
        limit: tier.maxRequests,
        remaining: Math.max(0, tier.maxRequests - count - 1),
        resetTime
      };
      
    } catch (error) {
      console.error('Rate limit check error:', error);
      // On error, be permissive but log
      return {
        allowed: true,
        limit: tier.maxRequests,
        remaining: tier.maxRequests,
        resetTime: Date.now() + tier.windowMs
      };
    }
  }
  
  /**
   * Get tier for an endpoint
   */
  getTierForEndpoint(path: string): string {
    // Direct match
    if (ENDPOINT_TIERS[path]) {
      return ENDPOINT_TIERS[path];
    }
    
    // Pattern matching for dynamic routes
    for (const [pattern, tier] of Object.entries(ENDPOINT_TIERS)) {
      if (pattern.includes('[') && pattern.includes(']')) {
        // Convert Next.js dynamic route pattern to regex
        const regexPattern = pattern
          .replace(/\[([^\]]+)\]/g, '([^/]+)')
          .replace(/\//g, '\\/');
        
        const regex = new RegExp(`^${regexPattern}$`);
        if (regex.test(path)) {
          return tier;
        }
      }
    }
    
    // Check path prefixes for categorization
    if (path.includes('/api/analytics/')) return 'analytics';
    if (path.includes('/api/ai-') || path.includes('/api/chat')) return 'ai';
    if (path.includes('/api/stream/') || path.includes('/api/feed/')) return 'realtime';
    if (path.includes('/api/admin/')) return 'admin';
    
    // Default to public tier
    return 'public';
  }
  
  /**
   * Reset rate limit for a client (useful for testing)
   */
  async resetLimit(clientId: string, tierName: string): Promise<void> {
    if (!this.redis) return;
    
    const key = `ratelimit:${tierName}:${clientId}`;
    const pattern = `${key}:*`;
    
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Failed to reset rate limit:', error);
    }
  }
}

// Export singleton instance
export const tieredRateLimiter = new TieredRateLimiter();
