import { Connection } from '@solana/web3.js';
import { getConnection } from '@/lib/solana-connection';
import { getDuckDBCache } from '@/lib/data-cache/duckdb-cache';
import { AnalyticsCallback, AnalyticsConfig } from '@/lib/types/solana-analytics';

export abstract class BaseAnalytics {
  protected connection: Connection | null = null;
  protected cache = getDuckDBCache();
  protected config: AnalyticsConfig;
  protected intervals: NodeJS.Timeout[] = [];
  protected callbacks: Map<string, AnalyticsCallback<any>[]> = new Map();
  
  // State management for initialization and monitoring
  private initializationPromise: Promise<void> | null = null;
  private isInitialized = false;
  private isMonitoring = false;
  private isInitializing = false;

  constructor(config: AnalyticsConfig) {
    this.config = config;
  }

  /**
   * Initialize the analytics engine with proper state guards
   */
  async initialize(): Promise<void> {
    // Prevent multiple parallel initializations
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.isInitializing = true;
    this.initializationPromise = this.performInitialization();
    
    try {
      await this.initializationPromise;
      this.isInitialized = true;
    } catch (error) {
      this.initializationPromise = null;
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  private async performInitialization(): Promise<void> {
    try {
      this.connection = await getConnection();
      await this.cache.initialize();
      await this.onInitialize();
      console.log(`${this.getAnalyticsName()} initialized successfully`);
    } catch (error) {
      console.error(`Failed to initialize ${this.getAnalyticsName()}:`, error);
      throw error;
    }
  }

  /**
   * Override this method to perform custom initialization logic
   */
  protected abstract onInitialize(): Promise<void>;

  /**
   * Get the name of the analytics engine for logging
   */
  protected abstract getAnalyticsName(): string;

  /**
   * Start monitoring with proper state guards
   */
  async startMonitoring(): Promise<void> {
    // Ensure we're initialized first
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Prevent starting monitoring if already active
    if (this.isMonitoring) {
      console.warn(`${this.getAnalyticsName()} monitoring is already active`);
      return;
    }

    try {
      await this.onStartMonitoring();
      this.isMonitoring = true;
      console.log(`${this.getAnalyticsName()} monitoring started`);
    } catch (error) {
      console.error(`Failed to start ${this.getAnalyticsName()} monitoring:`, error);
      throw error;
    }
  }

  /**
   * Override this method to implement monitoring logic
   */
  protected abstract onStartMonitoring(): Promise<void>;

  /**
   * Stop monitoring with proper cleanup
   */
  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
      console.warn(`${this.getAnalyticsName()} monitoring is not active`);
      return;
    }

    try {
      // Clear all intervals
      this.intervals.forEach(interval => clearInterval(interval));
      this.intervals = [];
      
      await this.onStopMonitoring();
      this.isMonitoring = false;
      console.log(`${this.getAnalyticsName()} monitoring stopped`);
    } catch (error) {
      console.error(`Error stopping ${this.getAnalyticsName()} monitoring:`, error);
    }
  }

  /**
   * Override this method to implement custom stop logic
   */
  protected async onStopMonitoring(): Promise<void> {
    // Default implementation - can be overridden
  }

  /**
   * Get current monitoring status
   */
  getMonitoringStatus(): {
    isInitialized: boolean;
    isInitializing: boolean;
    isMonitoring: boolean;
  } {
    return {
      isInitialized: this.isInitialized,
      isInitializing: this.isInitializing,
      isMonitoring: this.isMonitoring
    };
  }

  /**
   * Register a callback for specific events
   */
  protected registerCallback<T>(event: string, callback: AnalyticsCallback<T>): void {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    this.callbacks.get(event)!.push(callback);
  }

  /**
   * Emit data to registered callbacks
   */
  protected emit<T>(event: string, data: T): void {
    const callbacks = this.callbacks.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} callback for ${this.getAnalyticsName()}:`, error);
        }
      });
    }
  }

  /**
   * Add an interval to be managed by the analytics engine
   */
  protected addInterval(interval: NodeJS.Timeout): void {
    this.intervals.push(interval);
  }

  /**
   * Create a managed interval that will be automatically cleaned up
   */
  protected createInterval(callback: () => void | Promise<void>, intervalMs: number): NodeJS.Timeout {
    const wrappedCallback = async () => {
      try {
        await callback();
      } catch (error) {
        console.error(`Error in ${this.getAnalyticsName()} interval:`, error);
      }
    };

    const interval = setInterval(wrappedCallback, intervalMs);
    this.addInterval(interval);
    return interval;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.stopMonitoring();
    this.callbacks.clear();
    this.connection = null;
    this.isInitialized = false;
    this.initializationPromise = null;
  }
}