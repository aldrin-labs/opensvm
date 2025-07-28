import { ProxyConfig } from '../config/ProxyConfig';

export interface SecurityContext {
    userId?: string;
    apiKeyId?: string;
    ipAddress: string;
    userAgent?: string;
    origin?: string;
    requestSize: number;
}

export interface SecurityResult {
    allowed: boolean;
    response?: Response;
    headers?: Record<string, string>;
    reason?: string;
}

/**
 * Security middleware for API protection
 */
export class SecurityMiddleware {
    private config: ProxyConfig['security'];

    constructor(config: ProxyConfig['security']) {
        this.config = config;
    }

    /**
     * Apply all security checks
     */
    async applySecurity(
        request: Request,
        context: SecurityContext
    ): Promise<SecurityResult> {
        // Check CORS
        const corsResult = this.checkCORS(request, context);
        if (!corsResult.allowed) {
            return corsResult;
        }

        // Check IP whitelist
        const ipResult = this.checkIPWhitelist(context);
        if (!ipResult.allowed) {
            return ipResult;
        }

        // Check request size
        const sizeResult = this.checkRequestSize(context);
        if (!sizeResult.allowed) {
            return sizeResult;
        }

        // Check for malicious patterns
        const maliciousResult = await this.checkMaliciousPatterns(request, context);
        if (!maliciousResult.allowed) {
            return maliciousResult;
        }

        return {
            allowed: true,
            headers: corsResult.headers
        };
    }

    /**
     * Handle CORS preflight requests
     */
    handleCORSPreflight(request: Request, context: SecurityContext): Response | null {
        if (request.method !== 'OPTIONS') {
            return null;
        }

        if (!this.config.cors.enabled) {
            return new Response(null, { status: 204 });
        }

        const origin = context.origin || request.headers.get('origin');
        const allowedOrigin = this.isOriginAllowed(origin);

        const headers: Record<string, string> = {
            'Access-Control-Allow-Methods': this.config.cors.methods.join(', '),
            'Access-Control-Allow-Headers': this.config.cors.headers.join(', '),
            'Access-Control-Max-Age': '86400', // 24 hours
        };

        if (allowedOrigin) {
            headers['Access-Control-Allow-Origin'] = origin || '*';
            headers['Access-Control-Allow-Credentials'] = 'true';
        }

        return new Response(null, {
            status: 204,
            headers
        });
    }

    /**
     * Validate API key format
     */
    validateAPIKeyFormat(apiKey: string): {
        valid: boolean;
        reason?: string;
    } {
        if (!this.config.apiKeyValidation.strictFormat) {
            return { valid: true };
        }

        // Check prefix
        if (!apiKey.startsWith(this.config.apiKeyValidation.requirePrefix)) {
            return {
                valid: false,
                reason: `API key must start with ${this.config.apiKeyValidation.requirePrefix}`
            };
        }

        // Check length
        if (apiKey.length < this.config.apiKeyValidation.minLength) {
            return {
                valid: false,
                reason: `API key too short (minimum ${this.config.apiKeyValidation.minLength} characters)`
            };
        }

        if (apiKey.length > this.config.apiKeyValidation.maxLength) {
            return {
                valid: false,
                reason: `API key too long (maximum ${this.config.apiKeyValidation.maxLength} characters)`
            };
        }

        // Check format (base64-like characters after prefix)
        const keyPart = apiKey.substring(this.config.apiKeyValidation.requirePrefix.length);
        if (!/^[A-Za-z0-9+/=]+$/.test(keyPart)) {
            return {
                valid: false,
                reason: 'API key contains invalid characters'
            };
        }

        return { valid: true };
    }

    /**
     * Sanitize request body to prevent injection attacks
     */
    sanitizeRequestBody(body: any): any {
        if (typeof body === 'string') {
            return this.sanitizeString(body);
        }

        if (Array.isArray(body)) {
            return body.map(item => this.sanitizeRequestBody(item));
        }

        if (body && typeof body === 'object') {
            const sanitized: any = {};
            for (const [key, value] of Object.entries(body)) {
                sanitized[this.sanitizeString(key)] = this.sanitizeRequestBody(value);
            }
            return sanitized;
        }

        return body;
    }

    /**
     * Check CORS policy
     */
    private checkCORS(request: Request, context: SecurityContext): SecurityResult {
        if (!this.config.cors.enabled) {
            return { allowed: true };
        }

        const origin = context.origin || request.headers.get('origin');
        const method = request.method;

        // Check if method is allowed
        if (!this.config.cors.methods.includes(method)) {
            return {
                allowed: false,
                response: new Response('Method not allowed', {
                    status: 405,
                    headers: {
                        'Content-Type': 'text/plain'
                    }
                }),
                reason: `Method ${method} not allowed`
            };
        }

        // Check if origin is allowed
        if (origin && !this.isOriginAllowed(origin)) {
            return {
                allowed: false,
                response: new Response('Origin not allowed', {
                    status: 403,
                    headers: {
                        'Content-Type': 'text/plain'
                    }
                }),
                reason: `Origin ${origin} not allowed`
            };
        }

        // Set CORS headers
        const headers: Record<string, string> = {};
        if (origin && this.isOriginAllowed(origin)) {
            headers['Access-Control-Allow-Origin'] = origin;
            headers['Access-Control-Allow-Credentials'] = 'true';
        } else if (this.config.cors.origins.includes('*')) {
            headers['Access-Control-Allow-Origin'] = '*';
        }

        return {
            allowed: true,
            headers
        };
    }

    /**
     * Check IP whitelist
     */
    private checkIPWhitelist(context: SecurityContext): SecurityResult {
        if (!this.config.ipWhitelist || this.config.ipWhitelist.length === 0) {
            return { allowed: true };
        }

        const isAllowed = this.config.ipWhitelist.some(allowedIP => {
            if (allowedIP.includes('/')) {
                // CIDR notation
                return this.isIPInCIDR(context.ipAddress, allowedIP);
            } else {
                // Exact match
                return context.ipAddress === allowedIP;
            }
        });

        if (!isAllowed) {
            return {
                allowed: false,
                response: new Response(JSON.stringify({
                    type: 'error',
                    error: {
                        type: 'permission_error',
                        message: 'Access denied from this IP address'
                    }
                }), {
                    status: 403,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }),
                reason: `IP ${context.ipAddress} not in whitelist`
            };
        }

        return { allowed: true };
    }

    /**
     * Check request size limits
     */
    private checkRequestSize(context: SecurityContext): SecurityResult {
        if (context.requestSize > this.config.maxRequestSize) {
            return {
                allowed: false,
                response: new Response(JSON.stringify({
                    type: 'error',
                    error: {
                        type: 'invalid_request_error',
                        message: `Request too large. Maximum size is ${this.config.maxRequestSize} bytes`
                    }
                }), {
                    status: 413,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }),
                reason: `Request size ${context.requestSize} exceeds limit ${this.config.maxRequestSize}`
            };
        }

        return { allowed: true };
    }

    /**
     * Check for malicious patterns in requests
     */
    private async checkMaliciousPatterns(
        request: Request,
        context: SecurityContext
    ): Promise<SecurityResult> {
        const suspiciousPatterns = [
            // SQL injection patterns
            /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bDELETE\b|\bDROP\b)/i,
            // XSS patterns
            /<script[^>]*>.*?<\/script>/gi,
            /javascript:/gi,
            /on\w+\s*=/gi,
            // Path traversal
            /\.\.\//g,
            /\.\.\\/g,
            // Command injection
            /;\s*(rm|cat|ls|pwd|whoami|id|uname)/gi,
        ];

        const userAgent = context.userAgent || '';
        const url = request.url;

        // Check URL and user agent for suspicious patterns
        const textToCheck = `${url} ${userAgent}`;

        for (const pattern of suspiciousPatterns) {
            if (pattern.test(textToCheck)) {
                return {
                    allowed: false,
                    response: new Response(JSON.stringify({
                        type: 'error',
                        error: {
                            type: 'invalid_request_error',
                            message: 'Request contains potentially malicious content'
                        }
                    }), {
                        status: 400,
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }),
                    reason: 'Malicious pattern detected'
                };
            }
        }

        // Check for suspicious user agents
        const suspiciousUserAgents = [
            /curl/i,
            /wget/i,
            /python-requests/i,
            /bot/i,
            /crawler/i,
            /spider/i,
        ];

        // Allow if no user agent restrictions or if it's a legitimate browser/SDK
        const isSuspiciousUserAgent = suspiciousUserAgents.some(pattern =>
            pattern.test(userAgent)
        );

        if (isSuspiciousUserAgent && !this.isWhitelistedUserAgent(userAgent)) {
            // Log but don't block - just monitor
            console.warn(`Suspicious user agent detected: ${userAgent} from IP ${context.ipAddress}`);
        }

        return { allowed: true };
    }

    /**
     * Check if origin is allowed
     */
    private isOriginAllowed(origin: string | null): boolean {
        if (!origin) return true; // Allow requests without origin (like from Postman)

        if (this.config.cors.origins.includes('*')) {
            return true;
        }

        return this.config.cors.origins.some(allowedOrigin => {
            if (allowedOrigin.startsWith('*.')) {
                // Wildcard subdomain matching
                const domain = allowedOrigin.substring(2);
                return origin.endsWith(domain);
            }
            return origin === allowedOrigin;
        });
    }

    /**
     * Check if IP is in CIDR range
     */
    private isIPInCIDR(ip: string, cidr: string): boolean {
        // Simple CIDR check - in production, use a proper library like 'ip-range-check'
        const [network, prefixLength] = cidr.split('/');
        const prefixLen = parseInt(prefixLength, 10);

        if (prefixLen === 32) {
            return ip === network;
        }

        // For simplicity, just do basic subnet matching
        // In production, implement proper CIDR matching
        const ipParts = ip.split('.').map(Number);
        const networkParts = network.split('.').map(Number);

        const bytes = Math.floor(prefixLen / 8);
        const remainingBits = prefixLen % 8;

        // Check full bytes
        for (let i = 0; i < bytes; i++) {
            if (ipParts[i] !== networkParts[i]) {
                return false;
            }
        }

        // Check remaining bits
        if (remainingBits > 0 && bytes < 4) {
            const mask = 0xFF << (8 - remainingBits);
            if ((ipParts[bytes] & mask) !== (networkParts[bytes] & mask)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Check if user agent is whitelisted
     */
    private isWhitelistedUserAgent(userAgent: string): boolean {
        const whitelistedPatterns = [
            /anthropic/i,
            /claude/i,
            /openai/i,
            /postman/i,
            /insomnia/i,
        ];

        return whitelistedPatterns.some(pattern => pattern.test(userAgent));
    }

    /**
     * Sanitize string to prevent injection
     */
    private sanitizeString(str: string): string {
        if (typeof str !== 'string') return str;

        return str
            .replace(/[<>]/g, '') // Remove potential HTML tags
            .replace(/javascript:/gi, '') // Remove javascript: URLs
            .replace(/on\w+\s*=/gi, '') // Remove event handlers
            .trim();
    }

    /**
     * Generate security headers for responses
     */
    getSecurityHeaders(): Record<string, string> {
        return {
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none';",
        };
    }

    /**
     * Update security configuration
     */
    updateConfig(config: ProxyConfig['security']): void {
        this.config = config;
    }
}

/**
 * Create security middleware instance
 */
export function createSecurityMiddleware(config: ProxyConfig): SecurityMiddleware {
    return new SecurityMiddleware(config.security);
}

/**
 * Extract security context from request
 */
export function extractSecurityContext(request: Request): SecurityContext {
    const contentLength = request.headers.get('content-length');
    const requestSize = contentLength ? parseInt(contentLength, 10) : 0;

    return {
        ipAddress: getClientIP(request),
        userAgent: request.headers.get('user-agent') || undefined,
        origin: request.headers.get('origin') || undefined,
        requestSize
    };
}

/**
 * Extract client IP address from request
 */
function getClientIP(request: Request): string {
    // Check various headers for client IP
    const headers = [
        'x-forwarded-for',
        'x-real-ip',
        'x-client-ip',
        'cf-connecting-ip', // Cloudflare
        'x-forwarded',
        'forwarded-for',
        'forwarded'
    ];

    for (const header of headers) {
        const value = request.headers.get(header);
        if (value) {
            // Take the first IP if there are multiple
            const ip = value.split(',')[0].trim();
            if (ip && ip !== 'unknown') {
                return ip;
            }
        }
    }

    return '127.0.0.1'; // Fallback
} 