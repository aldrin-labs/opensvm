#!/usr/bin/env node

/**
 * OpenAPI 3.0 Specification Generator
 * Generates a comprehensive OpenAPI spec from API_REFERENCE.md
 */

const fs = require('fs');
const path = require('path');

// Read API_REFERENCE.md
const apiRefPath = path.join(process.cwd(), 'API_REFERENCE.md');
const apiRefContent = fs.readFileSync(apiRefPath, 'utf-8');

// Parse the markdown to extract endpoint information
const endpoints = [];
const lines = apiRefContent.split('\n');
let currentEndpoint = null;
let currentSection = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Match endpoint headers like "### GET /api/endpoint" or "### GET, POST /api/endpoint"
  const endpointMatch = line.match(/^### ((?:GET|POST|PUT|DELETE|PATCH)(?:,\s*(?:GET|POST|PUT|DELETE|PATCH))*)\s+(.+)$/);
  if (endpointMatch) {
    if (currentEndpoint) {
      endpoints.push(currentEndpoint);
    }
    
    // Split methods by comma and trim whitespace
    const methods = endpointMatch[1].split(',').map(m => m.trim());
    const path = endpointMatch[2].trim();
    
    currentEndpoint = {
      path: path,
      methods: methods,
      description: '',
      parameters: [],
      authentication: false,
      requestBody: null,
      responses: {}
    };
    currentSection = null;
    continue;
  }
  
  if (!currentEndpoint) continue;
  
  // Match description
  const descMatch = line.match(/^\*\*Description\*\*:\s*(.+)$/);
  if (descMatch) {
    currentEndpoint.description = descMatch[1];
    continue;
  }
  
  // Match authentication requirement
  if (line.includes('**Authentication**: Required')) {
    currentEndpoint.authentication = true;
    continue;
  }
  
  // Match parameter sections
  if (line.includes('**Query Parameters**:')) {
    currentSection = 'query';
    continue;
  }
  if (line.includes('**Path Parameters**:')) {
    currentSection = 'path';
    continue;
  }
  
  // Parse parameter table rows
  if (currentSection && line.startsWith('| `')) {
    const paramMatch = line.match(/\|\s*`([^`]+)`\s*\|\s*(\w+)\s*\|\s*(.+?)\s*\|/);
    if (paramMatch) {
      currentEndpoint.parameters.push({
        name: paramMatch[1],
        in: currentSection,
        type: paramMatch[2],
        description: paramMatch[3]
      });
    }
  }
}

// Add last endpoint
if (currentEndpoint) {
  endpoints.push(currentEndpoint);
}

// Generate OpenAPI spec
const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'OpenSVM API',
    version: '1.0.0',
    description: 'Comprehensive Solana blockchain explorer and analytics platform with AI-powered features',
    contact: {
      name: 'OpenSVM Support',
      email: 'api@opensvm.com',
      url: 'https://opensvm.com'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: 'https://opensvm.com/api',
      description: 'Production server'
    },
    {
      url: 'http://localhost:3000/api',
      description: 'Development server'
    }
  ],
  tags: [
    { name: 'Blockchain', description: 'Blockchain core operations (transactions, blocks, accounts)' },
    { name: 'Tokens', description: 'Token and NFT operations' },
    { name: 'Analytics', description: 'DeFi, DEX, and market analytics' },
    { name: 'AI', description: 'AI-powered analysis and question answering' },
    { name: 'Search', description: 'Search and discovery endpoints' },
    { name: 'User', description: 'User profiles, history, and social features' },
    { name: 'Real-Time', description: 'Streaming and SSE endpoints' },
    { name: 'Monitoring', description: 'Health checks and monitoring' },
    { name: 'Trading', description: 'Trading terminal and market data' },
    { name: 'Auth', description: 'Authentication and API key management' }
  ],
  paths: {},
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token or API key authentication'
      }
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'object' }
            }
          },
          timestamp: { type: 'string', format: 'date-time' }
        }
      },
      Success: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'object' },
          timestamp: { type: 'string', format: 'date-time' }
        }
      },
      AccountStatsResponse: {
        type: 'object',
        properties: {
          totalTransactions: { type: ['string', 'number'], description: 'Total transaction count (may be "1000+" for large accounts)' },
          tokenTransfers: { type: 'number', description: 'Number of token transfers in last 24h' },
          lastUpdated: { type: 'number', description: 'Timestamp of last update' }
        }
      },
      AccountPortfolioResponse: {
        type: 'object',
        properties: {
          address: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
          data: {
            type: 'object',
            properties: {
              native: {
                type: 'object',
                properties: {
                  balance: { type: 'number' },
                  symbol: { type: 'string', example: 'SOL' },
                  name: { type: 'string', example: 'Solana' },
                  decimals: { type: 'number', example: 9 },
                  price: { type: ['number', 'null'] },
                  value: { type: ['number', 'null'] },
                  change24h: { type: ['number', 'null'] }
                }
              },
              tokens: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    mint: { type: 'string' },
                    balance: { type: 'number' },
                    symbol: { type: 'string' },
                    name: { type: 'string' },
                    decimals: { type: 'number' },
                    price: { type: ['number', 'null'] },
                    value: { type: ['number', 'null'] },
                    change24h: { type: ['number', 'null'] },
                    logo: { type: ['string', 'null'] }
                  }
                }
              },
              totalValue: { type: ['number', 'null'] },
              totalTokens: { type: 'number' }
            }
          }
        }
      },
      TransactionListResponse: {
        type: 'object',
        properties: {
          transactions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                signature: { type: 'string' },
                blockTime: { type: ['number', 'null'] },
                slot: { type: 'number' },
                err: { type: ['object', 'null'] },
                memo: { type: ['string', 'null'] }
              }
            }
          },
          hasMore: { type: 'boolean' },
          cursor: { type: ['string', 'null'] }
        }
      },
      TransferListResponse: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                txId: { type: 'string', description: 'Transaction signature' },
                date: { type: 'string', format: 'date-time', description: 'ISO 8601 timestamp of the transaction' },
                from: { type: 'string', description: 'Sender wallet address' },
                to: { type: 'string', description: 'Recipient wallet address' },
                tokenSymbol: { type: 'string', description: 'Token symbol (e.g., SOL, USDC, SVMAI)' },
                tokenAmount: { type: 'string', description: 'Transfer amount in token\'s native units' },
                transferType: { type: 'string', enum: ['IN', 'OUT'], description: 'Direction of transfer relative to queried address' },
                mint: { type: 'string', description: 'Token mint address or \'SOL\' for native transfers' },
                txType: { type: 'string', enum: ['sol', 'spl', 'defi', 'nft', 'program', 'system', 'funding'], description: 'Transaction category' },
                programId: { type: 'string', description: 'Program ID for DeFi/complex transactions (optional)' }
              },
              required: ['txId', 'date', 'from', 'to', 'tokenSymbol', 'tokenAmount', 'transferType', 'mint', 'txType']
            }
          },
          hasMore: { type: 'boolean', description: 'Indicates if more transfers are available for pagination' },
          total: { type: 'integer', description: 'Number of transfers returned in this response' },
          originalTotal: { type: 'integer', description: 'Total number of transfers before pagination' },
          nextPageSignature: { type: 'string', description: 'Signature to use for next page (optional)' },
          fromCache: { type: 'boolean', description: 'Indicates if data was served from cache' }
        },
        required: ['data', 'hasMore', 'total', 'originalTotal', 'fromCache']
      },
      TransactionDetailResponse: {
        type: 'object',
        properties: {
          signature: { type: 'string' },
          blockTime: { type: ['number', 'null'] },
          slot: { type: 'number' },
          meta: { type: 'object' },
          transaction: { type: 'object' }
        }
      },
      BlockListResponse: {
        type: 'object',
        properties: {
          blocks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                slot: { type: 'number' },
                blockTime: { type: ['number', 'null'] },
                blockHeight: { type: 'number' },
                transactions: { type: 'number' }
              }
            }
          },
          hasMore: { type: 'boolean' }
        }
      },
      TokenInfoResponse: {
        type: 'object',
        properties: {
          mint: { type: 'string' },
          symbol: { type: 'string' },
          name: { type: 'string' },
          decimals: { type: 'number' },
          supply: { type: 'string' },
          holders: { type: 'number' }
        }
      },
      MarketDataResponse: {
        type: 'object',
        properties: {
          tokenInfo: {
            type: 'object',
            properties: {
              symbol: { type: 'string' },
              name: { type: 'string' },
              price: { type: 'number' },
              liquidity: { type: 'number' },
              volume24h: { type: 'number' }
            }
          },
          pools: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                poolAddress: { type: 'string' },
                dex: { type: 'string' },
                pair: { type: 'string' },
                price: { type: 'number' },
                liquidity: { type: 'number' },
                volume24h: { type: 'number' }
              }
            }
          }
        }
      },
      ChartDataResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    unixTime: { type: 'number' },
                    type: { type: 'string' },
                    open: { type: 'number' },
                    high: { type: 'number' },
                    low: { type: 'number' },
                    close: { type: 'number' },
                    volume: { type: 'number' }
                  }
                }
              }
            }
          }
        }
      },
      TradesResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                signature: { type: 'string' },
                blockTime: { type: 'number' },
                source: { type: 'string' },
                side: { type: 'string', enum: ['buy', 'sell'] },
                price: { type: 'number' },
                amount: { type: 'number' },
                volumeUSD: { type: 'number' }
              }
            }
          }
        }
      },
      SearchResultsResponse: {
        type: 'object',
        properties: {
          results: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['account', 'transaction', 'token', 'program'] },
                address: { type: 'string' },
                signature: { type: 'string' },
                name: { type: 'string' },
                symbol: { type: 'string' }
              }
            }
          },
          total: { type: 'number' }
        }
      },
      AIAnswerResponse: {
        type: 'object',
        properties: {
          answer: { type: 'string', description: 'AI-generated answer to the question' },
          sources: {
            type: 'array',
            items: { type: 'string' },
            description: 'Data sources used to generate the answer'
          },
          confidence: { type: 'number', description: 'Confidence score (0-1)' },
          timestamp: { type: 'string', format: 'date-time' }
        }
      },
      TransactionResponse: {
        type: 'object',
        properties: {
          signature: { type: 'string' },
          blockTime: { type: ['number', 'null'] },
          slot: { type: 'number' },
          meta: { type: 'object' },
          transaction: { type: 'object' },
          parsed: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              info: { type: 'object' }
            }
          }
        }
      },
      BlockResponse: {
        type: 'object',
        properties: {
          slot: { type: 'number' },
          blockTime: { type: ['number', 'null'] },
          blockHeight: { type: 'number' },
          blockhash: { type: 'string' },
          previousBlockhash: { type: 'string' },
          parentSlot: { type: 'number' },
          transactions: {
            type: 'array',
            items: { type: 'object' }
          },
          rewards: {
            type: 'array',
            items: { type: 'object' }
          }
        }
      },
      DeFiOverviewResponse: {
        type: 'object',
        properties: {
          totalValueLocked: { type: 'number' },
          totalVolume24h: { type: 'number' },
          topProtocols: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                tvl: { type: 'number' },
                volume24h: { type: 'number' },
                change24h: { type: 'number' }
              }
            }
          },
          timestamp: { type: 'string', format: 'date-time' }
        }
      },
      NFTCollectionsResponse: {
        type: 'object',
        properties: {
          collections: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                address: { type: 'string' },
                name: { type: 'string' },
                symbol: { type: 'string' },
                floorPrice: { type: 'number' },
                volume24h: { type: 'number' },
                items: { type: 'number' },
                owners: { type: 'number' }
              }
            }
          },
          total: { type: 'number' }
        }
      },
      SearchResponse: {
        type: 'object',
        properties: {
          results: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['account', 'transaction', 'token', 'program', 'block'] },
                address: { type: 'string' },
                signature: { type: 'string' },
                name: { type: 'string' },
                symbol: { type: 'string' },
                relevance: { type: 'number' }
              }
            }
          },
          total: { type: 'number' },
          query: { type: 'string' }
        }
      },
      TokenMetadataResponse: {
        type: 'object',
        properties: {
          mint: { type: 'string' },
          symbol: { type: 'string' },
          name: { type: 'string' },
          decimals: { type: 'number' },
          supply: { type: 'string' },
          logo: { type: ['string', 'null'] },
          description: { type: ['string', 'null'] },
          website: { type: ['string', 'null'] },
          twitter: { type: ['string', 'null'] }
        }
      },
      ProgramInfoResponse: {
        type: 'object',
        properties: {
          programId: { type: 'string' },
          name: { type: 'string' },
          category: { type: 'string' },
          verified: { type: 'boolean' },
          description: { type: 'string' },
          website: { type: ['string', 'null'] },
          documentation: { type: ['string', 'null'] }
        }
      }
    }
  }
};

// Helper function to create endpoint-specific response schema
function createResponseSchema(endpointPath) {
  // Map endpoints to their specific response schemas
  const schemaMap = {
    // More specific paths first (exact matches or longer paths)
    // Use :param format as it appears in API_REFERENCE.md before conversion
    '/api/blocks/:slot': 'BlockResponse',
    '/api/transaction/batch': 'TransactionListResponse',
    '/api/token-metadata': 'TokenMetadataResponse',
    '/api/analytics/defi': 'DeFiOverviewResponse',
    '/api/account-transactions': 'TransactionListResponse',
    '/api/account-transfers': 'TransferListResponse',
    '/api/account-portfolio': 'AccountPortfolioResponse',
    '/api/account-stats': 'AccountStatsResponse',
    '/api/nft-collections': 'NFTCollectionsResponse',
    '/api/program': 'ProgramInfoResponse',
    '/api/market-data': 'MarketDataResponse',
    '/api/getAnswer': 'AIAnswerResponse',
    '/api/chart': 'ChartDataResponse',
    '/api/trades': 'TradesResponse',
    '/api/search': 'SearchResponse',
    // Less specific paths last
    '/api/transaction': 'TransactionResponse',
    '/api/blocks': 'BlockListResponse',
    '/api/block': 'BlockResponse',
    '/api/token': 'TokenInfoResponse',
  };
  
  // Check if endpoint matches any schema mapping (exact match first, then prefix)
  if (schemaMap[endpointPath]) {
    return { $ref: `#/components/schemas/${schemaMap[endpointPath]}` };
  }
  
  for (const [pathPrefix, schemaName] of Object.entries(schemaMap)) {
    if (endpointPath.startsWith(pathPrefix)) {
      return { $ref: `#/components/schemas/${schemaName}` };
    }
  }
  
  // Default to generic Success schema
  return { $ref: '#/components/schemas/Success' };
}

// Convert endpoints to OpenAPI paths
endpoints.forEach(endpoint => {
  const pathKey = endpoint.path.replace(/:(\w+)/g, '{$1}');
  
  if (!openApiSpec.paths[pathKey]) {
    openApiSpec.paths[pathKey] = {};
  }
  
  endpoint.methods.forEach(method => {
    const methodLower = method.toLowerCase();
    
    const operation = {
      summary: endpoint.description || `${method} ${endpoint.path}`,
      description: endpoint.description || '',
      parameters: endpoint.parameters.map(param => ({
        name: param.name,
        in: param.in,
        required: param.in === 'path',
        schema: {
          type: param.type === 'number' ? 'number' : 
                param.type === 'boolean' ? 'boolean' :
                param.type.includes('[]') ? 'array' : 'string'
        },
        description: param.description
      })),
      responses: {
        '200': {
          description: 'Successful response',
          content: {
            'application/json': {
              schema: createResponseSchema(endpoint.path)
            }
          }
        },
        '400': {
          description: 'Bad Request',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        '404': {
          description: 'Not Found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        '500': {
          description: 'Internal Server Error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        }
      }
    };
    
    // Add authentication if required
    if (endpoint.authentication) {
      operation.security = [{ BearerAuth: [] }];
    }
    
    // Add request body for POST/PUT/PATCH
    if (['post', 'put', 'patch'].includes(methodLower)) {
      operation.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              description: 'Request payload'
            }
          }
        }
      };
    }
    
    // Assign tag based on path
    if (endpoint.path.includes('/transaction')) operation.tags = ['Blockchain'];
    else if (endpoint.path.includes('/block')) operation.tags = ['Blockchain'];
    else if (endpoint.path.includes('/account')) operation.tags = ['Blockchain'];
    else if (endpoint.path.includes('/token')) operation.tags = ['Tokens'];
    else if (endpoint.path.includes('/nft')) operation.tags = ['Tokens'];
    else if (endpoint.path.includes('/analytics')) operation.tags = ['Analytics'];
    else if (endpoint.path.includes('/dex')) operation.tags = ['Analytics'];
    else if (endpoint.path.includes('/getAnswer') || endpoint.path.includes('/ai-')) operation.tags = ['AI'];
    else if (endpoint.path.includes('/search')) operation.tags = ['Search'];
    else if (endpoint.path.includes('/user-')) operation.tags = ['User'];
    else if (endpoint.path.includes('/sse-') || endpoint.path.includes('/stream')) operation.tags = ['Real-Time'];
    else if (endpoint.path.includes('/health') || endpoint.path.includes('/monitoring')) operation.tags = ['Monitoring'];
    else if (endpoint.path.includes('/trading')) operation.tags = ['Trading'];
    else if (endpoint.path.includes('/auth')) operation.tags = ['Auth'];
    else operation.tags = ['Other'];
    
    openApiSpec.paths[pathKey][methodLower] = operation;
  });
});

// Write OpenAPI spec to file
const outputPath = path.join(process.cwd(), 'public', 'openapi.json');
fs.writeFileSync(outputPath, JSON.stringify(openApiSpec, null, 2));

console.log(`✅ OpenAPI specification generated successfully!`);
console.log(`📄 Output: ${outputPath}`);
console.log(`📊 Total endpoints: ${endpoints.length}`);
console.log(`📋 Total paths: ${Object.keys(openApiSpec.paths).length}`);
console.log(`🏷️  Tags: ${openApiSpec.tags.map(t => t.name).join(', ')}`);
