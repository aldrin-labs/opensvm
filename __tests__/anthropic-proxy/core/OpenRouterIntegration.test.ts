import { jest } from '@jest/globals';
import { AnthropicClient } from '../../../lib/anthropic-proxy/core/AnthropicClient';
import { AnthropicRequest, AnthropicResponse } from '../../../lib/anthropic-proxy/types/AnthropicTypes';

// Mock fetch
global.fetch = jest.fn();

describe('OpenRouter Integration Tests', () => {
    let client: AnthropicClient;

    beforeEach(() => {
        jest.clearAllMocks();
        // Default to single key for most tests
        process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
        delete process.env.OPENROUTER_API_KEYS;
    });

    describe('Request Transformation', () => {
        it('transforms Anthropic request to OpenRouter format correctly', async () => {
            const anthropicRequest: AnthropicRequest = {
                model: 'claude-3-sonnet-20240229',
                max_tokens: 1024,
                messages: [
                    { role: 'user', content: 'Hello Claude!' }
                ],
                system: 'You are a helpful assistant',
                temperature: 0.7,
                top_p: 0.9,
                stop_sequences: ['END', 'STOP']
            };

            const mockOpenRouterResponse = {
                id: 'chatcmpl-abc123',
                object: 'chat.completion',
                created: 1708963200,
                model: 'anthropic/claude-3.5-sonnet',
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: 'Hello! How can I help you today?'
                    },
                    finish_reason: 'stop'
                }],
                usage: {
                    prompt_tokens: 15,
                    completion_tokens: 20,
                    total_tokens: 35
                }
            };

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => mockOpenRouterResponse
            });

            const response = await client.sendMessage(anthropicRequest);

            // Verify the request was sent to OpenRouter
            expect(fetch).toHaveBeenCalledWith(
                'https://openrouter.ai/api/v1/chat/completions',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer test-openrouter-key',
                        'HTTP-Referer': 'https://opensvm.com',
                        'X-Title': 'OpenSVM Anthropic Proxy'
                    }),
                    body: expect.stringContaining('anthropic/claude-3.5-sonnet')
                })
            );

            // Verify the request body transformation
            const requestBody = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
            expect(requestBody).toEqual({
                model: 'anthropic/claude-3.5-sonnet',
                messages: [
                    { role: 'system', content: 'You are a helpful assistant' },
                    { role: 'user', content: 'Hello Claude!' }
                ],
                max_tokens: 1024,
                temperature: 0.7,
                top_p: 0.9,
                stop: ['END', 'STOP'],
                stream: false,
                provider: {
                    order: ['Anthropic'],
                    allow_fallbacks: false
                }
            });
        });

        it('handles message content arrays correctly', async () => {
            const anthropicRequest: AnthropicRequest = {
                model: 'claude-3-opus-20240229',
                max_tokens: 1024,
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: 'What is in this image?' },
                            { type: 'text', text: ' Please describe it.' }
                        ]
                    }
                ]
            };

            const mockResponse = {
                id: 'chatcmpl-xyz789',
                object: 'chat.completion',
                created: 1708963200,
                model: 'anthropic/claude-3-opus',
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: 'I see an image description here.'
                    },
                    finish_reason: 'stop'
                }],
                usage: {
                    prompt_tokens: 20,
                    completion_tokens: 15,
                    total_tokens: 35
                }
            };

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => mockResponse
            });

            await client.sendMessage(anthropicRequest);

            const requestBody = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
            expect(requestBody.messages[0].content).toBe('What is in this image? Please describe it.');
        });
    });

    describe('Response Transformation', () => {
        it('transforms OpenRouter response to Anthropic format correctly', async () => {
            const anthropicRequest: AnthropicRequest = {
                model: 'claude-3-sonnet-20240229',
                max_tokens: 1024,
                messages: [
                    { role: 'user', content: 'Test message' }
                ]
            };

            const mockOpenRouterResponse = {
                id: 'chatcmpl-test123',
                object: 'chat.completion',
                created: 1708963200,
                model: 'anthropic/claude-3.5-sonnet',
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: 'This is a test response from OpenRouter.'
                    },
                    finish_reason: 'stop'
                }],
                usage: {
                    prompt_tokens: 10,
                    completion_tokens: 25,
                    total_tokens: 35
                }
            };

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => mockOpenRouterResponse
            });

            const response = await client.sendMessage(anthropicRequest);

            // Verify Anthropic response format
            expect(response).toEqual({
                id: 'chatcmpl-test123',
                type: 'message',
                role: 'assistant',
                content: [
                    {
                        type: 'text',
                        text: 'This is a test response from OpenRouter.'
                    }
                ],
                model: 'claude-3-sonnet-20240229', // Original model name preserved
                stop_reason: 'end_turn',
                stop_sequence: null,
                usage: {
                    input_tokens: 10,
                    output_tokens: 25
                }
            });
        });

        it('correctly maps finish_reason to stop_reason', async () => {
            const testCases = [
                { finish_reason: 'stop', expected_stop_reason: 'end_turn' },
                { finish_reason: 'length', expected_stop_reason: 'max_tokens' },
                { finish_reason: 'stop', expected_stop_reason: 'stop_sequence' }
            ];

            for (const testCase of testCases) {
                const mockResponse = {
                    id: 'test-id',
                    object: 'chat.completion',
                    created: 1708963200,
                    model: 'anthropic/claude-3.5-sonnet',
                    choices: [{
                        index: 0,
                        message: {
                            role: 'assistant',
                            content: 'Response content'
                        },
                        finish_reason: testCase.finish_reason
                    }],
                    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
                };

                global.fetch = jest.fn().mockResolvedValue({
                    ok: true,
                    status: 200,
                    json: async () => mockResponse
                });

                const response = await client.sendMessage({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 100,
                    messages: [{ role: 'user', content: 'Test' }]
                });

                if (testCase.finish_reason === 'length') {
                    expect(response.stop_reason).toBe('max_tokens');
                } else {
                    expect(response.stop_reason).toBe('end_turn');
                }
            }
        });
    });

    describe('Model Mapping', () => {
        it('maps Anthropic models to OpenRouter models correctly', async () => {
            const modelMappings = [
                { anthropic: 'claude-3-sonnet-20240229', openrouter: 'anthropic/claude-3.5-sonnet' },
                { anthropic: 'claude-3-opus-20240229', openrouter: 'anthropic/claude-3-opus' },
                { anthropic: 'claude-3-haiku-20240307', openrouter: 'anthropic/claude-3-haiku' },
                { anthropic: 'claude-3-sonnet-4', openrouter: 'anthropic/claude-3.5-sonnet' },
                { anthropic: 'claude-3-opus-4', openrouter: 'anthropic/claude-3-opus' }
            ];

            for (const mapping of modelMappings) {
                global.fetch = jest.fn().mockResolvedValue({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        id: 'test',
                        object: 'chat.completion',
                        created: 1708963200,
                        model: mapping.openrouter,
                        choices: [{
                            index: 0,
                            message: { role: 'assistant', content: 'Test' },
                            finish_reason: 'stop'
                        }],
                        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
                    })
                });

                await client.sendMessage({
                    model: mapping.anthropic,
                    max_tokens: 100,
                    messages: [{ role: 'user', content: 'Test' }]
                });

                const requestBody = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
                expect(requestBody.model).toBe(mapping.openrouter);
            }
        });

        it('passes through unknown model names', async () => {
            const unknownModel = 'claude-future-model';

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({
                    id: 'test',
                    object: 'chat.completion',
                    created: 1708963200,
                    model: unknownModel,
                    choices: [{
                        index: 0,
                        message: { role: 'assistant', content: 'Test' },
                        finish_reason: 'stop'
                    }],
                    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
                })
            });

            await client.sendMessage({
                model: unknownModel,
                max_tokens: 100,
                messages: [{ role: 'user', content: 'Test' }]
            });

            const requestBody = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
            expect(requestBody.model).toBe(unknownModel);
        });
    });

    describe('Streaming', () => {
        it('transforms streaming responses correctly', async () => {
            const anthropicRequest: AnthropicRequest = {
                model: 'claude-3-sonnet-20240229',
                max_tokens: 1024,
                stream: true,
                messages: [
                    { role: 'user', content: 'Stream test' }
                ]
            };

            // Mock OpenRouter streaming chunks
            const chunks = [
                { id: 'chat-123', object: 'chat.completion.chunk', created: 1708963200, model: 'anthropic/claude-3.5-sonnet', choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }] },
                { id: 'chat-123', object: 'chat.completion.chunk', created: 1708963200, model: 'anthropic/claude-3.5-sonnet', choices: [{ index: 0, delta: { content: 'Hello' }, finish_reason: null }] },
                { id: 'chat-123', object: 'chat.completion.chunk', created: 1708963200, model: 'anthropic/claude-3.5-sonnet', choices: [{ index: 0, delta: { content: ' from' }, finish_reason: null }] },
                { id: 'chat-123', object: 'chat.completion.chunk', created: 1708963200, model: 'anthropic/claude-3.5-sonnet', choices: [{ index: 0, delta: { content: ' OpenRouter!' }, finish_reason: null }] },
                { id: 'chat-123', object: 'chat.completion.chunk', created: 1708963200, model: 'anthropic/claude-3.5-sonnet', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }
            ];

            const mockStream = new ReadableStream({
                start(controller) {
                    chunks.forEach((chunk, index) => {
                        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`));
                    });
                    controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
                    controller.close();
                }
            });

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                body: mockStream
            });

            const stream = await client.sendStreamingMessage(anthropicRequest);
            const reader = stream.getReader();

            const receivedChunks: any[] = [];
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                receivedChunks.push(value);
            }

            // Verify we received the expected Anthropic-format chunks
            expect(receivedChunks.length).toBeGreaterThan(0);
            expect(receivedChunks[0].type).toBe('message_start');
            expect(receivedChunks.find(c => c.type === 'content_block_start')).toBeDefined();
            expect(receivedChunks.filter(c => c.type === 'content_block_delta').length).toBeGreaterThan(0);
            expect(receivedChunks.find(c => c.type === 'content_block_stop')).toBeDefined();
            expect(receivedChunks[receivedChunks.length - 1].type).toBe('message_stop');
        });
    });

    describe('Error Handling', () => {
        it('handles OpenRouter API errors correctly', async () => {
            const errorResponse = {
                error: {
                    message: 'Invalid API key',
                    type: 'invalid_request_error',
                    code: 'invalid_api_key'
                }
            };

            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 401,
                json: async () => errorResponse
            });

            await expect(client.sendMessage({
                model: 'claude-3-sonnet-20240229',
                max_tokens: 100,
                messages: [{ role: 'user', content: 'Test' }]
            })).rejects.toThrow();
        });

        it('handles network errors', async () => {
            global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

            await expect(client.sendMessage({
                model: 'claude-3-sonnet-20240229',
                max_tokens: 100,
                messages: [{ role: 'user', content: 'Test' }]
            })).rejects.toThrow('Failed to send message to OpenRouter API');
        });
    });

    describe('Model List', () => {
        it('returns static Anthropic model list', async () => {
            const models = await client.getModels();

            expect(models.data).toHaveLength(5);
            expect(models.data.map((m: any) => m.id)).toContain('claude-3-sonnet-20240229');
            expect(models.data.map((m: any) => m.id)).toContain('claude-3-opus-20240229');
            expect(models.data.map((m: any) => m.id)).toContain('claude-3-haiku-20240307');
            expect(models.data.map((m: any) => m.id)).toContain('claude-3-sonnet-4');
            expect(models.data.map((m: any) => m.id)).toContain('claude-3-opus-4');
        });
    });

    describe('Multi-Key Round Robin', () => {
        beforeEach(() => {
            // Set up multiple keys for these tests
            process.env.OPENROUTER_API_KEYS = 'key1,key2,key3';
            delete process.env.OPENROUTER_API_KEY;
        });

        it('initializes with multiple API keys', () => {
            const multiKeyClient = new AnthropicClient();
            expect(() => multiKeyClient).not.toThrow();
        });

        it('rotates through keys in round-robin fashion', async () => {
            const multiKeyClient = new AnthropicClient();
            const mockResponse = {
                id: 'test',
                object: 'chat.completion',
                created: 1708963200,
                model: 'anthropic/claude-3.5-sonnet',
                choices: [{
                    index: 0,
                    message: { role: 'assistant', content: 'Test' },
                    finish_reason: 'stop'
                }],
                usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
            };

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => mockResponse
            });

            // Make 3 requests to cycle through all keys
            for (let i = 0; i < 3; i++) {
                await multiKeyClient.sendMessage({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 100,
                    messages: [{ role: 'user', content: `Request ${i + 1}` }]
                });
            }

            // Check that each request used a different key
            const authHeaders = (fetch as jest.Mock).mock.calls.map(
                call => call[1].headers['Authorization']
            );

            expect(authHeaders).toEqual([
                'Bearer key1',
                'Bearer key2',
                'Bearer key3'
            ]);
        });

        it('handles rate limit errors by switching to next key', async () => {
            const multiKeyClient = new AnthropicClient();

            const rateLimitResponse = {
                ok: false,
                status: 429,
                json: async () => ({
                    error: {
                        message: 'Rate limit exceeded',
                        type: 'rate_limit_error'
                    }
                })
            };

            const successResponse = {
                ok: true,
                status: 200,
                json: async () => ({
                    id: 'test',
                    object: 'chat.completion',
                    created: 1708963200,
                    model: 'anthropic/claude-3.5-sonnet',
                    choices: [{
                        index: 0,
                        message: { role: 'assistant', content: 'Success after retry' },
                        finish_reason: 'stop'
                    }],
                    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
                })
            };

            // First call fails with rate limit, second succeeds
            global.fetch = jest.fn()
                .mockResolvedValueOnce(rateLimitResponse)
                .mockResolvedValueOnce(successResponse);

            const response = await multiKeyClient.sendMessage({
                model: 'claude-3-sonnet-20240229',
                max_tokens: 100,
                messages: [{ role: 'user', content: 'Test rate limit retry' }]
            });

            expect(response.content[0].text).toBe('Success after retry');
            expect(fetch).toHaveBeenCalledTimes(2);

            // Verify different keys were used
            const authHeaders = (fetch as jest.Mock).mock.calls.map(
                call => call[1].headers['Authorization']
            );
            expect(authHeaders[0]).toBe('Bearer key1');
            expect(authHeaders[1]).toBe('Bearer key2');
        });

        it('marks keys as failed temporarily after rate limit', async () => {
            const multiKeyClient = new AnthropicClient();

            const rateLimitResponse = {
                ok: false,
                status: 429,
                json: async () => ({
                    error: {
                        message: 'Rate limit exceeded',
                        type: 'rate_limit_error'
                    }
                })
            };

            const successResponse = {
                ok: true,
                status: 200,
                json: async () => ({
                    id: 'test',
                    object: 'chat.completion',
                    created: 1708963200,
                    model: 'anthropic/claude-3.5-sonnet',
                    choices: [{
                        index: 0,
                        message: { role: 'assistant', content: 'Success' },
                        finish_reason: 'stop'
                    }],
                    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
                })
            };

            // First key fails with rate limit
            global.fetch = jest.fn()
                .mockResolvedValueOnce(rateLimitResponse)
                .mockResolvedValue(successResponse);

            // First request triggers rate limit on key1
            await multiKeyClient.sendMessage({
                model: 'claude-3-sonnet-20240229',
                max_tokens: 100,
                messages: [{ role: 'user', content: 'Request 1' }]
            });

            // Get usage stats to check failed keys
            const stats = multiKeyClient.getKeyUsageStats();
            expect(stats.failedKeys).toBe(1);
            expect(stats.activeKeys).toBe(2);

            // Make more requests - should skip key1
            jest.clearAllMocks();
            for (let i = 0; i < 3; i++) {
                await multiKeyClient.sendMessage({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 100,
                    messages: [{ role: 'user', content: `Request ${i + 2}` }]
                });
            }

            // Should only use key2 and key3, not key1
            const authHeaders = (fetch as jest.Mock).mock.calls.map(
                call => call[1].headers['Authorization']
            );
            expect(authHeaders).toEqual([
                'Bearer key2',
                'Bearer key3',
                'Bearer key2'
            ]);
        });

        it('handles streaming with multiple keys', async () => {
            const multiKeyClient = new AnthropicClient();

            const chunks = [
                { id: 'chat-123', object: 'chat.completion.chunk', created: 1708963200, model: 'anthropic/claude-3.5-sonnet', choices: [{ index: 0, delta: { content: 'Hello' }, finish_reason: null }] },
                { id: 'chat-123', object: 'chat.completion.chunk', created: 1708963200, model: 'anthropic/claude-3.5-sonnet', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }
            ];

            const mockStream = new ReadableStream({
                start(controller) {
                    chunks.forEach((chunk) => {
                        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`));
                    });
                    controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
                    controller.close();
                }
            });

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                body: mockStream
            });

            const stream = await multiKeyClient.sendStreamingMessage({
                model: 'claude-3-sonnet-20240229',
                max_tokens: 100,
                stream: true,
                messages: [{ role: 'user', content: 'Stream test' }]
            });

            expect(stream).toBeDefined();
            expect(fetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer key1' // First key should be used
                    })
                })
            );
        });

        it('reports key usage statistics correctly', async () => {
            const multiKeyClient = new AnthropicClient();

            const mockResponse = {
                ok: true,
                status: 200,
                json: async () => ({
                    id: 'test',
                    object: 'chat.completion',
                    created: 1708963200,
                    model: 'anthropic/claude-3.5-sonnet',
                    choices: [{
                        index: 0,
                        message: { role: 'assistant', content: 'Test' },
                        finish_reason: 'stop'
                    }],
                    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
                })
            };

            global.fetch = jest.fn().mockResolvedValue(mockResponse);

            // Make several requests
            for (let i = 0; i < 5; i++) {
                await multiKeyClient.sendMessage({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 100,
                    messages: [{ role: 'user', content: `Request ${i + 1}` }]
                });
            }

            const stats = multiKeyClient.getKeyUsageStats();

            expect(stats.totalKeys).toBe(3);
            expect(stats.activeKeys).toBe(3);
            expect(stats.failedKeys).toBe(0);

            // Check individual key usage
            expect(stats.usage.key_1.requests).toBe(2); // Used for requests 1 and 4
            expect(stats.usage.key_2.requests).toBe(2); // Used for requests 2 and 5
            expect(stats.usage.key_3.requests).toBe(1); // Used for request 3

            // Verify key previews for security
            expect(stats.usage.key_1.keyPreview).toBe('...key1');
            expect(stats.usage.key_2.keyPreview).toBe('...key2');
            expect(stats.usage.key_3.keyPreview).toBe('...key3');
        });

        it('handles all keys being rate limited', async () => {
            const multiKeyClient = new AnthropicClient();

            const rateLimitResponse = {
                ok: false,
                status: 429,
                json: async () => ({
                    error: {
                        message: 'Rate limit exceeded',
                        type: 'rate_limit_error'
                    }
                })
            };

            // All requests fail with rate limit
            global.fetch = jest.fn().mockResolvedValue(rateLimitResponse);

            await expect(multiKeyClient.sendMessage({
                model: 'claude-3-sonnet-20240229',
                max_tokens: 100,
                messages: [{ role: 'user', content: 'Test all keys failed' }]
            })).rejects.toThrow('rate_limit_error');

            // Should have tried 3 times (once per key)
            expect(fetch).toHaveBeenCalledTimes(3);

            // Verify different keys were attempted
            const authHeaders = (fetch as jest.Mock).mock.calls.map(
                call => call[1].headers['Authorization']
            );
            expect(authHeaders).toEqual([
                'Bearer key1',
                'Bearer key2',
                'Bearer key3'
            ]);
        });
    });
}); 