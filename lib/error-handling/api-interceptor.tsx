'use client';

import React from 'react';
import { useErrorHandling, createApiError, createNetworkError } from './index';
import { useI18n } from '@/lib/i18n';
import { useRBAC } from '@/lib/rbac';

// HTTP status codes and their handling
const HTTP_STATUS_CODES = {
  // Client errors
  400: { severity: 'medium' as const, category: 'validation' as const },
  401: { severity: 'high' as const, category: 'authentication' as const },
  403: { severity: 'high' as const, category: 'authorization' as const },
  404: { severity: 'low' as const, category: 'api' as const },
  409: { severity: 'medium' as const, category: 'validation' as const },
  422: { severity: 'medium' as const, category: 'validation' as const },
  429: { severity: 'medium' as const, category: 'api' as const },
  
  // Server errors
  500: { severity: 'critical' as const, category: 'api' as const },
  502: { severity: 'high' as const, category: 'network' as const },
  503: { severity: 'high' as const, category: 'api' as const },
  504: { severity: 'high' as const, category: 'network' as const },
} as const;

// Retry configuration
interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBase: number;
  retryableStatuses: number[];
  retryableErrors: string[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  exponentialBase: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  retryableErrors: [
    'NetworkError',
    'TimeoutError',
    'AbortError',
    'TypeError', // Often network-related in fetch
  ],
};

// Enhanced fetch with error handling and retry logic
export class EnhancedFetch {
  private errorHandler: ReturnType<typeof useErrorHandling> | null = null;
  private i18n: ReturnType<typeof useI18n> | null = null;
  private rbac: ReturnType<typeof useRBAC> | null = null;
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  // Initialize with React hooks (call this in a component)
  initialize(
    errorHandler: ReturnType<typeof useErrorHandling>,
    i18n: ReturnType<typeof useI18n>,
    rbac: ReturnType<typeof useRBAC>
  ) {
    this.errorHandler = errorHandler;
    this.i18n = i18n;
    this.rbac = rbac;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private calculateDelay(attempt: number): number {
    const exponentialDelay = this.config.baseDelay * 
      Math.pow(this.config.exponentialBase, attempt - 1);
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * exponentialDelay;
    
    return Math.min(exponentialDelay + jitter, this.config.maxDelay);
  }

  private isRetryableStatus(status: number): boolean {
    return this.config.retryableStatuses.includes(status);
  }

  private isRetryableError(error: Error): boolean {
    return this.config.retryableErrors.some(errorType =>
      error.name === errorType || error.message.includes(errorType)
    );
  }

  private createErrorFromResponse(
    response: Response,
    endpoint: string,
    context?: Record<string, any>
  ) {
    const statusInfo = HTTP_STATUS_CODES[response.status as keyof typeof HTTP_STATUS_CODES];
    
    return createApiError(
      endpoint,
      response.status,
      response.statusText || `HTTP ${response.status}`,
    );
  }

  private handleAuthenticationError(response: Response) {
    if (response.status === 401 && this.rbac) {
      // Clear authentication and redirect to login
      this.rbac.clearAuthentication?.();
      
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  }

  private async makeRequest(
    url: string,
    options: RequestInit = {},
    attempt: number = 1
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      // Add authentication headers if available
      const headers = new Headers(options.headers);
      if (this.rbac?.currentUser?.accessToken) {
        headers.set('Authorization', `Bearer ${this.rbac.currentUser.accessToken}`);
      }

      // Add tenant context if available
      if (this.rbac?.currentTenant?.id) {
        headers.set('X-Tenant-ID', this.rbac.currentTenant.id);
      }

      // Add request tracking headers
      headers.set('X-Request-ID', `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
      headers.set('X-Attempt', attempt.toString());

      const requestOptions: RequestInit = {
        ...options,
        headers,
        signal: controller.signal,
      };

      const response = await fetch(url, requestOptions);
      clearTimeout(timeoutId);

      // Handle authentication errors immediately
      if (response.status === 401) {
        this.handleAuthenticationError(response);
      }

      // Check if we should retry
      if (!response.ok && attempt < this.config.maxAttempts) {
        if (this.isRetryableStatus(response.status)) {
          const delay = this.calculateDelay(attempt);
          await this.delay(delay);
          return this.makeRequest(url, options, attempt + 1);
        }
      }

      return response;
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      // Handle network errors
      if (error instanceof Error) {
        // Retry on retryable errors
        if (attempt < this.config.maxAttempts && this.isRetryableError(error)) {
          const delay = this.calculateDelay(attempt);
          await this.delay(delay);
          return this.makeRequest(url, options, attempt + 1);
        }

        // Report the error
        if (this.errorHandler) {
          if (error.name === 'AbortError') {
            this.errorHandler.reportError(createNetworkError(
              'Request timeout - the server took too long to respond',
              408
            ));
          } else {
            this.errorHandler.reportError(createNetworkError(
              error.message,
              0
            ));
          }
        }
      }

      throw error;
    }
  }

  async request<T = any>(
    url: string,
    options: RequestInit = {},
    parseResponse = true
  ): Promise<T> {
    try {
      const response = await this.makeRequest(url, options);

      // Handle successful responses
      if (response.ok) {
        if (!parseResponse) {
          return response as unknown as T;
        }

        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          return await response.json();
        } else {
          return await response.text() as unknown as T;
        }
      }

      // Handle error responses
      const errorInfo = this.createErrorFromResponse(response, url, {
        method: options.method || 'GET',
        status: response.status,
        statusText: response.statusText,
      });

      if (this.errorHandler) {
        this.errorHandler.reportError(errorInfo);
      }

      throw new Error(errorInfo.message);

    } catch (error) {
      // Re-throw if already handled
      if (error instanceof Error && this.errorHandler) {
        // Only report if not already reported in makeRequest
        if (!error.message.includes('Request timeout') && 
            !error.message.includes('Network')) {
          this.errorHandler.reportError(error, {
            endpoint: url,
            method: options.method || 'GET',
          });
        }
      }
      throw error;
    }
  }

  // Convenience methods
  async get<T = any>(url: string, options: RequestInit = {}): Promise<T> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  async post<T = any>(url: string, data?: any, options: RequestInit = {}): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  }

  async put<T = any>(url: string, data?: any, options: RequestInit = {}): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  }

  async patch<T = any>(url: string, data?: any, options: RequestInit = {}): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  }

  async delete<T = any>(url: string, options: RequestInit = {}): Promise<T> {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }
}

// Global instance
const enhancedFetch = new EnhancedFetch();

// Hook for using the enhanced fetch with error handling
export function useApiClient() {
  const errorHandler = useErrorHandling();
  const i18n = useI18n();
  const rbac = useRBAC();

  // Initialize the fetch client with hooks
  React.useEffect(() => {
    enhancedFetch.initialize(errorHandler, i18n, rbac);
  }, [errorHandler, i18n, rbac]);

  return enhancedFetch;
}

// Axios-like interceptors for existing codebases
export class ApiInterceptors {
  private static requestInterceptors: Array<(config: RequestInit) => RequestInit> = [];
  private static responseInterceptors: Array<(response: Response) => Response> = [];
  private static errorInterceptors: Array<(error: Error) => Promise<Error>> = [];

  static addRequestInterceptor(interceptor: (config: RequestInit) => RequestInit) {
    this.requestInterceptors.push(interceptor);
  }

  static addResponseInterceptor(interceptor: (response: Response) => Response) {
    this.responseInterceptors.push(interceptor);
  }

  static addErrorInterceptor(interceptor: (error: Error) => Promise<Error>) {
    this.errorInterceptors.push(interceptor);
  }

  static async processRequest(config: RequestInit): Promise<RequestInit> {
    return this.requestInterceptors.reduce((acc, interceptor) => {
      return interceptor(acc);
    }, config);
  }

  static async processResponse(response: Response): Promise<Response> {
    return this.responseInterceptors.reduce((acc, interceptor) => {
      return interceptor(acc);
    }, response);
  }

  static async processError(error: Error): Promise<Error> {
    for (const interceptor of this.errorInterceptors) {
      error = await interceptor(error);
    }
    return error;
  }
}

// Setup default interceptors
ApiInterceptors.addRequestInterceptor((config) => {
  // Add default headers
  const headers = new Headers(config.headers);
  headers.set('X-Requested-With', 'XMLHttpRequest');
  headers.set('Accept', 'application/json');
  
  return { ...config, headers };
});

ApiInterceptors.addResponseInterceptor((response) => {
  // Log successful requests in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`✓ ${response.status} ${response.url}`);
  }
  return response;
});

ApiInterceptors.addErrorInterceptor(async (error) => {
  // Log errors in development
  if (process.env.NODE_ENV === 'development') {
    console.error(`✗ API Error:`, error);
  }
  return error;
});

export { enhancedFetch as apiClient };