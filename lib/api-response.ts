/**
 * API Response Utilities
 * Standardized response formatting for API endpoints
 */

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: number;
}

export const ErrorCodes = {
  INVALID_REQUEST: 'INVALID_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CLIENT_BLOCKED: 'CLIENT_BLOCKED',
  WEBSOCKET_NOT_SUPPORTED: 'WEBSOCKET_NOT_SUPPORTED'
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export function createSuccessResponse<T>(data: T): APIResponse<T> {
  return {
    success: true,
    data,
    timestamp: Date.now()
  };
}

export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: any,
  statusCode?: number
): { response: APIResponse; status: number } {
  return {
    response: {
      success: false,
      error: {
        code,
        message,
        details
      },
      timestamp: Date.now()
    },
    status: statusCode || 500
  };
}

export const CommonErrors = {
  invalidJson: (error?: any) => createErrorResponse(
    ErrorCodes.VALIDATION_ERROR,
    'Invalid JSON in request body',
    error,
    400
  ),

  missingField: (field: string) => createErrorResponse(
    ErrorCodes.VALIDATION_ERROR,
    `Missing required field: ${field}`,
    { field },
    400
  ),

  unauthorized: (message: string = 'Unauthorized') => createErrorResponse(
    ErrorCodes.UNAUTHORIZED,
    message,
    undefined,
    401
  ),

  forbidden: (message: string = 'Forbidden') => createErrorResponse(
    ErrorCodes.FORBIDDEN,
    message,
    undefined,
    403
  ),

  notFound: (resource: string = 'Resource') => createErrorResponse(
    ErrorCodes.NOT_FOUND,
    `${resource} not found`,
    undefined,
    404
  ),

  rateLimit: (retryAfter?: number, remainingTokens?: number) => createErrorResponse(
    ErrorCodes.RATE_LIMITED,
    'Rate limit exceeded',
    { retryAfter, remainingTokens },
    429
  ),

  clientBlocked: (message: string = 'Client is blocked') => createErrorResponse(
    ErrorCodes.CLIENT_BLOCKED,
    message,
    undefined,
    403
  ),

  internalError: (error?: any) => createErrorResponse(
    ErrorCodes.INTERNAL_ERROR,
    'Internal server error',
    process.env.NODE_ENV === 'development' ? error : undefined,
    500
  ),

  validationError: (errors: any) => createErrorResponse(
    ErrorCodes.VALIDATION_ERROR,
    'Validation failed',
    errors,
    400
  )
};
