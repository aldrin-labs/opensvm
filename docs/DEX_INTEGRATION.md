# DEX Integration and Arbitrage Detection

This document describes the newly implemented DEX integration and arbitrage detection features for OpenSVM.

## Overview

The DEX integration system provides real-time token price monitoring, liquidity pool discovery, and arbitrage opportunity detection across major Solana DEXs including Jupiter, Raydium, and Orca.

## Features

### 1. Real-time Token Price Monitoring

- **Multi-DEX Aggregation**: Fetches prices from Jupiter, Raydium, and Orca
- **Fallback Mechanism**: Uses mock data when external APIs are unavailable
- **Timeout Handling**: 5-second timeouts with graceful error recovery
- **Rate Limiting**: Built-in API rate limiting to prevent abuse

### 2. Liquidity Pool Discovery

- **Cross-DEX Pool Data**: Aggregates pool information from multiple DEXs
- **Pool Metrics**: TVL, 24h volume, fees, and APY tracking
- **Real-time Updates**: Automatic refresh every 2-5 minutes

### 3. Arbitrage Opportunity Detection

- **Price Difference Analysis**: Identifies profitable price disparities between DEXs
- **Profit Calculation**: Calculates potential profit percentages
- **Filtering**: Only shows opportunities with >0.5% profit potential
- **Ranking**: Sorts opportunities by profitability

## API Endpoints

### `/api/dex-data`

Fetches aggregated DEX data including prices, pools, and optionally arbitrage opportunities.

**Parameters:**
- `tokens` (optional): Comma-separated list of token mint addresses
- `arbitrage` (optional): Set to 'true' to include arbitrage opportunities

**Example Request:**
```bash
GET /api/dex-data?tokens=So11111111111111111111111111111111111111112,EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&arbitrage=true
```

**Response:**
```json
{
  "prices": [
    {
      "mint": "So11111111111111111111111111111111111111112",
      "symbol": "SOL",
      "price": 98.50,
      "priceUsd": 98.50,
      "volume24h": 1250000000,
      "change24h": 2.3,
      "source": "Jupiter",
      "timestamp": 1704067200000
    }
  ],
  "pools": [
    {
      "address": "pool_address_here",
      "tokenA": "So11111111111111111111111111111111111111112",
      "tokenB": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "tokenASymbol": "SOL",
      "tokenBSymbol": "USDC",
      "liquidity": 12500000,
      "volume24h": 4500000,
      "fees24h": 13500,
      "apy": 12.5,
      "dex": "Raydium",
      "timestamp": 1704067200000
    }
  ],
  "arbitrageOpportunities": [
    {
      "tokenMint": "So11111111111111111111111111111111111111112",
      "tokenSymbol": "SOL",
      "buyDEX": "Jupiter",
      "sellDEX": "Raydium",
      "buyPrice": 100,
      "sellPrice": 101.5,
      "priceDifference": 1.5,
      "profitPercentage": 1.5,
      "timestamp": 1704067200000
    }
  ],
  "totalLiquidity": 25000000,
  "totalVolume24h": 9000000,
  "metadata": {
    "timestamp": 1704067200000,
    "priceCount": 5,
    "poolCount": 4,
    "arbitrageCount": 2
  }
}
```

## UI Components

### TrendingTokens Component

Enhanced to display real-time token prices from DEX aggregation:

- Live price updates every 5 minutes
- DEX source attribution
- Loading states and last updated timestamps
- Fallback to mock data when APIs are unavailable

### DEXAnalytics Component

New component displaying comprehensive DEX analytics:

- **Overview Stats**: Total liquidity, 24h volume, arbitrage opportunities count
- **Arbitrage Opportunities**: Top profit opportunities with buy/sell recommendations
- **Top Liquidity Pools**: Pool rankings with APY and volume data
- **Real-time Updates**: Automatic refresh every 2 minutes

## Integration Architecture

### DEX Program IDs

```typescript
export const DEX_PROGRAM_IDS = {
  RAYDIUM: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  JUPITER: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
  ORCA: '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP',
  OPENBOOK: 'srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX',
  METEORA: 'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB'
} as const;
```

### Error Handling

The system implements robust error handling:

1. **API Timeouts**: 5-second timeouts for external API calls
2. **Fallback Data**: Mock data when external APIs are unavailable
3. **Rate Limiting**: Prevents API abuse and handles rate limit responses
4. **Graceful Degradation**: UI continues to function with fallback data

### Performance Optimizations

- **Concurrent Requests**: Parallel fetching from multiple DEX APIs
- **Request Debouncing**: Prevents excessive API calls
- **Caching**: Rate-limited API access with built-in caching
- **Lazy Loading**: Components load data asynchronously

## Usage Examples

### Basic DEX Data Fetching

```typescript
import { aggregateDEXData } from '@/lib/dex-integration';

const dexData = await aggregateDEXData();
console.log(`Found ${dexData.prices.length} token prices`);
console.log(`Found ${dexData.pools.length} liquidity pools`);
```

### Arbitrage Detection

```typescript
import { detectArbitrageOpportunities } from '@/lib/dex-integration';

const opportunities = detectArbitrageOpportunities(tokenPrices);
opportunities.forEach(opp => {
  console.log(`${opp.tokenSymbol}: ${opp.profitPercentage.toFixed(2)}% profit`);
  console.log(`Buy on ${opp.buyDEX}, sell on ${opp.sellDEX}`);
});
```

### Real-time Pool Monitoring

```typescript
import { monitorLiquidityPools } from '@/lib/dex-integration';

const poolAddresses = ['pool1', 'pool2'];
await monitorLiquidityPools(poolAddresses, (poolAddress, data) => {
  console.log(`Pool ${poolAddress} updated:`, data);
});
```

## Future Enhancements

1. **Route Optimization**: Implement multi-hop arbitrage route finding
2. **Cross-chain Integration**: Add Ethereum DEX comparison
3. **Advanced Analytics**: Implement yield farming optimization
4. **Risk Assessment**: Add rug pull and impermanent loss calculations
5. **WebSocket Integration**: Real-time streaming data updates

## Testing

Run the integration tests:

```bash
# Simple algorithm test
node test-dex-integration.js

# Full test suite (when Jest is configured)
npm test dex-integration.test.ts
```

## Configuration

Environment variables for DEX integration:

```env
# Rate limiting configuration
DEX_API_RATE_LIMIT=10
DEX_API_WINDOW_MS=60000

# API timeouts
DEX_API_TIMEOUT_MS=5000

# Enable/disable fallback data
DEX_USE_FALLBACK=true
```