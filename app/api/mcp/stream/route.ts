/**
 * MCP Streaming Tool Endpoint
 *
 * Executes streaming tools and returns Server-Sent Events (SSE).
 *
 * Usage:
 *   POST /api/mcp/stream
 *   Body: { "tool": "streaming:scan_transactions", "args": { "address": "...", "limit": 100 } }
 *
 * Response: text/event-stream with events:
 *   - start: Tool execution started
 *   - progress: Progress update (percent, message)
 *   - chunk: Data chunk
 *   - partial: Partial result
 *   - complete: Execution complete
 *   - error: Error occurred
 */

import { NextRequest } from 'next/server';
import {
  STREAMING_EXECUTORS,
  getStreamingExecutor,
  executeStreamingTool,
  createSSEHeaders,
} from '@/api/src/mcp-streaming';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/mcp/stream - List available streaming tools
 */
export async function GET() {
  return Response.json({
    name: 'MCP Streaming Tools',
    version: '1.0.0',
    description: 'Server-Sent Events for long-running MCP tool operations',
    tools: STREAMING_EXECUTORS.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
    usage: {
      method: 'POST',
      endpoint: '/api/mcp/stream',
      body: {
        tool: 'streaming:scan_transactions',
        args: { address: 'wallet_address', limit: 100 },
      },
      response: 'text/event-stream',
    },
    eventTypes: {
      start: 'Tool execution started',
      progress: 'Progress update with percent and message',
      chunk: 'Data chunk with index and metadata',
      partial: 'Partial result during execution',
      complete: 'Execution complete with final result',
      error: 'Error occurred during execution',
      heartbeat: 'Keep-alive ping',
    },
  });
}

/**
 * POST /api/mcp/stream - Execute a streaming tool
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tool, args = {} } = body as { tool?: string; args?: Record<string, unknown> };

    if (!tool) {
      return Response.json(
        { error: 'Missing required field: tool' },
        { status: 400 }
      );
    }

    const executor = getStreamingExecutor(tool);
    if (!executor) {
      return Response.json(
        {
          error: `Unknown streaming tool: ${tool}`,
          availableTools: STREAMING_EXECUTORS.map(t => t.name),
        },
        { status: 404 }
      );
    }

    // Validate required args
    const required = executor.inputSchema.required || [];
    const missing = required.filter(key => !(key in args));
    if (missing.length > 0) {
      return Response.json(
        {
          error: `Missing required arguments: ${missing.join(', ')}`,
          inputSchema: executor.inputSchema,
        },
        { status: 400 }
      );
    }

    // Execute and return SSE stream
    return executeStreamingTool(tool, args);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS - CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
