# Birdeye OHLCV & Orderbook APIs

OpenSVM now integrates Birdeye's advanced market data APIs for OHLCV (candlestick) charting and order book depth analysis.

## OHLCV API ✅ Fully Functional

Get historical candlestick data for any Solana token.

### Endpoint
- **Tool Name**: `birdeyeOHLCV`
- **API**: `https://public-api.birdeye.so/defi/ohlcv`
- **Authentication**: Requires `BIRDEYE_API_KEY` environment variable

### Parameters
```typescript
{
  address: string;      // Token mint address (e.g., "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263")
  type?: string;        // Timeframe: "1m"|"3m"|"5m"|"15m"|"30m"|"1H"|"2H"|"4H"|"6H"|"8H"|"12H"|"1D"|"3D"|"1W"|"1M"
  time_from?: number;   // Unix timestamp in seconds (default: 24h ago)
  time_to?: number;     // Unix timestamp in seconds (default: now)
}
```

### Response Format
```typescript
{
  success: true,
  source: "birdeye-ohlcv",
  data: {
    items: [
      {
        o: number;        // Open price (USD)
        h: number;        // High price (USD)
        l: number;        // Low price (USD)
        c: number;        // Close price (USD)
        v: number;        // Volume (USD)
        unixTime: number; // Timestamp
        address: string;  // Token mint
        type: string;     // Timeframe
        currency: "usd"
      }
    ]
  },
  meta: { type, time_from, time_to }
}
```

### Usage Examples

#### Example 1: Hourly candles for BONK (last 24 hours)
```bash
curl -X POST http://localhost:3000/api/getAnswer \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Get hourly OHLCV data for BONK token DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
  }'
```

#### Example 2: 15-minute candles for OVSM
```bash
curl -X POST http://localhost:3000/api/getAnswer \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Show 15-minute candlestick data for pvv4fu1RvQBkKXozyH5A843sp1mt6gTy9rPoZrBBAGS"
  }'
```

#### Example 3: Direct API test endpoint
```bash
# Test OHLCV with custom parameters
curl "http://localhost:3000/api/birdeye-test?endpoint=ohlcv&mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263&type=1H"
```

### AI Integration
The AI planner can automatically use `birdeyeOHLCV` when users ask for:
- Chart data
- Price history
- Candlestick patterns
- Technical analysis data

Example queries:
- "Show me 1-hour candles for BONK"
- "Get daily OHLCV data for token X"
- "I need 15-minute price bars for the last 24 hours"

---

## Orderbook API ⚠️ Market Address Required

Get real-time market depth with bid/ask levels.

### Endpoint
- **Tool Name**: `birdeyeOrderbook`
- **API**: `https://public-api.birdeye.so/defi/orderbook`
- **Authentication**: Requires `BIRDEYE_API_KEY` environment variable

### Parameters
```typescript
{
  address: string;  // DEX market/pair address (NOT token mint)
  offset?: number;  // Depth offset from best bid/ask (default: 100)
}
```

### Important Notes
1. **Requires market/pair address** - NOT the token mint address
2. Get the `pairAddress` from the token overview API first:
   ```bash
   # Step 1: Get pair address
   curl "https://public-api.birdeye.so/defi/token_overview?address=<TOKEN_MINT>" \
     -H "X-API-KEY: your_key"
   
   # Step 2: Use pairAddress for orderbook
   curl "https://public-api.birdeye.so/defi/orderbook?address=<PAIR_ADDRESS>" \
     -H "X-API-KEY: your_key"
   ```
3. Only available for tokens with centralized orderbook markets
4. Most DEX tokens won't have orderbook data (they use AMM pools)

### Response Format
```typescript
{
  success: true,
  source: "birdeye-orderbook",
  data: {
    bids: [{ price: number, size: number }],  // Buy orders
    asks: [{ price: number, size: number }],  // Sell orders
    updateUnixTime: number
  },
  meta: { offset, updateUnixTime }
}
```

---

## Testing

Run the comprehensive test suite:
```bash
./test-birdeye-apis.sh
```

Or test individual endpoints:
```bash
# OHLCV - Hourly candles
curl "http://localhost:3000/api/birdeye-test?endpoint=ohlcv&mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263&type=1H"

# OHLCV - 15-minute candles
curl "http://localhost:3000/api/birdeye-test?endpoint=ohlcv&mint=pvv4fu1RvQBkKXozyH5A843sp1mt6gTy9rPoZrBBAGS&type=15m"

# OHLCV - Daily candles
curl "http://localhost:3000/api/birdeye-test?endpoint=ohlcv&mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263&type=1D"
```

---

## Environment Setup

Add your Birdeye API key to `.env`:
```bash
BIRDEYE_API_KEY=your_api_key_here
```

Current key: `b8c7ec5035c34ebe9ac9a523556f854c` ✅

---

## Supported Timeframes

| Code | Description | Data Points (24h) |
|------|-------------|-------------------|
| 1m   | 1 minute    | 1,440             |
| 3m   | 3 minutes   | 480               |
| 5m   | 5 minutes   | 288               |
| 15m  | 15 minutes  | 96                |
| 30m  | 30 minutes  | 48                |
| 1H   | 1 hour      | 24                |
| 2H   | 2 hours     | 12                |
| 4H   | 4 hours     | 6                 |
| 6H   | 6 hours     | 4                 |
| 8H   | 8 hours     | 3                 |
| 12H  | 12 hours    | 2                 |
| 1D   | 1 day       | 1                 |
| 3D   | 3 days      | 8 (in 24 days)    |
| 1W   | 1 week      | 52 (in 1 year)    |
| 1M   | 1 month     | 12 (in 1 year)    |

---

## Implementation Files

- **Main Tool Logic**: `/app/api/getAnswer/tools/aiPlanExecution.ts` (lines 1398-1487)
- **Test Endpoint**: `/app/api/birdeye-test/route.ts`
- **Test Script**: `/test-birdeye-apis.sh`
- **Documentation**: `/docs/birdeye-apis.md` (this file)

---

## Example Output

### BONK Hourly Candles (Last 24h)
```json
{
  "success": true,
  "candleCount": 24,
  "latest": {
    "o": 0.000013177700029625507,
    "h": 0.000013224979147138883,
    "l": 0.00001308119125425359,
    "c": 0.000013191243808855327,
    "v": 3414714968.7841625,
    "unixTime": 1762603200,
    "address": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    "type": "1H",
    "currency": "usd"
  }
}
```

### OVSM 15-Minute Candles
```json
{
  "success": true,
  "candleCount": 96,
  "priceRange": {
    "first": 0.0009437442550678344,
    "last": 0.0008465176089802684
  }
}
```

---

## Summary

✅ **OHLCV API**: Fully functional with 15 timeframes, perfect for charting and technical analysis  
⚠️ **Orderbook API**: Functional but requires market/pair address (not token mint), limited to centralized orderbook markets

Both APIs are integrated into the AI planner and available via:
1. Natural language queries through `/api/getAnswer`
2. Direct tool calls via `birdeyeOHLCV` and `birdeyeOrderbook`
3. Test endpoint at `/api/birdeye-test`
