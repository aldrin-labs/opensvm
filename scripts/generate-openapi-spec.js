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
      }
    }
  }
};

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
              schema: { $ref: '#/components/schemas/Success' }
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
