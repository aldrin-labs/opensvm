import logger from '@/lib/logging/logger';
import { ErrorBoundaryService, ErrorReport } from '@/lib/error/error-boundary-service';
import PerformanceMonitor from '@/lib/performance/monitor';

export interface CrashReport {
  id: string;
  timestamp: number;
  type: 'javascript' | 'react' | 'network' | 'performance' | 'unhandled' | 'memory' | 'security';
  severity: 'low' | 'medium' | 'high' | 'critical';
  error: {
    name: string;
    message: string;
    stack?: string;
    cause?: any;
  };
  context: {
    url: string;
    userAgent: string;
    userId?: string;
    sessionId: string;
    component?: string;
    action?: string;
    props?: Record<string, any>;
    state?: Record<string, any>;
  };
  environment: {
    timestamp: number;
    viewport: { width: number; height: number };
    memory?: { used: number; total: number; limit: number };
    performance?: {
      fps: number;
      loadTime: number;
      apiResponseTime: number;
    };
    network?: {
      effectiveType: string;
      downlink: number;
      rtt: number;
    };
    device: {
      platform: string;
      language: string;
      timezone: string;
      cookieEnabled: boolean;
      doNotTrack: boolean;
    };
  };
  breadcrumbs: CrashBreadcrumb[];
  tags: string[];
  fingerprint: string;
  metadata?: Record<string, any>;
}

export interface CrashBreadcrumb {
  timestamp: number;
  category: 'navigation' | 'user' | 'api' | 'console' | 'dom' | 'error';
  level: 'debug' | 'info' | 'warning' | 'error';
  message: string;
  data?: Record<string, any>;
}

export interface CrashAggregation {
  fingerprint: string;
  firstSeen: number;
  lastSeen: number;
  count: number;
  uniqueUsers: Set<string>;
  crashes: CrashReport[];
  patterns: {
    mostCommonBrowsers: Record<string, number>;
    mostCommonPages: Record<string, number>;
    mostCommonComponents: Record<string, number>;
    timePattern: Record<string, number>; // Hour of day
  };
  resolved: boolean;
  assignee?: string;
  notes?: string;
}

class CrashReporter {
  private static instance: CrashReporter;
  private crashes = new Map<string, CrashReport>();
  private aggregations = new Map<string, CrashAggregation>();
  private breadcrumbs: CrashBreadcrumb[] = [];
  private sessionId: string;
  private maxBreadcrumbs = 100;
  private maxCrashes = 1000;
  private enabled = true;
  private config = {
    enableBreadcrumbs: true,
    enablePerformanceContext: true,
    enableNetworkContext: true,
    enableAutoReporting: true,
    samplingRate: 1.0,
    maxStackTraceLength: 5000,
    maxBreadcrumbs: 100,
    breadcrumbCategories: {
      navigation: true,
      user: true,
      api: true,
      console: true,
      dom: true,
      error: true
    }
  };

  static getInstance(): CrashReporter {
    if (!CrashReporter.instance) {
      CrashReporter.instance = new CrashReporter();
    }
    return CrashReporter.instance;
  }

  private constructor() {
    this.sessionId = this.generateSessionId();
    
    if (typeof window !== 'undefined') {
      this.setupGlobalCrashHandling();
      this.setupBreadcrumbTracking();
      this.startPeriodicCleanup();
    }
  }

  private generateSessionId(): string {
    return `crash_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupGlobalCrashHandling(): void {
    // JavaScript errors
    window.addEventListener('error', (event) => {
      this.reportCrash({
        type: 'javascript',
        error: new Error(event.message),
        context: {
          component: 'GlobalErrorHandler',
          action: 'error-event',
          metadata: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
          }
        }
      });
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason instanceof Error 
        ? event.reason 
        : new Error(String(event.reason));
      
      this.reportCrash({
        type: 'unhandled',
        error,
        context: {
          component: 'GlobalErrorHandler',
          action: 'unhandled-promise',
          metadata: { promise: event.promise }
        }
      });
    });

    // Security errors (CSP violations)
    document.addEventListener('securitypolicyviolation', (event) => {
      this.reportCrash({
        type: 'security',
        error: new Error(`CSP Violation: ${event.violatedDirective}`),
        context: {
          component: 'SecurityHandler',
          action: 'csp-violation',
          metadata: {
            violatedDirective: event.violatedDirective,
            blockedURI: event.blockedURI,
            documentURI: event.documentURI,
            originalPolicy: event.originalPolicy
          }
        }
      });
    });

    // Memory pressure warnings (if supported)
    if ('memory' in performance) {
      setInterval(() => {
        const memory = (performance as any).memory;
        const usagePercent = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
        
        if (usagePercent > 0.9) {
          this.reportCrash({
            type: 'memory',
            error: new Error(`High memory usage: ${(usagePercent * 100).toFixed(1)}%`),
            context: {
              component: 'MemoryMonitor',
              action: 'high-memory-usage',
              metadata: {
                usedJSHeapSize: memory.usedJSHeapSize,
                totalJSHeapSize: memory.totalJSHeapSize,
                jsHeapSizeLimit: memory.jsHeapSizeLimit,
                usagePercent
              }
            },
            severity: usagePercent > 0.95 ? 'critical' : 'high'
          });
        }
      }, 30000); // Check every 30 seconds
    }

    // Network errors monitoring
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        
        if (!response.ok && response.status >= 500) {
          this.addBreadcrumb({
            category: 'api',
            level: 'error',
            message: `Network error: ${response.status} ${response.statusText}`,
            data: {
              url: args[0],
              status: response.status,
              statusText: response.statusText
            }
          });
          
          // Report as crash for 5xx errors
          this.reportCrash({
            type: 'network',
            error: new Error(`Network error: ${response.status} ${response.statusText}`),
            context: {
              component: 'NetworkHandler',
              action: 'fetch-error',
              metadata: {
                url: args[0],
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries())
              }
            },
            severity: response.status >= 500 ? 'high' : 'medium'
          });
        }
        
        return response;
      } catch (error) {
        this.addBreadcrumb({
          category: 'api',
          level: 'error',
          message: `Fetch failed: ${error}`,
          data: { url: args[0], error: String(error) }
        });
        
        this.reportCrash({
          type: 'network',
          error: error instanceof Error ? error : new Error(String(error)),
          context: {
            component: 'NetworkHandler',
            action: 'fetch-exception',
            metadata: { url: args[0] }
          }
        });
        
        throw error;
      }
    };
  }

  private setupBreadcrumbTracking(): void {
    if (!this.config.enableBreadcrumbs) return;

    // Navigation breadcrumbs
    if (this.config.breadcrumbCategories.navigation) {
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      
      history.pushState = (...args) => {
        originalPushState.apply(history, args);
        this.addBreadcrumb({
          category: 'navigation',
          level: 'info',
          message: `Navigation to ${location.pathname}`,
          data: { url: location.href, method: 'pushState' }
        });
      };
      
      history.replaceState = (...args) => {
        originalReplaceState.apply(history, args);
        this.addBreadcrumb({
          category: 'navigation',
          level: 'info',
          message: `Navigation to ${location.pathname}`,
          data: { url: location.href, method: 'replaceState' }
        });
      };
    }

    // User interaction breadcrumbs
    if (this.config.breadcrumbCategories.user) {
      document.addEventListener('click', (event) => {
        const target = event.target as Element;
        if (target) {
          this.addBreadcrumb({
            category: 'user',
            level: 'info',
            message: `Clicked ${target.tagName.toLowerCase()}`,
            data: {
              element: target.tagName.toLowerCase(),
              id: target.id || undefined,
              className: target.className || undefined,
              textContent: target.textContent?.substring(0, 50) || undefined
            }
          });
        }
      });
    }

    // Console breadcrumbs
    if (this.config.breadcrumbCategories.console) {
      const originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error
      };
      
      console.error = (...args) => {
        originalConsole.error(...args);
        this.addBreadcrumb({
          category: 'console',
          level: 'error',
          message: args.join(' '),
          data: { type: 'console.error' }
        });
      };
      
      console.warn = (...args) => {
        originalConsole.warn(...args);
        this.addBreadcrumb({
          category: 'console',
          level: 'warning',
          message: args.join(' '),
          data: { type: 'console.warn' }
        });
      };
    }

    // DOM mutations (throttled)
    if (this.config.breadcrumbCategories.dom && 'MutationObserver' in window) {
      let mutationCount = 0;
      const observer = new MutationObserver((mutations) => {
        mutationCount += mutations.length;
        
        // Throttle DOM mutation breadcrumbs
        if (mutationCount > 10) {
          this.addBreadcrumb({
            category: 'dom',
            level: 'debug',
            message: `DOM mutations: ${mutationCount} changes`,
            data: { count: mutationCount }
          });
          mutationCount = 0;
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true
      });
    }
  }

  private startPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private cleanup(): void {
    // Remove old crashes (older than 24 hours)
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    
    for (const [id, crash] of this.crashes.entries()) {
      if (crash.timestamp < cutoff) {
        this.crashes.delete(id);
      }
    }

    // Trim breadcrumbs
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(-this.maxBreadcrumbs);
    }

    // Limit crashes
    if (this.crashes.size > this.maxCrashes) {
      const entries = Array.from(this.crashes.entries())
        .sort(([, a], [, b]) => b.timestamp - a.timestamp)
        .slice(0, this.maxCrashes);
      
      this.crashes.clear();
      for (const [id, crash] of entries) {
        this.crashes.set(id, crash);
      }
    }
  }

  public addBreadcrumb(breadcrumb: Omit<CrashBreadcrumb, 'timestamp'>): void {
    if (!this.config.enableBreadcrumbs || !this.enabled) return;

    const fullBreadcrumb: CrashBreadcrumb = {
      ...breadcrumb,
      timestamp: Date.now()
    };

    this.breadcrumbs.push(fullBreadcrumb);

    // Trim breadcrumbs if needed
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }
  }

  public reportCrash(crashData: {
    type: CrashReport['type'];
    error: Error;
    context?: Partial<CrashReport['context']>;
    severity?: CrashReport['severity'];
    metadata?: Record<string, any>;
  }): string {
    if (!this.enabled || Math.random() > this.config.samplingRate) {
      return '';
    }

    const crashId = this.generateCrashId();
    const timestamp = Date.now();
    
    // Determine severity if not provided
    const severity = crashData.severity || this.calculateSeverity(crashData.type, crashData.error);

    // Generate fingerprint for aggregation
    const fingerprint = this.generateFingerprint(crashData.error, crashData.context);

    const crash: CrashReport = {
      id: crashId,
      timestamp,
      type: crashData.type,
      severity,
      error: {
        name: crashData.error.name,
        message: crashData.error.message,
        stack: crashData.error.stack?.substring(0, this.config.maxStackTraceLength),
        cause: crashData.error.cause
      },
      context: {
        url: typeof window !== 'undefined' ? window.location.href : 'unknown',
        userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'unknown',
        userId: this.getUserId(),
        sessionId: this.sessionId,
        component: crashData.context?.component,
        action: crashData.context?.action,
        props: crashData.context?.props,
        state: crashData.context?.state,
        ...crashData.context
      },
      environment: this.collectEnvironmentData(),
      breadcrumbs: this.getBreadcrumbsSnapshot(),
      tags: this.generateTags(crashData.type, crashData.error, crashData.context),
      fingerprint,
      metadata: crashData.metadata
    };

    // Store crash
    this.crashes.set(crashId, crash);

    // Update aggregation
    this.updateAggregation(crash);

    // Log crash
    logger.error('Crash reported', {
      component: 'CrashReporter',
      metadata: {
        crashId,
        type: crash.type,
        severity: crash.severity,
        fingerprint,
        component: crash.context.component,
        errorMessage: crash.error.message
      }
    });

    // Send to external services
    if (this.config.enableAutoReporting) {
      this.sendCrashReport(crash);
    }

    // Emit crash event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('crash-reported', { detail: crash }));
    }

    return crashId;
  }

  private generateCrashId(): string {
    return `crash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateSeverity(type: CrashReport['type'], error: Error): CrashReport['severity'] {
    // Critical crashes
    if (type === 'security' || type === 'memory') return 'critical';
    if (error.name === 'SecurityError') return 'critical';
    if (error.message.includes('CRITICAL')) return 'critical';

    // High severity crashes
    if (type === 'react' || type === 'unhandled') return 'high';
    if (error.name === 'TypeError' || error.name === 'ReferenceError') return 'high';
    if (error.message.includes('Cannot read properties')) return 'high';

    // Medium severity crashes
    if (type === 'network' || type === 'performance') return 'medium';
    if (error.name === 'NetworkError') return 'medium';

    return 'low';
  }

  private generateFingerprint(error: Error, context?: Partial<CrashReport['context']>): string {
    const key = `${error.name}:${error.message}:${context?.component}:${error.stack?.split('\n')[0] || ''}`;
    return btoa(key).replace(/[+/=]/g, '').substring(0, 16);
  }

  private collectEnvironmentData(): CrashReport['environment'] {
    const env: CrashReport['environment'] = {
      timestamp: Date.now(),
      viewport: {
        width: typeof window !== 'undefined' ? window.innerWidth : 0,
        height: typeof window !== 'undefined' ? window.innerHeight : 0
      },
      device: {
        platform: typeof window !== 'undefined' ? navigator.platform : 'unknown',
        language: typeof window !== 'undefined' ? navigator.language : 'unknown',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        cookieEnabled: typeof window !== 'undefined' ? navigator.cookieEnabled : false,
        doNotTrack: typeof window !== 'undefined' ? navigator.doNotTrack === '1' : false
      }
    };

    // Add memory info if available
    if (this.config.enablePerformanceContext && 'memory' in performance) {
      const memory = (performance as any).memory;
      env.memory = {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit
      };
    }

    // Add performance metrics if available
    if (this.config.enablePerformanceContext) {
      try {
        const performanceMonitor = PerformanceMonitor.getInstance();
        const metrics = performanceMonitor.getLatestMetrics();
        
        if (metrics) {
          env.performance = {
            fps: metrics.fps,
            loadTime: metrics.loadTime || 0,
            apiResponseTime: metrics.apiResponseTime
          };
        }
      } catch (error) {
        // Ignore performance collection errors
      }
    }

    // Add network info if available
    if (this.config.enableNetworkContext && 'connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        env.network = {
          effectiveType: connection.effectiveType || 'unknown',
          downlink: connection.downlink || 0,
          rtt: connection.rtt || 0
        };
      }
    }

    return env;
  }

  private getBreadcrumbsSnapshot(): CrashBreadcrumb[] {
    return [...this.breadcrumbs].slice(-50); // Last 50 breadcrumbs
  }

  private generateTags(type: CrashReport['type'], error: Error, context?: Partial<CrashReport['context']>): string[] {
    const tags = [
      `type:${type}`,
      `error:${error.name}`,
      `severity:${this.calculateSeverity(type, error)}`
    ];

    if (context?.component) {
      tags.push(`component:${context.component}`);
    }

    if (typeof window !== 'undefined') {
      tags.push(`browser:${this.getBrowserName()}`);
      tags.push(`os:${this.getOSName()}`);
    }

    return tags;
  }

  private getBrowserName(): string {
    const ua = navigator.userAgent;
    if (ua.includes('Chrome')) return 'chrome';
    if (ua.includes('Firefox')) return 'firefox';
    if (ua.includes('Safari')) return 'safari';
    if (ua.includes('Edge')) return 'edge';
    return 'unknown';
  }

  private getOSName(): string {
    const ua = navigator.userAgent;
    if (ua.includes('Windows')) return 'windows';
    if (ua.includes('Mac')) return 'macos';
    if (ua.includes('Linux')) return 'linux';
    if (ua.includes('Android')) return 'android';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'ios';
    return 'unknown';
  }

  private getUserId(): string | undefined {
    try {
      return typeof window !== 'undefined' ? localStorage.getItem('userId') || undefined : undefined;
    } catch (error) {
      return undefined;
    }
  }

  private updateAggregation(crash: CrashReport): void {
    const existing = this.aggregations.get(crash.fingerprint);
    
    if (existing) {
      existing.lastSeen = crash.timestamp;
      existing.count++;
      existing.crashes.push(crash);
      if (crash.context.userId) {
        existing.uniqueUsers.add(crash.context.userId);
      }
      
      // Update patterns
      const browser = this.getBrowserName();
      const page = crash.context.url;
      const component = crash.context.component || 'unknown';
      const hour = new Date(crash.timestamp).getHours().toString();
      
      existing.patterns.mostCommonBrowsers[browser] = (existing.patterns.mostCommonBrowsers[browser] || 0) + 1;
      existing.patterns.mostCommonPages[page] = (existing.patterns.mostCommonPages[page] || 0) + 1;
      existing.patterns.mostCommonComponents[component] = (existing.patterns.mostCommonComponents[component] || 0) + 1;
      existing.patterns.timePattern[hour] = (existing.patterns.timePattern[hour] || 0) + 1;
    } else {
      const aggregation: CrashAggregation = {
        fingerprint: crash.fingerprint,
        firstSeen: crash.timestamp,
        lastSeen: crash.timestamp,
        count: 1,
        uniqueUsers: new Set(crash.context.userId ? [crash.context.userId] : []),
        crashes: [crash],
        patterns: {
          mostCommonBrowsers: { [this.getBrowserName()]: 1 },
          mostCommonPages: { [crash.context.url]: 1 },
          mostCommonComponents: { [crash.context.component || 'unknown']: 1 },
          timePattern: { [new Date(crash.timestamp).getHours().toString()]: 1 }
        },
        resolved: false
      };
      
      this.aggregations.set(crash.fingerprint, aggregation);
    }
  }

  private async sendCrashReport(crash: CrashReport): Promise<void> {
    try {
      await fetch('/api/crash-reporting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(crash)
      });
    } catch (error) {
      // Don't let crash reporting errors cause more crashes
      console.error('Failed to send crash report:', error);
    }
  }

  // Integration with ErrorBoundaryService
  public reportReactError(error: Error, errorInfo: React.ErrorInfo, component?: string): string {
    return this.reportCrash({
      type: 'react',
      error,
      context: {
        component,
        action: 'component-error',
        metadata: {
          componentStack: errorInfo.componentStack
        }
      }
    });
  }

  // Public API
  public getCrashes(options?: {
    type?: CrashReport['type'];
    severity?: CrashReport['severity'];
    since?: number;
    limit?: number;
  }): CrashReport[] {
    let crashes = Array.from(this.crashes.values());
    
    if (options?.type) {
      crashes = crashes.filter(c => c.type === options.type);
    }
    
    if (options?.severity) {
      crashes = crashes.filter(c => c.severity === options.severity);
    }
    
    if (options?.since) {
      crashes = crashes.filter(c => c.timestamp >= options.since!);
    }
    
    crashes.sort((a, b) => b.timestamp - a.timestamp);
    
    if (options?.limit) {
      crashes = crashes.slice(0, options.limit);
    }
    
    return crashes;
  }

  public getAggregations(): CrashAggregation[] {
    return Array.from(this.aggregations.values())
      .sort((a, b) => b.count - a.count);
  }

  public getCrashById(crashId: string): CrashReport | undefined {
    return this.crashes.get(crashId);
  }

  public getAggregationByFingerprint(fingerprint: string): CrashAggregation | undefined {
    return this.aggregations.get(fingerprint);
  }

  public resolveAggregation(fingerprint: string, assignee?: string, notes?: string): boolean {
    const aggregation = this.aggregations.get(fingerprint);
    if (aggregation) {
      aggregation.resolved = true;
      aggregation.assignee = assignee;
      aggregation.notes = notes;
      
      logger.info('Crash aggregation resolved', {
        component: 'CrashReporter',
        metadata: { fingerprint, assignee, notes }
      });
      
      return true;
    }
    return false;
  }

  public updateConfig(config: Partial<typeof this.config>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): typeof this.config {
    return { ...this.config };
  }

  public clearCrashes(): void {
    this.crashes.clear();
    this.aggregations.clear();
    this.breadcrumbs = [];
    
    logger.info('Crash data cleared', {
      component: 'CrashReporter'
    });
  }

  public enable(): void {
    this.enabled = true;
  }

  public disable(): void {
    this.enabled = false;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }
}

export { CrashReporter };
export default CrashReporter;