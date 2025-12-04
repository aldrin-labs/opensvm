#!/usr/bin/env bun
/**
 * DFlow MCP Server - Web Server
 * Handles both HTTP requests and MCP protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { serve } from 'bun';

// API Configuration
const BASE_URL = 'https://api.llm.dflow.org';
const DEFAULT_TIMEOUT = 30000;

class DFlowAPIClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string = BASE_URL, timeout: number = DEFAULT_TIMEOUT) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeout = timeout;
  }

  private makeUrl(path: string): string {
    return `${this.baseUrl}${path.startsWith('/') ? path : '/' + path}`;
  }

  async request(method: string, path: string, options: RequestInit = {}): Promise<any> {
    const url = this.makeUrl(path);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
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

// Initialize MCP server
const server = new Server(
  {
    name: 'dflow-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const apiClient = new DFlowAPIClient();

// Tool definitions (simplified for web server)
const TOOLS: Tool[] = [
  {
    name: 'get_events',
    description: 'Get a paginated list of all events with optional filtering and sorting.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 0, description: 'Maximum number of events to return' },
        cursor: { type: 'integer', minimum: 0, description: 'Pagination cursor' },
      },
      required: [],
    },
  },
  {
    name: 'get_markets',
    description: 'Get a paginated list of markets with optional filtering.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 0, description: 'Number of markets to return' },
        cursor: { type: 'integer', minimum: 0, description: 'Pagination cursor' },
      },
      required: [],
    },
  },
  {
    name: 'get_trades',
    description: 'Get a paginated list of trades across markets with optional filtering.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 0, description: 'Number of trades to return' },
        cursor: { type: 'string', description: 'Pagination cursor' },
      },
      required: [],
    },
  },
];

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool call requests
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Ensure args is defined
  const toolArgs = args || {};

  try {
    let result: any;

    switch (name) {
      case 'get_events':
        result = await apiClient.get('/api/v1/events', toolArgs);
        break;
      case 'get_markets':
        result = await apiClient.get('/api/v1/markets', toolArgs);
        break;
      case 'get_trades':
        result = await apiClient.get('/api/v1/trades', toolArgs);
        break;
      default:
        throw new McpError(-32601, `Method not found: ${name}`);
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

// Web server for HTTP requests
const webServer = {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    
    // Handle MCP JSON-RPC requests
    if (req.method === 'POST' && url.pathname === '/') {
      try {
        const body = await req.json();
        
        // Create MCP request object
        const mcpRequest = {
          jsonrpc: body.jsonrpc || "2.0",
          id: body.id,
          method: body.method,
          params: body.params || {}
        };

        // Handle tools/list
        if (body.method === 'tools.list') {
          return new Response(JSON.stringify({
            jsonrpc: "2.0",
            id: body.id,
            result: { tools: TOOLS }
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Handle tools/call
        if (body.method === 'tools.call') {
          const toolRequest = {
            params: {
              name: body.params.name,
              arguments: body.params.arguments
            }
          };
          
          try {
            const result = await server.request(toolRequest, { 
              method: 'tools/call', 
              params: toolRequest.params 
            });
            
            return new Response(JSON.stringify({
              jsonrpc: "2.0",
              id: body.id,
              result: result
            }), {
              headers: { 'Content-Type': 'application/json' }
            });
          } catch (error) {
            return new Response(JSON.stringify({
              jsonrpc: "2.0",
              id: body.id,
              error: {
                code: -32603,
                message: error instanceof Error ? error.message : String(error)
              }
            }), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }

        // Handle other methods
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          error: { code: -32601, message: 'Method not found' }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });

      } catch (error) {
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: 'Parse error' }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Serve static files
    if (url.pathname === '/' && req.method === 'GET') {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DFlow MCP Server | OpenSVM</title>
    <style>
        body {
            background: #000000;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
        }
        h1 {
            font-size: 32px;
            font-weight: 600;
            margin: 0 0 20px 0;
        }
        .status {
            color: #888888;
            font-size: 16px;
            margin: 20px 0;
        }
        .endpoint {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            padding: 20px;
            margin: 20px 0;
            font-family: monospace;
            border-radius: 0;
        }
        .test {
            background: #ffffff;
            color: #000000;
            border: none;
            padding: 10px 20px;
            font-size: 14px;
            margin: 10px 5px;
            cursor: pointer;
        }
        .test:hover {
            background: #cccccc;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>DFlow MCP Server</h1>
        <div class="status">🟢 MCP Server Running</div>
        
        <div class="endpoint">
            <strong>JSON-RPC Endpoint:</strong><br>
            https://dflow.opensvm.com
        </div>

        <div>
            <button class="test" onclick="testListTools()">Test tools.list</button>
            <button class="test" onclick="testCallTool()">Test tools.call</button>
        </div>

        <div id="result" style="margin-top: 20px; background: rgba(255,255,255,0.05); padding: 15px; display: none;">
            <strong>Response:</strong><br>
            <pre id="response" style="white-space: pre-wrap;"></pre>
        </div>
    </div>

    <script>
        async function testListTools() {
            const response = await fetch('/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 1,
                    method: "tools.list",
                    params: {}
                })
            });
            const result = await response.json();
            showResult(result);
        }

        async function testCallTool() {
            const response = await fetch('/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 2,
                    method: "tools.call",
                    params: {
                        name: "get_events",
                        arguments: { limit: 5 }
                    }
                })
            });
            const result = await response.json();
            showResult(result);
        }

        function showResult(result) {
            document.getElementById('result').style.display = 'block';
            document.getElementById('response').textContent = JSON.stringify(result, null, 2);
        }
    </script>
</body>
</html>`;
      
      return new Response(html, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'dflow-mcp',
        version: '1.0.0',
        tools: TOOLS.length
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 404 for other paths
    return new Response('Not Found', { status: 404 });
  }
};

// Start web server
console.log('DFlow MCP Server starting on port 3000...');
console.log('JSON-RPC endpoint: http://localhost:3000');
console.log('Health check: http://localhost:3000/health');

// Start the server
serve(webServer, {
  port: 3000,
  hostname: '0.0.0.0',
});