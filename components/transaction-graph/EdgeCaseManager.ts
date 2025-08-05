'use client';

import { MemoryManager } from './MemoryManager';

// Enhanced interfaces for edge case handling
export interface CircularReference {
  nodeId: string;
  path: string[];
  depth: number;
  detectedAt: number;
}

export interface RaceConditionTracker {
  operationId: string;
  type: 'navigation' | 'data_fetch' | 'layout' | 'render';
  startTime: number;
  status: 'pending' | 'completed' | 'cancelled' | 'failed';
  priority: number;
}

export interface NetworkFailureContext {
  url: string;
  method: string;
  attempts: number;
  lastError: Error;
  timestamp: number;
  retryAfter?: number;
}

export interface StateCorruption {
  componentId: string;
  expectedState: any;
  actualState: any;
  detectedAt: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface EdgeCaseConfig {
  maxCircularDepth: number;
  maxRetryAttempts: number;
  raceConditionTimeout: number;
  stateValidationInterval: number;
  networkTimeout: number;
  memoryPressureThreshold: number;
}

// Comprehensive edge case management
export class EdgeCaseManager {
  private static instance: EdgeCaseManager | null = null;
  private memoryManager = MemoryManager.getInstance();

  // Tracking state
  private circularReferences = new Map<string, CircularReference>();
  private raceConditions = new Map<string, RaceConditionTracker>();
  private networkFailures = new Map<string, NetworkFailureContext>();
  private stateCorruptions: StateCorruption[] = [];
  private operationQueue: Array<{
    id: string;
    operation: () => Promise<any>;
    priority: number;
    timeout: number;
  }> = [];

  // Configuration
  private config: EdgeCaseConfig = {
    maxCircularDepth: 10,
    maxRetryAttempts: 3,
    raceConditionTimeout: 5000,
    stateValidationInterval: 30000,
    networkTimeout: 10000,
    memoryPressureThreshold: 100 * 1024 * 1024 // 100MB
  };

  // Event callbacks
  private eventHandlers = {
    onCircularReference: (_ref: CircularReference) => { },
    onRaceCondition: (_tracker: RaceConditionTracker) => { },
    onNetworkFailure: (_context: NetworkFailureContext) => { },
    onStateCorruption: (_corruption: StateCorruption) => { },
    onRecoverySuccess: (_type: string, _context: any) => { },
    onRecoveryFailure: (_type: string, _error: Error) => { }
  };

  private constructor() {
    this.startStateValidation();
    this.setupGlobalErrorHandlers();
  }

  static getInstance(): EdgeCaseManager {
    if (!EdgeCaseManager.instance) {
      EdgeCaseManager.instance = new EdgeCaseManager();
    }
    return EdgeCaseManager.instance;
  }

  /**
   * Configure edge case handling
   */
  configure(config: Partial<EdgeCaseConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set event handlers for edge cases
   */
  setEventHandlers(handlers: Partial<typeof this.eventHandlers>): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  /**
   * Circular reference detection and handling
   */
  detectCircularReference(nodeId: string, path: string[]): CircularReference | null {
    const circularIndex = path.indexOf(nodeId);

    if (circularIndex !== -1) {
      const circularPath = path.slice(circularIndex);
      const reference: CircularReference = {
        nodeId,
        path: circularPath,
        depth: circularPath.length,
        detectedAt: Date.now()
      };

      this.circularReferences.set(nodeId, reference);
      this.eventHandlers.onCircularReference(reference);

      return reference;
    }

    return null;
  }

  /**
   * Break circular reference by finding alternative path
   */
  breakCircularReference(nodeId: string, targetId: string, allNodes: Map<string, any>): string[] | null {
    const visited = new Set<string>();
    const queue: Array<{ node: string; path: string[] }> = [{ node: nodeId, path: [nodeId] }];

    while (queue.length > 0) {
      const { node, path } = queue.shift()!;

      if (node === targetId && path.length > 1) {
        return path;
      }

      if (visited.has(node) || path.length > this.config.maxCircularDepth) {
        continue;
      }

      visited.add(node);
      const nodeData = allNodes.get(node);

      if (nodeData?.connections) {
        for (const connection of nodeData.connections) {
          if (!visited.has(connection) && !path.includes(connection)) {
            queue.push({
              node: connection,
              path: [...path, connection]
            });
          }
        }
      }
    }

    return null;
  }

  /**
   * Race condition prevention and management
   */
  trackOperation(
    operationId: string,
    type: RaceConditionTracker['type'],
    priority: number = 0
  ): boolean {
    // Check for existing operation
    const existing = this.raceConditions.get(operationId);
    if (existing && existing.status === 'pending') {
      console.warn(`Race condition detected: ${operationId} already pending`);
      this.eventHandlers.onRaceCondition(existing);
      return false;
    }

    // Cancel lower priority operations of same type
    this.cancelLowerPriorityOperations(type, priority);

    const tracker: RaceConditionTracker = {
      operationId,
      type,
      startTime: Date.now(),
      status: 'pending',
      priority
    };

    this.raceConditions.set(operationId, tracker);

    // Auto-timeout after configured time
    this.memoryManager.safeSetTimeout(() => {
      const current = this.raceConditions.get(operationId);
      if (current && current.status === 'pending') {
        current.status = 'failed';
        this.eventHandlers.onRaceCondition(current);
      }
    }, this.config.raceConditionTimeout, `Race condition timeout for ${operationId}`);

    return true;
  }

  /**
   * Complete operation tracking
   */
  completeOperation(operationId: string, success: boolean = true): void {
    const tracker = this.raceConditions.get(operationId);
    if (tracker) {
      tracker.status = success ? 'completed' : 'failed';

      // Clean up after a delay
      this.memoryManager.safeSetTimeout(() => {
        this.raceConditions.delete(operationId);
      }, 1000, `Cleanup operation ${operationId}`);
    }
  }

  /**
   * Cancel lower priority operations
   */
  private cancelLowerPriorityOperations(type: RaceConditionTracker['type'], priority: number): void {
    for (const [_id, tracker] of this.raceConditions.entries()) {
      if (tracker.type === type && tracker.priority < priority && tracker.status === 'pending') {
        tracker.status = 'cancelled';
        this.eventHandlers.onRaceCondition(tracker);
      }
    }
  }

  /**
   * Robust network request with retry and timeout
   */
  async safeNetworkRequest<T>(
    url: string,
    options: RequestInit = {},
    retryConfig?: {
      attempts?: number;
      delay?: number;
      backoff?: number;
    }
  ): Promise<T> {
    const config = {
      attempts: this.config.maxRetryAttempts,
      delay: 1000,
      backoff: 2,
      ...retryConfig
    };

    let lastError: Error = new Error('Unknown error');

    for (let attempt = 1; attempt <= config.attempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.networkTimeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Clear any previous failure for this URL
        this.networkFailures.delete(url);

        return data;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        const context: NetworkFailureContext = {
          url,
          method: options.method || 'GET',
          attempts: attempt,
          lastError,
          timestamp: Date.now(),
          retryAfter: attempt < config.attempts ? config.delay * Math.pow(config.backoff, attempt - 1) : undefined
        };

        this.networkFailures.set(url, context);
        this.eventHandlers.onNetworkFailure(context);

        if (attempt < config.attempts) {
          await this.delay(context.retryAfter!);
        }
      }
    }

    throw lastError;
  }

  /**
   * State validation and corruption detection
   */
  validateState<T>(
    componentId: string,
    expectedState: T,
    actualState: T,
    validator?: (expected: T, actual: T) => boolean
  ): boolean {
    const isValid = validator
      ? validator(expectedState, actualState)
      : JSON.stringify(expectedState) === JSON.stringify(actualState);

    if (!isValid) {
      const corruption: StateCorruption = {
        componentId,
        expectedState,
        actualState,
        detectedAt: Date.now(),
        severity: this.calculateCorruptionSeverity(expectedState, actualState)
      };

      this.stateCorruptions.push(corruption);
      this.eventHandlers.onStateCorruption(corruption);

      // Keep only recent corruptions
      if (this.stateCorruptions.length > 100) {
        this.stateCorruptions = this.stateCorruptions.slice(-50);
      }
    }

    return isValid;
  }

  /**
   * Attempt automatic state recovery
   */
  async recoverState<T>(
    componentId: string,
    corruptedState: T,
    recoveryStrategies: Array<{
      name: string;
      recover: (state: T) => Promise<T> | T;
    }>
  ): Promise<T> {
    for (const strategy of recoveryStrategies) {
      try {
        const recoveredState = await strategy.recover(corruptedState);

        this.eventHandlers.onRecoverySuccess(strategy.name, {
          componentId,
          originalState: corruptedState,
          recoveredState
        });

        return recoveredState;

      } catch (error) {
        this.eventHandlers.onRecoveryFailure(
          strategy.name,
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }

    throw new Error(`All recovery strategies failed for component: ${componentId}`);
  }

  /**
   * Handle browser compatibility issues
   */
  checkBrowserCompatibility(): {
    isSupported: boolean;
    missing: string[];
    warnings: string[];
  } {
    const missing: string[] = [];
    const warnings: string[] = [];

    // Check for required features
    const requiredFeatures = [
      { name: 'fetch', check: () => typeof fetch !== 'undefined' },
      { name: 'Promise', check: () => typeof Promise !== 'undefined' },
      { name: 'Map', check: () => typeof Map !== 'undefined' },
      { name: 'Set', check: () => typeof Set !== 'undefined' },
      { name: 'WeakRef', check: () => typeof WeakRef !== 'undefined' },
      { name: 'AbortController', check: () => typeof AbortController !== 'undefined' }
    ];

    const optionalFeatures = [
      { name: 'IntersectionObserver', check: () => typeof IntersectionObserver !== 'undefined' },
      { name: 'ResizeObserver', check: () => typeof ResizeObserver !== 'undefined' },
      { name: 'Worker', check: () => typeof Worker !== 'undefined' },
      { name: 'performance.memory', check: () => typeof window !== 'undefined' && 'performance' in window && 'memory' in (window.performance as any) }
    ];

    for (const feature of requiredFeatures) {
      if (!feature.check()) {
        missing.push(feature.name);
      }
    }

    for (const feature of optionalFeatures) {
      if (!feature.check()) {
        warnings.push(feature.name);
      }
    }

    return {
      isSupported: missing.length === 0,
      missing,
      warnings
    };
  }

  /**
   * Graceful degradation for unsupported features
   */
  createFallbacks(): {
    fetch: typeof fetch;
    Worker: typeof Worker | null;
    IntersectionObserver: typeof IntersectionObserver | null;
  } {
    return {
      fetch: typeof fetch !== 'undefined' ? fetch : async () => {
        throw new Error('Fetch not supported - please use a modern browser');
      },
      Worker: typeof Worker !== 'undefined' ? Worker : null,
      IntersectionObserver: typeof IntersectionObserver !== 'undefined' ? IntersectionObserver : null
    };
  }

  /**
   * Memory pressure handling
   */
  handleMemoryPressure(): void {
    console.warn('Memory pressure detected - performing cleanup');

    // Clear old tracking data
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    // Clean up old circular references
    for (const [key, ref] of this.circularReferences.entries()) {
      if (now - ref.detectedAt > maxAge) {
        this.circularReferences.delete(key);
      }
    }

    // Clean up old network failures
    for (const [key, failure] of this.networkFailures.entries()) {
      if (now - failure.timestamp > maxAge) {
        this.networkFailures.delete(key);
      }
    }

    // Limit state corruption history
    this.stateCorruptions = this.stateCorruptions
      .filter(corruption => now - corruption.detectedAt < maxAge)
      .slice(-20);

    // Force garbage collection if available
    if (typeof window !== 'undefined' && (window as any).gc) {
      try {
        (window as any).gc();
      } catch (error) {
        console.warn('Manual GC failed:', error);
      }
    }
  }

  /**
   * Concurrent operation queue management
   */
  async queueOperation<T>(
    id: string,
    operation: () => Promise<T>,
    priority: number = 0,
    timeout: number = 30000
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const queueItem = {
        id,
        operation: async () => {
          try {
            const result = await Promise.race([
              operation(),
              this.createTimeoutPromise(timeout)
            ]) as T;
            resolve(result);
            return result;
          } catch (error) {
            reject(error);
            throw error;
          }
        },
        priority,
        timeout
      };

      // Insert based on priority
      const insertIndex = this.operationQueue.findIndex(item => item.priority < priority);
      if (insertIndex === -1) {
        this.operationQueue.push(queueItem);
      } else {
        this.operationQueue.splice(insertIndex, 0, queueItem);
      }

      this.processQueue();
    });
  }

  /**
   * Process operation queue
   */
  private async processQueue(): Promise<void> {
    if (this.operationQueue.length === 0) return;

    const operation = this.operationQueue.shift()!;

    try {
      await operation.operation();
    } catch (error) {
      console.error(`Queue operation ${operation.id} failed:`, error);
    }

    // Process next operation
    if (this.operationQueue.length > 0) {
      this.memoryManager.safeSetTimeout(() => this.processQueue(), 0);
    }
  }

  /**
   * Utility methods
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => {
      this.memoryManager.safeSetTimeout(() => resolve(), ms);
    });
  }

  private createTimeoutPromise<T>(ms: number): Promise<T> {
    return new Promise((_, reject) => {
      this.memoryManager.safeSetTimeout(() => {
        reject(new Error(`Operation timed out after ${ms}ms`));
      }, ms);
    });
  }

  private calculateCorruptionSeverity(expected: any, actual: any): StateCorruption['severity'] {
    if (typeof expected !== typeof actual) return 'critical';
    if (expected === null && actual !== null) return 'high';
    if (Array.isArray(expected) !== Array.isArray(actual)) return 'high';

    // Simple heuristic based on difference size
    const expectedStr = JSON.stringify(expected);
    const actualStr = JSON.stringify(actual);
    const diffRatio = Math.abs(expectedStr.length - actualStr.length) / expectedStr.length;

    if (diffRatio > 0.5) return 'high';
    if (diffRatio > 0.2) return 'medium';
    return 'low';
  }

  private startStateValidation(): void {
    this.memoryManager.safeSetInterval(() => {
      // Periodic cleanup and validation
      this.handleMemoryPressure();
    }, this.config.stateValidationInterval, 'State validation interval');
  }

  private setupGlobalErrorHandlers(): void {
    if (typeof window !== 'undefined') {
      // Handle unhandled promise rejections
      this.memoryManager.safeAddEventListener(
        window,
        'unhandledrejection',
        (event: PromiseRejectionEvent) => {
          console.error('Unhandled promise rejection:', event.reason);
          // Don't prevent default to allow normal error handling
        },
        undefined,
        'Global unhandled rejection handler'
      );

      // Handle general errors
      this.memoryManager.safeAddEventListener(
        window,
        'error',
        (event: ErrorEvent) => {
          console.error('Global error:', event.error);
        },
        undefined,
        'Global error handler'
      );
    }
  }

  /**
   * Get edge case statistics
   */
  getStatistics(): {
    circularReferences: number;
    activeOperations: number;
    networkFailures: number;
    stateCorruptions: number;
    queuedOperations: number;
  } {
    return {
      circularReferences: this.circularReferences.size,
      activeOperations: Array.from(this.raceConditions.values())
        .filter(op => op.status === 'pending').length,
      networkFailures: this.networkFailures.size,
      stateCorruptions: this.stateCorruptions.length,
      queuedOperations: this.operationQueue.length
    };
  }

  /**
   * Reset all tracking data
   */
  reset(): void {
    this.circularReferences.clear();
    this.raceConditions.clear();
    this.networkFailures.clear();
    this.stateCorruptions = [];
    this.operationQueue = [];
  }

  /**
   * Destroy the manager
   */
  destroy(): void {
    this.reset();
    EdgeCaseManager.instance = null;
  }
}

export default EdgeCaseManager;