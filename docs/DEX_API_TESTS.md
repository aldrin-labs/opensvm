# DEX Aggregator API - E2E Test Suite

Comprehensive end-to-end tests for OpenSVM's DEX aggregator API, ensuring competitiveness with major Solana DEX aggregators like Jupiter, Raydium, and Orca.

## Test Coverage

### 1. **OHLCV Data Endpoints** (10 tests)
- ✅ Fetch candlestick data for tokens
- ✅ Support all timeframes (1m, 5m, 15m, 1H, 4H, 1D)
- ✅ Include technical indicators (MA7, MA25, MACD)
- ✅ Pool-specific OHLCV data
- ✅ Validate OHLC relationships (Low ≤ Open/Close ≤ High)

### 2. **Market Data & Token Overview** (4 tests)
- ✅ Token metadata (symbol, name)
- ✅ Current price and liquidity
- ✅ 24h volume
- ✅ Main trading pair information
- ✅ Error handling for invalid addresses

### 3. **Pool Discovery** (6 tests)
- ✅ Top 3 pools by liquidity
- ✅ Liquidity-sorted results
- ✅ Filter by base mint (e.g., USDC pairs only)
- ✅ Filter by specific pool address
- ✅ Complete pool metadata (DEX, tokens, addresses)
- ✅ Handle empty results gracefully

### 4. **DEX/AMM Coverage** (2 tests)
- ✅ Multi-DEX aggregation
- ✅ Major DEX support (Phoenix, Raydium, Orca, Meteora, Zerofi, Bonkswap, Saros)

### 5. **Liquidity & Volume Metrics** (3 tests)
- ✅ Accurate liquidity data per pool
- ✅ 24h volume and transaction counts
- ✅ Total liquidity across all pools

### 6. **Price Data Quality** (2 tests)
- ✅ Consistent prices across endpoints
- ✅ Valid OHLC relationships

### 7. **API Performance** (3 tests)
- ✅ Response time < 5 seconds
- ✅ Concurrent request handling
- ✅ Proper error codes for invalid requests

### 8. **Data Completeness** (2 tests)
- ✅ All required pool fields present
- ✅ All required OHLCV fields present

### 9. **Edge Cases** (3 tests)
- ✅ Tokens with no pools
- ✅ Missing API key handling
- ✅ Non-existent pool addresses

### 10. **Additional Features** (1 test)
- ✅ Orderbook endpoint

### 11. **Integration Tests** (2 tests)
- ✅ Complete workflow: markets → OHLCV → pool-specific data
- ✅ Best price comparison across pools

## Total Test Coverage
**38 comprehensive tests** covering all critical DEX aggregator functionality

## Running Tests

### Prerequisites
1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Ensure `BIRDEYE_API_KEY` is set in `.env.local`

### Run All API Tests
```bash
npm run test:api
```

### Run Tests with Watcher
```bash
npm run test:api:watch
```

### Run with Custom Port
```bash
API_PORT=3004 npm run test:api
```

### Run Test Script
```bash
./scripts/test-dex-api.sh
```

Or with custom port:
```bash
API_PORT=3004 ./scripts/test-dex-api.sh
```

## Test Configuration

### Environment Variables
- `TEST_API_URL`: Base URL for API (default: `http://localhost:3000`)
- `API_PORT`: Dev server port (default: `3000`)
- `BIRDEYE_API_KEY`: Birdeye API key (required)

### Test Tokens
- **BONK**: `DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263`
- **USDC**: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- **SOL**: `So11111111111111111111111111111111111111112`
- **USDT**: `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB`

### Test Pools
- **BONK-USDC (Phoenix)**: `GBMoNx84HsFdVK63t8BZuDgyZhSBaeKWB4pHHpoeRM9z`
- **BONK-USDC (Zerofi)**: `Du4WfVEeXmYtgwvX5FYzJaW5J8LokjFRNFbPFMXYfe4`
- **BONK-SOL (Bonkswap)**: `GBmzQL7BTKwSV9Qg7h5iXQad1q61xwMSzMpdbBkCyo2p`

## API Endpoints Tested

### OHLCV Endpoint
```
GET /api/market-data?endpoint=ohlcv&mint={TOKEN}&type={TIMEFRAME}
GET /api/market-data?endpoint=ohlcv&mint={TOKEN}&type={TIMEFRAME}&poolAddress={POOL}
```

**Parameters:**
- `mint`: Token address
- `type`: Timeframe (1m, 5m, 15m, 1H, 4H, 1D)
- `poolAddress` (optional): Specific pool address

**Response:**
```json
{
  "success": true,
  "endpoint": "ohlcv",
  "mint": "...",
  "tokenInfo": {
    "symbol": "Bonk",
    "name": "Bonk",
    "price": 0.000012843,
    "liquidity": 7288519,
    "volume24h": 3786770
  },
  "mainPair": {
    "pair": "Bonk/USDC",
    "dex": "Phoenix",
    "poolAddress": "..."
  },
  "data": {
    "items": [
      {
        "o": 0.00001234,
        "h": 0.00001250,
        "l": 0.00001220,
        "c": 0.00001245,
        "v": 123456.78
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
  }
}
```

### Markets Endpoint
```
GET /api/market-data?endpoint=markets&mint={TOKEN}
GET /api/market-data?endpoint=markets&mint={TOKEN}&baseMint={BASE}
GET /api/market-data?endpoint=markets&mint={TOKEN}&poolAddress={POOL}
```

**Parameters:**
- `mint`: Token address
- `baseMint` (optional): Filter by base token (e.g., USDC)
- `poolAddress` (optional): Filter to specific pool

**Response:**
```json
{
  "success": true,
  "endpoint": "markets",
  "mint": "...",
  "pools": [
    {
      "dex": "Phoenix",
      "pair": "Bonk-USDC",
      "poolAddress": "...",
      "price": 0.000012812,
      "liquidity": 1265975.07,
      "volume24h": 59475.53,
      "txCount24h": 710,
      "baseToken": "Bonk",
      "quoteToken": "USDC",
      "baseAddress": "...",
      "quoteAddress": "..."
    }
  ],
  "count": 3,
  "filters": {
    "baseMint": null,
    "poolAddress": null
  }
}
```

### Orderbook Endpoint
```
GET /api/market-data?endpoint=orderbook&mint={TOKEN}
```

## Competitive Analysis

### Features Matching Jupiter/Raydium:
- ✅ Multi-DEX aggregation
- ✅ Real-time price data
- ✅ Liquidity metrics
- ✅ Pool filtering
- ✅ Technical indicators
- ✅ 24h volume/transaction data
- ✅ Pool-specific data

### Unique Features:
- ✅ Built-in technical indicators (MACD, MA)
- ✅ Flexible pool filtering (base mint, pool address)
- ✅ Comprehensive error handling
- ✅ Unified API design

## Performance Benchmarks

- **Response Time**: < 5 seconds
- **Concurrent Requests**: 5+ simultaneous
- **Data Freshness**: Real-time via Birdeye API
- **Coverage**: 7+ major DEXes

## Test Results Interpretation

### Success Criteria:
- All tests pass (38/38)
- Response times < 5s
- Valid data structure
- Proper error handling
- Complete data fields

### Failure Investigation:
1. Check dev server is running
2. Verify `BIRDEYE_API_KEY` in `.env.local`
3. Check API rate limits
4. Review test logs for specific failures

## Continuous Integration

Add to CI/CD pipeline:

```yaml
# .github/workflows/api-tests.yml
name: API Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run build
      - run: npm run dev &
      - run: sleep 10
      - run: npm run test:api
```

## Contributing

When adding new endpoints:
1. Add tests to `__tests__/api/dex-aggregator.test.ts`
2. Follow existing test structure
3. Include edge cases
4. Update this documentation

## Support

For issues or questions:
- Check test logs: `npm run test:api -- --verbose`
- Review API responses in browser/Postman
- Verify Birdeye API status
