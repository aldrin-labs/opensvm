import {
  AnthropicRequest,
  AnthropicResponse,
  AnthropicError,
  AnthropicStreamChunk,
  ANTHROPIC_HEADERS
} from '../types/AnthropicTypes';

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
    this.openRouterApiKeys = keysFromEnv
      .split(',')
      .map(key => key.trim())
      .filter(key => key.length > 0);

    this.baseUrl = 'https://openrouter.ai/api/v1';

    if (this.openRouterApiKeys.length === 0) {
      throw new Error('At least one OpenRouter API key is required');
    }

    console.log(`Initialized with ${this.openRouterApiKeys.length} OpenRouter API key(s)`);
  }

  /**
   * Get the next API key using round-robin selection
   */
  private getNextApiKey(): string {
    const maxAttempts = this.openRouterApiKeys.length;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const key = this.openRouterApiKeys[this.currentKeyIndex];
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
        console.log(`Cleared failed status for key ending in ...${key.slice(-4)}`);
      }

      // Update usage tracking
      this.keyUsageCount.set(key, (this.keyUsageCount.get(key) || 0) + 1);
      this.keyLastUsed.set(key, Date.now());

      return key;
    }

    // If all keys have failed recently, try the first one anyway
    console.warn('All OpenRouter keys have failed recently, retrying with first key');
    return this.openRouterApiKeys[0];
  }

  /**
   * Mark a key as failed temporarily
   */
  private markKeyAsFailed(key: string, error: any): void {
    // Only mark as failed for rate limit errors
    if (error.status === 429 || (error.message && error.message.includes('rate limit'))) {
      this.failedKeys.add(key);
      this.keyLastUsed.set(key + '_failed', Date.now());
      console.warn(`Marked OpenRouter key ending in ...${key.slice(-4)} as failed due to rate limit`);
    }
  }

  /**
   * Get statistics about key usage
   */
  getKeyUsageStats(): Record<string, any> {
    const stats: Record<string, any> = {
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
        keyPreview: `...${key.slice(-4)}`
      };
    });

    return stats;
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
        : msg.content.map(c => c.type === 'text' ? c.text : '').join('')
    }));

    // Add system message if present
    if (request.system) {
      messages.unshift({
        role: 'system',
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
    const choice = openRouterResponse.choices[0];

    // Map finish_reason
    let stopReason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' = 'end_turn';
    if (choice.finish_reason === 'length') {
      stopReason = 'max_tokens';
    } else if (choice.finish_reason === 'stop') {
      stopReason = 'stop_sequence';
    }

    return {
      id: openRouterResponse.id,
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: choice.message.content
        }
      ],
      model: originalRequest.model, // Return the original model name
      stop_reason: stopReason,
      stop_sequence: null,
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
      const apiKey = this.getNextApiKey();

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

        const responseData = await response.json();

        if (!response.ok) {
          const error = new AnthropicAPIError(responseData, response.status);

          // If rate limited, mark this key as failed and try another
          if (response.status === 429) {
            this.markKeyAsFailed(apiKey, error);
            lastError = error;
            console.log(`Rate limited on key ...${apiKey.slice(-4)}, trying next key (attempt ${attempt + 1}/${maxRetries})`);
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

        console.error(`Error sending message to OpenRouter with key ...${apiKey.slice(-4)}:`, error);

        // If this was our last attempt, throw the error
        if (attempt === maxRetries - 1) {
          throw new Error('Failed to send message to OpenRouter API after multiple attempts');
        }
      }
    }

    // If we exhausted all retries, throw the last error
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
    const choice = chunk.choices[0];

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
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 }
        }
      };
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
      // Message complete
      let stopReason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' = 'end_turn';
      if (choice.finish_reason === 'length') {
        stopReason = 'max_tokens';
      } else if (choice.finish_reason === 'stop') {
        stopReason = 'stop_sequence';
      }

      return {
        type: 'message_delta',
        delta: {
          stop_reason: stopReason,
          stop_sequence: null
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
      const apiKey = this.getNextApiKey();

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
          const errorData = await response.json();
          const error = new AnthropicAPIError(errorData, response.status);

          // If rate limited, mark this key as failed and try another
          if (response.status === 429) {
            this.markKeyAsFailed(apiKey, error);
            lastError = error;
            console.log(`Rate limited on key ...${apiKey.slice(-4)} for streaming, trying next key (attempt ${attempt + 1}/${maxRetries})`);
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

        console.error(`Error sending streaming message to OpenRouter with key ...${apiKey.slice(-4)}:`, error);

        // If this was our last attempt, throw the error
        if (attempt === maxRetries - 1) {
          throw new Error('Failed to send streaming message to OpenRouter API after multiple attempts');
        }
      }
    }

    // If we exhausted all retries, throw the last error
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
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let isFirst = true;
    let sentContentBlockStart = false;

    return new ReadableStream({
      async start(controller) {
        try {
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
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);

                if (data === '[DONE]') {
                  continue;
                }

                try {
                  const chunk: OpenRouterStreamChunk = JSON.parse(data);

                  if (isFirst) {
                    // Send message_start
                    controller.enqueue(this.transformStreamChunkToAnthropic(chunk, true, originalRequest)!);
                    // Send content_block_start
                    controller.enqueue({
                      type: 'content_block_start',
                      index: 0,
                      content_block: { type: 'text', text: '' }
                    });
                    sentContentBlockStart = true;
                    isFirst = false;
                  }

                  const anthropicChunk = this.transformStreamChunkToAnthropic(chunk, false, originalRequest);
                  if (anthropicChunk) {
                    controller.enqueue(anthropicChunk);
                  }
                } catch (error) {
                  console.error('Error parsing OpenRouter stream chunk:', error);
                }
              }
            }
          }
        } catch (error) {
          controller.error(error);
        } finally {
          reader.releaseLock();
        }
      }
    });
  }

  /**
   * Get available models - returns Anthropic model list
   */
  async getModels(): Promise<any> {
    // Return a static list of Anthropic models since OpenRouter uses different naming
    return {
      data: [
        {
          id: 'claude-3-sonnet-20240229',
          object: 'model',
          created: 1708963200,
          owned_by: 'anthropic',
          display_name: 'Claude 3 Sonnet',
          max_tokens: 4096
        },
        {
          id: 'claude-3-opus-20240229',
          object: 'model',
          created: 1708963200,
          owned_by: 'anthropic',
          display_name: 'Claude 3 Opus',
          max_tokens: 4096
        },
        {
          id: 'claude-3-haiku-20240307',
          object: 'model',
          created: 1709769600,
          owned_by: 'anthropic',
          display_name: 'Claude 3 Haiku',
          max_tokens: 4096
        },
        {
          id: 'claude-3-sonnet-4',
          object: 'model',
          created: 1719792000,
          owned_by: 'anthropic',
          display_name: 'Claude 3.5 Sonnet',
          max_tokens: 8192
        },
        {
          id: 'claude-3-opus-4',
          object: 'model',
          created: 1719792000,
          owned_by: 'anthropic',
          display_name: 'Claude 3.5 Opus',
          max_tokens: 8192
        }
      ]
    };
  }

  /**
   * Parse streaming response from Anthropic API
   */
  private parseStreamingResponse(body: ReadableStream<Uint8Array>): ReadableStream<AnthropicStreamChunk> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    return new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });
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
                  console.error('Error parsing streaming chunk:', parseError);
                  // Continue processing other chunks
                }
              }
            }
          }

          controller.close();
        } catch (error) {
          console.error('Error in streaming response:', error);
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
      console.error('Anthropic API connection test failed:', error);
      return false;
    }
  }

  /**
   * Get API usage statistics (if available)
   */
  async getUsageStats(): Promise<any> {
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

      const responseData = await response.json();

      if (!response.ok) {
        throw new AnthropicAPIError(responseData, response.status);
      }

      return responseData;
    } catch (error) {
      console.error('Error getting usage stats from Anthropic:', error);
      return null;
    }
  }

  /**
   * Update API key
   */
  updateApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Get current API key (masked for security)
   */
  getMaskedApiKey(): string {
    if (this.apiKey.length < 8) {
      return '***';
    }

    return this.apiKey.substring(0, 4) + '***' + this.apiKey.substring(this.apiKey.length - 4);
  }
}

/**
 * Custom error class for Anthropic API errors
 */
export class AnthropicAPIError extends Error {
  public readonly status: number;
  public readonly anthropicError: AnthropicError;

  constructor(errorData: AnthropicError, status: number) {
    super(errorData.error?.message || 'Anthropic API error');
    this.name = 'AnthropicAPIError';
    this.status = status;
    this.anthropicError = errorData;
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