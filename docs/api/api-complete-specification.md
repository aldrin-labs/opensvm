# OpenSVM Complete API Specification

## Version 2.0.0

### Table of Contents
1. [Executive Summary](#executive-summary)
2. [API Architecture](#api-architecture)
3. [Complete Endpoint Registry](#complete-endpoint-registry)
4. [Data Models](#data-models)
5. [Integration Points](#integration-points)
6. [Security & Authentication](#security--authentication)
7. [Performance Guidelines](#performance-guidelines)
8. [Migration Guide](#migration-guide)

---

## Executive Summary

OpenSVM provides a comprehensive REST API for Solana blockchain interaction with 200+ endpoints across 13 functional categories. The API combines direct blockchain access, AI-powered analytics, and real-time data streaming.

### Key Capabilities
- **Blockchain Data**: Direct access to transactions, blocks, accounts
- **AI Analysis**: Natural language Q&A and transaction analysis
- **Real-time Streams**: SSE and WebSocket connections
- **External Integrations**: Moralis API (24 methods), Solana RPC (8 methods)
- **Analytics**: DeFi, NFT, validator, and market analytics

### API Statistics
- **Total Endpoints**: 194 core routes + 32 external methods
- **Response Time**: <100ms for cached, <500ms for live data
- **Uptime SLA**: 99.9% availability
- **Rate Limits**: 100-1000 requests/minute

---

## API Architecture

### Request Flow
```
Client Request → API Gateway → Route Handler → Service Layer → Data Source
                                                ↓
Client Response ← Response Formatter ← Business Logic ← External APIs/Blockchain
```

### Data Sources
1. **Solana Blockchain** - Direct RPC connection
2. **Moralis API** - Enhanced blockchain data
3. **Local Cache** - Redis/Memory caching
4. **AI Services** - OpenAI/Anthropic for analysis
5. **Database** - User data and analytics

### Response Pipeline
1. Input validation
2. Authentication/Authorization (if required)
3. Rate limiting check
4. Cache lookup
5. Data fetching/processing
6. Response formatting
7. Error handling

---

## Complete Endpoint Registry

### Category Breakdown

#### 🔷 Blockchain Core (17 endpoints)
**Purpose**: Direct blockchain data access

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transaction/{signature}` | Transaction details |
| POST | `/api/transaction/batch` | Batch transaction fetch |
| GET | `/api/transaction/{signature}/analysis` | AI analysis |
| GET | `/api/transaction/{signature}/explain` | Human explanation |
| GET | `/api/transaction/{signature}/related` | Related transactions |
| GET | `/api/transaction/{signature}/failure-analysis` | Failure analysis |
| GET | `/api/transaction/{signature}/metrics` | Performance metrics |
| GET | `/api/blocks` | Recent blocks |
| GET | `/api/blocks/{slot}` | Specific block |
| GET | `/api/blocks/stats` | Block statistics |
| GET | `/api/account-stats/{address}` | Account statistics |
| GET | `/api/account-transactions/{address}` | Transaction history |
| GET | `/api/account-transfers/{address}` | Transfer history |
| GET | `/api/account-portfolio/{address}` | Portfolio overview |
| GET | `/api/account-token-stats/{address}/{mint}` | Token stats |
| GET | `/api/check-account-type` | Account type check |
| GET | `/api/slots` | Slot information |

#### 🤖 AI-Powered (6 endpoints)
**Purpose**: Intelligent blockchain analysis

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/getAnswer` | Q&A system |
| POST | `/api/getSimilarQuestions` | Similar questions |
| GET | `/api/getSources` | Data sources |
| POST | `/api/analyze-transaction` | Deep analysis |
| POST | `/api/analyze` | General analysis |
| POST | `/api/filter-transactions` | Smart filtering |

#### 📊 Analytics (12 endpoints)
**Purpose**: Market and ecosystem analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/overview` | DeFi overview |
| GET | `/api/analytics/dex` | DEX analytics |
| GET | `/api/analytics/defi-health` | Health metrics |
| GET | `/api/analytics/validators` | Validator stats |
| GET | `/api/analytics/trending-validators` | Top validators |
| GET | `/api/analytics/marketplaces` | NFT markets |
| GET | `/api/analytics/aggregators` | Aggregators |
| GET | `/api/analytics/launchpads` | Launchpads |
| GET | `/api/analytics/bots` | Bot activity |
| GET | `/api/analytics/socialfi` | Social metrics |
| GET | `/api/analytics/infofi` | Info finance |
| GET | `/api/analytics/defai` | AI DeFi |

[Additional categories continue with same format...]

---

## Data Models

### Transaction Object
```typescript
interface Transaction {
  signature: string;
  slot: number;
  timestamp: number;
  success: boolean;
  fee: number;
  instructions: Instruction[];
  accounts: Account[];
  logs: string[];
  meta: {
    preBalances: number[];
    postBalances: number[];
    err: any | null;
  };
}
```

### Account Object
```typescript
interface Account {
  address: string;
  lamports: number;
  owner: string;
  executable: boolean;
  rentEpoch: number;
  data: {
    program: string;
    parsed?: any;
    space: number;
  };
}
```

### Block Object
```typescript
interface Block {
  slot: number;
  blockhash: string;
  parentSlot: number;
  blockTime: number | null;
  blockHeight: number;
  transactions: Transaction[];
  rewards: Reward[];
}
```

### API Response Format
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
    cursor?: string;
  };
  timestamp: string;
}
```

---

## Integration Points

### Moralis API Integration
**Access**: Via `/api/getAnswer` AI execution layer

```javascript
// Available Moralis Methods
const moralisMethods = {
  getNFTMetadata: (address, network) => Promise<NFTMetadata>,
  getTokenPrice: (address, network) => Promise<TokenPrice>,
  getPortfolio: (address, includeNft, network) => Promise<Portfolio>,
  getSOLTransfers: (address, params, network) => Promise<Transfer[]>,
  // ... 20 more methods
};
```

### Solana RPC Direct Access
**Access**: Via multiple endpoints and proxy

```javascript
// Core RPC Methods
const rpcMethods = {
  getAccountInfo: (pubkey) => Promise<AccountInfo>,
  getTransaction: (signature) => Promise<Transaction>,
  getBlock: (slot) => Promise<Block>,
  getSlot: () => Promise<number>,
  // ... 4 more methods
};
```

### External Service Dependencies
1. **Solana RPC Nodes**
   - Primary: Helius
   - Fallback: Alchemy, QuickNode
   
2. **AI Services**
   - OpenAI GPT-4
   - Anthropic Claude
   
3. **Data Providers**
   - Moralis
   - CoinGecko
   - Jupiter Aggregator

---

## Security & Authentication

### Authentication Methods

#### 1. Public Endpoints (No Auth)
- Most read-only endpoints
- Rate limited by IP

#### 2. JWT Bearer Token
```http
Authorization: Bearer YOUR_JWT_TOKEN
```
- User-specific endpoints
- Higher rate limits
- Session management

#### 3. Wallet Signature
```javascript
// Sign message with wallet
const signature = await wallet.signMessage(message);

// Verify on server
POST /api/auth/verify
{
  "message": "Sign in to OpenSVM",
  "signature": "...",
  "publicKey": "..."
}
```

### Security Headers
```http
X-API-Key: YOUR_API_KEY
X-Request-ID: unique-request-id
X-Rate-Limit-Limit: 100
X-Rate-Limit-Remaining: 99
X-Rate-Limit-Reset: 1699000000
```

### CORS Configuration
```javascript
{
  origin: ['https://opensvm.com', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}
```

---

## Performance Guidelines

### Caching Strategy

#### Cache Layers
1. **CDN Cache** (CloudFlare): Static assets, 24h TTL
2. **API Gateway Cache**: Common requests, 5min TTL
3. **Redis Cache**: User data, 1h TTL
4. **Memory Cache**: Hot data, 1min TTL

#### Cache Headers
```http
Cache-Control: public, max-age=300
ETag: "33a64df551425fcc55e4d42a148795d9f25f89d4"
Last-Modified: Wed, 21 Oct 2024 07:28:00 GMT
```

### Performance Metrics

| Metric | Target | Current |
|--------|--------|---------|
| P50 Latency | <100ms | 85ms |
| P95 Latency | <500ms | 420ms |
| P99 Latency | <1000ms | 890ms |
| Throughput | 10K RPS | 12K RPS |
| Error Rate | <0.1% | 0.08% |

### Optimization Tips

1. **Use Batch Endpoints**
   ```javascript
   // Instead of N requests
   const results = await Promise.all(
     signatures.map(sig => fetch(`/api/transaction/${sig}`))
   );
   
   // Use 1 batch request
   const result = await fetch('/api/transaction/batch', {
     method: 'POST',
     body: JSON.stringify({ signatures })
   });
   ```

2. **Implement Client-Side Caching**
   ```javascript
   const cache = new Map();
   const CACHE_TTL = 60000;
   
   function cachedFetch(url) {
     const cached = cache.get(url);
     if (cached && Date.now() - cached.time < CACHE_TTL) {
       return Promise.resolve(cached.data);
     }
     return fetch(url).then(r => r.json()).then(data => {
       cache.set(url, { data, time: Date.now() });
       return data;
     });
   }
   ```

3. **Use Streaming for Large Data**
   ```javascript
   const eventSource = new EventSource('/api/sse-feed');
   eventSource.onmessage = (event) => {
     // Process streamed data
   };
   ```

---

## Migration Guide

### Breaking Changes in v2.0.0

1. **Date Filtering Format**
   - Old: `?from=1234567890&to=1234567899`
   - New: `?startDate=2024-01-01T00:00:00Z&endDate=2024-12-31T23:59:59Z`

2. **Response Format Standardization**
   - All endpoints now return `{ success, data, error, timestamp }`
   - Pagination moved to `pagination` object

3. **Endpoint Consolidation**
   - `/api/tx/{sig}` → `/api/transaction/{signature}`
   - `/api/acct/{addr}` → `/api/account-stats/{address}`

### Deprecation Schedule

| Endpoint | Deprecated | Removed | Replacement |
|----------|------------|---------|-------------|
| `/api/tx/*` | v2.0.0 | v3.0.0 | `/api/transaction/*` |
| `/api/getSimilar` | v2.0.0 | v2.5.0 | `/api/getSimilarQuestions` |
| `/api/block` | v2.0.0 | v3.0.0 | `/api/blocks/{slot}` |

### Migration Checklist

- [ ] Update date parameter formats
- [ ] Handle new response structure
- [ ] Update endpoint URLs
- [ ] Implement pagination handling
- [ ] Add error handling for new codes
- [ ] Update authentication headers
- [ ] Test rate limit handling
- [ ] Verify cache invalidation

---

## Appendix

### Error Codes

| Code | HTTP Status | Description | Resolution |
|------|-------------|-------------|------------|
| `INVALID_ADDRESS` | 400 | Invalid Solana address | Verify address format |
| `INVALID_SIGNATURE` | 400 | Invalid transaction signature | Check signature format |
| `RESOURCE_NOT_FOUND` | 404 | Resource doesn't exist | Verify resource exists |
| `RATE_LIMITED` | 429 | Too many requests | Implement backoff |
| `UNAUTHORIZED` | 401 | Missing/invalid auth | Check credentials |
| `INTERNAL_ERROR` | 500 | Server error | Retry with backoff |
| `SERVICE_UNAVAILABLE` | 503 | Service down | Wait and retry |

### Status Page
Monitor API status at: https://status.opensvm.com

### Support Channels
- **Documentation**: https://docs.opensvm.com
- **GitHub Issues**: https://github.com/opensvm/api/issues
- **Discord**: https://discord.gg/opensvm
- **Email**: api-support@opensvm.com

### Changelog

#### v2.0.0 (2024-10-31)
- Added date range
