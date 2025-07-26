import { AnthropicStreamChunk } from '../types/AnthropicTypes';

/**
 * Handles server-sent events streaming support for Anthropic API proxy
 */
export class StreamingProxy {
  /**
   * Convert Anthropic stream to Server-Sent Events format
   */
  static createSSEStream(
    anthropicStream: ReadableStream<AnthropicStreamChunk>
  ): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();

    return new ReadableStream({
      async start(controller) {
        const reader = anthropicStream.getReader();

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              // Send final SSE event to indicate completion
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
              break;
            }

            // Convert chunk to SSE format
            const sseData = StreamingProxy.formatSSEChunk(value);
            controller.enqueue(encoder.encode(sseData));
          }
        } catch (error) {
          console.error('Error in SSE stream:', error);
          
          // Send error event
          const errorEvent = StreamingProxy.formatSSEError(error);
          controller.enqueue(encoder.encode(errorEvent));
          controller.close();
        }
      }
    });
  }

  /**
   * Format a single chunk as Server-Sent Event
   */
  private static formatSSEChunk(chunk: AnthropicStreamChunk): string {
    try {
      const data = JSON.stringify(chunk);
      return `data: ${data}\n\n`;
    } catch (error) {
      console.error('Error formatting SSE chunk:', error);
      return `data: {"type": "error", "error": "Failed to format chunk"}\n\n`;
    }
  }

  /**
   * Format error as Server-Sent Event
   */
  private static formatSSEError(error: any): string {
    const errorData = {
      type: 'error',
      error: {
        type: 'api_error',
        message: error.message || 'Unknown streaming error'
      }
    };

    return `data: ${JSON.stringify(errorData)}\n\n`;
  }

  /**
   * Create SSE headers for HTTP response
   */
  static getSSEHeaders(): Record<string, string> {
    return {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    };
  }

  /**
   * Create a streaming response with proper headers
   */
  static createStreamingResponse(
    anthropicStream: ReadableStream<AnthropicStreamChunk>
  ): Response {
    const sseStream = StreamingProxy.createSSEStream(anthropicStream);
    
    return new Response(sseStream, {
      status: 200,
      headers: StreamingProxy.getSSEHeaders()
    });
  }

  /**
   * Handle streaming request with error boundaries
   */
  static async handleStreamingRequest(
    streamProvider: () => Promise<ReadableStream<AnthropicStreamChunk>>
  ): Promise<Response> {
    try {
      const anthropicStream = await streamProvider();
      return StreamingProxy.createStreamingResponse(anthropicStream);
    } catch (error) {
      console.error('Error handling streaming request:', error);
      
      // Create error stream
      const errorStream = new ReadableStream<AnthropicStreamChunk>({
        start(controller) {
          const errorChunk: AnthropicStreamChunk = {
            type: 'message_stop',
            delta: {
              type: 'text_delta',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          };
          
          controller.enqueue(errorChunk);
          controller.close();
        }
      });

      return StreamingProxy.createStreamingResponse(errorStream);
    }
  }

  /**
   * Validate streaming request
   */
  static validateStreamingRequest(request: any): { valid: boolean; error?: string } {
    if (!request.stream) {
      return { valid: false, error: 'Stream parameter must be true for streaming requests' };
    }

    // Additional streaming-specific validations can be added here
    return { valid: true };
  }

  /**
   * Monitor streaming performance
   */
  static createMonitoredStream(
    anthropicStream: ReadableStream<AnthropicStreamChunk>,
    onMetrics?: (metrics: StreamingMetrics) => void
  ): ReadableStream<AnthropicStreamChunk> {
    let chunkCount = 0;
    let totalBytes = 0;
    let startTime = Date.now();
    let firstChunkTime: number | null = null;

    return new ReadableStream({
      async start(controller) {
        const reader = anthropicStream.getReader();

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              // Calculate final metrics
              const endTime = Date.now();
              const totalTime = endTime - startTime;
              const timeToFirstChunk = firstChunkTime ? firstChunkTime - startTime : 0;

              const metrics: StreamingMetrics = {
                chunkCount,
                totalBytes,
                totalTime,
                timeToFirstChunk,
                averageChunkSize: chunkCount > 0 ? totalBytes / chunkCount : 0,
                chunksPerSecond: chunkCount > 0 ? chunkCount / (totalTime / 1000) : 0
              };

              onMetrics?.(metrics);
              controller.close();
              break;
            }

            // Track metrics
            chunkCount++;
            if (firstChunkTime === null) {
              firstChunkTime = Date.now();
            }

            // Estimate chunk size (rough approximation)
            const chunkSize = JSON.stringify(value).length;
            totalBytes += chunkSize;

            controller.enqueue(value);
          }
        } catch (error) {
          console.error('Error in monitored stream:', error);
          controller.error(error);
        }
      }
    });
  }

  /**
   * Create a timeout wrapper for streaming
   */
  static createTimeoutStream(
    anthropicStream: ReadableStream<AnthropicStreamChunk>,
    timeoutMs: number = 30000
  ): ReadableStream<AnthropicStreamChunk> {
    return new ReadableStream({
      async start(controller) {
        const reader = anthropicStream.getReader();
        let timeoutId: NodeJS.Timeout;

        const resetTimeout = () => {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          
          timeoutId = setTimeout(() => {
            console.error('Streaming timeout exceeded');
            controller.error(new Error('Streaming timeout exceeded'));
          }, timeoutMs);
        };

        resetTimeout();

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              clearTimeout(timeoutId);
              controller.close();
              break;
            }

            resetTimeout(); // Reset timeout on each chunk
            controller.enqueue(value);
          }
        } catch (error) {
          clearTimeout(timeoutId);
          console.error('Error in timeout stream:', error);
          controller.error(error);
        }
      }
    });
  }
}

/**
 * Streaming performance metrics
 */
export interface StreamingMetrics {
  chunkCount: number;
  totalBytes: number;
  totalTime: number;
  timeToFirstChunk: number;
  averageChunkSize: number;
  chunksPerSecond: number;
}