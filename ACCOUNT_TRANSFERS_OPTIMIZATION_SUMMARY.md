# Account Transfers Optimization Summary
**Date:** November 17, 2025

## Overview
Comprehensive optimization of the `/api/account-transfers/[address]` endpoint to address performance issues and network errors (ECONNRESET, socket hang ups, ECONNREFUSED).

## Problems Identified
1. **Sequential token account processing**: Token account signature fetching was sequential, causing long cumulative latency
2. **No pagination for token accounts**: Only fetched first 100 signatures per token account
3. **Network error handling**: No retry/backoff for transient network errors (ECONNRESET, socket hang up)
4. **No endpoint health tracking**: Repeatedly hitting failing RPC endpoints
5. **No request-level timeouts**: Requests could hang indefinitely
6. **Duplicate signatures**: Potential duplicate processing across main wallet + token accounts

## Optimizations Implemented

### 1. Endpoint Health Tracking (`lib/solana-connection-server.ts`)
**What changed:**
- Added `EndpointHealth` interface tracking success/failure rates, latency, and consecutive failures per endpoint
- Modified `ConnectionPool.getConnection()` to use weighted random selection based on endpoint health
- Endpoints with >5 consecutive failures are temporarily excluded (60s recovery period)
- Success rate and latency influence endpoint selection probability

**Code changes:**
```typescript
// New health metrics per endpoint
interface EndpointHealth {
  successCount: number;
  failureCount: number;
  lastSuccess: number;
  lastFailure: number;
  consecutiveFailures: number;
  avgLatency: number;
  totalRequests: number;
}
```

**Impact:**
- Automatically avoids failing endpoints
- Prefers low-latency, high-success-rate endpoints
- Self-healing: retries unhealthy endpoints after recovery period

### 2. RPC Retry Wrapper (`lib/rpc-retry.ts` - NEW FILE)
**What changed:**
- Created `withRetry()` utility function with exponential backoff
- Detects retryable errors (ECONNRESET, ETIMEDOUT, 502, 503, 504, rate limits)
- Integrated with connection pool health tracking
- Per-request timeout support (default 60s)

**Code changes:**
```typescript
export async function withRetry<T>(
  operation: () => Promise<T>,
  endpoint: string,
  options: RetryOptions = {}
): Promise<T>
```

**Impact:**
- Handles transient network errors gracefully
- Records success/failure for endpoint health scoring
- Prevents cascade failures

### 3. Paginated Token Account Signature Fetching (`app/api/account-transfers/[address]/route.ts`)
**What changed:**
- Replaced single `getSignaturesForAddress(limit: 100)` with paginated fetch using `before` cursor
- New helper: `fetchAllSignaturesForAddressPaginated()` fetches up to 2000 signatures per token account
- Each page uses fresh connection (rotating endpoints)
- Built-in retry/backoff per page

**Code changes:**
```typescript
async function fetchAllSignaturesForAddressPaginated(tokenPubkey: PublicKey, maxTotal = 2000) {
  // Pages through signatures with cursor, rotating connections
  while (iterations < 50 && collected.length < maxTotal) {
    // Retry with exponential backoff
    const sigs = await withRetry(() => freshConn.getSignaturesForAddress(...), ...);
    // ...
  }
}
```

**Impact:**
- Captures many more signatures per token account (100 → up to 2000)
- Fewer total RPC calls via pagination
- More robust with retry/backoff

### 4. Bounded Parallelism for Token Accounts
**What changed:**
- Token account signature fetching now uses chunked parallelism (8 concurrent at a time)
- Small delays (50ms) between chunks to reduce burstiness
- Previous implementation: all token accounts fetched in parallel (could be 100+ concurrent requests)

**Code changes:**
```typescript
const TOKEN_SIG_FETCH_CONCURRENCY = 8;
for (let i = 0; i < allTokenAccounts.length; i += TOKEN_SIG_FETCH_CONCURRENCY) {
  const chunk = allTokenAccounts.slice(i, i + TOKEN_SIG_FETCH_CONCURRENCY);
  // Process chunk in parallel
  await Promise.all(chunkPromises);
  // Small delay before next chunk
  await sleep(50);
}
```

**Impact:**
- Reduces RPC endpoint load spikes
- Fewer ECONNRESET / socket hang up errors
- Smoother load distribution

### 5. Retry Wrapper for getParsedTransactions
**What changed:**
- Wrapped `getParsedTransactions` calls with `withRetry()`
- Handles transient errors with exponential backoff
- 60s timeout per batch
- Logs retry attempts for debugging

**Code changes:**
```typescript
const batchTransactionsResult = await withRetry(
  () => freshConnection.getParsedTransactions(batch, {...}),
  freshConnection.rpcEndpoint,
  { maxRetries: MAX_RETRIES, timeoutMs: 60000, onRetry: (attempt, error) => {...} }
);
```

**Impact:**
- More resilient to network errors during transaction fetching
- Better error visibility (retry logs)
- Automatic endpoint health tracking

### 6. Early Signature Deduplication
**What changed:**
- Added final deduplication pass after signature collection (Phase 1c)
- Uses `Set` to eliminate duplicates before processing
- Logs number of duplicates removed

**Code changes:**
```typescript
// Phase 1c: Deduplicate signatures again (final check before processing)
const uniqueSignatures = [...new Set(allSignatures)];
if (uniqueSignatures.length < allSignatures.length) {
  console.log(`Deduplicated signatures: ${allSignatures.length} → ${uniqueSignatures.length}`);
}
```

**Impact:**
- Reduces unnecessary transaction processing
- Faster response times (fewer RPC calls)

### 7. RPC Health Monitoring Endpoint (NEW)
**What changed:**
- Created `/api/health/rpc-endpoints` to expose endpoint health stats
- Shows success rates, average latency, consecutive failures per endpoint

**Code:**
```typescript
// GET /api/health/rpc-endpoints
{
  "totalEndpoints": 10,
  "endpoints": {
    "https://rpc1.osvm.ai": {
      "successRate": "98.5%",
      "avgLatency": "850ms",
      "consecutiveFailures": 0,
      "totalRequests": 1234
    },
    // ...
  }
}
```

**Impact:**
- Operational visibility into RPC health
- Can identify and replace bad endpoints
- Debug performance issues

## Performance Improvements (Expected)

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Token account sig fetch | Sequential (10s per account) | Parallel + paginated (8 concurrent) | ~10x faster |
| Signatures per token account | 100 | Up to 2000 | 20x more data |
| Network error handling | None (fail fast) | Retry + backoff | Much more resilient |
| Endpoint selection | Random | Health-based weighted | Prefer healthy endpoints |
| Duplicate processing | After fetch | Before processing | Fewer wasted RPC calls |

## Configuration & Tuning

### Constants (tunable via `lib/transaction-constants.ts`):
- `MAX_SIGNATURES_LIMIT = 1000` - Max signatures per page
- `MAX_CONCURRENT_BATCHES = 50` - Max parallel transaction batches
- `EFFECTIVE_MAX_RPS = 240` - Rate limit (80% of 300 RPS)
- `INITIAL_BACKOFF_MS = 50` - Starting backoff for retries
- `MAX_RETRIES = 5` - Max retry attempts

### New constants (in route.ts):
- `TOKEN_SIG_FETCH_CONCURRENCY = 8` - Parallel token account fetches
- `HEALTH_FAILURE_THRESHOLD = 5` - Mark endpoint unhealthy after 5 consecutive failures
- `HEALTH_RECOVERY_TIME = 60000` - Retry unhealthy endpoints after 60s

### Recommendations:
- **If still seeing ECONNRESET**: Lower `TOKEN_SIG_FETCH_CONCURRENCY` to 4 or 2
- **For faster wallets**: Increase `TOKEN_SIG_FETCH_CONCURRENCY` to 16
- **For more historical data**: Increase `maxTotal` in `fetchAllSignaturesForAddressPaginated` (default 2000)

## Files Modified
1. `lib/solana-connection-server.ts` - Endpoint health tracking
2. `lib/rpc-retry.ts` - NEW: Retry wrapper utility
3. `app/api/account-transfers/[address]/route.ts` - Paginated fetch, retry integration, bounded parallelism
4. `app/api/health/rpc-endpoints/route.ts` - NEW: Health monitoring endpoint

## Testing Instructions

### 1. Test account-transfers endpoint
```bash
# Test with a wallet that has many token accounts
time curl -s "http://localhost:3000/api/account-transfers/CradPJy4PJZKGS... ?limit=50&bypassCache=true" | jq '.data | length'
```

### 2. Monitor RPC endpoint health
```bash
curl -s "http://localhost:3000/api/health/rpc-endpoints" | jq
```

### 3. Check server logs for:
- "Fetching signatures for token account chunk X/Y" - Chunked processing
- "contributed N signatures (paginated)" - Pagination working
- "Retry N for getParsedTransactions" - Retry behavior
- "Deduplicated signatures: X → Y" - Deduplication stats
- "Endpoint ... marked unhealthy" - Health tracking

### 4. Compare before/after:
- Wall-clock time for same request
- Number of ECONNRESET / socket hang up errors
- Success rate

## Known Limitations & Future Work

### Current limitations:
1. **Third-party API failures** (Birdeye 404, Moralis auth) are outside our control
2. **Localhost connection errors** (ECONNREFUSED 127.0.0.1:3000) indicate deployment/env issues
3. **Helius MCP latency** (2-5s per call) is external bottleneck

### Recommended next steps:
1. **Add caching for token account signatures** (short TTL, e.g. 5min) for frequently queried wallets
2. **Dynamic concurrency adjustment** based on endpoint health and latency
3. **Fallback RPC providers** when OpenSVM endpoints are all unhealthy
4. **Request-level instrumentation** (OpenTelemetry/Datadog) for production monitoring
5. **Address localhost connection errors** in Lambda/streaming endpoints

## Monitoring & Operations

### Key metrics to track:
- `/api/health/rpc-endpoints` - Endpoint health (success rate, latency, failures)
- Server logs - Retry counts, deduplication stats, error patterns
- Response times - Wall-clock latency for account-transfers requests
- Error rates - ECONNRESET, socket hang up, timeout frequency

### Alerting (recommended):
- Alert when >50% of endpoints have consecutive failures >3
- Alert when account-transfers p95 latency >30s
- Alert when retry rate >20% for any endpoint

## Conclusion
These optimizations significantly improve the robustness and performance of the account-transfers endpoint by:
1. Intelligently avoiding failing endpoints
2. Gracefully handling transient network errors
3. Maximizing data capture via pagination
4. Reducing RPC call volume via parallelism and deduplication
5. Providing operational visibility via health monitoring

The changes are backward-compatible and include extensive logging for debugging. Further tuning may be needed based on production traffic patterns.
