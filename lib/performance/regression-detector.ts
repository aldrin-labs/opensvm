import { PerformanceMetrics, PerformanceAlert } from './types';
import { logger } from '../logging/logger';

export interface PerformanceBaseline {
  id: string;
  timestamp: number;
  version?: string;
  branch?: string;
  metrics: {
    fps: { mean: number; p95: number; p99: number };
    memory: { mean: number; p95: number; p99: number };
    apiResponseTime: { mean: number; p95: number; p99: number };
    renderTime: { mean: number; p95: number; p99: number };
    webVitals: {
      lcp: { mean: number; p95: number };
      fid: { mean: number; p95: number };
      cls: { mean: number; p95: number };
    };
  };
  sampleSize: number;
  environment: 'development' | 'staging' | 'production';
}

export interface RegressionRule {
  metric: string;
  threshold: number; // percentage degradation
  consecutiveFailures: number; // how many consecutive measurements must fail
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
}

export interface RegressionDetection {
  id: string;
  timestamp: number;
  metric: string;
  currentValue: number;
  baselineValue: number;
  degradationPercent: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  rule: RegressionRule;
  context: {
    version?: string;
    branch?: string;
    environment: string;
    sampleSize: number;
  };
}

export interface RegressionDetectorConfig {
  baselineRetentionDays: number;
  minSampleSizeForBaseline: number;
  detectionIntervalMs: number;
  rules: RegressionRule[];
  autoCreateBaselines: boolean;
  baselineCreationThreshold: number; // hours since last baseline
}

const defaultConfig: RegressionDetectorConfig = {
  baselineRetentionDays: 30,
  minSampleSizeForBaseline: 100,
  detectionIntervalMs: 60000, // 1 minute
  autoCreateBaselines: true,
  baselineCreationThreshold: 24, // 24 hours
  rules: [
    {
      metric: 'fps',
      threshold: 10, // 10% FPS drop
      consecutiveFailures: 3,
      severity: 'medium',
      enabled: true
    },
    {
      metric: 'memory',
      threshold: 20, // 20% memory increase
      consecutiveFailures: 2,
      severity: 'high',
      enabled: true
    },
    {
      metric: 'apiResponseTime',
      threshold: 25, // 25% API response time increase
      consecutiveFailures: 2,
      severity: 'high',
      enabled: true
    },
    {
      metric: 'renderTime',
      threshold: 15, // 15% render time increase
      consecutiveFailures: 3,
      severity: 'medium',
      enabled: true
    },
    {
      metric: 'lcp',
      threshold: 30, // 30% LCP degradation
      consecutiveFailures: 2,
      severity: 'critical',
      enabled: true
    },
    {
      metric: 'fid',
      threshold: 50, // 50% FID degradation
      consecutiveFailures: 2,
      severity: 'high',
      enabled: true
    },
    {
      metric: 'cls',
      threshold: 25, // 25% CLS degradation
      consecutiveFailures: 2,
      severity: 'medium',
      enabled: true
    }
  ]
};

export class PerformanceRegressionDetector {
  private config: RegressionDetectorConfig;
  private baselines: Map<string, PerformanceBaseline> = new Map();
  private detectionHistory: Map<string, number[]> = new Map(); // metric -> consecutive failure counts
  private detectionTimer?: NodeJS.Timeout;
  private currentMetricsBuffer: PerformanceMetrics[] = [];
  private listeners: Set<(detection: RegressionDetection) => void> = new Set();

  constructor(config: Partial<RegressionDetectorConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.loadBaselinesFromStorage();
  }

  public addMetrics(metrics: PerformanceMetrics): void {
    this.currentMetricsBuffer.push({
      ...metrics,
      timestamp: Date.now()
    });

    // Keep buffer size manageable
    if (this.currentMetricsBuffer.length > 1000) {
      this.currentMetricsBuffer = this.currentMetricsBuffer.slice(-500);
    }

    // Auto-create baselines if needed
    if (this.config.autoCreateBaselines) {
      this.checkAndCreateBaseline();
    }
  }

  public createBaseline(
    environment: 'development' | 'staging' | 'production' = 'development',
    version?: string,
    branch?: string
  ): PerformanceBaseline | null {
    if (this.currentMetricsBuffer.length < this.config.minSampleSizeForBaseline) {
      logger.warn('Insufficient metrics for baseline creation', {
        component: 'RegressionDetector',
        metadata: {
          bufferSize: this.currentMetricsBuffer.length,
          minRequired: this.config.minSampleSizeForBaseline
        }
      });
      return null;
    }

    const baseline: PerformanceBaseline = {
      id: `baseline_${Date.now()}`,
      timestamp: Date.now(),
      version,
      branch,
      environment,
      sampleSize: this.currentMetricsBuffer.length,
      metrics: this.calculateBaselineMetrics()
    };

    this.baselines.set(baseline.id, baseline);
    this.saveBaselinesToStorage();

    logger.info('Performance baseline created', {
      component: 'RegressionDetector',
      metadata: {
        baselineId: baseline.id,
        sampleSize: baseline.sampleSize,
        environment
      }
    });

    return baseline;
  }

  private calculateBaselineMetrics(): PerformanceBaseline['metrics'] {
    const fps = this.currentMetricsBuffer.map(m => m.fps).filter(v => v > 0);
    const memory = this.currentMetricsBuffer.map(m => m.memoryUsage?.used || 0).filter(v => v > 0);
    const apiTimes = this.currentMetricsBuffer.map(m => m.apiResponseTime).filter(v => v > 0);
    const renderTimes = this.currentMetricsBuffer.map(m => m.graphRenderTime || 0).filter(v => v > 0);

    const webVitalsLcp = this.currentMetricsBuffer.map(m => m.largestContentfulPaint || 0).filter(v => v > 0);
    const webVitalsFid = this.currentMetricsBuffer.map(m => m.timeToInteractive || 0).filter(v => v > 0);
    const webVitalsCls = this.currentMetricsBuffer.map(m => m.cumulativeLayoutShift || 0).filter(v => v > 0);

    return {
      fps: this.calculateStatistics(fps),
      memory: this.calculateStatistics(memory),
      apiResponseTime: this.calculateStatistics(apiTimes),
      renderTime: this.calculateStatistics(renderTimes),
      webVitals: {
        lcp: { 
          mean: this.calculateMean(webVitalsLcp),
          p95: this.calculatePercentile(webVitalsLcp, 95)
        },
        fid: {
          mean: this.calculateMean(webVitalsFid),
          p95: this.calculatePercentile(webVitalsFid, 95)
        },
        cls: {
          mean: this.calculateMean(webVitalsCls),
          p95: this.calculatePercentile(webVitalsCls, 95)
        }
      }
    };
  }

  private calculateStatistics(values: number[]): { mean: number; p95: number; p99: number } {
    if (values.length === 0) {
      return { mean: 0, p95: 0, p99: 0 };
    }

    return {
      mean: this.calculateMean(values),
      p95: this.calculatePercentile(values, 95),
      p99: this.calculatePercentile(values, 99)
    };
  }

  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * (percentile / 100)) - 1;
    return sorted[Math.max(0, index)];
  }

  public startDetection(): void {
    if (this.detectionTimer) {
      this.stopDetection();
    }

    this.detectionTimer = setInterval(() => {
      this.performRegressionDetection();
    }, this.config.detectionIntervalMs);

    logger.info('Regression detection started', {
      component: 'RegressionDetector',
      metadata: {
        interval: this.config.detectionIntervalMs
      }
    });
  }

  public stopDetection(): void {
    if (this.detectionTimer) {
      clearInterval(this.detectionTimer);
      this.detectionTimer = undefined;
    }
  }

  private performRegressionDetection(): void {
    if (this.baselines.size === 0) {
      return;
    }

    // Get most recent baseline
    const latestBaseline = Array.from(this.baselines.values())
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    if (!latestBaseline) return;

    // Get current metrics for comparison
    const recentMetrics = this.currentMetricsBuffer.slice(-50); // Last 50 measurements
    if (recentMetrics.length < 10) return;

    const currentStats = this.calculateCurrentStats(recentMetrics);

    // Check each rule
    for (const rule of this.config.rules.filter(r => r.enabled)) {
      const detection = this.checkRegressionRule(rule, currentStats, latestBaseline);
      if (detection) {
        this.handleRegressionDetection(detection);
      }
    }
  }

  private calculateCurrentStats(metrics: PerformanceMetrics[]): any {
    const fps = metrics.map(m => m.fps).filter(v => v > 0);
    const memory = metrics.map(m => m.memoryUsage?.used || 0).filter(v => v > 0);
    const apiTimes = metrics.map(m => m.apiResponseTime).filter(v => v > 0);
    const renderTimes = metrics.map(m => m.graphRenderTime || 0).filter(v => v > 0);
    const lcp = metrics.map(m => m.largestContentfulPaint || 0).filter(v => v > 0);
    const fid = metrics.map(m => m.timeToInteractive || 0).filter(v => v > 0);
    const cls = metrics.map(m => m.cumulativeLayoutShift || 0).filter(v => v > 0);

    return {
      fps: this.calculateMean(fps),
      memory: this.calculateMean(memory),
      apiResponseTime: this.calculateMean(apiTimes),
      renderTime: this.calculateMean(renderTimes),
      lcp: this.calculateMean(lcp),
      fid: this.calculateMean(fid),
      cls: this.calculateMean(cls)
    };
  }

  private checkRegressionRule(
    rule: RegressionRule,
    currentStats: any,
    baseline: PerformanceBaseline
  ): RegressionDetection | null {
    const currentValue = currentStats[rule.metric];
    let baselineValue: number;

    // Get baseline value based on metric
    if (rule.metric in baseline.metrics) {
      const metricStats = baseline.metrics[rule.metric as keyof typeof baseline.metrics];
      baselineValue = typeof metricStats === 'object' && 'mean' in metricStats
        ? (metricStats as any).mean
        : 0;
    } else if (rule.metric in baseline.metrics.webVitals) {
      baselineValue = (baseline.metrics.webVitals as any)[rule.metric]?.mean || 0;
    } else {
      return null;
    }

    if (currentValue === 0 || baselineValue === 0) {
      return null;
    }

    // Calculate degradation percentage
    let degradationPercent: number;
    
    // For metrics where lower is better (FPS is opposite)
    if (rule.metric === 'fps') {
      degradationPercent = ((baselineValue - currentValue) / baselineValue) * 100;
    } else {
      degradationPercent = ((currentValue - baselineValue) / baselineValue) * 100;
    }

    // Check if regression threshold is exceeded
    if (degradationPercent > rule.threshold) {
      const failures = this.detectionHistory.get(rule.metric) || [];
      failures.push(Date.now());

      // Keep only recent failures
      const recentFailures = failures.filter(time => 
        Date.now() - time < rule.consecutiveFailures * this.config.detectionIntervalMs * 2
      );
      
      this.detectionHistory.set(rule.metric, recentFailures);

      // Check if we have enough consecutive failures
      if (recentFailures.length >= rule.consecutiveFailures) {
        return {
          id: `regression_${rule.metric}_${Date.now()}`,
          timestamp: Date.now(),
          metric: rule.metric,
          currentValue,
          baselineValue,
          degradationPercent,
          severity: rule.severity,
          rule,
          context: {
            version: baseline.version,
            branch: baseline.branch,
            environment: baseline.environment,
            sampleSize: this.currentMetricsBuffer.length
          }
        };
      }
    } else {
      // Reset failure count for this metric
      this.detectionHistory.delete(rule.metric);
    }

    return null;
  }

  private handleRegressionDetection(detection: RegressionDetection): void {
    logger.warn('Performance regression detected', {
      component: 'RegressionDetector',
      metadata: {
        metric: detection.metric,
        degradation: `${detection.degradationPercent.toFixed(2)}%`,
        severity: detection.severity,
        currentValue: detection.currentValue,
        baselineValue: detection.baselineValue
      }
    });

    // Notify listeners
    this.listeners.forEach(listener => {
      try {
        listener(detection);
      } catch (error) {
        logger.error('Error in regression detection listener', {
          component: 'RegressionDetector',
          metadata: {
            error: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined
          }
        });
      }
    });

    // Clear failure history for this metric to avoid duplicate alerts
    this.detectionHistory.delete(detection.metric);
  }

  private checkAndCreateBaseline(): void {
    const latestBaseline = Array.from(this.baselines.values())
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    const shouldCreate = !latestBaseline || 
      (Date.now() - latestBaseline.timestamp) > (this.config.baselineCreationThreshold * 60 * 60 * 1000);

    if (shouldCreate && this.currentMetricsBuffer.length >= this.config.minSampleSizeForBaseline) {
      this.createBaseline();
    }
  }

  public onRegressionDetected(listener: (detection: RegressionDetection) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getBaselines(): PerformanceBaseline[] {
    return Array.from(this.baselines.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  public removeBaseline(id: string): boolean {
    const removed = this.baselines.delete(id);
    if (removed) {
      this.saveBaselinesToStorage();
    }
    return removed;
  }

  public updateConfig(config: Partial<RegressionDetectorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private saveBaselinesToStorage(): void {
    try {
      if (typeof window !== 'undefined') {
        const baselines = Array.from(this.baselines.entries());
        localStorage.setItem('opensvm_performance_baselines', JSON.stringify(baselines));
      }
    } catch (error) {
      logger.error('Failed to save baselines to storage', {
        component: 'RegressionDetector',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined
        }
      });
    }
  }

  private loadBaselinesFromStorage(): void {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('opensvm_performance_baselines');
        if (stored) {
          const baselines = JSON.parse(stored);
          this.baselines = new Map(baselines);

          // Clean up old baselines
          this.cleanupOldBaselines();
        }
      }
    } catch (error) {
      logger.error('Failed to load baselines from storage', {
        component: 'RegressionDetector',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined
        }
      });
    }
  }

  private cleanupOldBaselines(): void {
    const cutoff = Date.now() - (this.config.baselineRetentionDays * 24 * 60 * 60 * 1000);
    
    for (const [id, baseline] of this.baselines) {
      if (baseline.timestamp < cutoff) {
        this.baselines.delete(id);
      }
    }

    this.saveBaselinesToStorage();
  }

  public destroy(): void {
    this.stopDetection();
    this.listeners.clear();
    this.currentMetricsBuffer = [];
    this.detectionHistory.clear();
  }
}

// Singleton instance
export const regressionDetector = new PerformanceRegressionDetector();
