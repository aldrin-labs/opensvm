#!/usr/bin/env bun
/**
 * MCP Server for Prediction Market Metadata API
 *
 * This server implements a Model Context Protocol (MCP) interface to the
 * Prediction Market Metadata API defined in llms_dflow.json.
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

/**
 * Configuration schema for Smithery
 * Exported for automatic discovery by @smithery/cli
 */
export const configSchema = z.object({
  apiUrl: z.string()
    .describe('Base URL for the Prediction Market Metadata API')
    .default('https://prediction-markets-api.dflow.net'),
  requestTimeout: z.number()
    .describe('Timeout for API requests in milliseconds')
    .default(30000),
});

// API Configuration
const BASE_URL = 'https://prediction-markets-api.dflow.net';
const DEFAULT_TIMEOUT = 30000; // 30 seconds

class DFlowAPIClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string = BASE_URL, timeout: number = DEFAULT_TIMEOUT) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeout = timeout;
  }

  private makeUrl(path: string): string {
    return `${this.baseUrl}${path.startsWith('/') ? path : '/' + path}`;
  }

  async request(method: string, path: string, options: RequestInit = {}): Promise<any> {
    const url = this.makeUrl(path);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
        ...options,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  async get(path: string, params?: Record<string, any>): Promise<any> {
    const url = new URL(this.makeUrl(path));
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }
    return this.request('GET', url.pathname + url.search);
  }

  async post(path: string, data?: any): Promise<any> {
    return this.request('POST', path, {
      body: data ? JSON.stringify(data) : undefined,
    });
  }
}

// Configuration schema for Smithery
interface ServerConfig {
  apiUrl?: string;
  requestTimeout?: number;
}

// Factory function for Smithery compatibility
function createServer(config?: ServerConfig) {
  const apiClient = new DFlowAPIClient(
    config?.apiUrl || BASE_URL,
    config?.requestTimeout || DEFAULT_TIMEOUT
  );

  const server = new Server(
    {
      name: 'dflow-mcp-server',
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

// Tool definitions
const TOOLS: Tool[] = [
  // Event endpoints
  {
    name: 'get_event',
    title: 'Get Event Details',
    description: 'Get a single event by ticker. Returns event metadata including series ticker, subtitle, markets, strike information and volume.',
    inputSchema: {
      type: 'object',
      properties: {
        event_id: {
          type: 'string',
          description: 'Event ticker',
        },
        withNestedMarkets: {
          type: 'boolean',
          description: 'Include nested markets (optional)',
        },
      },
      required: ['event_id'],
    },
    annotations: {
      title: 'Get Event Details',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'get_events',
    title: 'Get Events List',
    description: 'Get a paginated list of all events with optional filtering and sorting.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          minimum: 0,
          description: 'Maximum number of events to return',
        },
        cursor: {
          type: 'integer',
          minimum: 0,
          description: 'Pagination cursor',
        },
        withNestedMarkets: {
          type: 'boolean',
          description: 'Include nested markets',
        },
        seriesTickers: {
          type: 'string',
          description: 'Filter by series tickers (comma-separated)',
        },
        isInitialized: {
          type: 'boolean',
          description: 'Filter by initialization status',
        },
        status: {
          type: 'string',
          description: 'Filter by event status',
        },
        sort: {
          type: 'string',
          enum: ['volume', 'volume24h', 'liquidity', 'openInterest', 'startDate'],
          description: 'Sort field',
        },
      },
      required: [],
    },
    annotations: {
      title: 'Get Events List',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },

  // Market endpoints
  {
    name: 'get_market',
    title: 'Get Market Details',
    description: 'Get details of a market by ticker.',
    inputSchema: {
      type: 'object',
      properties: {
        market_id: {
          type: 'string',
          description: 'Market ticker',
        },
      },
      required: ['market_id'],
    },
    annotations: {
      title: 'Get Market Details',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'get_market_by_mint',
    title: 'Get Market by Mint Address',
    description: 'Get a market by looking up its mint address.',
    inputSchema: {
      type: 'object',
      properties: {
        mint_address: {
          type: 'string',
          description: 'Ledger or outcome mint address',
        },
      },
      required: ['mint_address'],
    },
    annotations: {
      title: 'Get Market by Mint Address',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'get_markets',
    title: 'Get Markets List',
    description: 'Get a paginated list of markets with optional filtering.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          minimum: 0,
          description: 'Number of markets to return',
        },
        cursor: {
          type: 'integer',
          minimum: 0,
          description: 'Pagination cursor',
        },
        isInitialized: {
          type: 'boolean',
          description: 'Filter by initialization status',
        },
        status: {
          type: 'string',
          description: 'Filter by status',
        },
        sort: {
          type: 'string',
          enum: ['volume', 'volume24h', 'liquidity', 'openInterest', 'startDate'],
          description: 'Sort field',
        },
      },
      required: [],
    },
    annotations: {
      title: 'Get Markets List',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'get_markets_batch',
    title: 'Get Markets Batch',
    description: 'Get multiple markets by tickers and/or mint addresses (up to 100 results).',
    inputSchema: {
      type: 'object',
      properties: {
        tickers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of market tickers',
        },
        mints: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of mint addresses',
        },
      },
      required: [],
    },
    annotations: {
      title: 'Get Markets Batch',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },

  // Trade endpoints
  {
    name: 'get_trades',
    title: 'Get Trades',
    description: 'Get a paginated list of trades across markets with optional filtering.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          minimum: 0,
          description: 'Number of trades to return',
        },
        cursor: {
          type: 'string',
          description: 'Pagination cursor',
        },
        ticker: {
          type: 'string',
          description: 'Filter by market ticker',
        },
        minTs: {
          type: 'integer',
          minimum: 0,
          description: 'Minimum timestamp filter',
        },
        maxTs: {
          type: 'integer',
          minimum: 0,
          description: 'Maximum timestamp filter',
        },
      },
      required: [],
    },
    annotations: {
      title: 'Get Trades',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'get_trades_by_mint',
    title: 'Get Trades by Mint Address',
    description: 'Get trades for a market identified by a mint address.',
    inputSchema: {
      type: 'object',
      properties: {
        mint_address: {
          type: 'string',
          description: 'Mint address',
        },
        limit: {
          type: 'integer',
          minimum: 0,
          description: 'Number of trades to return',
        },
        cursor: {
          type: 'string',
          description: 'Pagination cursor',
        },
        minTs: {
          type: 'integer',
          minimum: 0,
          description: 'Minimum timestamp filter',
        },
        maxTs: {
          type: 'integer',
          minimum: 0,
          description: 'Maximum timestamp filter',
        },
      },
      required: ['mint_address'],
    },
    annotations: {
      title: 'Get Trades by Mint Address',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },

  // Forecast endpoints
  {
    name: 'get_forecast_percentile_history',
    title: 'Get Forecast Percentile History',
    description: 'Get historical raw and formatted forecast numbers for an event at specified percentiles.',
    inputSchema: {
      type: 'object',
      properties: {
        series_ticker: {
          type: 'string',
          description: 'Series ticker',
        },
        event_id: {
          type: 'string',
          description: 'Event ticker',
        },
        percentiles: {
          type: 'string',
          description: 'Comma-separated list of percentiles',
        },
        startTs: {
          type: 'integer',
          minimum: 0,
          description: 'Start timestamp',
        },
        endTs: {
          type: 'integer',
          minimum: 0,
          description: 'End timestamp',
        },
        periodInterval: {
          type: 'integer',
          minimum: 0,
          description: 'Sampling interval in seconds',
        },
      },
      required: ['series_ticker', 'event_id', 'percentiles', 'startTs', 'endTs', 'periodInterval'],
    },
    annotations: {
      title: 'Get Forecast Percentile History',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'get_forecast_percentile_history_by_mint',
    title: 'Get Forecast Percentile History by Mint',
    description: 'Get forecast history by looking up an event using a market mint address.',
    inputSchema: {
      type: 'object',
      properties: {
        mint_address: {
          type: 'string',
          description: 'Market mint address',
        },
        percentiles: {
          type: 'string',
          description: 'Comma-separated list of percentiles',
        },
        startTs: {
          type: 'integer',
          minimum: 0,
          description: 'Start timestamp',
        },
        endTs: {
          type: 'integer',
          minimum: 0,
          description: 'End timestamp',
        },
        periodInterval: {
          type: 'integer',
          minimum: 0,
          description: 'Sampling interval in seconds',
        },
      },
      required: ['mint_address', 'percentiles', 'startTs', 'endTs', 'periodInterval'],
    },
    annotations: {
      title: 'Get Forecast Percentile History by Mint',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },

  // Candlestick endpoints
  {
    name: 'get_event_candlesticks',
    title: 'Get Event Candlesticks',
    description: 'Get event candlesticks from the Kalshi API. Resolves series ticker automatically.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Event ticker',
        },
        startTs: {
          type: 'integer',
          minimum: 0,
          description: 'Start timestamp',
        },
        endTs: {
          type: 'integer',
          minimum: 0,
          description: 'End timestamp',
        },
        periodInterval: {
          type: 'integer',
          minimum: 0,
          description: 'Interval size in seconds',
        },
      },
      required: ['ticker', 'startTs', 'endTs', 'periodInterval'],
    },
    annotations: {
      title: 'Get Event Candlesticks',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'get_market_candlesticks',
    title: 'Get Market Candlesticks',
    description: 'Get market candlesticks. Resolves series ticker automatically.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Market ticker',
        },
        startTs: {
          type: 'integer',
          minimum: 0,
          description: 'Start timestamp',
        },
        endTs: {
          type: 'integer',
          minimum: 0,
          description: 'End timestamp',
        },
        periodInterval: {
          type: 'integer',
          minimum: 0,
          description: 'Interval size in seconds',
        },
      },
      required: ['ticker', 'startTs', 'endTs', 'periodInterval'],
    },
    annotations: {
      title: 'Get Market Candlesticks',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'get_market_candlesticks_by_mint',
    title: 'Get Market Candlesticks by Mint',
    description: 'Get candlesticks by looking up a market by mint address.',
    inputSchema: {
      type: 'object',
      properties: {
        mint_address: {
          type: 'string',
          description: 'Mint address',
        },
        startTs: {
          type: 'integer',
          minimum: 0,
          description: 'Start timestamp',
        },
        endTs: {
          type: 'integer',
          minimum: 0,
          description: 'End timestamp',
        },
        periodInterval: {
          type: 'integer',
          minimum: 0,
          description: 'Interval size in seconds',
        },
      },
      required: ['mint_address', 'startTs', 'endTs', 'periodInterval'],
    },
    annotations: {
      title: 'Get Market Candlesticks by Mint',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },

  // Live data endpoints
  {
    name: 'get_live_data',
    title: 'Get Live Data',
    description: 'Get live data from the Kalshi API for specific milestones.',
    inputSchema: {
      type: 'object',
      properties: {
        milestoneIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of milestone IDs',
        },
      },
      required: ['milestoneIds'],
    },
    annotations: {
      title: 'Get Live Data',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'get_live_data_by_event',
    title: 'Get Live Data by Event',
    description: 'Get live data for all milestones of an event.',
    inputSchema: {
      type: 'object',
      properties: {
        event_ticker: {
          type: 'string',
          description: 'Event ticker',
        },
        minimumStartDate: {
          type: 'string',
          description: 'Filter milestones after this date',
        },
        category: {
          type: 'string',
          description: 'Filter by category',
        },
        competition: {
          type: 'string',
          description: 'Filter by competition',
        },
        sourceId: {
          type: 'string',
          description: 'Filter by data source',
        },
        type: {
          type: 'string',
          description: 'Filter by milestone type',
        },
      },
      required: ['event_ticker'],
    },
    annotations: {
      title: 'Get Live Data by Event',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'get_live_data_by_mint',
    title: 'Get Live Data by Mint Address',
    description: 'Get live data by looking up an event from a market mint address.',
    inputSchema: {
      type: 'object',
      properties: {
        mint_address: {
          type: 'string',
          description: 'Mint address',
        },
        minimumStartDate: {
          type: 'string',
          description: 'Filter milestones after this date',
        },
        category: {
          type: 'string',
          description: 'Filter by category',
        },
        competition: {
          type: 'string',
          description: 'Filter by competition',
        },
        sourceId: {
          type: 'string',
          description: 'Filter by data source',
        },
        type: {
          type: 'string',
          description: 'Filter by milestone type',
        },
      },
      required: ['mint_address'],
    },
    annotations: {
      title: 'Get Live Data by Mint Address',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },

  // Series endpoints
  {
    name: 'get_series',
    title: 'Get Series Templates',
    description: 'Get all series templates with optional filtering.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Filter by series category',
        },
        tags: {
          type: 'string',
          description: 'Filter by tags',
        },
        isInitialized: {
          type: 'boolean',
          description: 'Filter by initialization status',
        },
        status: {
          type: 'string',
          description: 'Filter by series status',
        },
      },
      required: [],
    },
    annotations: {
      title: 'Get Series Templates',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'get_series_by_ticker',
    title: 'Get Series by Ticker',
    description: 'Get a single series by its ticker.',
    inputSchema: {
      type: 'object',
      properties: {
        series_ticker: {
          type: 'string',
          description: 'Series ticker',
        },
      },
      required: ['series_ticker'],
    },
    annotations: {
      title: 'Get Series by Ticker',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },

  // Utility endpoints
  {
    name: 'get_outcome_mints',
    title: 'Get Outcome Mints',
    description: 'Get a flat list of yes and no outcome mint pubkeys.',
    inputSchema: {
      type: 'object',
      properties: {
        minCloseTs: {
          type: 'integer',
          minimum: 0,
          description: 'Filter by minimum close timestamp',
        },
      },
      required: [],
    },
    annotations: {
      title: 'Get Outcome Mints',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'filter_outcome_mints',
    title: 'Filter Outcome Mints',
    description: 'Filter a list of addresses and return only outcome mints.',
    inputSchema: {
      type: 'object',
      properties: {
        addresses: {
          type: 'array',
          items: { type: 'string' },
          maxItems: 200,
          description: 'Array of addresses to filter',
        },
      },
      required: ['addresses'],
    },
    annotations: {
      title: 'Filter Outcome Mints',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'get_tags_by_categories',
    title: 'Get Tags by Categories',
    description: 'Get a mapping of series categories to tags.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    annotations: {
      title: 'Get Tags by Categories',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'get_filters_by_sports',
    title: 'Get Filters by Sports',
    description: 'Get filtering options for each sport including scopes and competitions.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    annotations: {
      title: 'Get Filters by Sports',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'search_events',
    title: 'Search Events',
    description: 'Search events with nested markets by title or ticker.',
    inputSchema: {
      type: 'object',
      properties: {
        q: {
          type: 'string',
          description: 'Search query',
        },
        sort: {
          type: 'string',
          enum: ['volume', 'volume24h', 'liquidity', 'openInterest', 'startDate'],
          description: 'Sort field',
        },
        order: {
          type: 'string',
          enum: ['desc', 'asc'],
          description: 'Sort order',
        },
        limit: {
          type: 'integer',
          minimum: 0,
          description: 'Number of results to return',
        },
        cursor: {
          type: 'integer',
          minimum: 0,
          description: 'Pagination cursor',
        },
        withNestedMarkets: {
          type: 'boolean',
          description: 'Include nested markets',
        },
        withMarketAccounts: {
          type: 'boolean',
          description: 'Include market accounts',
        },
      },
      required: ['q'],
    },
    annotations: {
      title: 'Search Events',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
];

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle list prompts request
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: 'analyze_market_trends',
        description: 'Analyze prediction market trends and provide insights on volume, liquidity, and price movements',
        arguments: [
          {
            name: 'market_filter',
            description: 'Filter markets by category (e.g., politics, sports, crypto)',
            required: false,
          },
          {
            name: 'time_range',
            description: 'Time range for analysis (e.g., 24h, 7d, 30d)',
            required: false,
          },
        ],
      },
      {
        name: 'compare_events',
        description: 'Compare multiple prediction market events side-by-side',
        arguments: [
          {
            name: 'event_ids',
            description: 'Comma-separated list of event tickers to compare',
            required: true,
          },
        ],
      },
    ],
  };
});

// Handle get prompt request
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'analyze_market_trends') {
    const filter = args?.market_filter || 'all markets';
    const timeRange = args?.time_range || '24h';
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Analyze prediction market trends for ${filter} over the past ${timeRange}. Use get_events and get_markets tools to gather data, then provide insights on volume trends, liquidity patterns, and notable price movements.`,
          },
        },
      ],
    };
  }

  if (name === 'compare_events') {
    const eventIds = args?.event_ids || '';
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Compare the following prediction market events: ${eventIds}. Use get_event tool for each event and provide a side-by-side comparison of volume, liquidity, markets, and recent activity.`,
          },
        },
      ],
    };
  }

  throw new McpError(ErrorCode.InvalidRequest, `Unknown prompt: ${name}`);
});

// Handle list resources request
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'dflow://api/events',
        name: 'Prediction Market Events',
        description: 'Real-time feed of all prediction market events',
        mimeType: 'application/json',
      },
      {
        uri: 'dflow://api/markets',
        name: 'Active Markets',
        description: 'Currently active prediction markets with live data',
        mimeType: 'application/json',
      },
      {
        uri: 'dflow://api/docs',
        name: 'API Documentation',
        description: 'Complete API documentation and usage examples',
        mimeType: 'text/markdown',
      },
    ],
  };
});

// Handle read resource request
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri === 'dflow://api/events') {
    const events = await apiClient.get('/api/v1/events', { limit: 10 });
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(events, null, 2),
        },
      ],
    };
  }

  if (uri === 'dflow://api/markets') {
    const markets = await apiClient.get('/api/v1/markets', { limit: 10 });
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(markets, null, 2),
        },
      ],
    };
  }

  if (uri === 'dflow://api/docs') {
    const docs = `# DFlow Prediction Market API

## Available Tools
- get_events: Get all events
- get_markets: Get all markets
- get_trades: Get trade history
- And 21 more specialized tools...

## Example Usage
1. List events: get_events with limit parameter
2. Get specific event: get_event with event_id
3. Analyze trades: get_trades with filtering options

For full documentation, visit: https://dflow.opensvm.com
`;
    return {
      contents: [
        {
          uri,
          mimeType: 'text/markdown',
          text: docs,
        },
      ],
    };
  }

  throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
});

// Handle tool call requests
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Ensure args is defined
  const toolArgs = args || {};

  try {
    let result: any;

    // Event endpoints
    switch (name) {
      case 'get_event':
        result = await apiClient.get(`/api/v1/event/${toolArgs.event_id}`, {
          withNestedMarkets: toolArgs.withNestedMarkets,
        });
        break;

      case 'get_events':
        result = await apiClient.get('/api/v1/events', toolArgs);
        break;

      // Market endpoints
      case 'get_market':
        result = await apiClient.get(`/api/v1/market/${toolArgs.market_id}`);
        break;

      case 'get_market_by_mint':
        result = await apiClient.get(`/api/v1/market/by-mint/${toolArgs.mint_address}`);
        break;

      case 'get_markets':
        result = await apiClient.get('/api/v1/markets', toolArgs);
        break;

      case 'get_markets_batch':
        result = await apiClient.post('/api/v1/markets/batch', toolArgs);
        break;

      // Trade endpoints
      case 'get_trades':
        result = await apiClient.get('/api/v1/trades', toolArgs);
        break;

      case 'get_trades_by_mint':
        const { mint_address: trade_mint, ...trade_params } = toolArgs;
        result = await apiClient.get(`/api/v1/trades/by-mint/${trade_mint}`, trade_params);
        break;

      // Forecast endpoints
      case 'get_forecast_percentile_history':
        const { series_ticker, event_id, ...forecast_params } = toolArgs;
        result = await apiClient.get(`/api/v1/event/${series_ticker}/${event_id}/forecast_percentile_history`, forecast_params);
        break;

      case 'get_forecast_percentile_history_by_mint':
        const { mint_address: forecast_mint, ...forecast_mint_params } = toolArgs;
        result = await apiClient.get(`/api/v1/event/by-mint/${forecast_mint}/forecast_percentile_history`, forecast_mint_params);
        break;

      // Candlestick endpoints
      case 'get_event_candlesticks':
        const { ticker: event_ticker, ...event_candle_params } = toolArgs;
        result = await apiClient.get(`/api/v1/event/${event_ticker}/candlesticks`, event_candle_params);
        break;

      case 'get_market_candlesticks':
        const { ticker: market_ticker, ...market_candle_params } = toolArgs;
        result = await apiClient.get(`/api/v1/market/${market_ticker}/candlesticks`, market_candle_params);
        break;

      case 'get_market_candlesticks_by_mint':
        const { mint_address: candle_mint, ...candle_mint_params } = toolArgs;
        result = await apiClient.get(`/api/v1/market/by-mint/${candle_mint}/candlesticks`, candle_mint_params);
        break;

      // Live data endpoints
      case 'get_live_data':
        result = await apiClient.get('/api/v1/live_data', { milestoneIds: toolArgs.milestoneIds });
        break;

      case 'get_live_data_by_event':
        const { event_ticker: live_event_ticker, ...live_event_params } = toolArgs;
        result = await apiClient.get(`/api/v1/live_data/by-event/${live_event_ticker}`, live_event_params);
        break;

      case 'get_live_data_by_mint':
        const { mint_address: live_mint, ...live_mint_params } = toolArgs;
        result = await apiClient.get(`/api/v1/live_data/by-mint/${live_mint}`, live_mint_params);
        break;

      // Series endpoints
      case 'get_series':
        result = await apiClient.get('/api/v1/series', toolArgs);
        break;

      case 'get_series_by_ticker':
        result = await apiClient.get(`/api/v1/series/${toolArgs.series_ticker}`);
        break;

      // Utility endpoints
      case 'get_outcome_mints':
        result = await apiClient.get('/api/v1/outcome_mints', toolArgs);
        break;

      case 'filter_outcome_mints':
        result = await apiClient.post('/api/v1/filter_outcome_mints', toolArgs);
        break;

      case 'get_tags_by_categories':
        result = await apiClient.get('/api/v1/tags_by_categories');
        break;

      case 'get_filters_by_sports':
        result = await apiClient.get('/api/v1/filters_by_sports');
        break;

      case 'search_events':
        result = await apiClient.get('/api/v1/search', toolArgs);
        break;

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error calling ${name}: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

  return server;
}

// Export for Smithery (stateless server factory)
export default function({ config }: { config?: ServerConfig }) {
  return createServer(config);
}

// Also run as STDIO server when executed directly
async function main() {
  const transport = new StdioServerTransport();
  const server = createServer();
  await server.connect(transport);
}

// Handle process termination
process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});

// Start the server if run directly (not imported)
const isMainModule = typeof require !== 'undefined' && require.main === module;
if (isMainModule || process.argv[1]?.endsWith('index.ts')) {
  main().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
}