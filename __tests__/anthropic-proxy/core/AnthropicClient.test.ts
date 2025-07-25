import { AnthropicClient, AnthropicAPIError } from '../../../lib/anthropic-proxy/core/AnthropicClient';
import { AnthropicRequest, AnthropicResponse } from '../../../lib/anthropic-proxy/types/AnthropicTypes';

// Mock fetch globally
global.fetch = jest.fn();

describe('AnthropicClient', () => {
  let client: AnthropicClient;
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    jest.clearAllMocks();
    client = new AnthropicClient(mockApiKey);
  });

  describe('constructor', () => {
    it('should initialize with provided API key', () => {
      expect(client.getMaskedApiKey()).toBe('test***-key');
    });

    it('should throw error if no API key provided', () => {
      expect(() => new AnthropicClient('')).toThrow('Anthropic API key is required');
    });
  });

  describe('sendMessage', () => {
    const mockRequest: AnthropicRequest = {
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1024,
      messages: [
        { role: 'user', content: 'Hello' }
      ]
    };

    const mockResponse: AnthropicResponse = {
      id: 'msg_123',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello! How can I help you?' }],
      model: 'claude-3-sonnet-20240229',
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 10,
        output_tokens: 15
      }
    };

    it('should send message successfully', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      const result = await client.sendMessage(mockRequest);

      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify(mockRequest)
        })
      );
    });

    it('should handle API errors', async () => {
      const errorResponse = {
        type: 'error',
        error: {
          type: 'invalid_request_error',
          message: 'Invalid request'
        }
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => errorResponse
      });

      await expect(client.sendMessage(mockRequest)).rejects.toThrow(AnthropicAPIError);
    });

    it('should handle network errors', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(client.sendMessage(mockRequest)).rejects.toThrow('Failed to send message to Anthropic API');
    });
  });

  describe('sendStreamingMessage', () => {
    const mockRequest: AnthropicRequest = {
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1024,
      messages: [
        { role: 'user', content: 'Hello' }
      ]
    };

    it('should handle streaming response', async () => {
      const mockStreamData = 'data: {"type": "message_start"}\n\ndata: [DONE]\n\n';
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(mockStreamData));
          controller.close();
        }
      });

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockStream
      });

      const result = await client.sendStreamingMessage(mockRequest);
      expect(result).toBeInstanceOf(ReadableStream);

      // Test that the stream can be read
      const reader = result.getReader();
      const { value, done } = await reader.read();
      
      expect(done).toBe(false);
      expect(value).toEqual({ type: 'message_start' });
    });

    it('should handle streaming API errors', async () => {
      const errorResponse = {
        type: 'error',
        error: {
          type: 'rate_limit_error',
          message: 'Rate limit exceeded'
        }
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => errorResponse
      });

      await expect(client.sendStreamingMessage(mockRequest)).rejects.toThrow(AnthropicAPIError);
    });
  });

  describe('getModels', () => {
    it('should get models successfully', async () => {
      const mockModelsResponse = {
        data: [
          {
            id: 'claude-3-sonnet-20240229',
            type: 'model',
            display_name: 'Claude 3 Sonnet'
          }
        ]
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockModelsResponse
      });

      const result = await client.getModels();

      expect(result).toEqual(mockModelsResponse);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/models',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockApiKey}`
          })
        })
      );
    });
  });

  describe('testConnection', () => {
    it('should return true for successful connection', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] })
      });

      const result = await client.testConnection();
      expect(result).toBe(true);
    });

    it('should return false for failed connection', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      const result = await client.testConnection();
      expect(result).toBe(false);
    });
  });

  describe('updateApiKey', () => {
    it('should update API key', () => {
      const newKey = 'new-api-key';
      client.updateApiKey(newKey);
      
      expect(client.getMaskedApiKey()).toBe('new-***-key');
    });
  });
});

describe('AnthropicAPIError', () => {
  const mockErrorData = {
    type: 'error' as const,
    error: {
      type: 'rate_limit_error' as const,
      message: 'Rate limit exceeded'
    }
  };

  it('should create error with correct properties', () => {
    const error = new AnthropicAPIError(mockErrorData, 429);
    
    expect(error.message).toBe('Rate limit exceeded');
    expect(error.status).toBe(429);
    expect(error.getErrorType()).toBe('rate_limit_error');
  });

  it('should identify retryable errors', () => {
    const retryableError = new AnthropicAPIError(mockErrorData, 429);
    expect(retryableError.isRetryable()).toBe(true);

    const nonRetryableError = new AnthropicAPIError({
      type: 'error',
      error: {
        type: 'invalid_request_error',
        message: 'Invalid request'
      }
    }, 400);
    expect(nonRetryableError.isRetryable()).toBe(false);
  });

  it('should provide retry delay', () => {
    const error = new AnthropicAPIError(mockErrorData, 429);
    expect(error.getRetryDelay()).toBe(60000); // 1 minute for rate limit
  });

  it('should convert to JSON', () => {
    const error = new AnthropicAPIError(mockErrorData, 429);
    expect(error.toJSON()).toEqual(mockErrorData);
  });
});