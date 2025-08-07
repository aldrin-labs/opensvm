import { useEffect, useState, useCallback } from 'react';
import { 
  regressionDetector, 
  RegressionDetection, 
  PerformanceBaseline,
  RegressionDetectorConfig 
} from '@/lib/performance/regression-detector';
import { usePerformance } from '@/contexts/PerformanceContext';
import { logger } from '@/lib/logging/logger';

export interface UseRegressionDetectionReturn {
  // State
  detections: RegressionDetection[];
  baselines: PerformanceBaseline[];
  isDetecting: boolean;
  
  // Actions
  createBaseline: (environment?: 'development' | 'staging' | 'production', version?: string) => PerformanceBaseline | null;
  removeBaseline: (id: string) => boolean;
  startDetection: () => void;
  stopDetection: () => void;
  clearDetections: () => void;
  
  // Configuration
  updateConfig: (config: Partial<RegressionDetectorConfig>) => void;
  
  // Statistics
  getDetectionStats: () => {
    totalDetections: number;
    criticalDetections: number;
    highDetections: number;
    mediumDetections: number;
    lowDetections: number;
    recentDetections: number; // Last 24 hours
  };
}

export function useRegressionDetection(): UseRegressionDetectionReturn {
  const { latestMetrics } = usePerformance();
  const [detections, setDetections] = useState<RegressionDetection[]>([]);
  const [baselines, setBaselines] = useState<PerformanceBaseline[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);

  // Initialize state and setup listeners
  useEffect(() => {
    // Load initial baselines
    setBaselines(regressionDetector.getBaselines());

    // Subscribe to regression detections
    const unsubscribe = regressionDetector.onRegressionDetected((detection) => {
      setDetections(prev => [detection, ...prev.slice(0, 99)]); // Keep last 100
      
      logger.warn('Regression detected via hook', {
        component: 'useRegressionDetection',
        metadata: {
          metric: detection.metric,
          degradation: detection.degradationPercent,
          severity: detection.severity
        }
      });
    });

    return unsubscribe;
  }, []);

  // Feed metrics to regression detector when new metrics arrive
  useEffect(() => {
    if (latestMetrics) {
      regressionDetector.addMetrics(latestMetrics);
    }
  }, [latestMetrics]);

  const createBaseline = useCallback((
    environment: 'development' | 'staging' | 'production' = 'development',
    version?: string
  ): PerformanceBaseline | null => {
    try {
      const baseline = regressionDetector.createBaseline(environment, version);
      if (baseline) {
        setBaselines(regressionDetector.getBaselines());
        
        logger.info('Baseline created via hook', {
          component: 'useRegressionDetection',
          metadata: {
            baselineId: baseline.id,
            environment,
            version,
            sampleSize: baseline.sampleSize
          }
        });
      }
      return baseline;
    } catch (error) {
      logger.error('Failed to create baseline', error, {
        component: 'useRegressionDetection'
      });
      return null;
    }
  }, []);

  const removeBaseline = useCallback((id: string): boolean => {
    try {
      const removed = regressionDetector.removeBaseline(id);
      if (removed) {
        setBaselines(regressionDetector.getBaselines());
        
        logger.info('Baseline removed via hook', {
          component: 'useRegressionDetection',
          metadata: { baselineId: id }
        });
      }
      return removed;
    } catch (error) {
      logger.error('Failed to remove baseline', error, {
        component: 'useRegressionDetection',
        metadata: { baselineId: id }
      });
      return false;
    }
  }, []);

  const startDetection = useCallback(() => {
    try {
      regressionDetector.startDetection();
      setIsDetecting(true);
      
      logger.info('Regression detection started via hook', {
        component: 'useRegressionDetection'
      });
    } catch (error) {
      logger.error('Failed to start regression detection', error, {
        component: 'useRegressionDetection'
      });
    }
  }, []);

  const stopDetection = useCallback(() => {
    try {
      regressionDetector.stopDetection();
      setIsDetecting(false);
      
      logger.info('Regression detection stopped via hook', {
        component: 'useRegressionDetection'
      });
    } catch (error) {
      logger.error('Failed to stop regression detection', error, {
        component: 'useRegressionDetection'
      });
    }
  }, []);

  const clearDetections = useCallback(() => {
    setDetections([]);
    
    logger.info('Regression detections cleared via hook', {
      component: 'useRegressionDetection'
    });
  }, []);

  const updateConfig = useCallback((config: Partial<RegressionDetectorConfig>) => {
    try {
      regressionDetector.updateConfig(config);
      
      logger.info('Regression detector config updated via hook', {
        component: 'useRegressionDetection',
        metadata: { updatedFields: Object.keys(config) }
      });
    } catch (error) {
      logger.error('Failed to update regression detector config', error, {
        component: 'useRegressionDetection'
      });
    }
  }, []);

  const getDetectionStats = useCallback(() => {
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);

    const totalDetections = detections.length;
    const criticalDetections = detections.filter(d => d.severity === 'critical').length;
    const highDetections = detections.filter(d => d.severity === 'high').length;
    const mediumDetections = detections.filter(d => d.severity === 'medium').length;
    const lowDetections = detections.filter(d => d.severity === 'low').length;
    const recentDetections = detections.filter(d => d.timestamp >= oneDayAgo).length;

    return {
      totalDetections,
      criticalDetections,
      highDetections,
      mediumDetections,
      lowDetections,
      recentDetections
    };
  }, [detections]);

  return {
    // State
    detections,
    baselines,
    isDetecting,
    
    // Actions
    createBaseline,
    removeBaseline,
    startDetection,
    stopDetection,
    clearDetections,
    
    // Configuration
    updateConfig,
    
    // Statistics
    getDetectionStats
  };
}

// Specialized hook for component-level regression monitoring
export function useComponentRegressionMonitoring(componentName: string) {
  const { createBaseline, detections } = useRegressionDetection();
  const [componentBaseline, setComponentBaseline] = useState<PerformanceBaseline | null>(null);

  // Filter detections relevant to this component
  const componentDetections = detections.filter(detection => 
    detection.context.version?.includes(componentName) ||
    detection.context.branch?.includes(componentName)
  );

  const createComponentBaseline = useCallback((version?: string) => {
    const baseline = createBaseline('development', version || `${componentName}-${Date.now()}`);
    if (baseline) {
      setComponentBaseline(baseline);
    }
    return baseline;
  }, [componentName, createBaseline]);

  return {
    componentDetections,
    componentBaseline,
    createComponentBaseline,
    hasRecentRegressions: componentDetections.some(d => 
      Date.now() - d.timestamp < 60 * 60 * 1000 // Last hour
    )
  };
}

// Hook for automated baseline management
export function useAutomatedBaselines(config?: {
  autoCreateInterval?: number; // hours
  maxBaselines?: number;
  environments?: ('development' | 'staging' | 'production')[];
}) {
  const { createBaseline, baselines, removeBaseline } = useRegressionDetection();
  
  const defaultConfig = {
    autoCreateInterval: 24, // 24 hours
    maxBaselines: 10,
    environments: ['development'] as const
  };
  
  const effectiveConfig = { ...defaultConfig, ...config };

  useEffect(() => {
    const interval = setInterval(() => {
      effectiveConfig.environments.forEach(environment => {
        // Check if we need a new baseline for this environment
        const environmentBaselines = baselines.filter(b => b.environment === environment);
        const latestBaseline = environmentBaselines.sort((a, b) => b.timestamp - a.timestamp)[0];
        
        const shouldCreate = !latestBaseline || 
          (Date.now() - latestBaseline.timestamp) > (effectiveConfig.autoCreateInterval * 60 * 60 * 1000);
        
        if (shouldCreate) {
          const baseline = createBaseline(environment, `auto-${Date.now()}`);
          
          if (baseline) {
            logger.info('Auto-created baseline', {
              component: 'useAutomatedBaselines',
              metadata: {
                baselineId: baseline.id,
                environment,
                trigger: 'scheduled'
              }
            });
          }
        }
        
        // Clean up old baselines if we have too many
        if (environmentBaselines.length > effectiveConfig.maxBaselines) {
          const sorted = environmentBaselines.sort((a, b) => a.timestamp - b.timestamp);
          const toRemove = sorted.slice(0, environmentBaselines.length - effectiveConfig.maxBaselines);
          
          toRemove.forEach(baseline => {
            removeBaseline(baseline.id);
            
            logger.info('Auto-removed old baseline', {
              component: 'useAutomatedBaselines',
              metadata: {
                baselineId: baseline.id,
                environment,
                reason: 'cleanup'
              }
            });
          });
        }
      });
    }, 60 * 60 * 1000); // Check every hour

    return () => clearInterval(interval);
  }, [baselines, createBaseline, removeBaseline, effectiveConfig]);

  return {
    baselineCount: baselines.length,
    environments: effectiveConfig.environments,
    config: effectiveConfig
  };
}