/**
 * MCP Registry REST API
 *
 * Full CRUD operations for MCP server registry management.
 *
 * GET /api/mcp/registry - List servers with filtering and pagination
 * GET /api/mcp/registry?id=xxx - Get specific server
 * GET /api/mcp/registry?action=stats - Get registry statistics
 * GET /api/mcp/registry?action=discover - Trigger discovery
 * GET /api/mcp/registry?action=export&format=official|mcpb - Export registry
 * POST /api/mcp/registry - Register new server
 * PUT /api/mcp/registry - Update existing server
 * DELETE /api/mcp/registry?id=xxx - Remove server
 */

import { NextRequest, NextResponse } from 'next/server';

// ============================================================================
// Types (simplified for Edge Runtime compatibility)
// ============================================================================

type ServerStatus = 'online' | 'offline' | 'degraded' | 'unknown' | 'deprecated';
type TransportType = 'stdio' | 'http' | 'sse' | 'websocket';

interface UnifiedServer {
  id: string;
  name: string;
  displayName: string;
  version: string;
  description: string;
  schemaFormat: 'official' | 'mcpb' | 'internal';
  transport: TransportType;
  baseUrl?: string;
  capabilities: {
    tools: boolean;
    prompts: boolean;
    resources: boolean;
  };
  author?: { name: string; url?: string };
  repository?: { url: string; source?: string };
  homepage?: string;
  icons?: { src: string; size?: string }[];
  tags?: string[];
  category?: string;
  status: ServerStatus;
  toolCount: number;
  registeredAt: number;
  updatedAt: number;
  premium?: {
    featured: boolean;
    verifiedAuthor: boolean;
    sponsorTier?: string;
  };
}

// ============================================================================
// In-Memory Registry (Edge Runtime compatible)
// ============================================================================

const BUILTIN_SERVERS: UnifiedServer[] = [
  {
    id: 'opensvm-mcp',
    name: 'ai.osvm/opensvm-mcp',
    displayName: 'OpenSVM MCP Server',
    version: '2.0.0',
    description: 'Solana blockchain explorer with AI-powered analytics. Provides 34 tools for transaction analysis, wallet forensics, token data, and autonomous investigations.',
    schemaFormat: 'official',
    transport: 'http',
    baseUrl: 'https://osvm.ai/api/mcp',
    capabilities: { tools: true, prompts: true, resources: true },
    author: { name: 'OpenSVM', url: 'https://osvm.ai' },
    repository: { url: 'https://github.com/aldrin-labs/opensvm', source: 'github' },
    homepage: 'https://osvm.ai',
    icons: [{ src: 'https://osvm.ai/icon.svg' }],
    tags: ['solana', 'blockchain', 'explorer', 'ai', 'forensics', 'defi', 'nft'],
    category: 'blockchain',
    status: 'online',
    toolCount: 34,
    registeredAt: Date.now(),
    updatedAt: Date.now(),
    premium: { featured: true, verifiedAuthor: true, sponsorTier: 'platinum' },
  },
  {
    id: 'dflow-mcp',
    name: 'ai.osvm/dflow-mcp',
    displayName: 'DFlow Prediction Markets',
    version: '1.0.0',
    description: 'Prediction market metadata and live data API. Provides 23 tools for events, markets, trades, forecasts, and candlestick data.',
    schemaFormat: 'official',
    transport: 'http',
    baseUrl: 'https://prediction-markets-api.dflow.net',
    capabilities: { tools: true, prompts: true, resources: true },
    author: { name: 'DFlow' },
    repository: { url: 'https://github.com/aldrin-labs/opensvm', source: 'github' },
    homepage: 'https://dflow.opensvm.com',
    icons: [{ src: 'https://dflow.opensvm.com/icon.svg' }],
    tags: ['prediction-markets', 'trading', 'forecasts', 'kalshi'],
    category: 'markets',
    status: 'online',
    toolCount: 23,
    registeredAt: Date.now(),
    updatedAt: Date.now(),
    premium: { featured: true, verifiedAuthor: true },
  },
  {
    id: 'mcp-gateway',
    name: 'ai.osvm/mcp-gateway',
    displayName: 'OpenSVM MCP Gateway',
    version: '1.0.0',
    description: 'Unified MCP gateway aggregating tools from multiple servers. Provides 62+ tools with auto-discovery, health checking, and intelligent routing.',
    schemaFormat: 'official',
    transport: 'http',
    baseUrl: 'https://osvm.ai/api/gateway',
    capabilities: { tools: true, prompts: true, resources: true },
    author: { name: 'OpenSVM' },
    repository: { url: 'https://github.com/aldrin-labs/opensvm', source: 'github' },
    homepage: 'https://osvm.ai/gateway',
    tags: ['gateway', 'registry', 'aggregator', 'discovery'],
    category: 'infrastructure',
    status: 'online',
    toolCount: 62,
    registeredAt: Date.now(),
    updatedAt: Date.now(),
    premium: { featured: false, verifiedAuthor: true },
  },
];

// Simple in-memory store (in production, use KV or database)
const servers = new Map<string, UnifiedServer>(
  BUILTIN_SERVERS.map(s => [s.id, s])
);

// ============================================================================
// Helper Functions
// ============================================================================

function toOfficialFormat(server: UnifiedServer): any {
  return {
    $schema: 'https://modelcontextprotocol.io/schemas/server-v1.2025-10-17.json',
    name: server.name,
    title: server.displayName,
    description: server.description,
    version: server.version,
    websiteUrl: server.homepage,
    repository: server.repository ? {
      url: server.repository.url,
      source: server.repository.source,
    } : undefined,
    icons: server.icons?.map(i => ({ src: i.src, sizes: i.size ? [i.size] : undefined })),
    remotes: server.baseUrl ? [{ type: server.transport, url: server.baseUrl }] : undefined,
    _meta: {
      tags: server.tags,
      category: server.category,
      capabilities: { tools: server.toolCount },
    },
  };
}

function toMCPBFormat(server: UnifiedServer): any {
  return {
    $schema: 'https://mcpb.anthropic.com/schemas/mcpb-manifest-v0.3.json',
    manifest_version: '0.3',
    name: server.id,
    display_name: server.displayName,
    version: server.version,
    description: server.description,
    author: server.author || { name: 'Unknown' },
    repository: server.repository ? {
      type: 'git',
      url: server.repository.url,
    } : undefined,
    homepage: server.homepage,
    icons: server.icons?.map(i => ({ src: i.src, size: i.size || '192x192' })),
    keywords: server.tags,
    server: {
      type: 'node',
      entry_point: 'src/index.ts',
      mcp_config: { command: 'bun', args: ['run', 'src/index.ts'] },
    },
    tools_generated: true,
  };
}

function validateServer(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.id && !data.name) errors.push('Server ID or name is required');
  if (!data.description) errors.push('Description is required');
  if (!data.version) errors.push('Version is required');

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// GET Handler
// ============================================================================

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const action = searchParams.get('action');
  const format = searchParams.get('format') as 'official' | 'mcpb' | null;

  // Filter parameters
  const status = searchParams.get('status') as ServerStatus | null;
  const category = searchParams.get('category');
  const tags = searchParams.get('tags')?.split(',');
  const search = searchParams.get('search');
  const featured = searchParams.get('featured') === 'true';
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100);

  try {
    // Get specific server
    if (id) {
      const server = servers.get(id);
      if (!server) {
        return NextResponse.json({ error: 'Server not found' }, { status: 404 });
      }

      if (format === 'official') {
        return NextResponse.json(toOfficialFormat(server));
      } else if (format === 'mcpb') {
        return NextResponse.json(toMCPBFormat(server));
      }
      return NextResponse.json({ server });
    }

    // Get registry statistics
    if (action === 'stats') {
      const allServers = Array.from(servers.values());
      const toolsByCategory: Record<string, number> = {};

      for (const server of allServers) {
        const cat = server.category || 'other';
        toolsByCategory[cat] = (toolsByCategory[cat] || 0) + server.toolCount;
      }

      return NextResponse.json({
        stats: {
          serverCount: allServers.length,
          onlineServers: allServers.filter(s => s.status === 'online').length,
          totalTools: allServers.reduce((sum, s) => sum + s.toolCount, 0),
          featuredServers: allServers.filter(s => s.premium?.featured).length,
          toolsByCategory,
          categories: [...new Set(allServers.map(s => s.category).filter(Boolean))],
          tags: [...new Set(allServers.flatMap(s => s.tags || []))],
        },
      });
    }

    // Trigger discovery (mock - would fetch from external registries)
    if (action === 'discover') {
      return NextResponse.json({
        discovered: [],
        sources: [
          'https://osvm.ai/.well-known/mcp-servers.json',
          'https://registry.modelcontextprotocol.io/v0/servers',
        ],
        message: 'Discovery completed. No new servers found.',
      });
    }

    // Export registry
    if (action === 'export') {
      const allServers = Array.from(servers.values());

      if (format === 'official') {
        return NextResponse.json({
          $schema: 'https://modelcontextprotocol.io/schemas/server-list-v1.json',
          servers: allServers.map(toOfficialFormat),
          metadata: { count: allServers.length },
        });
      } else if (format === 'mcpb') {
        return NextResponse.json({
          manifests: allServers.map(toMCPBFormat),
          count: allServers.length,
        });
      }

      return NextResponse.json({
        servers: allServers,
        exported: new Date().toISOString(),
      });
    }

    // List servers with filtering and pagination
    let filtered = Array.from(servers.values());

    if (status) filtered = filtered.filter(s => s.status === status);
    if (category) filtered = filtered.filter(s => s.category === category);
    if (tags?.length) filtered = filtered.filter(s => tags.some(t => s.tags?.includes(t)));
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.displayName.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
      );
    }
    if (featured) filtered = filtered.filter(s => s.premium?.featured);

    // Sort: featured first, then by display name
    filtered.sort((a, b) => {
      if (a.premium?.featured && !b.premium?.featured) return -1;
      if (!a.premium?.featured && b.premium?.featured) return 1;
      return a.displayName.localeCompare(b.displayName);
    });

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const paged = filtered.slice(start, start + pageSize);

    return NextResponse.json({
      servers: paged,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        hasMore: start + pageSize < total,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST Handler (Create)
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { server: serverData, format } = body;

    if (!serverData) {
      return NextResponse.json({ error: 'Server data required' }, { status: 400 });
    }

    // Convert from different formats
    let server: UnifiedServer;

    if (format === 'mcpb') {
      // Convert MCPB manifest to unified format
      server = {
        id: serverData.name,
        name: serverData.name,
        displayName: serverData.display_name || serverData.name,
        version: serverData.version,
        description: serverData.description,
        schemaFormat: 'mcpb',
        transport: 'stdio',
        capabilities: {
          tools: !!serverData.tools?.length || serverData.tools_generated,
          prompts: !!serverData.prompts?.length,
          resources: false,
        },
        author: serverData.author,
        repository: serverData.repository ? { url: serverData.repository.url } : undefined,
        homepage: serverData.homepage,
        tags: serverData.keywords,
        category: 'community',
        status: 'unknown',
        toolCount: serverData.tools?.length || 0,
        registeredAt: Date.now(),
        updatedAt: Date.now(),
      };
    } else if (format === 'official') {
      // Convert official format to unified
      const nameParts = (serverData.name || '').split('/');
      const id = nameParts[nameParts.length - 1] || serverData.name;

      server = {
        id,
        name: serverData.name,
        displayName: serverData.title || serverData.name,
        version: serverData.version,
        description: serverData.description,
        schemaFormat: 'official',
        transport: serverData.remotes?.[0]?.type || 'http',
        baseUrl: serverData.remotes?.[0]?.url || serverData.websiteUrl,
        capabilities: {
          tools: true,
          prompts: (serverData._meta?.capabilities?.prompts || 0) > 0,
          resources: (serverData._meta?.capabilities?.resources || 0) > 0,
        },
        repository: serverData.repository,
        homepage: serverData.websiteUrl,
        icons: serverData.icons?.map((i: any) => ({ src: i.src, size: i.sizes?.[0] })),
        tags: serverData._meta?.tags || [],
        category: serverData._meta?.category,
        status: 'unknown',
        toolCount: serverData._meta?.capabilities?.tools || 0,
        registeredAt: Date.now(),
        updatedAt: Date.now(),
      };
    } else {
      // Unified format
      const validation = validateServer(serverData);
      if (!validation.valid) {
        return NextResponse.json({ error: 'Validation failed', errors: validation.errors }, { status: 400 });
      }

      server = {
        id: serverData.id || serverData.name?.split('/')?.pop() || `server-${Date.now()}`,
        name: serverData.name || serverData.id,
        displayName: serverData.displayName || serverData.name,
        version: serverData.version || '1.0.0',
        description: serverData.description,
        schemaFormat: 'internal',
        transport: serverData.transport || 'http',
        baseUrl: serverData.baseUrl,
        capabilities: serverData.capabilities || { tools: true, prompts: false, resources: false },
        author: serverData.author,
        repository: serverData.repository,
        homepage: serverData.homepage,
        icons: serverData.icons,
        tags: serverData.tags,
        category: serverData.category,
        status: 'unknown',
        toolCount: serverData.toolCount || 0,
        registeredAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    // Check for duplicate
    if (servers.has(server.id)) {
      return NextResponse.json(
        { error: `Server with ID '${server.id}' already exists. Use PUT to update.` },
        { status: 409 }
      );
    }

    servers.set(server.id, server);

    return NextResponse.json({
      success: true,
      server,
      message: `Server '${server.displayName}' registered successfully`,
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT Handler (Update)
// ============================================================================

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Server ID required' }, { status: 400 });
    }

    const existing = servers.get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 });
    }

    const updated: UnifiedServer = {
      ...existing,
      ...updates,
      id: existing.id,  // ID cannot be changed
      registeredAt: existing.registeredAt,
      updatedAt: Date.now(),
    };

    servers.set(id, updated);

    return NextResponse.json({
      success: true,
      server: updated,
      message: `Server '${updated.displayName}' updated successfully`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE Handler
// ============================================================================

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Server ID required' }, { status: 400 });
  }

  const server = servers.get(id);
  if (!server) {
    return NextResponse.json({ error: 'Server not found' }, { status: 404 });
  }

  // Prevent deletion of builtin servers
  if (BUILTIN_SERVERS.some(s => s.id === id)) {
    return NextResponse.json(
      { error: 'Cannot delete built-in servers' },
      { status: 403 }
    );
  }

  servers.delete(id);

  return NextResponse.json({
    success: true,
    message: `Server '${server.displayName}' removed successfully`,
  });
}

export const runtime = 'edge';
