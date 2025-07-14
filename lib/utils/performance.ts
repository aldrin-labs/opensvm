/**
 * Performance monitoring utilities for the monitoring page
 */

export interface PerformanceMetrics {
  memoryUsage: {
    used: number;
    total: number;
    limit: number;
  } | null;
  renderTime: number;
  eventProcessingTime: number;
  totalEvents: number;
  filterTime: number;
  lastUpdate: number;
}

export class PerformanceTracker {
  private static instance: PerformanceTracker;
  private marks: Map<string, number> = new Map();
  private metrics: PerformanceMetrics = {
    memoryUsage: null,
    renderTime: 0,
    eventProcessingTime: 0,
    totalEvents: 0,
    filterTime: 0,
    lastUpdate: Date.now()
  };

  static getInstance(): PerformanceTracker {
    if (!PerformanceTracker.instance) {
      PerformanceTracker.instance = new PerformanceTracker();
    }
    return PerformanceTracker.instance;
  }

  markStart(label: string): void {
    if (typeof window !== 'undefined' && 'performance' in window) {
      this.marks.set(`${label}-start`, performance.now());
    }
  }

  markEnd(label: string): number {
    if (typeof window !== 'undefined' && 'performance' in window) {
      const startTime = this.marks.get(`${label}-start`);
      if (startTime !== undefined) {
        const duration = performance.now() - startTime;
        this.marks.delete(`${label}-start`);
        return duration;
      }
    }
    return 0;
  }

  getMemoryUsage(): PerformanceMetrics['memoryUsage'] {
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in (window as any).performance) {
      const memory = (window as any).performance.memory;
      return {
        used: Math.round(memory.usedJSHeapSize / 1048576), // MB
        total: Math.round(memory.totalJSHeapSize / 1048576), // MB
        limit: Math.round(memory.jsHeapSizeLimit / 1048576) // MB
      };
    }
    return null;
  }

  updateMetrics(updates: Partial<PerformanceMetrics>): void {
    this.metrics = {
      ...this.metrics,
      ...updates,
      lastUpdate: Date.now()
    };
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  checkMemoryPressure(): boolean {
    const memory = this.getMemoryUsage();
    if (!memory) return false;
    
    return memory.used > memory.limit * 0.8;
  }
}

/**
 * Throttling utility for high-frequency operations
 */
export function createThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutRef: NodeJS.Timeout | undefined;
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    
    if (now - lastCall >= delay) {
      lastCall = now;
      callback(...args);
    } else {
      if (timeoutRef) {
        clearTimeout(timeoutRef);
      }
      
      timeoutRef = setTimeout(() => {
        lastCall = Date.now();
        callback(...args);
      }, delay - (now - lastCall));
    }
  };
}

/**
 * Debouncing utility for delaying function calls
 */
export function createDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutRef: NodeJS.Timeout | undefined;
  
  return (...args: Parameters<T>) => {
    if (timeoutRef) {
      clearTimeout(timeoutRef);
    }
    
    timeoutRef = setTimeout(() => {
      callback(...args);
    }, delay);
  };
}

/**
 * Batch processor for high-frequency operations
 */
export class BatchProcessor<T> {
  private items: T[] = [];
  private timeout: NodeJS.Timeout | undefined;
  private isProcessing = false;

  constructor(
    private processor: (items: T[]) => void,
    private batchSize: number = 50,
    private delay: number = 100
  ) {}

  add(item: T): void {
    this.items.push(item);
    
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    
    if (this.items.length >= this.batchSize && !this.isProcessing) {
      this.processBatch();
    } else {
      this.timeout = setTimeout(() => {
        this.processBatch();
      }, this.delay);
    }
  }

  private processBatch(): void {
    if (this.isProcessing || this.items.length === 0) return;
    
    this.isProcessing = true;
    const batch = this.items.splice(0, this.batchSize);
    
    try {
      this.processor(batch);
    } catch (error) {
      console.error('Batch processing error:', error);
    } finally {
      this.isProcessing = false;
      
      // Process remaining items if any
      if (this.items.length > 0) {
        this.timeout = setTimeout(() => {
          this.processBatch();
        }, this.delay);
      }
    }
  }

  flush(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    
    if (this.items.length > 0) {
      this.processBatch();
    }
  }

  clear(): void {
    this.items = [];
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
  }
}

/**
 * Memory management utilities
 */
export class MemoryManager {
  private static readonly MEMORY_CHECK_INTERVAL = 10000; // 10 seconds
  private static readonly MEMORY_WARNING_THRESHOLD = 0.8; // 80% of limit
  private static readonly MEMORY_CRITICAL_THRESHOLD = 0.9; // 90% of limit
  
  static startMonitoring(onMemoryPressure: (level: 'warning' | 'critical') => void): () => void {
    const tracker = PerformanceTracker.getInstance();
    
    const interval = setInterval(() => {
      const memory = tracker.getMemoryUsage();
      if (!memory) return;
      
      const usage = memory.used / memory.limit;
      
      if (usage > MemoryManager.MEMORY_CRITICAL_THRESHOLD) {
        onMemoryPressure('critical');
      } else if (usage > MemoryManager.MEMORY_WARNING_THRESHOLD) {
        onMemoryPressure('warning');
      }
    }, MemoryManager.MEMORY_CHECK_INTERVAL);
    
    return () => clearInterval(interval);
  }
  
  static optimizeForMemory<T>(array: T[], maxSize: number, keepRecent = true): T[] {
    if (array.length <= maxSize) return array;
    
    return keepRecent 
      ? array.slice(-maxSize)
      : array.slice(0, maxSize);
  }
}

export const performanceTracker = PerformanceTracker.getInstance();