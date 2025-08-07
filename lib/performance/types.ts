export interface PerformanceMetrics {
  // Browser Performance API Metrics
  fps: number;
  memoryUsage: {
    used: number;
    total: number;
    limit: number;
  };
  
  // Network & API Metrics
  apiResponseTime: number;
  networkLatency: number;
  
  // User Experience Metrics
  loadTime: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  timeToInteractive: number;
  
  // Custom Application Metrics
  graphRenderTime?: number;
  transactionProcessingTime?: number;
  componentMountTime?: number;
  
  // Metadata
  timestamp: number;
  url: string;
  userAgent: string;
  sessionId: string;
}

export interface PerformanceAlert {
  id: string;
  type: 'warning' | 'critical' | 'info';
  metric: keyof PerformanceMetrics;
  threshold: number;
  currentValue: number;
  message: string;
  timestamp: number;
  resolved: boolean;
}

export interface PerformanceThresholds {
  fps: { warning: number; critical: number };
  memoryUsage: { warning: number; critical: number };
  apiResponseTime: { warning: number; critical: number };
  loadTime: { warning: number; critical: number };
  firstContentfulPaint: { warning: number; critical: number };
  largestContentfulPaint: { warning: number; critical: number };
  cumulativeLayoutShift: { warning: number; critical: number };
  timeToInteractive: { warning: number; critical: number };
}

export interface PerformanceConfig {
  enabled: boolean;
  collectInterval: number; // ms
  reportInterval: number; // ms
  thresholds: PerformanceThresholds;
  enabledMetrics: (keyof PerformanceMetrics)[];
  debugMode: boolean;
}

export interface PerformanceReport {
  sessionId: string;
  startTime: number;
  endTime: number;
  metrics: PerformanceMetrics[];
  alerts: PerformanceAlert[];
  summary: {
    avgFps: number;
    avgMemoryUsage: number;
    avgApiResponseTime: number;
    totalAlerts: number;
    criticalAlerts: number;
  };
}

export interface UserInteraction {
  id: string;
  type: 'click' | 'scroll' | 'input' | 'navigation' | 'error';
  element?: string;
  timestamp: number;
  metadata?: Record<string, any>;
  performance?: Partial<PerformanceMetrics>;
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
  component?: string;
  metadata?: Record<string, any>;
  performance?: Partial<PerformanceMetrics>;
  trace?: string;
}