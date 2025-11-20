# AI Service Client

A robust client for calling AI services with automatic retry logic, circuit breaker pattern, request caching, and comprehensive error handling.

## Features

- **Automatic Retries**: Exponentially backs off on failures (1s → 2s → 4s)
- **Circuit Breaker**: Prevents cascading failures during service outages
- **Request Caching**: Reduces load with LRU cache (5-minute TTL)
- **Timeout Handling**: Configurable timeouts per request
- **User-Friendly Errors**: Clear error messages for different failure scenarios
- **TypeScript Support**: Full type safety and IntelliSense

## Installation

The client is already available in the project. Simply import it:

```typescript
import { aiServiceClient } from '@/lib/ai-service-client';
```

## Basic Usage

### Simple Request

```typescript
import { aiServiceClient } from '@/lib/ai-service-client';

const result = await aiServiceClient.callAIService(
  '/api/getAnswer',
  { question: 'What is Solana?' }
);

if (result.success) {
  console.log('Response:', result.data);
  console.log('Response time:', result.responseTime, 'ms');
} else {
  console.error('Error:', result.error);
  console.error('Was timeout:', result.isTimeout);
}
```

### With Custom Timeout

```typescript
const result = await aiServiceClient.callAIService(
  '/api/getAnswer',
  { question: 'Complex query...' },
  { timeout: 60000 } // 60 second timeout
);
```

### Skip Cache

```typescript
const result = await aiServiceClient.callAIService(
  '/api/getAnswer',
  { question: 'Latest data...' },
  { skipCache: true } // Force fresh request
);
```

## Advanced Usage

### Custom Client Configuration

Create a client with custom settings:

```typescript
import { createAIServiceClient } from '@/lib/ai-service-client';

const customClient = createAIServiceClient({
  baseTimeout: 45000,              // 45 second default timeout
  maxRetries: 5,                   // 5 retry attempts
  retryDelay: 2000,                // 2 second initial delay
  circuitBreakerThreshold: 10,     // Open after 10 failures
  circuitBreakerTimeout: 120000,   // 2 minute cooldown
  enableCircuitBreaker: true       // Enable circuit breaker
});

const result = await customClient.callAIService(endpoint, payload);
```

### Circuit Breaker Monitoring

```typescript
import { aiServiceClient } from '@/lib/ai-service-client';

// Get current circuit breaker status
const status = aiServiceClient.getCircuitBreakerStatus();

console.log('State:', status?.state);           // CLOSED, OPEN, or HALF_OPEN
console.log('Failure count:', status?.failureCount);
console.log('Success count:', status?.successCount);
console.log('Last failure:', new Date(status?.lastFailureTime));
```

### Manual Circuit Breaker Reset

```typescript
// Force reset the circuit breaker (for testing or manual recovery)
aiServiceClient.resetCircuitBreaker();
```

## Response Format

### Success Response

```typescript
{
  success: true,
  data: any,                    // The response data
  isCached: boolean,            // Was this from cache?
  retryCount: number,           // How many retries were needed
  responseTime: number          // Total time in milliseconds
}
```

### Error Response

```typescript
{
  success: false,
  error: string,                // User-friendly error message
  isTimeout: boolean,           // Was this a timeout error?
  retryCount: number,           // How many retries were attempted
  responseTime: number          // Total time in milliseconds
}
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baseTimeout` | number | 30000 | Default timeout in milliseconds |
| `maxRetries` | number | 3 | Maximum retry attempts |
| `retryDelay` | number | 1000 | Initial retry delay in milliseconds |
| `circuitBreakerThreshold` | number | 5 | Failures before opening circuit |
| `circuitBreakerTimeout` | number | 60000 | Time before retrying after circuit opens |
| `enableCircuitBreaker` | boolean | true | Enable/disable circuit breaker |

## Circuit Breaker States

### CLOSED (Normal Operation)
- All requests are allowed
- Service is functioning normally
- Failures are counted but don't block requests

### OPEN (Service Down)
- All requests are blocked immediately
- Returns error without hitting the service
- Prevents cascading failures
- Automatically transitions to HALF_OPEN after timeout

### HALF_OPEN (Testing Recovery)
- Allows limited requests to test if service recovered
- After 2 successful requests, transitions to CLOSED
- After any failure, transitions back to OPEN

## Error Handling

The client provides user-friendly error messages for common scenarios:

| Scenario | Error Message |
|----------|---------------|
| Timeout | "Request timed out. The AI service is taking too long to respond. Please try again." |
| 504 Gateway Timeout | "The AI service is experiencing high load. Please try again in a moment." |
| 503 Service Unavailable | "The AI service is temporarily unavailable. Please try again later." |
| 429 Rate Limit | "Too many requests. Please wait a moment before trying again." |
| Network Error | "Network error. Please check your connection and try again." |
| Circuit Breaker Open | "AI service is temporarily unavailable. Please try again in a moment." |

## Caching Strategy

### Cache Key Generation
Cache keys are generated from the endpoint and payload:
```
cacheKey = endpoint + ":" + JSON.stringify(payload)
```

### Cache Behavior
- **TTL**: 5 minutes
- **Size**: 100 entries (LRU eviction)
- **Invalidation**: Automatic on expiry
- **Bypass**: Use `skipCache: true` option

### Cache Benefits
- Reduces backend load
- Faster response times for repeated queries
- Continues working during temporary service outages

## Retry Strategy

### Exponential Backoff
The client uses exponential backoff for retries:

| Attempt | Delay |
|---------|-------|
| 1st | 0ms (immediate) |
| 2nd | 1000ms (1 second) |
| 3rd | 2000ms (2 seconds) |
| 4th | 4000ms (4 seconds) |

### When Retries Stop
- Maximum retries reached
- Circuit breaker opens
- Non-retriable error (e.g., 400 Bad Request)

## Best Practices

### 1. Use Appropriate Timeouts
```typescript
// Quick queries
const result = await aiServiceClient.callAIService(endpoint, payload, {
  timeout: 15000 // 15 seconds
});

// Complex queries
const result = await aiServiceClient.callAIService(endpoint, payload, {
  timeout: 60000 // 60 seconds
});
```

### 2. Handle Both Success and Error Cases
```typescript
const result = await aiServiceClient.callAIService(endpoint, payload);

if (result.success) {
  // Handle success
  updateUI(result.data);
} else {
  // Handle error with user feedback
  showError(result.error);
  
  // Log for debugging
  console.error('AI service error:', {
    error: result.error,
    isTimeout: result.isTimeout,
    retryCount: result.retryCount
  });
}
```

### 3. Monitor Circuit Breaker Status
```typescript
// Check before critical operations
const status = aiServiceClient.getCircuitBreakerStatus();

if (status?.state === 'OPEN') {
  // Service is down, use fallback or show maintenance message
  showMaintenanceMessage();
} else {
  // Service is available, proceed
  await callAIService();
}
```

### 4. Use Caching Wisely
```typescript
// For frequently repeated queries - use cache (default)
const result1 = await aiServiceClient.callAIService(endpoint, payload);

// For time-sensitive data - skip cache
const result2 = await aiServiceClient.callAIService(endpoint, payload, {
  skipCache: true
});
```

## Examples

### Complete Example with Error Handling

```typescript
import { aiServiceClient } from '@/lib/ai-service-client';

async function askAI(question: string) {
  try {
    const result = await aiServiceClient.callAIService(
      '/api/getAnswer',
      { question },
      { timeout: 30000 }
    );

    if (result.success) {
      // Log performance metrics
      console.log(`Response time: ${result.responseTime}ms`);
      console.log(`From cache: ${result.isCached}`);
      console.log(`Retries needed: ${result.retryCount}`);

      return {
        answer: result.data,
        cached: result.isCached
      };
    } else {
      // Handle error gracefully
      console.error(`AI service error: ${result.error}`);
      
      if (result.isTimeout) {
        throw new Error('Request timed out, please try again');
      } else {
        throw new Error('AI service unavailable');
      }
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    throw error;
  }
}
```

### React Component Example

```typescript
import { useState, useEffect } from 'react';
import { aiServiceClient } from '@/lib/ai-service-client';

function AIChat() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await aiServiceClient.callAIService(
      '/api/getAnswer',
      { question },
      { timeout: 30000 }
    );

    setLoading(false);

    if (result.success) {
      setAnswer(result.data);
    } else {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask a question..."
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Loading...' : 'Ask'}
      </button>
      
      {error && <div className="error">{error}</div>}
      {answer && <div className="answer">{answer}</div>}
    </form>
  );
}
```

## Troubleshooting

### Circuit Breaker Won't Close
**Problem**: Circuit breaker stays open even after service recovers.

**Solution**:
```typescript
// Manually reset the circuit breaker
aiServiceClient.resetCircuitBreaker();
```

### High Cache Miss Rate
**Problem**: Cache isn't being used effectively.

**Possible Causes**:
- Payload formatting inconsistencies (e.g., extra whitespace)
- TTL too short for your use case
- Cache size too small

**Solution**:
```typescript
// Create client with larger cache
const client = createAIServiceClient({
  // ... other options
});

// Normalize payloads before sending
const normalizedPayload = {
  question: question.trim().toLowerCase()
};
```

### Requests Still Timing Out
**Problem**: Requests timeout even with retries.

**Solution**:
1. Increase timeout value
2. Simplify queries
3. Check backend health
4. Consider load balancing

## Testing

### Unit Tests
```typescript
import { createAIServiceClient } from '@/lib/ai-service-client';

describe('AI Service Client', () => {
  it('should retry on failure', async () => {
    const client = createAIServiceClient({
      maxRetries: 3,
      retryDelay: 100
    });

    // Mock fetch to fail twice then succeed
    // ... test implementation
  });

  it('should cache responses', async () => {
    const client = createAIServiceClient();

    // First call
    const result1 = await client.callAIService('/test', {});
    expect(result1.isCached).toBe(false);

    // Second identical call
    const result2 = await client.callAIService('/test', {});
    expect(result2.isCached).toBe(true);
  });
});
```

## Related Documentation

- [AI Service Timeout Fix](../AI-SERVICE-TIMEOUT-FIX.md) - Complete implementation details
- [Quick Start Guide](../AI-SERVICE-FIX-QUICKSTART.md) - Getting started
- [Health Monitoring](../app/api/health/ai-service/README.md) - Health check API

## License

Part of the OpenSVM project.
