# Token Page Error Fixes

## Issues Fixed

### 1. Global Timeout Error in Token API Route
**Problem:** The token API route had a 3-second global timeout that was too aggressive for the operations being performed.

**Error:**
```
Error fetching token details: Error: Global request timeout
    at Timeout.eval [as _onTimeout] (app/api/token/[address]/route.ts:54:29)
```

**Root Cause:**
- The global timeout was set to 3 seconds
- Birdeye API call could take up to 2 seconds
- getProgramAccounts call could take up to 5 seconds
- Total potential time: 7+ seconds, exceeding the 3-second limit

**Fix:**
- Increased global timeout from 3 seconds to 10 seconds
- This accommodates:
  - Birdeye API: 2s timeout
  - getProgramAccounts: 5s timeout
  - Overhead and other operations: 3s buffer

**File Changed:** `app/api/token/[address]/route.ts`
```typescript
// Before:
setTimeout(() => reject(new Error('Global request timeout')), 3000);

// After:
setTimeout(() => reject(new Error('Global request timeout')), 10000);
```

### 2. Qdrant Bad Request Error in Token Metadata Storage
**Problem:** Token metadata storage was failing with a 400 Bad Request error from Qdrant.

**Error:**
```
Error storing token metadata: Error: Bad Request
    at async storeTokenMetadata (lib/qdrant.ts:1484:5)
{
  headers: Headers { ... },
  url: 'https://...qdrant.io:6333/collections/token_metadata/points?wait=true',
  status: 400,
  statusText: 'Bad Request',
  data: [Object]
}
```

**Root Cause:**
- The error data object wasn't being logged, making it difficult to diagnose
- Potential issues with payload structure or field types not matching Qdrant's expectations

**Fix:**
- Added detailed error logging to capture the full Qdrant error response
- Wrapped the upsert operation in a try-catch to log:
  - Mint address and symbol being stored
  - Error message and status
  - Full error data (JSON stringified)
  - Payload keys and vector length

**File Changed:** `lib/qdrant.ts`
```typescript
try {
  await qdrantClient.upsert(COLLECTIONS.TOKEN_METADATA, upsertData);
} catch (upsertError: any) {
  // Log detailed error information from Qdrant
  console.error('Qdrant upsert failed for token metadata:', {
    mintAddress: metadata.mintAddress,
    symbol: metadata.symbol,
    errorMessage: upsertError?.message,
    errorData: JSON.stringify(upsertError?.data, null, 2),
    errorStatus: upsertError?.status,
    payloadKeys: Object.keys(cleanPayload),
    vectorLength: vector.length
  });
  throw upsertError;
}
```

## Testing Recommendations

1. **Test Token Page Load:**
   ```bash
   curl -s "http://localhost:3000/api/token/Cpzvdx6pppc9TNArsGsqgShCsKC9NCCjA2gtzHvUpump"
   ```

2. **Monitor Logs:**
   - Watch for the detailed Qdrant error logging if the Bad Request persists
   - The new logging will show exactly what field or data type is causing the issue

3. **Verify Timeout Fix:**
   - Load token pages with high holder counts
   - Ensure the 10-second timeout is sufficient for getProgramAccounts operations

## Next Steps

If the Qdrant Bad Request error persists:
1. Check the detailed error logs to identify the problematic field
2. Verify the Qdrant collection schema matches the payload structure
3. Ensure all field types (string, number, boolean) match Qdrant's expectations
4. Consider if the vector dimension (384) matches the collection configuration

## Files Modified

1. `app/api/token/[address]/route.ts` - Increased global timeout to 10 seconds
2. `lib/qdrant.ts` - Added detailed error logging for Qdrant upsert failures
