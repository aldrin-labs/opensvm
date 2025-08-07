import { AnomalyDetectionCapability } from '@/lib/ai/capabilities/anomaly-detection';
import { Connection } from '@solana/web3.js';

// Mock connection for testing
const mockConnection = {
  getBlockHeight: jest.fn().mockResolvedValue(100),
  rpcEndpoint: 'mock://test'
} as unknown as Connection;

describe('AnomalyDetectionCapability', () => {
  let anomalyDetector: AnomalyDetectionCapability;

  beforeEach(async () => {
    anomalyDetector = new AnomalyDetectionCapability(mockConnection);
    // Wait a bit for async pattern initialization
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Mock some basic patterns for testing
    (anomalyDetector as any).patterns = [
      {
        type: 'high_failure_rate',
        description: 'High transaction failure rate detected',
        category: 'transaction',
        severity: 'critical',
        threshold: { failureRate: 0.5, timeWindow: 60000 },
        check: (event: any, context: any) => {
          return context.errorRate > 0.5;
        },
        metadata: { confidence: 0.9 }
      },
      {
        type: 'suspicious_fee_spike',
        description: 'Unusual fee spike detected',
        category: 'transaction',
        severity: 'high',
        threshold: { feeMultiplier: 3 },
        check: (event: any, context: any) => {
          const eventFee = event.data?.fee || 0;
          const avgFee = context.averageFees || 0;
          return eventFee > avgFee * 3;
        },
        metadata: { confidence: 0.8 }
      }
    ];
  });

  it('should initialize with default patterns', () => {
    expect(anomalyDetector.type).toBe('anomaly_detection');
    expect(anomalyDetector.tools).toHaveLength(5);
  });

  it('should handle anomaly detection messages', () => {
    const message = { role: 'user' as const, content: 'detect anomaly in this transaction' };
    expect(anomalyDetector.canHandle(message)).toBe(true);
  });

  it('should not handle non-anomaly messages', () => {
    const message = { role: 'user' as const, content: 'what is the weather today' };
    expect(anomalyDetector.canHandle(message)).toBe(false);
  });

  it('should process transaction events', async () => {
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

    const alerts = await anomalyDetector.processEvent(event);
    expect(Array.isArray(alerts)).toBe(true);
  });

  it('should detect high failure rate anomaly', async () => {
    // Create multiple failed transactions to trigger high failure rate
    const failedEvents = Array.from({ length: 10 }, (_, i) => ({
      type: 'transaction',
      timestamp: Date.now() - i * 1000,
      data: {
        signature: `failed_tx_${i}`,
        fee: 5000,
        logs: ['Program log: failed'],
        err: 'Transaction failed'
      }
    }));

    // Process failed events
    for (const event of failedEvents) {
      await anomalyDetector.processEvent(event);
    }

    // Process one more event that should trigger the anomaly
    const triggerEvent = {
      type: 'transaction',
      timestamp: Date.now(),
      data: {
        signature: 'trigger_tx',
        fee: 5000,
        logs: ['Program log: failed'],
        err: 'Transaction failed'
      }
    };

    const alerts = await anomalyDetector.processEvent(triggerEvent);
    
    // Should detect high failure rate
    const failureAlert = alerts.find(alert => alert.type === 'high_failure_rate');
    expect(failureAlert).toBeDefined();
    if (failureAlert) {
      expect(failureAlert.severity).toBe('critical');
    }
  });

  it('should detect suspicious fee spike', async () => {
    // First, establish a baseline with normal fees
    const normalEvents = Array.from({ length: 5 }, (_, i) => ({
      type: 'transaction',
      timestamp: Date.now() - i * 1000,
      data: {
        signature: `normal_tx_${i}`,
        fee: 5000, // Normal fee
        logs: ['Program log: success'],
        err: null
      }
    }));

    for (const event of normalEvents) {
      await anomalyDetector.processEvent(event);
    }

    // Now send a transaction with extremely high fee
    const highFeeEvent = {
      type: 'transaction',
      timestamp: Date.now(),
      data: {
        signature: 'high_fee_tx',
        fee: 50000, // 10x normal fee
        logs: ['Program log: success'],
        err: null
      }
    };

    const alerts = await anomalyDetector.processEvent(highFeeEvent);
    
    // Should detect fee spike
    const feeAlert = alerts.find(alert => alert.type === 'suspicious_fee_spike');
    expect(feeAlert).toBeDefined();
    if (feeAlert) {
      expect(feeAlert.severity).toBe('high');
    }
  });

  it('should provide anomaly statistics via tool', async () => {
    const toolParams = {
      message: { role: 'user' as const, content: 'get anomaly statistics' },
      context: { messages: [] }
    };

    // Find the getAnomalyStats tool from the public tools array
    const statsTool = anomalyDetector.tools.find(tool => tool.name === 'getAnomalyStats');
    expect(statsTool).toBeDefined();
    
    if (statsTool) {
      const response = await statsTool.execute(toolParams);
      
      expect(response).toBeDefined();
      expect(response.stats).toBeDefined();
      expect(response.patterns).toBeDefined();
      expect(response.systemHealth).toBeDefined();
      expect(Array.isArray(response.stats)).toBe(true);
      expect(Array.isArray(response.patterns)).toBe(true);
    }
  });

  it('should handle malformed events gracefully', async () => {
    const malformedEvent = {
      type: 'unknown',
      timestamp: 'invalid',
      data: null
    };

    // Should not throw an error
    const alerts = await anomalyDetector.processEvent(malformedEvent);
    expect(Array.isArray(alerts)).toBe(true);
  });
});
