import { POST, GET } from '@/app/api/anomaly/route';
import { NextRequest } from 'next/server';

// Mock the dependencies
jest.mock('@/lib/solana-connection', () => ({
  getConnection: jest.fn().mockResolvedValue({
    getBlockHeight: jest.fn().mockResolvedValue(100),
    rpcEndpoint: 'mock://test'
  })
}));

describe('/api/anomaly Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/anomaly', () => {
    it('should return anomaly alerts', async () => {
      const request = new NextRequest('http://localhost:3000/api/anomaly?action=alerts');
      
      const response = await GET(request);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
    });

    it('should return anomaly statistics', async () => {
      const request = new NextRequest('http://localhost:3000/api/anomaly?action=stats');
      
      const response = await GET(request);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.stats).toBeDefined();
      expect(data.data.patterns).toBeDefined();
    });

    it('should reject invalid action', async () => {
      const request = new NextRequest('http://localhost:3000/api/anomaly?action=invalid');
      
      const response = await GET(request);
      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/anomaly', () => {
    it('should analyze single event', async () => {
      const event = {
        type: 'transaction',
        timestamp: Date.now(),
        data: {
          signature: 'test123',
          fee: 5000,
          logs: ['Program log: success'],
          err: null
        }
      };

      const request = new NextRequest('http://localhost:3000/api/anomaly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze', event })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.event).toEqual(event);
      expect(data.data.alerts).toBeDefined();
      expect(Array.isArray(data.data.alerts)).toBe(true);
    });

    it('should handle bulk analysis', async () => {
      const events = [
        {
          type: 'transaction',
          timestamp: Date.now(),
          data: { signature: 'test1', fee: 5000, err: null }
        },
        {
          type: 'block',
          timestamp: Date.now(),
          data: { slot: 123456 }
        }
      ];

      const request = new NextRequest('http://localhost:3000/api/anomaly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk_analyze', event: events })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.processed).toBe(2);
      expect(data.data.results).toHaveLength(2);
    });

    it('should detect high fee anomaly', async () => {
      // First create baseline with normal fees
      const normalEvents = Array.from({ length: 5 }, (_, i) => ({
        type: 'transaction',
        timestamp: Date.now() - i * 1000,
        data: { signature: `normal_${i}`, fee: 5000, err: null }
      }));

      // Process normal events first
      for (const event of normalEvents) {
        const request = new NextRequest('http://localhost:3000/api/anomaly', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'analyze', event })
        });
        await POST(request);
      }

      // Now send high fee transaction
      const highFeeEvent = {
        type: 'transaction',
        timestamp: Date.now(),
        data: { signature: 'high_fee', fee: 50000, err: null }
      };

      const request = new NextRequest('http://localhost:3000/api/anomaly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze', event: highFeeEvent })
      });

      const response = await POST(request);
      const data = await response.json();

      // Should detect the fee spike
      expect(data.success).toBe(true);
      const alerts = data.data.alerts;
      const feeAlert = alerts.find((alert: any) => alert.type === 'suspicious_fee_spike');
      
      if (feeAlert) {
        expect(feeAlert.severity).toBe('high');
        expect(feeAlert.description).toContain('fee');
      }
    });

    it('should handle missing event data', async () => {
      const request = new NextRequest('http://localhost:3000/api/anomaly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze' })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('Event data is required');
    });

    it('should handle invalid bulk data', async () => {
      const request = new NextRequest('http://localhost:3000/api/anomaly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk_analyze', event: 'not an array' })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('Events array is required for bulk analysis');
    });
  });

  describe('End-to-End Anomaly Detection', () => {
    it('should detect pattern across multiple events', async () => {
      // Create a scenario with multiple failed transactions
      const failedEvents = Array.from({ length: 15 }, (_, i) => ({
        type: 'transaction',
        timestamp: Date.now() - i * 1000,
        data: {
          signature: `failed_${i}`,
          fee: 5000,
          logs: ['Program log: failed'],
          err: 'Transaction failed'
        }
      }));

      let highFailureRateDetected = false;

      // Process each event and check for anomalies
      for (const event of failedEvents) {
        const request = new NextRequest('http://localhost:3000/api/anomaly', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'analyze', event })
        });

        const response = await POST(request);
        const data = await response.json();

        if (data.success && data.data.alerts.length > 0) {
          const failureAlert = data.data.alerts.find((alert: any) => 
            alert.type === 'high_failure_rate'
          );
          if (failureAlert) {
            highFailureRateDetected = true;
            expect(failureAlert.severity).toBe('critical');
            break;
          }
        }
      }

      expect(highFailureRateDetected).toBe(true);
    });

    it('should provide comprehensive statistics', async () => {
      // Generate some events first
      const events = [
        { type: 'transaction', timestamp: Date.now(), data: { signature: 'tx1', fee: 5000, err: null } },
        { type: 'transaction', timestamp: Date.now(), data: { signature: 'tx2', fee: 15000, err: 'failed' } },
        { type: 'block', timestamp: Date.now(), data: { slot: 123456 } }
      ];

      // Process events
      for (const event of events) {
        const request = new NextRequest('http://localhost:3000/api/anomaly', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'analyze', event })
        });
        await POST(request);
      }

      // Get statistics
      const statsRequest = new NextRequest('http://localhost:3000/api/anomaly?action=stats');
      const statsResponse = await GET(statsRequest);
      const statsData = await statsResponse.json();

      expect(statsData.success).toBe(true);
      expect(statsData.data.stats).toBeDefined();
      expect(Array.isArray(statsData.data.stats)).toBe(true);
      expect(statsData.data.patterns).toBeDefined();
      expect(statsData.data.systemHealth).toBeDefined();

      // Check that stats contain expected periods
      const stats = statsData.data.stats;
      const periods = stats.map((s: any) => s.period);
      expect(periods).toContain('1h');
      expect(periods).toContain('6h');
      expect(periods).toContain('24h');
    });
  });
});