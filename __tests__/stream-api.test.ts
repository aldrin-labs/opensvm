import { POST, GET } from '@/app/api/stream/route';
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
    it('should return WebSocket info for non-websocket requests', async () => {
      const request = new NextRequest('http://localhost:3000/api/stream', {
        method: 'GET',
        headers: {
          'upgrade': 'http/1.1'
        }
      });

      const response = await GET(request);
      expect(response.status).toBe(400);
      
      const text = await response.text();
      expect(text).toBe('Expected WebSocket connection');
    });

    it('should handle websocket upgrade request', async () => {
      const request = new NextRequest('http://localhost:3000/api/stream?clientId=test123', {
        method: 'GET',
        headers: {
          'upgrade': 'websocket'
        }
      });

      const response = await GET(request);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.message).toBe('WebSocket endpoint ready');
      expect(data.clientId).toBe('test123');
      expect(data.supportedEvents).toEqual(['transaction', 'block', 'account_change']);
    });

    it('should generate clientId if not provided', async () => {
      const request = new NextRequest('http://localhost:3000/api/stream', {
        method: 'GET',
        headers: {
          'upgrade': 'websocket'
        }
      });

      const response = await GET(request);
      const data = await response.json();
      
      expect(data.clientId).toMatch(/^client_\d+_[a-z0-9]+$/);
    });
  });

  describe('POST /api/stream', () => {
    it('should handle authenticate action', async () => {
      const request = new NextRequest('http://localhost:3000/api/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'authenticate',
          clientId: 'test123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.authToken).toBeDefined();
      expect(data.expiresIn).toBe(3600);
    });

    it('should handle subscribe action with authentication', async () => {
      // First authenticate
      const authRequest = new NextRequest('http://localhost:3000/api/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'authenticate',
          clientId: 'test123'
        })
      });

      const authResponse = await POST(authRequest);
      const authData = await authResponse.json();
      const authToken = authData.authToken;

      // Then subscribe
      const request = new NextRequest('http://localhost:3000/api/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'subscribe',
          clientId: 'test123',
          eventTypes: ['transaction', 'block'],
          authToken
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Subscribed to events');
    });

    it('should handle subscribe action (legacy compatibility)', async () => {
      const request = new NextRequest('http://localhost:3000/api/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'subscribe',
          clientId: 'test123',
          eventTypes: ['transaction', 'block']
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(401); // Should require auth now
      
      const data = await response.json();
      expect(data.error).toBe('Authentication required or failed');
    });

    it('should handle unsubscribe action', async () => {
      const request = new NextRequest('http://localhost:3000/api/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'unsubscribe',
          clientId: 'test123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Unsubscribed from events');
    });

    it('should reject invalid action', async () => {
      const request = new NextRequest('http://localhost:3000/api/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'invalid_action',
          clientId: 'test123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toBe('Invalid action');
    });

    it('should reject invalid event types', async () => {
      const request = new NextRequest('http://localhost:3000/api/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'subscribe',
          clientId: 'test123',
          eventTypes: ['invalid_type']
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toContain('Invalid event types');
    });

    it('should reject subscribe without event types', async () => {
      const request = new NextRequest('http://localhost:3000/api/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'subscribe',
          clientId: 'test123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toBe('Valid event types array is required');
    });

    it('should handle start_monitoring action with auto-authentication', async () => {
      const request = new NextRequest('http://localhost:3000/api/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'start_monitoring',
          clientId: 'test123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Started monitoring');
      expect(data.authToken).toBeDefined();
    });

    it('should handle malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: 'invalid json'
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toBe('Invalid JSON format');
    });

    it('should validate request structure', async () => {
      const request = new NextRequest('http://localhost:3000/api/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          invalidField: 'test'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toBe('Invalid request format');
    });
  });
});