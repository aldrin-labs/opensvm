import { AnthropicError, AnthropicAPIError } from '../types/AnthropicTypes';
import { ProxyMonitor } from '../monitoring/ProxyMonitor';

export interface ProxyError {
    type: 'proxy_error' | 'anthropic_error' | 'auth_error' | 'billing_error' | 'rate_limit_error' | 'validation_error';
    message: string;
    code?: string;
    details?: any;
    statusCode: number;
    requestId?: string;
    userId?: string;
    keyId?: string;
}

export interface ErrorContext {
    requestId: string;
    userId?: string;
    keyId?: string;
    endpoint: string;
    method: string;
    userAgent?: string;
    ipAddress?: string;
    timestamp: Date;
    requestBody?: any;
}

export class ProxyErrorHandler {
    private monitor: ProxyMonitor;

    constructor(monitor?: ProxyMonitor) {
        this.monitor = monitor || ProxyMonitor.getInstance();
    }

    /**
     * Handle and format errors for API responses
     */
    async handleError(error: any, context: ErrorContext): Promise<ProxyError> {
        const proxyError = this.classifyError(error, context);

        // Log error for monitoring
        await this.monitor.logError(proxyError, context);

        // Track error metrics
        await this.monitor.incrementErrorCount(proxyError.type, context.endpoint);

        return proxyError;
    }

    /**
     * Classify different types of errors
     */
    private classifyError(error: any, context: ErrorContext): ProxyError {
        // Anthropic API errors - forward as-is
        if (error instanceof AnthropicAPIError) {
            return {
                type: 'anthropic_error',
                message: error.message,
                code: error.anthropicError?.error?.type,
                details: error.anthropicError,
                statusCode: error.status,
                requestId: context.requestId,
                userId: context.userId,
                keyId: context.keyId
            };
        }

        // Authentication errors
        if (this.isAuthError(error)) {
            return {
                type: 'auth_error',
                message: 'Invalid API key or authentication failed',
                code: 'invalid_api_key',
                statusCode: 401,
                requestId: context.requestId,
                userId: context.userId,
                keyId: context.keyId
            };
        }

        // Billing/balance errors
        if (this.isBillingError(error)) {
            return {
                type: 'billing_error',
                message: error.message || 'Insufficient SVMAI balance',
                code: 'insufficient_balance',
                statusCode: 402,
                requestId: context.requestId,
                userId: context.userId,
                keyId: context.keyId
            };
        }

        // Rate limit errors
        if (this.isRateLimitError(error)) {
            return {
                type: 'rate_limit_error',
                message: 'Rate limit exceeded',
                code: 'rate_limit_exceeded',
                details: {
                    retryAfter: error.retryAfter || 60,
                    limit: error.limit,
                    remaining: error.remaining
                },
                statusCode: 429,
                requestId: context.requestId,
                userId: context.userId,
                keyId: context.keyId
            };
        }

        // Validation errors
        if (this.isValidationError(error)) {
            return {
                type: 'validation_error',
                message: error.message || 'Invalid request parameters',
                code: 'invalid_request',
                details: error.details || error.validationErrors,
                statusCode: 400,
                requestId: context.requestId,
                userId: context.userId,
                keyId: context.keyId
            };
        }

        // Generic proxy errors
        return {
            type: 'proxy_error',
            message: error.message || 'Internal proxy error',
            code: 'internal_error',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            statusCode: error.statusCode || 500,
            requestId: context.requestId,
            userId: context.userId,
            keyId: context.keyId
        };
    }

    /**
     * Check if error is authentication-related
     */
    private isAuthError(error: any): boolean {
        return error.name === 'AuthenticationError' ||
            error.code === 'INVALID_API_KEY' ||
            error.message?.includes('authentication') ||
            error.message?.includes('unauthorized') ||
            error.statusCode === 401;
    }

    /**
     * Check if error is billing-related
     */
    private isBillingError(error: any): boolean {
        return error.name === 'InsufficientBalanceError' ||
            error.code === 'INSUFFICIENT_BALANCE' ||
            error.message?.includes('balance') ||
            error.message?.includes('payment') ||
            error.statusCode === 402;
    }

    /**
     * Check if error is rate limit-related
     */
    private isRateLimitError(error: any): boolean {
        return error.name === 'RateLimitError' ||
            error.code === 'RATE_LIMIT_EXCEEDED' ||
            error.message?.includes('rate limit') ||
            error.statusCode === 429;
    }

    /**
     * Check if error is validation-related
     */
    private isValidationError(error: any): boolean {
        return error.name === 'ValidationError' ||
            error.code === 'INVALID_REQUEST' ||
            error.message?.includes('validation') ||
            error.message?.includes('invalid') ||
            error.statusCode === 400;
    }

    /**
     * Format error for Anthropic-compatible API response
     */
    formatAnthropicError(proxyError: ProxyError): AnthropicError {
        // Map proxy error types to Anthropic error types
        const anthropicErrorType = this.mapToAnthropicErrorType(proxyError.type);

        return {
            type: 'error',
            error: {
                type: anthropicErrorType,
                message: proxyError.message
            }
        };
    }

    /**
     * Map proxy error types to Anthropic error types
     */
    private mapToAnthropicErrorType(proxyErrorType: string): "invalid_request_error" | "authentication_error" | "permission_error" | "not_found_error" | "rate_limit_error" | "api_error" | "overloaded_error" {
        switch (proxyErrorType) {
            case 'auth_error':
                return 'authentication_error';
            case 'billing_error':
                return 'permission_error';
            case 'rate_limit_error':
                return 'rate_limit_error';
            case 'validation_error':
                return 'invalid_request_error';
            case 'anthropic_error':
                return 'api_error';
            default:
                return 'api_error';
        }
    }

    /**
     * Create error response for API endpoints
     */
    createErrorResponse(proxyError: ProxyError): Response {
        const anthropicError = this.formatAnthropicError(proxyError);

        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            'X-Request-ID': proxyError.requestId || 'unknown'
        };

        // Add retry-after header for rate limit errors
        if (proxyError.type === 'rate_limit_error' && proxyError.details?.retryAfter) {
            headers['Retry-After'] = proxyError.details.retryAfter.toString();
        }

        return new Response(
            JSON.stringify(anthropicError),
            {
                status: proxyError.statusCode,
                headers
            }
        );
    }

    /**
     * Handle streaming errors
     */
    createStreamingErrorChunk(proxyError: ProxyError): string {
        const anthropicError = this.formatAnthropicError(proxyError);
        return `data: ${JSON.stringify({
            type: 'error',
            error: anthropicError.error
        })}\n\n`;
    }

    /**
     * Log critical errors that need immediate attention
     */
    async logCriticalError(error: ProxyError, context: ErrorContext): Promise<void> {
        if (this.isCriticalError(error)) {
            console.error('CRITICAL PROXY ERROR:', {
                error,
                context,
                timestamp: new Date().toISOString()
            });

            // In production, this would send alerts to monitoring systems
            if (process.env.NODE_ENV === 'production') {
                // Send to error tracking service (Sentry, Datadog, etc.)
                await this.sendAlert(error, context);
            }
        }
    }

    /**
     * Check if error is critical and needs immediate attention
     */
    private isCriticalError(error: ProxyError): boolean {
        return error.statusCode >= 500 ||
            error.type === 'proxy_error' ||
            (error.type === 'anthropic_error' && error.statusCode >= 500);
    }

    /**
     * Send alert for critical errors (placeholder for production alerting)
     */
    private async sendAlert(error: ProxyError, context: ErrorContext): Promise<void> {
        // Use context for enriched error alerting and debugging
        console.warn('Alert would be sent for critical error:', {
            errorType: error.type,
            message: error.message,
            userId: context.userId,
            keyId: context.keyId,
            timestamp: context.timestamp,
            requestId: context.requestId,
            userAgent: context.userAgent
        });

        // Placeholder for production alerting system
        // This would integrate with services like PagerDuty, Slack, email, etc.
        // Example: await this.alertingService.sendAlert(error, context);
    }

    /**
     * Get error statistics for monitoring dashboard
     */
    async getErrorStats(timeRange: { start: Date; end: Date }): Promise<{
        totalErrors: number;
        errorsByType: Record<string, number>;
        errorsByEndpoint: Record<string, number>;
        criticalErrors: number;
        averageErrorRate: number;
    }> {
        return await this.monitor.getErrorStats(timeRange);
    }
} 