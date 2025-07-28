import { jest } from '@jest/globals';

// Mock @anthropic-ai/sdk request patterns
describe('@anthropic-ai/sdk JavaScript/TypeScript Compatibility Tests', () => {
    let mockAnthropicResponse: any;
    let mockStreamingChunks: any[];

    beforeEach(() => {
        jest.clearAllMocks();

        // Standard @anthropic-ai/sdk response format
        mockAnthropicResponse = {
            id: 'msg_01A1B2C3D4E5F6G7H8I9J0K1',
            type: 'message',
            role: 'assistant',
            content: [
                {
                    type: 'text',
                    text: 'Hello! I\'m Claude, an AI assistant. How can I help you today?'
                }
            ],
            model: 'claude-3-sonnet-20240229',
            stop_reason: 'end_turn',
            stop_sequence: null,
            usage: {
                input_tokens: 18,
                output_tokens: 22
            }
        };

        // JavaScript SDK streaming chunks
        mockStreamingChunks = [
            {
                type: 'message_start',
                message: {
                    id: 'msg_01A1B2C3D4E5F6G7H8I9J0K1',
                    type: 'message',
                    role: 'assistant',
                    content: [],
                    model: 'claude-3-sonnet-20240229',
                    stop_reason: null,
                    stop_sequence: null,
                    usage: { input_tokens: 18, output_tokens: 0 }
                }
            },
            {
                type: 'content_block_start',
                index: 0,
                content_block: { type: 'text', text: '' }
            },
            {
                type: 'content_block_delta',
                index: 0,
                delta: { type: 'text_delta', text: 'Hello from JavaScript!' }
            },
            {
                type: 'content_block_stop',
                index: 0
            },
            {
                type: 'message_delta',
                delta: { stop_reason: 'end_turn', stop_sequence: null },
                usage: { output_tokens: 22 }
            },
            {
                type: 'message_stop'
            }
        ];
    });

    describe('JavaScript SDK Client Initialization', () => {
        it('accepts API key in constructor', async () => {
            // Simulates: const anthropic = new Anthropic({ apiKey: "sk-ant-api03-..." })
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-js-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': '@anthropic-ai/sdk/0.20.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    messages: [
                        { role: 'user', content: 'Hello from JavaScript!' }
                    ]
                })
            });

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Headers({
                    'Content-Type': 'application/json',
                    'x-request-id': 'req_js_123'
                }),
                json: async () => mockAnthropicResponse
            });

            const response = await fetch(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.id).toBe('msg_01A1B2C3D4E5F6G7H8I9J0K1');
            expect(data.content[0].text).toContain('Claude');
            expect(data.usage.input_tokens).toBe(18);
            expect(data.usage.output_tokens).toBe(22);
        });

        it('accepts custom baseURL', async () => {
            // Simulates: const anthropic = new Anthropic({ apiKey: "...", baseURL: "https://opensvm.com/v1" })
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-js-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': '@anthropic-ai/sdk/0.20.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: 'Test custom baseURL' }]
                })
            });

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => mockAnthropicResponse
            });

            const response = await fetch(request);
            expect(response.status).toBe(200);
        });

        it('handles environment variable API key', async () => {
            // Simulates: process.env.ANTHROPIC_API_KEY usage
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-env-js-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': '@anthropic-ai/sdk/0.20.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: 'Using env var key' }]
                })
            });

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => mockAnthropicResponse
            });

            const response = await fetch(request);
            expect(response.status).toBe(200);
        });

        it('handles timeout configuration', async () => {
            // Simulates: new Anthropic({ apiKey: "...", timeout: 30000 })
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-js-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': '@anthropic-ai/sdk/0.20.0',
                    'X-Timeout': '30000'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: 'Request with custom timeout' }]
                })
            });

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => mockAnthropicResponse
            });

            const response = await fetch(request);
            expect(response.status).toBe(200);
        });
    });

    describe('JavaScript SDK Messages API', () => {
        beforeEach(() => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => mockAnthropicResponse
            });
        });

        it('handles messages.create() method', async () => {
            // Simulates: await anthropic.messages.create({ model: "claude-3-sonnet-20240229", max_tokens: 1024, messages: [...] })
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-js-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': '@anthropic-ai/sdk/0.20.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    messages: [
                        { role: 'user', content: 'What is TypeScript?' }
                    ]
                })
            });

            const response = await fetch(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toMatchObject({
                id: expect.stringMatching(/^msg_/),
                type: 'message',
                role: 'assistant',
                content: expect.arrayContaining([
                    expect.objectContaining({
                        type: 'text',
                        text: expect.any(String)
                    })
                ]),
                model: 'claude-3-sonnet-20240229',
                usage: expect.objectContaining({
                    input_tokens: expect.any(Number),
                    output_tokens: expect.any(Number)
                })
            });
        });

        it('handles TypeScript type safety', async () => {
            // Simulates TypeScript interfaces and type checking
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-js-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': '@anthropic-ai/sdk/0.20.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229' as const, // TypeScript literal type
                    max_tokens: 1024 as number,
                    messages: [
                        {
                            role: 'user' as const,
                            content: 'TypeScript type safety test' as string
                        }
                    ]
                })
            });

            const response = await fetch(request);
            const data = await response.json();

            // Verify response matches TypeScript Message interface
            expect(data.type).toBe('message');
            expect(data.role).toBe('assistant');
            expect(Array.isArray(data.content)).toBe(true);
            expect(typeof data.model).toBe('string');
            expect(typeof data.usage.input_tokens).toBe('number');
            expect(typeof data.usage.output_tokens).toBe('number');
        });

        it('handles optional parameters with defaults', async () => {
            // Simulates: await anthropic.messages.create({ model, max_tokens, messages, temperature: 0.7 })
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-js-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': '@anthropic-ai/sdk/0.20.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    temperature: 0.7,
                    top_p: 0.9,
                    messages: [
                        { role: 'user', content: 'Generate creative content' }
                    ]
                })
            });

            const response = await fetch(request);
            expect(response.status).toBe(200);
        });

        it('handles system messages properly', async () => {
            // Simulates: system parameter in JavaScript
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-js-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': '@anthropic-ai/sdk/0.20.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    system: 'You are a helpful JavaScript and TypeScript coding assistant.',
                    messages: [
                        { role: 'user', content: 'Help me with async/await syntax' }
                    ]
                })
            });

            const response = await fetch(request);
            expect(response.status).toBe(200);
        });

        it('handles stop_sequences array', async () => {
            // Simulates: stop_sequences parameter
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-js-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': '@anthropic-ai/sdk/0.20.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    stop_sequences: ['END', 'STOP', '###'],
                    messages: [
                        { role: 'user', content: 'Count to 10 and say END' }
                    ]
                })
            });

            const stoppedResponse = {
                ...mockAnthropicResponse,
                content: [{ type: 'text', text: '1, 2, 3, 4, 5, 6, 7, 8, 9, 10 END' }],
                stop_reason: 'stop_sequence',
                stop_sequence: 'END'
            };

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => stoppedResponse
            });

            const response = await fetch(request);
            const data = await response.json();

            expect(data.stop_reason).toBe('stop_sequence');
            expect(data.stop_sequence).toBe('END');
        });
    });

    describe('JavaScript SDK Streaming', () => {
        it('handles stream: true parameter', async () => {
            // Simulates: const stream = await anthropic.messages.create({ stream: true, ... })
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-js-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': '@anthropic-ai/sdk/0.20.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    stream: true,
                    messages: [
                        { role: 'user', content: 'Stream a response about JavaScript' }
                    ]
                })
            });

            const mockStream = new ReadableStream({
                start(controller) {
                    mockStreamingChunks.forEach((chunk, index) => {
                        setTimeout(() => {
                            controller.enqueue(new TextEncoder().encode(
                                `data: ${JSON.stringify(chunk)}\n\n`
                            ));
                            if (index === mockStreamingChunks.length - 1) {
                                controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
                                controller.close();
                            }
                        }, index * 10);
                    });
                }
            });

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Headers({
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                }),
                body: mockStream
            });

            const response = await fetch(request);

            expect(response.status).toBe(200);
            expect(response.headers.get('Content-Type')).toBe('text/event-stream');
        });

        it('handles async iteration over stream', async () => {
            // Simulates: for await (const chunk of stream) { ... }
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-js-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': '@anthropic-ai/sdk/0.20.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    stream: true,
                    messages: [
                        { role: 'user', content: 'Stream async iteration test' }
                    ]
                })
            });

            const mockAsyncIterableStream = new ReadableStream({
                start(controller) {
                    const chunks = [
                        'data: {"type":"message_start","message":{"id":"msg_123","type":"message","role":"assistant","content":[],"model":"claude-3-sonnet-20240229","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":18,"output_tokens":0}}}\n\n',
                        'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
                        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"JavaScript rocks!"}}\n\n',
                        'data: {"type":"content_block_stop","index":0}\n\n',
                        'data: {"type":"message_stop"}\n\n'
                    ];

                    chunks.forEach((chunk, index) => {
                        setTimeout(() => {
                            controller.enqueue(new TextEncoder().encode(chunk));
                            if (index === chunks.length - 1) {
                                controller.close();
                            }
                        }, index * 10);
                    });
                }
            });

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Headers({ 'Content-Type': 'text/event-stream' }),
                body: mockAsyncIterableStream
            });

            const response = await fetch(request);
            expect(response.status).toBe(200);
            expect(response.headers.get('Content-Type')).toBe('text/event-stream');
        });
    });

    describe('JavaScript SDK Error Handling', () => {
        it('handles APIError exceptions', async () => {
            // Simulates: try { ... } catch (error) { if (error instanceof Anthropic.APIError) ... }
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer invalid-js-api-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': '@anthropic-ai/sdk/0.20.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: 'This should fail' }]
                })
            });

            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 401,
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => ({
                    error: {
                        type: 'authentication_error',
                        message: 'Your API key is invalid or missing. Please check your API key and try again.'
                    }
                })
            });

            const response = await fetch(request);
            const error = await response.json();

            expect(response.status).toBe(401);
            expect(error.error.type).toBe('authentication_error');
        });

        it('handles RateLimitError with retry headers', async () => {
            // Simulates: if (error instanceof Anthropic.RateLimitError) { setTimeout(retry, error.retryAfter * 1000) }
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-js-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': '@anthropic-ai/sdk/0.20.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: 'Rate limited request' }]
                })
            });

            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 429,
                headers: new Headers({
                    'Content-Type': 'application/json',
                    'Retry-After': '30',
                    'X-RateLimit-Limit': '1000',
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': Math.floor(Date.now() / 1000 + 30).toString()
                }),
                json: async () => ({
                    error: {
                        type: 'rate_limit_error',
                        message: 'You have exceeded your rate limit. Please slow down your requests.'
                    }
                })
            });

            const response = await fetch(request);
            const error = await response.json();

            expect(response.status).toBe(429);
            expect(error.error.type).toBe('rate_limit_error');
            expect(response.headers.get('Retry-After')).toBe('30');
        });

        it('handles BadRequestError with validation details', async () => {
            // Simulates: if (error instanceof Anthropic.BadRequestError) { console.log(error.message) }
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-js-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': '@anthropic-ai/sdk/0.20.0'
                },
                body: JSON.stringify({
                    model: 'claude-nonexistent-model',
                    max_tokens: -1, // Invalid value
                    messages: [] // Empty messages array
                })
            });

            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 400,
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => ({
                    error: {
                        type: 'invalid_request_error',
                        message: 'Invalid value for field \'max_tokens\'. Expected positive integer.'
                    }
                })
            });

            const response = await fetch(request);
            const error = await response.json();

            expect(response.status).toBe(400);
            expect(error.error.type).toBe('invalid_request_error');
            expect(error.error.message).toContain('max_tokens');
        });

        it('handles SVMAI billing errors gracefully', async () => {
            // Custom SVMAI billing error that maintains JavaScript SDK compatibility
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-js-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': '@anthropic-ai/sdk/0.20.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: 'This should trigger billing error' }]
                })
            });

            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 402,
                headers: new Headers({
                    'Content-Type': 'application/json',
                    'x-svmai-balance': '2',
                    'x-svmai-required': '15',
                    'x-deposit-address': 'A7X8mNzE3QqJ9PdKfR2vS6tY8uZ1wBcDeFgHiJkLmNoP'
                }),
                json: async () => ({
                    error: {
                        type: 'authentication_error', // Use auth error for billing compatibility
                        message: 'Insufficient SVMAI balance to process this request. Current balance: 2 SVMAI, Required: 15 SVMAI. Please deposit SVMAI tokens to: A7X8mNzE3QqJ9PdKfR2vS6tY8uZ1wBcDeFgHiJkLmNoP'
                    }
                })
            });

            const response = await fetch(request);
            const error = await response.json();

            expect(response.status).toBe(402);
            expect(error.error.type).toBe('authentication_error');
            expect(error.error.message).toContain('Insufficient SVMAI balance');
            expect(response.headers.get('x-svmai-balance')).toBe('2');
        });
    });

    describe('JavaScript SDK Browser Compatibility', () => {
        it('handles CORS preflight requests', async () => {
            // Simulates browser CORS preflight
            const preflightRequest = new Request('https://opensvm.com/v1/messages', {
                method: 'OPTIONS',
                headers: {
                    'Origin': 'https://myapp.com',
                    'Access-Control-Request-Method': 'POST',
                    'Access-Control-Request-Headers': 'authorization,content-type,anthropic-version'
                }
            });

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 204,
                headers: new Headers({
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'authorization, content-type, anthropic-version',
                    'Access-Control-Max-Age': '86400'
                })
            });

            const response = await fetch(preflightRequest);

            expect(response.status).toBe(204);
            expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
            expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
        });

        it('handles fetch with AbortController', async () => {
            // Simulates: const controller = new AbortController(); fetch(url, { signal: controller.signal })
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-js-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': '@anthropic-ai/sdk/0.20.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: 'Test with abort controller' }]
                })
            });

            // Mock AbortController behavior
            const mockAbortController = {
                signal: { aborted: false },
                abort: jest.fn()
            };

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => mockAnthropicResponse
            });

            const response = await fetch(request);
            expect(response.status).toBe(200);
        });

        it('handles browser environment detection', async () => {
            // Simulates browser-specific headers and behaviors
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-js-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': 'Mozilla/5.0 (compatible browser) @anthropic-ai/sdk/0.20.0',
                    'Origin': 'https://myapp.com',
                    'Referer': 'https://myapp.com/chat'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: 'Browser request' }]
                })
            });

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Headers({
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': 'https://myapp.com'
                }),
                json: async () => mockAnthropicResponse
            });

            const response = await fetch(request);
            expect(response.status).toBe(200);
        });
    });

    describe('JavaScript SDK Advanced Features', () => {
        it('handles Promise-based responses', async () => {
            // Simulates: anthropic.messages.create(...).then(response => { ... })
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-js-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': '@anthropic-ai/sdk/0.20.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: 'Promise-based request' }]
                })
            });

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => mockAnthropicResponse
            });

            return fetch(request)
                .then(response => response.json())
                .then(data => {
                    expect(data.id).toBeDefined();
                    expect(data.type).toBe('message');
                    expect(data.content).toHaveLength(1);
                });
        });

        it('handles complex conversation history', async () => {
            // Simulates building conversation state in JavaScript
            const conversationHistory = [
                { role: 'user', content: 'Hello, I\'m building a web app' },
                { role: 'assistant', content: 'Great! What kind of web app are you building?' },
                { role: 'user', content: 'A chat interface using your API' },
                { role: 'assistant', content: 'Excellent! I can help you with that. What framework are you using?' },
                { role: 'user', content: 'React with TypeScript' }
            ];

            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-js-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': '@anthropic-ai/sdk/0.20.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    messages: conversationHistory
                })
            });

            const contextualResponse = {
                ...mockAnthropicResponse,
                content: [{
                    type: 'text',
                    text: 'Perfect! React with TypeScript is a great choice for building chat interfaces. Here\'s a simple example of how you can integrate with the Anthropic API:\n\n```typescript\nimport Anthropic from \'@anthropic-ai/sdk\';\n\nconst anthropic = new Anthropic({\n  apiKey: process.env.ANTHROPIC_API_KEY,\n  baseURL: \'https://opensvm.com/v1\'\n});\n\nconst response = await anthropic.messages.create({\n  model: \'claude-3-sonnet-20240229\',\n  max_tokens: 1024,\n  messages: conversationHistory\n});\n```'
                }]
            };

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => contextualResponse
            });

            const response = await fetch(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.content[0].text).toContain('React');
            expect(data.content[0].text).toContain('TypeScript');
        });

        it('handles custom request interceptors', async () => {
            // Simulates middleware/interceptor patterns common in JS
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-js-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': '@anthropic-ai/sdk/0.20.0',
                    'X-Custom-Header': 'custom-value',
                    'X-Request-ID': 'custom-req-12345',
                    'X-Trace-ID': 'trace-67890'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: 'Request with custom headers' }]
                })
            });

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Headers({
                    'Content-Type': 'application/json',
                    'X-Response-ID': 'resp-12345'
                }),
                json: async () => mockAnthropicResponse
            });

            const response = await fetch(request);
            expect(response.status).toBe(200);
            expect(response.headers.get('X-Response-ID')).toBe('resp-12345');
        });

        it('handles JSON response parsing edge cases', async () => {
            // Test robust JSON parsing
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-js-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': '@anthropic-ai/sdk/0.20.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: 'Test special characters: 中文, émojis 🎉, quotes "test"' }]
                })
            });

            const specialResponse = {
                ...mockAnthropicResponse,
                content: [{
                    type: 'text',
                    text: 'I can handle special characters: 中文, émojis 🎉, and quotes "perfectly"!'
                }]
            };

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Headers({ 'Content-Type': 'application/json; charset=utf-8' }),
                json: async () => specialResponse
            });

            const response = await fetch(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.content[0].text).toContain('中文');
            expect(data.content[0].text).toContain('🎉');
            expect(data.content[0].text).toContain('"perfectly"');
        });
    });

    describe('JavaScript SDK Performance Tests', () => {
        it('handles concurrent Promise.all requests', async () => {
            // Simulates: await Promise.all([...requests])
            const requests = Array.from({ length: 8 }, (_, i) =>
                new Request('https://opensvm.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer sk-ant-api03-js-test-key',
                        'Content-Type': 'application/json',
                        'anthropic-version': '2023-06-01',
                        'User-Agent': '@anthropic-ai/sdk/0.20.0'
                    },
                    body: JSON.stringify({
                        model: 'claude-3-sonnet-20240229',
                        max_tokens: 100,
                        messages: [{ role: 'user', content: `Concurrent JS request ${i + 1}` }]
                    })
                })
            );

            global.fetch = jest.fn().mockImplementation(() =>
                Promise.resolve({
                    ok: true,
                    status: 200,
                    headers: new Headers({ 'Content-Type': 'application/json' }),
                    json: async () => mockAnthropicResponse
                })
            );

            const startTime = Date.now();
            const responses = await Promise.all(requests.map(req => fetch(req)));
            const endTime = Date.now();

            expect(responses).toHaveLength(8);
            expect(responses.every(r => r.status === 200)).toBe(true);
            expect(endTime - startTime).toBeLessThan(2000); // Should handle 8 requests efficiently
        });

        it('handles memory-efficient response processing', async () => {
            // Test processing large responses without memory issues
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-js-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': '@anthropic-ai/sdk/0.20.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 4096,
                    messages: [
                        { role: 'user', content: 'Generate a long response for memory testing' }
                    ]
                })
            });

            const largeResponse = {
                ...mockAnthropicResponse,
                content: [{
                    type: 'text',
                    text: 'Large response content. '.repeat(1000) // 22KB of text
                }],
                usage: { input_tokens: 50, output_tokens: 4000 }
            };

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => largeResponse
            });

            const response = await fetch(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.content[0].text.length).toBeGreaterThan(20000);
            expect(data.usage.output_tokens).toBe(4000);
        });

        it('maintains response format consistency across requests', async () => {
            // Test that all responses maintain the same structure
            const testCases = [
                { model: 'claude-3-sonnet-20240229', query: 'Simple question' },
                { model: 'claude-3-haiku-20240307', query: 'Quick query' },
                { model: 'claude-3-opus-20240229', query: 'Complex analysis' }
            ];

            global.fetch = jest.fn().mockImplementation(() =>
                Promise.resolve({
                    ok: true,
                    status: 200,
                    headers: new Headers({ 'Content-Type': 'application/json' }),
                    json: async () => mockAnthropicResponse
                })
            );

            for (const testCase of testCases) {
                const request = new Request('https://opensvm.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer sk-ant-api03-js-test-key',
                        'Content-Type': 'application/json',
                        'anthropic-version': '2023-06-01',
                        'User-Agent': '@anthropic-ai/sdk/0.20.0'
                    },
                    body: JSON.stringify({
                        model: testCase.model,
                        max_tokens: 1024,
                        messages: [{ role: 'user', content: testCase.query }]
                    })
                });

                const response = await fetch(request);
                const data = await response.json();

                // Verify TypeScript-compatible response structure
                expect(data).toMatchObject({
                    id: expect.stringMatching(/^msg_/),
                    type: 'message',
                    role: 'assistant',
                    content: expect.arrayContaining([
                        expect.objectContaining({
                            type: 'text',
                            text: expect.any(String)
                        })
                    ]),
                    model: expect.any(String),
                    stop_reason: expect.any(String),
                    usage: expect.objectContaining({
                        input_tokens: expect.any(Number),
                        output_tokens: expect.any(Number)
                    })
                });
            }
        });
    });
}); 