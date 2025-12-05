#!/usr/bin/env bun
/**
 * OpenSVM MCP Streaming Server
 *
 * Entry point for the streaming MCP server with WebSocket and SSE support.
 * Run with: bun run src/opensvm-streaming.ts
 */

import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { createStreamingServer, emitStreamEvent } from './streaming-transport.js';

// Import the OpenSVM MCP server components
const DEFAULT_BASE_URL = process.env.OPENSVM_API_URL || 'https://osvm.ai';
const DEFAULT_TIMEOUT = 30000;

class OpenSVMAPIClient {
  private baseUrl: string;
  private timeout: number;
  private apiKey?: string;

  constructor(baseUrl: string = DEFAULT_BASE_URL, timeout: number = DEFAULT_TIMEOUT, apiKey?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeout = timeout;
    this.apiKey = apiKey || process.env.OPENSVM_API_KEY;
  }

  private makeUrl(path: string): string {
    return `${this.baseUrl}${path.startsWith('/') ? path : '/' + path}`;
  }

  async request(method: string, path: string, options: RequestInit = {}): Promise<any> {
    const url = this.makeUrl(path);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

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

// Initialize API client
const apiClient = new OpenSVMAPIClient();

// Tool definitions (same as main MCP server)
const TOOLS = [
  { name: 'get_transaction', description: 'Get transaction details by signature' },
  { name: 'explain_transaction', description: 'Get AI explanation of a transaction' },
  { name: 'analyze_transaction', description: 'Deep analysis of transaction patterns' },
  { name: 'get_account_portfolio', description: 'Get wallet holdings and values' },
  { name: 'get_account_transactions', description: 'Get recent account activity' },
  { name: 'get_account_stats', description: 'Get account statistics' },
  { name: 'get_blocks', description: 'Get recent blocks' },
  { name: 'get_block', description: 'Get block by slot' },
  { name: 'get_token_ohlcv', description: 'Get candlestick data with indicators' },
  { name: 'get_token_markets', description: 'Get DEX pools for a token' },
  { name: 'get_token_metadata', description: 'Get token information' },
  { name: 'get_program', description: 'Get program info and IDL' },
  { name: 'search', description: 'Search for anything on Solana' },
  { name: 'find_wallet_path', description: 'Find connection between wallets' },
  { name: 'get_network_status', description: 'Get network health and stats' },
  { name: 'get_nft_collections', description: 'Get trending NFT collections' },
  { name: 'ask_ai', description: 'Ask questions about Solana' },
  { name: 'investigate', description: 'Autonomous forensics investigation' },
  { name: 'create_api_key', description: 'Create new API key' },
  { name: 'list_api_keys', description: 'List your API keys' },
  { name: 'get_api_key_metrics', description: 'Get API key usage metrics' },
  { name: 'check_session', description: 'Check authentication status' },
  { name: 'get_user_history', description: 'Get wallet history' },
  { name: 'get_user_profile', description: 'Get wallet profile' },
  { name: 'check_svmai_access', description: 'Check SVMAI token access' },
];

/**
 * Handle MCP JSON-RPC request
 */
async function handleMCPRequest(request: any): Promise<any> {
  const { method, params, id } = request;

  try {
    // Handle tools/list
    if (method === 'tools/list' || method === 'tools.list') {
      return {
        jsonrpc: '2.0',
        id,
        result: { tools: TOOLS },
      };
    }

    // Handle tools/call
    if (method === 'tools/call' || method === 'tools.call') {
      const { name, arguments: args = {} } = params;
      const result = await callTool(name, args, id);
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        },
      };
    }

    // Handle prompts/list
    if (method === 'prompts/list' || method === 'prompts.list') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          prompts: [
            { name: 'analyze_wallet', description: 'Comprehensive wallet analysis' },
            { name: 'investigate_transaction', description: 'Deep transaction investigation' },
            { name: 'token_analysis', description: 'Token price and liquidity analysis' },
            { name: 'find_connection', description: 'Find wallet connections' },
          ],
        },
      };
    }

    // Handle resources/list
    if (method === 'resources/list' || method === 'resources.list') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          resources: [
            { uri: 'opensvm://network/status', name: 'Network Status', mimeType: 'application/json' },
            { uri: 'opensvm://blocks/recent', name: 'Recent Blocks', mimeType: 'application/json' },
          ],
        },
      };
    }

    // Unknown method
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    };

  } catch (error) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Call a tool and return result
 */
async function callTool(name: string, args: any, requestId?: string | number): Promise<any> {
  switch (name) {
    // Transaction Tools
    case 'get_transaction':
      return apiClient.get(`/api/transaction/${args.signature}`);

    case 'explain_transaction':
      return apiClient.get(`/api/transaction/${args.signature}/explain`);

    case 'analyze_transaction':
      return apiClient.get(`/api/transaction/${args.signature}/analysis`);

    // Account Tools
    case 'get_account_portfolio':
      return apiClient.get(`/api/account-portfolio/${args.address}`);

    case 'get_account_transactions':
      return apiClient.get(`/api/account-transactions/${args.address}`, { limit: args.limit });

    case 'get_account_stats':
      return apiClient.get(`/api/account-stats/${args.address}`);

    // Block Tools
    case 'get_blocks':
      return apiClient.get('/api/blocks', { limit: args.limit, before: args.before });

    case 'get_block':
      return apiClient.get(`/api/blocks/${args.slot}`);

    // Market Data Tools
    case 'get_token_ohlcv':
      return apiClient.get('/api/market-data', {
        endpoint: 'ohlcv',
        mint: args.mint,
        type: args.type || '1H',
      });

    case 'get_token_markets':
      return apiClient.get('/api/market-data', {
        endpoint: 'markets',
        mint: args.mint,
        baseMint: args.baseMint,
      });

    case 'get_token_metadata':
      return apiClient.get('/api/token-metadata', { mint: args.mint });

    // Program Tools
    case 'get_program':
      return apiClient.get(`/api/program/${args.address}`);

    // Search & Discovery
    case 'search':
      return apiClient.get('/api/search-suggestions', { q: args.query });

    case 'find_wallet_path':
      return apiClient.post('/api/wallet-path-finding', {
        sourceWallet: args.sourceWallet,
        targetWallet: args.targetWallet,
        maxDepth: args.maxDepth,
      });

    // Analytics
    case 'get_network_status':
      return apiClient.get('/api/status');

    case 'get_nft_collections':
      const endpoint = args.type === 'new' ? '/api/nft-collections/new' : '/api/nft-collections/trending';
      return apiClient.get(endpoint);

    // AI Analysis
    case 'ask_ai':
      return apiClient.post('/api/getAnswer', {
        question: args.question,
        context: args.context,
      });

    // Investigation with streaming support
    case 'investigate':
      return handleStreamingInvestigation(args, requestId);

    // Authentication & Account Tools
    case 'create_api_key':
      return apiClient.post('/api/auth/api-keys/create', {
        name: args.name,
        permissions: args.permissions || ['read:*'],
        expiresInDays: args.expiresInDays || 365,
      });

    case 'list_api_keys':
      return apiClient.get('/api/auth/api-keys/list');

    case 'get_api_key_metrics':
      return apiClient.get('/api/auth/api-keys/metrics', { keyId: args.keyId });

    case 'check_session':
      return apiClient.get('/api/auth/session');

    case 'get_user_history':
      return apiClient.get(`/api/user-history/${args.walletAddress}`, { limit: args.limit || 50 });

    case 'get_user_profile':
      return apiClient.get(`/api/user-profile/${args.walletAddress}`);

    case 'check_svmai_access':
      return apiClient.get('/api/check-token', { address: args.walletAddress });

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/**
 * Handle investigation with streaming events
 */
async function handleStreamingInvestigation(
  args: { target: string; type?: string; maxDepth?: number; maxTransactions?: number },
  requestId?: string | number
): Promise<any> {
  const invId = requestId ? String(requestId) : `inv_${Date.now()}`;

  try {
    // Emit progress events
    emitStreamEvent(invId, {
      type: 'progress',
      timestamp: Date.now(),
      data: { step: 'starting', message: 'Initializing investigation...' },
    });

    // Call the investigation API
    const result = await apiClient.post('/api/investigate', {
      target: args.target,
      type: args.type || 'wallet_forensics',
      config: {
        maxDepth: args.maxDepth || 3,
        maxTransactions: args.maxTransactions || 50,
      },
    });

    emitStreamEvent(invId, {
      type: 'complete',
      timestamp: Date.now(),
      data: result,
    });

    return result;

  } catch (error) {
    emitStreamEvent(invId, {
      type: 'error',
      timestamp: Date.now(),
      data: { error: error instanceof Error ? error.message : String(error) },
    });
    throw error;
  }
}

// Start the streaming server
const port = parseInt(process.env.PORT || '3001', 10);
createStreamingServer(handleMCPRequest, { port });

console.log(`\nOpenSVM MCP Streaming Server ready!`);
console.log(`\nUsage examples:`);
console.log(`  WebSocket: wscat -c ws://localhost:${port}/ws`);
console.log(`  SSE: curl -N http://localhost:${port}/stream/inv_123`);
console.log(`  JSON-RPC: curl -X POST http://localhost:${port}/ -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`);
console.log(`  Streaming Investigation: curl -N -X POST http://localhost:${port}/investigate/stream -H "Content-Type: application/json" -d '{"target":"EPjFWdd5..."}'`);
