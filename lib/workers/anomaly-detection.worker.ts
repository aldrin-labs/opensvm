/**
 * Web Worker for anomaly detection processing
 * Runs anomaly detection off the main thread to prevent UI blocking
 */

// Import necessary modules for worker environment
import { AnomalyDetectionCapability } from '../ai/capabilities/anomaly-detection';

// Worker state
let detector: AnomalyDetectionCapability | null = null;
let isInitialized = false;
let processingStats = {
  processed: 0,
  failed: 0,
  averageTime: 0
};

/**
 * Initialize the anomaly detector in worker context
 */
async function initializeDetector(): Promise<void> {
  if (isInitialized) return;
  
  try {
    // Initialize without connection for pure analysis
    detector = new AnomalyDetectionCapability(null);
    isInitialized = true;
    
    // Send initialization success
    self.postMessage({
      type: 'initialized',
      timestamp: Date.now()
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error.message,
      timestamp: Date.now()
    });
  }
}

/**
 * Process a single event for anomalies
 */
async function processEvent(taskId: string, event: any): Promise<void> {
  const startTime = Date.now();
  
  try {
    if (!detector) {
      throw new Error('Detector not initialized');
    }
    
    const alerts = await detector.processEvent(event);
    const processingTime = Date.now() - startTime;
    
    // Update stats
    processingStats.processed++;
    processingStats.averageTime = 
      (processingStats.averageTime * (processingStats.processed - 1) + processingTime) / processingStats.processed;
    
    // Send results back to main thread
    self.postMessage({
      type: 'success',
      taskId,
      result: {
        taskId,
        alerts,
        processingTime,
        timestamp: Date.now()
      }
    });
    
  } catch (error) {
    processingStats.failed++;
    
    self.postMessage({
      type: 'error',
      taskId,
      error: error.message,
      timestamp: Date.now()
    });
  }
}

/**
 * Process a batch of events
 */
async function processBatch(taskId: string, tasks: any[]): Promise<void> {
  const startTime = Date.now();
  const results = [];
  
  try {
    if (!detector) {
      throw new Error('Detector not initialized');
    }
    
    for (const task of tasks) {
      try {
        const alerts = await detector.processEvent(task.data);
        results.push({
          taskId: task.id,
          alerts,
          processingTime: Date.now() - startTime,
          timestamp: Date.now()
        });
        
        processingStats.processed++;
      } catch (error) {
        processingStats.failed++;
        results.push({
          taskId: task.id,
          error: error.message,
          timestamp: Date.now()
        });
      }
    }
    
    const totalProcessingTime = Date.now() - startTime;
    processingStats.averageTime = 
      (processingStats.averageTime * (processingStats.processed - tasks.length) + totalProcessingTime) / processingStats.processed;
    
    self.postMessage({
      type: 'success',
      taskId,
      result: {
        taskId,
        batchResults: results,
        totalProcessingTime,
        timestamp: Date.now()
      }
    });
    
  } catch (error) {
    self.postMessage({
      type: 'error',
      taskId,
      error: error.message,
      timestamp: Date.now()
    });
  }
}

/**
 * Send heartbeat to main thread
 */
function sendHeartbeat(): void {
  self.postMessage({
    type: 'heartbeat',
    stats: processingStats,
    timestamp: Date.now()
  });
}

/**
 * Send performance metrics
 */
function sendMetrics(): void {
  const memoryUsage = (self as any).performance?.memory ? {
    usedJSHeapSize: (self as any).performance.memory.usedJSHeapSize,
    totalJSHeapSize: (self as any).performance.memory.totalJSHeapSize,
    jsHeapSizeLimit: (self as any).performance.memory.jsHeapSizeLimit
  } : null;
  
  self.postMessage({
    type: 'metrics',
    result: {
      processingStats,
      memoryUsage,
      timestamp: Date.now()
    }
  });
}

/**
 * Message handler for worker
 */
self.addEventListener('message', async (event) => {
  const { type, taskId, taskType, data } = event.data;
  
  switch (type) {
    case 'init':
      await initializeDetector();
      break;
      
    case 'process':
      if (!isInitialized) {
        await initializeDetector();
      }
      
      if (taskType === 'batch') {
        await processBatch(taskId, data.tasks);
      } else {
        await processEvent(taskId, data);
      }
      break;
      
    case 'heartbeat':
      sendHeartbeat();
      break;
      
    case 'metrics':
      sendMetrics();
      break;
      
    case 'terminate':
      self.close();
      break;
      
    default:
      self.postMessage({
        type: 'error',
        taskId,
        error: `Unknown message type: ${type}`,
        timestamp: Date.now()
      });
  }
});

// Start heartbeat interval
setInterval(sendHeartbeat, 30000); // Every 30 seconds

// Send metrics periodically
setInterval(sendMetrics, 60000); // Every minute

// Initialize on startup
initializeDetector();

export {}; // Make this a module