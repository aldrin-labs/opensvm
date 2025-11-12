# Testing Guide - OpenSVM DEX Aggregator API

## Quick Start

### Fast Validation (8 tests, ~10 seconds)
```bash
# Start dev server first
npm run dev

# In another terminal
API_PORT=3000 ./scripts/quick-api-test.sh
```

### Full Test Suite (38 tests, comprehensive)
```bash
# Start dev server first
npm run dev

# In another terminal
npm run test:api

# Or with custom port
TEST_API_URL=http://localhost:3004 npm run test:api
```

## Test Coverage

### ✅ Quick Validation Script (8 tests)
Location: `scripts/quick-api-test.sh`

**OHLCV Tests (3)**
- ✓ Get OHLCV 1H data
- ✓ Get OHLCV 15m data
- ✓ Technical indicators (MA7, MA25, MACD)

**Markets/Pools Tests (3)**
- ✓ Get top 3 pools by liquidity
- ✓ Filter pools by base mint (e.g., USDC pairs only)
- ✓ Pool metadata completeness

**Token Info Tests (2)**
- ✓ Token overview data
- ✓ Main trading pair identification

### ✅ Full Jest Suite (38 tests)
Location: `__tests__/api/dex-aggregator.test.ts`

**Categories:**
1. OHLCV Data (10 tests) - All timeframes, indicators, validation
2. Market Data (4 tests) - Token info, pricing, liquidity
3. Pool Discovery (6 tests) - Filtering, sorting, metadata
4. DEX Coverage (2 tests) - Multi-DEX aggregation
5. Liquidity & Volume (3 tests) - Metrics accuracy
6. Price Quality (2 tests) - Consistency checks
7. Performance (3 tests) - Speed, concurrency
8. Data Completeness (2 tests) - Field validation
9. Edge Cases (3 tests) - Error handling
10. Orderbook (1 test) - Order data
11. Integration (2 tests) - End-to-end workflows

## API Endpoints Tested

### 1. OHLCV (Candlestick Data)
```bash
curl "http://localhost:3000/api/market-data?endpoint=ohlcv&mint=BONK_MINT&type=1H"
```
**Response includes:**
- Candlestick data (open, high, low, close, volume)
- Technical indicators (MA7, MA25, MACD)
- Token info (symbol, name, price, liquidity)
- Main trading pair

**Supported timeframes:**
- `1m` - 1 minute
- `5m` - 5 minutes
- `15m` - 15 minutes
- `1H` - 1 hour
- `4H` - 4 hours
- `1D` - 1 day

### 2. Markets/Pools
```bash
# Get top 3 pools
curl "http://localhost:3000/api/market-data?endpoint=markets&mint=BONK_MINT"

# Filter by base mint (USDC pairs only)
curl "http://localhost:3000/api/market-data?endpoint=markets&mint=BONK_MINT&baseMint=USDC_MINT"

# Get specific pool
curl "http://localhost:3000/api/market-data?endpoint=markets&mint=BONK_MINT&poolAddress=POOL_ADDRESS"
```
**Response includes:**
- Top 3 pools by liquidity
- DEX name (Phoenix, Raydium, Orca, etc.)
- Trading pair
- Pool address
- Price, liquidity, volume, tx count
- Base and quote token info

### 3. Token Overview
```bash
curl "http://localhost:3000/api/market-data?endpoint=overview&mint=BONK_MINT"
```
**Response includes:**
- Symbol, name, decimals
- Price (USD)
- Total liquidity
- 24h volume
- Market cap
- Fully diluted valuation

### 4. Orderbook
```bash
curl "http://localhost:3000/api/market-data?endpoint=orderbook&mint=BONK_MINT"
```
**Response includes:**
- Buy/sell orders
- Price levels
- Order sizes
- Market depth

## Test Tokens

We use real Solana tokens for testing:

```bash
BONK="DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
USDC="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
SOL="So11111111111111111111111111111111111111112"
JUP="JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"
```

## Environment Setup

### Required
```bash
# .env.local
BIRDEYE_API_KEY=your_key_here
```

### Optional
```bash
# For Jest tests
TEST_API_URL=http://localhost:3000

# For quick validation
API_PORT=3000
```

## Troubleshooting

### Tests Fail with Empty Responses
**Problem:** API returns `{}`

**Solution:**
```bash
# Check if server is running
curl http://localhost:3000/api/market-data?endpoint=ohlcv&mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263&type=1H

# Set correct port
TEST_API_URL=http://localhost:3004 npm run test:api
```

### Quick Test Script Errors
**Problem:** `jq: command not found`

**Solution:**
```bash
# Install jq
sudo apt-get install jq  # Ubuntu/Debian
brew install jq          # macOS
```

### Port Already in Use
**Problem:** Server won't start on port 3000

**Solution:**
```bash
# Find and kill the process
lsof -ti:3000 | xargs kill -9

# Or use a different port
API_PORT=3004 npm run dev
```

### Jest Out of Memory
**Problem:** `JavaScript heap out of memory`

**Solution:**
Already configured in `package.json`:
```json
"test:api": "NODE_OPTIONS=--max_old_space_size=4096 jest ..."
```

## Performance Expectations

### Quick Validation
- **Runtime:** ~10 seconds
- **Network Calls:** 8
- **Pass Rate:** 100% (8/8)

### Full Jest Suite
- **Runtime:** ~30-60 seconds
- **Network Calls:** 50+
- **Pass Rate:** Target 100% (38/38)

### API Response Times
- OHLCV: < 2 seconds
- Markets: < 3 seconds
- Token Overview: < 2 seconds
- Orderbook: < 3 seconds

## Competitive Benchmarks

Our API competes with:
- **Jupiter** - Top Solana DEX aggregator
- **Raydium** - Leading AMM protocol
- **Orca** - Major liquidity provider

### Feature Comparison

| Feature | OpenSVM | Jupiter | Raydium | Orca |
|---------|---------|---------|---------|------|
| Multi-DEX | ✅ | ✅ | ❌ | ❌ |
| OHLCV Data | ✅ | ✅ | ✅ | ✅ |
| Technical Indicators | ✅ | ❌ | ❌ | ❌ |
| Pool Filtering | ✅ | ✅ | ❌ | ❌ |
| Base Mint Filter | ✅ | ❌ | ❌ | ❌ |
| Specific Pool | ✅ | ✅ | ✅ | ✅ |
| Top N Pools | ✅ (3) | ✅ (5+) | ✅ | ✅ |

## Documentation

- **Full Test Docs:** `docs/DEX_API_TESTS.md`
- **Summary:** `docs/TEST_SUITE_SUMMARY.md`
- **Architecture:** `docs/architecture/README.md`

## CI/CD Integration

### GitHub Actions Example
```yaml
name: API Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run dev &
      - run: sleep 10  # Wait for server
      - run: ./scripts/quick-api-test.sh
      - run: npm run test:api
```

## Next Steps

1. **Add to CI/CD** - Automate testing on every commit
2. **Monitor Performance** - Track API response times
3. **Expand Coverage** - Add more edge cases
4. **Load Testing** - Test with concurrent requests
5. **Rate Limiting** - Add and test rate limit handling

## Support

For issues or questions:
1. Check `docs/DEX_API_TESTS.md`
2. Review test output carefully
3. Ensure `.env.local` is configured
4. Verify server is running on correct port
