import { HealthCheckResult } from '../types/ConfigTypes';

export class HealthChecker {
  private lastCheck: Map<string, HealthCheckResult>;
  private checkInterval: number;
  private openRouterApiUrl: string = 'https://openrouter.ai/api/v1';

  constructor(checkInterval: number = 60000) {
    this.lastCheck = new Map();
    this.checkInterval = checkInterval;
  }

  /**
   * Check OpenRouter API health
   * @returns Health check result with latency and status
   */
  async checkOpenRouterHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const backend = 'openrouter';

    try {
      // Create AbortController with 5 second timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        // Try to fetch the models list as a health check
        const response = await fetch(`${this.openRouterApiUrl}/models`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeout);
        const latency = Date.now() - startTime;
        const isHealthy = response.ok;

        const result: HealthCheckResult = {
          isHealthy,
          backend,
          latency,
          timestamp: new Date(),
        };

        if (!isHealthy) {
          result.error = `HTTP ${response.status}: ${response.statusText}`;
        }

        this.lastCheck.set(backend, result);
        return result;
      } catch (fetchError) {
        clearTimeout(timeout);
        throw fetchError;
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      const result: HealthCheckResult = {
        isHealthy: false,
        backend,
        latency,
        timestamp: new Date(),
        error: error instanceof Error && error.name === 'AbortError'
          ? 'Connection timeout after 5000ms'
          : error instanceof Error ? error.message : 'Unknown error',
      };

      this.lastCheck.set(backend, result);
      return result;
    }
  }

  /**
   * Check Anthropic API health (direct)
   * @returns Health check result with latency and status
   */
  async checkAnthropicHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const backend = 'anthropic';

    try {
      // Create AbortController with 5 second timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        // Try to fetch the Anthropic API health endpoint
        const response = await fetch('https://api.anthropic.com/v1/models', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
          },
          signal: controller.signal,
        });

        clearTimeout(timeout);
        const latency = Date.now() - startTime;
        
        // Anthropic API might return 401 without auth, which still indicates it's up
        const isHealthy = response.ok || response.status === 401;

        const result: HealthCheckResult = {
          isHealthy,
          backend,
          latency,
          timestamp: new Date(),
        };

        if (!isHealthy) {
          result.error = `HTTP ${response.status}: ${response.statusText}`;
        }

        this.lastCheck.set(backend, result);
        return result;
      } catch (fetchError) {
        clearTimeout(timeout);
        throw fetchError;
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      const result: HealthCheckResult = {
        isHealthy: false,
        backend,
        latency,
        timestamp: new Date(),
        error: error instanceof Error && error.name === 'AbortError'
          ? 'Connection timeout after 5000ms'
          : error instanceof Error ? error.message : 'Unknown error',
      };

      this.lastCheck.set(backend, result);
      return result;
    }
  }

  /**
   * Get health status for all backends
   * @returns Array of health check results
   */
  async getAllHealthStatus(): Promise<HealthCheckResult[]> {
    const [openRouterHealth, anthropicHealth] = await Promise.all([
      this.checkOpenRouterHealth(),
      this.checkAnthropicHealth(),
    ]);

    return [openRouterHealth, anthropicHealth];
  }

  /**
   * Get cached health status for a specific backend
   * @param backend Backend name
   * @returns Cached health check result or null if not available
   */
  getCachedHealth(backend: string): HealthCheckResult | null {
    return this.lastCheck.get(backend) || null;
  }

  /**
   * Clear all cached health check results
   */
  clearCache(): void {
    this.lastCheck.clear();
  }

  /**
   * Check if a cached result is still fresh
   * @param backend Backend name
   * @returns True if the cached result is still within the check interval
   */
  isCacheFresh(backend: string): boolean {
    const cached = this.lastCheck.get(backend);
    if (!cached) return false;

    const age = Date.now() - cached.timestamp.getTime();
    return age < this.checkInterval;
  }
}
