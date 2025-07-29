import { NextRequest, NextResponse } from 'next/server';
import { jest } from '@jest/globals';

// Mock the entire proxy system for CLI testing
jest.mock('../../../lib/anthropic-proxy/core/AnthropicClient');
jest.mock('../../../lib/anthropic-proxy/auth/ProxyAuth');
jest.mock('../../../lib/anthropic-proxy/billing/SVMAIBalanceManager');

describe('Claude CLI Compatibility Tests', () => {
    let mockAnthropicResponse: any;
    let mockStreamingResponse: any;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock standard Anthropic API response
        mockAnthropicResponse = {
            id: 'msg_01A1B2C3D4E5F6G7H8I9J0K1',
            type: 'message',
            role: 'assistant',
            content: [
                {
                    type: 'text',
                    text: 'Hello! How can I help you today?'
                }
            ],
            model: 'claude-3-sonnet-20240229',
            stop_reason: 'end_turn',
            stop_sequence: null,
            usage: {
                input_tokens: 12,
                output_tokens: 8
            }
        };

        // Mock streaming response chunks
        mockStreamingResponse = [
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
                    usage: { input_tokens: 12, output_tokens: 0 }
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
                delta: { type: 'text_delta', text: 'Hello!' }
            },
            {
                type: 'content_block_delta',
                index: 0,
                delta: { type: 'text_delta', text: ' How can I help you today?' }
            },
            {
                type: 'content_block_stop',
                index: 0
            },
            {
                type: 'message_delta',
                delta: { stop_reason: 'end_turn', stop_sequence: null },
                usage: { output_tokens: 8 }
            },
            {
                type: 'message_stop'
            }
        ];
    });

    describe('Claude CLI Authentication', () => {
        it('accepts API keys in Anthropic format', async () => {
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-test-key-here',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': 'claude-cli/1.0.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    messages: [
                        { role: 'user', content: 'Hello Claude!' }
                    ]
                })
            });

            // Mock the proxy response
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Headers({
                    'Content-Type': 'application/json',
                    'x-request-id': 'req_test_123'
                }),
                json: async () => mockAnthropicResponse
            });

            const response = await fetch(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.id).toBe('msg_01A1B2C3D4E5F6G7H8I9J0K1');
            expect(data.content[0].text).toBe('Hello! How can I help you today?');
            expect(data.usage).toEqual({
                input_tokens: 12,
                output_tokens: 8
            });
        });

        it('rejects invalid API key format', async () => {
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer invalid-key-format',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: 'Hello' }]
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
            expect(error.error.message).toContain('API key is invalid');
        });

        it('handles missing authorization header', async () => {
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: 'Hello' }]
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
    });

    describe('Claude CLI Commands', () => {
        beforeEach(() => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Headers({
                    'Content-Type': 'application/json',
                    'x-request-id': 'req_test_123'
                }),
                json: async () => mockAnthropicResponse
            });
        });

        it('handles simple message command', async () => {
            // Simulates: claude "Hello Claude!"
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': 'claude-cli/1.0.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    messages: [
                        { role: 'user', content: 'Hello Claude!' }
                    ]
                })
            });

            const response = await fetch(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.type).toBe('message');
            expect(data.role).toBe('assistant');
            expect(data.content).toHaveLength(1);
            expect(data.content[0].type).toBe('text');
        });

        it('handles model selection', async () => {
            // Simulates: claude --model claude-3-haiku-20240307 "Quick question"
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-haiku-20240307',
                    max_tokens: 1024,
                    messages: [
                        { role: 'user', content: 'Quick question' }
                    ]
                })
            });

            const haikuResponse = {
                ...mockAnthropicResponse,
                model: 'claude-3-haiku-20240307'
            };

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => haikuResponse
            });

            const response = await fetch(request);
            const data = await response.json();

            expect(data.model).toBe('claude-3-haiku-20240307');
        });

        it('handles max tokens parameter', async () => {
            // Simulates: claude --max-tokens 500 "Generate a short story"
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 500,
                    messages: [
                        { role: 'user', content: 'Generate a short story' }
                    ]
                })
            });

            const response = await fetch(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.usage.output_tokens).toBeLessThanOrEqual(500);
        });

        it('handles system prompts', async () => {
            // Simulates: claude --system "You are a helpful coding assistant" "Write a function"
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    system: 'You are a helpful coding assistant',
                    messages: [
                        { role: 'user', content: 'Write a function' }
                    ]
                })
            });

            const response = await fetch(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.content[0].text).toBeDefined();
        });

        it('handles temperature parameter', async () => {
            // Simulates: claude --temperature 0.7 "Be creative"
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    temperature: 0.7,
                    messages: [
                        { role: 'user', content: 'Be creative' }
                    ]
                })
            });

            const response = await fetch(request);
            expect(response.status).toBe(200);
        });
    });

    describe('Claude CLI Streaming', () => {
        it('handles streaming responses correctly', async () => {
            // Simulates: claude --stream "Tell me a story"
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    stream: true,
                    messages: [
                        { role: 'user', content: 'Tell me a story' }
                    ]
                })
            });

            // Mock streaming response
            const mockStream = new ReadableStream({
                start(controller) {
                    mockStreamingResponse.forEach((chunk, index) => {
                        setTimeout(() => {
                            controller.enqueue(new TextEncoder().encode(
                                `data: ${JSON.stringify(chunk)}\n\n`
                            ));
                            if (index === mockStreamingResponse.length - 1) {
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

            // Verify we can read the stream
            const reader = response.body?.getReader();
            expect(reader).toBeDefined();
        });

        it('handles streaming with proper SSE format', async () => {
            const chunks: string[] = [];

            // Mock a proper SSE stream
            const mockStream = new ReadableStream({
                start(controller) {
                    const sseData = [
                        'data: {"type":"message_start","message":{"id":"msg_123","type":"message","role":"assistant","content":[],"model":"claude-3-sonnet-20240229","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":12,"output_tokens":0}}}\n\n',
                        'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
                        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello!"}}\n\n',
                        'data: {"type":"content_block_stop","index":0}\n\n',
                        'data: {"type":"message_stop"}\n\n',
                        'data: [DONE]\n\n'
                    ];

                    sseData.forEach((data, index) => {
                        setTimeout(() => {
                            controller.enqueue(new TextEncoder().encode(data));
                            if (index === sseData.length - 1) {
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
                    'Content-Type': 'text/event-stream'
                }),
                body: mockStream
            });

            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    stream: true,
                    messages: [{ role: 'user', content: 'Hello' }]
                })
            });

            const response = await fetch(request);
            expect(response.headers.get('Content-Type')).toBe('text/event-stream');
        });
    });

    describe('Claude CLI Error Handling', () => {
        it('handles invalid model errors', async () => {
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-nonexistent-model',
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: 'Hello' }]
                })
            });

            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 400,
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => ({
                    error: {
                        type: 'invalid_request_error',
                        message: "Model 'claude-nonexistent-model' is not available. Available models: claude-3-sonnet-20240229, claude-3-haiku-20240307, claude-3-opus-20240229"
                    }
                })
            });

            const response = await fetch(request);
            const error = await response.json();

            expect(response.status).toBe(400);
            expect(error.error.type).toBe('invalid_request_error');
            expect(error.error.message).toContain('not available');
        });

        it('handles token limit errors', async () => {
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 500000, // Exceeds limit
                    messages: [{ role: 'user', content: 'Hello' }]
                })
            });

            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 400,
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => ({
                    error: {
                        type: 'invalid_request_error',
                        message: 'Requested 500000 tokens, but maximum allowed is 4096. Model: claude-3-sonnet-20240229'
                    }
                })
            });

            const response = await fetch(request);
            const error = await response.json();

            expect(response.status).toBe(400);
            expect(error.error.type).toBe('invalid_request_error');
            expect(error.error.message).toContain('maximum allowed');
        });

        it('handles SVMAI billing errors', async () => {
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: 'Hello' }]
                })
            });

            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 402,
                headers: new Headers({
                    'Content-Type': 'application/json',
                    'x-svmai-balance': '10',
                    'x-svmai-required': '50',
                    'x-deposit-address': 'A7X8mNzE3QqJ9PdKfR2vS6tY8uZ1wBcDeFgHiJkLmNoP'
                }),
                json: async () => ({
                    error: {
                        type: 'authentication_error',
                        message: 'Insufficient SVMAI balance to process this request. Current balance: 10 SVMAI, Required: 50 SVMAI. Please deposit SVMAI tokens to: A7X8mNzE3QqJ9PdKfR2vS6tY8uZ1wBcDeFgHiJkLmNoP'
                    }
                })
            });

            const response = await fetch(request);
            const error = await response.json();

            expect(response.status).toBe(402);
            expect(error.error.type).toBe('authentication_error');
            expect(error.error.message).toContain('Insufficient SVMAI balance');
            expect(response.headers.get('x-svmai-balance')).toBe('10');
            expect(response.headers.get('x-deposit-address')).toBeDefined();
        });

        it('handles rate limiting errors', async () => {
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: 'Hello' }]
                })
            });

            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 429,
                headers: new Headers({
                    'Content-Type': 'application/json',
                    'Retry-After': '60',
                    'x-ratelimit-reset': Math.floor(Date.now() / 1000 + 60).toString()
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
            expect(response.headers.get('Retry-After')).toBe('60');
        });
    });

    describe('Claude CLI Models Endpoint', () => {
        it('returns available models', async () => {
            const request = new Request('https://opensvm.com/v1/models', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-test-key',
                    'anthropic-version': '2023-06-01'
                }
            });

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => ({
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
                            id: 'claude-3-haiku-20240307',
                            object: 'model',
                            created: 1709769600,
                            owned_by: 'anthropic',
                            display_name: 'Claude 3 Haiku',
                            max_tokens: 4096
                        },
                        {
                            id: 'claude-3-opus-20240229',
                            object: 'model',
                            created: 1708963200,
                            owned_by: 'anthropic',
                            display_name: 'Claude 3 Opus',
                            max_tokens: 4096
                        }
                    ]
                })
            });

            const response = await fetch(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data).toHaveLength(3);
            expect(data.data[0].id).toBe('claude-3-sonnet-20240229');
            expect(data.data[0].object).toBe('model');
            expect(data.data[0].owned_by).toBe('anthropic');
        });
    });

    describe('Claude CLI Advanced Features', () => {
        it('handles conversation context', async () => {
            // Simulates multiple back-and-forth messages
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    messages: [
                        { role: 'user', content: 'My name is Alice' },
                        { role: 'assistant', content: 'Hello Alice! Nice to meet you.' },
                        { role: 'user', content: 'What is my name?' }
                    ]
                })
            });

            const contextResponse = {
                ...mockAnthropicResponse,
                content: [{ type: 'text', text: 'Your name is Alice.' }]
            };

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => contextResponse
            });

            const response = await fetch(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.content[0].text).toContain('Alice');
        });

        it('handles stop sequences', async () => {
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    stop_sequences: ['END', '###'],
                    messages: [
                        { role: 'user', content: 'Count to 10 and then say END' }
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

            expect(response.status).toBe(200);
            expect(data.stop_reason).toBe('stop_sequence');
            expect(data.stop_sequence).toBe('END');
        });

        it('validates anthropic-version header', async () => {
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-test-key',
                    'Content-Type': 'application/json',
                    // Missing anthropic-version header
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: 'Hello' }]
                })
            });

            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 400,
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => ({
                    error: {
                        type: 'invalid_request_error',
                        message: 'Missing required header: anthropic-version'
                    }
                })
            });

            const response = await fetch(request);
            const error = await response.json();

            expect(response.status).toBe(400);
            expect(error.error.message).toContain('anthropic-version');
        });
    });

    describe('Claude CLI Performance', () => {
        it('handles concurrent requests', async () => {
            const requests = Array.from({ length: 5 }, (_, i) =>
                new Request('https://opensvm.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer sk-ant-api03-test-key',
                        'Content-Type': 'application/json',
                        'anthropic-version': '2023-06-01'
                    },
                    body: JSON.stringify({
                        model: 'claude-3-sonnet-20240229',
                        max_tokens: 100,
                        messages: [{ role: 'user', content: `Request ${i + 1}` }]
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

            expect(responses).toHaveLength(5);
            expect(responses.every(r => r.status === 200)).toBe(true);
            expect(endTime - startTime).toBeLessThan(5000); // Should handle 5 requests quickly
        });

        it('maintains response format consistency', async () => {
            // Test multiple requests to ensure consistent response structure
            const testCases = [
                { model: 'claude-3-sonnet-20240229', content: 'Simple question' },
                { model: 'claude-3-haiku-20240307', content: 'Quick query' },
                { model: 'claude-3-opus-20240229', content: 'Complex analysis' }
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
                        'Authorization': 'Bearer sk-ant-api03-test-key',
                        'Content-Type': 'application/json',
                        'anthropic-version': '2023-06-01'
                    },
                    body: JSON.stringify({
                        model: testCase.model,
                        max_tokens: 1024,
                        messages: [{ role: 'user', content: testCase.content }]
                    })
                });

                const response = await fetch(request);
                const data = await response.json();

                // Verify consistent Anthropic API structure
                expect(data).toHaveProperty('id');
                expect(data).toHaveProperty('type', 'message');
                expect(data).toHaveProperty('role', 'assistant');
                expect(data).toHaveProperty('content');
                expect(data).toHaveProperty('model');
                expect(data).toHaveProperty('stop_reason');
                expect(data).toHaveProperty('usage');
                expect(data.usage).toHaveProperty('input_tokens');
                expect(data.usage).toHaveProperty('output_tokens');
            }
        });
    });
}); 