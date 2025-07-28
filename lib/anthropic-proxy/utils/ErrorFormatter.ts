import { AnthropicError } from '../types/AnthropicTypes';

export interface FormattedError {
    error: AnthropicError;
    statusCode: number;
    headers: Record<string, string>;
    requestId?: string;
}

export interface ErrorFormatOptions {
    includeStackTrace?: boolean;
    includeRequestId?: boolean;
    includeTimestamp?: boolean;
    sanitizeMessage?: boolean;
    maxMessageLength?: number;
}

export class ErrorFormatter {
    private static readonly DEFAULT_OPTIONS: ErrorFormatOptions = {
        includeStackTrace: process.env.NODE_ENV === 'development',
        includeRequestId: true,
        includeTimestamp: false,
        sanitizeMessage: true,
        maxMessageLength: 500
    };

    /**
     * Format error for Anthropic-compatible API response
     */
    static formatError(
        error: any,
        context: {
            requestId?: string;
            endpoint?: string;
            userId?: string;
            keyId?: string;
        } = {},
        options: ErrorFormatOptions = {}
    ): FormattedError {
        const opts = { ...ErrorFormatter.DEFAULT_OPTIONS, ...options };

        // Determine error type and status code
        const { errorType, statusCode, message } = ErrorFormatter.classifyError(error);

        // Sanitize message if needed
        const sanitizedMessage = opts.sanitizeMessage
            ? ErrorFormatter.sanitizeErrorMessage(message, opts.maxMessageLength)
            : message;

        // Create Anthropic-compatible error
        const anthropicError: AnthropicError = {
            type: 'error',
            error: {
                type: errorType,
                message: sanitizedMessage
            }
        };

        // Build headers
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };

        if (opts.includeRequestId && context.requestId) {
            headers['X-Request-ID'] = context.requestId;
        }

        if (opts.includeTimestamp) {
            headers['X-Timestamp'] = new Date().toISOString();
        }

        // Add retry-after for rate limit errors
        if (statusCode === 429) {
            const retryAfter = ErrorFormatter.extractRetryAfter(error);
            if (retryAfter) {
                headers['Retry-After'] = retryAfter.toString();
            }
        }

        // Add CORS headers for browser requests
        headers['Access-Control-Allow-Origin'] = '*';
        headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
        headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';

        return {
            error: anthropicError,
            statusCode,
            headers,
            requestId: context.requestId
        };
    }

    /**
     * Format error for streaming responses
     */
    static formatStreamingError(
        error: any,
        context: {
            requestId?: string;
            endpoint?: string;
        } = {},
        options: ErrorFormatOptions = {}
    ): string {
        const formattedError = ErrorFormatter.formatError(error, context, options);

        const streamChunk = {
            type: 'error',
            error: formattedError.error.error
        };

        return `data: ${JSON.stringify(streamChunk)}\n\n`;
    }

    /**
     * Format multiple errors (for validation errors)
     */
    static formatValidationErrors(
        errors: Array<{
            field: string;
            message: string;
            code?: string;
        }>,
        context: {
            requestId?: string;
        } = {},
        options: ErrorFormatOptions = {}
    ): FormattedError {
        const errorMessages = errors.map(err => `${err.field}: ${err.message}`).join('; ');
        const message = `Validation failed: ${errorMessages}`;

        return ErrorFormatter.formatError(
            {
                name: 'ValidationError',
                message,
                statusCode: 400,
                details: errors
            },
            context,
            options
        );
    }

    /**
     * Format error for webhook/callback responses
     */
    static formatWebhookError(
        error: any,
        webhookUrl: string,
        context: {
            requestId?: string;
            attempt?: number;
            maxAttempts?: number;
        } = {}
    ): FormattedError {
        const message = `Webhook delivery failed to ${webhookUrl}: ${error.message || 'Unknown error'}`;

        const formattedError = ErrorFormatter.formatError(
            {
                name: 'WebhookError',
                message,
                statusCode: 502,
                webhookUrl,
                attempt: context.attempt,
                maxAttempts: context.maxAttempts
            },
            context
        );

        // Add webhook-specific headers
        formattedError.headers['X-Webhook-URL'] = webhookUrl;
        if (context.attempt && context.maxAttempts) {
            formattedError.headers['X-Webhook-Attempt'] = `${context.attempt}/${context.maxAttempts}`;
        }

        return formattedError;
    }

    /**
     * Create error response for Next.js API routes
     */
    static createApiResponse(
        error: any,
        context: {
            requestId?: string;
            endpoint?: string;
            userId?: string;
            keyId?: string;
        } = {},
        options: ErrorFormatOptions = {}
    ): Response {
        const formattedError = ErrorFormatter.formatError(error, context, options);

        return new Response(
            JSON.stringify(formattedError.error),
            {
                status: formattedError.statusCode,
                headers: formattedError.headers
            }
        );
    }

    /**
     * Create streaming error response
     */
    static createStreamingResponse(
        error: any,
        context: {
            requestId?: string;
            endpoint?: string;
        } = {},
        options: ErrorFormatOptions = {}
    ): Response {
        const errorChunk = ErrorFormatter.formatStreamingError(error, context, options);

        return new Response(errorChunk, {
            status: 200, // Streaming responses typically use 200 even for errors
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Request-ID': context.requestId || 'unknown'
            }
        });
    }

    /**
     * Classify error and determine appropriate response
     */
    private static classifyError(error: any): {
        errorType: string;
        statusCode: number;
        message: string;
    } {
        // Anthropic API errors
        if (error.response?.data?.error) {
            return {
                errorType: error.response.data.error.type || 'api_error',
                statusCode: error.response.status || 500,
                message: error.response.data.error.message || 'API error occurred'
            };
        }

        // Authentication errors
        if (ErrorFormatter.isAuthError(error)) {
            return {
                errorType: 'authentication_error',
                statusCode: 401,
                message: error.message || 'Authentication failed'
            };
        }

        // Permission errors
        if (ErrorFormatter.isPermissionError(error)) {
            return {
                errorType: 'permission_error',
                statusCode: 403,
                message: error.message || 'Permission denied'
            };
        }

        // Billing errors
        if (ErrorFormatter.isBillingError(error)) {
            return {
                errorType: 'permission_error', // Anthropic uses permission_error for billing
                statusCode: 402,
                message: error.message || 'Insufficient balance'
            };
        }

        // Rate limit errors
        if (ErrorFormatter.isRateLimitError(error)) {
            return {
                errorType: 'rate_limit_error',
                statusCode: 429,
                message: error.message || 'Rate limit exceeded'
            };
        }

        // Validation errors
        if (ErrorFormatter.isValidationError(error)) {
            return {
                errorType: 'invalid_request_error',
                statusCode: 400,
                message: error.message || 'Invalid request'
            };
        }

        // Not found errors
        if (ErrorFormatter.isNotFoundError(error)) {
            return {
                errorType: 'not_found_error',
                statusCode: 404,
                message: error.message || 'Resource not found'
            };
        }

        // Timeout errors
        if (ErrorFormatter.isTimeoutError(error)) {
            return {
                errorType: 'api_error',
                statusCode: 504,
                message: 'Request timeout'
            };
        }

        // Service unavailable
        if (ErrorFormatter.isServiceUnavailableError(error)) {
            return {
                errorType: 'api_error',
                statusCode: 503,
                message: 'Service temporarily unavailable'
            };
        }

        // Default to internal server error
        return {
            errorType: 'api_error',
            statusCode: error.statusCode || 500,
            message: error.message || 'Internal server error'
        };
    }

    /**
     * Extract retry-after value from error
     */
    private static extractRetryAfter(error: any): number | null {
        if (error.retryAfter) return error.retryAfter;
        if (error.headers?.['retry-after']) return parseInt(error.headers['retry-after']);
        if (error.response?.headers?.['retry-after']) return parseInt(error.response.headers['retry-after']);

        // Default retry-after for rate limits
        if (ErrorFormatter.isRateLimitError(error)) {
            return 60; // 60 seconds
        }

        return null;
    }

    /**
     * Sanitize error message for security
     */
    private static sanitizeErrorMessage(message: string, maxLength?: number): string {
        if (!message) return 'An error occurred';

        // Remove potentially sensitive information
        let sanitized = message
            .replace(/sk-ant-api03-[a-zA-Z0-9+/=]+/g, '[API_KEY]') // API keys
            .replace(/Bearer\s+[a-zA-Z0-9+/=]+/g, 'Bearer [TOKEN]') // Bearer tokens
            .replace(/password[=:]\s*[^\s]+/gi, 'password=[REDACTED]') // Passwords
            .replace(/secret[=:]\s*[^\s]+/gi, 'secret=[REDACTED]') // Secrets
            .replace(/token[=:]\s*[^\s]+/gi, 'token=[REDACTED]') // Tokens
            .replace(/key[=:]\s*[^\s]+/gi, 'key=[REDACTED]') // Keys
            .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[CARD_NUMBER]') // Credit cards
            .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]'); // Emails

        // Truncate if too long
        if (maxLength && sanitized.length > maxLength) {
            sanitized = sanitized.substring(0, maxLength - 3) + '...';
        }

        return sanitized;
    }

    // Error type detection methods
    private static isAuthError(error: any): boolean {
        return error.name === 'AuthenticationError' ||
            error.code === 'INVALID_API_KEY' ||
            error.message?.toLowerCase().includes('authentication') ||
            error.message?.toLowerCase().includes('unauthorized') ||
            error.statusCode === 401;
    }

    private static isPermissionError(error: any): boolean {
        return error.name === 'PermissionError' ||
            error.code === 'PERMISSION_DENIED' ||
            error.message?.toLowerCase().includes('permission') ||
            error.message?.toLowerCase().includes('forbidden') ||
            error.statusCode === 403;
    }

    private static isBillingError(error: any): boolean {
        return error.name === 'InsufficientBalanceError' ||
            error.code === 'INSUFFICIENT_BALANCE' ||
            error.message?.toLowerCase().includes('balance') ||
            error.message?.toLowerCase().includes('payment') ||
            error.statusCode === 402;
    }

    private static isRateLimitError(error: any): boolean {
        return error.name === 'RateLimitError' ||
            error.code === 'RATE_LIMIT_EXCEEDED' ||
            error.message?.toLowerCase().includes('rate limit') ||
            error.statusCode === 429;
    }

    private static isValidationError(error: any): boolean {
        return error.name === 'ValidationError' ||
            error.code === 'INVALID_REQUEST' ||
            error.message?.toLowerCase().includes('validation') ||
            error.message?.toLowerCase().includes('invalid') ||
            error.statusCode === 400;
    }

    private static isNotFoundError(error: any): boolean {
        return error.name === 'NotFoundError' ||
            error.code === 'NOT_FOUND' ||
            error.message?.toLowerCase().includes('not found') ||
            error.statusCode === 404;
    }

    private static isTimeoutError(error: any): boolean {
        return error.name === 'TimeoutError' ||
            error.code === 'ETIMEDOUT' ||
            error.code === 'TIMEOUT' ||
            error.message?.toLowerCase().includes('timeout') ||
            error.statusCode === 504;
    }

    private static isServiceUnavailableError(error: any): boolean {
        return error.name === 'ServiceUnavailableError' ||
            error.code === 'ECONNREFUSED' ||
            error.code === 'ENOTFOUND' ||
            error.message?.toLowerCase().includes('service unavailable') ||
            error.statusCode === 503;
    }

    /**
     * Get user-friendly error message
     */
    static getUserFriendlyMessage(error: any): string {
        const { errorType } = ErrorFormatter.classifyError(error);

        switch (errorType) {
            case 'authentication_error':
                return 'Invalid API key. Please check your authentication credentials.';
            case 'permission_error':
                return 'Access denied. You don\'t have permission to perform this action.';
            case 'rate_limit_error':
                return 'Rate limit exceeded. Please wait before making more requests.';
            case 'invalid_request_error':
                return 'Invalid request. Please check your request parameters.';
            case 'not_found_error':
                return 'The requested resource was not found.';
            default:
                return 'An unexpected error occurred. Please try again later.';
        }
    }

    /**
     * Check if error should be retried
     */
    static isRetryableError(error: any): boolean {
        const { statusCode } = ErrorFormatter.classifyError(error);

        // Retry on server errors, timeouts, and service unavailable
        return statusCode >= 500 ||
            statusCode === 429 ||
            statusCode === 503 ||
            statusCode === 504 ||
            ErrorFormatter.isTimeoutError(error) ||
            ErrorFormatter.isServiceUnavailableError(error);
    }

    /**
     * Get recommended retry delay in milliseconds
     */
    static getRetryDelay(error: any, attempt: number = 1): number {
        const retryAfter = ErrorFormatter.extractRetryAfter(error);

        if (retryAfter) {
            return retryAfter * 1000; // Convert to milliseconds
        }

        // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
        return Math.min(1000 * Math.pow(2, attempt - 1), 30000);
    }
} 