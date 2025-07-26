// Simple mutex implementation for preventing race conditions
export class Mutex {
  private locked = false;
  private queue: (() => void)[] = [];
  private readonly maxQueueSize = 100; // Prevent unbounded growth

  async acquire(): Promise<() => void> {
    // Check queue size to prevent memory issues
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error('Mutex queue is full - too many pending operations');
    }

    while (this.locked) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.locked = true;
    return () => this.release();
  }

  private release(): void {
    this.locked = false;
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }
}

// Global mutexes for different operations
export const boostMutex = new Mutex();