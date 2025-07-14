import { Connection } from '@solana/web3.js';
import { BaseCapability } from './base';
import type { Message, Tool, ToolParams } from '../types';
import { 
  getAllPatterns, 
  calculateSeverity, 
  AnomalyStatistics,
  type AnomalyPattern, 
  type AnomalyContext 
} from '@/lib/anomaly-patterns';
import { SSEManager } from '@/lib/sse-manager';
import { generateSecureUUID } from '@/lib/crypto-utils';
import { RingBuffer } from '@/lib/utils/ring-buffer';
import { getAnomalyPatternManager, loadAnomalyPatterns } from '@/lib/configurable-anomaly-patterns';

interface AnomalyAlert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  event: any;
  context: AnomalyContext;
  timestamp: number;
  confidence?: number;
  category?: string;
}

export class AnomalyDetectionCapability extends BaseCapability {
  type = 'anomaly_detection' as const;
  private patterns: AnomalyPattern[] = [];
  private recentEvents: RingBuffer<any>;
  private alerts: RingBuffer<AnomalyAlert>;
  private maxEventHistory = 1000;
  private maxAlertHistory = 100;
  public tools: Tool[] = this.createTools(); // Initialize directly here

  constructor(connection: Connection) {
    super(connection);
    this.recentEvents = new RingBuffer<any>(this.maxEventHistory);
    this.alerts = new RingBuffer<AnomalyAlert>(this.maxAlertHistory);
    this.initializePatterns(); // Now async but fire-and-forget
  }

  canHandle(message: Message): boolean {
    const content = message.content.toLowerCase();
    return content.includes('anomaly') || 
           content.includes('suspicious') ||
           content.includes('abnormal') ||
           content.includes('unusual') ||
           content.includes('detect') ||
           content.includes('alert') ||
           content.includes('monitor');
  }

  private async initializePatterns(): Promise<void> {
    try {
      // Try to load configurable patterns first
      const remoteConfigUrl = process.env.ANOMALY_PATTERNS_CONFIG_URL;
      this.patterns = await loadAnomalyPatterns(remoteConfigUrl);
      console.log(`Loaded ${this.patterns.length} configurable anomaly detection patterns`);
    } catch (error) {
      console.warn('Failed to load configurable patterns, falling back to static patterns:', error);
      // Fallback to static patterns
      this.patterns = getAllPatterns();
      console.log(`Loaded ${this.patterns.length} static anomaly detection patterns`);
    }
  }

  private createTools(): Tool[] {
    return [
      this.createToolExecutor(
        'analyzeEvent',
        'Analyze a blockchain event for anomalies',
        this.analyzeEvent.bind(this)
      ),
      this.createToolExecutor(
        'getAnomalyAlerts',
        'Get recent anomaly alerts',
        this.getAnomalyAlerts.bind(this)
      ),
      this.createToolExecutor(
        'getAnomalyStats',
        'Get anomaly detection statistics',
        this.getAnomalyStats.bind(this)
      ),
      this.createToolExecutor(
        'configureDetection',
        'Configure anomaly detection parameters',
        this.configureDetection.bind(this)
      ),
      this.createToolExecutor(
        'getPatternConfiguration',
        'Get current anomaly pattern configuration',
        this.getPatternConfiguration.bind(this)
      )
    ];
  }

  // Runtime validation for event data
  private validateEventData(event: any): boolean {
    if (!event || typeof event !== 'object') return false;
    if (typeof event.type !== 'string') return false;
    if (typeof event.timestamp !== 'number') return false;
    if (!event.data || typeof event.data !== 'object') return false;
    return true;
  }

  // Safe pattern check with validation
  private async safePatternCheck(pattern: AnomalyPattern, event: any, context: AnomalyContext): Promise<boolean> {
    try {
      // Validate event structure first
      if (!this.validateEventData(event)) {
        console.warn(`Invalid event data for pattern ${pattern.type}`);
        return false;
      }

      // Validate context
      if (!context || typeof context !== 'object') {
        console.warn(`Invalid context for pattern ${pattern.type}`);
        return false;
      }

      return pattern.check(event, context);
    } catch (error) {
      console.error(`Error checking pattern ${pattern.type}:`, error);
      return false;
    }
  }

  public async processEvent(event: any): Promise<AnomalyAlert[]> {
    // Validate event before processing
    if (!this.validateEventData(event)) {
      console.warn('Received invalid event data, skipping processing');
      return [];
    }

    // Add event to ring buffer (now synchronous)
    this.recentEvents.push(event);

    // Create context for analysis
    const context = await this.createContext();
    
    // Check for anomalies with safe pattern checking
    const alerts: AnomalyAlert[] = [];
    
    for (const pattern of this.patterns) {
      const isAnomaly = await this.safePatternCheck(pattern, event, context);
      if (isAnomaly) {
        const alert = this.createAlert(pattern, event, context);
        alerts.push(alert);
        this.alerts.push(alert); // Now synchronous
        
        // Push alert via SSE for real-time updates
        try {
          const sseManager = SSEManager.getInstance();
          sseManager.broadcastAnomalyAlert(alert);
        } catch (sseError) {
          console.error('Failed to broadcast alert via SSE:', sseError);
        }
      }
    }

    return alerts;
  }

  private async createContext(): Promise<AnomalyContext> {
    const now = Date.now();
    const recentWindow = 5 * 60 * 1000; // 5 minutes
    const recentEvents = this.recentEvents.toArray().filter(e => e.timestamp > now - recentWindow);
    
    const transactionEvents = recentEvents.filter(e => e.type === 'transaction');
    const failedTransactions = transactionEvents.filter(e => e.data.err !== null);
    
    // Enhanced statistical calculations
    const fees = transactionEvents
      .map(t => t.data.fee)
      .filter(fee => typeof fee === 'number' && fee > 0);
    
    const feeStatistics = this.calculateFeeStatistics(fees);
    const transactionStatistics = this.calculateTransactionStatistics(transactionEvents);
    const baselineData = await this.getBaselineData();
    
    return {
      recentEvents,
      transactionVolume: transactionEvents.length,
      averageFees: this.calculateAverageFees(transactionEvents),
      errorRate: transactionEvents.length > 0 ? failedTransactions.length / transactionEvents.length : 0,
      timestamp: now,
      timeWindowMs: recentWindow,
      feeStatistics,
      transactionStatistics,
      baselineData
    };
  }

  private calculateFeeStatistics(fees: number[]) {
    if (fees.length === 0) {
      return {
        mean: 0,
        median: 0,
        stdDev: 0,
        percentiles: { p95: 0, p99: 0 },
        movingAverage: 0
      };
    }

    const mean = AnomalyStatistics.calculateMean(fees);
    const median = AnomalyStatistics.calculateMedian(fees);
    const stdDev = AnomalyStatistics.calculateStdDev(fees, mean);
    const p95 = AnomalyStatistics.calculatePercentile(fees, 95);
    const p99 = AnomalyStatistics.calculatePercentile(fees, 99);
    const movingAverage = AnomalyStatistics.calculateMovingAverage(fees, 20);

    return {
      mean,
      median,
      stdDev,
      percentiles: { p95, p99 },
      movingAverage
    };
  }

  private calculateTransactionStatistics(transactions: any[]) {
    const volumes = this.getVolumeTimeSeries(transactions);
    const volumeMovingAverage = AnomalyStatistics.calculateMovingAverage(volumes, 10);
    const volumeStdDev = AnomalyStatistics.calculateStdDev(volumes);
    
    // Calculate transaction intervals for timing analysis
    const timestamps = transactions.map(t => t.timestamp).sort((a, b) => a - b);
    const intervals = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i-1]);
    }
    
    const intervalMean = AnomalyStatistics.calculateMean(intervals);
    const intervalStdDev = AnomalyStatistics.calculateStdDev(intervals, intervalMean);
    
    return {
      volumeMovingAverage,
      volumeStdDev,
      intervalStatistics: {
        mean: intervalMean,
        stdDev: intervalStdDev,
        outlierThreshold: intervalMean + (3 * intervalStdDev)
      }
    };
  }

  private getVolumeTimeSeries(transactions: any[], bucketSizeMs: number = 30000): number[] {
    if (transactions.length === 0) return [];
    
    const now = Date.now();
    const buckets: number[] = [];
    const numBuckets = 20; // 20 buckets for time series
    
    for (let i = 0; i < numBuckets; i++) {
      const bucketEnd = now - (i * bucketSizeMs);
      const bucketStart = bucketEnd - bucketSizeMs;
      
      const bucketCount = transactions.filter(t => 
        t.timestamp >= bucketStart && t.timestamp < bucketEnd
      ).length;
      
      buckets.unshift(bucketCount);
    }
    
    return buckets;
  }

  private async getBaselineData() {
    // Simple baseline calculation from recent history
    // In production, this would come from a database or cache
    const allEvents = this.recentEvents.toArray();
    const historicalTxs = allEvents.filter(e => e.type === 'transaction');
    
    if (historicalTxs.length < 50) {
      return {
        historicalAverageFees: 0,
        historicalVolumeAverage: 0,
        historicalErrorRate: 0,
        dataPoints: 0,
        lastUpdated: Date.now()
      };
    }
    
    const historicalFees = historicalTxs
      .map(t => t.data.fee)
      .filter(fee => typeof fee === 'number' && fee > 0);
    
    const historicalFailures = historicalTxs.filter(t => t.data.err !== null);
    
    return {
      historicalAverageFees: AnomalyStatistics.calculateMean(historicalFees),
      historicalVolumeAverage: historicalTxs.length / 20, // Average per time bucket
      historicalErrorRate: historicalFailures.length / historicalTxs.length,
      dataPoints: historicalTxs.length,
      lastUpdated: Date.now()
    };
  }

  private calculateAverageFees(transactions: any[]): number {
    if (transactions.length === 0) return 0;
    
    const validFees = transactions
      .map(t => t.data.fee)
      .filter(fee => typeof fee === 'number' && fee > 0);
    
    if (validFees.length === 0) return 0;
    
    return validFees.reduce((sum, fee) => sum + fee, 0) / validFees.length;
  }

  private createAlert(pattern: AnomalyPattern, event: any, context: AnomalyContext): AnomalyAlert {
    // Use unified severity calculation from externalized patterns
    const confidence = pattern.metadata?.confidence || 1.0;
    const severity = calculateSeverity(pattern, event, context, confidence);
    
    return {
      id: generateSecureUUID(),
      type: pattern.type,
      severity,
      description: pattern.description,
      event,
      context,
      timestamp: Date.now(),
      confidence,
      category: pattern.category
    };
  }

  private async analyzeEvent(params: ToolParams): Promise<any> {
    const { message } = params;
    
    try {
      // Extract event data from message content
      const eventData = this.extractEventFromMessage(message.content);
      if (!eventData) {
        return { error: 'No event data found in message' };
      }

      const alerts = await this.processEvent(eventData);
      
      return {
        analyzed: true,
        event: eventData,
        alerts,
        summary: alerts.length > 0 
          ? `Detected ${alerts.length} anomalies: ${alerts.map(a => a.type).join(', ')}`
          : 'No anomalies detected'
      };
    } catch (error) {
      console.error('Error analyzing event:', error);
      return { error: 'Failed to analyze event' };
    }
  }

  public async getAnomalyAlerts(): Promise<any> {
    const allAlerts = this.alerts.toArray();
    const recentAlerts = allAlerts
      .filter(alert => alert.timestamp > Date.now() - (24 * 60 * 60 * 1000)) // Last 24 hours
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 50); // Limit to 50 most recent

    const stats = {
      total: recentAlerts.length,
      bySeverity: {
        critical: recentAlerts.filter(a => a.severity === 'critical').length,
        high: recentAlerts.filter(a => a.severity === 'high').length,
        medium: recentAlerts.filter(a => a.severity === 'medium').length,
        low: recentAlerts.filter(a => a.severity === 'low').length,
      },
      byType: recentAlerts.reduce((acc, alert) => {
        acc[alert.type] = (acc[alert.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    return {
      alerts: recentAlerts,
      stats
    };
  }

  public async getAnomalyStats(): Promise<any> {
    const now = Date.now();
    const periods = [
      { name: '1h', duration: 60 * 60 * 1000 },
      { name: '6h', duration: 6 * 60 * 60 * 1000 },
      { name: '24h', duration: 24 * 60 * 60 * 1000 }
    ];

    const allAlerts = this.alerts.toArray();
    const stats = periods.map(period => {
      const alerts = allAlerts.filter(alert => alert.timestamp > now - period.duration);
      return {
        period: period.name,
        total: alerts.length,
        critical: alerts.filter(a => a.severity === 'critical').length,
        high: alerts.filter(a => a.severity === 'high').length,
        medium: alerts.filter(a => a.severity === 'medium').length,
        low: alerts.filter(a => a.severity === 'low').length,
      };
    });

    return {
      stats,
      patterns: this.patterns.map(p => ({
        type: p.type,
        description: p.description,
        threshold: p.threshold
      })),
      systemHealth: {
        eventHistorySize: this.recentEvents.size,
        alertHistorySize: this.alerts.size,
        activePatterns: this.patterns.length
      }
    };
  }

  private async configureDetection(params: ToolParams): Promise<any> {
    // Enhanced configuration with pattern manager support
    const manager = getAnomalyPatternManager();
    const configInfo = manager.getConfigurationInfo();
    
    return {
      message: 'Anomaly detection configuration',
      patterns: this.patterns.length,
      maxEventHistory: this.maxEventHistory,
      maxAlertHistory: this.maxAlertHistory,
      patternConfiguration: configInfo
    };
  }

  private async getPatternConfiguration(params: ToolParams): Promise<any> {
    const manager = getAnomalyPatternManager();
    const configInfo = manager.getConfigurationInfo();
    const enabledPatterns = manager.getEnabledPatterns();
    
    return {
      message: 'Current anomaly pattern configuration',
      configuration: configInfo,
      enabledPatterns: enabledPatterns.map(p => ({
        type: p.type,
        description: p.description,
        severity: p.severity,
        category: p.category,
        threshold: p.threshold
      }))
    };
  }

  private extractEventFromMessage(content: string): any | null {
    try {
      // Try to parse JSON from the message
      const jsonMatch = content.match(/\{.*\}/s);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Try to extract signature for transaction lookup
      const sigMatch = content.match(/signature:\s*([A-Za-z0-9]{88,})/);
      if (sigMatch) {
        return {
          type: 'transaction',
          data: { signature: sigMatch[1] },
          timestamp: Date.now()
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting event from message:', error);
      return null;
    }
  }
}
