'use client';

import cytoscape from 'cytoscape';

// Enhanced TypeScript interfaces for better type safety
export interface MemoryMetrics {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  timestamp: number;
}

export interface ResourceTracker {
  id: string;
  type: 'timeout' | 'interval' | 'listener' | 'observer' | 'animation' | 'worker' | 'cytoscape';
  cleanup: () => void;
  createdAt: number;
  description?: string;
}

export interface MemoryLeakDetection {
  threshold: number; // MB
  checkInterval: number; // ms
  onLeakDetected: (metrics: MemoryMetrics) => void;
  onMemoryPressure: (metrics: MemoryMetrics) => void;
}

// Memory management and leak detection
export class MemoryManager {
  private static instance: MemoryManager | null = null;
  private resources = new Map<string, ResourceTracker>();
  private memoryHistory: MemoryMetrics[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private leakDetectionConfig: MemoryLeakDetection | null = null;
  private readonly MAX_HISTORY_SIZE = 100;
  private readonly MEMORY_PRESSURE_THRESHOLD = 50 * 1024 * 1024; // 50MB
  private isMonitoring = false;

  private constructor() {
    this.startMemoryMonitoring();
    this.setupUnloadHandler();
  }

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  /**
   * Register a resource for cleanup tracking
   */
  registerResource(
    id: string,
    type: ResourceTracker['type'],
    cleanup: () => void,
    description?: string
  ): void {
    this.resources.set(id, {
      id,
      type,
      cleanup,
      createdAt: Date.now(),
      description
    });
  }

  /**
   * Unregister and cleanup a specific resource
   */
  unregisterResource(id: string): void {
    const resource = this.resources.get(id);
    if (resource) {
      try {
        resource.cleanup();
      } catch (error) {
        console.warn(`Error cleaning up resource ${id}:`, error);
      }
      this.resources.delete(id);
    }
  }

  /**
   * Cleanup all resources of a specific type
   */
  cleanupResourcesByType(type: ResourceTracker['type']): void {
    const resourcesToCleanup = Array.from(this.resources.values())
      .filter(resource => resource.type === type);
    
    resourcesToCleanup.forEach(resource => {
      this.unregisterResource(resource.id);
    });
  }

  /**
   * Cleanup all registered resources
   */
  cleanupAllResources(): void {
    const resourceIds = Array.from(this.resources.keys());
    resourceIds.forEach(id => {
      this.unregisterResource(id);
    });
  }

  /**
   * Safe timeout wrapper with automatic cleanup
   */
  safeSetTimeout(callback: () => void, delay: number, description?: string): string {
    const id = `timeout_${Date.now()}_${Math.random()}`;
    
    const timeoutId = setTimeout(() => {
      try {
        callback();
      } catch (error) {
        console.error('Error in safe timeout:', error);
      } finally {
        this.unregisterResource(id);
      }
    }, delay);

    this.registerResource(
      id,
      'timeout',
      () => clearTimeout(timeoutId),
      description
    );

    return id;
  }

  /**
   * Safe interval wrapper with automatic cleanup
   */
  safeSetInterval(callback: () => void, interval: number, description?: string): string {
    const id = `interval_${Date.now()}_${Math.random()}`;
    
    const intervalId = setInterval(() => {
      try {
        callback();
      } catch (error) {
        console.error('Error in safe interval:', error);
        this.unregisterResource(id); // Stop interval on error
      }
    }, interval);

    this.registerResource(
      id,
      'interval',
      () => clearInterval(intervalId),
      description
    );

    return id;
  }

  /**
   * Safe event listener wrapper with automatic cleanup
   */
  safeAddEventListener<K extends keyof WindowEventMap>(
    target: Window | Document | HTMLElement | cytoscape.Core,
    type: K | string,
    listener: EventListener | ((event: any) => void),
    options?: AddEventListenerOptions,
    description?: string
  ): string {
    const id = `listener_${Date.now()}_${Math.random()}`;
    
    // Type-safe event listener binding
    if ('addEventListener' in target) {
      (target as any).addEventListener(type, listener, options);
    } else if ('on' in target) {
      // Cytoscape-style event binding
      (target as any).on(type, listener);
    }

    this.registerResource(
      id,
      'listener',
      () => {
        try {
          if ('removeEventListener' in target) {
            (target as any).removeEventListener(type, listener, options);
          } else if ('off' in target) {
            (target as any).off(type, listener);
          }
        } catch (error) {
          console.warn('Error removing event listener:', error);
        }
      },
      description
    );

    return id;
  }

  /**
   * Safe animation frame wrapper
   */
  safeRequestAnimationFrame(callback: FrameRequestCallback, description?: string): string {
    const id = `animation_${Date.now()}_${Math.random()}`;
    
    const frameId = requestAnimationFrame((time) => {
      try {
        callback(time);
      } catch (error) {
        console.error('Error in animation frame:', error);
      } finally {
        this.unregisterResource(id);
      }
    });

    this.registerResource(
      id,
      'animation',
      () => cancelAnimationFrame(frameId),
      description
    );

    return id;
  }

  /**
   * Safe observer wrapper (Intersection, Mutation, etc.)
   */
  registerObserver(
    observer: IntersectionObserver | MutationObserver | ResizeObserver,
    description?: string
  ): string {
    const id = `observer_${Date.now()}_${Math.random()}`;
    
    this.registerResource(
      id,
      'observer',
      () => observer.disconnect(),
      description
    );

    return id;
  }

  /**
   * Safe Web Worker wrapper
   */
  registerWorker(worker: Worker, description?: string): string {
    const id = `worker_${Date.now()}_${Math.random()}`;
    
    this.registerResource(
      id,
      'worker',
      () => {
        worker.terminate();
      },
      description
    );

    return id;
  }

  /**
   * Safe Cytoscape instance wrapper
   */
  registerCytoscape(cy: cytoscape.Core, description?: string): string {
    const id = `cytoscape_${Date.now()}_${Math.random()}`;
    
    this.registerResource(
      id,
      'cytoscape',
      () => {
        try {
          // Clear all elements first to prevent memory leaks
          cy.elements().remove();
          // Destroy the instance
          cy.destroy();
        } catch (error) {
          console.warn('Error destroying cytoscape:', error);
        }
      },
      description
    );

    return id;
  }

  /**
   * Get current memory metrics
   */
  getMemoryMetrics(): MemoryMetrics | null {
    if (typeof window === 'undefined' || !('performance' in window)) {
      return null;
    }

    const memory = (performance as any).memory;
    if (!memory) {
      return null;
    }

    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      timestamp: Date.now()
    };
  }

  /**
   * Start monitoring memory usage
   */
  startMemoryMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.monitoringInterval = this.safeSetInterval(() => {
      const metrics = this.getMemoryMetrics();
      if (metrics) {
        this.memoryHistory.push(metrics);
        
        // Keep history size manageable
        if (this.memoryHistory.length > this.MAX_HISTORY_SIZE) {
          this.memoryHistory.shift();
        }
        
        // Check for memory pressure
        if (metrics.usedJSHeapSize > this.MEMORY_PRESSURE_THRESHOLD) {
          this.handleMemoryPressure(metrics);
        }
        
        // Check for memory leaks
        this.checkForMemoryLeaks(metrics);
      }
    }, 5000, 'Memory monitoring interval'); // Check every 5 seconds
  }

  /**
   * Stop memory monitoring
   */
  stopMemoryMonitoring(): void {
    if (this.monitoringInterval) {
      this.unregisterResource(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
  }

  /**
   * Configure leak detection
   */
  configureLeakDetection(config: MemoryLeakDetection): void {
    this.leakDetectionConfig = config;
  }

  /**
   * Check for potential memory leaks
   */
  private checkForMemoryLeaks(currentMetrics: MemoryMetrics): void {
    if (!this.leakDetectionConfig || this.memoryHistory.length < 10) {
      return;
    }

    const { threshold, onLeakDetected } = this.leakDetectionConfig;
    const thresholdBytes = threshold * 1024 * 1024; // Convert MB to bytes
    
    // Check if memory usage has consistently increased
    const recentHistory = this.memoryHistory.slice(-10);
    const oldestMetric = recentHistory[0];
    const increase = currentMetrics.usedJSHeapSize - oldestMetric.usedJSHeapSize;
    
    if (increase > thresholdBytes) {
      // Check if this is a sustained increase (not just temporary)
      const isIncreasing = recentHistory.every((metric, index) => {
        if (index === 0) return true;
        return metric.usedJSHeapSize >= recentHistory[index - 1].usedJSHeapSize;
      });
      
      if (isIncreasing) {
        onLeakDetected(currentMetrics);
        this.performGarbageCollection();
      }
    }
  }

  /**
   * Handle memory pressure situations
   */
  private handleMemoryPressure(metrics: MemoryMetrics): void {
    console.warn('Memory pressure detected:', metrics);
    
    if (this.leakDetectionConfig?.onMemoryPressure) {
      this.leakDetectionConfig.onMemoryPressure(metrics);
    }
    
    // Attempt garbage collection
    this.performGarbageCollection();
    
    // Clean up old resources
    this.cleanupOldResources();
  }

  /**
   * Attempt to trigger garbage collection
   */
  private performGarbageCollection(): void {
    if (typeof window !== 'undefined' && (window as any).gc) {
      try {
        (window as any).gc();
        console.log('Manual garbage collection triggered');
      } catch (error) {
        console.warn('Failed to trigger garbage collection:', error);
      }
    }
  }

  /**
   * Clean up resources older than specified age
   */
  private cleanupOldResources(maxAge: number = 300000): void { // 5 minutes default
    const now = Date.now();
    const resourcesToCleanup = Array.from(this.resources.values())
      .filter(resource => now - resource.createdAt > maxAge);
    
    resourcesToCleanup.forEach(resource => {
      console.warn(`Cleaning up old resource: ${resource.id} (${resource.type})`);
      this.unregisterResource(resource.id);
    });
  }

  /**
   * Get resource usage statistics
   */
  getResourceStats(): {
    totalResources: number;
    byType: Record<string, number>;
    oldestResource: { id: string; age: number } | null;
    memoryHistory: MemoryMetrics[];
  } {
    const now = Date.now();
    const byType: Record<string, number> = {};
    let oldestResource: { id: string; age: number } | null = null;
    
    this.resources.forEach(resource => {
      byType[resource.type] = (byType[resource.type] || 0) + 1;
      
      const age = now - resource.createdAt;
      if (!oldestResource || age > oldestResource.age) {
        oldestResource = { id: resource.id, age };
      }
    });
    
    return {
      totalResources: this.resources.size,
      byType,
      oldestResource,
      memoryHistory: [...this.memoryHistory]
    };
  }

  /**
   * Setup cleanup on page unload
   */
  private setupUnloadHandler(): void {
    if (typeof window !== 'undefined') {
      const cleanup = () => {
        this.cleanupAllResources();
        this.stopMemoryMonitoring();
      };
      
      window.addEventListener('beforeunload', cleanup);
      window.addEventListener('pagehide', cleanup);
      
      // Also cleanup on visibility change for mobile browsers
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.cleanupOldResources(60000); // Clean up resources older than 1 minute
        }
      });
    }
  }

  /**
   * Force cleanup and reset
   */
  destroy(): void {
    this.cleanupAllResources();
    this.stopMemoryMonitoring();
    this.memoryHistory = [];
    this.leakDetectionConfig = null;
    MemoryManager.instance = null;
  }
}

// Type-safe event emitter with automatic cleanup
export class TypeSafeEventEmitter<TEvents extends Record<string, any>> {
  private listeners = new Map<keyof TEvents, Set<Function>>();
  private memoryManager = MemoryManager.getInstance();
  private listenerId: string;

  constructor(description?: string) {
    this.listenerId = `event_emitter_${Date.now()}_${Math.random()}`;
    this.memoryManager.registerResource(
      this.listenerId,
      'listener',
      () => this.removeAllListeners(),
      description
    );
  }

  on<K extends keyof TEvents>(
    event: K,
    listener: (data: TEvents[K]) => void
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(listener);
    
    // Return unsubscribe function
    return () => this.off(event, listener);
  }

  off<K extends keyof TEvents>(
    event: K,
    listener: (data: TEvents[K]) => void
  ): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  emit<K extends keyof TEvents>(event: K, data: TEvents[K]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for ${String(event)}:`, error);
        }
      });
    }
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }

  destroy(): void {
    this.removeAllListeners();
    this.memoryManager.unregisterResource(this.listenerId);
  }
}

// Enhanced weak reference utilities
export class WeakReferenceManager<T extends object> {
  private refs = new Set<WeakRef<T>>();
  private cleanupInterval: string;

  constructor(cleanupIntervalMs: number = 30000) {
    const memoryManager = MemoryManager.getInstance();
    this.cleanupInterval = memoryManager.safeSetInterval(
      () => this.cleanup(),
      cleanupIntervalMs,
      'WeakReference cleanup'
    );
  }

  add(obj: T): WeakRef<T> {
    const ref = new WeakRef(obj);
    this.refs.add(ref);
    return ref;
  }

  cleanup(): void {
    const toDelete = new Set<WeakRef<T>>();
    
    this.refs.forEach(ref => {
      if (ref.deref() === undefined) {
        toDelete.add(ref);
      }
    });
    
    toDelete.forEach(ref => this.refs.delete(ref));
  }

  getAliveReferences(): T[] {
    const alive: T[] = [];
    
    this.refs.forEach(ref => {
      const obj = ref.deref();
      if (obj !== undefined) {
        alive.push(obj);
      }
    });
    
    return alive;
  }

  destroy(): void {
    const memoryManager = MemoryManager.getInstance();
    memoryManager.unregisterResource(this.cleanupInterval);
    this.refs.clear();
  }
}

export default MemoryManager;