// Comprehensive API Documentation Data
// Generated from llms-api.txt specification

export interface APIEndpointDoc {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  category: string;
  summary: string;
  description: string;
  authentication?: 'jwt' | 'api-key' | 'wallet' | 'session' | 'none';
  rateLimit?: string;
  cache?: string;
  parameters?: Array<{
    name: string;
    type: 'path' | 'query' | 'header' | 'body';
    required: boolean;
    description: string;
    example?: any;
  }>;
  requestBody?: {
    type: string;
    example: any;
  };
  responses: Array<{
    status: number;
    description: string;
    example?: any;
  }>;
  examples?: Array<{
    title: string;
    request: {
      method: string;
      url: string;
      headers?: Record<string, string>;
      body?: any;
    };
    response: {
      status: number;
      body: any;
    };
  }>;
}

export const API_CATEGORIES = {
  TRANSACTIONS: 'Transactions',
  ACCOUNTS: 'Accounts',
  BLOCKS: 'Blocks',
  SEARCH: 'Search',
  ANALYTICS: 'Analytics',
  TOKENS: 'Tokens & NFTs',
  USER: 'User Management',
  MONETIZATION: 'Monetization',
  INFRASTRUCTURE: 'Infrastructure',
  PROGRAMS: 'Programs',
  UTILITIES: 'Utilities',
  REALTIME: 'Real-time',
  SHARING: 'Sharing'
} as const;

export const API_DOCUMENTATION: APIEndpointDoc[] = [
  // ==================== TRANSACTION APIs ====================
  {
    path: '/transaction/{signature}',
    method: 'GET',
    category: API_CATEGORIES.TRANSACTIONS,
    summary: 'Get Transaction Details',
    description: 'Fetch detailed transaction information with enhanced parsing',
    rateLimit: '30 req/min',
    cache: '5 minutes',
    parameters: [
      {
        name: 'signature',
        type: 'path',
        required: true,
        description: 'Transaction signature (base58, 87-88 chars)',
        example: '4RwR2w12LydcoutGYJz2TbVxY8HVV44FCN2xoo1L9xu7ZcFxFBpoxxpSFTRWf9MPwMzmr9yTuJZjGqSmzcrawF43'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Transaction details retrieved successfully',
        example: {
          signature: '4RwR2w12...',
          timestamp: 1234567890000,
          slot: 123456789,
          success: true,
          type: 'token',
          details: {
            instructions: [],
            accounts: [],
            preBalances: [],
            postBalances: [],
            logs: [],
            tokenChanges: [],
            solChanges: []
          }
        }
      },
      {
        status: 404,
        description: 'Transaction not found'
      },
      {
        status: 504,
        description: 'Request timeout'
      }
    ]
  },
  {
    path: '/transaction/batch',
    method: 'POST',
    category: API_CATEGORIES.TRANSACTIONS,
    summary: 'Batch Fetch Transactions',
    description: 'Fetch multiple transactions in a single request',
    rateLimit: '10 req/min',
    requestBody: {
      type: 'object',
      example: {
        signatures: ['sig1', 'sig2'],
        includeDetails: true
      }
    },
    responses: [
      {
        status: 200,
        description: 'Batch results',
        example: {
          transactions: [],
          errors: {}
        }
      }
    ]
  },
  {
    path: '/transaction/{signature}/analysis',
    method: 'GET',
    category: API_CATEGORIES.TRANSACTIONS,
    summary: 'AI Transaction Analysis',
    description: 'Get AI-powered analysis of a transaction',
    rateLimit: '10 req/min',
    parameters: [
      {
        name: 'signature',
        type: 'path',
        required: true,
        description: 'Transaction signature'
      },
      {
        name: 'model',
        type: 'query',
        required: false,
        description: 'AI model to use',
        example: 'gpt-4'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Analysis complete',
        example: {
          analysis: {
            summary: 'Token swap on Jupiter',
            type: 'swap',
            risk: 'low',
            patterns: ['dex-swap', 'slippage-optimized'],
            recommendations: []
          }
        }
      }
    ]
  },
  {
    path: '/transaction/{signature}/explain',
    method: 'GET',
    category: API_CATEGORIES.TRANSACTIONS,
    summary: 'Explain Transaction',
    description: 'Get natural language explanation of a transaction',
    parameters: [
      {
        name: 'signature',
        type: 'path',
        required: true,
        description: 'Transaction signature'
      },
      {
        name: 'language',
        type: 'query',
        required: false,
        description: 'Output language',
        example: 'en'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Explanation generated',
        example: {
          explanation: 'This transaction swapped 100 USDC for 0.5 SOL on Jupiter...',
          technical_details: {},
          user_friendly: 'You exchanged 100 USDC for 0.5 SOL'
        }
      }
    ]
  },
  {
    path: '/transaction/{signature}/related',
    method: 'GET',
    category: API_CATEGORIES.TRANSACTIONS,
    summary: 'Find Related Transactions',
    description: 'Find transactions related to the specified one',
    parameters: [
      {
        name: 'signature',
        type: 'path',
        required: true,
        description: 'Transaction signature'
      },
      {
        name: 'limit',
        type: 'query',
        required: false,
        description: 'Maximum results',
        example: 10
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Related transactions found',
        example: {
          related: [
            {
              signature: '...',
              relationship: 'same_program',
              confidence: 0.95
            }
          ]
        }
      }
    ]
  },

  // ==================== ACCOUNT APIs ====================
  {
    path: '/account-stats/{address}',
    method: 'GET',
    category: API_CATEGORIES.ACCOUNTS,
    summary: 'Get Account Statistics',
    description: 'Get comprehensive statistics for a Solana account',
    cache: '5 minutes',
    parameters: [
      {
        name: 'address',
        type: 'path',
        required: true,
        description: 'Solana account address',
        example: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Account statistics',
        example: {
          totalTransactions: '3000+',
          tokenTransfers: 150,
          lastUpdated: 1234567890000,
          balance: 10.5,
          tokenAccounts: 25
        }
      }
    ]
  },
  {
    path: '/account-transactions/{address}',
    method: 'GET',
    category: API_CATEGORIES.ACCOUNTS,
    summary: 'Get Account Transactions',
    description: 'Get transaction history for an account',
    parameters: [
      {
        name: 'address',
        type: 'path',
        required: true,
        description: 'Account address'
      },
      {
        name: 'limit',
        type: 'query',
        required: false,
        description: 'Results per page (max 100)',
        example: 50
      },
      {
        name: 'before',
        type: 'query',
        required: false,
        description: 'Pagination cursor'
      },
      {
        name: 'type',
        type: 'query',
        required: false,
        description: 'Transaction type filter'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Transaction list',
        example: {
          transactions: [],
          hasMore: true,
          nextCursor: '...'
        }
      }
    ]
  },

  // ==================== BLOCK APIs ====================
  {
    path: '/blocks/{slot}',
    method: 'GET',
    category: API_CATEGORIES.BLOCKS,
    summary: 'Get Block Information',
    description: 'Get detailed information about a specific block',
    parameters: [
      {
        name: 'slot',
        type: 'path',
        required: true,
        description: 'Block slot number',
        example: 123456789
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Block information',
        example: {
          slot: 123456789,
          blockhash: '...',
          parentSlot: 123456788,
          transactions: 150,
          timestamp: 1234567890,
          rewards: []
        }
      }
    ]
  },
  {
    path: '/blocks',
    method: 'GET',
    category: API_CATEGORIES.BLOCKS,
    summary: 'List Recent Blocks',
    description: 'Get a list of recent blocks',
    parameters: [
      {
        name: 'limit',
        type: 'query',
        required: false,
        description: 'Number of blocks to return',
        example: 20
      },
      {
        name: 'before',
        type: 'query',
        required: false,
        description: 'Slot number for pagination'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Block list',
        example: {
          blocks: [],
          latestSlot: 123456789
        }
      }
    ]
  },

  // ==================== SEARCH APIs ====================
  {
    path: '/search',
    method: 'GET',
    category: API_CATEGORIES.SEARCH,
    summary: 'Universal Search',
    description: 'Search across accounts, transactions, tokens, and programs',
    parameters: [
      {
        name: 'q',
        type: 'query',
        required: true,
        description: 'Search query (address, signature, token)',
        example: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
      },
      {
        name: 'type',
        type: 'query',
        required: false,
        description: 'Filter by type',
        example: 'account'
      },
      {
        name: 'start',
        type: 'query',
        required: false,
        description: 'Start date (ISO string)'
      },
      {
        name: 'end',
        type: 'query',
        required: false,
        description: 'End date (ISO string)'
      },
      {
        name: 'status',
        type: 'query',
        required: false,
        description: 'Transaction status filter',
        example: 'success'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Search results',
        example: {
          results: [],
          totalResults: 100,
          searchTime: 150
        }
      }
    ]
  },

  // ==================== ANALYTICS APIs ====================
  {
    path: '/analytics/overview',
    method: 'GET',
    category: API_CATEGORIES.ANALYTICS,
    summary: 'DeFi Overview',
    description: 'Comprehensive DeFi ecosystem overview with TVL, volume, and protocol metrics',
    cache: '2 minutes',
    responses: [
      {
        status: 200,
        description: 'DeFi overview data',
        example: {
          totalTvl: 2850000000,
          totalVolume24h: 185000000,
          activeDexes: 15,
          totalTransactions: 125000,
          topProtocols: [
            {
              name: 'jupiter',
              tvl: 950000000,
              volume24h: 45000000,
              category: 'Aggregator'
            }
          ],
          sectorBreakdown: {
            dex: { tvl: 1420000000, volume24h: 95000000, protocols: 8 }
          }
        }
      }
    ]
  },
  {
    path: '/analytics/dex',
    method: 'GET',
    category: API_CATEGORIES.ANALYTICS,
    summary: 'DEX Analytics',
    description: 'DEX-specific analytics with real-time price feeds',
    parameters: [
      {
        name: 'dex',
        type: 'query',
        required: false,
        description: 'Specific DEX name',
        example: 'jupiter'
      },
      {
        name: 'timeframe',
        type: 'query',
        required: false,
        description: 'Time period',
        example: '24h'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'DEX analytics data'
      }
    ]
  },
  {
    path: '/analytics/validators',
    method: 'GET',
    category: API_CATEGORIES.ANALYTICS,
    summary: 'Validator Analytics',
    description: 'Network validator statistics and performance metrics',
    responses: [
      {
        status: 200,
        description: 'Validator data',
        example: {
          totalValidators: 1500,
          activeValidators: 1450,
          averageAPY: 0.07,
          topValidators: [],
          networkHealth: 'excellent'
        }
      }
    ]
  },

  // ==================== TOKEN & NFT APIs ====================
  {
    path: '/token/{address}',
    method: 'GET',
    category: API_CATEGORIES.TOKENS,
    summary: 'Get Token Details',
    description: 'Get detailed information about a token including metadata and market data',
    parameters: [
      {
        name: 'address',
        type: 'path',
        required: true,
        description: 'Token mint address',
        example: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Token details',
        example: {
          mint: '...',
          supply: 1000000000,
          decimals: 6,
          metadata: {
            name: 'USD Coin',
            symbol: 'USDC',
            image: 'https://...'
          },
          price: 1.0,
          marketCap: 1000000000,
          holders: 10000
        }
      }
    ]
  },
  {
    path: '/nft-collections',
    method: 'GET',
    category: API_CATEGORIES.TOKENS,
    summary: 'List NFT Collections',
    description: 'Get a list of NFT collections with floor prices and volume data',
    parameters: [
      {
        name: 'limit',
        type: 'query',
        required: false,
        description: 'Number of results',
        example: 20
      },
      {
        name: 'sort',
        type: 'query',
        required: false,
        description: 'Sort by metric',
        example: 'volume'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'NFT collections list'
      }
    ]
  },

  // ==================== USER MANAGEMENT APIs ====================
  {
    path: '/auth/verify',
    method: 'POST',
    category: API_CATEGORIES.USER,
    summary: 'Verify Wallet Signature',
    description: 'Authenticate user by verifying wallet signature',
    authentication: 'none',
    requestBody: {
      type: 'object',
      example: {
        message: 'Sign this message...',
        signature: '...',
        publicKey: '...'
      }
    },
    responses: [
      {
        status: 200,
        description: 'Authentication successful',
        example: {
          success: true,
          token: 'jwt_token',
          user: {
            address: '...',
            verified: true
          }
        }
      }
    ]
  },
  {
    path: '/auth/session',
    method: 'GET',
    category: API_CATEGORIES.USER,
    summary: 'Get Session Info',
    description: 'Get current user session information',
    authentication: 'session',
    responses: [
      {
        status: 200,
        description: 'Session information',
        example: {
          authenticated: true,
          user: {
            address: '...',
            balance: 100
          },
          session: {
            id: '...',
            expiresAt: 1234567890000
          }
        }
      }
    ]
  },

  // ==================== MONETIZATION APIs ====================
  {
    path: '/opensvm/balance',
    method: 'GET',
    category: API_CATEGORIES.MONETIZATION,
    summary: 'Get Token Balance',
    description: 'Get user SVMAI token balance (requires JWT authentication)',
    authentication: 'jwt',
    responses: [
      {
        status: 200,
        description: 'Token balance',
        example: {
          balance: 1000,
          pending: 50,
          locked: 0
        }
      }
    ]
  },
  {
    path: '/opensvm/anthropic-keys',
    method: 'POST',
    category: API_CATEGORIES.MONETIZATION,
    summary: 'Create API Key',
    description: 'Generate a new API key for external access',
    authentication: 'jwt',
    requestBody: {
      type: 'object',
      example: {
        name: 'Production API Key',
        permissions: ['read', 'write']
      }
    },
    responses: [
      {
        status: 200,
        description: 'API key created',
        example: {
          key: 'sk_live_...',
          id: 'key_456'
        }
      }
    ]
  },

  // ==================== INFRASTRUCTURE APIs ====================
  {
    path: '/monitoring/api',
    method: 'GET',
    category: API_CATEGORIES.INFRASTRUCTURE,
    summary: 'API Performance Metrics',
    description: 'Get API performance and health metrics',
    responses: [
      {
        status: 200,
        description: 'Performance metrics',
        example: {
          metrics: {
            uptime: 0.999,
            responseTime: {
              p50: 150,
              p95: 500,
              p99: 1000
            },
            requestsPerSecond: 100,
            errorRate: 0.001
          }
        }
      }
    ]
  },
  {
    path: '/error-tracking',
    method: 'POST',
    category: API_CATEGORIES.INFRASTRUCTURE,
    summary: 'Report Error',
    description: 'Report client-side errors for tracking',
    requestBody: {
      type: 'object',
      example: {
        error: {
          message: 'Error message',
          stack: '...',
          url: 'https://...',
          userAgent: '...'
        }
      }
    },
    responses: [
      {
        status: 200,
        description: 'Error tracked',
        example: {
          tracked: true,
          id: 'error_123'
        }
      }
    ]
  },

  // ==================== REAL-TIME APIs ====================
  {
    path: '/sse-feed',
    method: 'GET',
    category: API_CATEGORIES.REALTIME,
    summary: 'Real-time Event Feed',
    description: 'Server-Sent Events feed for real-time blockchain updates',
    parameters: [
      {
        name: 'Accept',
        type: 'header',
        required: true,
        description: 'Must be text/event-stream',
        example: 'text/event-stream'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'SSE stream',
        example: 'data: {"type": "transaction", "signature": "...", "timestamp": 1234567890000}'
      }
    ]
  },
  {
    path: '/sse-alerts',
    method: 'GET',
    category: API_CATEGORIES.REALTIME,
    summary: 'Real-time Alerts',
    description: 'Subscribe to real-time alert notifications',
    parameters: [
      {
        name: 'types',
        type: 'query',
        required: false,
        description: 'Alert types to subscribe to',
        example: 'large_transfer,whale_activity'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Alert stream'
      }
    ]
  },

  // ==================== PROGRAM APIs ====================
  {
    path: '/program-registry',
    method: 'GET',
    category: API_CATEGORIES.PROGRAMS,
    summary: 'List Programs',
    description: 'Get list of registered Solana programs',
    parameters: [
      {
        name: 'category',
        type: 'query',
        required: false,
        description: 'Program category filter',
        example: 'defi'
      },
      {
        name: 'verified',
        type: 'query',
        required: false,
        description: 'Show only verified programs',
        example: true
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Program list',
        example: {
          programs: [
            {
              address: '...',
              name: 'Jupiter Aggregator',
              category: 'defi',
              verified: true
            }
          ]
        }
      }
    ]
  },
  {
    path: '/program-registry/{programId}',
    method: 'GET',
    category: API_CATEGORIES.PROGRAMS,
    summary: 'Get Program Details',
    description: 'Get detailed information about a specific program',
    parameters: [
      {
        name: 'programId',
        type: 'path',
        required: true,
        description: 'Program address',
        example: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Program details',
        example: {
          address: '...',
          name: 'Token Program',
          description: 'SPL Token program',
          category: 'system',
          instructions: [],
          usage: {
            transactions: 100000,
            accounts: 5000
          }
        }
      }
    ]
  },

  // ==================== UTILITY APIs ====================
  {
    path: '/solana-rpc',
    method: 'POST',
    category: API_CATEGORIES.UTILITIES,
    summary: 'Direct RPC Access',
    description: 'Direct access to Solana JSON-RPC interface',
    requestBody: {
      type: 'object',
      example: {
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: ['...']
      }
    },
    responses: [
      {
        status: 200,
        description: 'JSON-RPC response'
      }
    ]
  },
  {
    path: '/docs/openapi',
    method: 'GET',
    category: API_CATEGORIES.UTILITIES,
    summary: 'OpenAPI Specification',
    description: 'Get the OpenAPI 3.0 specification for the API',
    parameters: [
      {
        name: 'format',
        type: 'query',
        required: false,
        description: 'Output format',
        example: 'json'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'OpenAPI specification document'
      }
    ]
  }
];

// Helper function to get endpoints by category
export function getEndpointsByCategory(category: string): APIEndpointDoc[] {
  return API_DOCUMENTATION.filter(endpoint => endpoint.category === category);
}

// Helper function to search endpoints
export function searchEndpoints(query: string): APIEndpointDoc[] {
  const lowerQuery = query.toLowerCase();
  return API_DOCUMENTATION.filter(endpoint =>
    endpoint.path.toLowerCase().includes(lowerQuery) ||
    endpoint.summary.toLowerCase().includes(lowerQuery) ||
    endpoint.description.toLowerCase().includes(lowerQuery) ||
    endpoint.category.toLowerCase().includes(lowerQuery)
  );
}

// Generate curl command for an endpoint
export function generateCurlCommand(
  endpoint: APIEndpointDoc,
  baseUrl: string = 'https://osvm.ai/api',
  params?: Record<string, any>
): string {
  let url = baseUrl + endpoint.path;

  // Replace path parameters
  if (params) {
    Object.keys(params).forEach(key => {
      if (url.includes(`{${key}}`)) {
        url = url.replace(`{${key}}`, params[key]);
      }
    });
  }

  let curl = `curl -X ${endpoint.method} '${url}'`;

  // Add headers
  if (endpoint.authentication === 'jwt') {
    curl += ` \\\n  -H 'Authorization: Bearer YOUR_JWT_TOKEN'`;
  } else if (endpoint.authentication === 'api-key') {
    curl += ` \\\n  -H 'X-API-Key: YOUR_API_KEY'`;
  }

  if (endpoint.method !== 'GET') {
    curl += ` \\\n  -H 'Content-Type: application/json'`;
    if (endpoint.requestBody?.example) {
      curl += ` \\\n  -d '${JSON.stringify(endpoint.requestBody.example, null, 2)}'`;
    }
  }

  return curl;
}

// Generate code examples for different languages
export function generateCodeExample(
  endpoint: APIEndpointDoc,
  language: 'javascript' | 'python' | 'go',
  baseUrl: string = 'https://osvm.ai/api'
): string {
  switch (language) {
    case 'javascript':
      return generateJavaScriptExample(endpoint, baseUrl);
    case 'python':
      return generatePythonExample(endpoint, baseUrl);
    case 'go':
      return generateGoExample(endpoint, baseUrl);
    default:
      return '';
  }
}

function generateJavaScriptExample(endpoint: APIEndpointDoc, baseUrl: string): string {
  const url = `${baseUrl}${endpoint.path}`;
  let code = `// ${endpoint.summary}\n`;
  code += `const response = await fetch('${url}'`;

  if (endpoint.method !== 'GET') {
    code += `, {\n  method: '${endpoint.method}',\n`;
    code += `  headers: {\n    'Content-Type': 'application/json'`;
    if (endpoint.authentication === 'jwt') {
      code += `,\n    'Authorization': 'Bearer ' + token`;
    }
    code += `\n  }`;
    if (endpoint.requestBody?.example) {
      code += `,\n  body: JSON.stringify(${JSON.stringify(endpoint.requestBody.example, null, 2)})`;
    }
    code += `\n}`;
  }
  code += `);\n\nconst data = await response.json();`;

  return code;
}

function generatePythonExample(endpoint: APIEndpointDoc, baseUrl: string): string {
  const url = `${baseUrl}${endpoint.path}`;
  let code = `# ${endpoint.summary}\nimport requests\n\n`;
  code += `response = requests.${endpoint.method.toLowerCase()}(\n`;
  code += `    '${url}'`;

  if (endpoint.authentication === 'jwt') {
    code += `,\n    headers={'Authorization': f'Bearer {token}'}`;
  }
  if (endpoint.requestBody?.example) {
    code += `,\n    json=${JSON.stringify(endpoint.requestBody.example)}`;
  }
  code += `\n)\n\ndata = response.json()`;

  return code;
}

function generateGoExample(endpoint: APIEndpointDoc, baseUrl: string): string {
  const url = `${baseUrl}${endpoint.path}`;
  let code = `// ${endpoint.summary}\n`;
  code += `resp, err := http.${endpoint.method === 'GET' ? 'Get' : 'Post'}("${url}"`;

  if (endpoint.method !== 'GET' && endpoint.requestBody?.example) {
    code += `,\n    "application/json",\n    bytes.NewBuffer([]byte(\`${JSON.stringify(endpoint.requestBody.example)}\`))`;
  }
  code += `)\nif err != nil {\n    log.Fatal(err)\n}\ndefer resp.Body.Close()`;

  return code;
}

// Export statistics
export const API_STATS = {
  totalEndpoints: API_DOCUMENTATION.length,
  categories: Object.keys(API_CATEGORIES).length,
  authMethods: ['jwt', 'api-key', 'wallet', 'session', 'none'],
  httpMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
};