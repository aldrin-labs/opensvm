/**
 * MCP Server Health Badge SVG Generator
 *
 * Returns a dynamic SVG badge showing server health status.
 * Usage: <img src="https://osvm.ai/api/mcp/badge.svg" alt="MCP Status" />
 *
 * Query parameters:
 * - server: 'opensvm' | 'dflow' | 'gateway' | 'all' (default: 'all')
 * - style: 'flat' | 'flat-square' | 'plastic' (default: 'flat')
 * - label: custom label text (default: 'MCP')
 */

import { NextRequest, NextResponse } from 'next/server';

type ServerName = 'opensvm' | 'dflow' | 'gateway' | 'all';
type BadgeStyle = 'flat' | 'flat-square' | 'plastic';
type HealthStatus = 'healthy' | 'degraded' | 'offline' | 'unknown';

interface ServerHealth {
  name: string;
  status: HealthStatus;
  latency?: number;
  tools?: number;
}

// Health check endpoints
const HEALTH_ENDPOINTS: Record<string, string> = {
  opensvm: 'https://osvm.ai/api/status',
  dflow: 'https://prediction-markets-api.dflow.net/api/v1/events?limit=1',
  gateway: 'https://osvm.ai/api/status',
};

// Tool counts for each server
const TOOL_COUNTS: Record<string, number> = {
  opensvm: 34,
  dflow: 23,
  gateway: 62,
};

async function checkServerHealth(server: string): Promise<ServerHealth> {
  const endpoint = HEALTH_ENDPOINTS[server];
  if (!endpoint) {
    return { name: server, status: 'unknown' };
  }

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(endpoint, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });

    clearTimeout(timeoutId);
    const latency = Date.now() - start;

    if (response.ok) {
      return {
        name: server,
        status: latency < 1000 ? 'healthy' : 'degraded',
        latency,
        tools: TOOL_COUNTS[server],
      };
    }
    return { name: server, status: 'degraded', latency };
  } catch {
    return { name: server, status: 'offline' };
  }
}

function getStatusColor(status: HealthStatus): string {
  switch (status) {
    case 'healthy': return '#4cc71e';
    case 'degraded': return '#dfb317';
    case 'offline': return '#e05d44';
    default: return '#9f9f9f';
  }
}

function getStatusText(status: HealthStatus, latency?: number): string {
  switch (status) {
    case 'healthy': return latency ? `healthy (${latency}ms)` : 'healthy';
    case 'degraded': return latency ? `degraded (${latency}ms)` : 'degraded';
    case 'offline': return 'offline';
    default: return 'unknown';
  }
}

function generateBadgeSVG(
  label: string,
  value: string,
  color: string,
  style: BadgeStyle
): string {
  const labelWidth = label.length * 6.5 + 10;
  const valueWidth = value.length * 6.5 + 10;
  const totalWidth = labelWidth + valueWidth;

  const borderRadius = style === 'flat-square' ? '0' : '3';
  const gradient = style === 'plastic' ? `
    <linearGradient id="smooth" x2="0" y2="100%">
      <stop offset="0" stop-color="#fff" stop-opacity=".7"/>
      <stop offset=".1" stop-color="#aaa" stop-opacity=".1"/>
      <stop offset=".9" stop-color="#000" stop-opacity=".3"/>
      <stop offset="1" stop-color="#000" stop-opacity=".5"/>
    </linearGradient>
  ` : '';

  const fill = style === 'plastic' ? 'url(#smooth)' : 'none';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${value}">
  <title>${label}: ${value}</title>
  ${gradient}
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="${borderRadius}" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="${fill}"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text aria-hidden="true" x="${labelWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${labelWidth / 2}" y="14">${label}</text>
    <text aria-hidden="true" x="${labelWidth + valueWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${value}</text>
    <text x="${labelWidth + valueWidth / 2}" y="14">${value}</text>
  </g>
</svg>`;
}

function generateMultiBadgeSVG(
  servers: ServerHealth[],
  style: BadgeStyle
): string {
  const segments: { label: string; color: string; width: number }[] = [];

  // MCP label
  const labelText = 'MCP';
  const labelWidth = labelText.length * 7 + 12;
  segments.push({ label: labelText, color: '#555', width: labelWidth });

  // Server statuses
  for (const server of servers) {
    const text = `${server.name}:${server.status === 'healthy' ? 'ok' : server.status[0]}`;
    const width = text.length * 6.5 + 10;
    segments.push({ label: text, color: getStatusColor(server.status), width });
  }

  const totalWidth = segments.reduce((sum, s) => sum + s.width, 0);
  const borderRadius = style === 'flat-square' ? '0' : '3';

  let xOffset = 0;
  const rects = segments.map(s => {
    const rect = `<rect x="${xOffset}" width="${s.width}" height="20" fill="${s.color}"/>`;
    xOffset += s.width;
    return rect;
  }).join('\n    ');

  xOffset = 0;
  const texts = segments.map(s => {
    const centerX = xOffset + s.width / 2;
    const text = `
    <text aria-hidden="true" x="${centerX}" y="15" fill="#010101" fill-opacity=".3">${s.label}</text>
    <text x="${centerX}" y="14">${s.label}</text>`;
    xOffset += s.width;
    return text;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="MCP Server Status">
  <title>MCP Server Status</title>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="${borderRadius}" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    ${rects}
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    ${texts}
  </g>
</svg>`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const server = (searchParams.get('server') || 'all') as ServerName;
  const style = (searchParams.get('style') || 'flat') as BadgeStyle;
  const customLabel = searchParams.get('label');

  try {
    let svg: string;

    if (server === 'all') {
      // Check all servers in parallel
      const [opensvm, dflow, gateway] = await Promise.all([
        checkServerHealth('opensvm'),
        checkServerHealth('dflow'),
        checkServerHealth('gateway'),
      ]);

      svg = generateMultiBadgeSVG([opensvm, dflow, gateway], style);
    } else {
      // Check single server
      const health = await checkServerHealth(server);
      const label = customLabel || `MCP ${server}`;
      const value = getStatusText(health.status, health.latency);
      const color = getStatusColor(health.status);

      svg = generateBadgeSVG(label, value, color, style);
    }

    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    // Return error badge
    const svg = generateBadgeSVG(
      customLabel || 'MCP',
      'error',
      '#e05d44',
      style
    );

    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-cache',
      },
    });
  }
}

export const runtime = 'edge';
