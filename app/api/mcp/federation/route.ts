/**
 * MCP Federation API - Main Endpoint
 *
 * GET /api/mcp/federation - Get this server's info and network stats
 * POST /api/mcp/federation - Receive discovery messages
 *
 * @module app/api/mcp/federation
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Federation network info (would be configured from environment in production)
const THIS_SERVER = {
  id: `opensvm_mcp_${process.env.VERCEL_URL || 'localhost'}`,
  name: 'OpenSVM MCP Server',
  description: 'AI-powered Solana blockchain explorer with investigation tools',
  endpoint: process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}/api/mcp`
    : 'http://localhost:3000/api/mcp',
  mcpVersion: '1.0.0',
  owner: process.env.SERVER_OWNER_WALLET || 'not_configured',
  capabilities: {
    streaming: true,
    batching: true,
    webhooks: true,
    customAuth: true,
    maxConcurrentRequests: 100,
    supportedAuthMethods: ['bearer', 'api_key'],
  },
  metadata: {
    version: '1.0.0',
    region: process.env.VERCEL_REGION || 'unknown',
    tags: ['solana', 'blockchain', 'analytics', 'investigation', 'ai'],
    website: 'https://opensvm.com',
    documentation: 'https://opensvm.com/docs/mcp',
    revenueSharePercent: 70,
    minTrustRequired: 0,
  },
};

// In-memory server registry (use Qdrant in production)
const servers = new Map<string, any>();
const trustMetrics = new Map<string, any>();

/**
 * GET /api/mcp/federation
 *
 * Returns this server's info and network statistics
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');

  try {
    switch (action) {
      case 'stats':
        return NextResponse.json({
          networkId: 'opensvm-mcp-mainnet',
          totalServers: servers.size + 1, // Include self
          totalTools: 48, // OpenSVM MCP tools
          totalPeers: servers.size,
          averageTrust: calculateAverageTrust(),
          thisServer: {
            id: THIS_SERVER.id,
            name: THIS_SERVER.name,
            uptime: process.uptime(),
          },
        });

      case 'health':
        return NextResponse.json({
          status: 'healthy',
          timestamp: Date.now(),
          serverId: THIS_SERVER.id,
        });

      default:
        // Return full server info
        return NextResponse.json({
          ...THIS_SERVER,
          trustScore: 100, // Self-trust
          registeredAt: Date.now() - 86400000, // 1 day ago for demo
          lastSeenAt: Date.now(),
          tools: await getToolList(),
        });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/mcp/federation
 *
 * Handle federation messages (announce, ping, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, senderId, timestamp, payload } = body;

    switch (type) {
      case 'announce':
        // Register announced server
        if (payload && payload.id && payload.endpoint) {
          servers.set(payload.id, {
            ...payload,
            lastSeenAt: Date.now(),
            trustScore: 30, // Starting trust
          });
          trustMetrics.set(payload.id, {
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
            received: true,
            registered: true,
            serverId: payload.id,
          });
        }
        break;

      case 'ping':
        return NextResponse.json({
          type: 'pong',
          senderId: THIS_SERVER.id,
          timestamp: Date.now(),
          payload: { status: 'alive' },
        });

      case 'query':
        // Return list of known servers
        const knownServers = Array.from(servers.values()).map(s => ({
          id: s.id,
          name: s.name,
          endpoint: s.endpoint,
          trustScore: s.trustScore,
        }));
        return NextResponse.json({
          type: 'response',
          senderId: THIS_SERVER.id,
          timestamp: Date.now(),
          payload: { servers: knownServers },
        });

      default:
        return NextResponse.json({ received: true, type });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Helper functions

function calculateAverageTrust(): number {
  if (servers.size === 0) return 100;
  const total = Array.from(servers.values()).reduce((sum, s) => sum + (s.trustScore || 0), 0);
  return Math.round(total / servers.size);
}

async function getToolList() {
  // Return summary of available tools
  return [
    { name: 'get_account_info', category: 'account', description: 'Get Solana account information' },
    { name: 'get_transaction', category: 'transaction', description: 'Get transaction details' },
    { name: 'get_balance', category: 'account', description: 'Get SOL balance' },
    { name: 'get_token_accounts', category: 'token', description: 'Get token holdings' },
    { name: 'investigate', category: 'ai', description: 'AI-powered wallet investigation' },
    { name: 'ask_ai', category: 'ai', description: 'Ask AI about blockchain data' },
    { name: 'search_transactions', category: 'search', description: 'Search transaction history' },
    { name: 'get_network_status', category: 'network', description: 'Get Solana network status' },
    // ... abbreviated for display
    { name: '...and 40 more tools', category: 'various', description: 'See full documentation' },
  ];
}
