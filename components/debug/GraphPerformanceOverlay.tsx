'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, Eye, EyeOff, Settings, Zap, Clock, 
  BarChart3, Cpu, Memory, RefreshCw 
} from 'lucide-react';
import { usePerformance } from '@/contexts/PerformanceContext';
import logger from '@/lib/logging/logger';

interface GraphMetrics {
  fps: number;
  renderTime: number;
  nodeCount: number;
  edgeCount: number;
  memoryUsage: number;
  animationFrames: number;
  layoutCalculationTime: number;
  dataProcessingTime: number;
  lastUpdateTime: number;
}

interface GraphPerformanceOverlayProps {
  graphRef?: React.RefObject<any>;
  isVisible?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  compact?: boolean;
  onToggleVisibility?: (visible: boolean) => void;
}

export function GraphPerformanceOverlay({
  graphRef,
  isVisible = true,
  position = 'top-right',
  compact = false,
  onToggleVisibility
}: GraphPerformanceOverlayProps) {
  const { latestMetrics, trackCustomMetric } = usePerformance();
  const [graphMetrics, setGraphMetrics] = useState<GraphMetrics>({
    fps: 60,
    renderTime: 0,
    nodeCount: 0,
    edgeCount: 0,
    memoryUsage: 0,
    animationFrames: 0,
    layoutCalculationTime: 0,
    dataProcessingTime: 0,
    lastUpdateTime: Date.now(),
  });
  const [showOverlay, setShowOverlay] = useState(isVisible);
  const frameCount = useRef(0);
  const lastFrameTime = useRef(performance.now());
  const renderTimeHistory = useRef<number[]>([]);
  const animationId = useRef<number>();

  // Monitor graph performance
  useEffect(() => {
    if (!showOverlay) return;

    const updateMetrics = () => {
      const now = performance.now();
      const deltaTime = now - lastFrameTime.current;
      
      if (deltaTime > 0) {
        const currentFps = Math.round(1000 / deltaTime);
        frameCount.current++;
        
        // Calculate average render time
        renderTimeHistory.current.push(deltaTime);
        if (renderTimeHistory.current.length > 30) {
          renderTimeHistory.current.shift();
        }
        
        const avgRenderTime = renderTimeHistory.current.reduce((a, b) => a + b, 0) / renderTimeHistory.current.length;
        
        // Get graph-specific data if graphRef is provided
        let nodeCount = 0;
        let edgeCount = 0;
        let layoutTime = 0;
        
        if (graphRef?.current) {
          try {
            // Try to extract metrics from different graph libraries
            const graph = graphRef.current;
            
            // For Cytoscape
            if (graph.nodes && graph.edges) {
              nodeCount = graph.nodes().length || 0;
              edgeCount = graph.edges().length || 0;
            }
            
            // For Force Graph
            if (graph.graphData && typeof graph.graphData === 'function') {
              const data = graph.graphData();
              nodeCount = data.nodes?.length || 0;
              edgeCount = data.links?.length || 0;
            }
            
            // For D3 graphs
            if (graph.selectAll) {
              nodeCount = graph.selectAll('.node').size() || 0;
              edgeCount = graph.selectAll('.link').size() || 0;
            }
          } catch (error) {
            logger.debug('Error extracting graph metrics', {
              component: 'GraphPerformanceOverlay',
              metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
            });
          }
        }
        
        const newMetrics: GraphMetrics = {
          fps: currentFps,
          renderTime: avgRenderTime,
          nodeCount,
          edgeCount,
          memoryUsage: latestMetrics?.memoryUsage.used || 0,
          animationFrames: frameCount.current,
          layoutCalculationTime: layoutTime,
          dataProcessingTime: 0, // This would be measured during data updates
          lastUpdateTime: now,
        };
        
        setGraphMetrics(newMetrics);
        
        // Track custom metrics
        trackCustomMetric('graph-fps', currentFps, {
          component: 'graph',
          nodeCount,
          edgeCount
        });
        
        trackCustomMetric('graph-render-time', avgRenderTime, {
          component: 'graph',
          nodeCount,
          edgeCount
        });
        
        lastFrameTime.current = now;
      }
      
      animationId.current = requestAnimationFrame(updateMetrics);
    };
    
    animationId.current = requestAnimationFrame(updateMetrics);
    
    return () => {
      if (animationId.current) {
        cancelAnimationFrame(animationId.current);
      }
    };
  }, [showOverlay, graphRef, latestMetrics, trackCustomMetric]);

  const toggleVisibility = () => {
    const newVisibility = !showOverlay;
    setShowOverlay(newVisibility);
    onToggleVisibility?.(newVisibility);
    
    logger.debug(`Graph performance overlay ${newVisibility ? 'shown' : 'hidden'}`, {
      component: 'GraphPerformanceOverlay'
    });
  };

  const resetMetrics = () => {
    frameCount.current = 0;
    renderTimeHistory.current = [];
    lastFrameTime.current = performance.now();
    
    logger.debug('Graph performance metrics reset', {
      component: 'GraphPerformanceOverlay'
    });
  };

  const getPositionClasses = () => {
    const base = 'fixed z-50';
    switch (position) {
      case 'top-left':
        return `${base} top-4 left-4`;
      case 'top-right':
        return `${base} top-4 right-4`;
      case 'bottom-left':
        return `${base} bottom-4 left-4`;
      case 'bottom-right':
        return `${base} bottom-4 right-4`;
      default:
        return `${base} top-4 right-4`;
    }
  };

  const getFPSColor = (fps: number) => {
    if (fps >= 55) return 'text-green-600';
    if (fps >= 30) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRenderTimeColor = (time: number) => {
    if (time <= 16.67) return 'text-green-600'; // 60 FPS
    if (time <= 33.33) return 'text-yellow-600'; // 30 FPS
    return 'text-red-600';
  };

  const getComplexityLevel = () => {
    const totalElements = graphMetrics.nodeCount + graphMetrics.edgeCount;
    if (totalElements > 1000) return { level: 'High', color: 'text-red-600' };
    if (totalElements > 500) return { level: 'Medium', color: 'text-yellow-600' };
    return { level: 'Low', color: 'text-green-600' };
  };

  if (!showOverlay && process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <>
      {/* Toggle Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={toggleVisibility}
        className="fixed top-4 right-16 z-50 bg-white/90 backdrop-blur-sm"
        title="Toggle Graph Performance Overlay"
      >
        {showOverlay ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>

      {/* Overlay */}
      {showOverlay && (
        <Card className={`${getPositionClasses()} bg-black/80 backdrop-blur-sm text-white border-gray-700 ${compact ? 'w-64' : 'w-80'}`}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Activity className="h-4 w-4 text-blue-400" />
                <span className="font-semibold text-sm">Graph Performance</span>
              </div>
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetMetrics}
                  className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleVisibility}
                  className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                >
                  <EyeOff className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              {/* FPS */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Zap className="h-3 w-3 text-blue-400" />
                  <span>FPS</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`font-mono ${getFPSColor(graphMetrics.fps)}`}>
                    {graphMetrics.fps}
                  </span>
                  <div className="w-16 h-1 bg-gray-700 rounded overflow-hidden">
                    <div 
                      className={`h-full ${graphMetrics.fps >= 55 ? 'bg-green-500' : graphMetrics.fps >= 30 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(100, (graphMetrics.fps / 60) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Render Time */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Clock className="h-3 w-3 text-green-400" />
                  <span>Render</span>
                </div>
                <span className={`font-mono ${getRenderTimeColor(graphMetrics.renderTime)}`}>
                  {graphMetrics.renderTime.toFixed(1)}ms
                </span>
              </div>

              {/* Graph Elements */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="h-3 w-3 text-purple-400" />
                  <span>Elements</span>
                </div>
                <div className="text-right">
                  <div className="font-mono">
                    {graphMetrics.nodeCount}N / {graphMetrics.edgeCount}E
                  </div>
                  {!compact && (
                    <div className={`text-xs ${getComplexityLevel().color}`}>
                      {getComplexityLevel().level} complexity
                    </div>
                  )}
                </div>
              </div>

              {/* Memory Usage */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Memory className="h-3 w-3 text-orange-400" />
                  <span>Memory</span>
                </div>
                <span className="font-mono">
                  {Math.round(graphMetrics.memoryUsage / 1024 / 1024)}MB
                </span>
              </div>

              {!compact && (
                <>
                  {/* Animation Frames */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Cpu className="h-3 w-3 text-cyan-400" />
                      <span>Frames</span>
                    </div>
                    <span className="font-mono">
                      {graphMetrics.animationFrames.toLocaleString()}
                    </span>
                  </div>

                  {/* Performance Indicators */}
                  <div className="pt-2 border-t border-gray-700">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-400">Performance</span>
                      <Badge 
                        variant={graphMetrics.fps >= 55 ? "default" : graphMetrics.fps >= 30 ? "secondary" : "destructive"}
                        className="text-xs"
                      >
                        {graphMetrics.fps >= 55 ? 'Excellent' : graphMetrics.fps >= 30 ? 'Good' : 'Poor'}
                      </Badge>
                    </div>
                    
                    {/* Performance Bar */}
                    <div className="w-full h-2 bg-gray-700 rounded overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          graphMetrics.fps >= 55 ? 'bg-green-500' : 
                          graphMetrics.fps >= 30 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(100, (graphMetrics.fps / 60) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Performance Tips */}
                  {graphMetrics.fps < 30 && (
                    <div className="pt-2 border-t border-gray-700">
                      <div className="text-xs text-yellow-400">
                        <div className="font-semibold mb-1">Performance Tips:</div>
                        <ul className="list-disc list-inside space-y-1 text-gray-300">
                          {graphMetrics.nodeCount > 1000 && (
                            <li>Consider reducing node count</li>
                          )}
                          {graphMetrics.renderTime > 33 && (
                            <li>Optimize render frequency</li>
                          )}
                          <li>Enable hardware acceleration</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

// Hook for graph performance monitoring
export function useGraphPerformance(graphRef?: React.RefObject<any>) {
  const { trackCustomMetric } = usePerformance();
  const [isMonitoring, setIsMonitoring] = useState(false);
  const metricsRef = useRef<GraphMetrics | null>(null);

  const startMonitoring = () => {
    setIsMonitoring(true);
    logger.info('Graph performance monitoring started', {
      component: 'GraphPerformanceHook'
    });
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
    logger.info('Graph performance monitoring stopped', {
      component: 'GraphPerformanceHook'
    });
  };

  const measureLayoutTime = async <T,>(
    layoutFunction: () => Promise<T> | T
  ): Promise<T> => {
    const startTime = performance.now();
    
    try {
      const result = await layoutFunction();
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      trackCustomMetric('graph-layout-time', duration, {
        component: 'graph-layout'
      });
      
      logger.debug(`Graph layout completed in ${duration.toFixed(2)}ms`, {
        component: 'GraphPerformanceHook',
        metadata: { layoutDuration: duration }
      });
      
      return result;
      
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      logger.error('Graph layout failed', {
        component: 'GraphPerformanceHook',
        metadata: { 
          layoutDuration: duration,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      
      throw error;
    }
  };

  const measureDataProcessing = async <T,>(
    processingFunction: () => Promise<T> | T,
    dataSize?: number
  ): Promise<T> => {
    const startTime = performance.now();
    
    try {
      const result = await processingFunction();
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      trackCustomMetric('graph-data-processing-time', duration, {
        component: 'graph-data-processing',
        dataSize
      });
      
      logger.debug(`Graph data processing completed in ${duration.toFixed(2)}ms`, {
        component: 'GraphPerformanceHook',
        metadata: { 
          processingDuration: duration,
          dataSize
        }
      });
      
      return result;
      
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      logger.error('Graph data processing failed', {
        component: 'GraphPerformanceHook',
        metadata: { 
          processingDuration: duration,
          dataSize,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      
      throw error;
    }
  };

  const trackGraphInteraction = (
    interactionType: 'zoom' | 'pan' | 'select' | 'hover' | 'click',
    metadata?: Record<string, any>
  ) => {
    trackCustomMetric(`graph-interaction-${interactionType}`, 1, {
      component: 'graph-interaction',
      interactionType,
      ...metadata
    });
    
    logger.debug(`Graph interaction: ${interactionType}`, {
      component: 'GraphPerformanceHook',
      metadata: { interactionType, ...metadata }
    });
  };

  return {
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    measureLayoutTime,
    measureDataProcessing,
    trackGraphInteraction,
    currentMetrics: metricsRef.current
  };
}

export default GraphPerformanceOverlay;