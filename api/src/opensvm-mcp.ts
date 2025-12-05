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

import {
  advancedMCP,
  compressResult,
  parsePipeline,
  executePipeline,
  extractAuthContext,
  saveCheckpoint,
  loadCheckpoint,
  listCheckpoints,
  executeBatch,
  getToolVersions,
  getTemplate,
  listTemplates,
  INVESTIGATION_TEMPLATES,
  type BatchRequest,
  type AuthContext,
} from './mcp-advanced.js';

import { analytics } from './mcp-analytics.js';

// New MCP modules (v2.1)
import { getCache, withCache, type MCPCache } from './mcp-cache.js';
import { getMetering, withMetering, type MeteringService } from './mcp-metering.js';
import { getWebhooks, EVENT_TEMPLATES, type WebhookManager } from './mcp-webhooks.js';
import { generateFromUrl, generateFromSpec, createExecutor, type GeneratedMCPServer } from './mcp-openapi-generator.js';
import { MultiAgentOrchestrator, INVESTIGATION_TEMPLATES as MULTI_AGENT_TEMPLATES, AGENT_ROLES } from './mcp-multi-agent.js';
import { getMemory, type MemoryStore } from './mcp-memory.js';
import {
  FederationNetwork,
  TrustCalculator,
  createFederationNetwork,
  getFederationNetwork,
  type FederatedServer,
  type FederatedTool,
} from './mcp-federation.js';

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

  // ============================================================================
  // ADVANCED MCP TOOLS (v2.0)
  // ============================================================================

  // Batch Execution
  {
    name: 'batch_execute',
    title: 'Batch Execute Tools',
    description: 'Execute multiple tool calls in parallel for faster results. Returns results in same order as requests. Use this when you need to fetch data for multiple addresses or perform parallel lookups.',
    inputSchema: {
      type: 'object',
      properties: {
        requests: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Unique ID for this request' },
              tool: { type: 'string', description: 'Tool name to execute' },
              params: { type: 'object', description: 'Tool parameters' },
            },
            required: ['id', 'tool'],
          },
          description: 'Array of tool calls to execute in parallel',
        },
        maxConcurrency: {
          type: 'integer',
          description: 'Maximum parallel requests (default: 5, max: 10)',
          minimum: 1,
          maximum: 10,
        },
      },
      required: ['requests'],
    },
    annotations: {
      title: 'Batch Execute Tools',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },

  // Pipeline Execution
  {
    name: 'execute_pipeline',
    title: 'Execute Tool Pipeline',
    description: `Execute a tool pipeline defined in YAML DSL. Chain tools with filters, maps, and variable references.

Example pipeline:
\`\`\`yaml
name: whale_analysis
- tool: get_account_portfolio
  params:
    address: $target
  as: portfolio
- tool: get_account_transactions
  params:
    address: $target
    limit: 50
  filter: item.solTransferred > 10
  as: large_txs
output: { portfolio: ctx.portfolio, largeTxs: ctx.large_txs }
\`\`\``,
    inputSchema: {
      type: 'object',
      properties: {
        pipeline: {
          type: 'string',
          description: 'Pipeline definition in YAML format',
        },
        context: {
          type: 'object',
          description: 'Initial context variables (e.g., { target: "wallet_address" })',
        },
      },
      required: ['pipeline'],
    },
    annotations: {
      title: 'Execute Tool Pipeline',
      readOnlyHint: true,
      idempotentHint: false,
      openWorldHint: true,
      destructiveHint: false,
    },
  },

  // Investigation Checkpoints
  {
    name: 'save_checkpoint',
    title: 'Save Investigation Checkpoint',
    description: 'Save current investigation state as a checkpoint for later resumption. Useful for long-running forensic investigations.',
    inputSchema: {
      type: 'object',
      properties: {
        investigationId: {
          type: 'string',
          description: 'The investigation ID to checkpoint',
        },
        state: {
          type: 'object',
          description: 'Investigation state to save',
        },
        metadata: {
          type: 'object',
          properties: {
            target: { type: 'string' },
            type: { type: 'string' },
            progress: { type: 'number' },
          },
          description: 'Metadata about the investigation',
        },
      },
      required: ['investigationId', 'state'],
    },
    annotations: {
      title: 'Save Investigation Checkpoint',
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'load_checkpoint',
    title: 'Load Investigation Checkpoint',
    description: 'Load a saved investigation checkpoint to resume analysis from where you left off.',
    inputSchema: {
      type: 'object',
      properties: {
        checkpointId: {
          type: 'string',
          description: 'The checkpoint or investigation ID to load',
        },
      },
      required: ['checkpointId'],
    },
    annotations: {
      title: 'Load Investigation Checkpoint',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'list_checkpoints',
    title: 'List Investigation Checkpoints',
    description: 'List all saved investigation checkpoints with their metadata.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    annotations: {
      title: 'List Investigation Checkpoints',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },

  // Template-based Investigation
  {
    name: 'investigate_with_template',
    title: 'Investigate with Template',
    description: `Run an investigation using a pre-configured template:
- **quick_scan**: Fast 10-30s overview, 20 transactions, basic risk assessment
- **deep_dive**: Comprehensive 2-5min analysis, 50 transactions, connection mapping
- **forensic**: Full 5-15min forensics, 100 transactions, maximum depth`,
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'Address or signature to investigate',
        },
        template: {
          type: 'string',
          enum: ['quick_scan', 'deep_dive', 'forensic'],
          description: 'Investigation template to use',
        },
        type: {
          type: 'string',
          enum: ['wallet_forensics', 'transaction_tracing', 'token_flow_analysis', 'anomaly_detection', 'connection_mapping', 'full_investigation'],
          description: 'Type of investigation (default: wallet_forensics)',
        },
      },
      required: ['target', 'template'],
    },
    annotations: {
      title: 'Investigate with Template',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },

  // List Templates
  {
    name: 'list_investigation_templates',
    title: 'List Investigation Templates',
    description: 'List available investigation templates with their configurations, estimated durations, and use cases.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    annotations: {
      title: 'List Investigation Templates',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },

  // Context Compression
  {
    name: 'compress_result',
    title: 'Compress Result',
    description: 'Compress large API results into AI-friendly summaries. Reduces 500 transactions to a 2KB structured summary that preserves key insights.',
    inputSchema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          description: 'The data to compress (transactions, tokens, portfolio, etc.)',
        },
        maxTokens: {
          type: 'integer',
          description: 'Target max tokens for output (default: 2000)',
        },
      },
      required: ['data'],
    },
    annotations: {
      title: 'Compress Result',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },

  // Tool Versioning
  {
    name: 'get_tool_versions',
    title: 'Get Tool Versions',
    description: 'Get version history and changelog for a tool. See what features were added in each version.',
    inputSchema: {
      type: 'object',
      properties: {
        toolName: {
          type: 'string',
          description: 'Name of the tool to get versions for',
        },
      },
      required: ['toolName'],
    },
    annotations: {
      title: 'Get Tool Versions',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },

  // ============================================================================
  // NEW MCP FEATURES (v2.1)
  // ============================================================================

  // Cache Management
  {
    name: 'get_cache_stats',
    title: 'Get Cache Statistics',
    description: 'Get cache performance statistics including hit rate, memory usage, and per-tool metrics.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    annotations: {
      title: 'Get Cache Statistics',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'clear_cache',
    title: 'Clear Cache',
    description: 'Clear the tool response cache. Optionally clear only for a specific tool.',
    inputSchema: {
      type: 'object',
      properties: {
        tool: {
          type: 'string',
          description: 'Tool name to clear cache for (optional, clears all if not specified)',
        },
      },
      required: [],
    },
    annotations: {
      title: 'Clear Cache',
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: false,
      destructiveHint: false,
    },
  },

  // Metering & Billing
  {
    name: 'get_usage',
    title: 'Get Usage Statistics',
    description: 'Get your API usage statistics including calls, costs, and remaining quota.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID to get usage for (defaults to current user)',
        },
        period: {
          type: 'string',
          enum: ['hourly', 'daily', 'weekly', 'monthly'],
          description: 'Time period for the report (default: daily)',
        },
      },
      required: [],
    },
    annotations: {
      title: 'Get Usage Statistics',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'get_pricing',
    title: 'Get Tool Pricing',
    description: 'Get pricing information for tools including cost per call and free tier allowances.',
    inputSchema: {
      type: 'object',
      properties: {
        tool: {
          type: 'string',
          description: 'Tool name to get pricing for (optional, returns all if not specified)',
        },
      },
      required: [],
    },
    annotations: {
      title: 'Get Tool Pricing',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },

  // Webhook Management
  {
    name: 'create_webhook',
    title: 'Create Webhook',
    description: 'Create a webhook subscription to receive notifications for blockchain events. Example: "Notify me when wallet X receives > 100 SOL".',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name for this webhook subscription',
        },
        eventTypes: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['wallet.transaction', 'wallet.sol_received', 'wallet.sol_sent', 'wallet.token_received', 'wallet.token_sent', 'token.price_change', 'token.large_transfer', 'investigation.anomaly', 'investigation.complete'],
          },
          description: 'Event types to subscribe to',
        },
        targets: {
          type: 'array',
          items: { type: 'string' },
          description: 'Wallet addresses or token mints to monitor',
        },
        conditions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              field: { type: 'string' },
              operator: { type: 'string', enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains'] },
              value: {},
            },
          },
          description: 'Filter conditions (e.g., { field: "amount", operator: "gt", value: 100 })',
        },
        delivery: {
          type: 'object',
          properties: {
            method: { type: 'string', enum: ['http', 'slack', 'discord', 'telegram'] },
            url: { type: 'string' },
          },
          description: 'Delivery configuration (method and URL)',
        },
      },
      required: ['name', 'eventTypes', 'targets', 'delivery'],
    },
    annotations: {
      title: 'Create Webhook',
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'list_webhooks',
    title: 'List Webhooks',
    description: 'List all your webhook subscriptions with their status and statistics.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID (defaults to current user)',
        },
      },
      required: [],
    },
    annotations: {
      title: 'List Webhooks',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'delete_webhook',
    title: 'Delete Webhook',
    description: 'Delete a webhook subscription.',
    inputSchema: {
      type: 'object',
      properties: {
        webhookId: {
          type: 'string',
          description: 'ID of the webhook to delete',
        },
      },
      required: ['webhookId'],
    },
    annotations: {
      title: 'Delete Webhook',
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: false,
      destructiveHint: true,
    },
  },
  {
    name: 'list_webhook_events',
    title: 'List Webhook Event Types',
    description: 'List all available webhook event types with descriptions and example payloads.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    annotations: {
      title: 'List Webhook Event Types',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },

  // OpenAPI Generator
  {
    name: 'generate_mcp_from_openapi',
    title: 'Generate MCP from OpenAPI',
    description: 'Generate MCP tools from an OpenAPI/Swagger specification URL. Instantly wrap any REST API as MCP tools.',
    inputSchema: {
      type: 'object',
      properties: {
        specUrl: {
          type: 'string',
          description: 'URL to OpenAPI/Swagger spec (JSON)',
        },
        config: {
          type: 'object',
          properties: {
            toolPrefix: { type: 'string', description: 'Prefix for generated tool names' },
            includeTags: { type: 'array', items: { type: 'string' }, description: 'Only include operations with these tags' },
            excludeTags: { type: 'array', items: { type: 'string' }, description: 'Exclude operations with these tags' },
          },
          description: 'Generator configuration options',
        },
      },
      required: ['specUrl'],
    },
    annotations: {
      title: 'Generate MCP from OpenAPI',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },

  // Multi-Agent Investigation
  {
    name: 'multi_agent_investigate',
    title: 'Multi-Agent Investigation',
    description: 'Launch a multi-agent investigation with parallel agent execution. 10x faster than single-agent for complex forensics.',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'Address or signature to investigate',
        },
        template: {
          type: 'string',
          enum: ['quick_scan', 'standard', 'deep_dive', 'forensic'],
          description: 'Investigation template (default: standard)',
        },
        config: {
          type: 'object',
          properties: {
            maxAgents: { type: 'integer', minimum: 2, maximum: 10 },
            maxDepth: { type: 'integer', minimum: 1, maximum: 5 },
            parallelism: { type: 'integer', minimum: 1, maximum: 5 },
            autoSpawnFollowUp: { type: 'boolean' },
          },
          description: 'Advanced configuration options',
        },
      },
      required: ['target'],
    },
    annotations: {
      title: 'Multi-Agent Investigation',
      readOnlyHint: true,
      idempotentHint: false,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'get_investigation_status',
    title: 'Get Investigation Status',
    description: 'Get the status and progress of a multi-agent investigation.',
    inputSchema: {
      type: 'object',
      properties: {
        investigationId: {
          type: 'string',
          description: 'Investigation ID to check',
        },
      },
      required: ['investigationId'],
    },
    annotations: {
      title: 'Get Investigation Status',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'list_agent_roles',
    title: 'List Agent Roles',
    description: 'List all available investigation agent roles with their capabilities and tools.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    annotations: {
      title: 'List Agent Roles',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },

  // Memory/Context Persistence
  {
    name: 'remember',
    title: 'Store Memory',
    description: 'Store information in long-term memory for future reference. Memories are searchable semantically.',
    inputSchema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'Information to remember',
        },
        type: {
          type: 'string',
          enum: ['investigation', 'finding', 'entity', 'relationship', 'knowledge'],
          description: 'Type of memory (default: knowledge)',
        },
        metadata: {
          type: 'object',
          description: 'Additional metadata (tags, target address, etc.)',
        },
        importance: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          description: 'Importance score (affects retrieval and retention, default: 50)',
        },
      },
      required: ['content'],
    },
    annotations: {
      title: 'Store Memory',
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'recall',
    title: 'Search Memory',
    description: 'Search memories semantically. Use natural language to find relevant past investigations, findings, and knowledge.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language search query',
        },
        types: {
          type: 'array',
          items: { type: 'string', enum: ['investigation', 'finding', 'entity', 'relationship', 'knowledge'] },
          description: 'Filter by memory types',
        },
        target: {
          type: 'string',
          description: 'Filter by target address',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 50,
          description: 'Maximum results (default: 10)',
        },
      },
      required: [],
    },
    annotations: {
      title: 'Search Memory',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'get_investigation_context',
    title: 'Get Investigation Context',
    description: 'Get all relevant context for investigating a target, including previous investigations, findings, and known entities.',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'Target address to get context for',
        },
      },
      required: ['target'],
    },
    annotations: {
      title: 'Get Investigation Context',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'get_memory_stats',
    title: 'Get Memory Statistics',
    description: 'Get statistics about stored memories including counts by type and storage usage.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    annotations: {
      title: 'Get Memory Statistics',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },

  // ==========================================================================
  // Federation Tools
  // ==========================================================================

  {
    name: 'federation_list_servers',
    title: 'List Federated Servers',
    description: 'List all servers in the federation network with their tools and trust scores.',
    inputSchema: {
      type: 'object',
      properties: {
        minTrust: {
          type: 'number',
          description: 'Minimum trust score to include (0-100, default: 20)',
        },
        category: {
          type: 'string',
          description: 'Filter by tool category',
        },
        limit: {
          type: 'number',
          description: 'Maximum results (default: 50)',
        },
      },
      required: [],
    },
    annotations: {
      title: 'List Federated Servers',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'federation_search_tools',
    title: 'Search Federation Tools',
    description: 'Search for tools across all federated servers. Find the best tool for any task.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query to find tools by name or description',
        },
        category: {
          type: 'string',
          description: 'Filter by tool category',
        },
        minTrust: {
          type: 'number',
          description: 'Minimum server trust score (default: 20)',
        },
        limit: {
          type: 'number',
          description: 'Maximum results (default: 50)',
        },
      },
      required: ['query'],
    },
    annotations: {
      title: 'Search Federation Tools',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'federation_call_tool',
    title: 'Call Federated Tool',
    description: 'Call a tool on a remote federated server. Automatically selects best server if not specified.',
    inputSchema: {
      type: 'object',
      properties: {
        tool: {
          type: 'string',
          description: 'Name of the tool to call',
        },
        params: {
          type: 'object',
          description: 'Parameters to pass to the tool',
        },
        serverId: {
          type: 'string',
          description: 'Specific server ID to call (optional, auto-selects if not provided)',
        },
      },
      required: ['tool', 'params'],
    },
    annotations: {
      title: 'Call Federated Tool',
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'federation_register_server',
    title: 'Register Server in Federation',
    description: 'Register a new MCP server in the federation network.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Server name',
        },
        description: {
          type: 'string',
          description: 'Server description',
        },
        endpoint: {
          type: 'string',
          description: 'Server base URL',
        },
        owner: {
          type: 'string',
          description: 'Owner wallet address',
        },
        tools: {
          type: 'array',
          description: 'Array of tool definitions',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              category: { type: 'string' },
              inputSchema: { type: 'object' },
            },
          },
        },
      },
      required: ['name', 'endpoint', 'owner', 'tools'],
    },
    annotations: {
      title: 'Register Server in Federation',
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'federation_get_server',
    title: 'Get Federated Server Details',
    description: 'Get detailed information about a specific federated server including tools and trust metrics.',
    inputSchema: {
      type: 'object',
      properties: {
        serverId: {
          type: 'string',
          description: 'Server ID to look up',
        },
      },
      required: ['serverId'],
    },
    annotations: {
      title: 'Get Federated Server Details',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'federation_report_server',
    title: 'Report Federated Server',
    description: 'Report a federated server for abuse or policy violations.',
    inputSchema: {
      type: 'object',
      properties: {
        serverId: {
          type: 'string',
          description: 'Server ID to report',
        },
        reason: {
          type: 'string',
          description: 'Reason for the report',
        },
        category: {
          type: 'string',
          enum: ['spam', 'malicious', 'impersonation', 'low_quality', 'unavailable', 'tos_violation', 'other'],
          description: 'Report category',
        },
      },
      required: ['serverId', 'reason'],
    },
    annotations: {
      title: 'Report Federated Server',
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'federation_network_stats',
    title: 'Get Federation Network Stats',
    description: 'Get statistics about the entire federation network.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    annotations: {
      title: 'Get Federation Network Stats',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },

  // ============================================================================
  // BANK & PORTFOLIO MANAGEMENT TOOLS
  // ============================================================================

  {
    name: 'bank_list_wallets',
    title: 'List Bank Wallets',
    description: 'List all managed wallets in the SVM Bank for the authenticated user. Returns wallet addresses, names, and balances.',
    inputSchema: {
      type: 'object',
      properties: {
        userWallet: {
          type: 'string',
          description: 'The primary wallet address of the user (required for authentication)',
        },
      },
      required: ['userWallet'],
    },
    annotations: {
      title: 'List Bank Wallets',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'bank_get_portfolio',
    title: 'Get Bank Portfolio Summary',
    description: 'Get a comprehensive portfolio summary across all managed wallets including total value, SOL holdings, token distribution, and analytics.',
    inputSchema: {
      type: 'object',
      properties: {
        userWallet: {
          type: 'string',
          description: 'The primary wallet address of the user',
        },
      },
      required: ['userWallet'],
    },
    annotations: {
      title: 'Get Bank Portfolio Summary',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'bank_create_wallet',
    title: 'Create Bank Wallet',
    description: 'Create a new managed wallet in the SVM Bank. The wallet will be encrypted and linked to the user\'s primary wallet.',
    inputSchema: {
      type: 'object',
      properties: {
        userWallet: {
          type: 'string',
          description: 'The primary wallet address of the user',
        },
        name: {
          type: 'string',
          description: 'Name for the new wallet (e.g., "Trading", "DCA", "Savings")',
        },
      },
      required: ['userWallet', 'name'],
    },
    annotations: {
      title: 'Create Bank Wallet',
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'bank_refresh_balances',
    title: 'Refresh Bank Balances',
    description: 'Refresh balances and token holdings for all managed wallets. Fetches latest on-chain data.',
    inputSchema: {
      type: 'object',
      properties: {
        userWallet: {
          type: 'string',
          description: 'The primary wallet address of the user',
        },
      },
      required: ['userWallet'],
    },
    annotations: {
      title: 'Refresh Bank Balances',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },

  // DCA (Dollar Cost Averaging) Tools
  {
    name: 'bank_list_dca_orders',
    title: 'List DCA Orders',
    description: 'List all Dollar Cost Averaging orders for the user. DCA allows automated periodic token purchases.',
    inputSchema: {
      type: 'object',
      properties: {
        userWallet: {
          type: 'string',
          description: 'The primary wallet address of the user',
        },
      },
      required: ['userWallet'],
    },
    annotations: {
      title: 'List DCA Orders',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'bank_create_dca_order',
    title: 'Create DCA Order',
    description: 'Create a new Dollar Cost Averaging order to automatically purchase tokens at regular intervals.',
    inputSchema: {
      type: 'object',
      properties: {
        userWallet: {
          type: 'string',
          description: 'The primary wallet address of the user',
        },
        walletId: {
          type: 'string',
          description: 'The ID of the managed wallet to use for DCA',
        },
        inputMint: {
          type: 'string',
          description: 'Token mint address to spend (e.g., USDC)',
        },
        outputMint: {
          type: 'string',
          description: 'Token mint address to buy (e.g., SOL)',
        },
        amountPerSwap: {
          type: 'number',
          description: 'Amount to spend per swap in input token units',
        },
        frequency: {
          type: 'string',
          enum: ['hourly', 'daily', 'weekly', 'monthly'],
          description: 'How often to execute the DCA',
        },
        totalBudget: {
          type: 'number',
          description: 'Total budget limit (optional)',
        },
        maxSwaps: {
          type: 'integer',
          description: 'Maximum number of swaps (optional)',
        },
      },
      required: ['userWallet', 'walletId', 'inputMint', 'outputMint', 'amountPerSwap', 'frequency'],
    },
    annotations: {
      title: 'Create DCA Order',
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: false,
      destructiveHint: false,
    },
  },

  // Conditional Triggers Tools
  {
    name: 'bank_list_triggers',
    title: 'List Conditional Triggers',
    description: 'List all conditional triggers for automated trading based on price, balance, or time conditions.',
    inputSchema: {
      type: 'object',
      properties: {
        userWallet: {
          type: 'string',
          description: 'The primary wallet address of the user',
        },
      },
      required: ['userWallet'],
    },
    annotations: {
      title: 'List Conditional Triggers',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'bank_create_trigger',
    title: 'Create Conditional Trigger',
    description: 'Create a conditional trigger that executes actions (transfer, swap, webhook) when conditions are met (price thresholds, balance changes, time windows).',
    inputSchema: {
      type: 'object',
      properties: {
        userWallet: {
          type: 'string',
          description: 'The primary wallet address of the user',
        },
        name: {
          type: 'string',
          description: 'Name for the trigger',
        },
        conditions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['price_above', 'price_below', 'price_change_percent', 'balance_above', 'balance_below', 'time_window'],
              },
              tokenMint: { type: 'string' },
              priceThreshold: { type: 'number' },
              percentChange: { type: 'number' },
              timeWindowMinutes: { type: 'integer' },
              walletId: { type: 'string' },
              balanceThreshold: { type: 'number' },
            },
            required: ['type'],
          },
          description: 'Conditions that must all be true to trigger (AND logic)',
        },
        actions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['transfer', 'swap', 'webhook', 'notification'],
              },
              fromWalletId: { type: 'string' },
              toAddress: { type: 'string' },
              amount: { type: 'number' },
              inputMint: { type: 'string' },
              outputMint: { type: 'string' },
              webhookUrl: { type: 'string' },
            },
            required: ['type'],
          },
          description: 'Actions to execute when conditions are met',
        },
        executeOnce: {
          type: 'boolean',
          description: 'If true, deactivate after first execution',
        },
        cooldownMinutes: {
          type: 'integer',
          description: 'Minimum minutes between executions (default: 60)',
        },
      },
      required: ['userWallet', 'name', 'conditions', 'actions'],
    },
    annotations: {
      title: 'Create Conditional Trigger',
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: false,
      destructiveHint: false,
    },
  },

  // Kalshi Prediction Market Tools
  {
    name: 'kalshi_get_markets',
    title: 'Get Kalshi Markets',
    description: 'Get prediction markets from Kalshi. Search for markets or browse by status.',
    inputSchema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Search query to find specific markets',
        },
        status: {
          type: 'string',
          enum: ['open', 'closed', 'settled'],
          description: 'Filter by market status (default: open)',
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of markets to return (default: 20)',
        },
      },
      required: [],
    },
    annotations: {
      title: 'Get Kalshi Markets',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'kalshi_get_market',
    title: 'Get Kalshi Market Details',
    description: 'Get detailed information about a specific Kalshi prediction market including current prices and orderbook.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'The market ticker symbol',
        },
        includeOrderbook: {
          type: 'boolean',
          description: 'Include current orderbook data',
        },
      },
      required: ['ticker'],
    },
    annotations: {
      title: 'Get Kalshi Market Details',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  {
    name: 'kalshi_get_portfolio',
    title: 'Get Kalshi Portfolio',
    description: 'Get Kalshi portfolio summary including balance, positions, and P&L. Requires connected Kalshi account.',
    inputSchema: {
      type: 'object',
      properties: {
        userWallet: {
          type: 'string',
          description: 'The primary wallet address of the user (to identify stored Kalshi credentials)',
        },
      },
      required: ['userWallet'],
    },
    annotations: {
      title: 'Get Kalshi Portfolio',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'kalshi_place_order',
    title: 'Place Kalshi Order',
    description: 'Place an order on a Kalshi prediction market. Requires connected Kalshi account.',
    inputSchema: {
      type: 'object',
      properties: {
        userWallet: {
          type: 'string',
          description: 'The primary wallet address of the user',
        },
        ticker: {
          type: 'string',
          description: 'The market ticker to trade',
        },
        side: {
          type: 'string',
          enum: ['yes', 'no'],
          description: 'Which side to trade (yes = outcome happens, no = does not happen)',
        },
        action: {
          type: 'string',
          enum: ['buy', 'sell'],
          description: 'Buy or sell contracts',
        },
        count: {
          type: 'integer',
          description: 'Number of contracts',
          minimum: 1,
        },
        type: {
          type: 'string',
          enum: ['limit', 'market'],
          description: 'Order type (default: limit)',
        },
        price: {
          type: 'integer',
          description: 'Price in cents (1-99) for limit orders',
          minimum: 1,
          maximum: 99,
        },
      },
      required: ['userWallet', 'ticker', 'side', 'action', 'count'],
    },
    annotations: {
      title: 'Place Kalshi Order',
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
];

/**
 * Execute a single tool call - extracted for reuse by batch/pipeline
 * Includes analytics tracking for batch operations
 */
async function executeToolCall(apiClient: OpenSVMAPIClient, tool: string, params: Record<string, any>): Promise<any> {
  const startTime = Date.now();
  const inputSize = JSON.stringify(params).length;

  try {
    let result: any;

    switch (tool) {
      case 'get_transaction':
        result = await apiClient.get(`/api/transaction/${params.signature}`);
        break;
      case 'explain_transaction':
        result = await apiClient.get(`/api/transaction/${params.signature}/explain`);
        break;
      case 'analyze_transaction':
        result = await apiClient.get(`/api/transaction/${params.signature}/analysis`);
        break;
      case 'get_account_portfolio':
        result = await apiClient.get(`/api/account-portfolio/${params.address}`);
        break;
      case 'get_account_transactions':
        result = await apiClient.get(`/api/account-transactions/${params.address}`, { limit: params.limit });
        break;
      case 'get_account_stats':
        result = await apiClient.get(`/api/account-stats/${params.address}`);
        break;
      case 'get_blocks':
        result = await apiClient.get('/api/blocks', { limit: params.limit, before: params.before });
        break;
      case 'get_block':
        result = await apiClient.get(`/api/blocks/${params.slot}`);
        break;
      case 'get_token_ohlcv':
        result = await apiClient.get('/api/market-data', { endpoint: 'ohlcv', mint: params.mint, type: params.type || '1H' });
        break;
      case 'get_token_markets':
        result = await apiClient.get('/api/market-data', { endpoint: 'markets', mint: params.mint, baseMint: params.baseMint });
        break;
      case 'get_token_metadata':
        result = await apiClient.get('/api/token-metadata', { mint: params.mint });
        break;
      case 'get_program':
        result = await apiClient.get(`/api/program/${params.address}`);
        break;
      case 'search':
        result = await apiClient.get('/api/search-suggestions', { q: params.query });
        break;
      case 'find_wallet_path':
        result = await apiClient.post('/api/wallet-path-finding', params);
        break;
      case 'get_network_status':
        result = await apiClient.get('/api/status');
        break;
      case 'investigate':
        result = await apiClient.post('/api/investigate', {
          target: params.target,
          type: params.type || 'wallet_forensics',
          config: { maxDepth: params.maxDepth || 3, maxTransactions: params.maxTransactions || 50 },
        });
        break;
      default:
        throw new Error(`Unknown tool for batch/pipeline: ${tool}`);
    }

    // Record successful call (batch context)
    const outputSize = JSON.stringify(result).length;
    analytics.recordToolCall({
      serverId: 'opensvm-mcp',
      toolName: tool,
      duration: Date.now() - startTime,
      success: true,
      inputSize,
      outputSize,
      metadata: { context: 'batch' },
    });

    return result;
  } catch (error) {
    // Record failed call (batch context)
    analytics.recordToolCall({
      serverId: 'opensvm-mcp',
      toolName: tool,
      duration: Date.now() - startTime,
      success: false,
      errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
      inputSize,
      outputSize: 0,
      metadata: { context: 'batch' },
    });
    throw error;
  }
}

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

    // Track analytics
    const startTime = Date.now();
    const inputSize = JSON.stringify(toolArgs).length;

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

        // ============================================================================
        // ADVANCED MCP TOOL HANDLERS (v2.0)
        // ============================================================================

        case 'batch_execute': {
          const requests: BatchRequest[] = (toolArgs.requests as BatchRequest[]) || [];
          const maxConcurrency = (toolArgs.maxConcurrency as number) || 5;

          // Create a tool executor that uses this switch
          const toolExecutor = async (tool: string, params: Record<string, any>) => {
            // Recursively call the same handler logic
            const innerResult = await executeToolCall(apiClient, tool, params);
            return innerResult;
          };

          result = await executeBatch(requests, toolExecutor, maxConcurrency);
          break;
        }

        case 'execute_pipeline': {
          const pipeline = parsePipeline(toolArgs.pipeline as string);
          const context = (toolArgs.context as Record<string, any>) || {};

          const toolExecutor = async (tool: string, params: Record<string, any>) => {
            return await executeToolCall(apiClient, tool, params);
          };

          result = await executePipeline(pipeline, toolExecutor, context);
          break;
        }

        case 'save_checkpoint': {
          const checkpoint = saveCheckpoint(
            toolArgs.investigationId as string,
            toolArgs.state,
            (toolArgs.metadata as any) || { target: '', type: '', progress: 0, stepCount: 0, anomalyCount: 0 }
          );
          result = {
            success: true,
            checkpointId: checkpoint.id,
            createdAt: checkpoint.createdAt,
          };
          break;
        }

        case 'load_checkpoint': {
          const checkpoint = loadCheckpoint(toolArgs.checkpointId as string);
          if (!checkpoint) {
            result = { success: false, error: 'Checkpoint not found' };
          } else {
            result = {
              success: true,
              checkpoint: {
                id: checkpoint.id,
                investigationId: checkpoint.investigationId,
                createdAt: checkpoint.createdAt,
                metadata: checkpoint.metadata,
                state: checkpoint.state,
              },
            };
          }
          break;
        }

        case 'list_checkpoints': {
          const checkpoints = listCheckpoints();
          result = {
            count: checkpoints.length,
            checkpoints: checkpoints.map(c => ({
              id: c.id,
              investigationId: c.investigationId,
              createdAt: c.createdAt,
              metadata: c.metadata,
            })),
          };
          break;
        }

        case 'investigate_with_template': {
          const template = getTemplate(toolArgs.template as string);
          if (!template) {
            throw new Error(`Unknown template: ${toolArgs.template}`);
          }

          result = await apiClient.post('/api/investigate', {
            target: toolArgs.target,
            type: toolArgs.type || 'wallet_forensics',
            config: template.config,
          });

          // Optionally compress if template says so
          if (template.config.compressResults && result) {
            const compressed = compressResult(result);
            result = {
              _compressed: true,
              compressionRatio: compressed.compressionRatio.toFixed(2) + 'x',
              data: compressed.compressed,
            };
          }
          break;
        }

        case 'list_investigation_templates': {
          result = {
            templates: listTemplates(),
          };
          break;
        }

        case 'compress_result': {
          const compressed = compressResult(toolArgs.data, {
            maxTokens: (toolArgs.maxTokens as number) || 2000,
            preserveStructure: true,
            includeMetrics: true,
          });
          result = {
            originalSize: compressed.originalSize,
            compressedSize: compressed.compressedSize,
            compressionRatio: compressed.compressionRatio.toFixed(2) + 'x',
            data: compressed.compressed,
          };
          break;
        }

        case 'get_tool_versions': {
          const versions = getToolVersions(toolArgs.toolName as string);
          result = {
            toolName: toolArgs.toolName as string,
            versions: versions.map(v => ({
              version: v.version,
              deprecated: v.deprecated || false,
              deprecationMessage: v.deprecationMessage,
              description: v.description,
              changelog: v.changelog,
            })),
          };
          break;
        }

        // ============================================================================
        // NEW MCP FEATURE HANDLERS (v2.1)
        // ============================================================================

        // Cache Management
        case 'get_cache_stats': {
          const cache = getCache();
          result = cache.getStats();
          break;
        }

        case 'clear_cache': {
          const cache = getCache();
          if (toolArgs.tool) {
            const count = cache.invalidateTool(toolArgs.tool as string);
            result = { success: true, clearedEntries: count, tool: toolArgs.tool };
          } else {
            cache.clear();
            result = { success: true, clearedAll: true };
          }
          break;
        }

        // Metering & Billing
        case 'get_usage': {
          const metering = getMetering();
          const userId = (toolArgs.userId as string) || 'anonymous';
          const period = (toolArgs.period as 'hourly' | 'daily' | 'weekly' | 'monthly') || 'daily';
          const report = metering.generateBillingReport(userId, period);
          const quota = metering.getQuota(userId);
          result = {
            report,
            quota: {
              tier: quota.tier,
              callsToday: quota.currentDayCalls,
              callsThisMonth: quota.currentMonthCalls,
              dailyLimit: quota.callsPerDay,
              monthlyLimit: quota.callsPerMonth,
            },
          };
          break;
        }

        case 'get_pricing': {
          const { TOOL_PRICING } = await import('./mcp-metering.js');
          if (toolArgs.tool) {
            const pricing = TOOL_PRICING[toolArgs.tool as string];
            result = pricing ? { [toolArgs.tool as string]: pricing } : { error: 'Tool not found' };
          } else {
            result = TOOL_PRICING;
          }
          break;
        }

        // Webhook Management
        case 'create_webhook': {
          const webhooks = getWebhooks();
          const userId = 'user_from_context'; // Would come from auth context
          const sub = webhooks.createSubscription({
            userId,
            name: toolArgs.name as string,
            eventTypes: toolArgs.eventTypes as any[],
            targets: toolArgs.targets as string[],
            conditions: toolArgs.conditions as any[] || [],
            delivery: toolArgs.delivery as any,
          });
          result = {
            success: true,
            webhookId: sub.id,
            secret: sub.secret,
            status: sub.status,
          };
          break;
        }

        case 'list_webhooks': {
          const webhooks = getWebhooks();
          const userId = (toolArgs.userId as string) || 'user_from_context';
          const subs = webhooks.listSubscriptions(userId);
          result = {
            count: subs.length,
            webhooks: subs.map(s => ({
              id: s.id,
              name: s.name,
              eventTypes: s.eventTypes,
              targets: s.targets,
              status: s.status,
              stats: s.stats,
              createdAt: s.createdAt,
            })),
          };
          break;
        }

        case 'delete_webhook': {
          const webhooks = getWebhooks();
          const deleted = webhooks.deleteSubscription(toolArgs.webhookId as string);
          result = { success: deleted, webhookId: toolArgs.webhookId };
          break;
        }

        case 'list_webhook_events': {
          result = {
            eventTypes: Object.entries(EVENT_TEMPLATES).map(([type, template]) => ({
              type,
              description: template.description,
              defaultConditions: template.defaultConditions,
              exampleData: template.exampleData,
            })),
          };
          break;
        }

        // OpenAPI Generator
        case 'generate_mcp_from_openapi': {
          try {
            const server = await generateFromUrl(
              toolArgs.specUrl as string,
              toolArgs.config as any
            );
            result = {
              success: true,
              server: {
                name: server.name,
                version: server.version,
                description: server.description,
                baseUrl: server.baseUrl,
                toolCount: server.tools.length,
              },
              tools: server.tools.map(t => ({
                name: t.name,
                description: t.description,
                inputSchema: t.inputSchema,
              })),
            };
          } catch (error) {
            result = {
              success: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
          break;
        }

        // Multi-Agent Investigation
        case 'multi_agent_investigate': {
          const toolExecutor = async (tool: string, params: Record<string, any>) => {
            return await executeToolCall(apiClient, tool, params);
          };
          const orchestrator = new MultiAgentOrchestrator(toolExecutor);
          const investigation = await orchestrator.startInvestigation({
            target: toolArgs.target as string,
            template: (toolArgs.template as string) || 'standard',
            config: toolArgs.config as any,
          });

          // Wait for completion or return in-progress status
          const maxWait = 30000; // 30s max wait for initial response
          const startWait = Date.now();
          while (Date.now() - startWait < maxWait) {
            const status = orchestrator.getInvestigation(investigation.id);
            if (status?.status === 'completed' || status?.status === 'failed') {
              result = {
                investigationId: status.id,
                status: status.status,
                progress: status.progress,
                target: status.target,
                agentCount: status.agents.length,
                findings: status.findings,
                anomalies: status.anomalies,
                entities: status.entities,
                riskScore: status.riskScore,
              };
              break;
            }
            await new Promise(r => setTimeout(r, 500));
          }

          if (!result) {
            result = {
              investigationId: investigation.id,
              status: 'in_progress',
              progress: investigation.progress,
              message: 'Investigation started. Use get_investigation_status to check progress.',
            };
          }
          break;
        }

        case 'get_investigation_status': {
          // Note: In production, orchestrator would be persistent/shared
          result = {
            message: 'Investigation status lookup requires persistent orchestrator. Use multi_agent_investigate which waits for completion.',
            investigationId: toolArgs.investigationId,
          };
          break;
        }

        case 'list_agent_roles': {
          result = {
            roles: Object.entries(AGENT_ROLES).map(([role, config]) => ({
              role,
              description: config.description,
              tools: config.tools,
              priority: config.priority,
              canSpawnFollowUp: config.canSpawnFollowUp,
            })),
            templates: Object.entries(MULTI_AGENT_TEMPLATES).map(([name, template]) => ({
              name,
              displayName: template.name,
              description: template.description,
              agents: template.agents,
              config: template.config,
            })),
          };
          break;
        }

        // Memory/Context Persistence
        case 'remember': {
          const memory = getMemory();
          const userId = 'user_from_context';
          const stored = await memory.store({
            userId,
            type: (toolArgs.type as any) || 'knowledge',
            content: toolArgs.content as string,
            metadata: toolArgs.metadata as any,
            importance: toolArgs.importance as number,
          });
          result = {
            success: true,
            memoryId: stored.id,
            type: stored.type,
            importance: stored.importance,
          };
          break;
        }

        case 'recall': {
          const memory = getMemory();
          const userId = 'user_from_context';
          const results = await memory.search({
            userId,
            query: toolArgs.query as string,
            types: toolArgs.types as any[],
            target: toolArgs.target as string,
            limit: (toolArgs.limit as number) || 10,
          });
          result = {
            count: results.length,
            memories: results.map(r => ({
              id: r.memory.id,
              type: r.memory.type,
              content: r.memory.content,
              metadata: r.memory.metadata,
              score: r.score,
              matchedOn: r.matchedOn,
              importance: r.memory.importance,
              createdAt: r.memory.createdAt,
            })),
          };
          break;
        }

        case 'get_investigation_context': {
          const memory = getMemory();
          const userId = 'user_from_context';
          const context = await memory.getInvestigationContext(userId, toolArgs.target as string);
          result = {
            target: toolArgs.target,
            previousInvestigations: context.previousInvestigations.map(m => ({
              id: m.id,
              summary: m.metadata.summary,
              riskLevel: m.metadata.riskLevel,
              createdAt: m.createdAt,
            })),
            relatedFindings: context.relatedFindings.map(m => ({
              id: m.id,
              content: m.content,
              severity: m.metadata.data?.severity,
            })),
            knownEntities: context.knownEntities.map(m => ({
              address: m.metadata.address,
              name: m.metadata.title,
              type: m.metadata.entityType,
            })),
            relationshipContext: context.relationshipContext,
          };
          break;
        }

        case 'get_memory_stats': {
          const memory = getMemory();
          result = memory.getStats();
          break;
        }

        // ==========================================================================
        // Federation Tools
        // ==========================================================================

        case 'federation_list_servers': {
          const federation = getFederationNetwork();
          const servers = federation.listServers({
            minTrust: toolArgs.minTrust as number | undefined,
            category: toolArgs.category as string | undefined,
            limit: toolArgs.limit as number | undefined,
          });
          result = {
            count: servers.length,
            servers: servers.map(s => ({
              id: s.id,
              name: s.name,
              description: s.description,
              endpoint: s.endpoint,
              trustScore: s.trustScore,
              toolCount: s.tools.length,
              tools: s.tools.map(t => ({
                name: t.name,
                description: t.description,
                category: t.category,
              })),
              capabilities: s.capabilities,
              registeredAt: s.registeredAt,
              lastSeenAt: s.lastSeenAt,
            })),
          };
          break;
        }

        case 'federation_search_tools': {
          const federation = getFederationNetwork();
          const results = federation.searchTools(toolArgs.query as string, {
            category: toolArgs.category as string | undefined,
            minTrust: toolArgs.minTrust as number | undefined,
            limit: toolArgs.limit as number | undefined,
          });
          result = {
            query: toolArgs.query,
            count: results.length,
            tools: results.map(r => ({
              serverId: r.server.id,
              serverName: r.server.name,
              serverTrust: r.server.trustScore,
              tool: {
                name: r.tool.name,
                description: r.tool.description,
                category: r.tool.category,
                inputSchema: r.tool.inputSchema,
              },
              score: Math.round(r.score),
            })),
          };
          break;
        }

        case 'federation_call_tool': {
          const federation = getFederationNetwork();
          const toolName = toolArgs.tool as string;
          const params = (toolArgs.params as Record<string, any>) || {};
          const serverId = toolArgs.serverId as string | undefined;

          if (serverId) {
            result = await federation.callTool({
              serverId,
              tool: toolName,
              params,
            });
          } else {
            result = await federation.callToolAuto(toolName, params);
          }
          break;
        }

        case 'federation_register_server': {
          const federation = getFederationNetwork();
          const serverData: FederatedServer = {
            id: '',
            name: toolArgs.name as string,
            description: (toolArgs.description as string) || '',
            endpoint: toolArgs.endpoint as string,
            mcpVersion: '1.0.0',
            owner: toolArgs.owner as string,
            tools: (toolArgs.tools as any[]).map(t => ({
              name: t.name,
              description: t.description || '',
              inputSchema: t.inputSchema || {},
              category: t.category || 'general',
            })),
            capabilities: {
              streaming: true,
              batching: true,
              webhooks: false,
              customAuth: false,
              maxConcurrentRequests: 10,
              supportedAuthMethods: ['bearer'],
            },
            trustScore: 30,
            registeredAt: Date.now(),
            lastSeenAt: Date.now(),
            metadata: {
              version: '1.0.0',
              tags: [],
              revenueSharePercent: 70,
              minTrustRequired: 0,
            },
          };
          result = await federation.registerServer(serverData);
          break;
        }

        case 'federation_get_server': {
          const federation = getFederationNetwork();
          const serverId = toolArgs.serverId as string;
          const server = federation.getServer(serverId);

          if (!server) {
            result = { error: 'Server not found', serverId };
          } else {
            const metrics = federation.getTrustMetrics(serverId);
            result = {
              ...server,
              trustMetrics: metrics,
            };
          }
          break;
        }

        case 'federation_report_server': {
          const federation = getFederationNetwork();
          await federation.reportServer(
            toolArgs.serverId as string,
            toolArgs.reason as string
          );
          result = {
            success: true,
            serverId: toolArgs.serverId,
            message: 'Report submitted successfully',
          };
          break;
        }

        case 'federation_network_stats': {
          const federation = getFederationNetwork();
          result = federation.getNetworkStats();
          break;
        }

        // ==========================================================================
        // Bank & Portfolio Management Tools
        // ==========================================================================

        case 'bank_list_wallets': {
          const userWallet = toolArgs.userWallet as string;
          result = await apiClient.get('/api/bank/wallets', {
            // Note: In a real implementation, this would use session auth
            // For MCP, we pass the user wallet for identification
          });
          break;
        }

        case 'bank_get_portfolio': {
          const userWallet = toolArgs.userWallet as string;
          // Get wallets with balances
          const wallets = await apiClient.get('/api/bank/wallets');
          const walletsData = wallets.wallets || [];

          // Calculate portfolio metrics
          const totalValue = walletsData.reduce((sum: number, w: any) =>
            sum + (w.balance || 0) + (w.tokens || []).reduce((s: number, t: any) => s + (t.usdValue || 0), 0), 0);
          const totalSOL = walletsData.reduce((sum: number, w: any) => sum + (w.balance || 0), 0);
          const allTokens = walletsData.flatMap((w: any) => w.tokens || []);
          const uniqueTokens = new Set(allTokens.map((t: any) => t.mint));

          result = {
            totalValue,
            totalSOL,
            totalWallets: walletsData.length,
            uniqueTokenTypes: uniqueTokens.size,
            wallets: walletsData.map((w: any) => ({
              id: w.id,
              name: w.name,
              address: w.address,
              balance: w.balance,
              tokenCount: (w.tokens || []).length,
              totalValue: (w.balance || 0) + (w.tokens || []).reduce((s: number, t: any) => s + (t.usdValue || 0), 0),
            })),
          };
          break;
        }

        case 'bank_create_wallet': {
          const userWallet = toolArgs.userWallet as string;
          const name = toolArgs.name as string;
          result = await apiClient.post('/api/bank/wallets/create', { name });
          break;
        }

        case 'bank_refresh_balances': {
          const userWallet = toolArgs.userWallet as string;
          result = await apiClient.post('/api/bank/wallets/refresh');
          break;
        }

        case 'bank_list_dca_orders': {
          const userWallet = toolArgs.userWallet as string;
          result = await apiClient.get('/api/bank/dca');
          break;
        }

        case 'bank_create_dca_order': {
          const userWallet = toolArgs.userWallet as string;
          result = await apiClient.post('/api/bank/dca', {
            walletId: toolArgs.walletId,
            inputMint: toolArgs.inputMint,
            outputMint: toolArgs.outputMint,
            amountPerSwap: toolArgs.amountPerSwap,
            frequency: toolArgs.frequency,
            totalBudget: toolArgs.totalBudget,
            maxSwaps: toolArgs.maxSwaps,
          });
          break;
        }

        case 'bank_list_triggers': {
          const userWallet = toolArgs.userWallet as string;
          result = await apiClient.get('/api/bank/triggers');
          break;
        }

        case 'bank_create_trigger': {
          const userWallet = toolArgs.userWallet as string;
          result = await apiClient.post('/api/bank/triggers', {
            name: toolArgs.name,
            conditions: toolArgs.conditions,
            actions: toolArgs.actions,
            executeOnce: toolArgs.executeOnce,
            cooldownMinutes: toolArgs.cooldownMinutes || 60,
          });
          break;
        }

        // ==========================================================================
        // Kalshi Prediction Market Tools
        // ==========================================================================

        case 'kalshi_get_markets': {
          const search = toolArgs.search as string | undefined;
          const status = toolArgs.status as string || 'open';
          const limit = toolArgs.limit as number || 20;

          if (search) {
            result = await apiClient.get('/api/bank/kalshi', {
              action: 'search',
              q: search,
            });
          } else {
            result = await apiClient.get('/api/bank/kalshi', {
              action: 'markets',
              status,
              limit,
            });
          }
          break;
        }

        case 'kalshi_get_market': {
          const ticker = toolArgs.ticker as string;
          const includeOrderbook = toolArgs.includeOrderbook as boolean;
          result = await apiClient.get(`/api/bank/kalshi/markets/${ticker}`, {
            orderbook: includeOrderbook ? 'true' : undefined,
          });
          break;
        }

        case 'kalshi_get_portfolio': {
          const userWallet = toolArgs.userWallet as string;
          result = await apiClient.get('/api/bank/kalshi/portfolio', {
            action: 'summary',
          });
          break;
        }

        case 'kalshi_place_order': {
          const userWallet = toolArgs.userWallet as string;
          result = await apiClient.post('/api/bank/kalshi/orders', {
            ticker: toolArgs.ticker,
            side: toolArgs.side,
            action: toolArgs.action,
            count: toolArgs.count,
            type: toolArgs.type || 'limit',
            price: toolArgs.price,
          });
          break;
        }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }

      // Record successful call to analytics
      const outputText = JSON.stringify(result, null, 2);
      const duration = Date.now() - startTime;

      analytics.recordToolCall({
        serverId: 'opensvm-mcp',
        toolName: name,
        duration,
        success: true,
        inputSize,
        outputSize: outputText.length,
      });

      return {
        content: [
          {
            type: 'text',
            text: outputText,
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const duration = Date.now() - startTime;

      // Record failed call to analytics
      analytics.recordToolCall({
        serverId: 'opensvm-mcp',
        toolName: name,
        duration,
        success: false,
        errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
        inputSize,
        outputSize: 0,
      });

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
