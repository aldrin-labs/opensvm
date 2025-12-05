/**
 * MCP Federation API - Servers Endpoint
 *
 * GET /api/mcp/federation/servers - List federated servers
 * POST /api/mcp/federation/servers - Register a new server
 *
 * @module app/api/mcp/federation/servers
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// In-memory server registry (use Qdrant in production)
const servers = new Map<string, any>();
const trustMetrics = new Map<string, any>();

interface FederatedServer {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  mcpVersion: string;
  owner: string;
  tools: any[];
  capabilities: any;
  trustScore: number;
  registeredAt: number;
  lastSeenAt: number;
  metadata: any;
}

/**
 * GET /api/mcp/federation/servers
 *
 * List all federated servers with optional filtering
 *
 * Query params:
 * - minTrust: Minimum trust score (default: 20)
 * - category: Filter by tool category
 * - hasTools: Comma-separated list of required tools
 * - limit: Max results (default: 50)
 * - offset: Pagination offset
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const minTrust = parseInt(searchParams.get('minTrust') || '20');
    const category = searchParams.get('category');
    const hasTools = searchParams.get('hasTools')?.split(',').filter(Boolean);
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'));
    const offset = parseInt(searchParams.get('offset') || '0');

    let results = Array.from(servers.values());

    // Filter by trust
    results = results.filter(s => s.trustScore >= minTrust);

    // Filter by category
    if (category) {
      results = results.filter(s =>
        s.tools?.some((t: any) => t.category === category)
      );
    }

    // Filter by required tools
    if (hasTools && hasTools.length > 0) {
      results = results.filter(s =>
        hasTools.every(tool =>
          s.tools?.some((t: any) => t.name === tool)
        )
      );
    }

    // Sort by trust score descending
    results.sort((a, b) => b.trustScore - a.trustScore);

    // Paginate
    const total = results.length;
    results = results.slice(offset, offset + limit);

    // Return with pagination info
    return NextResponse.json({
      servers: results.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        endpoint: s.endpoint,
        mcpVersion: s.mcpVersion,
        owner: s.owner,
        toolCount: s.tools?.length || 0,
        tools: s.tools?.map((t: any) => ({
          name: t.name,
          category: t.category,
          description: t.description,
        })),
        capabilities: s.capabilities,
        trustScore: s.trustScore,
        registeredAt: s.registeredAt,
        lastSeenAt: s.lastSeenAt,
        metadata: {
          version: s.metadata?.version,
          region: s.metadata?.region,
          tags: s.metadata?.tags,
        },
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/mcp/federation/servers
 *
 * Register a new server in the federation
 *
 * Body:
 * - name: Server name
 * - description: Server description
 * - endpoint: Server base URL
 * - mcpVersion: MCP protocol version
 * - owner: Owner wallet address
 * - tools: Array of tool definitions
 * - capabilities: Server capabilities
 * - metadata: Additional metadata
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      endpoint,
      mcpVersion,
      owner,
      tools,
      capabilities,
      metadata,
    } = body;

    // Validate required fields
    if (!name || !endpoint || !owner) {
      return NextResponse.json(
        { error: 'Missing required fields: name, endpoint, owner' },
        { status: 400 }
      );
    }

    if (!tools || tools.length === 0) {
      return NextResponse.json(
        { error: 'Server must have at least one tool' },
        { status: 400 }
      );
    }

    // Validate endpoint URL
    try {
      new URL(endpoint);
    } catch {
      return NextResponse.json(
        { error: 'Invalid endpoint URL' },
        { status: 400 }
      );
    }

    // Generate server ID
    const id = `srv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();

    // Ping server to verify it's reachable
    const isReachable = await pingServer(endpoint);
    if (!isReachable) {
      return NextResponse.json(
        { error: 'Server is not reachable at the provided endpoint' },
        { status: 400 }
      );
    }

    // Create server record
    const server: FederatedServer = {
      id,
      name,
      description: description || '',
      endpoint,
      mcpVersion: mcpVersion || '1.0.0',
      owner,
      tools: tools.map((t: any) => ({
        name: t.name,
        description: t.description || '',
        inputSchema: t.inputSchema || {},
        category: t.category || 'general',
        pricing: t.pricing,
        rateLimit: t.rateLimit,
      })),
      capabilities: {
        streaming: capabilities?.streaming ?? false,
        batching: capabilities?.batching ?? false,
        webhooks: capabilities?.webhooks ?? false,
        customAuth: capabilities?.customAuth ?? false,
        maxConcurrentRequests: capabilities?.maxConcurrentRequests ?? 10,
        supportedAuthMethods: capabilities?.supportedAuthMethods ?? ['bearer'],
      },
      trustScore: 30, // Starting trust for new servers
      registeredAt: now,
      lastSeenAt: now,
      metadata: {
        version: metadata?.version || '1.0.0',
        region: metadata?.region,
        tags: metadata?.tags || [],
        website: metadata?.website,
        documentation: metadata?.documentation,
        supportContact: metadata?.supportContact,
        revenueSharePercent: metadata?.revenueSharePercent ?? 70,
        minTrustRequired: metadata?.minTrustRequired ?? 0,
      },
    };

    // Store server
    servers.set(id, server);

    // Initialize trust metrics
    trustMetrics.set(id, {
      uptime: 100,
      avgResponseTimeMs: 0,
      successRate: 100,
      totalRequests: 0,
      totalErrors: 0,
      qualityScore: 50,
      reportCount: 0,
      verifiedOwner: false,
      auditedCode: false,
    });

    return NextResponse.json({
      success: true,
      serverId: id,
      server: {
        id: server.id,
        name: server.name,
        endpoint: server.endpoint,
        trustScore: server.trustScore,
        registeredAt: server.registeredAt,
        toolCount: server.tools.length,
      },
      message: 'Server registered successfully. Initial trust score: 30',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/mcp/federation/servers
 *
 * Unregister a server (requires owner signature in production)
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const serverId = searchParams.get('id');
    const signature = searchParams.get('signature');

    if (!serverId) {
      return NextResponse.json(
        { error: 'Missing server ID' },
        { status: 400 }
      );
    }

    const server = servers.get(serverId);
    if (!server) {
      return NextResponse.json(
        { error: 'Server not found' },
        { status: 404 }
      );
    }

    // In production, verify owner signature
    // For now, just delete
    servers.delete(serverId);
    trustMetrics.delete(serverId);

    return NextResponse.json({
      success: true,
      deletedId: serverId,
      message: 'Server unregistered successfully',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Helper function to ping a server
async function pingServer(endpoint: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${endpoint}/health`, {
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeout);

    // Also try /api/health or just the endpoint
    if (!response?.ok) {
      const altResponse = await fetch(endpoint, {
        method: 'HEAD',
      }).catch(() => null);
      return altResponse?.ok ?? false;
    }

    return true;
  } catch {
    return false;
  }
}
