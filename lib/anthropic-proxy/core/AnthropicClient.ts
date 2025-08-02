import {
  AnthropicRequest,
  AnthropicResponse,
  AnthropicError,
  AnthropicStreamChunk,
  ANTHROPIC_HEADERS,
  KeyUsageStats,
  ModelsResponse,
  UsageStatsResponse
} from '../types/AnthropicTypes';
import { Mutex } from 'async-mutex';

// OpenRouter specific types
interface OpenRouterRequest {
  model: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop?: string[];
  stream?: boolean;
  provider?: {
    order: string[];
    allow_fallbacks?: boolean;
  };
}

interface OpenRouterResponse {
  id: string;
  model: string;
  object: string;
  created: number;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenRouterStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      content?: string;
      role?: string;
    };
    finish_reason: string | null;
  }>;
}

/**
 * HTTP client for forwarding requests to OpenRouter (which then forwards to Anthropic)
 */
export class AnthropicClient {
  private apiKey: string;
  private openRouterApiKeys: string[];
  private currentKeyIndex: number = 0;
  private baseUrl: string;
  private keyUsageCount: Map<string, number> = new Map();
  private keyLastUsed: Map<string, number> = new Map();
  private failedKeys: Set<string> = new Set();
  private readonly keyMutex = new Mutex();
  private readonly debug = process.env.NODE_ENV === 'development';

  // Model mapping from Anthropic names to OpenRouter names
  private modelMapping: Record<string, string> = {
    'claude-3-sonnet-20240229': 'anthropic/claude-3.5-sonnet',
    'claude-3-opus-20240229': 'anthropic/claude-3-opus',
    'claude-3-haiku-20240307': 'anthropic/claude-3-haiku',
    // Support for newer model versions
    'claude-3-sonnet-4': 'anthropic/claude-3.5-sonnet',
    'claude-3-opus-4': 'anthropic/claude-3-opus'
  };

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY || '';

    // Support multiple OpenRouter keys separated by commas
    const keysFromEnv = process.env.OPENROUTER_API_KEYS || process.env.OPENROUTER_API_KEY || '';
    const parsedKeys = keysFromEnv
      .split(',')
      .map(key => key.trim())
      .filter(key => key.length > 0 && key !== '""' && key !== "''" && key !== 'null' && key !== 'undefined');

    // Remove duplicates while preserving order
    this.openRouterApiKeys = [...new Set(parsedKeys)];

    // Use provided baseUrl or default to OpenRouter
    this.baseUrl = baseUrl || 'https://openrouter.ai/api/v1';

    if (this.openRouterApiKeys.length === 0) {
      throw new Error('At least one OpenRouter API key is required');
    }

    // Validate all API keys
    const invalidKeys = this.openRouterApiKeys.filter(key => !this.validateApiKeyFormat(key));
    if (invalidKeys.length > 0) {
      throw new Error(`Invalid OpenRouter API key format. Keys should start with 'sk-or-v1-'`);
    }

    // Log if duplicates were removed
    if (parsedKeys.length !== this.openRouterApiKeys.length) {
      this.log(`Removed ${parsedKeys.length - this.openRouterApiKeys.length} duplicate API key(s)`);
    }

    this.log(`Initialized with ${this.openRouterApiKeys.length} OpenRouter API key(s)`);
  }

  /**
   * Validate OpenRouter API key format
   */
  private validateApiKeyFormat(key: string): boolean {
    return /^sk-or-v1-[a-zA-Z0-9]+$/.test(key);
  }

  /**
   * Secure logging that doesn't expose sensitive data
   */
  private log(message: string): void {
    if (this.debug) {
      console.log(`[AnthropicClient] ${message}`);
    }
  }

  /**
   * Clean up old entries to prevent memory leaks
   * Removes entries older than 24 hours
   */
  private async cleanupOldEntries(): Promise<void> {
    const release = await this.keyMutex.acquire();
    try {
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      // Clean up old last used entries and usage counts
      for (const [key, timestamp] of this.keyLastUsed.entries()) {
        if (now - timestamp > maxAge && !key.endsWith('_failed')) {
          this.keyLastUsed.delete(key);
          this.keyUsageCount.delete(key);
        }
      }

      // Clean up old failed key entries
      const keysToClean: string[] = [];
      for (const [key, timestamp] of this.keyLastUsed.entries()) {
        if (key.endsWith('_failed') && now - timestamp > maxAge) {
          keysToClean.push(key);
        }
      }

      keysToClean.forEach(key => {
        this.keyLastUsed.delete(key);
        const originalKey = key.replace('_failed', '');
        this.failedKeys.delete(originalKey);
      });

      this.log(`Cleaned up old entries. Active entries: ${this.keyLastUsed.size}, Usage counts: ${this.keyUsageCount.size}`);
    } finally {
      release();
    }
  }

  /**
   * Get the next API key using round-robin selection with thread safety
   */
  private async getNextApiKey(): Promise<string> {
    // Periodically clean up old entries (check outside mutex for performance)
    const shouldCleanup = Math.random() < 0.01; // 1% chance per request
    if (shouldCleanup) {
      await this.cleanupOldEntries();
    }

    const release = await this.keyMutex.acquire();
    try {
      return this.selectNextKey();
    } finally {
      release();
    }
  }

  /**
   * Select next API key (must be called within mutex)
   */
  private selectNextKey(): string {
    const maxAttempts = this.openRouterApiKeys.length;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const key = this.openRouterApiKeys[this.currentKeyIndex];
      const keyIndex = this.currentKeyIndex;
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.openRouterApiKeys.length;

      // Skip failed keys that were marked recently (within 5 minutes)
      const lastFailed = this.keyLastUsed.get(key + '_failed') || 0;
      if (this.failedKeys.has(key) && Date.now() - lastFailed < 5 * 60 * 1000) {
        attempts++;
        continue;
      }

      // Clear failed status if it's been more than 5 minutes
      if (this.failedKeys.has(key) && Date.now() - lastFailed >= 5 * 60 * 1000) {
        this.failedKeys.delete(key);
        this.log(`Cleared failed status for key index ${keyIndex}`);
      }

      // Update usage tracking
      this.keyUsageCount.set(key, (this.keyUsageCount.get(key) || 0) + 1);
      this.keyLastUsed.set(key, Date.now());

      return key;
    }

    // If all keys have failed recently, use the first one and update stats
    const fallbackKey = this.openRouterApiKeys[0];
    this.keyUsageCount.set(fallbackKey, (this.keyUsageCount.get(fallbackKey) || 0) + 1);
    this.keyLastUsed.set(fallbackKey, Date.now());
    this.log('All OpenRouter keys have failed recently, retrying with first key');
    return fallbackKey;
  }

  /**
   * Mark a key as failed temporarily
   */
  private markKeyAsFailed(key: string, error: any): void {
    // Only mark as failed for rate limit errors
    if (error.status === 429 || (error.message && error.message.includes('rate limit'))) {
      this.failedKeys.add(key);
      this.keyLastUsed.set(key + '_failed', Date.now());
      const keyIndex = this.openRouterApiKeys.indexOf(key);
      if (keyIndex >= 0) {
        this.log(`Marked key index ${keyIndex} as failed due to rate limit`);
      } else {
        this.log(`Marked unknown key as failed due to rate limit`);
      }
    }
  }

  /**
   * Get statistics about key usage
   */
  async getKeyUsageStats(): Promise<KeyUsageStats> {
    const release = await this.keyMutex.acquire();
    try {
      const stats: KeyUsageStats = {
        totalKeys: this.openRouterApiKeys.length,
        activeKeys: this.openRouterApiKeys.length - this.failedKeys.size,
        failedKeys: this.failedKeys.size,
        usage: {}
      };

      this.openRouterApiKeys.forEach((key, index) => {
        const keyId = `key_${index + 1}`;
        stats.usage[keyId] = {
          requests: this.keyUsageCount.get(key) || 0,
          lastUsed: this.keyLastUsed.get(key) || null,
          isFailed: this.failedKeys.has(key),
          keyPreview: `key_${index + 1}`
        };
      });

      return stats;
    } finally {
      release();
    }
  }

  /**
   * Transform Anthropic request to OpenRouter format
   */
  private transformToOpenRouterRequest(request: AnthropicRequest): OpenRouterRequest {
    // Map the model name
    const openRouterModel = this.modelMapping[request.model] || request.model;

    // Transform messages format
    const messages = request.messages.map(msg => ({
      role: msg.role,
      content: typeof msg.content === 'string'
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content
            .filter(c => c && typeof c === 'object')
            .map(c => c.type === 'text' && c.text ? c.text : '')
            .join('')
          : ''
    }));

    // Add system message if present (OpenRouter supports system role)
    if (request.system) {
      messages.unshift({
        role: 'system' as any, // OpenRouter accepts system role
        content: request.system
      });
    }

    return {
      model: openRouterModel,
      messages,
      max_tokens: request.max_tokens,
      temperature: request.temperature,
      top_p: request.top_p,
      stop: request.stop_sequences,
      stream: request.stream || false,
      provider: {
        order: ['Anthropic'],
        allow_fallbacks: false
      }
    };
  }

  /**
   * Transform OpenRouter response to Anthropic format
   */
  private transformToAnthropicResponse(
    openRouterResponse: OpenRouterResponse,
    originalRequest: AnthropicRequest
  ): AnthropicResponse {
    // Add null safety checks
    if (!openRouterResponse.choices || openRouterResponse.choices.length === 0) {
      throw new Error('No choices in OpenRouter response');
    }

    const choice = openRouterResponse.choices[0];
    if (!choice || !choice.message) {
      throw new Error('Invalid choice structure in OpenRouter response');
    }

    // Map finish_reason
    let stopReason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' = 'end_turn';
    if (choice.finish_reason === 'length') {
      stopReason = 'max_tokens';
    } else if (choice.finish_reason === 'stop') {
      stopReason = 'end_turn';
    }

    return {
      id: openRouterResponse.id,
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: choice.message.content || ''
        }
      ],
      model: originalRequest.model, // Return the original model name
      stop_reason: stopReason,
      stop_sequence: undefined,
      usage: {
        input_tokens: openRouterResponse.usage?.prompt_tokens || 0,
        output_tokens: openRouterResponse.usage?.completion_tokens || 0
      }
    };
  }

  /**
   * Send a messages request to OpenRouter (which forwards to Anthropic)
   */
  async sendMessage(request: AnthropicRequest): Promise<AnthropicResponse> {
    const maxRetries = Math.min(3, this.openRouterApiKeys.length);
    let lastError: any = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const apiKey = await this.getNextApiKey();

      try {
        // Transform to OpenRouter format
        const openRouterRequest = this.transformToOpenRouterRequest(request);

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://opensvm.com',
            'X-Title': 'OpenSVM Anthropic Proxy'
          },
          body: JSON.stringify(openRouterRequest)
        });

        let responseData: any;
        try {
          responseData = await response.json();
        } catch (jsonError) {
          // If we can't parse JSON, create a generic error
          const error = new AnthropicAPIError(
            {
              type: 'error',
              error: {
                type: 'api_error',
                message: 'Invalid JSON response from OpenRouter'
              }
            },
            response.status
          );

          if (response.status === 429) {
            this.markKeyAsFailed(apiKey, error);
            lastError = error;
            const keyIndex = this.openRouterApiKeys.indexOf(apiKey);
            this.log(`Rate limited on key index ${keyIndex >= 0 ? keyIndex : 'unknown'}, trying next key (attempt ${attempt + 1}/${maxRetries})`);
            continue;
          }

          throw error;
        }

        if (!response.ok) {
          const error = new AnthropicAPIError(responseData, response.status);

          // If rate limited, mark this key as failed and try another
          if (response.status === 429) {
            this.markKeyAsFailed(apiKey, error);
            lastError = error;
            const keyIndex = this.openRouterApiKeys.indexOf(apiKey);
            this.log(`Rate limited on key index ${keyIndex >= 0 ? keyIndex : 'unknown'}, trying next key (attempt ${attempt + 1}/${maxRetries})`);
            continue;
          }

          throw error;
        }

        // Transform back to Anthropic format
        return this.transformToAnthropicResponse(responseData, request);
      } catch (error) {
        lastError = error;

        // For rate limit errors, we've already marked the key and will retry
        if (error instanceof AnthropicAPIError && error.status === 429) {
          continue;
        }

        // For other errors, don't retry with different keys
        if (error instanceof AnthropicAPIError) {
          throw error;
        }

        const errorKeyIndex = this.openRouterApiKeys.indexOf(apiKey);
        this.log(`Error sending message to OpenRouter with key index ${errorKeyIndex >= 0 ? errorKeyIndex : 'unknown'}: ${error instanceof Error ? error.message : 'Unknown error'}`);

        // If this was our last attempt, throw the error
        if (attempt === maxRetries - 1) {
          throw new Error('Failed to send message to OpenRouter API after multiple attempts');
        }
      }
    }

    // If we exhausted all retries, throw the last error
    if (lastError instanceof AnthropicAPIError && lastError.status === 429) {
      throw new Error('Failed to send message to OpenRouter API: All keys exhausted');
    }
    if (lastError instanceof AnthropicAPIError) {
      throw lastError;
    }
    throw new Error('Failed to send message to OpenRouter API: All keys exhausted');
  }

  /**
   * Transform OpenRouter streaming chunk to Anthropic format
   */
  private transformStreamChunkToAnthropic(
    chunk: OpenRouterStreamChunk,
    isFirst: boolean,
    originalRequest: AnthropicRequest
  ): AnthropicStreamChunk | null {
    // Add null safety check
    if (!chunk.choices || chunk.choices.length === 0) {
      this.log('Received OpenRouter stream chunk with no choices');
      return null;
    }

    const choice = chunk.choices[0];
    if (!choice) {
      this.log('Invalid choice in OpenRouter stream chunk');
      return null;
    }

    if (isFirst) {
      // Send message_start event
      return {
        type: 'message_start',
        message: {
          id: chunk.id,
          type: 'message',
          role: 'assistant',
          content: [],
          model: originalRequest.model,
          stop_reason: undefined,
          stop_sequence: undefined,
          usage: { input_tokens: 0, output_tokens: 0 }
        }
      };
    }

    // Check if delta exists
    if (!choice.delta) {
      return null;
    }

    if (choice.delta.content) {
      // Content delta
      return {
        type: 'content_block_delta',
        index: 0,
        delta: {
          type: 'text_delta',
          text: choice.delta.content
        }
      };
    }

    if (choice.finish_reason) {
      // Message complete - finish_reason indicates stream end

      return {
        type: 'message_delta',
        delta: {
          type: 'text_delta',
          text: '' // Empty text delta for message end
        },
        usage: { output_tokens: 0 } // OpenRouter doesn't provide token counts in stream
      };
    }

    return null;
  }

  /**
   * Send a streaming messages request to OpenRouter
   */
  async sendStreamingMessage(request: AnthropicRequest): Promise<ReadableStream<AnthropicStreamChunk>> {
    const maxRetries = Math.min(3, this.openRouterApiKeys.length);
    let lastError: any = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const apiKey = await this.getNextApiKey();

      try {
        const openRouterRequest = this.transformToOpenRouterRequest({ ...request, stream: true });

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://opensvm.com',
            'X-Title': 'OpenSVM Anthropic Proxy'
          },
          body: JSON.stringify(openRouterRequest)
        });

        if (!response.ok) {
          let errorData: any;
          try {
            errorData = await response.json();
          } catch (jsonError) {
            errorData = {
              type: 'error',
              error: {
                type: 'api_error',
                message: 'Invalid JSON response from OpenRouter'
              }
            };
          }

          const error = new AnthropicAPIError(errorData, response.status);

          // If rate limited, mark this key as failed and try another
          if (response.status === 429) {
            this.markKeyAsFailed(apiKey, error);
            lastError = error;
            const keyIndex = this.openRouterApiKeys.indexOf(apiKey);
            this.log(`Rate limited on key index ${keyIndex >= 0 ? keyIndex : 'unknown'} for streaming, trying next key (attempt ${attempt + 1}/${maxRetries})`);
            continue;
          }

          throw error;
        }

        if (!response.body) {
          throw new Error('No response body for streaming request');
        }

        return this.parseOpenRouterStreamingResponse(response.body, request);
      } catch (error) {
        lastError = error;

        // For rate limit errors, we've already marked the key and will retry
        if (error instanceof AnthropicAPIError && error.status === 429) {
          continue;
        }

        // For other errors, don't retry with different keys
        if (error instanceof AnthropicAPIError) {
          throw error;
        }

        const errorKeyIndex = this.openRouterApiKeys.indexOf(apiKey);
        this.log(`Error sending streaming message to OpenRouter with key index ${errorKeyIndex >= 0 ? errorKeyIndex : 'unknown'}: ${error instanceof Error ? error.message : 'Unknown error'}`);

        // If this was our last attempt, throw the error
        if (attempt === maxRetries - 1) {
          throw new Error('Failed to send streaming message to OpenRouter API after multiple attempts');
        }
      }
    }

    // If we exhausted all retries, throw the last error
    if (lastError instanceof AnthropicAPIError && lastError.status === 429) {
      throw new Error('Failed to send streaming message to OpenRouter API: All keys exhausted');
    }
    if (lastError instanceof AnthropicAPIError) {
      throw lastError;
    }
    throw new Error('Failed to send streaming message to OpenRouter API: All keys exhausted');
  }

  /**
   * Parse OpenRouter streaming response and transform to Anthropic format
   */
  private parseOpenRouterStreamingResponse(
    body: ReadableStream<Uint8Array>,
    originalRequest: AnthropicRequest
  ): ReadableStream<AnthropicStreamChunk> {
    const log = this.log.bind(this); // Capture the log method with correct binding
    const transformStreamChunk = this.transformStreamChunkToAnthropic.bind(this); // Capture the transform method

    return new ReadableStream({
      async start(controller) {
        let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

        try {
          reader = body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let isFirst = true;
          let sentContentBlockStart = false;
          const MAX_BUFFER_SIZE = 1024 * 1024; // 1MB limit

          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              // Send final events
              if (sentContentBlockStart) {
                controller.enqueue({ type: 'content_block_stop', index: 0 });
              }
              controller.enqueue({ type: 'message_stop' });
              break;
            }

            buffer += decoder.decode(value, { stream: true });

            // Prevent buffer overflow
            if (buffer.length > MAX_BUFFER_SIZE) {
              throw new Error('Stream buffer overflow - response too large');
            }

            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('data: ')) {
                const data = trimmed.slice(6);
                if (data === '[DONE]') {
                  continue;
                }

                try {
                  const chunk = JSON.parse(data) as OpenRouterStreamChunk;

                  // Send initial events if first chunk
                  if (isFirst && !sentContentBlockStart) {
                    controller.enqueue({
                      type: 'message_start',
                      message: {
                        id: chunk.id,
                        type: 'message',
                        role: 'assistant',
                        content: [],
                        model: originalRequest.model,
                        stop_reason: 'end_turn',
                        usage: { input_tokens: 0, output_tokens: 0 }
                      }
                    });
                    controller.enqueue({
                      type: 'content_block_start',
                      index: 0,
                      content_block: { type: 'text', text: '' }
                    });
                    sentContentBlockStart = true;
                    isFirst = false;
                  }

                  const anthropicChunk = transformStreamChunk(chunk, false, originalRequest);
                  if (anthropicChunk) {
                    controller.enqueue(anthropicChunk);
                  }
                } catch (error) {
                  log(`Error parsing OpenRouter stream chunk: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
              }
            }
          }
        } catch (error) {
          log(`Error in streaming response: ${error instanceof Error ? error.message : 'Unknown error'}`);
          controller.error(error);
        } finally {
          if (reader) {
            try {
              reader.releaseLock();
            } catch (releaseError) {
              log(`Error releasing reader lock: ${releaseError instanceof Error ? releaseError.message : 'Unknown error'}`);
            }
          }
        }
      }
    });
  }

  /**
   * Get available models - returns Anthropic model list
   */
  async getModels(): Promise<ModelsResponse> {
    // Return a static list of Anthropic models since OpenRouter uses different naming
    return {
      object: 'list',
      data: [
        {
          id: 'claude-3-opus-20240229',
          object: 'model',
          created: 1708992000,
          owned_by: 'anthropic'
        },
        {
          id: 'claude-3-sonnet-20240229',
          object: 'model',
          created: 1708992000,
          owned_by: 'anthropic'
        },
        {
          id: 'claude-3-haiku-20240307',
          object: 'model',
          created: 1709769600,
          owned_by: 'anthropic'
        },
        // Support newer model versions
        {
          id: 'claude-3-sonnet-4',
          object: 'model',
          created: 1708992000,
          owned_by: 'anthropic'
        },
        {
          id: 'claude-3-opus-4',
          object: 'model',
          created: 1708992000,
          owned_by: 'anthropic'
        }
      ]
    };
  }

  /**
   * Parse streaming response from Anthropic API (for future direct API support)
   */
  // Reserved for future direct Anthropic API support
  private _parseStreamingResponse(body: ReadableStream<Uint8Array>): ReadableStream<AnthropicStreamChunk> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const MAX_BUFFER_SIZE = 1024 * 1024; // 1MB limit
    const log = this.log.bind(this); // Capture the log method with correct binding

    return new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });

            // Prevent buffer overflow
            if (buffer.length > MAX_BUFFER_SIZE) {
              controller.error(new Error('Stream buffer overflow - response too large'));
              return;
            }

            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
              if (line.trim() === '') continue;

              if (line.startsWith('data: ')) {
                const data = line.slice(6);

                if (data === '[DONE]') {
                  controller.close();
                  return;
                }

                try {
                  const chunk = JSON.parse(data) as AnthropicStreamChunk;
                  controller.enqueue(chunk);
                } catch (parseError) {
                  log(`Error parsing streaming chunk: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
                  // Continue processing other chunks
                }
              }
            }
          }

          controller.close();
        } catch (error) {
          log(`Error in streaming response: ${error instanceof Error ? error.message : 'Unknown error'}`);
          controller.error(error);
        }
      }
    });
  }

  /**
   * Test connection to Anthropic API
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getModels();
      return true;
    } catch (error) {
      this.log(`Anthropic API connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Get API usage statistics (if available)
   */
  async getUsageStats(): Promise<UsageStatsResponse | null> {
    try {
      // Note: Anthropic may not have a usage endpoint
      // This is a placeholder for future implementation
      const response = await fetch(`${this.baseUrl}/v1/usage`, {
        method: 'GET',
        headers: {
          ...ANTHROPIC_HEADERS,
          'Authorization': `Bearer ${this.apiKey}`,
        }
      });

      if (response.status === 404) {
        return null; // Usage endpoint not available
      }

      let responseData: any;
      try {
        responseData = await response.json();
      } catch (jsonError) {
        this.log(`Invalid JSON in usage stats response: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}`);
        return null;
      }

      if (!response.ok) {
        throw new AnthropicAPIError(responseData, response.status);
      }

      return responseData;
    } catch (error) {
      this.log(`Error getting usage stats from Anthropic: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Create streaming response using direct Anthropic API parsing
   * (for future direct API integration when baseUrl points to Anthropic)
   */
  public createDirectStreamingResponse(body: ReadableStream<Uint8Array>): ReadableStream<AnthropicStreamChunk> {
    this.log('Using direct Anthropic API streaming response parsing');
    return this._parseStreamingResponse(body);
  }
}

/**
 * Custom error class for Anthropic API errors
 */
export class AnthropicAPIError extends Error {
  public readonly status: number;
  public readonly anthropicError: AnthropicError;

  constructor(errorData: any, status: number) {
    // Safely extract error message
    let message = 'Anthropic API error';
    if (errorData && typeof errorData === 'object' && errorData.error) {
      if (typeof errorData.error === 'string') {
        message = errorData.error;
      } else if (errorData.error.message) {
        message = errorData.error.message;
      }
    }

    super(message);
    this.name = 'AnthropicAPIError';
    this.status = status;
    // Ensure we have a valid AnthropicError structure
    this.anthropicError = errorData && typeof errorData === 'object'
      ? errorData as AnthropicError
      : { type: 'error', error: { type: 'api_error', message } };
  }

  /**
   * Get error type from Anthropic response
   */
  getErrorType(): string {
    return this.anthropicError.error?.type || 'unknown_error';
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    const retryableTypes = ['rate_limit_error', 'api_error', 'overloaded_error'];
    return retryableTypes.includes(this.getErrorType());
  }

  /**
   * Get retry delay in milliseconds
   */
  getRetryDelay(): number {
    switch (this.getErrorType()) {
      case 'rate_limit_error':
        return 60000; // 1 minute
      case 'overloaded_error':
        return 30000; // 30 seconds
      case 'api_error':
        return 5000;  // 5 seconds
      default:
        return 0;
    }
  }

  /**
   * Convert to JSON for API response
   */
  toJSON(): AnthropicError {
    return this.anthropicError;
  }
}