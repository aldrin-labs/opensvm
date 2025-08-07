import { NextRequest, NextResponse } from 'next/server';
import { getAnthropicClient } from '../../../../lib/anthropic-proxy/core/AnthropicClientSingleton';
import { APIKeyManager } from '../../../../lib/anthropic-proxy/core/APIKeyManager';
import { BillingProcessor } from '../../../../lib/anthropic-proxy/billing/BillingProcessor';
import { ProxyErrorHandler } from '../../../../lib/anthropic-proxy/errors/ProxyErrorHandler';
import { AnthropicRequest } from '../../../../lib/anthropic-proxy/types/AnthropicTypes';
import { globalRateLimiter } from '../../../../lib/anthropic-proxy/middleware/EnhancedRateLimiter';
import { ProxyRequest, ProxyResponse } from '../../../../lib/anthropic-proxy/types/ProxyTypes';

// Polyfill for crypto.randomUUID in test environments
const generateRequestId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for test environments
    return 'req-' + Math.random().toString(36).substr(2, 9);
};

// Enhanced cost estimation based on model and usage patterns
const estimateRequestCost = (anthropicRequest: AnthropicRequest): number => {
    const { model, max_tokens, messages } = anthropicRequest;

    // Base rates per 1000 tokens (in SVMAI tokens)
    const modelRates = {
        'claude-3-opus-20240229': { input: 15, output: 75 },
        'claude-3-sonnet-20240229': { input: 3, output: 15 },
        'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
        'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
        'claude-3-5-haiku-20241022': { input: 1, output: 5 }
    };

    // Default to sonnet rates if model not found
    const rates = modelRates[model as keyof typeof modelRates] || modelRates['claude-3-sonnet-20240229'];

    // Estimate input tokens (rough approximation: 4 chars = 1 token)
    const inputText = messages.map(m =>
        typeof m.content === 'string' ? m.content :
            Array.isArray(m.content) ? m.content.map(c => c.text || '').join('') : ''
    ).join('');
    const estimatedInputTokens = Math.ceil(inputText.length / 4);

    // Calculate costs
    const inputCost = (estimatedInputTokens / 1000) * rates.input;
    const outputCost = (max_tokens / 1000) * rates.output;

    // Add 20% buffer for safety and round up
    return Math.ceil((inputCost + outputCost) * 1.2);
};

// Enhanced actual cost calculation from response
const calculateActualCost = (anthropicResponse: any, model: string): number => {
    const modelRates = {
        'claude-3-opus-20240229': { input: 15, output: 75 },
        'claude-3-sonnet-20240229': { input: 3, output: 15 },
        'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
        'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
        'claude-3-5-haiku-20241022': { input: 1, output: 5 }
    };

    const rates = modelRates[model as keyof typeof modelRates] || modelRates['claude-3-sonnet-20240229'];
    const usage = anthropicResponse.usage;

    const inputCost = (usage.input_tokens / 1000) * rates.input;
    const outputCost = (usage.output_tokens / 1000) * rates.output;

    return Math.ceil(inputCost + outputCost);
};

const apiKeyManager = new APIKeyManager();
const billingProcessor = new BillingProcessor();
const errorHandler = new ProxyErrorHandler();

export async function POST(request: NextRequest) {
    const requestId = generateRequestId();
    const startTime = Date.now();

    try {
        // Check rate limiting first
        const rateLimitResult = globalRateLimiter.checkLimit('/api/v1/messages', request);
        if (!rateLimitResult.allowed) {
            return NextResponse.json(
                {
                    error: {
                        type: 'rate_limit_error',
                        message: 'Too many requests. Please try again later.'
                    }
                },
                {
                    status: 429,
                    headers: {
                        'X-RateLimit-Limit': '100',
                        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
                        'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
                        'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
                    }
                }
            );
        }

        // Extract API key from Authorization header
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                {
                    error: {
                        type: 'authentication_error',
                        message: 'Missing or invalid Authorization header'
                    }
                },
                { status: 401 }
            );
        }

        const apiKey = authHeader.substring(7); // Remove 'Bearer '

        // Validate API key and get user info
        const keyValidation = await apiKeyManager.validateKey(apiKey);
        if (!keyValidation.isValid) {
            return NextResponse.json(
                {
                    error: {
                        type: 'authentication_error',
                        message: 'Invalid API key'
                    }
                },
                { status: 401 }
            );
        }

        const userId = keyValidation.userId!;
        const keyId = keyValidation.keyId!;

        // Parse request body
        let anthropicRequest: AnthropicRequest;
        try {
            anthropicRequest = await request.json();
        } catch (error) {
            return NextResponse.json(
                {
                    error: {
                        type: 'invalid_request_error',
                        message: 'Invalid JSON in request body'
                    }
                },
                { status: 400 }
            );
        }

        // Validate required fields
        if (!anthropicRequest.model || !anthropicRequest.messages || !anthropicRequest.max_tokens) {
            return NextResponse.json(
                {
                    error: {
                        type: 'invalid_request_error',
                        message: 'Missing required fields: model, messages, or max_tokens'
                    }
                },
                { status: 400 }
            );
        }

        // Estimate cost and reserve balance
        const estimatedCost = estimateRequestCost(anthropicRequest);
        const proxyRequest: ProxyRequest = {
            method: 'POST',
            headers: Object.fromEntries(request.headers.entries()),
            body: anthropicRequest,
            userId,
            apiKeyId: keyId,
            estimatedCost
        };

        try {
            await billingProcessor.reserveBalance(proxyRequest);
        } catch (error) {
            return NextResponse.json(
                {
                    error: {
                        type: 'billing_error',
                        message: 'Insufficient balance to process request'
                    }
                },
                { status: 402 }
            );
        }

        // Get Anthropic client and process request
        // Initialize Anthropic client. On first use, an API key is required.
        // Prefer a specific proxy key if provided via environment; otherwise fall back to the caller's key.
        const initKey =
          process.env.ANTHROPIC_PROXY_API_KEY ||
          process.env.ANTHROPIC_API_KEY ||
          apiKey;

        const anthropicClient = getAnthropicClient(initKey);

        try {
            if (anthropicRequest.stream) {
                // Handle streaming request
                const stream = await anthropicClient.sendStreamingMessage(anthropicRequest);

                // Convert ReadableStream to Response
                return new Response(stream, {
                    headers: {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache, no-transform',
                        'Connection': 'keep-alive',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                        'X-Accel-Buffering': 'no',
                        'X-Request-ID': requestId,
                        'X-RateLimit-Limit': '50',
                        'X-RateLimit-Remaining': '49',
                        'X-RateLimit-Reset': new Date(Date.now() + 60000).toISOString(),
                    }
                });
            } else {
                // Handle non-streaming request
                const response = await anthropicClient.sendMessage(anthropicRequest);

                // Process successful response for billing
                const actualCost = calculateActualCost(response, anthropicRequest.model);
                const proxyResponse: ProxyResponse = {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                    body: response,
                    userId,
                    keyId,
                    model: anthropicRequest.model,
                    inputTokens: response.usage?.input_tokens || 0,
                    outputTokens: response.usage?.output_tokens || 0,
                    actualCost,
                    responseTime: Date.now() - startTime,
                    success: true,
                    timestamp: new Date(),
                    anthropicResponse: response
                };

                await billingProcessor.processSuccessfulResponse(proxyResponse);

                return NextResponse.json(response, {
                    headers: {
                        'X-Request-ID': requestId
                    }
                });
            }
        } catch (error) {
            // Process failed response for billing
            const proxyResponse: ProxyResponse = {
                status: 500,
                headers: { 'content-type': 'application/json' },
                body: null,
                userId,
                keyId,
                model: anthropicRequest.model,
                inputTokens: 0,
                outputTokens: 0,
                actualCost: 0,
                responseTime: Date.now() - startTime,
                success: false,
                timestamp: new Date(),
                anthropicResponse: null
            };

            await billingProcessor.processFailedResponse(proxyResponse);

            // Enhanced error handling for different Anthropic API error types
            if (error instanceof Error) {
                const errorMessage = error.message.toLowerCase();

                // Rate limiting errors
                if (errorMessage.includes('rate_limit') || errorMessage.includes('429')) {
                    return NextResponse.json(
                        {
                            error: {
                                type: 'rate_limit_error',
                                message: 'Rate limit exceeded. Please try again later.'
                            }
                        },
                        { status: 429 }
                    );
                }

                // Authentication errors
                if (errorMessage.includes('authentication') || errorMessage.includes('401')) {
                    return NextResponse.json(
                        {
                            error: {
                                type: 'authentication_error',
                                message: 'Invalid or expired API key'
                            }
                        },
                        { status: 401 }
                    );
                }

                // Permission errors
                if (errorMessage.includes('permission') || errorMessage.includes('403')) {
                    return NextResponse.json(
                        {
                            error: {
                                type: 'permission_error',
                                message: 'Insufficient permissions for this request'
                            }
                        },
                        { status: 403 }
                    );
                }

                // Invalid request errors
                if (errorMessage.includes('invalid_request') || errorMessage.includes('400')) {
                    return NextResponse.json(
                        {
                            error: {
                                type: 'invalid_request_error',
                                message: 'Invalid request format or parameters'
                            }
                        },
                        { status: 400 }
                    );
                }

                // Model overloaded errors
                if (errorMessage.includes('overloaded') || errorMessage.includes('503')) {
                    return NextResponse.json(
                        {
                            error: {
                                type: 'overloaded_error',
                                message: 'Model is currently overloaded. Please try again shortly.'
                            }
                        },
                        { status: 503 }
                    );
                }

                // Content filtering errors
                if (errorMessage.includes('content_filter') || errorMessage.includes('content policy')) {
                    return NextResponse.json(
                        {
                            error: {
                                type: 'content_filter_error',
                                message: 'Request blocked by content filtering policy'
                            }
                        },
                        { status: 400 }
                    );
                }

                // Token limit errors
                if (errorMessage.includes('token') && errorMessage.includes('limit')) {
                    return NextResponse.json(
                        {
                            error: {
                                type: 'token_limit_error',
                                message: 'Request exceeds maximum token limit for this model'
                            }
                        },
                        { status: 400 }
                    );
                }
            }

            throw error; // Re-throw for general error handling
        }

    } catch (error) {
        const proxyError = await errorHandler.handleError(error, {
            requestId,
            endpoint: '/v1/messages',
            method: 'POST',
            timestamp: new Date()
        });

        return NextResponse.json(
            {
                error: {
                    type: proxyError.type,
                    message: proxyError.message
                }
            },
            { status: proxyError.statusCode }
        );
    }
}

export async function OPTIONS(_request: NextRequest) {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, anthropic-version',
            'Access-Control-Max-Age': '86400'
        }
    });
}
