# OpenSVM API Complete Reference

Auto-generated documentation for all 193 API endpoints.

**Generated**: 2025-11-12T06:42:01.130Z

## Table of Contents

- [Account portfolio](#account-portfolio) (1 endpoint)
- [Account stats](#account-stats) (1 endpoint)
- [Account token stats](#account-token-stats) (1 endpoint)
- [Account transactions](#account-transactions) (1 endpoint)
- [Account transfers](#account-transfers) (1 endpoint)
- [Ai analyze transaction](#ai-analyze-transaction) (1 endpoint)
- [Ai response](#ai-response) (1 endpoint)
- [Alerts](#alerts) (1 endpoint)
- [Analytics](#analytics) (14 endpoints)
- [Analyze](#analyze) (1 endpoint)
- [Analyze account changes](#analyze-account-changes) (1 endpoint)
- [Analyze transaction](#analyze-transaction) (1 endpoint)
- [Anomaly](#anomaly) (3 endpoints)
- [Api keys](#api-keys) (1 endpoint)
- [Auth](#auth) (9 endpoints)
- [Bank](#bank) (4 endpoints)
- [Block](#block) (1 endpoint)
- [Blocks](#blocks) (3 endpoints)
- [Chart](#chart) (1 endpoint)
- [Chat](#chat) (2 endpoints)
- [Check account type](#check-account-type) (1 endpoint)
- [Check token](#check-token) (1 endpoint)
- [Config](#config) (1 endpoint)
- [Crash reporting](#crash-reporting) (1 endpoint)
- [Dex](#dex) (1 endpoint)
- [Docs](#docs) (2 endpoints)
- [Error report](#error-report) (1 endpoint)
- [Error tracking](#error-tracking) (1 endpoint)
- [Favicon](#favicon) (1 endpoint)
- [Feed](#feed) (1 endpoint)
- [Filter transactions](#filter-transactions) (1 endpoint)
- [Find related transactions](#find-related-transactions) (1 endpoint)
- [GetAnswer](#getanswer) (1 endpoint)
- [GetSimilarQuestions](#getsimilarquestions) (1 endpoint)
- [GetSources](#getsources) (1 endpoint)
- [Health](#health) (2 endpoints)
- [HoldersByInteraction](#holdersbyinteraction) (1 endpoint)
- [Instruction lookup](#instruction-lookup) (1 endpoint)
- [Launchpad](#launchpad) (14 endpoints)
- [Live stats](#live-stats) (1 endpoint)
- [Logging](#logging) (1 endpoint)
- [Market data](#market-data) (1 endpoint)
- [Mempool](#mempool) (1 endpoint)
- [Metrics](#metrics) (1 endpoint)
- [Monetization](#monetization) (3 endpoints)
- [Monitoring](#monitoring) (2 endpoints)
- [Nft collections](#nft-collections) (3 endpoints)
- [Nfts](#nfts) (1 endpoint)
- [Notifications](#notifications) (1 endpoint)
- [Og](#og) (2 endpoints)
- [Opensvm](#opensvm) (5 endpoints)
- [Program](#program) (1 endpoint)
- [Program accounts](#program-accounts) (1 endpoint)
- [Program discovery](#program-discovery) (1 endpoint)
- [Program metadata](#program-metadata) (1 endpoint)
- [Program registry](#program-registry) (2 endpoints)
- [Proxy](#proxy) (2 endpoints)
- [Qdrant](#qdrant) (1 endpoint)
- [Referrals](#referrals) (2 endpoints)
- [Scan](#scan) (1 endpoint)
- [Search](#search) (5 endpoints)
- [Search suggestions](#search-suggestions) (1 endpoint)
- [Share](#share) (5 endpoints)
- [Slots](#slots) (1 endpoint)
- [Solana proxy](#solana-proxy) (2 endpoints)
- [Solana rpc](#solana-rpc) (1 endpoint)
- [Sse alerts](#sse-alerts) (1 endpoint)
- [Sse events](#sse-events) (1 endpoint)
- [Sse feed](#sse-feed) (1 endpoint)
- [Status](#status) (1 endpoint)
- [Stream](#stream) (3 endpoints)
- [Test qdrant](#test-qdrant) (1 endpoint)
- [Test token balance](#test-token-balance) (1 endpoint)
- [Test transaction](#test-transaction) (1 endpoint)
- [Token](#token) (4 endpoints)
- [Token gating](#token-gating) (1 endpoint)
- [Token metadata](#token-metadata) (1 endpoint)
- [Token stats](#token-stats) (1 endpoint)
- [Trades](#trades) (1 endpoint)
- [Trading](#trading) (8 endpoints)
- [Transaction](#transaction) (9 endpoints)
- [Transaction metrics](#transaction-metrics) (2 endpoints)
- [Transfers](#transfers) (1 endpoint)
- [Usage stats](#usage-stats) (1 endpoint)
- [User feed](#user-feed) (1 endpoint)
- [User history](#user-history) (3 endpoints)
- [User profile](#user-profile) (2 endpoints)
- [User social](#user-social) (9 endpoints)
- [User tab preference](#user-tab-preference) (1 endpoint)
- [V1](#v1) (2 endpoints)
- [Validator](#validator) (1 endpoint)
- [Version](#version) (1 endpoint)
- [Wallet path finding](#wallet-path-finding) (1 endpoint)
- [Websocket info](#websocket-info) (1 endpoint)

---

## Account portfolio

### GET /api/account-portfolio/:address

**Methods**: GET

**Method Details**:
- **GET**: Rate limit configuration for portfolio data

**Authentication**: Required

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `address` | string | address identifier |

**Example Request**:
```bash
curl "https://opensvm.com/api/account-portfolio/{address}" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/account-portfolio/[address]/route.ts`

---

## Account stats

### GET /api/account-stats/:address

**Methods**: GET

**Method Details**:
- **GET**: 5 minutes

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `address` | string | address identifier |

**Type Definitions**:
```typescript
interface AccountStats {
totalTransactions: string | number;
  tokenTransfers: number;
  lastUpdated: number;
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/account-stats/{address}"
```

**Source**: `app/api/account-stats/[address]/route.ts`

---

## Account token stats

### GET /api/account-token-stats/:address/:mint

**Methods**: GET

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `address` | string | address identifier |
| `mint` | string | mint identifier |

**Example Request**:
```bash
curl "https://opensvm.com/api/account-token-stats/{address}/{mint}"
```

**Source**: `app/api/account-token-stats/[address]/[mint]/route.ts`

---

## Account transactions

### GET /api/account-transactions/:address

**Methods**: GET

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | limit parameter |
| `before` | boolean | before parameter |
| `until` | boolean | until parameter |
| `classify` | boolean | classify parameter |
| `includeInflow` | boolean | includeInflow parameter |
| `startDate` | string | New date range parameters |
| `endDate` | string | endDate parameter |

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `address` | string | address identifier |

**Example Request**:
```bash
curl "https://opensvm.com/api/account-transactions/{address}?limit=value&before=value&until=value&classify=value&includeInflow=value&startDate=value&endDate=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/account-transactions/[address]/route.ts`

---

## Account transfers

### GET /api/account-transfers/:address

**Methods**: GET

**Description**: Get transfer history for an address with comprehensive filtering and transaction type detection. Supports bidirectional visibility (sender + receiver), real token symbols from Metaplex, and DeFi program attribution.

**Method Details**:
- **GET**: Get transfer history for an address with comprehensive filtering and transaction type detection

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `beforeSignature` | string | (Optional) Pagination cursor - use the signature to continue from a specific transaction |
| `offset` | number | (Optional, default: 0) Pagination offset - number of transfers to skip |
| `limit` | number | (Optional, default: 50) Maximum number of transfers to return per request |
| `transferType` | string | (Optional, default: 'ALL') Filter by transfer direction - values: 'IN', 'OUT', 'ALL' |
| `solanaOnly` | boolean | (Optional, default: false) Show only native SOL transfers, excluding all SPL tokens |
| `txType` | string | (Optional) Filter by transaction type - comma-separated values: 'sol', 'spl', 'defi', 'nft', 'program', 'system', 'funding' |
| `mints` | string | (Optional) Filter by specific token mint addresses - comma-separated list to track specific tokens (e.g., 'Cpzvdx6pppc9TNArsGsqgShCsKC9NCCjA2gtzHvUpump' for SVMAI token) |
| `bypassCache` | boolean | (Optional, default: false) Bypass cache and fetch fresh data directly from RPC |

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `address` | string | (Required) Solana wallet address to fetch transfers for |

**Type Definitions**:
```typescript
type TransactionType = 'sol' | 'spl' | 'defi' | 'nft' | 'program' | 'system' | 'funding';

interface Transfer {
  txId: string;
  date: string;
  from: string;
  to: string;
  tokenSymbol: string;
  tokenAmount: string;
  transferType: 'IN' | 'OUT';
  mint: string; // Token mint address or "SOL" for native transfers
  txType: TransactionType; // Transaction category
  programId?: string; // Program ID for DeFi/complex transactions
}

interface AccountTransfersResponse {
  data: Transfer[];
  hasMore: boolean;
  total: number;
  originalTotal: number;
  nextPageSignature?: string;
  fromCache: boolean;
}
```

**Example Requests**:
```bash
# Basic request - get 50 most recent transfers
curl "https://opensvm.com/api/account-transfers/{address}" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Filter by transaction type - show only DeFi and SPL token transfers
curl "https://opensvm.com/api/account-transfers/{address}?txType=defi,spl&limit=20" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Track specific token by mint address (SVMAI example)
curl "https://opensvm.com/api/account-transfers/{address}?mints=Cpzvdx6pppc9TNArsGsqgShCsKC9NCCjA2gtzHvUpump&limit=100" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Complex filtering - DeFi transactions for specific tokens only
curl "https://opensvm.com/api/account-transfers/{address}?txType=defi&mints=So11111111111111111111111111111111111111112,EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Show only incoming SOL transfers, bypass cache
curl "https://opensvm.com/api/account-transfers/{address}?solanaOnly=true&transferType=IN&bypassCache=true" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/account-transfers/[address]/route.ts`

---

## Ai analyze transaction

### GET, POST /api/ai-analyze-transaction

**Methods**: GET, POST

**Method Details**:
- **GET**: Analyze the transaction

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `signature` | string | signature parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/ai-analyze-transaction?signature=value"
curl -X POST "https://opensvm.com/api/ai-analyze-transaction" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/ai-analyze-transaction/route.ts`

---

## Ai response

### POST /api/ai-response

**Methods**: POST

**Method Details**:
- **POST**: Function to extract potential sources from AI response

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/ai-response" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/ai-response/route.ts`

---

## Alerts

### GET /api/alerts

**Description**: Real-time alerts and warnings stream

**Methods**: GET

**Method Details**:
- **GET**: Real-time alerts and warnings stream

**Example Request**:
```bash
curl "https://opensvm.com/api/alerts"
```

**Source**: `app/api/alerts/route.ts`

---

## Analytics

### GET /api/analytics/aggregators

**Methods**: GET

**Method Details**:
- **GET**: Real Aggregator Analytics API

**Type Definitions**:
```typescript
interface AggregatorMetrics {
name: string;
  type: 'dex' | 'yield' | 'lending' | 'bridge' | 'multi';
  description: string;
  tvl: number;
  volume24h: number;
  trades24h: number;
  integrations: number;
  supportedProtocols: string[];
  website: string;
  likes: number;
  fees: number;
  slippage: number;
  gasOptimization: number;
  userExperience: number;
  marketShare: number;
  status: 'active' | 'inactive' | 'beta';
  launched: string;
  lastUpdate: number;
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/analytics/aggregators"
```

**Source**: `app/api/analytics/aggregators/route.ts`

---

### GET /api/analytics/bots

**Methods**: GET

**Method Details**:
- **GET**: Real Bot Analytics API for Telegram/Discord/Matrix bots

**Type Definitions**:
```typescript
interface BotMetrics {
name: string;
  platform: 'telegram' | 'discord' | 'matrix' | 'multi-platform';
  category: string;
  description: string;
  users: number;
  servers: number;
  features: string[];
  website: string;
  inviteLink?: string;
  likes: number;
  rating: number;
  isVerified: boolean;
  isPremium: boolean;
  pricing: 'free' | 'freemium' | 'paid';
  monthlyActiveUsers: number;
  uptime: number;
  responseTime: number;
  lastUpdate: number;
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/analytics/bots"
```

**Source**: `app/api/analytics/bots/route.ts`

---

### GET /api/analytics/cross-chain

**Methods**: GET

**Method Details**:
- **GET**: Real Cross-Chain Analytics API using external bridge data sources

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `bridge` | string | bridge parameter |

**Type Definitions**:
```typescript
interface BridgeData {
name: string;
  volume24h: number;
  volumeChange: number;
  totalVolume: number;
  supportedChains: string[];
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/analytics/cross-chain?bridge=value"
```

**Source**: `app/api/analytics/cross-chain/route.ts`

---

### GET /api/analytics/defai

**Methods**: GET

**Method Details**:
- **GET**: Real DeFAI Analytics API

**Type Definitions**:
```typescript
interface DeFAIMetrics {
name: string;
  category: 'trading' | 'analytics' | 'portfolio' | 'risk' | 'automation';
  description: string;
  activeUsers: number;
  totalUsers: number;
  volume24h: number;
  accuracy: number;
  performance: number;
  aum: number;
  website: string;
  likes: number;
  pricing: 'free' | 'freemium' | 'paid';
  features: string[];
  aiModel: string;
  marketShare: number;
  status: 'active' | 'inactive' | 'beta';
  launched: string;
  lastUpdate: number;
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/analytics/defai"
```

**Source**: `app/api/analytics/defai/route.ts`

---

### GET /api/analytics/defi-health

**Methods**: GET

**Method Details**:
- **GET**: Real DeFi Health API using external data sources

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `protocol` | string | protocol parameter |

**Type Definitions**:
```typescript
interface ProtocolData {
name: string;
  category: string;
  tvl: number;
  tvlChange24h: number;
  tvlChange7d: number;
  riskScore: number;
  healthScore: number;
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/analytics/defi-health?protocol=value"
```

**Source**: `app/api/analytics/defi-health/route.ts`

---

### GET /api/analytics/dex

**Methods**: GET

**Method Details**:
- **GET**: Fetch real price data from Jupiter API with:

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `dex` | string | dex parameter |

**Type Definitions**:
```typescript
interface DexMetrics {
name: string;
  volume24h: number;
  tvl: number;
  volumeChange: number;
  marketShare: number;
  activeUsers?: number;
  transactions?: number;
  avgTransactionSize?: number;
}

interface PriceData {
token: string;
  price: number;
  dex: string;
  timestamp: number;
}

interface ArbitrageOpportunity {
tokenPair: string;
  buyDex: string;
  sellDex: string;
  buyPrice: number;
  sellPrice: number;
  profitPercentage: number;
  profitUSD: number;
  volume: number;
  gasEstimate: number;
  netProfit: number;
  confidence: number;
}

interface JupiterCacheEntry {
data: PriceData[];
  ts: number;
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/analytics/dex?dex=value"
```

**Source**: `app/api/analytics/dex/route.ts`

---

### GET /api/analytics/infofi

**Methods**: GET

**Method Details**:
- **GET**: Real Info Fi Analytics API

**Type Definitions**:
```typescript
interface InfoFiMetrics {
name: string;
  category: 'analytics' | 'explorer' | 'portfolio' | 'data' | 'research';
  description: string;
  dailyUsers: number;
  totalUsers: number;
  apiCalls: number;
  accuracy: number;
  uptime: number;
  dataPoints: number;
  website: string;
  likes: number;
  pricing: 'free' | 'freemium' | 'paid';
  features: string[];
  marketShare: number;
  status: 'active' | 'inactive' | 'beta';
  launched: string;
  lastUpdate: number;
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/analytics/infofi"
```

**Source**: `app/api/analytics/infofi/route.ts`

---

### GET /api/analytics/launchpads

**Methods**: GET

**Method Details**:
- **GET**: Real Launchpad Analytics API using external APIs for real data

**Type Definitions**:
```typescript
interface LaunchpadMetrics {
name: string;
  platform: string;
  totalRaised: number;
  projectsLaunched: number;
  avgRoi: number;
  successRate: number;
  marketCap: number;
  website: string;
  description: string;
  likes: number;
  category: string;
  status: 'active' | 'inactive' | 'maintenance';
  launchDate: string;
  lastUpdate: number;
}

interface LaunchpadProject {
name: string;
  platform: string;
  raised: number;
  roi: number;
  status: 'completed' | 'active' | 'upcoming';
  launchDate: string;
  website: string;
  description: string;
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/analytics/launchpads"
```

**Source**: `app/api/analytics/launchpads/route.ts`

---

### GET /api/analytics/marketplaces

**Methods**: GET

**Method Details**:
- **GET**: Real Marketplace Analytics API

**Type Definitions**:
```typescript
interface MarketplaceMetrics {
name: string;
  type: 'nft' | 'token' | 'defi' | 'gaming' | 'multi';
  description: string;
  volume24h: number;
  trades24h: number;
  uniqueTraders: number;
  totalCollections: number;
  floorPrice: number;
  marketCap: number;
  website: string;
  likes: number;
  fees: number;
  royalties: number;
  userExperience: number;
  marketShare: number;
  status: 'active' | 'inactive' | 'beta';
  launched: string;
  lastUpdate: number;
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/analytics/marketplaces"
```

**Source**: `app/api/analytics/marketplaces/route.ts`

---

### GET /api/analytics/overview

**Methods**: GET

**Method Details**:
- **GET**: Comprehensive DeFi Overview API aggregating data from all DeFi sectors

**Type Definitions**:
```typescript
interface OverviewMetrics {
totalTvl: number;
  totalVolume24h: number;
  activeDexes: number;
  totalTransactions: number;
  topProtocols: Array<{
    name: string;
    tvl: number;
    volume24h: number;
    category: string;
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/analytics/overview"
```

**Source**: `app/api/analytics/overview/route.ts`

---

### GET /api/analytics/socialfi

**Methods**: GET

**Method Details**:
- **GET**: Real Social Fi Analytics API

**Type Definitions**:
```typescript
interface SocialFiMetrics {
name: string;
  category: 'social' | 'creator' | 'dao' | 'community' | 'messaging';
  description: string;
  activeUsers: number;
  totalUsers: number;
  postsDaily: number;
  engagement: number;
  tokenPrice: number;
  marketCap: number;
  website: string;
  likes: number;
  revenue: number;
  growth: number;
  features: string[];
  status: 'active' | 'inactive' | 'beta';
  launched: string;
  lastUpdate: number;
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/analytics/socialfi"
```

**Source**: `app/api/analytics/socialfi/route.ts`

---

### GET, POST /api/analytics/trending-validators

**Methods**: GET, POST

**Method Details**:
- **GET**: $SVMAI amount burned
- **POST**: $SVMAI amount burned

**Type Definitions**:
```typescript
interface TrendingValidator {
voteAccount: string;
  name: string;
  commission: number;
  activatedStake: number;
  depositVolume24h: number;
  boostEndTime?: number;
  boostAmount?: number;
  trendingScore: number;
  trendingReason: 'volume' | 'boost';
  rank: number;
}

interface BoostPurchase {
voteAccount: string;
  burnAmount: number; // $SVMAI amount burned
  totalBurned: number; // Total $SVMAI burned for this validator
  purchaseTime: number;
  burnSignature: string;
  burnerWallet: string;
  duration: number; // hours (always 24)
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/analytics/trending-validators"
curl -X POST "https://opensvm.com/api/analytics/trending-validators" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/analytics/trending-validators/route.ts`

---

### GET, POST, PATCH /api/analytics/user-interactions

**Methods**: GET, POST, PATCH

**Method Details**:
- **GET**: In a real implementation, this would:
- **PATCH**: In a real implementation, this would:

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | Parse query parameters |
| `limit` | number | limit parameter |
| `sessionId` | string | sessionId parameter |
| `heatmapType` | string | heatmapType parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/analytics/user-interactions?type=value&limit=value&sessionId=value&heatmapType=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
curl -X POST "https://opensvm.com/api/analytics/user-interactions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
curl -X PATCH "https://opensvm.com/api/analytics/user-interactions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/analytics/user-interactions/route.ts`

---

### GET /api/analytics/validators

**Methods**: GET

**Method Details**:
- **GET**: Extract IP address from TPU or RPC endpoint

**Type Definitions**:
```typescript
interface GeolocationData {
country: string;
  countryCode: string;
  region: string;
  city: string;
  datacenter?: string;
  isp?: string;
  lat?: number;
  lon?: number;
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/analytics/validators"
```

**Source**: `app/api/analytics/validators/route.ts`

---

## Analyze

### POST /api/analyze

**Methods**: POST

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/analyze" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/analyze/route.ts`

---

## Analyze account changes

### POST /api/analyze-account-changes

**Methods**: POST

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/analyze-account-changes" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/analyze-account-changes/route.ts`

---

## Analyze transaction

### GET, POST /api/analyze-transaction

**Methods**: GET, POST

**Method Details**:
- **GET**: Rate limiting map (in production, use Redis or similar)
- **POST**: Rate limiting map (in production, use Redis or similar)

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `signature` | string | signature parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/analyze-transaction?signature=value"
curl -X POST "https://opensvm.com/api/analyze-transaction" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/analyze-transaction/route.ts`

---

## Anomaly

### GET, POST /api/anomaly

**Methods**: GET, POST

**Method Details**:
- **GET**: Global anomaly detector instance
- **POST**: Global anomaly detector instance

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `action` | string | action parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/anomaly?action=value"
curl -X POST "https://opensvm.com/api/anomaly" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/anomaly/route.ts`

---

### GET /api/anomaly/related

**Methods**: GET

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `alertId` | string[] | alertId parameter |
| `accounts` | string[] | accounts parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/anomaly/related?alertId=value&accounts=value"
```

**Source**: `app/api/anomaly/related/route.ts`

---

### GET /api/anomaly/similar

**Methods**: GET

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `alertId` | string | alertId parameter |
| `type` | string | type parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/anomaly/similar?alertId=value&type=value"
```

**Source**: `app/api/anomaly/similar/route.ts`

---

## Api keys

### GET, POST /api/api-keys

**Description**: API key management

**Methods**: GET, POST

**Method Details**:
- **GET**: API key management
- **POST**: API key management

**Authentication**: Required

**Example Request**:
```bash
curl "https://opensvm.com/api/api-keys" \
  -H "Authorization: Bearer YOUR_API_KEY"
curl -X POST "https://opensvm.com/api/api-keys" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/api-keys/route.ts`

---

## Auth

### GET /api/auth/api-keys/activity

**Methods**: GET

**Method Details**:
- **GET**: GET /api/auth/api-keys/activity

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `apiKeyId` | string | apiKeyId parameter |
| `walletAddress` | string | walletAddress parameter |
| `signature` | string | signature parameter |
| `message` | string | message parameter |
| `limit` | string | limit parameter |
| `offset` | string | offset parameter |
| `startDate` | string | startDate parameter |
| `endDate` | string | endDate parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/auth/api-keys/activity?apiKeyId=value&walletAddress=value&signature=value&message=value&limit=value&offset=value&startDate=value&endDate=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/auth/api-keys/activity/route.ts`

---

### POST /api/auth/api-keys/create

**Description**: API endpoint to create a new API key

**Methods**: POST

**Method Details**:
- **POST**: API endpoint to create a new API key

**Authentication**: Required

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/auth/api-keys/create" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/auth/api-keys/create/route.ts`

---

### GET /api/auth/api-keys/list

**Methods**: GET

**Method Details**:
- **GET**: GET /api/auth/api-keys/list

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `walletAddress` | string | walletAddress parameter |
| `signature` | string | signature parameter |
| `message` | string | message parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/auth/api-keys/list?walletAddress=value&signature=value&message=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/auth/api-keys/list/route.ts`

---

### GET /api/auth/api-keys/metrics

**Methods**: GET

**Method Details**:
- **GET**: GET /api/auth/api-keys/metrics

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `apiKeyId` | string | apiKeyId parameter |
| `walletAddress` | string | walletAddress parameter |
| `signature` | string | signature parameter |
| `message` | string | message parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/auth/api-keys/metrics?apiKeyId=value&walletAddress=value&signature=value&message=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/auth/api-keys/metrics/route.ts`

---

### POST /api/auth/auth-link/create

**Description**: API endpoint to create an auth link for an existing API key

**Methods**: POST

**Method Details**:
- **POST**: API endpoint to create an auth link for an existing API key

**Authentication**: Required

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/auth/auth-link/create" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/auth/auth-link/create/route.ts`

---

### POST /api/auth/bind-wallet

**Description**: API endpoint to bind a wallet to an API key via auth link

**Methods**: POST

**Method Details**:
- **POST**: API endpoint to bind a wallet to an API key via auth link

**Authentication**: Required

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/auth/bind-wallet" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/auth/bind-wallet/route.ts`

---

### POST /api/auth/logout

**Description**: Logout endpoint

**Methods**: POST

**Method Details**:
- **POST**: Logout endpoint

**Authentication**: Required

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/auth/logout" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/auth/logout/route.ts`

---

### GET, POST /api/auth/session

**Description**: Session creation endpoint

**Methods**: GET, POST

**Method Details**:
- **GET**: Session creation endpoint
- **POST**: Session creation endpoint

**Authentication**: Required

**Example Request**:
```bash
curl "https://opensvm.com/api/auth/session" \
  -H "Authorization: Bearer YOUR_API_KEY"
curl -X POST "https://opensvm.com/api/auth/session" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/auth/session/route.ts`

---

### POST /api/auth/verify

**Description**: Signature verification endpoint

**Methods**: POST

**Method Details**:
- **POST**: Signature verification endpoint

**Authentication**: Required

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/auth/verify" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/auth/verify/route.ts`

---

## Bank

### GET /api/bank/wallets

**Methods**: GET

**Method Details**:
- **GET**: GET /api/bank/wallets

**Authentication**: Required

**Type Definitions**:
```typescript
interface StoredWallet {
id: string;
  userWallet: string;
  address: string;
  encryptedPrivateKey: string;
  name: string;
  createdAt: number;
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/bank/wallets" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/bank/wallets/route.ts`

---

### POST /api/bank/wallets/create

**Description**: Initialize bank wallets collection if it doesn't exist

**Methods**: POST

**Method Details**:
- **POST**: Initialize bank wallets collection if it doesn't exist

**Authentication**: Required

**Type Definitions**:
```typescript
interface CreateWalletRequest {
name?: string;
}

interface StoredWallet {
id: string;
  userWallet: string;
  address: string;
  encryptedPrivateKey: string;
  name: string;
  createdAt: number;
}

```

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/bank/wallets/create" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/bank/wallets/create/route.ts`

---

### POST /api/bank/wallets/refresh

**Description**: Get Solana connection

**Methods**: POST

**Method Details**:
- **POST**: Get Solana connection

**Authentication**: Required

**Type Definitions**:
```typescript
interface TokenBalance {
mint: string;
  amount: string;
  decimals: number;
  uiAmount: number;
  symbol?: string;
  name?: string;
}

interface WalletBalance {
id: string;
  address: string;
  name: string;
  balance: number;
  tokens: TokenBalance[];
  createdAt: number;
}

```

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/bank/wallets/refresh" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/bank/wallets/refresh/route.ts`

---

### POST /api/bank/wallets/simulate

**Methods**: POST

**Authentication**: Required

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/bank/wallets/simulate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/bank/wallets/simulate/route.ts`

---

## Block

### GET /api/block

**Methods**: GET

**Method Details**:
- **GET**: Legacy block API endpoint - redirects to new structure

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `slot` | string | slot parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/block?slot=value"
```

**Source**: `app/api/block/route.ts`

---

## Blocks

### GET /api/blocks

**Methods**: GET

**Method Details**:
- **GET**: Rate limiter for block list requests (200 requests per minute)

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | string | limit parameter |
| `before` | string | before parameter |
| `validator` | string | validator parameter |
| `includeAnalytics` | string | includeAnalytics parameter |
| `sortBy` | string | sortBy parameter |
| `sortOrder` | string | sortOrder parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/blocks?limit=value&before=value&validator=value&includeAnalytics=value&sortBy=value&sortOrder=value"
```

**Source**: `app/api/blocks/route.ts`

---

### GET /api/blocks/:slot

**Description**: Process block analytics based on request parameters

**Methods**: GET

**Method Details**:
- **GET**: Process block analytics based on request parameters

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `includeAnalytics` | string | includeAnalytics parameter |
| `includeTransactions` | string | includeTransactions parameter |
| `includePrograms` | string | includePrograms parameter |
| `includeAccounts` | string | includeAccounts parameter |
| `includeTransfers` | string | includeTransfers parameter |

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `slot` | string | slot identifier |

**Example Request**:
```bash
curl "https://opensvm.com/api/blocks/{slot}?includeAnalytics=value&includeTransactions=value&includePrograms=value&includeAccounts=value&includeTransfers=value"
```

**Source**: `app/api/blocks/[slot]/route.ts`

---

### GET /api/blocks/stats

**Methods**: GET

**Method Details**:
- **GET**: Rate limiter for block stats requests (500 requests per minute)

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `lookbackSlots` | number | lookbackSlots parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/blocks/stats?lookbackSlots=value"
```

**Source**: `app/api/blocks/stats/route.ts`

---

## Chart

### GET /api/chart

**Description**: Chart API - Clean alias for OHLCV candlestick data

**Methods**: GET

**Method Details**:
- **GET**: Chart API - Clean alias for OHLCV candlestick data

**Example Request**:
```bash
curl "https://opensvm.com/api/chart"
```

**Source**: `app/api/chart/route.ts`

---

## Chat

### POST /api/chat

**Methods**: POST

**Method Details**:
- **POST**: Mock responses for E2E testing

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `mock` | string | mock parameter |

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/chat/route.ts`

---

### GET, POST, DELETE /api/chat/global

**Methods**: GET, POST, DELETE

**Method Details**:
- **GET**: Removed @solana/web3.js import to avoid server runtime bundling issues that caused 500s
- **POST**: Removed @solana/web3.js import to avoid server runtime bundling issues that caused 500s
- **DELETE**: Removed @solana/web3.js import to avoid server runtime bundling issues that caused 500s

**Type Definitions**:
```typescript
interface GlobalMessage {
id: string;
  content: string;
  sender: string; // wallet address or "guest"
  timestamp: number;
  type: 'user' | 'system';
}

interface RateLimitEntry {
lastMessage: number;
  messageCount: number;
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/chat/global"
curl -X POST "https://opensvm.com/api/chat/global" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
curl -X DELETE "https://opensvm.com/api/chat/global"
```

**Source**: `app/api/chat/global/route.ts`

---

## Check account type

### GET /api/check-account-type

**Methods**: GET

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `address` | string | address parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/check-account-type?address=value"
```

**Source**: `app/api/check-account-type/route.ts`

---

## Check token

### GET /api/check-token

**Methods**: GET

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `address` | string | address parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/check-token?address=value"
```

**Source**: `app/api/check-token/route.ts`

---

## Config

### GET, POST /api/config

**Description**: Configuration endpoint

**Methods**: GET, POST

**Method Details**:
- **GET**: Configuration endpoint
- **POST**: Configuration endpoint

**Authentication**: Required

**Example Request**:
```bash
curl "https://opensvm.com/api/config" \
  -H "Authorization: Bearer YOUR_API_KEY"
curl -X POST "https://opensvm.com/api/config" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/config/route.ts`

---

## Crash reporting

### GET, POST, DELETE, PATCH /api/crash-reporting

**Methods**: GET, POST, DELETE, PATCH

**Method Details**:
- **GET**: In a real implementation, this would:
- **DELETE**: In a real implementation, this would:
- **PATCH**: In a real implementation, this would:

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | Parse query parameters |
| `severity` | number | severity parameter |
| `since` | number | since parameter |
| `limit` | number | limit parameter |
| `aggregated` | boolean | aggregated parameter |
| `crashId` | string | crashId parameter |
| `fingerprint` | string | fingerprint parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/crash-reporting?type=value&severity=value&since=value&limit=value&aggregated=value&crashId=value&fingerprint=value"
curl -X POST "https://opensvm.com/api/crash-reporting" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
curl -X DELETE "https://opensvm.com/api/crash-reporting"
curl -X PATCH "https://opensvm.com/api/crash-reporting" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/crash-reporting/route.ts`

---

## Dex

### GET /api/dex/:name

**Methods**: GET

**Method Details**:
- **GET**: DEX configurations with real program IDs and details - standardized lowercase names

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | name identifier |

**Type Definitions**:
```typescript
interface DexProfileData {
name: string;
  description: string;
  logo: string;
  website: string;
  twitter: string;
  telegram: string;
  github: string;
  programId: string;
  totalVolume: number;
  volume24h: number;
  volumeChange: number;
  tvl: number;
  tvlChange: number;
  marketShare: number;
  activeUsers: number;
  transactions: number;
  avgTransactionSize: number;
  fees24h: number;
  totalFees: number;
  commission: number;
  status: 'active' | 'inactive' | 'deprecated';
  security: {
    audited: boolean;
    auditors: string[];
    lastAudit: string;
    bugBounty: boolean;
    multisig: boolean;
    timelock: boolean;
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/dex/{name}"
```

**Source**: `app/api/dex/[name]/route.ts`

---

## Docs

### GET /api/docs/openapi

**Methods**: GET

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `format` | boolean | format parameter |
| `download` | boolean | download parameter |
| `scan` | string | Scan API routes if requested (development only) |

**Example Request**:
```bash
curl "https://opensvm.com/api/docs/openapi?format=value&download=value&scan=value"
```

**Source**: `app/api/docs/openapi/route.ts`

---

### GET /api/docs/page

**Methods**: GET

**Authentication**: Required

**Example Request**:
```bash
curl "https://opensvm.com/api/docs/page" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/docs/page/route.ts`

---

## Error report

### GET, POST /api/error-report

**Description**: Error reporting endpoint

**Methods**: GET, POST

**Method Details**:
- **GET**: Error reporting endpoint
- **POST**: Error reporting endpoint

**Authentication**: Required

**Example Request**:
```bash
curl "https://opensvm.com/api/error-report" \
  -H "Authorization: Bearer YOUR_API_KEY"
curl -X POST "https://opensvm.com/api/error-report" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/error-report/route.ts`

---

## Error tracking

### GET, POST, DELETE, PATCH /api/error-tracking

**Methods**: GET, POST, DELETE, PATCH

**Method Details**:
- **GET**: In a real implementation, this would:
- **DELETE**: In a real implementation, this would:
- **PATCH**: In a real implementation, this would:

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `severity` | string | Parse query parameters |
| `category` | number | category parameter |
| `component` | number | component parameter |
| `resolved` | number | resolved parameter |
| `since` | number | since parameter |
| `limit` | number | limit parameter |
| `stats` | number | stats parameter |
| `timeframe` | string | Default 24 hours |
| `type` | string | type parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/error-tracking?severity=value&category=value&component=value&resolved=value&since=value&limit=value&stats=value&timeframe=value&type=value"
curl -X POST "https://opensvm.com/api/error-tracking" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
curl -X DELETE "https://opensvm.com/api/error-tracking"
curl -X PATCH "https://opensvm.com/api/error-tracking" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/error-tracking/route.ts`

---

## Favicon

### GET /api/favicon

**Methods**: GET

**Example Request**:
```bash
curl "https://opensvm.com/api/favicon"
```

**Source**: `app/api/favicon/route.ts`

---

## Feed

### GET /api/feed/latest

**Description**: Real-time feed of latest blockchain activity

**Methods**: GET

**Method Details**:
- **GET**: Real-time feed of latest blockchain activity

**Example Request**:
```bash
curl "https://opensvm.com/api/feed/latest"
```

**Source**: `app/api/feed/latest/route.ts`

---

## Filter transactions

### POST /api/filter-transactions

**Methods**: POST

**Authentication**: Required

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/filter-transactions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/filter-transactions/route.ts`

---

## Find related transactions

### POST /api/find-related-transactions

**Methods**: POST

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/find-related-transactions" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/find-related-transactions/route.ts`

---

## GetAnswer

### POST /api/getAnswer

**Methods**: POST

**Description**: AI-powered question answering endpoint with support for custom system prompts and output length control. Provides blockchain data analysis, market insights, and general Solana knowledge.

**Method Details**:
- **POST**: Supports standard queries (uses internal Solana tools) or custom system prompts (pure LLM mode)

**Request Body**:
```typescript
{
  question: string;          // Required: The question to ask
  systemPrompt?: string;     // Optional: Custom system prompt (bypasses internal tools)
  maxTokens?: number;        // Optional: Max output tokens (1-32000, default: 32000)
  ownPlan?: boolean;         // Optional: Return execution plan instead of answer
  _healthCheck?: boolean;    // Internal: Health check flag
}
```

**Response**: Plain text or markdown answer

**Features**:
- **Standard Mode**: Uses Solana RPC knowledge base, CoinGecko API, and internal tools
- **Custom Prompt Mode**: Bypasses all tools, uses only your system prompt with LLM
- **Output Control**: Set `maxTokens` to limit response length (e.g., 50 for one sentence)
- **60-Minute Cache**: Identical queries cached for performance
- **Dynamic Timeouts**: 2-5 minutes based on query complexity
- **Circuit Breaker**: Automatic retry with exponential backoff

**Example Requests**:
```bash
# Standard blockchain query
curl -X POST "https://opensvm.com/api/getAnswer" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is the current price of SOL?"
  }'

# Custom creative response with pirate theme
curl -X POST "https://opensvm.com/api/getAnswer" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Explain DeFi on Solana",
    "systemPrompt": "You are a pirate captain. Use pirate slang and nautical metaphors.",
    "maxTokens": 500
  }'

# Short one-sentence answer
curl -X POST "https://opensvm.com/api/getAnswer" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is Solana?",
    "systemPrompt": "Answer in exactly one sentence.",
    "maxTokens": 50
  }'

# Get execution plan without running
curl -X POST "https://opensvm.com/api/getAnswer" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Analyze wallet holdings for 3 addresses",
    "ownPlan": true
  }'
```

**Source**: `app/api/getAnswer/route.ts`

---

## GetSimilarQuestions

### POST /api/getSimilarQuestions

**Methods**: POST

**Method Details**:
- **POST**: Check if required environment variables are present

**Authentication**: Required

**Type Definitions**:
```typescript
interface ChatCompletion {
choices: Array<{
    message: {
      content: string;
}

```

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/getSimilarQuestions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/getSimilarQuestions/route.ts`

---

## GetSources

### GET /api/getSources

**Methods**: GET

**Example Request**:
```bash
curl "https://opensvm.com/api/getSources"
```

**Source**: `app/api/getSources/route.ts`

---

## Health

### GET /api/health

**Description**: Health check endpoint with activity logging

**Methods**: GET

**Method Details**:
- **GET**: Health check endpoint with activity logging

**Authentication**: Required

**Example Request**:
```bash
curl "https://opensvm.com/api/health" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/health/route.ts`

---

### GET /api/health/anthropic

**Methods**: GET

**Method Details**:
- **GET**: GET /api/health/anthropic

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `backend` | string | backend parameter |
| `cache` | string | cache parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/health/anthropic?backend=value&cache=value"
```

**Source**: `app/api/health/anthropic/route.ts`

---

## HoldersByInteraction

### GET /api/holdersByInteraction

**Methods**: GET

**Method Details**:
- **GET**: Shared cache (5 minute TTL)

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `program` | string | Required parameter: program address |
| `period` | string | Optional parameters |
| `limit` | number | limit parameter |
| `offset` | number | offset parameter |
| `minInteractions` | number | minInteractions parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/holdersByInteraction?program=value&period=value&limit=value&offset=value&minInteractions=value"
```

**Source**: `app/api/holdersByInteraction/route.ts`

---

## Instruction lookup

### GET, POST /api/instruction-lookup

**Description**: GET /api/instruction-lookup

**Methods**: GET, POST

**Method Details**:
- **GET**: GET /api/instruction-lookup
- **POST**: GET /api/instruction-lookup

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `action` | string | action parameter |
| `programId` | string | programId parameter |
| `discriminator` | string | discriminator parameter |
| `instructionName` | string | instructionName parameter |
| `category` | string | category parameter |
| `riskLevel` | string | riskLevel parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/instruction-lookup?action=value&programId=value&discriminator=value&instructionName=value&category=value&riskLevel=value"
curl -X POST "https://opensvm.com/api/instruction-lookup" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/instruction-lookup/route.ts`

---

## Launchpad

### GET /api/launchpad/admin/referrers

**Description**: API Route: GET /api/launchpad/admin/referrers

**Methods**: GET

**Method Details**:
- **GET**: API Route: GET /api/launchpad/admin/referrers

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | status parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/launchpad/admin/referrers?status=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/launchpad/admin/referrers/route.ts`

---

### POST /api/launchpad/admin/referrers/:id/approve

**Description**: API Route: POST /api/launchpad/admin/referrers/[id]/approve

**Methods**: POST

**Method Details**:
- **POST**: API Route: POST /api/launchpad/admin/referrers/[id]/approve

**Authentication**: Required

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | id identifier |

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/launchpad/admin/referrers/{id}/approve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/launchpad/admin/referrers/[id]/approve/route.ts`

---

### POST /api/launchpad/admin/referrers/:id/reject

**Description**: API Route: POST /api/launchpad/admin/referrers/[id]/reject

**Methods**: POST

**Method Details**:
- **POST**: API Route: POST /api/launchpad/admin/referrers/[id]/reject

**Authentication**: Required

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | id identifier |

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/launchpad/admin/referrers/{id}/reject" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/launchpad/admin/referrers/[id]/reject/route.ts`

---

### GET /api/launchpad/contributions/:contribId

**Methods**: GET

**Method Details**:
- **GET**: GET /api/launchpad/contributions/:contribId - Get single contribution receipt

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `contribId` | string | contribId identifier |

**Example Request**:
```bash
curl "https://opensvm.com/api/launchpad/contributions/{contribId}"
```

**Source**: `app/api/launchpad/contributions/[contribId]/route.ts`

---

### GET /api/launchpad/kol/:kolId

**Description**: API Route: GET /api/launchpad/kol/[kolId]

**Methods**: GET

**Method Details**:
- **GET**: API Route: GET /api/launchpad/kol/[kolId]

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `kolId` | string | kolId identifier |

**Example Request**:
```bash
curl "https://opensvm.com/api/launchpad/kol/{kolId}"
```

**Source**: `app/api/launchpad/kol/[kolId]/route.ts`

---

### POST /api/launchpad/kol/:kolId/claim

**Methods**: POST

**Method Details**:
- **POST**: POST /api/launchpad/kol/:kolId/claim - Claim tokens

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `kolId` | string | kolId identifier |

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/launchpad/kol/{kolId}/claim" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/launchpad/kol/[kolId]/claim/route.ts`

---

### POST /api/launchpad/kol/apply

**Description**: API Route: POST /api/launchpad/kol/apply

**Methods**: POST

**Method Details**:
- **POST**: API Route: POST /api/launchpad/kol/apply

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/launchpad/kol/apply" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/launchpad/kol/apply/route.ts`

---

### GET /api/launchpad/referral-links/:code

**Description**: API Route: GET /api/launchpad/referral-links/[code]

**Methods**: GET

**Method Details**:
- **GET**: API Route: GET /api/launchpad/referral-links/[code]

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `code` | string | code identifier |

**Example Request**:
```bash
curl "https://opensvm.com/api/launchpad/referral-links/{code}"
```

**Source**: `app/api/launchpad/referral-links/[code]/route.ts`

---

### GET, POST /api/launchpad/reports/daily

**Methods**: GET, POST

**Method Details**:
- **GET**: POST /api/launchpad/reports/daily - Submit daily volume report
- **POST**: POST /api/launchpad/reports/daily - Submit daily volume report

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `sale_id` | string | sale_id parameter |
| `kol_id` | string | kol_id parameter |
| `date` | string | date parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/launchpad/reports/daily?sale_id=value&kol_id=value&date=value"
curl -X POST "https://opensvm.com/api/launchpad/reports/daily" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/launchpad/reports/daily/route.ts`

---

### GET, POST /api/launchpad/sales

**Description**: API Route: GET /api/launchpad/sales

**Methods**: GET, POST

**Method Details**:
- **GET**: API Route: GET /api/launchpad/sales
- **POST**: API Route: GET /api/launchpad/sales

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | status parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/launchpad/sales?status=value"
curl -X POST "https://opensvm.com/api/launchpad/sales" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/launchpad/sales/route.ts`

---

### GET /api/launchpad/sales/:saleId

**Description**: API Route: GET /api/launchpad/sales/[saleId]

**Methods**: GET

**Method Details**:
- **GET**: API Route: GET /api/launchpad/sales/[saleId]

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `saleId` | string | saleId identifier |

**Example Request**:
```bash
curl "https://opensvm.com/api/launchpad/sales/{saleId}"
```

**Source**: `app/api/launchpad/sales/[saleId]/route.ts`

---

### POST /api/launchpad/sales/:saleId/contribute

**Description**: API Route: POST /api/launchpad/sales/[saleId]/contribute

**Methods**: POST

**Method Details**:
- **POST**: API Route: POST /api/launchpad/sales/[saleId]/contribute

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `saleId` | string | saleId identifier |

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/launchpad/sales/{saleId}/contribute" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/launchpad/sales/[saleId]/contribute/route.ts`

---

### POST /api/launchpad/sales/:saleId/distribute_volume

**Methods**: POST

**Method Details**:
- **POST**: POST /api/launchpad/sales/:saleId/distribute_volume - Distribute volume rewards

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `saleId` | string | saleId identifier |

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/launchpad/sales/{saleId}/distribute_volume" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/launchpad/sales/[saleId]/distribute_volume/route.ts`

---

### POST /api/launchpad/sales/:saleId/referral-links

**Description**: API Route: POST /api/launchpad/sales/[saleId]/referral-links

**Methods**: POST

**Method Details**:
- **POST**: API Route: POST /api/launchpad/sales/[saleId]/referral-links

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `saleId` | string | saleId identifier |

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/launchpad/sales/{saleId}/referral-links" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/launchpad/sales/[saleId]/referral-links/route.ts`

---

## Live stats

### GET /api/live-stats

**Description**: Real-time blockchain statistics

**Methods**: GET

**Method Details**:
- **GET**: Real-time blockchain statistics

**Example Request**:
```bash
curl "https://opensvm.com/api/live-stats"
```

**Source**: `app/api/live-stats/route.ts`

---

## Logging

### GET, POST /api/logging

**Methods**: GET, POST

**Method Details**:
- **GET**: Handle both single log entries and batched logs

**Example Request**:
```bash
curl "https://opensvm.com/api/logging"
curl -X POST "https://opensvm.com/api/logging" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/logging/route.ts`

---

## Market data

### GET /api/market-data

**Methods**: GET

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `mint` | string | mint parameter |
| `endpoint` | string | endpoint parameter |
| `baseMint` | string | Optional: filter by base token |
| `poolAddress` | string | Optional: specific pool |
| `type` | string | type parameter |
| `time_to` | string | Support custom time ranges via query parameters |
| `time_from` | string | time_from parameter |
| `offset` | string | offset parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/market-data?mint=value&endpoint=value&baseMint=value&poolAddress=value&type=value&time_to=value&time_from=value&offset=value"
```

**Source**: `app/api/market-data/route.ts`

---

## Mempool

### GET /api/mempool

**Description**: Real-time mempool monitoring

**Methods**: GET

**Method Details**:
- **GET**: Real-time mempool monitoring

**Example Request**:
```bash
curl "https://opensvm.com/api/mempool"
```

**Source**: `app/api/mempool/route.ts`

---

## Metrics

### GET, POST /api/metrics

**Description**: System metrics and performance data

**Methods**: GET, POST

**Method Details**:
- **GET**: System metrics and performance data
- **POST**: System metrics and performance data

**Authentication**: Required

**Example Request**:
```bash
curl "https://opensvm.com/api/metrics" \
  -H "Authorization: Bearer YOUR_API_KEY"
curl -X POST "https://opensvm.com/api/metrics" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/metrics/route.ts`

---

## Monetization

### GET /api/monetization/balance

**Methods**: GET

**Authentication**: Required

**Example Request**:
```bash
curl "https://opensvm.com/api/monetization/balance" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/monetization/balance/route.ts`

---

### POST /api/monetization/consume

**Methods**: POST

**Authentication**: Required

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/monetization/consume" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/monetization/consume/route.ts`

---

### POST /api/monetization/earn

**Methods**: POST

**Authentication**: Required

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/monetization/earn" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/monetization/earn/route.ts`

---

## Monitoring

### GET, DELETE /api/monitoring/api

**Methods**: GET, DELETE

**Method Details**:
- **DELETE**: Parse query parameters

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `timeframe` | string | Default 1 hour |
| `endpoint` | string | Default 1 hour |
| `method` | number | method parameter |
| `limit` | number | limit parameter |
| `type` | string | type parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/monitoring/api?timeframe=value&endpoint=value&method=value&limit=value&type=value"
curl -X DELETE "https://opensvm.com/api/monitoring/api"
```

**Source**: `app/api/monitoring/api/route.ts`

---

### GET, POST, DELETE /api/monitoring/requests

**Methods**: GET, POST, DELETE

**Method Details**:
- **POST**: Parse query parameters
- **DELETE**: Parse query parameters

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | string | Parse query parameters |
| `since` | number | since parameter |
| `method` | number | method parameter |
| `status` | number | status parameter |
| `path` | boolean | path parameter |
| `userId` | number | userId parameter |
| `sessionId` | number | sessionId parameter |
| `completedOnly` | number | completedOnly parameter |
| `stats` | number | stats parameter |
| `timeframe` | string | Default 1 hour |

**Example Request**:
```bash
curl "https://opensvm.com/api/monitoring/requests?limit=value&since=value&method=value&status=value&path=value&userId=value&sessionId=value&completedOnly=value&stats=value&timeframe=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
curl -X POST "https://opensvm.com/api/monitoring/requests" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
curl -X DELETE "https://opensvm.com/api/monitoring/requests" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/monitoring/requests/route.ts`

---

## Nft collections

### GET /api/nft-collections

**Methods**: GET

**Example Request**:
```bash
curl "https://opensvm.com/api/nft-collections"
```

**Source**: `app/api/nft-collections/route.ts`

---

### GET /api/nft-collections/new

**Methods**: GET

**Example Request**:
```bash
curl "https://opensvm.com/api/nft-collections/new"
```

**Source**: `app/api/nft-collections/new/route.ts`

---

### GET /api/nft-collections/trending

**Methods**: GET

**Example Request**:
```bash
curl "https://opensvm.com/api/nft-collections/trending"
```

**Source**: `app/api/nft-collections/trending/route.ts`

---

## Nfts

### GET /api/nfts/collections

**Methods**: GET

**Method Details**:
- **GET**: Type definitions

**Authentication**: Required

**Type Definitions**:
```typescript
interface NFTCollection {
address: string;
  name: string;
  symbol: string;
  uri: string;
}

interface NFTMetadata {
image?: string;
  description?: string;
  external_url?: string;
}

interface NFTCollectionWithMetadata {
address: string;
  name: string;
  symbol: string;
  image: string;
  description?: string;
  external_url?: string;
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/nfts/collections" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/nfts/collections/route.ts`

---

## Notifications

### GET /api/notifications

**Description**: Real-time notifications stream

**Methods**: GET

**Method Details**:
- **GET**: Real-time notifications stream

**Example Request**:
```bash
curl "https://opensvm.com/api/notifications"
```

**Source**: `app/api/notifications/route.ts`

---

## Og

### GET /api/og

**Methods**: GET

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `title` | string | Dynamic params |
| `description` | string | description parameter |
| `type` | string | type parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/og?title=value&description=value&type=value"
```

**Source**: `app/api/og/route.tsx`

---

### GET /api/og/:entityType/:entityId

**Description**: OG Image Generation API

**Methods**: GET

**Method Details**:
- **GET**: OG Image Generation API

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `entityType` | string | entityType identifier |
| `entityId` | string | entityId identifier |

**Type Definitions**:
```typescript
interface Params {
entityType: string;
  entityId: string;
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/og/{entityType}/{entityId}"
```

**Source**: `app/api/og/[entityType]/[entityId]/route.tsx`

---

## Opensvm

### GET, POST, DELETE /api/opensvm/anthropic-keys

**Methods**: GET, POST, DELETE

**Method Details**:
- **GET**: Enhanced user authentication with session and JWT support
- **POST**: Enhanced user authentication with session and JWT support
- **DELETE**: Enhanced user authentication with session and JWT support

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `keyId` | string | keyId parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/opensvm/anthropic-keys?keyId=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
curl -X POST "https://opensvm.com/api/opensvm/anthropic-keys" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
curl -X DELETE "https://opensvm.com/api/opensvm/anthropic-keys" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/opensvm/anthropic-keys/route.ts`

---

### GET, DELETE /api/opensvm/anthropic-keys/:keyId

**Description**: Extract user ID from request with proper JWT validation

**Methods**: GET, DELETE

**Method Details**:
- **GET**: Extract user ID from request with proper JWT validation
- **DELETE**: Extract user ID from request with proper JWT validation

**Authentication**: Required

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `keyId` | string | keyId identifier |

**Example Request**:
```bash
curl "https://opensvm.com/api/opensvm/anthropic-keys/{keyId}" \
  -H "Authorization: Bearer YOUR_API_KEY"
curl -X DELETE "https://opensvm.com/api/opensvm/anthropic-keys/{keyId}" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/opensvm/anthropic-keys/[keyId]/route.ts`

---

### GET /api/opensvm/anthropic-keys/stats

**Methods**: GET

**Method Details**:
- **GET**: GET /api/opensvm/anthropic-keys/stats

**Authentication**: Required

**Example Request**:
```bash
curl "https://opensvm.com/api/opensvm/anthropic-keys/stats" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/opensvm/anthropic-keys/stats/route.ts`

---

### GET /api/opensvm/balance

**Methods**: GET

**Method Details**:
- **GET**: Enhanced user authentication with JWT support

**Authentication**: Required

**Example Request**:
```bash
curl "https://opensvm.com/api/opensvm/balance" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/opensvm/balance/route.ts`

---

### GET /api/opensvm/usage

**Methods**: GET

**Method Details**:
- **GET**: Enhanced user authentication with JWT support

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `period` | string | period parameter |
| `keyId` | string | keyId parameter |
| `model` | string | model parameter |
| `startDate` | string | startDate parameter |
| `endDate` | string | endDate parameter |
| `minCost` | string | minCost parameter |
| `maxCost` | string | maxCost parameter |
| `minTokens` | string | minTokens parameter |
| `maxTokens` | number | maxTokens parameter |
| `status` | number | status parameter |
| `sortBy` | number | sortBy parameter |
| `sortOrder` | number | sortOrder parameter |
| `limit` | number | limit parameter |
| `offset` | number | offset parameter |
| `groupBy` | boolean | groupBy parameter |
| `includeMetadata` | boolean | includeMetadata parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/opensvm/usage?period=value&keyId=value&model=value&startDate=value&endDate=value&minCost=value&maxCost=value&minTokens=value&maxTokens=value&status=value&sortBy=value&sortOrder=value&limit=value&offset=value&groupBy=value&includeMetadata=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/opensvm/usage/route.ts`

---

## Program

### GET /api/program/:address

**Methods**: GET

**Method Details**:
- **GET**: @ts-nocheck

**Authentication**: Required

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `address` | string | address identifier |

**Example Request**:
```bash
curl "https://opensvm.com/api/program/{address}" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/program/[address]/route.ts`

---

## Program accounts

### GET, POST /api/program-accounts

**Description**: Generate PDA (Program Derived Address)

**Methods**: GET, POST

**Method Details**:
- **GET**: Generate PDA (Program Derived Address)
- **POST**: Generate PDA (Program Derived Address)

**Type Definitions**:
```typescript
interface ProgramAccountSearchRequest {
programId: string;
  searchType: 'all' | 'filtered' | 'pda';
  filters?: {
    hasBalance?: boolean;
    minBalance?: number;
    hasData?: boolean;
    minDataSize?: number;
    isExecutable?: boolean;
}

interface AccountInfo {
address: string;
  balance: number;
  dataSize: number;
  executable: boolean;
  owner: string;
  rentEpoch: number | null;
  data?: string;
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/program-accounts"
curl -X POST "https://opensvm.com/api/program-accounts" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/program-accounts/route.ts`

---

## Program discovery

### GET, POST /api/program-discovery

**Description**: GET /api/program-discovery

**Methods**: GET, POST

**Method Details**:
- **GET**: GET /api/program-discovery
- **POST**: GET /api/program-discovery

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `action` | number | action parameter |
| `programId` | number | programId parameter |
| `query` | number | query parameter |
| `status` | number | status parameter |
| `limit` | number | limit parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/program-discovery?action=value&programId=value&query=value&status=value&limit=value"
curl -X POST "https://opensvm.com/api/program-discovery" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/program-discovery/route.ts`

---

## Program metadata

### GET, POST /api/program-metadata

**Methods**: GET, POST

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `programId` | string | programId parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/program-metadata?programId=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
curl -X POST "https://opensvm.com/api/program-metadata" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/program-metadata/route.ts`

---

## Program registry

### GET, POST /api/program-registry

**Description**: GET /api/program-registry

**Methods**: GET, POST

**Method Details**:
- **GET**: GET /api/program-registry
- **POST**: GET /api/program-registry

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `action` | string | action parameter |
| `programId` | string | programId parameter |
| `category` | string | category parameter |
| `riskLevel` | string | riskLevel parameter |
| `instructionType` | string | instructionType parameter |
| `query` | string | query parameter |
| `similar` | string | similar parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/program-registry?action=value&programId=value&category=value&riskLevel=value&instructionType=value&query=value&similar=value"
curl -X POST "https://opensvm.com/api/program-registry" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/program-registry/route.ts`

---

### GET, POST /api/program-registry/:programId

**Description**: GET /api/program-registry/[programId]

**Methods**: GET, POST

**Method Details**:
- **GET**: GET /api/program-registry/[programId]
- **POST**: GET /api/program-registry/[programId]

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `include` | string[] | include parameter |
| `instruction` | string | instruction parameter |

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `programId` | string | programId identifier |

**Example Request**:
```bash
curl "https://opensvm.com/api/program-registry/{programId}?include=value&instruction=value"
curl -X POST "https://opensvm.com/api/program-registry/{programId}" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/program-registry/[programId]/route.ts`

---

## Proxy

### POST /api/proxy/rpc

**Methods**: POST

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `cluster` | string | cluster parameter |

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/proxy/rpc" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/proxy/rpc/route.ts`

---

### POST /api/proxy/rpc/:id

**Methods**: POST

**Method Details**:
- **POST**: Next.js 15.1.7 App Router route handler with correct type signature

**Authentication**: Required

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | id identifier |

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/proxy/rpc/{id}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/proxy/rpc/[id]/route.ts`

---

## Qdrant

### GET /api/qdrant/init

**Methods**: GET

**Example Request**:
```bash
curl "https://opensvm.com/api/qdrant/init"
```

**Source**: `app/api/qdrant/init/route.ts`

---

## Referrals

### GET /api/referrals/balance

**Description**: API endpoint for getting a user's token balance

**Methods**: GET

**Method Details**:
- **GET**: API endpoint for getting a user's token balance

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `walletAddress` | string | walletAddress parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/referrals/balance?walletAddress=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/referrals/balance/route.ts`

---

### POST /api/referrals/claim

**Description**: API endpoint for claiming referral rewards

**Methods**: POST

**Method Details**:
- **POST**: API endpoint for claiming referral rewards

**Authentication**: Required

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/referrals/claim" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/referrals/claim/route.ts`

---

## Scan

### GET /api/scan

**Methods**: GET

**Method Details**:
- **GET**: Simple list of sample launchpads to mock aggregate data from

**Type Definitions**:
```typescript
interface MemecoinInfo {
id: string;
    name: string;
    symbol: string;
    launchpad: string;
    priceUsd: number;
    marketCapUsd: number;
    liquidityUsd: number;
    volume24hUsd: number;
    ageMinutes: number;
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/scan"
```

**Source**: `app/api/scan/route.ts`

---

## Search

### GET /api/search

**Methods**: GET

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | q parameter |
| `start` | string | start parameter |
| `end` | string | end parameter |
| `type` | string | type parameter |
| `status` | string | status parameter |
| `min` | string | min parameter |
| `max` | string | max parameter |

**Type Definitions**:
```typescript
interface SearchResult {
address: string;
  signature?: string;
  timestamp?: string | null;
  type: 'account' | 'transaction' | 'token' | 'program';
  status?: 'success' | 'failed';
  amount?: number;
  balance?: number | null;
  symbol?: string;
  name?: string;
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/search?q=value&start=value&end=value&type=value&status=value&min=value&max=value"
```

**Source**: `app/api/search/route.ts`

---

### GET /api/search/accounts

**Methods**: GET

**Method Details**:
- **GET**: Rate limit configuration for account search

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | q parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/search/accounts?q=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/search/accounts/route.ts`

---

### GET /api/search/filtered

**Methods**: GET

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | q parameter |
| `start` | string | start parameter |
| `end` | string | end parameter |
| `type` | string | type parameter |
| `status` | string | status parameter |
| `min` | string | min parameter |
| `max` | string | max parameter |

**Type Definitions**:
```typescript
interface TransactionResult {
address: string;
  signature: string;
  timestamp: string | null;
  type: 'success' | 'failed';
  status: 'success' | 'failed';
  amount: number;
  balance: number | null;
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/search/filtered?q=value&start=value&end=value&type=value&status=value&min=value&max=value"
```

**Source**: `app/api/search/filtered/route.ts`

---

### GET /api/search/suggestions

**Methods**: GET

**Method Details**:
- **GET**: Lightweight base58 check (characters only)

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | q parameter |
| `networks` | string[] | networks parameter |
| `userId` | string | Optional user ID for personalization |

**Example Request**:
```bash
curl "https://opensvm.com/api/search/suggestions?q=value&networks=value&userId=value"
```

**Source**: `app/api/search/suggestions/route.ts`

---

### GET /api/search/suggestions/empty-state

**Description**: Get live token data for latest items section from Qdrant

**Methods**: GET

**Method Details**:
- **GET**: Get live token data for latest items section from Qdrant

**Example Request**:
```bash
curl "https://opensvm.com/api/search/suggestions/empty-state"
```

**Source**: `app/api/search/suggestions/empty-state/route.ts`

---

## Search suggestions

### GET /api/search-suggestions

**Methods**: GET

**Method Details**:
- **GET**: Common Solana-related search suggestions

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | q parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/search-suggestions?q=value"
```

**Source**: `app/api/search-suggestions/route.ts`

---

## Share

### GET /api/share/:shareCode

**Description**: Share Data API

**Methods**: GET

**Method Details**:
- **GET**: Share Data API

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `shareCode` | string | shareCode identifier |

**Example Request**:
```bash
curl "https://opensvm.com/api/share/{shareCode}"
```

**Source**: `app/api/share/[shareCode]/route.ts`

---

### POST /api/share/click/:shareCode

**Description**: Share Click Tracking API

**Methods**: POST

**Method Details**:
- **POST**: Share Click Tracking API

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `shareCode` | string | shareCode identifier |

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/share/click/{shareCode}" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/share/click/[shareCode]/route.ts`

---

### POST /api/share/conversion

**Description**: Share Conversion Tracking API

**Methods**: POST

**Method Details**:
- **POST**: Share Conversion Tracking API

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/share/conversion" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/share/conversion/route.ts`

---

### POST /api/share/generate

**Description**: Fetch entity data based on type

**Methods**: POST

**Method Details**:
- **POST**: Share Generation API

**Authentication**: Required

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/share/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/share/generate/route.ts`

---

### GET /api/share/stats/:walletAddress

**Description**: Share Statistics API

**Methods**: GET

**Method Details**:
- **GET**: Share Statistics API

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `walletAddress` | string | walletAddress identifier |

**Example Request**:
```bash
curl "https://opensvm.com/api/share/stats/{walletAddress}"
```

**Source**: `app/api/share/stats/[walletAddress]/route.ts`

---

## Slots

### GET /api/slots

**Description**: Fetch slot details with caching

**Methods**: GET

**Method Details**:
- **GET**: Fetch slot details with caching

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | string | Reduced default limit for better performance |
| `fromSlot` | number | fromSlot parameter |

**Type Definitions**:
```typescript
interface SlotInfo {
slot: number;
    blockTime: number | null;
    blockHeight: number;
    parentSlot: number;
    transactionCount: number;
    leader: string;
    skipRate: number;
    producedBy?: string;
    timestamp: number;
}

interface SlotMetrics {
averageBlockTime: number;
    skippedSlots: number;
    totalSlots: number;
    skipRate: number;
    slotsPerSecond: number;
    epochProgress: number;
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/slots?limit=value&fromSlot=value"
```

**Source**: `app/api/slots/route.ts`

---

## Solana proxy

### GET, POST /api/solana-proxy

**Methods**: GET, POST

**Method Details**:
- **POST**: Try multiple RPC endpoints with rate limits

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `transaction` | string | transaction parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/solana-proxy?transaction=value"
curl -X POST "https://opensvm.com/api/solana-proxy" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/solana-proxy/route.ts`

---

### GET /api/solana-proxy/:transaction

**Methods**: GET

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `transaction` | string | transaction identifier |

**Example Request**:
```bash
curl "https://opensvm.com/api/solana-proxy/{transaction}"
```

**Source**: `app/api/solana-proxy/[transaction]/route.ts`

---

## Solana rpc

### POST /api/solana-rpc

**Description**: Solana RPC proxy API endpoint

**Methods**: POST

**Method Details**:
- **POST**: Solana RPC proxy API endpoint

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/solana-rpc" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/solana-rpc/route.ts`

---

## Sse alerts

### GET, DELETE /api/sse-alerts

**Methods**: GET, DELETE

**Method Details**:
- **GET**: Start SSE cleanup on module load
- **DELETE**: Start SSE cleanup on module load

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `clientId` | string | clientId parameter |
| `action` | string | action parameter |
| `eventTypes` | string | Get event types from query params, no default - require explicit specification |

**Example Request**:
```bash
curl "https://opensvm.com/api/sse-alerts?clientId=value&action=value&eventTypes=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
curl -X DELETE "https://opensvm.com/api/sse-alerts" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/sse-alerts/route.ts`

---

## Sse events

### GET /api/sse-events/feed

**Description**: Server-Sent Events (SSE) endpoint for real-time feed updates

**Methods**: GET

**Method Details**:
- **GET**: Server-Sent Events (SSE) endpoint for real-time feed updates

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `walletAddress` | string | walletAddress parameter |
| `type` | string | type parameter |

**Type Definitions**:
```typescript
interface SSEConnection {
id: string;
  controller: ReadableStreamDefaultController;
  walletAddress: string;
  feedType: string;
  isActive: boolean;
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/sse-events/feed?walletAddress=value&type=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/sse-events/feed/route.ts`

---

## Sse feed

### GET, DELETE /api/sse-feed

**Methods**: GET, DELETE

**Method Details**:
- **GET**: Start SSE cleanup on module load
- **DELETE**: Start SSE cleanup on module load

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `clientId` | string | clientId parameter |
| `action` | string | action parameter |
| `feedType` | string | feedType parameter |
| `walletAddress` | string | walletAddress parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/sse-feed?clientId=value&action=value&feedType=value&walletAddress=value"
curl -X DELETE "https://opensvm.com/api/sse-feed"
```

**Source**: `app/api/sse-feed/route.ts`

---

## Status

### GET, POST /api/status

**Description**: System status

**Methods**: GET, POST

**Method Details**:
- **GET**: System status
- **POST**: System status

**Authentication**: Required

**Example Request**:
```bash
curl "https://opensvm.com/api/status" \
  -H "Authorization: Bearer YOUR_API_KEY"
curl -X POST "https://opensvm.com/api/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/status/route.ts`

---

## Stream

### GET, POST /api/stream

**Methods**: GET, POST

**Method Details**:
- **GET**: Enhanced logger for stream API
- **POST**: Enhanced logger for stream API

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `action` | string | action parameter |
| `clientId` | string | clientId parameter |

**Type Definitions**:
```typescript
interface StreamClient {
id: string;
  send: (data: any) => void;
  close: () => void;
  subscriptions: Set<string>;
  authenticated: boolean;
  connectionTime: number;
  lastActivity: number;
  isConnected: boolean;
  consecutiveFailures: number;
}

interface BlockchainEvent {
type: 'transaction' | 'block' | 'account_change';
  timestamp: number;
  data: any;
  metadata?: any;
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/stream?action=value&clientId=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
curl -X POST "https://opensvm.com/api/stream" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/stream/route.ts`

---

### GET /api/stream/blocks

**Description**: Real-time block stream endpoint using SSE

**Methods**: GET

**Method Details**:
- **GET**: Real-time block stream endpoint using SSE

**Example Request**:
```bash
curl "https://opensvm.com/api/stream/blocks"
```

**Source**: `app/api/stream/blocks/route.ts`

---

### GET /api/stream/transactions

**Description**: Real-time transaction stream endpoint using SSE

**Methods**: GET

**Method Details**:
- **GET**: Real-time transaction stream endpoint using SSE

**Example Request**:
```bash
curl "https://opensvm.com/api/stream/transactions"
```

**Source**: `app/api/stream/transactions/route.ts`

---

## Test qdrant

### GET /api/test-qdrant

**Methods**: GET

**Example Request**:
```bash
curl "https://opensvm.com/api/test-qdrant"
```

**Source**: `app/api/test-qdrant/route.ts`

---

## Test token balance

### GET /api/test-token-balance

**Methods**: GET

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `wallet` | string | wallet parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/test-token-balance?wallet=value"
```

**Source**: `app/api/test-token-balance/route.ts`

---

## Test transaction

### GET /api/test-transaction

**Methods**: GET

**Authentication**: Required

**Example Request**:
```bash
curl "https://opensvm.com/api/test-transaction" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/test-transaction/route.ts`

---

## Token

### GET /api/token/:address

**Methods**: GET

**Method Details**:
- **GET**: Cache for token holder data and market data

**Authentication**: Required

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `address` | string | address identifier |

**Example Request**:
```bash
curl "https://opensvm.com/api/token/{address}" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/token/[address]/route.ts`

---

### GET /api/token/:address/holders

**Methods**: GET

**Method Details**:
- **GET**: Constants

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | limit parameter |
| `offset` | number | offset parameter |
| `minBalance` | number | minBalance parameter |
| `minVolume` | number | minVolume parameter |
| `volumeHours` | number | volumeHours parameter |
| `sortBy` | string | balance, address, or volume |
| `order` | string | desc or asc |
| `includeVolume` | string | desc or asc |

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `address` | string | address identifier |

**Example Request**:
```bash
curl "https://opensvm.com/api/token/{address}/holders?limit=value&offset=value&minBalance=value&minVolume=value&volumeHours=value&sortBy=value&order=value&includeVolume=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/token/[address]/holders/route.ts`

---

### GET /api/token/:address/holdersByVolume

**Methods**: GET

**Method Details**:
- **GET**: Shared cache with holders endpoint (5 minute TTL)

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | string | Force include volume and sort by volume |
| `offset` | number | offset parameter |
| `minBalance` | number | minBalance parameter |
| `minVolume` | number | minVolume parameter |
| `period` | string | hours |

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `address` | string | address identifier |

**Example Request**:
```bash
curl "https://opensvm.com/api/token/{address}/holdersByVolume?limit=value&offset=value&minBalance=value&minVolume=value&period=value"
```

**Source**: `app/api/token/[address]/holdersByVolume/route.ts`

---

### GET /api/token/:address/traders

**Methods**: GET

**Method Details**:
- **GET**: Shared cache with holders endpoint (5 minute TTL)

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `includeVolume` | string | For traders endpoint, includeVolume is true by default |
| `limit` | number | limit parameter |
| `offset` | number | offset parameter |
| `minBalance` | number | minBalance parameter |
| `minVolume` | number | minVolume parameter |
| `period` | string | hours |
| `sortBy` | string | Default to sort by volume for traders |

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `address` | string | address identifier |

**Example Request**:
```bash
curl "https://opensvm.com/api/token/{address}/traders?includeVolume=value&limit=value&offset=value&minBalance=value&minVolume=value&period=value&sortBy=value"
```

**Source**: `app/api/token/[address]/traders/route.ts`

---

## Token gating

### GET /api/token-gating/check

**Methods**: GET

**Authentication**: Required

**Example Request**:
```bash
curl "https://opensvm.com/api/token-gating/check" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/token-gating/check/route.ts`

---

## Token metadata

### GET, POST /api/token-metadata

**Methods**: GET, POST

**Method Details**:
- **POST**: Validate mint address format

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `mint` | string | mint parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/token-metadata?mint=value"
curl -X POST "https://opensvm.com/api/token-metadata" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/token-metadata/route.ts`

---

## Token stats

### GET /api/token-stats/:account/:mint

**Methods**: GET

**Method Details**:
- **GET**: 5 minutes

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `account` | string | account identifier |
| `mint` | string | mint identifier |

**Type Definitions**:
```typescript
interface TokenStats {
mint: string;
  txCount: number;
  volume: number;
  lastUpdated: number;
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/token-stats/{account}/{mint}"
```

**Source**: `app/api/token-stats/[account]/[mint]/route.ts`

---

## Trades

### GET /api/trades

**Description**: Trades API - Fetch recent trades for a specific token

**Methods**: GET

**Method Details**:
- **GET**: Trades API - Fetch recent trades for a specific token

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `mint` | number | mint parameter |
| `limit` | number | limit parameter |
| `type` | number | type parameter |
| `offset` | number | offset parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/trades?mint=value&limit=value&type=value&offset=value"
```

**Source**: `app/api/trades/route.ts`

---

## Trading

### POST /api/trading/chat

**Methods**: POST

**Method Details**:
- **POST**: Parse natural language trading commands

**Type Definitions**:
```typescript
interface TradeCommand {
action: 'buy' | 'sell';
  amount: number;
  token: string;
  orderType: 'market' | 'limit';
  price?: number;
  estimatedValue?: number;
}

interface ChatMessage {
id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

```

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/trading/chat" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/trading/chat/route.ts`

---

### GET, POST, DELETE /api/trading/execute

**Description**: Generate a unique order ID

**Methods**: GET, POST, DELETE

**Method Details**:
- **GET**: Generate a unique order ID
- **POST**: Generate a unique order ID
- **DELETE**: Generate a unique order ID

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `orderId` | string | orderId parameter |

**Type Definitions**:
```typescript
interface OrderRequest {
type: 'market' | 'limit';
  side: 'buy' | 'sell';
  amount: number;
  price?: number;
  market: string;
  stopLoss?: number;
  takeProfit?: number;
  userId?: string;
}

interface OrderResponse {
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

interface PositionUpdate {
symbol: string;
  side: 'long' | 'short';
  amount: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  stopLoss?: number;
  takeProfit?: number;
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/trading/execute?orderId=value"
curl -X POST "https://opensvm.com/api/trading/execute" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
curl -X DELETE "https://opensvm.com/api/trading/execute"
```

**Source**: `app/api/trading/execute/route.ts`

---

### GET /api/trading/market-data

**Description**: Calculate price impact for a given trade size on an AMM

**Methods**: GET

**Method Details**:
- **GET**: Calculate price impact for a given trade size on an AMM

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `market` | string | market parameter |

**Type Definitions**:
```typescript
interface MarketDataResponse {
market: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  lastUpdate: number;
  orderBook?: {
    bids: Array<{ price: number; amount: number
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/trading/market-data?market=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/trading/market-data/route.ts`

---

### GET /api/trading/markets

**Description**: Fetch trending/top tokens from Birdeye API

**Methods**: GET

**Method Details**:
- **GET**: Fetch trending/top tokens from Birdeye API

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | number | type parameter |
| `limit` | number | limit parameter |
| `dex` | string | New: DEX filter parameter |

**Type Definitions**:
```typescript
interface CacheEntry {
data: any;
  timestamp: number;
  ttl: number;
}

interface MarketData {
symbol: string;
  baseToken: string;
  quoteToken: string;
  price: number;
  change24h: number;
  volume24h: number;
  source: string;
  marketCap?: number;
  liquidity?: number;
  mint?: string;
  dex?: string; // Added DEX information
  poolAddress?: string; // Added pool address
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/trading/markets?type=value&limit=value&dex=value"
```

**Source**: `app/api/trading/markets/route.ts`

---

### GET /api/trading/pools

**Description**: Fetch all trading pools/pairs for a specific token from Birdeye API

**Methods**: GET

**Method Details**:
- **GET**: Fetch all trading pools/pairs for a specific token from Birdeye API

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `token` | string | token parameter |
| `symbol` | string | For mock data |
| `dex` | string | For mock data |

**Type Definitions**:
```typescript
interface PoolData {
symbol: string;
  baseToken: string;
  quoteToken: string;
  price: number;
  change24h: number;
  volume24h: number;
  liquidity: number;
  dex: string;
  poolAddress: string;
  source: string;
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/trading/pools?token=value&symbol=value&dex=value"
```

**Source**: `app/api/trading/pools/route.ts`

---

### GET, POST, DELETE, PATCH /api/trading/positions

**Description**: Calculate current PnL for a position

**Methods**: GET, POST, DELETE, PATCH

**Method Details**:
- **GET**: Calculate current PnL for a position
- **POST**: Calculate current PnL for a position
- **DELETE**: Calculate current PnL for a position
- **PATCH**: Calculate current PnL for a position

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | id parameter |
| `status` | string | status parameter |
| `symbol` | string | symbol parameter |
| `closeAll` | boolean | closeAll parameter |

**Type Definitions**:
```typescript
interface Position {
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
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/trading/positions?id=value&status=value&symbol=value&closeAll=value"
curl -X POST "https://opensvm.com/api/trading/positions" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
curl -X DELETE "https://opensvm.com/api/trading/positions"
curl -X PATCH "https://opensvm.com/api/trading/positions" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/trading/positions/route.ts`

---

### GET, POST /api/trading/stream

**Description**: Trading Stream API - Real-Time Data via Server-Sent Events

**Methods**: GET, POST

**Method Details**:
- **GET**: Trading Stream API - Real-Time Data via Server-Sent Events
- **POST**: Trading Stream API - Real-Time Data via Server-Sent Events

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `market` | string[] | market parameter |
| `channels` | string[] | channels parameter |

**Type Definitions**:
```typescript
interface Trade {
id: string;
  timestamp: number;
  price: number;
  amount: number;
  side: 'buy' | 'sell';
  dex: string;
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/trading/stream?market=value&channels=value"
curl -X POST "https://opensvm.com/api/trading/stream" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/trading/stream/route.ts`

---

### GET /api/trading/trades

**Description**: Fetch recent trades from Birdeye API

**Methods**: GET

**Method Details**:
- **GET**: Fetch recent trades from Birdeye API

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `mint` | string | SOL by default |
| `limit` | string | SOL by default |
| `source` | string | 'auto', 'birdeye', or 'mock' |

**Type Definitions**:
```typescript
interface Trade {
id: string;
  price: number;
  amount: number;
  side: 'buy' | 'sell';
  timestamp: number;
  dex?: string;
  txHash?: string;
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/trading/trades?mint=value&limit=value&source=value"
```

**Source**: `app/api/trading/trades/route.ts`

---

## Transaction

### GET /api/transaction

**Methods**: GET

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `signature` | string | signature parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/transaction?signature=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/transaction/route.ts`

---

### GET /api/transaction/:signature

**Methods**: GET

**Method Details**:
- **GET**: Set to true to enable detailed logging

**Authentication**: Required

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `signature` | string | signature identifier |

**Example Request**:
```bash
curl "https://opensvm.com/api/transaction/{signature}" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/transaction/[signature]/route.ts`

---

### GET, POST /api/transaction/:signature/analysis

**Methods**: GET, POST

**Method Details**:
- **GET**: Lazy loader to ensure Jest module mocks are applied (avoids eager ESM binding)
- **POST**: Lazy loader to ensure Jest module mocks are applied (avoids eager ESM binding)

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `includeInstructions` | boolean | includeInstructions parameter |
| `includeAccountChanges` | boolean | includeAccountChanges parameter |
| `includeMetrics` | boolean | includeMetrics parameter |
| `includeFailureAnalysis` | boolean | includeFailureAnalysis parameter |
| `detailed` | boolean | detailed parameter |

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `signature` | string | signature identifier |

**Type Definitions**:
```typescript
interface TransactionAnalysisResponse {
success: boolean;
  data?: {
    signature: string;
    analysis: {
      instructions?: {
        parsed: any[];
        summary: {
          totalInstructions: number;
          programsInvolved: string[];
          instructionTypes: Record<string, number>;
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/transaction/{signature}/analysis?includeInstructions=value&includeAccountChanges=value&includeMetrics=value&includeFailureAnalysis=value&detailed=value"
curl -X POST "https://opensvm.com/api/transaction/{signature}/analysis" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/transaction/[signature]/analysis/route.ts`

---

### GET, POST /api/transaction/:signature/explain

**Methods**: GET, POST

**Method Details**:
- **GET**: Lazy loader to ensure Jest module mocks are applied (avoids eager ESM binding)
- **POST**: Lazy loader to ensure Jest module mocks are applied (avoids eager ESM binding)

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `level` | boolean | level parameter |
| `focus` | boolean | focus parameter |
| `includeRisks` | boolean | includeRisks parameter |
| `includeRecommendations` | boolean | includeRecommendations parameter |
| `regenerate` | boolean | regenerate parameter |
| `language` | string | language parameter |

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `signature` | string | signature identifier |

**Type Definitions**:
```typescript
interface ExplainTransactionResponse {
success: boolean;
  data?: {
    signature: string;
    explanation: {
      summary: string;
      mainAction: string;
      secondaryEffects: string[];
      technicalDetails?: {
        programsUsed: Array<{
          program: string;
          purpose: string;
          instructions: number;
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/transaction/{signature}/explain?level=value&focus=value&includeRisks=value&includeRecommendations=value&regenerate=value&language=value"
curl -X POST "https://opensvm.com/api/transaction/{signature}/explain" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/transaction/[signature]/explain/route.ts`

---

### GET, POST /api/transaction/:signature/failure-analysis

**Methods**: GET, POST

**Method Details**:
- **POST**: Validate signature format

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `signature` | string | signature identifier |

**Example Request**:
```bash
curl "https://opensvm.com/api/transaction/{signature}/failure-analysis"
curl -X POST "https://opensvm.com/api/transaction/{signature}/failure-analysis" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/transaction/[signature]/failure-analysis/route.ts`

---

### GET /api/transaction/:signature/metrics

**Methods**: GET

**Method Details**:
- **GET**: Lazy loader to ensure Jest module mocks are applied (avoids eager ESM binding)

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `includeComparison` | boolean | includeComparison parameter |
| `includeBenchmarks` | boolean | includeBenchmarks parameter |
| `includeRecommendations` | string | includeRecommendations parameter |
| `timeframe` | string | timeframe parameter |

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `signature` | string | signature identifier |

**Type Definitions**:
```typescript
interface TransactionMetricsResponse {
success: boolean;
  data?: {
    signature: string;
    metrics: {
      fees: {
        total: number;
        perComputeUnit: number;
        breakdown: {
          baseFee: number;
          priorityFee: number;
          rentExemption?: number;
}

interface Recommendation {
category: 'fee' | 'compute' | 'structure' | 'security';
    priority: 'low' | 'medium' | 'high';
    title: string;
    description: string;
    potentialSavings?: number;
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/transaction/{signature}/metrics?includeComparison=value&includeBenchmarks=value&includeRecommendations=value&timeframe=value"
```

**Source**: `app/api/transaction/[signature]/metrics/route.ts`

---

### GET, POST /api/transaction/:signature/related

**Methods**: GET, POST

**Method Details**:
- **GET**: Lazy loader to ensure Jest module mocks are applied (avoids eager ESM binding)
- **POST**: Lazy loader to ensure Jest module mocks are applied (avoids eager ESM binding)

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `maxResults` | number | maxResults parameter |
| `minScore` | number | minScore parameter |
| `relationshipTypes` | number | relationshipTypes parameter |
| `timeWindow` | number | timeWindow parameter |
| `includeMetadata` | string | includeMetadata parameter |
| `sortBy` | string | sortBy parameter |

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `signature` | string | signature identifier |

**Type Definitions**:
```typescript
interface RelatedTransactionsResponse {
success: boolean;
  data?: {
    signature: string;
    relatedTransactions: {
      signature: string;
      relationship: {
        type: string;
        score: number;
        explanation: string;
        sharedAccounts?: string[];
        sharedPrograms?: string[];
        timeDifference?: number;
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/transaction/{signature}/related?maxResults=value&minScore=value&relationshipTypes=value&timeWindow=value&includeMetadata=value&sortBy=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
curl -X POST "https://opensvm.com/api/transaction/{signature}/related" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/transaction/[signature]/related/route.ts`

---

### GET, POST /api/transaction/batch

**Methods**: GET, POST

**Method Details**:
- **GET**: Lazy loader to ensure Jest module mocks are applied (avoids eager ESM binding)
- **POST**: Lazy loader to ensure Jest module mocks are applied (avoids eager ESM binding)

**Type Definitions**:
```typescript
interface BatchTransactionResponse {
success: boolean;
  data?: {
    transactions: Array<{
      signature: string;
      transaction?: any;
      analysis?: any;
      error?: string;
      cached: boolean;
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/transaction/batch"
curl -X POST "https://opensvm.com/api/transaction/batch" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/transaction/batch/route.ts`

---

### GET, POST /api/transaction/mock/:signature

**Methods**: GET, POST

**Method Details**:
- **GET**: Mock transaction data for testing
- **POST**: Mock transaction data for testing

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `signature` | string | signature identifier |

**Example Request**:
```bash
curl "https://opensvm.com/api/transaction/mock/{signature}"
curl -X POST "https://opensvm.com/api/transaction/mock/{signature}" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/transaction/mock/[signature]/route.ts`

---

## Transaction metrics

### GET, POST /api/transaction-metrics

**Description**: GET /api/transaction-metrics

**Methods**: GET, POST

**Method Details**:
- **GET**: GET /api/transaction-metrics
- **POST**: GET /api/transaction-metrics

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `action` | string | action parameter |
| `signature` | string | signature parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/transaction-metrics?action=value&signature=value"
curl -X POST "https://opensvm.com/api/transaction-metrics" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/transaction-metrics/route.ts`

---

### GET, POST /api/transaction-metrics/:signature

**Description**: GET /api/transaction-metrics/[signature]

**Methods**: GET, POST

**Method Details**:
- **GET**: GET /api/transaction-metrics/[signature]
- **POST**: GET /api/transaction-metrics/[signature]

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `include` | string[] | include parameter |

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `signature` | string | signature identifier |

**Example Request**:
```bash
curl "https://opensvm.com/api/transaction-metrics/{signature}?include=value"
curl -X POST "https://opensvm.com/api/transaction-metrics/{signature}" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/transaction-metrics/[signature]/route.ts`

---

## Transfers

### GET, POST /api/transfers/cache

**Methods**: GET, POST

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `walletAddress` | string | walletAddress parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/transfers/cache?walletAddress=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
curl -X POST "https://opensvm.com/api/transfers/cache" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/transfers/cache/route.ts`

---

## Usage stats

### GET, POST /api/usage-stats

**Description**: API usage statistics

**Methods**: GET, POST

**Method Details**:
- **GET**: API usage statistics
- **POST**: API usage statistics

**Authentication**: Required

**Example Request**:
```bash
curl "https://opensvm.com/api/usage-stats" \
  -H "Authorization: Bearer YOUR_API_KEY"
curl -X POST "https://opensvm.com/api/usage-stats" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/usage-stats/route.ts`

---

## User feed

### GET /api/user-feed/:walletAddress

**Description**: User Feed API

**Methods**: GET

**Method Details**:
- **GET**: User Feed API

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | boolean | type parameter |
| `realtime` | boolean | realtime parameter |
| `page` | string | Parse query parameters |
| `limit` | number | limit parameter |
| `dateRange` | string[] | dateRange parameter |
| `eventTypes` | string[] | eventTypes parameter |
| `sort` | string | sort parameter |

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `walletAddress` | string | walletAddress identifier |

**Example Request**:
```bash
curl "https://opensvm.com/api/user-feed/{walletAddress}?type=value&realtime=value&page=value&limit=value&dateRange=value&eventTypes=value&sort=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/user-feed/[walletAddress]/route.ts`

---

## User history

### GET, POST, DELETE /api/user-history/:walletAddress

**Description**: User History API Endpoints

**Methods**: GET, POST, DELETE

**Method Details**:
- **GET**: User History API Endpoints
- **POST**: User History API Endpoints
- **DELETE**: User History API Endpoints

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | string | Cap at 1000 |
| `offset` | string | Cap at 1000 |
| `pageType` | string | pageType parameter |

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `walletAddress` | string | walletAddress identifier |

**Example Request**:
```bash
curl "https://opensvm.com/api/user-history/{walletAddress}?limit=value&offset=value&pageType=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
curl -X POST "https://opensvm.com/api/user-history/{walletAddress}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
curl -X DELETE "https://opensvm.com/api/user-history/{walletAddress}" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/user-history/[walletAddress]/route.ts`

---

### GET, POST /api/user-history/repair

**Description**: User History Repair API

**Methods**: GET, POST

**Method Details**:
- **GET**: User History Repair API
- **POST**: User History Repair API

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `walletAddress` | string | walletAddress parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/user-history/repair?walletAddress=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
curl -X POST "https://opensvm.com/api/user-history/repair" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/user-history/repair/route.ts`

---

### POST /api/user-history/sync

**Description**: User History Sync API

**Methods**: POST

**Method Details**:
- **POST**: User History Sync API

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/user-history/sync" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/user-history/sync/route.ts`

---

## User profile

### GET, PUT /api/user-profile/:walletAddress

**Description**: User Profile API Endpoints

**Methods**: GET, PUT

**Method Details**:
- **GET**: User Profile API Endpoints
- **PUT**: User Profile API Endpoints

**Authentication**: Required

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `walletAddress` | string | walletAddress identifier |

**Example Request**:
```bash
curl "https://opensvm.com/api/user-profile/{walletAddress}" \
  -H "Authorization: Bearer YOUR_API_KEY"
curl -X PUT "https://opensvm.com/api/user-profile/{walletAddress}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/user-profile/[walletAddress]/route.ts`

---

### GET, POST /api/user-profile/sync

**Description**: User Profile Statistics Synchronization API

**Methods**: GET, POST

**Method Details**:
- **GET**: User Profile Statistics Synchronization API
- **POST**: User Profile Statistics Synchronization API

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `walletAddress` | string | walletAddress parameter |

**Example Request**:
```bash
curl "https://opensvm.com/api/user-profile/sync?walletAddress=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
curl -X POST "https://opensvm.com/api/user-profile/sync" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/user-profile/sync/route.ts`

---

## User social

### POST /api/user-social/follow

**Description**: API endpoint for following users

**Methods**: POST

**Method Details**:
- **POST**: API endpoint for following users

**Authentication**: Required

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/user-social/follow" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/user-social/follow/route.ts`

---

### GET, POST, DELETE /api/user-social/follow/:targetAddress

**Description**: User Social Follow API Endpoints

**Methods**: GET, POST, DELETE

**Method Details**:
- **GET**: User Social Follow API Endpoints
- **POST**: User Social Follow API Endpoints
- **DELETE**: User Social Follow API Endpoints

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | type parameter |

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `targetAddress` | string | targetAddress identifier |

**Example Request**:
```bash
curl "https://opensvm.com/api/user-social/follow/{targetAddress}?type=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
curl -X POST "https://opensvm.com/api/user-social/follow/{targetAddress}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
curl -X DELETE "https://opensvm.com/api/user-social/follow/{targetAddress}" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/user-social/follow/[targetAddress]/route.ts`

---

### POST /api/user-social/like

**Description**: API endpoint for liking user profiles

**Methods**: POST

**Method Details**:
- **POST**: API endpoint for liking user profiles

**Authentication**: Required

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/user-social/like" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/user-social/like/route.ts`

---

### POST /api/user-social/like-event

**Description**: API endpoint for liking/unliking feed events

**Methods**: POST

**Method Details**:
- **POST**: API endpoint for liking/unliking feed events

**Authentication**: Required

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/user-social/like-event" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/user-social/like-event/route.ts`

---

### GET, POST, DELETE /api/user-social/like/:targetAddress

**Description**: User Social Like API Endpoints

**Methods**: GET, POST, DELETE

**Method Details**:
- **GET**: User Social Like API Endpoints
- **POST**: User Social Like API Endpoints
- **DELETE**: User Social Like API Endpoints

**Authentication**: Required

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `targetAddress` | string | targetAddress identifier |

**Example Request**:
```bash
curl "https://opensvm.com/api/user-social/like/{targetAddress}" \
  -H "Authorization: Bearer YOUR_API_KEY"
curl -X POST "https://opensvm.com/api/user-social/like/{targetAddress}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
curl -X DELETE "https://opensvm.com/api/user-social/like/{targetAddress}" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/user-social/like/[targetAddress]/route.ts`

---

### POST /api/user-social/unfollow

**Description**: API endpoint for unfollowing users

**Methods**: POST

**Method Details**:
- **POST**: API endpoint for unfollowing users

**Authentication**: Required

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/user-social/unfollow" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/user-social/unfollow/route.ts`

---

### POST /api/user-social/unlike

**Description**: API endpoint for unliking user profiles

**Methods**: POST

**Method Details**:
- **POST**: API endpoint for unliking user profiles

**Authentication**: Required

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/user-social/unlike" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/user-social/unlike/route.ts`

---

### POST /api/user-social/unlike-event

**Description**: API endpoint for unliking feed events

**Methods**: POST

**Method Details**:
- **POST**: API endpoint for unliking feed events

**Authentication**: Required

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/user-social/unlike-event" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/user-social/unlike-event/route.ts`

---

### POST /api/user-social/view

**Description**: API endpoint for tracking profile views

**Methods**: POST

**Method Details**:
- **POST**: API endpoint for tracking profile views

**Authentication**: Required

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/user-social/view" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/user-social/view/route.ts`

---

## User tab preference

### GET, PUT /api/user-tab-preference/:walletAddress

**Description**: User Tab Preference API Endpoints

**Methods**: GET, PUT

**Method Details**:
- **GET**: User Tab Preference API Endpoints
- **PUT**: User Tab Preference API Endpoints

**Authentication**: Required

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `walletAddress` | string | walletAddress identifier |

**Example Request**:
```bash
curl "https://opensvm.com/api/user-tab-preference/{walletAddress}" \
  -H "Authorization: Bearer YOUR_API_KEY"
curl -X PUT "https://opensvm.com/api/user-tab-preference/{walletAddress}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/user-tab-preference/[walletAddress]/route.ts`

---

## V1

### POST /api/v1/messages

**Methods**: POST

**Method Details**:
- **POST**: Polyfill for crypto.randomUUID in test environments

**Authentication**: Required

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/v1/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/v1/messages/route.ts`

---

### GET /api/v1/models

**Methods**: GET

**Method Details**:
- **GET**: Simple in-memory cache for models

**Authentication**: Required

**Type Definitions**:
```typescript
interface CacheEntry {
data: any;
    timestamp: number;
    expiresAt: number;
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/v1/models" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/v1/models/route.ts`

---

## Validator

### GET, POST /api/validator/:address

**Description**: Fetch real stakers delegated to a specific validator

**Methods**: GET, POST

**Method Details**:
- **GET**: Fetch real stakers delegated to a specific validator
- **POST**: Fetch real stakers delegated to a specific validator

**Authentication**: Required

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `address` | string | address identifier |

**Example Request**:
```bash
curl "https://opensvm.com/api/validator/{address}" \
  -H "Authorization: Bearer YOUR_API_KEY"
curl -X POST "https://opensvm.com/api/validator/{address}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/validator/[address]/route.ts`

---

## Version

### GET, POST /api/version

**Description**: API version information

**Methods**: GET, POST

**Method Details**:
- **GET**: API version information
- **POST**: API version information

**Authentication**: Required

**Example Request**:
```bash
curl "https://opensvm.com/api/version" \
  -H "Authorization: Bearer YOUR_API_KEY"
curl -X POST "https://opensvm.com/api/version" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/version/route.ts`

---

## Wallet path finding

### POST /api/wallet-path-finding

**Methods**: POST

**Method Details**:
- **POST**: Handle the wallet path finding request

**Authentication**: Required

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/wallet-path-finding" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/wallet-path-finding/route.ts`

---

## Websocket info

### GET /api/websocket-info

**Description**: WebSocket info endpoint

**Methods**: GET

**Method Details**:
- **GET**: WebSocket info endpoint

**Example Request**:
```bash
curl "https://opensvm.com/api/websocket-info"
```

**Source**: `app/api/websocket-info/route.ts`

---

