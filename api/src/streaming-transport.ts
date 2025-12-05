#!/usr/bin/env bun
/**
 * OpenSVM MCP Streaming Transport
 *
 * Provides WebSocket and SSE transports for real-time MCP communication.
 * Supports:
 * - WebSocket: Bidirectional MCP messages for interactive sessions
 * - SSE: Server-Sent Events for streaming long-running operations (investigations)
 */

import { serve, ServerWebSocket } from 'bun';

// ============================================================================
// Rate Limiting
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  maxRequests: number;       // Max requests per window
  windowMs: number;          // Window size in milliseconds
  maxConnections: number;    // Max WebSocket connections per client
  maxInvestigations: number; // Max concurrent investigations per client
}

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 100,          // 100 requests
  windowMs: 60000,           // per minute
  maxConnections: 5,         // 5 concurrent WebSocket connections
  maxInvestigations: 3,      // 3 concurrent investigations
};

// Premium rate limits for authenticated users
const PREMIUM_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 1000,         // 1000 requests
  windowMs: 60000,           // per minute
  maxConnections: 20,        // 20 concurrent WebSocket connections
  maxInvestigations: 10,     // 10 concurrent investigations
};

// API key validation cache (stores validated keys with expiry)
interface APIKeyCache {
  valid: boolean;
  tier: 'free' | 'premium' | 'enterprise';
  walletAddress?: string;
  cachedAt: number;
}

const apiKeyCache = new Map<string, APIKeyCache>();
const API_KEY_CACHE_TTL = 300000; // 5 minutes

/**
 * Validate API key and get tier
 */
async function validateAPIKey(apiKey: string, apiBaseUrl: string = 'https://osvm.ai'): Promise<APIKeyCache> {
  // Check cache first
  const cached = apiKeyCache.get(apiKey);
  if (cached && Date.now() - cached.cachedAt < API_KEY_CACHE_TTL) {
    return cached;
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/auth/api-keys/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({ key: apiKey }),
    });

    if (response.ok) {
      const data = await response.json();
      const result: APIKeyCache = {
        valid: data.valid === true,
        tier: data.tier || 'premium', // Default to premium if key is valid
        walletAddress: data.walletAddress,
        cachedAt: Date.now(),
      };
      apiKeyCache.set(apiKey, result);
      return result;
    }
  } catch (error) {
    console.error('[Rate Limit] API key validation error:', error);
  }

  // Invalid or error - cache negative result briefly
  const invalid: APIKeyCache = {
    valid: false,
    tier: 'free',
    cachedAt: Date.now(),
  };
  apiKeyCache.set(apiKey, invalid);
  return invalid;
}

/**
 * Get rate limit config based on authentication
 */
function getRateLimitConfig(apiKey?: string): RateLimitConfig {
  if (!apiKey) return DEFAULT_RATE_LIMIT;

  const cached = apiKeyCache.get(apiKey);
  if (cached?.valid) {
    switch (cached.tier) {
      case 'enterprise':
        // Enterprise: 5x premium limits
        return {
          maxRequests: 5000,
          windowMs: 60000,
          maxConnections: 100,
          maxInvestigations: 50,
        };
      case 'premium':
        return PREMIUM_RATE_LIMIT;
      default:
        return DEFAULT_RATE_LIMIT;
    }
  }

  return DEFAULT_RATE_LIMIT;
}

/**
 * Extract API key from request
 */
function getAPIKey(req: Request): string | undefined {
  // Check header first
  const headerKey = req.headers.get('x-api-key');
  if (headerKey) return headerKey;

  // Check Authorization header (Bearer token)
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7);
  }

  // Check query parameter as fallback
  const url = new URL(req.url);
  return url.searchParams.get('api_key') || undefined;
}

// Rate limit storage by client IP
const rateLimits = new Map<string, RateLimitEntry>();
const connectionCounts = new Map<string, number>();
const clientInvestigations = new Map<string, Set<string>>();

/**
 * Get client identifier from request
 */
function getClientId(req: Request): string {
  // Try to get real IP from headers (for proxied requests)
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  // Fallback to a hash of user-agent (not ideal but better than nothing)
  return req.headers.get('user-agent') || 'unknown';
}

/**
 * Check and update rate limit for a client
 */
function checkRateLimit(clientId: string, config: RateLimitConfig = DEFAULT_RATE_LIMIT): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  let entry = rateLimits.get(clientId);

  // Create new entry or reset if window expired
  if (!entry || now >= entry.resetAt) {
    entry = {
      count: 0,
      resetAt: now + config.windowMs,
    };
    rateLimits.set(clientId, entry);
  }

  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  // Increment count
  entry.count++;

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Check if client can open a new WebSocket connection
 */
function canOpenConnection(clientId: string, config: RateLimitConfig = DEFAULT_RATE_LIMIT): boolean {
  const count = connectionCounts.get(clientId) || 0;
  return count < config.maxConnections;
}

/**
 * Track WebSocket connection open
 */
function trackConnectionOpen(clientId: string): void {
  const count = connectionCounts.get(clientId) || 0;
  connectionCounts.set(clientId, count + 1);
}

/**
 * Track WebSocket connection close
 */
function trackConnectionClose(clientId: string): void {
  const count = connectionCounts.get(clientId) || 0;
  if (count > 0) {
    connectionCounts.set(clientId, count - 1);
  }
}

/**
 * Check if client can start a new investigation
 */
function canStartInvestigation(clientId: string, config: RateLimitConfig = DEFAULT_RATE_LIMIT): boolean {
  const investigations = clientInvestigations.get(clientId);
  if (!investigations) return true;
  return investigations.size < config.maxInvestigations;
}

/**
 * Track investigation start
 */
function trackInvestigationStart(clientId: string, investigationId: string): void {
  if (!clientInvestigations.has(clientId)) {
    clientInvestigations.set(clientId, new Set());
  }
  clientInvestigations.get(clientId)!.add(investigationId);
}

/**
 * Track investigation end
 */
function trackInvestigationEnd(clientId: string, investigationId: string): void {
  const investigations = clientInvestigations.get(clientId);
  if (investigations) {
    investigations.delete(investigationId);
  }
}

/**
 * Create rate limit response
 */
function rateLimitResponse(resetAt: number): Response {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  return new Response(JSON.stringify({
    error: 'Rate limit exceeded',
    retryAfter,
  }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfter),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
    },
  });
}

/**
 * Clean up expired rate limit entries (call periodically)
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [clientId, entry] of rateLimits) {
    if (now >= entry.resetAt) {
      rateLimits.delete(clientId);
    }
  }
}

// Clean up every minute
setInterval(cleanupRateLimits, 60000);

// ============================================================================
// Types for MCP protocol
// ============================================================================

// Types for MCP protocol
interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, any>;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface MCPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, any>;
}

// SSE Event types
interface SSEEvent {
  event: string;
  data: any;
  id?: string;
}

// Stream event types for investigation agent
type StreamEventType =
  | 'start'
  | 'progress'
  | 'tool_call'
  | 'tool_result'
  | 'anomaly'
  | 'finding'
  | 'report'
  | 'complete'
  | 'error';

interface StreamEvent {
  type: StreamEventType;
  timestamp: number;
  data: any;
}

// WebSocket client tracking
interface WSClient {
  ws: ServerWebSocket<{ id: string; clientIp: string }>;
  subscriptions: Set<string>;
  apiKey?: string;
  clientIp: string;
}

// Active investigation streams
interface InvestigationStream {
  id: string;
  target: string;
  type: string;
  startedAt: number;
  subscribers: Set<string>;
  events: StreamEvent[];
}

// Global state
const wsClients = new Map<string, WSClient>();
const sseClients = new Map<string, WritableStreamDefaultWriter<Uint8Array>>();
const activeInvestigations = new Map<string, InvestigationStream>();

// Event emitter for streaming
type EventCallback = (event: StreamEvent) => void;
const eventSubscribers = new Map<string, Set<EventCallback>>();

/**
 * Emit a stream event to all subscribers
 */
export function emitStreamEvent(investigationId: string, event: StreamEvent): void {
  const subscribers = eventSubscribers.get(investigationId);
  if (subscribers) {
    for (const callback of subscribers) {
      try {
        callback(event);
      } catch (error) {
        console.error('[ERROR] Error in event callback:', error);
      }
    }
  }

  // Store event for replay
  const investigation = activeInvestigations.get(investigationId);
  if (investigation) {
    investigation.events.push(event);
  }
}

/**
 * Subscribe to investigation events
 */
export function subscribeToInvestigation(
  investigationId: string,
  callback: EventCallback
): () => void {
  if (!eventSubscribers.has(investigationId)) {
    eventSubscribers.set(investigationId, new Set());
  }
  eventSubscribers.get(investigationId)!.add(callback);

  // Return unsubscribe function
  return () => {
    const subscribers = eventSubscribers.get(investigationId);
    if (subscribers) {
      subscribers.delete(callback);
      if (subscribers.size === 0) {
        eventSubscribers.delete(investigationId);
      }
    }
  };
}

/**
 * Create a new investigation stream
 */
export function createInvestigationStream(
  target: string,
  type: string
): InvestigationStream {
  const id = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const stream: InvestigationStream = {
    id,
    target,
    type,
    startedAt: Date.now(),
    subscribers: new Set(),
    events: [],
  };
  activeInvestigations.set(id, stream);

  // Emit start event
  emitStreamEvent(id, {
    type: 'start',
    timestamp: Date.now(),
    data: { id, target, type },
  });

  return stream;
}

/**
 * Format SSE event for sending
 */
function formatSSEEvent(event: SSEEvent): string {
  let message = '';
  if (event.id) {
    message += `id: ${event.id}\n`;
  }
  message += `event: ${event.event}\n`;
  message += `data: ${JSON.stringify(event.data)}\n\n`;
  return message;
}

/**
 * Create SSE response with proper headers
 */
function createSSEResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    },
  });
}

/**
 * Handle SSE connection for investigation streaming
 */
async function handleSSEConnection(
  req: Request,
  investigationId: string
): Promise<Response> {
  const investigation = activeInvestigations.get(investigationId);

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Send initial connection event
      controller.enqueue(encoder.encode(formatSSEEvent({
        event: 'connected',
        data: {
          investigationId,
          status: investigation ? 'active' : 'not_found',
          timestamp: Date.now(),
        },
      })));

      // If investigation exists, replay past events
      if (investigation) {
        for (const event of investigation.events) {
          controller.enqueue(encoder.encode(formatSSEEvent({
            event: event.type,
            data: event.data,
            id: `${event.timestamp}`,
          })));
        }
      }

      // Subscribe to new events
      unsubscribe = subscribeToInvestigation(investigationId, (event) => {
        try {
          controller.enqueue(encoder.encode(formatSSEEvent({
            event: event.type,
            data: event.data,
            id: `${event.timestamp}`,
          })));
        } catch (error) {
          // Stream closed
          if (unsubscribe) unsubscribe();
        }
      });

      // Send keepalive ping every 30 seconds
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch (error) {
          clearInterval(pingInterval);
          if (unsubscribe) unsubscribe();
        }
      }, 30000);
    },
    cancel() {
      if (unsubscribe) unsubscribe();
    },
  });

  return createSSEResponse(stream);
}

/**
 * Handle WebSocket message
 */
async function handleWebSocketMessage(
  ws: ServerWebSocket<{ id: string }>,
  message: string | Buffer,
  mcpHandler: (req: MCPRequest) => Promise<MCPResponse>
): Promise<void> {
  try {
    const data = typeof message === 'string' ? message : message.toString();
    const request: MCPRequest = JSON.parse(data);

    // Validate JSON-RPC format
    if (request.jsonrpc !== '2.0') {
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id: request.id || null,
        error: { code: -32600, message: 'Invalid JSON-RPC version' },
      }));
      return;
    }

    // Handle subscription requests for investigations
    if (request.method === 'subscribe' && request.params?.investigationId) {
      const client = wsClients.get(ws.data.id);
      if (client) {
        const invId = request.params.investigationId;
        client.subscriptions.add(invId);

        // Subscribe to events and forward to WebSocket
        subscribeToInvestigation(invId, (event) => {
          try {
            ws.send(JSON.stringify({
              jsonrpc: '2.0',
              method: 'investigation/event',
              params: { investigationId: invId, event },
            } as MCPNotification));
          } catch (error) {
            // WebSocket closed
          }
        });

        ws.send(JSON.stringify({
          jsonrpc: '2.0',
          id: request.id,
          result: { subscribed: true, investigationId: invId },
        }));
      }
      return;
    }

    // Handle unsubscribe
    if (request.method === 'unsubscribe' && request.params?.investigationId) {
      const client = wsClients.get(ws.data.id);
      if (client) {
        client.subscriptions.delete(request.params.investigationId);
        ws.send(JSON.stringify({
          jsonrpc: '2.0',
          id: request.id,
          result: { unsubscribed: true },
        }));
      }
      return;
    }

    // Forward to MCP handler
    const response = await mcpHandler(request);
    ws.send(JSON.stringify(response));

  } catch (error) {
    ws.send(JSON.stringify({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: error instanceof Error ? error.message : 'Parse error'
      },
    }));
  }
}

/**
 * Create the streaming server
 */
export function createStreamingServer(
  mcpHandler: (req: MCPRequest) => Promise<MCPResponse>,
  options: {
    port?: number;
    hostname?: string;
  } = {}
) {
  const port = options.port || 3001;
  const hostname = options.hostname || '0.0.0.0';

  const server = serve({
    port,
    hostname,

    async fetch(req, server) {
      const url = new URL(req.url);
      const path = url.pathname;
      const clientId = getClientId(req);
      const apiKey = getAPIKey(req);

      // Validate API key if provided (async, but cached)
      let rateLimitConfig = DEFAULT_RATE_LIMIT;
      let tier: 'free' | 'premium' | 'enterprise' = 'free';

      if (apiKey) {
        const keyInfo = await validateAPIKey(apiKey);
        if (keyInfo.valid) {
          rateLimitConfig = getRateLimitConfig(apiKey);
          tier = keyInfo.tier;
        }
      }

      // CORS preflight (exempt from rate limiting)
      if (req.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
            'Access-Control-Max-Age': '86400',
          },
        });
      }

      // Health check (exempt from rate limiting)
      if (path === '/health') {
        return new Response(JSON.stringify({
          status: 'ok',
          service: 'opensvm-mcp-streaming',
          connections: {
            websocket: wsClients.size,
            activeInvestigations: activeInvestigations.size,
          },
          rateLimits: {
            trackedClients: rateLimits.size,
            trackedConnections: connectionCounts.size,
            tiers: {
              free: { requests: 100, connections: 5, investigations: 3 },
              premium: { requests: 1000, connections: 20, investigations: 10 },
              enterprise: { requests: 5000, connections: 100, investigations: 50 },
            },
          },
          timestamp: Date.now(),
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Check rate limit for all other requests (using tier-specific config)
      const rateCheck = checkRateLimit(clientId, rateLimitConfig);
      if (!rateCheck.allowed) {
        return rateLimitResponse(rateCheck.resetAt);
      }

      // WebSocket upgrade for /ws
      if (path === '/ws') {
        // Check connection limit (tier-specific)
        if (!canOpenConnection(clientId, rateLimitConfig)) {
          return new Response(JSON.stringify({
            error: 'Connection limit exceeded',
            maxConnections: rateLimitConfig.maxConnections,
            tier,
            upgrade: tier === 'free' ? 'Get an API key for higher limits' : undefined,
          }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const upgraded = server.upgrade(req, {
          data: {
            id: `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            clientIp: clientId,
            apiKey,
            tier,
          },
        });
        if (upgraded) {
          trackConnectionOpen(clientId);
          return; // Upgrade successful
        }
        return new Response('WebSocket upgrade failed', { status: 400 });
      }

      // SSE for investigation streaming: /stream/:investigationId
      if (path.startsWith('/stream/')) {
        const investigationId = path.slice(8);
        return handleSSEConnection(req, investigationId);
      }

      // SSE for creating new investigation with streaming
      if (path === '/investigate/stream' && req.method === 'POST') {
        // Check investigation limit (tier-specific)
        if (!canStartInvestigation(clientId, rateLimitConfig)) {
          return new Response(JSON.stringify({
            error: 'Investigation limit exceeded',
            maxConcurrent: rateLimitConfig.maxInvestigations,
            tier,
            upgrade: tier === 'free' ? 'Get an API key for higher limits' : undefined,
          }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return handleStreamingInvestigation(req, mcpHandler, clientId);
      }

      // Fallback to regular MCP JSON-RPC
      if (req.method === 'POST') {
        return handleMCPRequest(req, mcpHandler, rateCheck.remaining, tier);
      }

      return new Response(`OpenSVM MCP Streaming Server

Endpoints:
- POST / - JSON-RPC
- GET /ws - WebSocket
- GET /stream/:id - SSE
- POST /investigate/stream - Start streaming investigation

Rate Limits (per minute):
- Free:       100 requests, 5 connections, 3 investigations
- Premium:    1000 requests, 20 connections, 10 investigations
- Enterprise: 5000 requests, 100 connections, 50 investigations

Authentication:
- Header: X-API-Key: your_api_key
- Bearer: Authorization: Bearer your_api_key
- Query:  ?api_key=your_api_key

Get an API key: POST /api/auth/api-keys/create`, {
        headers: { 'Content-Type': 'text/plain' },
      });
    },

    websocket: {
      open(ws: ServerWebSocket<{ id: string; clientIp: string }>) {
        wsClients.set(ws.data.id, {
          ws,
          subscriptions: new Set(),
          clientIp: ws.data.clientIp,
        });
        console.log(`[WS] Client connected: ${ws.data.id} from ${ws.data.clientIp}`);
      },

      message(ws: ServerWebSocket<{ id: string; clientIp: string }>, message: string | Buffer) {
        handleWebSocketMessage(ws, message, mcpHandler);
      },

      close(ws: ServerWebSocket<{ id: string; clientIp: string }>, code: number, reason: string) {
        wsClients.delete(ws.data.id);
        trackConnectionClose(ws.data.clientIp);
        console.log(`[WS] Client disconnected: ${ws.data.id} (${code}: ${reason})`);
      },

      drain(ws: ServerWebSocket<{ id: string; clientIp: string }>) {
        // Handle backpressure
      },
    },
  });

  console.log(`OpenSVM MCP Streaming Server running on ${hostname}:${port}`);
  console.log(`  WebSocket: ws://${hostname}:${port}/ws`);
  console.log(`  SSE: http://${hostname}:${port}/stream/:investigationId`);
  console.log(`  JSON-RPC: http://${hostname}:${port}/`);

  return server;
}

/**
 * Handle regular MCP JSON-RPC request
 */
async function handleMCPRequest(
  req: Request,
  mcpHandler: (req: MCPRequest) => Promise<MCPResponse>,
  rateLimitRemaining?: number,
  tier?: 'free' | 'premium' | 'enterprise'
): Promise<Response> {
  try {
    const body: MCPRequest = await req.json();
    const response = await mcpHandler(body);
    return new Response(JSON.stringify(response), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        ...(rateLimitRemaining !== undefined && {
          'X-RateLimit-Remaining': String(rateLimitRemaining),
        }),
        ...(tier && {
          'X-RateLimit-Tier': tier,
        }),
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error' },
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle streaming investigation request
 */
async function handleStreamingInvestigation(
  req: Request,
  mcpHandler: (req: MCPRequest) => Promise<MCPResponse>,
  clientId?: string
): Promise<Response> {
  try {
    const body = await req.json();
    const { target, type = 'wallet_forensics', config = {} } = body;

    if (!target) {
      return new Response(JSON.stringify({ error: 'Missing target' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create investigation stream
    const stream = createInvestigationStream(target, type);
    const encoder = new TextEncoder();

    // Track investigation for rate limiting
    if (clientId) {
      trackInvestigationStart(clientId, stream.id);
    }

    // Start investigation in background
    const investigationPromise = mcpHandler({
      jsonrpc: '2.0',
      id: stream.id,
      method: 'tools/call',
      params: {
        name: 'investigate',
        arguments: { target, type, ...config },
      },
    });

    // Create SSE response that streams events
    const responseStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        // Send initial event
        controller.enqueue(encoder.encode(formatSSEEvent({
          event: 'start',
          data: { investigationId: stream.id, target, type },
          id: `${Date.now()}`,
        })));

        // Subscribe to investigation events
        const unsubscribe = subscribeToInvestigation(stream.id, (event) => {
          try {
            controller.enqueue(encoder.encode(formatSSEEvent({
              event: event.type,
              data: event.data,
              id: `${event.timestamp}`,
            })));

            // Close stream on complete or error
            if (event.type === 'complete' || event.type === 'error') {
              // Track investigation end
              if (clientId) {
                trackInvestigationEnd(clientId, stream.id);
              }
              setTimeout(() => {
                try {
                  controller.close();
                } catch {
                  // Already closed
                }
              }, 100);
            }
          } catch (error) {
            // Stream closed
            unsubscribe();
            if (clientId) {
              trackInvestigationEnd(clientId, stream.id);
            }
          }
        });

        // Wait for investigation to complete
        try {
          const result = await investigationPromise;
          emitStreamEvent(stream.id, {
            type: 'complete',
            timestamp: Date.now(),
            data: result,
          });
        } catch (error) {
          emitStreamEvent(stream.id, {
            type: 'error',
            timestamp: Date.now(),
            data: { error: error instanceof Error ? error.message : String(error) },
          });
        }
      },
      cancel() {
        // Client disconnected, clean up
        if (clientId) {
          trackInvestigationEnd(clientId, stream.id);
        }
      },
    });

    return createSSEResponse(responseStream);

  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Invalid request',
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Broadcast notification to all connected WebSocket clients
 */
export function broadcastNotification(notification: MCPNotification): void {
  const message = JSON.stringify(notification);
  for (const client of wsClients.values()) {
    try {
      client.ws.send(message);
    } catch (error) {
      // Client disconnected
    }
  }
}

/**
 * Get active investigation IDs
 */
export function getActiveInvestigations(): string[] {
  return Array.from(activeInvestigations.keys());
}

/**
 * Clean up completed investigations (call periodically)
 */
export function cleanupInvestigations(maxAgeMs: number = 3600000): void {
  const now = Date.now();
  for (const [id, investigation] of activeInvestigations) {
    const lastEvent = investigation.events[investigation.events.length - 1];
    if (lastEvent && (lastEvent.type === 'complete' || lastEvent.type === 'error')) {
      if (now - investigation.startedAt > maxAgeMs) {
        activeInvestigations.delete(id);
        eventSubscribers.delete(id);
      }
    }
  }
}
