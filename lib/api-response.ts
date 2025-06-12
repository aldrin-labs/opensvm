/**
 * Standardized API Response Format
 * 
 * Provides consistent error and success response structures across all API endpoints
 */

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp?: number;
}

export interface ApiSuccess<T = any> {
  success: true;
  data: T;
  timestamp?: number;
}

export interface ApiFailure {
  success: false;
  error: ApiError;
  timestamp?: number;
}

export type ApiResponse<T = any> = ApiSuccess<T> | ApiFailure;

/**
 * Create standardized success response
 */
export function createSuccessResponse<T>(data: T): ApiSuccess<T> {
  return {
    success: true,
    data,
    timestamp: Date.now()
  };
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  code: string, 
  message: string, 
  details?: any,
  status: number = 500
): { response: ApiFailure; status: number } {
  return {
    response: {
      success: false,
      error: {
        code,
        message,
        details,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    },
    status
  };
}

/**
 * Common error codes
 */
export const ErrorCodes = {
  // Client errors (4xx)
  INVALID_REQUEST: 'INVALID_REQUEST',
  INVALID_JSON: 'INVALID_JSON', 
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  CLIENT_BLOCKED: 'CLIENT_BLOCKED',
  
  // Server errors (5xx)
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  PROCESSING_FAILED: 'PROCESSING_FAILED'
} as const;

/**
 * Create common error responses
 */
export const CommonErrors = {
  invalidJson: (details?: any) => createErrorResponse(
    ErrorCodes.INVALID_JSON, 
    'Invalid JSON format in request body', 
    details, 
    400
  ),
  
  missingField: (field: string) => createErrorResponse(
    ErrorCodes.MISSING_REQUIRED_FIELD, 
    `Missing required field: ${field}`, 
    { field }, 
    400
  ),
  
  unauthorized: (reason?: string) => createErrorResponse(
    ErrorCodes.UNAUTHORIZED, 
    'Authentication required', 
    { reason }, 
    401
  ),
  
  forbidden: (reason?: string) => createErrorResponse(
    ErrorCodes.FORBIDDEN, 
    'Access forbidden', 
    { reason }, 
    403
  ),
  
  rateLimit: (retryAfter?: number, remainingTokens?: number) => createErrorResponse(
    ErrorCodes.RATE_LIMIT_EXCEEDED, 
    'Rate limit exceeded', 
    { retryAfter, remainingTokens }, 
    429
  ),
  
  clientBlocked: (reason?: string) => createErrorResponse(
    ErrorCodes.CLIENT_BLOCKED, 
    'Client blocked due to policy violations', 
    { reason }, 
    403
  ),
  
  internalError: (details?: any) => createErrorResponse(
    ErrorCodes.INTERNAL_SERVER_ERROR, 
    'Internal server error', 
    process.env.NODE_ENV === 'development' ? details : undefined, 
    500
  )
};