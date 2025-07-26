import { 
  AnthropicRequest, 
  AnthropicResponse, 
  AnthropicError, 
  AnthropicStreamChunk,
  ANTHROPIC_HEADERS 
} from '../types/AnthropicTypes';

/**
 * HTTP client for forwarding requests to Anthropic API
 */
export class AnthropicClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.baseUrl = baseUrl || 'https://api.anthropic.com';
    
    if (!this.apiKey) {
      throw new Error('Anthropic API key is required');
    }
  }

  /**
   * Send a messages request to Anthropic API
   */
  async sendMessage(request: AnthropicRequest): Promise<AnthropicResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          ...ANTHROPIC_HEADERS,
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(request)
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new AnthropicAPIError(responseData, response.status);
      }

      return responseData as AnthropicResponse;
    } catch (error) {
      if (error instanceof AnthropicAPIError) {
        throw error;
      }
      
      console.error('Error sending message to Anthropic:', error);
      throw new Error('Failed to send message to Anthropic API');
    }
  }

  /**
   * Send a streaming messages request to Anthropic API
   */
  async sendStreamingMessage(request: AnthropicRequest): Promise<ReadableStream<AnthropicStreamChunk>> {
    try {
      const streamingRequest = { ...request, stream: true };
      
      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          ...ANTHROPIC_HEADERS,
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(streamingRequest)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new AnthropicAPIError(errorData, response.status);
      }

      if (!response.body) {
        throw new Error('No response body for streaming request');
      }

      return this.parseStreamingResponse(response.body);
    } catch (error) {
      if (error instanceof AnthropicAPIError) {
        throw error;
      }
      
      console.error('Error sending streaming message to Anthropic:', error);
      throw new Error('Failed to send streaming message to Anthropic API');
    }
  }

  /**
   * Get available models from Anthropic API
   */
  async getModels(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        method: 'GET',
        headers: {
          ...ANTHROPIC_HEADERS,
          'Authorization': `Bearer ${this.apiKey}`,
        }
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new AnthropicAPIError(responseData, response.status);
      }

      return responseData;
    } catch (error) {
      if (error instanceof AnthropicAPIError) {
        throw error;
      }
      
      console.error('Error getting models from Anthropic:', error);
      throw new Error('Failed to get models from Anthropic API');
    }
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