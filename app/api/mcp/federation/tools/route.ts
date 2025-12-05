/**
 * MCP Federation API - Tools Search Endpoint
 *
 * GET /api/mcp/federation/tools - Search for tools across federated servers
 * POST /api/mcp/federation/tools - Call a tool on a remote server
 *
 * @module app/api/mcp/federation/tools
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// In-memory server registry (shared with servers route)
const servers = new Map<string, any>();

// Result cache for tool calls
const resultCache = new Map<string, { result: any; timestamp: number }>();
const CACHE_TTL_MS = 60000; // 1 minute

/**
 * GET /api/mcp/federation/tools
 *
 * Search for tools across all federated servers
 *
 * Query params:
 * - q: Search query (searches name, description, category)
 * - category: Filter by category
 * - minTrust: Minimum server trust score (default: 20)
 * - limit: Max results (default: 50)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const category = searchParams.get('category');
    const minTrust = parseInt(searchParams.get('minTrust') || '20');
    const limit = Math.min(200, parseInt(searchParams.get('limit') || '50'));

    const queryLower = query.toLowerCase();
    const results: Array<{
      server: { id: string; name: string; endpoint: string; trustScore: number };
      tool: any;
      score: number;
    }> = [];

    // Search across all servers
    for (const server of servers.values()) {
      if (server.trustScore < minTrust) continue;

      for (const tool of server.tools || []) {
        // Filter by category if specified
        if (category && tool.category !== category) continue;

        // Calculate match score
        let score = 0;
        if (query) {
          if (tool.name.toLowerCase().includes(queryLower)) score += 50;
          if (tool.description?.toLowerCase().includes(queryLower)) score += 30;
          if (tool.category?.toLowerCase().includes(queryLower)) score += 20;
        } else {
          score = 50; // Base score for no query (list all)
        }

        // Boost by server trust
        score += server.trustScore * 0.3;

        if (score > 0 || !query) {
          results.push({
            server: {
              id: server.id,
              name: server.name,
              endpoint: server.endpoint,
              trustScore: server.trustScore,
            },
            tool: {
              name: tool.name,
              description: tool.description,
              category: tool.category,
              inputSchema: tool.inputSchema,
              pricing: tool.pricing,
              rateLimit: tool.rateLimit,
            },
            score,
          });
        }
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Limit results
    const limited = results.slice(0, limit);

    // Get unique categories
    const categories = [...new Set(results.map(r => r.tool.category).filter(Boolean))];

    return NextResponse.json({
      query,
      total: results.length,
      returned: limited.length,
      categories,
      tools: limited.map(r => ({
        serverId: r.server.id,
        serverName: r.server.name,
        serverTrust: r.server.trustScore,
        tool: r.tool,
        score: Math.round(r.score),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/mcp/federation/tools
 *
 * Call a tool on a remote federated server
 *
 * Body:
 * - serverId: Target server ID (optional if using auto-select)
 * - tool: Tool name to call
 * - params: Tool parameters
 * - apiKey: API key for authentication (optional)
 * - useCache: Whether to use cached results (default: true)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { serverId, tool, params, apiKey, useCache = true } = body;

    if (!tool) {
      return NextResponse.json(
        { error: 'Missing required field: tool' },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    // Check cache first
    if (useCache) {
      const cacheKey = `${serverId || 'auto'}:${tool}:${JSON.stringify(params)}`;
      const cached = resultCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return NextResponse.json({
          success: true,
          result: cached.result,
          serverId: serverId || 'cached',
          tool,
          durationMs: Date.now() - startTime,
          fromCache: true,
        });
      }
    }

    // Find server
    let targetServer: any;

    if (serverId) {
      targetServer = servers.get(serverId);
      if (!targetServer) {
        return NextResponse.json({
          success: false,
          error: `Server not found: ${serverId}`,
          serverId,
          tool,
          durationMs: Date.now() - startTime,
          fromCache: false,
        });
      }
    } else {
      // Auto-select best server with this tool
      const candidates = Array.from(servers.values())
        .filter(s => s.trustScore >= 20)
        .filter(s => s.tools?.some((t: any) => t.name === tool))
        .sort((a, b) => b.trustScore - a.trustScore);

      if (candidates.length === 0) {
        return NextResponse.json({
          success: false,
          error: `No servers found with tool: ${tool}`,
          serverId: '',
          tool,
          durationMs: Date.now() - startTime,
          fromCache: false,
        });
      }

      targetServer = candidates[0];
    }

    // Check trust
    if (targetServer.trustScore < 20) {
      return NextResponse.json({
        success: false,
        error: `Server trust score too low: ${targetServer.trustScore}`,
        serverId: targetServer.id,
        tool,
        durationMs: Date.now() - startTime,
        fromCache: false,
      });
    }

    // Make remote call
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${targetServer.endpoint}/tools/${tool}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
          'X-Federation-Network': 'opensvm-mcp-mainnet',
          'X-Federation-Caller': 'opensvm',
        },
        body: JSON.stringify(params),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Remote call failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      const durationMs = Date.now() - startTime;

      // Cache result
      const cacheKey = `${targetServer.id}:${tool}:${JSON.stringify(params)}`;
      resultCache.set(cacheKey, { result, timestamp: Date.now() });

      // Update server last seen
      targetServer.lastSeenAt = Date.now();

      return NextResponse.json({
        success: true,
        result,
        serverId: targetServer.id,
        serverName: targetServer.name,
        tool,
        durationMs,
        fromCache: false,
      });
    } catch (fetchError) {
      const durationMs = Date.now() - startTime;

      return NextResponse.json({
        success: false,
        error: fetchError instanceof Error ? fetchError.message : 'Remote call failed',
        serverId: targetServer.id,
        serverName: targetServer.name,
        tool,
        durationMs,
        fromCache: false,
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
