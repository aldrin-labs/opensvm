/**
 * FIFO Queue implementation for efficient event storage
 * Maintains a maximum capacity with automatic overflow handling
 */

export class FIFOQueue<T> {
  private items: T[] = [];
  private maxSize: number;

  constructor(maxSize: number = 10000) {
    this.maxSize = maxSize;
  }

  /**
   * Add item to the front of the queue
   * Automatically removes oldest items if over capacity
   */
  enqueue(item: T): void {
    this.items.unshift(item);
    if (this.items.length > this.maxSize) {
      this.items = this.items.slice(0, this.maxSize);
    }
  }

  /**
   * Get all items as array (newest first)
   */
  getAll(): T[] {
    return [...this.items];
  }

  /**
   * Get items with pagination
   */
  getSlice(start: number, count: number): T[] {
    return this.items.slice(start, start + count);
  }

  /**
   * Get current size
   */
  size(): number {
    return this.items.length;
  }

  /**
   * Clear all items
   */
  clear(): void {
    this.items = [];
  }

  /**
   * Check if queue is at capacity
   */
  isFull(): boolean {
    return this.items.length >= this.maxSize;
  }

  /**
   * Get maximum capacity
   */
  getMaxSize(): number {
    return this.maxSize;
  }

  /**
   * Filter items by predicate
   */
  filter(predicate: (item: T) => boolean): T[] {
    return this.items.filter(predicate);
  }

  /**
   * Find item by predicate
   */
  find(predicate: (item: T) => boolean): T | undefined {
    return this.items.find(predicate);
  }
}