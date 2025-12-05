/**
 * MCP Federation API - Gossip Protocol Endpoint
 *
 * POST /api/mcp/federation/gossip - Exchange server lists with peers
 *
 * The gossip protocol allows federated servers to discover each other
 * by periodically exchanging lists of known servers.
 *
 * @module app/api/mcp/federation/gossip
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// In-memory server registry
const servers = new Map<string, any>();
const peers = new Map<string, { endpoint: string; lastContact: number; trustScore: number }>();

// This server's info
const THIS_SERVER_ID = `opensvm_mcp_${process.env.VERCEL_URL || 'localhost'}`;
const THIS_SERVER_ENDPOINT = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}/api/mcp`
  : 'http://localhost:3000/api/mcp';

/**
 * POST /api/mcp/federation/gossip
 *
 * Exchange server information with a peer
 *
 * Body:
 * - type: 'exchange' | 'query' | 'announce'
 * - senderId: ID of the sending server
 * - senderEndpoint: Endpoint of the sending server
 * - servers: Array of server info (for exchange)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, senderId, senderEndpoint, servers: receivedServers } = body;

    if (!senderId) {
      return NextResponse.json(
        { error: 'Missing senderId' },
        { status: 400 }
      );
    }

    // Track the peer
    if (senderEndpoint) {
      peers.set(senderId, {
        endpoint: senderEndpoint,
        lastContact: Date.now(),
        trustScore: 50, // Default peer trust
      });
    }

    switch (type) {
      case 'exchange':
        return handleExchange(senderId, receivedServers || []);

      case 'query':
        return handleQuery();

      case 'announce':
        return handleAnnounce(body.server);

      default:
        return NextResponse.json({
          received: true,
          type,
          timestamp: Date.now(),
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
 * Handle server list exchange
 */
function handleExchange(senderId: string, receivedServers: any[]): NextResponse {
  const now = Date.now();
  let newServers = 0;
  let updatedServers = 0;

  // Process received servers
  for (const server of receivedServers) {
    if (!server.id || !server.endpoint) continue;

    // Don't add ourselves
    if (server.id === THIS_SERVER_ID) continue;

    const existing = servers.get(server.id);
    if (existing) {
      // Update if newer info
      if (server.lastSeenAt > existing.lastSeenAt) {
        existing.lastSeenAt = server.lastSeenAt;
        existing.trustScore = server.trustScore;
        updatedServers++;
      }
    } else {
      // Add new server
      servers.set(server.id, {
        id: server.id,
        name: server.name || 'Unknown',
        endpoint: server.endpoint,
        trustScore: server.trustScore || 30,
        lastSeenAt: server.lastSeenAt || now,
        discoveredVia: senderId,
        discoveredAt: now,
      });
      newServers++;
    }
  }

  // Return our server list
  const myServers = Array.from(servers.values())
    .filter(s => s.trustScore >= 20) // Only share trusted servers
    .map(s => ({
      id: s.id,
      name: s.name,
      endpoint: s.endpoint,
      trustScore: s.trustScore,
      lastSeenAt: s.lastSeenAt,
    }));

  return NextResponse.json({
    success: true,
    senderId: THIS_SERVER_ID,
    senderEndpoint: THIS_SERVER_ENDPOINT,
    servers: myServers,
    stats: {
      receivedCount: receivedServers.length,
      newServers,
      updatedServers,
      myServerCount: myServers.length,
    },
    timestamp: now,
  });
}

/**
 * Handle query for known servers
 */
function handleQuery(): NextResponse {
  const myServers = Array.from(servers.values())
    .filter(s => s.trustScore >= 20)
    .map(s => ({
      id: s.id,
      name: s.name,
      endpoint: s.endpoint,
      trustScore: s.trustScore,
      lastSeenAt: s.lastSeenAt,
    }));

  return NextResponse.json({
    success: true,
    senderId: THIS_SERVER_ID,
    senderEndpoint: THIS_SERVER_ENDPOINT,
    servers: myServers,
    peerCount: peers.size,
    timestamp: Date.now(),
  });
}

/**
 * Handle server announcement
 */
function handleAnnounce(server: any): NextResponse {
  if (!server || !server.id || !server.endpoint) {
    return NextResponse.json(
      { error: 'Invalid server announcement' },
      { status: 400 }
    );
  }

  const now = Date.now();
  const existing = servers.get(server.id);

  if (existing) {
    // Update existing
    existing.lastSeenAt = now;
    existing.trustScore = server.trustScore || existing.trustScore;

    return NextResponse.json({
      success: true,
      action: 'updated',
      serverId: server.id,
      timestamp: now,
    });
  }

  // Add new server
  servers.set(server.id, {
    id: server.id,
    name: server.name || 'Unknown',
    description: server.description || '',
    endpoint: server.endpoint,
    mcpVersion: server.mcpVersion || '1.0.0',
    owner: server.owner || 'unknown',
    tools: server.tools || [],
    capabilities: server.capabilities || {},
    trustScore: 30, // Starting trust
    registeredAt: now,
    lastSeenAt: now,
    metadata: server.metadata || {},
    announcedDirectly: true,
  });

  return NextResponse.json({
    success: true,
    action: 'registered',
    serverId: server.id,
    trustScore: 30,
    timestamp: now,
  });
}

/**
 * GET /api/mcp/federation/gossip
 *
 * Get gossip protocol status
 */
export async function GET() {
  const peerList = Array.from(peers.entries()).map(([id, info]) => ({
    id,
    endpoint: info.endpoint,
    lastContact: info.lastContact,
    trustScore: info.trustScore,
    ageMs: Date.now() - info.lastContact,
  }));

  const serverList = Array.from(servers.values()).map(s => ({
    id: s.id,
    name: s.name,
    endpoint: s.endpoint,
    trustScore: s.trustScore,
    lastSeenAt: s.lastSeenAt,
    discoveredVia: s.discoveredVia,
  }));

  return NextResponse.json({
    thisServer: {
      id: THIS_SERVER_ID,
      endpoint: THIS_SERVER_ENDPOINT,
    },
    peers: peerList,
    servers: serverList,
    stats: {
      peerCount: peers.size,
      serverCount: servers.size,
      activePeers: peerList.filter(p => p.ageMs < 300000).length, // Active in last 5 min
    },
    timestamp: Date.now(),
  });
}
