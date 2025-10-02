export interface TimeoutConfig {
  requestTimeout: number;        // Default: 30000ms (30s)
  streamingTimeout: number;      // Default: 120000ms (120s)
  connectionTimeout: number;     // Default: 10000ms (10s)
  retryAttempts: number;         // Default: 3
  retryDelay: number;           // Default: 1000ms
}

export interface HealthCheckResult {
  isHealthy: boolean;
  backend: 'openrouter' | 'anthropic';
  latency: number;
  timestamp: Date;
  error?: string;
}

export interface LoadTestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  requestsPerSecond: number;
  concurrentUsers: number;
}
