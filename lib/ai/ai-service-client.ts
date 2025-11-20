/**
 * AI Service Client with Retry Logic, Circuit Breaker, and Timeout Handling
 * 
 * This module provides a robust client for calling AI services with:
 * - Configurable timeouts
 * - Exponential backoff retry logic
 * - Circuit breaker pattern to prevent cascading failures
 * - Request queuing and rate limiting
 * - Comprehensive error handling
 */

export interface AIServiceConfig {
  baseTimeout: number;           // Base timeout in milliseconds (default: 30000)
  maxRetries: number;             // Maximum retry attempts (default: 3)
  retryDelay: number;             // Initial retry delay in milliseconds (default: 1000)
  circuitBreakerThreshold: number; // Failures before opening circuit (default: 5)
  circuitBreakerTimeout: number;  // Time before retrying after circuit opens (default: 60000)
  enableCircuitBreaker: boolean;  // Enable/disable circuit breaker (default: true)
}

export interface AIServiceResponse {
  success: boolean;
  data?: any;
  error?: string;
  isTimeout?: boolean;
  isCached?: boolean;
  retryCount?: number;
  responseTime?: number;
}

enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Too many failures, blocking requests
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private successCount: number = 0;

  constructor(
    private threshold: number,
    private timeout: number
  ) {}

  canMakeRequest(): boolean {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.OPEN) {
      // Check if enough time has passed to try again
      if (Date.now() - this.lastFailureTime >= this.timeout) {
        console.log('🔄 Circuit breaker: Entering HALF_OPEN state');
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        return true;
      }
      return false;
    }

    // HALF_OPEN state
    return true;
  }

  recordSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      // After 2 successful requests in HALF_OPEN, close the circuit
      if (this.successCount >= 2) {
        console.log('✅ Circuit breaker: Closing circuit (service recovered)');
        this.state = CircuitState.CLOSED;
      }
    }
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      console.log('🔴 Circuit breaker: Opening circuit (service still failing)');
      this.state = CircuitState.OPEN;
    } else if (this.failureCount >= this.threshold) {
      console.log(`🔴 Circuit breaker: Opening circuit (${this.failureCount} failures)`);
      this.state = CircuitState.OPEN;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}

export class AIServiceClient {
  private config: AIServiceConfig;
  private circuitBreaker: CircuitBreaker | null = null;
  private requestCache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(config?: Partial<AIServiceConfig>) {
    this.config = {
      baseTimeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 60000,
      enableCircuitBreaker: true,
      ...config
    };

    if (this.config.enableCircuitBreaker) {
      this.circuitBreaker = new CircuitBreaker(
        this.config.circuitBreakerThreshold,
        this.config.circuitBreakerTimeout
      );
    }
  }

  /**
   * Call the AI service with retry logic and error handling
   */
  async callAIService(
    endpoint: string,
    payload: any,
    options?: { timeout?: number; skipCache?: boolean }
  ): Promise<AIServiceResponse> {
    const startTime = Date.now();
    const cacheKey = this.getCacheKey(endpoint, payload);

    // Check cache first (unless skipCache is true)
    if (!options?.skipCache) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        console.log('✅ Returning cached AI response');
        return {
          success: true,
          data: cached,
          isCached: true,
          responseTime: Date.now() - startTime
        };
      }
    }

    // Check circuit breaker
    if (this.circuitBreaker && !this.circuitBreaker.canMakeRequest()) {
      console.error('🔴 Circuit breaker is OPEN, blocking request');
      return {
        success: false,
        error: 'AI service is temporarily unavailable. Please try again in a moment.',
        isTimeout: false,
        responseTime: Date.now() - startTime
      };
    }

    // Perform request with retry logic
    let lastError: Error | null = null;
    const timeout = options?.timeout || this.config.baseTimeout;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        console.log(`🔄 AI service call attempt ${attempt + 1}/${this.config.maxRetries + 1}`);
        
        const result = await this.makeRequest(endpoint, payload, timeout);
        
        // Success - update circuit breaker and cache
        if (this.circuitBreaker) {
          this.circuitBreaker.recordSuccess();
        }
        
        this.setCache(cacheKey, result);
        
        return {
          success: true,
          data: result,
          retryCount: attempt,
          responseTime: Date.now() - startTime
        };
      } catch (error) {
        lastError = error as Error;
        
        console.error(`❌ AI service call failed (attempt ${attempt + 1}):`, lastError.message);

        // Record failure in circuit breaker
        if (this.circuitBreaker) {
          this.circuitBreaker.recordFailure();
        }

        // Don't retry if circuit breaker opened
        if (this.circuitBreaker && this.circuitBreaker.getState() === CircuitState.OPEN) {
          break;
        }

        // Don't retry on last attempt
        if (attempt < this.config.maxRetries) {
          // Exponential backoff: delay = retryDelay * 2^attempt
          const delay = this.config.retryDelay * Math.pow(2, attempt);
          console.log(`⏳ Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    // All retries failed
    const isTimeout = (lastError?.name === 'AbortError' || lastError?.message.includes('timeout')) ?? false;
    
    return {
      success: false,
      error: this.formatError(lastError, isTimeout),
      isTimeout,
      retryCount: this.config.maxRetries,
      responseTime: Date.now() - startTime
    };
  }

  /**
   * Make a single request with timeout
   */
  private async makeRequest(endpoint: string, payload: any, timeout: number): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 504) {
          throw new Error('Gateway Timeout: The AI service took too long to respond');
        }
        if (response.status === 503) {
          throw new Error('Service Unavailable: The AI service is temporarily down');
        }
        if (response.status === 429) {
          throw new Error('Rate Limit Exceeded: Too many requests');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Handle different response types
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Format error messages for user display
   */
  private formatError(error: Error | null, isTimeout: boolean): string {
    if (!error) {
      return 'Unknown error occurred';
    }

    if (isTimeout) {
      return 'Request timed out. The AI service is taking too long to respond. Please try again.';
    }

    if (error.message.includes('fetch') || error.message.includes('network')) {
      return 'Network error. Please check your connection and try again.';
    }

    if (error.message.includes('504') || error.message.includes('Gateway Timeout')) {
      return 'The AI service is experiencing high load. Please try again in a moment.';
    }

    if (error.message.includes('503') || error.message.includes('Service Unavailable')) {
      return 'The AI service is temporarily unavailable. Please try again later.';
    }

    if (error.message.includes('429') || error.message.includes('Rate Limit')) {
      return 'Too many requests. Please wait a moment before trying again.';
    }

    return `An error occurred: ${error.message}`;
  }

  /**
   * Cache management
   */
  private getCacheKey(endpoint: string, payload: any): string {
    return `${endpoint}:${JSON.stringify(payload)}`;
  }

  private getFromCache(key: string): any | null {
    const cached = this.requestCache.get(key);
    if (!cached) return null;

    // Check if expired
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.requestCache.delete(key);
      return null;
    }

    return cached.data;
  }

  private setCache(key: string, data: any): void {
    // Limit cache size
    if (this.requestCache.size > 100) {
      const firstKey = this.requestCache.keys().next().value;
      if (firstKey) this.requestCache.delete(firstKey);
    }

    this.requestCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus() {
    return this.circuitBreaker ? this.circuitBreaker.getStats() : null;
  }

  /**
   * Reset circuit breaker (for testing or manual intervention)
   */
  resetCircuitBreaker(): void {
    if (this.circuitBreaker) {
      this.circuitBreaker = new CircuitBreaker(
        this.config.circuitBreakerThreshold,
        this.config.circuitBreakerTimeout
      );
      console.log('🔄 Circuit breaker reset');
    }
  }

  /**
   * Helper: Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance with default configuration
export const aiServiceClient = new AIServiceClient();

// Export factory for custom configurations
export function createAIServiceClient(config?: Partial<AIServiceConfig>): AIServiceClient {
  return new AIServiceClient(config);
}
