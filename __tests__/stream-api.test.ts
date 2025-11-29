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

// Create mocked EventStreamManager with controllable behavior
const mockSubscribeToEvents = jest.fn(() => Promise.resolve(true));
const mockEventStreamManager = {
  getStatus: jest.fn(() => ({ clients: 0, active: true })),
  subscribeToEvents: mockSubscribeToEvents,
  removeClient: jest.fn()
};

jest.mock('@/lib/api/event-stream-manager', () => ({
  EventStreamManager: {
    getInstance: jest.fn(() => mockEventStreamManager)
  }
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
    it('should handle subscribe action with valid request', async () => {
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
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.message).toBe('Successfully subscribed');
      expect(data.data.clientId).toBe('test123');
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
      expect(data.data.message).toBe('Successfully unsubscribed');
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
      expect(data.error.message).toBe('Invalid action');
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
      // Implementation treats undefined action as invalid action
      expect(data.error.message).toBe('Invalid action');
    });

    it('should handle subscription failure gracefully', async () => {
      // Mock subscription to fail
      mockSubscribeToEvents.mockResolvedValueOnce(false);

      const request = {
        json: jest.fn().mockResolvedValue({
          action: 'subscribe',
          clientId: 'test123',
          eventTypes: ['transaction']
        }),
        headers: new Headers({
          'Content-Type': 'application/json'
        }),
        nextUrl: new URL('http://localhost:3000/api/stream')
      } as any as NextRequest;

      const response = await POST(request);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.message).toBe('Subscription failed');
    });
  });
});
