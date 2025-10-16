# OpenRouter Integration Architecture

This document explains how OpenSVM's Anthropic API proxy internally routes requests through OpenRouter while maintaining perfect Anthropic API compatibility.

## Overview

While OpenSVM presents an Anthropic-compatible API interface to users, internally it routes all requests through OpenRouter. This architecture provides several benefits:

1. **Multi-Provider Access**: OpenRouter can route to various AI providers, not just Anthropic
2. **Reliability**: Built-in failover and redundancy
3. **Cost Optimization**: OpenRouter can optimize routing based on pricing
4. **Unified Billing**: Single billing system through OpenRouter

## Architecture Flow

```
User Request (Anthropic Format)
    ↓
OpenSVM Proxy
    ↓
Transform to OpenRouter Format
    ↓
OpenRouter API
    ↓
Route to Anthropic (or other providers)
    ↓
Transform Response to Anthropic Format
    ↓
User Response (Anthropic Format)
```

## Request Transformation

### Anthropic Request → OpenRouter Request

```typescript
// Anthropic Format (from user)
{
  model: "claude-3-sonnet-20240229",
  messages: [
    { role: "user", content: "Hello!" }
  ],
  system: "You are helpful",
  max_tokens: 1024,
  temperature: 0.7,
  stop_sequences: ["END"]
}

// OpenRouter Format (internal)
{
  model: "anthropic/claude-3.5-sonnet",
  messages: [
    { role: "system", content: "You are helpful" },
    { role: "user", content: "Hello!" }
  ],
  max_tokens: 1024,
  temperature: 0.7,
  stop: ["END"],
  provider: {
    order: ["Anthropic"],
    allow_fallbacks: false
  }
}
```

## Model Mapping

| Anthropic Model Name | OpenRouter Model Name | Notes |
|---------------------|----------------------|-------|
| claude-3-sonnet-20240229 | anthropic/claude-3.5-sonnet | Latest Sonnet |
| claude-3-opus-20240229 | anthropic/claude-3-opus | Opus model |
| claude-3-haiku-20240307 | anthropic/claude-3-haiku | Fast model |
| claude-3-sonnet-4 | anthropic/claude-3.5-sonnet | New Sonnet 4 |
| claude-3-opus-4 | anthropic/claude-3-opus | New Opus 4 |

## Response Transformation

### OpenRouter Response → Anthropic Response

```typescript
// OpenRouter Response
{
  id: "chatcmpl-123",
  object: "chat.completion",
  created: 1708963200,
  model: "anthropic/claude-3.5-sonnet",
  choices: [{
    index: 0,
    message: {
      role: "assistant",
      content: "Hello! How can I help?"
    },
    finish_reason: "stop"
  }],
  usage: {
    prompt_tokens: 10,
    completion_tokens: 20,
    total_tokens: 30
  }
}

// Anthropic Response (to user)
{
  id: "chatcmpl-123",
  type: "message",
  role: "assistant",
  content: [{
    type: "text",
    text: "Hello! How can I help?"
  }],
  model: "claude-3-sonnet-20240229", // Original model name
  stop_reason: "end_turn",
  stop_sequence: null,
  usage: {
    input_tokens: 10,
    output_tokens: 20
  }
}
```

## Streaming Transformation

OpenRouter uses OpenAI-style streaming format, which we transform to Anthropic's SSE format:

### OpenRouter Stream Events:
```
data: {"id":"chat-123","object":"chat.completion.chunk","choices":[{"delta":{"content":"Hello"},"index":0}]}
data: {"id":"chat-123","object":"chat.completion.chunk","choices":[{"delta":{"content":" world"},"index":0}]}
data: {"id":"chat-123","object":"chat.completion.chunk","choices":[{"delta":{},"finish_reason":"stop","index":0}]}
data: [DONE]
```

### Transformed to Anthropic Events:
```
data: {"type":"message_start","message":{"id":"chat-123","type":"message","role":"assistant","content":[],"model":"claude-3-sonnet-20240229"}}
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" world"}}
data: {"type":"content_block_stop","index":0}
data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}
data: {"type":"message_stop"}
```

## Configuration

### Environment Variables

```bash
# OpenRouter API key (required)
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx

# Optional: Override OpenRouter base URL
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

### Headers Sent to OpenRouter

```typescript
{
  'Content-Type': 'application/json',
  'Authorization': 'Bearer ${OPENROUTER_API_KEY}',
  'HTTP-Referer': 'https://opensvm.com',
  'X-Title': 'OpenSVM Anthropic Proxy'
}
```

## Error Handling

OpenRouter errors are transformed to Anthropic-compatible errors:

| OpenRouter Error | Anthropic Error Type | HTTP Status |
|-----------------|---------------------|-------------|
| Invalid API key | authentication_error | 401 |
| Rate limit exceeded | rate_limit_error | 429 |
| Invalid request | invalid_request_error | 400 |
| Server error | api_error | 500 |

## Benefits of This Architecture

1. **Transparent to Users**: Users interact with a standard Anthropic API
2. **Provider Flexibility**: Can route to different AI providers through OpenRouter
3. **Enhanced Reliability**: OpenRouter's infrastructure provides additional reliability
4. **Cost Management**: OpenRouter can optimize routing for cost
5. **Future-Proof**: Easy to add new models or providers

## Testing

The integration is thoroughly tested in `__tests__/anthropic-proxy/core/OpenRouterIntegration.test.ts`:

- Request transformation
- Response transformation  
- Model mapping
- Streaming support
- Error handling
- Edge cases

## Security Considerations

1. **API Key Security**: OpenRouter API key is stored securely in environment variables
2. **Request Validation**: All requests are validated before forwarding
3. **Response Sanitization**: Responses are sanitized to ensure compatibility
4. **No Data Storage**: Requests/responses are not stored, only forwarded

## Limitations

1. **Token Counting**: OpenRouter may count tokens differently than Anthropic
2. **Feature Support**: Some advanced Anthropic features may not be available
3. **Latency**: Additional hop through OpenRouter adds minimal latency
4. **Model Availability**: Limited to models available on OpenRouter

## Future Enhancements

1. **Dynamic Model Mapping**: Auto-discover new models from OpenRouter
2. **Multi-Provider Support**: Route to providers beyond Anthropic
3. **Smart Routing**: Choose providers based on cost/performance
4. **Caching**: Cache common responses to reduce costs
5. **Analytics**: Track usage patterns and optimize routing 