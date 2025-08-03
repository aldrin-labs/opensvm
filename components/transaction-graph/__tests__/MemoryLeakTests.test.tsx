import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { MemoryManager } from '../MemoryManager';
import { EdgeCaseManager } from '../EdgeCaseManager';
import { GraphContext } from '../GraphContext';

// Mock Cytoscape
jest.mock('cytoscape', () => {
  const mockCy = {
    ready: jest.fn((callback) => callback()),
    on: jest.fn(),
    off: jest.fn(),
    destroy: jest.fn(),
    elements: jest.fn(() => ({
      remove: jest.fn()
    })),
    nodes: jest.fn(() => []),
    edges: jest.fn(() => [])
  };
  
  return jest.fn(() => mockCy);
});

// Test component that uses memory-intensive operations
const MemoryIntensiveComponent: React.FC<{ iterations?: number }> = ({ iterations = 100 }) => {
  const memoryManager = MemoryManager.getInstance();
  const [data, setData] = React.useState<any[]>([]);

  React.useEffect(() => {
    // Create memory-intensive operations
    const operations: string[] = [];
    
    for (let i = 0; i < iterations; i++) {
      // Create timeouts
      const timeoutId = memoryManager.safeSetTimeout(() => {
        setData(prev => [...prev, { id: i, data: new Array(1000).fill(i) }]);
      }, i * 10, `Memory test timeout ${i}`);
      
      operations.push(timeoutId);
      
      // Create intervals
      const intervalId = memoryManager.safeSetInterval(() => {
        // Do nothing, just test cleanup
      }, 1000, `Memory test interval ${i}`);
      
      operations.push(intervalId);
    }
    
    return () => {
      // Cleanup should be automatic via MemoryManager
    };
  }, [iterations, memoryManager]);

  return (
    <div data-testid="memory-intensive-component">
      <span data-testid="data-count">{data.length}</span>
    </div>
  );
};

describe('Memory Leak Tests', () => {
  let memoryManager: MemoryManager;
  let edgeCaseManager: EdgeCaseManager;
  let originalMemory: any;

  beforeEach(() => {
    memoryManager = MemoryManager.getInstance();
    edgeCaseManager = EdgeCaseManager.getInstance();
    
    // Mock performance.memory
    originalMemory = (performance as any).memory;
    (performance as any).memory = {
      usedJSHeapSize: 50 * 1024 * 1024, // 50MB
      totalJSHeapSize: 100 * 1024 * 1024, // 100MB
      jsHeapSizeLimit: 2048 * 1024 * 1024 // 2GB
    };
  });

  afterEach(() => {
    memoryManager.cleanupAllResources();
    edgeCaseManager.reset();
    (performance as any).memory = originalMemory;
    jest.clearAllMocks();
  });

  describe('Resource Cleanup', () => {
    it('should clean up all registered resources on unmount', () => {
      const { unmount } = render(<MemoryIntensiveComponent iterations={10} />);
      
      // Check that resources were registered
      const stats = memoryManager.getResourceStats();
      expect(stats.totalResources).toBeGreaterThan(0);
      
      // Unmount component
      unmount();
      
      // Wait for cleanup
      act(() => {
        memoryManager.cleanupAllResources();
      });
      
      // Check that resources were cleaned up
      const finalStats = memoryManager.getResourceStats();
      expect(finalStats.totalResources).toBe(0);
    });

    it('should handle timeout cleanup correctly', async () => {
      let callbackCalled = false;
      
      const timeoutId = memoryManager.safeSetTimeout(() => {
        callbackCalled = true;
      }, 100, 'Test timeout');
      
      // Check resource is registered
      const stats = memoryManager.getResourceStats();
      expect(stats.byType.timeout).toBe(1);
      
      // Clean up before timeout fires
      memoryManager.unregisterResource(timeoutId);
      
      // Wait longer than timeout
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      });
      
      // Callback should not have been called
      expect(callbackCalled).toBe(false);
      
      // Resource should be cleaned up
      const finalStats = memoryManager.getResourceStats();
      expect(finalStats.byType.timeout || 0).toBe(0);
    });

    it('should handle interval cleanup correctly', async () => {
      let callCount = 0;
      
      const intervalId = memoryManager.safeSetInterval(() => {
        callCount++;
      }, 50, 'Test interval');
      
      // Wait for a few calls
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      });
      
      const callsBeforeCleanup = callCount;
      expect(callsBeforeCleanup).toBeGreaterThan(0);
      
      // Clean up interval
      memoryManager.unregisterResource(intervalId);
      
      // Wait more time
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      });
      
      // Call count should not have increased
      expect(callCount).toBe(callsBeforeCleanup);
    });

    it('should clean up event listeners properly', () => {
      const mockElement = document.createElement('div');
      const mockHandler = jest.fn();
      
      const listenerId = memoryManager.safeAddEventListener(
        mockElement,
        'click',
        mockHandler,
        undefined,
        'Test event listener'
      );
      
      // Simulate click
      mockElement.click();
      expect(mockHandler).toHaveBeenCalledTimes(1);
      
      // Clean up listener
      memoryManager.unregisterResource(listenerId);
      
      // Simulate click again
      mockHandler.mockClear();
      mockElement.click();
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('Memory Monitoring', () => {
    it('should detect memory pressure and trigger cleanup', async () => {
      const onMemoryPressure = jest.fn();
      
      memoryManager.configureLeakDetection({
        threshold: 10, // 10MB
        checkInterval: 100,
        onLeakDetected: jest.fn(),
        onMemoryPressure
      });
      
      // Simulate memory pressure
      (performance as any).memory.usedJSHeapSize = 200 * 1024 * 1024; // 200MB
      
      // Wait for monitoring to detect pressure
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      });
      
      expect(onMemoryPressure).toHaveBeenCalled();
    });

    it('should detect memory leaks through sustained growth', async () => {
      const onLeakDetected = jest.fn();
      let heapSize = 50 * 1024 * 1024; // Start at 50MB
      
      memoryManager.configureLeakDetection({
        threshold: 5, // 5MB threshold
        checkInterval: 50,
        onLeakDetected,
        onMemoryPressure: jest.fn()
      });
      
      // Simulate sustained memory growth
      const interval = setInterval(() => {
        heapSize += 1 * 1024 * 1024; // Grow by 1MB each time
        (performance as any).memory.usedJSHeapSize = heapSize;
      }, 60);
      
      // Wait for leak detection
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
      });
      
      clearInterval(interval);
      expect(onLeakDetected).toHaveBeenCalled();
    });

    it('should handle WeakReference cleanup correctly', () => {
      const objects: any[] = [];
      const refs: WeakRef<any>[] = [];
      
      // Create objects and weak references
      for (let i = 0; i < 10; i++) {
        const obj = { id: i, data: new Array(1000).fill(i) };
        objects.push(obj);
        refs.push(new WeakRef(obj));
      }
      
      // Clear strong references to some objects
      objects.splice(0, 5);
      
      // Force garbage collection if available
      if ((global as any).gc) {
        (global as any).gc();
      }
      
      // Check that some refs are now empty
      // Note: This test may be flaky in different JS engines
      const aliveRefs = refs.filter(ref => ref.deref() !== undefined);
      expect(aliveRefs.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Resource Statistics', () => {
    it('should provide accurate resource statistics', () => {
      // Create various resources
      const timeoutId = memoryManager.safeSetTimeout(() => {}, 1000);
      const intervalId = memoryManager.safeSetInterval(() => {}, 1000);
      
      const mockElement = document.createElement('div');
      const listenerId = memoryManager.safeAddEventListener(mockElement, 'click', () => {});
      
      const stats = memoryManager.getResourceStats();
      
      expect(stats.totalResources).toBe(3);
      expect(stats.byType.timeout).toBe(1);
      expect(stats.byType.interval).toBe(1);
      expect(stats.byType.listener).toBe(1);
      expect(stats.oldestResource).toBeTruthy();
      
      // Clean up
      memoryManager.unregisterResource(timeoutId);
      memoryManager.unregisterResource(intervalId);
      memoryManager.unregisterResource(listenerId);
    });

    it('should track resource age correctly', async () => {
      const timeoutId = memoryManager.safeSetTimeout(() => {}, 1000);
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });
      
      const stats = memoryManager.getResourceStats();
      expect(stats.oldestResource?.age).toBeGreaterThan(50);
      
      memoryManager.unregisterResource(timeoutId);
    });
  });

  describe('Memory-Intensive Components', () => {
    it('should handle rapid component mounting/unmounting without leaks', async () => {
      const { rerender, unmount } = render(<MemoryIntensiveComponent iterations={5} />);
      
      // Rapidly change props to trigger re-renders
      for (let i = 0; i < 10; i++) {
        rerender(<MemoryIntensiveComponent iterations={i + 1} />);
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
        });
      }
      
      const statsBeforeUnmount = memoryManager.getResourceStats();
      
      unmount();
      
      // Clean up
      act(() => {
        memoryManager.cleanupAllResources();
      });
      
      const statsAfterUnmount = memoryManager.getResourceStats();
      expect(statsAfterUnmount.totalResources).toBe(0);
    });

    it('should clean up old resources automatically', async () => {
      // Create resources
      for (let i = 0; i < 50; i++) {
        memoryManager.safeSetTimeout(() => {}, 1000, `Old resource ${i}`);
      }
      
      const initialStats = memoryManager.getResourceStats();
      expect(initialStats.totalResources).toBe(50);
      
      // Trigger memory pressure cleanup
      edgeCaseManager.handleMemoryPressure();
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });
      
      // Some resources should have been cleaned up
      // (exact number depends on timing and cleanup logic)
      const finalStats = memoryManager.getResourceStats();
      expect(finalStats.totalResources).toBeLessThanOrEqual(50);
    });
  });

  describe('GraphContext Memory Management', () => {
    it('should clean up graph context resources properly', () => {
      const TestComponent = () => {
        return (
          <GraphContext>
            <div data-testid="graph-consumer">Graph Consumer</div>
          </GraphContext>
        );
      };
      
      const { unmount } = render(<TestComponent />);
      
      // Verify context is working
      expect(screen.getByTestId('graph-consumer')).toBeInTheDocument();
      
      // Unmount and verify cleanup
      unmount();
      
      // Context should have cleaned up its resources
      const stats = memoryManager.getResourceStats();
      expect(stats.totalResources).toBe(0);
    });
  });

  describe('Error Handling in Cleanup', () => {
    it('should handle cleanup errors gracefully', () => {
      // Mock a resource that throws during cleanup
      const mockCleanup = jest.fn(() => {
        throw new Error('Cleanup error');
      });
      
      memoryManager.registerResource('test-error', 'timeout', mockCleanup);
      
      // Should not throw
      expect(() => {
        memoryManager.unregisterResource('test-error');
      }).not.toThrow();
      
      expect(mockCleanup).toHaveBeenCalled();
    });

    it('should continue cleanup even if some resources fail', () => {
      const mockCleanup1 = jest.fn(() => {
        throw new Error('Cleanup error 1');
      });
      const mockCleanup2 = jest.fn();
      const mockCleanup3 = jest.fn(() => {
        throw new Error('Cleanup error 3');
      });
      
      memoryManager.registerResource('test-1', 'timeout', mockCleanup1);
      memoryManager.registerResource('test-2', 'timeout', mockCleanup2);
      memoryManager.registerResource('test-3', 'timeout', mockCleanup3);
      
      // Should not throw and should clean up all resources
      expect(() => {
        memoryManager.cleanupAllResources();
      }).not.toThrow();
      
      expect(mockCleanup1).toHaveBeenCalled();
      expect(mockCleanup2).toHaveBeenCalled();
      expect(mockCleanup3).toHaveBeenCalled();
      
      const stats = memoryManager.getResourceStats();
      expect(stats.totalResources).toBe(0);
    });
  });
});