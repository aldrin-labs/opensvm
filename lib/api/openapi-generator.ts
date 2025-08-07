import { z } from 'zod';
import fs from 'fs';
import path from 'path';

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
        title: 'OpenSVM API',
        version: '1.0.0',
        description: 'Comprehensive API for Solana Virtual Machine Explorer - transaction analysis, blockchain data, and AI-powered insights',
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
        { name: 'Transactions', description: 'Transaction analysis and data retrieval' },
        { name: 'Accounts', description: 'Account information and statistics' },
        { name: 'Blocks', description: 'Block data and exploration' },
        { name: 'Search', description: 'Search functionality and suggestions' },
        { name: 'Analytics', description: 'Analytics and metrics' },
        { name: 'AI', description: 'AI-powered analysis and insights' },
        { name: 'Monitoring', description: 'Performance and system monitoring' },
        { name: 'Programs', description: 'Smart contract and program analysis' },
        { name: 'Tokens', description: 'Token information and statistics' },
        { name: 'DeFi', description: 'DeFi protocols and analysis' }
      ]
    };

    this.registerKnownEndpoints();
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
            example: '5VfFmLBHnJo1oQq8nrNGJCG5v3cphgKBo7N3N9q8pXqD...'
          },
          slot: { type: 'integer', description: 'Slot number' },
          blockTime: { type: 'integer', description: 'Block timestamp' },
          fee: { type: 'integer', description: 'Transaction fee in lamports' },
          status: { 
            type: 'string', 
            enum: ['success', 'failed'],
            description: 'Transaction status' 
          },
          instructions: {
            type: 'array',
            items: { $ref: '#/components/schemas/Instruction' },
            description: 'Transaction instructions'
          },
          accounts: {
            type: 'array',
            items: { type: 'string' },
            description: 'Account addresses involved'
          }
        }
      },
      Instruction: {
        type: 'object',
        properties: {
          programId: { type: 'string', description: 'Program ID' },
          data: { type: 'string', description: 'Instruction data (base64)' },
          accounts: {
            type: 'array',
            items: { type: 'string' },
            description: 'Account keys'
          },
          parsed: { 
            type: 'object',
            description: 'Parsed instruction data'
          }
        }
      },
      Account: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Account address' },
          lamports: { type: 'integer', description: 'Account balance in lamports' },
          data: { type: 'string', description: 'Account data (base64)' },
          owner: { type: 'string', description: 'Program that owns this account' },
          executable: { type: 'boolean', description: 'Whether account is executable' },
          rentEpoch: { type: 'integer', description: 'Rent epoch' }
        }
      },
      Block: {
        type: 'object',
        properties: {
          slot: { type: 'integer', description: 'Block slot number' },
          blockhash: { type: 'string', description: 'Block hash' },
          previousBlockhash: { type: 'string', description: 'Previous block hash' },
          parentSlot: { type: 'integer', description: 'Parent slot number' },
          transactions: {
            type: 'array',
            items: { $ref: '#/components/schemas/Transaction' },
            description: 'Transactions in block'
          },
          blockTime: { type: 'integer', description: 'Block timestamp' },
          blockHeight: { type: 'integer', description: 'Block height' }
        }
      },
      SearchSuggestion: {
        type: 'object',
        properties: {
          type: { 
            type: 'string',
            enum: ['transaction', 'account', 'block', 'program', 'token'],
            description: 'Suggestion type'
          },
          value: { type: 'string', description: 'Suggestion value' },
          label: { type: 'string', description: 'Display label' },
          description: { type: 'string', description: 'Additional description' },
          metadata: { type: 'object', description: 'Additional metadata' }
        }
      },
      PerformanceMetrics: {
        type: 'object',
        properties: {
          timestamp: { type: 'integer', description: 'Metrics timestamp' },
          fps: { type: 'number', description: 'Frames per second' },
          memoryUsage: {
            type: 'object',
            properties: {
              used: { type: 'integer', description: 'Used memory in bytes' },
              total: { type: 'integer', description: 'Total allocated memory' },
              limit: { type: 'integer', description: 'Memory limit' }
            }
          },
          apiResponseTime: { type: 'number', description: 'API response time in ms' },
          networkLatency: { type: 'number', description: 'Network latency in ms' }
        }
      },
      TokenInfo: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Token mint address' },
          symbol: { type: 'string', description: 'Token symbol' },
          name: { type: 'string', description: 'Token name' },
          decimals: { type: 'integer', description: 'Token decimal places' },
          supply: { type: 'string', description: 'Token total supply' },
          price: { type: 'number', description: 'Current price in USD' },
          marketCap: { type: 'number', description: 'Market capitalization' },
          volume24h: { type: 'number', description: '24h trading volume' }
        }
      }
    };
  }

  private registerKnownEndpoints() {
    // Transaction endpoints
    this.addEndpoint({
      path: '/transaction/{signature}',
      method: 'GET',
      summary: 'Get transaction details',
      description: 'Retrieve detailed information about a specific transaction',
      tags: ['Transactions'],
      parameters: [
        {
          name: 'signature',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Transaction signature'
        }
      ],
      responses: {
        '200': {
          status: 200,
          description: 'Transaction details',
          schema: { $ref: '#/components/schemas/Transaction' },
          examples: {
            'application/json': {
              signature: '5VfFmLBHnJo1oQq8nrNGJCG5v3cphgKBo7N3N9q8pXqD...',
              slot: 12345,
              blockTime: 1640995200,
              fee: 5000,
              status: 'success'
            }
          }
        },
        '404': {
          status: 404,
          description: 'Transaction not found',
          schema: { $ref: '#/components/schemas/Error' }
        }
      },
      operationId: 'getTransaction'
    });

    // Account endpoints
    this.addEndpoint({
      path: '/account/{address}',
      method: 'GET',
      summary: 'Get account information',
      description: 'Retrieve account details including balance and data',
      tags: ['Accounts'],
      parameters: [
        {
          name: 'address',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Account address'
        }
      ],
      responses: {
        '200': {
          status: 200,
          description: 'Account information',
          schema: { $ref: '#/components/schemas/Account' }
        },
        '404': {
          status: 404,
          description: 'Account not found',
          schema: { $ref: '#/components/schemas/Error' }
        }
      },
      operationId: 'getAccount'
    });

    // Block endpoints
    this.addEndpoint({
      path: '/block/{slot}',
      method: 'GET',
      summary: 'Get block information',
      description: 'Retrieve block details including transactions',
      tags: ['Blocks'],
      parameters: [
        {
          name: 'slot',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          description: 'Block slot number'
        }
      ],
      responses: {
        '200': {
          status: 200,
          description: 'Block information',
          schema: { $ref: '#/components/schemas/Block' }
        },
        '404': {
          status: 404,
          description: 'Block not found',
          schema: { $ref: '#/components/schemas/Error' }
        }
      },
      operationId: 'getBlock'
    });

    // Search endpoints
    this.addEndpoint({
      path: '/search/suggestions',
      method: 'GET',
      summary: 'Get search suggestions',
      description: 'Get autocomplete suggestions for search queries',
      tags: ['Search'],
      parameters: [
        {
          name: 'q',
          in: 'query',
          required: true,
          schema: { type: 'string', minLength: 1 },
          description: 'Search query'
        },
        {
          name: 'limit',
          in: 'query',
          required: false,
          schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
          description: 'Maximum number of suggestions'
        }
      ],
      responses: {
        '200': {
          status: 200,
          description: 'Search suggestions',
          schema: {
            type: 'array',
            items: { $ref: '#/components/schemas/SearchSuggestion' }
          }
        }
      },
      operationId: 'getSearchSuggestions'
    });

    // AI Analysis endpoints
    this.addEndpoint({
      path: '/analyze-transaction',
      method: 'POST',
      summary: 'Analyze transaction with AI',
      description: 'Get AI-powered analysis of a transaction',
      tags: ['AI'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                signature: { type: 'string', description: 'Transaction signature' },
                includeContext: { type: 'boolean', default: true },
                analysisType: { 
                  type: 'string',
                  enum: ['basic', 'detailed', 'comprehensive'],
                  default: 'basic'
                }
              },
              required: ['signature']
            }
          }
        }
      },
      responses: {
        '200': {
          status: 200,
          description: 'Transaction analysis',
          schema: {
            type: 'object',
            properties: {
              summary: { type: 'string', description: 'Analysis summary' },
              insights: {
                type: 'array',
                items: { type: 'string' },
                description: 'Key insights'
              },
              riskScore: { type: 'number', minimum: 0, maximum: 1 },
              categories: {
                type: 'array',
                items: { type: 'string' },
                description: 'Transaction categories'
              },
              metadata: { type: 'object', description: 'Additional metadata' }
            }
          }
        },
        '400': {
          status: 400,
          description: 'Invalid request',
          schema: { $ref: '#/components/schemas/Error' }
        }
      },
      operationId: 'analyzeTransaction'
    });

    // Monitoring endpoints
    this.addEndpoint({
      path: '/monitoring/performance',
      method: 'GET',
      summary: 'Get performance metrics',
      description: 'Retrieve current system performance metrics',
      tags: ['Monitoring'],
      parameters: [
        {
          name: 'timeframe',
          in: 'query',
          required: false,
          schema: { 
            type: 'string',
            enum: ['1h', '24h', '7d', '30d'],
            default: '1h'
          },
          description: 'Metrics timeframe'
        }
      ],
      responses: {
        '200': {
          status: 200,
          description: 'Performance metrics',
          schema: {
            type: 'object',
            properties: {
              current: { $ref: '#/components/schemas/PerformanceMetrics' },
              history: {
                type: 'array',
                items: { $ref: '#/components/schemas/PerformanceMetrics' }
              },
              summary: {
                type: 'object',
                properties: {
                  avgFps: { type: 'number' },
                  avgMemoryUsage: { type: 'number' },
                  avgApiResponseTime: { type: 'number' },
                  totalAlerts: { type: 'integer' }
                }
              }
            }
          }
        }
      },
      operationId: 'getPerformanceMetrics'
    });

    // Token endpoints
    this.addEndpoint({
      path: '/token/{mint}',
      method: 'GET',
      summary: 'Get token information',
      description: 'Retrieve token details and market data',
      tags: ['Tokens'],
      parameters: [
        {
          name: 'mint',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Token mint address'
        }
      ],
      responses: {
        '200': {
          status: 200,
          description: 'Token information',
          schema: { $ref: '#/components/schemas/TokenInfo' }
        },
        '404': {
          status: 404,
          description: 'Token not found',
          schema: { $ref: '#/components/schemas/Error' }
        }
      },
      operationId: 'getTokenInfo'
    });
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
        parameters: endpoint.parameters?.map(param => ({
          name: param.name,
          in: param.in,
          required: param.required || false,
          schema: param.schema,
          description: param.description
        })),
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
                schema: response.schema,
                ...(response.examples && { examples: response.examples })
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
      // to extract actual endpoint definitions, parameters, etc.
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
    if (path.includes('/account')) return 'Accounts';
    if (path.includes('/block')) return 'Blocks';
    if (path.includes('/search')) return 'Search';
    if (path.includes('/analyze')) return 'AI';
    if (path.includes('/monitoring')) return 'Monitoring';
    if (path.includes('/token')) return 'Tokens';
    if (path.includes('/program')) return 'Programs';
    if (path.includes('/analytics')) return 'Analytics';
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