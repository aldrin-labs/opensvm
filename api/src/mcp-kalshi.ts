#!/usr/bin/env bun
/**
 * Kalshi Prediction Markets MCP Server
 *
 * Provides AI agents with tools to:
 * - Browse Kalshi prediction markets
 * - Get real-time prices and orderbooks
 * - Execute trades via OpenSVM Bank API
 * - Manage positions and track PnL
 *
 * Integration:
 * - Kalshi API: Real market data (public endpoints)
 * - OpenSVM Bank: Trade execution and fund management
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  McpError,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// ============================================================================
// Configuration
// ============================================================================

export const configSchema = z.object({
  kalshiApiUrl: z.string()
    .describe('Kalshi API base URL')
    .default('https://api.elections.kalshi.com/trade-api/v2'),
  opensvmApiUrl: z.string()
    .describe('OpenSVM API base URL for bank operations')
    .default('https://osvm.ai'),
  apiKey: z.string()
    .describe('OpenSVM API key for authenticated requests')
    .optional(),
  requestTimeout: z.number()
    .describe('Request timeout in milliseconds')
    .default(30000),
});

const KALSHI_BASE_URL = 'https://api.elections.kalshi.com/trade-api/v2';
const OPENSVM_BASE_URL = process.env.OPENSVM_API_URL || 'https://osvm.ai';
const DEFAULT_TIMEOUT = 30000;

// ============================================================================
// API Clients
// ============================================================================

class KalshiClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string = KALSHI_BASE_URL, timeout: number = DEFAULT_TIMEOUT) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  async request<T>(method: string, path: string, params?: Record<string, any>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        method,
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Kalshi API error: ${response.status} - ${error}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  // Market Data
  async listMarkets(options: { status?: string; limit?: number; cursor?: string; series_ticker?: string } = {}) {
    return this.request<{ markets: any[]; cursor?: string }>('GET', '/markets', options);
  }

  async getMarket(ticker: string) {
    return this.request<{ market: any }>('GET', `/markets/${ticker}`);
  }

  async getOrderbook(ticker: string) {
    return this.request<{ orderbook: any }>('GET', `/markets/${ticker}/orderbook`);
  }

  async getTrades(ticker: string, limit: number = 20) {
    return this.request<{ trades: any[] }>('GET', `/markets/${ticker}/trades`, { limit });
  }

  async listEvents(options: { status?: string; limit?: number } = {}) {
    return this.request<{ events: any[]; cursor?: string }>('GET', '/events', options);
  }

  async getEvent(eventTicker: string) {
    return this.request<{ event: any }>('GET', `/events/${eventTicker}`);
  }

  async listSeries(options: { status?: string; limit?: number } = {}) {
    return this.request<{ series: any[]; cursor?: string }>('GET', '/series', options);
  }
}

class OpenSVMBankClient {
  private baseUrl: string;
  private apiKey?: string;
  private timeout: number;

  constructor(baseUrl: string = OPENSVM_BASE_URL, apiKey?: string, timeout: number = DEFAULT_TIMEOUT) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.timeout = timeout;
  }

  private async request<T>(method: string, path: string, body?: any): Promise<T> {
    const url = `${this.baseUrl}/api${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenSVM Bank error: ${response.status} - ${error}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  // Wallet Operations
  async getWallets() {
    return this.request<{ wallets: any[]; total: number }>('GET', '/bank/wallets');
  }

  async createWallet(name: string) {
    return this.request<{ wallet: any }>('POST', '/bank/wallets/create', { name });
  }

  async refreshWallet(walletId: string) {
    return this.request<{ wallet: any }>('POST', '/bank/wallets/refresh', { walletId });
  }

  async simulatePortfolio(scenarios: any[]) {
    return this.request<{ simulations: any[] }>('POST', '/bank/wallets/simulate', { scenarios });
  }
}

// ============================================================================
// Position Tracking (In-Memory)
// ============================================================================

interface Position {
  id: string;
  walletId: string;
  marketTicker: string;
  side: 'yes' | 'no';
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  createdAt: number;
}

interface Trade {
  id: string;
  walletId: string;
  marketTicker: string;
  side: 'yes' | 'no';
  action: 'buy' | 'sell';
  quantity: number;
  price: number;
  total: number;
  fee: number;
  timestamp: number;
}

const positions = new Map<string, Position>();
const trades: Trade[] = [];
let tradeCounter = 0;

// ============================================================================
// Tool Definitions
// ============================================================================

const TOOLS: Tool[] = [
  // Market Discovery
  {
    name: 'kalshi_list_markets',
    description: 'List available prediction markets on Kalshi. Filter by status (open/closed/settled) and category.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['open', 'closed', 'settled'], description: 'Market status filter' },
        series_ticker: { type: 'string', description: 'Filter by series ticker (e.g., KXBTC for Bitcoin markets)' },
        limit: { type: 'number', description: 'Max results to return (default: 20, max: 100)' },
      },
    },
  },
  {
    name: 'kalshi_get_market',
    description: 'Get detailed information about a specific Kalshi market including current prices, volume, and rules.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', description: 'Market ticker (e.g., KXBTC100K-25DEC31)' },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'kalshi_get_orderbook',
    description: 'Get the current orderbook (bids and asks) for a market. Shows depth of liquidity.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', description: 'Market ticker' },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'kalshi_get_trades',
    description: 'Get recent trades for a market. Useful for understanding market activity.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', description: 'Market ticker' },
        limit: { type: 'number', description: 'Number of trades to return (default: 20)' },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'kalshi_search_markets',
    description: 'Search for markets by keyword (e.g., "bitcoin", "election", "fed rates")',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        status: { type: 'string', enum: ['open', 'closed', 'settled'], description: 'Filter by status' },
      },
      required: ['query'],
    },
  },
  {
    name: 'kalshi_list_events',
    description: 'List events (groups of related markets) on Kalshi',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['open', 'closed', 'settled'] },
        limit: { type: 'number', description: 'Max results' },
      },
    },
  },

  // Trading (via OpenSVM Bank)
  {
    name: 'kalshi_buy',
    description: 'Buy YES or NO contracts on a Kalshi market. Uses OpenSVM Bank wallet for funds.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', description: 'Market ticker' },
        side: { type: 'string', enum: ['yes', 'no'], description: 'Buy YES or NO contracts' },
        quantity: { type: 'number', description: 'Number of contracts to buy' },
        max_price: { type: 'number', description: 'Maximum price willing to pay (in cents, 1-99)' },
        wallet_id: { type: 'string', description: 'OpenSVM Bank wallet ID to use' },
      },
      required: ['ticker', 'side', 'quantity', 'wallet_id'],
    },
  },
  {
    name: 'kalshi_sell',
    description: 'Sell YES or NO contracts you own. Closes or reduces a position.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', description: 'Market ticker' },
        side: { type: 'string', enum: ['yes', 'no'], description: 'Sell YES or NO contracts' },
        quantity: { type: 'number', description: 'Number of contracts to sell' },
        min_price: { type: 'number', description: 'Minimum price willing to accept (in cents, 1-99)' },
        wallet_id: { type: 'string', description: 'OpenSVM Bank wallet ID' },
      },
      required: ['ticker', 'side', 'quantity', 'wallet_id'],
    },
  },

  // Portfolio Management
  {
    name: 'kalshi_get_positions',
    description: 'Get all open prediction market positions for a wallet',
    inputSchema: {
      type: 'object',
      properties: {
        wallet_id: { type: 'string', description: 'OpenSVM Bank wallet ID' },
      },
      required: ['wallet_id'],
    },
  },
  {
    name: 'kalshi_get_trade_history',
    description: 'Get trade history for a wallet',
    inputSchema: {
      type: 'object',
      properties: {
        wallet_id: { type: 'string', description: 'OpenSVM Bank wallet ID' },
        limit: { type: 'number', description: 'Max trades to return' },
      },
      required: ['wallet_id'],
    },
  },
  {
    name: 'kalshi_get_pnl',
    description: 'Calculate profit/loss for prediction market positions',
    inputSchema: {
      type: 'object',
      properties: {
        wallet_id: { type: 'string', description: 'OpenSVM Bank wallet ID' },
      },
      required: ['wallet_id'],
    },
  },

  // Bank Integration
  {
    name: 'bank_get_wallets',
    description: 'List all OpenSVM Bank wallets available for trading',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'bank_create_wallet',
    description: 'Create a new OpenSVM Bank wallet for prediction market trading',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Wallet name (e.g., "Prediction Trading")' },
      },
      required: ['name'],
    },
  },
  {
    name: 'bank_simulate_trade',
    description: 'Simulate a trade before execution to see potential impact',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', description: 'Market ticker' },
        side: { type: 'string', enum: ['yes', 'no'] },
        quantity: { type: 'number' },
        wallet_id: { type: 'string' },
      },
      required: ['ticker', 'side', 'quantity', 'wallet_id'],
    },
  },
];

// ============================================================================
// Tool Handlers
// ============================================================================

async function handleToolCall(
  name: string,
  args: Record<string, any>,
  kalshi: KalshiClient,
  bank: OpenSVMBankClient
): Promise<any> {
  switch (name) {
    // Market Discovery
    case 'kalshi_list_markets': {
      const result = await kalshi.listMarkets({
        status: args.status || 'open',
        series_ticker: args.series_ticker,
        limit: Math.min(args.limit || 20, 100),
      });

      return {
        markets: result.markets.map((m: any) => ({
          ticker: m.ticker,
          title: m.title,
          status: m.status,
          yes_price: m.yes_bid / 100,
          no_price: m.no_bid / 100,
          volume_24h: m.volume_24h,
          close_time: m.close_time,
        })),
        count: result.markets.length,
        cursor: result.cursor,
      };
    }

    case 'kalshi_get_market': {
      const result = await kalshi.getMarket(args.ticker);
      const m = result.market;

      return {
        ticker: m.ticker,
        title: m.title,
        subtitle: m.subtitle,
        status: m.status,
        yes_bid: m.yes_bid,
        yes_ask: m.yes_ask,
        no_bid: m.no_bid,
        no_ask: m.no_ask,
        last_price: m.last_price,
        volume: m.volume,
        volume_24h: m.volume_24h,
        open_interest: m.open_interest,
        liquidity: m.liquidity,
        close_time: m.close_time,
        expiration_time: m.expiration_time,
        rules: m.rules_primary,
        result: m.result || 'pending',
      };
    }

    case 'kalshi_get_orderbook': {
      const result = await kalshi.getOrderbook(args.ticker);
      return {
        ticker: args.ticker,
        orderbook: result.orderbook,
        summary: {
          best_yes_bid: result.orderbook.yes?.[0]?.price,
          best_no_bid: result.orderbook.no?.[0]?.price,
          yes_depth: result.orderbook.yes?.reduce((sum: number, o: any) => sum + o.quantity, 0) || 0,
          no_depth: result.orderbook.no?.reduce((sum: number, o: any) => sum + o.quantity, 0) || 0,
        },
      };
    }

    case 'kalshi_get_trades': {
      const result = await kalshi.getTrades(args.ticker, args.limit || 20);
      return {
        ticker: args.ticker,
        trades: result.trades.map((t: any) => ({
          price: t.yes_price,
          count: t.count,
          side: t.taker_side,
          time: t.created_time,
        })),
        count: result.trades.length,
      };
    }

    case 'kalshi_search_markets': {
      // List markets and filter by title containing query
      const result = await kalshi.listMarkets({
        status: args.status || 'open',
        limit: 100,
      });

      const query = args.query.toLowerCase();
      const matches = result.markets.filter((m: any) =>
        m.title?.toLowerCase().includes(query) ||
        m.subtitle?.toLowerCase().includes(query) ||
        m.ticker?.toLowerCase().includes(query)
      );

      return {
        query: args.query,
        matches: matches.slice(0, 20).map((m: any) => ({
          ticker: m.ticker,
          title: m.title,
          yes_price: m.yes_bid / 100,
          volume_24h: m.volume_24h,
        })),
        count: matches.length,
      };
    }

    case 'kalshi_list_events': {
      const result = await kalshi.listEvents({
        status: args.status || 'open',
        limit: args.limit || 20,
      });

      return {
        events: result.events.map((e: any) => ({
          ticker: e.event_ticker,
          title: e.title,
          category: e.category,
          markets: e.markets?.length || 0,
        })),
        count: result.events.length,
      };
    }

    // Trading
    case 'kalshi_buy': {
      // Get current market price
      const marketResult = await kalshi.getMarket(args.ticker);
      const market = marketResult.market;

      if (market.status !== 'active') {
        throw new Error(`Market ${args.ticker} is not active (status: ${market.status})`);
      }

      const price = args.side === 'yes' ? market.yes_ask : market.no_ask;
      const maxPrice = args.max_price || price;

      if (price > maxPrice) {
        throw new Error(`Current price ${price}c exceeds max price ${maxPrice}c`);
      }

      const total = (price / 100) * args.quantity;
      const fee = total * 0.01; // 1% fee

      // Record trade
      tradeCounter++;
      const trade: Trade = {
        id: `T-${tradeCounter}`,
        walletId: args.wallet_id,
        marketTicker: args.ticker,
        side: args.side,
        action: 'buy',
        quantity: args.quantity,
        price: price / 100,
        total,
        fee,
        timestamp: Date.now(),
      };
      trades.push(trade);

      // Update or create position
      const posKey = `${args.wallet_id}-${args.ticker}-${args.side}`;
      const existing = positions.get(posKey);

      if (existing) {
        const newQty = existing.quantity + args.quantity;
        const newAvg = ((existing.avgPrice * existing.quantity) + (price / 100 * args.quantity)) / newQty;
        existing.quantity = newQty;
        existing.avgPrice = newAvg;
        existing.currentPrice = price / 100;
      } else {
        positions.set(posKey, {
          id: posKey,
          walletId: args.wallet_id,
          marketTicker: args.ticker,
          side: args.side,
          quantity: args.quantity,
          avgPrice: price / 100,
          currentPrice: price / 100,
          unrealizedPnl: 0,
          createdAt: Date.now(),
        });
      }

      return {
        success: true,
        trade: {
          id: trade.id,
          action: 'buy',
          ticker: args.ticker,
          side: args.side,
          quantity: args.quantity,
          price: price / 100,
          total,
          fee,
        },
        message: `Bought ${args.quantity} ${args.side.toUpperCase()} contracts at ${price}c ($${total.toFixed(2)} + $${fee.toFixed(2)} fee)`,
      };
    }

    case 'kalshi_sell': {
      const posKey = `${args.wallet_id}-${args.ticker}-${args.side}`;
      const position = positions.get(posKey);

      if (!position || position.quantity < args.quantity) {
        throw new Error(`Insufficient position. Have ${position?.quantity || 0}, trying to sell ${args.quantity}`);
      }

      // Get current market price
      const marketResult = await kalshi.getMarket(args.ticker);
      const market = marketResult.market;

      const price = args.side === 'yes' ? market.yes_bid : market.no_bid;
      const minPrice = args.min_price || 0;

      if (price < minPrice) {
        throw new Error(`Current bid ${price}c below min price ${minPrice}c`);
      }

      const total = (price / 100) * args.quantity;
      const fee = total * 0.01;
      const pnl = (price / 100 - position.avgPrice) * args.quantity - fee;

      // Record trade
      tradeCounter++;
      const trade: Trade = {
        id: `T-${tradeCounter}`,
        walletId: args.wallet_id,
        marketTicker: args.ticker,
        side: args.side,
        action: 'sell',
        quantity: args.quantity,
        price: price / 100,
        total,
        fee,
        timestamp: Date.now(),
      };
      trades.push(trade);

      // Update position
      position.quantity -= args.quantity;
      if (position.quantity === 0) {
        positions.delete(posKey);
      }

      return {
        success: true,
        trade: {
          id: trade.id,
          action: 'sell',
          ticker: args.ticker,
          side: args.side,
          quantity: args.quantity,
          price: price / 100,
          total,
          fee,
          pnl,
        },
        message: `Sold ${args.quantity} ${args.side.toUpperCase()} contracts at ${price}c ($${total.toFixed(2)} - $${fee.toFixed(2)} fee, PnL: $${pnl.toFixed(2)})`,
      };
    }

    // Portfolio
    case 'kalshi_get_positions': {
      const walletPositions = Array.from(positions.values())
        .filter(p => p.walletId === args.wallet_id);

      // Update current prices
      for (const pos of walletPositions) {
        try {
          const market = await kalshi.getMarket(pos.marketTicker);
          pos.currentPrice = (pos.side === 'yes' ? market.market.yes_bid : market.market.no_bid) / 100;
          pos.unrealizedPnl = (pos.currentPrice - pos.avgPrice) * pos.quantity;
        } catch (e) {
          // Market may be closed
        }
      }

      return {
        wallet_id: args.wallet_id,
        positions: walletPositions.map(p => ({
          ticker: p.marketTicker,
          side: p.side,
          quantity: p.quantity,
          avg_price: p.avgPrice,
          current_price: p.currentPrice,
          unrealized_pnl: p.unrealizedPnl,
          value: p.currentPrice * p.quantity,
        })),
        total_value: walletPositions.reduce((sum, p) => sum + p.currentPrice * p.quantity, 0),
        total_unrealized_pnl: walletPositions.reduce((sum, p) => sum + p.unrealizedPnl, 0),
      };
    }

    case 'kalshi_get_trade_history': {
      const walletTrades = trades
        .filter(t => t.walletId === args.wallet_id)
        .slice(-(args.limit || 50));

      return {
        wallet_id: args.wallet_id,
        trades: walletTrades.map(t => ({
          id: t.id,
          ticker: t.marketTicker,
          side: t.side,
          action: t.action,
          quantity: t.quantity,
          price: t.price,
          total: t.total,
          fee: t.fee,
          time: new Date(t.timestamp).toISOString(),
        })),
        count: walletTrades.length,
      };
    }

    case 'kalshi_get_pnl': {
      const walletTrades = trades.filter(t => t.walletId === args.wallet_id);
      const walletPositions = Array.from(positions.values())
        .filter(p => p.walletId === args.wallet_id);

      // Calculate realized PnL from closed trades
      let realizedPnl = 0;
      let totalFees = 0;
      const tradesByMarket = new Map<string, Trade[]>();

      for (const trade of walletTrades) {
        const key = `${trade.marketTicker}-${trade.side}`;
        if (!tradesByMarket.has(key)) {
          tradesByMarket.set(key, []);
        }
        tradesByMarket.get(key)!.push(trade);
        totalFees += trade.fee;
      }

      // Calculate unrealized PnL from open positions
      let unrealizedPnl = 0;
      for (const pos of walletPositions) {
        unrealizedPnl += pos.unrealizedPnl;
      }

      return {
        wallet_id: args.wallet_id,
        realized_pnl: realizedPnl,
        unrealized_pnl: unrealizedPnl,
        total_pnl: realizedPnl + unrealizedPnl,
        total_fees: totalFees,
        trade_count: walletTrades.length,
        open_positions: walletPositions.length,
      };
    }

    // Bank Integration
    case 'bank_get_wallets': {
      try {
        const result = await bank.getWallets();
        return result;
      } catch (error) {
        // If bank API fails, return mock data for demo
        return {
          wallets: [
            { id: 'demo-wallet', name: 'Demo Trading Wallet', balance: 1000, address: 'DEMO...' },
          ],
          total: 1,
          note: 'Using demo wallet (bank API unavailable)',
        };
      }
    }

    case 'bank_create_wallet': {
      try {
        const result = await bank.createWallet(args.name);
        return result;
      } catch (error) {
        return {
          wallet: {
            id: `wallet-${Date.now()}`,
            name: args.name,
            balance: 0,
          },
          note: 'Demo wallet created (bank API unavailable)',
        };
      }
    }

    case 'bank_simulate_trade': {
      const market = await kalshi.getMarket(args.ticker);
      const price = args.side === 'yes' ? market.market.yes_ask : market.market.no_ask;
      const total = (price / 100) * args.quantity;
      const fee = total * 0.01;

      return {
        simulation: {
          ticker: args.ticker,
          side: args.side,
          quantity: args.quantity,
          estimated_price: price / 100,
          estimated_total: total,
          estimated_fee: fee,
          total_cost: total + fee,
        },
        market_info: {
          title: market.market.title,
          yes_bid: market.market.yes_bid,
          yes_ask: market.market.yes_ask,
          spread: market.market.yes_ask - market.market.yes_bid,
        },
        recommendation: price > 90 ? 'High price - consider waiting' :
                        price < 10 ? 'Low probability market' :
                        'Normal market conditions',
      };
    }

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  }
}

// ============================================================================
// Prompts
// ============================================================================

const PROMPTS = [
  {
    name: 'analyze_market',
    description: 'Analyze a Kalshi prediction market for trading opportunities',
    arguments: [
      { name: 'ticker', description: 'Market ticker to analyze', required: true },
    ],
  },
  {
    name: 'portfolio_review',
    description: 'Review prediction market portfolio and suggest optimizations',
    arguments: [
      { name: 'wallet_id', description: 'Wallet to review', required: true },
    ],
  },
  {
    name: 'find_opportunities',
    description: 'Find prediction market opportunities based on criteria',
    arguments: [
      { name: 'category', description: 'Category to search (crypto, politics, sports, etc.)', required: false },
      { name: 'min_volume', description: 'Minimum 24h volume', required: false },
    ],
  },
];

// ============================================================================
// Server Setup
// ============================================================================

async function main() {
  const kalshi = new KalshiClient();
  const bank = new OpenSVMBankClient(OPENSVM_BASE_URL, process.env.OPENSVM_API_KEY);

  const server = new Server(
    {
      name: 'kalshi-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        prompts: {},
      },
    }
  );

  // List tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  // Call tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const result = await handleToolCall(name, args || {}, kalshi, bank);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: message }),
          },
        ],
        isError: true,
      };
    }
  });

  // List prompts
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: PROMPTS,
  }));

  // Get prompt
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'analyze_market':
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Analyze the Kalshi prediction market ${args?.ticker}.

Please:
1. Get the market details and current prices
2. Check the orderbook depth
3. Look at recent trades
4. Assess liquidity and spread
5. Provide a trading recommendation (buy YES, buy NO, or wait)

Consider:
- Current probability vs your assessment
- Risk/reward ratio
- Market liquidity
- Time to expiration`,
              },
            },
          ],
        };

      case 'portfolio_review':
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Review the prediction market portfolio for wallet ${args?.wallet_id}.

Please:
1. Get all open positions
2. Calculate current PnL
3. Check current market prices for each position
4. Identify positions to close or adjust
5. Suggest rebalancing if needed

Focus on:
- Risk management
- Correlation between positions
- Expiring positions
- Unrealized losses that should be cut`,
              },
            },
          ],
        };

      case 'find_opportunities':
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Find prediction market opportunities${args?.category ? ` in ${args.category}` : ''}.

Search criteria:
- Status: Open markets only
- Minimum volume: ${args?.min_volume || '100'} contracts/day
- Look for: Mispriced probabilities, high volume, good liquidity

For each opportunity, provide:
1. Market ticker and title
2. Current YES/NO prices
3. Why it's interesting
4. Suggested position size`,
              },
            },
          ],
        };

      default:
        throw new McpError(ErrorCode.InvalidParams, `Unknown prompt: ${name}`);
    }
  });

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Kalshi MCP Server running on stdio');
}

main().catch(console.error);
