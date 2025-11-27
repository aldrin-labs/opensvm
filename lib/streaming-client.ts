/**
 * Streaming Client for OpenSVM
 * 
 * This utility provides a client for consuming server-sent events (SSE) from the OpenSVM API.
 * It handles connection management, event parsing, and provides a clean interface for
 * consuming streaming data with progress updates.
 */

export type StreamEventType = 
  | 'init'        // Initial connection established
  | 'progress'    // Progress update
  | 'transaction' // Transaction data
  | 'account'     // Account data
  | 'error'       // Error occurred
  | 'complete';   // Stream completed

export interface StreamEvent<T = any> {
  type: StreamEventType;
  data?: T;
  message?: string;
  progress?: number;
  timestamp: number;
  index?: number;
  total?: number;
}

export interface StreamingClientOptions {
  onInit?: () => void;
  onProgress?: (progress: number, message: string) => void;
  onData?: (data: any, type: 'transaction' | 'account') => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
  onConnectionError?: (error: Event) => void;
}

export class StreamingClient {
  private eventSource: EventSource | null = null;
  private options: StreamingClientOptions;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;
  private reconnectDelay: number = 1000; // Start with 1 second delay
  
  constructor(options: StreamingClientOptions = {}) {
    this.options = options;
  }
  
  /**
   * Fetch data using server-sent events
   * @param url The URL to connect to
   * @returns A promise that resolves when the stream completes or rejects on error
   */
  public fetchStream(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Close any existing connection
        this.close();
        
        // Reset reconnect attempts
        this.reconnectAttempts = 0;
        
        // Create new EventSource
        this.eventSource = new EventSource(url);
        
        // Set up event handlers
        this.setupEventHandlers(resolve, reject);
      } catch (err) {
        console.error('Error setting up EventSource:', err);
        this.options.onError?.('Failed to establish connection');
        reject(err);
      }
    });
  }
  
  /**
   * Close the connection
   */
  public close(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
  
  /**
   * Set up event handlers for the EventSource
   */
  private setupEventHandlers(resolve: () => void, reject: (reason?: any) => void): void {
    if (!this.eventSource) return;
    
    // Handle connection open
    this.eventSource.onopen = () => {
      console.log('SSE connection established');
    };
    
    // Handle specific event types
    this.eventSource.addEventListener('init', (event) => {
      try {
        const data = JSON.parse(event.data);
        this.options.onInit?.();
      } catch (err) {
        console.error('Error parsing init event:', err);
      }
    });
    
    this.eventSource.addEventListener('progress', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.progress !== undefined && data.message) {
          this.options.onProgress?.(data.progress, data.message);
        }
      } catch (err) {
        console.error('Error parsing progress event:', err);
      }
    });
    
    this.eventSource.addEventListener('transaction', (event) => {
      try {
        const data = JSON.parse(event.data);
        this.options.onData?.(data.data, 'transaction');
      } catch (err) {
        console.error('Error parsing transaction event:', err);
      }
    });
    
    this.eventSource.addEventListener('account', (event) => {
      try {
        const data = JSON.parse(event.data);
        this.options.onData?.(data.data, 'account');
      } catch (err) {
        console.error('Error parsing account event:', err);
      }
    });
    
    this.eventSource.addEventListener('error', (event) => {
      try {
        // For error events with data
        if (event instanceof MessageEvent) {
          const data = JSON.parse(event.data);
          const errorMsg = data.message || 'Unknown error';
          this.options.onError?.(errorMsg);
        } else {
          // For connection errors
          this.handleConnectionError(event, resolve, reject);
        }
      } catch (err) {
        console.error('Error parsing error event:', err);
        this.options.onError?.('Error parsing stream data');
      }
    });
    
    this.eventSource.addEventListener('complete', (event) => {
      try {
        const data = JSON.parse(event.data);
        this.options.onComplete?.();
        this.close();
        resolve();
      } catch (err) {
        console.error('Error parsing complete event:', err);
        this.close();
        resolve(); // Still resolve as the stream is complete
      }
    });
    
    // Handle general errors
    this.eventSource.onerror = (error) => {
      this.handleConnectionError(error, resolve, reject);
    };
  }
  
  /**
   * Handle connection errors with reconnection logic
   */
  private handleConnectionError(
    error: Event, 
    resolve: () => void, 
    reject: (reason?: any) => void
  ): void {
    // Notify about the connection error
    this.options.onConnectionError?.(error);
    
    // Check if we should reconnect
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      
      // Exponential backoff
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      // Close current connection
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
      
      // Attempt to reconnect after delay
      setTimeout(() => {
        try {
          // Recreate the EventSource with the same URL
          if (this.eventSource?.url) {
            this.eventSource = new EventSource(this.eventSource.url);
            this.setupEventHandlers(resolve, reject);
          } else {
            this.options.onError?.('Failed to reconnect: URL not available');
            reject(new Error('Failed to reconnect: URL not available'));
          }
        } catch (err) {
          console.error('Error during reconnection:', err);
          this.options.onError?.('Failed to reconnect');
          reject(err);
        }
      }, delay);
    } else {
      // Max reconnect attempts reached
      console.error('Max reconnection attempts reached');
      this.options.onError?.('Connection lost. Max reconnection attempts reached.');
      this.close();
      reject(new Error('Connection lost. Max reconnection attempts reached.'));
    }
  }
  
  /**
   * Check if the browser supports EventSource
   */
  public static isSupported(): boolean {
    return typeof EventSource !== 'undefined';
  }
}