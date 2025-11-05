# OpenSVM API Index

## Complete Endpoint Index by Functionality

### 🔍 Finding Data

#### Search for Anything
- `GET /api/search?q={query}` - Universal search
- `GET /api/search/accounts?q={query}` - Search accounts
- `GET /api/search/filtered` - Advanced filtered search
- `GET /api/search/suggestions?q={query}` - Get suggestions

#### Discover Programs
- `GET /api/program-discovery` - Find Solana programs
- `GET /api/program-registry` - List registered programs
- `GET /api/program/{address}` - Get program details
- `GET /api/program-metadata?programs={ids}` - Batch metadata

### 💰 Account & Wallet Data

#### Account Information
- `GET /api/account-stats/{address}` - Complete account statistics
- `GET /api/account-portfolio/{address}` - Portfolio overview
- `GET /api/check-account-type?address={addr}` - Determine account type

#### Transaction History
- `GET /api/account-transactions/{address}` - Transaction history with date filtering
- `GET /api/account-transfers/{address}` - SOL/token transfers
- `GET /api/user-history/{walletAddress}` - User transaction history

#### Token Holdings
- `GET /api/account-token-stats/{address}/{mint}` - Token-specific stats
- `GET /api/token-stats/{account}/{mint}` - Alternative token stats endpoint

### 📊 Transactions

#### Single Transaction
- `GET /api/transaction/{signature}` - Get transaction details
- `GET /api/transaction/{signature}/analysis` - AI analysis
- `GET /api/transaction/{signature}/explain` - Human-readable explanation
- `GET /api/transaction/{signature}/metrics` - Performance metrics
- `GET /api/transaction/{signature}/related` - Find related transactions
- `GET /api/transaction/{signature}/failure-analysis` - Analyze failures

#### Batch Operations
- `POST /api/transaction/batch` - Fetch multiple transactions

#### Filtering & Analysis
- `POST /api/filter-transactions` - Filter by criteria
- `POST /api/analyze-transaction` - Deep AI analysis

### 🔷 Blockchain Data

#### Blocks
- `GET /api/blocks` - Recent blocks
- `GET /api/blocks/{slot}` - Specific block
- `GET /api/blocks/stats` - Block statistics
- `GET /api/block?slot={slot}` - Legacy block endpoint

#### Network
- `GET /api/slots` - Current slot information
- `POST /api/solana-rpc` - Direct RPC calls
- `POST /api/solana-proxy` - Proxied RPC with caching

### 🪙 Tokens & NFTs

#### Token Information
- `GET /api/token/{address}` - Token details
- `GET /api/token-metadata?mints={mints}` - Batch metadata
- `GET /api/check-token?mint={mint}` - Validate token

#### NFT Collections
- `GET /api/nft-collections` - List collections
- `GET /api/nft-collections/trending` - Trending NFTs
- `GET /api/nft-collections/new` - New collections
- `GET /api/nfts/collections` - Alternative endpoint

### 📈 Analytics

#### DeFi Analytics
- `GET /api/analytics/overview` - DeFi ecosystem overview
- `GET /api/analytics/dex` - DEX analytics
- `GET /api/analytics/defi-health` - Health metrics
- `GET /api/dex/{name}` - Specific DEX data

#### Validator Analytics
- `GET /api/analytics/validators` - Validator overview
- `GET /api/analytics/trending-validators` - Top validators
- `GET /api/validator/{address}` - Specific validator

#### Market Analytics
- `GET /api/analytics/marketplaces` - NFT marketplaces
- `GET /api/analytics/aggregators` - DeFi aggregators
- `GET /api/analytics/launchpads` - Token launchpads
- `GET /api/analytics/bots` - Trading bot activity

#### Social & GameFi
- `GET /api/analytics/socialfi` - SocialFi metrics
- `GET /api/analytics/infofi` - Information finance
- `GET /api/analytics/defai` - AI-powered DeFi

### 🤖 AI-Powered Features

#### Question Answering
- `POST /api/getAnswer` - Ask questions about blockchain data
- `POST /api/getSimilarQuestions` - Find similar questions
- `GET /api/getSources` - Available data sources

#### AI Analysis
- `POST /api/analyze` - General analysis
- `POST /api/ai-response` - Generate AI responses
- `GET /api/ai-context` - Get conversation context

### 📡 Real-Time Data

#### Server-Sent Events
- `GET /api/sse-feed` - Transaction feed
- `GET /api/sse-events/feed` - Event feed
- `GET /api/sse-alerts` - Real-time alerts

#### Streaming
- `GET /api/stream` - Data stream
- `POST /api/stream` - Create subscription
- `GET /api/scan` - Blockchain scanning

### 👤 User Management

#### Profile Management
- `GET /api/user-profile/{walletAddress}` - Get profile
- `PUT /api/user-profile/{walletAddress}` - Update profile
- `POST /api/user-profile/sync` - Sync profile

#### Preferences
- `GET /api/user-tab-preference/{walletAddress}` - Get preferences
- `PUT /api/user-tab-preference/{walletAddress}` - Update preferences

#### Social Features
- `POST /api/user-social/follow` - Follow user
- `POST /api/user-social/unfollow` - Unfollow
- `POST /api/user-social/like` - Like content
- `POST /api/user-social/unlike` - Unlike
- `POST /api/user-social/view` - Track views

#### User Feed
- `GET /api/user-feed/{walletAddress}` - Personal feed

### 💎 Premium Features

#### Token Gating
- `GET /api/token-gating/check` - Check access

#### Monetization
- `GET /api/monetization/balance` - Get balance
- `POST /api/monetization/consume` - Use credits
- `POST /api/monetization/earn` - Earn credits

### 📊 Trading Terminal

#### Market Data
- `GET /api/trading/market-data` - Real-time prices

#### Position Management
- `GET /api/trading/positions` - View positions
- `POST /api/trading/positions` - Open position
- `PATCH /api/trading/positions` - Modify position
- `DELETE /api/trading/positions` - Close position

#### Trade Execution
- `POST /api/trading/execute` - Execute trade
- `GET /api/trading/execute` - Check status

### 🔧 System & Monitoring

#### Health Checks
- `GET /api/health/anthropic` - Anthropic API health
- `GET /api/monitoring/api` - API metrics
- `GET /api/monitoring/requests` - Request logs

#### Error Tracking
- `POST /api/error-tracking` - Report errors
- `GET /api/error-tracking` - Get error logs
- `POST /api/crash-reporting` - Report crashes

### 🔐 Authentication

- `POST /api/auth/verify` - Verify wallet signature
- `POST /api/auth/session` - Create session
- `POST /api/auth/logout` - Logout

### 🔗 Sharing & Referrals

#### Share Content
- `POST /api/share/generate` - Generate share link
- `GET /api/share/{shareCode}` - Get shared content
- `POST /api/share/click/{shareCode}` - Track clicks
- `POST /api/share/conversion` - Track conversions
- `GET /api/share/stats/{walletAddress}` - Share statistics

#### Referrals
- `POST /api/referrals/claim` - Claim referral
- `GET /api/referrals/balance` - Check balance

### 🛠️ Utilities

- `GET /api/favicon` - Get favicon
- `GET /api/og` - Open Graph metadata
- `POST /api/wallet-path-finding` - Find wallet connections
- `GET /api/docs/page` - Documentation page
- `GET /api/docs/openapi` - OpenAPI spec

## 📊 Endpoint Count by Category

| Category | Count | Description |
|----------|-------|-------------|
| Blockchain Core | 17 | Transactions, blocks, accounts |
| Analytics | 12 | DeFi, validators, markets |
| Token & NFT | 7 | Token data, NFT collections |
| AI-Powered | 6 | Q&A, analysis, responses |
| Search & Discovery | 9 | Universal search, programs |
| User Services | 14 | Profiles, history, social |
| Real-Time | 6 | SSE, streaming |
| Trading | 5 | Market data, positions |
| Monitoring | 6 | Health, errors, logs |
| Authentication | 3 | Wallet verification |
| Sharing | 7 | Share links, referrals |
| Utilities | 5 | Misc helpers |

**Total Endpoints: 97 Core API Routes**

## 🔌 External Integrations

### Moralis API (24 methods)
Access via `/api/getAnswer` AI execution:
- Token prices and metadata
- NFT collections and metadata
- Portfolio data
- Transaction history
- Domain resolution
- Market data

### Solana RPC (8 methods)
Direct blockchain access:
- Account information
- Network statistics
- Block details
- Transaction parsing
- Address validation

## 🎯 Quick Links to Common Tasks

| Task | Endpoint |
|------|----------|
| Get wallet balance | `/api/account-stats/{address}` |
| Check transaction | `/api/transaction/{signature}` |
| Search for tokens | `/api/search?q={token}` |
| Get token price | `/api/token/{mint}` |
| Track portfolio | `/api/account-portfolio/{address}` |
| Ask AI questions | `POST /api/getAnswer` |
| Monitor real-time | `/api/sse-feed` |
| Get block info | `/api/blocks/stats` |
| Analyze DeFi | `/api/analytics/overview` |
| Find programs | `/api/program-discovery` |

## 🌐 Network Support

All endpoints support network selection via query parameter:
- `?network=mainnet` (default)
- `?network=devnet`
- `?network=testnet`

Example: `/api/account-stats/{address}?network=devnet`

## 📝 Notes

1. **Authentication**: Most endpoints are public. Protected endpoints require JWT Bearer token.
2. **Rate Limits**: 100 req/min (public), 1000 req/min (authenticated)
3. **Response Format**: JSON with `success`, `data`, and optional `pagination`
4. **Error Codes**: Standard HTTP status codes (200, 400, 401, 404, 429, 500, 503)
5. **Date Filtering**: Use ISO 8601 format for date parameters
