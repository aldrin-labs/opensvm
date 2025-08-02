import { ProxyConfig } from '../config/ProxyConfig';

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetTime: Date;
    retryAfter?: number;
    limit: number;
    windowStart: Date;
}

export interface RateLimitKey {
    type: 'global' | 'user' | 'apiKey' | 'ip';
    identifier: string;
    window: 'minute' | 'hour' | 'day';
}

export interface RateLimitEntry {
    count: number;
    windowStart: number;
    lastRequest: number;
}

/**
 * In-memory rate limiter with sliding window algorithm
 */
export class RateLimiter {
    private static instance: RateLimiter;
    private storage: Map<string, RateLimitEntry> = new Map();
    private config: ProxyConfig['rateLimiting'];
    private cleanupInterval: NodeJS.Timeout;

    constructor(config: ProxyConfig['rateLimiting']) {
        this.config = config;

        // Clean up expired entries every 5 minutes
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 5 * 60 * 1000);
    }

    static getInstance(config: ProxyConfig['rateLimiting']): RateLimiter {
        if (!RateLimiter.instance) {
            RateLimiter.instance = new RateLimiter(config);
        }
        return RateLimiter.instance;
    }

    /**
     * Check if request is allowed under rate limits
     */
    async checkRateLimit(
        type: RateLimitKey['type'],
        identifier: string,
        window: RateLimitKey['window']
    ): Promise<RateLimitResult> {
        if (!this.config.enabled) {
            return {
                allowed: true,
                remaining: Infinity,
                resetTime: new Date(Date.now() + this.getWindowDuration(window)),
                limit: Infinity,
                windowStart: new Date()
            };
        }

        const limit = this.getLimit(type, window);
        const windowDuration = this.getWindowDuration(window);
        const now = Date.now();
        const windowStart = Math.floor(now / windowDuration) * windowDuration;

        const key = this.createKey(type, identifier, window);
        const entry = this.storage.get(key) || {
            count: 0,
            windowStart,
            lastRequest: 0
        };

        // Reset counter if we're in a new window
        if (entry.windowStart !== windowStart) {
            entry.count = 0;
            entry.windowStart = windowStart;
        }

        const remaining = Math.max(0, limit - entry.count);
        const allowed = entry.count < limit;
        const resetTime = new Date(windowStart + windowDuration);

        if (allowed) {
            entry.count++;
            entry.lastRequest = now;
            this.storage.set(key, entry);
        }

        return {
            allowed,
            remaining: allowed ? remaining - 1 : remaining,
            resetTime,
            retryAfter: allowed ? undefined : Math.ceil((resetTime.getTime() - now) / 1000),
            limit,
            windowStart: new Date(windowStart)
        };
    }

    /**
     * Check multiple rate limits at once
     */
    async checkMultipleRateLimits(checks: Array<{
        type: RateLimitKey['type'];
        identifier: string;
        windows: RateLimitKey['window'][];
    }>): Promise<{
        allowed: boolean;
        results: RateLimitResult[];
        mostRestrictive?: RateLimitResult;
    }> {
        const results: RateLimitResult[] = [];
        let mostRestrictive: RateLimitResult | undefined;

        for (const check of checks) {
            for (const window of check.windows) {
                const result = await this.checkRateLimit(check.type, check.identifier, window);
                results.push(result);

                if (!result.allowed || (mostRestrictive && result.remaining < mostRestrictive.remaining)) {
                    mostRestrictive = result;
                }
            }
        }

        const allowed = results.every(r => r.allowed);

        return {
            allowed,
            results,
            mostRestrictive: !allowed ? mostRestrictive : undefined
        };
    }

    /**
     * Get current usage for a rate limit key
     */
    async getCurrentUsage(
        type: RateLimitKey['type'],
        identifier: string,
        window: RateLimitKey['window']
    ): Promise<{
        count: number;
        limit: number;
        remaining: number;
        resetTime: Date;
        windowStart: Date;
    }> {
        const limit = this.getLimit(type, window);
        const windowDuration = this.getWindowDuration(window);
        const now = Date.now();
        const windowStart = Math.floor(now / windowDuration) * windowDuration;

        const key = this.createKey(type, identifier, window);
        const entry = this.storage.get(key) || {
            count: 0,
            windowStart,
            lastRequest: 0
        };

        // Reset if new window
        const currentCount = entry.windowStart === windowStart ? entry.count : 0;
        const remaining = Math.max(0, limit - currentCount);

        return {
            count: currentCount,
            limit,
            remaining,
            resetTime: new Date(windowStart + windowDuration),
            windowStart: new Date(windowStart)
        };
    }

    /**
     * Reset rate limit for a specific key
     */
    async resetRateLimit(
        type: RateLimitKey['type'],
        identifier: string,
        window?: RateLimitKey['window']
    ): Promise<void> {
        if (window) {
            const key = this.createKey(type, identifier, window);
            this.storage.delete(key);
        } else {
            // Reset all windows for this type/identifier
            const windows: RateLimitKey['window'][] = ['minute', 'hour', 'day'];
            for (const w of windows) {
                const key = this.createKey(type, identifier, w);
                this.storage.delete(key);
            }
        }
    }

    /**
     * Get rate limit statistics
     */
    async getStats(): Promise<{
        totalKeys: number;
        activeKeys: number;
        topConsumers: Array<{
            key: string;
            count: number;
            lastRequest: Date;
        }>;
        memoryUsage: {
            entries: number;
            estimatedBytes: number;
        };
    }> {
        const now = Date.now();
        const activeThreshold = 60 * 1000; // 1 minute
        let activeKeys = 0;

        const consumers = Array.from(this.storage.entries())
            .map(([key, entry]) => {
                if (now - entry.lastRequest < activeThreshold) {
                    activeKeys++;
                }
                return {
                    key,
                    count: entry.count,
                    lastRequest: new Date(entry.lastRequest)
                };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        return {
            totalKeys: this.storage.size,
            activeKeys,
            topConsumers: consumers,
            memoryUsage: {
                entries: this.storage.size,
                estimatedBytes: this.storage.size * 100 // Rough estimate
            }
        };
    }

    /**
     * Update rate limit configuration
     */
    updateConfig(config: ProxyConfig['rateLimiting']): void {
        this.config = config;
    }

    /**
     * Cleanup expired entries
     */
    private cleanup(): void {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        for (const [key, entry] of this.storage.entries()) {
            if (now - entry.lastRequest > maxAge) {
                this.storage.delete(key);
            }
        }
    }

    /**
     * Create storage key for rate limit entry
     */
    private createKey(
        type: RateLimitKey['type'],
        identifier: string,
        window: RateLimitKey['window']
    ): string {
        return `${type}:${identifier}:${window}`;
    }

    /**
     * Get rate limit for specific type and window
     */
    private getLimit(type: RateLimitKey['type'], window: RateLimitKey['window']): number {
        switch (type) {
            case 'global':
                switch (window) {
                    case 'minute': return this.config.global.requestsPerMinute;
                    case 'hour': return this.config.global.requestsPerHour;
                    case 'day': return this.config.global.requestsPerDay;
                }
                break;
            case 'user':
                switch (window) {
                    case 'minute': return this.config.perUser.requestsPerMinute;
                    case 'hour': return this.config.perUser.requestsPerHour;
                    case 'day': return this.config.perUser.requestsPerDay;
                }
                break;
            case 'apiKey':
                switch (window) {
                    case 'minute': return this.config.perApiKey.requestsPerMinute;
                    case 'hour': return this.config.perApiKey.requestsPerHour;
                    case 'day': return this.config.perApiKey.requestsPerDay;
                }
                break;
            case 'ip':
                // Use user limits for IP-based limiting
                switch (window) {
                    case 'minute': return this.config.perUser.requestsPerMinute;
                    case 'hour': return this.config.perUser.requestsPerHour;
                    case 'day': return this.config.perUser.requestsPerDay;
                }
                break;
        }
        return Infinity;
    }

    /**
     * Get window duration in milliseconds
     */
    private getWindowDuration(window: RateLimitKey['window']): number {
        switch (window) {
            case 'minute': return 60 * 1000;
            case 'hour': return 60 * 60 * 1000;
            case 'day': return 24 * 60 * 60 * 1000;
        }
    }

    /**
     * Shutdown rate limiter
     */
    shutdown(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.storage.clear();
    }
}

/**
 * Rate limiting middleware for Next.js API routes
 */
export async function rateLimitMiddleware(
    request: Request,
    rateLimiter: RateLimiter,
    context: {
        userId?: string;
        apiKeyId?: string;
        ipAddress?: string;
    }
): Promise<{
    allowed: boolean;
    response?: Response;
    headers?: Record<string, string>;
}> {
    // Use request for enhanced rate limiting analysis
    const requestInfo = {
        method: request.method,
        url: request.url,
        userAgent: request.headers.get('user-agent') || 'unknown',
        contentLength: request.headers.get('content-length') || '0'
    };
    console.log(`Rate limiting analysis for ${requestInfo.method} ${requestInfo.url}`);

    const checks: Array<{
        type: RateLimitKey['type'];
        identifier: string;
        windows: RateLimitKey['window'][];
    }> = [];

    // Global rate limiting
    checks.push({
        type: 'global',
        identifier: 'global',
        windows: ['minute', 'hour', 'day']
    });

    // User-specific rate limiting
    if (context.userId) {
        checks.push({
            type: 'user',
            identifier: context.userId,
            windows: ['minute', 'hour', 'day']
        });
    }

    // API key-specific rate limiting
    if (context.apiKeyId) {
        checks.push({
            type: 'apiKey',
            identifier: context.apiKeyId,
            windows: ['minute', 'hour', 'day']
        });
    }

    // IP-based rate limiting (fallback)
    if (context.ipAddress && !context.userId) {
        checks.push({
            type: 'ip',
            identifier: context.ipAddress,
            windows: ['minute', 'hour']
        });
    }

    const result = await rateLimiter.checkMultipleRateLimits(checks);

    if (!result.allowed && result.mostRestrictive) {
        const headers: Record<string, string> = {
            'X-RateLimit-Limit': result.mostRestrictive.limit.toString(),
            'X-RateLimit-Remaining': result.mostRestrictive.remaining.toString(),
            'X-RateLimit-Reset': Math.ceil(result.mostRestrictive.resetTime.getTime() / 1000).toString(),
        };

        if (result.mostRestrictive.retryAfter) {
            headers['Retry-After'] = result.mostRestrictive.retryAfter.toString();
        }

        const errorResponse = {
            type: 'error',
            error: {
                type: 'rate_limit_error',
                message: 'Rate limit exceeded. Please wait before making more requests.'
            }
        };

        return {
            allowed: false,
            response: new Response(JSON.stringify(errorResponse), {
                status: 429,
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                }
            }),
            headers
        };
    }

    // Add rate limit headers to successful responses
    const headers: Record<string, string> = {};
    if (result.results.length > 0) {
        const mostRestrictive = result.results.reduce((min, curr) =>
            curr.remaining < min.remaining ? curr : min
        );

        headers['X-RateLimit-Limit'] = mostRestrictive.limit.toString();
        headers['X-RateLimit-Remaining'] = mostRestrictive.remaining.toString();
        headers['X-RateLimit-Reset'] = Math.ceil(mostRestrictive.resetTime.getTime() / 1000).toString();
    }

    return {
        allowed: true,
        headers
    };
}

/**
 * Create rate limiter instance from config
 */
export function createRateLimiter(config: ProxyConfig): RateLimiter {
    return RateLimiter.getInstance(config.rateLimiting);
} 