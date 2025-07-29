import { NextRequest } from 'next/server';

interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    keyGenerator?: (request: NextRequest) => string;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
}

interface RateLimitEntry {
    count: number;
    resetTime: number;
    requests: number[];
}

export class EnhancedRateLimiter {
    private store: Map<string, RateLimitEntry> = new Map();
    private configs: Map<string, RateLimitConfig> = new Map();

    constructor() {
        // Clean up expired entries every 5 minutes
        setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }

    /**
     * Configure rate limiting for a specific endpoint
     */
    configure(endpoint: string, config: RateLimitConfig): void {
        this.configs.set(endpoint, {
            keyGenerator: (req) => this.getClientKey(req),
            skipSuccessfulRequests: false,
            skipFailedRequests: false,
            ...config
        });
    }

    /**
     * Check if request should be rate limited
     */
    checkLimit(endpoint: string, request: NextRequest): {
        allowed: boolean;
        remaining: number;
        resetTime: number;
        retryAfter?: number;
    } {
        const config = this.configs.get(endpoint);
        if (!config) {
            return { allowed: true, remaining: Infinity, resetTime: 0 };
        }

        const key = `${endpoint}:${config.keyGenerator!(request)}`;
        const now = Date.now();
        const windowStart = now - config.windowMs;

        let entry = this.store.get(key);
        if (!entry) {
            entry = { count: 0, resetTime: now + config.windowMs, requests: [] };
            this.store.set(key, entry);
        }

        // Remove old requests outside the window
        entry.requests = entry.requests.filter(time => time > windowStart);
        entry.count = entry.requests.length;

        // Update reset time if needed
        if (now >= entry.resetTime) {
            entry.resetTime = now + config.windowMs;
        }

        const allowed = entry.count < config.maxRequests;
        const remaining = Math.max(0, config.maxRequests - entry.count);

        if (allowed) {
            entry.requests.push(now);
            entry.count++;
        }

        return {
            allowed,
            remaining: allowed ? remaining - 1 : remaining,
            resetTime: entry.resetTime,
            retryAfter: allowed ? undefined : Math.ceil((entry.resetTime - now) / 1000)
        };
    }

    /**
     * Get client identifier for rate limiting
     */
    private getClientKey(request: NextRequest): string {
        // Try to get user ID from Authorization header
        const authHeader = request.headers.get('Authorization');
        if (authHeader) {
            // For JWT, we could decode to get user ID, but for now use the token itself
            return `auth:${authHeader.substring(0, 20)}...`;
        }

        // Fallback to IP address
        const forwarded = request.headers.get('x-forwarded-for');
        const ip = forwarded ? forwarded.split(',')[0] :
            request.headers.get('x-real-ip') ||
            'unknown';

        return `ip:${ip}`;
    }

    /**
     * Clean up expired entries
     */
    private cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.store.entries()) {
            if (now >= entry.resetTime && entry.requests.length === 0) {
                this.store.delete(key);
            }
        }
    }

    /**
     * Get current statistics
     */
    getStats(): {
        totalKeys: number;
        endpoints: string[];
        memoryUsage: number;
    } {
        return {
            totalKeys: this.store.size,
            endpoints: Array.from(this.configs.keys()),
            memoryUsage: JSON.stringify(Array.from(this.store.entries())).length
        };
    }

    /**
     * Reset limits for a specific key
     */
    reset(endpoint: string, request: NextRequest): void {
        const config = this.configs.get(endpoint);
        if (!config) return;

        const key = `${endpoint}:${config.keyGenerator!(request)}`;
        this.store.delete(key);
    }

    /**
     * Reset all limits
     */
    resetAll(): void {
        this.store.clear();
    }
}

// Global rate limiter instance
export const globalRateLimiter = new EnhancedRateLimiter();

// Pre-configure common endpoints
globalRateLimiter.configure('/api/opensvm/anthropic-keys', {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 key operations per minute
});

globalRateLimiter.configure('/api/v1/messages', {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
});

globalRateLimiter.configure('/api/v1/models', {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 requests per minute (since it's cached)
});

globalRateLimiter.configure('/api/opensvm/balance', {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 balance checks per minute
});

globalRateLimiter.configure('/api/opensvm/usage', {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 usage queries per minute
}); 