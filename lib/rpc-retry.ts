// RPC retry utilities with exponential backoff and health tracking

import { connectionPool } from './solana-connection-server';
import { INITIAL_BACKOFF_MS, MAX_RETRIES } from './transaction-constants';

export interface RetryOptions {
  maxRetries?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  timeoutMs?: number;
  onRetry?: (attempt: number, error: any) => void;
}

/**
 * Retry wrapper for RPC calls with exponential backoff
 * Tracks endpoint health for connection pool optimization
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  endpoint: string,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = MAX_RETRIES,
    initialBackoffMs = INITIAL_BACKOFF_MS,
    maxBackoffMs = 30000,
    timeoutMs = 60000,
    onRetry
  } = options;

  let lastError: any;
  let backoff = initialBackoffMs;
  const startTime = Date.now();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Check timeout
      if (Date.now() - startTime > timeoutMs) {
        throw new Error(`Operation timeout after ${timeoutMs}ms`);
      }

      const operationStartTime = Date.now();
      const result = await operation();
      const latency = Date.now() - operationStartTime;

      // Record success
      connectionPool.recordSuccess(endpoint, latency);

      return result;
    } catch (error: any) {
      lastError = error;

      // Record failure
      connectionPool.recordFailure(endpoint);

      // Check if error is retryable
      const isRetryable = isRetryableError(error);
      if (!isRetryable || attempt >= maxRetries) {
        throw error;
      }

      // Log retry
      if (onRetry) {
        onRetry(attempt + 1, error);
      }

      // Wait before retry with exponential backoff
      await new Promise(resolve => setTimeout(resolve, backoff));
      backoff = Math.min(backoff * 2, maxBackoffMs);
    }
  }

  throw lastError;
}

/**
 * Determine if an error is retryable (transient network errors)
 */
function isRetryableError(error: any): boolean {
  if (!error) return false;

  const errorMessage = error.message?.toLowerCase() || '';
  const errorCode = error.code?.toUpperCase() || '';

  // Network-level transient errors
  const retryablePatterns = [
    'econnreset',
    'econnrefused',
    'socket hang up',
    'network error',
    'timeout',
    'etimedout',
    'enotfound',
    'ehostunreach',
    'enetunreach',
    'epipe',
    '429', // Rate limit
    'too many requests',
    'service unavailable',
    'bad gateway',
    '502',
    '503',
    '504'
  ];

  return retryablePatterns.some(pattern =>
    errorMessage.includes(pattern) || errorCode.includes(pattern)
  );
}

/**
 * Create a timeout promise that rejects after specified time
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage?: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage || `Timeout after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}
