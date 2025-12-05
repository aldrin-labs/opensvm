#!/usr/bin/env bun
/**
 * MCP Gateway Server
 *
 * Unified MCP server that aggregates tools from multiple registered servers.
 * Acts as a single entry point for AI clients to access all blockchain tools.
 *
 * Features:
 * - Aggregates tools from OpenSVM + DFlow + any registered servers
 * - Automatic server discovery and health checking
 * - Intelligent routing with failover
 * - Registry management tools
 * - Cross-server pipelines
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
  MCPRegistry,
  createRegistry,
  createGatewayTools,
  type MCPServerInfo,
  type RegisteredTool,
} from './mcp-registry.js';

// ============================================================================
// Configuration
// ============================================================================

export const configSchema = z.object({
  enableDiscovery: z.boolean()
    .describe('Enable automatic server discovery')
    .default(true),
  enableHealthChecks: z.boolean()
    .describe('Enable periodic health checks')
    .default(true),
  healthCheckIntervalMs: z.number()
    .describe('Health check interval in milliseconds')
    .default(30000),
});

interface GatewayConfig {
  enableDiscovery?: boolean;
  enableHealthChecks?: boolean;
  healthCheckIntervalMs?: number;
}

// ============================================================================
// Server Executors
// ============================================================================

/**
 * Execute a tool on the OpenSVM server
 */
async function executeOpenSVMTool(tool: string, args: Record<string, any>): Promise<any> {
  const baseUrl = 'https://osvm.ai';

  // Map tool names to API endpoints
  const toolEndpoints: Record<string, { method: string; path: string | ((args: any) => string) }> = {
    'get_transaction': { method: 'GET', path: (a) => `/api/transaction/${a.signature}` },
    'get_account_portfolio': { method: 'GET', path: (a) => `/api/account-portfolio/${a.address}` },
    'get_account_transactions': { method: 'GET', path: (a) => `/api/account-transactions/${a.address}` },
    'get_account_stats': { method: 'GET', path: (a) => `/api/account-stats/${a.address}` },
    'get_blocks': { method: 'GET', path: '/api/blocks' },
    'get_token_metadata': { method: 'GET', path: '/api/token-metadata' },
    'get_network_status': { method: 'GET', path: '/api/status' },
    'search': { method: 'GET', path: '/api/search-suggestions' },
    'investigate': { method: 'POST', path: '/api/investigate' },
    'ask_ai': { method: 'POST', path: '/api/getAnswer' },
  };

  const endpoint = toolEndpoints[tool];
  if (!endpoint) {
    throw new Error(`Unknown OpenSVM tool: ${tool}`);
  }

  const path = typeof endpoint.path === 'function' ? endpoint.path(args) : endpoint.path;
  const url = new URL(path, baseUrl);

  if (endpoint.method === 'GET') {
    for (const [key, value] of Object.entries(args)) {
      if (value !== undefined && !path.includes(value)) {
        url.searchParams.append(key, String(value));
      }
    }
    const response = await fetch(url.toString());
    return await response.json();
  } else {
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    return await response.json();
  }
}

/**
 * Execute a tool on the DFlow server
 */
async function executeDFlowTool(tool: string, args: Record<string, any>): Promise<any> {
  const baseUrl = 'https://prediction-markets-api.dflow.net';

  const toolEndpoints: Record<string, { method: string; path: string | ((args: any) => string) }> = {
    'get_event': { method: 'GET', path: (a) => `/api/v1/event/${a.event_id}` },
    'get_events': { method: 'GET', path: '/api/v1/events' },
    'get_market': { method: 'GET', path: (a) => `/api/v1/market/${a.market_id}` },
    'get_markets': { method: 'GET', path: '/api/v1/markets' },
    'get_trades': { method: 'GET', path: '/api/v1/trades' },
    'get_series': { method: 'GET', path: '/api/v1/series' },
    'search_events': { method: 'GET', path: '/api/v1/search' },
  };

  const endpoint = toolEndpoints[tool];
  if (!endpoint) {
    throw new Error(`Unknown DFlow tool: ${tool}`);
  }

  const path = typeof endpoint.path === 'function' ? endpoint.path(args) : endpoint.path;
  const url = new URL(path, baseUrl);

  if (endpoint.method === 'GET') {
    for (const [key, value] of Object.entries(args)) {
      if (value !== undefined && !path.includes(String(value))) {
        url.searchParams.append(key, String(value));
      }
    }
  }

  const response = await fetch(url.toString(), {
    method: endpoint.method,
    headers: { 'Content-Type': 'application/json' },
    body: endpoint.method === 'POST' ? JSON.stringify(args) : undefined,
  });

  return await response.json();
}

// ============================================================================
// Gateway Server
// ============================================================================

function createGatewayServer(config?: GatewayConfig) {
  // Create registry
  const registry = createRegistry({
    enableHttpDiscovery: config?.enableDiscovery ?? true,
    healthCheckIntervalMs: config?.healthCheckIntervalMs ?? 30000,
  });

  // Discover and register servers
  registry.discover().then(() => {
    console.log('[Gateway] Discovery complete');
  });

  // Register OpenSVM tools
  const opensvmTools: Tool[] = [
    { name: 'get_transaction', description: 'Get Solana transaction details', inputSchema: { type: 'object', properties: { signature: { type: 'string' } }, required: ['signature'] } },
    { name: 'get_account_portfolio', description: 'Get wallet holdings', inputSchema: { type: 'object', properties: { address: { type: 'string' } }, required: ['address'] } },
    { name: 'get_account_transactions', description: 'Get account transactions', inputSchema: { type: 'object', properties: { address: { type: 'string' }, limit: { type: 'integer' } }, required: ['address'] } },
    { name: 'get_account_stats', description: 'Get account statistics', inputSchema: { type: 'object', properties: { address: { type: 'string' } }, required: ['address'] } },
    { name: 'get_blocks', description: 'Get recent blocks', inputSchema: { type: 'object', properties: { limit: { type: 'integer' } }, required: [] } },
    { name: 'get_token_metadata', description: 'Get token metadata', inputSchema: { type: 'object', properties: { mint: { type: 'string' } }, required: ['mint'] } },
    { name: 'get_network_status', description: 'Get Solana network status', inputSchema: { type: 'object', properties: {}, required: [] } },
    { name: 'search', description: 'Search Solana', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
    { name: 'investigate', description: 'Autonomous blockchain investigation', inputSchema: { type: 'object', properties: { target: { type: 'string' }, type: { type: 'string' } }, required: ['target'] } },
    { name: 'ask_ai', description: 'Ask AI about Solana', inputSchema: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] } },
  ];
  registry.registerTools('opensvm', opensvmTools);

  // Register DFlow tools
  const dflowTools: Tool[] = [
    { name: 'get_event', description: 'Get prediction market event', inputSchema: { type: 'object', properties: { event_id: { type: 'string' } }, required: ['event_id'] } },
    { name: 'get_events', description: 'Get prediction market events', inputSchema: { type: 'object', properties: { limit: { type: 'integer' } }, required: [] } },
    { name: 'get_market', description: 'Get prediction market', inputSchema: { type: 'object', properties: { market_id: { type: 'string' } }, required: ['market_id'] } },
    { name: 'get_markets', description: 'Get prediction markets', inputSchema: { type: 'object', properties: { limit: { type: 'integer' } }, required: [] } },
    { name: 'get_trades', description: 'Get prediction market trades', inputSchema: { type: 'object', properties: { ticker: { type: 'string' } }, required: [] } },
    { name: 'get_series', description: 'Get series templates', inputSchema: { type: 'object', properties: {}, required: [] } },
    { name: 'search_events', description: 'Search prediction market events', inputSchema: { type: 'object', properties: { q: { type: 'string' } }, required: ['q'] } },
  ];
  registry.registerTools('dflow', dflowTools);

  // Start health checks
  if (config?.enableHealthChecks !== false) {
    registry.startHealthChecks();
  }

  // Create MCP server
  const server = new Server(
    {
      name: 'mcp-gateway',
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

  // Get all gateway tools (including registry management)
  const gatewayTools = createGatewayTools(registry);

  // Handle list tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: gatewayTools };
  });

  // Handle list prompts
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: [
        {
          name: 'cross_chain_analysis',
          description: 'Analyze wallet activity across Solana blockchain and prediction markets',
          arguments: [
            { name: 'wallet', description: 'Solana wallet address', required: true },
          ],
        },
        {
          name: 'market_correlation',
          description: 'Find correlations between blockchain activity and prediction market movements',
          arguments: [
            { name: 'event_id', description: 'Prediction market event ID', required: true },
          ],
        },
      ],
    };
  });

  // Handle get prompt
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === 'cross_chain_analysis') {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Analyze the wallet ${args?.wallet} across:
1. Solana blockchain (use opensvm:get_account_portfolio, opensvm:get_account_transactions)
2. Prediction markets (use dflow:get_events, dflow:get_trades)

Provide insights on trading patterns and any prediction market positions.`,
            },
          },
        ],
      };
    }

    if (name === 'market_correlation') {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Analyze correlations for prediction market event ${args?.event_id}:
1. Get event details (dflow:get_event)
2. Get recent trades (dflow:get_trades)
3. Check Solana network status (opensvm:get_network_status)
4. Look for related blockchain activity

Find any correlations between on-chain activity and market movements.`,
            },
          },
        ],
      };
    }

    throw new McpError(ErrorCode.InvalidRequest, `Unknown prompt: ${name}`);
  });

  // Handle list resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: 'gateway://registry/servers',
          name: 'Registered MCP Servers',
          description: 'List of all registered MCP servers with status',
          mimeType: 'application/json',
        },
        {
          uri: 'gateway://registry/tools',
          name: 'Available Tools',
          description: 'All tools available across registered servers',
          mimeType: 'application/json',
        },
        {
          uri: 'gateway://registry/stats',
          name: 'Registry Statistics',
          description: 'Statistics about the MCP gateway',
          mimeType: 'application/json',
        },
      ],
    };
  });

  // Handle read resource
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    if (uri === 'gateway://registry/servers') {
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(registry.getServers(), null, 2),
        }],
      };
    }

    if (uri === 'gateway://registry/tools') {
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(registry.getAllTools().map(t => ({
            name: t.name,
            qualifiedName: t.qualifiedName,
            server: t.serverName,
            description: t.description,
          })), null, 2),
        }],
      };
    }

    if (uri === 'gateway://registry/stats') {
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(registry.getStats(), null, 2),
        }],
      };
    }

    throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const toolArgs = args || {};

    try {
      let result: any;

      // Registry management tools
      if (name === 'registry_list_servers') {
        const servers = registry.getServers();
        const statusFilter = toolArgs.status as string;
        result = statusFilter && statusFilter !== 'all'
          ? servers.filter(s => s.status === statusFilter)
          : servers;
      } else if (name === 'registry_list_tools') {
        const tools = registry.getAllTools();
        result = tools.map(t => ({
          name: t.name,
          qualifiedName: t.qualifiedName,
          server: t.serverName,
          serverId: t.serverId,
          description: t.description,
          callCount: t.callCount,
          avgLatencyMs: t.avgLatencyMs,
        }));
        if (toolArgs.serverId) {
          result = result.filter((t: any) => t.serverId === toolArgs.serverId);
        }
      } else if (name === 'registry_server_health') {
        if (toolArgs.serverId) {
          const status = await registry.checkServerHealth(toolArgs.serverId as string);
          const server = registry.getServer(toolArgs.serverId as string);
          result = { serverId: toolArgs.serverId, status, latencyMs: server?.latencyMs };
        } else {
          const health = await registry.checkAllServersHealth();
          result = Object.fromEntries(health);
        }
      } else if (name === 'registry_stats') {
        result = registry.getStats();
      } else if (name === 'registry_discover') {
        const discovered = await registry.discover();
        result = {
          serversFound: discovered.reduce((sum, d) => sum + d.servers.length, 0),
          sources: discovered.map(d => ({ source: d.source, count: d.servers.length })),
        };
      } else {
        // Route to appropriate server
        const tool = registry.findTool(name);
        if (!tool) {
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }

        // Execute on the appropriate server
        if (tool.serverId === 'opensvm') {
          result = await executeOpenSVMTool(tool.name, toolArgs);
        } else if (tool.serverId === 'dflow') {
          result = await executeDFlowTool(tool.name, toolArgs);
        } else {
          throw new Error(`No executor for server: ${tool.serverId}`);
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{
          type: 'text',
          text: `Error: ${errorMessage}`,
        }],
        isError: true,
      };
    }
  });

  return { server, registry };
}

// ============================================================================
// Exports
// ============================================================================

export default function({ config }: { config?: GatewayConfig }) {
  return createGatewayServer(config).server;
}

// Run as STDIO server when executed directly
async function main() {
  console.log('[Gateway] Starting MCP Gateway Server...');

  const transport = new StdioServerTransport();
  const { server, registry } = createGatewayServer();

  // Log registry info
  const stats = registry.getStats();
  console.log(`[Gateway] Servers: ${stats.serverCount}, Tools: ${stats.totalTools}`);

  await server.connect(transport);
}

if (process.argv[1]?.endsWith('mcp-gateway.ts')) {
  main().catch(console.error);
}
