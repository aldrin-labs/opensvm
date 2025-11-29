/**
 * Strategy Scheduler
 *
 * Client-side scheduler for autonomous strategy execution.
 * Runs in background using setInterval (or service worker in production).
 */

import { strategyEngine } from './strategy-engine';

export class StrategyScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private checkIntervalMs: number = 60 * 1000; // Check every minute
  private isRunning: boolean = false;

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      console.warn('Scheduler already running');
      return;
    }

    console.log('Starting strategy scheduler...');
    this.isRunning = true;

    // Immediate check
    this.checkStrategies();

    // Periodic checks
    this.intervalId = setInterval(() => {
      this.checkStrategies();
    }, this.checkIntervalMs);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      console.warn('Scheduler not running');
      return;
    }

    console.log('Stopping strategy scheduler...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Check and execute due strategies
   */
  private async checkStrategies(): Promise<void> {
    try {
      await strategyEngine.checkAndExecuteStrategies();
    } catch (error) {
      console.error('Strategy check failed:', error);
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): { isRunning: boolean; checkIntervalMs: number } {
    return {
      isRunning: this.isRunning,
      checkIntervalMs: this.checkIntervalMs,
    };
  }
}

// Singleton instance
export const strategyScheduler = new StrategyScheduler();

// Auto-start scheduler when module loads (if in browser)
if (typeof window !== 'undefined') {
  // Wait for page load
  if (document.readyState === 'complete') {
    strategyScheduler.start();
  } else {
    window.addEventListener('load', () => {
      strategyScheduler.start();
    });
  }

  // Stop on page unload
  window.addEventListener('beforeunload', () => {
    strategyScheduler.stop();
  });
}
