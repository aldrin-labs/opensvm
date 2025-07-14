/**
 * Memory-efficient Ring Buffer implementation for event storage
 * Maintains fixed memory allocation with circular buffer operations
 * Replaces FIFOQueue for better performance and memory management
 */

export class RingBuffer<T> {
  private buffer: T[];
  private head = 0;
  private tail = 0;
  private count = 0;
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  /**
   * Add item to the buffer (equivalent to enqueue)
   * Automatically overwrites oldest items when at capacity
   */
  push(item: T): void {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;
    
    if (this.count < this.capacity) {
      this.count++;
    } else {
      this.head = (this.head + 1) % this.capacity;
    }
  }

  /**
   * Add item (alias for push to match FIFOQueue interface)
   */
  enqueue(item: T): void {
    this.push(item);
  }

  /**
   * Get all items as array (oldest first for consistency)
   */
  toArray(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this.count; i++) {
      const index = (this.head + i) % this.capacity;
      result.push(this.buffer[index]);
    }
    return result;
  }

  /**
   * Get all items (alias for toArray to match FIFOQueue interface)
   */
  getAll(): T[] {
    return this.toArray();
  }

  /**
   * Get a slice of recent items without copying the entire buffer
   */
  getRecent(maxItems: number): T[] {
    const itemCount = Math.min(maxItems, this.count);
    const result: T[] = [];
    
    for (let i = this.count - itemCount; i < this.count; i++) {
      const index = (this.head + i) % this.capacity;
      result.push(this.buffer[index]);
    }
    
    return result;
  }

  /**
   * Get items with pagination (compatible with FIFOQueue interface)
   */
  getSlice(start: number, count: number): T[] {
    const allItems = this.toArray();
    return allItems.slice(start, start + count);
  }

  /**
   * Filter items by predicate
   */
  filter(predicate: (item: T) => boolean): T[] {
    return this.toArray().filter(predicate);
  }

  /**
   * Find item by predicate
   */
  find(predicate: (item: T) => boolean): T | undefined {
    const items = this.toArray();
    for (let i = 0; i < items.length; i++) {
      if (predicate(items[i])) {
        return items[i];
      }
    }
    return undefined;
  }

  /**
   * Check if buffer is near capacity for memory management
   */
  isNearCapacity(threshold: number = 0.8): boolean {
    return this.count >= this.capacity * threshold;
  }

  /**
   * Clear buffer for memory management
   */
  clear(): void {
    this.head = 0;
    this.tail = 0;
    this.count = 0;
    // Don't reallocate buffer, just reset pointers
  }

  /**
   * Get current size
   */
  size(): number {
    return this.count;
  }

  /**
   * Check if buffer is full
   */
  get isFull(): boolean {
    return this.count === this.capacity;
  }

  /**
   * Get maximum capacity
   */
  getMaxSize(): number {
    return this.capacity;
  }
}