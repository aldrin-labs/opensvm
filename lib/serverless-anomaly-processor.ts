/**
 * Serverless/Worker-based Anomaly Detection System
 * Moves heavy anomaly detection processing off the main thread for better scalability
 */

import { createLogger } from '@/lib/debug-logger';
import { generateSecureActionId } from '@/lib/crypto-utils';

const logger = createLogger('ANOMALY_PROCESSOR');

// Types for the worker-based system
interface AnomalyTask {
  id: string;
  type: 'transaction' | 'block' | 'batch';
  timestamp: number;
  data: any;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface AnomalyResult {
  taskId: string;
  alerts: any[];
  processingTime: number;
  timestamp: number;
}

interface WorkerConfig {
  maxConcurrentTasks: number;
  workerTimeoutMs: number;
  queueMaxSize: number;
  enableBatching: boolean;
  batchSize: number;
  batchTimeoutMs: number;
}

/**
 * Queue-based anomaly detection processor
 * Offloads heavy processing to prevent blocking the main thread
 */
export class OffThreadAnomalyProcessor {
  private taskQueue: AnomalyTask[] = [];
  private activeTasks = new Map<string, AnomalyTask>();
  private workers: Worker[] = [];
  private config: WorkerConfig;
  private isProcessing = false;
  private processingStats = {
    processed: 0,
    failed: 0,
    averageProcessingTime: 0,
    queueSize: 0
  };

  constructor(config: Partial<WorkerConfig> = {}) {
    this.config = {
      maxConcurrentTasks: 4,
      workerTimeoutMs: 30000,
      queueMaxSize: 1000,
      enableBatching: true,
      batchSize: 10,
      batchTimeoutMs: 5000,
      ...config
    };

    // Initialize worker pool in browser environment
    if (typeof window !== 'undefined' && 'Worker' in window) {
      this.initializeWorkers();
    }
  }

  /**
   * Initialize Web Workers for anomaly detection
   */
  private initializeWorkers(): void {
    try {
      // Create worker pool
      for (let i = 0; i < this.config.maxConcurrentTasks; i++) {
        const worker = new Worker(
          new URL('../workers/anomaly-detection.worker.ts', import.meta.url),
          { type: 'module' }
        );

        worker.onmessage = (event) => {
          this.handleWorkerMessage(event.data);
        };

        worker.onerror = (error) => {
          logger.error(`Worker ${i} error:`, error);
          this.handleWorkerError(worker, error);
        };

        this.workers.push(worker);
      }

      logger.debug(`Initialized ${this.workers.length} anomaly detection workers`);
    } catch (error) {
      logger.error('Failed to initialize workers, falling back to main thread:', error);
    }
  }

  /**
   * Queue an anomaly detection task
   */
  public async queueTask(
    type: 'transaction' | 'block' | 'batch',
    data: any,
    priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<string> {
    const taskId = generateSecureActionId();
    
    const task: AnomalyTask = {
      id: taskId,
      type,
      timestamp: Date.now(),
      data,
      priority
    };

    // Check queue size limits
    if (this.taskQueue.length >= this.config.queueMaxSize) {
      // Remove low priority tasks to make room
      this.taskQueue = this.taskQueue.filter(t => t.priority !== 'low');
      
      if (this.taskQueue.length >= this.config.queueMaxSize) {
        throw new Error('Anomaly detection queue is full');
      }
    }

    // Insert task based on priority
    this.insertTaskByPriority(task);
    
    logger.debug(`Queued anomaly detection task ${taskId} (${type}, priority: ${priority})`);

    // Start processing if not already running
    if (!this.isProcessing) {
      this.startProcessing();
    }

    return taskId;
  }

  /**
   * Process queued tasks using available workers
   */
  private async startProcessing(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    logger.debug('Starting anomaly detection processing');

    try {
      while (this.taskQueue.length > 0 || this.activeTasks.size > 0) {
        // Process tasks in batches if enabled
        if (this.config.enableBatching && this.taskQueue.length >= this.config.batchSize) {
          await this.processBatch();
        } else {
          await this.processSingleTask();
        }

        // Update stats
        this.processingStats.queueSize = this.taskQueue.length;
      }
    } catch (error) {
      logger.error('Error in anomaly detection processing:', error);
    } finally {
      this.isProcessing = false;
      logger.debug('Anomaly detection processing stopped');
    }
  }

  /**
   * Process a single task
   */
  private async processSingleTask(): Promise<void> {
    if (this.taskQueue.length === 0) return;

    const availableWorker = this.getAvailableWorker();
    if (!availableWorker) {
      // Wait for worker to become available
      await new Promise(resolve => setTimeout(resolve, 100));
      return;
    }

    const task = this.taskQueue.shift()!;
    this.activeTasks.set(task.id, task);

    const startTime = Date.now();
    
    try {
      await this.processTaskWithWorker(availableWorker, task);
    } catch (error) {
      logger.error(`Task ${task.id} failed:`, error);
      this.processingStats.failed++;
    } finally {
      this.activeTasks.delete(task.id);
      
      // Update processing time stats
      const processingTime = Date.now() - startTime;
      this.updateProcessingStats(processingTime);
    }
  }

  /**
   * Process multiple tasks as a batch
   */
  private async processBatch(): Promise<void> {
    const batchSize = Math.min(this.config.batchSize, this.taskQueue.length);
    const batch = this.taskQueue.splice(0, batchSize);

    const batchTask: AnomalyTask = {
      id: generateSecureActionId(),
      type: 'batch',
      timestamp: Date.now(),
      data: { tasks: batch },
      priority: 'medium'
    };

    const availableWorker = this.getAvailableWorker();
    if (!availableWorker) {
      // Put batch back and wait
      this.taskQueue.unshift(...batch);
      await new Promise(resolve => setTimeout(resolve, 100));
      return;
    }

    this.activeTasks.set(batchTask.id, batchTask);

    const startTime = Date.now();
    
    try {
      await this.processTaskWithWorker(availableWorker, batchTask);
      logger.debug(`Processed batch of ${batch.length} tasks`);
    } catch (error) {
      logger.error(`Batch ${batchTask.id} failed:`, error);
      this.processingStats.failed += batch.length;
    } finally {
      this.activeTasks.delete(batchTask.id);
      
      const processingTime = Date.now() - startTime;
      this.updateProcessingStats(processingTime);
    }
  }

  /**
   * Process a task with a worker
   */
  private async processTaskWithWorker(worker: Worker, task: AnomalyTask): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Task ${task.id} timed out`));
      }, this.config.workerTimeoutMs);

      const messageHandler = (event: MessageEvent) => {
        const { type, taskId, result, error } = event.data;
        
        if (taskId === task.id) {
          clearTimeout(timeout);
          worker.removeEventListener('message', messageHandler);
          
          if (type === 'success') {
            this.handleTaskSuccess(task, result);
            resolve();
          } else if (type === 'error') {
            reject(new Error(error));
          }
        }
      };

      worker.addEventListener('message', messageHandler);
      worker.postMessage({
        type: 'process',
        taskId: task.id,
        taskType: task.type,
        data: task.data
      });
    });
  }

  /**
   * Handle successful task completion
   */
  private handleTaskSuccess(task: AnomalyTask, result: AnomalyResult): void {
    logger.debug(`Task ${task.id} completed successfully`);
    this.processingStats.processed++;
    
    // Emit results to subscribers
    this.emitResults(result);
  }

  /**
   * Handle worker messages
   */
  private handleWorkerMessage(data: any): void {
    const { type, taskId: _taskId, result, error: _error } = data;
    
    if (type === 'heartbeat') {
      logger.debug(`Worker heartbeat received`);
    } else if (type === 'metrics') {
      logger.debug(`Worker metrics:`, result);
    }
  }

  /**
   * Handle worker errors
   */
  private handleWorkerError(worker: Worker, error: any): void {
    logger.error('Worker error:', error);
    
    // Restart worker if possible
    try {
      worker.terminate();
      const newWorker = new Worker(
        new URL('../workers/anomaly-detection.worker.ts', import.meta.url),
        { type: 'module' }
      );
      
      const index = this.workers.indexOf(worker);
      if (index !== -1) {
        this.workers[index] = newWorker;
      }
    } catch (restartError) {
      logger.error('Failed to restart worker:', restartError);
    }
  }

  /**
   * Get an available worker with improved scheduling
   */
  private getAvailableWorker(): Worker | null {
    if (this.workers.length === 0) {
      return null;
    }

    // Track worker busy states and task queues
    const workerStats = this.workers.map((worker, index) => ({
      worker,
      index,
      busyTasks: Array.from(this.activeTasks.values()).filter(task => 
        task.id.endsWith(`_worker_${index}`)
      ).length,
      isAvailable: true // In a real implementation, track this properly
    }));

    // Find the least busy worker
    const availableWorkers = workerStats.filter(w => w.isAvailable);
    if (availableWorkers.length === 0) {
      logger.warn('No available workers, tasks will be queued');
      return null;
    }

    // Sort by least busy first
    availableWorkers.sort((a, b) => a.busyTasks - b.busyTasks);
    
    const selectedWorker = availableWorkers[0];
    logger.debug(`Selected worker ${selectedWorker.index} with ${selectedWorker.busyTasks} busy tasks`);
    
    return selectedWorker.worker;
  }

  /**
   * Enhanced worker management with health checks
   */
  private async _performWorkerHealthCheck(): Promise<void> {
    const healthPromises = this.workers.map(async (worker, index) => {
      try {
        // Send ping to worker
        const pingId = generateSecureActionId();
        const pingPromise = new Promise<boolean>((resolve) => {
          const timeout = setTimeout(() => resolve(false), 5000);
          
          const handler = (event: MessageEvent) => {
            if (event.data.type === 'pong' && event.data.pingId === pingId) {
              clearTimeout(timeout);
              worker.removeEventListener('message', handler);
              resolve(true);
            }
          };
          
          worker.addEventListener('message', handler);
        });

        worker.postMessage({ type: 'ping', pingId });
        const isHealthy = await pingPromise;
        
        if (!isHealthy) {
          logger.warn(`Worker ${index} failed health check, restarting`);
          // TODO: Implement restartWorker method
          // await this.restartWorker(index);
        }
      } catch (error) {
        logger.error(`Health check failed for worker ${index}:`, error);
        // TODO: Implement restartWorker method
        // await this.restartWorker(index);
      }
    });

    await Promise.allSettled(healthPromises);
  }

  /**
   * Intelligent task scheduling with backpressure handling
   */
  private async _scheduleTask(task: AnomalyTask): Promise<void> {
    // Check queue capacity
    if (this.taskQueue.length >= this.config.queueMaxSize) {
      // Drop lowest priority tasks if queue is full
      const lowPriorityIndex = this.taskQueue.findIndex(t => t.priority === 'low');
      if (lowPriorityIndex !== -1) {
        const droppedTask = this.taskQueue.splice(lowPriorityIndex, 1)[0];
        logger.warn(`Dropped low priority task ${droppedTask.id} due to queue overflow`);
      } else {
        throw new Error('Task queue is full and no low priority tasks to drop');
      }
    }

    // Insert task by priority
    this.insertTaskByPriority(task);
    
    // Update stats
    this.processingStats.queueSize = this.taskQueue.length;
    
    // TODO: Implement processQueue method
    // this.processQueue();
  }

  /**
   * Insert task by priority
   */
  private insertTaskByPriority(task: AnomalyTask): void {
    const priorityOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };
    
    let insertIndex = this.taskQueue.length;
    for (let i = 0; i < this.taskQueue.length; i++) {
      if (priorityOrder[task.priority] < priorityOrder[this.taskQueue[i].priority]) {
        insertIndex = i;
        break;
      }
    }
    
    this.taskQueue.splice(insertIndex, 0, task);
  }

  /**
   * Update processing statistics
   */
  private updateProcessingStats(processingTime: number): void {
    const totalProcessed = this.processingStats.processed + this.processingStats.failed;
    this.processingStats.averageProcessingTime = 
      (this.processingStats.averageProcessingTime * (totalProcessed - 1) + processingTime) / totalProcessed;
  }

  /**
   * Emit results to subscribers
   */
  private emitResults(result: AnomalyResult): void {
    // Emit to event system or callback subscribers
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('anomaly-results', { detail: result }));
    }
  }

  /**
   * Get processing statistics
   */
  public getStats(): any {
    return {
      ...this.processingStats,
      activeWorkers: this.workers.length,
      activeTasks: this.activeTasks.size,
      queueSize: this.taskQueue.length
    };
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.workers.forEach(worker => worker.terminate());
    this.workers = [];
    this.taskQueue = [];
    this.activeTasks.clear();
    this.isProcessing = false;
    
    logger.debug('Anomaly processor cleanup completed');
  }
}

/**
 * Serverless function handler for anomaly detection
 * For deployment to serverless platforms like Vercel, Netlify, etc.
 */
export async function serverlessAnomalyHandler(request: Request): Promise<Response> {
  const logger = createLogger('SERVERLESS_ANOMALY');
  
  try {
    const { events, config } = await request.json();
    
    // Process events for anomalies
    const startTime = Date.now();
    const results = await processEventsForAnomalies(events, config);
    const processingTime = Date.now() - startTime;
    
    logger.debug(`Processed ${events.length} events in ${processingTime}ms`);
    
    return new Response(JSON.stringify({
      success: true,
      results,
      processingTime,
      timestamp: Date.now()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logger.error('Serverless anomaly detection error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Process events for anomalies in a serverless context
 */
async function processEventsForAnomalies(events: any[], config: any): Promise<any[]> {
  // Import anomaly detection logic
  const { AnomalyDetectionCapability } = await import('./ai/capabilities/anomaly-detection');
  
  const detector = new AnomalyDetectionCapability(null as any); // No connection needed for pure analysis
  const results = [];
  
  for (const event of events) {
    try {
      const alerts = await detector.processEvent(event);
      if (alerts.length > 0) {
        results.push({
          event,
          alerts,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      logger.error('Error processing event:', error);
    }
  }
  
  return results;
}

// Export singleton instance
export const anomalyProcessor = new OffThreadAnomalyProcessor();