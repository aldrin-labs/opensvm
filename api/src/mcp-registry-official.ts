/**
 * Official MCP Registry Compatibility
 *
 * Implements compatibility with the official MCP Registry at:
 * https://github.com/modelcontextprotocol/registry
 *
 * Schema version: 2025-10-17
 * Registry API: https://registry.modelcontextprotocol.io
 */

// ============================================================================
// Official MCP Registry Schema Types
// ============================================================================

export const MCP_SCHEMA_VERSION = 'https://modelcontextprotocol.io/schemas/server-v1.2025-10-17.json';

export type TransportType = 'stdio' | 'http' | 'sse' | 'websocket';
export type RegistryType = 'npm' | 'pypi' | 'oci' | 'nuget' | 'mcpb' | 'cargo';
export type RuntimeHint = 'npx' | 'uvx' | 'docker' | 'cargo' | 'python' | 'node' | 'bun' | 'dnx';
export type IconMimeType = 'image/png' | 'image/jpeg' | 'image/svg+xml' | 'image/webp';
export type IconTheme = 'light' | 'dark';
export type ServerStatus = 'active' | 'deprecated' | 'deleted';

export interface Icon {
  src: string;
  mimeType?: IconMimeType;
  sizes?: string[];
  theme?: IconTheme;
}

export interface KeyValueInput {
  name: string;
  description?: string;
  required?: boolean;
  secret?: boolean;
}

export interface Argument {
  name: string;
  description?: string;
  required?: boolean;
  default?: string;
}

export interface Transport {
  type: TransportType;
  url?: string;
  headers?: KeyValueInput[];
}

export interface Package {
  registryType: RegistryType;
  registryBaseUrl?: string;
  identifier: string;
  version?: string;
  fileSha256?: string;
  runtimeHint?: RuntimeHint;
  transport: Transport;
  runtimeArguments?: Argument[];
  packageArguments?: Argument[];
  environmentVariables?: KeyValueInput[];
}

export interface Repository {
  url?: string;
  source?: string;
  id?: string;
  subfolder?: string;
}

export interface RegistryExtensions {
  status: ServerStatus;
  publishedAt: string;
  updatedAt: string;
  isLatest: boolean;
}

export interface ServerMeta {
  [key: string]: any;
}

/**
 * Official MCP Server JSON Schema
 * Compatible with https://modelcontextprotocol.io/schemas/server-v1.2025-10-17.json
 */
export interface ServerJSON {
  $schema: string;
  name: string;  // Reverse-DNS format: "io.github.username/server-name"
  description: string;
  title?: string;
  version: string;
  websiteUrl?: string;
  repository?: Repository;
  icons?: Icon[];
  packages?: Package[];
  remotes?: Transport[];
  _meta?: ServerMeta;
}

export interface ServerResponse {
  server: ServerJSON;
  _meta: {
    'io.modelcontextprotocol.registry/official': RegistryExtensions;
  };
}

export interface ServerListResponse {
  servers: ServerResponse[];
  metadata: {
    nextCursor?: string;
    count: number;
  };
}

// ============================================================================
// OpenSVM Server Definition
// ============================================================================

export const OPENSVM_SERVER: ServerJSON = {
  $schema: MCP_SCHEMA_VERSION,
  name: 'ai.osvm/opensvm-mcp',
  title: 'OpenSVM MCP Server',
  description: 'Solana blockchain explorer with AI-powered analytics. Provides 34 tools for transaction analysis, wallet forensics, token data, and autonomous blockchain investigations.',
  version: '2.0.0',
  websiteUrl: 'https://osvm.ai',
  repository: {
    url: 'https://github.com/aldrin-labs/opensvm',
    source: 'github',
  },
  icons: [
    {
      src: 'https://osvm.ai/icon.svg',
      mimeType: 'image/svg+xml',
    },
    {
      src: 'https://osvm.ai/icon.png',
      mimeType: 'image/png',
      sizes: ['192x192'],
    },
  ],
  packages: [
    {
      registryType: 'npm',
      identifier: '@opensvm/mcp-server',
      version: '2.0.0',
      runtimeHint: 'bun',
      transport: { type: 'stdio' },
      environmentVariables: [
        {
          name: 'OPENSVM_API_KEY',
          description: 'OpenSVM API key for authenticated requests (optional)',
          required: false,
          secret: true,
        },
      ],
    },
  ],
  remotes: [
    {
      type: 'http',
      url: 'https://osvm.ai/api/mcp',
    },
    {
      type: 'sse',
      url: 'https://osvm.ai/api/mcp/stream',
    },
  ],
  _meta: {
    category: 'blockchain',
    tags: ['solana', 'blockchain', 'explorer', 'ai', 'forensics', 'defi', 'nft'],
    capabilities: {
      tools: 34,
      prompts: 4,
      resources: 3,
    },
    features: [
      'Transaction analysis',
      'Wallet forensics',
      'Token metadata',
      'AI-powered insights',
      'Autonomous investigations',
      'Batch execution',
      'Tool pipelines',
      'Context compression',
    ],
  },
};

// ============================================================================
// DFlow Server Definition
// ============================================================================

export const DFLOW_SERVER: ServerJSON = {
  $schema: MCP_SCHEMA_VERSION,
  name: 'ai.osvm/dflow-mcp',
  title: 'DFlow Prediction Markets MCP',
  description: 'Prediction market metadata and live data API. Provides 23 tools for accessing events, markets, trades, forecasts, and candlestick data from prediction markets.',
  version: '1.0.0',
  websiteUrl: 'https://dflow.opensvm.com',
  repository: {
    url: 'https://github.com/aldrin-labs/opensvm',
    source: 'github',
    subfolder: 'api',
  },
  icons: [
    {
      src: 'https://dflow.opensvm.com/icon.svg',
      mimeType: 'image/svg+xml',
    },
  ],
  packages: [
    {
      registryType: 'npm',
      identifier: '@opensvm/dflow-mcp',
      version: '1.0.0',
      runtimeHint: 'bun',
      transport: { type: 'stdio' },
    },
  ],
  remotes: [
    {
      type: 'http',
      url: 'https://prediction-markets-api.dflow.net',
    },
  ],
  _meta: {
    category: 'markets',
    tags: ['prediction-markets', 'trading', 'forecasts', 'kalshi', 'solana'],
    capabilities: {
      tools: 23,
      prompts: 2,
      resources: 3,
    },
  },
};

// ============================================================================
// MCP Gateway Server Definition
// ============================================================================

export const GATEWAY_SERVER: ServerJSON = {
  $schema: MCP_SCHEMA_VERSION,
  name: 'ai.osvm/mcp-gateway',
  title: 'OpenSVM MCP Gateway',
  description: 'Unified MCP gateway aggregating tools from multiple servers. Provides 57+ tools from OpenSVM and DFlow with automatic discovery, health checking, and intelligent routing.',
  version: '1.0.0',
  websiteUrl: 'https://osvm.ai/gateway',
  repository: {
    url: 'https://github.com/aldrin-labs/opensvm',
    source: 'github',
    subfolder: 'api',
  },
  packages: [
    {
      registryType: 'npm',
      identifier: '@opensvm/mcp-gateway',
      version: '1.0.0',
      runtimeHint: 'bun',
      transport: { type: 'stdio' },
    },
  ],
  remotes: [
    {
      type: 'http',
      url: 'https://osvm.ai/api/gateway',
    },
  ],
  _meta: {
    category: 'infrastructure',
    tags: ['gateway', 'registry', 'aggregator', 'discovery'],
    capabilities: {
      tools: 62,  // 34 + 23 + 5 management tools
      prompts: 6,
      resources: 6,
    },
    features: [
      'Server registry',
      'Auto-discovery',
      'Health checking',
      'Failover',
      'Tool routing',
      'Cross-server pipelines',
    ],
    aggregatedServers: ['ai.osvm/opensvm-mcp', 'ai.osvm/dflow-mcp'],
  },
};

// ============================================================================
// Registry API Client
// ============================================================================

const REGISTRY_API_URL = 'https://registry.modelcontextprotocol.io';

export class OfficialRegistryClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string = REGISTRY_API_URL, timeout: number = 30000) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeout = timeout;
  }

  /**
   * List servers from the official registry
   */
  async listServers(options?: {
    cursor?: string;
    limit?: number;
    status?: ServerStatus;
  }): Promise<ServerListResponse> {
    const url = new URL(`${this.baseUrl}/v0/servers`);
    if (options?.cursor) url.searchParams.set('cursor', options.cursor);
    if (options?.limit) url.searchParams.set('limit', String(options.limit));
    if (options?.status) url.searchParams.set('status', options.status);

    const response = await this.fetch(url.toString());
    return response as ServerListResponse;
  }

  /**
   * Get a specific server by name
   */
  async getServer(name: string, version?: string): Promise<ServerResponse> {
    const path = version ? `/v0/servers/${name}/${version}` : `/v0/servers/${name}`;
    return await this.fetch(`${this.baseUrl}${path}`) as ServerResponse;
  }

  /**
   * Search servers
   */
  async searchServers(query: string): Promise<ServerListResponse> {
    const url = new URL(`${this.baseUrl}/v0/servers`);
    url.searchParams.set('q', query);
    return await this.fetch(url.toString()) as ServerListResponse;
  }

  private async fetch(url: string): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
}

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Export our servers in official registry format
 */
export function exportToOfficialFormat(): ServerJSON[] {
  return [OPENSVM_SERVER, DFLOW_SERVER, GATEWAY_SERVER];
}

/**
 * Generate server.json file content
 */
export function generateServerJson(server: ServerJSON): string {
  return JSON.stringify(server, null, 2);
}

/**
 * Validate a server against the official schema
 */
export function validateServer(server: Partial<ServerJSON>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Required fields
  if (!server.name) errors.push('Missing required field: name');
  if (!server.description) errors.push('Missing required field: description');
  if (!server.version) errors.push('Missing required field: version');

  // Name format (reverse-DNS with exactly one slash)
  if (server.name) {
    const slashCount = (server.name.match(/\//g) || []).length;
    if (slashCount !== 1) {
      errors.push('Name must contain exactly one forward slash (reverse-DNS format)');
    }
  }

  // Version format (should be semver)
  if (server.version && !/^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/.test(server.version)) {
    errors.push('Version should follow semantic versioning (e.g., 1.0.0)');
  }

  // Package validation
  if (server.packages) {
    for (let i = 0; i < server.packages.length; i++) {
      const pkg = server.packages[i];
      if (!pkg.registryType) errors.push(`Package[${i}]: Missing registryType`);
      if (!pkg.identifier) errors.push(`Package[${i}]: Missing identifier`);
      if (!pkg.transport) errors.push(`Package[${i}]: Missing transport`);
    }
  }

  // Icon validation
  if (server.icons) {
    for (let i = 0; i < server.icons.length; i++) {
      const icon = server.icons[i];
      if (!icon.src) errors.push(`Icon[${i}]: Missing src`);
      if (icon.src && !icon.src.startsWith('http')) {
        errors.push(`Icon[${i}]: src must be a valid URL`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Convert our internal server format to official format
 */
export function convertToOfficialFormat(internal: {
  id: string;
  name: string;
  version: string;
  description?: string;
  baseUrl?: string;
  transport?: string;
  repository?: string;
  tags?: string[];
}): ServerJSON {
  // Convert id to reverse-DNS name
  const name = internal.id.includes('/') ? internal.id : `ai.osvm/${internal.id}`;

  return {
    $schema: MCP_SCHEMA_VERSION,
    name,
    title: internal.name,
    description: internal.description || `${internal.name} MCP Server`,
    version: internal.version,
    websiteUrl: internal.baseUrl,
    repository: internal.repository ? {
      url: internal.repository,
      source: 'github',
    } : undefined,
    remotes: internal.baseUrl ? [
      { type: (internal.transport as TransportType) || 'http', url: internal.baseUrl },
    ] : undefined,
    _meta: {
      tags: internal.tags || [],
    },
  };
}

// ============================================================================
// Well-Known Endpoint Data
// ============================================================================

/**
 * Generate .well-known/mcp-servers.json content for discovery
 */
export function generateWellKnownServers(): {
  servers: ServerJSON[];
  updated: string;
  registry: string;
} {
  return {
    servers: exportToOfficialFormat(),
    updated: new Date().toISOString(),
    registry: 'https://registry.modelcontextprotocol.io',
  };
}

// ============================================================================
// Exports
// ============================================================================

export const officialRegistry = {
  // Schema
  MCP_SCHEMA_VERSION,

  // Server definitions
  OPENSVM_SERVER,
  DFLOW_SERVER,
  GATEWAY_SERVER,

  // Client
  OfficialRegistryClient,

  // Functions
  exportToOfficialFormat,
  generateServerJson,
  validateServer,
  convertToOfficialFormat,
  generateWellKnownServers,
};
