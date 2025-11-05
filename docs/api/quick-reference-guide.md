# OpenSVM API Quick Reference Guide

## Most Common API Endpoints

### 🚀 Essential Endpoints for Getting Started

#### 1. Get Account Information
```bash
# Get account balance and stats
curl -X GET "http://localhost:3000/api/account-stats/YOUR_WALLET_ADDRESS"

# Get account transaction history
curl -X GET "http://localhost:3000/api/account-transactions/YOUR_WALLET_ADDRESS?limit=10"

# Get account portfolio (tokens, NFTs, etc.)
curl -X GET "http://localhost:3000/api/account-portfolio/YOUR_WALLET_ADDRESS"
```

#### 2. Transaction Operations
```bash
# Get transaction details
curl -X GET "http://localhost:3000/api/transaction/YOUR_SIGNATURE"

# Analyze transaction with AI
curl -X GET "http://localhost:3000/api/transaction/YOUR_SIGNATURE/analysis"

# Get human-readable explanation
curl -X GET "http://localhost:3000/api/transaction/YOUR_SIGNATURE/explain"
```

#### 3. Token Information
```bash
# Get token metadata
curl -X GET "http://localhost:3000/api/token-metadata?mints=TOKEN_MINT_ADDRESS"

# Get token price (for specific tokens like SVMAI)
curl -X GET "http://localhost:3000/api/token/TOKEN_MINT_ADDRESS"
```

#### 4. AI-Powered Q&A
```bash
# Ask questions about blockchain data
curl -X POST "http://localhost:3000/api/getAnswer" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is the current price of SOL?"
  }'
```

#### 5. Block Information
```bash
# Get latest blocks
curl -X GET "http://localhost:3000/api/blocks?limit=5"

# Get block statistics
curl -X GET "http://localhost:3000/api/blocks/stats"
```

## 📊 Common Use Cases

### Use Case 1: Tracking Wallet Activity
```javascript
// JavaScript Example
async function getWalletActivity(address) {
  // Get balance and stats
  const stats = await fetch(`/api/account-stats/${address}`);
  
  // Get recent transactions
  const transactions = await fetch(
    `/api/account-transactions/${address}?limit=50`
  );
  
  // Get token holdings
  const portfolio = await fetch(`/api/account-portfolio/${address}`);
  
  return {
    stats: await stats.json(),
    transactions: await transactions.json(),
    portfolio: await portfolio.json()
  };
}
```

### Use Case 2: Analyzing Token Performance
```javascript
async function analyzeToken(mintAddress) {
  // Get token metadata
  const metadata = await fetch(`/api/token-metadata?mints=${mintAddress}`);
  
  // Get token stats
  const stats = await fetch(`/api/token/${mintAddress}`);
  
  // Ask AI for analysis
  const analysis = await fetch('/api/getAnswer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: `Analyze the token ${mintAddress} performance and trading volume`
    })
  });
  
  return {
    metadata: await metadata.json(),
    stats: await stats.json(),
    analysis: await analysis.json()
  };
}
```

### Use Case 3: Real-Time Monitoring
```javascript
// Subscribe to real-time updates
const eventSource = new EventSource('/api/sse-feed');

eventSource.onmessage = (event) => {
  const transaction = JSON.parse(event.data);
  console.log('New transaction:', transaction);
  
  // Process transaction
  if (transaction.type === 'transfer') {
    handleTransfer(transaction);
  }
};

eventSource.onerror = (error) => {
  console.error('SSE Error:', error);
  eventSource.close();
};
```

### Use Case 4: DeFi Analytics
```javascript
async function getDeFiMetrics() {
  // Get overall DeFi stats
  const overview = await fetch('/api/analytics/overview');
  
  // Get DEX analytics
  const dexData = await fetch('/api/analytics/dex?timeframe=24h');
  
  // Get DeFi health metrics
  const health = await fetch('/api/analytics/defi-health');
  
  return {
    overview: await overview.json(),
    dexData: await dexData.json(),
    health: await health.json()
  };
}
```

## 🔑 Key Patterns

### Error Handling Pattern
```javascript
async function safeApiCall(url, options = {}) {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      if (response.status === 429) {
        // Rate limited - wait and retry
        await new Promise(resolve => setTimeout(resolve, 60000));
        return safeApiCall(url, options);
      }
      throw new Error(`API Error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API Call Failed:', error);
    return null;
  }
}
```

### Batch Operations Pattern
```javascript
// Instead of multiple calls
const signatures = ['sig1', 'sig2', 'sig3'];

// Use batch endpoint
const batchResponse = await fetch('/api/transaction/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    signatures,
    includeDetails: true
  })
});
```

### Pagination Pattern
```javascript
async function getAllTransactions(address) {
  let allTransactions = [];
  let cursor = null;
  let hasMore = true;
  
  while (hasMore) {
    const url = cursor 
      ? `/api/account-transactions/${address}?before=${cursor}`
      : `/api/account-transactions/${address}`;
      
    const response = await fetch(url);
    const data = await response.json();
    
    allTransactions = [...allTransactions, ...data.data];
    cursor = data.pagination?.cursor;
    hasMore = data.pagination?.hasMore || false;
  }
  
  return allTransactions;
}
```

## ⚡ Performance Tips

### 1. Use Caching
```javascript
const cache = new Map();
const CACHE_TTL = 60000; // 1 minute

async function cachedFetch(url) {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const data = await fetch(url).then(r => r.json());
  cache.set(url, { data, timestamp: Date.now() });
  return data;
}
```

### 2. Parallel Requests
```javascript
// Fetch multiple resources in parallel
async function getAccountData(address) {
  const [stats, transactions, portfolio] = await Promise.all([
    fetch(`/api/account-stats/${address}`),
    fetch(`/api/account-transactions/${address}`),
    fetch(`/api/account-portfolio/${address}`)
  ]);
  
  return {
    stats: await stats.json(),
    transactions: await transactions.json(),
    portfolio: await portfolio.json()
  };
}
```

### 3. Use Appropriate Endpoints
```javascript
// ❌ Don't make multiple calls for related data
const tx1 = await fetch('/api/transaction/sig1');
const tx2 = await fetch('/api/transaction/sig2');

// ✅ Use batch endpoints
const transactions = await fetch('/api/transaction/batch', {
  method: 'POST',
  body: JSON.stringify({ signatures: ['sig1', 'sig2'] })
});
```

## 🔍 Common Queries

### Token Queries
```bash
# Check if token is valid
curl "http://localhost:3000/api/check-token?mint=TOKEN_ADDRESS"

# Get token holders
curl "http://localhost:3000/api/token/TOKEN_ADDRESS"

# Get token price history (via Moralis)
# Use through /api/getAnswer endpoint
```

### Search Queries
```bash
# Universal search
curl "http://localhost:3000/api/search?q=SOL"

# Search for accounts
curl "http://localhost:3000/api/search/accounts?q=whale"

# Get search suggestions
curl "http://localhost:3000/api/search/suggestions?q=defi"
```

### Analytics Queries
```bash
# DeFi overview
curl "http://localhost:3000/api/analytics/overview"

# Validator stats
curl "http://localhost:3000/api/analytics/validators"

# NFT marketplace data
curl "http://localhost:3000/api/analytics/marketplaces"
```

## 🎯 Specific Token Example: $SVMAI

### Get SVMAI Token Information
```javascript
// SVMAI token mint address (example - replace with actual)
const SVMAI_MINT = 'YOUR_SVMAI_MINT_ADDRESS';

async function getSVMAIInfo() {
  // Method 1: Direct token endpoint
  const tokenInfo = await fetch(`/api/token/${SVMAI_MINT}`);
  
  // Method 2: Through AI endpoint for comprehensive data
  const aiResponse = await fetch('/api/getAnswer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: 'What is the current price, market cap, and trading volume for $SVMAI?'
    })
  });
  
  // Method 3: Token metadata
  const metadata = await fetch(`/api/token-metadata?mints=${SVMAI_MINT}`);
  
  return {
    directInfo: await tokenInfo.json(),
    aiAnalysis: await aiResponse.json(),
    metadata: await metadata.json()
  };
}
```

## 📝 Response Format Examples

### Success Response
```json
{
  "success": true,
  "data": {
    "address": "...",
    "balance": 1000000000,
    "tokens": [...]
  },
  "timestamp": "2024-10-31T13:00:00Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "INVALID_ADDRESS",
    "message": "The provided address is not valid",
    "details": {}
  }
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 1000,
    "limit": 100,
    "offset": 0,
    "hasMore": true,
    "cursor": "next_cursor"
  }
}
```

## 🚦 Rate Limits

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| Public endpoints | 100 req | 1 minute |
| Authenticated | 1000 req | 1 minute |
| AI endpoints | 50 req | 1 minute |
| Streaming | No limit | - |

## 🛠️ Troubleshooting

### Common Issues and Solutions

1. **429 Too Many Requests**
   - Implement exponential backoff
   - Use batch endpoints
   - Cache responses

2. **404 Not Found**
   - Verify address/signature format
   - Check if resource exists on-chain
   - Ensure correct network (mainnet/devnet)

3. **500 Internal Server Error**
   - Check server logs
   - Verify request payload format
   - Retry with exponential backoff

4. **Timeout Errors**
   - Use streaming endpoints for large data
   - Implement pagination
   - Reduce request complexity

## 📚 Additional Resources

- **Full Documentation**: `/docs/api/api-reference.md`
- **LLM Reference**: `/llms.txt`
- **Verification Script**: `/scripts/verify-api-methods.js`
- **API Summary**: `/docs/api/api-documentation-summary.md`

## Quick Test Commands

```bash
# Test if API is running
curl http://localhost:3000/api/blocks/stats

# Test AI endpoint
curl -X POST http://localhost:3000/api/getAnswer \
  -H "Content-Type: application/json" \
  -d '{"question":"What is Solana?"}'

# Test search
curl "http://localhost:3000/api/search?q=SOL"

# Test account info
curl "http://localhost:3000/api/account-stats/11111111111111111111111111111111"
