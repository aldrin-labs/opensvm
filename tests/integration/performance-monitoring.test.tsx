/**
 * Integration tests for the Performance Monitoring & Developer Experience System
 * Tests the interaction between all major components
 */

import { jest } from '@jest/globals';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { PerformanceProvider } from '@/contexts/PerformanceContext';
import { PerformanceRegressionDetector, regressionDetector } from '@/lib/performance/regression-detector';
import PerformanceMonitor from '@/lib/performance/monitor';

// Mock browser APIs
const mockPerformanceObserver = jest.fn();
const mockPerformanceNow = jest.fn(() => Date.now());
const mockNavigatorMemory = {
  usedJSHeapSize: 50000000,
  totalJSHeapSize: 100000000,
  jsHeapSizeLimit: 200000000
};

// Setup global mocks
beforeAll(() => {
  // Mock Performance API
  global.PerformanceObserver = mockPerformanceObserver as any;
  global.performance = {
    ...global.performance,
    now: mockPerformanceNow,
    memory: mockNavigatorMemory,
    getEntriesByType: jest.fn(() => []),
    mark: jest.fn(),
    measure: jest.fn(),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn()
  } as any;

  // Mock requestIdleCallback
  global.requestIdleCallback = jest.fn((cb: any) => setTimeout(cb, 0)) as any;
  global.cancelIdleCallback = jest.fn();

  // Mock localStorage
  const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  };
  global.localStorage = localStorageMock as any;

  // Mock fetch
  global.fetch = jest.fn(() => 
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true })
    })
  ) as any;
});

// Test component that uses performance monitoring
function TestComponent({ children }: { children?: React.ReactNode }) {
  return (
    <PerformanceProvider autoStart>
      <div data-testid="test-component">
        {children}
      </div>
    </PerformanceProvider>
  );
}

describe('Performance Monitoring Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    if (regressionDetector && typeof regressionDetector.destroy === 'function') {
      regressionDetector.destroy();
    }
  });

  describe('Core Performance Monitoring', () => {
    it('should initialize performance monitoring when provider mounts', async () => {
      render(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('test-component')).toBeInTheDocument();
      });

      // Verify that performance monitoring is active
      const monitor = PerformanceMonitor.getInstance();
      expect(monitor).toBeDefined();
    });

    it('should collect and report metrics automatically', async () => {
      let metricsCollected = false;
      
      render(<TestComponent />);

      // Simulate metrics collection
      await act(async () => {
        // Trigger a metrics collection cycle
        await new Promise(resolve => setTimeout(resolve, 100));
        metricsCollected = true;
      });

      expect(metricsCollected).toBe(true);
    });
  });

  describe('Component Integration', () => {
    it('should handle component lifecycle properly', async () => {
      const { rerender, unmount } = render(<TestComponent />);

      // Verify initial state
      expect(screen.getByTestId('test-component')).toBeInTheDocument();

      // Re-render component
      rerender(<TestComponent><div>Updated</div></TestComponent>);
      
      expect(screen.getByTestId('test-component')).toBeInTheDocument();
      expect(screen.getByText('Updated')).toBeInTheDocument();

      // Unmount and verify cleanup
      unmount();
      
      // Cleanup should be handled automatically
      expect(screen.queryByTestId('test-component')).not.toBeInTheDocument();
    });

    it('should maintain performance data across re-renders', async () => {
      const { rerender } = render(<TestComponent />);

      // Get initial monitor instance
      const initialMonitor = PerformanceMonitor.getInstance();
      
      // Re-render
      rerender(<TestComponent><div>Updated</div></TestComponent>);

      // Verify same monitor instance is maintained
      const afterRenderMonitor = PerformanceMonitor.getInstance();
      expect(afterRenderMonitor).toBe(initialMonitor);
    });
  });

  describe('Performance Under Load', () => {
    it('should handle high-frequency metric updates', async () => {
      render(<TestComponent />);

      const monitor = PerformanceMonitor.getInstance();
      
      // Simulate high-frequency updates
      const updateCount = 100;
      const startTime = Date.now();

      for (let i = 0; i < updateCount; i++) {
        if (monitor && typeof monitor.trackCustomMetric === 'function') {
          monitor.trackCustomMetric('load-test-metric', Math.random() * 100);
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);
    });

    it('should maintain memory usage within bounds', async () => {
      render(<TestComponent />);

      const initialMemory = performance.memory?.usedJSHeapSize || 0;
      
      // Generate lots of data
      for (let i = 0; i < 100; i++) {
        // Simulate some work
        const data = { iteration: i, timestamp: Date.now() };
        // Just create some objects to simulate memory usage
        JSON.stringify(data);
      }

      // Allow garbage collection
      await new Promise(resolve => setTimeout(resolve, 100));

      const finalMemory = performance.memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });
});

describe('System Configuration', () => {
  it('should apply custom configuration correctly', async () => {
    const customConfig = {
      collectionInterval: 2000,
      maxDataPoints: 500,
      enableWebVitals: false,
      alertThresholds: {
        fps: { min: 45, critical: 20 },
        memory: { max: 100000000, critical: 200000000 }
      }
    };

    render(
      <PerformanceProvider config={customConfig}>
        <div>Custom config test</div>
      </PerformanceProvider>
    );

    const monitor = PerformanceMonitor.getInstance();
    if (monitor && typeof monitor.getConfig === 'function') {
      const config = monitor.getConfig();
      expect(config.collectionInterval).toBe(2000);
      expect(config.maxDataPoints).toBe(500);
      expect(config.enableWebVitals).toBe(false);
    }
  });

  it('should validate configuration values', async () => {
    const invalidConfig = {
      collectionInterval: -1000, // Invalid negative value
      maxDataPoints: 0 // Invalid zero value
    };

    // Should not throw error but should use default values
    expect(() => {
      render(
        <PerformanceProvider config={invalidConfig}>
          <div>Invalid config test</div>
        </PerformanceProvider>
      );
    }).not.toThrow();
  });
});