'use client';

import { MemoryManager } from './MemoryManager';
import { EdgeCaseManager } from './EdgeCaseManager';
import { UXManager } from './UXManager';
import { ScalabilityManager } from './ScalabilityManager';

// Enhanced monitoring interfaces
export interface PerformanceMetrics {
  // Core performance
  frameRate: number;
  renderTime: number;
  layoutTime: number;
  interactionLatency: number;
  
  // Memory metrics
  memoryUsage: number;
  memoryPressure: number;
  gcCount: number;
  
  // Network metrics
  networkLatency: number;
  dataTransferRate: number;
  cacheHitRatio: number;
  
  // User experience
  loadingTimes: Record<string, number>;
  errorRate: number;
  taskCompletionRate: number;
  userSatisfaction: number;
  
  // System metrics
  cpuUsage: number;
  batteryLevel?: number;
  connectionType: string;
  deviceMemory?: number;
  
  // Graph-specific metrics
  nodeCount: number;
  edgeCount: number;
  visibleElements: number;
  spatialIndexQueries: number;
  virtualizationEfficiency: number;
}

export interface UserBehaviorMetrics {
  // Navigation patterns
  navigationCount: number;
  backButtonUsage: number;
  searchUsage: number;
  filterUsage: number;
  
  // Interaction patterns
  clickCount: number;
  scrollDistance: number;
  zoomOperations: number;
  keyboardShortcuts: number;
  
  // Feature usage
  featureUsage: Record<string, number>;
  settingsChanges: Record<string, number>;
  
  // Session data
  sessionDuration: number;
  pageViews: number;
  bounceRate: number;
  returnVisits: number;
}

export interface SystemHealthMetrics {
  // Application health
  uptime: number;
  errorCount: number;
  warningCount: number;
  criticalErrors: number;
  
  // Performance health
  performanceScore: number;
  accessibilityScore: number;
  seoScore: number;
  
  // Resource health
  memoryLeaks: number;
  resourceCleanup: number;
  cacheEfficiency: number;
  
  // User experience health
  loadingFailures: number;
  renderingErrors: number;
  navigationErrors: number;
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: 'above' | 'below' | 'equals';
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldown: number; // minutes
  lastTriggered?: number;
  actions: AlertAction[];
}

export interface AlertAction {
  type: 'log' | 'notify' | 'email' | 'webhook' | 'auto-fix';
  config: Record<string, any>;
}

export interface MonitoringEvent {
  id: string;
  timestamp: number;
  type: 'performance' | 'error' | 'user-action' | 'system' | 'custom';
  category: string;
  data: Record<string, any>;
  metadata?: {
    userAgent?: string;
    url?: string;
    userId?: string;
    sessionId?: string;
    buildVersion?: string;
  };
}

export interface MonitoringConfig {
  enabled: boolean;
  sampleRate: number; // 0-1
  bufferSize: number;
  flushInterval: number; // ms
  enableRealTimeMetrics: boolean;
  enableUserTracking: boolean;
  enableErrorTracking: boolean;
  enablePerformanceTracking: boolean;
  alertsEnabled: boolean;
  dataRetention: number; // days
}

// Real-time metrics collector
class MetricsCollector {
  private metrics: Partial<PerformanceMetrics> = {};
  private userMetrics: Partial<UserBehaviorMetrics> = {};
  private systemMetrics: Partial<SystemHealthMetrics> = {};
  private collectors = new Map<string, () => any>();
  private collectInterval: string | null = null;
  private memoryManager = MemoryManager.getInstance();

  constructor(private config: MonitoringConfig) {
    this.setupDefaultCollectors();
    this.startCollection();
  }

  private setupDefaultCollectors(): void {
    // Performance collectors
    this.addCollector('frameRate', () => {
      // Calculate from frame timing
      return this.calculateFrameRate();
    });

    this.addCollector('memoryUsage', () => {
      const memInfo = this.memoryManager.getMemoryMetrics();
      return memInfo ? memInfo.usedJSHeapSize : 0;
    });

    this.addCollector('networkLatency', () => {
      // Measure network latency using Navigation Timing API
      return this.measureNetworkLatency();
    });

    this.addCollector('deviceInfo', () => {
      return this.collectDeviceInfo();
    });

    this.addCollector('userBehavior', () => {
      return this.collectUserBehavior();
    });
  }

  addCollector(name: string, collector: () => any): void {
    this.collectors.set(name, collector);
  }

  removeCollector(name: string): void {
    this.collectors.delete(name);
  }

  private startCollection(): void {
    if (!this.config.enabled) return;

    this.collectInterval = this.memoryManager.safeSetInterval(() => {
      this.collectMetrics();
    }, this.config.flushInterval, 'Metrics collection');
  }

  private collectMetrics(): void {
    const timestamp = Date.now();
    
    for (const [name, collector] of this.collectors.entries()) {
      try {
        const value = collector();
        this.updateMetric(name, value, timestamp);
      } catch (error) {
        console.warn(`Metric collection failed for ${name}:`, error);
      }
    }
  }

  private updateMetric(name: string, value: any, timestamp: number): void {
    switch (name) {
      case 'frameRate':
        this.metrics.frameRate = value;
        break;
      case 'memoryUsage':
        this.metrics.memoryUsage = value;
        break;
      case 'networkLatency':
        this.metrics.networkLatency = value;
        break;
      default:
        // Handle custom metrics
        (this.metrics as any)[name] = value;
    }
  }

  private calculateFrameRate(): number {
    // Use performance observer to calculate frame rate
    if (typeof window === 'undefined') return 60;

    try {
      const entries = performance.getEntriesByType('measure');
      if (entries.length === 0) return 60;

      const recentEntries = entries.slice(-10);
      const totalTime = recentEntries.reduce((sum, entry) => sum + entry.duration, 0);
      const avgFrameTime = totalTime / recentEntries.length;
      
      return avgFrameTime > 0 ? 1000 / avgFrameTime : 60;
    } catch (error) {
      return 60;
    }
  }

  private measureNetworkLatency(): number {
    if (typeof window === 'undefined') return 0;

    try {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (!navigation) return 0;

      return navigation.responseStart - navigation.requestStart;
    } catch (error) {
      return 0;
    }
  }

  private collectDeviceInfo(): any {
    if (typeof window === 'undefined') return {};

    return {
      deviceMemory: (navigator as any).deviceMemory || 'unknown',
      connectionType: (navigator as any).connection?.effectiveType || 'unknown',
      batteryLevel: this.getBatteryLevel(),
      cpuCores: navigator.hardwareConcurrency || 'unknown',
      platform: navigator.platform,
      userAgent: navigator.userAgent
    };
  }

  private async getBatteryLevel(): Promise<number | undefined> {
    try {
      if ('getBattery' in navigator) {
        const battery = await (navigator as any).getBattery();
        return battery.level * 100;
      }
    } catch (error) {
      // Battery API not supported
    }
    return undefined;
  }

  private collectUserBehavior(): Partial<UserBehaviorMetrics> {
    // Collect user behavior metrics from UX manager
    const uxManager = UXManager.getInstance();
    const uxMetrics = uxManager.getUXMetrics();

    return {
      navigationCount: this.userMetrics.navigationCount || 0,
      clickCount: uxMetrics.userInteractions,
      keyboardShortcuts: uxMetrics.keyboardUsageCount,
      sessionDuration: Date.now() - (this.userMetrics.sessionDuration || Date.now())
    };
  }

  getMetrics(): {
    performance: Partial<PerformanceMetrics>;
    userBehavior: Partial<UserBehaviorMetrics>;
    systemHealth: Partial<SystemHealthMetrics>;
  } {
    return {
      performance: { ...this.metrics },
      userBehavior: { ...this.userMetrics },
      systemHealth: { ...this.systemMetrics }
    };
  }

  reset(): void {
    this.metrics = {};
    this.userMetrics = {};
    this.systemMetrics = {};
  }

  destroy(): void {
    if (this.collectInterval) {
      this.memoryManager.unregisterResource(this.collectInterval);
    }
    this.collectors.clear();
    this.reset();
  }
}

// Alert system
class AlertSystem {
  private rules = new Map<string, AlertRule>();
  private activeAlerts = new Map<string, number>();
  private memoryManager = MemoryManager.getInstance();

  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
  }

  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    this.activeAlerts.delete(ruleId);
  }

  checkAlerts(metrics: Partial<PerformanceMetrics>): void {
    const now = Date.now();

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      // Check cooldown
      if (rule.lastTriggered && now - rule.lastTriggered < rule.cooldown * 60000) {
        continue;
      }

      const metricValue = (metrics as any)[rule.metric];
      if (metricValue === undefined) continue;

      const shouldTrigger = this.evaluateCondition(metricValue, rule.condition, rule.threshold);

      if (shouldTrigger) {
        this.triggerAlert(rule, metricValue);
      }
    }
  }

  private evaluateCondition(value: number, condition: AlertRule['condition'], threshold: number): boolean {
    switch (condition) {
      case 'above':
        return value > threshold;
      case 'below':
        return value < threshold;
      case 'equals':
        return Math.abs(value - threshold) < 0.01;
      default:
        return false;
    }
  }

  private triggerAlert(rule: AlertRule, value: number): void {
    console.warn(`Alert triggered: ${rule.name} (${rule.metric}: ${value})`);
    
    rule.lastTriggered = Date.now();
    this.activeAlerts.set(rule.id, Date.now());

    // Execute alert actions
    for (const action of rule.actions) {
      this.executeAlertAction(action, rule, value);
    }
  }

  private executeAlertAction(action: AlertAction, rule: AlertRule, value: number): void {
    switch (action.type) {
      case 'log':
        console.error(`[ALERT] ${rule.name}: ${rule.metric} = ${value}`);
        break;
        
      case 'notify':
        this.showNotification(rule, value);
        break;
        
      case 'auto-fix':
        this.attemptAutoFix(rule, value);
        break;
        
      default:
        console.warn(`Unknown alert action: ${action.type}`);
    }
  }

  private showNotification(rule: AlertRule, value: number): void {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(`Performance Alert: ${rule.name}`, {
          body: `${rule.metric} is ${value}`,
          icon: '/favicon.ico'
        });
      }
    }
  }

  private attemptAutoFix(rule: AlertRule, value: number): void {
    // Implement auto-fix strategies based on the metric
    switch (rule.metric) {
      case 'memoryUsage':
        // Trigger garbage collection and cleanup
        this.memoryManager.cleanupAllResources();
        break;
        
      case 'frameRate':
        // Reduce visual complexity
        console.log('Auto-fix: Reducing visual complexity due to low frame rate');
        break;
        
      default:
        console.log(`No auto-fix available for metric: ${rule.metric}`);
    }
  }

  getActiveAlerts(): AlertRule[] {
    return Array.from(this.rules.values()).filter(rule => 
      this.activeAlerts.has(rule.id)
    );
  }

  clearAlert(ruleId: string): void {
    this.activeAlerts.delete(ruleId);
  }
}

// Event tracking system
class EventTracker {
  private events: MonitoringEvent[] = [];
  private sessionId: string;
  private memoryManager = MemoryManager.getInstance();

  constructor(private config: MonitoringConfig) {
    this.sessionId = this.generateSessionId();
    this.setupEventListeners();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupEventListeners(): void {
    if (typeof window === 'undefined') return;

    // Track page visibility changes
    this.memoryManager.safeAddEventListener(
      document,
      'visibilitychange',
      () => {
        this.trackEvent('system', 'visibility-change', {
          hidden: document.hidden
        });
      }
    );

    // Track unhandled errors
    this.memoryManager.safeAddEventListener(
      window,
      'error',
      (event) => {
        this.trackEvent('error', 'unhandled-error', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack
        });
      }
    );

    // Track unhandled promise rejections
    this.memoryManager.safeAddEventListener(
      window,
      'unhandledrejection',
      (event) => {
        this.trackEvent('error', 'unhandled-rejection', {
          reason: event.reason?.toString(),
          stack: event.reason?.stack
        });
      }
    );

    // Track performance entries
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.trackEvent('performance', entry.entryType, {
              name: entry.name,
              duration: entry.duration,
              startTime: entry.startTime
            });
          }
        });

        observer.observe({ entryTypes: ['measure', 'navigation', 'resource'] });
      } catch (error) {
        console.warn('Performance Observer not supported:', error);
      }
    }
  }

  trackEvent(
    type: MonitoringEvent['type'],
    category: string,
    data: Record<string, any>,
    metadata?: MonitoringEvent['metadata']
  ): void {
    if (!this.config.enabled) return;

    // Sample events based on sample rate
    if (Math.random() > this.config.sampleRate) return;

    const event: MonitoringEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type,
      category,
      data,
      metadata: {
        ...metadata,
        sessionId: this.sessionId,
        url: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        buildVersion: process.env.NEXT_PUBLIC_BUILD_VERSION || 'unknown'
      }
    };

    this.events.push(event);

    // Limit buffer size
    if (this.events.length > this.config.bufferSize) {
      this.events.shift();
    }
  }

  getEvents(filter?: {
    type?: MonitoringEvent['type'];
    category?: string;
    since?: number;
  }): MonitoringEvent[] {
    let filtered = this.events;

    if (filter) {
      if (filter.type) {
        filtered = filtered.filter(event => event.type === filter.type);
      }
      if (filter.category) {
        filtered = filtered.filter(event => event.category === filter.category);
      }
      if (filter.since) {
        filtered = filtered.filter(event => event.timestamp >= filter.since);
      }
    }

    return [...filtered];
  }

  clearEvents(): void {
    this.events = [];
  }

  exportEvents(): string {
    return JSON.stringify(this.events, null, 2);
  }
}

// Main monitoring manager
export class MonitoringManager {
  private static instance: MonitoringManager | null = null;
  private memoryManager = MemoryManager.getInstance();
  
  // Components
  private metricsCollector: MetricsCollector;
  private alertSystem: AlertSystem;
  private eventTracker: EventTracker;
  
  // Configuration
  private config: MonitoringConfig = {
    enabled: true,
    sampleRate: 1.0,
    bufferSize: 1000,
    flushInterval: 5000,
    enableRealTimeMetrics: true,
    enableUserTracking: true,
    enableErrorTracking: true,
    enablePerformanceTracking: true,
    alertsEnabled: true,
    dataRetention: 7
  };

  // State
  private isInitialized = false;
  private dashboardCallbacks = new Set<(data: any) => void>();

  private constructor() {
    this.metricsCollector = new MetricsCollector(this.config);
    this.alertSystem = new AlertSystem();
    this.eventTracker = new EventTracker(this.config);
    
    this.setupDefaultAlerts();
    this.startRealtimeMonitoring();
    this.isInitialized = true;
  }

  static getInstance(): MonitoringManager {
    if (!MonitoringManager.instance) {
      MonitoringManager.instance = new MonitoringManager();
    }
    return MonitoringManager.instance;
  }

  /**
   * Configure monitoring settings
   */
  configure(config: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Recreate components with new config
    this.metricsCollector.destroy();
    this.metricsCollector = new MetricsCollector(this.config);
  }

  /**
   * Track custom event
   */
  track(category: string, action: string, data?: Record<string, any>): void {
    this.eventTracker.trackEvent('user-action', category, {
      action,
      ...data
    });
  }

  /**
   * Track performance timing
   */
  trackTiming(name: string, duration: number, category = 'custom'): void {
    this.eventTracker.trackEvent('performance', category, {
      name,
      duration,
      timestamp: Date.now()
    });
  }

  /**
   * Track error
   */
  trackError(error: Error, context?: Record<string, any>): void {
    this.eventTracker.trackEvent('error', 'application-error', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      ...context
    });
  }

  /**
   * Get real-time metrics
   */
  getMetrics(): {
    performance: Partial<PerformanceMetrics>;
    userBehavior: Partial<UserBehaviorMetrics>;
    systemHealth: Partial<SystemHealthMetrics>;
    alerts: AlertRule[];
    events: MonitoringEvent[];
  } {
    const metrics = this.metricsCollector.getMetrics();
    
    return {
      ...metrics,
      alerts: this.alertSystem.getActiveAlerts(),
      events: this.eventTracker.getEvents({ since: Date.now() - 3600000 }) // Last hour
    };
  }

  /**
   * Subscribe to real-time dashboard updates
   */
  subscribeToDashboard(callback: (data: any) => void): () => void {
    this.dashboardCallbacks.add(callback);
    
    // Send initial data
    callback(this.getMetrics());
    
    return () => {
      this.dashboardCallbacks.delete(callback);
    };
  }

  /**
   * Generate performance report
   */
  generateReport(timeRange: { start: number; end: number }): {
    summary: any;
    performance: any;
    errors: any;
    userBehavior: any;
    recommendations: string[];
  } {
    const events = this.eventTracker.getEvents({
      since: timeRange.start
    }).filter(event => event.timestamp <= timeRange.end);

    const performanceEvents = events.filter(event => event.type === 'performance');
    const errorEvents = events.filter(event => event.type === 'error');
    const userEvents = events.filter(event => event.type === 'user-action');

    return {
      summary: {
        totalEvents: events.length,
        performanceEvents: performanceEvents.length,
        errorEvents: errorEvents.length,
        userEvents: userEvents.length,
        timeRange
      },
      performance: this.analyzePerformance(performanceEvents),
      errors: this.analyzeErrors(errorEvents),
      userBehavior: this.analyzeUserBehavior(userEvents),
      recommendations: this.generateRecommendations(events)
    };
  }

  /**
   * Export monitoring data
   */
  exportData(format: 'json' | 'csv' = 'json'): string {
    const data = {
      config: this.config,
      metrics: this.getMetrics(),
      timestamp: Date.now()
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else {
      // Convert to CSV format
      return this.convertToCSV(data);
    }
  }

  /**
   * Private methods
   */
  private setupDefaultAlerts(): void {
    // Memory usage alert
    this.alertSystem.addRule({
      id: 'high-memory-usage',
      name: 'High Memory Usage',
      metric: 'memoryUsage',
      condition: 'above',
      threshold: 100 * 1024 * 1024, // 100MB
      severity: 'high',
      enabled: true,
      cooldown: 5,
      actions: [
        { type: 'log', config: {} },
        { type: 'auto-fix', config: {} }
      ]
    });

    // Low frame rate alert
    this.alertSystem.addRule({
      id: 'low-frame-rate',
      name: 'Low Frame Rate',
      metric: 'frameRate',
      condition: 'below',
      threshold: 30,
      severity: 'medium',
      enabled: true,
      cooldown: 2,
      actions: [
        { type: 'log', config: {} }
      ]
    });

    // High error rate alert
    this.alertSystem.addRule({
      id: 'high-error-rate',
      name: 'High Error Rate',
      metric: 'errorRate',
      condition: 'above',
      threshold: 0.1, // 10%
      severity: 'critical',
      enabled: true,
      cooldown: 1,
      actions: [
        { type: 'log', config: {} },
        { type: 'notify', config: {} }
      ]
    });
  }

  private startRealtimeMonitoring(): void {
    this.memoryManager.safeSetInterval(() => {
      const metrics = this.metricsCollector.getMetrics();
      
      // Check alerts
      if (this.config.alertsEnabled) {
        this.alertSystem.checkAlerts(metrics.performance);
      }
      
      // Update dashboard subscribers
      if (this.dashboardCallbacks.size > 0) {
        const dashboardData = this.getMetrics();
        this.dashboardCallbacks.forEach(callback => {
          try {
            callback(dashboardData);
          } catch (error) {
            console.error('Dashboard callback error:', error);
          }
        });
      }
      
    }, this.config.flushInterval, 'Real-time monitoring');
  }

  private analyzePerformance(events: MonitoringEvent[]): any {
    const durations = events
      .filter(event => typeof event.data.duration === 'number')
      .map(event => event.data.duration);

    return {
      averageDuration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      totalEvents: events.length
    };
  }

  private analyzeErrors(events: MonitoringEvent[]): any {
    const errorsByCategory = events.reduce((acc, event) => {
      acc[event.category] = (acc[event.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalErrors: events.length,
      errorsByCategory,
      criticalErrors: events.filter(event => event.data.severity === 'critical').length
    };
  }

  private analyzeUserBehavior(events: MonitoringEvent[]): any {
    const actionsByType = events.reduce((acc, event) => {
      const action = event.data.action || 'unknown';
      acc[action] = (acc[action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalActions: events.length,
      actionsByType,
      uniqueActions: Object.keys(actionsByType).length
    };
  }

  private generateRecommendations(events: MonitoringEvent[]): string[] {
    const recommendations: string[] = [];
    
    const errorEvents = events.filter(event => event.type === 'error');
    if (errorEvents.length > 10) {
      recommendations.push('High error rate detected. Consider implementing better error handling.');
    }

    const performanceEvents = events.filter(event => 
      event.type === 'performance' && event.data.duration > 1000
    );
    if (performanceEvents.length > 5) {
      recommendations.push('Slow operations detected. Consider optimizing performance-critical code.');
    }

    const memoryEvents = events.filter(event => 
      event.category === 'memory' && event.data.usage > 50 * 1024 * 1024
    );
    if (memoryEvents.length > 0) {
      recommendations.push('High memory usage detected. Consider implementing memory optimization.');
    }

    return recommendations;
  }

  private convertToCSV(data: any): string {
    // Simple CSV conversion - could be enhanced
    const events = data.metrics.events || [];
    const headers = ['timestamp', 'type', 'category', 'data'];
    const rows = events.map((event: MonitoringEvent) => [
      event.timestamp,
      event.type,
      event.category,
      JSON.stringify(event.data)
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  /**
   * Health check
   */
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    components: Record<string, boolean>;
    uptime: number;
    lastCheck: number;
  } {
    const alerts = this.alertSystem.getActiveAlerts();
    const criticalAlerts = alerts.filter(alert => alert.severity === 'critical');
    const warningAlerts = alerts.filter(alert => alert.severity === 'medium' || alert.severity === 'high');

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (criticalAlerts.length > 0) {
      status = 'critical';
    } else if (warningAlerts.length > 0) {
      status = 'warning';
    }

    return {
      status,
      components: {
        metricsCollector: !!this.metricsCollector,
        alertSystem: !!this.alertSystem,
        eventTracker: !!this.eventTracker,
        monitoring: this.isInitialized
      },
      uptime: Date.now() - (this.isInitialized ? Date.now() : 0),
      lastCheck: Date.now()
    };
  }

  /**
   * Destroy the manager
   */
  destroy(): void {
    this.metricsCollector.destroy();
    this.eventTracker.clearEvents();
    this.dashboardCallbacks.clear();
    
    MonitoringManager.instance = null;
  }
}

export default MonitoringManager;