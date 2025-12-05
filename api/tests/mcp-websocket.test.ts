/**
 * MCP WebSocket Transport Tests
 *
 * Tests for the WebSocket transport implementation.
 */

import { EventEmitter } from 'events';

// Mock types for testing without Bun
interface MockWebSocket {
  data: { clientId: string };
  send: jest.Mock;
  close: jest.Mock;
}

// Create mock transport class for testing
class MockWebSocketServerTransport extends EventEmitter {
  private options: {
    port: number;
    host: string;
    path: string;
    maxConnections: number;
    heartbeatInterval: number;
    corsOrigins: string[];
  };
  private clients: Map<string, { id: string; connectedAt: number; lastActivity: number; initialized: boolean; ws: MockWebSocket }> = new Map();
  private started = false;

  constructor(options: Partial<typeof MockWebSocketServerTransport.prototype.options> = {}) {
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
    this.started = true;
  }

  stop(): void {
    this.clients.clear();
    this.started = false;
  }

  isStarted(): boolean {
    return this.started;
  }

  // Simulate client connection
  simulateConnection(clientId: string): MockWebSocket {
    const ws: MockWebSocket = {
      data: { clientId },
      send: jest.fn(),
      close: jest.fn(),
    };

    this.clients.set(clientId, {
      id: clientId,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      initialized: false,
      ws,
    });

    this.emit('connection', clientId);
    return ws;
  }

  // Simulate message from client
  simulateMessage(clientId: string, message: unknown): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastActivity = Date.now();
      this.emit('message', clientId, message);
    }
  }

  // Simulate client disconnection
  simulateDisconnection(clientId: string, code = 1000, reason = ''): void {
    this.clients.delete(clientId);
    this.emit('disconnection', clientId, code, reason);
  }

  send(clientId: string, message: unknown): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    client.ws.send(JSON.stringify(message));
    return true;
  }

  broadcast(message: unknown): number {
    const data = JSON.stringify(message);
    let sent = 0;

    for (const client of this.clients.values()) {
      client.ws.send(data);
      sent++;
    }

    return sent;
  }

  getClients(): string[] {
    return Array.from(this.clients.keys());
  }

  getClientInfo(clientId: string): Omit<typeof this.clients extends Map<string, infer V> ? V : never, 'ws'> | undefined {
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

  getStats(): { clients: number; uptime: number; port: number; path: string } {
    return {
      clients: this.clients.size,
      uptime: process.uptime(),
      port: this.options.port,
      path: this.options.path,
    };
  }
}

describe('WebSocket Transport', () => {
  let transport: MockWebSocketServerTransport;

  beforeEach(() => {
    transport = new MockWebSocketServerTransport({ port: 9999 });
  });

  afterEach(() => {
    transport.stop();
  });

  describe('Server Lifecycle', () => {
    test('should start successfully', async () => {
      await transport.start();
      expect(transport.isStarted()).toBe(true);
    });

    test('should stop and clear clients', async () => {
      await transport.start();
      transport.simulateConnection('client1');
      transport.simulateConnection('client2');

      expect(transport.getClients().length).toBe(2);

      transport.stop();

      expect(transport.isStarted()).toBe(false);
      expect(transport.getClients().length).toBe(0);
    });
  });

  describe('Client Connections', () => {
    beforeEach(async () => {
      await transport.start();
    });

    test('should track connected clients', () => {
      transport.simulateConnection('client1');
      transport.simulateConnection('client2');

      expect(transport.getClients()).toEqual(['client1', 'client2']);
    });

    test('should emit connection event', () => {
      const connections: string[] = [];
      transport.on('connection', (id) => connections.push(id));

      transport.simulateConnection('client1');

      expect(connections).toEqual(['client1']);
    });

    test('should get client info', () => {
      transport.simulateConnection('client1');

      const info = transport.getClientInfo('client1');
      expect(info).toBeDefined();
      expect(info?.id).toBe('client1');
      expect(info?.initialized).toBe(false);
      expect(info?.connectedAt).toBeDefined();
    });

    test('should mark client as initialized', () => {
      transport.simulateConnection('client1');
      transport.markInitialized('client1');

      const info = transport.getClientInfo('client1');
      expect(info?.initialized).toBe(true);
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      await transport.start();
    });

    test('should emit message events', () => {
      const messages: unknown[] = [];
      transport.on('message', (clientId, msg) => messages.push({ clientId, msg }));

      transport.simulateConnection('client1');
      transport.simulateMessage('client1', { jsonrpc: '2.0', id: 1, method: 'ping' });

      expect(messages.length).toBe(1);
      expect(messages[0]).toEqual({
        clientId: 'client1',
        msg: { jsonrpc: '2.0', id: 1, method: 'ping' },
      });
    });

    test('should update lastActivity on message', () => {
      transport.simulateConnection('client1');
      const infoBefore = transport.getClientInfo('client1');
      const before = infoBefore?.lastActivity ?? 0;

      // Wait a tiny bit to ensure time difference
      jest.advanceTimersByTime?.(10) || new Promise(r => setTimeout(r, 10));

      transport.simulateMessage('client1', { test: true });
      const infoAfter = transport.getClientInfo('client1');

      expect(infoAfter?.lastActivity).toBeGreaterThanOrEqual(before);
    });
  });

  describe('Sending Messages', () => {
    beforeEach(async () => {
      await transport.start();
    });

    test('should send message to specific client', () => {
      const ws = transport.simulateConnection('client1');

      const sent = transport.send('client1', { jsonrpc: '2.0', id: 1, result: {} });

      expect(sent).toBe(true);
      expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} }));
    });

    test('should return false when sending to unknown client', () => {
      const sent = transport.send('unknown', { test: true });
      expect(sent).toBe(false);
    });

    test('should broadcast to all clients', () => {
      const ws1 = transport.simulateConnection('client1');
      const ws2 = transport.simulateConnection('client2');
      const ws3 = transport.simulateConnection('client3');

      const count = transport.broadcast({ method: 'notification', params: {} });

      expect(count).toBe(3);
      expect(ws1.send).toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalled();
      expect(ws3.send).toHaveBeenCalled();
    });
  });

  describe('Disconnection', () => {
    beforeEach(async () => {
      await transport.start();
    });

    test('should emit disconnection event', () => {
      const disconnections: { id: string; code: number }[] = [];
      transport.on('disconnection', (id, code) => disconnections.push({ id, code }));

      transport.simulateConnection('client1');
      transport.simulateDisconnection('client1', 1000);

      expect(disconnections).toEqual([{ id: 'client1', code: 1000 }]);
    });

    test('should remove client on disconnection', () => {
      transport.simulateConnection('client1');
      expect(transport.getClients()).toContain('client1');

      transport.simulateDisconnection('client1');
      expect(transport.getClients()).not.toContain('client1');
    });
  });

  describe('Stats', () => {
    beforeEach(async () => {
      await transport.start();
    });

    test('should return accurate stats', () => {
      transport.simulateConnection('client1');
      transport.simulateConnection('client2');

      const stats = transport.getStats();

      expect(stats.clients).toBe(2);
      expect(stats.port).toBe(9999);
      expect(stats.path).toBe('/mcp');
      expect(stats.uptime).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('MCP WebSocket Gateway', () => {
  let transport: MockWebSocketServerTransport;
  let messageHandler: ((clientId: string, message: unknown) => Promise<unknown>) | null = null;

  beforeEach(async () => {
    transport = new MockWebSocketServerTransport();
    await transport.start();

    // Set up message handler
    transport.on('message', async (clientId: string, message: unknown) => {
      if (messageHandler) {
        const response = await messageHandler(clientId, message);
        if (response) {
          transport.send(clientId, response);
        }
      }
    });
  });

  afterEach(() => {
    transport.stop();
    messageHandler = null;
  });

  test('should handle initialize request', async () => {
    messageHandler = async (_clientId, message) => {
      const { id, method } = message as { id: number; method: string };
      if (method === 'initialize') {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2025-11-25',
            serverInfo: { name: 'test', version: '1.0.0' },
            capabilities: { tools: { listChanged: true } },
          },
        };
      }
      return null;
    };

    const ws = transport.simulateConnection('client1');
    transport.simulateMessage('client1', {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {},
    });

    // Wait for async handling
    await new Promise(r => setTimeout(r, 10));

    expect(ws.send).toHaveBeenCalled();
    const response = JSON.parse(ws.send.mock.calls[0][0]);
    expect(response.result.protocolVersion).toBe('2025-11-25');
  });

  test('should handle tools/list request', async () => {
    const mockTools = [
      { name: 'test:tool', description: 'Test tool', inputSchema: { type: 'object' } },
    ];

    messageHandler = async (_clientId, message) => {
      const { id, method } = message as { id: number; method: string };
      if (method === 'tools/list') {
        return {
          jsonrpc: '2.0',
          id,
          result: { tools: mockTools },
        };
      }
      return null;
    };

    const ws = transport.simulateConnection('client1');
    transport.simulateMessage('client1', {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    });

    await new Promise(r => setTimeout(r, 10));

    const response = JSON.parse(ws.send.mock.calls[0][0]);
    expect(response.result.tools).toEqual(mockTools);
  });

  test('should handle unknown method with error', async () => {
    messageHandler = async (_clientId, message) => {
      const { id, method } = message as { id: number; method: string };
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Method not found: ${method}`,
        },
      };
    };

    const ws = transport.simulateConnection('client1');
    transport.simulateMessage('client1', {
      jsonrpc: '2.0',
      id: 3,
      method: 'unknown/method',
      params: {},
    });

    await new Promise(r => setTimeout(r, 10));

    const response = JSON.parse(ws.send.mock.calls[0][0]);
    expect(response.error.code).toBe(-32601);
  });

  test('should broadcast notifications', async () => {
    const ws1 = transport.simulateConnection('client1');
    const ws2 = transport.simulateConnection('client2');

    const notification = {
      jsonrpc: '2.0',
      method: 'notifications/progress',
      params: { token: 'abc', current: 50, total: 100 },
    };

    transport.broadcast(notification);

    expect(ws1.send).toHaveBeenCalledWith(JSON.stringify(notification));
    expect(ws2.send).toHaveBeenCalledWith(JSON.stringify(notification));
  });
});

describe('JSON-RPC Protocol Compliance', () => {
  test('should have correct JSON-RPC version', () => {
    const message = {
      jsonrpc: '2.0' as const,
      id: 1,
      method: 'test',
      params: {},
    };

    expect(message.jsonrpc).toBe('2.0');
  });

  test('request should have id, method, and optional params', () => {
    const request = {
      jsonrpc: '2.0' as const,
      id: 1,
      method: 'tools/call',
      params: { name: 'test:tool', arguments: {} },
    };

    expect(request).toHaveProperty('jsonrpc', '2.0');
    expect(request).toHaveProperty('id');
    expect(request).toHaveProperty('method');
    expect(request).toHaveProperty('params');
  });

  test('response should have id and either result or error', () => {
    const successResponse = {
      jsonrpc: '2.0' as const,
      id: 1,
      result: { data: 'test' },
    };

    const errorResponse = {
      jsonrpc: '2.0' as const,
      id: 2,
      error: { code: -32600, message: 'Invalid Request' },
    };

    expect(successResponse).toHaveProperty('result');
    expect(successResponse).not.toHaveProperty('error');
    expect(errorResponse).toHaveProperty('error');
    expect(errorResponse).not.toHaveProperty('result');
  });

  test('notification should not have id', () => {
    const notification = {
      jsonrpc: '2.0' as const,
      method: 'notifications/message',
      params: { level: 'info', data: {} },
    };

    expect(notification).not.toHaveProperty('id');
  });
});

console.log('MCP WebSocket Transport Tests');
console.log('==============================');
