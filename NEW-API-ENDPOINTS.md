# New API Endpoints

## Overview
Added two new convenience endpoints to simplify API usage:

1. **`/api/chart`** - Clean alias for OHLCV candlestick data
2. **`/api/trades`** - Fetch recent trades for any token

---

## /api/chart

Clean, focused endpoint for fetching candlestick/OHLCV data.

### Endpoint
```
GET /api/chart
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `mint` | string | Yes | Token mint address |
| `type` | string | No | Interval type (default: 1H) |
| `time_from` | number | No | Start timestamp (unix seconds) |
| `time_to` | number | No | End timestamp (unix seconds) |
| `poolAddress` | string | No | Specific pool address |

### Supported Intervals
`1m`, `3m`, `5m`, `15m`, `30m`, `1H`, `2H`, `4H`, `6H`, `8H`, `12H`, `1D`, `3D`, `1W`, `1M`

### Examples

#### Basic Usage
```bash
# Get default hourly candles
curl "http://localhost:3000/api/chart?mint=YOUR_MINT"

# Get 1-minute candles
curl "http://localhost:3000/api/chart?mint=YOUR_MINT&type=1m"

# Get daily candles
curl "http://localhost:3000/api/chart?mint=YOUR_MINT&type=1D"
```

#### Custom Time Range
```bash
# Get last 10 days of 1-minute candles
time_to=$(date +%s)
time_from=$((time_to - 10*24*60*60))
curl "http://localhost:3000/api/chart?mint=YOUR_MINT&type=1m&time_from=$time_from&time_to=$time_to"
```

### Response Format
```json
{
  "success": true,
  "endpoint": "ohlcv",
  "mint": "YOUR_MINT",
  "data": {
    "items": [
      {
        "o": 0.001,
        "h": 0.0012,
        "l": 0.0009,
        "c": 0.0011,
        "v": 1000000,
        "unixTime": 1234567890,
        "type": "1H"
      }
    ]
  },
  "indicators": {
    "ma7": [...],
    "ma25": [...],
    "macd": {
      "line": [...],
      "signal": [...],
      "histogram": [...]
    }
  },
  "_meta": {
    "requestedRange": {
      "from": 1234567890,
      "to": 1234567999,
      "duration": 109
    },
    "batching": {
      "enabled": true,
      "batchCount": 15,
      "batchSize": 57600
    },
    "candleCount": 14400
  }
}
```

### Features

✅ **Automatic Batch Fetching** - Handles large time ranges automatically  
✅ **Smart Batching** - Optimized to ~960 candles per batch  
✅ **Technical Indicators** - MA7, MA25, MACD included  
✅ **10x More Data** - Enhanced default ranges  
✅ **Performance Metadata** - Track batching efficiency  

---

## /api/trades

Fetch recent trades/swaps for any Solana token.

### Endpoint
```
GET /api/trades
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `mint` | string | Yes | Token mint address |
| `limit` | number | No | Number of trades (default: 50, max: 100) |
| `type` | string | No | Transaction type (default: swap) |
| `offset` | number | No | Pagination offset (default: 0) |

### Transaction Types
- `swap` - Token swaps (default)
- `add` - Liquidity additions
- `remove` - Liquidity removals

### Examples

#### Basic Usage
```bash
# Get last 50 trades
curl "http://localhost:3000/api/trades?mint=YOUR_MINT"

# Get last 100 trades
curl "http://localhost:3000/api/trades?mint=YOUR_MINT&limit=100"

# Get only swaps
curl "http://localhost:3000/api/trades?mint=YOUR_MINT&type=swap&limit=50"
```

#### Pagination
```bash
# First page (0-50)
curl "http://localhost:3000/api/trades?mint=YOUR_MINT&limit=50&offset=0"

# Second page (50-100)
curl "http://localhost:3000/api/trades?mint=YOUR_MINT&limit=50&offset=50"

# Third page (100-150)
curl "http://localhost:3000/api/trades?mint=YOUR_MINT&limit=50&offset=100"
```

### Response Format
```json
{
  "success": true,
  "mint": "YOUR_MINT",
  "trades": [
    {
      "signature": "5x7D...",
      "timestamp": 1234567890,
      "type": "swap",
      "side": "buy",
      "price": 0.001,
      "priceUSD": 0.001,
      "amount": 1000,
      "amountUSD": 1.0,
      "token": {
        "symbol": "TOKEN",
        "address": "YOUR_MINT",
        "decimals": 9
      },
      "pairToken": {
        "symbol": "USDC",
        "address": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        "decimals": 6
      },
      "dex": "Raydium",
      "poolAddress": "POOL_ADDRESS",
      "owner": "WALLET_ADDRESS",
      "slot": 123456789,
      "raw": {
        "base": {...},
        "quote": {...},
        "pricePair": 0.001
      }
    }
  ],
  "count": 50,
  "metadata": {
    "limit": 50,
    "offset": 0,
    "txType": "swap",
    "hasMore": true
  }
}
```

### Trade Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `signature` | string | Transaction signature |
| `timestamp` | number | Unix timestamp |
| `type` | string | Transaction type (swap, add, remove) |
| `side` | string | Trade side (buy, sell) |
| `price` | number | Trade price |
| `priceUSD` | number | Price in USD |
| `amount` | number | Token amount |
| `amountUSD` | number | USD value |
| `token` | object | Target token details |
| `pairToken` | object | Paired token details |
| `dex` | string | DEX name (Raydium, Orca, etc.) |
| `poolAddress` | string | Pool/AMM address |
| `owner` | string | Wallet that made the trade |
| `slot` | number | Solana slot number |
| `raw` | object | Raw Birdeye response data |

### Use Cases

**Real-Time Trading Activity**
```javascript
// Get latest 10 trades and update every 30 seconds
setInterval(async () => {
  const response = await fetch('/api/trades?mint=YOUR_MINT&limit=10');
  const { trades } = await response.json();
  updateTradesFeed(trades);
}, 30000);
```

**Trade History Analysis**
```javascript
// Fetch last 100 trades for analysis
const response = await fetch('/api/trades?mint=YOUR_MINT&limit=100');
const { trades } = await response.json();

// Calculate average trade size
const avgSize = trades.reduce((sum, t) => sum + t.amountUSD, 0) / trades.length;

// Find largest trade
const largestTrade = trades.reduce((max, t) => 
  t.amountUSD > max.amountUSD ? t : max
);
```

**DEX Activity Distribution**
```javascript
const response = await fetch('/api/trades?mint=YOUR_MINT&limit=100');
const { trades } = await response.json();

// Group by DEX
const byDEX = trades.reduce((acc, trade) => {
  acc[trade.dex] = (acc[trade.dex] || 0) + 1;
  return acc;
}, {});
```

---

## Comparison with Existing Endpoints

| Endpoint | Purpose | Benefits |
|----------|---------|----------|
| `/api/market-data?endpoint=ohlcv` | Full market data | Complete data, multiple endpoints |
| `/api/chart` | OHLCV only | Simpler, focused, cleaner URL |
| `/api/trades` | Recent trades | New capability, trade-specific |

### When to Use Each

**Use `/api/chart`** when:
- You only need candlestick/OHLCV data
- You want a clean, simple API
- You're building charts or technical analysis

**Use `/api/trades`** when:
- You need recent trading activity
- You want to display trade feeds
- You're analyzing trade patterns or volumes

**Use `/api/market-data`** when:
- You need multiple types of data (markets, orderbook, etc.)
- You want maximum flexibility
- You're building comprehensive market dashboards

---

## Migration from market-data

### Before
```javascript
const response = await fetch(
  '/api/market-data?endpoint=ohlcv&mint=YOUR_MINT&type=1H'
);
```

### After  
```javascript
const response = await fetch(
  '/api/chart?mint=YOUR_MINT&type=1H'
);
```

Both work identically, but `/api/chart` is cleaner and more semantic.

---

## Error Handling

### Missing Required Parameters
```json
{
  "error": "Missing required parameter: mint",
  "usage": "GET /api/chart?mint=YOUR_MINT&type=1H"
}
```

### API Configuration Error
```json
{
  "error": "BIRDEYE_API_KEY not configured"
}
```

### Birdeye API Error
```json
{
  "error": "Birdeye API returned 429",
  "details": "Rate limit exceeded"
}
```

---

## Rate Limits

Both endpoints use the Birdeye API which has rate limits:

- Free tier: ~10 requests/second
- Pro tier: Higher limits available

The batch fetching system respects these limits by:
- Making parallel requests efficiently
- Handling errors gracefully
- Continuing even if some batches fail

---

## Performance Notes

### /api/chart Performance

| Interval | Time Range | Batches | Est. Time |
|----------|------------|---------|-----------|
| 1m | 20 hours | 2 | ~2-3s |
| 1m | 10 days | 15 | ~5-10s |
| 1H | 70 days | 2 | ~2-3s |
| 1D | 900 days | 1 | ~1-2s |

### /api/trades Performance

- Single request, no batching needed
- Typically returns in <1 second
- Pagination for large datasets

---

## Files Created

- `app/api/chart/route.ts` - Chart endpoint implementation
- `app/api/trades/route.ts` - Trades endpoint implementation
- `NEW-API-ENDPOINTS.md` - This documentation

---

## Summary

✅ **2 New Endpoints** - `/api/chart` and `/api/trades`  
✅ **Cleaner API** - More semantic and focused  
✅ **Full Compatibility** - Works alongside existing endpoints  
✅ **Enhanced Features** - Batch fetching, technical indicators, trade details  
✅ **Well Documented** - Complete examples and use cases  

**Status: ✅ COMPLETE AND READY TO USE**
