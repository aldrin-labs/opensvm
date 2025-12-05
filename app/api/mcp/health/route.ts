/**
 * MCP Health Check Endpoint
 *
 * Returns health status for all MCP servers.
 * Usage: GET https://osvm.ai/api/mcp/health
 *
 * Query parameters:
 * - server: 'opensvm' | 'dflow' | 'gateway' | 'all' (default: 'all')
 */

import { NextRequest, NextResponse } from 'next/server';

type HealthStatus = 'healthy' | 'degraded' | 'offline' | 'unknown';

interface ServerHealth {
  name: string;
  displayName: string;
  status: HealthStatus;
  latency?: number;
  tools: number;
  endpoint: string;
  checkedAt: string;
}

interface HealthResponse {
  status: HealthStatus;
  servers: ServerHealth[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    offline: number;
  };
  checkedAt: string;
}

const SERVERS = {
  opensvm: {
    displayName: 'OpenSVM MCP',
    endpoint: 'https://osvm.ai/api/status',
    tools: 34,
  },
  dflow: {
    displayName: 'DFlow MCP',
    endpoint: 'https://prediction-markets-api.dflow.net/api/v1/events?limit=1',
    tools: 23,
  },
  gateway: {
    displayName: 'MCP Gateway',
    endpoint: 'https://osvm.ai/api/status',
    tools: 62,
  },
};

async function checkServer(name: string): Promise<ServerHealth> {
  const server = SERVERS[name as keyof typeof SERVERS];
  if (!server) {
    return {
      name,
      displayName: name,
      status: 'unknown',
      tools: 0,
      endpoint: '',
      checkedAt: new Date().toISOString(),
    };
  }

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(server.endpoint, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });

    clearTimeout(timeoutId);
    const latency = Date.now() - start;

    const status: HealthStatus = response.ok
      ? (latency < 1000 ? 'healthy' : 'degraded')
      : 'degraded';

    return {
      name,
      displayName: server.displayName,
      status,
      latency,
      tools: server.tools,
      endpoint: server.endpoint,
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return {
      name,
      displayName: server.displayName,
      status: 'offline',
      tools: server.tools,
      endpoint: server.endpoint,
      checkedAt: new Date().toISOString(),
    };
  }
}

function getOverallStatus(servers: ServerHealth[]): HealthStatus {
  const statuses = servers.map(s => s.status);
  if (statuses.every(s => s === 'healthy')) return 'healthy';
  if (statuses.some(s => s === 'offline')) return 'degraded';
  if (statuses.some(s => s === 'degraded')) return 'degraded';
  return 'unknown';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const serverParam = searchParams.get('server') || 'all';

  try {
    let servers: ServerHealth[];

    if (serverParam === 'all') {
      servers = await Promise.all([
        checkServer('opensvm'),
        checkServer('dflow'),
        checkServer('gateway'),
      ]);
    } else {
      servers = [await checkServer(serverParam)];
    }

    const summary = {
      total: servers.length,
      healthy: servers.filter(s => s.status === 'healthy').length,
      degraded: servers.filter(s => s.status === 'degraded').length,
      offline: servers.filter(s => s.status === 'offline').length,
    };

    const response: HealthResponse = {
      status: getOverallStatus(servers),
      servers,
      summary,
      checkedAt: new Date().toISOString(),
    };

    const httpStatus = response.status === 'healthy' ? 200 :
                       response.status === 'degraded' ? 200 : 503;

    return NextResponse.json(response, {
      status: httpStatus,
      headers: {
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    return NextResponse.json({
      status: 'offline',
      servers: [],
      summary: { total: 0, healthy: 0, degraded: 0, offline: 0 },
      error: error instanceof Error ? error.message : 'Unknown error',
      checkedAt: new Date().toISOString(),
    }, { status: 503 });
  }
}

export const runtime = 'edge';
