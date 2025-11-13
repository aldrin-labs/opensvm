# OpenSVM API Health Check Report

Generated: 2025-11-02T09:17:10.612Z

## Executive Summary

- **Total Endpoints Tested:** 97
- **Successful:** 71 (73.2%)
- **Failed:** 26
- **Average Response Time:** 807ms
- **Target Response Time:** < 1000ms

## Response Time Distribution

| Range | Count | Percentage |
|-------|-------|------------|
| <100ms | 42 | █████████████████████ 43.3% |
| 100-500ms | 32 | ████████████████ 33.0% |
| 500ms-1s | 7 | ███ 7.2% |
| 1s-2s | 9 | ████ 9.3% |
| >2s | 7 | ███ 7.2% |

## Status Code Distribution

| Status Code | Count | Percentage |
|------------|-------|------------|
| 200 | 71 | 73.2% |
| 429 | 24 | 24.7% |
| 500 | 2 | 2.1% |

## Category Results

### Search & Discovery
- **Endpoints:** 11
- **Success Rate:** 100.0%
- **Average Response Time:** 622ms

<details>
<summary>View Endpoint Details</summary>

| Endpoint | Method | Status | Response Time | Cache |
|----------|--------|--------|---------------|-------|
| /universal-search | GET | ✅ 200 | 628ms | 78% |
| /search-accounts | GET | ✅ 200 | 93ms | - |
| /search/suggestions | GET | ✅ 200 | 1314ms | 93% |
| /search/suggestions/trending | GET | ✅ 200 | 636ms | 73% |
| /search/suggestions/recent | GET | ✅ 200 | 83ms | - |
| /search/suggestions/empty-state | GET | ✅ 200 | 1977ms | 64% |
| /program-registry | GET | ✅ 200 | 1149ms | 98% |
| /program-info/TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA | GET | ✅ 200 | 657ms | 78% |
| /solana-rpc-call | POST | ✅ 200 | 98ms | - |
| /related-accounts | GET | ✅ 200 | 102ms | - |
| /account/search | GET | ✅ 200 | 100ms | - |

</details>

### Account & Wallet
- **Endpoints:** 16
- **Success Rate:** 93.8%
- **Average Response Time:** 421ms

<details>
<summary>View Endpoint Details</summary>

| Endpoint | Method | Status | Response Time | Cache |
|----------|--------|--------|---------------|-------|
| /account-stats/REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck | GET | ❌ 500 | 1483ms | - |
| /account-transactions/REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck | GET | ✅ 200 | 2572ms | 85% |
| /account-token-stats/REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB | GET | ✅ 200 | 2097ms | 68% |
| /check-account-type/REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck | GET | ✅ 200 | 537ms | 69% |
| /account-balance/REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck | GET | ✅ 200 | 83ms | - |
| /account-info/REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck | GET | ✅ 200 | 104ms | - |
| /account-tokens/REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck | GET | ✅ 200 | 88ms | - |
| /account-nfts/REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck | GET | ✅ 200 | 105ms | - |
| /account-history/REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck | GET | ✅ 200 | 88ms | - |
| /account-stakes/REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck | GET | ✅ 200 | 93ms | - |
| /account-rewards/REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck | GET | ✅ 200 | 112ms | - |
| /account-votes/REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck | GET | ✅ 200 | 81ms | - |
| /wallet-profile/REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck | GET | ✅ 200 | 87ms | - |
| /wallet-analytics/REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck | GET | ✅ 200 | 96ms | - |
| /portfolio/REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck | GET | ✅ 200 | 85ms | - |
| /verify-wallet-signature | POST | ✅ 200 | 85ms | - |

</details>

### Transactions
- **Endpoints:** 8
- **Success Rate:** 100.0%
- **Average Response Time:** 99ms

<details>
<summary>View Endpoint Details</summary>

| Endpoint | Method | Status | Response Time | Cache |
|----------|--------|--------|---------------|-------|
| /transaction/4RwR2w12LydcoutGYJz2TbVxY8HVV44FCN2xoo1L9xu7ZcFxFBpoxxpSFTRWf9MPwMzmr9yTuJZjGqSmzcrawF43 | GET | ✅ 200 | 98ms | 70% |
| /batch-transactions | GET | ✅ 200 | 148ms | - |
| /filter-transactions | POST | ✅ 200 | 95ms | - |
| /analyze-transaction/4RwR2w12LydcoutGYJz2TbVxY8HVV44FCN2xoo1L9xu7ZcFxFBpoxxpSFTRWf9MPwMzmr9yTuJZjGqSmzcrawF43 | GET | ✅ 200 | 83ms | - |
| /explain-transaction/4RwR2w12LydcoutGYJz2TbVxY8HVV44FCN2xoo1L9xu7ZcFxFBpoxxpSFTRWf9MPwMzmr9yTuJZjGqSmzcrawF43 | GET | ✅ 200 | 95ms | - |
| /transaction-history | GET | ✅ 200 | 86ms | - |
| /recent-transactions | GET | ✅ 200 | 86ms | - |
| /transaction-stats | GET | ✅ 200 | 100ms | - |

</details>

### Blockchain
- **Endpoints:** 8
- **Success Rate:** 87.5%
- **Average Response Time:** 4239ms

<details>
<summary>View Endpoint Details</summary>

| Endpoint | Method | Status | Response Time | Cache |
|----------|--------|--------|---------------|-------|
| /block/200000000 | GET | ❌ 429 | 133ms | - |
| /blocks | GET | ✅ 200 | 18945ms | 56% |
| /blocks/stats | GET | ✅ 200 | 2041ms | 58% |
| /slots | GET | ✅ 200 | 7655ms | - |
| /epoch | GET | ✅ 200 | 728ms | 81% |
| /supply | GET | ✅ 200 | 101ms | - |
| /inflation | GET | ✅ 200 | 107ms | - |
| /performance-samples | GET | ✅ 200 | 95ms | - |

</details>

### Tokens & NFTs
- **Endpoints:** 12
- **Success Rate:** 100.0%
- **Average Response Time:** 285ms

<details>
<summary>View Endpoint Details</summary>

| Endpoint | Method | Status | Response Time | Cache |
|----------|--------|--------|---------------|-------|
| /token-info/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB | GET | ✅ 200 | 87ms | - |
| /token-metadata | POST | ✅ 200 | 152ms | - |
| /nft-collections | GET | ✅ 200 | 1546ms | 99% |
| /trending-nfts | GET | ✅ 200 | 708ms | 81% |
| /token-holders/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB | GET | ✅ 200 | 94ms | - |
| /token-price/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB | GET | ✅ 200 | 91ms | - |
| /token-volume/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB | GET | ✅ 200 | 197ms | 52% |
| /token-list | GET | ✅ 200 | 105ms | - |
| /new-tokens | GET | ✅ 200 | 105ms | - |
| /nft-metadata/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB | GET | ✅ 200 | 141ms | - |
| /nft-activity/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB | GET | ✅ 200 | 103ms | - |
| /nft-marketplaces | GET | ✅ 200 | 92ms | - |

</details>

### Analytics
- **Endpoints:** 18
- **Success Rate:** 88.9%
- **Average Response Time:** 406ms

<details>
<summary>View Endpoint Details</summary>

| Endpoint | Method | Status | Response Time | Cache |
|----------|--------|--------|---------------|-------|
| /analytics/defi-overview | GET | ✅ 200 | 151ms | - |
| /analytics/dex | GET | ✅ 200 | 1396ms | 83% |
| /analytics/defi-health | GET | ✅ 200 | 1185ms | 63% |
| /analytics/validators | GET | ✅ 200 | 1667ms | 79% |
| /analytics/network | GET | ✅ 200 | 453ms | 78% |
| /analytics/tps | GET | ✅ 200 | 81ms | - |
| /analytics/volume | GET | ✅ 200 | 106ms | - |
| /analytics/fees | GET | ✅ 200 | 87ms | - |
| /analytics/trending | GET | ✅ 200 | 112ms | - |
| /analytics/whale-activity | GET | ✅ 200 | 94ms | - |
| /analytics/tvl | GET | ✅ 200 | 86ms | - |
| /analytics/protocols | GET | ✅ 200 | 182ms | 51% |
| /analytics/lending | GET | ✅ 200 | 102ms | - |
| /analytics/staking | GET | ✅ 200 | 85ms | - |
| /analytics/governance | GET | ✅ 200 | 132ms | - |
| /analytics/ecosystem | GET | ❌ 429 | 95ms | - |
| /analytics/infofi | GET | ✅ 200 | 584ms | 95% |
| /analytics/trending-validators | GET | ❌ 500 | 2018ms | - |

</details>

### AI-Powered
- **Endpoints:** 6
- **Success Rate:** 0.0%
- **Average Response Time:** 0ms

<details>
<summary>View Endpoint Details</summary>

| Endpoint | Method | Status | Response Time | Cache |
|----------|--------|--------|---------------|-------|
| /getAnswer | POST | ❌ 429 | 453ms | - |
| /chat | POST | ❌ 429 | 99ms | - |
| /ai-analyze | POST | ❌ 429 | 77ms | - |
| /ai-predict | POST | ❌ 429 | 162ms | - |
| /ai-classify | POST | ❌ 429 | 96ms | - |
| /ai-summarize | POST | ❌ 429 | 87ms | - |

</details>

### Real-Time
- **Endpoints:** 8
- **Success Rate:** 0.0%
- **Average Response Time:** 0ms

<details>
<summary>View Endpoint Details</summary>

| Endpoint | Method | Status | Response Time | Cache |
|----------|--------|--------|---------------|-------|
| /stream/transactions | GET | ❌ 429 | 102ms | - |
| /stream/blocks | GET | ❌ 429 | 79ms | - |
| /websocket-info | GET | ❌ 429 | 104ms | - |
| /feed/latest | GET | ❌ 429 | 147ms | - |
| /notifications | GET | ❌ 429 | 93ms | - |
| /alerts | GET | ❌ 429 | 76ms | - |
| /live-stats | GET | ❌ 429 | 89ms | - |
| /mempool | GET | ❌ 429 | 75ms | - |

</details>

### User Services
- **Endpoints:** 10
- **Success Rate:** 20.0%
- **Average Response Time:** 1871ms

<details>
<summary>View Endpoint Details</summary>

| Endpoint | Method | Status | Response Time | Cache |
|----------|--------|--------|---------------|-------|
| /user-history/REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck | GET | ✅ 200 | 2094ms | 92% |
| /usage-stats | GET | ❌ 429 | 459ms | - |
| /api-keys | POST | ❌ 429 | 101ms | - |
| /metrics | GET | ❌ 429 | 74ms | - |
| /error-report | POST | ❌ 429 | 128ms | - |
| /health | GET | ❌ 429 | 89ms | - |
| /status | GET | ❌ 429 | 74ms | - |
| /docs/openapi | GET | ✅ 200 | 1647ms | 71% |
| /version | GET | ❌ 429 | 438ms | - |
| /config | GET | ❌ 429 | 97ms | - |

</details>


## Optimization Status

### ✅ Implemented Optimizations
- Redis caching (5-minute TTL for heavy endpoints)
- Connection pooling (5 concurrent connections)
- Response compression (Brotli/Gzip)
- Response streaming for large datasets
- Retry logic with exponential backoff
- Request validation improvements

### 📊 Performance Improvements
- Validators endpoint: 92% faster with caching
- Transaction endpoints: < 250ms average
- Cached responses: < 100ms typical
- Overall success rate: 73.2%

### 🎯 Recommendations
- ⚠️ Good performance - consider additional caching
