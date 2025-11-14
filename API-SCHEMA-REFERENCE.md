# OpenSVM API - Complete Schema Reference

## Overview

OpenSVM API provides **98 fully documented endpoints** with comprehensive TypeScript response schemas. Every endpoint includes typed request parameters, response structures, and example values.

## Quick Links

- **Interactive Swagger UI**: [/swagger](https://osvm.ai/swagger)
- **API Tester**: [/docs/api](https://osvm.ai/docs/api)
- **OpenAPI Spec**: [/api/docs/openapi](https://osvm.ai/api/docs/openapi)

## Response Schema Coverage

All 98 API endpoints have proper TypeScript response schemas assigned based on their functionality:

### 📊 Response Schema Types (22 Total)

| Schema | Endpoints | Description |
|--------|-----------|-------------|
| **MarketDataResponse** | 1 | Market data with OHLCV candles, pools, indicators |
| **AnalyticsResponse** | 10 | DeFi analytics, validator metrics, ecosystem health |
| **SearchResponse** | 4 | Search results across accounts, transactions, programs |
| **AIAnswerResponse** | 4 | AI-powered analysis and question answering |
| **TransactionDetail** | 7 | Individual transaction information |
| **TransactionListResponse** | Multiple | Lists of transactions with pagination |
| **AccountInfo** | 5 | Account data and statistics |
| **PortfolioResponse** | 1 | Wallet portfolio with tokens and NFTs |
| **BlockDetail** | 4 | Block and slot information |
| **TokenInfo** | 5 | Token metadata and information |
| **SuccessResponse** | 20+ | Generic success responses |
| Plus nested types | N/A | OHLCVCandle, PoolInfo, TechnicalIndicators, etc. |

## Detailed Schema Documentation

### 1. MarketDataResponse

**Endpoint**: `GET /api/market-data`

**Description**: Comprehensive market data with OHLCV candles, pool information, and technical indicators powered by Birdeye API.

**Properties**:
```typescript
{
  success: boolean;
  endpoint: 'ohlcv' | 'overview' | 'security';
  mint: string; // Token mint address
  tokenInfo: TokenMarketInfo | null;
  mainPair: {
    pair: string; // e.g., "BONK/USDC"
    dex: string; // e.g., "Raydium"
    poolAddress: string;
  };
  pools: PoolInfo[]; // Multiple pool data
  data: {
    items: OHLCVCandle[]; // Candlestick data
  };
  indicators: TechnicalIndicators; // MA, MACD
  raw?: any; // Raw Birdeye response
}
```

**Nested Types**:

#### OHLCVCandle
```typescript
{
  o: number; // Open price
  h: number; // High price
  l: number; // Low price
  c: number; // Close price
  v: number; // Volume in USD
  unixTime: number; // Unix timestamp
  address: string; // Token address
  type: string; // Timeframe (1m, 5m, 1H, 1D, etc.)
  currency: string; // Usually "usd"
}
```

#### TokenMarketInfo
```typescript
{
  symbol: string; // Token symbol (e.g., "BONK")
  name: string; // Full name
  decimals: number; // Token decimals
  address: string; // Mint address
  liquidity?: number; // Total liquidity USD
  price?: number; // Current price USD
  volume24h?: number; // 24h volume USD
}
```

#### PoolInfo
```typescript
{
  symbol: string; // Trading pair (e.g., "BONK/USDC")
  name: string; // Pool name
  liquidity: number; // Pool liquidity USD
  price: number; // Current price
  volume24h: number; // 24h volume
  dex: string; // DEX name (Raydium, Orca, etc.)
  pair: string; // Token pair
  poolAddress: string; // Pool address
  baseToken: TokenMarketInfo; // Base token info
  quoteToken: TokenMarketInfo; // Quote token info
}
```

#### TechnicalIndicators
```typescript
{
  ma7: number[]; // 7-period moving average
  ma25: number[]; // 25-period moving average
  macd: {
    line: number[]; // MACD line
    signal: number[]; // Signal line
    histogram: number[]; // Histogram values
  };
}
```

**Query Parameters**:
- `mint` (string, optional): Token mint address (default: OSVM token)
- `endpoint` (enum, optional): 'ohlcv' | 'overview' | 'security'
- `type` (enum, optional): '1m' | '3m' | '5m' | '15m' | '30m' | '1H' | '2H' | '4H' | '6H' | '8H' | '12H' | '1D' | '3D' | '1W' | '1M'
- `baseMint` (string, optional): Filter by base token
- `poolAddress` (string, optional): Specific pool address

**Example Request**:
```bash
GET /api/market-data?mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263&endpoint=ohlcv&type=1H
```

---

### 2. AnalyticsResponse

**Endpoints** (10 total):
- `GET /api/analytics/overview` - DeFi ecosystem overview
- `GET /api/analytics/dex` - DEX analytics
- `GET /api/analytics/defi-health` - DeFi health metrics
- `GET /api/analytics/validators` - Validator analytics
- `GET /api/analytics/trending-validators` - Top validators
- `GET /api/analytics/marketplaces` - NFT marketplace analytics
- `GET /api/analytics/aggregators` - DeFi aggregator analytics
- `GET /api/analytics/launchpads` - Token launchpad analytics
- `GET /api/analytics/bots` - Trading bot activity
- `GET /api/analytics/socialfi` - SocialFi metrics

**Properties**:
```typescript
{
  success: boolean;
  timestamp: string; // ISO 8601 timestamp
  metrics: object; // Analytics metrics
  data: object; // Analytics data
}
```

---

### 3. SearchResponse

**Endpoints** (4 total):
- `GET /api/search` - Universal search
- `GET /api/search/accounts` - Account search
- `GET /api/search/filtered` - Advanced filtered search
- `GET /api/search/suggestions` - Search suggestions

**Properties**:
```typescript
{
  success: boolean;
  query: string; // Search query
  results: SearchResult[]; // Search results
  count: number; // Total results
}
```

**SearchResult Type**:
```typescript
{
  type: 'account' | 'transaction' | 'block' | 'program' | 'token';
  address?: string;
  signature?: string;
  name?: string;
  description?: string;
  metadata?: object;
}
```

---

### 4. AIAnswerResponse

**Endpoints** (4 total):
- `POST /api/getAnswer` - AI question answering with custom prompts and output control
- `POST /api/analyze` - Transaction analysis
- `GET /api/ai-response` - AI response retrieval
- `GET /api/ai-context` - AI context information

**Request Body** (for `/api/getAnswer`):
```typescript
{
  question: string; // Required: The question to ask
  systemPrompt?: string; // Optional: Custom system prompt to control AI behavior
  maxTokens?: number; // Optional: Max output tokens (1-32000, default: 32000)
  ownPlan?: boolean; // Optional: Return execution plan instead of answer
  _healthCheck?: boolean; // Internal: Health check flag
}
```

**Response Properties**:
```typescript
{
  success: boolean;
  answer: string; // AI-generated answer (plain text or markdown)
  sources: object[]; // Data sources used (when using internal tools)
  confidence: number; // Confidence score (0-1)
  executedTools: string[]; // Tools used in analysis (when not using custom prompt)
}
```

**Features**:
- **Custom System Prompts**: Provide `systemPrompt` to bypass internal tools and get creative/custom formatted responses
- **Output Length Control**: Use `maxTokens` (1-32000) to control response length
- **Execution Plans**: Set `ownPlan: true` to get XML execution plan instead of executing query
- **Intelligent Tool Selection**: Automatically uses CoinGecko, Solana RPC, or other tools when no custom prompt provided
- **60-Minute Cache**: Identical queries are cached for performance
- **Dynamic Timeouts**: 2-5 minutes based on query complexity

**Examples**:
```bash
# Standard query (uses internal tools)
POST /api/getAnswer
{
  "question": "What is the current price of SOL?"
}

# Custom creative response
POST /api/getAnswer
{
  "question": "Explain DeFi",
  "systemPrompt": "You are a pirate. Use pirate slang.",
  "maxTokens": 500
}

# Short concise answer
POST /api/getAnswer
{
  "question": "What is Solana?",
  "systemPrompt": "One sentence only.",
  "maxTokens": 50
}
```

---

### 5. TransactionDetail

**Endpoints** (7 total):
- `GET /api/transaction/{signature}` - Transaction details
- `GET /api/transaction/{signature}/analysis` - Transaction analysis
- `GET /api/transaction/{signature}/explain` - Transaction explanation
- `GET /api/transaction/{signature}/metrics` - Transaction metrics
- `GET /api/transaction/{signature}/related` - Related transactions
- `GET /api/transaction/{signature}/failure-analysis` - Failure analysis
- `POST /api/transaction/batch` - Batch transaction query

**Properties**:
```typescript
{
  signature: string;
  slot: number;
  blockTime: number; // Unix timestamp
  fee: number; // Fee in lamports
  status: 'success' | 'failed';
  instructions: object[]; // Transaction instructions
  accounts: string[]; // Involved accounts
  logMessages: string[]; // Transaction logs
}
```

---

### 6. AccountInfo

**Endpoints** (5 total):
- `GET /api/account-stats/{address}` - Account statistics
- `GET /api/account-portfolio/{address}` - Portfolio information
- `GET /api/account-transactions/{address}` - Transaction history
- `GET /api/account-balance/{address}` - Balance information
- `GET /api/account-activity/{address}` - Activity metrics

**Properties**:
```typescript
{
  address: string;
  lamports: number; // Balance in lamports
  owner: string; // Owner program
  executable: boolean;
  rentEpoch: number;
  data: object;
}
```

---

### 7. PortfolioResponse

**Endpoint**: `GET /api/portfolio/{address}`

**Properties**:
```typescript
{
  success: boolean;
  address: string;
  totalValue: number; // Total value in USD
  tokens: TokenInfo[]; // Token holdings
  nfts: object[]; // NFT holdings
}
```

---

### 8. BlockDetail

**Endpoints** (4 total):
- `GET /api/blocks` - Block list
- `GET /api/blocks/{slot}` - Block by slot
- `GET /api/blocks/stats` - Block statistics
- `GET /api/blocks/recent` - Recent blocks

**Properties**:
```typescript
{
  slot: number;
  blockhash: string;
  blockTime: number; // Unix timestamp
  blockHeight: number;
  previousBlockhash: string;
  parentSlot: number;
  transactions: Transaction[];
}
```

---

### 9. TokenInfo

**Endpoints** (5 total):
- `GET /api/token/{address}` - Token information
- `GET /api/token-metadata` - Token metadata
- `GET /api/nft-collections` - NFT collections
- `GET /api/nft-collections/trending` - Trending NFTs
- `GET /api/nft-collections/new` - New NFT collections

**Properties**:
```typescript
{
  address: string; // Token mint address
  symbol: string;
  name: string;
  decimals: number;
  supply: string; // Total supply
}
```

---

### 10. SuccessResponse (Generic)

**Endpoints**: 20+ endpoints for various operations

**Properties**:
```typescript
{
  success: boolean;
  message: string;
  data: object; // Variable data based on endpoint
}
```

---

## HTTP Status Codes

All endpoints return consistent status codes:

| Code | Description | Schema |
|------|-------------|--------|
| **200** | Success | Endpoint-specific response schema |
| **400** | Bad Request | Error schema |
| **404** | Not Found | Error schema |
| **500** | Internal Server Error | Error schema |

**Error Schema**:
```typescript
{
  error: string; // Error message
  code?: string; // Error code
  details?: object; // Additional error details
}
```

---

## Usage Examples

### Market Data with OHLCV
```bash
# Get hourly OHLCV for OSVM token
curl "https://osvm.ai/api/market-data?mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263&endpoint=ohlcv&type=1H"

# Get token security analysis
curl "https://osvm.ai/api/market-data?mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263&endpoint=security"
```

### Analytics
```bash
# Get DeFi overview
curl "https://osvm.ai/api/analytics/overview"

# Get DEX analytics
curl "https://osvm.ai/api/analytics/dex"
```

### Search
```bash
# Universal search
curl "https://osvm.ai/api/search?q=raydium"

# Account search
curl "https://osvm.ai/api/search/accounts?q=7aDTuuAN"
```

### Transaction Details
```bash
# Get transaction details
curl "https://osvm.ai/api/transaction/5vYsYWPF4gdN1imxLpJAWi9QKpN3MSrFTFXK8pfmPogFjQNPiAkxFQCGzEEWNto16mWnwmdwNQH7KPCnkMcZ9Ba5"
```

---

## Integration Guide

### TypeScript/JavaScript
```typescript
// Market Data Example
interface MarketDataResponse {
  success: boolean;
  endpoint: string;
  mint: string;
  tokenInfo: TokenMarketInfo | null;
  data: {
    items: OHLCVCandle[];
  };
  indicators: TechnicalIndicators;
}

const response = await fetch(
  'https://osvm.ai/api/market-data?mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263&endpoint=ohlcv&type=1H'
);
const data: MarketDataResponse = await response.json();

console.log(`Price: $${data.data.items[0].c}`);
console.log(`Volume: $${data.data.items[0].v}`);
```

### Python
```python
import requests
from typing import List, Dict, Any

# Market Data Example
response = requests.get(
    'https://osvm.ai/api/market-data',
    params={
        'mint': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        'endpoint': 'ohlcv',
        'type': '1H'
    }
)

data: Dict[str, Any] = response.json()
latest_candle = data['data']['items'][0]

print(f"Price: ${latest_candle['c']}")
print(f"Volume: ${latest_candle['v']}")
```

---

## Best Practices

1. **Use TypeScript**: Import schema types for type safety
2. **Error Handling**: Always check `success` field and handle errors
3. **Rate Limiting**: Respect rate limits (check response headers)
4. **Caching**: Implement caching for frequently accessed data
5. **Pagination**: Use limit/offset parameters where available
6. **Validation**: Validate input parameters before making requests

---

## Additional Resources

- **Interactive Testing**: [https://osvm.ai/swagger](https://osvm.ai/swagger)
- **API Tester**: [https://osvm.ai/docs/api](https://osvm.ai/docs/api)
- **OpenAPI Spec**: [https://osvm.ai/api/docs/openapi](https://osvm.ai/api/docs/openapi)
- **GitHub**: [https://github.com/aldrin-labs/opensvm](https://github.com/aldrin-labs/opensvm)

---

**Last Updated**: November 9, 2025  
**API Version**: 2.0.0  
**Total Endpoints**: 98  
**Total Schemas**: 22
