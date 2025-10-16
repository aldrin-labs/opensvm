import { TimeoutConfig } from '../types/ConfigTypes';

/**
 * Default timeout configuration for Anthropic proxy
 */
const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
  requestTimeout: 30000,        // 30 seconds
  streamingTimeout: 120000,     // 120 seconds
  connectionTimeout: 10000,     // 10 seconds
  retryAttempts: 3,
  retryDelay: 1000,            // 1 second
};

/**
 * Get validated timeout configuration from environment or use defaults
 */
export function getValidatedTimeoutConfig(): TimeoutConfig {
  return {
    requestTimeout: parseInt(process.env.ANTHROPIC_REQUEST_TIMEOUT || '') || DEFAULT_TIMEOUT_CONFIG.requestTimeout,
    streamingTimeout: parseInt(process.env.ANTHROPIC_STREAMING_TIMEOUT || '') || DEFAULT_TIMEOUT_CONFIG.streamingTimeout,
    connectionTimeout: parseInt(process.env.ANTHROPIC_CONNECTION_TIMEOUT || '') || DEFAULT_TIMEOUT_CONFIG.connectionTimeout,
    retryAttempts: parseInt(process.env.ANTHROPIC_RETRY_ATTEMPTS || '') || DEFAULT_TIMEOUT_CONFIG.retryAttempts,
    retryDelay: parseInt(process.env.ANTHROPIC_RETRY_DELAY || '') || DEFAULT_TIMEOUT_CONFIG.retryDelay,
  };
}
