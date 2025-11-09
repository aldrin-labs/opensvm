import fs from 'fs';
import path from 'path';
import { apiMethods } from '../api-presets';

export interface OpenAPIParameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'body';
  required?: boolean;
  schema: any;
  description?: string;
}

export interface OpenAPIResponse {
  status: number;
  description: string;
  schema?: any;
  examples?: Record<string, any>;
}

export interface OpenAPIEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  summary: string;
  description?: string;
  tags?: string[];
  parameters?: OpenAPIParameter[];
  requestBody?: {
    required?: boolean;
    content: Record<string, { schema: any; examples?: any }>;
  };
  responses: Record<string, OpenAPIResponse>;
  operationId: string;
}

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
    contact?: {
      name: string;
      url: string;
      email: string;
    };
    license?: {
      name: string;
      url: string;
    };
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  paths: Record<string, Record<string, any>>;
  components: {
    schemas: Record<string, any>;
    securitySchemes?: Record<string, any>;
  };
  tags: Array<{
    name: string;
    description: string;
  }>;
}

class OpenAPIGenerator {
  private spec: OpenAPISpec;
  private endpoints: OpenAPIEndpoint[] = [];

  constructor() {
    this.spec = {
      openapi: '3.0.3',
      info: {
        title: 'OpenSVM API - Complete Reference',
        version: '2.0.0',
        description: 'Comprehensive API for Solana Virtual Machine Explorer - 98 Core API Routes covering transactions, blockchain data, analytics, DeFi, NFTs, and AI-powered insights',
        contact: {
          name: 'OpenSVM Team',
          url: 'https://opensvm.com',
          email: 'support@opensvm.com'
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT'
        }
      },
      servers: [
        {
          url: 'http://localhost:3000/api',
          description: 'Development server'
        },
        {
          url: 'https://opensvm.com/api',
          description: 'Production server'
        }
      ],
      paths: {},
      components: {
        schemas: this.getCommonSchemas()
      },
      tags: [
        { name: 'Search & Discovery', description: 'Universal search and program discovery across the blockchain (9 endpoints)' },
        { name: 'Account & Wallet', description: 'Account information, portfolio management, and transaction history (14 endpoints)' },
        { name: 'Transactions', description: 'Transaction analysis, metrics, and failure detection (17 endpoints)' },
        { name: 'Blockchain', description: 'Block data, slot information, and RPC operations (8 endpoints)' },
        { name: 'Tokens & NFTs', description: 'Token information, NFT collections, and metadata (7 endpoints)' },
        { name: 'Analytics', description: 'DeFi analytics, validator metrics, and ecosystem health (13 endpoints)' },
        { name: 'AI-Powered', description: 'AI-powered analysis, question answering, and insights (6 endpoints)' },
        { name: 'Real-Time', description: 'Server-sent events, streaming data, and live feeds (6 endpoints)' },
        { name: 'User Services', description: 'User profiles, activity feeds, and personalization (14 endpoints)' }
      ]
    };

    this.registerAllEndpoints();
  }

  private getCommonSchemas() {
    return {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string', description: 'Error message' },
          code: { type: 'string', description: 'Error code' },
          details: { type: 'object', description: 'Additional error details' }
        },
        required: ['error']
      },
      Transaction: {
        type: 'object',
        properties: {
          signature: { 
            type: 'string', 
            description: 'Transaction signature',
            example: '5vYsYWPF4gdN1imxLpJAWi9QKpN3MSrFTFXK8pfmPogFjQNPiAkxFQCGzEEWNto16mWnwmdwNQH7KPCnkMcZ9Ba5'
          },
          slot: { type: 'integer', description: 'Slot number' },
          blockTime: { type: 'integer', description: 'Block timestamp' },
          fee: { type: 'integer', description: 'Transaction fee in lamports' },
          status: { 
            type: 'string', 
            enum: ['success', 'failed'],
            description: 'Transaction status' 
          }
        }
      },
      Account: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Account address' },
          lamports: { type: 'integer', description: 'Account balance in lamports' },
          owner: { type: 'string', description: 'Program that owns this account' },
          executable: { type: 'boolean', description: 'Whether account is executable' }
        }
      },
      Block: {
        type: 'object',
        properties: {
          slot: { type: 'integer', description: 'Block slot number' },
          blockhash: { type: 'string', description: 'Block hash' },
          blockTime: { type: 'integer', description: 'Block timestamp' },
          blockHeight: { type: 'integer', description: 'Block height' }
        }
      },
      TokenInfo: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Token mint address' },
          symbol: { type: 'string', description: 'Token symbol' },
          name: { type: 'string', description: 'Token name' },
          decimals: { type: 'integer', description: 'Token decimal places' },
          supply: { type: 'string', description: 'Token total supply' }
        }
      },
      // Market Data & OHLCV Schemas
      OHLCVCandle: {
        type: 'object',
        required: ['o', 'h', 'l', 'c', 'v', 'unixTime'],
        properties: {
          o: { type: 'number', description: 'Open price', example: 0.001234 },
          h: { type: 'number', description: 'High price', example: 0.001256 },
          l: { type: 'number', description: 'Low price', example: 0.001210 },
          c: { type: 'number', description: 'Close price', example: 0.001245 },
          v: { type: 'number', description: 'Volume in USD', example: 125430.50 },
          unixTime: { type: 'integer', description: 'Unix timestamp in seconds', example: 1699545600 },
          address: { type: 'string', description: 'Token address' },
          type: { type: 'string', description: 'Timeframe type (e.g., "1H")', example: '1H' },
          currency: { type: 'string', description: 'Currency (usually "usd")', example: 'usd' }
        }
      },
      TokenMarketInfo: {
        type: 'object',
        properties: {
          symbol: { type: 'string', example: 'BONK' },
          name: { type: 'string', example: 'Bonk' },
          decimals: { type: 'integer', example: 5 },
          address: { type: 'string', example: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
          liquidity: { type: 'number', example: 1250000.50 },
          price: { type: 'number', example: 0.00001234 },
          volume24h: { type: 'number', example: 5420000.75 }
        }
      },
      PoolInfo: {
        type: 'object',
        properties: {
          symbol: { type: 'string', example: 'BONK/USDC' },
          name: { type: 'string', example: 'Bonk-USDC Pool' },
          liquidity: { type: 'number', example: 1250000.50 },
          price: { type: 'number', example: 0.00001234 },
          volume24h: { type: 'number', example: 5420000.75 },
          dex: { type: 'string', example: 'Raydium' },
          pair: { type: 'string', example: 'BONK/USDC' },
          poolAddress: { type: 'string', example: '8kJqxAbqbPAvJKuomNFtWfJZMh3ZPSFMaGw2JTJfhHqe' },
          baseToken: { $ref: '#/components/schemas/TokenMarketInfo' },
          quoteToken: { $ref: '#/components/schemas/TokenMarketInfo' }
        }
      },
      TechnicalIndicators: {
        type: 'object',
        properties: {
          ma7: {
            type: 'array',
            items: { type: 'number' },
            description: '7-period moving average'
          },
          ma25: {
            type: 'array',
            items: { type: 'number' },
            description: '25-period moving average'
          },
          macd: {
            type: 'object',
            properties: {
              line: { type: 'array', items: { type: 'number' } },
              signal: { type: 'array', items: { type: 'number' } },
              histogram: { type: 'array', items: { type: 'number' } }
            }
          }
        }
      },
      MarketDataResponse: {
        type: 'object',
        required: ['success', 'endpoint', 'mint', 'data'],
        properties: {
          success: { type: 'boolean', example: true },
          endpoint: { type: 'string', example: 'ohlcv' },
          mint: { type: 'string', example: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
          tokenInfo: { $ref: '#/components/schemas/TokenMarketInfo' },
          mainPair: {
            type: 'object',
            properties: {
              pair: { type: 'string', example: 'BONK/USDC' },
              dex: { type: 'string', example: 'Raydium' },
              poolAddress: { type: 'string', example: '8kJqxAbqbPAvJKuomNFtWfJZMh3ZPSFMaGw2JTJfhHqe' }
            }
          },
          pools: {
            type: 'array',
            items: { $ref: '#/components/schemas/PoolInfo' }
          },
          data: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: { $ref: '#/components/schemas/OHLCVCandle' }
              }
            }
          },
          indicators: { $ref: '#/components/schemas/TechnicalIndicators' },
          raw: { type: 'object', description: 'Raw API response from Birdeye' }
        }
      },
      TokenSecurityData: {
        type: 'object',
        properties: {
          creatorBalance: { type: 'number', example: 0.999744017 },
          creatorPercentage: { type: 'number', example: 9.998841964586756e-10 },
          top10HolderPercent: { type: 'number', example: 0.23566702589502325 },
          freezeAuthority: { type: 'boolean', example: false },
          mintAuthority: { type: 'boolean', example: false },
          lpBurn: { type: 'boolean', example: false },
          isHoneypot: { type: 'boolean', example: false }
        }
      },
      TokenSecurityResponse: {
        type: 'object',
        required: ['success', 'data', 'address'],
        properties: {
          success: { type: 'boolean', example: true },
          data: { $ref: '#/components/schemas/TokenSecurityData' },
          address: { type: 'string', example: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
          analyzed_at: { type: 'string', format: 'date-time', example: '2025-11-09T12:34:56.789Z' }
        }
      },
      // Search & Discovery Schemas
      SearchResult: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['account', 'transaction', 'block', 'program', 'token'], example: 'account' },
          address: { type: 'string', example: '7aDTuuAN98tBanLcJQgq2oVaXztBzMgLNRu84iVqnVVH' },
          signature: { type: 'string', example: '5vYsYWPF4gdN1imxLpJAWi9QKpN3MSrFTFXK8pfmPogFjQNPiAkxFQCGzEEWNto16mWnwmdwNQH7KPCnkMcZ9Ba5' },
          name: { type: 'string', example: 'Raydium AMM' },
          description: { type: 'string', example: 'Automated market maker program' },
          metadata: { type: 'object' }
        }
      },
      SearchResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          query: { type: 'string', example: 'raydium' },
          results: { type: 'array', items: { $ref: '#/components/schemas/SearchResult' } },
          count: { type: 'integer', example: 10 }
        }
      },
      // Account & Wallet Schemas
      AccountInfo: {
        type: 'object',
        properties: {
          address: { type: 'string', example: '7aDTuuAN98tBanLcJQgq2oVaXztBzMgLNRu84iVqnVVH' },
          lamports: { type: 'integer', example: 5000000000, description: 'Balance in lamports' },
          owner: { type: 'string', example: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
          executable: { type: 'boolean', example: false },
          rentEpoch: { type: 'integer', example: 361 },
          data: { type: 'object' }
        }
      },
      PortfolioResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          address: { type: 'string' },
          totalValue: { type: 'number', example: 1234.56, description: 'Total value in USD' },
          tokens: { type: 'array', items: { $ref: '#/components/schemas/TokenInfo' } },
          nfts: { type: 'array', items: { type: 'object' } }
        }
      },
      // Transaction Schemas
      TransactionDetail: {
        type: 'object',
        properties: {
          signature: { type: 'string' },
          slot: { type: 'integer' },
          blockTime: { type: 'integer' },
          fee: { type: 'integer', description: 'Fee in lamports' },
          status: { type: 'string', enum: ['success', 'failed'] },
          instructions: { type: 'array', items: { type: 'object' } },
          accounts: { type: 'array', items: { type: 'string' } },
          logMessages: { type: 'array', items: { type: 'string' } }
        }
      },
      TransactionListResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          transactions: { type: 'array', items: { $ref: '#/components/schemas/Transaction' } },
          count: { type: 'integer', example: 100 },
          hasMore: { type: 'boolean', example: true }
        }
      },
      // Block & Blockchain Schemas
      BlockDetail: {
        type: 'object',
        properties: {
          slot: { type: 'integer', example: 290000000 },
          blockhash: { type: 'string', example: 'FzGFHzT8RYq3Q1LqULvZnR8YG3HWfQ2jP4fXe7iG8xKz' },
          blockTime: { type: 'integer', example: 1699545600 },
          blockHeight: { type: 'integer', example: 250000000 },
          previousBlockhash: { type: 'string' },
          parentSlot: { type: 'integer' },
          transactions: { type: 'array', items: { $ref: '#/components/schemas/Transaction' } }
        }
      },
      // Analytics Schemas
      AnalyticsResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          timestamp: { type: 'string', format: 'date-time' },
          metrics: { type: 'object' },
          data: { type: 'object' }
        }
      },
      // AI-Powered Schemas
      AIAnswerResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          answer: { type: 'string', example: 'The transaction was successful and transferred 5 SOL...' },
          sources: { type: 'array', items: { type: 'object' } },
          confidence: { type: 'number', example: 0.95 },
          executedTools: { type: 'array', items: { type: 'string' } }
        }
      },
      // Generic Success Response
      SuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Operation completed successfully' },
          data: { type: 'object', description: 'Response data' }
        }
      }
    };
  }

  private registerAllEndpoints() {
    // Convert imported API methods to OpenAPI endpoints
    apiMethods.forEach(method => {
      const endpoint: OpenAPIEndpoint = {
        path: this.convertEndpointPath(method.endpoint),
        method: method.method,
        summary: method.name,
        description: method.description,
        tags: [method.category],
        parameters: this.extractParameters(method.endpoint, method.method),
        responses: this.getResponsesForEndpoint(method.endpoint, method.id),
        operationId: method.id
      };

      if (method.method === 'POST' || method.method === 'PUT' || method.method === 'PATCH') {
        endpoint.requestBody = {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                description: `Request body for ${method.name}`
              }
            }
          }
        };
      }

      this.addEndpoint(endpoint);
    });
  }

  private getResponsesForEndpoint(endpoint: string, operationId: string): Record<string, OpenAPIResponse> {
    const errorSchema = { $ref: '#/components/schemas/Error' };
    
    const baseResponses: Record<string, OpenAPIResponse> = {
      '400': {
        status: 400,
        description: 'Bad request - Invalid parameters',
        schema: errorSchema
      },
      '404': {
        status: 404,
        description: 'Not found',
        schema: errorSchema
      },
      '500': {
        status: 500,
        description: 'Internal server error',
        schema: errorSchema
      }
    };

    // Determine response schema based on endpoint pattern
    let responseSchema: any;
    let description = 'Successful response';

    // Market Data endpoints
    if (endpoint.includes('/market-data') || operationId === 'market-data') {
      responseSchema = { $ref: '#/components/schemas/MarketDataResponse' };
      description = 'Market data retrieved successfully';
    }
    // Search endpoints
    else if (endpoint.includes('/search') || operationId.includes('search')) {
      responseSchema = { $ref: '#/components/schemas/SearchResponse' };
      description = 'Search results retrieved successfully';
    }
    // Account/Wallet endpoints
    else if (endpoint.includes('/account') || endpoint.includes('/wallet') || endpoint.includes('/portfolio')) {
      if (endpoint.includes('/portfolio')) {
        responseSchema = { $ref: '#/components/schemas/PortfolioResponse' };
        description = 'Portfolio data retrieved successfully';
      } else {
        responseSchema = { $ref: '#/components/schemas/AccountInfo' };
        description = 'Account information retrieved successfully';
      }
    }
    // Transaction endpoints
    else if (endpoint.includes('/transaction') || endpoint.includes('/tx')) {
      if (endpoint.includes('/transactions') || endpoint.includes('/history')) {
        responseSchema = { $ref: '#/components/schemas/TransactionListResponse' };
        description = 'Transaction list retrieved successfully';
      } else {
        responseSchema = { $ref: '#/components/schemas/TransactionDetail' };
        description = 'Transaction details retrieved successfully';
      }
    }
    // Block endpoints
    else if (endpoint.includes('/block') || endpoint.includes('/slot')) {
      responseSchema = { $ref: '#/components/schemas/BlockDetail' };
      description = 'Block information retrieved successfully';
    }
    // Token/NFT endpoints
    else if (endpoint.includes('/token') || endpoint.includes('/nft')) {
      responseSchema = { $ref: '#/components/schemas/TokenInfo' };
      description = 'Token information retrieved successfully';
    }
    // Analytics endpoints
    else if (endpoint.includes('/analytics') || operationId.includes('analytics')) {
      responseSchema = { $ref: '#/components/schemas/AnalyticsResponse' };
      description = 'Analytics data retrieved successfully';
    }
    // AI-powered endpoints
    else if (endpoint.includes('/getAnswer') || endpoint.includes('/ai-') || operationId.includes('ai-')) {
      responseSchema = { $ref: '#/components/schemas/AIAnswerResponse' };
      description = 'AI-generated response retrieved successfully';
    }
    // Default generic response
    else {
      responseSchema = { $ref: '#/components/schemas/SuccessResponse' };
      description = 'Operation completed successfully';
    }

    return {
      '200': {
        status: 200,
        description,
        schema: responseSchema
      },
      ...baseResponses
    };
  }

  private convertEndpointPath(endpoint: string): string {
    // Convert /api/... to just /... since base path is already in servers
    let path = endpoint.replace('/api/', '/');
    
    // Convert {param} style to OpenAPI format if needed
    path = path.replace(/\{([^}]+)\}/g, '{$1}');
    
    return path;
  }

  private extractParameters(endpoint: string, method: string): OpenAPIParameter[] {
    const parameters: OpenAPIParameter[] = [];
    
    // Extract path parameters
    const pathParams = endpoint.match(/\{([^}]+)\}/g);
    if (pathParams) {
      pathParams.forEach(param => {
        const paramName = param.replace(/[{}]/g, '');
        parameters.push({
          name: paramName,
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: `${paramName} parameter`
        });
      });
    }

    // Special handling for market-data endpoint
    if (endpoint.includes('/market-data')) {
      parameters.push({
        name: 'mint',
        in: 'query',
        required: false,
        schema: { type: 'string' },
        description: 'Token mint address (defaults to OSVM token: DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263)'
      });
      parameters.push({
        name: 'endpoint',
        in: 'query',
        required: false,
        schema: { 
          type: 'string',
          enum: ['ohlcv', 'overview', 'security'],
          default: 'ohlcv'
        },
        description: 'Type of market data to fetch'
      });
      parameters.push({
        name: 'type',
        in: 'query',
        required: false,
        schema: { 
          type: 'string',
          enum: ['1m', '3m', '5m', '15m', '30m', '1H', '2H', '4H', '6H', '8H', '12H', '1D', '3D', '1W', '1M'],
          default: '1H'
        },
        description: 'OHLCV candlestick timeframe (only for endpoint=ohlcv)'
      });
      parameters.push({
        name: 'baseMint',
        in: 'query',
        required: false,
        schema: { type: 'string' },
        description: 'Filter results by base token mint address'
      });
      parameters.push({
        name: 'poolAddress',
        in: 'query',
        required: false,
        schema: { type: 'string' },
        description: 'Query specific DEX pool address'
      });
      return parameters;
    }

    // Add common query parameters for GET requests
    if (method === 'GET') {
      if (endpoint.includes('transactions') || endpoint.includes('blocks')) {
        parameters.push({
          name: 'limit',
          in: 'query',
          required: false,
          schema: { type: 'integer', default: 10 },
          description: 'Number of results to return'
        });
        parameters.push({
          name: 'offset',
          in: 'query',
          required: false,
          schema: { type: 'integer', default: 0 },
          description: 'Offset for pagination'
        });
      }
    }

    return parameters;
  }

  private addEndpoint(endpoint: OpenAPIEndpoint) {
    this.endpoints.push(endpoint);
  }

  public generateSpec(): OpenAPISpec {
    // Build paths from endpoints
    this.spec.paths = {};
    
    for (const endpoint of this.endpoints) {
      if (!this.spec.paths[endpoint.path]) {
        this.spec.paths[endpoint.path] = {};
      }

      const operation: any = {
        summary: endpoint.summary,
        description: endpoint.description,
        tags: endpoint.tags || [],
        operationId: endpoint.operationId,
        parameters: endpoint.parameters,
        responses: {}
      };

      // Add request body if present
      if (endpoint.requestBody) {
        operation.requestBody = endpoint.requestBody;
      }

      // Add responses
      for (const [status, response] of Object.entries(endpoint.responses)) {
        operation.responses[status] = {
          description: response.description,
          ...(response.schema && {
            content: {
              'application/json': {
                schema: response.schema
              }
            }
          })
        };
      }

      this.spec.paths[endpoint.path][endpoint.method.toLowerCase()] = operation;
    }

    return this.spec;
  }

  public generateSpecFile(outputPath: string): void {
    const spec = this.generateSpec();
    fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2));
  }

  public generateSpecYaml(outputPath: string): void {
    const spec = this.generateSpec();
    // For YAML generation, you'd typically use a YAML library
    // For now, we'll just generate JSON
    fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2));
  }

  // Scan API routes directory and auto-generate endpoints
  public async scanApiRoutes(apiDir: string): Promise<void> {
    try {
      const routes = this.findApiRoutes(apiDir);
      
      for (const route of routes) {
        // Analyze route file and extract endpoint information
        const endpointInfo = this.analyzeRouteFile(route);
        if (endpointInfo) {
          this.addEndpoint(endpointInfo);
        }
      }
    } catch (error) {
      console.error('Error scanning API routes:', error);
    }
  }

  private findApiRoutes(dir: string, routes: string[] = []): string[] {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        this.findApiRoutes(fullPath, routes);
      } else if (file === 'route.ts' || file === 'route.js') {
        routes.push(fullPath);
      }
    }
    
    return routes;
  }

  private analyzeRouteFile(filePath: string): OpenAPIEndpoint | null {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Extract route path from file path
      const relativePath = path.relative('app/api', path.dirname(filePath));
      const apiPath = '/' + relativePath.replace(/\\/g, '/').replace(/\[([^\]]+)\]/g, '{$1}');
      
      // Basic analysis - in a real implementation, you'd parse the TypeScript/JavaScript
      const hasGET = content.includes('export async function GET');
      const hasPOST = content.includes('export async function POST');
      const hasPUT = content.includes('export async function PUT');
      const hasDELETE = content.includes('export async function DELETE');
      
      if (hasGET || hasPOST || hasPUT || hasDELETE) {
        const method = hasGET ? 'GET' : hasPOST ? 'POST' : hasPUT ? 'PUT' : 'DELETE';
        
        return {
          path: apiPath,
          method: method as any,
          summary: `${method} ${apiPath}`,
          description: `Auto-generated endpoint for ${apiPath}`,
          tags: [this.inferTagFromPath(apiPath)],
          responses: {
            '200': {
              status: 200,
              description: 'Successful response',
              schema: { type: 'object' }
            }
          },
          operationId: this.generateOperationId(method, apiPath)
        };
      }
    } catch (error) {
      console.error('Error analyzing route file:', filePath, error);
    }
    
    return null;
  }

  private inferTagFromPath(path: string): string {
    if (path.includes('/transaction')) return 'Transactions';
    if (path.includes('/account')) return 'Account & Wallet';
    if (path.includes('/block')) return 'Blockchain';
    if (path.includes('/search')) return 'Search & Discovery';
    if (path.includes('/analyze') || path.includes('/getAnswer')) return 'AI-Powered';
    if (path.includes('/analytics')) return 'Analytics';
    if (path.includes('/token') || path.includes('/nft')) return 'Tokens & NFTs';
    if (path.includes('/sse') || path.includes('/stream')) return 'Real-Time';
    if (path.includes('/user')) return 'User Services';
    return 'General';
  }

  private generateOperationId(method: string, path: string): string {
    const cleanPath = path.replace(/[{}]/g, '').replace(/\//g, '_').replace(/_+/g, '_');
    return method.toLowerCase() + cleanPath.split('_').map(part => 
      part.charAt(0).toUpperCase() + part.slice(1)
    ).join('');
  }
}

export const openApiGenerator = new OpenAPIGenerator();
export default OpenAPIGenerator;
