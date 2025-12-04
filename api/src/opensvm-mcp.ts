#!/usr/bin/env bun
/**
 * OpenSVM MCP Server
 *
 * This server implements a Model Context Protocol (MCP) interface to the
 * OpenSVM Solana Explorer APIs, providing AI agents with tools to explore
 * blockchain data, analyze transactions, and query market information.
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
 */
export const configSchema = z.object({
  apiUrl: z.string()
    .describe('Base URL for the OpenSVM API')
    .default('https://osvm.ai'),
  requestTimeout: z.number()
    .describe('Timeout for API requests in milliseconds')
    .default(30000),
  apiKey: z.string()
    .describe('OpenSVM API key for authenticated requests (optional)')
    .optional(),
});

// API Configuration
const DEFAULT_BASE_URL = 'https://osvm.ai';
const DEFAULT_TIMEOUT = 30000;

class OpenSVMAPIClient {
  private baseUrl: string;
  private timeout: number;
  private apiKey?: string;

  constructor(baseUrl: string = DEFAULT_BASE_URL, timeout: number = DEFAULT_TIMEOUT, apiKey?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeout = timeout;
    this.apiKey = apiKey;
  }

  private makeUrl(path: string): string {
    return `${this.baseUrl}${path.startsWith('/') ? path : '/' + path}`;
  }

  async request(method: string, path: string, options: RequestInit = {}): Promise<any> {
    const url = this.makeUrl(path);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    // Build headers with optional API key
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
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

interface ServerConfig {
  apiUrl?: string;
  requestTimeout?: number;
  apiKey?: string;
}

// Tool definitions for OpenSVM APIs
const TOOLS: Tool[] = [
  // Transaction Tools
  {
    name: 'get_transaction',
    title: 'Get Transaction Details',
    description: 'Get detailed information about a Solana transaction by its signature. Returns instructions, accounts, balances, token changes, and logs.',
    inputSchema: {
      type: 'object',
      properties: {
        signature: {
          type: 'string',
          description: 'The transaction signature (base58 encoded)',
        },
      },
      required: ['signature'],
    },
    annotations: {
      title: 'Get Transaction Details',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'explain_transaction',
    title: 'Explain Transaction',
    description: 'Get an AI-powered explanation of what a transaction does in simple terms.',
    inputSchema: {
      type: 'object',
      properties: {
        signature: {
          type: 'string',
          description: 'The transaction signature to explain',
        },
      },
      required: ['signature'],
    },
    annotations: {
      title: 'Explain Transaction',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'analyze_transaction',
    title: 'Analyze Transaction',
    description: 'Perform deep analysis of a transaction including program interactions, token flows, and patterns.',
    inputSchema: {
      type: 'object',
      properties: {
        signature: {
          type: 'string',
          description: 'The transaction signature to analyze',
        },
      },
      required: ['signature'],
    },
    annotations: {
      title: 'Analyze Transaction',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },

  // Account Tools
  {
    name: 'get_account_portfolio',
    title: 'Get Account Portfolio',
    description: 'Get the portfolio of a Solana account including SOL balance, token balances, and USD values.',
    inputSchema: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'The Solana account address (public key)',
        },
      },
      required: ['address'],
    },
    annotations: {
      title: 'Get Account Portfolio',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'get_account_transactions',
    title: 'Get Account Transactions',
    description: 'Get recent transactions for a Solana account.',
    inputSchema: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'The Solana account address',
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of transactions to return (default: 20)',
          minimum: 1,
          maximum: 100,
        },
      },
      required: ['address'],
    },
    annotations: {
      title: 'Get Account Transactions',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'get_account_stats',
    title: 'Get Account Statistics',
    description: 'Get statistics and analytics for a Solana account.',
    inputSchema: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'The Solana account address',
        },
      },
      required: ['address'],
    },
    annotations: {
      title: 'Get Account Statistics',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },

  // Block Tools
  {
    name: 'get_blocks',
    title: 'Get Recent Blocks',
    description: 'Get a list of recent Solana blocks with transaction counts and fees.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          description: 'Number of blocks to return (default: 10)',
          minimum: 1,
          maximum: 50,
        },
        before: {
          type: 'integer',
          description: 'Get blocks before this slot number',
        },
      },
      required: [],
    },
    annotations: {
      title: 'Get Recent Blocks',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'get_block',
    title: 'Get Block Details',
    description: 'Get detailed information about a specific block by slot number.',
    inputSchema: {
      type: 'object',
      properties: {
        slot: {
          type: 'integer',
          description: 'The slot number of the block',
        },
      },
      required: ['slot'],
    },
    annotations: {
      title: 'Get Block Details',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },

  // Market Data Tools
  {
    name: 'get_token_ohlcv',
    title: 'Get Token OHLCV Data',
    description: 'Get OHLCV (candlestick) data for a token with technical indicators (MA7, MA25, MACD).',
    inputSchema: {
      type: 'object',
      properties: {
        mint: {
          type: 'string',
          description: 'The token mint address',
        },
        type: {
          type: 'string',
          enum: ['1m', '5m', '15m', '1H', '4H', '1D'],
          description: 'Timeframe for candles (default: 1H)',
        },
      },
      required: ['mint'],
    },
    annotations: {
      title: 'Get Token OHLCV Data',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'get_token_markets',
    title: 'Get Token Markets',
    description: 'Get top liquidity pools/markets for a token across DEXes.',
    inputSchema: {
      type: 'object',
      properties: {
        mint: {
          type: 'string',
          description: 'The token mint address',
        },
        baseMint: {
          type: 'string',
          description: 'Filter by base token mint (optional)',
        },
      },
      required: ['mint'],
    },
    annotations: {
      title: 'Get Token Markets',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'get_token_metadata',
    title: 'Get Token Metadata',
    description: 'Get metadata for a Solana token including name, symbol, decimals, and supply.',
    inputSchema: {
      type: 'object',
      properties: {
        mint: {
          type: 'string',
          description: 'The token mint address',
        },
      },
      required: ['mint'],
    },
    annotations: {
      title: 'Get Token Metadata',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },

  // Program Tools
  {
    name: 'get_program',
    title: 'Get Program Info',
    description: 'Get information about a Solana program including IDL if available.',
    inputSchema: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'The program address',
        },
      },
      required: ['address'],
    },
    annotations: {
      title: 'Get Program Info',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },

  // Search & Discovery Tools
  {
    name: 'search',
    title: 'Search Solana',
    description: 'Search for transactions, accounts, tokens, or programs on Solana.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (address, signature, token symbol, etc.)',
        },
      },
      required: ['query'],
    },
    annotations: {
      title: 'Search Solana',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'find_wallet_path',
    title: 'Find Wallet Connection Path',
    description: 'Find the shortest path of token transfers between two wallets.',
    inputSchema: {
      type: 'object',
      properties: {
        sourceWallet: {
          type: 'string',
          description: 'The source wallet address',
        },
        targetWallet: {
          type: 'string',
          description: 'The target wallet address',
        },
        maxDepth: {
          type: 'integer',
          description: 'Maximum search depth (default: 42)',
          minimum: 1,
          maximum: 100,
        },
      },
      required: ['sourceWallet', 'targetWallet'],
    },
    annotations: {
      title: 'Find Wallet Connection Path',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },

  // Analytics Tools
  {
    name: 'get_network_status',
    title: 'Get Network Status',
    description: 'Get current Solana network status including TPS, slot, and health.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    annotations: {
      title: 'Get Network Status',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'get_nft_collections',
    title: 'Get NFT Collections',
    description: 'Get trending or new NFT collections on Solana.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['trending', 'new'],
          description: 'Type of collections to fetch (default: trending)',
        },
      },
      required: [],
    },
    annotations: {
      title: 'Get NFT Collections',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },

  // AI Analysis Tools
  {
    name: 'ask_ai',
    title: 'Ask AI About Solana',
    description: 'Ask the AI assistant questions about Solana transactions, accounts, or general blockchain concepts.',
    inputSchema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'Your question about Solana',
        },
        context: {
          type: 'string',
          description: 'Optional context (e.g., a transaction signature or account address)',
        },
      },
      required: ['question'],
    },
    annotations: {
      title: 'Ask AI About Solana',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },

  // Investigation Agent Tool
  {
    name: 'investigate',
    title: 'Autonomous Blockchain Investigation',
    description: 'Launch an autonomous investigation agent that analyzes a wallet, transaction, or token for suspicious activity. The agent chains multiple tools, detects anomalies, and generates a comprehensive forensics report.',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'The address or signature to investigate (wallet, transaction, token)',
        },
        type: {
          type: 'string',
          enum: ['wallet_forensics', 'transaction_tracing', 'token_flow_analysis', 'anomaly_detection', 'connection_mapping', 'full_investigation'],
          description: 'Type of investigation to perform (default: wallet_forensics)',
        },
        maxDepth: {
          type: 'integer',
          description: 'Maximum depth for connection tracing (default: 3)',
          minimum: 1,
          maximum: 5,
        },
        maxTransactions: {
          type: 'integer',
          description: 'Maximum transactions to analyze (default: 50)',
          minimum: 10,
          maximum: 100,
        },
      },
      required: ['target'],
    },
    annotations: {
      title: 'Autonomous Blockchain Investigation',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },

  // Authentication & Account Tools
  {
    name: 'create_api_key',
    title: 'Create API Key',
    description: 'Create a new OpenSVM API key for authenticated access. The key provides rate limit increases and access to premium features.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'A descriptive name for the API key',
        },
        permissions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Permissions for this key (e.g., ["read:*", "write:transactions"])',
        },
        expiresInDays: {
          type: 'integer',
          description: 'Days until key expires (default: 365)',
          minimum: 1,
          maximum: 365,
        },
      },
      required: ['name'],
    },
    annotations: {
      title: 'Create API Key',
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'list_api_keys',
    title: 'List API Keys',
    description: 'List all API keys associated with the authenticated wallet. Requires API key authentication.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    annotations: {
      title: 'List API Keys',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'get_api_key_metrics',
    title: 'Get API Key Metrics',
    description: 'Get usage metrics for API keys including request counts, response times, and activity logs.',
    inputSchema: {
      type: 'object',
      properties: {
        keyId: {
          type: 'string',
          description: 'The API key ID to get metrics for (optional, defaults to current key)',
        },
      },
      required: [],
    },
    annotations: {
      title: 'Get API Key Metrics',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'check_session',
    title: 'Check Authentication Status',
    description: 'Check if the current session is authenticated and get wallet information.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    annotations: {
      title: 'Check Authentication Status',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'get_user_history',
    title: 'Get User History',
    description: 'Get the transaction and page view history for an authenticated wallet. Requires matching wallet authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        walletAddress: {
          type: 'string',
          description: 'The wallet address to get history for',
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of history items to return (default: 50)',
          minimum: 1,
          maximum: 100,
        },
      },
      required: ['walletAddress'],
    },
    annotations: {
      title: 'Get User History',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'get_user_profile',
    title: 'Get User Profile',
    description: 'Get the public profile for a Solana wallet including social stats and activity.',
    inputSchema: {
      type: 'object',
      properties: {
        walletAddress: {
          type: 'string',
          description: 'The wallet address to get profile for',
        },
      },
      required: ['walletAddress'],
    },
    annotations: {
      title: 'Get User Profile',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'check_svmai_access',
    title: 'Check SVMAI Token Access',
    description: 'Check if a wallet has sufficient SVMAI tokens (100,000) for premium features.',
    inputSchema: {
      type: 'object',
      properties: {
        walletAddress: {
          type: 'string',
          description: 'The wallet address to check token balance for',
        },
      },
      required: ['walletAddress'],
    },
    annotations: {
      title: 'Check SVMAI Token Access',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
];

function createServer(config?: ServerConfig) {
  const apiClient = new OpenSVMAPIClient(
    config?.apiUrl || DEFAULT_BASE_URL,
    config?.requestTimeout || DEFAULT_TIMEOUT,
    config?.apiKey
  );

  const server = new Server(
    {
      name: 'opensvm-mcp-server',
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

  // Handle list tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  // Handle list prompts request
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: [
        {
          name: 'analyze_wallet',
          description: 'Analyze a Solana wallet including holdings, transaction history, and activity patterns',
          arguments: [
            {
              name: 'address',
              description: 'The wallet address to analyze',
              required: true,
            },
          ],
        },
        {
          name: 'investigate_transaction',
          description: 'Deep investigation of a transaction including related transactions and flow analysis',
          arguments: [
            {
              name: 'signature',
              description: 'The transaction signature to investigate',
              required: true,
            },
          ],
        },
        {
          name: 'token_analysis',
          description: 'Comprehensive analysis of a token including price, liquidity, and trading activity',
          arguments: [
            {
              name: 'mint',
              description: 'The token mint address',
              required: true,
            },
          ],
        },
        {
          name: 'find_connection',
          description: 'Find if and how two wallets are connected through token transfers',
          arguments: [
            {
              name: 'wallet_a',
              description: 'First wallet address',
              required: true,
            },
            {
              name: 'wallet_b',
              description: 'Second wallet address',
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

    if (name === 'analyze_wallet') {
      const address = args?.address || '';
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Analyze the Solana wallet at address: ${address}

Please use the following tools in sequence:
1. get_account_portfolio - to get current holdings and balances
2. get_account_stats - to get account statistics
3. get_account_transactions - to see recent activity

Provide a comprehensive analysis including:
- Current portfolio value and composition
- Notable tokens held
- Recent transaction patterns
- Any interesting observations`,
            },
          },
        ],
      };
    }

    if (name === 'investigate_transaction') {
      const signature = args?.signature || '';
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Investigate the Solana transaction: ${signature}

Please use the following tools:
1. get_transaction - to get full transaction details
2. explain_transaction - to get an AI explanation
3. analyze_transaction - for deep analysis

Provide a detailed investigation including:
- What the transaction does
- Programs involved
- Token/SOL transfers
- Any notable patterns or concerns`,
            },
          },
        ],
      };
    }

    if (name === 'token_analysis') {
      const mint = args?.mint || '';
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Analyze the Solana token with mint: ${mint}

Please use the following tools:
1. get_token_metadata - to get token information
2. get_token_markets - to find trading pools
3. get_token_ohlcv - to get price data with indicators

Provide analysis including:
- Token details (name, symbol, supply)
- Price and market data
- Liquidity across DEXes
- Technical indicator signals`,
            },
          },
        ],
      };
    }

    if (name === 'find_connection') {
      const walletA = args?.wallet_a || '';
      const walletB = args?.wallet_b || '';
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Find the connection between two Solana wallets:
- Wallet A: ${walletA}
- Wallet B: ${walletB}

Use the find_wallet_path tool to discover if these wallets are connected through token transfers.
Then analyze the connection path if found.`,
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
          uri: 'opensvm://network/status',
          name: 'Solana Network Status',
          description: 'Current Solana network status and health',
          mimeType: 'application/json',
        },
        {
          uri: 'opensvm://blocks/recent',
          name: 'Recent Blocks',
          description: 'List of recent Solana blocks',
          mimeType: 'application/json',
        },
        {
          uri: 'opensvm://docs',
          name: 'OpenSVM API Documentation',
          description: 'Documentation for the OpenSVM API',
          mimeType: 'text/markdown',
        },
      ],
    };
  });

  // Handle read resource request
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    if (uri === 'opensvm://network/status') {
      const status = await apiClient.get('/api/status');
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(status, null, 2),
          },
        ],
      };
    }

    if (uri === 'opensvm://blocks/recent') {
      const blocks = await apiClient.get('/api/blocks', { limit: 10 });
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(blocks, null, 2),
          },
        ],
      };
    }

    if (uri === 'opensvm://docs') {
      const docs = `# OpenSVM API Documentation

## Overview
OpenSVM is a Solana blockchain explorer with AI-powered analytics.

## Available Tools

### Transaction Tools
- **get_transaction**: Get full transaction details by signature
- **explain_transaction**: Get AI explanation of a transaction
- **analyze_transaction**: Deep analysis of transaction patterns

### Account Tools
- **get_account_portfolio**: Get wallet holdings and values
- **get_account_transactions**: Get recent account activity
- **get_account_stats**: Get account statistics

### Block Tools
- **get_blocks**: Get recent blocks
- **get_block**: Get specific block by slot

### Market Data Tools
- **get_token_ohlcv**: Get candlestick data with indicators
- **get_token_markets**: Get DEX pools for a token
- **get_token_metadata**: Get token information

### Search & Discovery
- **search**: Search for anything on Solana
- **find_wallet_path**: Find connection between wallets

### Analytics
- **get_network_status**: Network health and stats
- **get_nft_collections**: Trending NFT collections

## Example Usage

\`\`\`
# Get transaction details
get_transaction({ signature: "5J7H..." })

# Analyze a wallet
get_account_portfolio({ address: "EPjFW..." })

# Get token price data
get_token_ohlcv({ mint: "DezXA...", type: "1H" })
\`\`\`

For more information, visit: https://osvm.ai
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
    const toolArgs = args || {};

    try {
      let result: any;

      switch (name) {
        // Transaction Tools
        case 'get_transaction':
          result = await apiClient.get(`/api/transaction/${toolArgs.signature}`);
          break;

        case 'explain_transaction':
          result = await apiClient.get(`/api/transaction/${toolArgs.signature}/explain`);
          break;

        case 'analyze_transaction':
          result = await apiClient.get(`/api/transaction/${toolArgs.signature}/analysis`);
          break;

        // Account Tools
        case 'get_account_portfolio':
          result = await apiClient.get(`/api/account-portfolio/${toolArgs.address}`);
          break;

        case 'get_account_transactions':
          result = await apiClient.get(`/api/account-transactions/${toolArgs.address}`, {
            limit: toolArgs.limit,
          });
          break;

        case 'get_account_stats':
          result = await apiClient.get(`/api/account-stats/${toolArgs.address}`);
          break;

        // Block Tools
        case 'get_blocks':
          result = await apiClient.get('/api/blocks', {
            limit: toolArgs.limit,
            before: toolArgs.before,
          });
          break;

        case 'get_block':
          result = await apiClient.get(`/api/blocks/${toolArgs.slot}`);
          break;

        // Market Data Tools
        case 'get_token_ohlcv':
          result = await apiClient.get('/api/market-data', {
            endpoint: 'ohlcv',
            mint: toolArgs.mint,
            type: toolArgs.type || '1H',
          });
          break;

        case 'get_token_markets':
          result = await apiClient.get('/api/market-data', {
            endpoint: 'markets',
            mint: toolArgs.mint,
            baseMint: toolArgs.baseMint,
          });
          break;

        case 'get_token_metadata':
          result = await apiClient.get('/api/token-metadata', {
            mint: toolArgs.mint,
          });
          break;

        // Program Tools
        case 'get_program':
          result = await apiClient.get(`/api/program/${toolArgs.address}`);
          break;

        // Search & Discovery
        case 'search':
          result = await apiClient.get('/api/search-suggestions', {
            q: toolArgs.query,
          });
          break;

        case 'find_wallet_path':
          result = await apiClient.post('/api/wallet-path-finding', {
            sourceWallet: toolArgs.sourceWallet,
            targetWallet: toolArgs.targetWallet,
            maxDepth: toolArgs.maxDepth,
          });
          break;

        // Analytics
        case 'get_network_status':
          result = await apiClient.get('/api/status');
          break;

        case 'get_nft_collections':
          const endpoint = toolArgs.type === 'new' ? '/api/nft-collections/new' : '/api/nft-collections/trending';
          result = await apiClient.get(endpoint);
          break;

        // AI Analysis
        case 'ask_ai':
          result = await apiClient.post('/api/getAnswer', {
            question: toolArgs.question,
            context: toolArgs.context,
          });
          break;

        // Investigation Agent
        case 'investigate':
          result = await apiClient.post('/api/investigate', {
            target: toolArgs.target,
            type: toolArgs.type || 'wallet_forensics',
            config: {
              maxDepth: toolArgs.maxDepth || 3,
              maxTransactions: toolArgs.maxTransactions || 50,
            },
          });
          break;

        // Authentication & Account Tools
        case 'create_api_key':
          result = await apiClient.post('/api/auth/api-keys/create', {
            name: toolArgs.name,
            permissions: toolArgs.permissions || ['read:*'],
            expiresInDays: toolArgs.expiresInDays || 365,
          });
          break;

        case 'list_api_keys':
          result = await apiClient.get('/api/auth/api-keys/list');
          break;

        case 'get_api_key_metrics':
          result = await apiClient.get('/api/auth/api-keys/metrics', {
            keyId: toolArgs.keyId,
          });
          break;

        case 'check_session':
          result = await apiClient.get('/api/auth/session');
          break;

        case 'get_user_history':
          result = await apiClient.get(`/api/user-history/${toolArgs.walletAddress}`, {
            limit: toolArgs.limit || 50,
          });
          break;

        case 'get_user_profile':
          result = await apiClient.get(`/api/user-profile/${toolArgs.walletAddress}`);
          break;

        case 'check_svmai_access':
          result = await apiClient.get('/api/check-token', {
            address: toolArgs.walletAddress,
          });
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

// Export for Smithery
export default function({ config }: { config?: ServerConfig }) {
  return createServer(config);
}

// Run as STDIO server when executed directly
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

// Start the server if run directly
const isMainModule = typeof require !== 'undefined' && require.main === module;
if (isMainModule || process.argv[1]?.endsWith('opensvm-mcp.ts')) {
  main().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
}
