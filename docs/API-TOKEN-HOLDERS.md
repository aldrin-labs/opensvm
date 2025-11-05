# Token Holders API Endpoint

## Overview
New endpoint to fetch all token holders with their balances for any Solana token mint address. This endpoint uses the efficient `getProgramAccounts` RPC method with data slicing for optimal performance.

## Endpoint
```
GET /api/token/[address]/holders
```

## Features
- ✅ Fetches all token holders with balances
- ✅ Filters out zero balance accounts
- ✅ Supports pagination (limit/offset)
- ✅ Filters by minimum balance threshold
- ✅ Sorts by balance or address
- ✅ Provides holder statistics (concentration, average, median)
- ✅ Implements 10-minute caching
- ✅ Uses efficient data slicing for minimal RPC data transfer

## Query Parameters

| Parameter | Type | Default | Description | Example |
|-----------|------|---------|-------------|---------|
| `limit` | number | 100 | Number of holders to return (max 1000) | `?limit=50` |
| `offset` | number | 0 | Pagination offset | `?offset=100` |
| `minBalance` | number | 0 | Minimum token balance filter | `?minBalance=1000` |
| `minVolume` | number | 0 | Minimum trading volume filter | `?minVolume=10000` |
| `volumeHours` | number | 24 | Hours to look back for volume data | `?volumeHours=48` |
| `includeVolume` | boolean | false | Include volume calculations | `?includeVolume=true` |
| `sortBy` | string | "balance" | Sort field: "balance", "address", or "volume" | `?sortBy=volume` |
| `order` | string | "desc" | Sort order: "desc" or "asc" | `?order=asc` |

## Response Format

```json
{
  "mint": "pvv4fu1RvQBkKXozyH5A843sp1mt6gTy9rPoZrBBAGS",
  "totalHolders": 932,
  "fetchedAt": "2024-11-05T18:56:00.000Z",
  "statistics": {
    "totalSupplyHeld": 999950674.367,
    "averageBalance": 1072908.449,
    "medianBalance": 104782.626,
    "top10Concentration": "25.68%"
  },
  "holders": [
    {
      "address": "9BZ9r9TQj2vVAm8xxvRJXNBPWNGJYw6HR3jvKZJQfzht",
      "balance": "43506000690000000",
      "uiBalance": 43506000.69,
      "decimals": 9
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "hasMore": true,
    "nextOffset": 10
  }
}
```

## Field Descriptions

### Root Fields
- **mint**: The token mint address
- **totalHolders**: Total number of non-zero balance holders
- **fetchedAt**: Timestamp when data was fetched
- **statistics**: Aggregate statistics about holder distribution
- **holders**: Array of holder accounts with balances
- **pagination**: Pagination metadata

### Statistics Object
- **totalSupplyHeld**: Sum of all holder balances
- **averageBalance**: Mean balance across all holders
- **medianBalance**: Median holder balance
- **top10Concentration**: Percentage of supply held by top 10 holders
- **volumeStats** (when includeVolume=true):
  - **totalVolume**: Total tokens transferred in period
  - **averageVolume**: Average volume per holder
  - **activeTraders**: Number of holders with >0 volume
  - **activeTradersPercentage**: Percentage of active traders
  - **volumePeriodHours**: Time period for volume calculation

### Holder Object
- **address**: Wallet address of the token holder
- **balance**: Raw balance as string (to preserve precision)
- **uiBalance**: Human-readable balance with decimals applied
- **decimals**: Token decimals used for conversion
- **volume24h** (when includeVolume=true): Trading volume in specified period

## Usage Examples

### Get Top 10 Holders
```bash
curl "http://localhost:3000/api/token/pvv4fu1RvQBkKXozyH5A843sp1mt6gTy9rPoZrBBAGS/holders?limit=10"
```

### Get Holders with >1000 Tokens
```bash
curl "http://localhost:3000/api/token/pvv4fu1RvQBkKXozyH5A843sp1mt6gTy9rPoZrBBAGS/holders?minBalance=1000"
```

### Get Active Traders (with Volume Data)
```bash
curl "http://localhost:3000/api/token/pvv4fu1RvQBkKXozyH5A843sp1mt6gTy9rPoZrBBAGS/holders?includeVolume=true&volumeHours=24"
```

### Filter by Minimum Volume (Last 48 Hours)
```bash
curl "http://localhost:3000/api/token/pvv4fu1RvQBkKXozyH5A843sp1mt6gTy9rPoZrBBAGS/holders?minVolume=10000&volumeHours=48"
```

### Sort by Trading Volume
```bash
curl "http://localhost:3000/api/token/pvv4fu1RvQBkKXozyH5A843sp1mt6gTy9rPoZrBBAGS/holders?sortBy=volume&includeVolume=true"
```

### Paginated Request
```bash
curl "http://localhost:3000/api/token/pvv4fu1RvQBkKXozyH5A843sp1mt6gTy9rPoZrBBAGS/holders?limit=50&offset=100"
```

### Sort by Address (Alphabetically)
```bash
curl "http://localhost:3000/api/token/pvv4fu1RvQBkKXozyH5A843sp1mt6gTy9rPoZrBBAGS/holders?sortBy=address&order=asc"
```

## Implementation Details

### Technical Approach
The endpoint uses Solana's `getProgramAccounts` RPC method with:
1. **Data Slicing**: Only fetches bytes 64-72 (balance data) to minimize data transfer
2. **Filters**:
   - Token account size filter (165 bytes)
   - Mint address memcmp filter (first 32 bytes)
3. **Zero Balance Filtering**: Excludes accounts with zero balance
4. **BigInt Handling**: Uses BigInt for balance precision

### Performance Optimizations
- **10-minute cache**: Reduces RPC calls for frequently accessed tokens
- **5-minute volume cache**: Caches individual holder volume calculations
- **Data slicing**: Fetches only 8 bytes per account instead of full 165 bytes
- **Pagination support**: Handles tokens with many holders efficiently
- **Rate limiting**: Prevents RPC abuse (50 requests/minute)
- **Volume processing limit**: Calculates volume for top 100 holders only (for performance)

### Error Handling
- **400**: Invalid mint address format
- **408**: Request timeout (tokens with too many holders)
- **429**: Rate limit exceeded
- **503**: RPC provider doesn't support getProgramAccounts
- **500**: General server error

## RPC Requirements

⚠️ **Important**: This endpoint requires an RPC provider that supports `getProgramAccounts`. 

### Compatible Providers
- ✅ Helius
- ✅ QuickNode
- ✅ Self-hosted Solana node
- ✅ Most paid RPC providers

### Incompatible Providers
- ❌ Free Solana public RPC (doesn't support getProgramAccounts)

## Test Results

From testing with SVMAI token (`pvv4fu1RvQBkKXozyH5A843sp1mt6gTy9rPoZrBBAGS`):
- Total holders: 933
- Top 10 concentration: 25.68%
- Average balance: 1,072,908 tokens
- Median balance: 104,782 tokens
- Cache performance: 25% faster on cached requests

### Volume Analysis (24 hours):
- Total volume transferred: 1,435,279 tokens
- Active traders: 1 out of 933 (0.11%)
- Average volume per holder: 1,538 tokens

## Code Location
- Implementation: `/app/api/token/[address]/holders/route.ts`
- Test script: `/scripts/test-token-holders.js`

## Related Endpoints
- `/api/token/[address]` - Get basic token information
- `/api/token/[address]/transfers` - Get token transfer history (if implemented)

## Future Enhancements
1. Add WebSocket support for real-time holder updates
2. Implement holder change tracking over time
3. Add CSV/JSON export options for large datasets
4. Include holder labels (exchanges, known wallets)
5. Add holder analytics (new vs old holders, churn rate)
