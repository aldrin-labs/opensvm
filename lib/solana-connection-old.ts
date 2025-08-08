import { Connection, ConnectionConfig } from '@solana/web3.js';
import { getRpcEndpoints, getRpcHeaders } from './opensvm-rpc';
import { rateLimit, RateLimitError } from './rate-limit';

class ProxyConnection extends Connection {
  private requestQueue: Array<{
    resolve: (value: any) => void;
    reject: (error: any) => void;
    method: string;
    args: any[];
    retryCount: number;
  }> = [];
  private isProcessingQueue = false;
  private lastRequestTime = 0;
  private readonly minRequestInterval = 10; // Decreased from 25
  private readonly maxConcurrentRequests = 12; // Increased from 8
  private readonly maxRetries = 12; // Increased from 8
  private activeRequests = 0;

  constructor(endpoint: string, config?: ConnectionConfig) {
    // Proxy for opensvm.com endpoints is disabled; use the provided endpoint directly
    let finalEndpoint = endpoint;
    // Ensure endpoint is absolute with http or https
    if (!/^https?:\/\//i.test(finalEndpoint)) {
      if (typeof window !== 'undefined' && window.location.origin) {
        finalEndpoint = window.location.origin + finalEndpoint;
      } else if (process.env.NEXT_PUBLIC_BASE_URL) {
        finalEndpoint = process.env.NEXT_PUBLIC_BASE_URL + finalEndpoint;
      } else {
        throw new Error(`Invalid endpoint '${endpoint}': URL must start with http:// or https://`);
      }
    }

    // Proxy for opensvm.com endpoints is disabled; use the provided endpoint directly
    // ...existing code continues

    // Detect test environment for optimized timeouts
    const isTestEnv = process.env.NODE_ENV === 'test' ||
      process.env.PLAYWRIGHT_TEST === 'true' ||
      (typeof global !== 'undefined' && (global as any).__PLAYWRIGHT__);

    // Configure timeouts based on environment
    const timeoutConfig = isTestEnv ? {
      fetchTimeout: 3000,      // 3s for tests vs 15s for production
      maxRetries: 3,           // 3 retries vs 8 for production
      retryDelay: 200,         // 200ms vs 1000ms for production
      confirmTimeout: 10000    // 10s vs 45s for production
    } : {
      fetchTimeout: 15000,     // Increased from 8s to 15s for busy periods
      maxRetries: 8,           // Reduced from 12 to 8 for faster failure
      retryDelay: 1000,
      confirmTimeout: 45000    // Increased from 30s to 45s
    };

    super(finalEndpoint, {
      ...config,
      commitment: 'confirmed',
      disableRetryOnRateLimit: false,
      confirmTransactionInitialTimeout: timeoutConfig.confirmTimeout,
      wsEndpoint: undefined,
      fetch: async (url, options) => {
        const headers = getRpcHeaders(endpoint);
        let lastError;

        // Initialize after super() call
        // this._isClient = _isClient;

        for (let i = 0; i < timeoutConfig.maxRetries; i++) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutConfig.fetchTimeout);

            const response = await fetch(url, {
              ...options,
              headers: {
                ...headers,
                ...(options?.headers || {})
              },
              signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
              return response;
            }

            lastError = new Error(`HTTP error! status: ${response.status}`);
          } catch (error) {
            lastError = error;
            if (error instanceof Error && error.name === 'AbortError') {
              if (isTestEnv) {
                console.debug(`Request timed out after ${timeoutConfig.fetchTimeout}ms (test env), retrying...`);
              } else {
                console.warn('Request timed out, retrying...');
              }
            }
          }

          // Faster backoff for tests
          const baseDelay = isTestEnv ? timeoutConfig.retryDelay : 1000;
          const maxDelay = isTestEnv ? 1000 : 2000;
          const backoffMultiplier = isTestEnv ? 1.2 : 1.1;
          await new Promise(resolve => setTimeout(resolve, Math.min(baseDelay * Math.pow(backoffMultiplier, i), maxDelay)));
        }

        throw lastError;
      }
    });
  }

  private async processQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrentRequests) {
      const request = this.requestQueue.shift();
      if (!request) continue;

      this.activeRequests++;
      this.processRequest(request).finally(() => {
        this.activeRequests--;
        if (this.requestQueue.length > 0) {
          this.processQueue();
        }
      });
    }

    this.isProcessingQueue = this.activeRequests > 0;
  }

  private async processRequest(request: {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    method: string;
    args: any[];
    retryCount: number;
  }) {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      await new Promise(resolve => setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest));
    }

    try {
      const headers = getRpcHeaders(this.rpcEndpoint);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout to match API layer

      const response = await fetch(this.rpcEndpoint, {
        method: 'POST',
        headers: {
          ...headers
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: request.method,
          params: request.args
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = new Error(`HTTP error! status: ${response.status}`);
        if (response.status === 429 || response.status === 403) {
          if (request.retryCount < this.maxRetries) {
            console.warn(`Request failed with ${response.status}, retrying (${request.retryCount + 1}/${this.maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(1.1, request.retryCount), 2000))); // Changed from 1.25 to 1.1
            this.requestQueue.push({ ...request, retryCount: request.retryCount + 1 });
            return;
          }
        }
        throw error;
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message);
      }

      request.resolve(data.result);
    } catch (error) {
      if (error instanceof Error && request.retryCount < this.maxRetries) {
        console.warn(`Request failed, retrying (${request.retryCount + 1}/${this.maxRetries})...`, error);
        await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(1.1, request.retryCount), 2000))); // Changed from 1.25 to 1.1
        this.requestQueue.push({ ...request, retryCount: request.retryCount + 1 });
        return;
      }
      request.reject(error);
    }

    this.lastRequestTime = Date.now();
  }

  async _rpcRequest(method: string, args: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ resolve, reject, method, args, retryCount: 0 });
      this.processQueue();
    });
  }
}

class ConnectionPool {
  private static instance: ConnectionPool;
  private connections: ProxyConnection[] = [];
  private currentIndex = 0;
  private config: ConnectionConfig;
  private isOpenSvmMode = false;
  private failedEndpoints: Set<string> = new Set();
  private lastHealthCheck: number = 0;
  private readonly healthCheckInterval = 60000; // Decreased from 120000

  // Circuit breaker state
  private circuitBreakerState: Map<string, {
    failureCount: number;
    lastFailureTime: number;
    isOpen: boolean;
  }> = new Map();
  private readonly circuitBreakerThreshold = 3; // Failures before opening circuit
  private readonly circuitBreakerTimeout = 30000; // 30 seconds before trying again

  private constructor() {
    // Detect test environment for optimized configuration
    const isTestEnv = process.env.NODE_ENV === 'test' ||
      process.env.PLAYWRIGHT_TEST === 'true' ||
      (typeof global !== 'undefined' && (global as any).__PLAYWRIGHT__);

    this.config = {
      commitment: 'confirmed',
      disableRetryOnRateLimit: false,
      confirmTransactionInitialTimeout: isTestEnv ? 10000 : 30000, // 10s for tests, 30s for production
      wsEndpoint: undefined
    };

    this.isOpenSvmMode = true;
    this.initializeConnections();
  }

  public getConnectionCount(): number {
    return this.connections.length;
  }

  private initializeConnections() {
    const endpoints = getRpcEndpoints();
    this.connections = endpoints
      .filter(url => !this.failedEndpoints.has(url))
      .map(url => new ProxyConnection(url, this.config));

    // Only log during development or when explicitly needed
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG_RPC) {
      console.log('Initialized OpenSVM connection pool with', this.connections.length, 'endpoints');
    }
  }

  public static getInstance(): ConnectionPool {
    if (!ConnectionPool.instance) {
      ConnectionPool.instance = new ConnectionPool();
    }
    return ConnectionPool.instance;
  }

  public updateEndpoint(endpoint: string): void {
    // Always use OpenSVM RPC servers regardless of the provided endpoint
    console.log(`Endpoint update requested to ${endpoint}, enforcing OpenSVM RPC servers`);

    // Reset the connection pool to use OpenSVM endpoints
    this.isOpenSvmMode = true;
    this.failedEndpoints.clear();
    this.initializeConnections();
    this.currentIndex = 0;
  }

  private async testConnection(connection: ProxyConnection): Promise<boolean> {
    const endpoint = connection.rpcEndpoint;

    // Check circuit breaker state
    if (this.isCircuitBreakerOpen(endpoint)) {
      console.warn(`Circuit breaker is open for ${endpoint}`);
      return false;
    }

    // Detect test environment for faster health checks
    const isTestEnv = process.env.NODE_ENV === 'test' ||
      process.env.PLAYWRIGHT_TEST === 'true' ||
      (typeof global !== 'undefined' && (global as any).__PLAYWRIGHT__);
    const healthCheckTimeout = isTestEnv ? 2000 : 5000; // 2s for tests, 5s for production

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), healthCheckTimeout);
      const blockHeight = await connection.getBlockHeight();
      clearTimeout(timeoutId);

      // Reset circuit breaker on success
      this.resetCircuitBreaker(endpoint);
      return blockHeight > 0;
    } catch (error) {
      // Record failure in circuit breaker
      this.recordFailure(endpoint);

      if (error instanceof RateLimitError) {
        console.warn(`Rate limit hit during health check for ${endpoint}`);
        return true; // Don't fail just because of rate limit
      }
      if (error instanceof Error && error.name === 'AbortError') {
        if (isTestEnv) {
          console.debug(`Health check timed out for ${endpoint} (test env)`);
        } else {
          console.warn(`Health check timed out for ${endpoint}`);
        }
        return false;
      }
      console.error(`Error testing connection ${endpoint}:`, error);
      return false;
    }
  }

  /**
   * Check if circuit breaker is open for an endpoint
   */
  private isCircuitBreakerOpen(endpoint: string): boolean {
    const state = this.circuitBreakerState.get(endpoint);
    if (!state) return false;

    if (state.isOpen) {
      // Check if enough time has passed to try again
      const timeSinceLastFailure = Date.now() - state.lastFailureTime;
      if (timeSinceLastFailure > this.circuitBreakerTimeout) {
        state.isOpen = false;
        state.failureCount = 0;
        console.log(`Circuit breaker reset for ${endpoint}`);
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Record a failure for circuit breaker
   */
  private recordFailure(endpoint: string): void {
    const state = this.circuitBreakerState.get(endpoint) || {
      failureCount: 0,
      lastFailureTime: 0,
      isOpen: false
    };

    state.failureCount++;
    state.lastFailureTime = Date.now();

    if (state.failureCount >= this.circuitBreakerThreshold) {
      state.isOpen = true;
      console.warn(`Circuit breaker opened for ${endpoint} after ${state.failureCount} failures`);
    }

    this.circuitBreakerState.set(endpoint, state);
  }

  /**
   * Reset circuit breaker on successful connection
   */
  private resetCircuitBreaker(endpoint: string): void {
    const state = this.circuitBreakerState.get(endpoint);
    if (state && (state.failureCount > 0 || state.isOpen)) {
      console.log(`Circuit breaker reset for ${endpoint}`);
      this.circuitBreakerState.set(endpoint, {
        failureCount: 0,
        lastFailureTime: 0,
        isOpen: false
      });
    }
  }

  private async findHealthyConnection(): Promise<ProxyConnection | null> {
    const _startIndex = this.currentIndex;

    // Use _startIndex for connection rotation tracking and debugging
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG_CONNECTION) {
      console.log(`Starting connection health check from index: ${_startIndex}`);
      if (_startIndex < 0) {
        console.warn(`Negative start index detected: ${_startIndex}, resetting to 0`);
      }
    }
    let attempts = 0;
    const endpoints = getRpcEndpoints();

    while (attempts < this.connections.length) {
      const connection = this.connections[this.currentIndex];
      const endpoint = endpoints[this.currentIndex];

      try {
        const isHealthy = await this.testConnection(connection);
        if (isHealthy) {
          return connection;
        }

        console.warn(`Endpoint ${endpoint} failed health check`);
        this.failedEndpoints.add(endpoint);
      } catch (error) {
        console.error(`Error testing connection ${endpoint}:`, error);
        this.failedEndpoints.add(endpoint);
      }

      this.currentIndex = (this.currentIndex + 1) % this.connections.length;
      attempts++;
    }

    if (this.failedEndpoints.size === endpoints.length) {
      console.warn('All endpoints failed, resetting failed endpoints list');
      this.failedEndpoints.clear();
      this.initializeConnections();
    }

    return null;
  }

  public async getConnection(): Promise<Connection> {
    const now = Date.now();
    if (now - this.lastHealthCheck > this.healthCheckInterval) {
      this.lastHealthCheck = now;
      const healthyConnection = await this.findHealthyConnection();
      if (healthyConnection) {
        return healthyConnection;
      }
    }

    if (this.isOpenSvmMode && this.connections.length > 1) {
      // Try to find a connection that's not circuit broken
      let attempts = 0;
      const maxAttempts = this.connections.length;

      while (attempts < maxAttempts) {
        const connection = this.connections[this.currentIndex];
        const endpoint = connection.rpcEndpoint;

        // Skip if circuit breaker is open
        if (this.isCircuitBreakerOpen(endpoint)) {
          this.currentIndex = (this.currentIndex + 1) % this.connections.length;
          attempts++;
          continue;
        }

        try {
          await rateLimit(`rpc-${endpoint}`, {
            limit: 100, // Increased from 80
            windowMs: 1000,
            maxRetries: 20, // Increased from 15
            initialRetryDelay: 50, // Decreased from 100
            maxRetryDelay: 500 // Decreased from 1000
          });

          this.currentIndex = (this.currentIndex + 1) % this.connections.length;
          return connection;
        } catch (error) {
          this.recordFailure(endpoint);

          if (error instanceof RateLimitError) {
            console.warn(`Rate limit exceeded for ${endpoint}, switching endpoints`);
            this.currentIndex = (this.currentIndex + 1) % this.connections.length;
            attempts++;
            continue;
          }
          throw error;
        }
      }

      // If all connections are circuit broken, return the first one anyway
      console.warn('All connections are circuit broken, using first connection anyway');
      return this.connections[0];
    }

    const connection = this.connections[0];
    const endpoint = connection.rpcEndpoint;

    if (this.isCircuitBreakerOpen(endpoint)) {
      throw new Error(`All connections are circuit broken`);
    }

    try {
      await rateLimit(`rpc-single-${endpoint}`, {
        limit: 50, // Increased from 40
        windowMs: 1000,
        maxRetries: 20, // Increased from 15
        initialRetryDelay: 50, // Decreased from 100
        maxRetryDelay: 500 // Decreased from 1000
      });

      return connection;
    } catch (error) {
      this.recordFailure(endpoint);
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const connection = await this.getConnection();
      const blockHeight = await connection.getBlockHeight();
      return blockHeight > 0;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
}

export async function getConnection(): Promise<Connection> {
  return ConnectionPool.getInstance().getConnection();
}

export async function updateRpcEndpoint(endpoint: string): Promise<void> {
  ConnectionPool.getInstance().updateEndpoint(endpoint);
}

export const connectionPool = ConnectionPool.getInstance();
