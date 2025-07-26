// Simple mutex implementation for preventing race conditions
export class Mutex {
  private locked = false;
  private queue: (() => void)[] = [];

  async acquire(): Promise<() => void> {
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