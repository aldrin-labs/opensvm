/**
 * MCP Tool Analytics API
 *
 * GET /api/mcp/analytics - Get analytics dashboard
 * GET /api/mcp/analytics?server=opensvm - Get server-specific analytics
 * POST /api/mcp/analytics - Record a tool call
 */

import { NextRequest, NextResponse } from 'next/server';

// In-memory analytics store (in production, use Redis or a database)
interface ToolCall {
  id: string;
  serverId: string;
  toolName: string;
  timestamp: number;
  duration: number;
  success: boolean;
  errorType?: string;
}

interface ToolMetrics {
  toolName: string;
  serverId: string;
  totalCalls: number;
  successRate: number;
  avgDuration: number;
  lastUsed: number;
}

// Simulated analytics data
const MOCK_ANALYTICS = {
  overview: {
    totalCalls: 15847,
    totalServers: 3,
    totalTools: 62,
    avgSuccessRate: 0.973,
    avgLatency: 234,
    uniqueUsers: 423,
    uniqueSessions: 1892,
  },
  servers: [
    {
      serverId: 'opensvm-mcp',
      serverName: 'OpenSVM MCP',
      totalTools: 34,
      totalCalls: 8923,
      successRate: 0.982,
      avgLatency: 187,
      activeTools: 28,
      topTools: [
        { name: 'get_transaction', calls: 2341 },
        { name: 'get_account', calls: 1876 },
        { name: 'get_token_info', calls: 1234 },
        { name: 'analyze_wallet', calls: 987 },
        { name: 'search_transactions', calls: 876 },
      ],
    },
    {
      serverId: 'dflow-mcp',
      serverName: 'DFlow MCP',
      totalTools: 23,
      totalCalls: 4521,
      successRate: 0.965,
      avgLatency: 256,
      activeTools: 18,
      topTools: [
        { name: 'get_events', calls: 1234 },
        { name: 'get_markets', calls: 987 },
        { name: 'get_trades', calls: 654 },
        { name: 'get_forecasts', calls: 543 },
        { name: 'get_candles', calls: 432 },
      ],
    },
    {
      serverId: 'mcp-gateway',
      serverName: 'MCP Gateway',
      totalTools: 5,
      totalCalls: 2403,
      successRate: 0.991,
      avgLatency: 312,
      activeTools: 5,
      topTools: [
        { name: 'list_servers', calls: 876 },
        { name: 'route_call', calls: 654 },
        { name: 'health_check', calls: 543 },
        { name: 'discover', calls: 210 },
        { name: 'batch_execute', calls: 120 },
      ],
    },
  ],
  topTools: [
    { toolName: 'get_transaction', serverId: 'opensvm-mcp', totalCalls: 2341, successRate: 0.99, avgDuration: 145, lastUsed: Date.now() - 1000 },
    { toolName: 'get_account', serverId: 'opensvm-mcp', totalCalls: 1876, successRate: 0.98, avgDuration: 167, lastUsed: Date.now() - 2000 },
    { toolName: 'get_events', serverId: 'dflow-mcp', totalCalls: 1234, successRate: 0.97, avgDuration: 234, lastUsed: Date.now() - 3000 },
    { toolName: 'get_token_info', serverId: 'opensvm-mcp', totalCalls: 1234, successRate: 0.99, avgDuration: 123, lastUsed: Date.now() - 5000 },
    { toolName: 'analyze_wallet', serverId: 'opensvm-mcp', totalCalls: 987, successRate: 0.95, avgDuration: 456, lastUsed: Date.now() - 10000 },
  ],
  trends: [
    { period: '2024-12-01', calls: 2134, successRate: 0.97, avgLatency: 245 },
    { period: '2024-12-02', calls: 2456, successRate: 0.98, avgLatency: 223 },
    { period: '2024-12-03', calls: 2789, successRate: 0.97, avgLatency: 234 },
    { period: '2024-12-04', calls: 2123, successRate: 0.98, avgLatency: 212 },
  ],
  recentErrors: [
    { toolName: 'get_transaction', errorType: 'TimeoutError', timestamp: Date.now() - 60000, count: 3 },
    { toolName: 'analyze_wallet', errorType: 'RateLimitError', timestamp: Date.now() - 120000, count: 5 },
    { toolName: 'get_events', errorType: 'NetworkError', timestamp: Date.now() - 180000, count: 2 },
  ],
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const server = searchParams.get('server');
  const tool = searchParams.get('tool');
  const startTime = searchParams.get('start');
  const endTime = searchParams.get('end');

  try {
    // Filter by server if specified
    if (server && tool) {
      const toolMetrics = MOCK_ANALYTICS.topTools.find(
        t => t.serverId === server && t.toolName === tool
      );
      if (!toolMetrics) {
        return NextResponse.json({ error: 'Tool not found' }, { status: 404 });
      }
      return NextResponse.json(toolMetrics);
    }

    if (server) {
      const serverMetrics = MOCK_ANALYTICS.servers.find(s => s.serverId === server);
      if (!serverMetrics) {
        return NextResponse.json({ error: 'Server not found' }, { status: 404 });
      }
      return NextResponse.json(serverMetrics);
    }

    // Return full dashboard
    return NextResponse.json({
      ...MOCK_ANALYTICS,
      generatedAt: new Date().toISOString(),
      timeRange: {
        start: startTime || new Date(Date.now() - 7 * 86400000).toISOString(),
        end: endTime || new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate required fields
    const { serverId, toolName, duration, success } = body;
    if (!serverId || !toolName || duration === undefined || success === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: serverId, toolName, duration, success' },
        { status: 400 }
      );
    }

    // In production, store this in a database
    const call: ToolCall = {
      id: crypto.randomUUID(),
      serverId,
      toolName,
      timestamp: Date.now(),
      duration,
      success,
      errorType: body.errorType,
    };

    // Return success
    return NextResponse.json({
      success: true,
      id: call.id,
      recorded: call.timestamp,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export const runtime = 'edge';
