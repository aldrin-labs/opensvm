import { AnthropicAPIError } from '../types/AnthropicTypes';

export interface ErrorContext {
  userId?: string;
  apiKeyId?: string;
  requestId?: string;
  model?: string;
  timestamp: number;
  userAgent?: string;
  ip?: string;
}

export class ProxyError extends Error {
  public code: string;
  public statusCode: number;
  public context: ErrorContext;
  public retryable: boolean;

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