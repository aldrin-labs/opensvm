# Token Routes Caching Analysis Report

## Executive Summary

Analysis of caching implementation across token-related API routes, with latency measurements and recommendations for optimization.

## Test Results

### 1. Token Details Route (`/api/token/[address]`)

**Current Status:** ✓ Caching Implemented (Partial)

**Findings:**
- Cache duration: 5 minutes
- First request: 580ms
- Second request: 391ms (32.6% faster)
- **Issue:** Response doesn't include `cached` flag
- **Issue:** No background refresh mechanism (cache goes stale after 5 minutes)

**Cache Implementation:**
```typescript
const tokenHolderCache = new Map<string, { 
  holders: number; 
  volume24h: number; 
  // ... other fields
  timestamp: number 
}>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
```

**Problems:**
1. No `cached` flag in response (makes it hard to verify caching)
2. No background refresh (users wait for fresh data after 5 minutes)
3. No `cacheAge` indicator
4. Cache only stores holder/volume data, not full response

### 2. Token Holders Route (`/api/token/[address]/holders`)

**Current Status:** ✓ Caching Implemented (Complete)

**Features:**
- Cache duration: 5 minutes
- Background refresh threshold: 1 minute
- Returns `cached` flag in response
- Returns `cacheAge` in seconds
- Background updates prevent stale data
- Duplicate update prevention via `ongoingUpdates` Set

**Implementation:**
```typescript
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const CACHE_REFRESH_THRESHOLD = 60 * 1000; // 1 minute

// Returns cached data immediately if < 5 min old
// Triggers background refresh if > 1 min old
```

### 3. Token Transactions Route

**Status:** ⚠️ Not Tested (Route may not exist or needs verification)

## Recommendations

### Priority 1: Fix Token Details Route Caching

The token details route needs the same background refresh mechanism as the holders route:

1. **Add background refresh function**
   - Similar to `updateHolderCacheInBackground()`
   - Refresh threshold: 1 minute
   - Cache duration: 5 minutes

2. **Add response flags**
   - Include `cached: boolean` in response
   - Include `cacheAge: number` (seconds)

3. **Improve cache structure**
   - Cache the full response, not just holder/volume data
   - This avoids re-fetching metadata on every request

### Priority 2: Standardize Caching Across All Routes

**Recommended Pattern:**
```typescript
// Constants
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const CACHE_REFRESH_THRESHOLD = 60 * 1000; // 1 minute
const ongoingUpdates = new Set<string>();

// Cache check logic
if (cached) {
  const cacheAge = now - cached.timestamp;
  
  if (cacheAge < CACHE_DURATION) {
    // Trigger background refresh if needed
    if (cacheAge > CACHE_REFRESH_THRESHOLD) {
      updateCacheInBackground(key, params).catch(console.error);
    }
    
    // Return cached data immediately
    return NextResponse.json({
      ...cached.data,
      cached: true,
      cacheAge: Math.round(cacheAge / 1000)
    });
  }
}
```

### Priority 3: Add Cache Monitoring

Add logging to track cache effectiveness:
- Cache hit rate
- Average cache age when served
- Background refresh frequency
- Cache size/memory usage

### Priority 4: Consider Redis for Production

For production deployment with multiple instances:
- Use Redis for shared cache
- Implement cache warming strategies
- Add cache invalidation on token updates

## Performance Targets

Based on test results:

| Route | Current (Uncached) | Current (Cached) | Target (Cached) |
|-------|-------------------|------------------|-----------------|
| Token Details | 580ms | 391ms | <100ms |
| Token Holders | ~5000ms | <100ms | <100ms |
| Token Transactions | TBD | TBD | <100ms |

## Implementation Priority

1. **Immediate (Today)**
   - Add `cached` and `cacheAge` flags to token details response
   - Verify all routes return consistent cache indicators

2. **Short-term (This Week)**
   - Implement background refresh for token details route
   - Add cache monitoring/logging
   - Document caching behavior in API docs

3. **Medium-term (This Month)**
   - Evaluate Redis implementation for production
   - Add cache warming for popular tokens
   - Implement cache invalidation strategies

## Code Example: Updated Token Details Route

```typescript
// Add these constants
const CACHE_REFRESH_THRESHOLD = 60 * 1000; // 1 minute
const ongoingUpdates = new Set<string>();

// Add background update function
async function updateTokenCacheInBackground(mintAddress: string, mintPubkey: PublicKey) {
  if (ongoingUpdates.has(mintAddress)) return;
  
  ongoingUpdates.add(mintAddress);
  try {
    // Fetch fresh data
    const freshData = await fetchTokenData(mintAddress, mintPubkey);
    
    // Update cache
    tokenHolderCache.set(mintAddress, {
      ...freshData,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Background update failed:', error);
  } finally {
    ongoingUpdates.delete(mintAddress);
  }
}

// Update cache check logic
if (cached) {
  const cacheAge = now - cached.timestamp;
  
  if (cacheAge < CACHE_DURATION) {
    if (cacheAge > CACHE_REFRESH_THRESHOLD) {
      updateTokenCacheInBackground(mintAddress, mintPubkey).catch(console.error);
    }
    
    return NextResponse.json({
      ...tokenData,
      cached: true,
      cacheAge: Math.round(cacheAge / 1000)
    });
  }
}
```

## Conclusion

The holders route has excellent caching with background refresh. The token details route needs similar implementation to achieve optimal performance. With these changes, all routes should serve cached data in <100ms while keeping data fresh through background updates.
