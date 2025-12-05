/**
 * MCP Server Registry
 *
 * Auto-discovery and dynamic tool loading for MCP servers.
 * Enables plug-and-play ecosystem of blockchain analysis tools.
 *
 * Features:
 * - Register MCP servers dynamically
 * - Discover servers via multiple methods (config, DNS, HTTP)
 * - Aggregate tools from multiple servers
 * - Route tool calls to correct server
 * - Health checking and failover
 * - Server capability negotiation
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

// ============================================================================
// Types
// ============================================================================

export type ServerStatus = 'online' | 'offline' | 'degraded' | 'unknown';
export type TransportType = 'stdio' | 'http' | 'websocket' | 'sse';

export interface MCPServerInfo {
  id: string;
  name: string;
  version: string;
  description?: string;
  baseUrl?: string;
  transport: TransportType;
  command?: string;  // For stdio transport
  args?: string[];   // For stdio transport

  // Capabilities
  capabilities: {
    tools: boolean;
    prompts: boolean;
    resources: boolean;
    sampling: boolean;
    logging: boolean;
  };

  // Metadata
  author?: string;
  repository?: string;
  documentation?: string;
  tags?: string[];
  category?: string;

  // Runtime state
  status: ServerStatus;
  lastHealthCheck?: number;
  latencyMs?: number;
  errorCount: number;
  toolCount: number;
}

export interface RegisteredTool extends Tool {
  serverId: string;
  serverName: string;
  qualifiedName: string;  // server:tool format
  lastCalled?: number;
  callCount: number;
  avgLatencyMs: number;
}

export interface RegistryConfig {
  // Discovery methods
  enableConfigDiscovery: boolean;
  enableDnsDiscovery: boolean;
  enableHttpDiscovery: boolean;

  // Health checking
  healthCheckIntervalMs: number;
  healthCheckTimeoutMs: number;
  maxConsecutiveFailures: number;

  // Caching
  toolCacheTtlMs: number;

  // Routing
  enableLoadBalancing: boolean;
  preferLocalServers: boolean;
}

export interface DiscoveryResult {
  servers: MCPServerInfo[];
  source: 'config' | 'dns' | 'http' | 'manual';
  timestamp: number;
}

export interface ToolCallResult {
  success: boolean;
  serverId: string;
  result?: any;
  error?: string;
  latencyMs: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: RegistryConfig = {
  enableConfigDiscovery: true,
  enableDnsDiscovery: false,
  enableHttpDiscovery: true,
  healthCheckIntervalMs: 30000,
  healthCheckTimeoutMs: 5000,
  maxConsecutiveFailures: 3,
  toolCacheTtlMs: 60000,
  enableLoadBalancing: true,
  preferLocalServers: true,
};

// ============================================================================
// Built-in Server Definitions
// ============================================================================

const BUILTIN_SERVERS: Partial<MCPServerInfo>[] = [
  {
    id: 'opensvm',
    name: 'OpenSVM',
    version: '2.0.0',
    description: 'Solana blockchain explorer with AI-powered analytics',
    baseUrl: 'https://osvm.ai',
    transport: 'http',
    capabilities: {
      tools: true,
      prompts: true,
      resources: true,
      sampling: false,
      logging: false,
    },
    author: 'OpenSVM',
    repository: 'https://github.com/aldrin-labs/opensvm',
    documentation: 'https://osvm.ai/docs/mcp',
    tags: ['solana', 'blockchain', 'explorer', 'ai', 'forensics'],
    category: 'blockchain',
  },
  {
    id: 'dflow',
    name: 'DFlow Prediction Markets',
    version: '1.0.0',
    description: 'Prediction market metadata and live data API',
    baseUrl: 'https://prediction-markets-api.dflow.net',
    transport: 'http',
    capabilities: {
      tools: true,
      prompts: true,
      resources: true,
      sampling: false,
      logging: false,
    },
    author: 'DFlow',
    documentation: 'https://dflow.opensvm.com',
    tags: ['prediction-markets', 'trading', 'forecasts', 'kalshi'],
    category: 'markets',
  },
];

// ============================================================================
// MCP Server Registry
// ============================================================================

export class MCPRegistry {
  private servers: Map<string, MCPServerInfo> = new Map();
  private tools: Map<string, RegisteredTool> = new Map();
  private toolsByServer: Map<string, string[]> = new Map();
  private config: RegistryConfig;
  private healthCheckInterval?: NodeJS.Timeout;
  private discoveryCallbacks: Array<(server: MCPServerInfo) => void> = [];

  constructor(config: Partial<RegistryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ==========================================================================
  // Server Registration
  // ==========================================================================

  /**
   * Register a new MCP server
   */
  registerServer(server: Partial<MCPServerInfo> & { id: string; name: string }): MCPServerInfo {
    const fullServer: MCPServerInfo = {
      version: '1.0.0',
      transport: 'http',
      capabilities: {
        tools: true,
        prompts: false,
        resources: false,
        sampling: false,
        logging: false,
      },
      status: 'unknown',
      errorCount: 0,
      toolCount: 0,
      ...server,
    };

    this.servers.set(server.id, fullServer);
    this.toolsByServer.set(server.id, []);

    // Notify discovery callbacks
    for (const callback of this.discoveryCallbacks) {
      callback(fullServer);
    }

    console.log(`[Registry] Registered server: ${server.name} (${server.id})`);
    return fullServer;
  }

  /**
   * Unregister a server
   */
  unregisterServer(serverId: string): boolean {
    const server = this.servers.get(serverId);
    if (!server) return false;

    // Remove server's tools (both qualified and simple names)
    const serverTools = this.toolsByServer.get(serverId) || [];
    for (const qualifiedName of serverTools) {
      const tool = this.tools.get(qualifiedName);
      if (tool) {
        // Remove by qualified name
        this.tools.delete(qualifiedName);
        // Also remove simple name if it points to this tool
        const simpleNameTool = this.tools.get(tool.name);
        if (simpleNameTool?.serverId === serverId) {
          this.tools.delete(tool.name);
        }
      }
    }
    this.toolsByServer.delete(serverId);
    this.servers.delete(serverId);

    console.log(`[Registry] Unregistered server: ${server.name}`);
    return true;
  }

  /**
   * Register tools for a server
   */
  registerTools(serverId: string, tools: Tool[]): void {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server not found: ${serverId}`);
    }

    const toolNames: string[] = [];

    for (const tool of tools) {
      const qualifiedName = `${serverId}:${tool.name}`;
      const registeredTool: RegisteredTool = {
        ...tool,
        serverId,
        serverName: server.name,
        qualifiedName,
        callCount: 0,
        avgLatencyMs: 0,
      };

      this.tools.set(qualifiedName, registeredTool);
      // Also register by simple name for convenience
      if (!this.tools.has(tool.name)) {
        this.tools.set(tool.name, registeredTool);
      }
      toolNames.push(qualifiedName);
    }

    this.toolsByServer.set(serverId, toolNames);
    server.toolCount = tools.length;
    console.log(`[Registry] Registered ${tools.length} tools for ${server.name}`);
  }

  // ==========================================================================
  // Discovery
  // ==========================================================================

  /**
   * Discover servers from all enabled sources
   */
  async discover(): Promise<DiscoveryResult[]> {
    const results: DiscoveryResult[] = [];

    // Config-based discovery (built-in servers)
    if (this.config.enableConfigDiscovery) {
      const configServers = await this.discoverFromConfig();
      results.push(configServers);
    }

    // HTTP-based discovery (well-known endpoints)
    if (this.config.enableHttpDiscovery) {
      const httpServers = await this.discoverFromHttp();
      results.push(httpServers);
    }

    // DNS-based discovery (SRV records)
    if (this.config.enableDnsDiscovery) {
      const dnsServers = await this.discoverFromDns();
      results.push(dnsServers);
    }

    return results;
  }

  /**
   * Discover from built-in config
   */
  private async discoverFromConfig(): Promise<DiscoveryResult> {
    const servers: MCPServerInfo[] = [];

    for (const builtin of BUILTIN_SERVERS) {
      const server = this.registerServer(builtin as MCPServerInfo);
      servers.push(server);
    }

    return {
      servers,
      source: 'config',
      timestamp: Date.now(),
    };
  }

  /**
   * Discover from HTTP well-known endpoints
   */
  private async discoverFromHttp(): Promise<DiscoveryResult> {
    const servers: MCPServerInfo[] = [];

    // Check well-known MCP registry endpoints
    const registryUrls = [
      'https://osvm.ai/.well-known/mcp-servers.json',
      'https://mcp.anthropic.com/registry.json',
    ];

    for (const url of registryUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data.servers)) {
            for (const serverInfo of data.servers) {
              const server = this.registerServer(serverInfo);
              servers.push(server);
            }
          }
        }
      } catch {
        // Silently ignore discovery failures
      }
    }

    return {
      servers,
      source: 'http',
      timestamp: Date.now(),
    };
  }

  /**
   * Discover from DNS SRV records
   */
  private async discoverFromDns(): Promise<DiscoveryResult> {
    // DNS discovery would use _mcp._tcp SRV records
    // Not implemented for browser/bun compatibility
    return {
      servers: [],
      source: 'dns',
      timestamp: Date.now(),
    };
  }

  /**
   * Register callback for new server discoveries
   */
  onServerDiscovered(callback: (server: MCPServerInfo) => void): void {
    this.discoveryCallbacks.push(callback);
  }

  // ==========================================================================
  // Health Checking
  // ==========================================================================

  /**
   * Start periodic health checks
   */
  startHealthChecks(): void {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(
      () => this.checkAllServersHealth(),
      this.config.healthCheckIntervalMs
    );

    // Initial check
    this.checkAllServersHealth();
  }

  /**
   * Stop health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  /**
   * Check health of all servers
   */
  async checkAllServersHealth(): Promise<Map<string, ServerStatus>> {
    const results = new Map<string, ServerStatus>();

    const promises = Array.from(this.servers.keys()).map(async (serverId) => {
      const status = await this.checkServerHealth(serverId);
      results.set(serverId, status);
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Check health of a single server
   */
  async checkServerHealth(serverId: string): Promise<ServerStatus> {
    const server = this.servers.get(serverId);
    if (!server) return 'unknown';

    const startTime = Date.now();

    try {
      if (server.transport === 'http' && server.baseUrl) {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.config.healthCheckTimeoutMs
        );

        const response = await fetch(`${server.baseUrl}/health`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        server.latencyMs = Date.now() - startTime;
        server.lastHealthCheck = Date.now();

        if (response.ok) {
          server.status = 'online';
          server.errorCount = 0;
        } else {
          server.status = 'degraded';
          server.errorCount++;
        }
      } else {
        // For stdio/other transports, assume online if registered
        server.status = 'online';
      }
    } catch {
      server.latencyMs = Date.now() - startTime;
      server.lastHealthCheck = Date.now();
      server.errorCount++;

      if (server.errorCount >= this.config.maxConsecutiveFailures) {
        server.status = 'offline';
      } else {
        server.status = 'degraded';
      }
    }

    return server.status;
  }

  // ==========================================================================
  // Tool Routing
  // ==========================================================================

  /**
   * Get all registered tools
   */
  getAllTools(): RegisteredTool[] {
    const seen = new Set<string>();
    const tools: RegisteredTool[] = [];

    for (const tool of this.tools.values()) {
      if (!seen.has(tool.qualifiedName)) {
        seen.add(tool.qualifiedName);
        tools.push(tool);
      }
    }

    return tools;
  }

  /**
   * Get tools grouped by server
   */
  getToolsByServer(): Map<string, RegisteredTool[]> {
    const result = new Map<string, RegisteredTool[]>();

    for (const server of this.servers.values()) {
      const serverTools = this.toolsByServer.get(server.id) || [];
      result.set(server.id, serverTools.map(name => this.tools.get(name)!).filter(Boolean));
    }

    return result;
  }

  /**
   * Find a tool by name (supports both simple and qualified names)
   */
  findTool(name: string): RegisteredTool | null {
    // Try exact match first
    const exact = this.tools.get(name);
    if (exact) return exact;

    // Try qualified name
    for (const tool of this.tools.values()) {
      if (tool.qualifiedName === name || tool.name === name) {
        return tool;
      }
    }

    return null;
  }

  /**
   * Route a tool call to the appropriate server
   */
  async routeToolCall(
    toolName: string,
    args: Record<string, any>,
    executor: (serverId: string, tool: string, args: Record<string, any>) => Promise<any>
  ): Promise<ToolCallResult> {
    const tool = this.findTool(toolName);
    if (!tool) {
      return {
        success: false,
        serverId: 'unknown',
        error: `Tool not found: ${toolName}`,
        latencyMs: 0,
      };
    }

    const server = this.servers.get(tool.serverId);
    if (!server || server.status === 'offline') {
      return {
        success: false,
        serverId: tool.serverId,
        error: `Server offline: ${tool.serverName}`,
        latencyMs: 0,
      };
    }

    const startTime = Date.now();

    try {
      const result = await executor(tool.serverId, tool.name, args);

      const latencyMs = Date.now() - startTime;

      // Update tool stats
      tool.callCount++;
      tool.lastCalled = Date.now();
      tool.avgLatencyMs = (tool.avgLatencyMs * (tool.callCount - 1) + latencyMs) / tool.callCount;

      return {
        success: true,
        serverId: tool.serverId,
        result,
        latencyMs,
      };
    } catch (error) {
      return {
        success: false,
        serverId: tool.serverId,
        error: error instanceof Error ? error.message : String(error),
        latencyMs: Date.now() - startTime,
      };
    }
  }

  // ==========================================================================
  // Registry Info
  // ==========================================================================

  /**
   * Get all registered servers
   */
  getServers(): MCPServerInfo[] {
    return Array.from(this.servers.values());
  }

  /**
   * Get a specific server
   */
  getServer(serverId: string): MCPServerInfo | null {
    return this.servers.get(serverId) || null;
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    serverCount: number;
    onlineServers: number;
    totalTools: number;
    toolsByCategory: Record<string, number>;
  } {
    const servers = this.getServers();
    const tools = this.getAllTools();

    const toolsByCategory: Record<string, number> = {};
    for (const server of servers) {
      const category = server.category || 'other';
      const serverTools = this.toolsByServer.get(server.id)?.length || 0;
      toolsByCategory[category] = (toolsByCategory[category] || 0) + serverTools;
    }

    return {
      serverCount: servers.length,
      onlineServers: servers.filter(s => s.status === 'online').length,
      totalTools: tools.length,
      toolsByCategory,
    };
  }

  /**
   * Export registry state for persistence
   */
  export(): {
    servers: MCPServerInfo[];
    tools: RegisteredTool[];
    config: RegistryConfig;
  } {
    return {
      servers: this.getServers(),
      tools: this.getAllTools(),
      config: this.config,
    };
  }

  /**
   * Import registry state
   */
  import(data: { servers?: MCPServerInfo[]; config?: Partial<RegistryConfig> }): void {
    if (data.config) {
      this.config = { ...this.config, ...data.config };
    }

    if (data.servers) {
      for (const server of data.servers) {
        this.registerServer(server);
      }
    }
  }
}

// ============================================================================
// Global Registry Instance
// ============================================================================

let globalRegistry: MCPRegistry | null = null;

export function getRegistry(): MCPRegistry {
  if (!globalRegistry) {
    globalRegistry = new MCPRegistry();
  }
  return globalRegistry;
}

export function createRegistry(config?: Partial<RegistryConfig>): MCPRegistry {
  globalRegistry = new MCPRegistry(config);
  return globalRegistry;
}

// ============================================================================
// MCP Gateway Server
// ============================================================================

/**
 * Create a unified MCP gateway that exposes tools from all registered servers
 */
export function createGatewayTools(registry: MCPRegistry): Tool[] {
  const tools = registry.getAllTools();

  // Add registry management tools
  const managementTools: Tool[] = [
    {
      name: 'registry_list_servers',
      description: 'List all registered MCP servers with their status and capabilities',
      inputSchema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['online', 'offline', 'degraded', 'all'],
            description: 'Filter by server status (default: all)',
          },
        },
        required: [],
      },
    },
    {
      name: 'registry_list_tools',
      description: 'List all available tools across all registered servers',
      inputSchema: {
        type: 'object',
        properties: {
          serverId: {
            type: 'string',
            description: 'Filter by server ID (optional)',
          },
          category: {
            type: 'string',
            description: 'Filter by category (optional)',
          },
        },
        required: [],
      },
    },
    {
      name: 'registry_server_health',
      description: 'Check health status of registered servers',
      inputSchema: {
        type: 'object',
        properties: {
          serverId: {
            type: 'string',
            description: 'Server ID to check (optional, checks all if not provided)',
          },
        },
        required: [],
      },
    },
    {
      name: 'registry_stats',
      description: 'Get registry statistics including server count, tool count, and health metrics',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'registry_discover',
      description: 'Trigger server discovery to find new MCP servers',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  ];

  return [...managementTools, ...tools];
}

// ============================================================================
// Exports
// ============================================================================

export const mcpRegistry = {
  MCPRegistry,
  getRegistry,
  createRegistry,
  createGatewayTools,
  BUILTIN_SERVERS,
  DEFAULT_CONFIG,
};
