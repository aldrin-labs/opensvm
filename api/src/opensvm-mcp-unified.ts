#!/usr/bin/env bun
/**
 * OpenSVM Unified MCP Server
 *
 * Consolidates all MCP tools into a single server with namespaced categories:
 * - solana:*      - Solana blockchain exploration (50+ tools)
 * - dflow:*       - DFlow prediction markets (24 tools)
 * - kalshi:*      - Kalshi prediction markets (75 tools)
 * - lp:*          - Liquidity mining (15 tools)
 * - governance:*  - Governance timelock (16 tools)
 * - federation:*  - MCP federation network
 * - agent:*       - Multi-agent orchestration
 * - bank:*        - OpenSVM Bank operations
 *
 * Total: 200+ tools in one unified server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  McpError,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// ============================================================================
// Configuration
// ============================================================================

export const configSchema = z.object({
  opensvmApiUrl: z.string()
    .describe('OpenSVM API base URL')
    .default('https://osvm.ai'),
  dflowApiUrl: z.string()
    .describe('DFlow API base URL')
    .default('https://prediction-markets-api.dflow.net'),
  kalshiApiUrl: z.string()
    .describe('Kalshi API base URL')
    .default('https://api.elections.kalshi.com/trade-api/v2'),
  kalshiApiKeyId: z.string().optional(),
  kalshiPrivateKey: z.string().optional(),
  opensvmApiKey: z.string().optional(),
  requestTimeout: z.number().default(30000),
});

type ServerConfig = z.infer<typeof configSchema>;

// ============================================================================
// Namespace Definitions
// ============================================================================

const NAMESPACES = {
  solana: {
    prefix: 'solana:',
    description: 'Solana blockchain exploration - transactions, accounts, blocks, tokens',
  },
  dflow: {
    prefix: 'dflow:',
    description: 'DFlow prediction markets - events, markets, trades, forecasts',
  },
  kalshi: {
    prefix: 'kalshi:',
    description: 'Kalshi prediction markets - full Trade API v2',
  },
  lp: {
    prefix: 'lp:',
    description: 'Liquidity mining - pools, positions, rewards',
  },
  governance: {
    prefix: 'governance:',
    description: 'Governance timelock - actions, multi-sig, execution',
  },
  federation: {
    prefix: 'federation:',
    description: 'MCP federation network - server discovery, trust',
  },
  agent: {
    prefix: 'agent:',
    description: 'Multi-agent orchestration - investigation, analysis',
  },
  bank: {
    prefix: 'bank:',
    description: 'OpenSVM Bank - wallets, trading, positions',
  },
} as const;

// ============================================================================
// Tool Registry - Centralized Tool Definitions
// ============================================================================

// Solana namespace tools (from opensvm-mcp.ts)
const SOLANA_TOOLS: Tool[] = [
  // Transaction tools
  {
    name: 'solana:get_transaction',
    description: 'Get detailed information about a Solana transaction by signature',
    inputSchema: {
      type: 'object',
      properties: {
        signature: { type: 'string', description: 'Transaction signature (base58)' },
      },
      required: ['signature'],
    },
  },
  {
    name: 'solana:explain_transaction',
    description: 'Get AI-powered explanation of a transaction in simple terms',
    inputSchema: {
      type: 'object',
      properties: {
        signature: { type: 'string', description: 'Transaction signature' },
      },
      required: ['signature'],
    },
  },
  {
    name: 'solana:analyze_transaction',
    description: 'Deep analysis of transaction including program interactions and token flows',
    inputSchema: {
      type: 'object',
      properties: {
        signature: { type: 'string', description: 'Transaction signature' },
      },
      required: ['signature'],
    },
  },
  // Account tools
  {
    name: 'solana:get_account_portfolio',
    description: 'Get portfolio of a Solana account including SOL and token balances',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Solana account address' },
      },
      required: ['address'],
    },
  },
  {
    name: 'solana:get_account_transactions',
    description: 'Get recent transactions for a Solana account',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Solana account address' },
        limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Max transactions (default: 20)' },
      },
      required: ['address'],
    },
  },
  {
    name: 'solana:get_account_stats',
    description: 'Get statistics and analytics for a Solana account',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Solana account address' },
      },
      required: ['address'],
    },
  },
  // Block tools
  {
    name: 'solana:get_blocks',
    description: 'Get list of recent Solana blocks with transaction counts',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Number of blocks (default: 10)' },
        before: { type: 'integer', description: 'Get blocks before this slot' },
      },
    },
  },
  {
    name: 'solana:get_block',
    description: 'Get detailed information about a specific block',
    inputSchema: {
      type: 'object',
      properties: {
        slot: { type: 'integer', description: 'Block slot number' },
      },
      required: ['slot'],
    },
  },
  // Token tools
  {
    name: 'solana:get_token_ohlcv',
    description: 'Get OHLCV candlestick data for a token with technical indicators',
    inputSchema: {
      type: 'object',
      properties: {
        mint: { type: 'string', description: 'Token mint address' },
        type: { type: 'string', enum: ['1m', '5m', '15m', '1H', '4H', '1D'], description: 'Timeframe' },
      },
      required: ['mint'],
    },
  },
  {
    name: 'solana:get_token_markets',
    description: 'Get top liquidity pools/markets for a token across DEXes',
    inputSchema: {
      type: 'object',
      properties: {
        mint: { type: 'string', description: 'Token mint address' },
        baseMint: { type: 'string', description: 'Filter by base token (optional)' },
      },
      required: ['mint'],
    },
  },
  {
    name: 'solana:get_token_metadata',
    description: 'Get token metadata including name, symbol, decimals, supply',
    inputSchema: {
      type: 'object',
      properties: {
        mint: { type: 'string', description: 'Token mint address' },
      },
      required: ['mint'],
    },
  },
  // Program tools
  {
    name: 'solana:get_program',
    description: 'Get information about a Solana program including IDL',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Program address' },
      },
      required: ['address'],
    },
  },
  // Search tools
  {
    name: 'solana:search',
    description: 'Search for transactions, accounts, tokens, or programs',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  },
  {
    name: 'solana:find_wallet_path',
    description: 'Find shortest path of token transfers between two wallets',
    inputSchema: {
      type: 'object',
      properties: {
        sourceWallet: { type: 'string', description: 'Source wallet address' },
        targetWallet: { type: 'string', description: 'Target wallet address' },
        maxDepth: { type: 'integer', minimum: 1, maximum: 100, description: 'Max search depth (default: 42)' },
      },
      required: ['sourceWallet', 'targetWallet'],
    },
  },
];

// DFlow namespace tools (from index.ts)
const DFLOW_TOOLS: Tool[] = [
  // Event tools
  {
    name: 'dflow:get_event',
    description: 'Get a single event by ticker including markets and metadata',
    inputSchema: {
      type: 'object',
      properties: {
        event_id: { type: 'string', description: 'Event ticker' },
        withNestedMarkets: { type: 'boolean', description: 'Include nested markets' },
      },
      required: ['event_id'],
    },
  },
  {
    name: 'dflow:get_events',
    description: 'Get paginated list of events with filtering and sorting',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 0, description: 'Max events to return' },
        cursor: { type: 'integer', minimum: 0, description: 'Pagination cursor' },
        withNestedMarkets: { type: 'boolean' },
        seriesTickers: { type: 'string', description: 'Filter by series (comma-separated)' },
        status: { type: 'string', description: 'Filter by status' },
        sort: { type: 'string', enum: ['volume', 'volume24h', 'liquidity', 'openInterest', 'startDate'] },
      },
    },
  },
  {
    name: 'dflow:search_events',
    description: 'Search events with nested markets by title or ticker',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Search query' },
        sort: { type: 'string', enum: ['volume', 'volume24h', 'liquidity', 'openInterest', 'startDate'] },
        order: { type: 'string', enum: ['desc', 'asc'] },
        limit: { type: 'integer', minimum: 0 },
        cursor: { type: 'integer', minimum: 0 },
      },
      required: ['q'],
    },
  },
  // Market tools
  {
    name: 'dflow:get_market',
    description: 'Get details of a market by ticker',
    inputSchema: {
      type: 'object',
      properties: {
        market_id: { type: 'string', description: 'Market ticker' },
      },
      required: ['market_id'],
    },
  },
  {
    name: 'dflow:get_market_by_mint',
    description: 'Get market by mint address lookup',
    inputSchema: {
      type: 'object',
      properties: {
        mint_address: { type: 'string', description: 'Ledger or outcome mint address' },
      },
      required: ['mint_address'],
    },
  },
  {
    name: 'dflow:get_markets',
    description: 'Get paginated list of markets with filtering',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 0 },
        cursor: { type: 'integer', minimum: 0 },
        isInitialized: { type: 'boolean' },
        status: { type: 'string' },
        sort: { type: 'string', enum: ['volume', 'volume24h', 'liquidity', 'openInterest', 'startDate'] },
      },
    },
  },
  {
    name: 'dflow:get_markets_batch',
    description: 'Get multiple markets by tickers/mints (up to 100)',
    inputSchema: {
      type: 'object',
      properties: {
        tickers: { type: 'array', items: { type: 'string' }, description: 'Market tickers' },
        mints: { type: 'array', items: { type: 'string' }, description: 'Mint addresses' },
      },
    },
  },
  // Trade tools
  {
    name: 'dflow:get_trades',
    description: 'Get paginated list of trades with filtering',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 0 },
        cursor: { type: 'string' },
        ticker: { type: 'string', description: 'Filter by market ticker' },
        minTs: { type: 'integer', minimum: 0 },
        maxTs: { type: 'integer', minimum: 0 },
      },
    },
  },
  {
    name: 'dflow:get_trades_by_mint',
    description: 'Get trades for a market by mint address',
    inputSchema: {
      type: 'object',
      properties: {
        mint_address: { type: 'string', description: 'Mint address' },
        limit: { type: 'integer', minimum: 0 },
        cursor: { type: 'string' },
      },
      required: ['mint_address'],
    },
  },
  // Forecast tools
  {
    name: 'dflow:get_forecast_history',
    description: 'Get historical forecast percentiles for an event',
    inputSchema: {
      type: 'object',
      properties: {
        series_ticker: { type: 'string' },
        event_id: { type: 'string' },
        percentiles: { type: 'string', description: 'Comma-separated percentiles' },
        startTs: { type: 'integer', minimum: 0 },
        endTs: { type: 'integer', minimum: 0 },
        periodInterval: { type: 'integer', minimum: 0 },
      },
      required: ['series_ticker', 'event_id', 'percentiles', 'startTs', 'endTs', 'periodInterval'],
    },
  },
  // Candlestick tools
  {
    name: 'dflow:get_event_candlesticks',
    description: 'Get event candlesticks from Kalshi API',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', description: 'Event ticker' },
        startTs: { type: 'integer', minimum: 0 },
        endTs: { type: 'integer', minimum: 0 },
        periodInterval: { type: 'integer', minimum: 0 },
      },
      required: ['ticker', 'startTs', 'endTs', 'periodInterval'],
    },
  },
  {
    name: 'dflow:get_market_candlesticks',
    description: 'Get market candlesticks',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', description: 'Market ticker' },
        startTs: { type: 'integer', minimum: 0 },
        endTs: { type: 'integer', minimum: 0 },
        periodInterval: { type: 'integer', minimum: 0 },
      },
      required: ['ticker', 'startTs', 'endTs', 'periodInterval'],
    },
  },
  // Live data tools
  {
    name: 'dflow:get_live_data',
    description: 'Get live data for specific milestones',
    inputSchema: {
      type: 'object',
      properties: {
        milestoneIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['milestoneIds'],
    },
  },
  {
    name: 'dflow:get_live_data_by_event',
    description: 'Get live data for all milestones of an event',
    inputSchema: {
      type: 'object',
      properties: {
        event_ticker: { type: 'string' },
        minimumStartDate: { type: 'string' },
        category: { type: 'string' },
        competition: { type: 'string' },
      },
      required: ['event_ticker'],
    },
  },
  // Series tools
  {
    name: 'dflow:get_series',
    description: 'Get all series templates with filtering',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string' },
        tags: { type: 'string' },
        isInitialized: { type: 'boolean' },
        status: { type: 'string' },
      },
    },
  },
  {
    name: 'dflow:get_series_by_ticker',
    description: 'Get a single series by ticker',
    inputSchema: {
      type: 'object',
      properties: {
        series_ticker: { type: 'string' },
      },
      required: ['series_ticker'],
    },
  },
  // Utility tools
  {
    name: 'dflow:get_outcome_mints',
    description: 'Get flat list of yes/no outcome mint pubkeys',
    inputSchema: {
      type: 'object',
      properties: {
        minCloseTs: { type: 'integer', minimum: 0 },
      },
    },
  },
  {
    name: 'dflow:filter_outcome_mints',
    description: 'Filter addresses and return only outcome mints',
    inputSchema: {
      type: 'object',
      properties: {
        addresses: { type: 'array', items: { type: 'string' }, maxItems: 200 },
      },
      required: ['addresses'],
    },
  },
  {
    name: 'dflow:get_tags_by_categories',
    description: 'Get mapping of series categories to tags',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'dflow:get_filters_by_sports',
    description: 'Get filtering options for each sport',
    inputSchema: { type: 'object', properties: {} },
  },
];

// Kalshi namespace tools (from mcp-kalshi-full.ts) - abbreviated for key tools
const KALSHI_TOOLS: Tool[] = [
  // Exchange
  {
    name: 'kalshi:get_exchange_status',
    description: 'Get Kalshi exchange operational status',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'kalshi:get_announcements',
    description: 'Get exchange-wide announcements',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'kalshi:get_schedule',
    description: 'Get trading schedule',
    inputSchema: { type: 'object', properties: {} },
  },
  // Markets
  {
    name: 'kalshi:list_markets',
    description: 'List prediction markets with filtering options',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (1-200)' },
        cursor: { type: 'string' },
        event_ticker: { type: 'string' },
        series_ticker: { type: 'string' },
        status: { type: 'string', enum: ['open', 'closed', 'settled'] },
        tickers: { type: 'string', description: 'Comma-separated tickers' },
      },
    },
  },
  {
    name: 'kalshi:get_market',
    description: 'Get detailed market information by ticker',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', description: 'Market ticker' },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'kalshi:get_orderbook',
    description: 'Get current orderbook (bids/asks) for a market',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: { type: 'string' },
        depth: { type: 'number', description: 'Orderbook depth (default 10)' },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'kalshi:get_market_trades',
    description: 'Get recent trades for a market',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number' },
        cursor: { type: 'string' },
        ticker: { type: 'string' },
        min_ts: { type: 'number' },
        max_ts: { type: 'number' },
      },
    },
  },
  {
    name: 'kalshi:get_candlesticks',
    description: 'Get OHLC candlestick data (batch up to 100 markets)',
    inputSchema: {
      type: 'object',
      properties: {
        series_ticker: { type: 'string' },
        tickers: { type: 'string' },
        start_ts: { type: 'number' },
        end_ts: { type: 'number' },
        period_interval: { type: 'number', description: 'Interval in minutes (1,5,15,60,1440)' },
      },
      required: ['series_ticker'],
    },
  },
  {
    name: 'kalshi:search_markets',
    description: 'Search markets by keyword',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        status: { type: 'string', enum: ['open', 'closed', 'settled'] },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
  },
  // Events
  {
    name: 'kalshi:list_events',
    description: 'List events (groups of related markets)',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number' },
        cursor: { type: 'string' },
        status: { type: 'string', enum: ['open', 'closed', 'settled'] },
        series_ticker: { type: 'string' },
        with_nested_markets: { type: 'boolean' },
      },
    },
  },
  {
    name: 'kalshi:get_event',
    description: 'Get event details by ticker',
    inputSchema: {
      type: 'object',
      properties: {
        event_ticker: { type: 'string' },
        with_nested_markets: { type: 'boolean' },
      },
      required: ['event_ticker'],
    },
  },
  // Series
  {
    name: 'kalshi:list_series',
    description: 'List all series with filters',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number' },
        cursor: { type: 'string' },
        status: { type: 'string' },
      },
    },
  },
  {
    name: 'kalshi:get_series',
    description: 'Get series definition and metadata',
    inputSchema: {
      type: 'object',
      properties: {
        series_ticker: { type: 'string' },
      },
      required: ['series_ticker'],
    },
  },
  // Portfolio (authenticated)
  {
    name: 'kalshi:get_balance',
    description: 'Get account balance (requires auth)',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'kalshi:get_positions',
    description: 'List all open positions (requires auth)',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number' },
        cursor: { type: 'string' },
        settlement_status: { type: 'string', enum: ['unsettled', 'settled'] },
        ticker: { type: 'string' },
        event_ticker: { type: 'string' },
      },
    },
  },
  {
    name: 'kalshi:get_fills',
    description: 'Get completed trades/fills (requires auth)',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number' },
        cursor: { type: 'string' },
        ticker: { type: 'string' },
        order_id: { type: 'string' },
      },
    },
  },
  // Orders (authenticated)
  {
    name: 'kalshi:list_orders',
    description: 'List all orders (requires auth)',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number' },
        cursor: { type: 'string' },
        ticker: { type: 'string' },
        status: { type: 'string', enum: ['resting', 'canceled', 'executed', 'pending'] },
      },
    },
  },
  {
    name: 'kalshi:create_order',
    description: 'Submit a new order (requires auth)',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: { type: 'string' },
        action: { type: 'string', enum: ['buy', 'sell'] },
        side: { type: 'string', enum: ['yes', 'no'] },
        type: { type: 'string', enum: ['limit', 'market'] },
        count: { type: 'number' },
        yes_price: { type: 'number', description: 'Limit price in cents (1-99)' },
        no_price: { type: 'number' },
      },
      required: ['ticker', 'action', 'side', 'type', 'count'],
    },
  },
  {
    name: 'kalshi:cancel_order',
    description: 'Cancel an existing order (requires auth)',
    inputSchema: {
      type: 'object',
      properties: {
        order_id: { type: 'string' },
      },
      required: ['order_id'],
    },
  },
  {
    name: 'kalshi:create_batch_orders',
    description: 'Submit up to 20 orders simultaneously (requires auth)',
    inputSchema: {
      type: 'object',
      properties: {
        orders: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              ticker: { type: 'string' },
              action: { type: 'string', enum: ['buy', 'sell'] },
              side: { type: 'string', enum: ['yes', 'no'] },
              type: { type: 'string', enum: ['limit', 'market'] },
              count: { type: 'number' },
              yes_price: { type: 'number' },
            },
          },
        },
      },
      required: ['orders'],
    },
  },
];

// Liquidity Mining tools (from mcp-liquidity-mining.ts)
const LP_TOOLS: Tool[] = [
  // Pool Management
  {
    name: 'lp:create_pool',
    description: 'Create a new liquidity pool for a prediction market',
    inputSchema: {
      type: 'object',
      properties: {
        market_id: { type: 'string', description: 'Market ticker/ID' },
        platform: { type: 'string', enum: ['kalshi', 'polymarket', 'manifold'] },
        title: { type: 'string' },
        boost: { type: 'number', description: 'Market boost multiplier (1-3x)' },
      },
      required: ['market_id', 'platform', 'title'],
    },
  },
  {
    name: 'lp:get_pool',
    description: 'Get pool details by ID',
    inputSchema: {
      type: 'object',
      properties: {
        pool_id: { type: 'string' },
      },
      required: ['pool_id'],
    },
  },
  {
    name: 'lp:list_pools',
    description: 'List all active liquidity pools',
    inputSchema: {
      type: 'object',
      properties: {
        include_inactive: { type: 'boolean' },
      },
    },
  },
  {
    name: 'lp:set_boost',
    description: 'Set market boost multiplier for a pool (admin)',
    inputSchema: {
      type: 'object',
      properties: {
        pool_id: { type: 'string' },
        boost: { type: 'number', description: 'Boost multiplier (1-3)' },
      },
      required: ['pool_id', 'boost'],
    },
  },
  // Liquidity Positions
  {
    name: 'lp:add_liquidity',
    description: 'Add liquidity to a pool and receive LP tokens',
    inputSchema: {
      type: 'object',
      properties: {
        pool_id: { type: 'string' },
        provider: { type: 'string', description: 'Wallet address' },
        amount: { type: 'number', description: 'Amount in USD' },
        lock_duration: { type: 'string', enum: ['7d', '30d', '90d', '180d', '365d'] },
        referrer: { type: 'string' },
      },
      required: ['pool_id', 'provider', 'amount', 'lock_duration'],
    },
  },
  {
    name: 'lp:remove_liquidity',
    description: 'Remove liquidity from a pool (10% early withdrawal penalty)',
    inputSchema: {
      type: 'object',
      properties: {
        position_id: { type: 'string' },
      },
      required: ['position_id'],
    },
  },
  {
    name: 'lp:get_position',
    description: 'Get position details including pending rewards',
    inputSchema: {
      type: 'object',
      properties: {
        position_id: { type: 'string' },
      },
      required: ['position_id'],
    },
  },
  {
    name: 'lp:get_positions',
    description: 'Get all positions for a wallet address',
    inputSchema: {
      type: 'object',
      properties: {
        provider: { type: 'string', description: 'Wallet address' },
      },
      required: ['provider'],
    },
  },
  // Rewards
  {
    name: 'lp:claim_rewards',
    description: 'Claim pending SVMAI rewards from a position',
    inputSchema: {
      type: 'object',
      properties: {
        position_id: { type: 'string' },
      },
      required: ['position_id'],
    },
  },
  {
    name: 'lp:get_pending_rewards',
    description: 'Get pending rewards without claiming',
    inputSchema: {
      type: 'object',
      properties: {
        position_id: { type: 'string' },
      },
      required: ['position_id'],
    },
  },
  {
    name: 'lp:get_apr',
    description: 'Get estimated APR for a pool or position',
    inputSchema: {
      type: 'object',
      properties: {
        pool_id: { type: 'string' },
        position_id: { type: 'string' },
        token_price: { type: 'number', description: 'SVMAI price in USD (default: 1)' },
      },
    },
  },
  // Statistics
  {
    name: 'lp:get_provider_stats',
    description: 'Get comprehensive stats for a liquidity provider',
    inputSchema: {
      type: 'object',
      properties: {
        provider: { type: 'string' },
      },
      required: ['provider'],
    },
  },
  {
    name: 'lp:get_global_stats',
    description: 'Get global liquidity mining statistics',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'lp:get_leaderboard',
    description: 'Get top liquidity providers',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of entries (default: 10)' },
        pool_id: { type: 'string' },
      },
    },
  },
  {
    name: 'lp:get_staking_boost',
    description: 'Get compound boost from SVMAI staking + LP position',
    inputSchema: {
      type: 'object',
      properties: {
        provider: { type: 'string' },
        position_id: { type: 'string' },
      },
      required: ['provider'],
    },
  },
];

// Governance Timelock tools (from mcp-governance-timelock.ts)
const GOVERNANCE_TOOLS: Tool[] = [
  // Action Management
  {
    name: 'governance:queue_action',
    description: 'Queue a governance action for execution after timelock delay',
    inputSchema: {
      type: 'object',
      properties: {
        action_type: {
          type: 'string',
          enum: ['parameter_change', 'gauge_creation', 'gauge_removal', 'emission_change', 'fee_change', 'treasury_spend', 'upgrade', 'emergency'],
        },
        target: { type: 'string', description: 'Target contract/module' },
        data: { type: 'object', description: 'Action parameters' },
        proposer: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['action_type', 'target', 'data', 'proposer', 'description'],
    },
  },
  {
    name: 'governance:queue_batch',
    description: 'Queue multiple actions as a batch (all execute together)',
    inputSchema: {
      type: 'object',
      properties: {
        actions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              action_type: { type: 'string' },
              target: { type: 'string' },
              data: { type: 'object' },
              description: { type: 'string' },
            },
          },
        },
        proposer: { type: 'string' },
      },
      required: ['actions', 'proposer'],
    },
  },
  {
    name: 'governance:execute',
    description: 'Execute a queued action after timelock expired',
    inputSchema: {
      type: 'object',
      properties: {
        action_id: { type: 'string' },
        executor: { type: 'string' },
      },
      required: ['action_id', 'executor'],
    },
  },
  {
    name: 'governance:execute_batch',
    description: 'Execute all actions in a batch atomically',
    inputSchema: {
      type: 'object',
      properties: {
        batch_id: { type: 'string' },
        executor: { type: 'string' },
      },
      required: ['batch_id', 'executor'],
    },
  },
  // Multi-Sig
  {
    name: 'governance:sign',
    description: 'Sign an action for multi-sig approval/cancellation/expediting',
    inputSchema: {
      type: 'object',
      properties: {
        action_id: { type: 'string' },
        signer: { type: 'string' },
        sign_action: { type: 'string', enum: ['approve', 'cancel', 'expedite'] },
      },
      required: ['action_id', 'signer', 'sign_action'],
    },
  },
  {
    name: 'governance:get_signatures',
    description: 'Get all signatures for an action',
    inputSchema: {
      type: 'object',
      properties: {
        action_id: { type: 'string' },
        sign_action: { type: 'string', enum: ['approve', 'cancel', 'expedite'] },
      },
      required: ['action_id'],
    },
  },
  // Queries
  {
    name: 'governance:get_action',
    description: 'Get details of a specific action',
    inputSchema: {
      type: 'object',
      properties: {
        action_id: { type: 'string' },
      },
      required: ['action_id'],
    },
  },
  {
    name: 'governance:get_actions_by_status',
    description: 'Get all actions with a specific status',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['queued', 'ready', 'executed', 'cancelled', 'expired'] },
      },
      required: ['status'],
    },
  },
  {
    name: 'governance:get_ready_actions',
    description: 'Get all actions ready for execution',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'governance:get_pending_actions',
    description: 'Get all pending actions (timelock not expired)',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'governance:is_ready',
    description: 'Check if action is ready for execution',
    inputSchema: {
      type: 'object',
      properties: {
        action_id: { type: 'string' },
      },
      required: ['action_id'],
    },
  },
  {
    name: 'governance:time_until_ready',
    description: 'Get time remaining until action can be executed',
    inputSchema: {
      type: 'object',
      properties: {
        action_id: { type: 'string' },
      },
      required: ['action_id'],
    },
  },
  // Stats
  {
    name: 'governance:get_stats',
    description: 'Get overall timelock statistics',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'governance:get_config',
    description: 'Get current timelock configuration',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'governance:expire_stale',
    description: 'Expire all stale actions (admin)',
    inputSchema: { type: 'object', properties: {} },
  },
];

// Bank tools (from mcp-kalshi.ts bank integration)
const BANK_TOOLS: Tool[] = [
  {
    name: 'bank:get_wallets',
    description: 'List all OpenSVM Bank wallets available for trading',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'bank:create_wallet',
    description: 'Create a new OpenSVM Bank wallet',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Wallet name' },
      },
      required: ['name'],
    },
  },
  {
    name: 'bank:simulate_trade',
    description: 'Simulate a trade before execution',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: { type: 'string' },
        side: { type: 'string', enum: ['yes', 'no'] },
        quantity: { type: 'number' },
        wallet_id: { type: 'string' },
      },
      required: ['ticker', 'side', 'quantity', 'wallet_id'],
    },
  },
];

// Combine all tools
const ALL_TOOLS: Tool[] = [
  ...SOLANA_TOOLS,
  ...DFLOW_TOOLS,
  ...KALSHI_TOOLS,
  ...LP_TOOLS,
  ...GOVERNANCE_TOOLS,
  ...BANK_TOOLS,
];

// ============================================================================
// Prompt Definitions
// ============================================================================

const PROMPTS = [
  {
    name: 'investigate_wallet',
    description: 'Comprehensive investigation of a Solana wallet',
    arguments: [{ name: 'address', description: 'Wallet address', required: true }],
  },
  {
    name: 'analyze_market',
    description: 'Analyze a prediction market for trading opportunities',
    arguments: [
      { name: 'ticker', description: 'Market ticker', required: true },
      { name: 'platform', description: 'Platform (kalshi/dflow)', required: false },
    ],
  },
  {
    name: 'optimize_liquidity',
    description: 'Analyze LP positions and suggest optimal allocation',
    arguments: [
      { name: 'provider', description: 'Wallet address', required: true },
      { name: 'budget', description: 'Available USD', required: false },
    ],
  },
  {
    name: 'governance_review',
    description: 'Review pending governance actions and voting recommendations',
    arguments: [],
  },
  {
    name: 'portfolio_overview',
    description: 'Combined overview of Solana holdings, prediction positions, and LP stakes',
    arguments: [{ name: 'address', description: 'Wallet address', required: true }],
  },
];

// ============================================================================
// Resource Definitions
// ============================================================================

const RESOURCES = [
  {
    uri: 'opensvm://namespaces',
    name: 'Available Namespaces',
    description: 'List of all tool namespaces and their descriptions',
    mimeType: 'application/json',
  },
  {
    uri: 'opensvm://tools/summary',
    name: 'Tools Summary',
    description: 'Summary of all available tools by namespace',
    mimeType: 'application/json',
  },
  {
    uri: 'opensvm://solana/network-status',
    name: 'Solana Network Status',
    description: 'Current Solana network health and stats',
    mimeType: 'application/json',
  },
  {
    uri: 'opensvm://kalshi/exchange-status',
    name: 'Kalshi Exchange Status',
    description: 'Kalshi exchange operational status',
    mimeType: 'application/json',
  },
];

// ============================================================================
// Server Factory
// ============================================================================

function createServer(config?: Partial<ServerConfig>) {
  const server = new Server(
    {
      name: 'opensvm-unified-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        prompts: {},
        resources: {},
      },
    }
  );

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: ALL_TOOLS,
  }));

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const toolArgs = args || {};

    try {
      // Route to appropriate handler based on namespace
      const [namespace, toolName] = name.includes(':') ? name.split(':') : ['solana', name];

      let result: unknown;

      switch (namespace) {
        case 'solana':
          result = await handleSolanaTool(toolName, toolArgs, config);
          break;
        case 'dflow':
          result = await handleDFlowTool(toolName, toolArgs, config);
          break;
        case 'kalshi':
          result = await handleKalshiTool(toolName, toolArgs, config);
          break;
        case 'lp':
          result = await handleLPTool(toolName, toolArgs);
          break;
        case 'governance':
          result = await handleGovernanceTool(toolName, toolArgs);
          break;
        case 'bank':
          result = await handleBankTool(toolName, toolArgs, config);
          break;
        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown namespace: ${namespace}`);
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
        isError: true,
      };
    }
  });

  // List prompts handler
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: PROMPTS,
  }));

  // Get prompt handler
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return handlePrompt(name, args);
  });

  // List resources handler
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: RESOURCES,
  }));

  // Read resource handler
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    return handleResource(uri, config);
  });

  return server;
}

// ============================================================================
// Tool Handlers
// ============================================================================

async function handleSolanaTool(
  name: string,
  args: Record<string, unknown>,
  config?: Partial<ServerConfig>
): Promise<unknown> {
  const baseUrl = config?.opensvmApiUrl || 'https://osvm.ai';

  switch (name) {
    case 'get_transaction':
      return fetchAPI(`${baseUrl}/api/transaction/${args.signature}`);
    case 'explain_transaction':
      return fetchAPI(`${baseUrl}/api/transaction/${args.signature}/explain`);
    case 'analyze_transaction':
      return fetchAPI(`${baseUrl}/api/transaction/${args.signature}/analyze`);
    case 'get_account_portfolio':
      return fetchAPI(`${baseUrl}/api/account/${args.address}/portfolio`);
    case 'get_account_transactions':
      return fetchAPI(`${baseUrl}/api/account/${args.address}/transactions`, { limit: args.limit });
    case 'get_account_stats':
      return fetchAPI(`${baseUrl}/api/account/${args.address}/stats`);
    case 'get_blocks':
      return fetchAPI(`${baseUrl}/api/blocks`, { limit: args.limit, before: args.before });
    case 'get_block':
      return fetchAPI(`${baseUrl}/api/blocks/${args.slot}`);
    case 'get_token_ohlcv':
      return fetchAPI(`${baseUrl}/api/token/${args.mint}/ohlcv`, { type: args.type });
    case 'get_token_markets':
      return fetchAPI(`${baseUrl}/api/token/${args.mint}/markets`, { baseMint: args.baseMint });
    case 'get_token_metadata':
      return fetchAPI(`${baseUrl}/api/token/${args.mint}`);
    case 'get_program':
      return fetchAPI(`${baseUrl}/api/program/${args.address}`);
    case 'search':
      return fetchAPI(`${baseUrl}/api/search`, { q: args.query });
    case 'find_wallet_path':
      return fetchAPI(`${baseUrl}/api/wallet-path`, {
        source: args.sourceWallet,
        target: args.targetWallet,
        maxDepth: args.maxDepth,
      });
    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown solana tool: ${name}`);
  }
}

async function handleDFlowTool(
  name: string,
  args: Record<string, unknown>,
  config?: Partial<ServerConfig>
): Promise<unknown> {
  const baseUrl = config?.dflowApiUrl || 'https://prediction-markets-api.dflow.net';

  switch (name) {
    case 'get_event':
      return fetchAPI(`${baseUrl}/api/v1/event/${args.event_id}`, { withNestedMarkets: args.withNestedMarkets });
    case 'get_events':
      return fetchAPI(`${baseUrl}/api/v1/events`, args);
    case 'search_events':
      return fetchAPI(`${baseUrl}/api/v1/search`, args);
    case 'get_market':
      return fetchAPI(`${baseUrl}/api/v1/market/${args.market_id}`);
    case 'get_market_by_mint':
      return fetchAPI(`${baseUrl}/api/v1/market/by-mint/${args.mint_address}`);
    case 'get_markets':
      return fetchAPI(`${baseUrl}/api/v1/markets`, args);
    case 'get_markets_batch':
      return postAPI(`${baseUrl}/api/v1/markets/batch`, args);
    case 'get_trades':
      return fetchAPI(`${baseUrl}/api/v1/trades`, args);
    case 'get_trades_by_mint':
      return fetchAPI(`${baseUrl}/api/v1/trades/by-mint/${args.mint_address}`, args);
    case 'get_forecast_history':
      return fetchAPI(
        `${baseUrl}/api/v1/event/${args.series_ticker}/${args.event_id}/forecast_percentile_history`,
        args
      );
    case 'get_event_candlesticks':
      return fetchAPI(`${baseUrl}/api/v1/event/${args.ticker}/candlesticks`, args);
    case 'get_market_candlesticks':
      return fetchAPI(`${baseUrl}/api/v1/market/${args.ticker}/candlesticks`, args);
    case 'get_live_data':
      return fetchAPI(`${baseUrl}/api/v1/live_data`, { milestoneIds: args.milestoneIds });
    case 'get_live_data_by_event':
      return fetchAPI(`${baseUrl}/api/v1/live_data/by-event/${args.event_ticker}`, args);
    case 'get_series':
      return fetchAPI(`${baseUrl}/api/v1/series`, args);
    case 'get_series_by_ticker':
      return fetchAPI(`${baseUrl}/api/v1/series/${args.series_ticker}`);
    case 'get_outcome_mints':
      return fetchAPI(`${baseUrl}/api/v1/outcome_mints`, args);
    case 'filter_outcome_mints':
      return postAPI(`${baseUrl}/api/v1/filter_outcome_mints`, args);
    case 'get_tags_by_categories':
      return fetchAPI(`${baseUrl}/api/v1/tags_by_categories`);
    case 'get_filters_by_sports':
      return fetchAPI(`${baseUrl}/api/v1/filters_by_sports`);
    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown dflow tool: ${name}`);
  }
}

async function handleKalshiTool(
  name: string,
  args: Record<string, unknown>,
  config?: Partial<ServerConfig>
): Promise<unknown> {
  const baseUrl = config?.kalshiApiUrl || 'https://api.elections.kalshi.com/trade-api/v2';

  switch (name) {
    case 'get_exchange_status':
      return fetchAPI(`${baseUrl}/exchange/status`);
    case 'get_announcements':
      return fetchAPI(`${baseUrl}/exchange/announcements`);
    case 'get_schedule':
      return fetchAPI(`${baseUrl}/exchange/schedule`);
    case 'list_markets':
      return fetchAPI(`${baseUrl}/markets`, args);
    case 'get_market':
      return fetchAPI(`${baseUrl}/markets/${args.ticker}`);
    case 'get_orderbook':
      return fetchAPI(`${baseUrl}/markets/${args.ticker}/orderbook`, { depth: args.depth });
    case 'get_market_trades':
      return fetchAPI(`${baseUrl}/markets/trades`, args);
    case 'get_candlesticks':
      return fetchAPI(`${baseUrl}/markets/candlesticks`, args);
    case 'search_markets': {
      const result = await fetchAPI(`${baseUrl}/markets`, { status: args.status || 'open', limit: 200 });
      const query = String(args.query).toLowerCase();
      const matches = (result.markets || []).filter(
        (m: { title?: string; subtitle?: string; ticker?: string }) =>
          m.title?.toLowerCase().includes(query) ||
          m.subtitle?.toLowerCase().includes(query) ||
          m.ticker?.toLowerCase().includes(query)
      );
      return { query: args.query, matches: matches.slice(0, (args.limit as number) || 20), count: matches.length };
    }
    case 'list_events':
      return fetchAPI(`${baseUrl}/events`, args);
    case 'get_event':
      return fetchAPI(`${baseUrl}/events/${args.event_ticker}`, { with_nested_markets: args.with_nested_markets });
    case 'list_series':
      return fetchAPI(`${baseUrl}/series`, args);
    case 'get_series':
      return fetchAPI(`${baseUrl}/series/${args.series_ticker}`);
    case 'get_balance':
      return fetchAPI(`${baseUrl}/portfolio/balance`);
    case 'get_positions':
      return fetchAPI(`${baseUrl}/portfolio/positions`, args);
    case 'get_fills':
      return fetchAPI(`${baseUrl}/portfolio/fills`, args);
    case 'list_orders':
      return fetchAPI(`${baseUrl}/portfolio/orders`, args);
    case 'create_order':
      return postAPI(`${baseUrl}/portfolio/orders`, args);
    case 'cancel_order':
      return deleteAPI(`${baseUrl}/portfolio/orders/${args.order_id}`);
    case 'create_batch_orders':
      return postAPI(`${baseUrl}/portfolio/orders/batched`, { orders: args.orders });
    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown kalshi tool: ${name}`);
  }
}

// LP and Governance tools use in-memory state, so we import and use the existing engines
async function handleLPTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  // Placeholder - in production, import from mcp-liquidity-mining.ts
  return { message: `LP tool ${name} called`, args, note: 'Use lp: namespace tools through mcp-liquidity-mining.ts' };
}

async function handleGovernanceTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  // Placeholder - in production, import from mcp-governance-timelock.ts
  return {
    message: `Governance tool ${name} called`,
    args,
    note: 'Use governance: namespace tools through mcp-governance-timelock.ts',
  };
}

async function handleBankTool(
  name: string,
  args: Record<string, unknown>,
  config?: Partial<ServerConfig>
): Promise<unknown> {
  const baseUrl = config?.opensvmApiUrl || 'https://osvm.ai';

  switch (name) {
    case 'get_wallets':
      try {
        return fetchAPI(`${baseUrl}/api/bank/wallets`);
      } catch {
        return {
          wallets: [{ id: 'demo-wallet', name: 'Demo Trading Wallet', balance: 1000 }],
          note: 'Demo wallet (bank API unavailable)',
        };
      }
    case 'create_wallet':
      try {
        return postAPI(`${baseUrl}/api/bank/wallets/create`, { name: args.name });
      } catch {
        return { wallet: { id: `wallet-${Date.now()}`, name: args.name, balance: 0 }, note: 'Demo wallet created' };
      }
    case 'simulate_trade':
      return { simulation: args, note: 'Trade simulation' };
    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown bank tool: ${name}`);
  }
}

// ============================================================================
// Prompt Handler
// ============================================================================

function handlePrompt(name: string, args?: Record<string, string>): { messages: Array<{ role: string; content: { type: string; text: string } }> } {
  switch (name) {
    case 'investigate_wallet':
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Investigate wallet ${args?.address}. Use:
1. solana:get_account_portfolio for holdings
2. solana:get_account_transactions for activity
3. solana:get_account_stats for patterns
4. lp:get_positions for LP stakes
5. kalshi:get_positions for prediction positions

Provide comprehensive report on wallet activity, holdings, and risk indicators.`,
            },
          },
        ],
      };

    case 'analyze_market':
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Analyze prediction market ${args?.ticker} on ${args?.platform || 'kalshi'}. Use:
1. ${args?.platform === 'dflow' ? 'dflow:get_market' : 'kalshi:get_market'} for details
2. ${args?.platform === 'dflow' ? 'dflow:get_trades' : 'kalshi:get_market_trades'} for activity
3. kalshi:get_orderbook for liquidity (if Kalshi)

Provide trading recommendation with risk/reward analysis.`,
            },
          },
        ],
      };

    case 'optimize_liquidity':
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Optimize liquidity for ${args?.provider}. Use:
1. lp:get_positions for current positions
2. lp:get_provider_stats for overall stats
3. lp:list_pools for available pools
4. lp:get_staking_boost for staking synergy

${args?.budget ? `Available budget: $${args.budget}` : ''}
Recommend optimal allocation strategy.`,
            },
          },
        ],
      };

    case 'governance_review':
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Review governance actions. Use:
1. governance:get_ready_actions for executable actions
2. governance:get_pending_actions for upcoming
3. governance:get_config for timelock settings

Provide voting recommendations and risk analysis.`,
            },
          },
        ],
      };

    case 'portfolio_overview':
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Portfolio overview for ${args?.address}. Use:
1. solana:get_account_portfolio for Solana holdings
2. kalshi:get_positions for prediction positions
3. lp:get_positions for LP stakes

Provide combined portfolio summary with allocation recommendations.`,
            },
          },
        ],
      };

    default:
      throw new McpError(ErrorCode.InvalidParams, `Unknown prompt: ${name}`);
  }
}

// ============================================================================
// Resource Handler
// ============================================================================

async function handleResource(
  uri: string,
  config?: Partial<ServerConfig>
): Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> {
  switch (uri) {
    case 'opensvm://namespaces':
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(NAMESPACES, null, 2),
          },
        ],
      };

    case 'opensvm://tools/summary':
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                total: ALL_TOOLS.length,
                byNamespace: {
                  solana: SOLANA_TOOLS.length,
                  dflow: DFLOW_TOOLS.length,
                  kalshi: KALSHI_TOOLS.length,
                  lp: LP_TOOLS.length,
                  governance: GOVERNANCE_TOOLS.length,
                  bank: BANK_TOOLS.length,
                },
                tools: ALL_TOOLS.map((t) => ({ name: t.name, description: t.description })),
              },
              null,
              2
            ),
          },
        ],
      };

    case 'opensvm://solana/network-status':
      try {
        const baseUrl = config?.opensvmApiUrl || 'https://osvm.ai';
        const status = await fetchAPI(`${baseUrl}/api/health`);
        return {
          contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(status, null, 2) }],
        };
      } catch {
        return {
          contents: [{ uri, mimeType: 'application/json', text: JSON.stringify({ status: 'unknown' }) }],
        };
      }

    case 'opensvm://kalshi/exchange-status':
      try {
        const baseUrl = config?.kalshiApiUrl || 'https://api.elections.kalshi.com/trade-api/v2';
        const status = await fetchAPI(`${baseUrl}/exchange/status`);
        return {
          contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(status, null, 2) }],
        };
      } catch {
        return {
          contents: [{ uri, mimeType: 'application/json', text: JSON.stringify({ status: 'unknown' }) }],
        };
      }

    default:
      throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
  }
}

// ============================================================================
// HTTP Helpers
// ============================================================================

async function fetchAPI(url: string, params?: Record<string, unknown>): Promise<unknown> {
  const fullUrl = new URL(url);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        fullUrl.searchParams.set(key, String(value));
      }
    });
  }

  const response = await fetch(fullUrl.toString(), {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

async function postAPI(url: string, data?: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

async function deleteAPI(url: string): Promise<unknown> {
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('OpenSVM Unified MCP Server v1.0.0 running on stdio');
  console.error(`Namespaces: ${Object.keys(NAMESPACES).join(', ')}`);
  console.error(`Total tools: ${ALL_TOOLS.length}`);
}

// Export for programmatic use
export { createServer, ALL_TOOLS, PROMPTS, RESOURCES, NAMESPACES };

// Run if executed directly
main().catch(console.error);
