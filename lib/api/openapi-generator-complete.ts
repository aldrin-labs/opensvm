import { z } from 'zod';
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
        description: 'Comprehensive API for Solana Virtual Machine Explorer - 97 Core API Routes covering transactions, blockchain data, analytics, DeFi, NFTs, and AI-powered insights',
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
        { name: 'Analytics', description: 'DeFi analytics, validator metrics, and ecosystem health (12 endpoints)' },
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
        responses: {
          '200': {
            status: 200,
            description: 'Successful response'
          },
          '400': {
            status: 400,
            description: 'Bad request'
          },
          '404': {
            status: 404,
            description: 'Not found'
          },
          '500': {
            status: 500,
            description: 'Internal server error'
          }
        },
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
