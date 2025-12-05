#!/usr/bin/env bun
/**
 * MCP Dynamic Gateway Server
 *
 * A self-discovering MCP server that automatically aggregates tools from all
 * MCP modules in the source directory. Supports hot-reload during development.
 *
 * Features:
 * - Auto-discovers MCP modules at startup
 * - Aggregates all tools with namespace prefixes
 * - Hot-reload: detects file changes and updates registry
 * - Dynamic routing to appropriate handlers
 * - Built-in management tools for the gateway itself
 *
 * Usage:
 *   bun run src/mcp-dynamic-gateway.ts
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
} from '@modelcontextprotocol/sdk/types.js';
import { join, dirname } from 'path';

import {
  MCPGateway,
  ToolRegistry,
  type DiscoveredTool,
  type DiscoveryConfig,
} from './mcp-tool-discovery.js';

// ============================================================================
// Gateway Management Tools
// ============================================================================

const GATEWAY_TOOLS = [
  {
    name: 'gateway:list_modules',
    description: 'List all discovered MCP modules and their status',
    inputSchema: {
      type: 'object',
      properties: {
        include_tools: {
          type: 'boolean',
          description: 'Include tool list for each module',
        },
      },
    },
  },
  {
    name: 'gateway:list_namespaces',
    description: 'List all available tool namespaces with tool counts',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'gateway:get_stats',
    description: 'Get gateway statistics: total modules, tools, namespaces',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'gateway:search_tools',
    description: 'Search for tools by name or description',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (matches tool name or description)',
        },
        namespace: {
          type: 'string',
          description: 'Filter by namespace (optional)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'gateway:get_tool_info',
    description: 'Get detailed information about a specific tool',
    inputSchema: {
      type: 'object',
      properties: {
        tool_name: {
          type: 'string',
          description: 'Full tool name including namespace (e.g., solana:get_transaction)',
        },
      },
      required: ['tool_name'],
    },
  },
  {
    name: 'gateway:reload_module',
    description: 'Reload a specific module to pick up changes',
    inputSchema: {
      type: 'object',
      properties: {
        module_id: {
          type: 'string',
          description: 'Module ID (filename without extension)',
        },
      },
      required: ['module_id'],
    },
  },
  {
    name: 'gateway:discover',
    description: 'Re-run module discovery to find new modules',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// ============================================================================
// Gateway Prompts
// ============================================================================

const GATEWAY_PROMPTS = [
  {
    name: 'explore_gateway',
    description: 'Explore the gateway to understand available tools and capabilities',
    arguments: [],
  },
  {
    name: 'find_tools_for_task',
    description: 'Find the best tools for a specific task',
    arguments: [
      { name: 'task', description: 'The task you want to accomplish', required: true },
    ],
  },
];

// ============================================================================
// Gateway Resources
// ============================================================================

const GATEWAY_RESOURCES = [
  {
    uri: 'gateway://modules',
    name: 'Discovered Modules',
    description: 'List of all discovered MCP modules',
    mimeType: 'application/json',
  },
  {
    uri: 'gateway://tools',
    name: 'All Tools',
    description: 'Complete list of all available tools',
    mimeType: 'application/json',
  },
  {
    uri: 'gateway://stats',
    name: 'Gateway Statistics',
    description: 'Real-time gateway statistics',
    mimeType: 'application/json',
  },
];

// ============================================================================
// Server Factory
// ============================================================================

async function createDynamicGateway(config?: Partial<DiscoveryConfig>) {
  // Initialize the gateway with discovery
  const gateway = new MCPGateway({
    sourceDirs: [join(dirname(import.meta.path), '.')],
    watchEnabled: true,
    autoReload: true,
    ...config,
  });

  await gateway.initialize();
  const registry = gateway.getRegistry();

  // Create MCP server
  const server = new Server(
    {
      name: 'mcp-dynamic-gateway',
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

  // ============================================================================
  // List Tools Handler
  // ============================================================================

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    // Get discovered tools
    const discoveredTools = registry.getToolsForMCP();

    // Combine with gateway management tools
    const allTools = [
      ...GATEWAY_TOOLS,
      ...discoveredTools,
    ];

    return { tools: allTools };
  });

  // ============================================================================
  // Call Tool Handler
  // ============================================================================

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const toolArgs = args || {};

    try {
      let result: unknown;

      // Handle gateway management tools
      if (name.startsWith('gateway:')) {
        result = await handleGatewayTool(name, toolArgs, registry, gateway);
      } else {
        // Execute discovered tool
        result = await gateway.executeTool(name, toolArgs);
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
        isError: true,
      };
    }
  });

  // ============================================================================
  // List Prompts Handler
  // ============================================================================

  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    const discoveredPrompts = registry.getAllPrompts();
    const allPrompts = [
      ...GATEWAY_PROMPTS,
      ...discoveredPrompts.map(p => ({
        name: p.name,
        description: p.description,
        arguments: p.arguments,
      })),
    ];
    return { prompts: allPrompts };
  });

  // ============================================================================
  // Get Prompt Handler
  // ============================================================================

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Handle gateway prompts
    if (name === 'explore_gateway') {
      const stats = registry.getStats();
      const namespaces = registry.getNamespaces();

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `You are connected to the MCP Dynamic Gateway.

Current Status:
- ${stats.totalModules} modules loaded
- ${stats.totalTools} tools available
- ${stats.totalPrompts} prompts
- ${stats.totalResources} resources

Available Namespaces:
${namespaces.map(ns => `- ${ns}: ${stats.byNamespace[ns] || 0} tools`).join('\n')}

Use these gateway tools to explore:
1. gateway:list_namespaces - See all namespaces
2. gateway:search_tools - Find tools by keyword
3. gateway:get_tool_info - Get details about a tool
4. gateway:get_stats - Get current statistics

Example workflow:
1. Search for what you need: gateway:search_tools { query: "transaction" }
2. Get tool details: gateway:get_tool_info { tool_name: "solana:get_transaction" }
3. Use the tool with appropriate arguments`,
            },
          },
        ],
      };
    }

    if (name === 'find_tools_for_task') {
      const task = args?.task || 'general exploration';

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Help me find the best tools for this task: "${task}"

Available namespaces and their focus:
${registry.getNamespaces().map(ns => {
  const tools = registry.getToolsByNamespace(ns);
  return `- ${ns} (${tools.length} tools): ${tools.slice(0, 3).map(t => t.originalName).join(', ')}...`;
}).join('\n')}

To find relevant tools:
1. Use gateway:search_tools with keywords from the task
2. Review the results and pick the most relevant
3. Get detailed info with gateway:get_tool_info
4. Combine multiple tools if needed for complex tasks`,
            },
          },
        ],
      };
    }

    // Check discovered prompts
    const prompt = registry.getAllPrompts().find(p => p.name === name);
    if (!prompt) {
      throw new McpError(ErrorCode.InvalidParams, `Unknown prompt: ${name}`);
    }

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Prompt: ${prompt.name}\nDescription: ${prompt.description}\nSource: ${prompt.sourceModule}`,
          },
        },
      ],
    };
  });

  // ============================================================================
  // List Resources Handler
  // ============================================================================

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const discoveredResources = registry.getAllResources();
    const allResources = [
      ...GATEWAY_RESOURCES,
      ...discoveredResources.map(r => ({
        uri: r.uri,
        name: r.name,
        description: r.description,
        mimeType: r.mimeType,
      })),
    ];
    return { resources: allResources };
  });

  // ============================================================================
  // Read Resource Handler
  // ============================================================================

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    if (uri === 'gateway://modules') {
      const modules = registry.getAllModules();
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(modules.map(m => ({
              id: m.id,
              name: m.name,
              version: m.version,
              namespace: m.namespace,
              status: m.status,
              toolCount: m.tools.length,
              promptCount: m.prompts.length,
              resourceCount: m.resources.length,
            })), null, 2),
          },
        ],
      };
    }

    if (uri === 'gateway://tools') {
      const tools = registry.getAllTools();
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(tools.map(t => ({
              name: t.name,
              namespace: t.namespace,
              description: t.description,
              sourceModule: t.sourceModule,
            })), null, 2),
          },
        ],
      };
    }

    if (uri === 'gateway://stats') {
      const stats = registry.getStats();
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(stats, null, 2),
          },
        ],
      };
    }

    // Check discovered resources
    const resource = registry.getAllResources().find(r => r.uri === uri);
    if (!resource) {
      throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
    }

    return {
      contents: [
        {
          uri,
          mimeType: resource.mimeType,
          text: JSON.stringify({ message: `Resource from ${resource.sourceModule}` }),
        },
      ],
    };
  });

  return { server, gateway, registry };
}

// ============================================================================
// Gateway Tool Handlers
// ============================================================================

async function handleGatewayTool(
  name: string,
  args: Record<string, unknown>,
  registry: ToolRegistry,
  gateway: MCPGateway
): Promise<unknown> {
  switch (name) {
    case 'gateway:list_modules': {
      const modules = registry.getAllModules();
      const includeTools = args.include_tools as boolean;

      return modules.map(m => ({
        id: m.id,
        name: m.name,
        version: m.version,
        namespace: m.namespace,
        status: m.status,
        path: m.path,
        toolCount: m.tools.length,
        promptCount: m.prompts.length,
        ...(includeTools && { tools: m.tools.map(t => t.name) }),
      }));
    }

    case 'gateway:list_namespaces': {
      const namespaces = registry.getNamespaces();
      const stats = registry.getStats();

      return namespaces.map(ns => ({
        namespace: ns,
        toolCount: stats.byNamespace[ns] || 0,
        tools: registry.getToolsByNamespace(ns).map(t => t.originalName),
      }));
    }

    case 'gateway:get_stats': {
      return registry.getStats();
    }

    case 'gateway:search_tools': {
      const query = String(args.query || '').toLowerCase();
      const namespace = args.namespace as string | undefined;

      let tools = registry.getAllTools();
      if (namespace) {
        tools = tools.filter(t => t.namespace === namespace);
      }

      const matches = tools.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query)
      );

      return {
        query,
        namespace: namespace || 'all',
        matches: matches.map(t => ({
          name: t.name,
          description: t.description,
          namespace: t.namespace,
        })),
        count: matches.length,
      };
    }

    case 'gateway:get_tool_info': {
      const toolName = args.tool_name as string;
      const tool = registry.getTool(toolName);

      if (!tool) {
        return { error: `Tool not found: ${toolName}` };
      }

      return {
        name: tool.name,
        originalName: tool.originalName,
        namespace: tool.namespace,
        description: tool.description,
        inputSchema: tool.inputSchema,
        sourceModule: tool.sourceModule,
        hasHandler: !!tool.handler,
      };
    }

    case 'gateway:reload_module': {
      const moduleId = args.module_id as string;
      const modules = registry.getAllModules();
      const module = modules.find(m => m.id === moduleId);

      if (!module) {
        return { error: `Module not found: ${moduleId}` };
      }

      // Trigger reload by re-loading the module
      await registry['loadModule'](module.path);

      const reloaded = registry.getAllModules().find(m => m.id === moduleId);
      return {
        success: true,
        module: {
          id: reloaded?.id,
          status: reloaded?.status,
          toolCount: reloaded?.tools.length,
        },
      };
    }

    case 'gateway:discover': {
      const before = registry.getStats();
      await registry.discover();
      const after = registry.getStats();

      return {
        before: {
          modules: before.totalModules,
          tools: before.totalTools,
        },
        after: {
          modules: after.totalModules,
          tools: after.totalTools,
        },
        newModules: after.totalModules - before.totalModules,
        newTools: after.totalTools - before.totalTools,
      };
    }

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown gateway tool: ${name}`);
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  const { server, registry } = await createDynamicGateway();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const stats = registry.getStats();
  console.error('MCP Dynamic Gateway v1.0.0 running on stdio');
  console.error(`Modules: ${stats.loadedModules}/${stats.totalModules}`);
  console.error(`Tools: ${stats.totalTools} across ${Object.keys(stats.byNamespace).length} namespaces`);
  console.error(`Namespaces: ${Object.keys(stats.byNamespace).join(', ')}`);
}

// Export for programmatic use
export { createDynamicGateway, handleGatewayTool, GATEWAY_TOOLS, GATEWAY_PROMPTS, GATEWAY_RESOURCES };

// Run if executed directly
main().catch(console.error);
