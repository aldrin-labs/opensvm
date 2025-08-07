import { AnthropicAPIError } from '../types/AnthropicTypes';

export interface ErrorContext {
  userId?: string;
  apiKeyId?: string;
  keyId?: string;
  endpoint?: string;
  method?: string;
  requestId?: string;
  model?: string;
  timestamp: Date | number;
  userAgent?: string;
  ip?: string;
  ipAddress?: string;
  requestBody?: any;
}

export class ProxyError extends Error {
  public type?: string;
  public code: string;
  public statusCode: number;
  public context: ErrorContext;
  public retryable: boolean;
  public requestId?: string;
  public userId?: string;
  public keyId?: string;
  public details?: any;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    context: ErrorContext,
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'ProxyError';
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
    this.retryable = retryable;
    this.requestId = context.requestId;
    this.userId = context.userId;
    this.keyId = context.keyId;
  }

  static fromAnthropicError(error: AnthropicAPIError, context: ErrorContext): ProxyError {
    return new ProxyError(
      error.message,
      error.code,
      error.status,
      context,
      error.status >= 500 || error.status === 429
    );
  }

  static insufficientBalance(context: ErrorContext): ProxyError {
    return new ProxyError(
      'Insufficient SVMAI balance',
      'INSUFFICIENT_BALANCE',
      402,
      context,
      false
    );
  }

  static invalidApiKey(context: ErrorContext): ProxyError {
    return new ProxyError(
      'Invalid API key',
      'INVALID_API_KEY',
      401,
      context,
      false
    );
  }

  static rateLimited(context: ErrorContext): ProxyError {
    return new ProxyError(
      'Rate limit exceeded',
      'RATE_LIMITED',
      429,
      context,
      true
    );
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      context: this.context,
      retryable: this.retryable,
      stack: this.stack
    };
  }
}

export class ProxyErrorHandler {
  private monitor: any;

  constructor(monitor?: any) {
    this.monitor = monitor;
  }

  async handleError(error: any, context: ErrorContext): Promise<ProxyError> {
    let proxyError: ProxyError;

    if (error instanceof AnthropicAPIError) {
      proxyError = new ProxyError(error.message, error.code, error.status, context);
      proxyError.type = 'anthropic_error';
    } else if (error.name === 'AuthenticationError') {
      proxyError = new ProxyError(error.message, 'invalid_api_key', 401, context);
      proxyError.type = 'auth_error';
    } else if (error.name === 'InsufficientBalanceError') {
      proxyError = new ProxyError(error.message, 'insufficient_balance', 402, context);
      proxyError.type = 'billing_error';
    } else if (error.name === 'RateLimitError') {
      proxyError = new ProxyError(error.message, 'rate_limit_error', 429, context, true);
      proxyError.type = 'rate_limit_error';
      proxyError.details = {
        retryAfter: error.retryAfter,
        limit: error.limit,
        remaining: error.remaining
      };
    } else if (error.name === 'ValidationError') {
      proxyError = new ProxyError(error.message, 'invalid_request', 400, context);
      proxyError.type = 'validation_error';
      proxyError.details = error.validationErrors;
    } else {
      proxyError = new ProxyError(error.message || 'Internal server error', 'internal_error', 500, context);
      proxyError.type = 'proxy_error';
    }

    // Log error if monitor is available
    if (this.monitor) {
      this.monitor.logError(proxyError, context);
      this.monitor.incrementErrorCount(proxyError.type || 'unknown', context.endpoint);
    }

    return proxyError;
  }

  formatAnthropicError(proxyError: ProxyError): any {
    const typeMap: Record<string, string> = {
      'auth_error': 'authentication_error',
      'billing_error': 'permission_error',
      'rate_limit_error': 'rate_limit_error',
      'validation_error': 'invalid_request_error',
      'anthropic_error': 'api_error'
    };

    return {
      type: 'error',
      error: {
        type: typeMap[proxyError.type || 'unknown'] || 'api_error',
        message: proxyError.message
      }
    };
  }

  createErrorResponse(proxyError: ProxyError): Response {
    const anthropicError = this.formatAnthropicError(proxyError);
    
    const headers = new Headers({
      'Content-Type': 'application/json',
      'X-Request-ID': proxyError.requestId || ''
    });

    if (proxyError.details?.retryAfter) {
      headers.set('Retry-After', proxyError.details.retryAfter.toString());
    }

    return new Response(JSON.stringify(anthropicError), {
      status: proxyError.statusCode,
      headers
    });
  }

  createStreamingErrorChunk(proxyError: ProxyError): string {
    const anthropicError = this.formatAnthropicError(proxyError);
    return `data: ${JSON.stringify(anthropicError)}\n\n`;
  }

  async getErrorStats(timeRange: any): Promise<any> {
    if (this.monitor) {
      return await this.monitor.getErrorStats(timeRange);
    }
    return null;
  }

  async logCriticalError(proxyError: ProxyError, context: ErrorContext): Promise<void> {
    console.error('CRITICAL PROXY ERROR:', {
      error: proxyError,
      context
    });
  }

  static handle(error: Error, context: ErrorContext): ProxyError {
    if (error instanceof ProxyError) {
      return error;
    }

    if (error instanceof AnthropicAPIError) {
      return ProxyError.fromAnthropicError(error, context);
    }

    // Generic error
    return new ProxyError(
      error.message || 'Internal server error',
      'INTERNAL_ERROR',
      500,
      context,
      false
    );
  }

  static isRetryable(error: ProxyError): boolean {
    return error.retryable;
  }

  static shouldLog(error: ProxyError): boolean {
    return error.statusCode >= 500 || error.code === 'INTERNAL_ERROR';
  }

  static getRetryDelay(attempt: number): number {
    return Math.min(1000 * Math.pow(2, attempt), 30000); // Exponential backoff, max 30s
  }
}