# OpenSVM API Documentation

Complete reference for all API endpoints in the OpenSVM platform with request/response schemas and usage examples.

**Base URL**: `https://opensvm.com` or `http://localhost:3000` (development)

**Complete API Reference**: See [API_REFERENCE.md](./API_REFERENCE.md) for all 193 endpoints

## Table of Contents

- [Authentication](#authentication)
- [Trading APIs](#trading-apis)
- [AI & Analysis APIs](#ai--analysis-apis)
- [Account APIs](#account-apis)
- [Blockchain Data APIs](#blockchain-data-apis)
- [Transaction APIs](#transaction-apis)
- [Token APIs](#token-apis)
- [NFT APIs](#nft-apis)
- [Analytics APIs](#analytics-apis)
- [Social & User APIs](#social--user-apis)
- [System APIs](#system--utilities)
- [WebSocket APIs](#websocket-apis)

---

## Authentication

Most endpoints require authentication via API key or session token.

### Methods

1. **API Key** (Recommended for programmatic access)
   ```bash
   curl -H "Authorization: Bearer YOUR_API_KEY" https://opensvm.com/api/endpoint
   ```

2. **Session Token** (Automatic via cookies for web)
   - Handled automatically by browser
   - Set via `/api/auth/session`

3. **Wallet Signature** (For wallet-specific operations)
   - Sign message with wallet
   - Include signature in request body

---

## Trading APIs

### Get Trading Markets

Retrieve available trading markets with optional filtering by type and DEX.

**Endpoint**: `GET /api/trading/markets`

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `type` | string | No | `trending` | Market type: `trending`, `gainers`, `losers`, `volume`, `marketcap` |
| `limit` | number | No | `100` | Maximum number of results (1-100) |
| `dex` | string | No | `all` | Filter by DEX: `raydium`, `orca`, `meteora`, `phoenix`, `all` |

**Response Schema**:
```typescript
{
  markets: Array<{
    symbol: string;           // e.g., "SOL/USDC"
    baseToken: string;        // e.g., "SOL"
    quoteToken: string;       // e.g., "USDC"
    price: number;            // Current price
    change24h: number;        // 24h price change percentage
    volume24h: number;        // 24h trading volume in USD
    source: string;           // Data source: "Birdeye", "CoinGecko", "Mock"
    marketCap?: number;       // Market capitalization
    liquidity?: number;       // Total liquidity
    mint?: string;            // Token mint address
    dex?: string;             // DEX name
    poolAddress?: string;     // Pool address
  }>;
  isRealData: boolean;        // true if real data, false if mock
  dataSource: string;         // Source description
  count: number;              // Number of markets returned
  totalAvailable: number;     // Total markets available
  type: string;               // Request type
  lastUpdate: number;         // Timestamp of last update
}
```

**Example Request**:
```bash
# Get trending markets
curl "https://opensvm.com/api/trading/markets?type=trending&limit=20"

# Get top gainers from Raydium
curl "https://opensvm.com/api/trading/markets?type=gainers&dex=raydium&limit=50"

# Get high volume markets
curl "https://opensvm.com/api/trading/markets?type=volume&limit=100"
```

---

### Get Token Pools

Search for all trading pools/pairs for a specific token.

**Endpoint**: `GET /api/trading/pools`

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token` | string | Yes* | Token mint address |
| `symbol` | string | Yes* | Token symbol (for mock data) |
| `dex` | string | No | Filter by DEX name |

*Either `token` or `symbol` is required

**Response Schema**:
```typescript
{
  pools: Array<{
    symbol: string;           // e.g., "BONK/USDC"
    baseToken: string;        // Base token symbol
    quoteToken: string;       // Quote token symbol
    price: number;            // Current price
    change24h: number;        // 24h price change %
    volume24h: number;        // 24h volume in USD
    liquidity: number;        // Pool liquidity in USD
    dex: string;              // DEX name
    poolAddress: string;      // Pool contract address
    source: string;           // Data source
  }>;
  isRealData: boolean;
  dataSource: string;
  count: number;
  token: string;              // Token identifier used
  dexFilter: string;          // DEX filter applied
  lastUpdate: number;
}
```

**Example Request**:
```bash
# Get all pools for SOL
curl "https://opensvm.com/api/trading/pools?token=So11111111111111111111111111111111111111112"

# Get Raydium pools for BONK
curl "https://opensvm.com/api/trading/pools?token=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263&dex=raydium"
```

---

### Get Recent Trades

Fetch recent trades for a specific token.

**Endpoint**: `GET /api/trading/trades`

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `mint` | string | Yes | Token mint address |
| `limit` | number | No | Number of trades to return |
| `source` | string | No | Data source filter |

**Response Schema**:
```typescript
{
  trades: Array<{
    id: string;
    price: number;
    amount: number;
    side: 'buy' | 'sell';
    timestamp: number;
    dex?: string;
    txHash?: string;
  }>;
}
```

**Example Request**:
```bash
curl "https://opensvm.com/api/trading/trades?mint=So11111111111111111111111111111111111111112&limit=50"
```

---

### Execute Trade

Execute a market or limit order.

**Endpoint**: `POST /api/trading/execute`

**Request Body**:
```typescript
{
  type: 'market' | 'limit';
  side: 'buy' | 'sell';
  amount: number;
  price?: number;              // Required for limit orders
  market: string;
  stopLoss?: number;
  takeProfit?: number;
  userId?: string;
}
```

**Response Schema**:
```typescript
{
  orderId: string;
  status: 'pending' | 'filled' | 'partial' | 'cancelled' | 'failed';
  type: 'market' | 'limit';
  side: 'buy' | 'sell';
  amount: number;
  price?: number;
  executedAmount?: number;
  executedPrice?: number;
  timestamp: number;
  fees?: number;
  txHash?: string;
  message?: string;
}
```

**Example Request**:
```bash
curl -X POST https://opensvm.com/api/trading/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "type": "market",
    "side": "buy",
    "amount": 100,
    "market": "SOL/USDC"
  }'
```

---

### Get Trading Positions

Get current trading positions.

**Endpoint**: `GET /api/trading/positions`

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | Filter by status: `open`, `closed` |
| `symbol` | string | No | Filter by symbol |

**Response Schema**:
```typescript
{
  positions: Array<{
    id: string;
    symbol: string;
    side: 'long' | 'short';
    amount: number;
    entryPrice: number;
    currentPrice: number;
    pnl: number;
    pnlPercent: number;
    stopLoss?: number;
    takeProfit?: number;
    openedAt: number;
    closedAt?: number;
    status: 'open' | 'closed';
    leverage?: number;
    margin?: number;
  }>;
}
```

**Example Request**:
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://opensvm.com/api/trading/positions?status=open"
```

---

### Get Market Data

Get real-time market data for a specific market.

**Endpoint**: `GET /api/trading/market-data`

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `market` | string | Yes | Market symbol (e.g., "SOL/USDC") |

**Response Schema**:
```typescript
{
  market: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  lastUpdate: number;
  orderBook?: {
    bids: Array<{ price: number; amount: number }>;
    asks: Array<{ price: number; amount: number }>;
  };
}
```

**Example Request**:
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://opensvm.com/api/trading/market-data?market=SOL/USDC"
```

---

## AI & Analysis APIs

### Get AI Answer

Get AI-generated answers to blockchain-related questions with optional execution planning.

**Endpoint**: `POST /api/getAnswer`

**Request Body**:
```typescript
{
  question: string;           // Required: Your question
  ownPlan?: boolean;          // Optional: Generate execution plan only (no execution)
  systemPrompt?: string;      // Optional: Custom system prompt for AI
}
```

**Response**: Plain text or XML (depending on `ownPlan` mode)

**Example Request**:
```bash
# Simple question
curl -X POST https://opensvm.com/api/getAnswer \
  -H "Content-Type: application/json" \
  -d '{"question":"What is the current price of SOL?"}'

# Generate execution plan
curl -X POST https://opensvm.com/api/getAnswer \
  -H "Content-Type: application/json" \
  -d '{
    "question":"Analyze the top 10 trending tokens on Solana",
    "ownPlan":true
  }'
```

**Response Headers**:
- `X-Processing-Time`: Processing time in milliseconds
- `X-Cache`: `HIT` or `MISS` (cached response indicator)
- `X-System-Health`: `HEALTHY` or `DEGRADED`
- `X-Response-Type`: `plan-only` (if ownPlan=true) or standard

---

### Analyze Transaction

Get AI-powered analysis of a transaction.

**Endpoint**: `POST /api/analyze-transaction`

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `signature` | string | Yes | Transaction signature |

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/analyze-transaction?signature=TRANSACTION_SIGNATURE"
```

---

### Get Transaction Explanation

Get natural language explanation of a transaction.

**Endpoint**: `GET /api/transaction/[signature]/explain`

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `level` | string | No | `simple` | Explanation level: `simple`, `detailed`, `technical` |
| `language` | string | No | `en` | Response language |
| `includeRisks` | boolean | No | `false` | Include risk analysis |

**Example Request**:
```bash
curl "https://opensvm.com/api/transaction/SIGNATURE/explain?level=detailed&includeRisks=true"
```

---

### Get Transaction Analysis

Get comprehensive transaction analysis.

**Endpoint**: `GET /api/transaction/[signature]/analysis`

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `includeInstructions` | boolean | No | `true` | Include instruction parsing |
| `includeAccountChanges` | boolean | No | `true` | Include account changes |
| `includeMetrics` | boolean | No | `true` | Include performance metrics |
| `detailed` | boolean | No | `false` | Include detailed analysis |

**Example Request**:
```bash
curl "https://opensvm.com/api/transaction/SIGNATURE/analysis?detailed=true"
```

---

### Find Related Transactions

Find transactions related to a given transaction.

**Endpoint**: `GET /api/transaction/[signature]/related`

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `maxResults` | number | No | `10` | Maximum results to return |
| `minScore` | number | No | `0.5` | Minimum relationship score (0-1) |
| `timeWindow` | number | No | `3600` | Time window in seconds |

**Example Request**:
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://opensvm.com/api/transaction/SIGNATURE/related?maxResults=20&minScore=0.7"
```

---

## Account APIs

### Get Account Statistics

Get comprehensive statistics for a Solana account.

**Endpoint**: `GET /api/account-stats/[address]`

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `address` | string | Yes | Solana account address (base58) |

**Response Schema**:
```typescript
{
  totalTransactions: string | number;
  tokenTransfers: number;
  lastUpdated: number;
}
```

**Example Request**:
```bash
curl "https://opensvm.com/api/account-stats/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
```

---

### Get Account Transactions

Get transaction history for an account.

**Endpoint**: `GET /api/account-transactions/[address]`

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | number | No | `100` | Max transactions to return (1-100) |
| `before` | string | No | - | Pagination cursor (signature) |
| `until` | string | No | - | End cursor |
| `classify` | boolean | No | `false` | Classify transaction types |
| `startDate` | string | No | - | Start date filter (ISO 8601) |
| `endDate` | string | No | - | End date filter (ISO 8601) |

**Example Request**:
```bash
# Get last 50 transactions
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://opensvm.com/api/account-transactions/ADDRESS?limit=50&classify=true"

# Paginate
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://opensvm.com/api/account-transactions/ADDRESS?limit=50&before=SIGNATURE"
```

---

### Get Account Transfers

Get transfer history for an account.

**Endpoint**: `GET /api/account-transfers/[address]`

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | number | No | `100` | Max transfers to return |
| `offset` | number | No | `0` | Pagination offset |
| `transferType` | string | No | - | Filter: `IN`, `OUT` |
| `solanaOnly` | boolean | No | `false` | Only SOL transfers |

**Response Schema**:
```typescript
{
  transfers: Array<{
    txId: string;
    date: string;
    from: string;
    to: string;
    tokenSymbol: string;
    tokenAmount: string;
    transferType: 'IN' | 'OUT';
  }>;
}
```

**Example Request**:
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://opensvm.com/api/account-transfers/ADDRESS?limit=50&transferType=IN"
```

---

### Get Account Portfolio

Get portfolio overview for an account.

**Endpoint**: `GET /api/account-portfolio/[address]`

**Example Request**:
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://opensvm.com/api/account-portfolio/ADDRESS"
```

---

### Get Account Token Statistics

Get token-specific statistics for an account.

**Endpoint**: `GET /api/account-token-stats/[address]/[mint]`

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `address` | string | Yes | Account address |
| `mint` | string | Yes | Token mint address |

**Example Request**:
```bash
curl "https://opensvm.com/api/account-token-stats/ACCOUNT_ADDRESS/TOKEN_MINT_ADDRESS"
```

---

### Check Account Type

Determine account type (wallet, program, token, etc.).

**Endpoint**: `GET /api/check-account-type`

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `address` | string | Yes | Account address to check |

**Example Request**:
```bash
curl "https://opensvm.com/api/check-account-type?address=ADDRESS"
```

---

## Blockchain Data APIs

### Get Block Information

Get block information by slot number.

**Endpoint**: `GET /api/blocks/[slot]`

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `slot` | number | Yes | Block slot number |

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `includeAnalytics` | boolean | No | `false` | Include block analytics |
| `includeTransactions` | boolean | No | `false` | Include transaction list |
| `includePrograms` | boolean | No | `false` | Include program usage |

**Example Request**:
```bash
curl "https://opensvm.com/api/blocks/123456789?includeAnalytics=true"
```

---

### Get Recent Blocks

List recent blocks with pagination.

**Endpoint**: `GET /api/blocks`

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | number | No | `20` | Number of blocks to return |
| `before` | number | No | - | Slot number for pagination |
| `validator` | string | No | - | Filter by validator |
| `sortBy` | string | No | `slot` | Sort field |
| `sortOrder` | string | No | `desc` | Sort order: `asc`, `desc` |

**Example Request**:
```bash
curl "https://opensvm.com/api/blocks?limit=10&sortBy=slot&sortOrder=desc"
```

---

### Get Block Statistics

Get block statistics and performance metrics.

**Endpoint**: `GET /api/blocks/stats`

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `lookbackSlots` | number | No | `100` | Number of slots to analyze (1-1000) |

**Example Request**:
```bash
curl "https://opensvm.com/api/blocks/stats?lookbackSlots=500"
```

---

### Get Slot Information

Get slot details with caching.

**Endpoint**: `GET /api/slots`

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | number | No | `20` | Number of slots to return |
| `fromSlot` | number | No | - | Starting slot number |

**Response Schema**:
```typescript
{
  slots: Array<{
    slot: number;
    blockTime: number | null;
    blockHeight: number;
    parentSlot: number;
    transactionCount: number;
    leader: string;
    skipRate: number;
    producedBy?: string;
    timestamp: number;
  }>;
  metrics: {
    averageBlockTime: number;
    skippedSlots: number;
    totalSlots: number;
    skipRate: number;
    slotsPerSecond: number;
    epochProgress: number;
  };
}
```

**Example Request**:
```bash
curl "https://opensvm.com/api/slots?limit=50"
```

---

## Transaction APIs

### Get Transaction

Get detailed transaction information by signature.

**Endpoint**: `GET /api/transaction/[signature]`

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `signature` | string | Yes | Transaction signature (base58, 87-88 chars) |

**Example Request**:
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
const ws = new WebSocket('wss://opensvm.com/api/trading/stream');

ws.onopen = () => {
  // Subscribe to markets
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'markets',
    symbols: ['SOL/USDC', 'BONK/USDC']
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Market update:', data);
};
```

**Message Types**:
- `subscribe` - Subscribe to channels
- `unsubscribe` - Unsubscribe from channels
- `ping` - Keep-alive ping
- `pong` - Keep-alive response

---

## Additional Endpoints

For a complete list of all 180+ endpoints, see the endpoint categories above. Each category contains multiple endpoints following similar patterns.

### Quick Reference by Category

**Account APIs** (7 endpoints)
- Portfolio, Stats, Token Stats, Transactions, Transfers, Type Check, Changes Analysis

**AI & Analysis APIs** (12 endpoints)
- Transaction Analysis, Chat, Questions, Explanations, Failure Analysis

**Analytics APIs** (11 endpoints)
- DeFi, DEX, Validators, Cross-chain, Social, Bots, Marketplaces

**Authentication APIs** (10 endpoints)
- Session, Verify, Logout, Wallet Binding, API Keys Management

**Blockchain Data APIs** (17 endpoints)
- Blocks, Transactions, Slots, Mempool, Transfers, Metrics

**Trading APIs** (8 endpoints)
- Markets, Pools, Execute, Positions, Trades, Stream, Chat

**Token APIs** (9 endpoints)
- Info, Metadata, Holders, Traders, Statistics, Gating

**NFT APIs** (4 endpoints)
- Collections, New, Trending, Details

**Social APIs** (20 endpoints)
- Profile, History, Follow, Like, Feed, Preferences, Notifications

**System APIs** (15+ endpoints)
- Health, Status, Metrics, Monitoring, Logging, Error Tracking

---

---

## Support & Resources

- **Documentation**: https://docs.opensvm.com
- **API Status**: https://status.opensvm.com
- **Discord**: https://discord.gg/opensvm
- **GitHub**: https://github.com/opensvm

---

## Changelog

### v1.0.0 (Current)
- Initial API release
- 180+ endpoints
- WebSocket support
- Real-time market data
- AI-powered analysis

---

*Last Updated: November 2024*
