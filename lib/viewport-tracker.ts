/**
 * Viewport Tracker Service
 * Tracks which table rows are visible and manages real-time dashboard updates
 */

export interface ViewportItem {
  id: string;
  element: HTMLElement;
  data: any;
  isVisible: boolean;
}

export interface ViewportStats {
  totalVisible: number;
  visibleItems: ViewportItem[];
  scrollPercentage: number;
  totalBalance: number;
  avgDataSize: number;
  executableCount: number;
}

export class ViewportTracker {
  private observer: IntersectionObserver | null = null;
  private items: Map<string, ViewportItem> = new Map();
  private callbacks: Set<(stats: ViewportStats) => void> = new Set();
  private updateTimeout: NodeJS.Timeout | null = null;
  private container: HTMLElement | null = null;

  constructor(private options: {
    rootMargin?: string;
    threshold?: number;
    debounceMs?: number;
  } = {}) {
    this.options = {
      rootMargin: '0px',
      threshold: 0.1,
      debounceMs: 300,
      ...options
    };
  }

  /**
   * Initialize the viewport tracker with a container element
   */
  initialize(container: HTMLElement): void {
    this.container = container;
    this.observer = new IntersectionObserver(
      this.handleIntersection.bind(this),
      {
        root: container,
        rootMargin: this.options.rootMargin,
        threshold: this.options.threshold
      }
    );
  }

  /**
   * Track a new item in the viewport
   */
  trackItem(id: string, element: HTMLElement, data: any): void {
    if (!this.observer) return;

    const item: ViewportItem = {
      id,
      element,
      data,
      isVisible: false
    };

    this.items.set(id, item);
    this.observer.observe(element);
  }

  /**
   * Stop tracking an item
   */
  untrackItem(id: string): void {
    const item = this.items.get(id);
    if (item && this.observer) {
      this.observer.unobserve(item.element);
      this.items.delete(id);
      this.debouncedUpdate();
    }
  }

  /**
   * Subscribe to viewport updates
   */
  subscribe(callback: (stats: ViewportStats) => void): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Get current viewport statistics
   */
  getStats(): ViewportStats {
    const visibleItems = Array.from(this.items.values()).filter(item => item.isVisible);
    
    const stats: ViewportStats = {
      totalVisible: visibleItems.length,
      visibleItems,
      scrollPercentage: this.getScrollPercentage(),
      totalBalance: visibleItems.reduce((sum, item) => sum + (item.data.lamports || 0), 0),
      avgDataSize: visibleItems.length > 0 
        ? visibleItems.reduce((sum, item) => sum + (item.data.dataSize || 0), 0) / visibleItems.length
        : 0,
      executableCount: visibleItems.filter(item => item.data.executable).length
    };

    return stats;
  }

  /**
   * Handle intersection observer changes
   */
  private handleIntersection(entries: IntersectionObserverEntry[]): void {
    let hasChanges = false;

    entries.forEach(entry => {
      const item = Array.from(this.items.values()).find(
        item => item.element === entry.target
      );

      if (item && item.isVisible !== entry.isIntersecting) {
        item.isVisible = entry.isIntersecting;
        hasChanges = true;
      }
    });

    if (hasChanges) {
      this.debouncedUpdate();
    }
  }

  /**
   * Debounced update to prevent too frequent calls
   */
  private debouncedUpdate(): void {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }

    this.updateTimeout = setTimeout(() => {
      const stats = this.getStats();
      this.callbacks.forEach(callback => callback(stats));
    }, this.options.debounceMs);
  }

  /**
   * Calculate scroll percentage
   */
  private getScrollPercentage(): number {
    if (!this.container) return 0;

    const scrollTop = this.container.scrollTop;
    const scrollHeight = this.container.scrollHeight - this.container.clientHeight;
    
    return scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = null;
    }

    this.items.clear();
    this.callbacks.clear();
  }

  /**
   * Force update stats
   */
  forceUpdate(): void {
    const stats = this.getStats();
    this.callbacks.forEach(callback => callback(stats));
  }
}

/**
 * Create a singleton viewport tracker
 */
let globalTracker: ViewportTracker | null = null;

export const getViewportTracker = (): ViewportTracker => {
  if (!globalTracker) {
    globalTracker = new ViewportTracker();
  }
  return globalTracker;
};
