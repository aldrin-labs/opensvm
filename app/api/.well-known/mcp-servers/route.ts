/**
 * .well-known/mcp-servers.json endpoint
 *
 * Standard discovery endpoint for MCP servers.
 * Clients can fetch https://osvm.ai/.well-known/mcp-servers.json
 * to discover all available MCP servers.
 *
 * Spec: https://github.com/modelcontextprotocol/registry
 */

import { NextRequest, NextResponse } from 'next/server';

const MCP_SCHEMA_VERSION = 'https://modelcontextprotocol.io/schemas/server-v1.2025-10-17.json';

// OpenSVM MCP Server definition
const OPENSVM_SERVER = {
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
    { src: 'https://osvm.ai/icon.svg', mimeType: 'image/svg+xml' },
    { src: 'https://osvm.ai/icon.png', mimeType: 'image/png', sizes: ['192x192'] },
  ],
  packages: [
    {
      registryType: 'npm',
      identifier: '@opensvm/mcp-server',
      version: '2.0.0',
      runtimeHint: 'bun',
      transport: { type: 'stdio' },
    },
  ],
  remotes: [
    { type: 'http', url: 'https://osvm.ai/api/mcp' },
    { type: 'sse', url: 'https://osvm.ai/api/mcp/stream' },
  ],
  _meta: {
    category: 'blockchain',
    tags: ['solana', 'blockchain', 'explorer', 'ai', 'forensics', 'defi', 'nft'],
    capabilities: { tools: 34, prompts: 4, resources: 3 },
  },
};

// DFlow Prediction Markets MCP Server definition
const DFLOW_SERVER = {
  $schema: MCP_SCHEMA_VERSION,
  name: 'ai.osvm/dflow-mcp',
  title: 'DFlow Prediction Markets MCP',
  description: 'Prediction market metadata and live data API. Provides 23 tools for accessing events, markets, trades, forecasts, and candlestick data.',
  version: '1.0.0',
  websiteUrl: 'https://dflow.opensvm.com',
  repository: {
    url: 'https://github.com/aldrin-labs/opensvm',
    source: 'github',
    subfolder: 'api',
  },
  icons: [
    { src: 'https://dflow.opensvm.com/icon.svg', mimeType: 'image/svg+xml' },
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
    { type: 'http', url: 'https://prediction-markets-api.dflow.net' },
  ],
  _meta: {
    category: 'markets',
    tags: ['prediction-markets', 'trading', 'forecasts', 'kalshi', 'solana'],
    capabilities: { tools: 23, prompts: 2, resources: 3 },
  },
};

// MCP Gateway Server definition
const GATEWAY_SERVER = {
  $schema: MCP_SCHEMA_VERSION,
  name: 'ai.osvm/mcp-gateway',
  title: 'OpenSVM MCP Gateway',
  description: 'Unified MCP gateway aggregating tools from multiple servers. Provides 62+ tools with automatic discovery, health checking, and intelligent routing.',
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
    { type: 'http', url: 'https://osvm.ai/api/gateway' },
  ],
  _meta: {
    category: 'infrastructure',
    tags: ['gateway', 'registry', 'aggregator', 'discovery'],
    capabilities: { tools: 62, prompts: 6, resources: 6 },
    aggregatedServers: ['ai.osvm/opensvm-mcp', 'ai.osvm/dflow-mcp'],
  },
};

export async function GET(req: NextRequest) {
  const wellKnownResponse = {
    servers: [OPENSVM_SERVER, DFLOW_SERVER, GATEWAY_SERVER],
    updated: new Date().toISOString(),
    registry: 'https://registry.modelcontextprotocol.io',
    discovery: {
      endpoint: 'https://osvm.ai/.well-known/mcp-servers.json',
      badge: 'https://osvm.ai/api/mcp/badge.svg',
      health: 'https://osvm.ai/api/mcp/health',
    },
  };

  return NextResponse.json(wellKnownResponse, {
    headers: {
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'Content-Type': 'application/json',
    },
  });
}

export const runtime = 'edge';
