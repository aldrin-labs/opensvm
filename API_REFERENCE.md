# OpenSVM API Complete Reference

Auto-generated documentation for all 193 API endpoints.

**Generated**: 2025-11-12T05:45:00.955Z

## Table of Contents

- [Account-portfolio](#account-portfolio) (1 endpoints)
- [Account-stats](#account-stats) (1 endpoints)
- [Account-token-stats](#account-token-stats) (1 endpoints)
- [Account-transactions](#account-transactions) (1 endpoints)
- [Account-transfers](#account-transfers) (1 endpoints)
- [Ai-analyze-transaction](#ai-analyze-transaction) (1 endpoints)
- [Ai-response](#ai-response) (1 endpoints)
- [Alerts](#alerts) (1 endpoints)
- [Analytics](#analytics) (14 endpoints)
- [Analyze](#analyze) (1 endpoints)
- [Analyze-account-changes](#analyze-account-changes) (1 endpoints)
- [Analyze-transaction](#analyze-transaction) (1 endpoints)
- [Anomaly](#anomaly) (3 endpoints)
- [Api-keys](#api-keys) (1 endpoints)
- [Auth](#auth) (9 endpoints)
- [Bank](#bank) (4 endpoints)
- [Block](#block) (1 endpoints)
- [Blocks](#blocks) (3 endpoints)
- [Chart](#chart) (1 endpoints)
- [Chat](#chat) (2 endpoints)
- [Check-account-type](#check-account-type) (1 endpoints)
- [Check-token](#check-token) (1 endpoints)
- [Config](#config) (1 endpoints)
- [Crash-reporting](#crash-reporting) (1 endpoints)
- [Dex](#dex) (1 endpoints)
- [Docs](#docs) (2 endpoints)
- [Error-report](#error-report) (1 endpoints)
- [Error-tracking](#error-tracking) (1 endpoints)
- [Favicon](#favicon) (1 endpoints)
- [Feed](#feed) (1 endpoints)
- [Filter-transactions](#filter-transactions) (1 endpoints)
- [Find-related-transactions](#find-related-transactions) (1 endpoints)
- [GetAnswer](#getAnswer) (1 endpoints)
- [GetSimilarQuestions](#getSimilarQuestions) (1 endpoints)
- [GetSources](#getSources) (1 endpoints)
- [Health](#health) (2 endpoints)
- [HoldersByInteraction](#holdersByInteraction) (1 endpoints)
- [Instruction-lookup](#instruction-lookup) (1 endpoints)
- [Launchpad](#launchpad) (14 endpoints)
- [Live-stats](#live-stats) (1 endpoints)
- [Logging](#logging) (1 endpoints)
- [Market-data](#market-data) (1 endpoints)
- [Mempool](#mempool) (1 endpoints)
- [Metrics](#metrics) (1 endpoints)
- [Monetization](#monetization) (3 endpoints)
- [Monitoring](#monitoring) (2 endpoints)
- [Nft-collections](#nft-collections) (3 endpoints)
- [Nfts](#nfts) (1 endpoints)
- [Notifications](#notifications) (1 endpoints)
- [Og](#og) (2 endpoints)
- [Opensvm](#opensvm) (5 endpoints)
- [Program](#program) (1 endpoints)
- [Program-accounts](#program-accounts) (1 endpoints)
- [Program-discovery](#program-discovery) (1 endpoints)
- [Program-metadata](#program-metadata) (1 endpoints)
- [Program-registry](#program-registry) (2 endpoints)
- [Proxy](#proxy) (2 endpoints)
- [Qdrant](#qdrant) (1 endpoints)
- [Referrals](#referrals) (2 endpoints)
- [Scan](#scan) (1 endpoints)
- [Search](#search) (5 endpoints)
- [Search-suggestions](#search-suggestions) (1 endpoints)
- [Share](#share) (5 endpoints)
- [Slots](#slots) (1 endpoints)
- [Solana-proxy](#solana-proxy) (2 endpoints)
- [Solana-rpc](#solana-rpc) (1 endpoints)
- [Sse-alerts](#sse-alerts) (1 endpoints)
- [Sse-events](#sse-events) (1 endpoints)
- [Sse-feed](#sse-feed) (1 endpoints)
- [Status](#status) (1 endpoints)
- [Stream](#stream) (3 endpoints)
- [Test-qdrant](#test-qdrant) (1 endpoints)
- [Test-token-balance](#test-token-balance) (1 endpoints)
- [Test-transaction](#test-transaction) (1 endpoints)
- [Token](#token) (4 endpoints)
- [Token-gating](#token-gating) (1 endpoints)
- [Token-metadata](#token-metadata) (1 endpoints)
- [Token-stats](#token-stats) (1 endpoints)
- [Trades](#trades) (1 endpoints)
- [Trading](#trading) (8 endpoints)
- [Transaction](#transaction) (9 endpoints)
- [Transaction-metrics](#transaction-metrics) (2 endpoints)
- [Transfers](#transfers) (1 endpoints)
- [Usage-stats](#usage-stats) (1 endpoints)
- [User-feed](#user-feed) (1 endpoints)
- [User-history](#user-history) (3 endpoints)
- [User-profile](#user-profile) (2 endpoints)
- [User-social](#user-social) (9 endpoints)
- [User-tab-preference](#user-tab-preference) (1 endpoints)
- [V1](#v1) (2 endpoints)
- [Validator](#validator) (1 endpoints)
- [Version](#version) (1 endpoints)
- [Wallet-path-finding](#wallet-path-finding) (1 endpoints)
- [Websocket-info](#websocket-info) (1 endpoints)

---

## Account-portfolio

### GET /api/account-portfolio/:address

**Methods**: GET

**Authentication**: Required

**Path Parameters**:
- `address`

**Example Request**:
```bash
curl "https://opensvm.com/api/account-portfolio/{address}" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/account-portfolio/[address]/route.ts`

---

## Account-stats

### GET /api/account-stats/:address

**Methods**: GET

**Path Parameters**:
- `address`

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

## Account-token-stats

### GET /api/account-token-stats/:address/:mint

**Methods**: GET

**Path Parameters**:
- `address`
- `mint`

**Example Request**:
```bash
curl "https://opensvm.com/api/account-token-stats/{address}/{mint}"
```

**Source**: `app/api/account-token-stats/[address]/[mint]/route.ts`

---

## Account-transactions

### GET /api/account-transactions/:address

**Methods**: GET

**Authentication**: Required

**Query Parameters**:
- `limit`
- `before`
- `until`
- `classify`
- `includeInflow`
- `startDate`
- `endDate`

**Path Parameters**:
- `address`

**Example Request**:
```bash
curl "https://opensvm.com/api/account-transactions/{address}?limit=value&before=value&until=value&classify=value&includeInflow=value&startDate=value&endDate=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/account-transactions/[address]/route.ts`

---

## Account-transfers

### GET /api/account-transfers/:address

Process a batch of transactions and extract transfer data

**Methods**: GET

**Authentication**: Required

**Query Parameters**:
- `beforeSignature`
- `offset`
- `limit`
- `transferType`
- `solanaOnly`

**Path Parameters**:
- `address`

**Type Definitions**:
```typescript
interface Transfer {
txId: string;
  date: string;
  from: string;
  to: string;
  tokenSymbol: string;
  tokenAmount: string;
  transferType: 'IN' | 'OUT';
}

```

**Example Request**:
```bash
curl "https://opensvm.com/api/account-transfers/{address}?beforeSignature=value&offset=value&limit=value&transferType=value&solanaOnly=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/account-transfers/[address]/route.ts`

---

## Ai-analyze-transaction

### GET, POST /api/ai-analyze-transaction

**Methods**: GET, POST

**Query Parameters**:
- `signature`

**Example Request**:
```bash
curl "https://opensvm.com/api/ai-analyze-transaction?signature=value"
curl -X POST "https://opensvm.com/api/ai-analyze-transaction" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/ai-analyze-transaction/route.ts`

---

## Ai-response

### POST /api/ai-response

**Methods**: POST

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

Real-time alerts and warnings stream

**Methods**: GET

**Example Request**:
```bash
curl "https://opensvm.com/api/alerts"
```

**Source**: `app/api/alerts/route.ts`

---

## Analytics

### GET /api/analytics/aggregators

**Methods**: GET

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

**Query Parameters**:
- `bridge`

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

**Query Parameters**:
- `protocol`

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

Fetch real price data from Jupiter API with:

**Methods**: GET

**Query Parameters**:
- `dex`

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

**Authentication**: Required

**Query Parameters**:
- `type`
- `limit`
- `sessionId`
- `heatmapType`

**Example Request**:
```bash
curl "https://opensvm.com/api/analytics/user-interactions?type=value&limit=value&sessionId=value&heatmapType=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
curl -X POST "https://opensvm.com/api/analytics/user-interactions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/analytics/user-interactions/route.ts`

---

### GET /api/analytics/validators

**Methods**: GET

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

## Analyze-account-changes

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

## Analyze-transaction

### GET, POST /api/analyze-transaction

**Methods**: GET, POST

**Query Parameters**:
- `signature`

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

**Query Parameters**:
- `action`

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
- `alertId`
- `accounts`

**Example Request**:
```bash
curl "https://opensvm.com/api/anomaly/related?alertId=value&accounts=value"
```

**Source**: `app/api/anomaly/related/route.ts`

---

### GET /api/anomaly/similar

**Methods**: GET

**Query Parameters**:
- `alertId`
- `type`

**Example Request**:
```bash
curl "https://opensvm.com/api/anomaly/similar?alertId=value&type=value"
```

**Source**: `app/api/anomaly/similar/route.ts`

---

## Api-keys

### GET, POST /api/api-keys

API key management

**Methods**: GET, POST

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

GET /api/auth/api-keys/activity

**Methods**: GET

**Authentication**: Required

**Query Parameters**:
- `apiKeyId`
- `walletAddress`
- `signature`
- `message`
- `limit`
- `offset`
- `startDate`
- `endDate`

**Example Request**:
```bash
curl "https://opensvm.com/api/auth/api-keys/activity?apiKeyId=value&walletAddress=value&signature=value&message=value&limit=value&offset=value&startDate=value&endDate=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/auth/api-keys/activity/route.ts`

---

### POST /api/auth/api-keys/create

API endpoint to create a new API key

**Methods**: POST

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

GET /api/auth/api-keys/list

**Methods**: GET

**Authentication**: Required

**Query Parameters**:
- `walletAddress`
- `signature`
- `message`

**Example Request**:
```bash
curl "https://opensvm.com/api/auth/api-keys/list?walletAddress=value&signature=value&message=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/auth/api-keys/list/route.ts`

---

### GET /api/auth/api-keys/metrics

GET /api/auth/api-keys/metrics

**Methods**: GET

**Authentication**: Required

**Query Parameters**:
- `apiKeyId`
- `walletAddress`
- `signature`
- `message`

**Example Request**:
```bash
curl "https://opensvm.com/api/auth/api-keys/metrics?apiKeyId=value&walletAddress=value&signature=value&message=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/auth/api-keys/metrics/route.ts`

---

### POST /api/auth/auth-link/create

API endpoint to create an auth link for an existing API key

**Methods**: POST

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

API endpoint to bind a wallet to an API key via auth link

**Methods**: POST

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

Logout endpoint

**Methods**: POST

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

Session creation endpoint

**Methods**: GET, POST

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

Signature verification endpoint

**Methods**: POST

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

GET /api/bank/wallets

**Methods**: GET

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

Initialize bank wallets collection if it doesn't exist

**Methods**: POST

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

Get Solana connection

**Methods**: POST

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

Legacy block API endpoint - redirects to new structure

**Methods**: GET

**Query Parameters**:
- `slot`

**Example Request**:
```bash
curl "https://opensvm.com/api/block?slot=value"
```

**Source**: `app/api/block/route.ts`

---

## Blocks

### GET /api/blocks

**Methods**: GET

**Query Parameters**:
- `limit`
- `before`
- `validator`
- `includeAnalytics`
- `sortBy`
- `sortOrder`

**Example Request**:
```bash
curl "https://opensvm.com/api/blocks?limit=value&before=value&validator=value&includeAnalytics=value&sortBy=value&sortOrder=value"
```

**Source**: `app/api/blocks/route.ts`

---

### GET /api/blocks/:slot

Process block analytics based on request parameters

**Methods**: GET

**Query Parameters**:
- `includeAnalytics`
- `includeTransactions`
- `includePrograms`
- `includeAccounts`
- `includeTransfers`

**Path Parameters**:
- `slot`

**Example Request**:
```bash
curl "https://opensvm.com/api/blocks/{slot}?includeAnalytics=value&includeTransactions=value&includePrograms=value&includeAccounts=value&includeTransfers=value"
```

**Source**: `app/api/blocks/[slot]/route.ts`

---

### GET /api/blocks/stats

**Methods**: GET

**Query Parameters**:
- `lookbackSlots`

**Example Request**:
```bash
curl "https://opensvm.com/api/blocks/stats?lookbackSlots=value"
```

**Source**: `app/api/blocks/stats/route.ts`

---

## Chart

### GET /api/chart

Chart API - Clean alias for OHLCV candlestick data

**Methods**: GET

**Example Request**:
```bash
curl "https://opensvm.com/api/chart"
```

**Source**: `app/api/chart/route.ts`

---

## Chat

### POST /api/chat

**Methods**: POST

**Query Parameters**:
- `mock`

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
```

**Source**: `app/api/chat/global/route.ts`

---

## Check-account-type

### GET /api/check-account-type

**Methods**: GET

**Query Parameters**:
- `address`

**Example Request**:
```bash
curl "https://opensvm.com/api/check-account-type?address=value"
```

**Source**: `app/api/check-account-type/route.ts`

---

## Check-token

### GET /api/check-token

**Methods**: GET

**Query Parameters**:
- `address`

**Example Request**:
```bash
curl "https://opensvm.com/api/check-token?address=value"
```

**Source**: `app/api/check-token/route.ts`

---

## Config

### GET, POST /api/config

Configuration endpoint

**Methods**: GET, POST

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

## Crash-reporting

### GET, POST, DELETE, PATCH /api/crash-reporting

**Methods**: GET, POST, DELETE, PATCH

**Query Parameters**:
- `type`
- `severity`
- `since`
- `limit`
- `aggregated`
- `crashId`
- `fingerprint`

**Example Request**:
```bash
curl "https://opensvm.com/api/crash-reporting?type=value&severity=value&since=value&limit=value&aggregated=value&crashId=value&fingerprint=value"
curl -X POST "https://opensvm.com/api/crash-reporting" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/crash-reporting/route.ts`

---

## Dex

### GET /api/dex/:name

**Methods**: GET

**Path Parameters**:
- `name`

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
- `format`
- `download`
- `scan`

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

## Error-report

### GET, POST /api/error-report

Error reporting endpoint

**Methods**: GET, POST

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

## Error-tracking

### GET, POST, DELETE, PATCH /api/error-tracking

**Methods**: GET, POST, DELETE, PATCH

**Query Parameters**:
- `severity`
- `category`
- `component`
- `resolved`
- `since`
- `limit`
- `stats`
- `timeframe`
- `type`

**Example Request**:
```bash
curl "https://opensvm.com/api/error-tracking?severity=value&category=value&component=value&resolved=value&since=value&limit=value&stats=value&timeframe=value&type=value"
curl -X POST "https://opensvm.com/api/error-tracking" \
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

Real-time feed of latest blockchain activity

**Methods**: GET

**Example Request**:
```bash
curl "https://opensvm.com/api/feed/latest"
```

**Source**: `app/api/feed/latest/route.ts`

---

## Filter-transactions

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

## Find-related-transactions

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

This API endpoint uses a modular tool system to handle common Solana queries

**Methods**: POST

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/getAnswer" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/getAnswer/route.ts`

---

## GetSimilarQuestions

### POST /api/getSimilarQuestions

**Methods**: POST

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

Health check endpoint with activity logging

**Methods**: GET

**Authentication**: Required

**Example Request**:
```bash
curl "https://opensvm.com/api/health" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/health/route.ts`

---

### GET /api/health/anthropic

GET /api/health/anthropic

**Methods**: GET

**Query Parameters**:
- `backend`
- `cache`

**Example Request**:
```bash
curl "https://opensvm.com/api/health/anthropic?backend=value&cache=value"
```

**Source**: `app/api/health/anthropic/route.ts`

---

## HoldersByInteraction

### GET /api/holdersByInteraction

**Methods**: GET

**Query Parameters**:
- `program`
- `period`
- `limit`
- `offset`
- `minInteractions`

**Example Request**:
```bash
curl "https://opensvm.com/api/holdersByInteraction?program=value&period=value&limit=value&offset=value&minInteractions=value"
```

**Source**: `app/api/holdersByInteraction/route.ts`

---

## Instruction-lookup

### GET, POST /api/instruction-lookup

GET /api/instruction-lookup

**Methods**: GET, POST

**Query Parameters**:
- `action`
- `programId`
- `discriminator`
- `instructionName`
- `category`
- `riskLevel`

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

API Route: GET /api/launchpad/admin/referrers

**Methods**: GET

**Authentication**: Required

**Query Parameters**:
- `status`

**Example Request**:
```bash
curl "https://opensvm.com/api/launchpad/admin/referrers?status=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/launchpad/admin/referrers/route.ts`

---

### POST /api/launchpad/admin/referrers/:id/approve

API Route: POST /api/launchpad/admin/referrers/[id]/approve

**Methods**: POST

**Authentication**: Required

**Path Parameters**:
- `id`

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

API Route: POST /api/launchpad/admin/referrers/[id]/reject

**Methods**: POST

**Authentication**: Required

**Path Parameters**:
- `id`

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

**Path Parameters**:
- `contribId`

**Example Request**:
```bash
curl "https://opensvm.com/api/launchpad/contributions/{contribId}"
```

**Source**: `app/api/launchpad/contributions/[contribId]/route.ts`

---

### GET /api/launchpad/kol/:kolId

API Route: GET /api/launchpad/kol/[kolId]

**Methods**: GET

**Path Parameters**:
- `kolId`

**Example Request**:
```bash
curl "https://opensvm.com/api/launchpad/kol/{kolId}"
```

**Source**: `app/api/launchpad/kol/[kolId]/route.ts`

---

### POST /api/launchpad/kol/:kolId/claim

**Methods**: POST

**Path Parameters**:
- `kolId`

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/launchpad/kol/{kolId}/claim" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/launchpad/kol/[kolId]/claim/route.ts`

---

### POST /api/launchpad/kol/apply

API Route: POST /api/launchpad/kol/apply

**Methods**: POST

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/launchpad/kol/apply" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/launchpad/kol/apply/route.ts`

---

### GET /api/launchpad/referral-links/:code

API Route: GET /api/launchpad/referral-links/[code]

**Methods**: GET

**Path Parameters**:
- `code`

**Example Request**:
```bash
curl "https://opensvm.com/api/launchpad/referral-links/{code}"
```

**Source**: `app/api/launchpad/referral-links/[code]/route.ts`

---

### GET, POST /api/launchpad/reports/daily

**Methods**: GET, POST

**Query Parameters**:
- `sale_id`
- `kol_id`
- `date`

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

API Route: GET /api/launchpad/sales

**Methods**: GET, POST

**Query Parameters**:
- `status`

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

API Route: GET /api/launchpad/sales/[saleId]

**Methods**: GET

**Path Parameters**:
- `saleId`

**Example Request**:
```bash
curl "https://opensvm.com/api/launchpad/sales/{saleId}"
```

**Source**: `app/api/launchpad/sales/[saleId]/route.ts`

---

### POST /api/launchpad/sales/:saleId/contribute

API Route: POST /api/launchpad/sales/[saleId]/contribute

**Methods**: POST

**Path Parameters**:
- `saleId`

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

**Path Parameters**:
- `saleId`

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/launchpad/sales/{saleId}/distribute_volume" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/launchpad/sales/[saleId]/distribute_volume/route.ts`

---

### POST /api/launchpad/sales/:saleId/referral-links

API Route: POST /api/launchpad/sales/[saleId]/referral-links

**Methods**: POST

**Path Parameters**:
- `saleId`

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/launchpad/sales/{saleId}/referral-links" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/launchpad/sales/[saleId]/referral-links/route.ts`

---

## Live-stats

### GET /api/live-stats

Real-time blockchain statistics

**Methods**: GET

**Example Request**:
```bash
curl "https://opensvm.com/api/live-stats"
```

**Source**: `app/api/live-stats/route.ts`

---

## Logging

### GET, POST /api/logging

**Methods**: GET, POST

**Example Request**:
```bash
curl "https://opensvm.com/api/logging"
curl -X POST "https://opensvm.com/api/logging" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/logging/route.ts`

---

## Market-data

### GET /api/market-data

**Methods**: GET

**Query Parameters**:
- `mint`
- `endpoint`
- `baseMint`
- `poolAddress`
- `type`
- `time_to`
- `time_from`
- `offset`

**Example Request**:
```bash
curl "https://opensvm.com/api/market-data?mint=value&endpoint=value&baseMint=value&poolAddress=value&type=value&time_to=value&time_from=value&offset=value"
```

**Source**: `app/api/market-data/route.ts`

---

## Mempool

### GET /api/mempool

Real-time mempool monitoring

**Methods**: GET

**Example Request**:
```bash
curl "https://opensvm.com/api/mempool"
```

**Source**: `app/api/mempool/route.ts`

---

## Metrics

### GET, POST /api/metrics

System metrics and performance data

**Methods**: GET, POST

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

**Query Parameters**:
- `timeframe`
- `endpoint`
- `method`
- `limit`
- `type`

**Example Request**:
```bash
curl "https://opensvm.com/api/monitoring/api?timeframe=value&endpoint=value&method=value&limit=value&type=value"
```

**Source**: `app/api/monitoring/api/route.ts`

---

### GET, POST, DELETE /api/monitoring/requests

**Methods**: GET, POST, DELETE

**Authentication**: Required

**Query Parameters**:
- `limit`
- `since`
- `method`
- `status`
- `path`
- `userId`
- `sessionId`
- `completedOnly`
- `stats`
- `timeframe`

**Example Request**:
```bash
curl "https://opensvm.com/api/monitoring/requests?limit=value&since=value&method=value&status=value&path=value&userId=value&sessionId=value&completedOnly=value&stats=value&timeframe=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
curl -X POST "https://opensvm.com/api/monitoring/requests" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/monitoring/requests/route.ts`

---

## Nft-collections

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

Real-time notifications stream

**Methods**: GET

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
- `title`
- `description`
- `type`

**Example Request**:
```bash
curl "https://opensvm.com/api/og?title=value&description=value&type=value"
```

**Source**: `app/api/og/route.tsx`

---

### GET /api/og/:entityType/:entityId

OG Image Generation API

**Methods**: GET

**Path Parameters**:
- `entityType`
- `entityId`

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

**Authentication**: Required

**Query Parameters**:
- `keyId`

**Example Request**:
```bash
curl "https://opensvm.com/api/opensvm/anthropic-keys?keyId=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
curl -X POST "https://opensvm.com/api/opensvm/anthropic-keys" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/opensvm/anthropic-keys/route.ts`

---

### GET, DELETE /api/opensvm/anthropic-keys/:keyId

Extract user ID from request with proper JWT validation

**Methods**: GET, DELETE

**Authentication**: Required

**Path Parameters**:
- `keyId`

**Example Request**:
```bash
curl "https://opensvm.com/api/opensvm/anthropic-keys/{keyId}" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/opensvm/anthropic-keys/[keyId]/route.ts`

---

### GET /api/opensvm/anthropic-keys/stats

GET /api/opensvm/anthropic-keys/stats

**Methods**: GET

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

**Authentication**: Required

**Query Parameters**:
- `period`
- `keyId`
- `model`
- `startDate`
- `endDate`
- `minCost`
- `maxCost`
- `minTokens`
- `maxTokens`
- `status`
- `sortBy`
- `sortOrder`
- `limit`
- `offset`
- `groupBy`
- `includeMetadata`

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

**Authentication**: Required

**Path Parameters**:
- `address`

**Example Request**:
```bash
curl "https://opensvm.com/api/program/{address}" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/program/[address]/route.ts`

---

## Program-accounts

### GET, POST /api/program-accounts

Generate PDA (Program Derived Address)

**Methods**: GET, POST

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

## Program-discovery

### GET, POST /api/program-discovery

GET /api/program-discovery

**Methods**: GET, POST

**Query Parameters**:
- `action`
- `programId`
- `query`
- `status`
- `limit`

**Example Request**:
```bash
curl "https://opensvm.com/api/program-discovery?action=value&programId=value&query=value&status=value&limit=value"
curl -X POST "https://opensvm.com/api/program-discovery" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/program-discovery/route.ts`

---

## Program-metadata

### GET, POST /api/program-metadata

**Methods**: GET, POST

**Authentication**: Required

**Query Parameters**:
- `programId`

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

## Program-registry

### GET, POST /api/program-registry

GET /api/program-registry

**Methods**: GET, POST

**Query Parameters**:
- `action`
- `programId`
- `category`
- `riskLevel`
- `instructionType`
- `query`
- `similar`

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

GET /api/program-registry/[programId]

**Methods**: GET, POST

**Query Parameters**:
- `include`
- `instruction`

**Path Parameters**:
- `programId`

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
- `cluster`

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

**Authentication**: Required

**Path Parameters**:
- `id`

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

API endpoint for getting a user's token balance

**Methods**: GET

**Authentication**: Required

**Query Parameters**:
- `walletAddress`

**Example Request**:
```bash
curl "https://opensvm.com/api/referrals/balance?walletAddress=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/referrals/balance/route.ts`

---

### POST /api/referrals/claim

API endpoint for claiming referral rewards

**Methods**: POST

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
- `q`
- `start`
- `end`
- `type`
- `status`
- `min`
- `max`

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

**Authentication**: Required

**Query Parameters**:
- `q`

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
- `q`
- `start`
- `end`
- `type`
- `status`
- `min`
- `max`

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

**Query Parameters**:
- `q`
- `query`
- `networks`
- `userId`

**Example Request**:
```bash
curl "https://opensvm.com/api/search/suggestions?q=value&query=value&networks=value&userId=value"
```

**Source**: `app/api/search/suggestions/route.ts`

---

### GET /api/search/suggestions/empty-state

Get live token data for latest items section from Qdrant

**Methods**: GET

**Example Request**:
```bash
curl "https://opensvm.com/api/search/suggestions/empty-state"
```

**Source**: `app/api/search/suggestions/empty-state/route.ts`

---

## Search-suggestions

### GET /api/search-suggestions

**Methods**: GET

**Query Parameters**:
- `q`

**Example Request**:
```bash
curl "https://opensvm.com/api/search-suggestions?q=value"
```

**Source**: `app/api/search-suggestions/route.ts`

---

## Share

### GET /api/share/:shareCode

Share Data API

**Methods**: GET

**Path Parameters**:
- `shareCode`

**Example Request**:
```bash
curl "https://opensvm.com/api/share/{shareCode}"
```

**Source**: `app/api/share/[shareCode]/route.ts`

---

### POST /api/share/click/:shareCode

Share Click Tracking API

**Methods**: POST

**Path Parameters**:
- `shareCode`

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/share/click/{shareCode}" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/share/click/[shareCode]/route.ts`

---

### POST /api/share/conversion

Share Conversion Tracking API

**Methods**: POST

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/share/conversion" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/share/conversion/route.ts`

---

### POST /api/share/generate

Share Generation API

**Methods**: POST

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

Share Statistics API

**Methods**: GET

**Path Parameters**:
- `walletAddress`

**Example Request**:
```bash
curl "https://opensvm.com/api/share/stats/{walletAddress}"
```

**Source**: `app/api/share/stats/[walletAddress]/route.ts`

---

## Slots

### GET /api/slots

Fetch slot details with caching

**Methods**: GET

**Query Parameters**:
- `limit`
- `fromSlot`

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

## Solana-proxy

### GET, POST /api/solana-proxy

**Methods**: GET, POST

**Query Parameters**:
- `transaction`

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
- `transaction`

**Example Request**:
```bash
curl "https://opensvm.com/api/solana-proxy/{transaction}"
```

**Source**: `app/api/solana-proxy/[transaction]/route.ts`

---

## Solana-rpc

### POST /api/solana-rpc

Solana RPC proxy API endpoint

**Methods**: POST

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/solana-rpc" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/solana-rpc/route.ts`

---

## Sse-alerts

### GET, DELETE /api/sse-alerts

**Methods**: GET, DELETE

**Authentication**: Required

**Query Parameters**:
- `clientId`
- `action`
- `eventTypes`

**Example Request**:
```bash
curl "https://opensvm.com/api/sse-alerts?clientId=value&action=value&eventTypes=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/sse-alerts/route.ts`

---

## Sse-events

### GET /api/sse-events/feed

Server-Sent Events (SSE) endpoint for real-time feed updates

**Methods**: GET

**Authentication**: Required

**Query Parameters**:
- `walletAddress`
- `type`

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

## Sse-feed

### GET, DELETE /api/sse-feed

**Methods**: GET, DELETE

**Query Parameters**:
- `clientId`
- `action`
- `feedType`
- `walletAddress`

**Example Request**:
```bash
curl "https://opensvm.com/api/sse-feed?clientId=value&action=value&feedType=value&walletAddress=value"
```

**Source**: `app/api/sse-feed/route.ts`

---

## Status

### GET, POST /api/status

System status

**Methods**: GET, POST

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

**Authentication**: Required

**Query Parameters**:
- `action`
- `clientId`

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

Real-time block stream endpoint using SSE

**Methods**: GET

**Example Request**:
```bash
curl "https://opensvm.com/api/stream/blocks"
```

**Source**: `app/api/stream/blocks/route.ts`

---

### GET /api/stream/transactions

Real-time transaction stream endpoint using SSE

**Methods**: GET

**Example Request**:
```bash
curl "https://opensvm.com/api/stream/transactions"
```

**Source**: `app/api/stream/transactions/route.ts`

---

## Test-qdrant

### GET /api/test-qdrant

**Methods**: GET

**Example Request**:
```bash
curl "https://opensvm.com/api/test-qdrant"
```

**Source**: `app/api/test-qdrant/route.ts`

---

## Test-token-balance

### GET /api/test-token-balance

**Methods**: GET

**Query Parameters**:
- `wallet`

**Example Request**:
```bash
curl "https://opensvm.com/api/test-token-balance?wallet=value"
```

**Source**: `app/api/test-token-balance/route.ts`

---

## Test-transaction

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

**Authentication**: Required

**Path Parameters**:
- `address`

**Example Request**:
```bash
curl "https://opensvm.com/api/token/{address}" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/token/[address]/route.ts`

---

### GET /api/token/:address/holders

**Methods**: GET

**Authentication**: Required

**Query Parameters**:
- `limit`
- `offset`
- `minBalance`
- `minVolume`
- `volumeHours`
- `sortBy`
- `order`
- `includeVolume`

**Path Parameters**:
- `address`

**Example Request**:
```bash
curl "https://opensvm.com/api/token/{address}/holders?limit=value&offset=value&minBalance=value&minVolume=value&volumeHours=value&sortBy=value&order=value&includeVolume=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/token/[address]/holders/route.ts`

---

### GET /api/token/:address/holdersByVolume

**Methods**: GET

**Query Parameters**:
- `limit`
- `offset`
- `minBalance`
- `minVolume`
- `period`

**Path Parameters**:
- `address`

**Example Request**:
```bash
curl "https://opensvm.com/api/token/{address}/holdersByVolume?limit=value&offset=value&minBalance=value&minVolume=value&period=value"
```

**Source**: `app/api/token/[address]/holdersByVolume/route.ts`

---

### GET /api/token/:address/traders

**Methods**: GET

**Query Parameters**:
- `includeVolume`
- `limit`
- `offset`
- `minBalance`
- `minVolume`
- `period`
- `sortBy`

**Path Parameters**:
- `address`

**Example Request**:
```bash
curl "https://opensvm.com/api/token/{address}/traders?includeVolume=value&limit=value&offset=value&minBalance=value&minVolume=value&period=value&sortBy=value"
```

**Source**: `app/api/token/[address]/traders/route.ts`

---

## Token-gating

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

## Token-metadata

### GET, POST /api/token-metadata

**Methods**: GET, POST

**Query Parameters**:
- `mint`

**Example Request**:
```bash
curl "https://opensvm.com/api/token-metadata?mint=value"
curl -X POST "https://opensvm.com/api/token-metadata" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/token-metadata/route.ts`

---

## Token-stats

### GET /api/token-stats/:account/:mint

**Methods**: GET

**Path Parameters**:
- `account`
- `mint`

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

Trades API - Fetch recent trades for a specific token

**Methods**: GET

**Query Parameters**:
- `mint`
- `limit`
- `type`
- `offset`

**Example Request**:
```bash
curl "https://opensvm.com/api/trades?mint=value&limit=value&type=value&offset=value"
```

**Source**: `app/api/trades/route.ts`

---

## Trading

### POST /api/trading/chat

**Methods**: POST

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

Generate a unique order ID

**Methods**: GET, POST, DELETE

**Query Parameters**:
- `orderId`

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
```

**Source**: `app/api/trading/execute/route.ts`

---

### GET /api/trading/market-data

Calculate price impact for a given trade size on an AMM

**Methods**: GET

**Authentication**: Required

**Query Parameters**:
- `market`

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

Fetch trending/top tokens from Birdeye API

**Methods**: GET

**Query Parameters**:
- `type`
- `limit`
- `dex`

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

Fetch all trading pools/pairs for a specific token from Birdeye API

**Methods**: GET

**Query Parameters**:
- `token`
- `symbol`
- `dex`

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

Calculate current PnL for a position

**Methods**: GET, POST, DELETE, PATCH

**Query Parameters**:
- `id`
- `status`
- `symbol`
- `closeAll`

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
```

**Source**: `app/api/trading/positions/route.ts`

---

### GET, POST /api/trading/stream

Trading Stream API - Real-Time Data via Server-Sent Events

**Methods**: GET, POST

**Query Parameters**:
- `market`
- `channels`

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

Fetch recent trades from Birdeye API

**Methods**: GET

**Query Parameters**:
- `mint`
- `limit`
- `source`

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
- `signature`

**Example Request**:
```bash
curl "https://opensvm.com/api/transaction?signature=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/transaction/route.ts`

---

### GET /api/transaction/:signature

**Methods**: GET

**Authentication**: Required

**Path Parameters**:
- `signature`

**Example Request**:
```bash
curl "https://opensvm.com/api/transaction/{signature}" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/transaction/[signature]/route.ts`

---

### GET, POST /api/transaction/:signature/analysis

**Methods**: GET, POST

**Query Parameters**:
- `includeInstructions`
- `includeAccountChanges`
- `includeMetrics`
- `includeFailureAnalysis`
- `detailed`

**Path Parameters**:
- `signature`

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

**Query Parameters**:
- `level`
- `focus`
- `includeRisks`
- `includeRecommendations`
- `regenerate`
- `language`

**Path Parameters**:
- `signature`

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

**Path Parameters**:
- `signature`

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

**Query Parameters**:
- `includeComparison`
- `includeBenchmarks`
- `includeRecommendations`
- `timeframe`

**Path Parameters**:
- `signature`

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

**Authentication**: Required

**Query Parameters**:
- `maxResults`
- `minScore`
- `relationshipTypes`
- `timeWindow`
- `includeMetadata`
- `sortBy`

**Path Parameters**:
- `signature`

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

**Path Parameters**:
- `signature`

**Example Request**:
```bash
curl "https://opensvm.com/api/transaction/mock/{signature}"
curl -X POST "https://opensvm.com/api/transaction/mock/{signature}" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/transaction/mock/[signature]/route.ts`

---

## Transaction-metrics

### GET, POST /api/transaction-metrics

GET /api/transaction-metrics

**Methods**: GET, POST

**Query Parameters**:
- `action`
- `signature`

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

GET /api/transaction-metrics/[signature]

**Methods**: GET, POST

**Query Parameters**:
- `include`

**Path Parameters**:
- `signature`

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
- `walletAddress`

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

## Usage-stats

### GET, POST /api/usage-stats

API usage statistics

**Methods**: GET, POST

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

## User-feed

### GET /api/user-feed/:walletAddress

User Feed API

**Methods**: GET

**Authentication**: Required

**Query Parameters**:
- `type`
- `realtime`
- `page`
- `limit`
- `dateRange`
- `eventTypes`
- `sort`

**Path Parameters**:
- `walletAddress`

**Example Request**:
```bash
curl "https://opensvm.com/api/user-feed/{walletAddress}?type=value&realtime=value&page=value&limit=value&dateRange=value&eventTypes=value&sort=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/user-feed/[walletAddress]/route.ts`

---

## User-history

### GET, POST, DELETE /api/user-history/:walletAddress

User History API Endpoints

**Methods**: GET, POST, DELETE

**Authentication**: Required

**Query Parameters**:
- `limit`
- `offset`
- `pageType`

**Path Parameters**:
- `walletAddress`

**Example Request**:
```bash
curl "https://opensvm.com/api/user-history/{walletAddress}?limit=value&offset=value&pageType=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
curl -X POST "https://opensvm.com/api/user-history/{walletAddress}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/user-history/[walletAddress]/route.ts`

---

### GET, POST /api/user-history/repair

User History Repair API

**Methods**: GET, POST

**Authentication**: Required

**Query Parameters**:
- `walletAddress`

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

User History Sync API

**Methods**: POST

**Example Request**:
```bash
curl -X POST "https://opensvm.com/api/user-history/sync" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Source**: `app/api/user-history/sync/route.ts`

---

## User-profile

### GET, PUT /api/user-profile/:walletAddress

User Profile API Endpoints

**Methods**: GET, PUT

**Authentication**: Required

**Path Parameters**:
- `walletAddress`

**Example Request**:
```bash
curl "https://opensvm.com/api/user-profile/{walletAddress}" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/user-profile/[walletAddress]/route.ts`

---

### GET, POST /api/user-profile/sync

User Profile Statistics Synchronization API

**Methods**: GET, POST

**Authentication**: Required

**Query Parameters**:
- `walletAddress`

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

## User-social

### POST /api/user-social/follow

API endpoint for following users

**Methods**: POST

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

User Social Follow API Endpoints

**Methods**: GET, POST, DELETE

**Authentication**: Required

**Query Parameters**:
- `type`

**Path Parameters**:
- `targetAddress`

**Example Request**:
```bash
curl "https://opensvm.com/api/user-social/follow/{targetAddress}?type=value" \
  -H "Authorization: Bearer YOUR_API_KEY"
curl -X POST "https://opensvm.com/api/user-social/follow/{targetAddress}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/user-social/follow/[targetAddress]/route.ts`

---

### POST /api/user-social/like

API endpoint for liking user profiles

**Methods**: POST

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

API endpoint for liking/unliking feed events

**Methods**: POST

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

User Social Like API Endpoints

**Methods**: GET, POST, DELETE

**Authentication**: Required

**Path Parameters**:
- `targetAddress`

**Example Request**:
```bash
curl "https://opensvm.com/api/user-social/like/{targetAddress}" \
  -H "Authorization: Bearer YOUR_API_KEY"
curl -X POST "https://opensvm.com/api/user-social/like/{targetAddress}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"key":"value"}'
```

**Source**: `app/api/user-social/like/[targetAddress]/route.ts`

---

### POST /api/user-social/unfollow

API endpoint for unfollowing users

**Methods**: POST

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

API endpoint for unliking user profiles

**Methods**: POST

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

API endpoint for unliking feed events

**Methods**: POST

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

API endpoint for tracking profile views

**Methods**: POST

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

## User-tab-preference

### GET, PUT /api/user-tab-preference/:walletAddress

User Tab Preference API Endpoints

**Methods**: GET, PUT

**Authentication**: Required

**Path Parameters**:
- `walletAddress`

**Example Request**:
```bash
curl "https://opensvm.com/api/user-tab-preference/{walletAddress}" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Source**: `app/api/user-tab-preference/[walletAddress]/route.ts`

---

## V1

### POST /api/v1/messages

**Methods**: POST

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

Fetch real stakers delegated to a specific validator

**Methods**: GET, POST

**Authentication**: Required

**Path Parameters**:
- `address`

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

API version information

**Methods**: GET, POST

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

## Wallet-path-finding

### POST /api/wallet-path-finding

Handle the wallet path finding request

**Methods**: POST

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

## Websocket-info

### GET /api/websocket-info

WebSocket info endpoint

**Methods**: GET

**Example Request**:
```bash
curl "https://opensvm.com/api/websocket-info"
```

**Source**: `app/api/websocket-info/route.ts`

---

