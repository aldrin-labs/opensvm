import fs from 'fs';
import path from 'path';
import { apiMethods } from '../api-presets';

export interface OpenAPIParameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'body';
  required?: boolean;
  schema: any;
  description?: string;
}

export interface OpenAPIResponse {
  status: number;
  description: string;
  schema?: any;
  examples?: Record<string, any>;
}

export interface OpenAPIEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  summary: string;
  description?: string;
  tags?: string[];
  parameters?: OpenAPIParameter[];
  requestBody?: {
    required?: boolean;
    content: Record<string, { schema: any; examples?: any }>;
  };
  responses: Record<string, OpenAPIResponse>;
  operationId: string;
}

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
    contact?: {
      name: string;
      url: string;
      email: string;
    };
    license?: {
      name: string;
      url: string;
    };
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  paths: Record<string, Record<string, any>>;
  components: {
    schemas: Record<string, any>;
    securitySchemes?: Record<string, any>;
  };
  tags: Array<{
    name: string;
    description: string;
  }>;
}

class OpenAPIGenerator {
  private spec: OpenAPISpec;
  private endpoints: OpenAPIEndpoint[] = [];

  constructor() {
    this.spec = {
      openapi: '3.0.3',
      info: {
        title: 'OpenSVM API - Complete Reference',
        version: '2.0.0',
        description: 'Comprehensive API for Solana Virtual Machine Explorer - 98 Core API Routes covering transactions, blockchain data, analytics, DeFi, NFTs, and AI-powered insights',
        contact: {
          name: 'OpenSVM Team',
          url: 'https://opensvm.com',
          email: 'support@opensvm.com'
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT'
        }
      },
      servers: [
        {
          url: 'http://localhost:3000/api',
          description: 'Development server'
        },
        {
          url: 'https://opensvm.com/api',
          description: 'Production server'
        }
      ],
      paths: {},
      components: {
        schemas: this.getCommonSchemas()
      },
      tags: [
        { name: 'Search & Discovery', description: 'Universal search and program discovery across the blockchain (9 endpoints)' },
        { name: 'Account & Wallet', description: 'Account information, portfolio management, and transaction history (14 endpoints)' },
        { name: 'Transactions', description: 'Transaction analysis, metrics, and failure detection (17 endpoints)' },
        { name: 'Blockchain', description: 'Block data, slot information, and RPC operations (8 endpoints)' },
        { name: 'Tokens & NFTs', description: 'Token information, NFT collections, and metadata (7 endpoints)' },
        { name: 'Analytics', description: 'DeFi analytics, validator metrics, and ecosystem health (13 endpoints)' },
        { name: 'AI-Powered', description: 'AI-powered analysis, question answering, and insights (6 endpoints)' },
        { name: 'Real-Time', description: 'Server-sent events, streaming data, and live feeds (6 endpoints)' },
        { name: 'User Services', description: 'User profiles, activity feeds, and personalization (14 endpoints)' }
      ]
    };

    this.registerAllEndpoints();
  }

  private getCommonSchemas() {
    return {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string', description: 'Error message' },
          code: { type: 'string', description: 'Error code' },
          details: { type: 'object', description: 'Additional error details' }
        },
        required: ['error']
      },
      Transaction: {
        type: 'object',
        properties: {
          signature: { 
            type: 'string', 
            description: 'Transaction signature',
            example: '5vYsYWPF4gdN1imxLpJAWi9QKpN3MSrFTFXK8pfmPogFjQNPiAkxFQCGzEEWNto16mWnwmdwNQH7KPCnkMcZ9Ba5'
          },
          slot: { type: 'integer', description: 'Slot number' },
          blockTime: { type: 'integer', description: 'Block timestamp' },
          fee: { type: 'integer', description: 'Transaction fee in lamports' },
          status: { 
            type: 'string', 
            enum: ['success', 'failed'],
            description: 'Transaction status' 
          }
        }
      },
      Account: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Account address' },
          lamports: { type: 'integer', description: 'Account balance in lamports' },
          owner: { type: 'string', description: 'Program that owns this account' },
          executable: { type: 'boolean', description: 'Whether account is executable' }
        }
      },
      Block: {
        type: 'object',
        properties: {
          slot: { type: 'integer', description: 'Block slot number' },
          blockhash: { type: 'string', description: 'Block hash' },
          blockTime: { type: 'integer', description: 'Block timestamp' },
          blockHeight: { type: 'integer', description: 'Block height' }
        }
      },
      TokenInfo: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Token mint address' },
          symbol: { type: 'string', description: 'Token symbol' },
          name: { type: 'string', description: 'Token name' },
          decimals: { type: 'integer', description: 'Token decimal places' },
          supply: { type: 'string', description: 'Token total supply' }
        }
      },
      // Market Data & OHLCV Schemas
      OHLCVCandle: {
        type: 'object',
        required: ['o', 'h', 'l', 'c', 'v', 'unixTime'],
        properties: {
          o: { type: 'number', description: 'Open price', example: 0.001234 },
          h: { type: 'number', description: 'High price', example: 0.001256 },
          l: { type: 'number', description: 'Low price', example: 0.001210 },
          c: { type: 'number', description: 'Close price', example: 0.001245 },
          v: { type: 'number', description: 'Volume in USD', example: 125430.50 },
          unixTime: { type: 'integer', description: 'Unix timestamp in seconds', example: 1699545600 },
          address: { type: 'string', description: 'Token address' },
          type: { type: 'string', description: 'Timeframe type (e.g., "1H")', example: '1H' },
          currency: { type: 'string', description: 'Currency (usually "usd")', example: 'usd' }
        }
      },
      TokenMarketInfo: {
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
          baseToken: { $ref: '#/components/schemas/TokenMarketInfo' },
          quoteToken: { $ref: '#/components/schemas/TokenMarketInfo' }
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
          tokenInfo: { $ref: '#/components/schemas/TokenMarketInfo' },
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
      },
      // Chart & Trades Endpoint Schemas
      ChartMetadata: {
        type: 'object',
        properties: {
          requestedRange: {
            type: 'object',
            properties: {
              from: { type: 'number', description: 'Start timestamp' },
              to: { type: 'number', description: 'End timestamp' },
              duration: { type: 'number', description: 'Duration in seconds' }
            }
          },
          batching: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              batchCount: { type: 'number', description: 'Number of batches used' },
              batchSize: { type: 'number', description: 'Time range per batch (seconds)' },
              candlesPerBatch: { type: 'number', description: 'Candles per batch (~960 optimal)' }
            }
          },
          candleCount: { type: 'number', description: 'Total candles returned' }
        }
      },
      ChartResponse: {
        type: 'object',
        required: ['success', 'endpoint', 'mint', 'data'],
        properties: {
          success: { type: 'boolean', example: true },
          endpoint: { type: 'string', example: 'ohlcv' },
          mint: { type: 'string', example: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
          tokenInfo: { $ref: '#/components/schemas/TokenMarketInfo' },
          mainPair: {
            type: 'object',
            properties: {
              pair: { type: 'string', example: 'BONK/USDC' },
              dex: { type: 'string', example: 'Raydium' },
              poolAddress: { type: 'string' }
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
          _meta: { $ref: '#/components/schemas/ChartMetadata' }
        }
      },
      TradeData: {
        type: 'object',
        required: ['signature', 'timestamp', 'type', 'owner'],
        properties: {
          signature: { type: 'string', description: 'Transaction signature' },
          timestamp: { type: 'number', description: 'Unix timestamp' },
          blockTime: { type: 'number', description: 'Block timestamp' },
          type: { type: 'string', enum: ['swap', 'add', 'remove'], description: 'Transaction type' },
          side: { type: 'string', enum: ['buy', 'sell'], description: 'Trade side' },
          price: { type: 'number', description: 'Price per token' },
          priceUSD: { type: 'number', description: 'Price in USD' },
          amount: { type: 'number', description: 'Token amount traded' },
          amountUSD: { type: 'number', description: 'USD value of trade' },
          volume: { type: 'number', description: 'Volume (same as amountUSD)' },
          token: {
            type: 'object',
            properties: {
              symbol: { type: 'string' },
              name: { type: 'string' },
              address: { type: 'string' },
              decimals: { type: 'number' }
            }
          },
          pairToken: {
            type: 'object',
            properties: {
              symbol: { type: 'string', example: 'USDC' },
              name: { type: 'string' },
              address: { type: 'string' },
              decimals: { type: 'number' }
            }
          },
          dex: { type: 'string', example: 'Raydium', description: 'DEX name' },
          poolAddress: { type: 'string', description: 'AMM pool address' },
          owner: { type: 'string', description: 'Wallet address that made the trade' },
          slot: { type: 'number', description: 'Solana slot number' },
          raw: { type: 'object', description: 'Raw Birdeye response data' }
        }
      },
      TradesResponse: {
        type: 'object',
        required: ['success', 'mint', 'trades', 'count', 'metadata'],
        properties: {
          success: { type: 'boolean', example: true },
          mint: { type: 'string', description: 'Token mint address' },
          trades: {
            type: 'array',
            items: { $ref: '#/components/schemas/TradeData' }
          },
          count: { type: 'number', description: 'Number of trades in response' },
          total: { type: 'number', description: 'Total trades available' },
          metadata: {
            type: 'object',
            properties: {
              mint: { type: 'string' },
              limit: { type: 'number' },
              offset: { type: 'number' },
              txType: { type: 'string', description: 'Filter type used' },
              hasMore: { type: 'boolean', description: 'Whether more trades available' }
            }
          }
        }
      },
      // Search & Discovery Schemas
      SearchResult: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['account', 'transaction', 'block', 'program', 'token'], example: 'account' },
          address: { type: 'string', example: 'REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck' },
          signature: { type: 'string', example: '5vYsYWPF4gdN1imxLpJAWi9QKpN3MSrFTFXK8pfmPogFjQNPiAkxFQCGzEEWNto16mWnwmdwNQH7KPCnkMcZ9Ba5' },
          name: { type: 'string', example: 'Raydium AMM' },
          description: { type: 'string', example: 'Automated market maker program' },
          metadata: { type: 'object' }
        }
      },
      SearchResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          query: { type: 'string', example: 'raydium' },
          results: { type: 'array', items: { $ref: '#/components/schemas/SearchResult' } },
          count: { type: 'integer', example: 10 }
        }
      },
      // Account & Wallet Schemas
      AccountInfo: {
        type: 'object',
        properties: {
          address: { type: 'string', example: 'REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck' },
          lamports: { type: 'integer', example: 5000000000, description: 'Balance in lamports' },
          owner: { type: 'string', example: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
          executable: { type: 'boolean', example: false },
          rentEpoch: { type: 'integer', example: 361 },
          data: { type: 'object' }
        }
      },
      PortfolioResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          address: { type: 'string' },
          totalValue: { type: 'number', example: 1234.56, description: 'Total value in USD' },
          tokens: { type: 'array', items: { $ref: '#/components/schemas/TokenInfo' } },
          nfts: { type: 'array', items: { type: 'object' } }
        }
      },
      // Transaction Schemas
      TransactionDetail: {
        type: 'object',
        properties: {
          signature: { type: 'string' },
          slot: { type: 'integer' },
          blockTime: { type: 'integer' },
          fee: { type: 'integer', description: 'Fee in lamports' },
          status: { type: 'string', enum: ['success', 'failed'] },
          instructions: { type: 'array', items: { type: 'object' } },
          accounts: { type: 'array', items: { type: 'string' } },
          logMessages: { type: 'array', items: { type: 'string' } }
        }
      },
      TransactionListResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          transactions: { type: 'array', items: { $ref: '#/components/schemas/Transaction' } },
          count: { type: 'integer', example: 100 },
          hasMore: { type: 'boolean', example: true }
        }
      },
      TransferListResponse: {
        type: 'object',
        required: ['transfers', 'hasMore'],
        properties: {
          transfers: {
            type: 'array',
            description: 'List of transfer transactions',
            items: {
              type: 'object',
              required: ['txId', 'date', 'from', 'to', 'tokenSymbol', 'tokenAmount', 'transferType'],
              properties: {
                txId: { type: 'string', description: 'Transaction signature' },
                date: { type: 'string', description: 'Transaction timestamp' },
                from: { type: 'string', description: 'Sender address' },
                to: { type: 'string', description: 'Receiver address' },
                tokenSymbol: { type: 'string', description: 'Token symbol (SOL or token)' },
                tokenAmount: { type: 'string', description: 'Amount transferred' },
                transferType: { 
                  type: 'string', 
                  enum: ['IN', 'OUT'],
                  description: 'Transfer direction relative to the queried address'
                }
              }
            }
          },
          hasMore: { 
            type: 'boolean',
            description: 'Whether more transfers are available for pagination'
          }
        }
      },
      // Account Response Schemas
      AccountStatsResponse: {
        type: 'object',
        properties: {
          address: { type: 'string' },
          balance: { type: 'number' },
          transactionCount: { type: 'integer' },
          firstActivity: { type: 'string', format: 'date-time' },
          lastActivity: { type: 'string', format: 'date-time' },
          totalSent: { type: 'number' },
          totalReceived: { type: 'number' }
        }
      },
      AccountTypeResponse: {
        type: 'object',
        properties: {
          address: { type: 'string' },
          type: { type: 'string', enum: ['wallet', 'program', 'token', 'nft', 'pda'] },
          isExecutable: { type: 'boolean' },
          owner: { type: 'string' }
        }
      },
      TokenStatsResponse: {
        type: 'object',
        properties: {
          address: { type: 'string' },
          mint: { type: 'string' },
          balance: { type: 'number' },
          transactions: { type: 'integer' },
          firstSeen: { type: 'string', format: 'date-time' },
          lastSeen: { type: 'string', format: 'date-time' }
        }
      },
      UserProfileResponse: {
        type: 'object',
        properties: {
          address: { type: 'string' },
          displayName: { type: 'string' },
          avatar: { type: 'string' },
          bio: { type: 'string' },
          stats: { $ref: '#/components/schemas/AccountStatsResponse' }
        }
      },
      UserFeedResponse: {
        type: 'object',
        properties: {
          address: { type: 'string' },
          feed: { type: 'array', items: { type: 'object' } },
          hasMore: { type: 'boolean' }
        }
      },
      // Transaction Response Schemas
      TransactionAnalysisResponse: {
        type: 'object',
        properties: {
          signature: { type: 'string' },
          analysis: { type: 'string' },
          programs: { type: 'array', items: { type: 'string' } },
          accounts: { type: 'array', items: { type: 'string' } },
          instructions: { type: 'integer' }
        }
      },
      TransactionExplanationResponse: {
        type: 'object',
        properties: {
          signature: { type: 'string' },
          explanation: { type: 'string' },
          summary: { type: 'string' },
          details: { type: 'object' }
        }
      },
      TransactionMetricsResponse: {
        type: 'object',
        properties: {
          signature: { type: 'string' },
          computeUnits: { type: 'integer' },
          fee: { type: 'number' },
          duration: { type: 'number' },
          instructions: { type: 'integer' }
        }
      },
      FailureAnalysisResponse: {
        type: 'object',
        properties: {
          signature: { type: 'string' },
          error: { type: 'string' },
          cause: { type: 'string' },
          suggestions: { type: 'array', items: { type: 'string' } }
        }
      },
      RelatedTransactionsResponse: {
        type: 'object',
        properties: {
          signature: { type: 'string' },
          related: { type: 'array', items: { $ref: '#/components/schemas/Transaction' } },
          count: { type: 'integer' }
        }
      },
      BatchTransactionsResponse: {
        type: 'object',
        properties: {
          transactions: { type: 'array', items: { $ref: '#/components/schemas/TransactionDetail' } },
          count: { type: 'integer' }
        }
      },
      // Block & Blockchain Schemas
      BlockDetail: {
        type: 'object',
        properties: {
          slot: { type: 'integer', example: 290000000 },
          blockhash: { type: 'string', example: 'FzGFHzT8RYq3Q1LqULvZnR8YG3HWfQ2jP4fXe7iG8xKz' },
          blockTime: { type: 'integer', example: 1699545600 },
          blockHeight: { type: 'integer', example: 250000000 },
          previousBlockhash: { type: 'string' },
          parentSlot: { type: 'integer' },
          transactions: { type: 'array', items: { $ref: '#/components/schemas/Transaction' } }
        }
      },
      BlockListResponse: {
        type: 'object',
        properties: {
          blocks: { type: 'array', items: { $ref: '#/components/schemas/BlockDetail' } },
          count: { type: 'integer' },
          hasMore: { type: 'boolean' }
        }
      },
      BlockStatsResponse: {
        type: 'object',
        properties: {
          averageBlockTime: { type: 'number' },
          totalBlocks: { type: 'integer' },
          averageTransactions: { type: 'number' },
          lookbackSlots: { type: 'integer' }
        }
      },
      SlotInfoResponse: {
        type: 'object',
        properties: {
          slot: { type: 'integer' },
          blockHeight: { type: 'integer' },
          timestamp: { type: 'integer' }
        }
      },
      RPCResponse: {
        type: 'object',
        properties: {
          jsonrpc: { type: 'string', example: '2.0' },
          result: { type: 'object' },
          id: { type: 'integer' }
        }
      },
      // Analytics Schemas
      AnalyticsResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          timestamp: { type: 'string', format: 'date-time' },
          metrics: { type: 'object' },
          data: { type: 'object' }
        }
      },
      AnalyticsOverviewResponse: {
        type: 'object',
        properties: {
          totalValueLocked: { type: 'number' },
          totalTransactions24h: { type: 'integer' },
          activeUsers24h: { type: 'integer' },
          topPrograms: { type: 'array', items: { type: 'object' } }
        }
      },
      DEXAnalyticsResponse: {
        type: 'object',
        properties: {
          totalVolume24h: { type: 'number' },
          dexList: { type: 'array', items: { type: 'object' } },
          topPairs: { type: 'array', items: { type: 'object' } }
        }
      },
      DeFiHealthResponse: {
        type: 'object',
        properties: {
          score: { type: 'number', example: 85.5 },
          indicators: { type: 'object' },
          alerts: { type: 'array', items: { type: 'string' } }
        }
      },
      ValidatorAnalyticsResponse: {
        type: 'object',
        properties: {
          totalValidators: { type: 'integer' },
          activeValidators: { type: 'integer' },
          topValidators: { type: 'array', items: { type: 'object' } }
        }
      },
      MarketplaceAnalyticsResponse: {
        type: 'object',
        properties: {
          totalVolume: { type: 'number' },
          marketplaces: { type: 'array', items: { type: 'object' } }
        }
      },
      AggregatorAnalyticsResponse: {
        type: 'object',
        properties: {
          totalAggregators: { type: 'integer' },
          volume24h: { type: 'number' },
          topAggregators: { type: 'array', items: { type: 'object' } }
        }
      },
      LaunchpadAnalyticsResponse: {
        type: 'object',
        properties: {
          totalLaunches: { type: 'integer' },
          successRate: { type: 'number' },
          launchpads: { type: 'array', items: { type: 'object' } }
        }
      },
      BotAnalyticsResponse: {
        type: 'object',
        properties: {
          activeBots: { type: 'integer' },
          volume24h: { type: 'number' },
          topBots: { type: 'array', items: { type: 'object' } }
        }
      },
      SocialFiAnalyticsResponse: {
        type: 'object',
        properties: {
          totalUsers: { type: 'integer' },
          activeUsers24h: { type: 'integer' },
          topPlatforms: { type: 'array', items: { type: 'object' } }
        }
      },
      // Token & NFT Response Schemas
      TokenMetadataResponse: {
        type: 'object',
        properties: {
          mints: { type: 'array', items: { $ref: '#/components/schemas/TokenInfo' } }
        }
      },
      TokenCheckResponse: {
        type: 'object',
        properties: {
          address: { type: 'string' },
          isToken: { type: 'boolean' },
          metadata: { $ref: '#/components/schemas/TokenInfo' }
        }
      },
      NFTCollectionsResponse: {
        type: 'object',
        properties: {
          collections: { type: 'array', items: { type: 'object' } },
          count: { type: 'integer' }
        }
      },
      // Search Response Schemas - SearchSuggestionsResponse only
      SearchSuggestionsResponse: {
        type: 'object',
        properties: {
          suggestions: { type: 'array', items: { type: 'string' } }
        }
      },
      // Program Response Schemas
      ProgramDetailResponse: {
        type: 'object',
        properties: {
          address: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          verified: { type: 'boolean' }
        }
      },
      ProgramDiscoveryResponse: {
        type: 'object',
        properties: {
          programs: { type: 'array', items: { $ref: '#/components/schemas/ProgramDetailResponse' } },
          count: { type: 'integer' }
        }
      },
      ProgramRegistryResponse: {
        type: 'object',
        properties: {
          programs: { type: 'array', items: { $ref: '#/components/schemas/ProgramDetailResponse' } },
          total: { type: 'integer' }
        }
      },
      ProgramMetadataResponse: {
        type: 'object',
        properties: {
          metadata: { type: 'array', items: { $ref: '#/components/schemas/ProgramDetailResponse' } }
        }
      },
      // AI-Powered Schemas
      AIAnswerResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          answer: { type: 'string', example: 'The transaction was successful and transferred 5 SOL...' },
          sources: { type: 'array', items: { type: 'object' } },
          confidence: { type: 'number', example: 0.95 },
          executedTools: { type: 'array', items: { type: 'string' } }
        }
      },
      SimilarQuestionsResponse: {
        type: 'object',
        properties: {
          questions: { type: 'array', items: { type: 'string' } },
          count: { type: 'integer' }
        }
      },
      SourcesResponse: {
        type: 'object',
        properties: {
          sources: { type: 'array', items: { type: 'object' } },
          count: { type: 'integer' }
        }
      },
      AnalyzeResponse: {
        type: 'object',
        properties: {
          analysis: { type: 'string' },
          insights: { type: 'array', items: { type: 'string' } },
          recommendations: { type: 'array', items: { type: 'string' } }
        }
      },
      AIContextResponse: {
        type: 'object',
        properties: {
          context: { type: 'object' },
          relevant: { type: 'boolean' }
        }
      },
      // Streaming & Scan Response Schemas
      ScanResponse: {
        type: 'object',
        properties: {
          results: { type: 'array', items: { type: 'object' } },
          scanned: { type: 'integer' },
          found: { type: 'integer' }
        }
      },
      // Generic Success Response
      SuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Operation completed successfully' },
          data: { type: 'object', description: 'Response data' }
        }
      }
    };
  }

  private registerAllEndpoints() {
    // Convert imported API methods to OpenAPI endpoints
    apiMethods.forEach(method => {
      const endpoint: OpenAPIEndpoint = {
        path: this.convertEndpointPath(method.endpoint),
        method: method.method,
        summary: method.name,
        description: method.description,
        tags: [method.category],
        parameters: this.extractParameters(method.endpoint, method.method),
        responses: this.getResponsesForEndpoint(method.endpoint, method.id),
        operationId: method.id
      };

      if (method.method === 'POST' || method.method === 'PUT' || method.method === 'PATCH') {
        endpoint.requestBody = {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                description: `Request body for ${method.name}`
              }
            }
          }
        };
      }

      this.addEndpoint(endpoint);
    });
  }

  private getResponsesForEndpoint(endpoint: string, operationId: string): Record<string, OpenAPIResponse> {
    const errorSchema = { $ref: '#/components/schemas/Error' };
    
    const baseResponses: Record<string, OpenAPIResponse> = {
      '400': {
        status: 400,
        description: 'Bad request - Invalid parameters',
        schema: errorSchema
      },
      '404': {
        status: 404,
        description: 'Not found',
        schema: errorSchema
      },
      '500': {
        status: 500,
        description: 'Internal server error',
        schema: errorSchema
      }
    };

    // Determine response schema based on endpoint pattern
    // ORDER MATTERS: Most specific patterns first!
    let responseSchema: any;
    let description = 'Successful response';

    // ===== MARKET DATA ENDPOINTS =====
    if (endpoint.includes('/market-data') || operationId === 'market-data') {
      responseSchema = { $ref: '#/components/schemas/MarketDataResponse' };
      description = 'Market data retrieved successfully';
    }
    else if (endpoint.includes('/chart') || operationId === 'chart') {
      responseSchema = { $ref: '#/components/schemas/ChartResponse' };
      description = 'Chart data retrieved successfully';
    }
    else if (endpoint.includes('/trades') || operationId === 'trades') {
      responseSchema = { $ref: '#/components/schemas/TradesResponse' };
      description = 'Trade data retrieved successfully';
    }
    
    // ===== SEARCH ENDPOINTS =====
    else if (endpoint.includes('/search/suggestions') || operationId === 'search-suggestions') {
      responseSchema = { $ref: '#/components/schemas/SearchSuggestionsResponse' };
      description = 'Search suggestions retrieved successfully';
    }
    else if (endpoint.includes('/search') || operationId.includes('search')) {
      responseSchema = { $ref: '#/components/schemas/SearchResponse' };
      description = 'Search results retrieved successfully';
    }
    
    // ===== PROGRAM DISCOVERY ENDPOINTS =====
    else if (endpoint.includes('/program-metadata') || operationId === 'program-metadata') {
      responseSchema = { $ref: '#/components/schemas/ProgramMetadataResponse' };
      description = 'Program metadata retrieved successfully';
    }
    else if (endpoint.includes('/program-registry') || operationId === 'program-registry') {
      responseSchema = { $ref: '#/components/schemas/ProgramRegistryResponse' };
      description = 'Program registry retrieved successfully';
    }
    else if (endpoint.includes('/program-discovery') || operationId === 'program-discovery') {
      responseSchema = { $ref: '#/components/schemas/ProgramDiscoveryResponse' };
      description = 'Program discovery results retrieved successfully';
    }
    else if (endpoint.includes('/program/') || operationId === 'get-program') {
      responseSchema = { $ref: '#/components/schemas/ProgramDetailResponse' };
      description = 'Program details retrieved successfully';
    }
    
    // ===== ACCOUNT ENDPOINTS (Most specific first!) =====
    else if (endpoint.includes('/account-token-stats') || operationId === 'account-token-stats') {
      responseSchema = { $ref: '#/components/schemas/TokenStatsResponse' };
      description = 'Token statistics retrieved successfully';
    }
    else if (endpoint.includes('/account-transfers') || operationId === 'account-transfers') {
      responseSchema = { $ref: '#/components/schemas/TransferListResponse' };
      description = 'Transfer history retrieved successfully';
    }
    else if (endpoint.includes('/account-transactions') || operationId === 'account-transactions') {
      responseSchema = { $ref: '#/components/schemas/TransactionListResponse' };
      description = 'Transaction history retrieved successfully';
    }
    else if (endpoint.includes('/account-stats') || operationId === 'account-stats') {
      responseSchema = { $ref: '#/components/schemas/AccountStatsResponse' };
      description = 'Account statistics retrieved successfully';
    }
    else if (endpoint.includes('/account-portfolio') || operationId === 'account-portfolio') {
      responseSchema = { $ref: '#/components/schemas/PortfolioResponse' };
      description = 'Portfolio data retrieved successfully';
    }
    else if (endpoint.includes('/check-account-type') || operationId === 'check-account-type') {
      responseSchema = { $ref: '#/components/schemas/AccountTypeResponse' };
      description = 'Account type information retrieved successfully';
    }
    // General account endpoint - last resort for /account paths
    else if (endpoint.includes('/account') && !endpoint.includes('/transaction')) {
      responseSchema = { $ref: '#/components/schemas/AccountInfo' };
      description = 'Account information retrieved successfully';
    }
    
    // ===== USER ENDPOINTS =====
    else if (endpoint.includes('/user-feed') || operationId === 'user-feed') {
      responseSchema = { $ref: '#/components/schemas/UserFeedResponse' };
      description = 'User feed retrieved successfully';
    }
    else if (endpoint.includes('/user-history') || operationId === 'user-history') {
      responseSchema = { $ref: '#/components/schemas/TransactionListResponse' };
      description = 'User history retrieved successfully';
    }
    else if (endpoint.includes('/user-profile') || operationId === 'user-profile') {
      responseSchema = { $ref: '#/components/schemas/UserProfileResponse' };
      description = 'User profile retrieved successfully';
    }
    
    // ===== TRANSACTION ENDPOINTS (Specific first!) =====
    else if (endpoint.includes('/transaction') && endpoint.includes('/failure-analysis')) {
      responseSchema = { $ref: '#/components/schemas/FailureAnalysisResponse' };
      description = 'Failure analysis retrieved successfully';
    }
    else if (endpoint.includes('/transaction') && endpoint.includes('/analysis')) {
      responseSchema = { $ref: '#/components/schemas/TransactionAnalysisResponse' };
      description = 'Transaction analysis retrieved successfully';
    }
    else if (endpoint.includes('/transaction') && endpoint.includes('/explain')) {
      responseSchema = { $ref: '#/components/schemas/TransactionExplanationResponse' };
      description = 'Transaction explanation retrieved successfully';
    }
    else if (endpoint.includes('/transaction') && endpoint.includes('/metrics')) {
      responseSchema = { $ref: '#/components/schemas/TransactionMetricsResponse' };
      description = 'Transaction metrics retrieved successfully';
    }
    else if (endpoint.includes('/transaction') && endpoint.includes('/related')) {
      responseSchema = { $ref: '#/components/schemas/RelatedTransactionsResponse' };
      description = 'Related transactions retrieved successfully';
    }
    else if (endpoint.includes('/transaction/batch') || operationId === 'batch-transactions') {
      responseSchema = { $ref: '#/components/schemas/BatchTransactionsResponse' };
      description = 'Batch transactions retrieved successfully';
    }
    else if (endpoint.includes('/filter-transactions') || operationId === 'filter-transactions') {
      responseSchema = { $ref: '#/components/schemas/TransactionListResponse' };
      description = 'Filtered transactions retrieved successfully';
    }
    else if (endpoint.includes('/analyze-transaction') || operationId === 'analyze-transaction') {
      responseSchema = { $ref: '#/components/schemas/TransactionAnalysisResponse' };
      description = 'Transaction analysis completed successfully';
    }
    // General transaction endpoints
    else if (endpoint.includes('/transaction') || endpoint.includes('/tx')) {
      if (endpoint.includes('/transactions') || endpoint.includes('/history')) {
        responseSchema = { $ref: '#/components/schemas/TransactionListResponse' };
        description = 'Transaction list retrieved successfully';
      } else {
        responseSchema = { $ref: '#/components/schemas/TransactionDetail' };
        description = 'Transaction details retrieved successfully';
      }
    }
    
    // ===== BLOCK ENDPOINTS =====
    else if (endpoint.includes('/blocks/stats') || operationId === 'block-stats') {
      responseSchema = { $ref: '#/components/schemas/BlockStatsResponse' };
      description = 'Block statistics retrieved successfully';
    }
    else if (endpoint.includes('/blocks/') && endpoint.match(/\/\d+$/)) {
      responseSchema = { $ref: '#/components/schemas/BlockDetail' };
      description = 'Block details retrieved successfully';
    }
    else if (endpoint.includes('/blocks') || operationId === 'recent-blocks') {
      responseSchema = { $ref: '#/components/schemas/BlockListResponse' };
      description = 'Block list retrieved successfully';
    }
    else if (endpoint.includes('/slots') || operationId === 'slots') {
      responseSchema = { $ref: '#/components/schemas/SlotInfoResponse' };
      description = 'Slot information retrieved successfully';
    }
    
    // ===== RPC ENDPOINTS =====
    else if (endpoint.includes('/solana-rpc') || operationId === 'solana-rpc') {
      responseSchema = { $ref: '#/components/schemas/RPCResponse' };
      description = 'RPC response retrieved successfully';
    }
    else if (endpoint.includes('/solana-proxy') || operationId === 'solana-proxy') {
      responseSchema = { $ref: '#/components/schemas/RPCResponse' };
      description = 'Proxied RPC response retrieved successfully';
    }
    
    // ===== TOKEN & NFT ENDPOINTS =====
    else if (endpoint.includes('/token-metadata') || operationId === 'token-metadata') {
      responseSchema = { $ref: '#/components/schemas/TokenMetadataResponse' };
      description = 'Token metadata retrieved successfully';
    }
    else if (endpoint.includes('/check-token') || operationId === 'check-token') {
      responseSchema = { $ref: '#/components/schemas/TokenCheckResponse' };
      description = 'Token check completed successfully';
    }
    else if (endpoint.includes('/nft-collections/trending') || operationId === 'nft-collections-trending') {
      responseSchema = { $ref: '#/components/schemas/NFTCollectionsResponse' };
      description = 'Trending NFT collections retrieved successfully';
    }
    else if (endpoint.includes('/nft-collections/new') || operationId === 'nft-collections-new') {
      responseSchema = { $ref: '#/components/schemas/NFTCollectionsResponse' };
      description = 'New NFT collections retrieved successfully';
    }
    else if (endpoint.includes('/nft-collections') || operationId === 'nft-collections') {
      responseSchema = { $ref: '#/components/schemas/NFTCollectionsResponse' };
      description = 'NFT collections retrieved successfully';
    }
    else if (endpoint.includes('/token/') || operationId === 'get-token') {
      responseSchema = { $ref: '#/components/schemas/TokenInfo' };
      description = 'Token information retrieved successfully';
    }
    
    // ===== ANALYTICS ENDPOINTS =====
    else if (endpoint.includes('/analytics/overview') || operationId === 'analytics-overview') {
      responseSchema = { $ref: '#/components/schemas/AnalyticsOverviewResponse' };
      description = 'Analytics overview retrieved successfully';
    }
    else if (endpoint.includes('/analytics/dex') || operationId === 'analytics-dex') {
      responseSchema = { $ref: '#/components/schemas/DEXAnalyticsResponse' };
      description = 'DEX analytics retrieved successfully';
    }
    else if (endpoint.includes('/analytics/defi-health') || operationId === 'analytics-defi-health') {
      responseSchema = { $ref: '#/components/schemas/DeFiHealthResponse' };
      description = 'DeFi health metrics retrieved successfully';
    }
    else if (endpoint.includes('/analytics/validators') || operationId.includes('validators')) {
      responseSchema = { $ref: '#/components/schemas/ValidatorAnalyticsResponse' };
      description = 'Validator analytics retrieved successfully';
    }
    else if (endpoint.includes('/analytics/marketplaces') || operationId === 'analytics-marketplaces') {
      responseSchema = { $ref: '#/components/schemas/MarketplaceAnalyticsResponse' };
      description = 'Marketplace analytics retrieved successfully';
    }
    else if (endpoint.includes('/analytics/aggregators') || operationId === 'analytics-aggregators') {
      responseSchema = { $ref: '#/components/schemas/AggregatorAnalyticsResponse' };
      description = 'Aggregator analytics retrieved successfully';
    }
    else if (endpoint.includes('/analytics/launchpads') || operationId === 'analytics-launchpads') {
      responseSchema = { $ref: '#/components/schemas/LaunchpadAnalyticsResponse' };
      description = 'Launchpad analytics retrieved successfully';
    }
    else if (endpoint.includes('/analytics/bots') || operationId === 'analytics-bots') {
      responseSchema = { $ref: '#/components/schemas/BotAnalyticsResponse' };
      description = 'Bot analytics retrieved successfully';
    }
    else if (endpoint.includes('/analytics/socialfi') || operationId === 'analytics-socialfi') {
      responseSchema = { $ref: '#/components/schemas/SocialFiAnalyticsResponse' };
      description = 'SocialFi analytics retrieved successfully';
    }
    else if (endpoint.includes('/analytics') || operationId.includes('analytics')) {
      responseSchema = { $ref: '#/components/schemas/AnalyticsResponse' };
      description = 'Analytics data retrieved successfully';
    }
    
    // ===== AI-POWERED ENDPOINTS =====
    else if (endpoint.includes('/getAnswer') || operationId === 'get-answer') {
      responseSchema = { $ref: '#/components/schemas/AIAnswerResponse' };
      description = 'AI-generated answer retrieved successfully';
    }
    else if (endpoint.includes('/getSimilarQuestions') || operationId === 'get-similar-questions') {
      responseSchema = { $ref: '#/components/schemas/SimilarQuestionsResponse' };
      description = 'Similar questions retrieved successfully';
    }
    else if (endpoint.includes('/getSources') || operationId === 'get-sources') {
      responseSchema = { $ref: '#/components/schemas/SourcesResponse' };
      description = 'Sources retrieved successfully';
    }
    else if (endpoint.includes('/analyze') || operationId === 'analyze') {
      responseSchema = { $ref: '#/components/schemas/AnalyzeResponse' };
      description = 'Analysis completed successfully';
    }
    else if (endpoint.includes('/ai-response') || operationId === 'ai-response') {
      responseSchema = { $ref: '#/components/schemas/AIAnswerResponse' };
      description = 'AI response generated successfully';
    }
    else if (endpoint.includes('/ai-context') || operationId === 'ai-context') {
      responseSchema = { $ref: '#/components/schemas/AIContextResponse' };
      description = 'AI context retrieved successfully';
    }
    
    // ===== SSE & STREAMING ENDPOINTS =====
    else if (endpoint.includes('/sse-feed') || endpoint.includes('/sse-events') || endpoint.includes('/sse-alerts')) {
      responseSchema = { type: 'string', description: 'Server-Sent Events stream' };
      description = 'SSE stream connection established';
    }
    else if (endpoint.includes('/stream') || operationId === 'stream') {
      responseSchema = { type: 'string', description: 'Data stream' };
      description = 'Stream connection established';
    }
    else if (endpoint.includes('/scan') || operationId === 'scan') {
      responseSchema = { $ref: '#/components/schemas/ScanResponse' };
      description = 'Scan completed successfully';
    }
    
    // ===== DEFAULT GENERIC RESPONSE =====
    else {
      responseSchema = { $ref: '#/components/schemas/SuccessResponse' };
      description = 'Operation completed successfully';
    }

    return {
      '200': {
        status: 200,
        description,
        schema: responseSchema
      },
      ...baseResponses
    };
  }

  private convertEndpointPath(endpoint: string): string {
    // Convert /api/... to just /... since base path is already in servers
    let path = endpoint.replace('/api/', '/');
    
    // Convert {param} style to OpenAPI format if needed
    path = path.replace(/\{([^}]+)\}/g, '{$1}');
    
    return path;
  }

  private extractParameters(endpoint: string, method: string): OpenAPIParameter[] {
    const parameters: OpenAPIParameter[] = [];
    
    // Extract path parameters
    const pathParams = endpoint.match(/\{([^}]+)\}/g);
    if (pathParams) {
      pathParams.forEach(param => {
        const paramName = param.replace(/[{}]/g, '');
        parameters.push({
          name: paramName,
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: `${paramName} parameter`
        });
      });
    }

    // Special handling for account-transfers endpoint
    if (endpoint.includes('/account-transfers')) {
      parameters.push({
        name: 'beforeSignature',
        in: 'query',
        required: false,
        schema: { type: 'string' },
        description: 'Smart cursor initialization: use oldest cached signature if no beforeSignature provided'
      });
      parameters.push({
        name: 'offset',
        in: 'query',
        required: false,
        schema: { type: 'number' },
        description: 'Pagination offset'
      });
      parameters.push({
        name: 'limit',
        in: 'query',
        required: false,
        schema: { type: 'string' },
        description: 'Maximum number of transfers to return'
      });
      parameters.push({
        name: 'transferType',
        in: 'query',
        required: false,
        schema: { 
          type: 'string',
          enum: ['IN', 'OUT']
        },
        description: 'Filter by transfer direction'
      });
      parameters.push({
        name: 'solanaOnly',
        in: 'query',
        required: false,
        schema: { type: 'boolean' },
        description: 'Show only SOL transfers (exclude tokens)'
      });
      return parameters;
    }

    // Special handling for market-data endpoint
    if (endpoint.includes('/market-data')) {
      parameters.push({
        name: 'mint',
        in: 'query',
        required: false,
        schema: { type: 'string' },
        description: 'Token mint address (defaults to OSVM token: DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263)'
      });
      parameters.push({
        name: 'endpoint',
        in: 'query',
        required: false,
        schema: { 
          type: 'string',
          enum: ['ohlcv', 'overview', 'security'],
          default: 'ohlcv'
        },
        description: 'Type of market data to fetch'
      });
      parameters.push({
        name: 'type',
        in: 'query',
        required: false,
        schema: { 
          type: 'string',
          enum: ['1m', '3m', '5m', '15m', '30m', '1H', '2H', '4H', '6H', '8H', '12H', '1D', '3D', '1W', '1M'],
          default: '1H'
        },
        description: 'OHLCV candlestick timeframe (only for endpoint=ohlcv)'
      });
      parameters.push({
        name: 'baseMint',
        in: 'query',
        required: false,
        schema: { type: 'string' },
        description: 'Filter results by base token mint address'
      });
      parameters.push({
        name: 'poolAddress',
        in: 'query',
        required: false,
        schema: { type: 'string' },
        description: 'Query specific DEX pool address'
      });
      return parameters;
    }

    // Add common query parameters for GET requests
    if (method === 'GET') {
      if (endpoint.includes('transactions') || endpoint.includes('blocks')) {
        parameters.push({
          name: 'limit',
          in: 'query',
          required: false,
          schema: { type: 'integer', default: 10 },
          description: 'Number of results to return'
        });
        parameters.push({
          name: 'offset',
          in: 'query',
          required: false,
          schema: { type: 'integer', default: 0 },
          description: 'Offset for pagination'
        });
      }
    }

    return parameters;
  }

  private addEndpoint(endpoint: OpenAPIEndpoint) {
    this.endpoints.push(endpoint);
  }

  public generateSpec(): OpenAPISpec {
    // Build paths from endpoints
    this.spec.paths = {};
    
    for (const endpoint of this.endpoints) {
      if (!this.spec.paths[endpoint.path]) {
        this.spec.paths[endpoint.path] = {};
      }

      const operation: any = {
        summary: endpoint.summary,
        description: endpoint.description,
        tags: endpoint.tags || [],
        operationId: endpoint.operationId,
        parameters: endpoint.parameters,
        responses: {}
      };

      // Add request body if present
      if (endpoint.requestBody) {
        operation.requestBody = endpoint.requestBody;
      }

      // Add responses
      for (const [status, response] of Object.entries(endpoint.responses)) {
        operation.responses[status] = {
          description: response.description,
          ...(response.schema && {
            content: {
              'application/json': {
                schema: response.schema
              }
            }
          })
        };
      }

      // Add curl example (x-code-samples extension)
      const curlExample = this.generateCurlExample(endpoint);
      if (curlExample) {
        operation['x-code-samples'] = [
          {
            lang: 'Shell',
            label: 'cURL',
            source: curlExample
          }
        ];
      }

      this.spec.paths[endpoint.path][endpoint.method.toLowerCase()] = operation;
    }

    return this.spec;
  }

  private generateCurlExample(endpoint: OpenAPIEndpoint): string {
    const baseUrl = 'https://opensvm.com/api';
    let url = `${baseUrl}${endpoint.path}`;
    
    // Replace path parameters with example values
    url = url.replace('{address}', 'REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck');
    url = url.replace('{walletAddress}', 'REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck');
    url = url.replace('{signature}', '5vYsYWPF4gdN1imxLpJAWi9QKpN3MSrFTFXK8pfmPogFjQNPiAkxFQCGzEEWNto16mWnwmdwNQH7KPCnkMcZ9Ba5');
    url = url.replace('{slot}', '290000000');
    url = url.replace('{mint}', 'So11111111111111111111111111111111111111112');
    
    // Add common query parameters based on endpoint type
    const queryParams: string[] = [];
    if (endpoint.path.includes('/account-transfers')) {
      queryParams.push('limit=10');
    } else if (endpoint.path.includes('/market-data')) {
      queryParams.push('endpoint=ohlcv');
      queryParams.push('type=1H');
    } else if (endpoint.path.includes('/search')) {
      queryParams.push('query=solana');
    } else if (endpoint.method === 'GET' && (endpoint.path.includes('/transactions') || endpoint.path.includes('/blocks'))) {
      queryParams.push('limit=10');
    }
    
    if (queryParams.length > 0) {
      url += '?' + queryParams.join('&');
    }

    let curl = `curl "${url}"`;
    
    // Add method if not GET
    if (endpoint.method !== 'GET') {
      curl = `curl -X ${endpoint.method} "${url}"`;
    }
    
    // Add request body for POST/PUT/PATCH
    if (endpoint.requestBody && (endpoint.method === 'POST' || endpoint.method === 'PUT' || endpoint.method === 'PATCH')) {
      curl += ' \\\n  -H "Content-Type: application/json"';
      
      // Add example body based on endpoint
      if (endpoint.path.includes('/transaction/batch')) {
        curl += ' \\\n  -d \'{"signatures":["5vYsYWPF4gdN1imxLpJAWi9QKpN3MSrFTFXK8pfmPogFjQNPiAkxFQCGzEEWNto16mWnwmdwNQH7KPCnkMcZ9Ba5"]}\'';
      } else if (endpoint.path.includes('/getAnswer')) {
        curl += ' \\\n  -d \'{"question":"What is the latest block?","conversationId":"test-123"}\'';
      } else if (endpoint.path.includes('/analyze-transaction') || endpoint.path.includes('/analyze')) {
        curl += ' \\\n  -d \'{"signature":"5vYsYWPF4gdN1imxLpJAWi9QKpN3MSrFTFXK8pfmPogFjQNPiAkxFQCGzEEWNto16mWnwmdwNQH7KPCnkMcZ9Ba5"}\'';
      } else if (endpoint.path.includes('/filter-transactions')) {
        curl += ' \\\n  -d \'{"account":"REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck","minAmount":1}\'';
      } else if (endpoint.path.includes('/solana-rpc') || endpoint.path.includes('/solana-proxy')) {
        curl += ' \\\n  -d \'{"method":"getHealth","params":[]}\'';
      } else if (endpoint.path.includes('/getSimilarQuestions')) {
        curl += ' \\\n  -d \'{"question":"What is Solana?"}\'';
      } else if (endpoint.path.includes('/getSources')) {
        curl += ' \\\n  -d \'{"query":"solana transactions"}\'';
      } else {
        curl += ' \\\n  -d \'{}\'';
      }
    }
    
    return curl;
  }

  public generateSpecFile(outputPath: string): void {
    const spec = this.generateSpec();
    fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2));
  }

  public generateSpecYaml(outputPath: string): void {
    const spec = this.generateSpec();
    // For YAML generation, you'd typically use a YAML library
    // For now, we'll just generate JSON
    fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2));
  }

  // Scan API routes directory and auto-generate endpoints
  public async scanApiRoutes(apiDir: string): Promise<void> {
    try {
      const routes = this.findApiRoutes(apiDir);
      
      for (const route of routes) {
        // Analyze route file and extract endpoint information
        const endpointInfo = this.analyzeRouteFile(route);
        if (endpointInfo) {
          this.addEndpoint(endpointInfo);
        }
      }
    } catch (error) {
      console.error('Error scanning API routes:', error);
    }
  }

  private findApiRoutes(dir: string, routes: string[] = []): string[] {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        this.findApiRoutes(fullPath, routes);
      } else if (file === 'route.ts' || file === 'route.js') {
        routes.push(fullPath);
      }
    }
    
    return routes;
  }

  private analyzeRouteFile(filePath: string): OpenAPIEndpoint | null {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Extract route path from file path
      const relativePath = path.relative('app/api', path.dirname(filePath));
      const apiPath = '/' + relativePath.replace(/\\/g, '/').replace(/\[([^\]]+)\]/g, '{$1}');
      
      // Basic analysis - in a real implementation, you'd parse the TypeScript/JavaScript
      const hasGET = content.includes('export async function GET');
      const hasPOST = content.includes('export async function POST');
      const hasPUT = content.includes('export async function PUT');
      const hasDELETE = content.includes('export async function DELETE');
      
      if (hasGET || hasPOST || hasPUT || hasDELETE) {
        const method = hasGET ? 'GET' : hasPOST ? 'POST' : hasPUT ? 'PUT' : 'DELETE';
        
        return {
          path: apiPath,
          method: method as any,
          summary: `${method} ${apiPath}`,
          description: `Auto-generated endpoint for ${apiPath}`,
          tags: [this.inferTagFromPath(apiPath)],
          responses: {
            '200': {
              status: 200,
              description: 'Successful response',
              schema: { type: 'object' }
            }
          },
          operationId: this.generateOperationId(method, apiPath)
        };
      }
    } catch (error) {
      console.error('Error analyzing route file:', filePath, error);
    }
    
    return null;
  }

  private inferTagFromPath(path: string): string {
    if (path.includes('/transaction')) return 'Transactions';
    if (path.includes('/account')) return 'Account & Wallet';
    if (path.includes('/block')) return 'Blockchain';
    if (path.includes('/search')) return 'Search & Discovery';
    if (path.includes('/analyze') || path.includes('/getAnswer')) return 'AI-Powered';
    if (path.includes('/analytics')) return 'Analytics';
    if (path.includes('/token') || path.includes('/nft')) return 'Tokens & NFTs';
    if (path.includes('/sse') || path.includes('/stream')) return 'Real-Time';
    if (path.includes('/user')) return 'User Services';
    return 'General';
  }

  private generateOperationId(method: string, path: string): string {
    const cleanPath = path.replace(/[{}]/g, '').replace(/\//g, '_').replace(/_+/g, '_');
    return method.toLowerCase() + cleanPath.split('_').map(part => 
      part.charAt(0).toUpperCase() + part.slice(1)
    ).join('');
  }
}

export const openApiGenerator = new OpenAPIGenerator();
export default OpenAPIGenerator;
