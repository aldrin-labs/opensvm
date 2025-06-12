import { Connection } from '@solana/web3.js';
import { BaseCapability } from './base';
import type { Message, Tool, ToolParams } from '../types';
import { 
  getAllPatterns, 
  calculateSeverity, 
  type AnomalyPattern, 
  type AnomalyContext 
} from '@/lib/anomaly-patterns';
import { SSEManager } from '@/lib/sse-manager';

// UUID v4 generation function
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

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

// Ring buffer implementation for efficient memory management
class RingBuffer<T> {
  private buffer: T[];
  private head = 0;
  private tail = 0;
  private count = 0;
  private readonly capacity: number;
  private readonly mutex = { locked: false };

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  async push(item: T): Promise<void> {
    await this.lock();
    try {
      this.buffer[this.tail] = item;
      this.tail = (this.tail + 1) % this.capacity;
      
      if (this.count < this.capacity) {
        this.count++;
      } else {
        this.head = (this.head + 1) % this.capacity;
      }
    } finally {
      this.unlock();
    }
  }

  async toArray(): Promise<T[]> {
    await this.lock();
    try {
      const result: T[] = [];
      for (let i = 0; i < this.count; i++) {
        const index = (this.head + i) % this.capacity;
        result.push(this.buffer[index]);
      }
      return result;
    } finally {
      this.unlock();
    }
  }

  private async lock(): Promise<void> {
    while (this.mutex.locked) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    this.mutex.locked = true;
  }

  private unlock(): void {
    this.mutex.locked = false;
  }

  get size(): number {
    return this.count;
  }
}

export class AnomalyDetectionCapability extends BaseCapability {
  type = 'anomaly_detection' as const;
  private patterns: AnomalyPattern[] = [];
  private recentEvents: RingBuffer<any>;
  private alerts: RingBuffer<AnomalyAlert>;
  private maxEventHistory = 1000;
  private maxAlertHistory = 100;

  constructor(connection: Connection) {
    super(connection);
    this.recentEvents = new RingBuffer<any>(this.maxEventHistory);
    this.alerts = new RingBuffer<AnomalyAlert>(this.maxAlertHistory);
    this.initializePatterns();
    this.tools = this.createTools();
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

  private initializePatterns(): void {
    // Load externalized patterns
    this.patterns = getAllPatterns();
    console.log(`Loaded ${this.patterns.length} anomaly detection patterns`);
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

    // Add event to ring buffer
    await this.recentEvents.push(event);

    // Create context for analysis
    const context = await this.createContext();
    
    // Check for anomalies with safe pattern checking
    const alerts: AnomalyAlert[] = [];
    
    for (const pattern of this.patterns) {
      const isAnomaly = await this.safePatternCheck(pattern, event, context);
      if (isAnomaly) {
        const alert = this.createAlert(pattern, event, context);
        alerts.push(alert);
        await this.alerts.push(alert);
        
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
    const recentEvents = (await this.recentEvents.toArray()).filter(e => e.timestamp > now - recentWindow);
    
    const transactionEvents = recentEvents.filter(e => e.type === 'transaction');
    const failedTransactions = transactionEvents.filter(e => e.data.err !== null);
    
    return {
      recentEvents,
      transactionVolume: transactionEvents.length,
      averageFees: this.calculateAverageFees(transactionEvents),
      errorRate: transactionEvents.length > 0 ? failedTransactions.length / transactionEvents.length : 0,
      timestamp: now,
      timeWindowMs: recentWindow
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
      id: generateUUID(),
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

  private async getAnomalyAlerts(params: ToolParams): Promise<any> {
    const allAlerts = await this.alerts.toArray();
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

  private async getAnomalyStats(params: ToolParams): Promise<any> {
    const now = Date.now();
    const periods = [
      { name: '1h', duration: 60 * 60 * 1000 },
      { name: '6h', duration: 6 * 60 * 60 * 1000 },
      { name: '24h', duration: 24 * 60 * 60 * 1000 }
    ];

    const allAlerts = await this.alerts.toArray();
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
    // This would allow configuration of detection parameters
    // For now, return current configuration
    return {
      message: 'Anomaly detection configuration',
      patterns: this.patterns.length,
      maxEventHistory: this.maxEventHistory,
      maxAlertHistory: this.maxAlertHistory
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