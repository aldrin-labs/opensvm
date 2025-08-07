import { 
  PerformanceMetrics, 
  PerformanceAlert, 
  PerformanceConfig, 
  PerformanceThresholds, 
  PerformanceReport,
  UserInteraction 
} from './types';

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private config: PerformanceConfig;
  private metrics: PerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private sessionId: string;
  private startTime: number;
  private collectTimer?: NodeJS.Timeout;
  private reportTimer?: NodeJS.Timeout;
  private frameCount = 0;
  private lastFrameTime = 0;
  private isMonitoring = false;

  private readonly defaultConfig: PerformanceConfig = {
    enabled: true,
    collectInterval: 1000, // 1 second
    reportInterval: 30000, // 30 seconds
    thresholds: {
      fps: { warning: 30, critical: 15 },
      memoryUsage: { warning: 0.8, critical: 0.9 },
      apiResponseTime: { warning: 1000, critical: 3000 },
      loadTime: { warning: 3000, critical: 5000 },
      firstContentfulPaint: { warning: 2000, critical: 4000 },
      largestContentfulPaint: { warning: 2500, critical: 4000 },
      cumulativeLayoutShift: { warning: 0.1, critical: 0.25 },
      timeToInteractive: { warning: 3500, critical: 5000 },
    },
    enabledMetrics: [
      'fps', 'memoryUsage', 'apiResponseTime', 'networkLatency',
      'loadTime', 'firstContentfulPaint', 'largestContentfulPaint',
      'cumulativeLayoutShift', 'timeToInteractive'
    ],
    debugMode: process.env.NODE_ENV === 'development'
  };

  private constructor(config?: Partial<PerformanceConfig>) {
    this.config = { ...this.defaultConfig, ...config };
    this.sessionId = this.generateSessionId();
    this.startTime = Date.now();
    
    if (typeof window !== 'undefined') {
      this.setupBrowserMonitoring();
    }
  }

  static getInstance(config?: Partial<PerformanceConfig>): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor(config);
    }
    return PerformanceMonitor.instance;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupBrowserMonitoring(): void {
    // Setup FPS monitoring
    this.setupFPSMonitoring();
    
    // Setup Performance Observer for Web Vitals
    this.setupPerformanceObserver();
    
    // Setup memory monitoring
    this.setupMemoryMonitoring();
  }

  private setupFPSMonitoring(): void {
    const countFrame = () => {
      this.frameCount++;
      if (this.isMonitoring) {
        requestAnimationFrame(countFrame);
      }
    };
    requestAnimationFrame(countFrame);
  }

  private setupPerformanceObserver(): void {
    if (!('PerformanceObserver' in window)) return;

    try {
      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          this.updateVital('largestContentfulPaint', lastEntry.startTime);
        }
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

      // First Input Delay / Interaction to Next Paint
      const fidObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry: any) => {
          if (entry.processingStart && entry.startTime) {
            const delay = entry.processingStart - entry.startTime;
            this.updateVital('timeToInteractive', delay);
          }
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });

      // Cumulative Layout Shift
      const clsObserver = new PerformanceObserver((list) => {
        let clsValue = 0;
        list.getEntries().forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
        this.updateVital('cumulativeLayoutShift', clsValue);
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });

    } catch (error) {
      console.warn('Performance Observer setup failed:', error);
    }
  }

  private setupMemoryMonitoring(): void {
    // Memory monitoring will be handled in collectMetrics
  }

  private updateVital(vital: keyof PerformanceMetrics, value: number): void {
    if (this.config.debugMode) {
      console.log(`Performance vital ${vital}:`, value);
    }
  }

  start(): void {
    if (!this.config.enabled || this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.startTime = Date.now();
    this.frameCount = 0;
    this.lastFrameTime = performance.now();

    // Start metric collection
    this.collectTimer = setInterval(() => {
      this.collectMetrics();
    }, this.config.collectInterval);

    // Start reporting
    this.reportTimer = setInterval(() => {
      this.generateReport();
    }, this.config.reportInterval);

    if (this.config.debugMode) {
      console.log('Performance monitoring started');
    }
  }

  stop(): void {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    if (this.collectTimer) {
      clearInterval(this.collectTimer);
      this.collectTimer = undefined;
    }
    
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
      this.reportTimer = undefined;
    }

    if (this.config.debugMode) {
      console.log('Performance monitoring stopped');
    }
  }

  private async collectMetrics(): Promise<void> {
    if (!this.isMonitoring || typeof window === 'undefined') return;

    try {
      const now = Date.now();
      const currentTime = performance.now();
      
      // Calculate FPS
      const fps = this.calculateFPS(currentTime);
      
      // Get memory usage
      const memoryUsage = this.getMemoryUsage();
      
      // Get network timing
      const { apiResponseTime, networkLatency } = this.getNetworkTiming();
      
      // Get Web Vitals
      const webVitals = this.getWebVitals();

      const metrics: PerformanceMetrics = {
        fps,
        memoryUsage,
        apiResponseTime,
        networkLatency,
        ...webVitals,
        timestamp: now,
        url: window.location.href,
        userAgent: navigator.userAgent,
        sessionId: this.sessionId,
      };

      this.metrics.push(metrics);
      this.checkThresholds(metrics);
      
      // Keep only last 1000 metrics to prevent memory leaks
      if (this.metrics.length > 1000) {
        this.metrics = this.metrics.slice(-1000);
      }

      if (this.config.debugMode) {
        console.log('Metrics collected:', metrics);
      }

    } catch (error) {
      console.error('Error collecting metrics:', error);
    }
  }

  private calculateFPS(currentTime: number): number {
    const deltaTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;
    
    if (deltaTime > 0) {
      return Math.round(1000 / deltaTime);
    }
    return 60; // Default assumption
  }

  private getMemoryUsage(): PerformanceMetrics['memoryUsage'] {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize || 0,
        total: memory.totalJSHeapSize || 0,
        limit: memory.jsHeapSizeLimit || 0,
      };
    }
    return { used: 0, total: 0, limit: 0 };
  }

  private getNetworkTiming(): { apiResponseTime: number; networkLatency: number } {
    const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    const entry = entries[entries.length - 1];
    
    if (entry) {
      const apiResponseTime = entry.responseEnd - entry.requestStart;
      const networkLatency = entry.responseStart - entry.requestStart;
      return { apiResponseTime, networkLatency };
    }
    
    return { apiResponseTime: 0, networkLatency: 0 };
  }

  private getWebVitals(): Partial<PerformanceMetrics> {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    if (!navigation) return {};
    
    return {
      loadTime: navigation.loadEventEnd - navigation.loadEventStart,
      firstContentfulPaint: this.getFCP(),
      largestContentfulPaint: 0, // Will be updated by observer
      cumulativeLayoutShift: 0, // Will be updated by observer
      timeToInteractive: 0, // Will be updated by observer
    };
  }

  private getFCP(): number {
    const entries = performance.getEntriesByName('first-contentful-paint');
    return entries.length > 0 ? entries[0].startTime : 0;
  }

  private checkThresholds(metrics: PerformanceMetrics): void {
    const thresholds = this.config.thresholds;
    
    // Check FPS
    if (metrics.fps < thresholds.fps.critical) {
      this.createAlert('critical', 'fps', thresholds.fps.critical, metrics.fps, 
        `Critical FPS drop detected: ${metrics.fps} FPS`);
    } else if (metrics.fps < thresholds.fps.warning) {
      this.createAlert('warning', 'fps', thresholds.fps.warning, metrics.fps, 
        `FPS warning: ${metrics.fps} FPS`);
    }

    // Check Memory Usage
    const memoryUsagePercent = metrics.memoryUsage.limit > 0 
      ? metrics.memoryUsage.used / metrics.memoryUsage.limit 
      : 0;
    
    if (memoryUsagePercent > thresholds.memoryUsage.critical) {
      this.createAlert('critical', 'memoryUsage', thresholds.memoryUsage.critical, memoryUsagePercent, 
        `Critical memory usage: ${(memoryUsagePercent * 100).toFixed(1)}%`);
    } else if (memoryUsagePercent > thresholds.memoryUsage.warning) {
      this.createAlert('warning', 'memoryUsage', thresholds.memoryUsage.warning, memoryUsagePercent, 
        `High memory usage: ${(memoryUsagePercent * 100).toFixed(1)}%`);
    }

    // Check API Response Time
    if (metrics.apiResponseTime > thresholds.apiResponseTime.critical) {
      this.createAlert('critical', 'apiResponseTime', thresholds.apiResponseTime.critical, metrics.apiResponseTime, 
        `Critical API response time: ${metrics.apiResponseTime}ms`);
    } else if (metrics.apiResponseTime > thresholds.apiResponseTime.warning) {
      this.createAlert('warning', 'apiResponseTime', thresholds.apiResponseTime.warning, metrics.apiResponseTime, 
        `Slow API response time: ${metrics.apiResponseTime}ms`);
    }
  }

  private createAlert(
    type: PerformanceAlert['type'], 
    metric: keyof PerformanceMetrics, 
    threshold: number, 
    currentValue: number, 
    message: string
  ): void {
    const alert: PerformanceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      metric,
      threshold,
      currentValue,
      message,
      timestamp: Date.now(),
      resolved: false,
    };

    this.alerts.push(alert);
    
    if (this.config.debugMode) {
      console.warn(`Performance Alert [${type.toUpperCase()}]:`, message);
    }

    // Emit alert event for subscribers
    this.emitAlert(alert);
  }

  private emitAlert(alert: PerformanceAlert): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('performance-alert', { detail: alert }));
    }
  }

  private generateReport(): PerformanceReport {
    const endTime = Date.now();
    const recentMetrics = this.metrics.filter(m => m.timestamp >= endTime - this.config.reportInterval);
    
    const report: PerformanceReport = {
      sessionId: this.sessionId,
      startTime: this.startTime,
      endTime,
      metrics: recentMetrics,
      alerts: this.alerts.filter(a => a.timestamp >= endTime - this.config.reportInterval),
      summary: this.calculateSummary(recentMetrics),
    };

    if (this.config.debugMode) {
      console.log('Performance report generated:', report.summary);
    }

    // Emit report event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('performance-report', { detail: report }));
    }

    return report;
  }

  private calculateSummary(metrics: PerformanceMetrics[]) {
    if (metrics.length === 0) {
      return {
        avgFps: 0,
        avgMemoryUsage: 0,
        avgApiResponseTime: 0,
        totalAlerts: this.alerts.length,
        criticalAlerts: this.alerts.filter(a => a.type === 'critical').length,
      };
    }

    const avgFps = metrics.reduce((sum, m) => sum + m.fps, 0) / metrics.length;
    const avgMemoryUsage = metrics.reduce((sum, m) => sum + (m.memoryUsage.used / Math.max(m.memoryUsage.limit, 1)), 0) / metrics.length;
    const avgApiResponseTime = metrics.reduce((sum, m) => sum + m.apiResponseTime, 0) / metrics.length;

    return {
      avgFps: Math.round(avgFps),
      avgMemoryUsage: Math.round(avgMemoryUsage * 100) / 100,
      avgApiResponseTime: Math.round(avgApiResponseTime),
      totalAlerts: this.alerts.length,
      criticalAlerts: this.alerts.filter(a => a.type === 'critical').length,
    };
  }

  // Public API methods
  getLatestMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  getMetrics(limit?: number): PerformanceMetrics[] {
    return limit ? this.metrics.slice(-limit) : this.metrics;
  }

  getAlerts(unresolved = false): PerformanceAlert[] {
    return unresolved ? this.alerts.filter(a => !a.resolved) : this.alerts;
  }

  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
    }
  }

  clearAlerts(): void {
    this.alerts = [];
  }

  updateConfig(config: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Restart monitoring if config changes require it
    if (this.isMonitoring) {
      this.stop();
      this.start();
    }
  }

  getConfig(): PerformanceConfig {
    return { ...this.config };
  }

  // Custom metric tracking
  trackCustomMetric(name: string, value: number, metadata?: Record<string, any>): void {
    if (this.config.debugMode) {
      console.log(`Custom metric ${name}:`, value, metadata);
    }
    
    // Emit custom metric event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('performance-custom-metric', { 
        detail: { name, value, metadata, timestamp: Date.now() } 
      }));
    }
  }

  // User interaction tracking
  trackInteraction(interaction: Omit<UserInteraction, 'id' | 'timestamp'>): void {
    const fullInteraction: UserInteraction = {
      ...interaction,
      id: `interaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      performance: this.getLatestMetrics() || undefined,
    };

    if (this.config.debugMode) {
      console.log('User interaction tracked:', fullInteraction);
    }

    // Emit interaction event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('performance-user-interaction', { 
        detail: fullInteraction 
      }));
    }
  }
}

export default PerformanceMonitor;