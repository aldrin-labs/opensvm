# Market Data Swagger Documentation Update

## Overview
Added comprehensive OpenAPI/Swagger documentation for the `/api/market-data` endpoint with proper TypeScript types and request/response schemas.

## Changes Made

### 1. API Presets (`lib/api-presets.ts`)
- Added `market-data` endpoint to Analytics category
- Updated total routes count: 97 → **98 Core API Routes**
- Added 5 example presets for market-data:
  1. **OSVM Token OHLCV (1H)** - Hourly candlestick data
  2. **BONK Daily Chart** - Daily timeframe
  3. **Token Overview** - Price, volume, market cap
  4. **Token Security Analysis** - Holder concentration, authorities
  5. **Specific Pool OHLCV** - Pool-specific data

### 2. Type Definitions (`lib/api/market-data-types.ts`) ✨ NEW FILE
Created comprehensive TypeScript interfaces and OpenAPI schemas:

#### Query Parameters
- `mint` (string, optional) - Token mint address
- `endpoint` (enum: 'ohlcv' | 'overview' | 'security') - Data type
- `type` (enum: '1m' | '3m' | '5m' | '15m' | '30m' | '1H' | '2H' | '4H' | '6H' | '8H' | '12H' | '1D' | '3D' | '1W' | '1M') - Timeframe
- `baseMint` (string, optional) - Base token filter
- `poolAddress` (string, optional) - Specific pool

#### Response Types
- **OHLCVCandle**: Open, high, low, close, volume, timestamp
- **TokenInfo**: Symbol, name, decimals, address, liquidity, price, volume
- **PoolInfo**: DEX pair info with base/quote tokens
- **TechnicalIndicators**: MA7, MA25, MACD
- **MarketDataResponse**: Complete response structure
- **TokenSecurityData**: Security metrics (holder %, authorities, LP burn)
- **TokenSecurityResponse**: Security analysis response

### 3. OpenAPI Generator (`lib/api/openapi-generator-complete.ts`)
#### Added Schemas to `getCommonSchemas()`:
- `OHLCVCandle` - Candlestick data structure
- `TokenMarketInfo` - Token market information
- `PoolInfo` - DEX pool details
- `TechnicalIndicators` - Chart indicators
- `MarketDataResponse` - Main response schema
- `TokenSecurityData` - Security metrics
- `TokenSecurityResponse` - Security response

#### Updated Methods:
1. **`extractParameters()`** - Special handling for market-data endpoint
   - Detects `/market-data` path
   - Adds 5 query parameters with proper schemas
   - Includes enum values for `endpoint` and `type`
   - Provides detailed descriptions

2. **`getResponsesForEndpoint()`** ✨ NEW METHOD
   - Returns typed responses for each endpoint
   - Special case for market-data: returns `MarketDataResponse` schema
   - Includes 200, 400, 404, 500 status codes

3. **`registerAllEndpoints()`** - Updated to use `getResponsesForEndpoint()`

4. **API Info Updates**:
   - Total routes: 97 → 98
   - Analytics category: 12 → 13 endpoints

## Endpoint Documentation

### GET `/api/market-data`

**Description**: Get comprehensive token market data with OHLCV candles, pool information, and technical indicators. Powered by Birdeye API.

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| mint | string | No | OSVM token | Token mint address |
| endpoint | enum | No | 'ohlcv' | Data type: ohlcv, overview, security |
| type | enum | No | '1H' | Timeframe (1m-1M) |
| baseMint | string | No | - | Filter by base token |
| poolAddress | string | No | - | Specific pool address |

**Response Schema** (`MarketDataResponse`):
```typescript
{
  success: boolean;
  endpoint: string;
  mint: string;
  tokenInfo: TokenMarketInfo | null;
  mainPair: {
    pair: string;
    dex: string;
    poolAddress: string;
  };
  pools: PoolInfo[];
  data: {
    items: OHLCVCandle[];
  };
  indicators: TechnicalIndicators;
  raw?: any;
  _debug?: any;
}
```

**Example Requests**:
```bash
# OSVM Token Hourly OHLCV
GET /api/market-data?mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263&endpoint=ohlcv&type=1H

# BONK Daily Chart
GET /api/market-data?mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263&endpoint=ohlcv&type=1D

# Token Overview (Price, Volume, Market Cap)
GET /api/market-data?mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263&endpoint=overview

# Token Security Analysis
GET /api/market-data?mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263&endpoint=security

# Specific Pool OHLCV
GET /api/market-data?mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263&endpoint=ohlcv&type=15m&poolAddress=8kJqxAbqbPAvJKuomNFtWfJZMh3ZPSFMaGw2JTJfhHqe
```

## Implementation Details

### Birdeye API Integration
The market-data endpoint uses Birdeye API as the primary data source:
- **OHLCV Data**: Historical price candles with volume
- **Token Overview**: Real-time price, volume, market cap, liquidity
- **Token Security**: Holder concentration, freeze/mint authority, LP burn status
- **Multi-Pool Support**: Aggregates data from multiple DEX pools

### Caching Strategy
- API responses cached for 2 minutes
- Reduces API calls and improves performance
- Implements in-memory cache with TTL

### Error Handling
- 400: Invalid parameters (wrong mint address, invalid timeframe)
- 404: Token not found
- 500: Birdeye API error or internal server error

## Testing

Test the endpoint locally:
```bash
# Start dev server
npm run dev

# Test OSVM token OHLCV
curl "http://localhost:3000/api/market-data?mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263&endpoint=ohlcv&type=1H"

# View Swagger UI
open http://localhost:3000/swagger
```

## Swagger UI Location
- **Development**: http://localhost:3000/swagger
- **Production**: https://osvm.ai/swagger

## Files Modified
1. ✅ `lib/api-presets.ts` - Added market-data endpoint with 5 presets
2. ✅ `lib/api/openapi-generator-complete.ts` - Added schemas and special parameter handling
3. ✅ `lib/api/market-data-types.ts` - Created comprehensive type definitions

## Verification Checklist
- [x] market-data endpoint added to api-presets.ts
- [x] 5 example presets created (OHLCV, overview, security)
- [x] TypeScript schemas defined in market-data-types.ts
- [x] OpenAPI schemas added to openapi-generator-complete.ts
- [x] Query parameters documented with enums
- [x] Response schema with proper types
- [x] Route count updated (97 → 98)
- [x] Analytics category count updated (12 → 13)
- [x] No TypeScript compile errors

## Next Steps
1. Start dev server: `npm run dev`
2. Visit http://localhost:3000/swagger
3. Find "Analytics" section
4. Locate "Token Market Data & OHLCV" endpoint
5. Test with example presets
6. Verify request/response types display correctly

---

**Date**: 2025-01-09  
**Related**: BIRDEYE-INTEGRATION-SUMMARY.md, BIRDEYE-MARKET-DATA-MIGRATION.md
