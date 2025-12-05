#!/usr/bin/env bun
/**
 * WebSocket Client Example for OpenSVM MCP Streaming Server
 *
 * This example shows how to:
 * 1. Connect to the MCP server via WebSocket
 * 2. List available tools
 * 3. Call tools and receive results
 * 4. Subscribe to investigation streams
 *
 * Run: bun run examples/websocket-client.ts
 */

const WS_URL = process.env.MCP_WS_URL || 'ws://localhost:3001/ws';

interface MCPRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, any>;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: any;
  error?: { code: number; message: string };
}

class MCPWebSocketClient {
  private ws: WebSocket | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number | string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }>();
  private eventHandlers = new Map<string, Set<(event: any) => void>>();

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        console.log('[WS] Connected to', WS_URL);
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('[WS] Error:', error);
        reject(new Error('WebSocket connection failed'));
      };

      this.ws.onclose = (event) => {
        console.log('[WS] Disconnected:', event.code, event.reason);
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };
    });
  }

  private handleMessage(message: MCPResponse | { method: string; params: any }): void {
    // Handle response to a request
    if ('id' in message && message.id !== null) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        if ('error' in message && message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
      }
      return;
    }

    // Handle notification (e.g., investigation events)
    if ('method' in message) {
      const handlers = this.eventHandlers.get(message.method);
      if (handlers) {
        for (const handler of handlers) {
          handler(message.params);
        }
      }
    }
  }

  async request<T = any>(method: string, params?: Record<string, any>): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const id = ++this.requestId;
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.ws!.send(JSON.stringify(request));

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  on(event: string, handler: (data: any) => void): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  async subscribeToInvestigation(investigationId: string): Promise<void> {
    await this.request('subscribe', { investigationId });
  }

  async unsubscribeFromInvestigation(investigationId: string): Promise<void> {
    await this.request('unsubscribe', { investigationId });
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Example usage
async function main() {
  const client = new MCPWebSocketClient();

  try {
    // Connect
    await client.connect();

    // List available tools
    console.log('\n[1] Listing tools...');
    const tools = await client.request('tools/list');
    console.log(`Found ${tools.tools.length} tools`);

    // Call a simple tool
    console.log('\n[2] Getting network status...');
    const status = await client.request('tools/call', {
      name: 'get_network_status',
      arguments: {},
    });
    console.log('Network status:', status.content[0].text.slice(0, 200) + '...');

    // Search for something
    console.log('\n[3] Searching for USDC...');
    const search = await client.request('tools/call', {
      name: 'search',
      arguments: { query: 'USDC' },
    });
    console.log('Search results:', search.content[0].text.slice(0, 200) + '...');

    // Subscribe to investigation events
    console.log('\n[4] Setting up investigation event handler...');
    client.on('investigation/event', (data) => {
      console.log('[Investigation Event]', data.event.type, data.event.data);
    });

    // Start an investigation (if you have an address to investigate)
    const testAddress = process.env.TEST_ADDRESS;
    if (testAddress) {
      console.log('\n[5] Starting investigation for', testAddress);
      const investigation = await client.request('tools/call', {
        name: 'investigate',
        arguments: {
          target: testAddress,
          type: 'wallet_forensics',
        },
      });
      console.log('Investigation result:', investigation.content[0].text.slice(0, 500) + '...');
    }

    console.log('\n[Done] All tests passed!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.close();
  }
}

main();
