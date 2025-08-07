'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Performance testing types
interface PerformanceTestSuite {
  id: string;
  name: string;
  description: string;
  tests: PerformanceTest[];
  setup?: () => Promise<void> | void;
  teardown?: () => Promise<void> | void;
}

interface PerformanceTest {
  id: string;
  name: string;
  description: string;
  category: 'loading' | 'runtime' | 'memory' | 'network' | 'user-interaction';
  threshold: {
    target: number;
    warning: number;
    critical: number;
    unit: 'ms' | 'bytes' | 'score' | 'ratio';
  };
  test: () => Promise<PerformanceTestResult> | PerformanceTestResult;
  skip?: boolean;
}

interface PerformanceTestResult {
  passed: boolean;
  value: number;
  unit: string;
  message: string;
  details?: Record<string, any>;
  duration: number;
}

interface TestSuiteResults {
  suiteId: string;
  suiteName: string;
  startTime: number;
  endTime: number;
  duration: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  results: Map<string, PerformanceTestResult>;
  summary: {
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    status: 'passed' | 'failed' | 'warning';
  };
}

// Performance testing hook
export function usePerformanceTesting() {
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string | null>(null);
  const [results, setResults] = useState<Map<string, TestSuiteResults>>(new Map());
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const runTest = useCallback(async (test: PerformanceTest): Promise<PerformanceTestResult> => {
    const startTime = performance.now();

    try {
      if (test.skip) {
        return {
          passed: true,
          value: 0,
          unit: test.threshold.unit,
          message: 'Test skipped',
          duration: 0,
        };
      }

      const result = await test.test();
      const endTime = performance.now();
      
      // Determine if test passed based on thresholds
      const passed = result.value <= test.threshold.target;
      
      return {
        ...result,
        passed,
        duration: endTime - startTime,
      };
    } catch (error) {
      const endTime = performance.now();
      return {
        passed: false,
        value: -1,
        unit: test.threshold.unit,
        message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: endTime - startTime,
      };
    }
  }, []);

  const runTestSuite = useCallback(async (suite: PerformanceTestSuite): Promise<TestSuiteResults> => {
    setIsRunning(true);
    setCurrentTest(suite.name);

    const startTime = performance.now();
    const results = new Map<string, PerformanceTestResult>();
    const enabledTests = suite.tests.filter(test => !test.skip);
    
    setProgress({ current: 0, total: enabledTests.length });

    // Run setup if provided
    if (suite.setup) {
      await suite.setup();
    }

    try {
      // Run tests sequentially
      for (let i = 0; i < enabledTests.length; i++) {
        const test = enabledTests[i];
        setCurrentTest(test.name);
        
        const result = await runTest(test);
        results.set(test.id, result);
        
        setProgress({ current: i + 1, total: enabledTests.length });
        
        // Small delay to prevent blocking the UI
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    } finally {
      // Run teardown if provided
      if (suite.teardown) {
        await suite.teardown();
      }
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Calculate summary
    const totalTests = suite.tests.length;
    const passedTests = Array.from(results.values()).filter(r => r.passed).length;
    const failedTests = Array.from(results.values()).filter(r => !r.passed).length;
    const skippedTests = suite.tests.filter(test => test.skip).length;

    const score = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
    const grade: 'A' | 'B' | 'C' | 'D' | 'F' = 
      score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
    const status: 'passed' | 'failed' | 'warning' = 
      failedTests === 0 ? 'passed' : score >= 70 ? 'warning' : 'failed';

    const suiteResults: TestSuiteResults = {
      suiteId: suite.id,
      suiteName: suite.name,
      startTime,
      endTime,
      duration,
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      results,
      summary: { score, grade, status },
    };

    setResults(prev => new Map(prev.set(suite.id, suiteResults)));
    setIsRunning(false);
    setCurrentTest(null);
    setProgress({ current: 0, total: 0 });

    return suiteResults;
  }, [runTest]);

  const runAllSuites = useCallback(async (suites: PerformanceTestSuite[]) => {
    const allResults: TestSuiteResults[] = [];
    
    for (const suite of suites) {
      const result = await runTestSuite(suite);
      allResults.push(result);
    }

    return allResults;
  }, [runTestSuite]);

  return {
    isRunning,
    currentTest,
    results,
    progress,
    runTest,
    runTestSuite,
    runAllSuites,
  };
}

// Built-in performance test suites
export function createCoreWebVitalsTestSuite(): PerformanceTestSuite {
  return {
    id: 'core-web-vitals',
    name: 'Core Web Vitals',
    description: 'Essential metrics for user experience',
    tests: [
      {
        id: 'fcp',
        name: 'First Contentful Paint',
        description: 'Time until first content is painted',
        category: 'loading',
        threshold: {
          target: 1800,
          warning: 3000,
          critical: 4000,
          unit: 'ms',
        },
        test: async () => {
          const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
          const value = fcpEntry?.startTime || 0;
          
          return {
            passed: value <= 1800,
            value,
            unit: 'ms',
            message: `FCP: ${Math.round(value)}ms`,
            details: { entry: fcpEntry },
            duration: 0,
          };
        },
      },
      {
        id: 'lcp',
        name: 'Largest Contentful Paint',
        description: 'Time until largest content is painted',
        category: 'loading',
        threshold: {
          target: 2500,
          warning: 4000,
          critical: 5000,
          unit: 'ms',
        },
        test: async () => {
          return new Promise<PerformanceTestResult>((resolve) => {
            let lcpValue = 0;
            
            const observer = new PerformanceObserver((list) => {
              const entries = list.getEntries();
              const lastEntry = entries[entries.length - 1];
              lcpValue = lastEntry.startTime;
            });

            observer.observe({ entryTypes: ['largest-contentful-paint'] });

            setTimeout(() => {
              observer.disconnect();
              resolve({
                passed: lcpValue <= 2500,
                value: lcpValue,
                unit: 'ms',
                message: `LCP: ${Math.round(lcpValue)}ms`,
                duration: 0,
              });
            }, 100);
          });
        },
      },
      {
        id: 'cls',
        name: 'Cumulative Layout Shift',
        description: 'Visual stability of the page',
        category: 'runtime',
        threshold: {
          target: 0.1,
          warning: 0.25,
          critical: 0.4,
          unit: 'score',
        },
        test: async () => {
          return new Promise<PerformanceTestResult>((resolve) => {
            let clsValue = 0;
            
            const observer = new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                const layoutShift = entry as any;
                if (!layoutShift.hadRecentInput) {
                  clsValue += layoutShift.value;
                }
              }
            });

            observer.observe({ entryTypes: ['layout-shift'] });

            setTimeout(() => {
              observer.disconnect();
              resolve({
                passed: clsValue <= 0.1,
                value: clsValue,
                unit: 'score',
                message: `CLS: ${clsValue.toFixed(3)}`,
                duration: 0,
              });
            }, 1000);
          });
        },
      },
    ],
  };
}

export function createMemoryTestSuite(): PerformanceTestSuite {
  return {
    id: 'memory',
    name: 'Memory Performance',
    description: 'Memory usage and efficiency tests',
    tests: [
      {
        id: 'heap-size',
        name: 'JavaScript Heap Size',
        description: 'Current JavaScript memory usage',
        category: 'memory',
        threshold: {
          target: 50 * 1024 * 1024, // 50MB
          warning: 100 * 1024 * 1024, // 100MB
          critical: 150 * 1024 * 1024, // 150MB
          unit: 'bytes',
        },
        test: () => {
          if ('memory' in performance) {
            const memory = (performance as any).memory;
            const value = memory.usedJSHeapSize;
            
            return {
              passed: value <= 50 * 1024 * 1024,
              value,
              unit: 'bytes',
              message: `Heap size: ${(value / 1024 / 1024).toFixed(1)}MB`,
              details: memory,
              duration: 0,
            };
          }
          
          return {
            passed: true,
            value: 0,
            unit: 'bytes',
            message: 'Memory API not available',
            duration: 0,
          };
        },
      },
      {
        id: 'dom-nodes',
        name: 'DOM Node Count',
        description: 'Total number of DOM nodes',
        category: 'memory',
        threshold: {
          target: 1500,
          warning: 3000,
          critical: 5000,
          unit: 'score',
        },
        test: () => {
          const value = document.getElementsByTagName('*').length;
          
          return {
            passed: value <= 1500,
            value,
            unit: 'nodes',
            message: `DOM nodes: ${value}`,
            duration: 0,
          };
        },
      },
    ],
  };
}

export function createNetworkTestSuite(): PerformanceTestSuite {
  return {
    id: 'network',
    name: 'Network Performance',
    description: 'Resource loading and network efficiency tests',
    tests: [
      {
        id: 'resource-count',
        name: 'Resource Count',
        description: 'Total number of network resources',
        category: 'network',
        threshold: {
          target: 50,
          warning: 100,
          critical: 150,
          unit: 'score',
        },
        test: () => {
          const resources = performance.getEntriesByType('resource');
          const value = resources.length;
          
          return {
            passed: value <= 50,
            value,
            unit: 'resources',
            message: `Resources loaded: ${value}`,
            details: { resources },
            duration: 0,
          };
        },
      },
      {
        id: 'total-size',
        name: 'Total Transfer Size',
        description: 'Total bytes transferred over network',
        category: 'network',
        threshold: {
          target: 1024 * 1024, // 1MB
          warning: 2048 * 1024, // 2MB
          critical: 4096 * 1024, // 4MB
          unit: 'bytes',
        },
        test: () => {
          const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
          const totalSize = resources.reduce((sum, resource) => {
            return sum + (resource.transferSize || 0);
          }, 0);
          
          return {
            passed: totalSize <= 1024 * 1024,
            value: totalSize,
            unit: 'bytes',
            message: `Total size: ${(totalSize / 1024 / 1024).toFixed(1)}MB`,
            details: { resources },
            duration: 0,
          };
        },
      },
    ],
  };
}

export function createRuntimeTestSuite(): PerformanceTestSuite {
  return {
    id: 'runtime',
    name: 'Runtime Performance',
    description: 'Application runtime performance tests',
    tests: [
      {
        id: 'render-time',
        name: 'Component Render Time',
        description: 'Time to render test component',
        category: 'runtime',
        threshold: {
          target: 16, // 60fps
          warning: 33, // 30fps
          critical: 50,
          unit: 'ms',
        },
        test: async () => {
          const startTime = performance.now();
          
          // Simulate a heavy render operation
          const element = document.createElement('div');
          for (let i = 0; i < 1000; i++) {
            const child = document.createElement('span');
            child.textContent = `Item ${i}`;
            element.appendChild(child);
          }
          
          document.body.appendChild(element);
          
          // Force reflow
          element.offsetHeight;
          
          const endTime = performance.now();
          const value = endTime - startTime;
          
          // Cleanup
          document.body.removeChild(element);
          
          return {
            passed: value <= 16,
            value,
            unit: 'ms',
            message: `Render time: ${value.toFixed(1)}ms`,
            duration: value,
          };
        },
      },
      {
        id: 'scroll-performance',
        name: 'Scroll Performance',
        description: 'Smoothness of scrolling operations',
        category: 'user-interaction',
        threshold: {
          target: 16, // 60fps
          warning: 33, // 30fps
          critical: 50,
          unit: 'ms',
        },
        test: async () => {
          return new Promise<PerformanceTestResult>((resolve) => {
            let maxFrameTime = 0;
            let frameCount = 0;
            let lastFrameTime = performance.now();

            const measureFrame = () => {
              const currentTime = performance.now();
              const frameTime = currentTime - lastFrameTime;
              maxFrameTime = Math.max(maxFrameTime, frameTime);
              frameCount++;
              lastFrameTime = currentTime;

              if (frameCount < 60) { // Test for 1 second at 60fps
                requestAnimationFrame(measureFrame);
              } else {
                resolve({
                  passed: maxFrameTime <= 16,
                  value: maxFrameTime,
                  unit: 'ms',
                  message: `Max frame time: ${maxFrameTime.toFixed(1)}ms`,
                  details: { frameCount, avgFrameTime: (performance.now() - lastFrameTime) / frameCount },
                  duration: performance.now() - lastFrameTime,
                });
              }
            };

            requestAnimationFrame(measureFrame);
          });
        },
      },
    ],
  };
}

// Test suite utilities
export function createCustomTestSuite(
  id: string,
  name: string,
  description: string,
  tests: PerformanceTest[]
): PerformanceTestSuite {
  return { id, name, description, tests };
}

export function getAllTestSuites(): PerformanceTestSuite[] {
  return [
    createCoreWebVitalsTestSuite(),
    createMemoryTestSuite(),
    createNetworkTestSuite(),
    createRuntimeTestSuite(),
  ];
}

export type {
  PerformanceTestSuite,
  PerformanceTest,
  PerformanceTestResult,
  TestSuiteResults,
};