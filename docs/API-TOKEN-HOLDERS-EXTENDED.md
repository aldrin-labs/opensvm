# Token Holders API Documentation - Extended Endpoints

## Overview
Extended API endpoints for advanced token holder analysis, trading activity, and program interaction tracking on Solana.

## Base URL
```
http://localhost:3000/api
```

## Endpoints

### 1. Token Traders Endpoint
**GET** `/token/{address}/traders`

Fetches token holders with trading activity analysis. Defaults to including volume data.

#### Parameters
- `address` (path, required): Token mint address
- `limit` (query, optional): Max results per page (default: 100, max: 1000)
- `offset` (query, optional): Pagination offset (default: 0)
- `minBalance` (query, optional): Minimum token balance filter (default: 0)
- `minVolume` (query, optional): Minimum trading volume filter (default: 0)
- `includeVolume` (query, optional): Include volume calculation (default: true)
- `period` (query, optional): Time period in hours (default: 24)
- `sortBy` (query, optional): Sort by 'volume', 'transactions', or 'balance' (default: 'volume')

#### Example Request
```bash
curl "http://localhost:3000/api/token/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263/traders?limit=10&period=24"
```

#### Example Response
```json
{
  "success": true,
  "tokenAddress": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  "tokenInfo": {
    "decimals": 5,
    "supply": "999999999999999",
    "totalHolders": 5234,
    "activeTraders": 342
  },
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 5234,
    "hasMore": true
  },
  "filters": {
    "minBalance": 0,
    "minVolume": 0,
    "includeVolume": true,
    "period": "24h",
    "sortBy": "volume"
  },
  "holders": [
    {
      "rank": 1,
      "owner": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
      "balance": 1234567.89,
      "percentage": 0.12,
      "volume24h": 98765.43,
      "transactionCount": 42
    }
  ]
}
```

### 2. Holders By Volume Endpoint
**GET** `/token/{address}/holdersByVolume`

Fetches token holders sorted strictly by trading volume. Always includes volume calculation.

#### Parameters
- `address` (path, required): Token mint address
- `limit` (query, optional): Max results per page (default: 100, max: 1000)
- `offset` (query, optional): Pagination offset (default: 0)
- `minBalance` (query, optional): Minimum token balance filter (default: 0)
- `minVolume` (query, optional): Minimum trading volume filter (default: 0)
- `period` (query, optional): Time period in hours (default: 24)

#### Example Request
```bash
curl "http://localhost:3000/api/token/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263/holdersByVolume?limit=10&minVolume=100"
```

#### Example Response
```json
{
  "success": true,
  "tokenAddress": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  "tokenInfo": {
    "decimals": 5,
    "supply": "999999999999999",
    "totalHolders": 5234,
    "activeTraders": 342
  },
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 342,
    "hasMore": true
  },
  "filters": {
    "minBalance": 0,
    "minVolume": 100,
    "period": "24h",
    "sortedBy": "volume"
  },
  "holders": [
    {
      "rank": 1,
      "owner": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
      "balance": 1234567.89,
      "percentage": 0.12,
      "volume24h": 98765.43,
      "transactionCount": 42
    }
  ]
}
```

### 3. Holders By Interaction Endpoint
**GET** `/holdersByInteraction`

Tracks unique addresses interacting with a specific Solana program.

#### Parameters
- `program` (query, required): Program address to analyze
- `period` (query, optional): Time period (e.g., '24h', '7d') (default: '24h')
- `limit` (query, optional): Max results per page (default: 100, max: 1000)
- `offset` (query, optional): Pagination offset (default: 0)
- `minInteractions` (query, optional): Minimum interaction count filter (default: 1)

#### Example Request
```bash
curl "http://localhost:3000/api/holdersByInteraction?program=RVKd61ztZW9GUwhRbbLoYVRE5Xf1B2tVscKqwZqXgEr&period=24h&limit=10"
```

#### Example Response
```json
{
  "success": true,
  "program": {
    "address": "RVKd61ztZW9GUwhRbbLoYVRE5Xf1B2tVscKqwZqXgEr",
    "isExecutable": true,
    "exists": true
  },
  "period": "24h",
  "periodHours": 24,
  "totalInteractors": 1234,
  "activeInteractors": 456,
  "highFrequencyInteractors": 78,
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 1234,
    "hasMore": true
  },
  "filters": {
    "minInteractions": 1,
    "period": "24h"
  },
  "interactors": [
    {
      "rank": 1,
      "address": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
      "interactionCount": 156,
      "firstSeen": 1699200000000,
      "lastSeen": 1699286400000,
      "signatures": ["5xKzc...", "4yBnm..."],
      "averageInteractionsPerHour": 6.5
    }
  ]
}
```

## Use Cases

### 1. Trading Activity Analysis
Use the `/traders` endpoint to identify:
- Most active traders of a token
- Trading patterns and frequency
- Volume leaders
- Bot vs. human trading patterns

### 2. Market Making Detection
Use `/holdersByVolume` to find:
- Market makers by volume
- Liquidity providers
- High-frequency trading accounts
- Wash trading detection

### 3. DApp Usage Analytics
Use `/holdersByInteraction` to analyze:
- DApp adoption metrics
- User engagement patterns
- Power users identification
- User retention analysis
- Program activity trends

## Rate Limiting
- All endpoints implement 5-minute caching
- Recommended: 1 request per second
- Maximum: 100 requests per minute

## Volume Calculation
Volume is estimated based on:
- Transaction count in the specified period
- Average trade size (10% of holdings)
- Formula: `volume = transactionCount * (balance * 0.1)`

Note: This is a simplified calculation. For precise volume, parse individual transactions.

## Error Responses
```json
{
  "error": "Error message",
  "details": "Additional error details"
}
```

Common errors:
- 400: Invalid token/program address
- 500: RPC connection error
- 429: Rate limit exceeded

## Performance Tips
1. Use pagination for large datasets
2. Set appropriate `minBalance` to filter dust accounts
3. Use caching - data refreshes every 5 minutes
4. For real-time data, bypass cache with unique query parameters

## Example: Complete Trading Analysis
```bash
# Get top traders
curl "http://localhost:3000/api/token/YOUR_TOKEN/traders?limit=100"

# Get volume leaders
curl "http://localhost:3000/api/token/YOUR_TOKEN/holdersByVolume?limit=50"

# Check DEX interaction
curl "http://localhost:3000/api/holdersByInteraction?program=RAYDIUM_PROGRAM&period=24h"
```

## Migration from Original Endpoint
The original `/token/{address}/holders` endpoint remains available. New endpoints provide:
- Better performance with default volume calculation on `/traders`
- Dedicated volume-sorted endpoint `/holdersByVolume`
- Program interaction tracking via `/holdersByInteraction`

## Related Documentation
- [Original Token Holders API](./API-TOKEN-HOLDERS.md)
- [Solana Web3.js Documentation](https://solana-labs.github.io/solana-web3.js/)
- [Token Program Documentation](https://spl.solana.com/token)
