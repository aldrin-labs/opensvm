import { ProxyConfig, getProxyConfig, resetProxyConfig } from '../../../lib/anthropic-proxy/config/ProxyConfig';
import { RateLimiter, createRateLimiter } from '../../../lib/anthropic-proxy/middleware/RateLimiter';
import { SecurityMiddleware, createSecurityMiddleware, extractSecurityContext } from '../../../lib/anthropic-proxy/middleware/SecurityMiddleware';
import { AnthropicRequest } from '../../../lib/anthropic-proxy/types/AnthropicTypes';

// Mock external dependencies
jest.mock('../../../lib/anthropic-proxy/storage/KeyStorage');
jest.mock('../../../lib/anthropic-proxy/storage/BalanceStorage');
jest.mock('../../../lib/anthropic-proxy/core/AnthropicClient');
jest.mock('../../../lib/anthropic-proxy/monitoring/ProxyMonitor');

describe('Full Proxy Flow End-to-End Tests', () => {
    let config: ProxyConfig;
    let rateLimiter: RateLimiter;
    let securityMiddleware: SecurityMiddleware;

    // Test data
    const testUserId = 'test-user-123';
    const testApiKey = 'sk-ant-api03-test-key-data-here-with-sufficient-length-for-validation';
    const testRequest: AnthropicRequest = {
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [
            {
                role: 'user',
                content: 'Hello, how are you?'
            }
        ]
    };

    beforeAll(() => {
        // Set up test environment variables
        process.env.NODE_ENV = 'test';
        process.env.OPENROUTER_API_KEYS = 'sk-or-v1-test-key-1,sk-or-v1-test-key-2';
        process.env.QDRANT_URL = 'http://localhost:6333';
        process.env.SOLANA_MULTISIG_ADDRESS = 'TestMultisigAddress123456789012345678901234';
        process.env.SVMAI_TOKEN_MINT = 'TestTokenMint123456789012345678901234567';
    });

    beforeEach(async () => {
        jest.clearAllMocks();
        resetProxyConfig();

        // Load configuration
        config = getProxyConfig();

        // Initialize middleware components
        rateLimiter = createRateLimiter(config);
        securityMiddleware = createSecurityMiddleware(config);
    });

    afterEach(() => {
        rateLimiter.shutdown();
    });

    describe('Configuration and Middleware', () => {
        it('should load configuration correctly', () => {
            expect(config).toBeDefined();
            expect(config.openRouter.apiKeys).toHaveLength(2);
            expect(config.qdrant.url).toBe('http://localhost:6333');
            expect(config.solana.multisigAddress).toBe('TestMultisigAddress123456789012345678901234');
        });

        it('should handle rate limiting correctly', async () => {
            // Test successful rate limit check
            const rateLimitResult = await rateLimiter.checkRateLimit('user', testUserId, 'minute');
            expect(rateLimitResult.allowed).toBe(true);
            expect(rateLimitResult.remaining).toBeGreaterThan(0);

            // Test rate limit exhaustion
            for (let i = 0; i < 60; i++) {
                await rateLimiter.checkRateLimit('user', testUserId, 'minute');
            }

            const exhaustedResult = await rateLimiter.checkRateLimit('user', testUserId, 'minute');
            expect(exhaustedResult.allowed).toBe(false);
            expect(exhaustedResult.retryAfter).toBeGreaterThan(0);
        });

        it('should handle security middleware correctly', async () => {
            const mockRequest = new Request('https://api.opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${testApiKey}`,
                    'Origin': 'https://app.opensvm.com'
                },
                body: JSON.stringify(testRequest)
            });

            const securityContext = extractSecurityContext(mockRequest);
            securityContext.userId = testUserId;

            const securityResult = await securityMiddleware.applySecurity(mockRequest, securityContext);
            expect(securityResult.allowed).toBe(true);
            expect(securityResult.headers).toBeDefined();
        });

        it('should validate API key format correctly', () => {
            const validKey = 'sk-ant-api03-validKeyDataWithSufficientLengthForValidationRequirementsAndMoreData123456789';
            const invalidKey = 'invalid-key';

            const validResult = securityMiddleware.validateAPIKeyFormat(validKey);
            expect(validResult.valid).toBe(true);

            const invalidResult = securityMiddleware.validateAPIKeyFormat(invalidKey);
            expect(invalidResult.valid).toBe(false);
            expect(invalidResult.reason).toBeDefined();
        });

        it('should handle CORS preflight requests', () => {
            const preflightRequest = new Request('https://api.opensvm.com/v1/messages', {
                method: 'OPTIONS',
                headers: {
                    'Origin': 'https://app.opensvm.com',
                    'Access-Control-Request-Method': 'POST'
                }
            });

            const securityContext = extractSecurityContext(preflightRequest);
            securityContext.origin = 'https://app.opensvm.com';

            const response = securityMiddleware.handleCORSPreflight(preflightRequest, securityContext);
            expect(response).toBeInstanceOf(Response);
            expect(response!.status).toBe(204);
        });
    });

    describe('Environment Configuration', () => {
        it('should validate required environment variables', () => {
            // Test with missing required env var
            const originalValue = process.env.OPENROUTER_API_KEYS;
            delete process.env.OPENROUTER_API_KEYS;

            resetProxyConfig();

            expect(() => {
                getProxyConfig();
            }).toThrow('Missing required environment variables: OPENROUTER_API_KEYS');

            // Restore env var
            process.env.OPENROUTER_API_KEYS = originalValue;
            resetProxyConfig();
        });

        it('should handle different environment configurations', () => {
            // Ensure env vars are set for this test
            const originalKeys = process.env.OPENROUTER_API_KEYS;
            const originalQdrant = process.env.QDRANT_URL;
            const originalMultisig = process.env.SOLANA_MULTISIG_ADDRESS;
            const originalMint = process.env.SVMAI_TOKEN_MINT;

            process.env.OPENROUTER_API_KEYS = 'sk-or-v1-test-key';
            process.env.QDRANT_URL = 'http://localhost:6333';
            process.env.SOLANA_MULTISIG_ADDRESS = 'TestAddress123456789012345678901234';
            process.env.SVMAI_TOKEN_MINT = 'TestMint123456789012345678901234567';

            // Test development environment
            process.env.NODE_ENV = 'development';
            resetProxyConfig();

            const devConfig = getProxyConfig();
            expect(devConfig.development).toBeDefined();

            // Test production environment
            process.env.NODE_ENV = 'production';
            resetProxyConfig();

            const prodConfig = getProxyConfig();
            expect(prodConfig.monitoring.enabled).toBe(true);

            // Restore test environment and variables
            process.env.NODE_ENV = 'test';
            process.env.OPENROUTER_API_KEYS = originalKeys;
            process.env.QDRANT_URL = originalQdrant;
            process.env.SOLANA_MULTISIG_ADDRESS = originalMultisig;
            process.env.SVMAI_TOKEN_MINT = originalMint;
            resetProxyConfig();
        });
    });

    describe('Rate Limiting Edge Cases', () => {
        it('should handle multiple rate limit windows correctly', async () => {
            const checks = [
                { type: 'user' as const, identifier: testUserId, windows: ['minute', 'hour', 'day'] as const }
            ];

            const result = await rateLimiter.checkMultipleRateLimits(checks);
            expect(result.allowed).toBe(true);
            expect(result.results).toHaveLength(3); // minute, hour, day
        });

        it('should provide rate limit statistics', async () => {
            // Generate some activity
            await rateLimiter.checkRateLimit('user', 'user1', 'minute');
            await rateLimiter.checkRateLimit('user', 'user2', 'minute');

            const stats = await rateLimiter.getStats();
            expect(stats.totalKeys).toBeGreaterThan(0);
            expect(stats.memoryUsage).toBeDefined();
        });

        it('should reset rate limits correctly', async () => {
            // Use up some rate limit
            await rateLimiter.checkRateLimit('user', testUserId, 'minute');

            // Reset the rate limit
            await rateLimiter.resetRateLimit('user', testUserId, 'minute');

            // Should be back to full limit
            const usage = await rateLimiter.getCurrentUsage('user', testUserId, 'minute');
            expect(usage.count).toBe(0);
        });
    });

    describe('Security Edge Cases', () => {
        it('should block requests with malicious patterns', async () => {
            const maliciousRequest = new Request('https://api.opensvm.com/v1/messages?test=<script>alert(1)</script>', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'malicious-bot'
                }
            });

            const securityContext = extractSecurityContext(maliciousRequest);
            const securityResult = await securityMiddleware.applySecurity(maliciousRequest, securityContext);

            // Should detect malicious patterns
            expect(securityResult.allowed).toBe(false);
            expect(securityResult.reason).toContain('Malicious pattern detected');
        });

        it('should handle request size limits', async () => {
            const largeRequest = new Request('https://api.opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': '20971520' // 20MB
                }
            });

            const securityContext = extractSecurityContext(largeRequest);
            securityContext.requestSize = 20971520;

            const securityResult = await securityMiddleware.applySecurity(largeRequest, securityContext);
            expect(securityResult.allowed).toBe(false);
            expect(securityResult.reason).toContain('Request size');
        });
    });

    describe('Performance and Concurrency', () => {
        it('should handle concurrent rate limit checks', async () => {
            const concurrentChecks = Array.from({ length: 10 }, (_, i) =>
                rateLimiter.checkRateLimit('user', `user-${i}`, 'minute')
            );

            const results = await Promise.all(concurrentChecks);

            // All should be allowed (different users)
            results.forEach(result => {
                expect(result.allowed).toBe(true);
            });
        });

        it('should maintain rate limit accuracy under load', async () => {
            const userId = 'load-test-user';
            const limit = config.rateLimiting.perUser.requestsPerMinute;

            // Use up the exact limit
            const checks = Array.from({ length: limit }, () =>
                rateLimiter.checkRateLimit('user', userId, 'minute')
            );

            const results = await Promise.all(checks);

            // All should be allowed
            results.forEach(result => {
                expect(result.allowed).toBe(true);
            });

            // Next one should be denied
            const overLimitResult = await rateLimiter.checkRateLimit('user', userId, 'minute');
            expect(overLimitResult.allowed).toBe(false);
        });
    });
}); 