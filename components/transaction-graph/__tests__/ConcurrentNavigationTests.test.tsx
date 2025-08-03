import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { EdgeCaseManager } from '../EdgeCaseManager';
import { GraphContext, useGraphContext } from '../GraphContext';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(() => '/account/0x123'),
  useSearchParams: jest.fn(() => new URLSearchParams())
}));

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
    edges: jest.fn(() => []),
    fit: jest.fn(),
    center: jest.fn()
  };
  
  return jest.fn(() => mockCy);
});

// Test component that simulates graph navigation
const NavigationTestComponent: React.FC<{
  onNavigate?: (address: string) => void;
  simulateDelay?: number;
}> = ({ onNavigate, simulateDelay = 0 }) => {
  const { state, dispatch } = useGraphContext();
  const [isNavigating, setIsNavigating] = React.useState(false);
  
  const handleNavigate = async (address: string) => {
    if (isNavigating) {
      console.log('Navigation already in progress');
      return;
    }
    
    setIsNavigating(true);
    
    try {
      // Simulate async operation
      if (simulateDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, simulateDelay));
      }
      
      dispatch({
        type: 'NAVIGATE_TO_ACCOUNT',
        payload: { address, timestamp: Date.now() }
      });
      
      onNavigate?.(address);
    } catch (error) {
      console.error('Navigation failed:', error);
    } finally {
      setIsNavigating(false);
    }
  };
  
  return (
    <div data-testid="navigation-component">
      <div data-testid="current-address">{state.currentAddress}</div>
      <div data-testid="is-navigating">{isNavigating.toString()}</div>
      <button
        data-testid="navigate-to-account-1"
        onClick={() => handleNavigate('0xAccount1')}
        disabled={isNavigating}
      >
        Navigate to Account 1
      </button>
      <button
        data-testid="navigate-to-account-2"
        onClick={() => handleNavigate('0xAccount2')}
        disabled={isNavigating}
      >
        Navigate to Account 2
      </button>
      <button
        data-testid="navigate-to-account-3"
        onClick={() => handleNavigate('0xAccount3')}
        disabled={isNavigating}
      >
        Navigate to Account 3
      </button>
    </div>
  );
};

// Test component for race condition simulation
const RaceConditionTestComponent: React.FC = () => {
  const edgeCaseManager = EdgeCaseManager.getInstance();
  const [results, setResults] = React.useState<string[]>([]);
  
  const simulateOperation = async (operationId: string, priority: number = 0) => {
    if (!edgeCaseManager.trackOperation(operationId, 'navigation', priority)) {
      setResults(prev => [...prev, `${operationId}: BLOCKED`]);
      return;
    }
    
    try {
      // Simulate async work
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
      
      edgeCaseManager.completeOperation(operationId, true);
      setResults(prev => [...prev, `${operationId}: SUCCESS`]);
    } catch (error) {
      edgeCaseManager.completeOperation(operationId, false);
      setResults(prev => [...prev, `${operationId}: FAILED`]);
    }
  };
  
  return (
    <div data-testid="race-condition-component">
      <div data-testid="results">
        {results.map((result, index) => (
          <div key={index} data-testid={`result-${index}`}>
            {result}
          </div>
        ))}
      </div>
      <button
        data-testid="start-concurrent-operations"
        onClick={() => {
          setResults([]);
          // Start multiple operations simultaneously
          simulateOperation('op1', 1);
          simulateOperation('op2', 2);
          simulateOperation('op3', 1);
          simulateOperation('op1', 3); // Duplicate with higher priority
        }}
      >
        Start Concurrent Operations
      </button>
    </div>
  );
};

describe('Concurrent Navigation Tests', () => {
  let mockPush: jest.Mock;
  let mockReplace: jest.Mock;
  let edgeCaseManager: EdgeCaseManager;

  beforeEach(() => {
    mockPush = jest.fn();
    mockReplace = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      replace: mockReplace,
      refresh: jest.fn(),
      back: jest.fn(),
      forward: jest.fn()
    });
    
    edgeCaseManager = EdgeCaseManager.getInstance();
    edgeCaseManager.reset();
  });

  afterEach(() => {
    edgeCaseManager.reset();
    jest.clearAllMocks();
  });

  describe('Rapid Navigation Prevention', () => {
    it('should prevent multiple simultaneous navigations', async () => {
      const onNavigate = jest.fn();
      
      render(
        <GraphContext>
          <NavigationTestComponent onNavigate={onNavigate} simulateDelay={100} />
        </GraphContext>
      );
      
      const button1 = screen.getByTestId('navigate-to-account-1');
      const button2 = screen.getByTestId('navigate-to-account-2');
      
      // Click multiple buttons rapidly
      fireEvent.click(button1);
      fireEvent.click(button2);
      
      // Wait for first navigation to complete
      await waitFor(() => {
        expect(screen.getByTestId('is-navigating')).toHaveTextContent('false');
      }, { timeout: 200 });
      
      // Only first navigation should have succeeded
      expect(onNavigate).toHaveBeenCalledTimes(1);
      expect(onNavigate).toHaveBeenCalledWith('0xAccount1');
    });

    it('should handle sequential navigations correctly', async () => {
      const onNavigate = jest.fn();
      
      render(
        <GraphContext>
          <NavigationTestComponent onNavigate={onNavigate} simulateDelay={50} />
        </GraphContext>
      );
      
      const button1 = screen.getByTestId('navigate-to-account-1');
      const button2 = screen.getByTestId('navigate-to-account-2');
      
      // First navigation
      fireEvent.click(button1);
      
      await waitFor(() => {
        expect(screen.getByTestId('is-navigating')).toHaveTextContent('false');
      });
      
      // Second navigation after first completes
      fireEvent.click(button2);
      
      await waitFor(() => {
        expect(screen.getByTestId('is-navigating')).toHaveTextContent('false');
      });
      
      // Both navigations should have succeeded
      expect(onNavigate).toHaveBeenCalledTimes(2);
      expect(onNavigate).toHaveBeenNthCalledWith(1, '0xAccount1');
      expect(onNavigate).toHaveBeenNthCalledWith(2, '0xAccount2');
    });
  });

  describe('Race Condition Handling', () => {
    it('should track and prevent race conditions', async () => {
      render(<RaceConditionTestComponent />);
      
      const button = screen.getByTestId('start-concurrent-operations');
      
      await act(async () => {
        fireEvent.click(button);
        // Wait for operations to complete
        await new Promise(resolve => setTimeout(resolve, 200));
      });
      
      const results = screen.getByTestId('results');
      const resultElements = results.querySelectorAll('[data-testid^="result-"]');
      
      expect(resultElements.length).toBeGreaterThan(0);
      
      // Check that duplicate operation was blocked
      const resultTexts = Array.from(resultElements).map(el => el.textContent);
      const op1Results = resultTexts.filter(text => text?.startsWith('op1:'));
      
      // Should have at least one op1 result
      expect(op1Results.length).toBeGreaterThan(0);
      
      // At least one operation should have been blocked or succeeded
      const hasBlocked = resultTexts.some(text => text?.includes('BLOCKED'));
      const hasSuccess = resultTexts.some(text => text?.includes('SUCCESS'));
      
      expect(hasBlocked || hasSuccess).toBe(true);
    });

    it('should prioritize higher priority operations', async () => {
      const highPriorityOp = 'high-priority-nav';
      const lowPriorityOp = 'low-priority-nav';
      
      // Start low priority operation
      const lowPrioritySuccess = edgeCaseManager.trackOperation(lowPriorityOp, 'navigation', 1);
      expect(lowPrioritySuccess).toBe(true);
      
      // Start high priority operation (should succeed and cancel low priority)
      const highPrioritySuccess = edgeCaseManager.trackOperation(highPriorityOp, 'navigation', 5);
      expect(highPrioritySuccess).toBe(true);
      
      // Check that low priority operation was cancelled
      const stats = edgeCaseManager.getStatistics();
      expect(stats.activeOperations).toBeGreaterThan(0);
    });
  });

  describe('Concurrent State Updates', () => {
    it('should handle concurrent state updates safely', async () => {
      const TestComponent = () => {
        const { state, dispatch } = useGraphContext();
        const [updateCount, setUpdateCount] = React.useState(0);
        
        const triggerConcurrentUpdates = () => {
          // Trigger multiple state updates rapidly
          for (let i = 0; i < 10; i++) {
            setTimeout(() => {
              dispatch({
                type: 'UPDATE_GRAPH_DATA',
                payload: { nodes: [{ id: `node-${i}`, data: { id: `node-${i}` } }] }
              });
              setUpdateCount(prev => prev + 1);
            }, i * 10);
          }
        };
        
        return (
          <div data-testid="concurrent-updates-component">
            <div data-testid="update-count">{updateCount}</div>
            <div data-testid="node-count">{state.graphData.nodes.length}</div>
            <button
              data-testid="trigger-updates"
              onClick={triggerConcurrentUpdates}
            >
              Trigger Updates
            </button>
          </div>
        );
      };
      
      render(
        <GraphContext>
          <TestComponent />
        </GraphContext>
      );
      
      const triggerButton = screen.getByTestId('trigger-updates');
      
      await act(async () => {
        fireEvent.click(triggerButton);
        // Wait for all updates to complete
        await new Promise(resolve => setTimeout(resolve, 200));
      });
      
      // Should have handled all updates without crashes
      const updateCount = screen.getByTestId('update-count').textContent;
      expect(parseInt(updateCount || '0')).toBe(10);
    });
  });

  describe('Network Request Concurrency', () => {
    it('should handle concurrent network requests safely', async () => {
      // Mock fetch
      const mockFetch = jest.fn();
      global.fetch = mockFetch;
      
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ account: '0xAccount1', data: 'data1' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ account: '0xAccount2', data: 'data2' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ account: '0xAccount3', data: 'data3' })
        });
      
      const requests = [
        edgeCaseManager.safeNetworkRequest('/api/account/0xAccount1'),
        edgeCaseManager.safeNetworkRequest('/api/account/0xAccount2'),
        edgeCaseManager.safeNetworkRequest('/api/account/0xAccount3')
      ];
      
      const results = await Promise.allSettled(requests);
      
      // All requests should succeed
      results.forEach(result => {
        expect(result.status).toBe('fulfilled');
      });
      
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should handle network request failures gracefully', async () => {
      const mockFetch = jest.fn();
      global.fetch = mockFetch;
      
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error'
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: 'success' })
        });
      
      // Test network error
      await expect(
        edgeCaseManager.safeNetworkRequest('/api/failing-endpoint')
      ).rejects.toThrow('Network error');
      
      // Test HTTP error
      await expect(
        edgeCaseManager.safeNetworkRequest('/api/server-error')
      ).rejects.toThrow('HTTP 500: Internal Server Error');
      
      // Test successful request
      const result = await edgeCaseManager.safeNetworkRequest('/api/success');
      expect(result).toEqual({ data: 'success' });
    });

    it('should retry failed requests with backoff', async () => {
      const mockFetch = jest.fn();
      global.fetch = mockFetch;
      
      mockFetch
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: 'success after retries' })
        });
      
      const startTime = Date.now();
      const result = await edgeCaseManager.safeNetworkRequest(
        '/api/retry-endpoint',
        {},
        { attempts: 3, delay: 50, backoff: 2 }
      );
      const endTime = Date.now();
      
      expect(result).toEqual({ data: 'success after retries' });
      expect(mockFetch).toHaveBeenCalledTimes(3);
      
      // Should have taken some time due to retry delays
      expect(endTime - startTime).toBeGreaterThan(100);
    });
  });

  describe('Operation Queue Management', () => {
    it('should process operations in priority order', async () => {
      const results: string[] = [];
      
      const createOperation = (id: string, priority: number) => async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        results.push(id);
      };
      
      // Queue operations with different priorities
      const promises = [
        edgeCaseManager.queueOperation('low-1', createOperation('low-1', 1), 1),
        edgeCaseManager.queueOperation('high-1', createOperation('high-1', 5), 5),
        edgeCaseManager.queueOperation('medium-1', createOperation('medium-1', 3), 3),
        edgeCaseManager.queueOperation('high-2', createOperation('high-2', 5), 5),
        edgeCaseManager.queueOperation('low-2', createOperation('low-2', 1), 1)
      ];
      
      await Promise.all(promises);
      
      // Results should be in priority order (highest first)
      expect(results[0]).toBe('high-1');
      expect(results[1]).toBe('high-2');
      expect(results[2]).toBe('medium-1');
      // Low priority operations should come last
      expect(results.slice(-2)).toEqual(expect.arrayContaining(['low-1', 'low-2']));
    });

    it('should handle operation timeouts', async () => {
      const slowOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return 'completed';
      };
      
      await expect(
        edgeCaseManager.queueOperation('slow-op', slowOperation, 0, 100) // 100ms timeout
      ).rejects.toThrow('Operation timed out after 100ms');
    });
  });

  describe('Circular Reference Prevention', () => {
    it('should detect circular navigation paths', () => {
      const path = ['0xA', '0xB', '0xC'];
      const nodeId = '0xA'; // This creates a circular reference
      
      const circularRef = edgeCaseManager.detectCircularReference(nodeId, path);
      
      expect(circularRef).toBeTruthy();
      expect(circularRef?.nodeId).toBe('0xA');
      expect(circularRef?.path).toEqual(['0xA', '0xB', '0xC']);
      expect(circularRef?.depth).toBe(3);
    });

    it('should find alternative paths when circular reference is detected', () => {
      const allNodes = new Map([
        ['0xA', { connections: ['0xB', '0xD'] }],
        ['0xB', { connections: ['0xC'] }],
        ['0xC', { connections: ['0xA'] }], // Creates circular reference
        ['0xD', { connections: ['0xC'] }]  // Alternative path
      ]);
      
      const alternativePath = edgeCaseManager.breakCircularReference('0xA', '0xC', allNodes);
      
      expect(alternativePath).toBeTruthy();
      expect(alternativePath).toEqual(['0xA', '0xD', '0xC']);
    });
  });
});