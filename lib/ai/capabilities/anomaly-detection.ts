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

  constructor(connection?: Connection | null) {
    // Provide a default connection if none provided
    if (!connection) {
      throw new Error('AnomalyDetectionCapability requires a valid Connection instance');
    }
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
      console.log(`✅ Loaded ${this.patterns.length} configurable anomaly detection patterns from config`);
      
      // DEBUG: Log transaction_failure_burst pattern status
      const failureBurstPattern = this.patterns.find(p => p.type === 'transaction_failure_burst');
      console.log(`🐛 DEBUG: transaction_failure_burst pattern:`, {
        found: !!failureBurstPattern,
        threshold: failureBurstPattern?.threshold,
        description: failureBurstPattern?.description,
        source: 'configurable_patterns'
      });
    } catch (error) {
      console.warn('❌ Failed to load configurable patterns, falling back to static patterns:', error);
      // Fallback to static patterns
      this.patterns = getAllPatterns();
      console.log(`⚠️ Loaded ${this.patterns.length} static anomaly detection patterns as fallback`);
      
      // DEBUG: Log transaction_failure_burst pattern status from fallback
      const failureBurstPattern = this.patterns.find(p => p.type === 'transaction_failure_burst');
      console.log(`🐛 DEBUG: transaction_failure_burst pattern (fallback):`, {
        found: !!failureBurstPattern,
        threshold: failureBurstPattern?.threshold,
        description: failureBurstPattern?.description,
        source: 'static_patterns'
      });
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

        // DEBUG: Log when transaction_failure_burst is triggered
        if (pattern.type === 'transaction_failure_burst') {
          console.log(`🚨 DEBUG: transaction_failure_burst triggered for event:`, {
            eventType: event.type,
            signature: event.data?.signature,
            hasError: event.data?.hasError,
            logCount: event.data?.logCount,
            contextErrorRate: context.errorRate,
            threshold: pattern.threshold,
            contextStats: {
              totalRecentTxs: context.recentEvents.filter(e => e.type === 'transaction').length,
              totalFailedTxs: context.recentEvents.filter(e => e.type === 'transaction' && e.data?.err !== null).length
            }
          });
        }

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

    const errorRate = transactionEvents.length > 0 ? failedTransactions.length / transactionEvents.length : 0;

    // DEBUG: Log context creation details
    console.log(`🐛 DEBUG: Context created - Total txs: ${transactionEvents.length}, Failed: ${failedTransactions.length}, Error rate: ${errorRate.toFixed(3)} (${(errorRate * 100).toFixed(1)}%)`);

    return {
      recentEvents,
      transactionVolume: transactionEvents.length,
      averageFees: this.calculateAverageFees(transactionEvents),
      errorRate,
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
      intervals.push(timestamps[i] - timestamps[i - 1]);
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

    // Extract configuration options from message content or context
    const messageContent = params.message.content.toLowerCase();
    const sensitivity = this.extractConfigValue(messageContent, 'sensitivity') || 'medium';
    const enabledCategories = this.extractArrayValue(messageContent, 'categories') || ['transaction', 'account', 'network'];

    console.log(`Configuring anomaly detection with sensitivity: ${sensitivity}, categories: ${enabledCategories.join(', ')}`);

    // Apply configuration parameters from message
    const maxEventHistoryMatch = messageContent.match(/max[_\s]?event[_\s]?history[:\s]*(\d+)/i);
    if (maxEventHistoryMatch) {
      const newMaxEventHistory = parseInt(maxEventHistoryMatch[1]);
      this.maxEventHistory = Math.max(100, Math.min(10000, newMaxEventHistory));
      console.log(`Updated max event history to: ${this.maxEventHistory}`);
    }

    const maxAlertHistoryMatch = messageContent.match(/max[_\s]?alert[_\s]?history[:\s]*(\d+)/i);
    if (maxAlertHistoryMatch) {
      const newMaxAlertHistory = parseInt(maxAlertHistoryMatch[1]);
      this.maxAlertHistory = Math.max(10, Math.min(1000, newMaxAlertHistory));
      console.log(`Updated max alert history to: ${this.maxAlertHistory}`);
    }

    // Log the configuration source for debugging
    console.log(`Configuration extracted from message: "${params.message.content.substring(0, 100)}..."`);
    console.log(`Context has ${params.context.messages.length} messages, network state: ${params.context.networkState ? 'available' : 'none'}`);

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

    // Extract parameters from message content
    const messageContent = params.message.content.toLowerCase();
    const category = this.extractConfigValue(messageContent, 'category') || 'all';
    const includeDisabled = messageContent.includes('include disabled') || messageContent.includes('show disabled');
    const detailLevel = messageContent.includes('detailed') || messageContent.includes('full details') ? 'detailed' : 'summary';

    console.log(`Getting pattern configuration for category: ${category}, detail level: ${detailLevel}`);

    const configInfo = manager.getConfigurationInfo();
    const enabledPatterns = manager.getEnabledPatterns();

    // Filter patterns based on params
    let filteredPatterns = enabledPatterns;
    if (category !== 'all') {
      filteredPatterns = enabledPatterns.filter(pattern =>
        pattern.category === category || pattern.type === category
      );
      console.log(`Filtered patterns by category '${category}': ${filteredPatterns.length} patterns`);
    }

    // Apply includeDisabled filter if needed
    if (!includeDisabled) {
      // Only include enabled patterns (default behavior)
      console.log(`Excluding disabled patterns, showing ${filteredPatterns.length} enabled patterns`);
    } else {
      // Include disabled patterns if available from manager
      console.log(`Including disabled patterns as requested`);
    }

    // Include additional details based on params
    const patternDetails = detailLevel === 'detailed' ?
      filteredPatterns.map(pattern => ({
        ...pattern,
        statistics: this.getPatternStatistics(pattern.type),
        lastTriggered: this.getLastTriggeredTime(pattern.type)
      })) :
      filteredPatterns.map(pattern => ({
        type: pattern.type,
        description: pattern.description,
        category: pattern.category,
        severity: pattern.severity
      }));

    // Use patternDetails in the response
    console.log(`Generated ${patternDetails.length} pattern detail entries with ${detailLevel} level`);

    return {
      message: 'Current anomaly pattern configuration',
      configuration: configInfo,
      requestedCategory: category,
      detailLevel: detailLevel,
      includeDisabled: includeDisabled,
      patterns: patternDetails,
      totalPatterns: filteredPatterns.length,
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

  /**
   * Get statistics for a specific pattern
   */
  private getPatternStatistics(patternId: string): any {
    // Count alerts generated by this pattern
    const patternAlerts = this.alerts.getAll().filter(alert =>
      alert.type === patternId || alert.category === patternId
    );

    return {
      totalAlerts: patternAlerts.length,
      lastWeekAlerts: patternAlerts.filter(alert =>
        Date.now() - alert.timestamp < 7 * 24 * 60 * 60 * 1000
      ).length,
      averageSeverity: this.calculateAverageSeverity(patternAlerts),
      confidenceScore: this.calculateConfidenceScore(patternAlerts)
    };
  }

  /**
   * Get the last time a pattern was triggered
   */
  private getLastTriggeredTime(patternId: string): number | null {
    const patternAlerts = this.alerts.getAll().filter(alert =>
      alert.type === patternId || alert.category === patternId
    );

    if (patternAlerts.length === 0) return null;

    return Math.max(...patternAlerts.map(alert => alert.timestamp));
  }

  /**
   * Calculate average severity score for alerts
   */
  private calculateAverageSeverity(alerts: AnomalyAlert[]): number {
    if (alerts.length === 0) return 0;

    const severityScores = { low: 1, medium: 2, high: 3, critical: 4 };
    const totalScore = alerts.reduce((sum, alert) =>
      sum + (severityScores[alert.severity] || 0), 0
    );

    return totalScore / alerts.length;
  }

  /**
   * Calculate confidence score based on alert history
   */
  private calculateConfidenceScore(alerts: AnomalyAlert[]): number {
    if (alerts.length === 0) return 0;

    const totalConfidence = alerts.reduce((sum, alert) =>
      sum + (alert.confidence || 0.5), 0
    );

    return totalConfidence / alerts.length;
  }

  /**
   * Extract configuration value from message content
   */
  private extractConfigValue(content: string, key: string): string | null {
    const patterns = [
      new RegExp(`${key}[:\\s]*([a-zA-Z0-9_-]+)`, 'i'),
      new RegExp(`set\\s+${key}\\s+to\\s+([a-zA-Z0-9_-]+)`, 'i'),
      new RegExp(`${key}\\s*=\\s*([a-zA-Z0-9_-]+)`, 'i')
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) return match[1];
    }

    return null;
  }

  /**
   * Extract array value from message content
   */
  private extractArrayValue(content: string, key: string): string[] | null {
    const patterns = [
      new RegExp(`${key}[:\\s]*\\[([^\\]]+)\\]`, 'i'),
      new RegExp(`${key}[:\\s]*([a-zA-Z0-9_,-\\s]+)`, 'i')
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        return match[1].split(/[,\s]+/).map(item => item.trim()).filter(Boolean);
      }
    }

    return null;
  }
}
