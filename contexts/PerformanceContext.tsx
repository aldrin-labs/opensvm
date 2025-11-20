'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import PerformanceMonitor from '@/lib/performance/monitor';
import { PerformanceMetrics, PerformanceAlert, PerformanceConfig, UserInteraction } from '@/lib/performance/types';
import { regressionDetector, RegressionDetection, PerformanceBaseline } from '@/lib/performance/regression-detector';
import { logger } from '@/lib/logging/logger';

interface PerformanceContextType {
  monitor: PerformanceMonitor;
  isMonitoring: boolean;
  latestMetrics: PerformanceMetrics | null;
  alerts: PerformanceAlert[];
  regressionDetections: RegressionDetection[];
  baselines: PerformanceBaseline[];
  startMonitoring: () => void;
  stopMonitoring: () => void;
  clearAlerts: () => void;
  trackInteraction: (interaction: Omit<UserInteraction, 'id' | 'timestamp'>) => void;
  trackCustomMetric: (name: string, value: number, metadata?: Record<string, any>) => void;
  createBaseline: (environment?: 'development' | 'staging' | 'production', version?: string) => PerformanceBaseline | null;
  removeBaseline: (id: string) => boolean;
  startRegressionDetection: () => void;
  stopRegressionDetection: () => void;
}

const PerformanceContext = createContext<PerformanceContextType | null>(null);

interface PerformanceProviderProps {
  children: ReactNode;
  config?: Partial<PerformanceConfig>;
  autoStart?: boolean;
}

export function PerformanceProvider({
  children,
  config,
  autoStart = true
}: PerformanceProviderProps) {
  const [monitor] = useState(() => PerformanceMonitor.getInstance(config));
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [latestMetrics, setLatestMetrics] = useState<PerformanceMetrics | null>(null);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [regressionDetections, setRegressionDetections] = useState<RegressionDetection[]>([]);
  const [baselines, setBaselines] = useState<PerformanceBaseline[]>([]);

  useEffect(() => {
    // Set up event listeners for performance events
    const handleAlert = (event: CustomEvent) => {
      const alert = event.detail as PerformanceAlert;
      setAlerts(prev => [...prev, alert]);
      
      // Log performance alerts
      logger.warn(`Performance alert: ${alert.type} on ${alert.metric}`, {
        metadata: { alertId: alert.id, threshold: alert.threshold, currentValue: alert.currentValue }
      });
    };

    const handleReport = (event: CustomEvent) => {
      const report = event.detail;
      const latestMetric = report.metrics[report.metrics.length - 1] || null;
      setLatestMetrics(latestMetric);
      
      // Feed metrics to regression detector
      if (latestMetric) {
        regressionDetector.addMetrics(latestMetric);
      }
      
      // Log performance summary
      logger.info('Performance report generated', {
        metadata: {
          summary: report.summary,
          metricsCount: report.metrics.length,
          alertsCount: report.alerts.length
        }
      });
    };

    const handleCustomMetric = (event: CustomEvent) => {
      const { name, value, metadata } = event.detail;
      logger.debug(`Custom metric: ${name}`, {
        metadata: { customMetricName: name, customMetricValue: value, ...metadata }
      });
    };

    const handleUserInteraction = (event: CustomEvent) => {
      const interaction = event.detail as UserInteraction;
      logger.debug(`User interaction: ${interaction.type} on ${interaction.element || 'unknown'}`, {
        metadata: { interactionId: interaction.id, ...interaction.metadata }
      });
    };

    // Set up regression detection listener
    const unsubscribeRegression = regressionDetector.onRegressionDetected((detection) => {
      setRegressionDetections(prev => [detection, ...prev.slice(0, 49)]);
      
      // Log regression detection
      logger.warn('Performance regression detected', {
        component: 'PerformanceProvider',
        metadata: {
          metric: detection.metric,
          degradation: `${detection.degradationPercent.toFixed(2)}%`,
          severity: detection.severity
        }
      });
    });

    // Load initial baselines
    setBaselines(regressionDetector.getBaselines());

    // Add event listeners
    window.addEventListener('performance-alert', handleAlert as EventListener);
    window.addEventListener('performance-report', handleReport as EventListener);
    window.addEventListener('performance-custom-metric', handleCustomMetric as EventListener);
    window.addEventListener('performance-user-interaction', handleUserInteraction as EventListener);

    // Auto-start monitoring if enabled
    if (autoStart && typeof window !== 'undefined') {
      startMonitoring();
    }

    return () => {
      window.removeEventListener('performance-alert', handleAlert as EventListener);
      window.removeEventListener('performance-report', handleReport as EventListener);
      window.removeEventListener('performance-custom-metric', handleCustomMetric as EventListener);
      window.removeEventListener('performance-user-interaction', handleUserInteraction as EventListener);
      unsubscribeRegression();
      
      if (isMonitoring) {
        monitor.stop();
      }
    };
  }, [monitor, autoStart]);

  const startMonitoring = () => {
    try {
      monitor.start();
      setIsMonitoring(true);
      logger.info('Performance monitoring started', {
        component: 'PerformanceProvider',
        metadata: { config: monitor.getConfig() }
      });
    } catch (error) {
      logger.error('Failed to start performance monitoring', {
        component: 'PerformanceProvider',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
  };

  const stopMonitoring = () => {
    try {
      monitor.stop();
      setIsMonitoring(false);
      logger.info('Performance monitoring stopped', {
        component: 'PerformanceProvider'
      });
    } catch (error) {
      logger.error('Failed to stop performance monitoring', {
        component: 'PerformanceProvider',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
  };

  const clearAlerts = () => {
    monitor.clearAlerts();
    setAlerts([]);
    logger.debug('Performance alerts cleared', {
      component: 'PerformanceProvider'
    });
  };

  const trackInteraction = (interaction: Omit<UserInteraction, 'id' | 'timestamp'>) => {
    monitor.trackInteraction(interaction);
  };

  const trackCustomMetric = (name: string, value: number, metadata?: Record<string, any>) => {
    monitor.trackCustomMetric(name, value, metadata);
  };

  const createBaseline = (
    environment: 'development' | 'staging' | 'production' = 'development',
    version?: string
  ): PerformanceBaseline | null => {
    const baseline = regressionDetector.createBaseline(environment, version);
    if (baseline) {
      setBaselines(regressionDetector.getBaselines());
    }
    return baseline;
  };

  const removeBaseline = (id: string): boolean => {
    const removed = regressionDetector.removeBaseline(id);
    if (removed) {
      setBaselines(regressionDetector.getBaselines());
    }
    return removed;
  };

  const startRegressionDetection = () => {
    regressionDetector.startDetection();
    logger.info('Regression detection started', {
      component: 'PerformanceProvider'
    });
  };

  const stopRegressionDetection = () => {
    regressionDetector.stopDetection();
    logger.info('Regression detection stopped', {
      component: 'PerformanceProvider'
    });
  };

  const value: PerformanceContextType = {
    monitor,
    isMonitoring,
    latestMetrics,
    alerts,
    regressionDetections,
    baselines,
    startMonitoring,
    stopMonitoring,
    clearAlerts,
    trackInteraction,
    trackCustomMetric,
    createBaseline,
    removeBaseline,
    startRegressionDetection,
    stopRegressionDetection,
  };

  return (
    <PerformanceContext.Provider value={value}>
      {children}
    </PerformanceContext.Provider>
  );
}

export function usePerformance(): PerformanceContextType {
  const context = useContext(PerformanceContext);
  if (!context) {
    throw new Error('usePerformance must be used within a PerformanceProvider');
  }
  return context;
}

// Hook for component performance tracking
export function useComponentPerformance(componentName: string) {
  const { trackCustomMetric, trackInteraction } = usePerformance();
  const [mountTime, setMountTime] = useState<number | null>(null);

  useEffect(() => {
    const startTime = performance.now();
    
    const cleanup = () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      setMountTime(duration);
      
      trackCustomMetric(`component-mount-${componentName}`, duration, {
        component: componentName,
        mountTime: duration
      });
      
      logger.debug(`Component mounted: ${componentName} in ${duration.toFixed(2)}ms`, {
        metadata: { component: componentName, duration }
      });
    };

    // Track mount completion
    setTimeout(cleanup, 0);

    return () => {
      if (mountTime !== null) {
        const unmountTime = performance.now() - startTime;
        trackCustomMetric(`component-unmount-${componentName}`, unmountTime, {
          component: componentName,
          lifetimeMs: unmountTime
        });
      }
    };
  }, [componentName, trackCustomMetric, mountTime]);

  const trackEvent = (eventType: string, metadata?: Record<string, any>) => {
    trackInteraction({
      type: eventType as any,
      element: componentName,
      metadata: { component: componentName, ...metadata }
    });
  };

  return {
    mountTime,
    trackEvent,
    trackCustomMetric: (name: string, value: number, metadata?: Record<string, any>) => 
      trackCustomMetric(name, value, { component: componentName, ...metadata })
  };
}

// Hook for API performance tracking
export function useApiPerformance() {
  const { trackCustomMetric } = usePerformance();

  function trackApiCall<T>(
    apiCall: () => Promise<T>,
    operationName: string,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = performance.now();
    const startTimestamp = Date.now();
    
    return apiCall()
      .then((result) => {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        // Track successful API call
        trackCustomMetric(`api-${operationName}-duration`, duration, {
          operation: operationName,
          success: true,
          startTime: startTimestamp,
          endTime: Date.now(),
          ...metadata
        });
        
        logger.info(`API request completed: ${operationName} in ${duration.toFixed(2)}ms`, {
          metadata: { operation: operationName, duration, success: true, ...metadata }
        });
        
        return result;
      })
      .catch((error) => {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        // Track failed API call
        trackCustomMetric(`api-${operationName}-error`, duration, {
          operation: operationName,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          startTime: startTimestamp,
          endTime: Date.now(),
          ...metadata
        });
        
        logger.error(`API request failed: ${operationName}`, {
          metadata: { operation: operationName, duration, error: error instanceof Error ? error.message : 'Unknown error', ...metadata }
        });
        
        throw error;
      });
  }

  return { trackApiCall };
}

// Hook for user interaction tracking
export function useInteractionTracking() {
  const { trackInteraction } = usePerformance();

  const trackClick = (element: string, metadata?: Record<string, any>) => {
    trackInteraction({
      type: 'click',
      element,
      metadata
    });
  };

  const trackScroll = (element: string, metadata?: Record<string, any>) => {
    trackInteraction({
      type: 'scroll',
      element,
      metadata
    });
  };

  const trackInput = (element: string, metadata?: Record<string, any>) => {
    trackInteraction({
      type: 'input',
      element,
      metadata
    });
  };

  const trackNavigation = (to: string, metadata?: Record<string, any>) => {
    trackInteraction({
      type: 'navigation',
      element: to,
      metadata
    });
  };

  return {
    trackClick,
    trackScroll,
    trackInput,
    trackNavigation
  };
}

export default PerformanceProvider;
