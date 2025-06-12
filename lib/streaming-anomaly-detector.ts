import { getConnection } from '@/lib/solana-connection';
import { AnomalyDetectionCapability } from '@/lib/ai/capabilities/anomaly-detection';

interface StreamingAnomalyDetector {
  start(): Promise<void>;
  stop(): void;
  isRunning(): boolean;
  getStats(): any;
}

class StreamingAnomalyDetectorImpl implements StreamingAnomalyDetector {
  private anomalyDetector: AnomalyDetectionCapability | null = null;
  private isActive = false;
  private subscriptionIds: number[] = [];

  async start(): Promise<void> {
    if (this.isActive) {
      console.log('Streaming anomaly detector already running');
      return;
    }

    try {
      const connection = await getConnection();
      this.anomalyDetector = new AnomalyDetectionCapability(connection);
      
      // Subscribe to slot changes for block events
      const slotSubscriptionId = connection.onSlotChange(async (slotInfo) => {
        const blockEvent = {
          type: 'block' as const,
          timestamp: Date.now(),
          data: {
            slot: slotInfo.slot,
            parent: slotInfo.parent,
            root: slotInfo.root
          }
        };
        
        if (this.anomalyDetector) {
          await this.anomalyDetector.processEvent(blockEvent);
        }
      });
      
      this.subscriptionIds.push(slotSubscriptionId);
      
      // Subscribe to transaction logs
      const logsSubscriptionId = connection.onLogs(
        'all',
        async (logs, context) => {
          if (logs.signature) {
            const transactionEvent = {
              type: 'transaction' as const,
              timestamp: Date.now(),
              data: {
                signature: logs.signature,
                slot: context.slot,
                logs: logs.logs,
                err: logs.err,
                fee: null // Would need to fetch transaction details for fee
              }
            };
            
            if (this.anomalyDetector) {
              const alerts = await this.anomalyDetector.processEvent(transactionEvent);
              
              // Log any anomalies detected
              if (alerts.length > 0) {
                console.log(`🚨 Anomalies detected:`, alerts.map(a => ({
                  type: a.type,
                  severity: a.severity,
                  description: a.description
                })));
              }
            }
          }
        },
        'confirmed'
      );
      
      this.subscriptionIds.push(logsSubscriptionId);
      this.isActive = true;
      
      console.log('✅ Streaming anomaly detector started');
    } catch (error) {
      console.error('Failed to start streaming anomaly detector:', error);
      throw error;
    }
  }

  stop(): void {
    if (!this.isActive) {
      return;
    }

    // Remove subscriptions would go here
    // Note: The current Connection interface doesn't provide remove methods
    // This would need to be implemented based on the actual WebSocket connection
    
    this.subscriptionIds = [];
    this.isActive = false;
    
    console.log('⏹️ Streaming anomaly detector stopped');
  }

  isRunning(): boolean {
    return this.isActive;
  }

  getStats(): any {
    if (!this.anomalyDetector) {
      return { error: 'Detector not initialized' };
    }

    return {
      isActive: this.isActive,
      subscriptions: this.subscriptionIds.length,
      // Additional stats would be available from the anomaly detector
    };
  }
}

// Singleton instance
let detectorInstance: StreamingAnomalyDetectorImpl | null = null;

export function getStreamingAnomalyDetector(): StreamingAnomalyDetector {
  if (!detectorInstance) {
    detectorInstance = new StreamingAnomalyDetectorImpl();
  }
  return detectorInstance;
}

// Utility function to start monitoring
export async function startAnomalyMonitoring(): Promise<void> {
  const detector = getStreamingAnomalyDetector();
  await detector.start();
}

// Utility function to stop monitoring
export function stopAnomalyMonitoring(): void {
  const detector = getStreamingAnomalyDetector();
  detector.stop();
}