/**
 * OpenAPI Type Definitions for OpenSVM Market Data APIs
 * Provides TypeScript interfaces and Zod schemas for all market data endpoints
 */

import { z } from 'zod';

// ============================================================================
// Market Data Endpoint Types
// ============================================================================

/**
 * GET /api/market-data - Comprehensive market data with OHLCV
 */
export const MarketDataQuerySchema = z.object({
  mint: z.string().optional().describe('Token mint address (default: OSVM token)'),
  endpoint: z.enum(['ohlcv', 'overview', 'security']).optional().describe('Data type to fetch'),
  type: z.enum(['1m', '3m', '5m', '15m', '30m', '1H', '2H', '4H', '6H', '8H', '12H', '1D', '3D', '1W', '1M']).optional().describe('OHLCV timeframe'),
  baseMint: z.string().optional().describe('Filter by base token mint'),
  poolAddress: z.string().optional().describe('Specific DEX pool address'),
});

export type MarketDataQuery = z.infer<typeof MarketDataQuerySchema>;

export interface OHLCVCandle {
  o: number;       // Open price
  h: number;       // High price
  l: number;       // Low price
  c: number;       // Close price
  v: number;       // Volume in USD
  unixTime: number; // Unix timestamp
  address: string;  // Token address
  type: string;     // Timeframe type
  currency: string; // Currency (usually USD)
}

export interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  address: string;
  liquidity?: number;
  price?: number;
  volume24h?: number;
}

export interface PoolInfo {
  symbol: string;
  name: string;
  liquidity: number;
  price: number;
  volume24h: number;
  dex: string;
  pair: string;
  poolAddress: string;
  baseToken: TokenInfo;
  quoteToken: TokenInfo;
}

export interface TechnicalIndicators {
  ma7: number[];        // 7-period moving average
  ma25: number[];       // 25-period moving average
  macd: {
    line: number[];
    signal: number[];
    histogram: number[];
  };
}

export interface MarketDataResponse {
  success: boolean;
  endpoint: string;
  mint: string;
  tokenInfo: TokenInfo | null;
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

// ============================================================================
// Token Security Types
// ============================================================================

export interface TokenSecurityData {
  creatorBalance: number;
  creatorPercentage: number;
  top10HolderPercent: number;
  freezeAuthority: boolean;
  mintAuthority: boolean;
  lpBurn: boolean;
  isHoneypot: boolean;
}

export interface TokenSecurityResponse {
  success: boolean;
  data: TokenSecurityData;
  address: string;
  analyzed_at: string;
}

// ============================================================================
// Token Overview Types
// ============================================================================

export interface TokenOverviewData {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  price: number;
  v24hUSD: number;
  v24hChangePercent: number;
  liquidity: number;
  mc: number; // market cap
  holder: number;
  supply: number;
  lastTradeUnixTime: number;
}

export interface TokenOverviewResponse {
  success: boolean;
  data: TokenOverviewData;
}

// ============================================================================
// OpenAPI Schema Definitions
// ============================================================================

export const openApiSchemas = {
  MarketDataQuery: {
    type: 'object',
    properties: {
      mint: {
        type: 'string',
        description: 'Token mint address',
        example: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
      },
      endpoint: {
        type: 'string',
        enum: ['ohlcv', 'overview', 'security'],
        default: 'ohlcv',
        description: 'Type of market data to fetch'
      },
      type: {
        type: 'string',
        enum: ['1m', '3m', '5m', '15m', '30m', '1H', '2H', '4H', '6H', '8H', '12H', '1D', '3D', '1W', '1M'],
        default: '1H',
        description: 'OHLCV candlestick timeframe'
      },
      baseMint: {
        type: 'string',
        description: 'Filter results by base token mint address'
      },
      poolAddress: {
        type: 'string',
        description: 'Specific DEX pool address to query'
      }
    }
  },
  OHLCVCandle: {
    type: 'object',
    required: ['o', 'h', 'l', 'c', 'v', 'unixTime'],
    properties: {
      o: { type: 'number', description: 'Open price' },
      h: { type: 'number', description: 'High price' },
      l: { type: 'number', description: 'Low price' },
      c: { type: 'number', description: 'Close price' },
      v: { type: 'number', description: 'Volume in USD' },
      unixTime: { type: 'integer', description: 'Unix timestamp in seconds' },
      address: { type: 'string', description: 'Token address' },
      type: { type: 'string', description: 'Timeframe type (e.g., "1H")' },
      currency: { type: 'string', description: 'Currency (usually "usd")' }
    },
    example: {
      o: 0.001234,
      h: 0.001256,
      l: 0.001210,
      c: 0.001245,
      v: 125430.50,
      unixTime: 1699545600,
      address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      type: '1H',
      currency: 'usd'
    }
  },
  TokenInfo: {
    type: 'object',
    properties: {
      symbol: { type: 'string', example: 'BONK' },
      name: { type: 'string', example: 'Bonk' },
      decimals: { type: 'integer', example: 5 },
      address: { type: 'string', example: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
      liquidity: { type: 'number', example: 1250000.50 },
      price: { type: 'number', example: 0.00001234 },
      volume24h: { type: 'number', example: 5420000.75 }
    }
  },
  PoolInfo: {
    type: 'object',
    properties: {
      symbol: { type: 'string', example: 'BONK/USDC' },
      name: { type: 'string', example: 'Bonk-USDC Pool' },
      liquidity: { type: 'number', example: 1250000.50 },
      price: { type: 'number', example: 0.00001234 },
      volume24h: { type: 'number', example: 5420000.75 },
      dex: { type: 'string', example: 'Raydium' },
      pair: { type: 'string', example: 'BONK/USDC' },
      poolAddress: { type: 'string', example: '8kJqxAbqbPAvJKuomNFtWfJZMh3ZPSFMaGw2JTJfhHqe' },
      baseToken: { $ref: '#/components/schemas/TokenInfo' },
      quoteToken: { $ref: '#/components/schemas/TokenInfo' }
    }
  },
  TechnicalIndicators: {
    type: 'object',
    properties: {
      ma7: {
        type: 'array',
        items: { type: 'number' },
        description: '7-period moving average'
      },
      ma25: {
        type: 'array',
        items: { type: 'number' },
        description: '25-period moving average'
      },
      macd: {
        type: 'object',
        properties: {
          line: { type: 'array', items: { type: 'number' } },
          signal: { type: 'array', items: { type: 'number' } },
          histogram: { type: 'array', items: { type: 'number' } }
        }
      }
    }
  },
  MarketDataResponse: {
    type: 'object',
    required: ['success', 'endpoint', 'mint', 'data'],
    properties: {
      success: { type: 'boolean', example: true },
      endpoint: { type: 'string', example: 'ohlcv' },
      mint: { type: 'string', example: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
      tokenInfo: { $ref: '#/components/schemas/TokenInfo' },
      mainPair: {
        type: 'object',
        properties: {
          pair: { type: 'string', example: 'BONK/USDC' },
          dex: { type: 'string', example: 'Raydium' },
          poolAddress: { type: 'string', example: '8kJqxAbqbPAvJKuomNFtWfJZMh3ZPSFMaGw2JTJfhHqe' }
        }
      },
      pools: {
        type: 'array',
        items: { $ref: '#/components/schemas/PoolInfo' }
      },
      data: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/OHLCVCandle' }
          }
        }
      },
      indicators: { $ref: '#/components/schemas/TechnicalIndicators' },
      raw: { type: 'object', description: 'Raw API response from Birdeye' }
    }
  },
  TokenSecurityData: {
    type: 'object',
    properties: {
      creatorBalance: { type: 'number', example: 0.999744017 },
      creatorPercentage: { type: 'number', example: 9.998841964586756e-10 },
      top10HolderPercent: { type: 'number', example: 0.23566702589502325 },
      freezeAuthority: { type: 'boolean', example: false },
      mintAuthority: { type: 'boolean', example: false },
      lpBurn: { type: 'boolean', example: false },
      isHoneypot: { type: 'boolean', example: false }
    }
  },
  TokenSecurityResponse: {
    type: 'object',
    required: ['success', 'data', 'address'],
    properties: {
      success: { type: 'boolean', example: true },
      data: { $ref: '#/components/schemas/TokenSecurityData' },
      address: { type: 'string', example: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
      analyzed_at: { type: 'string', format: 'date-time', example: '2025-11-09T12:34:56.789Z' }
    }
  }
};

// ============================================================================
// OpenAPI Path Definitions
// ============================================================================

export const marketDataPaths = {
  '/market-data': {
    get: {
      tags: ['Market Data'],
      summary: 'Get comprehensive market data with OHLCV candles',
      description: 'Fetches real-time market data including OHLCV candlestick data, token information, pool details, and technical indicators. Powered by Birdeye API with multi-pool aggregation.',
      operationId: 'getMarketData',
      parameters: [
        {
          name: 'mint',
          in: 'query',
          description: 'Token mint address (defaults to OSVM token)',
          required: false,
          schema: { type: 'string' },
          example: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
        },
        {
          name: 'endpoint',
          in: 'query',
          description: 'Type of market data to fetch',
          required: false,
          schema: {
            type: 'string',
            enum: ['ohlcv', 'overview', 'security'],
            default: 'ohlcv'
          }
        },
        {
          name: 'type',
          in: 'query',
          description: 'OHLCV timeframe',
          required: false,
          schema: {
            type: 'string',
            enum: ['1m', '3m', '5m', '15m', '30m', '1H', '2H', '4H', '6H', '8H', '12H', '1D', '3D', '1W', '1M'],
            default: '1H'
          }
        },
        {
          name: 'baseMint',
          in: 'query',
          description: 'Filter by base token mint address',
          required: false,
          schema: { type: 'string' }
        },
        {
          name: 'poolAddress',
          in: 'query',
          description: 'Query specific DEX pool address',
          required: false,
          schema: { type: 'string' }
        }
      ],
      responses: {
        '200': {
          description: 'Market data retrieved successfully',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/MarketDataResponse' }
            }
          }
        },
        '400': {
          description: 'Bad request - invalid parameters',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        '500': {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        }
      }
    }
  }
};
