import { ProxyRequest, ProxyResponse } from '../types/ProxyTypes';
import { AnthropicRequest, AnthropicResponse } from '../types/AnthropicTypes';
import { getAnthropicClient } from './AnthropicClientSingleton';
import { AnthropicAPIError, AnthropicClient } from './AnthropicClient';

/**
 * Forwards requests to Anthropic API using master account
 */
export class RequestForwarder {
  private anthropicClient: AnthropicClient | null = null;

  constructor(anthropicApiKey?: string) {
    // Client will be initialized on first use
  }

  /**
   * Ensure client is initialized
   */
  private async ensureClient(): Promise<AnthropicClient> {
    if (!this.anthropicClient) {
      this.anthropicClient = await getAnthropicClient();
    }
    return this.anthropicClient;
  }

  /**
   * Forward a non-streaming request to Anthropic API
   */
  async forwardRequest(proxyRequest: ProxyRequest): Promise<{
    response: AnthropicResponse;
    proxyResponse: ProxyResponse;
  }> {
    const client = await this.ensureClient();
    const startTime = Date.now();

    try {
      // Forward the request to Anthropic API
      const anthropicResponse = await client.sendMessage(
        proxyRequest.anthropicRequest
      );

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Create proxy response record
      const proxyResponse: ProxyResponse = {
        keyId: proxyRequest.keyId,
        userId: proxyRequest.userId,
        anthropicResponse,
        actualCost: 0, // Will be calculated by billing system
        inputTokens: anthropicResponse.usage.input_tokens,
        outputTokens: anthropicResponse.usage.output_tokens,
        model: anthropicResponse.model,
        success: true,
        timestamp: new Date(),
        responseTime
      };

      return {
        response: anthropicResponse,
        proxyResponse
      };
    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Handle Anthropic API errors
      if (error instanceof AnthropicAPIError) {
        const proxyResponse: ProxyResponse = {
          keyId: proxyRequest.keyId,
          userId: proxyRequest.userId,
          anthropicResponse: error.toJSON(),
          actualCost: 0,
          inputTokens: 0,
          outputTokens: 0,
          model: proxyRequest.anthropicRequest.model,
          success: false,
          timestamp: new Date(),
          responseTime
        };

        // For errors, we should throw them, not return them as successful responses
        throw error;
      }

      // Handle other errors
      console.error('Error forwarding request:', error);
      throw new Error('Failed to forward request to Anthropic API');
    }
  }

  /**
   * Forward a streaming request to Anthropic API
   */
  async forwardStreamingRequest(proxyRequest: ProxyRequest): Promise<{
    stream: ReadableStream<AnthropicStreamChunk>;
    getProxyResponse: () => Promise<ProxyResponse>;
  }> {
    const client = await this.ensureClient();
    const startTime = Date.now();
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let finalModel = proxyRequest.anthropicRequest.model;
    let success = true;
    let error: any = null;

    try {
      // Get streaming response from Anthropic API
      const anthropicStream = await client.sendStreamingMessage(
        proxyRequest.anthropicRequest
      );

      // Create a new stream that tracks tokens and creates proxy response
      const trackedStream = new ReadableStream<AnthropicStreamChunk>({
        async start(controller) {
          const reader = anthropicStream.getReader();

          try {
            while (true) {
              const { done, value } = await reader.read();

              if (done) {
                break;
              }

              // Track token usage from stream chunks
              if (value.type === 'message_start' && value.message?.usage) {
                totalInputTokens = value.message.usage.input_tokens;
              }

              if (value.type === 'message_delta' && value.usage) {
                totalOutputTokens = value.usage.output_tokens;
              }

              if (value.type === 'message_start' && value.message?.model) {
                finalModel = value.message.model;
              }

              // Forward the chunk to the client
              controller.enqueue(value);
            }

            controller.close();
          } catch (streamError) {
            success = false;
            error = streamError;
            console.error('Error in streaming response:', streamError);
            controller.error(streamError);
          }
        }
      });

      // Function to get proxy response after streaming is complete
      const getProxyResponse = async (): Promise<ProxyResponse> => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        return {
          keyId: proxyRequest.keyId,
          userId: proxyRequest.userId,
          anthropicResponse: null, // Streaming responses don't have a single response object
          actualCost: 0, // Will be calculated by billing system
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          model: finalModel,
          success,
          timestamp: new Date(),
          responseTime
        };
      };

      return {
        stream: trackedStream,
        getProxyResponse
      };
    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Handle Anthropic API errors for streaming
      if (error instanceof AnthropicAPIError) {
        const proxyResponse: ProxyResponse = {
          keyId: proxyRequest.keyId,
          userId: proxyRequest.userId,
          anthropicResponse: error.toJSON(),
          actualCost: 0,
          inputTokens: 0,
          outputTokens: 0,
          model: proxyRequest.anthropicRequest.model,
          success: false,
          timestamp: new Date(),
          responseTime
        };

        // Create an error stream
        const errorStream = new ReadableStream<AnthropicStreamChunk>({
          start(controller) {
            controller.error(error);
          }
        });

        return {
          stream: errorStream,
          getProxyResponse: async () => proxyResponse
        };
      }

      console.error('Error forwarding streaming request:', error);
      throw new Error('Failed to forward streaming request to Anthropic API');
    }
  }

  /**
   * Forward models request to Anthropic API
   */
  async forwardModelsRequest(): Promise<any> {
    const client = await this.ensureClient();
    try {
      return await client.getModels();
    } catch (error) {
      if (error instanceof AnthropicAPIError) {
        throw error;
      }

      console.error('Error forwarding models request:', error);
      throw new Error('Failed to forward models request to Anthropic API');
    }
  }

  /**
   * Test connection to Anthropic API
   */
  async testConnection(): Promise<boolean> {
    const client = await this.ensureClient();
    return await client.testConnection();
  }

  /**
   * Validate request before forwarding
   */
  validateRequest(request: AnthropicRequest): { valid: boolean; error?: string } {
    // Basic validation
    if (!request.model) {
      return { valid: false, error: 'Model is required' };
    }

    if (!request.messages || request.messages.length === 0) {
      return { valid: false, error: 'Messages are required' };
    }

    if (!request.max_tokens || request.max_tokens <= 0) {
      return { valid: false, error: 'max_tokens must be greater than 0' };
    }

    if (request.max_tokens > 4096) {
      return { valid: false, error: 'max_tokens cannot exceed 4096' };
    }

    // Validate messages
    for (const message of request.messages) {
      if (!message.role || !['user', 'assistant'].includes(message.role)) {
        return { valid: false, error: 'Invalid message role' };
      }

      if (!message.content) {
        return { valid: false, error: 'Message content is required' };
      }
    }

    // Validate temperature if provided
    if (request.temperature !== undefined) {
      if (request.temperature < 0 || request.temperature > 1) {
        return { valid: false, error: 'Temperature must be between 0 and 1' };
      }
    }

    // Validate top_p if provided
    if (request.top_p !== undefined) {
      if (request.top_p < 0 || request.top_p > 1) {
        return { valid: false, error: 'top_p must be between 0 and 1' };
      }
    }

    // Validate top_k if provided
    if (request.top_k !== undefined) {
      if (request.top_k < 1) {
        return { valid: false, error: 'top_k must be at least 1' };
      }
    }

    return { valid: true };
  }

  /**
   * Get request statistics
   */
  getRequestStats(request: AnthropicRequest): {
    estimatedInputTokens: number;
    model: string;
    hasTools: boolean;
    isStreaming: boolean;
  } {
    // Estimate input tokens (rough approximation)
    let totalContent = '';

    if (request.system) {
      totalContent += request.system;
    }

    for (const message of request.messages) {
      if (typeof message.content === 'string') {
        totalContent += message.content;
      } else if (Array.isArray(message.content)) {
        for (const content of message.content) {
          if (content.type === 'text' && content.text) {
            totalContent += content.text;
          }
        }
      }
    }

    const estimatedInputTokens = Math.ceil(totalContent.length / 4); // Rough estimate

    return {
      estimatedInputTokens,
      model: request.model,
      hasTools: Boolean(request.tools && request.tools.length > 0),
      isStreaming: Boolean(request.stream)
    };
  }
}