/**
 * Server-Sent Events (SSE) Handler
 * For real-time streaming endpoints
 */

import { NextRequest } from 'next/server';

export interface SSEClient {
  id: string;
  controller: ReadableStreamDefaultController;
  lastEventId?: string;
  closed: boolean;
}

export class SSEManager {
  private clients: Map<string, SSEClient> = new Map();
  private messageId = 0;

  /**
   * Create SSE response stream
   */
  createSSEStream(req: NextRequest): Response {
    const clientId = this.generateClientId();
    
    const stream = new ReadableStream({
      start: (controller) => {
        // Store client
        this.clients.set(clientId, {
          id: clientId,
          controller,
          lastEventId: req.headers.get('last-event-id') || undefined,
          closed: false
        });

        // Send initial connection message
        this.sendToClient(clientId, {
          type: 'connected',
          clientId,
          timestamp: Date.now()
        });

        // Set up ping interval to keep connection alive
        const pingInterval = setInterval(() => {
          const client = this.clients.get(clientId);
          if (client && !client.closed) {
            try {
              const pingMessage = `: ping\n\n`;
              const encoder = new TextEncoder();
              client.controller.enqueue(encoder.encode(pingMessage));
            } catch (error) {
              // Client disconnected
              this.removeClient(clientId);
              clearInterval(pingInterval);
            }
          } else {
            clearInterval(pingInterval);
          }
        }, 30000); // Ping every 30 seconds

        // Clean up on close
        req.signal.addEventListener('abort', () => {
          this.removeClient(clientId);
          clearInterval(pingInterval);
        });
      },
      
      cancel: () => {
        this.removeClient(clientId);
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable Nginx buffering
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Last-Event-ID',
      }
    });
  }

  /**
   * Send data to a specific client
   */
  sendToClient(clientId: string, data: any, eventType?: string) {
    const client = this.clients.get(clientId);
    if (!client || client.closed) return;

    try {
      const messageId = ++this.messageId;
      const encoder = new TextEncoder();
      
      let message = '';
      
      // Add event type if specified
      if (eventType) {
        message += `event: ${eventType}\n`;
      }
      
      // Add message ID
      message += `id: ${messageId}\n`;
      
      // Add data
      message += `data: ${JSON.stringify(data)}\n\n`;
      
      client.controller.enqueue(encoder.encode(message));
    } catch (error) {
      // Client disconnected
      this.removeClient(clientId);
    }
  }

  /**
   * Broadcast to all clients
   */
  broadcast(data: any, eventType?: string) {
    for (const clientId of this.clients.keys()) {
      this.sendToClient(clientId, data, eventType);
    }
  }

  /**
   * Broadcast to clients matching a filter
   */
  broadcastToMatching(
    filter: (client: SSEClient) => boolean,
    data: any,
    eventType?: string
  ) {
    for (const [clientId, client] of this.clients.entries()) {
      if (filter(client)) {
        this.sendToClient(clientId, data, eventType);
      }
    }
  }

  /**
   * Remove a client
   */
  removeClient(clientId: string) {
    const client = this.clients.get(clientId);
    if (client) {
      client.closed = true;
      try {
        client.controller.close();
      } catch (error) {
        // Already closed
      }
      this.clients.delete(clientId);
    }
  }

  /**
   * Get active client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instances for different stream types
export const transactionStreamManager = new SSEManager();
export const blockStreamManager = new SSEManager();
export const notificationManager = new SSEManager();
export const alertManager = new SSEManager();

/**
 * Format SSE message manually (for simple responses)
 */
export function formatSSEMessage(data: any, eventType?: string, id?: string): string {
  let message = '';
  
  if (eventType) {
    message += `event: ${eventType}\n`;
  }
  
  if (id) {
    message += `id: ${id}\n`;
  }
  
  // Handle multiline data
  const jsonData = JSON.stringify(data);
  const lines = jsonData.split('\n');
  for (const line of lines) {
    message += `data: ${line}\n`;
  }
  
  message += '\n';
  
  return message;
}

/**
 * Create a simple SSE response without manager
 */
export function createSimpleSSEResponse(): Response {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial message
      controller.enqueue(
        encoder.encode(
          formatSSEMessage(
            { 
              status: 'connected', 
              timestamp: Date.now(),
              message: 'Real-time stream connected'
            },
            'connection'
          )
        )
      );
      
      // Keep alive with periodic pings
      const interval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch (error) {
          clearInterval(interval);
        }
      }, 30000);
      
      // Cleanup on abort
      // Note: This is a simplified version
      setTimeout(() => {
        clearInterval(interval);
        controller.close();
      }, 300000); // Close after 5 minutes for demo
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    }
  });
}
