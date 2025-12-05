#!/usr/bin/env bun
/**
 * Kalshi Trade API MCP Server
 *
 * Comprehensive MCP server implementing the full Kalshi Trade API v2.
 * Based on OpenAPI specification from https://docs.kalshi.com/openapi.yaml
 *
 * Features:
 * - Exchange management (status, announcements, schedule)
 * - Orders (create, cancel, amend, batch operations)
 * - Portfolio management (balance, positions, settlements, fills)
 * - Markets (list, search, orderbook, trades, candlesticks)
 * - Events (single, multivariate, metadata)
 * - Series management
 * - RFQ/Quote communications
 * - API key management
 * - Milestones and live data
 *
 * Authentication: RSA-PSS signatures via KALSHI-ACCESS-KEY/SIGNATURE/TIMESTAMP headers
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
import * as crypto from 'crypto';

// ============================================================================
// Configuration
// ============================================================================

export const configSchema = z.object({
  kalshiApiUrl: z.string()
    .describe('Kalshi API base URL')
    .default('https://api.elections.kalshi.com/trade-api/v2'),
  apiKeyId: z.string()
    .describe('Kalshi API key ID')
    .optional(),
  privateKey: z.string()
    .describe('RSA private key for signing requests (PEM format)')
    .optional(),
  requestTimeout: z.number()
    .describe('Request timeout in milliseconds')
    .default(30000),
});

const KALSHI_BASE_URL = process.env.KALSHI_API_URL || 'https://api.elections.kalshi.com/trade-api/v2';
const DEFAULT_TIMEOUT = 30000;

// ============================================================================
// Kalshi API Client with RSA-PSS Authentication
// ============================================================================

class KalshiAPIClient {
  private baseUrl: string;
  private timeout: number;
  private apiKeyId?: string;
  private privateKey?: crypto.KeyObject;

  constructor(
    baseUrl: string = KALSHI_BASE_URL,
    timeout: number = DEFAULT_TIMEOUT,
    apiKeyId?: string,
    privateKeyPem?: string
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeout = timeout;
    this.apiKeyId = apiKeyId;
    if (privateKeyPem) {
      this.privateKey = crypto.createPrivateKey(privateKeyPem);
    }
  }

  private signRequest(timestamp: string, method: string, path: string): string | null {
    if (!this.privateKey || !this.apiKeyId) return null;

    const message = `${timestamp}${method}${path}`;
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(message);
    sign.end();

    return sign.sign({
      key: this.privateKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    }, 'base64');
  }

  private makeUrl(path: string): string {
    return `${this.baseUrl}${path.startsWith('/') ? path : '/' + path}`;
  }

  async request<T = any>(
    method: string,
    path: string,
    params?: Record<string, any>,
    body?: any
  ): Promise<T> {
    const url = new URL(this.makeUrl(path));
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => url.searchParams.append(key, String(v)));
          } else {
            url.searchParams.set(key, String(value));
          }
        }
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    // Add authentication headers if configured
    if (this.apiKeyId && this.privateKey) {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const pathWithQuery = url.pathname + url.search;
      const signature = this.signRequest(timestamp, method.toUpperCase(), pathWithQuery);
      if (signature) {
        headers['KALSHI-ACCESS-KEY'] = this.apiKeyId;
        headers['KALSHI-ACCESS-SIGNATURE'] = signature;
        headers['KALSHI-ACCESS-TIMESTAMP'] = timestamp;
      }
    }

    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Kalshi API error: ${response.status} - ${errorText}`);
      }

      const text = await response.text();
      return (text ? JSON.parse(text) : {}) as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  async get<T = any>(path: string, params?: Record<string, any>): Promise<T> {
    return this.request<T>('GET', path, params);
  }

  async post<T = any>(path: string, body?: any, params?: Record<string, any>): Promise<T> {
    return this.request<T>('POST', path, params, body);
  }

  async put<T = any>(path: string, body?: any, params?: Record<string, any>): Promise<T> {
    return this.request<T>('PUT', path, params, body);
  }

  async delete<T = any>(path: string, params?: Record<string, any>, body?: any): Promise<T> {
    return this.request<T>('DELETE', path, params, body);
  }
}

// ============================================================================
// Tool Definitions
// ============================================================================

const TOOLS: Tool[] = [
  // ──────────────────────────────────────────────────────────────────────────
  // Exchange Management
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: 'kalshi_get_exchange_status',
    description: 'Get the current operational status of the Kalshi exchange.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: {
      title: 'Get Exchange Status',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_get_announcements',
    description: 'Get exchange-wide announcements from Kalshi.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: {
      title: 'Get Announcements',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_get_schedule',
    description: 'Get the trading schedule for the Kalshi exchange.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: {
      title: 'Get Exchange Schedule',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Markets
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: 'kalshi_list_markets',
    description: 'List available prediction markets on Kalshi with filtering options.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (1-200, default 100)' },
        cursor: { type: 'string', description: 'Pagination cursor' },
        event_ticker: { type: 'string', description: 'Filter by event ticker' },
        series_ticker: { type: 'string', description: 'Filter by series ticker' },
        max_close_ts: { type: 'number', description: 'Maximum close timestamp (Unix)' },
        min_close_ts: { type: 'number', description: 'Minimum close timestamp (Unix)' },
        status: { type: 'string', enum: ['open', 'closed', 'settled'], description: 'Market status filter' },
        tickers: { type: 'string', description: 'Comma-separated market tickers' },
      },
    },
    annotations: {
      title: 'List Markets',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_get_market',
    description: 'Get detailed information about a specific Kalshi market by ticker.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', description: 'Market ticker (e.g., KXBTC-25DEC31-T100000)' },
      },
      required: ['ticker'],
    },
    annotations: {
      title: 'Get Market',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_get_orderbook',
    description: 'Get the current orderbook (bids and asks) for a market.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', description: 'Market ticker' },
        depth: { type: 'number', description: 'Orderbook depth (default 10)' },
      },
      required: ['ticker'],
    },
    annotations: {
      title: 'Get Orderbook',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_get_market_trades',
    description: 'Get recent trades for a specific market.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of trades (1-1000)' },
        cursor: { type: 'string', description: 'Pagination cursor' },
        ticker: { type: 'string', description: 'Market ticker to filter by' },
        min_ts: { type: 'number', description: 'Minimum timestamp filter' },
        max_ts: { type: 'number', description: 'Maximum timestamp filter' },
      },
    },
    annotations: {
      title: 'Get Market Trades',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_get_candlesticks',
    description: 'Get OHLC candlestick data for markets (batch up to 100 markets, 10k max).',
    inputSchema: {
      type: 'object',
      properties: {
        series_ticker: { type: 'string', description: 'Series ticker' },
        tickers: { type: 'string', description: 'Comma-separated market tickers' },
        start_ts: { type: 'number', description: 'Start timestamp (Unix seconds)' },
        end_ts: { type: 'number', description: 'End timestamp (Unix seconds)' },
        period_interval: { type: 'number', description: 'Candle interval in minutes (1, 5, 15, 60, 1440)' },
      },
      required: ['series_ticker'],
    },
    annotations: {
      title: 'Get Candlesticks',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Events
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: 'kalshi_list_events',
    description: 'List events (groups of related markets) on Kalshi.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results' },
        cursor: { type: 'string', description: 'Pagination cursor' },
        status: { type: 'string', enum: ['open', 'closed', 'settled'], description: 'Event status filter' },
        series_ticker: { type: 'string', description: 'Filter by series ticker' },
        with_nested_markets: { type: 'boolean', description: 'Include nested market data' },
      },
    },
    annotations: {
      title: 'List Events',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_get_event',
    description: 'Get details of a specific event by ticker.',
    inputSchema: {
      type: 'object',
      properties: {
        event_ticker: { type: 'string', description: 'Event ticker' },
        with_nested_markets: { type: 'boolean', description: 'Include nested market data' },
      },
      required: ['event_ticker'],
    },
    annotations: {
      title: 'Get Event',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_get_event_metadata',
    description: 'Get metadata for a specific event.',
    inputSchema: {
      type: 'object',
      properties: {
        event_ticker: { type: 'string', description: 'Event ticker' },
      },
      required: ['event_ticker'],
    },
    annotations: {
      title: 'Get Event Metadata',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_list_multivariate_events',
    description: 'List multivariate (combo) events only.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results' },
        cursor: { type: 'string', description: 'Pagination cursor' },
      },
    },
    annotations: {
      title: 'List Multivariate Events',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_get_event_candlesticks',
    description: 'Get OHLC candlestick data for an event.',
    inputSchema: {
      type: 'object',
      properties: {
        series_ticker: { type: 'string', description: 'Series ticker' },
        event_ticker: { type: 'string', description: 'Event ticker' },
        start_ts: { type: 'number', description: 'Start timestamp' },
        end_ts: { type: 'number', description: 'End timestamp' },
        period_interval: { type: 'number', description: 'Candle interval in minutes' },
      },
      required: ['series_ticker', 'event_ticker'],
    },
    annotations: {
      title: 'Get Event Candlesticks',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_get_forecast_percentile_history',
    description: 'Get historical percentile forecast data for an event (max 10 percentiles).',
    inputSchema: {
      type: 'object',
      properties: {
        series_ticker: { type: 'string', description: 'Series ticker' },
        event_ticker: { type: 'string', description: 'Event ticker' },
        percentiles: { type: 'string', description: 'Comma-separated percentiles (e.g., "10,25,50,75,90")' },
      },
      required: ['series_ticker', 'event_ticker'],
    },
    annotations: {
      title: 'Get Forecast History',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Series
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: 'kalshi_list_series',
    description: 'List all series with optional category/tag filters.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results' },
        cursor: { type: 'string', description: 'Pagination cursor' },
        status: { type: 'string', description: 'Status filter' },
      },
    },
    annotations: {
      title: 'List Series',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_get_series',
    description: 'Get series definition and metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        series_ticker: { type: 'string', description: 'Series ticker' },
      },
      required: ['series_ticker'],
    },
    annotations: {
      title: 'Get Series',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_get_fee_changes',
    description: 'Get fee structure changes for a series.',
    inputSchema: {
      type: 'object',
      properties: {
        series_ticker: { type: 'string', description: 'Series ticker (optional)' },
      },
    },
    annotations: {
      title: 'Get Fee Changes',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Search & Discovery
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: 'kalshi_search_markets',
    description: 'Search markets by keyword in title, subtitle, or ticker.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        status: { type: 'string', enum: ['open', 'closed', 'settled'], description: 'Filter by status' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
      required: ['query'],
    },
    annotations: {
      title: 'Search Markets',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_get_tags_by_categories',
    description: 'Get category-to-tags mapping for market discovery.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: {
      title: 'Get Tags by Categories',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_get_sport_filters',
    description: 'Get sport filters and competitions for sports markets.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: {
      title: 'Get Sport Filters',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Portfolio & Orders (Authenticated)
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: 'kalshi_get_balance',
    description: 'Get account balance (in cents). Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: {
      title: 'Get Balance',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_get_positions',
    description: 'List all open positions with optional filters. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results' },
        cursor: { type: 'string', description: 'Pagination cursor' },
        settlement_status: { type: 'string', enum: ['unsettled', 'settled'], description: 'Settlement status filter' },
        ticker: { type: 'string', description: 'Filter by market ticker' },
        event_ticker: { type: 'string', description: 'Filter by event ticker' },
        count_filter: { type: 'string', enum: ['all', 'position', 'resting_orders'], description: 'Position count filter' },
      },
    },
    annotations: {
      title: 'Get Positions',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_get_fills',
    description: 'Get completed trades/fills for the authenticated user. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results' },
        cursor: { type: 'string', description: 'Pagination cursor' },
        ticker: { type: 'string', description: 'Filter by market ticker' },
        order_id: { type: 'string', description: 'Filter by order ID' },
        min_ts: { type: 'number', description: 'Minimum timestamp' },
        max_ts: { type: 'number', description: 'Maximum timestamp' },
      },
    },
    annotations: {
      title: 'Get Fills',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_get_settlements',
    description: 'View settlement history. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results' },
        cursor: { type: 'string', description: 'Pagination cursor' },
      },
    },
    annotations: {
      title: 'Get Settlements',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_get_resting_order_value',
    description: 'Get total resting order value (FCM). Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: {
      title: 'Get Resting Order Value',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_list_orders',
    description: 'List all orders for the authenticated user. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results' },
        cursor: { type: 'string', description: 'Pagination cursor' },
        ticker: { type: 'string', description: 'Filter by market ticker' },
        event_ticker: { type: 'string', description: 'Filter by event ticker' },
        status: { type: 'string', enum: ['resting', 'canceled', 'executed', 'pending'], description: 'Order status filter' },
      },
    },
    annotations: {
      title: 'List Orders',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_get_order',
    description: 'Get details of a specific order. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        order_id: { type: 'string', description: 'Order ID' },
      },
      required: ['order_id'],
    },
    annotations: {
      title: 'Get Order',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_create_order',
    description: 'Submit a new order. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', description: 'Market ticker' },
        action: { type: 'string', enum: ['buy', 'sell'], description: 'Buy or sell' },
        side: { type: 'string', enum: ['yes', 'no'], description: 'Yes or No contracts' },
        type: { type: 'string', enum: ['limit', 'market'], description: 'Order type' },
        count: { type: 'number', description: 'Number of contracts' },
        yes_price: { type: 'number', description: 'Limit price in cents (1-99) for yes contracts' },
        no_price: { type: 'number', description: 'Limit price in cents (1-99) for no contracts' },
        expiration_ts: { type: 'number', description: 'Order expiration timestamp (optional)' },
        sell_position_floor: { type: 'number', description: 'Position floor for sell orders' },
        buy_max_cost: { type: 'number', description: 'Max cost in cents for buy orders' },
      },
      required: ['ticker', 'action', 'side', 'type', 'count'],
    },
    annotations: {
      title: 'Create Order',
      readOnlyHint: false,
      idempotentHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'kalshi_cancel_order',
    description: 'Cancel an existing order. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        order_id: { type: 'string', description: 'Order ID to cancel' },
      },
      required: ['order_id'],
    },
    annotations: {
      title: 'Cancel Order',
      readOnlyHint: false,
      idempotentHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'kalshi_amend_order',
    description: 'Modify price or quantity of an existing order. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        order_id: { type: 'string', description: 'Order ID to amend' },
        count: { type: 'number', description: 'New count (optional)' },
        yes_price: { type: 'number', description: 'New yes price in cents (optional)' },
        no_price: { type: 'number', description: 'New no price in cents (optional)' },
      },
      required: ['order_id'],
    },
    annotations: {
      title: 'Amend Order',
      readOnlyHint: false,
      idempotentHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'kalshi_decrease_order',
    description: 'Reduce the quantity of an existing order. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        order_id: { type: 'string', description: 'Order ID' },
        reduce_by: { type: 'number', description: 'Amount to reduce count by' },
      },
      required: ['order_id', 'reduce_by'],
    },
    annotations: {
      title: 'Decrease Order',
      readOnlyHint: false,
      idempotentHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'kalshi_create_batch_orders',
    description: 'Submit up to 20 orders simultaneously. Requires authentication.',
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
              no_price: { type: 'number' },
            },
            required: ['ticker', 'action', 'side', 'type', 'count'],
          },
          description: 'Array of orders (max 20)',
        },
      },
      required: ['orders'],
    },
    annotations: {
      title: 'Create Batch Orders',
      readOnlyHint: false,
      idempotentHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'kalshi_cancel_batch_orders',
    description: 'Cancel multiple orders at once. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        order_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of order IDs to cancel',
        },
      },
      required: ['order_ids'],
    },
    annotations: {
      title: 'Cancel Batch Orders',
      readOnlyHint: false,
      idempotentHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'kalshi_get_queue_position',
    description: 'Get queue position for a specific order. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        order_id: { type: 'string', description: 'Order ID' },
      },
      required: ['order_id'],
    },
    annotations: {
      title: 'Get Queue Position',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_get_queue_positions',
    description: 'Get queue positions for all resting orders. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: {
      title: 'Get Queue Positions',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Order Groups
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: 'kalshi_list_order_groups',
    description: 'List all order groups. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: {
      title: 'List Order Groups',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_create_order_group',
    description: 'Create an order group with contracts limit. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Group name' },
        max_contracts: { type: 'number', description: 'Maximum contracts allowed in group' },
      },
      required: ['name', 'max_contracts'],
    },
    annotations: {
      title: 'Create Order Group',
      readOnlyHint: false,
      idempotentHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'kalshi_get_order_group',
    description: 'Get order group details. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        order_group_id: { type: 'string', description: 'Order group ID' },
      },
      required: ['order_group_id'],
    },
    annotations: {
      title: 'Get Order Group',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_delete_order_group',
    description: 'Delete an order group and cancel its orders. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        order_group_id: { type: 'string', description: 'Order group ID' },
      },
      required: ['order_group_id'],
    },
    annotations: {
      title: 'Delete Order Group',
      readOnlyHint: false,
      idempotentHint: true,
      destructiveHint: true,
    },
  },
  {
    name: 'kalshi_reset_order_group',
    description: 'Reset matched counter for an order group. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        order_group_id: { type: 'string', description: 'Order group ID' },
      },
      required: ['order_group_id'],
    },
    annotations: {
      title: 'Reset Order Group',
      readOnlyHint: false,
      idempotentHint: true,
      destructiveHint: false,
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Communications (RFQ/Quotes)
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: 'kalshi_get_communications_id',
    description: 'Get user communications ID. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: {
      title: 'Get Communications ID',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_list_rfqs',
    description: 'List RFQs (Request for Quotes). Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (max 100)' },
        cursor: { type: 'string', description: 'Pagination cursor' },
        status: { type: 'string', enum: ['open', 'filled', 'cancelled'], description: 'RFQ status filter' },
      },
    },
    annotations: {
      title: 'List RFQs',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_create_rfq',
    description: 'Create a Request for Quote. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', description: 'Market ticker' },
        side: { type: 'string', enum: ['yes', 'no'], description: 'Contract side' },
        count: { type: 'number', description: 'Number of contracts' },
        action: { type: 'string', enum: ['buy', 'sell'], description: 'Buy or sell' },
      },
      required: ['ticker', 'side', 'count', 'action'],
    },
    annotations: {
      title: 'Create RFQ',
      readOnlyHint: false,
      idempotentHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'kalshi_get_rfq',
    description: 'Get details of a specific RFQ. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        rfq_id: { type: 'string', description: 'RFQ ID' },
      },
      required: ['rfq_id'],
    },
    annotations: {
      title: 'Get RFQ',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_delete_rfq',
    description: 'Delete/cancel an RFQ. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        rfq_id: { type: 'string', description: 'RFQ ID' },
      },
      required: ['rfq_id'],
    },
    annotations: {
      title: 'Delete RFQ',
      readOnlyHint: false,
      idempotentHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'kalshi_list_quotes',
    description: 'List quotes. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results' },
        cursor: { type: 'string', description: 'Pagination cursor' },
        status: { type: 'string', enum: ['open', 'accepted', 'rejected', 'expired'], description: 'Quote status' },
        is_creator: { type: 'boolean', description: 'Filter by creator' },
      },
    },
    annotations: {
      title: 'List Quotes',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_create_quote',
    description: 'Submit a quote response to an RFQ. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        rfq_id: { type: 'string', description: 'RFQ ID to quote' },
        price: { type: 'number', description: 'Quote price in cents' },
        expiration_ts: { type: 'number', description: 'Quote expiration timestamp' },
      },
      required: ['rfq_id', 'price'],
    },
    annotations: {
      title: 'Create Quote',
      readOnlyHint: false,
      idempotentHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'kalshi_get_quote',
    description: 'Get details of a specific quote. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        quote_id: { type: 'string', description: 'Quote ID' },
      },
      required: ['quote_id'],
    },
    annotations: {
      title: 'Get Quote',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_delete_quote',
    description: 'Revoke a quote. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        quote_id: { type: 'string', description: 'Quote ID' },
      },
      required: ['quote_id'],
    },
    annotations: {
      title: 'Delete Quote',
      readOnlyHint: false,
      idempotentHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'kalshi_accept_quote',
    description: 'Accept a quote. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        quote_id: { type: 'string', description: 'Quote ID' },
      },
      required: ['quote_id'],
    },
    annotations: {
      title: 'Accept Quote',
      readOnlyHint: false,
      idempotentHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'kalshi_confirm_quote',
    description: 'Confirm an accepted quote. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        quote_id: { type: 'string', description: 'Quote ID' },
      },
      required: ['quote_id'],
    },
    annotations: {
      title: 'Confirm Quote',
      readOnlyHint: false,
      idempotentHint: false,
      destructiveHint: false,
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Multivariate Event Collections
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: 'kalshi_list_collections',
    description: 'List multivariate event collections.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results' },
        cursor: { type: 'string', description: 'Pagination cursor' },
      },
    },
    annotations: {
      title: 'List Collections',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_get_collection',
    description: 'Get details of a multivariate event collection.',
    inputSchema: {
      type: 'object',
      properties: {
        collection_ticker: { type: 'string', description: 'Collection ticker' },
      },
      required: ['collection_ticker'],
    },
    annotations: {
      title: 'Get Collection',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_create_collection_market',
    description: 'Create a market in a collection. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        collection_ticker: { type: 'string', description: 'Collection ticker' },
        outcomes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Market outcomes',
        },
      },
      required: ['collection_ticker', 'outcomes'],
    },
    annotations: {
      title: 'Create Collection Market',
      readOnlyHint: false,
      idempotentHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'kalshi_lookup_collection_market',
    description: 'Look up a market in a collection.',
    inputSchema: {
      type: 'object',
      properties: {
        collection_ticker: { type: 'string', description: 'Collection ticker' },
        outcomes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Outcomes to look up',
        },
      },
      required: ['collection_ticker', 'outcomes'],
    },
    annotations: {
      title: 'Lookup Collection Market',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // API Keys Management
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: 'kalshi_list_api_keys',
    description: 'List all API keys. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: {
      title: 'List API Keys',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_create_api_key',
    description: 'Create an API key with user-provided public key. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Key name' },
        public_key: { type: 'string', description: 'RSA public key (PEM format)' },
      },
      required: ['name', 'public_key'],
    },
    annotations: {
      title: 'Create API Key',
      readOnlyHint: false,
      idempotentHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'kalshi_generate_api_key',
    description: 'Auto-generate an RSA key pair for API access. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Key name' },
      },
      required: ['name'],
    },
    annotations: {
      title: 'Generate API Key',
      readOnlyHint: false,
      idempotentHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'kalshi_delete_api_key',
    description: 'Revoke an API key permanently. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        api_key: { type: 'string', description: 'API key ID to revoke' },
      },
      required: ['api_key'],
    },
    annotations: {
      title: 'Delete API Key',
      readOnlyHint: false,
      idempotentHint: true,
      destructiveHint: true,
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Milestones & Live Data
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: 'kalshi_list_milestones',
    description: 'Get paginated list of milestones with RFC3339 filtering.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results' },
        cursor: { type: 'string', description: 'Pagination cursor' },
        min_ts: { type: 'string', description: 'Minimum timestamp (RFC3339)' },
        max_ts: { type: 'string', description: 'Maximum timestamp (RFC3339)' },
      },
    },
    annotations: {
      title: 'List Milestones',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_get_milestone',
    description: 'Get details of a single milestone.',
    inputSchema: {
      type: 'object',
      properties: {
        milestone_id: { type: 'string', description: 'Milestone ID' },
      },
      required: ['milestone_id'],
    },
    annotations: {
      title: 'Get Milestone',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_get_milestone_live_data',
    description: 'Get live data for a milestone.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Data type' },
        milestone_id: { type: 'string', description: 'Milestone ID' },
      },
      required: ['type', 'milestone_id'],
    },
    annotations: {
      title: 'Get Milestone Live Data',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_get_batch_live_data',
    description: 'Get live data for multiple milestones (max 100).',
    inputSchema: {
      type: 'object',
      properties: {
        milestone_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of milestone IDs',
        },
        type: { type: 'string', description: 'Data type' },
      },
      required: ['milestone_ids', 'type'],
    },
    annotations: {
      title: 'Get Batch Live Data',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Incentive Programs & Structured Targets
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: 'kalshi_list_incentive_programs',
    description: 'List volume/liquidity incentive programs.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: {
      title: 'List Incentive Programs',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_list_structured_targets',
    description: 'Get paginated list of structured targets.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results' },
        cursor: { type: 'string', description: 'Pagination cursor' },
      },
    },
    annotations: {
      title: 'List Structured Targets',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_get_structured_target',
    description: 'Get details of a structured target.',
    inputSchema: {
      type: 'object',
      properties: {
        structured_target_id: { type: 'string', description: 'Structured target ID' },
      },
      required: ['structured_target_id'],
    },
    annotations: {
      title: 'Get Structured Target',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // FCM (Futures Commission Merchant)
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: 'kalshi_get_fcm_orders',
    description: 'Get FCM subtrader orders. Requires FCM authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results' },
        cursor: { type: 'string', description: 'Pagination cursor' },
        subtrader_id: { type: 'string', description: 'Subtrader ID' },
      },
    },
    annotations: {
      title: 'Get FCM Orders',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: 'kalshi_get_fcm_positions',
    description: 'Get FCM subtrader positions. Requires FCM authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results' },
        cursor: { type: 'string', description: 'Pagination cursor' },
        subtrader_id: { type: 'string', description: 'Subtrader ID' },
      },
    },
    annotations: {
      title: 'Get FCM Positions',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Utility
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: 'kalshi_get_user_data_timestamp',
    description: 'Check data sync timestamp for the user.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: {
      title: 'Get User Data Timestamp',
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
];

// ============================================================================
// Tool Handler
// ============================================================================

async function handleToolCall(
  name: string,
  args: Record<string, any>,
  client: KalshiAPIClient
): Promise<any> {
  switch (name) {
    // Exchange Management
    case 'kalshi_get_exchange_status':
      return client.get('/exchange/status');

    case 'kalshi_get_announcements':
      return client.get('/exchange/announcements');

    case 'kalshi_get_schedule':
      return client.get('/exchange/schedule');

    // Markets
    case 'kalshi_list_markets':
      return client.get('/markets', args);

    case 'kalshi_get_market':
      return client.get(`/markets/${args.ticker}`);

    case 'kalshi_get_orderbook':
      return client.get(`/markets/${args.ticker}/orderbook`, { depth: args.depth });

    case 'kalshi_get_market_trades':
      return client.get('/markets/trades', args);

    case 'kalshi_get_candlesticks':
      return client.get('/markets/candlesticks', args);

    // Events
    case 'kalshi_list_events':
      return client.get('/events', args);

    case 'kalshi_get_event':
      return client.get(`/events/${args.event_ticker}`, {
        with_nested_markets: args.with_nested_markets,
      });

    case 'kalshi_get_event_metadata':
      return client.get(`/events/${args.event_ticker}/metadata`);

    case 'kalshi_list_multivariate_events':
      return client.get('/events/multivariate', args);

    case 'kalshi_get_event_candlesticks':
      return client.get(
        `/series/${args.series_ticker}/events/${args.event_ticker}/candlesticks`,
        { start_ts: args.start_ts, end_ts: args.end_ts, period_interval: args.period_interval }
      );

    case 'kalshi_get_forecast_percentile_history':
      return client.get(
        `/series/${args.series_ticker}/events/${args.event_ticker}/forecast_percentile_history`,
        { percentiles: args.percentiles }
      );

    // Series
    case 'kalshi_list_series':
      return client.get('/series', args);

    case 'kalshi_get_series':
      return client.get(`/series/${args.series_ticker}`);

    case 'kalshi_get_fee_changes':
      return client.get('/series/fee_changes', { series_ticker: args.series_ticker });

    // Search
    case 'kalshi_search_markets': {
      const result = await client.get('/markets', {
        status: args.status || 'open',
        limit: 200,
      });
      const query = args.query.toLowerCase();
      const matches = result.markets?.filter((m: any) =>
        m.title?.toLowerCase().includes(query) ||
        m.subtitle?.toLowerCase().includes(query) ||
        m.ticker?.toLowerCase().includes(query)
      ) || [];
      return {
        query: args.query,
        matches: matches.slice(0, args.limit || 20),
        count: matches.length,
      };
    }

    case 'kalshi_get_tags_by_categories':
      return client.get('/search/tags_by_categories');

    case 'kalshi_get_sport_filters':
      return client.get('/search/filters_by_sports');

    // Portfolio
    case 'kalshi_get_balance':
      return client.get('/portfolio/balance');

    case 'kalshi_get_positions':
      return client.get('/portfolio/positions', args);

    case 'kalshi_get_fills':
      return client.get('/portfolio/fills', args);

    case 'kalshi_get_settlements':
      return client.get('/portfolio/settlements', args);

    case 'kalshi_get_resting_order_value':
      return client.get('/portfolio/summary/total_resting_order_value');

    // Orders
    case 'kalshi_list_orders':
      return client.get('/portfolio/orders', args);

    case 'kalshi_get_order':
      return client.get(`/portfolio/orders/${args.order_id}`);

    case 'kalshi_create_order':
      return client.post('/portfolio/orders', args);

    case 'kalshi_cancel_order':
      return client.delete(`/portfolio/orders/${args.order_id}`);

    case 'kalshi_amend_order':
      return client.post(`/portfolio/orders/${args.order_id}/amend`, args);

    case 'kalshi_decrease_order':
      return client.post(`/portfolio/orders/${args.order_id}/decrease`, {
        reduce_by: args.reduce_by,
      });

    case 'kalshi_create_batch_orders':
      return client.post('/portfolio/orders/batched', { orders: args.orders });

    case 'kalshi_cancel_batch_orders':
      return client.delete('/portfolio/orders/batched', {}, { order_ids: args.order_ids });

    case 'kalshi_get_queue_position':
      return client.get(`/portfolio/orders/${args.order_id}/queue_position`);

    case 'kalshi_get_queue_positions':
      return client.get('/portfolio/orders/queue_positions');

    // Order Groups
    case 'kalshi_list_order_groups':
      return client.get('/portfolio/order_groups');

    case 'kalshi_create_order_group':
      return client.post('/portfolio/order_groups/create', args);

    case 'kalshi_get_order_group':
      return client.get(`/portfolio/order_groups/${args.order_group_id}`);

    case 'kalshi_delete_order_group':
      return client.delete(`/portfolio/order_groups/${args.order_group_id}`);

    case 'kalshi_reset_order_group':
      return client.put(`/portfolio/order_groups/${args.order_group_id}/reset`);

    // Communications
    case 'kalshi_get_communications_id':
      return client.get('/communications/id');

    case 'kalshi_list_rfqs':
      return client.get('/communications/rfqs', args);

    case 'kalshi_create_rfq':
      return client.post('/communications/rfqs', args);

    case 'kalshi_get_rfq':
      return client.get(`/communications/rfqs/${args.rfq_id}`);

    case 'kalshi_delete_rfq':
      return client.delete(`/communications/rfqs/${args.rfq_id}`);

    case 'kalshi_list_quotes':
      return client.get('/communications/quotes', args);

    case 'kalshi_create_quote':
      return client.post('/communications/quotes', args);

    case 'kalshi_get_quote':
      return client.get(`/communications/quotes/${args.quote_id}`);

    case 'kalshi_delete_quote':
      return client.delete(`/communications/quotes/${args.quote_id}`);

    case 'kalshi_accept_quote':
      return client.put(`/communications/quotes/${args.quote_id}/accept`);

    case 'kalshi_confirm_quote':
      return client.put(`/communications/quotes/${args.quote_id}/confirm`);

    // Collections
    case 'kalshi_list_collections':
      return client.get('/multivariate_event_collections', args);

    case 'kalshi_get_collection':
      return client.get(`/multivariate_event_collections/${args.collection_ticker}`);

    case 'kalshi_create_collection_market':
      return client.post(`/multivariate_event_collections/${args.collection_ticker}`, {
        outcomes: args.outcomes,
      });

    case 'kalshi_lookup_collection_market':
      return client.put(`/multivariate_event_collections/${args.collection_ticker}/lookup`, {
        outcomes: args.outcomes,
      });

    // API Keys
    case 'kalshi_list_api_keys':
      return client.get('/api_keys');

    case 'kalshi_create_api_key':
      return client.post('/api_keys', args);

    case 'kalshi_generate_api_key':
      return client.post('/api_keys/generate', args);

    case 'kalshi_delete_api_key':
      return client.delete(`/api_keys/${args.api_key}`);

    // Milestones
    case 'kalshi_list_milestones':
      return client.get('/milestones', args);

    case 'kalshi_get_milestone':
      return client.get(`/milestones/${args.milestone_id}`);

    case 'kalshi_get_milestone_live_data':
      return client.get(`/live_data/${args.type}/milestone/${args.milestone_id}`);

    case 'kalshi_get_batch_live_data':
      return client.get('/live_data/batch', {
        milestone_ids: args.milestone_ids,
        type: args.type,
      });

    // Incentives
    case 'kalshi_list_incentive_programs':
      return client.get('/incentive_programs');

    case 'kalshi_list_structured_targets':
      return client.get('/structured_targets', args);

    case 'kalshi_get_structured_target':
      return client.get(`/structured_targets/${args.structured_target_id}`);

    // FCM
    case 'kalshi_get_fcm_orders':
      return client.get('/fcm/orders', args);

    case 'kalshi_get_fcm_positions':
      return client.get('/fcm/positions', args);

    // Utility
    case 'kalshi_get_user_data_timestamp':
      return client.get('/exchange/user_data_timestamp');

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  }
}

// ============================================================================
// Prompts
// ============================================================================

const PROMPTS = [
  {
    name: 'analyze_kalshi_market',
    description: 'Analyze a Kalshi prediction market for trading opportunities',
    arguments: [
      { name: 'ticker', description: 'Market ticker to analyze', required: true },
    ],
  },
  {
    name: 'portfolio_review',
    description: 'Review prediction market portfolio and suggest optimizations',
    arguments: [],
  },
  {
    name: 'find_arbitrage',
    description: 'Find arbitrage opportunities across related markets',
    arguments: [
      { name: 'event_ticker', description: 'Event ticker to analyze', required: false },
    ],
  },
  {
    name: 'market_maker_analysis',
    description: 'Analyze market making opportunities in a market',
    arguments: [
      { name: 'ticker', description: 'Market ticker', required: true },
    ],
  },
  {
    name: 'event_summary',
    description: 'Get a comprehensive summary of an event and all its markets',
    arguments: [
      { name: 'event_ticker', description: 'Event ticker', required: true },
    ],
  },
];

// ============================================================================
// Resources
// ============================================================================

const RESOURCES = [
  {
    uri: 'kalshi://exchange/status',
    name: 'Exchange Status',
    description: 'Current operational status of the Kalshi exchange',
    mimeType: 'application/json',
  },
  {
    uri: 'kalshi://exchange/schedule',
    name: 'Trading Schedule',
    description: 'Kalshi exchange trading schedule',
    mimeType: 'application/json',
  },
  {
    uri: 'kalshi://markets/trending',
    name: 'Trending Markets',
    description: 'Currently trending prediction markets by volume',
    mimeType: 'application/json',
  },
];

// ============================================================================
// Server Setup
// ============================================================================

interface ServerConfig {
  kalshiApiUrl?: string;
  apiKeyId?: string;
  privateKey?: string;
  requestTimeout?: number;
}

function createServer(config?: ServerConfig) {
  const client = new KalshiAPIClient(
    config?.kalshiApiUrl || KALSHI_BASE_URL,
    config?.requestTimeout || DEFAULT_TIMEOUT,
    config?.apiKeyId || process.env.KALSHI_API_KEY_ID,
    config?.privateKey || process.env.KALSHI_PRIVATE_KEY
  );

  const server = new Server(
    {
      name: 'kalshi-mcp',
      version: '2.0.0',
    },
    {
      capabilities: {
        tools: {},
        prompts: {},
        resources: {},
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
      const result = await handleToolCall(name, args || {}, client);
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
      case 'analyze_kalshi_market':
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Analyze the Kalshi prediction market ${args?.ticker}.

Please:
1. Get the market details and current prices
2. Check the orderbook depth and spread
3. Look at recent trades for volume and price action
4. Assess liquidity and market efficiency
5. Provide a trading recommendation

Consider:
- Current implied probability vs fundamental assessment
- Risk/reward ratio for YES and NO positions
- Market liquidity and execution costs
- Time to expiration and event timing
- Related markets and correlation risks`,
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
                text: `Review my Kalshi prediction market portfolio.

Please:
1. Get all open positions and their current values
2. Calculate total P&L (realized and unrealized)
3. Assess portfolio risk and diversification
4. Identify positions to close or hedge
5. Suggest rebalancing opportunities

Focus on:
- Concentration risk in correlated markets
- Expiring positions needing attention
- Stop-loss candidates for losing positions
- Profit-taking opportunities
- Margin/capital efficiency`,
              },
            },
          ],
        };

      case 'find_arbitrage':
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Find arbitrage opportunities${args?.event_ticker ? ` in event ${args.event_ticker}` : ' across Kalshi markets'}.

Look for:
1. Markets where YES + NO prices don't sum to 100
2. Related binary markets with inconsistent pricing
3. Multi-outcome events with pricing inefficiencies
4. Time-based arbitrage opportunities

For each opportunity:
- Calculate the arbitrage profit potential
- Assess execution risk and costs
- Check liquidity for both legs
- Suggest optimal position sizes`,
              },
            },
          ],
        };

      case 'market_maker_analysis':
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Analyze market making opportunities in ${args?.ticker}.

Please:
1. Get current orderbook and spread
2. Analyze historical price volatility
3. Calculate expected market making returns
4. Assess inventory risk
5. Suggest optimal quotes

Consider:
- Bid-ask spread and competition
- Volume patterns and liquidity
- Event risk and volatility
- Capital requirements
- Position limits`,
              },
            },
          ],
        };

      case 'event_summary':
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Provide a comprehensive summary of event ${args?.event_ticker}.

Include:
1. Event description and resolution criteria
2. All markets within this event
3. Current prices and implied probabilities
4. Total volume and open interest
5. Key dates (close time, expiration)
6. Related events and correlations

Provide:
- Overview of market consensus
- Notable pricing discrepancies
- Trading opportunities
- Risk factors to consider`,
              },
            },
          ],
        };

      default:
        throw new McpError(ErrorCode.InvalidParams, `Unknown prompt: ${name}`);
    }
  });

  // List resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: RESOURCES,
  }));

  // Read resource
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    switch (uri) {
      case 'kalshi://exchange/status': {
        const result = await client.get('/exchange/status');
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'kalshi://exchange/schedule': {
        const result = await client.get('/exchange/schedule');
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'kalshi://markets/trending': {
        const result = await client.get('/markets', {
          status: 'open',
          limit: 20,
        });
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
    }
  });

  return server;
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Kalshi MCP Server v2.0.0 running on stdio');
  console.error(`Tools: ${TOOLS.length}, Prompts: ${PROMPTS.length}, Resources: ${RESOURCES.length}`);
}

// Export for programmatic use
export { createServer, KalshiAPIClient, TOOLS, PROMPTS, RESOURCES };

// Run if executed directly
main().catch(console.error);
