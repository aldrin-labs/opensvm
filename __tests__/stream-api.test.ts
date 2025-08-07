import { POST, GET } from '../app/api/stream/route';
import { NextRequest } from 'next/server';

// Mock the getConnection function
jest.mock('@/lib/solana-connection', () => ({
  getConnection: jest.fn().mockResolvedValue({
    onSlotChange: jest.fn().mockReturnValue(1),
    onLogs: jest.fn().mockReturnValue(2),
    removeSlotChangeListener: jest.fn(),
    removeOnLogsListener: jest.fn(),
    getSignaturesForAddress: jest.fn().mockResolvedValue([])
  })
}));

describe('/api/stream', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('GET /api/stream', () => {
    it('should return API information for non-websocket requests', async () => {
      const request = new NextRequest('http://localhost:3000/api/stream', {
        method: 'GET',
        headers: {
          'upgrade': 'http/1.1'
        }
      });

      const response = await GET(request);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.message).toBe('Blockchain Event Streaming API');
      expect(data.data.streamingMethod).toBe('SSE');
      expect(data.data.supportedEvents).toEqual(['transaction', 'block', 'account_change']);
    });

    it('should handle websocket upgrade request with proper error', async () => {
      const request = new NextRequest('http://localhost:3000/api/stream?clientId=test123', {
        method: 'GET',
        headers: {
          'upgrade': 'websocket',
          'connection': 'upgrade'
        }
      });

      const response = await GET(request);
      expect(response.status).toBe(426); // Upgrade Required
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('WEBSOCKET_NOT_SUPPORTED');
      expect(data.error.message).toBe('WebSocket connections are not supported by this endpoint');
      expect(data.error.details.alternatives.sseEndpoint).toBe('/api/sse-alerts');
    });

    it('should explain websocket not supported without connection header', async () => {
      const request = new NextRequest('http://localhost:3000/api/stream', {
        method: 'GET',
        headers: {
          'upgrade': 'websocket'
        }
      });

      const response = await GET(request);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.message).toBe('Blockchain Event Streaming API');
      expect(data.data.streamingMethod).toBe('SSE');
      expect(data.data.clientId).toMatch(/^client_\d+_[a-z0-9]+$/);
    });
  });

  describe('POST /api/stream', () => {
    it('should handle authenticate action', async () => {
      const bodyData = {
        action: 'authenticate',
        clientId: 'test123'
      };

      // Create a mock request with the json() method mocked
      const request = {
        json: jest.fn().mockResolvedValue(bodyData),
        headers: new Headers({
          'Content-Type': 'application/json'
        }),
        nextUrl: new URL('http://localhost:3000/api/stream')
      } as any as NextRequest;

      const response = await POST(request);
      const data = await response.json();
      
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.authToken).toBeDefined();
      expect(data.data.expiresIn).toBe(3600);
      expect(data.data.message).toBe('Client authenticated');
    });

    it('should handle subscribe action with authentication', async () => {
      // First add a client via start_monitoring (which auto-authenticates)
      const startRequest = {
        json: jest.fn().mockResolvedValue({
          action: 'start_monitoring',
          clientId: 'test123'
        }),
        headers: new Headers({
          'Content-Type': 'application/json'
        }),
        nextUrl: new URL('http://localhost:3000/api/stream')
      } as any as NextRequest;

      const startResponse = await POST(startRequest);
      const startData = await startResponse.json();
      const authToken = startData.data.authToken;

      // Then subscribe
      const request = {
        json: jest.fn().mockResolvedValue({
          action: 'subscribe',
          clientId: 'test123',
          eventTypes: ['transaction', 'block'],
          authToken
        }),
        headers: new Headers({
          'Content-Type': 'application/json'
        }),
        nextUrl: new URL('http://localhost:3000/api/stream')
      } as any as NextRequest;

      const response = await POST(request);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.message).toBe('Subscribed to events');
    });

    it('should handle subscribe action (legacy compatibility)', async () => {
      // Reset EventStreamManager state by removing any existing client
      const { EventStreamManager } = require('../app/api/stream/route');
      EventStreamManager.getInstance().removeClient('test123');

      const request = {
        json: jest.fn().mockResolvedValue({
          action: 'subscribe',
          clientId: 'test123',
          eventTypes: ['transaction', 'block']
        }),
        headers: new Headers({
          'Content-Type': 'application/json'
        }),
        nextUrl: new URL('http://localhost:3000/api/stream')
      } as any as NextRequest;

      const response = await POST(request);
      expect(response.status).toBe(401); // Should require auth now
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.message).toBe('Authentication required or failed');
    });

    it('should handle unsubscribe action', async () => {
      const request = {
        json: jest.fn().mockResolvedValue({
          action: 'unsubscribe',
          clientId: 'test123'
        }),
        headers: new Headers({
          'Content-Type': 'application/json'
        }),
        nextUrl: new URL('http://localhost:3000/api/stream')
      } as any as NextRequest;

      const response = await POST(request);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.message).toBe('Unsubscribed from events');
    });

    it('should reject invalid action', async () => {
      const request = {
        json: jest.fn().mockResolvedValue({
          action: 'invalid_action',
          clientId: 'test123'
        }),
        headers: new Headers({
          'Content-Type': 'application/json'
        }),
        nextUrl: new URL('http://localhost:3000/api/stream')
      } as any as NextRequest;

      const response = await POST(request);
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('Invalid action');
    });

    it('should reject invalid event types', async () => {
      const request = {
        json: jest.fn().mockResolvedValue({
          action: 'subscribe',
          clientId: 'test123',
          eventTypes: ['invalid_type']
        }),
        headers: new Headers({
          'Content-Type': 'application/json'
        }),
        nextUrl: new URL('http://localhost:3000/api/stream')
      } as any as NextRequest;

      const response = await POST(request);
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('Invalid event types');
    });

    it('should reject subscribe without event types', async () => {
      const request = {
        json: jest.fn().mockResolvedValue({
          action: 'subscribe',
          clientId: 'test123'
        }),
        headers: new Headers({
          'Content-Type': 'application/json'
        }),
        nextUrl: new URL('http://localhost:3000/api/stream')
      } as any as NextRequest;

      const response = await POST(request);
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.message).toBe('Valid event types array is required');
    });

    it('should handle start_monitoring action with auto-authentication', async () => {
      const request = {
        json: jest.fn().mockResolvedValue({
          action: 'start_monitoring',
          clientId: 'test123'
        }),
        headers: new Headers({
          'Content-Type': 'application/json'
        }),
        nextUrl: new URL('http://localhost:3000/api/stream')
      } as any as NextRequest;

      const response = await POST(request);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.message).toBe('Started monitoring');
      expect(data.data.authToken).toBeDefined();
    });

    it('should handle malformed JSON', async () => {
      const request = {
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
        headers: new Headers({
          'Content-Type': 'application/json'
        }),
        nextUrl: new URL('http://localhost:3000/api/stream')
      } as any as NextRequest;

      const response = await POST(request);
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.message).toBe('Invalid JSON in request body');
    });

    it('should validate request structure', async () => {
      const request = {
        json: jest.fn().mockResolvedValue({
          invalidField: 'test'
        }),
        headers: new Headers({
          'Content-Type': 'application/json'
        }),
        nextUrl: new URL('http://localhost:3000/api/stream')
      } as any as NextRequest;

      const response = await POST(request);
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.message).toBe('Invalid request format');
    });
  });
});