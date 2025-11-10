# Market Data API - User Guide

## Quick Start

The OpenSVM Market Data API provides real-time DEX aggregation, token prices, pool discovery, and technical analysis for Solana tokens.

### Base URL
```
http://localhost:3000/api/market-data
```

## Table of Contents
- [Getting Token Price & Charts](#getting-token-price--charts)
- [Finding Liquidity Pools](#finding-liquidity-pools)
- [Technical Analysis](#technical-analysis)
- [Filtering Pools](#filtering-pools)
- [Common Use Cases](#common-use-cases)
- [Error Handling](#error-handling)

---

## Getting Token Price & Charts

### Get Current Price with Candlestick Data

```bash
curl "http://localhost:3000/api/market-data?endpoint=ohlcv&mint=BONK_MINT&type=1H"
```

**What you get:**
- ✅ Current token price
- ✅ Candlestick/OHLCV data
- ✅ Technical indicators (MA7, MA25, MACD)
- ✅ Liquidity and 24h volume
- ✅ Main trading pair

**Timeframes available:**
- `1m` - 1 minute candles
- `5m` - 5 minute candles
- `15m` - 15 minute candles
- `1H` - 1 hour candles (recommended for most use cases)
- `4H` - 4 hour candles
- `1D` - 1 day candles

**Example response:**
```json
{
  "success": true,
  "tokenInfo": {
    "symbol": "Bonk",
    "price": 0.000012843,
    "liquidity": 7288519,
    "volume24h": 3786770
  },
  "mainPair": {
    "pair": "Bonk/USDC",
    "dex": "Phoenix"
  },
  "data": {
    "items": [
      {
        "o": 0.00001234,  // open
        "h": 0.00001250,  // high
        "l": 0.00001220,  // low
        "c": 0.00001245,  // close
        "v": 123456.78    // volume
      }
    ]
  }
}
```

---

## Finding Liquidity Pools

### Get Top Pools by Liquidity

```bash
curl "http://localhost:3000/api/market-data?endpoint=markets&mint=BONK_MINT"
```

**What you get:**
- ✅ Top 3 pools sorted by liquidity
- ✅ DEX name (Phoenix, Raydium, Orca, etc.)
- ✅ Trading pair (e.g., Bonk/USDC)
- ✅ Pool address
- ✅ Price, liquidity, volume, transaction count
- ✅ Base and quote token info

**Example response:**
```json
{
  "success": true,
  "pools": [
    {
      "dex": "Phoenix",
      "pair": "Bonk-USDC",
      "poolAddress": "GBMoNx84...",
      "price": 0.000012812,
      "liquidity": 1265975.07,
      "volume24h": 59475.53,
      "txCount24h": 710,
      "baseToken": "Bonk",
      "quoteToken": "USDC"
    }
  ],
  "count": 3
}
```

---

## Technical Analysis

Technical indicators are automatically calculated and included in OHLCV responses.

### Available Indicators

**Moving Averages:**
- **MA7** - 7-period Simple Moving Average
- **MA25** - 25-period Simple Moving Average

**MACD (Moving Average Convergence Divergence):**
- **Line** - MACD line (EMA12 - EMA26)
- **Signal** - 9-period EMA of MACD line
- **Histogram** - MACD line minus signal line

### Example: Getting Technical Indicators

```bash
curl "http://localhost:3000/api/market-data?endpoint=ohlcv&mint=BONK_MINT&type=15m"
```

**Response includes:**
```json
{
  "indicators": {
    "ma7": [null, null, null, null, null, null, 0.00001234, 0.00001235, ...],
    "ma25": [null, ..., 0.00001245, ...],
    "macd": {
      "line": [null, ..., 0.000000123, ...],
      "signal": [null, ..., 0.000000115, ...],
      "histogram": [null, ..., 0.000000008, ...]
    }
  }
}
```

**Note:** `null` values appear when insufficient data is available for calculation.

---

## Filtering Pools

### Filter by Base Token (e.g., USDC pairs only)

```bash
curl "http://localhost:3000/api/market-data?endpoint=markets&mint=BONK_MINT&baseMint=USDC_MINT"
```

This returns only pools where either base or quote token is USDC.

**Common base mints:**
- **USDC**: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- **SOL**: `So11111111111111111111111111111111111111112`
- **USDT**: `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB`

### Get Specific Pool Data

```bash
curl "http://localhost:3000/api/market-data?endpoint=markets&mint=BONK_MINT&poolAddress=POOL_ADDRESS"
```

Returns data for a single specific pool.

### Get Pool-Specific OHLCV

```bash
curl "http://localhost:3000/api/market-data?endpoint=ohlcv&mint=BONK_MINT&type=1H&poolAddress=POOL_ADDRESS"
```

Returns candlestick data specifically for that pool.

---

## Common Use Cases

### 1. Price Ticker Widget

Show current token price and 24h change:

```bash
curl "http://localhost:3000/api/market-data?endpoint=ohlcv&mint=YOUR_TOKEN&type=1H" \
  | jq '{price: .tokenInfo.price, volume24h: .tokenInfo.volume24h, liquidity: .tokenInfo.liquidity}'
```

### 2. Best Price Across DEXes

Find the best price across all pools:

```bash
curl "http://localhost:3000/api/market-data?endpoint=markets&mint=YOUR_TOKEN" \
  | jq '.pools | sort_by(.price) | reverse | .[0]'
```

### 3. Liquidity Heatmap

Get liquidity across all pools:

```bash
curl "http://localhost:3000/api/market-data?endpoint=markets&mint=YOUR_TOKEN" \
  | jq '.pools | map({dex, liquidity, volume24h})'
```

### 4. Price Chart

Get data for charting:

```bash
curl "http://localhost:3000/api/market-data?endpoint=ohlcv&mint=YOUR_TOKEN&type=15m" \
  | jq '.data.items | map({time: .unixTime, open: .o, high: .h, low: .l, close: .c, volume: .v})'
```

### 5. Trading Signal Detection

Check MACD crossover:

```bash
curl "http://localhost:3000/api/market-data?endpoint=ohlcv&mint=YOUR_TOKEN&type=1H" \
  | jq '.indicators.macd | {line: .line[-1], signal: .signal[-1], histogram: .histogram[-1]}'
```

---

## Error Handling

### Common Errors

**400 Bad Request**
```json
{
  "error": "Invalid endpoint. Use 'ohlcv', 'markets', or 'orderbook'"
}
```
**Solution:** Check the `endpoint` parameter.

**500 Internal Server Error**
```json
{
  "error": "BIRDEYE_API_KEY not configured"
}
```
**Solution:** Ensure API key is set in `.env.local`.

### Validation

All successful responses include `"success": true`. Always check this field:

```javascript
const response = await fetch(url);
const data = await response.json();

if (data.success) {
  // Process data
  console.log(data.tokenInfo.price);
} else {
  // Handle error
  console.error(data.error);
}
```

---

## Rate Limits

- **Anonymous**: 100 requests per minute
- **Response time**: < 5 seconds
- **Concurrent requests**: Supported

---

## Testing

### Quick Validation

Test if the API is working:

```bash
bash scripts/quick-api-test.sh
```

### Interactive Testing

Visit the interactive API tester:
```
http://localhost:3000/docs/api
```

### Full Test Suite

Run comprehensive tests:

```bash
npm run test:api
```

---

## Popular Tokens

Here are some popular Solana token mints for testing:

| Token | Mint Address |
|-------|--------------|
| BONK | `DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263` |
| USDC | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| SOL (Wrapped) | `So11111111111111111111111111111111111111112` |
| JUP | `JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN` |
| USDT | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` |

---

## Bash Script Integration

Display candlestick chart in terminal:

```bash
bash scripts/candlestick-chart.sh BONK_MINT 15m 50
```

**Parameters:**
1. Token mint address
2. Timeframe (1m, 5m, 15m, 1H, 4H, 1D)
3. Number of candles to display (optional)
4. Base mint filter (optional)
5. Pool address filter (optional)

---

## Support

- **Documentation**: `/docs/DEX_API_TESTS.md`
- **Test Suite**: `__tests__/api/dex-aggregator.test.ts`
- **Examples**: `scripts/quick-api-test.sh`
- **Architecture**: `docs/architecture/README.md`

For issues or questions:
1. Check test output: `npm run test:api -- --verbose`
2. Verify server is running: `curl http://localhost:3000/api/market-data?endpoint=ohlcv&mint=BONK&type=1H`
3. Check environment: Ensure `BIRDEYE_API_KEY` is set
