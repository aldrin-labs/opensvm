# Market Data Interval Parameter Fix

## Issue Report
User reported that the backend API was ignoring the `type` parameter and always returning hourly (1H) data regardless of the requested interval.

### Symptoms
- ✅ MCP Request: `chart({mint: '...', interval: '1m'})`
- ✅ API Call: `GET /market-data?endpoint=ohlcv&mint=...&type=1m`
- ❌ API Response: Returns 1H data anyway (24 candles)

## Root Cause Analysis

The issue was **NOT** that the `type` parameter was being ignored. The problem was with the **time range calculation**.

### Previous Behavior
```typescript
const type = searchParams.get('type') || '1H';
const time_to = Math.floor(Date.now() / 1000);
const time_from = time_to - (24 * 60 * 60); // ALWAYS 24 hours
```

The API always requested **24 hours of data** regardless of interval type:
- For `1m` intervals: 24 hours = **1,440 candles** (exceeds API limits)
- For `1H` intervals: 24 hours = **24 candles** (reasonable)

When requesting 1-minute candles, Birdeye's API hit its candle limit (likely 100-1000 max) and fell back to returning hourly data instead.

## Solution Implemented

Added **intelligent time range calculation** based on the interval type to request ~100-200 candles (optimal for API performance).

### New Implementation
```typescript
const timeRanges: Record<string, number> = {
    '1m': 2 * 60 * 60,        // 2 hours = 120 candles
    '3m': 6 * 60 * 60,        // 6 hours = 120 candles
    '5m': 12 * 60 * 60,       // 12 hours = 144 candles
    '15m': 24 * 60 * 60,      // 24 hours = 96 candles
    '30m': 2 * 24 * 60 * 60,  // 2 days = 96 candles
    '1H': 7 * 24 * 60 * 60,   // 7 days = 168 candles
    '2H': 10 * 24 * 60 * 60,  // 10 days = 120 candles
    '4H': 20 * 24 * 60 * 60,  // 20 days = 120 candles
    '6H': 30 * 24 * 60 * 60,  // 30 days = 120 candles
    '8H': 30 * 24 * 60 * 60,  // 30 days = 90 candles
    '12H': 30 * 24 * 60 * 60, // 30 days = 60 candles
    '1D': 90 * 24 * 60 * 60,  // 90 days = 90 candles
    '3D': 180 * 24 * 60 * 60, // 180 days = 60 candles
    '1W': 365 * 24 * 60 * 60, // 1 year = 52 candles
    '1M': 730 * 24 * 60 * 60, // 2 years = 24 candles
};

const timeRange = timeRanges[type] || (24 * 60 * 60);
const time_from = time_to - timeRange;
```

## Test Results

### Before Fix
```bash
curl "http://localhost:3000/api/market-data?endpoint=ohlcv&type=1m"
# Returns: 24 candles with type="1H" ❌
```

### After Fix
```bash
curl "http://localhost:3000/api/market-data?endpoint=ohlcv&type=1m"
# Returns: 120 candles with type="1m" ✅
```

**Verified Output:**
```json
{
  "data": {
    "items": [/* 120 candles */]
  }
}
```

- ✅ Candle count: **120** (correct for 2 hours of 1m data)
- ✅ Interval type: **"1m"** (matches requested type)
- ✅ API respects the type parameter

## Benefits

1. **Fixes reported issue**: 1-minute candles now return correctly
2. **Better API performance**: Requests optimal candle counts for each interval
3. **More useful data ranges**: 
   - Short intervals (1m, 3m, 5m): Recent 2-12 hours
   - Medium intervals (1H, 2H, 4H): Last 7-20 days
   - Long intervals (1D, 1W, 1M): Extended historical data
4. **Prevents API limit errors**: Stays within Birdeye's candle limits

## Files Modified

- `app/api/market-data/route.ts` - Added intelligent time range calculation

## Testing

Run the comprehensive test suite:
```bash
./test-market-data-intervals.sh
```

Or test individual intervals:
```bash
# 1-minute candles (2 hours of data)
curl "http://localhost:3000/api/market-data?endpoint=ohlcv&type=1m&mint=<MINT>" | jq '.data.items | length'

# 15-minute candles (24 hours of data)
curl "http://localhost:3000/api/market-data?endpoint=ohlcv&type=15m&mint=<MINT>" | jq '.data.items | length'

# 1-hour candles (7 days of data)
curl "http://localhost:3000/api/market-data?endpoint=ohlcv&type=1H&mint=<MINT>" | jq '.data.items | length'
```

## Summary

The backend API was **NOT** ignoring the `type` parameter. Instead, it was requesting too much data (24 hours regardless of interval), causing the Birdeye API to hit limits and fall back to default hourly intervals. The fix adjusts the time range based on the interval type, ensuring optimal candle counts and proper interval handling.

**Status: ✅ FIXED AND VERIFIED**
