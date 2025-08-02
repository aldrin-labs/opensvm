import { getConnection } from '@/lib/solana-connection';
import { AnomalyDetectionCapability } from '@/lib/ai/capabilities/anomaly-detection';
import { Connection } from '@solana/web3.js';

// Type definitions for Solana streaming data
interface SlotInfo {
  slot: number;
  parent: number;
  root: number;
}

interface LogsInfo {
  signature: string | null;
  logs: string[];
  err: any;
}

interface LogsContext {
  slot: number;
}

interface StreamingAnomalyDetector {
  start(): Promise<void>;
  stop(): void;
  isRunning(): boolean;
  getStats(): any;
}

class StreamingAnomalyDetectorImpl implements StreamingAnomalyDetector {
  private anomalyDetector: AnomalyDetectionCapability | null = null;
  private connection: Connection | null = null; // Store connection reference for cleanup
  private isActive = false;
  private subscriptionIds: number[] = [];
  private processedSlots = 0;
  private processedTransactions = 0;
  private detectedAnomalies = 0;
  private startTime: number | null = null;
  private lastActivityTime: number | null = null;

  async start(): Promise<void> {
    if (this.isActive) {
      console.log('Streaming anomaly detector already running');
      return;
    }

    try {
      this.connection = await getConnection();
      this.anomalyDetector = new AnomalyDetectionCapability(this.connection);

      // Subscribe to slot changes for block events
      const slotSubscriptionId = this.connection.onSlotChange(async (slotInfo: SlotInfo) => {
        console.log(`Processing slot ${slotInfo.slot} (parent: ${slotInfo.parent}, root: ${slotInfo.root})`);

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
          const alerts = await this.anomalyDetector.processEvent(blockEvent);

          // Track slot processing and anomalies
          this.processedSlots++;
          this.lastActivityTime = Date.now();
          if (alerts.length > 0) {
            this.detectedAnomalies += alerts.length;
            console.log(`🚨 Slot anomalies detected in slot ${slotInfo.slot}:`, alerts.map(a => ({
              type: a.type,
              severity: a.severity,
              description: a.description,
              slotInfo: {
                slot: slotInfo.slot,
                parent: slotInfo.parent,
                root: slotInfo.root
              }
            })));
          }
        }
      });

      this.subscriptionIds.push(slotSubscriptionId);

      // Subscribe to transaction logs
      const logsSubscriptionId = this.connection.onLogs(
        'all',
        async (logs: LogsInfo, context: LogsContext) => {
          if (logs.signature) {
            console.log(`Processing transaction ${logs.signature} in slot ${context.slot}`);

            const transactionEvent = {
              type: 'transaction' as const,
              timestamp: Date.now(),
              data: {
                signature: logs.signature,
                slot: context.slot,
                logs: logs.logs,
                err: logs.err,
                fee: null, // Would need to fetch transaction details for fee
                logCount: logs.logs.length,
                hasError: !!logs.err
              }
            };

            if (this.anomalyDetector) {
              const alerts = await this.anomalyDetector.processEvent(transactionEvent);

              // Track transaction processing and anomalies
              this.processedTransactions++;
              this.lastActivityTime = Date.now();
              if (alerts.length > 0) {
                this.detectedAnomalies += alerts.length;
                console.log(`🚨 Transaction anomalies detected in ${logs.signature}:`, alerts.map(a => ({
                  type: a.type,
                  severity: a.severity,
                  description: a.description,
                  transactionInfo: {
                    signature: logs.signature,
                    slot: context.slot,
                    logCount: logs.logs.length,
                    hasError: !!logs.err,
                    errorDetails: logs.err
                  }
                })));
              }

              // Special handling for error transactions
              if (logs.err) {
                console.warn(`Transaction ${logs.signature} failed with error:`, logs.err);
              }
            }
          }
        },
        'confirmed'
      );

      this.subscriptionIds.push(logsSubscriptionId);
      this.isActive = true;
      this.startTime = Date.now();
      this.lastActivityTime = Date.now();

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
      return {
        error: 'Detector not initialized',
        isActive: false,
        processedSlots: 0,
        processedTransactions: 0,
        detectedAnomalies: 0
      };
    }

    const uptime = this.isActive ? Date.now() - (this.startTime || Date.now()) : 0;
    const slotsPerMinute = this.processedSlots > 0 && uptime > 0 ? (this.processedSlots / (uptime / 60000)) : 0;
    const transactionsPerMinute = this.processedTransactions > 0 && uptime > 0 ? (this.processedTransactions / (uptime / 60000)) : 0;
    const anomalyRate = this.processedTransactions > 0 ? (this.detectedAnomalies / this.processedTransactions * 100) : 0;

    return {
      isActive: this.isActive,
      subscriptions: this.subscriptionIds.length,
      processedSlots: this.processedSlots,
      processedTransactions: this.processedTransactions,
      detectedAnomalies: this.detectedAnomalies,
      uptime: uptime,
      performance: {
        slotsPerMinute: Math.round(slotsPerMinute * 100) / 100,
        transactionsPerMinute: Math.round(transactionsPerMinute * 100) / 100,
        anomalyRate: Math.round(anomalyRate * 100) / 100
      },
      lastActivity: this.lastActivityTime || null
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