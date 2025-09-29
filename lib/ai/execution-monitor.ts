/**
 * Execution State Monitoring System
 * 
 * Tracks plan generation and execution phases to prevent deadlocks.
 * Provides automatic execution triggering and timeout handling.
 */

import { EventEmitter } from 'events';

export interface ExecutionState {
  planId: string;
  planGenerated: boolean;
  planExecuting: boolean;
  planCompleted: boolean;
  executionStartTime: number;
  executionTimeout: number;
  retryCount: number;
  lastError?: string;
  partialData?: any;
  toolsAttempted: string[];
}

export interface ExecutionMetrics {
  totalPlans: number;
  completedPlans: number;
  timedoutPlans: number;
  avgExecutionTime: number;
  successRate: number;
}

/**
 * Global execution monitor for tracking AI sidebar execution states
 */
export class ExecutionMonitor extends EventEmitter {
  private executions: Map<string, ExecutionState> = new Map();
  private metrics: ExecutionMetrics = {
    totalPlans: 0,
    completedPlans: 0,
    timedoutPlans: 0,
    avgExecutionTime: 0,
    successRate: 0
  };

  /**
   * Starts monitoring a new plan execution
   */
  startExecution(planId: string, timeout: number = 30000): ExecutionState {
    const state: ExecutionState = {
      planId,
      planGenerated: false,
      planExecuting: false,
      planCompleted: false,
      executionStartTime: Date.now(),
      executionTimeout: timeout,
      retryCount: 0,
      toolsAttempted: []
    };

    this.executions.set(planId, state);
    this.metrics.totalPlans++;
    
    // Set timeout to detect stuck executions
    setTimeout(() => {
      this.checkForTimeout(planId);
    }, timeout);

    this.emit('executionStarted', state);
    return state;
  }

  /**
   * Updates execution state when plan is generated
   */
  markPlanGenerated(planId: string): void {
    const state = this.executions.get(planId);
    if (!state) return;

    state.planGenerated = true;
    this.executions.set(planId, state);
    this.emit('planGenerated', state);

    // Auto-trigger execution after short delay to prevent deadlock
    setTimeout(() => {
      this.triggerExecution(planId);
    }, 1000);
  }

  /**
   * Updates execution state when plan starts executing
   */
  markPlanExecuting(planId: string): void {
    const state = this.executions.get(planId);
    if (!state) return;

    state.planExecuting = true;
    this.executions.set(planId, state);
    this.emit('executionStarted', state);
  }

  /**
   * Updates execution state when plan completes
   */
  markPlanCompleted(planId: string, partialData?: any): void {
    const state = this.executions.get(planId);
    if (!state) return;

    state.planCompleted = true;
    state.partialData = partialData;
    
    const executionTime = Date.now() - state.executionStartTime;
    this.updateMetrics(executionTime, true);
    
    this.executions.set(planId, state);
    this.emit('executionCompleted', state);

    // Clean up after delay
    setTimeout(() => {
      this.executions.delete(planId);
    }, 60000);
  }

  /**
   * Records an error in execution
   */
  recordError(planId: string, error: string): void {
    const state = this.executions.get(planId);
    if (!state) return;

    state.lastError = error;
    state.retryCount++;
    this.executions.set(planId, state);
    this.emit('executionError', { state, error });
  }

  /**
   * Records a tool attempt
   */
  recordToolAttempt(planId: string, toolName: string): void {
    const state = this.executions.get(planId);
    if (!state) return;

    if (!state.toolsAttempted.includes(toolName)) {
      state.toolsAttempted.push(toolName);
      this.executions.set(planId, state);
    }
  }

  /**
   * Forces execution trigger for stuck plans
   */
  triggerExecution(planId: string): void {
    const state = this.executions.get(planId);
    if (!state || state.planExecuting || state.planCompleted) return;

    if (state.planGenerated && !state.planExecuting) {
      console.log(`[ExecutionMonitor] Auto-triggering execution for stuck plan: ${planId}`);
      this.emit('forceExecution', state);
    }
  }

  /**
   * Checks for timed out executions
   */
  private checkForTimeout(planId: string): void {
    const state = this.executions.get(planId);
    if (!state || state.planCompleted) return;

    const elapsed = Date.now() - state.executionStartTime;
    if (elapsed >= state.executionTimeout) {
      console.log(`[ExecutionMonitor] Execution timeout detected for plan: ${planId}`);
      
      state.lastError = 'Execution timeout';
      this.metrics.timedoutPlans++;
      this.updateMetrics(elapsed, false);
      
      this.emit('executionTimeout', state);
      this.executions.delete(planId);
    }
  }

  /**
   * Updates performance metrics
   */
  private updateMetrics(executionTime: number, success: boolean): void {
    if (success) {
      this.metrics.completedPlans++;
    }

    // Update average execution time
    const totalCompleted = this.metrics.completedPlans + this.metrics.timedoutPlans;
    if (totalCompleted > 0) {
      this.metrics.avgExecutionTime = 
        (this.metrics.avgExecutionTime * (totalCompleted - 1) + executionTime) / totalCompleted;
    }

    // Update success rate
    this.metrics.successRate = this.metrics.completedPlans / this.metrics.totalPlans;
  }

  /**
   * Gets current execution state
   */
  getExecutionState(planId: string): ExecutionState | undefined {
    return this.executions.get(planId);
  }

  /**
   * Gets all active executions
   */
  getActiveExecutions(): ExecutionState[] {
    return Array.from(this.executions.values());
  }

  /**
   * Gets performance metrics
   */
  getMetrics(): ExecutionMetrics {
    return { ...this.metrics };
  }

  /**
   * Checks if execution is stuck in planning phase
   */
  isStuckInPlanning(planId: string): boolean {
    const state = this.executions.get(planId);
    if (!state) return false;

    const elapsed = Date.now() - state.executionStartTime;
    return state.planGenerated && !state.planExecuting && elapsed > 5000;
  }

  /**
   * Gets stuck executions that need intervention
   */
  getStuckExecutions(): ExecutionState[] {
    return Array.from(this.executions.values()).filter(state => 
      this.isStuckInPlanning(state.planId)
    );
  }

  /**
   * Forces completion for stuck executions with partial data
   */
  forceCompletionWithPartialData(planId: string, partialData: any): void {
    const state = this.executions.get(planId);
    if (!state) return;

    console.log(`[ExecutionMonitor] Forcing completion with partial data for: ${planId}`);
    this.markPlanCompleted(planId, partialData);
  }

  /**
   * Cleans up old executions
   */
  cleanup(): void {
    const cutoff = Date.now() - 300000; // 5 minutes
    
    for (const [planId, state] of this.executions.entries()) {
      if (state.executionStartTime < cutoff) {
        console.log(`[ExecutionMonitor] Cleaning up old execution: ${planId}`);
        this.executions.delete(planId);
      }
    }
  }
}

// Global singleton instance
export const executionMonitor = new ExecutionMonitor();

/**
 * Convenience functions for common operations
 */
export function monitorExecution(planId: string, timeout?: number): ExecutionState {
  return executionMonitor.startExecution(planId, timeout);
}

export function markPlanGenerated(planId: string): void {
  executionMonitor.markPlanGenerated(planId);
}

export function markPlanExecuting(planId: string): void {
  executionMonitor.markPlanExecuting(planId);
}

export function markPlanCompleted(planId: string, partialData?: any): void {
  executionMonitor.markPlanCompleted(planId, partialData);
}

export function recordToolAttempt(planId: string, toolName: string): void {
  executionMonitor.recordToolAttempt(planId, toolName);
}

export function getExecutionState(planId: string): ExecutionState | undefined {
  return executionMonitor.getExecutionState(planId);
}

export function isExecutionStuck(planId: string): boolean {
  return executionMonitor.isStuckInPlanning(planId);
}

// Auto-cleanup every 5 minutes
setInterval(() => {
  executionMonitor.cleanup();
}, 300000);
