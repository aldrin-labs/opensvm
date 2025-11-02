/**
 * Retry logic with exponential backoff for AI endpoints
 * Handles rate limiting and transient failures gracefully
 */

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  jitter?: boolean;
  onRetry?: (attempt: number, delay: number, error: any) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffFactor: 2,
  jitter: true,
  onRetry: () => {}
};

/**
 * Calculate delay with exponential backoff
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  backoffFactor: number,
  maxDelay: number,
  jitter: boolean
): number {
  // Exponential backoff: delay = initialDelay * (backoffFactor ^ attempt)
  let delay = initialDelay * Math.pow(backoffFactor, attempt);
  
  // Cap at maxDelay
  delay = Math.min(delay, maxDelay);
  
  // Add jitter to prevent thundering herd
  if (jitter) {
    // Random factor between 0.5 and 1.5
    const jitterFactor = 0.5 + Math.random();
    delay = Math.floor(delay * jitterFactor);
  }
  
  return delay;
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: any): boolean {
  // Retry on rate limiting (429)
  if (error.status === 429) return true;
  
  // Retry on server errors (500-599)
  if (error.status >= 500 && error.status < 600) return true;
  
  // Retry on timeout or network errors
  if (error.code === 'ECONNRESET' || 
      error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNREFUSED') return true;
  
  // Retry on specific AI provider errors
  if (error.message?.includes('rate_limit_exceeded') ||
      error.message?.includes('model_overloaded') ||
      error.message?.includes('timeout')) return true;
  
  return false;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      // Try to execute the function
      return await fn();
      
    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      if (attempt === opts.maxRetries || !isRetryableError(error)) {
        throw error;
      }
      
      // Calculate delay for next attempt
      const delay = calculateDelay(
        attempt,
        opts.initialDelay,
        opts.backoffFactor,
        opts.maxDelay,
        opts.jitter
      );
      
      // Check if we have a specific retry-after header (for rate limiting)
      let actualDelay = delay;
      const retryAfter = (error as any).retryAfter;
      if (retryAfter) {
        // Use the server's suggested retry time if available
        actualDelay = Math.max(delay, retryAfter * 1000);
      }
      
      // Call retry callback
      opts.onRetry(attempt + 1, actualDelay, error);
      
      // Wait before retrying
      await sleep(actualDelay);
    }
  }
  
  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Retry decorator for class methods
 */
export function Retry(options?: RetryOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      return withRetry(
        () => originalMethod.apply(this, args),
        options
      );
    };
    
    return descriptor;
  };
}

/**
 * Create a retry wrapper with custom options
 */
export function createRetryWrapper(options?: RetryOptions) {
  return <T>(fn: () => Promise<T>) => withRetry(fn, options);
}

/**
 * Specialized retry for AI API calls
 */
export const aiRetry = createRetryWrapper({
  maxRetries: 3,
  initialDelay: 2000, // Start with 2 seconds for AI APIs
  maxDelay: 60000, // Max 1 minute
  backoffFactor: 2,
  jitter: true,
  onRetry: (attempt, delay, error) => {
    console.log(`[AI Retry] Attempt ${attempt} after ${delay}ms delay. Error:`, {
      status: error.status,
      message: error.message,
      retryAfter: error.retryAfter
    });
  }
});

/**
 * Extract retry-after from error response
 */
export function extractRetryAfter(error: any): number | null {
  // Check headers for Retry-After
  if (error.headers?.['retry-after']) {
    const retryAfter = error.headers['retry-after'];
    // Could be seconds or HTTP date
    const seconds = parseInt(retryAfter);
    if (!isNaN(seconds)) {
      return seconds;
    }
  }
  
  // Check response body
  if (error.response?.retryAfter) {
    return error.response.retryAfter;
  }
  
  // Check for rate limit reset time
  if (error.headers?.['x-ratelimit-reset']) {
    const resetTime = parseInt(error.headers['x-ratelimit-reset']);
    if (!isNaN(resetTime)) {
      // Calculate seconds until reset
      const now = Math.floor(Date.now() / 1000);
      return Math.max(0, resetTime - now);
    }
  }
  
  return null;
}
