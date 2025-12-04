/**
 * OpenSVM MCP Server - Netlify Serverless Function
 *
 * HTTP endpoint for the OpenSVM MCP server, enabling browser-based
 * and HTTP clients to access Solana blockchain explorer tools.
 */

const BASE_URL = 'https://osvm.ai';
const DEFAULT_TIMEOUT = 30000;

// API client function
async function apiRequest(method, path, params) {
  const url = new URL(path, BASE_URL);
  if (params && method === 'GET') {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

  try {
    const response = await fetch(url.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: method === 'POST' && params ? JSON.stringify(params) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

// Tool definitions for OpenSVM
const TOOLS = [
  // Transaction Tools
  {
    name: 'get_transaction',
    description: 'Get detailed information about a Solana transaction by its signature. Returns instructions, accounts, balances, token changes, and logs.',
    inputSchema: {
      type: 'object',
      properties: {
        signature: { type: 'string', description: 'The transaction signature (base58 encoded)' },
      },
      required: ['signature'],
    },
  },
  {
    name: 'explain_transaction',
    description: 'Get an AI-powered explanation of what a transaction does in simple terms.',
    inputSchema: {
      type: 'object',
      properties: {
        signature: { type: 'string', description: 'The transaction signature to explain' },
      },
      required: ['signature'],
    },
  },
  {
    name: 'analyze_transaction',
    description: 'Perform deep analysis of a transaction including program interactions, token flows, and patterns.',
    inputSchema: {
      type: 'object',
      properties: {
        signature: { type: 'string', description: 'The transaction signature to analyze' },
      },
      required: ['signature'],
    },
  },

  // Account Tools
  {
    name: 'get_account_portfolio',
    description: 'Get the portfolio of a Solana account including SOL balance, token balances, and USD values.',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'The Solana account address (public key)' },
      },
      required: ['address'],
    },
  },
  {
    name: 'get_account_transactions',
    description: 'Get recent transactions for a Solana account.',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'The Solana account address' },
        limit: { type: 'integer', description: 'Maximum number of transactions to return (default: 20)', minimum: 1, maximum: 100 },
      },
      required: ['address'],
    },
  },
  {
    name: 'get_account_stats',
    description: 'Get statistics and analytics for a Solana account.',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'The Solana account address' },
      },
      required: ['address'],
    },
  },

  // Block Tools
  {
    name: 'get_blocks',
    description: 'Get a list of recent Solana blocks with transaction counts and fees.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: 'Number of blocks to return (default: 10)', minimum: 1, maximum: 50 },
        before: { type: 'integer', description: 'Get blocks before this slot number' },
      },
      required: [],
    },
  },
  {
    name: 'get_block',
    description: 'Get detailed information about a specific block by slot number.',
    inputSchema: {
      type: 'object',
      properties: {
        slot: { type: 'integer', description: 'The slot number of the block' },
      },
      required: ['slot'],
    },
  },

  // Market Data Tools
  {
    name: 'get_token_ohlcv',
    description: 'Get OHLCV (candlestick) data for a token with technical indicators (MA7, MA25, MACD).',
    inputSchema: {
      type: 'object',
      properties: {
        mint: { type: 'string', description: 'The token mint address' },
        type: { type: 'string', enum: ['1m', '5m', '15m', '1H', '4H', '1D'], description: 'Timeframe for candles (default: 1H)' },
      },
      required: ['mint'],
    },
  },
  {
    name: 'get_token_markets',
    description: 'Get top liquidity pools/markets for a token across DEXes.',
    inputSchema: {
      type: 'object',
      properties: {
        mint: { type: 'string', description: 'The token mint address' },
        baseMint: { type: 'string', description: 'Filter by base token mint (optional)' },
      },
      required: ['mint'],
    },
  },
  {
    name: 'get_token_metadata',
    description: 'Get metadata for a Solana token including name, symbol, decimals, and supply.',
    inputSchema: {
      type: 'object',
      properties: {
        mint: { type: 'string', description: 'The token mint address' },
      },
      required: ['mint'],
    },
  },

  // Program Tools
  {
    name: 'get_program',
    description: 'Get information about a Solana program including IDL if available.',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'The program address' },
      },
      required: ['address'],
    },
  },

  // Search & Discovery
  {
    name: 'search',
    description: 'Search for transactions, accounts, tokens, or programs on Solana.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (address, signature, token symbol, etc.)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'find_wallet_path',
    description: 'Find the shortest path of token transfers between two wallets.',
    inputSchema: {
      type: 'object',
      properties: {
        sourceWallet: { type: 'string', description: 'The source wallet address' },
        targetWallet: { type: 'string', description: 'The target wallet address' },
        maxDepth: { type: 'integer', description: 'Maximum search depth (default: 42)', minimum: 1, maximum: 100 },
      },
      required: ['sourceWallet', 'targetWallet'],
    },
  },

  // Analytics
  {
    name: 'get_network_status',
    description: 'Get current Solana network status including TPS, slot, and health.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_nft_collections',
    description: 'Get trending or new NFT collections on Solana.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['trending', 'new'], description: 'Type of collections to fetch (default: trending)' },
      },
      required: [],
    },
  },

  // AI Analysis
  {
    name: 'ask_ai',
    description: 'Ask the AI assistant questions about Solana transactions, accounts, or general blockchain concepts.',
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'Your question about Solana' },
        context: { type: 'string', description: 'Optional context (e.g., a transaction signature or account address)' },
      },
      required: ['question'],
    },
  },

  // Investigation Agent
  {
    name: 'investigate',
    description: 'Launch an autonomous investigation agent that analyzes a wallet, transaction, or token for suspicious activity. The agent chains multiple tools, detects anomalies, and generates a comprehensive forensics report.',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'The address or signature to investigate (wallet, transaction, token)' },
        type: { type: 'string', enum: ['wallet_forensics', 'transaction_tracing', 'token_flow_analysis', 'anomaly_detection', 'connection_mapping', 'full_investigation'], description: 'Type of investigation (default: wallet_forensics)' },
        maxDepth: { type: 'integer', description: 'Max depth for connection tracing (default: 3)', minimum: 1, maximum: 5 },
        maxTransactions: { type: 'integer', description: 'Max transactions to analyze (default: 50)', minimum: 10, maximum: 100 },
      },
      required: ['target'],
    },
  },

  // Authentication & Account Tools
  {
    name: 'create_api_key',
    description: 'Create a new OpenSVM API key for authenticated access. The key provides rate limit increases and access to premium features.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'A descriptive name for the API key' },
        permissions: { type: 'array', items: { type: 'string' }, description: 'Permissions for this key (e.g., ["read:*"])' },
        expiresInDays: { type: 'integer', description: 'Days until key expires (default: 365)', minimum: 1, maximum: 365 },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_api_keys',
    description: 'List all API keys associated with the authenticated wallet. Requires API key authentication.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_api_key_metrics',
    description: 'Get usage metrics for API keys including request counts, response times, and activity logs.',
    inputSchema: {
      type: 'object',
      properties: {
        keyId: { type: 'string', description: 'The API key ID to get metrics for (optional)' },
      },
      required: [],
    },
  },
  {
    name: 'check_session',
    description: 'Check if the current session is authenticated and get wallet information.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_user_history',
    description: 'Get the transaction and page view history for an authenticated wallet.',
    inputSchema: {
      type: 'object',
      properties: {
        walletAddress: { type: 'string', description: 'The wallet address to get history for' },
        limit: { type: 'integer', description: 'Maximum history items (default: 50)', minimum: 1, maximum: 100 },
      },
      required: ['walletAddress'],
    },
  },
  {
    name: 'get_user_profile',
    description: 'Get the public profile for a Solana wallet including social stats and activity.',
    inputSchema: {
      type: 'object',
      properties: {
        walletAddress: { type: 'string', description: 'The wallet address to get profile for' },
      },
      required: ['walletAddress'],
    },
  },
  {
    name: 'check_svmai_access',
    description: 'Check if a wallet has sufficient SVMAI tokens (100,000) for premium features.',
    inputSchema: {
      type: 'object',
      properties: {
        walletAddress: { type: 'string', description: 'The wallet address to check token balance for' },
      },
      required: ['walletAddress'],
    },
  },
];

// Handle tool calls
async function handleToolCall(name, args) {
  const toolArgs = args || {};

  switch (name) {
    // Transaction Tools
    case 'get_transaction':
      return await apiRequest('GET', `/api/transaction/${toolArgs.signature}`);

    case 'explain_transaction':
      return await apiRequest('GET', `/api/transaction/${toolArgs.signature}/explain`);

    case 'analyze_transaction':
      return await apiRequest('GET', `/api/transaction/${toolArgs.signature}/analysis`);

    // Account Tools
    case 'get_account_portfolio':
      return await apiRequest('GET', `/api/account-portfolio/${toolArgs.address}`);

    case 'get_account_transactions':
      return await apiRequest('GET', `/api/account-transactions/${toolArgs.address}`, {
        limit: toolArgs.limit,
      });

    case 'get_account_stats':
      return await apiRequest('GET', `/api/account-stats/${toolArgs.address}`);

    // Block Tools
    case 'get_blocks':
      return await apiRequest('GET', '/api/blocks', {
        limit: toolArgs.limit,
        before: toolArgs.before,
      });

    case 'get_block':
      return await apiRequest('GET', `/api/blocks/${toolArgs.slot}`);

    // Market Data Tools
    case 'get_token_ohlcv':
      return await apiRequest('GET', '/api/market-data', {
        endpoint: 'ohlcv',
        mint: toolArgs.mint,
        type: toolArgs.type || '1H',
      });

    case 'get_token_markets':
      return await apiRequest('GET', '/api/market-data', {
        endpoint: 'markets',
        mint: toolArgs.mint,
        baseMint: toolArgs.baseMint,
      });

    case 'get_token_metadata':
      return await apiRequest('GET', '/api/token-metadata', {
        mint: toolArgs.mint,
      });

    // Program Tools
    case 'get_program':
      return await apiRequest('GET', `/api/program/${toolArgs.address}`);

    // Search & Discovery
    case 'search':
      return await apiRequest('GET', '/api/search-suggestions', {
        q: toolArgs.query,
      });

    case 'find_wallet_path':
      return await apiRequest('POST', '/api/wallet-path-finding', {
        sourceWallet: toolArgs.sourceWallet,
        targetWallet: toolArgs.targetWallet,
        maxDepth: toolArgs.maxDepth,
      });

    // Analytics
    case 'get_network_status':
      return await apiRequest('GET', '/api/status');

    case 'get_nft_collections':
      const endpoint = toolArgs.type === 'new' ? '/api/nft-collections/new' : '/api/nft-collections/trending';
      return await apiRequest('GET', endpoint);

    // AI Analysis
    case 'ask_ai':
      return await apiRequest('POST', '/api/getAnswer', {
        question: toolArgs.question,
        context: toolArgs.context,
      });

    // Investigation Agent
    case 'investigate':
      return await apiRequest('POST', '/api/investigate', {
        target: toolArgs.target,
        type: toolArgs.type || 'wallet_forensics',
        config: {
          maxDepth: toolArgs.maxDepth || 3,
          maxTransactions: toolArgs.maxTransactions || 50,
        },
      });

    // Authentication & Account Tools
    case 'create_api_key':
      return await apiRequest('POST', '/api/auth/api-keys/create', {
        name: toolArgs.name,
        permissions: toolArgs.permissions || ['read:*'],
        expiresInDays: toolArgs.expiresInDays || 365,
      });

    case 'list_api_keys':
      return await apiRequest('GET', '/api/auth/api-keys/list');

    case 'get_api_key_metrics':
      return await apiRequest('GET', '/api/auth/api-keys/metrics', {
        keyId: toolArgs.keyId,
      });

    case 'check_session':
      return await apiRequest('GET', '/api/auth/session');

    case 'get_user_history':
      return await apiRequest('GET', `/api/user-history/${toolArgs.walletAddress}`, {
        limit: toolArgs.limit || 50,
      });

    case 'get_user_profile':
      return await apiRequest('GET', `/api/user-profile/${toolArgs.walletAddress}`);

    case 'check_svmai_access':
      return await apiRequest('GET', '/api/check-token', {
        address: toolArgs.walletAddress,
      });

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, mcp-session-id, mcp-protocol-version, *',
};

// Main handler
exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  // Health check
  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'opensvm-mcp-server',
        version: '1.0.0',
        status: 'healthy',
        endpoints: {
          tools: '/api/opensvm-mcp (POST with tools.list)',
          call: '/api/opensvm-mcp (POST with tools.call)',
        },
        toolCount: TOOLS.length,
      }),
    };
  }

  // Handle POST requests (MCP protocol)
  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      const { method, params, id } = body;

      let result;

      // Handle different MCP methods
      switch (method) {
        case 'initialize':
          result = {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
              prompts: {},
              resources: {},
            },
            serverInfo: {
              name: 'opensvm-mcp-server',
              version: '1.0.0',
            },
          };
          break;

        case 'tools/list':
        case 'tools.list':
          result = { tools: TOOLS };
          break;

        case 'tools/call':
        case 'tools.call':
          try {
            const toolResult = await handleToolCall(params.name, params.arguments);
            result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(toolResult, null, 2),
                },
              ],
            };
          } catch (error) {
            result = {
              content: [
                {
                  type: 'text',
                  text: `Error: ${error.message}`,
                },
              ],
              isError: true,
            };
          }
          break;

        case 'prompts/list':
        case 'prompts.list':
          result = {
            prompts: [
              {
                name: 'analyze_wallet',
                description: 'Analyze a Solana wallet including holdings, transaction history, and activity patterns',
                arguments: [{ name: 'address', description: 'The wallet address to analyze', required: true }],
              },
              {
                name: 'investigate_transaction',
                description: 'Deep investigation of a transaction including related transactions and flow analysis',
                arguments: [{ name: 'signature', description: 'The transaction signature to investigate', required: true }],
              },
              {
                name: 'token_analysis',
                description: 'Comprehensive analysis of a token including price, liquidity, and trading activity',
                arguments: [{ name: 'mint', description: 'The token mint address', required: true }],
              },
              {
                name: 'find_connection',
                description: 'Find if and how two wallets are connected through token transfers',
                arguments: [
                  { name: 'wallet_a', description: 'First wallet address', required: true },
                  { name: 'wallet_b', description: 'Second wallet address', required: true },
                ],
              },
            ],
          };
          break;

        case 'resources/list':
        case 'resources.list':
          result = {
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
          break;

        default:
          return {
            statusCode: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id,
              error: {
                code: -32601,
                message: `Unknown method: ${method}`,
              },
            }),
          };
      }

      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id,
          result,
        }),
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: error.message || 'Internal error',
          },
        }),
      };
    }
  }

  return {
    statusCode: 405,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
};
