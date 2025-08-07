import logger from '@/lib/logging/logger';
import PerformanceMonitor from '@/lib/performance/monitor';

export interface UserInteraction {
  id: string;
  sessionId: string;
  userId?: string;
  type: 'click' | 'scroll' | 'navigation' | 'input' | 'focus' | 'blur' | 'resize' | 'keystroke' | 'touch' | 'drag';
  timestamp: number;
  element: {
    tagName: string;
    id?: string;
    className?: string;
    textContent?: string;
    selector: string;
    attributes?: Record<string, string>;
  };
  position: {
    x: number;
    y: number;
    scrollX: number;
    scrollY: number;
    viewport: {
      width: number;
      height: number;
    };
  };
  page: {
    url: string;
    path: string;
    title: string;
    referrer?: string;
  };
  metadata?: Record<string, any>;
}

export interface UserSession {
  sessionId: string;
  userId?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  interactions: UserInteraction[];
  pages: string[];
  userAgent: string;
  device: {
    type: 'mobile' | 'tablet' | 'desktop';
    os: string;
    browser: string;
  };
  performance: {
    avgResponseTime: number;
    errorsCount: number;
    pagesVisited: number;
    totalInteractions: number;
  };
}

export interface HeatmapData {
  x: number;
  y: number;
  intensity: number;
  type: 'click' | 'scroll' | 'hover';
  element: string;
  timestamp: number;
}

export interface UserFlow {
  path: string[];
  frequency: number;
  averageDuration: number;
  dropoffPoints: Array<{
    step: number;
    dropoffRate: number;
  }>;
}

class UserInteractionTracker {
  private static instance: UserInteractionTracker;
  private sessions = new Map<string, UserSession>();
  private currentSessionId: string;
  private interactions: UserInteraction[] = [];
  private heatmapData: HeatmapData[] = [];
  private isTracking = false;
  private trackingConfig = {
    trackClicks: true,
    trackScrolls: true,
    trackInputs: true,
    trackNavigation: true,
    trackHovers: false, // Can be intensive
    sampleRate: 1.0, // Sample 100% of interactions
    maxInteractions: 10000,
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
    debounceScroll: 100, // ms
    debounceResize: 250, // ms
    collectHeatmapData: true,
    respectDoNotTrack: true,
    anonymizeData: true
  };

  static getInstance(): UserInteractionTracker {
    if (!UserInteractionTracker.instance) {
      UserInteractionTracker.instance = new UserInteractionTracker();
    }
    return UserInteractionTracker.instance;
  }

  private constructor() {
    this.currentSessionId = this.generateSessionId();
    
    if (typeof window !== 'undefined') {
      this.initializeSession();
      this.setupEventListeners();
      this.setupSessionManagement();
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateInteractionId(): string {
    return `interaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeSession(): void {
    // Check if user has Do Not Track enabled
    if (this.trackingConfig.respectDoNotTrack && navigator.doNotTrack === '1') {
      logger.info('User interaction tracking disabled due to Do Not Track', {
        component: 'UserInteractionTracker'
      });
      return;
    }

    const session: UserSession = {
      sessionId: this.currentSessionId,
      userId: this.getUserId(),
      startTime: Date.now(),
      interactions: [],
      pages: [window.location.pathname],
      userAgent: navigator.userAgent,
      device: this.getDeviceInfo(),
      performance: {
        avgResponseTime: 0,
        errorsCount: 0,
        pagesVisited: 1,
        totalInteractions: 0
      }
    };

    this.sessions.set(this.currentSessionId, session);
    
    logger.info('User interaction tracking session started', {
      component: 'UserInteractionTracker',
      metadata: {
        sessionId: this.currentSessionId,
        device: session.device,
        page: window.location.pathname
      }
    });
  }

  private setupEventListeners(): void {
    if (!this.trackingConfig.trackClicks && !this.trackingConfig.trackScrolls && 
        !this.trackingConfig.trackInputs && !this.trackingConfig.trackNavigation) {
      return;
    }

    // Click tracking
    if (this.trackingConfig.trackClicks) {
      document.addEventListener('click', this.handleClick, true);
    }

    // Scroll tracking
    if (this.trackingConfig.trackScrolls) {
      let scrollTimeout: NodeJS.Timeout;
      document.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          this.handleScroll();
        }, this.trackingConfig.debounceScroll);
      }, { passive: true });
    }

    // Input tracking
    if (this.trackingConfig.trackInputs) {
      document.addEventListener('input', this.handleInput, true);
      document.addEventListener('focus', this.handleFocus, true);
      document.addEventListener('blur', this.handleBlur, true);
    }

    // Navigation tracking
    if (this.trackingConfig.trackNavigation) {
      window.addEventListener('popstate', this.handleNavigation);
      
      // Override pushState and replaceState to track programmatic navigation
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      
      history.pushState = (...args) => {
        originalPushState.apply(history, args);
        this.handleNavigation();
      };
      
      history.replaceState = (...args) => {
        originalReplaceState.apply(history, args);
        this.handleNavigation();
      };
    }

    // Resize tracking
    let resizeTimeout: NodeJS.Timeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.handleResize();
      }, this.trackingConfig.debounceResize);
    });

    // Page visibility tracking
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    // Hover tracking (optional, can be intensive)
    if (this.trackingConfig.trackHovers) {
      document.addEventListener('mouseover', this.handleHover, true);
    }

    // Touch events for mobile
    document.addEventListener('touchstart', this.handleTouch, { passive: true });
    document.addEventListener('touchmove', this.handleTouchMove, { passive: true });

    this.isTracking = true;
  }

  private setupSessionManagement(): void {
    // End session on page unload
    window.addEventListener('beforeunload', () => {
      this.endSession();
    });

    // Extend session on activity
    setInterval(() => {
      this.checkSessionTimeout();
    }, 60000); // Check every minute

    // Clean up old data periodically
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private handleClick = (event: MouseEvent) => {
    if (Math.random() > this.trackingConfig.sampleRate) return;

    const target = event.target as Element;
    if (!target) return;

    const interaction = this.createInteraction('click', target, {
      button: event.button,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey
    });

    this.trackInteraction(interaction);

    // Collect heatmap data
    if (this.trackingConfig.collectHeatmapData) {
      this.collectHeatmapData('click', event.clientX, event.clientY, target);
    }
  };

  private handleScroll = () => {
    if (Math.random() > this.trackingConfig.sampleRate) return;

    const interaction = this.createInteraction('scroll', document.body, {
      scrollTop: window.scrollY,
      scrollLeft: window.scrollX,
      documentHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      scrollPercentage: (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
    });

    this.trackInteraction(interaction);

    // Collect heatmap data for scroll positions
    if (this.trackingConfig.collectHeatmapData) {
      this.collectHeatmapData('scroll', window.innerWidth / 2, window.scrollY, document.body);
    }
  };

  private handleInput = (event: Event) => {
    if (Math.random() > this.trackingConfig.sampleRate) return;

    const target = event.target as HTMLInputElement;
    if (!target) return;

    // Don't track sensitive input fields
    if (this.isSensitiveInput(target)) return;

    const interaction = this.createInteraction('input', target, {
      inputType: target.type,
      inputLength: target.value.length,
      placeholder: target.placeholder,
      // Don't store actual input value for privacy
      hasValue: target.value.length > 0
    });

    this.trackInteraction(interaction);
  };

  private handleFocus = (event: FocusEvent) => {
    if (Math.random() > this.trackingConfig.sampleRate) return;

    const target = event.target as Element;
    if (!target) return;

    const interaction = this.createInteraction('focus', target);
    this.trackInteraction(interaction);
  };

  private handleBlur = (event: FocusEvent) => {
    if (Math.random() > this.trackingConfig.sampleRate) return;

    const target = event.target as Element;
    if (!target) return;

    const interaction = this.createInteraction('blur', target);
    this.trackInteraction(interaction);
  };

  private handleNavigation = () => {
    const interaction = this.createInteraction('navigation', document.body, {
      fromPath: this.getCurrentSession()?.pages.slice(-1)[0] || '',
      toPath: window.location.pathname,
      referrer: document.referrer,
      navigationTiming: this.getNavigationTiming()
    });

    this.trackInteraction(interaction);

    // Update session pages
    const session = this.getCurrentSession();
    if (session && !session.pages.includes(window.location.pathname)) {
      session.pages.push(window.location.pathname);
      session.performance.pagesVisited++;
    }

    logger.info('Page navigation tracked', {
      component: 'UserInteractionTracker',
      metadata: {
        sessionId: this.currentSessionId,
        path: window.location.pathname,
        referrer: document.referrer
      }
    });
  };

  private handleResize = () => {
    const interaction = this.createInteraction('resize', document.body, {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
      devicePixelRatio: window.devicePixelRatio
    });

    this.trackInteraction(interaction);
  };

  private handleVisibilityChange = () => {
    if (document.hidden) {
      this.pauseTracking();
    } else {
      this.resumeTracking();
    }
  };

  private handleHover = (event: MouseEvent) => {
    if (Math.random() > this.trackingConfig.sampleRate) return;

    const target = event.target as Element;
    if (!target) return;

    // Collect heatmap data for hovers (throttled)
    if (this.trackingConfig.collectHeatmapData) {
      this.collectHeatmapData('hover', event.clientX, event.clientY, target);
    }
  };

  private handleTouch = (event: TouchEvent) => {
    if (Math.random() > this.trackingConfig.sampleRate) return;

    const touch = event.touches[0];
    const target = event.target as Element;
    if (!touch || !target) return;

    const interaction = this.createInteraction('touch', target, {
      touchCount: event.touches.length,
      touchType: 'start',
      force: (touch as any).force || 0
    });

    this.trackInteraction(interaction);
  };

  private handleTouchMove = (event: TouchEvent) => {
    // Only sample touch moves heavily to avoid spam
    if (Math.random() > this.trackingConfig.sampleRate * 0.1) return;

    const touch = event.touches[0];
    const target = event.target as Element;
    if (!touch || !target) return;

    const interaction = this.createInteraction('touch', target, {
      touchCount: event.touches.length,
      touchType: 'move',
      force: (touch as any).force || 0
    });

    this.trackInteraction(interaction);
  };

  private createInteraction(
    type: UserInteraction['type'], 
    element: Element, 
    metadata?: Record<string, any>
  ): UserInteraction {
    return {
      id: this.generateInteractionId(),
      sessionId: this.currentSessionId,
      userId: this.getUserId(),
      type,
      timestamp: Date.now(),
      element: this.getElementInfo(element),
      position: this.getPositionInfo(),
      page: this.getPageInfo(),
      metadata
    };
  }

  private getElementInfo(element: Element): UserInteraction['element'] {
    return {
      tagName: element.tagName.toLowerCase(),
      id: element.id || undefined,
      className: element.className || undefined,
      textContent: this.trackingConfig.anonymizeData 
        ? undefined 
        : element.textContent?.substring(0, 100) || undefined,
      selector: this.getElementSelector(element),
      attributes: this.getRelevantAttributes(element)
    };
  }

  private getElementSelector(element: Element): string {
    const path: string[] = [];
    let current = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      
      if (current.id) {
        selector += `#${current.id}`;
        path.unshift(selector);
        break;
      } else if (current.className) {
        const classes = current.className.split(' ').filter(c => c).slice(0, 2);
        if (classes.length > 0) {
          selector += `.${classes.join('.')}`;
        }
      }

      path.unshift(selector);
      current = current.parentElement!;

      if (path.length > 5) break; // Limit selector depth
    }

    return path.join(' > ');
  }

  private getRelevantAttributes(element: Element): Record<string, string> {
    const relevantAttrs = ['data-testid', 'aria-label', 'role', 'type', 'name'];
    const attributes: Record<string, string> = {};

    for (const attr of relevantAttrs) {
      const value = element.getAttribute(attr);
      if (value) {
        attributes[attr] = value;
      }
    }

    return attributes;
  }

  private getPositionInfo(): UserInteraction['position'] {
    return {
      x: 0, // Will be set by event handlers
      y: 0, // Will be set by event handlers
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    };
  }

  private getPageInfo(): UserInteraction['page'] {
    return {
      url: window.location.href,
      path: window.location.pathname,
      title: document.title,
      referrer: document.referrer || undefined
    };
  }

  private getDeviceInfo(): UserSession['device'] {
    const ua = navigator.userAgent;
    
    let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
    if (/Mobile|Android|iPhone|iPad/.test(ua)) {
      deviceType = /iPad/.test(ua) ? 'tablet' : 'mobile';
    }

    let os = 'unknown';
    if (/Windows/.test(ua)) os = 'windows';
    else if (/Mac/.test(ua)) os = 'macos';
    else if (/Linux/.test(ua)) os = 'linux';
    else if (/Android/.test(ua)) os = 'android';
    else if (/iPhone|iPad/.test(ua)) os = 'ios';

    let browser = 'unknown';
    if (/Chrome/.test(ua)) browser = 'chrome';
    else if (/Firefox/.test(ua)) browser = 'firefox';
    else if (/Safari/.test(ua)) browser = 'safari';
    else if (/Edge/.test(ua)) browser = 'edge';

    return { type: deviceType, os, browser };
  }

  private getNavigationTiming() {
    if ('performance' in window) {
      const timing = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (timing) {
        return {
          loadTime: timing.loadEventEnd - timing.loadEventStart,
          domContentLoaded: timing.domContentLoadedEventEnd - timing.domContentLoadedEventStart,
          timeToFirstByte: timing.responseStart - timing.requestStart
        };
      }
    }
    return undefined;
  }

  private isSensitiveInput(element: HTMLInputElement): boolean {
    const sensitiveTypes = ['password', 'email', 'tel', 'number'];
    const sensitiveName = ['password', 'email', 'phone', 'ssn', 'credit'];
    
    if (sensitiveTypes.includes(element.type)) return true;
    if (sensitiveName.some(name => element.name.toLowerCase().includes(name))) return true;
    if (element.autocomplete === 'cc-number' || element.autocomplete === 'current-password') return true;
    
    return false;
  }

  private getUserId(): string | undefined {
    try {
      return localStorage.getItem('userId') || undefined;
    } catch (error) {
      return undefined;
    }
  }

  private getCurrentSession(): UserSession | undefined {
    return this.sessions.get(this.currentSessionId);
  }

  private trackInteraction(interaction: UserInteraction): void {
    if (!this.isTracking) return;

    // Set actual position from current mouse/touch position if available
    interaction.position.x = (window as any).lastMouseX || 0;
    interaction.position.y = (window as any).lastMouseY || 0;

    this.interactions.push(interaction);

    // Add to session
    const session = this.getCurrentSession();
    if (session) {
      session.interactions.push(interaction);
      session.performance.totalInteractions++;
    }

    // Trim interactions if too many
    if (this.interactions.length > this.trackingConfig.maxInteractions) {
      this.interactions.shift();
    }

    // Log interaction
    logger.debug('User interaction tracked', {
      component: 'UserInteractionTracker',
      metadata: {
        sessionId: this.currentSessionId,
        type: interaction.type,
        element: interaction.element.tagName,
        page: interaction.page.path
      }
    });

    // Send to performance monitor
    const performanceMonitor = PerformanceMonitor.getInstance();
    performanceMonitor.trackInteraction({
      type: interaction.type,
      element: interaction.element.selector,
      metadata: {
        page: interaction.page.path,
        sessionId: this.currentSessionId
      }
    });
  }

  private collectHeatmapData(type: 'click' | 'scroll' | 'hover', x: number, y: number, element: Element): void {
    const heatmapPoint: HeatmapData = {
      x: Math.round(x),
      y: Math.round(y),
      intensity: 1,
      type,
      element: element.tagName.toLowerCase(),
      timestamp: Date.now()
    };

    this.heatmapData.push(heatmapPoint);

    // Trim heatmap data
    if (this.heatmapData.length > 5000) {
      this.heatmapData.shift();
    }
  }

  private checkSessionTimeout(): void {
    const session = this.getCurrentSession();
    if (!session) return;

    const now = Date.now();
    const lastInteraction = session.interactions[session.interactions.length - 1];
    
    if (lastInteraction && now - lastInteraction.timestamp > this.trackingConfig.sessionTimeout) {
      this.endSession();
      this.startNewSession();
    }
  }

  private cleanup(): void {
    // Remove old sessions (older than 24 hours)
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.startTime < cutoff) {
        this.sessions.delete(sessionId);
      }
    }

    // Trim old interactions
    const interactionCutoff = Date.now() - 2 * 60 * 60 * 1000; // 2 hours
    this.interactions = this.interactions.filter(i => i.timestamp > interactionCutoff);

    // Trim old heatmap data
    this.heatmapData = this.heatmapData.filter(h => h.timestamp > interactionCutoff);
  }

  private pauseTracking(): void {
    this.isTracking = false;
    logger.debug('User interaction tracking paused', {
      component: 'UserInteractionTracker',
      metadata: { sessionId: this.currentSessionId }
    });
  }

  private resumeTracking(): void {
    this.isTracking = true;
    logger.debug('User interaction tracking resumed', {
      component: 'UserInteractionTracker',
      metadata: { sessionId: this.currentSessionId }
    });
  }

  private endSession(): void {
    const session = this.getCurrentSession();
    if (session && !session.endTime) {
      session.endTime = Date.now();
      session.duration = session.endTime - session.startTime;
      
      // Calculate final performance metrics
      const responseTimes = session.interactions
        .filter(i => i.metadata?.responseTime)
        .map(i => i.metadata!.responseTime);
      
      session.performance.avgResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;

      logger.info('User interaction session ended', {
        component: 'UserInteractionTracker',
        metadata: {
          sessionId: this.currentSessionId,
          duration: session.duration,
          interactions: session.interactions.length,
          pagesVisited: session.performance.pagesVisited
        }
      });

      // Send session data to analytics service
      this.sendSessionData(session);
    }
  }

  private startNewSession(): void {
    this.currentSessionId = this.generateSessionId();
    this.initializeSession();
  }

  private async sendSessionData(session: UserSession): Promise<void> {
    try {
      await fetch('/api/analytics/user-interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session,
          heatmapData: this.heatmapData.filter(h => h.timestamp >= session.startTime)
        })
      });
    } catch (error) {
      logger.debug('Failed to send session data', {
        component: 'UserInteractionTracker',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
  }

  // Public API
  public getInteractions(limit = 100): UserInteraction[] {
    return this.interactions.slice(-limit);
  }

  public getCurrentSessionData(): UserSession | undefined {
    return this.getCurrentSession();
  }

  public getHeatmapData(type?: HeatmapData['type']): HeatmapData[] {
    return type 
      ? this.heatmapData.filter(h => h.type === type)
      : this.heatmapData;
  }

  public getUserFlows(): UserFlow[] {
    const flows = new Map<string, { count: number; durations: number[] }>();
    
    for (const session of this.sessions.values()) {
      if (session.pages.length > 1) {
        const pathKey = session.pages.join(' -> ');
        const existing = flows.get(pathKey);
        
        if (existing) {
          existing.count++;
          if (session.duration) existing.durations.push(session.duration);
        } else {
          flows.set(pathKey, {
            count: 1,
            durations: session.duration ? [session.duration] : []
          });
        }
      }
    }

    return Array.from(flows.entries()).map(([path, data]) => ({
      path: path.split(' -> '),
      frequency: data.count,
      averageDuration: data.durations.length > 0 
        ? data.durations.reduce((a, b) => a + b, 0) / data.durations.length 
        : 0,
      dropoffPoints: [] // Would be calculated based on more complex analysis
    }));
  }

  public updateConfig(config: Partial<typeof this.trackingConfig>): void {
    this.trackingConfig = { ...this.trackingConfig, ...config };
  }

  public getConfig(): typeof this.trackingConfig {
    return { ...this.trackingConfig };
  }

  public clearData(): void {
    this.interactions = [];
    this.heatmapData = [];
    this.sessions.clear();
    this.startNewSession();
    
    logger.info('User interaction data cleared', {
      component: 'UserInteractionTracker'
    });
  }
}

// Track mouse position globally for accurate interaction positioning
if (typeof window !== 'undefined') {
  document.addEventListener('mousemove', (e) => {
    (window as any).lastMouseX = e.clientX;
    (window as any).lastMouseY = e.clientY;
  });
}

export { UserInteractionTracker };
export default UserInteractionTracker;