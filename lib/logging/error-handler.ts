/**
 * Centralized Error Handling Utility
 * Provides consistent error messages and handling across the platform
 */

export interface AppError {
  code: string;
  message: string;
  details?: string;
  recoverable: boolean;
  userMessage: string;
}

export class BlockchainError extends Error {
  code: string;
  recoverable: boolean;
  userMessage: string;
  
  constructor(code: string, message: string, recoverable = true) {
    super(message);
    this.name = 'BlockchainError';
    this.code = code;
    this.recoverable = recoverable;
    this.userMessage = this.getUserFriendlyMessage(code);
  }
  
  private getUserFriendlyMessage(code: string): string {
    const messages: Record<string, string> = {
      'NETWORK_ERROR': 'Unable to connect to the Solana network. Please check your internet connection.',
      'RPC_ERROR': 'The blockchain node is experiencing issues. Please try again in a moment.',
      'TRANSACTION_FAILED': 'The transaction failed to process. This might be due to insufficient funds or network congestion.',
      'ACCOUNT_NOT_FOUND': 'The account you\'re looking for doesn\'t exist on the blockchain.',
      'INVALID_ADDRESS': 'The provided address is not a valid Solana address.',
      'TIMEOUT': 'The request timed out. The network might be congested.',
      'RATE_LIMIT': 'Too many requests. Please wait a moment and try again.',
      'INSUFFICIENT_FUNDS': 'Insufficient SOL balance to complete this transaction.',
      'SIGNATURE_VERIFICATION_FAILED': 'Failed to verify the transaction signature.',
      'UNKNOWN': 'An unexpected error occurred. Please try again.',
    };
    
    return messages[code] || messages['UNKNOWN'];
  }
}

/**
 * Parse and categorize errors from various sources
 */
export function parseError(error: unknown): AppError {
  // Handle BlockchainError instances
  if (error instanceof BlockchainError) {
    return {
      code: error.code,
      message: error.message,
      recoverable: error.recoverable,
      userMessage: error.userMessage,
    };
  }
  
  // Handle standard Error objects
  if (error instanceof Error) {
    // Check for specific error patterns
    if (error.message.includes('fetch')) {
      return {
        code: 'NETWORK_ERROR',
        message: error.message,
        recoverable: true,
        userMessage: 'Network connection error. Please check your internet connection.',
      };
    }
    
    if (error.message.includes('timeout') || error.message.includes('timed out')) {
      return {
        code: 'TIMEOUT',
        message: error.message,
        recoverable: true,
        userMessage: 'Request timed out. Please try again.',
      };
    }
    
    if (error.message.includes('rate limit')) {
      return {
        code: 'RATE_LIMIT',
        message: error.message,
        recoverable: true,
        userMessage: 'Too many requests. Please wait a moment.',
      };
    }
    
    // Generic error
    return {
      code: 'UNKNOWN',
      message: error.message,
      recoverable: true,
      userMessage: error.message || 'An unexpected error occurred.',
    };
  }
  
  // Handle string errors
  if (typeof error === 'string') {
    return {
      code: 'UNKNOWN',
      message: error,
      recoverable: true,
      userMessage: error,
    };
  }
  
  // Handle unknown error types
  return {
    code: 'UNKNOWN',
    message: 'An unknown error occurred',
    recoverable: true,
    userMessage: 'An unexpected error occurred. Please try again.',
  };
}

/**
 * Format error for logging
 */
export function formatErrorForLogging(error: AppError): string {
  return `[${error.code}] ${error.message}${error.details ? ` - ${error.details}` : ''}`;
}

/**
 * Determine if error should be reported to error tracking service
 */
export function shouldReportError(error: AppError): boolean {
  // Don't report user errors or expected failures
  const nonReportableCodes = [
    'INVALID_ADDRESS',
    'ACCOUNT_NOT_FOUND',
    'RATE_LIMIT',
  ];
  
  return !nonReportableCodes.includes(error.code);
}

/**
 * Success message templates
 */
export const SUCCESS_MESSAGES = {
  TRANSACTION_SENT: 'Transaction sent successfully!',
  WALLET_CONNECTED: 'Wallet connected successfully.',
  SETTINGS_SAVED: 'Settings saved successfully.',
  FILE_UPLOADED: 'File uploaded successfully.',
  DATA_SAVED: 'Data saved successfully.',
  COPY_SUCCESS: 'Copied to clipboard!',
} as const;

/**
 * Get appropriate retry delay based on error type
 */
export function getRetryDelay(error: AppError, attemptNumber: number): number {
  const baseDelay = error.code === 'RATE_LIMIT' ? 5000 : 1000;
  
  // Exponential backoff with max delay of 30 seconds
  return Math.min(baseDelay * Math.pow(2, attemptNumber - 1), 30000);
}

/**
 * Format error for user display
 */
export function formatUserError(error: unknown, context?: string): string {
  const appError = parseError(error);
  
  if (context) {
    return `${context}: ${appError.userMessage}`;
  }
  
  return appError.userMessage;
}

/**
 * Create a retry handler with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  onError?: (error: AppError, attempt: number) => void
): Promise<T> {
  let lastError: AppError | null = null;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = parseError(error);
      
      // Call error callback if provided
      if (onError) {
        onError(lastError, attempt);
      }
      
      // Don't retry if error is not recoverable or it's the last attempt
      if (!lastError.recoverable || attempt === maxAttempts) {
        break;
      }
      
      // Wait before retrying
      const delay = getRetryDelay(lastError, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // If we get here, all attempts failed
  throw new BlockchainError(
    lastError?.code || 'UNKNOWN',
    `Failed after ${maxAttempts} attempts: ${lastError?.message}`,
    false
  );
}
