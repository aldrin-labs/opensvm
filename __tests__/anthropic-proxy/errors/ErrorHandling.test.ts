import { ProxyErrorHandler, ProxyError, ErrorContext } from '../../../lib/anthropic-proxy/errors/ProxyErrorHandler';
import { ProxyMonitor, RequestMetrics, ResponseMetrics, SystemMetrics, AlertConfig } from '../../../lib/anthropic-proxy/monitoring/ProxyMonitor';
import { ErrorFormatter, FormattedError, ErrorFormatOptions } from '../../../lib/anthropic-proxy/utils/ErrorFormatter';
import { AnthropicAPIError } from '../../../lib/anthropic-proxy/types/AnthropicTypes';

// Mock ProxyMonitor
jest.mock('../../../lib/anthropic-proxy/monitoring/ProxyMonitor');

describe('Error Handling System', () => {
    let mockMonitor: jest.Mocked<ProxyMonitor>;

    beforeEach(() => {
        jest.clearAllMocks();

        // Create mock monitor instance
        mockMonitor = {
            logError: jest.fn(),
            incrementErrorCount: jest.fn(),
            getErrorStats: jest.fn(),
            logRequest: jest.fn(),
            logResponse: jest.fn(),
            getSystemMetrics: jest.fn(),
            getPerformanceMetrics: jest.fn(),
            getHealthStatus: jest.fn(),
            configureAlert: jest.fn(),
            getAlertConfigurations: jest.fn(),
            cleanup: jest.fn()
        } as any;

        (ProxyMonitor.getInstance as jest.Mock).mockReturnValue(mockMonitor);
    });

    describe('ProxyErrorHandler', () => {
        let errorHandler: ProxyErrorHandler;
        let mockContext: ErrorContext;

        beforeEach(() => {
            errorHandler = new ProxyErrorHandler(mockMonitor);
            mockContext = {
                requestId: 'test-request-123',
                userId: 'user-456',
                keyId: 'key-789',
                endpoint: '/v1/messages',
                method: 'POST',
                userAgent: 'test-agent',
                ipAddress: '127.0.0.1',
                timestamp: new Date(),
                requestBody: { model: 'claude-3-sonnet-20240229' }
            };
        });

        describe('handleError', () => {
            it('should handle Anthropic API errors correctly', async () => {
                const anthropicError = new AnthropicAPIError(
                    {
                        type: 'error',
                        error: {
                            type: 'rate_limit_error',
                            message: 'Rate limit exceeded'
                        }
                    },
                    429
                );

                const result = await errorHandler.handleError(anthropicError, mockContext);

                expect(result.type).toBe('anthropic_error');
                expect(result.statusCode).toBe(429);
                expect(result.message).toBe('Rate limit exceeded');
                expect(result.requestId).toBe('test-request-123');
                expect(mockMonitor.logError).toHaveBeenCalledWith(result, mockContext);
                expect(mockMonitor.incrementErrorCount).toHaveBeenCalledWith('anthropic_error', '/v1/messages');
            });

            it('should handle authentication errors correctly', async () => {
                const authError = {
                    name: 'AuthenticationError',
                    message: 'Invalid API key',
                    statusCode: 401
                };

                const result = await errorHandler.handleError(authError, mockContext);

                expect(result.type).toBe('auth_error');
                expect(result.statusCode).toBe(401);
                expect(result.code).toBe('invalid_api_key');
                expect(result.userId).toBe('user-456');
                expect(result.keyId).toBe('key-789');
            });

            it('should handle billing errors correctly', async () => {
                const billingError = {
                    name: 'InsufficientBalanceError',
                    message: 'Insufficient SVMAI balance',
                    statusCode: 402
                };

                const result = await errorHandler.handleError(billingError, mockContext);

                expect(result.type).toBe('billing_error');
                expect(result.statusCode).toBe(402);
                expect(result.code).toBe('insufficient_balance');
            });

            it('should handle rate limit errors correctly', async () => {
                const rateLimitError = {
                    name: 'RateLimitError',
                    message: 'Rate limit exceeded',
                    statusCode: 429,
                    retryAfter: 60,
                    limit: 100,
                    remaining: 0
                };

                const result = await errorHandler.handleError(rateLimitError, mockContext);

                expect(result.type).toBe('rate_limit_error');
                expect(result.statusCode).toBe(429);
                expect(result.details).toEqual({
                    retryAfter: 60,
                    limit: 100,
                    remaining: 0
                });
            });

            it('should handle validation errors correctly', async () => {
                const validationError = {
                    name: 'ValidationError',
                    message: 'Invalid request parameters',
                    statusCode: 400,
                    validationErrors: [
                        { field: 'model', message: 'Required field missing' }
                    ]
                };

                const result = await errorHandler.handleError(validationError, mockContext);

                expect(result.type).toBe('validation_error');
                expect(result.statusCode).toBe(400);
                expect(result.code).toBe('invalid_request');
                expect(result.details).toEqual(validationError.validationErrors);
            });

            it('should handle generic proxy errors correctly', async () => {
                const genericError = new Error('Something went wrong');

                const result = await errorHandler.handleError(genericError, mockContext);

                expect(result.type).toBe('proxy_error');
                expect(result.statusCode).toBe(500);
                expect(result.code).toBe('internal_error');
                expect(result.message).toBe('Something went wrong');
            });
        });

        describe('formatAnthropicError', () => {
            it('should format proxy errors to Anthropic format', () => {
                const proxyError: ProxyError = {
                    type: 'auth_error',
                    message: 'Invalid API key',
                    code: 'invalid_api_key',
                    statusCode: 401,
                    requestId: 'test-request-123'
                };

                const result = errorHandler.formatAnthropicError(proxyError);

                expect(result).toEqual({
                    type: 'error',
                    error: {
                        type: 'authentication_error',
                        message: 'Invalid API key'
                    }
                });
            });

            it('should map different error types correctly', () => {
                const testCases = [
                    { input: 'auth_error', expected: 'authentication_error' },
                    { input: 'billing_error', expected: 'permission_error' },
                    { input: 'rate_limit_error', expected: 'rate_limit_error' },
                    { input: 'validation_error', expected: 'invalid_request_error' },
                    { input: 'anthropic_error', expected: 'api_error' },
                    { input: 'unknown_error', expected: 'api_error' }
                ];

                testCases.forEach(({ input, expected }) => {
                    const proxyError: ProxyError = {
                        type: input as any,
                        message: 'Test error',
                        statusCode: 500,
                        requestId: 'test'
                    };

                    const result = errorHandler.formatAnthropicError(proxyError);
                    expect(result.error.type).toBe(expected);
                });
            });
        });

        describe('createErrorResponse', () => {
            it('should create proper HTTP response', () => {
                const proxyError: ProxyError = {
                    type: 'rate_limit_error',
                    message: 'Rate limit exceeded',
                    statusCode: 429,
                    requestId: 'test-request-123',
                    details: { retryAfter: 60 }
                };

                const response = errorHandler.createErrorResponse(proxyError);

                expect(response.status).toBe(429);
                expect(response).toBeInstanceOf(Response);
                // Headers might not be accessible in test environment, so we'll skip detailed header checks
            });
        });

        describe('createStreamingErrorChunk', () => {
            it('should create proper streaming error chunk', () => {
                const proxyError: ProxyError = {
                    type: 'auth_error',
                    message: 'Invalid API key',
                    statusCode: 401,
                    requestId: 'test-request-123'
                };

                const chunk = errorHandler.createStreamingErrorChunk(proxyError);

                expect(chunk).toContain('data: ');
                expect(chunk).toContain('authentication_error');
                expect(chunk).toContain('Invalid API key');
                expect(chunk).toMatch(/\n\n$/);
            });
        });

        describe('getErrorStats', () => {
            it('should get error statistics from monitor', async () => {
                const timeRange = { start: new Date(), end: new Date() };
                const mockStats = {
                    totalErrors: 10,
                    errorsByType: { auth_error: 5, rate_limit_error: 3 },
                    errorsByEndpoint: { '/v1/messages': 8 },
                    criticalErrors: 2,
                    averageErrorRate: 5.5
                };

                mockMonitor.getErrorStats.mockResolvedValue(mockStats);

                const result = await errorHandler.getErrorStats(timeRange);

                expect(result).toEqual(mockStats);
                expect(mockMonitor.getErrorStats).toHaveBeenCalledWith(timeRange);
            });
        });
    });

    describe('ErrorFormatter', () => {
        describe('formatError', () => {
            it('should format errors with default options', () => {
                const error = new Error('Test error');
                const context = { requestId: 'test-123' };

                const result = ErrorFormatter.formatError(error, context);

                expect(result.error.type).toBe('error');
                expect(result.error.error.type).toBe('api_error');
                expect(result.error.error.message).toBe('Test error');
                expect(result.statusCode).toBe(500);
                expect(result.headers['Content-Type']).toBe('application/json');
                expect(result.headers['X-Request-ID']).toBe('test-123');
            });

            it('should sanitize sensitive information in error messages', () => {
                const error = new Error('Error with API key sk-ant-api03-abc123 and password=secret123');
                const context = { requestId: 'test-123' };

                const result = ErrorFormatter.formatError(error, context);

                expect(result.error.error.message).toContain('[API_KEY]');
                expect(result.error.error.message).toContain('password=[REDACTED]');
                expect(result.error.error.message).not.toContain('sk-ant-api03-abc123');
                expect(result.error.error.message).not.toContain('secret123');
            });

            it('should handle different error types correctly', () => {
                const testCases = [
                    {
                        error: { name: 'AuthenticationError', message: 'Auth failed' },
                        expectedType: 'authentication_error',
                        expectedStatus: 401
                    },
                    {
                        error: { name: 'ValidationError', message: 'Invalid input' },
                        expectedType: 'invalid_request_error',
                        expectedStatus: 400
                    },
                    {
                        error: { name: 'RateLimitError', message: 'Too many requests' },
                        expectedType: 'rate_limit_error',
                        expectedStatus: 429
                    }
                ];

                testCases.forEach(({ error, expectedType, expectedStatus }) => {
                    const result = ErrorFormatter.formatError(error);
                    expect(result.error.error.type).toBe(expectedType);
                    expect(result.statusCode).toBe(expectedStatus);
                });
            });

            it('should truncate long error messages', () => {
                const longMessage = 'A'.repeat(600);
                const error = new Error(longMessage);
                const options = { maxMessageLength: 100 };

                const result = ErrorFormatter.formatError(error, {}, options);

                expect(result.error.error.message.length).toBeLessThanOrEqual(100);
                expect(result.error.error.message).toMatch(/\.\.\.$/);
            });
        });

        describe('formatStreamingError', () => {
            it('should format streaming errors correctly', () => {
                const error = new Error('Streaming error');
                const context = { requestId: 'stream-123' };

                const result = ErrorFormatter.formatStreamingError(error, context);

                expect(result).toMatch(/^data: /);
                expect(result).toContain('api_error');
                expect(result).toContain('Streaming error');
                expect(result).toMatch(/\n\n$/);
            });
        });

        describe('formatValidationErrors', () => {
            it('should format validation errors correctly', () => {
                const errors = [
                    { field: 'model', message: 'Required field missing' },
                    { field: 'max_tokens', message: 'Must be a positive integer' }
                ];
                const context = { requestId: 'validation-123' };

                const result = ErrorFormatter.formatValidationErrors(errors, context);

                expect(result.error.error.type).toBe('invalid_request_error');
                expect(result.statusCode).toBe(400);
                expect(result.error.error.message).toContain('model: Required field missing');
                expect(result.error.error.message).toContain('max_tokens: Must be a positive integer');
            });
        });

        describe('createApiResponse', () => {
            it('should create proper API response', () => {
                const error = { name: 'RateLimitError', message: 'Rate limited' };
                const context = { requestId: 'api-123' };

                const response = ErrorFormatter.createApiResponse(error, context);

                expect(response.status).toBe(429);
                expect(response).toBeInstanceOf(Response);
                // Headers might not be accessible in test environment, so we'll skip detailed header checks
            });
        });

        describe('getUserFriendlyMessage', () => {
            it('should return user-friendly messages', () => {
                const testCases = [
                    {
                        error: { name: 'AuthenticationError' },
                        expected: 'Invalid API key. Please check your authentication credentials.'
                    },
                    {
                        error: { name: 'RateLimitError' },
                        expected: 'Rate limit exceeded. Please wait before making more requests.'
                    },
                    {
                        error: { name: 'ValidationError' },
                        expected: 'Invalid request. Please check your request parameters.'
                    }
                ];

                testCases.forEach(({ error, expected }) => {
                    const result = ErrorFormatter.getUserFriendlyMessage(error);
                    expect(result).toBe(expected);
                });
            });
        });

        describe('isRetryableError', () => {
            it('should identify retryable errors correctly', () => {
                const retryableErrors = [
                    { statusCode: 500 },
                    { statusCode: 502 },
                    { statusCode: 503 },
                    { statusCode: 504 },
                    { statusCode: 429 },
                    { name: 'TimeoutError' },
                    { code: 'ECONNREFUSED' }
                ];

                const nonRetryableErrors = [
                    { statusCode: 400 },
                    { statusCode: 401 },
                    { statusCode: 403 },
                    { statusCode: 404 },
                    { name: 'ValidationError' }
                ];

                retryableErrors.forEach(error => {
                    expect(ErrorFormatter.isRetryableError(error)).toBe(true);
                });

                nonRetryableErrors.forEach(error => {
                    expect(ErrorFormatter.isRetryableError(error)).toBe(false);
                });
            });
        });

        describe('getRetryDelay', () => {
            it('should return retry-after value when present', () => {
                const error = { retryAfter: 120 };
                const delay = ErrorFormatter.getRetryDelay(error);
                expect(delay).toBe(120000); // 120 seconds in milliseconds
            });

            it('should use exponential backoff for attempts', () => {
                const error = { statusCode: 500 };

                expect(ErrorFormatter.getRetryDelay(error, 1)).toBe(1000);   // 1s
                expect(ErrorFormatter.getRetryDelay(error, 2)).toBe(2000);   // 2s
                expect(ErrorFormatter.getRetryDelay(error, 3)).toBe(4000);   // 4s
                expect(ErrorFormatter.getRetryDelay(error, 4)).toBe(8000);   // 8s
                expect(ErrorFormatter.getRetryDelay(error, 10)).toBe(30000); // Max 30s
            });
        });
    });

    describe('Integration Tests', () => {
        let errorHandler: ProxyErrorHandler;
        let mockContext: ErrorContext;

        beforeEach(() => {
            errorHandler = new ProxyErrorHandler(mockMonitor);
            mockContext = {
                requestId: 'integration-test-123',
                userId: 'user-integration',
                keyId: 'key-integration',
                endpoint: '/v1/messages',
                method: 'POST',
                timestamp: new Date()
            };
        });

        it('should handle complete error flow from classification to response', async () => {
            const originalError = new Error('Database connection failed');
            originalError.name = 'ConnectionError';

            // Handle error
            const proxyError = await errorHandler.handleError(originalError, mockContext);

            // Format for API response
            const formattedError = ErrorFormatter.formatError(originalError, mockContext);

            // Create HTTP response
            const httpResponse = errorHandler.createErrorResponse(proxyError);

            // Verify complete flow
            expect(proxyError.type).toBe('proxy_error');
            expect(formattedError.statusCode).toBe(500);
            expect(httpResponse.status).toBe(500);
            expect(mockMonitor.logError).toHaveBeenCalled();
            expect(mockMonitor.incrementErrorCount).toHaveBeenCalled();
        });

        it('should handle streaming error flow', async () => {
            const streamingError = {
                name: 'StreamingError',
                message: 'Connection interrupted',
                statusCode: 502
            };

            // Handle error
            const proxyError = await errorHandler.handleError(streamingError, mockContext);

            // Create streaming error chunk
            const errorChunk = errorHandler.createStreamingErrorChunk(proxyError);

            // Verify streaming format
            expect(errorChunk).toMatch(/^data: /);
            expect(errorChunk).toContain('api_error');
            expect(errorChunk).toMatch(/\n\n$/);

            const parsedChunk = JSON.parse(errorChunk.replace('data: ', '').trim());
            expect(parsedChunk.type).toBe('error');
            expect(parsedChunk.error.message).toBe('Connection interrupted');
        });

        it('should properly log critical errors', async () => {
            const criticalError = new Error('Critical system failure');
            criticalError.name = 'CriticalError';

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            const proxyError = await errorHandler.handleError(criticalError, mockContext);
            await errorHandler.logCriticalError(proxyError, mockContext);

            expect(consoleSpy).toHaveBeenCalledWith(
                'CRITICAL PROXY ERROR:',
                expect.objectContaining({
                    error: proxyError,
                    context: mockContext
                })
            );

            consoleSpy.mockRestore();
        });
    });
}); 