# OpenSVM API Reference

## Table of Contents
1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Response Formats](#response-formats)
4. [Rate Limiting](#rate-limiting)
5. [API Endpoints](#api-endpoints)
6. [External Integrations](#external-integrations)
7. [Error Handling](#error-handling)
8. [Best Practices](#best-practices)

## Overview

OpenSVM provides a comprehensive REST API for interacting with Solana blockchain data, performing analytics, and leveraging AI-powered features. All API endpoints are accessible via HTTP/HTTPS.

### Base URLs
```
Development: http://localhost:3000/api
Production:  https://opensvm.com/api
```

### Content Type
All requests and responses use `application/json` format unless otherwise specified.

## Authentication

Most endpoints are publicly accessible. Protected endpoints require JWT authentication:

```javascript
// Example authentication header
{
  "Authorization": "Bearer YOUR_JWT_TOKEN"
}
```

## Response Formats

### Standard Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [],
  "pagination": {
    "total": 1000,
    "limit": 100,
    "offset": 0,
    "hasMore": true,
    "cursor": "next_page_cursor"
  }
}
```

## Rate Limiting

| Type | Limit | Window |
|------|-------|--------|
| Anonymous | 100 requests | 1 minute |
| Authenticated | 1000 requests | 1 minute |

Rate limit information is included in response headers:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Unix timestamp when limit resets

## API Endpoints

### 🔷 Blockchain Core

#### Transaction Operations

##### Get Transaction Details
```http
GET /api/transaction/{signature}
```

**Parameters:**
- `signature` (path, required): Transaction signature

**Response:**
```json
{
  "signature": "...",
  "slot": 123456789,
  "timestamp": 1234567890,
  "success": true,
  "fee": 5000,
  "instructions": [],
  "accounts": [],
  "logs": []
}
```

##### Batch Fetch Transactions
```http
POST /api/transaction/batch
```

**Request Body:**
```json
{
  "signatures": ["sig1", "sig2"],
  "includeDetails": true
}
```

##### Analyze Transaction
```http
GET /api/transaction/{signature}/analysis
POST /api/transaction/{signature}/analysis
```

**Response:**
```json
{
  "intent": "Token Transfer",
  "risk": "low",
  "patterns": [],
  "recommendations": []
}
```

##### Explain Transaction
```http
GET /api/transaction/{signature}/explain
```

**Query Parameters:**
- `language` (optional): Output language (default: "en")

**Response:**
```json
{
  "explanation": "This transaction transfers 100 SOL from wallet A to wallet B...",
  "summary": "SOL Transfer",
  "details": {}
}
```

#### Block Operations

##### Get Recent Blocks
```http
GET /api/blocks
```

**Query Parameters:**
- `limit` (optional, number): Number of blocks to return (default: 20, max: 100)
- `before` (optional, number): Slot number for pagination

**Example Request:**
```bash
curl -X GET "https://opensvm.com/api/blocks?limit=10"
```

##### Get Block Details
```http
GET /api/blocks/{slot}
```

**Parameters:**
- `slot` (path, required): Block slot number

**Response:**
```json
{
  "slot": 123456789,
  "blockhash": "...",
  "parentSlot": 123456788,
  "blockTime": 1234567890,
  "transactions": [],
  "rewards": [],
  "programs": []
}
```

##### Get Block Statistics
```http
GET /api/blocks/stats
```

**Query Parameters:**
- `lookbackSlots` (optional): Number of slots to analyze (1-1000, default: 100)

**Response:**
```json
{
  "averageTps": 1500,
  "successRate": 95.5,
  "averageBlockTime": 0.4,
  "totalTransactions": 150000,
  "totalVolume": 1000000,
  "topPrograms": []
}
```

#### Account Operations

##### Get Account Statistics
```http
GET /api/account-stats/{address}
```

**Parameters:**
- `address` (path, required): Solana account address

**Response:**
```json
{
  "address": "...",
  "balance": 1000000000,
  "transactionCount": 500,
  "firstSeen": "2024-01-01T00:00:00Z",
  "lastSeen": "2024-10-31T00:00:00Z",
  "tokens": [],
  "nfts": []
}
```

##### Get Account Transactions
```http
GET /api/account-transactions/{address}
```

**Parameters:**
- `address` (path, required): Account address

**Query Parameters:**
- `limit` (optional): Number of transactions (default: 100)
- `before` (optional): Cursor for pagination
- `type` (optional): Transaction type filter
- `startDate` (optional): ISO date string for date range start
- `endDate` (optional): ISO date string for date range end

**Example with Date Filtering:**
```bash
curl -X GET "https://opensvm.com/api/account-transactions/ADDRESS?startDate=2024-01-01T00:00:00Z&endDate=2024-12-31T23:59:59Z"
```

### 🎨 Token & NFT APIs

#### Token Metadata
```http
GET /api/token-metadata?mints=mint1,mint2,mint3
```

**Query Parameters:**
- `mints` (required): Comma-separated list of token mint addresses

**Response:**
```json
{
  "tokens": [
    {
      "mint": "...",
      "name": "Token Name",
      "symbol": "TKN",
      "decimals": 9,
      "supply": "1000000000",
      "logo": "https://..."
    }
  ]
}
```

#### NFT Collections
```http
GET /api/nft-collections
```

**Query Parameters:**
- `limit` (optional): Number of collections
- `sort` (optional): Sort by 'volume', 'floor', or 'items'

### 📊 Analytics APIs

#### DeFi Overview
```http
GET /api/analytics/overview
```

**Response:**
```json
{
  "tvl": 1000000000,
  "volume24h": 500000000,
  "activeUsers": 100000,
  "topProtocols": [],
  "trends": {}
}
```

#### DEX Analytics
```http
GET /api/analytics/dex
```

**Query Parameters:**
- `dex` (optional): Specific DEX name
- `timeframe` (optional): '1h', '24h', or '7d'

### 🤖 AI-Powered APIs

#### Ask Question
```http
POST /api/getAnswer
```

**Request Body:**
```json
{
  "question": "What is the current price of SOL?",
  "context": {}
}
```

**Response:**
```json
{
  "answer": "The current price of SOL is $150.00...",
  "sources": ["price-feed", "dex-data"],
  "confidence": 0.95
}
```

#### Analyze Transaction with AI
```http
POST /api/analyze-transaction
```

**Request Body:**
```json
{
  "signature": "transaction_signature",
  "options": {
    "includeRisk": true,
    "includePattern": true
  }
}
```

### 🔍 Search & Discovery

#### Universal Search
```http
GET /api/search?q=searchterm
```

**Query Parameters:**
- `q` (required): Search query
- `type` (optional): Filter by type (account, transaction, token, program)
- Additional filters as needed

### 📡 Real-Time Streaming

#### Server-Sent Events Feed
```http
GET /api/sse-feed
```

**Query Parameters:**
- `filter` (optional): JSON stringified filter object

**Example Connection:**
```javascript
const eventSource = new EventSource('/api/sse-feed');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('New transaction:', data);
};
```

## External Integrations

### Birdeye API Integration (Primary Market Data)

The platform uses Birdeye as the primary source for token market data with automatic 5-tier fallback. These methods are available through the AI plan execution system:

#### Market Data Methods:
- `tokenMarketData(mint)` - Comprehensive token data (price, market cap, volume, liquidity)
  - Auto-fallback: Birdeye → DexScreener → GeckoTerminal → RPC
  - Example: `tokenMarketData("DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263")`

- `birdeyeOHLCV(address, type, time_from, time_to)` - Candlestick/chart data
  - Types: 1m, 3m, 5m, 15m, 30m, 1H, 2H, 4H, 6H, 8H, 12H, 1D, 3D, 1W, 1M
  - Returns: OHLCV data with USD volume
  - Use for: Charts, technical analysis, price history

- `birdeyeOrderbook(address, offset)` - Market depth and order book
  - Requires: DEX market/pair address (not token mint)
  - Returns: Bids, asks, price levels

#### Blockchain Data Methods:
- `getTokenHolders(address)` - Top token holders and distribution
- `getPortfolio(address, includeNftMetadata)` - Full wallet portfolio
- `getTokenBalances(address)` - SPL token balances
- `getNFTsForAddress(address, params)` - NFTs owned by address
- `getNFTMetadata(address)` - NFT metadata
- `getSwapsByWalletAddress(address, params)` - DEX swaps by wallet
- `getSwapsByTokenAddress(address, params)` - DEX swaps for token
- `getSPLTokenTransfers(address, params)` - SPL token transfer history
- `getSOLTransfers(address, params)` - SOL transfer history
- `getTransactionsByAddress(address, params)` - Transaction history
- And many more...

### Solana RPC Methods

Direct Solana RPC access is available through:

```http
POST /api/solana-rpc
```

**Request Body:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "getBalance",
  "params": ["wallet_address"]
}
```

## Error Handling

### HTTP Status Codes

| Code | Description | Common Causes |
|------|-------------|---------------|
| 200 | Success | Request processed successfully |
| 400 | Bad Request | Invalid parameters or malformed request |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server-side error |
| 503 | Service Unavailable | Temporary service outage |

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "INVALID_ADDRESS",
    "message": "The provided address is not a valid Solana address",
    "details": {
      "address": "invalid_address_here",
      "validation": "Failed PublicKey validation"
    }
  }
}
```

## Best Practices

### 1. Implement Retry Logic
```javascript
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      if (response.status !== 429 && response.status < 500) throw new Error(`HTTP ${response.status}`);
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    } catch (error) {
      if (i === maxRetries - 1) throw error;
    }
  }
}
```

### 2. Handle Rate Limits
```javascript
async function rateLimitedFetch(url) {
  const response = await fetch(url);
  
  if (response.status === 429) {
    const retryAfter = response.headers.get('X-RateLimit-Reset');
    const waitTime = retryAfter ? (parseInt(retryAfter) * 1000 - Date.now()) : 60000;
    await new Promise(resolve => setTimeout(resolve, waitTime));
    return rateLimitedFetch(url);
  }
  
  return response;
}
```

### 3. Use Batch Endpoints
Instead of making multiple individual requests:
```javascript
// ❌ Inefficient
const tx1 = await fetch('/api/transaction/sig1');
const tx2 = await fetch('/api/transaction/sig2');
const tx3 = await fetch('/api/transaction/sig3');

// ✅ Efficient
const transactions = await fetch('/api/transaction/batch', {
  method: 'POST',
  body: JSON.stringify({
    signatures: ['sig1', 'sig2', 'sig3']
  })
});
```

### 4. Cache Responses
```javascript
const cache = new Map();
const CACHE_TTL = 60000; // 1 minute

async function cachedFetch(url) {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const response = await fetch(url);
  const data = await response.json();
  
  cache.set(url, { data, timestamp: Date.now() });
  return data;
}
```

### 5. Subscribe to Real-Time Updates
For live data, use SSE or WebSocket connections instead of polling:
```javascript
// Use SSE for real-time updates
const eventSource = new EventSource('/api/sse-feed');
eventSource.onmessage = handleUpdate;

// Instead of polling
// ❌ setInterval(() => fetch('/api/blocks'), 1000);
```

## Support & Resources

- **Documentation**: https://opensvm.com/docs
- **GitHub**: https://github.com/opensvm
- **Discord**: https://discord.gg/opensvm
- **API Status**: https://status.opensvm.com
- **Email Support**: api@opensvm.com

## Changelog

### Version 2.0.0 (Current)
- Added date range filtering for transaction endpoints
- Enhanced AI-powered analysis capabilities
- Integrated Birdeye API as primary market data source with 5-tier fallback
- Added OHLCV candlestick data and orderbook endpoints
- Added comprehensive block statistics endpoint

### Version 1.0.0
- Initial API release
- Core blockchain endpoints
- Basic analytics
