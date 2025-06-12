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
  private connection: any = null; // Store connection reference for cleanup
  private isActive = false;
  private subscriptionIds: number[] = [];

  async start(): Promise<void> {
    if (this.isActive) {
      console.log('Streaming anomaly detector already running');
      return;
    }

    try {
      this.connection = await getConnection();
      this.anomalyDetector = new AnomalyDetectionCapability(this.connection);
      
      // Subscribe to slot changes for block events
      const slotSubscriptionId = this.connection.onSlotChange(async (slotInfo) => {
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
      const logsSubscriptionId = this.connection.onLogs(
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

    // Remove subscriptions properly
    if (this.subscriptionIds.length > 0) {
      try {
        if (this.connection) {
          // Remove slot change listener (first subscription)
          if (this.subscriptionIds[0]) {
            this.connection.removeSlotChangeListener(this.subscriptionIds[0]);
          }
          // Remove logs listener (second subscription)
          if (this.subscriptionIds[1]) {
            this.connection.removeOnLogsListener(this.subscriptionIds[1]);
          }
        }
      } catch (error) {
        console.error('Failed to remove subscriptions:', error);
      }
    }
    
    this.subscriptionIds = [];
    this.isActive = false;
    this.anomalyDetector = null;
    this.connection = null;
    
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