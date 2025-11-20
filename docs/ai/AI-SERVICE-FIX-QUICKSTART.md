# AI Service Backend Timeout Fix - Quick Reference

## Problem
HTTP 504 Gateway Timeout errors from `https://osvm.ai/api/getAnswer`

## Solution Overview
Implemented a comprehensive error handling system with:
- ✅ Retry logic with exponential backoff
- ✅ Circuit breaker pattern
- ✅ Request caching
- ✅ Health monitoring
- ✅ User-friendly error messages

## Files Created

### Core Implementation
1. **`/lib/ai-service-client.ts`** - Main client with retry logic and circuit breaker
2. **`/app/api/health/ai-service/route.ts`** - Health check endpoint
3. **`/components/ai/AIServiceHealthDashboard.tsx`** - Visual health dashboard
4. **`/app/health/ai-service/page.tsx`** - Health monitoring page

### Documentation
5. **`/AI-SERVICE-TIMEOUT-FIX.md`** - Complete implementation documentation
6. **`/test-ai-service-fix.sh`** - Test script

### Updated Files
- `/components/search/index.tsx` - Integrated AI service client
- `/lib/ai/capabilities/generative.ts` - Integrated AI service client
- `/app/api/getAnswer/route.ts` - Added health check fast path

## Quick Start

### 1. Test the Implementation
```bash
# Run the test suite
./test-ai-service-fix.sh

# Or test manually
curl http://localhost:3000/api/health/ai-service | jq
```

### 2. View the Health Dashboard
Open in browser: `http://localhost:3000/health/ai-service`

### 3. Use the AI Service Client
```typescript
import { aiServiceClient } from '@/lib/ai-service-client';

const result = await aiServiceClient.callAIService(
  '/api/getAnswer',
  { question: 'What is Solana?' },
  { timeout: 30000 }
);

if (result.success) {
  console.log('Response:', result.data);
} else {
  console.error('Error:', result.error);
}
```

## Key Features

### Automatic Retry
- Retries failed requests up to 3 times
- Exponential backoff: 1s → 2s → 4s
- Configurable retry count and delays

### Circuit Breaker
- Opens after 5 consecutive failures
- Blocks requests for 60 seconds when open
- Automatically tests recovery in half-open state

### Request Caching
- 5-minute TTL for responses
- LRU eviction policy
- 100 entry capacity

### Health Monitoring
- Real-time service status
- Performance metrics (uptime, error rate, response time)
- Dependency checks (OpenRouter API, Solana RPC)

## Configuration

### Default Settings
```typescript
{
  baseTimeout: 30000,              // 30 seconds
  maxRetries: 3,                   // 3 retry attempts
  retryDelay: 1000,                // 1 second initial delay
  circuitBreakerThreshold: 5,      // Open after 5 failures
  circuitBreakerTimeout: 60000,    // 60 second cooldown
  enableCircuitBreaker: true       // Enabled by default
}
```

### Custom Configuration
```typescript
import { createAIServiceClient } from '@/lib/ai-service-client';

const customClient = createAIServiceClient({
  baseTimeout: 45000,
  maxRetries: 5,
  retryDelay: 2000,
  circuitBreakerThreshold: 10,
  circuitBreakerTimeout: 120000
});
```

## Monitoring

### Check Health
```bash
curl http://localhost:3000/api/health/ai-service
```

### Circuit Breaker Status
```typescript
import { aiServiceClient } from '@/lib/ai-service-client';

const status = aiServiceClient.getCircuitBreakerStatus();
console.log('State:', status?.state);
console.log('Failures:', status?.failureCount);
```

### Reset Circuit Breaker
```typescript
aiServiceClient.resetCircuitBreaker();
```

## Troubleshooting

### Circuit Breaker Stuck Open
```typescript
// Manually reset
import { aiServiceClient } from '@/lib/ai-service-client';
aiServiceClient.resetCircuitBreaker();
```

### High Error Rates
1. Check health: `GET /api/health/ai-service`
2. Verify API keys are configured
3. Check backend logs
4. Increase timeout values if needed

### Slow Responses
1. Check cache hit ratio (should be > 30%)
2. Consider increasing cache TTL
3. Verify network connectivity
4. Monitor circuit breaker state

## API Endpoints

### Health Check
- **GET** `/api/health/ai-service` - Get service health status
- **POST** `/api/health/ai-service` - Reset metrics (admin)

### AI Service
- **POST** `/api/getAnswer` - Ask AI questions (with retry/circuit breaker)

### Health Dashboard
- **Page** `/health/ai-service` - Visual health monitoring

## Testing

### Run Full Test Suite
```bash
./test-ai-service-fix.sh
```

### Manual Tests
```bash
# Test health check
curl http://localhost:3000/api/health/ai-service | jq

# Test AI query
curl -X POST http://localhost:3000/api/getAnswer \
  -H "Content-Type: application/json" \
  -d '{"question":"What is Solana?"}'

# Test fast health check
curl -X POST http://localhost:3000/api/getAnswer \
  -H "Content-Type: application/json" \
  -d '{"question":"Health","_healthCheck":true}'

# Test caching (run twice)
curl -X POST http://localhost:3000/api/getAnswer \
  -H "Content-Type: application/json" \
  -d '{"question":"What is SOL?"}'
```

## Benefits

### For Users
- ✅ More reliable (automatic retries)
- ✅ Faster (cached responses)
- ✅ Better error messages
- ✅ Graceful degradation

### For Operators
- ✅ Real-time health monitoring
- ✅ Automatic failure recovery
- ✅ Reduced backend load
- ✅ Performance metrics

## Next Steps

1. **Monitor**: Watch the health dashboard for issues
2. **Tune**: Adjust timeout/retry settings based on production behavior
3. **Alert**: Set up alerts when error rate exceeds threshold
4. **Scale**: Consider load balancing if needed

## Support

For more details, see:
- **Full Documentation**: `/AI-SERVICE-TIMEOUT-FIX.md`
- **Test Script**: `/test-ai-service-fix.sh`
- **Health Dashboard**: `http://localhost:3000/health/ai-service`
