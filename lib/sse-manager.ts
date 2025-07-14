/**
 * Server-Sent Events Manager
 * Manages SSE connections for real-time streaming
 */

export interface SSEConnection {
  id: string;
  response: Response;
  controller: ReadableStreamDefaultController;
  subscriptions: Set<string>;
  connected: boolean;
  lastActivity: number;
}

export interface BlockchainEvent {
  type: 'transaction' | 'block' | 'account_change';
  timestamp: number;
  data: any;
  metadata?: any;
}

export class SSEManager {
  private static instance: SSEManager;
  private connections: Map<string, SSEConnection> = new Map();

  public static getInstance(): SSEManager {
    if (!SSEManager.instance) {
      SSEManager.instance = new SSEManager();
    }
    return SSEManager.instance;
  }

  public addConnection(id: string, controller: ReadableStreamDefaultController): void {
    const connection: SSEConnection = {
      id,
      response: null as any, // Will be set by caller
      controller,
      subscriptions: new Set(),
      connected: true,
      lastActivity: Date.now()
    };

    this.connections.set(id, connection);
  }

  public removeConnection(id: string): void {
    const connection = this.connections.get(id);
    if (connection) {
      connection.connected = false;
      try {
        connection.controller.close();
      } catch (error) {
        // Connection already closed
      }
      this.connections.delete(id);
    }
  }

  public broadcastBlockchainEvent(event: BlockchainEvent): void {
    const message = `data: ${JSON.stringify(event)}\n\n`;
    const encoder = new TextEncoder();
    const data = encoder.encode(message);

    for (const [id, connection] of this.connections) {
      if (!connection.connected) {
        this.connections.delete(id);
        continue;
      }

      try {
        connection.controller.enqueue(data);
        connection.lastActivity = Date.now();
      } catch (error) {
        // Connection failed, remove it
        this.removeConnection(id);
      }
    }
  }

  public broadcastAnomalyAlert(alert: any): void {
    const message = `data: ${JSON.stringify({ type: 'anomaly_alert', data: alert, timestamp: Date.now() })}\n\n`;
    const encoder = new TextEncoder();
    const data = encoder.encode(message);

    for (const [id, connection] of this.connections) {
      if (!connection.connected) {
        this.connections.delete(id);
        continue;
      }

      try {
        connection.controller.enqueue(data);
        connection.lastActivity = Date.now();
      } catch (error) {
        // Connection failed, remove it
        this.removeConnection(id);
      }
    }
  }

  public addClient(clientId: string): ReadableStream {
    const stream = new ReadableStream({
      start: (controller) => {
        this.addConnection(clientId, controller);
      },
      cancel: () => {
        this.removeConnection(clientId);
      }
    });

    return stream;
  }

  public removeClient(clientId: string): void {
    this.removeConnection(clientId);
  }

  public getStats(): { connectionCount: number; activeConnections: string[] } {
    return {
      connectionCount: this.connections.size,
      activeConnections: Array.from(this.connections.keys())
    };
  }

  public getConnectionCount(): number {
    return this.connections.size;
  }

  public cleanupStaleConnections(): void {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [id, connection] of this.connections) {
      if (now - connection.lastActivity > staleThreshold) {
        this.removeConnection(id);
      }
    }
  }
}

// Export cleanup function
export function startSSECleanup(): void {
  const manager = SSEManager.getInstance();
  setInterval(() => {
    manager.cleanupStaleConnections();
  }, 5 * 60 * 1000); // Run every 5 minutes
}
