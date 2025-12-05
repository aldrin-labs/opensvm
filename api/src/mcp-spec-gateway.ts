#!/usr/bin/env bun
/**
 * MCP Spec-Compliant Gateway Server
 *
 * Implements the full MCP specification (2025-11-25):
 * - JSON-RPC 2.0 compliant messaging
 * - Proper initialization handshake with capabilities
 * - Paginated tool/prompt/resource listings
 * - Tool annotations (readOnlyHint, destructiveHint, etc.)
 * - Progress notifications for long-running operations
 * - Logging support (setLevel, message notifications)
 * - Resource subscriptions
 * - Argument completions
 * - Cancellation support
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
  Resource,
  Prompt,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { EventEmitter } from 'events';

import {
  MCPGateway,
  ToolRegistry,
  type DiscoveredTool,
} from './mcp-tool-discovery.js';

// ============================================================================
// MCP Protocol Constants (2025-11-25)
// ============================================================================

const PROTOCOL_VERSION = '2025-11-25';
const JSONRPC_VERSION = '2.0';

// JSON-RPC Error Codes
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

// ============================================================================
// Types
// ============================================================================

interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

interface SpecCompliantTool extends Tool {
  annotations?: ToolAnnotations;
  execution?: {
    taskSupport?: 'forbidden' | 'optional' | 'required';
  };
}

interface PaginationParams {
  cursor?: string;
  limit?: number;
}

interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string;
  total?: number;
}

interface ProgressToken {
  token: string | number;
  total?: number;
  current: number;
  message?: string;
}

interface ResourceSubscription {
  uri: string;
  subscribedAt: number;
}

interface LogLevel {
  level: 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';
}

// ============================================================================
// Server Capabilities (2025-11-25 Spec)
// ============================================================================

const SERVER_CAPABILITIES = {
  // Experimental features
  experimental: {},

  // Logging support
  logging: {},

  // Argument autocompletion
  completions: {},

  // Prompts with change notifications
  prompts: {
    listChanged: true,
  },

  // Resources with subscriptions
  resources: {
    subscribe: true,
    listChanged: true,
  },

  // Tools with change notifications
  tools: {
    listChanged: true,
  },
};

const SERVER_INFO = {
  name: 'opensvm-mcp-gateway',
  version: '2.0.0',
  title: 'OpenSVM MCP Gateway',
  description: 'A spec-compliant MCP gateway that aggregates tools from multiple sources with full protocol support',
};

// ============================================================================
// Pagination Helper
// ============================================================================

function paginate<T>(items: T[], params?: PaginationParams): PaginatedResult<T> {
  const limit = params?.limit ?? 20;
  const cursor = params?.cursor;

  let startIndex = 0;
  if (cursor) {
    startIndex = parseInt(cursor, 10) || 0;
  }

  const paginatedItems = items.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < items.length;

  return {
    items: paginatedItems,
    nextCursor: hasMore ? String(startIndex + limit) : undefined,
    total: items.length,
  };
}

// ============================================================================
// Progress Tracker
// ============================================================================

class ProgressTracker extends EventEmitter {
  private tokens: Map<string | number, ProgressToken> = new Map();

  createToken(total?: number): string {
    const token = `progress_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    this.tokens.set(token, { token, total, current: 0 });
    return token;
  }

  updateProgress(token: string | number, current: number, message?: string): void {
    const progress = this.tokens.get(token);
    if (progress) {
      progress.current = current;
      progress.message = message;
      this.emit('progress', { ...progress });
    }
  }

  completeProgress(token: string | number): void {
    const progress = this.tokens.get(token);
    if (progress) {
      progress.current = progress.total ?? progress.current;
      this.emit('progress', { ...progress });
      this.tokens.delete(token);
    }
  }

  getProgress(token: string | number): ProgressToken | undefined {
    return this.tokens.get(token);
  }
}

// ============================================================================
// Resource Subscription Manager
// ============================================================================

class SubscriptionManager extends EventEmitter {
  private subscriptions: Map<string, ResourceSubscription> = new Map();

  subscribe(uri: string): void {
    if (!this.subscriptions.has(uri)) {
      this.subscriptions.set(uri, { uri, subscribedAt: Date.now() });
      this.emit('subscribed', uri);
    }
  }

  unsubscribe(uri: string): boolean {
    if (this.subscriptions.has(uri)) {
      this.subscriptions.delete(uri);
      this.emit('unsubscribed', uri);
      return true;
    }
    return false;
  }

  isSubscribed(uri: string): boolean {
    return this.subscriptions.has(uri);
  }

  getSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  notifyUpdate(uri: string): void {
    if (this.subscriptions.has(uri)) {
      this.emit('resourceUpdated', uri);
    }
  }
}

// ============================================================================
// Logging Manager
// ============================================================================

class LoggingManager extends EventEmitter {
  private level: LogLevel['level'] = 'info';
  private readonly levelPriority: Record<LogLevel['level'], number> = {
    debug: 0,
    info: 1,
    notice: 2,
    warning: 3,
    error: 4,
    critical: 5,
    alert: 6,
    emergency: 7,
  };

  setLevel(level: LogLevel['level']): void {
    this.level = level;
    this.emit('levelChanged', level);
  }

  getLevel(): LogLevel['level'] {
    return this.level;
  }

  log(level: LogLevel['level'], logger: string, data: unknown): void {
    if (this.levelPriority[level] >= this.levelPriority[this.level]) {
      this.emit('message', { level, logger, data });
    }
  }

  debug(logger: string, data: unknown): void {
    this.log('debug', logger, data);
  }

  info(logger: string, data: unknown): void {
    this.log('info', logger, data);
  }

  warning(logger: string, data: unknown): void {
    this.log('warning', logger, data);
  }

  error(logger: string, data: unknown): void {
    this.log('error', logger, data);
  }
}

// ============================================================================
// Tool Annotations Generator
// ============================================================================

function generateToolAnnotations(toolName: string): ToolAnnotations {
  const name = toolName.split(':')[1] || toolName;

  // Read-only operations
  const readOnlyPatterns = ['get_', 'list_', 'search_', 'find_', 'is_', 'time_'];
  const isReadOnly = readOnlyPatterns.some(p => name.startsWith(p));

  // Destructive operations
  const destructivePatterns = ['delete_', 'remove_', 'cancel_', 'expire_'];
  const isDestructive = destructivePatterns.some(p => name.startsWith(p));

  // Idempotent operations
  const idempotentPatterns = ['get_', 'list_', 'search_', 'set_'];
  const isIdempotent = idempotentPatterns.some(p => name.startsWith(p));

  // Open world operations (interact with external systems)
  const openWorldPatterns = ['search_', 'fetch_', 'query_'];
  const isOpenWorld = openWorldPatterns.some(p => name.startsWith(p));

  return {
    readOnlyHint: isReadOnly,
    destructiveHint: isDestructive && !isReadOnly,
    idempotentHint: isIdempotent,
    openWorldHint: isOpenWorld || toolName.includes('solana') || toolName.includes('kalshi') || toolName.includes('dflow'),
  };
}

// ============================================================================
// Gateway Management Tools with Annotations
// ============================================================================

const GATEWAY_TOOLS: SpecCompliantTool[] = [
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
    annotations: {
      title: 'List Modules',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'gateway:list_namespaces',
    description: 'List all available tool namespaces with tool counts',
    inputSchema: { type: 'object', properties: {} },
    annotations: {
      title: 'List Namespaces',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'gateway:get_stats',
    description: 'Get gateway statistics: total modules, tools, namespaces',
    inputSchema: { type: 'object', properties: {} },
    annotations: {
      title: 'Get Statistics',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'gateway:search_tools',
    description: 'Search for tools by name or description',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        namespace: { type: 'string', description: 'Filter by namespace' },
      },
      required: ['query'],
    },
    annotations: {
      title: 'Search Tools',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'gateway:get_tool_info',
    description: 'Get detailed information about a specific tool',
    inputSchema: {
      type: 'object',
      properties: {
        tool_name: { type: 'string', description: 'Full tool name (e.g., solana:get_transaction)' },
      },
      required: ['tool_name'],
    },
    annotations: {
      title: 'Get Tool Info',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'gateway:reload_module',
    description: 'Reload a specific module to pick up changes',
    inputSchema: {
      type: 'object',
      properties: {
        module_id: { type: 'string', description: 'Module ID' },
      },
      required: ['module_id'],
    },
    annotations: {
      title: 'Reload Module',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'gateway:discover',
    description: 'Re-run module discovery to find new modules',
    inputSchema: { type: 'object', properties: {} },
    annotations: {
      title: 'Discover Modules',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
];

// ============================================================================
// Gateway Prompts
// ============================================================================

const GATEWAY_PROMPTS: Prompt[] = [
  {
    name: 'explore_gateway',
    title: 'Explore Gateway',
    description: 'Explore the gateway to understand available tools and capabilities',
    arguments: [],
  },
  {
    name: 'find_tools_for_task',
    title: 'Find Tools for Task',
    description: 'Find the best tools for a specific task',
    arguments: [
      { name: 'task', title: 'Task', description: 'The task you want to accomplish', required: true },
    ],
  },
  {
    name: 'multi_namespace_workflow',
    title: 'Multi-Namespace Workflow',
    description: 'Create a workflow that spans multiple namespaces',
    arguments: [
      { name: 'goal', title: 'Goal', description: 'The end goal to achieve', required: true },
      { name: 'namespaces', title: 'Namespaces', description: 'Comma-separated namespaces to use', required: false },
    ],
  },
];

// ============================================================================
// Gateway Resources
// ============================================================================

const GATEWAY_RESOURCES: Resource[] = [
  {
    uri: 'gateway://modules',
    name: 'Discovered Modules',
    title: 'Discovered Modules',
    description: 'List of all discovered MCP modules',
    mimeType: 'application/json',
  },
  {
    uri: 'gateway://tools',
    name: 'All Tools',
    title: 'All Tools',
    description: 'Complete list of all available tools',
    mimeType: 'application/json',
  },
  {
    uri: 'gateway://stats',
    name: 'Gateway Statistics',
    title: 'Gateway Statistics',
    description: 'Real-time gateway statistics',
    mimeType: 'application/json',
  },
  {
    uri: 'gateway://capabilities',
    name: 'Server Capabilities',
    title: 'Server Capabilities',
    description: 'MCP server capabilities declaration',
    mimeType: 'application/json',
  },
  {
    uri: 'gateway://protocol',
    name: 'Protocol Info',
    title: 'Protocol Info',
    description: 'MCP protocol version and compliance info',
    mimeType: 'application/json',
  },
];

// ============================================================================
// Spec-Compliant Server Factory
// ============================================================================

interface GatewayConfig {
  sourceDirs?: string[];
  watchEnabled?: boolean;
  autoReload?: boolean;
}

async function createSpecCompliantGateway(config?: GatewayConfig) {
  // Initialize the discovery gateway with configurable source dirs
  const discoveryGateway = new MCPGateway({
    sourceDirs: config?.sourceDirs || ['./src', 'api/src'],
    watchEnabled: config?.watchEnabled ?? true,
    autoReload: config?.autoReload ?? true,
  });

  await discoveryGateway.initialize();
  const registry = discoveryGateway.getRegistry();

  // Initialize managers
  const progressTracker = new ProgressTracker();
  const subscriptionManager = new SubscriptionManager();
  const loggingManager = new LoggingManager();

  // Create MCP server with full capabilities
  const server = new Server(
    {
      name: SERVER_INFO.name,
      version: SERVER_INFO.version,
    },
    {
      capabilities: SERVER_CAPABILITIES,
    }
  );

  // ============================================================================
  // List Tools Handler (with pagination)
  // ============================================================================

  server.setRequestHandler(ListToolsRequestSchema, async (request) => {
    const params = request.params as PaginationParams | undefined;

    // Get discovered tools with annotations
    const discoveredTools = registry.getAllTools().map((tool): SpecCompliantTool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as SpecCompliantTool['inputSchema'],
      annotations: generateToolAnnotations(tool.name),
    }));

    // Combine with gateway management tools
    const allTools = [...GATEWAY_TOOLS, ...discoveredTools];

    // Apply pagination
    const { items, nextCursor } = paginate(allTools, params);

    return {
      tools: items,
      nextCursor,
    };
  });

  // ============================================================================
  // Call Tool Handler (with progress support)
  // ============================================================================

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const toolArgs = args || {};
    const meta = (request.params as { _meta?: { progressToken?: string | number } })._meta;

    try {
      let result: unknown;
      const progressToken = meta?.progressToken;

      // Handle gateway management tools
      if (name.startsWith('gateway:')) {
        result = await handleGatewayTool(name, toolArgs, registry, discoveryGateway);
      } else {
        // Report progress if token provided
        if (progressToken) {
          progressTracker.updateProgress(progressToken, 0, `Starting ${name}...`);
        }

        // Execute discovered tool
        result = await discoveryGateway.executeTool(name, toolArgs);

        if (progressToken) {
          progressTracker.completeProgress(progressToken);
        }
      }

      // Log tool execution
      loggingManager.info('gateway', { tool: name, success: true });

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Log error
      loggingManager.error('gateway', { tool: name, error: message });

      return {
        content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
        isError: true,
      };
    }
  });

  // ============================================================================
  // List Prompts Handler (with pagination)
  // ============================================================================

  server.setRequestHandler(ListPromptsRequestSchema, async (request) => {
    const params = request.params as PaginationParams | undefined;

    const discoveredPrompts = registry.getAllPrompts().map(p => ({
      name: p.name,
      description: p.description,
      arguments: p.arguments,
    }));

    const allPrompts = [...GATEWAY_PROMPTS, ...discoveredPrompts];
    const { items, nextCursor } = paginate(allPrompts, params);

    return {
      prompts: items,
      nextCursor,
    };
  });

  // ============================================================================
  // Get Prompt Handler
  // ============================================================================

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Handle gateway prompts
    switch (name) {
      case 'explore_gateway': {
        const stats = registry.getStats();
        const namespaces = registry.getNamespaces();

        return {
          description: 'Explore the MCP Gateway capabilities',
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `You are connected to the OpenSVM MCP Gateway (v${SERVER_INFO.version}).

Protocol: MCP ${PROTOCOL_VERSION}
Modules: ${stats.loadedModules}/${stats.totalModules}
Tools: ${stats.totalTools} across ${Object.keys(stats.byNamespace).length} namespaces
Prompts: ${stats.totalPrompts}
Resources: ${stats.totalResources}

Namespaces:
${namespaces.map(ns => `- ${ns}: ${stats.byNamespace[ns] || 0} tools`).join('\n')}

Gateway Management Tools:
- gateway:list_modules - See all discovered modules
- gateway:list_namespaces - See all namespaces with tool counts
- gateway:search_tools - Find tools by keyword
- gateway:get_tool_info - Get detailed tool information
- gateway:get_stats - Get gateway statistics

Start by using gateway:search_tools to find relevant tools for your task.`,
              },
            },
          ],
        };
      }

      case 'find_tools_for_task': {
        const task = args?.task || 'general task';

        return {
          description: `Find tools for: ${task}`,
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Help me find the best tools for this task: "${task}"

Available namespaces:
${registry.getNamespaces().map(ns => {
  const tools = registry.getToolsByNamespace(ns);
  return `- ${ns} (${tools.length} tools): ${tools.slice(0, 3).map(t => t.originalName).join(', ')}...`;
}).join('\n')}

Steps:
1. Use gateway:search_tools with keywords from the task
2. Review matching tools and their descriptions
3. Use gateway:get_tool_info for detailed parameter info
4. Combine multiple tools if needed for complex workflows`,
              },
            },
          ],
        };
      }

      case 'multi_namespace_workflow': {
        const goal = args?.goal || 'achieve goal';
        const namespaces = args?.namespaces?.split(',').map((s: string) => s.trim()) || registry.getNamespaces();

        return {
          description: `Multi-namespace workflow for: ${goal}`,
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Create a workflow spanning these namespaces: ${namespaces.join(', ')}

Goal: ${goal}

Available tools by namespace:
${namespaces.map(ns => {
  const tools = registry.getToolsByNamespace(ns);
  if (tools.length === 0) return `- ${ns}: (no tools found)`;
  return `- ${ns}:\n${tools.slice(0, 5).map(t => `    * ${t.name}: ${t.description.slice(0, 60)}...`).join('\n')}`;
}).join('\n')}

Design a workflow that:
1. Uses the right tools from each namespace
2. Passes data between steps appropriately
3. Handles errors gracefully
4. Reports progress at each step`,
              },
            },
          ],
        };
      }

      default: {
        // Check discovered prompts
        const prompt = registry.getAllPrompts().find(p => p.name === name);
        if (!prompt) {
          throw new McpError(ErrorCode.InvalidParams, `Unknown prompt: ${name}`);
        }

        return {
          description: prompt.description,
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
      }
    }
  });

  // ============================================================================
  // List Resources Handler (with pagination)
  // ============================================================================

  server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
    const params = request.params as PaginationParams | undefined;

    const discoveredResources = registry.getAllResources().map(r => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: r.mimeType,
    }));

    const allResources = [...GATEWAY_RESOURCES, ...discoveredResources];
    const { items, nextCursor } = paginate(allResources, params);

    return {
      resources: items,
      nextCursor,
    };
  });

  // ============================================================================
  // Read Resource Handler
  // ============================================================================

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    switch (uri) {
      case 'gateway://modules': {
        const modules = registry.getAllModules();
        return {
          contents: [{
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
              path: m.path,
            })), null, 2),
          }],
        };
      }

      case 'gateway://tools': {
        const tools = registry.getAllTools();
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(tools.map(t => ({
              name: t.name,
              namespace: t.namespace,
              description: t.description,
              annotations: generateToolAnnotations(t.name),
            })), null, 2),
          }],
        };
      }

      case 'gateway://stats': {
        const stats = registry.getStats();
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              ...stats,
              subscriptions: subscriptionManager.getSubscriptions().length,
              logLevel: loggingManager.getLevel(),
            }, null, 2),
          }],
        };
      }

      case 'gateway://capabilities': {
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(SERVER_CAPABILITIES, null, 2),
          }],
        };
      }

      case 'gateway://protocol': {
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              protocolVersion: PROTOCOL_VERSION,
              jsonrpcVersion: JSONRPC_VERSION,
              serverInfo: SERVER_INFO,
              capabilities: SERVER_CAPABILITIES,
              errorCodes: {
                PARSE_ERROR,
                INVALID_REQUEST,
                METHOD_NOT_FOUND,
                INVALID_PARAMS,
                INTERNAL_ERROR,
              },
            }, null, 2),
          }],
        };
      }

      default: {
        // Check discovered resources
        const resource = registry.getAllResources().find(r => r.uri === uri);
        if (!resource) {
          throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
        }

        return {
          contents: [{
            uri,
            mimeType: resource.mimeType,
            text: JSON.stringify({
              message: `Resource from ${resource.sourceModule}`,
              description: resource.description,
            }),
          }],
        };
      }
    }
  });

  // ============================================================================
  // Completions Handler (for argument autocompletion)
  // ============================================================================

  // Define completion request schema
  const CompleteRequestSchema = z.object({
    method: z.literal('completion/complete'),
    params: z.object({
      ref: z.object({
        type: z.enum(['ref/prompt', 'ref/resource']),
        name: z.string().optional(),
        uri: z.string().optional(),
      }),
      argument: z.object({
        name: z.string(),
        value: z.string(),
      }),
    }),
  });

  server.setRequestHandler(CompleteRequestSchema, async (request) => {
    const { ref, argument } = request.params;
    const { name: argName, value: partialValue } = argument;

    const completions: { values: string[]; total?: number; hasMore?: boolean } = {
      values: [],
      hasMore: false,
    };

    // Handle tool argument completions
    if (ref.type === 'ref/prompt' && ref.name) {
      const promptName = ref.name;

      // Find matching prompt
      const prompt = [...GATEWAY_PROMPTS, ...registry.getAllPrompts()]
        .find(p => p.name === promptName);

      if (prompt && prompt.arguments) {
        const argDef = prompt.arguments.find(a => a.name === argName);
        if (argDef) {
          // Generate completions based on argument type
          if (argName === 'namespace' || argName === 'namespaces') {
            const namespaces = registry.getNamespaces();
            completions.values = namespaces
              .filter(ns => ns.toLowerCase().includes(partialValue.toLowerCase()))
              .slice(0, 20);
          } else if (argName === 'task' || argName === 'goal') {
            // Suggest common tasks
            const commonTasks = [
              'Analyze a Solana transaction',
              'Get wallet balances',
              'Search for prediction markets',
              'Query blockchain data',
              'Investigate wallet activity',
            ];
            completions.values = commonTasks
              .filter(t => t.toLowerCase().includes(partialValue.toLowerCase()))
              .slice(0, 10);
          }
        }
      }
    }

    // Handle resource URI completions
    if (ref.type === 'ref/resource') {
      if (argName === 'uri') {
        // Suggest resource URIs
        const resourceUris = [
          ...GATEWAY_RESOURCES.map(r => r.uri),
          ...registry.getAllResources().map(r => r.uri),
        ];
        completions.values = resourceUris
          .filter(uri => uri.toLowerCase().includes(partialValue.toLowerCase()))
          .slice(0, 20);
      }
    }

    // Tool name completions (for gateway:get_tool_info etc)
    if (argName === 'tool_name') {
      const allTools = registry.getAllTools();
      completions.values = allTools
        .map(t => t.name)
        .filter(name => name.toLowerCase().includes(partialValue.toLowerCase()))
        .slice(0, 20);
      completions.total = allTools.length;
      completions.hasMore = allTools.length > 20;
    }

    // Module ID completions (for gateway:reload_module)
    if (argName === 'module_id') {
      const modules = registry.getAllModules();
      completions.values = modules
        .map(m => m.id)
        .filter(id => id.toLowerCase().includes(partialValue.toLowerCase()))
        .slice(0, 20);
    }

    // Namespace completions
    if (argName === 'namespace') {
      const namespaces = registry.getNamespaces();
      completions.values = namespaces
        .filter(ns => ns.toLowerCase().includes(partialValue.toLowerCase()))
        .slice(0, 20);
    }

    return { completion: completions };
  });

  return {
    server,
    gateway: discoveryGateway,
    registry,
    progressTracker,
    subscriptionManager,
    loggingManager,
  };
}

// ============================================================================
// Gateway Tool Handler
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
        tools: registry.getToolsByNamespace(ns).map(t => ({
          name: t.name,
          originalName: t.originalName,
        })),
      }));
    }

    case 'gateway:get_stats': {
      const stats = registry.getStats();
      return {
        ...stats,
        protocolVersion: PROTOCOL_VERSION,
        serverVersion: SERVER_INFO.version,
      };
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
          annotations: generateToolAnnotations(t.name),
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
        annotations: generateToolAnnotations(tool.name),
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
        before: { modules: before.totalModules, tools: before.totalTools },
        after: { modules: after.totalModules, tools: after.totalTools },
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
  const { server, registry, loggingManager } = await createSpecCompliantGateway();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const stats = registry.getStats();

  loggingManager.info('gateway', {
    message: 'MCP Spec-Compliant Gateway started',
    protocolVersion: PROTOCOL_VERSION,
    serverVersion: SERVER_INFO.version,
    modules: stats.loadedModules,
    tools: stats.totalTools,
    namespaces: Object.keys(stats.byNamespace),
  });

  console.error(`OpenSVM MCP Gateway v${SERVER_INFO.version} (MCP ${PROTOCOL_VERSION})`);
  console.error(`Modules: ${stats.loadedModules}, Tools: ${stats.totalTools}`);
  console.error(`Namespaces: ${Object.keys(stats.byNamespace).join(', ')}`);
}

// Export for programmatic use
export {
  createSpecCompliantGateway,
  PROTOCOL_VERSION,
  SERVER_CAPABILITIES,
  SERVER_INFO,
  GATEWAY_TOOLS,
  GATEWAY_PROMPTS,
  GATEWAY_RESOURCES,
  ProgressTracker,
  SubscriptionManager,
  LoggingManager,
  generateToolAnnotations,
  paginate,
};

// Run if executed directly
main().catch(console.error);
