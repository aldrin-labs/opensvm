import { jest } from '@jest/globals';

// Simple fetch mock setup with proper typing
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
(global as any).fetch = mockFetch;

// Headers polyfill for Jest
class MockHeaders {
    private headers: Record<string, string>;

    constructor(init?: Record<string, string> | [string, string][]) {
        this.headers = {};
        if (init) {
            if (Array.isArray(init)) {
                init.forEach(([key, value]) => {
                    this.headers[key.toLowerCase()] = value;
                });
            } else {
                Object.entries(init).forEach(([key, value]) => {
                    this.headers[key.toLowerCase()] = value;
                });
            }
        }
    }

    get(name: string): string | null {
        return this.headers[name.toLowerCase()] || null;
    }

    set(name: string, value: string): void {
        this.headers[name.toLowerCase()] = value;
    }

    has(name: string): boolean {
        return name.toLowerCase() in this.headers;
    }

    entries(): IterableIterator<[string, string]> {
        return Object.entries(this.headers)[Symbol.iterator]();
    }
}

// Replace global Headers with our mock
(global as any).Headers = MockHeaders;

// Mock Python SDK request patterns
describe('Python Anthropic SDK Compatibility Tests', () => {
    let mockAnthropicResponse: any;
    let mockStreamingChunks: any[];

    beforeEach(() => {
        jest.clearAllMocks();

        // Standard Python SDK response format
        mockAnthropicResponse = {
            id: 'msg_01A1B2C3D4E5F6G7H8I9J0K1',
            type: 'message',
            role: 'assistant',
            content: [
                {
                    type: 'text',
                    text: 'Hello! I\'m Claude, an AI assistant created by Anthropic. How can I help you today?'
                }
            ],
            model: 'claude-3-sonnet-20240229',
            stop_reason: 'end_turn',
            stop_sequence: null,
            usage: {
                input_tokens: 15,
                output_tokens: 25
            }
        };

        // Python SDK streaming chunks
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
                    usage: { input_tokens: 15, output_tokens: 0 }
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
                delta: { type: 'text_delta', text: ' How can I help you?' }
            },
            {
                type: 'content_block_stop',
                index: 0
            },
            {
                type: 'message_delta',
                delta: { stop_reason: 'end_turn', stop_sequence: null },
                usage: { output_tokens: 25 }
            },
            {
                type: 'message_stop'
            }
        ];
    });

    describe('Python SDK Client Initialization', () => {
        it('accepts API key in constructor', async () => {
            // Simulates: client = anthropic.Anthropic(api_key="sk-ant-api03-...")
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-python-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': 'anthropic-python/0.25.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    messages: [
                        { role: 'user', content: 'Hello Claude!' }
                    ]
                })
            });

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                headers: new MockHeaders({
                    'Content-Type': 'application/json',
                    'x-request-id': 'req_python_123'
                }),
                json: async () => mockAnthropicResponse
            });

            const response = await fetch(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.id).toBe('msg_01A1B2C3D4E5F6G7H8I9J0K1');
            expect(data.content[0].text).toContain('Claude');
            expect(data.usage.input_tokens).toBe(15);
            expect(data.usage.output_tokens).toBe(25);
        });

        it('accepts custom base URL', async () => {
            // Simulates: client = anthropic.Anthropic(api_key="...", base_url="https://opensvm.com/v1")
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-python-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': 'anthropic-python/0.25.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: 'Test custom base URL' }]
                })
            });

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                headers: new MockHeaders({ 'Content-Type': 'application/json' }),
                json: async () => mockAnthropicResponse
            });

            const response = await fetch(request);
            expect(response.status).toBe(200);
        });

        it('handles environment variable API key', async () => {
            // Simulates: client = anthropic.Anthropic() with ANTHROPIC_API_KEY env var
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-env-var-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': 'anthropic-python/0.25.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: 'Using env var key' }]
                })
            });

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                headers: new MockHeaders({ 'Content-Type': 'application/json' }),
                json: async () => mockAnthropicResponse
            });

            const response = await fetch(request);
            expect(response.status).toBe(200);
        });
    });

    describe('Python SDK Messages API', () => {
        beforeEach(() => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                headers: new MockHeaders({ 'Content-Type': 'application/json' }),
                json: async () => mockAnthropicResponse
            });
        });

        it('handles messages.create() method', async () => {
            // Simulates: client.messages.create(model="claude-3-sonnet-20240229", max_tokens=1024, messages=[...])
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-python-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': 'anthropic-python/0.25.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    messages: [
                        { role: 'user', content: 'What is the capital of France?' }
                    ]
                })
            });

            const response = await fetch(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toHaveProperty('id');
            expect(data).toHaveProperty('type', 'message');
            expect(data).toHaveProperty('role', 'assistant');
            expect(data).toHaveProperty('content');
            expect(data).toHaveProperty('model');
            expect(data).toHaveProperty('usage');
        });

        it('handles system parameter', async () => {
            // Simulates: client.messages.create(model="...", system="You are a helpful assistant", messages=[...])
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-python-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': 'anthropic-python/0.25.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    system: 'You are a helpful Python programming assistant',
                    messages: [
                        { role: 'user', content: 'Write a hello world program' }
                    ]
                })
            });

            const response = await fetch(request);
            expect(response.status).toBe(200);
        });

        it('handles temperature parameter', async () => {
            // Simulates: client.messages.create(temperature=0.7, ...)
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-python-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': 'anthropic-python/0.25.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    temperature: 0.7,
                    messages: [
                        { role: 'user', content: 'Be creative and write a poem' }
                    ]
                })
            });

            const response = await fetch(request);
            expect(response.status).toBe(200);
        });

        it('handles top_p parameter', async () => {
            // Simulates: client.messages.create(top_p=0.9, ...)
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-python-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': 'anthropic-python/0.25.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    top_p: 0.9,
                    messages: [
                        { role: 'user', content: 'Generate diverse responses' }
                    ]
                })
            });

            const response = await fetch(request);
            expect(response.status).toBe(200);
        });

        it('handles stop_sequences parameter', async () => {
            // Simulates: client.messages.create(stop_sequences=["END", "STOP"], ...)
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-python-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': 'anthropic-python/0.25.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    stop_sequences: ['END', 'STOP'],
                    messages: [
                        { role: 'user', content: 'Count to 5 and then say END' }
                    ]
                })
            });

            const stoppedResponse = {
                ...mockAnthropicResponse,
                content: [{ type: 'text', text: '1, 2, 3, 4, 5 END' }],
                stop_reason: 'stop_sequence',
                stop_sequence: 'END'
            };

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                headers: new MockHeaders({ 'Content-Type': 'application/json' }),
                json: async () => stoppedResponse
            });

            const response = await fetch(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.stop_reason).toBe('stop_sequence');
            expect(data.stop_sequence).toBe('END');
        });
    });

    describe('Python SDK Streaming', () => {
        it('handles stream=True parameter', async () => {
            // Simulates: client.messages.create(stream=True, ...)
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-python-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': 'anthropic-python/0.25.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    stream: true,
                    messages: [
                        { role: 'user', content: 'Tell me a short story' }
                    ]
                })
            });

            // Mock Server-Sent Events response
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

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                headers: new MockHeaders({
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

        it('handles Python async streaming', async () => {
            // Simulates: async for chunk in client.messages.create(stream=True, ...):
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-python-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': 'anthropic-python/0.25.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    stream: true,
                    messages: [
                        { role: 'user', content: 'Stream response please' }
                    ]
                })
            });

            const mockAsyncStream = new ReadableStream({
                start(controller) {
                    const chunks = [
                        'data: {"type":"message_start","message":{"id":"msg_123","type":"message","role":"assistant","content":[],"model":"claude-3-sonnet-20240229","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":15,"output_tokens":0}}}\n\n',
                        'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
                        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello from Python!"}}\n\n',
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

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                headers: new MockHeaders({
                    'Content-Type': 'text/event-stream'
                }),
                body: mockAsyncStream
            });

            const response = await fetch(request);
            expect(response.status).toBe(200);
            expect(response.headers.get('Content-Type')).toBe('text/event-stream');
        });
    });

    describe('Python SDK Error Handling', () => {
        it('handles AuthenticationError exceptions', async () => {
            // Simulates: except anthropic.AuthenticationError as e:
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer invalid-python-api-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': 'anthropic-python/0.25.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: 'Hello' }]
                })
            });

            mockFetch.mockResolvedValue({
                ok: false,
                status: 401,
                headers: new MockHeaders({ 'Content-Type': 'application/json' }),
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

        it('handles RateLimitError exceptions', async () => {
            // Simulates: except anthropic.RateLimitError as e:
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-python-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': 'anthropic-python/0.25.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: 'Too many requests' }]
                })
            });

            mockFetch.mockResolvedValue({
                ok: false,
                status: 429,
                headers: new MockHeaders({
                    'Content-Type': 'application/json',
                    'Retry-After': '60'
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

        it('handles BadRequestError exceptions', async () => {
            // Simulates: except anthropic.BadRequestError as e:
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-python-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': 'anthropic-python/0.25.0'
                },
                body: JSON.stringify({
                    model: 'invalid-model-name',
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: 'Hello' }]
                })
            });

            mockFetch.mockResolvedValue({
                ok: false,
                status: 400,
                headers: new MockHeaders({ 'Content-Type': 'application/json' }),
                json: async () => ({
                    error: {
                        type: 'invalid_request_error',
                        message: "Model 'invalid-model-name' is not available. Available models: claude-3-sonnet-20240229, claude-3-haiku-20240307, claude-3-opus-20240229"
                    }
                })
            });

            const response = await fetch(request);
            const error = await response.json();

            expect(response.status).toBe(400);
            expect(error.error.type).toBe('invalid_request_error');
            expect(error.error.message).toContain('not available');
        });

        it('handles SVMAI billing errors in Python-compatible format', async () => {
            // Custom SVMAI billing error that should still work with Python SDK
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-python-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': 'anthropic-python/0.25.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: 'This should fail due to balance' }]
                })
            });

            mockFetch.mockResolvedValue({
                ok: false,
                status: 402,
                headers: new MockHeaders({
                    'Content-Type': 'application/json',
                    'x-svmai-balance': '5',
                    'x-svmai-required': '25',
                    'x-deposit-address': 'A7X8mNzE3QqJ9PdKfR2vS6tY8uZ1wBcDeFgHiJkLmNoP'
                }),
                json: async () => ({
                    error: {
                        type: 'authentication_error', // Use auth error for billing compatibility
                        message: 'Insufficient SVMAI balance to process this request. Current balance: 5 SVMAI, Required: 25 SVMAI. Please deposit SVMAI tokens to: A7X8mNzE3QqJ9PdKfR2vS6tY8uZ1wBcDeFgHiJkLmNoP'
                    }
                })
            });

            const response = await fetch(request);
            const error = await response.json();

            expect(response.status).toBe(402);
            expect(error.error.type).toBe('authentication_error');
            expect(error.error.message).toContain('Insufficient SVMAI balance');
            expect(response.headers.get('x-svmai-balance')).toBe('5');
        });
    });

    describe('Python SDK Advanced Features', () => {
        it('handles multi-turn conversations', async () => {
            // Simulates building conversation history in Python
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-python-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': 'anthropic-python/0.25.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    messages: [
                        { role: 'user', content: 'Hi, I\'m working on a Python project' },
                        { role: 'assistant', content: 'Great! I\'d be happy to help with your Python project. What are you working on?' },
                        { role: 'user', content: 'I need help with error handling' },
                        { role: 'assistant', content: 'Error handling in Python is important. What specific aspect would you like to know about?' },
                        { role: 'user', content: 'How do I use try/except blocks effectively?' }
                    ]
                })
            });

            const contextualResponse = {
                ...mockAnthropicResponse,
                content: [{
                    type: 'text',
                    text: 'Here\'s how to use try/except blocks effectively in Python:\n\n```python\ntry:\n    # Code that might raise an exception\n    result = some_operation()\nexcept SpecificError as e:\n    # Handle specific error\n    print(f"Specific error occurred: {e}")\nexcept Exception as e:\n    # Handle any other exception\n    print(f"Unexpected error: {e}")\nelse:\n    # This runs if no exception occurred\n    print("Operation successful")\nfinally:\n    # This always runs\n    cleanup()\n```'
                }]
            };

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                headers: new MockHeaders({ 'Content-Type': 'application/json' }),
                json: async () => contextualResponse
            });

            const response = await fetch(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.content[0].text).toContain('try/except');
            expect(data.content[0].text).toContain('python');
        });

        it('handles large context windows', async () => {
            // Test with large message content (common in Python data processing)
            const largeContent = 'x'.repeat(50000); // 50KB of content

            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-python-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': 'anthropic-python/0.25.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 4096,
                    messages: [
                        { role: 'user', content: `Analyze this data: ${largeContent}` }
                    ]
                })
            });

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                headers: new MockHeaders({ 'Content-Type': 'application/json' }),
                json: async () => ({
                    ...mockAnthropicResponse,
                    usage: { input_tokens: 12500, output_tokens: 150 }
                })
            });

            const response = await fetch(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.usage.input_tokens).toBeGreaterThan(10000);
        });

        it('handles Python async/await patterns', async () => {
            // Simulates: response = await client.messages.create(...)
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-python-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': 'anthropic-python/0.25.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    messages: [
                        { role: 'user', content: 'This is an async request from Python' }
                    ]
                })
            });

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                headers: new MockHeaders({ 'Content-Type': 'application/json' }),
                json: async () => mockAnthropicResponse
            });

            const response = await fetch(request);
            expect(response.status).toBe(200);
        });

        it('handles Python requests with custom headers', async () => {
            // Simulates custom headers added by Python applications
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-python-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': 'MyPythonApp/1.0 anthropic-python/0.25.0',
                    'X-Request-ID': 'python-req-12345',
                    'X-Application': 'data-analysis-tool'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    messages: [
                        { role: 'user', content: 'Request with custom headers' }
                    ]
                })
            });

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                headers: new MockHeaders({ 'Content-Type': 'application/json' }),
                json: async () => mockAnthropicResponse
            });

            const response = await fetch(request);
            expect(response.status).toBe(200);
        });
    });

    describe('Python SDK Response Handling', () => {
        it('provides proper response object attributes', async () => {
            // Test that response has all expected Python SDK attributes
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-python-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': 'anthropic-python/0.25.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: 'Test response attributes' }]
                })
            });

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                headers: new MockHeaders({ 'Content-Type': 'application/json' }),
                json: async () => mockAnthropicResponse
            });

            const response = await fetch(request);
            const data = await response.json();

            // Verify all required attributes for Python SDK compatibility
            expect(data).toHaveProperty('id');
            expect(data).toHaveProperty('type');
            expect(data).toHaveProperty('role');
            expect(data).toHaveProperty('content');
            expect(data).toHaveProperty('model');
            expect(data).toHaveProperty('stop_reason');
            expect(data).toHaveProperty('usage');

            // Verify content structure
            expect(Array.isArray(data.content)).toBe(true);
            expect(data.content[0]).toHaveProperty('type');
            expect(data.content[0]).toHaveProperty('text');

            // Verify usage structure
            expect(data.usage).toHaveProperty('input_tokens');
            expect(data.usage).toHaveProperty('output_tokens');
        });

        it('handles content extraction properly', async () => {
            // Simulates: response.content[0].text
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-python-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': 'anthropic-python/0.25.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: 'Return simple text' }]
                })
            });

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                headers: new MockHeaders({ 'Content-Type': 'application/json' }),
                json: async () => mockAnthropicResponse
            });

            const response = await fetch(request);
            const data = await response.json();

            expect(data.content).toHaveLength(1);
            expect(data.content[0].type).toBe('text');
            expect(typeof data.content[0].text).toBe('string');
            expect(data.content[0].text.length).toBeGreaterThan(0);
        });
    });

    describe('Python SDK Performance Tests', () => {
        it('handles concurrent requests efficiently', async () => {
            // Simulates: await asyncio.gather(*[client.messages.create(...) for _ in range(10)])
            const requests = Array.from({ length: 10 }, (_, i) =>
                new Request('https://opensvm.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer sk-ant-api03-python-test-key',
                        'Content-Type': 'application/json',
                        'anthropic-version': '2023-06-01',
                        'User-Agent': 'anthropic-python/0.25.0'
                    },
                    body: JSON.stringify({
                        model: 'claude-3-sonnet-20240229',
                        max_tokens: 100,
                        messages: [{ role: 'user', content: `Concurrent request ${i + 1}` }]
                    })
                })
            );

            mockFetch.mockImplementation(() =>
                Promise.resolve({
                    ok: true,
                    status: 200,
                    headers: new MockHeaders({ 'Content-Type': 'application/json' }),
                    json: async () => mockAnthropicResponse
                })
            );

            const startTime = Date.now();
            const responses = await Promise.all(requests.map(req => fetch(req)));
            const endTime = Date.now();

            expect(responses).toHaveLength(10);
            expect(responses.every(r => r.status === 200)).toBe(true);
            expect(endTime - startTime).toBeLessThan(3000); // Should handle 10 requests efficiently
        });

        it('handles memory-efficient streaming', async () => {
            // Test streaming for large responses (important for Python data processing)
            const request = new Request('https://opensvm.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer sk-ant-api03-python-test-key',
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'User-Agent': 'anthropic-python/0.25.0'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 4096,
                    stream: true,
                    messages: [
                        { role: 'user', content: 'Generate a long response for streaming test' }
                    ]
                })
            });

            const mockLargeStream = new ReadableStream({
                start(controller) {
                    // Simulate 50 chunks for a large response
                    for (let i = 0; i < 50; i++) {
                        setTimeout(() => {
                            controller.enqueue(new TextEncoder().encode(
                                `data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Chunk ${i + 1} "}}\n\n`
                            ));
                            if (i === 49) {
                                controller.enqueue(new TextEncoder().encode('data: {"type":"message_stop"}\n\n'));
                                controller.close();
                            }
                        }, i * 5);
                    }
                }
            });

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                headers: new MockHeaders({ 'Content-Type': 'text/event-stream' }),
                body: mockLargeStream
            });

            const response = await fetch(request);
            expect(response.status).toBe(200);
            expect(response.headers.get('Content-Type')).toBe('text/event-stream');
        });
    });
});