'use client';

import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';

// Performance metrics types
interface PerformanceMetrics {
  // Core Web Vitals
  firstContentfulPaint: number | null;
  largestContentfulPaint: number | null;
  firstInputDelay: number | null;
  cumulativeLayoutShift: number | null;
  timeToInteractive: number | null;
  
  // Custom metrics
  totalBlockingTime: number | null;
  speedIndex: number | null;
  
  // Runtime metrics
  jsHeapSize: number;
  jsHeapLimit: number;
  domNodes: number;
  
  // Network metrics
  navigationTiming: PerformanceNavigationTiming | null;
  resourceTiming: PerformanceResourceTiming[];
  
  // Bundle metrics
  bundleSize: number | null;
  asyncChunksLoaded: number;
  
  // User experience
  interactionLatency: number[];
  scrollResponsiveness: number[];
  
  timestamp: number;
}

interface PerformanceBudget {
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  firstInputDelay: number;
  cumulativeLayoutShift: number;
  totalBlockingTime: number;
  bundleSize: number;
  jsHeapSize: number;
}

interface PerformanceAlert {
  id: string;
  type: 'warning' | 'critical';
  metric: string;
  value: number;
  threshold: number;
  timestamp: number;
  message: string;
}

interface PerformanceContextValue {
  // Current metrics
  metrics: PerformanceMetrics | null;
  isCollecting: boolean;
  
  // Performance budget
  budget: PerformanceBudget;
  setBudget: (budget: Partial<PerformanceBudget>) => void;
  
  // Alerts
  alerts: PerformanceAlert[];
  clearAlerts: () => void;
  
  // Controls
  startCollection: () => void;
  stopCollection: () => void;
  recordMetric: (key: string, value: number) => void;
  
  // Analysis
  getMetricsHistory: () => PerformanceMetrics[];
  generateReport: () => PerformanceReport;
  
  // Optimization suggestions
  getOptimizationSuggestions: () => OptimizationSuggestion[];
}

interface PerformanceReport {
  summary: {
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    passedBudgets: number;
    totalBudgets: number;
  };
  coreWebVitals: {
    fcp: { value: number | null; status: 'good' | 'needs-improvement' | 'poor' | 'unknown' };
    lcp: { value: number | null; status: 'good' | 'needs-improvement' | 'poor' | 'unknown' };
    fid: { value: number | null; status: 'good' | 'needs-improvement' | 'poor' | 'unknown' };
    cls: { value: number | null; status: 'good' | 'needs-improvement' | 'poor' | 'unknown' };
  };
  budgetStatus: Array<{
    metric: string;
    value: number | null;
    budget: number;
    status: 'pass' | 'fail' | 'unknown';
    impact: 'low' | 'medium' | 'high';
  }>;
  recommendations: OptimizationSuggestion[];
  timestamp: number;
}

interface OptimizationSuggestion {
  category: 'loading' | 'runtime' | 'bundle' | 'network' | 'memory';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  implementation: string[];
}

const PerformanceContext = createContext<PerformanceContextValue | null>(null);

const defaultBudget: PerformanceBudget = {
  firstContentfulPaint: 1500,      // 1.5s
  largestContentfulPaint: 2500,    // 2.5s
  firstInputDelay: 100,            // 100ms
  cumulativeLayoutShift: 0.1,      // 0.1
  totalBlockingTime: 200,          // 200ms
  bundleSize: 500000,              // 500KB
  jsHeapSize: 50000000,            // 50MB
};

export function PerformanceProvider({ children }: { children: React.ReactNode }) {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isCollecting, setIsCollecting] = useState(false);
  const [budget, setBudgetState] = useState<PerformanceBudget>(defaultBudget);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [metricsHistory, setMetricsHistory] = useState<PerformanceMetrics[]>([]);
  
  const collectionIntervalRef = useRef<NodeJS.Timeout>();
  const observerRef = useRef<PerformanceObserver>();

  // Core Web Vitals measurement
  const measureCoreWebVitals = useCallback((): Partial<PerformanceMetrics> => {
    const vitals: Partial<PerformanceMetrics> = {};

    // First Contentful Paint
    const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
    if (fcpEntry) {
      vitals.firstContentfulPaint = fcpEntry.startTime;
    }

    // Largest Contentful Paint
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
    if (lcpEntries.length > 0) {
      const lcpEntry = lcpEntries[lcpEntries.length - 1] as any;
      vitals.largestContentfulPaint = lcpEntry.startTime;
    }

    // Cumulative Layout Shift
    const clsEntries = performance.getEntriesByType('layout-shift');
    let clsValue = 0;
    clsEntries.forEach((entry: any) => {
      if (!entry.hadRecentInput) {
        clsValue += entry.value;
      }
    });
    vitals.cumulativeLayoutShift = clsValue;

    return vitals;
  }, []);

  // Runtime metrics
  const measureRuntimeMetrics = useCallback((): Partial<PerformanceMetrics> => {
    const runtime: Partial<PerformanceMetrics> = {};

    // Memory usage
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      runtime.jsHeapSize = memory.usedJSHeapSize;
      runtime.jsHeapLimit = memory.totalJSHeapSize;
    }

    // DOM nodes
    runtime.domNodes = document.getElementsByTagName('*').length;

    // Navigation timing
    const navigationEntries = performance.getEntriesByType('navigation');
    if (navigationEntries.length > 0) {
      runtime.navigationTiming = navigationEntries[0] as PerformanceNavigationTiming;
    }

    // Resource timing
    runtime.resourceTiming = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

    return runtime;
  }, []);

  // Collect all metrics
  const collectMetrics = useCallback((): PerformanceMetrics => {
    const coreWebVitals = measureCoreWebVitals();
    const runtimeMetrics = measureRuntimeMetrics();

    return {
      firstContentfulPaint: null,
      largestContentfulPaint: null,
      firstInputDelay: null,
      cumulativeLayoutShift: null,
      timeToInteractive: null,
      totalBlockingTime: null,
      speedIndex: null,
      jsHeapSize: 0,
      jsHeapLimit: 0,
      domNodes: 0,
      navigationTiming: null,
      resourceTiming: [],
      bundleSize: null,
      asyncChunksLoaded: 0,
      interactionLatency: [],
      scrollResponsiveness: [],
      timestamp: Date.now(),
      ...coreWebVitals,
      ...runtimeMetrics,
    };
  }, [measureCoreWebVitals, measureRuntimeMetrics]);

  // Check performance budget violations
  const checkBudgetViolations = useCallback((currentMetrics: PerformanceMetrics) => {
    const newAlerts: PerformanceAlert[] = [];

    const checks = [
      {
        metric: 'First Contentful Paint',
        value: currentMetrics.firstContentfulPaint,
        budget: budget.firstContentfulPaint,
      },
      {
        metric: 'Largest Contentful Paint',
        value: currentMetrics.largestContentfulPaint,
        budget: budget.largestContentfulPaint,
      },
      {
        metric: 'First Input Delay',
        value: currentMetrics.firstInputDelay,
        budget: budget.firstInputDelay,
      },
      {
        metric: 'Cumulative Layout Shift',
        value: currentMetrics.cumulativeLayoutShift,
        budget: budget.cumulativeLayoutShift,
      },
      {
        metric: 'JS Heap Size',
        value: currentMetrics.jsHeapSize,
        budget: budget.jsHeapSize,
      },
    ];

    checks.forEach(({ metric, value, budget: budgetValue }) => {
      if (value !== null && value > budgetValue) {
        const severity = value > budgetValue * 1.5 ? 'critical' : 'warning';
        newAlerts.push({
          id: `${metric.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
          type: severity,
          metric,
          value,
          threshold: budgetValue,
          timestamp: Date.now(),
          message: `${metric} (${Math.round(value)}${metric === 'Cumulative Layout Shift' ? '' : 'ms'}) exceeds budget (${budgetValue}${metric === 'Cumulative Layout Shift' ? '' : 'ms'})`,
        });
      }
    });

    if (newAlerts.length > 0) {
      setAlerts(prev => [...prev, ...newAlerts]);
    }
  }, [budget]);

  // Start performance monitoring
  const startCollection = useCallback(() => {
    if (isCollecting) return;

    setIsCollecting(true);

    // Set up Performance Observer for real-time metrics
    if ('PerformanceObserver' in window) {
      observerRef.current = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          // Handle specific performance entries
          if (entry.entryType === 'measure') {
            recordMetric(entry.name, entry.duration);
          }
        });
      });

      try {
        observerRef.current.observe({ 
          entryTypes: ['measure', 'navigation', 'resource', 'largest-contentful-paint', 'layout-shift']
        });
      } catch (error) {
        console.warn('Performance Observer not fully supported:', error);
      }
    }

    // Regular metrics collection
    collectionIntervalRef.current = setInterval(() => {
      const currentMetrics = collectMetrics();
      setMetrics(currentMetrics);
      setMetricsHistory(prev => [...prev.slice(-99), currentMetrics]); // Keep last 100 entries
      checkBudgetViolations(currentMetrics);
    }, 5000); // Collect every 5 seconds

    // Initial collection
    const initialMetrics = collectMetrics();
    setMetrics(initialMetrics);
    setMetricsHistory(prev => [...prev, initialMetrics]);
  }, [isCollecting, collectMetrics, checkBudgetViolations]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stop performance monitoring
  const stopCollection = useCallback(() => {
    setIsCollecting(false);
    
    if (collectionIntervalRef.current) {
      clearInterval(collectionIntervalRef.current);
    }
    
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
  }, []);

  // Record custom metric
  const recordMetric = useCallback((key: string, value: number) => {
    performance.mark(`${key}-start`);
    performance.mark(`${key}-end`);
    performance.measure(key, `${key}-start`, `${key}-end`);
  }, []);

  // Set budget
  const setBudget = useCallback((newBudget: Partial<PerformanceBudget>) => {
    setBudgetState(prev => ({ ...prev, ...newBudget }));
  }, []);

  // Clear alerts
  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  // Get metrics history
  const getMetricsHistory = useCallback(() => {
    return metricsHistory;
  }, [metricsHistory]);

  // Generate performance report
  const generateReport = useCallback((): PerformanceReport => {
    if (!metrics) {
      throw new Error('No metrics available for report generation');
    }

    // Calculate Core Web Vitals status
    const getCWVStatus = (value: number | null, goodThreshold: number, poorThreshold: number) => {
      if (value === null) return 'unknown' as const;
      if (value <= goodThreshold) return 'good' as const;
      if (value <= poorThreshold) return 'needs-improvement' as const;
      return 'poor' as const;
    };

    const coreWebVitals = {
      fcp: {
        value: metrics.firstContentfulPaint,
        status: getCWVStatus(metrics.firstContentfulPaint, 1800, 3000)
      },
      lcp: {
        value: metrics.largestContentfulPaint,
        status: getCWVStatus(metrics.largestContentfulPaint, 2500, 4000)
      },
      fid: {
        value: metrics.firstInputDelay,
        status: getCWVStatus(metrics.firstInputDelay, 100, 300)
      },
      cls: {
        value: metrics.cumulativeLayoutShift,
        status: getCWVStatus(metrics.cumulativeLayoutShift, 0.1, 0.25)
      },
    };

    // Budget status
    const budgetChecks = [
      { metric: 'First Contentful Paint', value: metrics.firstContentfulPaint, budget: budget.firstContentfulPaint, impact: 'high' as const },
      { metric: 'Largest Contentful Paint', value: metrics.largestContentfulPaint, budget: budget.largestContentfulPaint, impact: 'high' as const },
      { metric: 'First Input Delay', value: metrics.firstInputDelay, budget: budget.firstInputDelay, impact: 'medium' as const },
      { metric: 'Cumulative Layout Shift', value: metrics.cumulativeLayoutShift, budget: budget.cumulativeLayoutShift, impact: 'medium' as const },
      { metric: 'JS Heap Size', value: metrics.jsHeapSize, budget: budget.jsHeapSize, impact: 'low' as const },
    ];

    const budgetStatus = budgetChecks.map(({ metric, value, budget: budgetValue, impact }) => ({
      metric,
      value,
      budget: budgetValue,
      status: (value === null ? 'unknown' : value <= budgetValue ? 'pass' : 'fail') as 'pass' | 'fail' | 'unknown',
      impact,
    }));

    const passedBudgets = budgetStatus.filter(b => b.status === 'pass').length;
    const totalBudgets = budgetStatus.filter(b => b.status !== 'unknown').length;

    // Calculate overall score
    const cwvScores = Object.values(coreWebVitals).map(({ status }) =>
      status === 'good' ? 100 : status === 'needs-improvement' ? 75 : status === 'poor' ? 25 : 0
    );
    const budgetScore = totalBudgets > 0 ? (passedBudgets / totalBudgets) * 100 : 100;
    const overallScore = (cwvScores.reduce((sum: number, score: number) => sum + score, 0) / cwvScores.length + budgetScore) / 2;

    const getGrade = (score: number): 'A' | 'B' | 'C' | 'D' | 'F' => {
      if (score >= 90) return 'A';
      if (score >= 80) return 'B';
      if (score >= 70) return 'C';
      if (score >= 60) return 'D';
      return 'F';
    };

    // Generate suggestions inline to avoid circular dependency
    const suggestions: OptimizationSuggestion[] = [];
    if (metrics.firstContentfulPaint && metrics.firstContentfulPaint > budget.firstContentfulPaint) {
      suggestions.push({
        category: 'loading',
        priority: 'high',
        title: 'Improve First Contentful Paint',
        description: 'First Contentful Paint is slower than expected',
        impact: 'Faster initial page rendering and better user experience',
        effort: 'medium',
        implementation: [
          'Optimize critical CSS and inline above-the-fold styles',
          'Minimize and compress JavaScript bundles',
          'Use resource hints (preload, prefetch) for critical resources',
          'Optimize font loading with font-display: swap'
        ],
      });
    }

    if (metrics.jsHeapSize > budget.jsHeapSize) {
      suggestions.push({
        category: 'memory',
        priority: 'medium',
        title: 'Reduce Memory Usage',
        description: 'JavaScript heap size exceeds recommended limits',
        impact: 'Better performance on low-end devices and reduced crashes',
        effort: 'high',
        implementation: [
          'Implement code splitting and lazy loading',
          'Remove unused dependencies and dead code',
          'Optimize image sizes and formats',
          'Use React.memo and useMemo for expensive computations'
        ],
      });
    }

    if (metrics.cumulativeLayoutShift && metrics.cumulativeLayoutShift > budget.cumulativeLayoutShift) {
      suggestions.push({
        category: 'runtime',
        priority: 'medium',
        title: 'Reduce Layout Shifts',
        description: 'Page content shifts unexpectedly during loading',
        impact: 'Improved visual stability and user experience',
        effort: 'medium',
        implementation: [
          'Set explicit dimensions for images and videos',
          'Reserve space for dynamic content',
          'Avoid inserting content above existing content',
          'Use CSS transform instead of changing layout properties'
        ],
      });
    }

    return {
      summary: {
        score: Math.round(overallScore),
        grade: getGrade(overallScore),
        passedBudgets,
        totalBudgets,
      },
      coreWebVitals,
      budgetStatus,
      recommendations: suggestions,
      timestamp: Date.now(),
    };
  }, [metrics, budget]);

  // Get optimization suggestions
  const getOptimizationSuggestions = useCallback((): OptimizationSuggestion[] => {
    if (!metrics) return [];

    const suggestions: OptimizationSuggestion[] = [];

    // FCP optimization
    if (metrics.firstContentfulPaint && metrics.firstContentfulPaint > budget.firstContentfulPaint) {
      suggestions.push({
        category: 'loading',
        priority: 'high',
        title: 'Improve First Contentful Paint',
        description: 'First Contentful Paint is slower than expected',
        impact: 'Faster initial page rendering and better user experience',
        effort: 'medium',
        implementation: [
          'Optimize critical CSS and inline above-the-fold styles',
          'Minimize and compress JavaScript bundles',
          'Use resource hints (preload, prefetch) for critical resources',
          'Optimize font loading with font-display: swap'
        ],
      });
    }

    // Memory optimization
    if (metrics.jsHeapSize > budget.jsHeapSize) {
      suggestions.push({
        category: 'memory',
        priority: 'medium',
        title: 'Reduce Memory Usage',
        description: 'JavaScript heap size exceeds recommended limits',
        impact: 'Better performance on low-end devices and reduced crashes',
        effort: 'high',
        implementation: [
          'Implement code splitting and lazy loading',
          'Remove unused dependencies and dead code',
          'Optimize image sizes and formats',
          'Use React.memo and useMemo for expensive computations'
        ],
      });
    }

    // Layout shift optimization
    if (metrics.cumulativeLayoutShift && metrics.cumulativeLayoutShift > budget.cumulativeLayoutShift) {
      suggestions.push({
        category: 'runtime',
        priority: 'medium',
        title: 'Reduce Layout Shifts',
        description: 'Page content shifts unexpectedly during loading',
        impact: 'Improved visual stability and user experience',
        effort: 'medium',
        implementation: [
          'Set explicit dimensions for images and videos',
          'Reserve space for dynamic content',
          'Avoid inserting content above existing content',
          'Use CSS transform instead of changing layout properties'
        ],
      });
    }

    // Bundle size optimization
    if (metrics.bundleSize && metrics.bundleSize > budget.bundleSize) {
      suggestions.push({
        category: 'bundle',
        priority: 'high',
        title: 'Optimize Bundle Size',
        description: 'JavaScript bundle exceeds size budget',
        impact: 'Faster loading times and reduced bandwidth usage',
        effort: 'medium',
        implementation: [
          'Implement dynamic imports for route-based code splitting',
          'Tree shake unused code and dependencies',
          'Use webpack-bundle-analyzer to identify large dependencies',
          'Consider switching to lighter alternatives for heavy libraries'
        ],
      });
    }

    return suggestions;
  }, [metrics, budget]);

  const value: PerformanceContextValue = {
    metrics,
    isCollecting,
    budget,
    setBudget,
    alerts,
    clearAlerts,
    startCollection,
    stopCollection,
    recordMetric,
    getMetricsHistory,
    generateReport,
    getOptimizationSuggestions,
  };

  return (
    <PerformanceContext.Provider value={value}>
      {children}
    </PerformanceContext.Provider>
  );
}

export function usePerformance() {
  const context = useContext(PerformanceContext);
  if (!context) {
    throw new Error('usePerformance must be used within a PerformanceProvider');
  }
  return context;
}

export type { 
  PerformanceMetrics, 
  PerformanceBudget, 
  PerformanceAlert, 
  PerformanceReport, 
  OptimizationSuggestion 
};