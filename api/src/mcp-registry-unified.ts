/**
 * Unified MCP Registry
 *
 * A comprehensive MCP server registry supporting multiple schema formats:
 * - Official MCP Registry (v1.2025-10-17)
 * - MCPB Manifest (v0.3) for Claude Desktop
 * - Internal OpenSVM format
 *
 * Features:
 * - Multi-format schema support
 * - LRU caching with TTL
 * - Enhanced discovery with retries
 * - CRUD operations for server management
 * - Pagination support
 * - Event system for real-time updates
 * - Tokenomics integration for premium listings
 * - Health monitoring with circuit breaker
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

// ============================================================================
// Schema Version Constants
// ============================================================================

export const SCHEMA_VERSIONS = {
  OFFICIAL: 'https://modelcontextprotocol.io/schemas/server-v1.2025-10-17.json',
  MCPB_V03: 'https://mcpb.anthropic.com/schemas/mcpb-manifest-v0.3.json',
  OPENSVM: 'https://osvm.ai/schemas/mcp-server-v1.json',
} as const;

// ============================================================================
// Type Definitions
// ============================================================================

// Server status for all formats
export type ServerStatus = 'online' | 'offline' | 'degraded' | 'unknown' | 'deprecated';

// Transport types across all formats
export type TransportType = 'stdio' | 'http' | 'sse' | 'websocket';

// Package registry types
export type RegistryType = 'npm' | 'pypi' | 'oci' | 'nuget' | 'mcpb' | 'cargo';

// Runtime hints for package execution
export type RuntimeHint = 'npx' | 'uvx' | 'docker' | 'cargo' | 'python' | 'node' | 'bun';

// Server types for MCPB format
export type MCPBServerType = 'python' | 'node' | 'binary';

// ============================================================================
// Official Registry Schema Types
// ============================================================================

export interface OfficialIcon {
  src: string;
  mimeType?: 'image/png' | 'image/jpeg' | 'image/svg+xml' | 'image/webp';
  sizes?: string[];
  theme?: 'light' | 'dark';
}

export interface OfficialPackage {
  registryType: RegistryType;
  registryBaseUrl?: string;
  identifier: string;
  version?: string;
  fileSha256?: string;
  runtimeHint?: RuntimeHint;
  transport: { type: TransportType; url?: string; headers?: any[] };
  runtimeArguments?: { name: string; description?: string; required?: boolean; default?: string }[];
  packageArguments?: { name: string; description?: string; required?: boolean; default?: string }[];
  environmentVariables?: { name: string; description?: string; required?: boolean; secret?: boolean }[];
}

export interface OfficialServerJSON {
  $schema: string;
  name: string;  // Reverse-DNS format
  description: string;
  title?: string;
  version: string;
  websiteUrl?: string;
  repository?: { url?: string; source?: string; id?: string; subfolder?: string };
  icons?: OfficialIcon[];
  packages?: OfficialPackage[];
  remotes?: { type: TransportType; url?: string; headers?: any[] }[];
  _meta?: Record<string, any>;
}

// ============================================================================
// MCPB Manifest Schema Types (v0.3)
// ============================================================================

export interface MCPBAuthor {
  name: string;
  email?: string;
  url?: string;
}

export interface MCPBIcon {
  src: string;
  size: string;  // Pattern: "NxN" e.g., "192x192"
  theme?: string;
}

export interface MCPBServerConfig {
  type: MCPBServerType;
  entry_point: string;
  mcp_config: {
    command: string;
    args?: string[];
    env?: Record<string, string>;
    platform_overrides?: Record<string, {
      command?: string;
      args?: string[];
      env?: Record<string, string>;
    }>;
  };
}

export interface MCPBUserConfig {
  type: 'string' | 'number' | 'boolean' | 'directory' | 'file';
  title: string;
  description: string;
  required?: boolean;
  default?: string | number | boolean | string[];
  multiple?: boolean;
  sensitive?: boolean;
  min?: number;
  max?: number;
}

export interface MCPBManifest {
  $schema?: string;
  manifest_version: '0.3';
  name: string;
  display_name?: string;
  version: string;
  description: string;
  long_description?: string;
  author: MCPBAuthor;
  repository?: { type: string; url: string };
  homepage?: string;
  documentation?: string;
  support?: string;
  icon?: string;
  icons?: MCPBIcon[];
  screenshots?: string[];
  server: MCPBServerConfig;
  tools?: { name: string; description?: string }[];
  tools_generated?: boolean;
  prompts?: { name: string; description?: string; arguments?: string[]; text: string }[];
  prompts_generated?: boolean;
  keywords?: string[];
  license?: string;
  privacy_policies?: string[];
  compatibility?: {
    claude_desktop?: string;
    platforms?: ('darwin' | 'win32' | 'linux')[];
    runtimes?: { python?: string; node?: string };
  };
  user_config?: Record<string, MCPBUserConfig>;
  _meta?: Record<string, any>;
}

// ============================================================================
// Unified Server Type
// ============================================================================

export interface UnifiedServer {
  // Core identity
  id: string;
  name: string;
  displayName: string;
  version: string;
  description: string;

  // Schema format
  schemaFormat: 'official' | 'mcpb' | 'internal';
  schemaVersion: string;

  // Source data (original format)
  _original?: OfficialServerJSON | MCPBManifest | Record<string, any>;

  // Transport and connectivity
  transport: TransportType;
  baseUrl?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;

  // Capabilities
  capabilities: {
    tools: boolean;
    prompts: boolean;
    resources: boolean;
    sampling: boolean;
    logging: boolean;
  };

  // Metadata
  author?: { name: string; email?: string; url?: string };
  repository?: { type?: string; url: string; source?: string };
  homepage?: string;
  documentation?: string;
  icons?: { src: string; size?: string; theme?: string }[];
  tags?: string[];
  category?: string;
  license?: string;
  keywords?: string[];

  // Runtime state
  status: ServerStatus;
  lastHealthCheck?: number;
  latencyMs?: number;
  errorCount: number;
  consecutiveFailures: number;
  toolCount: number;

  // Tokenomics integration
  premium?: {
    featured: boolean;
    verifiedAuthor: boolean;
    sponsorTier?: 'bronze' | 'silver' | 'gold' | 'platinum';
    listingFee?: bigint;
  };

  // Timestamps
  registeredAt: number;
  updatedAt: number;
}

export interface RegisteredTool extends Tool {
  serverId: string;
  serverName: string;
  qualifiedName: string;
  category?: string;
  lastCalled?: number;
  callCount: number;
  avgLatencyMs: number;
  successRate: number;
}

// ============================================================================
// Cache System
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
}

class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    entry.hits++;
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.data;
  }

  set(key: string, data: T, ttl: number = 60000): void {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest (first) entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, { data, timestamp: Date.now(), ttl, hits: 0 });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  stats(): { size: number; maxSize: number; hitRate: number } {
    let totalHits = 0;
    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
    }
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.cache.size > 0 ? totalHits / this.cache.size : 0,
    };
  }
}

// ============================================================================
// Event System
// ============================================================================

type EventType = 'server:registered' | 'server:updated' | 'server:removed' |
                 'server:online' | 'server:offline' | 'tool:registered' |
                 'discovery:complete' | 'health:check';

interface RegistryEvent {
  type: EventType;
  timestamp: number;
  data: any;
}

type EventCallback = (event: RegistryEvent) => void;

class EventEmitter {
  private listeners = new Map<EventType, Set<EventCallback>>();

  on(type: EventType, callback: EventCallback): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);
    return () => this.off(type, callback);
  }

  off(type: EventType, callback: EventCallback): void {
    this.listeners.get(type)?.delete(callback);
  }

  emit(type: EventType, data: any): void {
    const event: RegistryEvent = { type, timestamp: Date.now(), data };
    this.listeners.get(type)?.forEach(cb => {
      try { cb(event); } catch (e) { console.error('[Registry Event Error]', e); }
    });
  }
}

// ============================================================================
// Circuit Breaker
// ============================================================================

interface CircuitState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

class CircuitBreaker {
  private circuits = new Map<string, CircuitState>();
  private threshold: number;
  private resetTimeout: number;

  constructor(threshold: number = 5, resetTimeout: number = 30000) {
    this.threshold = threshold;
    this.resetTimeout = resetTimeout;
  }

  canExecute(key: string): boolean {
    const circuit = this.circuits.get(key);
    if (!circuit) return true;

    if (circuit.state === 'closed') return true;

    if (circuit.state === 'open') {
      if (Date.now() - circuit.lastFailure > this.resetTimeout) {
        circuit.state = 'half-open';
        return true;
      }
      return false;
    }

    // half-open - allow one request
    return true;
  }

  recordSuccess(key: string): void {
    const circuit = this.circuits.get(key);
    if (circuit) {
      circuit.failures = 0;
      circuit.state = 'closed';
    }
  }

  recordFailure(key: string): void {
    let circuit = this.circuits.get(key);
    if (!circuit) {
      circuit = { failures: 0, lastFailure: 0, state: 'closed' };
      this.circuits.set(key, circuit);
    }

    circuit.failures++;
    circuit.lastFailure = Date.now();

    if (circuit.failures >= this.threshold) {
      circuit.state = 'open';
    }
  }

  getState(key: string): CircuitState | null {
    return this.circuits.get(key) || null;
  }
}

// ============================================================================
// Unified Registry Configuration
// ============================================================================

export interface UnifiedRegistryConfig {
  // Cache settings
  cacheTtlMs: number;
  cacheMaxSize: number;

  // Discovery settings
  discoveryUrls: string[];
  discoveryRetries: number;
  discoveryTimeoutMs: number;

  // Health check settings
  healthCheckIntervalMs: number;
  healthCheckTimeoutMs: number;
  maxConsecutiveFailures: number;

  // Circuit breaker settings
  circuitBreakerThreshold: number;
  circuitBreakerResetMs: number;

  // Pagination
  defaultPageSize: number;
  maxPageSize: number;
}

const DEFAULT_CONFIG: UnifiedRegistryConfig = {
  cacheTtlMs: 300000,  // 5 minutes
  cacheMaxSize: 1000,
  discoveryUrls: [
    'https://osvm.ai/.well-known/mcp-servers.json',
    'https://registry.modelcontextprotocol.io/v0/servers',
  ],
  discoveryRetries: 3,
  discoveryTimeoutMs: 10000,
  healthCheckIntervalMs: 60000,
  healthCheckTimeoutMs: 5000,
  maxConsecutiveFailures: 3,
  circuitBreakerThreshold: 5,
  circuitBreakerResetMs: 30000,
  defaultPageSize: 20,
  maxPageSize: 100,
};

// ============================================================================
// Unified MCP Registry
// ============================================================================

export class UnifiedMCPRegistry {
  private servers = new Map<string, UnifiedServer>();
  private tools = new Map<string, RegisteredTool>();
  private toolsByServer = new Map<string, string[]>();
  private config: UnifiedRegistryConfig;
  private cache: LRUCache<any>;
  private events = new EventEmitter();
  private circuitBreaker: CircuitBreaker;
  private healthCheckInterval?: ReturnType<typeof setInterval>;

  constructor(config: Partial<UnifiedRegistryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new LRUCache(this.config.cacheMaxSize);
    this.circuitBreaker = new CircuitBreaker(
      this.config.circuitBreakerThreshold,
      this.config.circuitBreakerResetMs
    );
  }

  // ==========================================================================
  // Schema Conversion
  // ==========================================================================

  /**
   * Convert Official Registry format to Unified format
   */
  private fromOfficialFormat(server: OfficialServerJSON): UnifiedServer {
    const nameParts = server.name.split('/');
    const id = nameParts[nameParts.length - 1] || server.name;

    return {
      id,
      name: server.name,
      displayName: server.title || server.name,
      version: server.version,
      description: server.description,
      schemaFormat: 'official',
      schemaVersion: server.$schema || SCHEMA_VERSIONS.OFFICIAL,
      _original: server,
      transport: server.remotes?.[0]?.type || 'http',
      baseUrl: server.remotes?.[0]?.url || server.websiteUrl,
      capabilities: {
        tools: true,
        prompts: (server._meta as any)?.capabilities?.prompts > 0,
        resources: (server._meta as any)?.capabilities?.resources > 0,
        sampling: false,
        logging: false,
      },
      repository: server.repository ? {
        type: 'git',
        url: server.repository.url || '',
        source: server.repository.source,
      } : undefined,
      homepage: server.websiteUrl,
      icons: server.icons?.map(i => ({
        src: i.src,
        size: i.sizes?.[0],
        theme: i.theme,
      })),
      tags: (server._meta as any)?.tags || [],
      category: (server._meta as any)?.category,
      status: 'unknown',
      errorCount: 0,
      consecutiveFailures: 0,
      toolCount: (server._meta as any)?.capabilities?.tools || 0,
      registeredAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /**
   * Convert MCPB Manifest format to Unified format
   */
  private fromMCPBFormat(manifest: MCPBManifest): UnifiedServer {
    return {
      id: manifest.name,
      name: manifest.name,
      displayName: manifest.display_name || manifest.name,
      version: manifest.version,
      description: manifest.description,
      schemaFormat: 'mcpb',
      schemaVersion: manifest.$schema || SCHEMA_VERSIONS.MCPB_V03,
      _original: manifest,
      transport: 'stdio',
      command: manifest.server.mcp_config.command,
      args: manifest.server.mcp_config.args,
      env: manifest.server.mcp_config.env,
      capabilities: {
        tools: !!manifest.tools?.length || !!manifest.tools_generated,
        prompts: !!manifest.prompts?.length || !!manifest.prompts_generated,
        resources: false,
        sampling: false,
        logging: false,
      },
      author: manifest.author,
      repository: manifest.repository ? {
        type: manifest.repository.type,
        url: manifest.repository.url,
      } : undefined,
      homepage: manifest.homepage,
      documentation: manifest.documentation,
      icons: manifest.icons?.map(i => ({
        src: i.src,
        size: i.size,
        theme: i.theme,
      })),
      tags: manifest.keywords,
      license: manifest.license,
      keywords: manifest.keywords,
      status: 'unknown',
      errorCount: 0,
      consecutiveFailures: 0,
      toolCount: manifest.tools?.length || 0,
      registeredAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /**
   * Convert Unified format to Official Registry format
   */
  toOfficialFormat(server: UnifiedServer): OfficialServerJSON {
    return {
      $schema: SCHEMA_VERSIONS.OFFICIAL,
      name: server.name.includes('/') ? server.name : `ai.osvm/${server.id}`,
      title: server.displayName,
      description: server.description,
      version: server.version,
      websiteUrl: server.homepage || server.baseUrl,
      repository: server.repository ? {
        url: server.repository.url,
        source: server.repository.source,
      } : undefined,
      icons: server.icons?.map(i => ({
        src: i.src,
        sizes: i.size ? [i.size] : undefined,
        theme: i.theme as 'light' | 'dark' | undefined,
      })),
      remotes: server.baseUrl ? [{ type: server.transport, url: server.baseUrl }] : undefined,
      _meta: {
        tags: server.tags,
        category: server.category,
        capabilities: {
          tools: server.toolCount,
          prompts: server.capabilities.prompts ? 1 : 0,
          resources: server.capabilities.resources ? 1 : 0,
        },
      },
    };
  }

  /**
   * Convert Unified format to MCPB Manifest format
   */
  toMCPBFormat(server: UnifiedServer): MCPBManifest {
    return {
      $schema: SCHEMA_VERSIONS.MCPB_V03,
      manifest_version: '0.3',
      name: server.id,
      display_name: server.displayName,
      version: server.version,
      description: server.description,
      author: server.author || { name: 'Unknown' },
      repository: server.repository ? {
        type: server.repository.type || 'git',
        url: server.repository.url,
      } : undefined,
      homepage: server.homepage,
      documentation: server.documentation,
      icons: server.icons?.map(i => ({
        src: i.src,
        size: i.size || '192x192',
        theme: i.theme,
      })),
      keywords: server.keywords || server.tags,
      license: server.license,
      server: {
        type: 'node',
        entry_point: 'src/index.ts',
        mcp_config: {
          command: server.command || 'bun',
          args: server.args || ['run', 'src/index.ts'],
          env: server.env,
        },
      },
      tools_generated: true,
    };
  }

  // ==========================================================================
  // CRUD Operations
  // ==========================================================================

  /**
   * Register a server (CREATE)
   */
  register(
    input: Partial<UnifiedServer> | OfficialServerJSON | MCPBManifest,
    format: 'unified' | 'official' | 'mcpb' = 'unified'
  ): UnifiedServer {
    let server: UnifiedServer;

    switch (format) {
      case 'official':
        server = this.fromOfficialFormat(input as OfficialServerJSON);
        break;
      case 'mcpb':
        server = this.fromMCPBFormat(input as MCPBManifest);
        break;
      default:
        server = {
          id: '',
          name: '',
          displayName: '',
          version: '1.0.0',
          description: '',
          schemaFormat: 'internal',
          schemaVersion: SCHEMA_VERSIONS.OPENSVM,
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
          consecutiveFailures: 0,
          toolCount: 0,
          registeredAt: Date.now(),
          updatedAt: Date.now(),
          ...(input as Partial<UnifiedServer>),
        } as UnifiedServer;
    }

    if (!server.id) {
      throw new Error('Server ID is required');
    }

    this.servers.set(server.id, server);
    this.toolsByServer.set(server.id, []);
    this.cache.delete(`server:${server.id}`);

    this.events.emit('server:registered', server);
    console.log(`[Registry] Registered: ${server.displayName} (${server.id})`);

    return server;
  }

  /**
   * Get a server (READ)
   */
  get(serverId: string): UnifiedServer | null {
    // Check cache first
    const cached = this.cache.get(`server:${serverId}`);
    if (cached) return cached;

    const server = this.servers.get(serverId) || null;
    if (server) {
      this.cache.set(`server:${serverId}`, server, this.config.cacheTtlMs);
    }
    return server;
  }

  /**
   * Update a server (UPDATE)
   */
  update(serverId: string, updates: Partial<UnifiedServer>): UnifiedServer | null {
    const server = this.servers.get(serverId);
    if (!server) return null;

    const updated = {
      ...server,
      ...updates,
      id: server.id,  // ID cannot be changed
      registeredAt: server.registeredAt,  // Original registration time
      updatedAt: Date.now(),
    };

    this.servers.set(serverId, updated);
    this.cache.delete(`server:${serverId}`);

    this.events.emit('server:updated', updated);
    return updated;
  }

  /**
   * Remove a server (DELETE)
   */
  remove(serverId: string): boolean {
    const server = this.servers.get(serverId);
    if (!server) return false;

    // Remove server's tools
    const serverTools = this.toolsByServer.get(serverId) || [];
    for (const qualifiedName of serverTools) {
      const tool = this.tools.get(qualifiedName);
      if (tool) {
        this.tools.delete(qualifiedName);
        if (this.tools.get(tool.name)?.serverId === serverId) {
          this.tools.delete(tool.name);
        }
      }
    }

    this.toolsByServer.delete(serverId);
    this.servers.delete(serverId);
    this.cache.delete(`server:${serverId}`);

    this.events.emit('server:removed', { id: serverId, name: server.displayName });
    console.log(`[Registry] Removed: ${server.displayName}`);

    return true;
  }

  /**
   * List servers with pagination
   */
  list(options?: {
    status?: ServerStatus;
    category?: string;
    tags?: string[];
    search?: string;
    featured?: boolean;
    page?: number;
    pageSize?: number;
  }): { servers: UnifiedServer[]; total: number; page: number; pageSize: number; hasMore: boolean } {
    let servers = Array.from(this.servers.values());

    // Apply filters
    if (options?.status) {
      servers = servers.filter(s => s.status === options.status);
    }
    if (options?.category) {
      servers = servers.filter(s => s.category === options.category);
    }
    if (options?.tags?.length) {
      servers = servers.filter(s =>
        options.tags!.some(tag => s.tags?.includes(tag))
      );
    }
    if (options?.search) {
      const search = options.search.toLowerCase();
      servers = servers.filter(s =>
        s.name.toLowerCase().includes(search) ||
        s.displayName.toLowerCase().includes(search) ||
        s.description.toLowerCase().includes(search)
      );
    }
    if (options?.featured) {
      servers = servers.filter(s => s.premium?.featured);
    }

    // Sort by premium status, then by name
    servers.sort((a, b) => {
      if (a.premium?.featured && !b.premium?.featured) return -1;
      if (!a.premium?.featured && b.premium?.featured) return 1;
      return a.displayName.localeCompare(b.displayName);
    });

    const total = servers.length;
    const pageSize = Math.min(options?.pageSize || this.config.defaultPageSize, this.config.maxPageSize);
    const page = options?.page || 1;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return {
      servers: servers.slice(start, end),
      total,
      page,
      pageSize,
      hasMore: end < total,
    };
  }

  // ==========================================================================
  // Tool Management
  // ==========================================================================

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
        serverName: server.displayName,
        qualifiedName,
        callCount: 0,
        avgLatencyMs: 0,
        successRate: 100,
      };

      this.tools.set(qualifiedName, registeredTool);
      if (!this.tools.has(tool.name)) {
        this.tools.set(tool.name, registeredTool);
      }
      toolNames.push(qualifiedName);
    }

    this.toolsByServer.set(serverId, toolNames);
    server.toolCount = tools.length;

    this.events.emit('tool:registered', { serverId, count: tools.length });
    console.log(`[Registry] Registered ${tools.length} tools for ${server.displayName}`);
  }

  findTool(name: string): RegisteredTool | null {
    const exact = this.tools.get(name);
    if (exact) return exact;

    for (const tool of this.tools.values()) {
      if (tool.qualifiedName === name || tool.name === name) {
        return tool;
      }
    }
    return null;
  }

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

  // ==========================================================================
  // Discovery
  // ==========================================================================

  async discover(): Promise<{ source: string; servers: UnifiedServer[]; errors: string[] }[]> {
    const results: { source: string; servers: UnifiedServer[]; errors: string[] }[] = [];

    for (const url of this.config.discoveryUrls) {
      if (!this.circuitBreaker.canExecute(`discovery:${url}`)) {
        results.push({ source: url, servers: [], errors: ['Circuit breaker open'] });
        continue;
      }

      try {
        const servers = await this.discoverFromUrl(url);
        this.circuitBreaker.recordSuccess(`discovery:${url}`);
        results.push({ source: url, servers, errors: [] });
      } catch (error) {
        this.circuitBreaker.recordFailure(`discovery:${url}`);
        results.push({
          source: url,
          servers: [],
          errors: [error instanceof Error ? error.message : String(error)]
        });
      }
    }

    this.events.emit('discovery:complete', results);
    return results;
  }

  private async discoverFromUrl(url: string): Promise<UnifiedServer[]> {
    const servers: UnifiedServer[] = [];
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.discoveryRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.config.discoveryTimeoutMs
        );

        const response = await fetch(url, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' },
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        // Handle different response formats
        if (Array.isArray(data.servers)) {
          for (const serverData of data.servers) {
            try {
              const server = this.detectAndRegister(serverData);
              servers.push(server);
            } catch (e) {
              console.error(`[Registry] Failed to register server:`, e);
            }
          }
        } else if (data.$schema?.includes('mcpb')) {
          // Single MCPB manifest
          servers.push(this.register(data, 'mcpb'));
        } else if (data.name && data.version) {
          // Single server
          servers.push(this.detectAndRegister(data));
        }

        return servers;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }

    throw lastError || new Error('Discovery failed');
  }

  private detectAndRegister(data: any): UnifiedServer {
    // Detect format and register appropriately
    if (data.manifest_version === '0.3' || data.$schema?.includes('mcpb')) {
      return this.register(data, 'mcpb');
    }
    if (data.$schema?.includes('modelcontextprotocol') || data.name?.includes('/')) {
      return this.register(data, 'official');
    }
    return this.register(data, 'unified');
  }

  // ==========================================================================
  // Health Checking
  // ==========================================================================

  startHealthChecks(): void {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(
      () => this.checkAllHealth(),
      this.config.healthCheckIntervalMs
    );

    // Initial check
    this.checkAllHealth();
  }

  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  async checkAllHealth(): Promise<Map<string, ServerStatus>> {
    const results = new Map<string, ServerStatus>();

    const promises = Array.from(this.servers.keys()).map(async (serverId) => {
      const status = await this.checkHealth(serverId);
      results.set(serverId, status);
    });

    await Promise.all(promises);
    this.events.emit('health:check', Object.fromEntries(results));
    return results;
  }

  async checkHealth(serverId: string): Promise<ServerStatus> {
    const server = this.servers.get(serverId);
    if (!server) return 'unknown';

    if (!this.circuitBreaker.canExecute(`health:${serverId}`)) {
      return 'offline';
    }

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
          server.consecutiveFailures = 0;
          this.circuitBreaker.recordSuccess(`health:${serverId}`);
          this.events.emit('server:online', server);
        } else {
          server.status = 'degraded';
          server.consecutiveFailures++;
          this.circuitBreaker.recordFailure(`health:${serverId}`);
        }
      } else {
        // For stdio, assume online
        server.status = 'online';
      }
    } catch {
      server.latencyMs = Date.now() - startTime;
      server.lastHealthCheck = Date.now();
      server.consecutiveFailures++;
      server.errorCount++;

      this.circuitBreaker.recordFailure(`health:${serverId}`);

      if (server.consecutiveFailures >= this.config.maxConsecutiveFailures) {
        server.status = 'offline';
        this.events.emit('server:offline', server);
      } else {
        server.status = 'degraded';
      }
    }

    return server.status;
  }

  // ==========================================================================
  // Event System
  // ==========================================================================

  on(event: EventType, callback: EventCallback): () => void {
    return this.events.on(event, callback);
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  getStats(): {
    serverCount: number;
    onlineServers: number;
    totalTools: number;
    toolsByCategory: Record<string, number>;
    cacheStats: { size: number; maxSize: number; hitRate: number };
  } {
    const servers = Array.from(this.servers.values());
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
      cacheStats: this.cache.stats(),
    };
  }

  // ==========================================================================
  // Export/Import
  // ==========================================================================

  export(format: 'unified' | 'official' | 'mcpb' = 'unified'): any[] {
    const servers = Array.from(this.servers.values());

    switch (format) {
      case 'official':
        return servers.map(s => this.toOfficialFormat(s));
      case 'mcpb':
        return servers.map(s => this.toMCPBFormat(s));
      default:
        return servers;
    }
  }

  import(data: any[], format: 'unified' | 'official' | 'mcpb' = 'unified'): number {
    let count = 0;
    for (const item of data) {
      try {
        this.register(item, format);
        count++;
      } catch (e) {
        console.error('[Registry] Import error:', e);
      }
    }
    return count;
  }
}

// ============================================================================
// Global Instance
// ============================================================================

let globalRegistry: UnifiedMCPRegistry | null = null;

export function getUnifiedRegistry(): UnifiedMCPRegistry {
  if (!globalRegistry) {
    globalRegistry = new UnifiedMCPRegistry();
  }
  return globalRegistry;
}

export function createUnifiedRegistry(config?: Partial<UnifiedRegistryConfig>): UnifiedMCPRegistry {
  globalRegistry = new UnifiedMCPRegistry(config);
  return globalRegistry;
}

// ============================================================================
// Exports
// ============================================================================

export const unifiedRegistry = {
  UnifiedMCPRegistry,
  getUnifiedRegistry,
  createUnifiedRegistry,
  SCHEMA_VERSIONS,
};
