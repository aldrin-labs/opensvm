#!/usr/bin/env bun
/**
 * MCP WebSocket Transport
 *
 * Provides WebSocket transport for browser-based MCP clients.
 * Implements the MCP transport interface over WebSocket connections.
 */

import { EventEmitter } from 'events';
import type { Server as McpServer } from '@modelcontextprotocol/sdk/server/index.js';

// ============================================================================
// Types
// ============================================================================

interface JSONRPCMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface WebSocketTransportOptions {
  port?: number;
  host?: string;
  path?: string;
  maxConnections?: number;
  heartbeatInterval?: number;
  corsOrigins?: string[];
}

interface WebSocketClient {
  id: string;
  ws: WebSocket;
  connectedAt: number;
  lastActivity: number;
  initialized: boolean;
}

// ============================================================================
// WebSocket Server Transport
// ============================================================================

class WebSocketServerTransport extends EventEmitter {
  private options: Required<WebSocketTransportOptions>;
  private clients: Map<string, WebSocketClient> = new Map();
  private server: ReturnType<typeof Bun.serve> | null = null;
  private heartbeatTimer: Timer | null = null;

  constructor(options: WebSocketTransportOptions = {}) {
    super();
    this.options = {
      port: options.port ?? 8765,
      host: options.host ?? '0.0.0.0',
      path: options.path ?? '/mcp',
      maxConnections: options.maxConnections ?? 100,
      heartbeatInterval: options.heartbeatInterval ?? 30000,
      corsOrigins: options.corsOrigins ?? ['*'],
    };
  }

  async start(): Promise<void> {
    const self = this;

    this.server = Bun.serve({
      port: this.options.port,
      hostname: this.options.host,

      fetch(req, server) {
        const url = new URL(req.url);

        // Handle CORS preflight
        if (req.method === 'OPTIONS') {
          return new Response(null, {
            headers: {
              'Access-Control-Allow-Origin': self.options.corsOrigins.join(', '),
              'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type',
            },
          });
        }

        // Health check endpoint
        if (url.pathname === '/health') {
          return Response.json({
            status: 'ok',
            clients: self.clients.size,
            uptime: process.uptime(),
          });
        }

        // WebSocket upgrade
        if (url.pathname === self.options.path) {
          const upgraded = server.upgrade(req, {
            data: { clientId: crypto.randomUUID() },
          });
          if (upgraded) {
            return undefined;
          }
          return new Response('WebSocket upgrade failed', { status: 500 });
        }

        // API info
        if (url.pathname === '/') {
          return Response.json({
            name: 'OpenSVM MCP WebSocket Gateway',
            version: '2.0.0',
            protocol: 'MCP 2025-11-25',
            websocket: `ws://${self.options.host}:${self.options.port}${self.options.path}`,
            endpoints: {
              health: '/health',
              websocket: self.options.path,
            },
          });
        }

        return new Response('Not Found', { status: 404 });
      },

      websocket: {
        open(ws) {
          const clientId = (ws.data as { clientId: string }).clientId;

          if (self.clients.size >= self.options.maxConnections) {
            ws.close(1013, 'Maximum connections reached');
            return;
          }

          const client: WebSocketClient = {
            id: clientId,
            ws: ws as unknown as WebSocket,
            connectedAt: Date.now(),
            lastActivity: Date.now(),
            initialized: false,
          };

          self.clients.set(clientId, client);
          self.emit('connection', clientId);

          console.error(`[WS] Client connected: ${clientId} (total: ${self.clients.size})`);
        },

        message(ws, message) {
          const clientId = (ws.data as { clientId: string }).clientId;
          const client = self.clients.get(clientId);

          if (!client) {
            ws.close(1011, 'Client not found');
            return;
          }

          client.lastActivity = Date.now();

          try {
            const data = typeof message === 'string' ? message : new TextDecoder().decode(message as ArrayBuffer);
            const parsed = JSON.parse(data) as JSONRPCMessage;

            self.emit('message', clientId, parsed);
          } catch (error) {
            // Send parse error
            const errorResponse: JSONRPCMessage = {
              jsonrpc: '2.0',
              error: {
                code: -32700,
                message: 'Parse error',
                data: error instanceof Error ? error.message : String(error),
              },
            };
            ws.send(JSON.stringify(errorResponse));
          }
        },

        close(ws, code, reason) {
          const clientId = (ws.data as { clientId: string }).clientId;
          self.clients.delete(clientId);
          self.emit('disconnection', clientId, code, reason);

          console.error(`[WS] Client disconnected: ${clientId} (code: ${code})`);
        },

        error(ws, error) {
          const clientId = (ws.data as { clientId: string }).clientId;
          self.emit('error', clientId, error);

          console.error(`[WS] Client error: ${clientId}`, error);
        },
      },
    });

    // Start heartbeat
    this.startHeartbeat();

    console.error(`[WS] MCP WebSocket server started on ws://${this.options.host}:${this.options.port}${this.options.path}`);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      const timeout = this.options.heartbeatInterval * 2;

      for (const [clientId, client] of this.clients) {
        if (now - client.lastActivity > timeout) {
          console.error(`[WS] Client timeout: ${clientId}`);
          client.ws.close(1000, 'Heartbeat timeout');
          this.clients.delete(clientId);
        }
      }
    }, this.options.heartbeatInterval);
  }

  send(clientId: string, message: JSONRPCMessage): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    try {
      client.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`[WS] Send error to ${clientId}:`, error);
      return false;
    }
  }

  broadcast(message: JSONRPCMessage): number {
    const data = JSON.stringify(message);
    let sent = 0;

    for (const client of this.clients.values()) {
      try {
        client.ws.send(data);
        sent++;
      } catch (error) {
        console.error(`[WS] Broadcast error to ${client.id}:`, error);
      }
    }

    return sent;
  }

  getClients(): string[] {
    return Array.from(this.clients.keys());
  }

  getClientInfo(clientId: string): Omit<WebSocketClient, 'ws'> | undefined {
    const client = this.clients.get(clientId);
    if (!client) return undefined;

    return {
      id: client.id,
      connectedAt: client.connectedAt,
      lastActivity: client.lastActivity,
      initialized: client.initialized,
    };
  }

  markInitialized(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.initialized = true;
    }
  }

  stop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    for (const client of this.clients.values()) {
      client.ws.close(1001, 'Server shutting down');
    }
    this.clients.clear();

    if (this.server) {
      this.server.stop();
      this.server = null;
    }

    console.error('[WS] MCP WebSocket server stopped');
  }

  getStats(): {
    clients: number;
    uptime: number;
    port: number;
    path: string;
  } {
    return {
      clients: this.clients.size,
      uptime: process.uptime(),
      port: this.options.port,
      path: this.options.path,
    };
  }
}

// ============================================================================
// MCP WebSocket Gateway
// ============================================================================

class MCPWebSocketGateway {
  private transport: WebSocketServerTransport;
  private messageHandler: ((clientId: string, message: JSONRPCMessage) => Promise<JSONRPCMessage | null>) | null = null;

  constructor(options: WebSocketTransportOptions = {}) {
    this.transport = new WebSocketServerTransport(options);
    this.setupTransportHandlers();
  }

  private setupTransportHandlers(): void {
    this.transport.on('message', async (clientId: string, message: JSONRPCMessage) => {
      if (this.messageHandler) {
        const response = await this.messageHandler(clientId, message);
        if (response) {
          this.transport.send(clientId, response);
        }
      }
    });

    this.transport.on('connection', (clientId: string) => {
      console.error(`[Gateway] New client: ${clientId}`);
    });

    this.transport.on('disconnection', (clientId: string) => {
      console.error(`[Gateway] Client left: ${clientId}`);
    });
  }

  setMessageHandler(handler: (clientId: string, message: JSONRPCMessage) => Promise<JSONRPCMessage | null>): void {
    this.messageHandler = handler;
  }

  async start(): Promise<void> {
    await this.transport.start();
  }

  stop(): void {
    this.transport.stop();
  }

  sendNotification(clientId: string, method: string, params?: unknown): boolean {
    return this.transport.send(clientId, {
      jsonrpc: '2.0',
      method,
      params,
    });
  }

  broadcastNotification(method: string, params?: unknown): number {
    return this.transport.broadcast({
      jsonrpc: '2.0',
      method,
      params,
    });
  }

  getTransport(): WebSocketServerTransport {
    return this.transport;
  }

  getStats(): ReturnType<WebSocketServerTransport['getStats']> {
    return this.transport.getStats();
  }
}

// ============================================================================
// Integration with MCP Spec Gateway
// ============================================================================

async function createWebSocketMCPServer(options: WebSocketTransportOptions = {}): Promise<{
  gateway: MCPWebSocketGateway;
  handleRequest: (clientId: string, message: JSONRPCMessage) => Promise<JSONRPCMessage | null>;
}> {
  // Dynamic import to avoid circular dependencies
  const { createSpecCompliantGateway, PROTOCOL_VERSION, SERVER_INFO, SERVER_CAPABILITIES } = await import('./mcp-spec-gateway.js');

  const { server, registry, progressTracker, subscriptionManager, loggingManager, gateway: discoveryGateway } = await createSpecCompliantGateway();

  const wsGateway = new MCPWebSocketGateway(options);

  // Handle JSON-RPC messages
  const handleRequest = async (clientId: string, message: JSONRPCMessage): Promise<JSONRPCMessage | null> => {
    const { id, method, params } = message;

    // Notifications don't have an id and don't need a response
    if (id === undefined) {
      return null;
    }

    try {
      let result: unknown;

      switch (method) {
        case 'initialize': {
          wsGateway.getTransport().markInitialized(clientId);
          result = {
            protocolVersion: PROTOCOL_VERSION,
            serverInfo: SERVER_INFO,
            capabilities: SERVER_CAPABILITIES,
          };
          break;
        }

        case 'tools/list': {
          const tools = registry.getAllTools();
          result = { tools: tools.map(t => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })) };
          break;
        }

        case 'tools/call': {
          const { name, arguments: args } = params as { name: string; arguments?: Record<string, unknown> };
          const toolResult = await discoveryGateway.executeTool(name, args || {});
          result = { content: [{ type: 'text', text: JSON.stringify(toolResult, null, 2) }] };
          break;
        }

        case 'prompts/list': {
          const prompts = registry.getAllPrompts();
          result = { prompts: prompts.map(p => ({
            name: p.name,
            description: p.description,
            arguments: p.arguments,
          })) };
          break;
        }

        case 'resources/list': {
          const resources = registry.getAllResources();
          result = { resources: resources.map(r => ({
            uri: r.uri,
            name: r.name,
            description: r.description,
            mimeType: r.mimeType,
          })) };
          break;
        }

        case 'logging/setLevel': {
          const { level } = params as { level: string };
          loggingManager.setLevel(level as 'debug' | 'info' | 'warning' | 'error');
          result = {};
          break;
        }

        case 'ping': {
          result = {};
          break;
        }

        default: {
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: `Method not found: ${method}`,
            },
          };
        }
      }

      return {
        jsonrpc: '2.0',
        id,
        result,
      };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  };

  wsGateway.setMessageHandler(handleRequest);

  // Forward logging messages to WebSocket clients
  loggingManager.on('message', (msg: { level: string; logger: string; data: unknown }) => {
    wsGateway.broadcastNotification('notifications/message', msg);
  });

  // Forward progress updates
  progressTracker.on('progress', (progress: { token: string | number; current: number; total?: number; message?: string }) => {
    wsGateway.broadcastNotification('notifications/progress', progress);
  });

  // Forward resource updates
  subscriptionManager.on('resourceUpdated', (uri: string) => {
    wsGateway.broadcastNotification('notifications/resources/updated', { uri });
  });

  return { gateway: wsGateway, handleRequest };
}

// ============================================================================
// Standalone Server Entry Point
// ============================================================================

async function main() {
  const port = parseInt(process.env.MCP_WS_PORT || '8765', 10);
  const host = process.env.MCP_WS_HOST || '0.0.0.0';

  console.error('[WS] Starting MCP WebSocket Gateway...');

  const { gateway } = await createWebSocketMCPServer({ port, host });
  await gateway.start();

  console.error(`[WS] MCP WebSocket Gateway ready`);
  console.error(`[WS] Connect at: ws://${host}:${port}/mcp`);

  // Handle shutdown
  process.on('SIGINT', () => {
    console.error('\n[WS] Shutting down...');
    gateway.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.error('[WS] Received SIGTERM, shutting down...');
    gateway.stop();
    process.exit(0);
  });
}

// ============================================================================
// Exports
// ============================================================================

export {
  WebSocketServerTransport,
  MCPWebSocketGateway,
  createWebSocketMCPServer,
  type WebSocketTransportOptions,
  type WebSocketClient,
  type JSONRPCMessage,
};

// Run if executed directly
if (import.meta.main) {
  main().catch(console.error);
}
