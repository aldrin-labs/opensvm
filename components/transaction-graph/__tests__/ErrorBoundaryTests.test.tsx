import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { EdgeCaseManager } from '../EdgeCaseManager';

// Enhanced Error Boundary component for testing
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorId: string | null;
  retryCount: number;
  lastErrorTime: number;
}

class TestErrorBoundary extends React.Component<
  React.PropsWithChildren<{
    fallback?: React.ComponentType<{ error: Error; retry: () => void; errorId: string }>;
    onError?: (error: Error, errorInfo: React.ErrorInfo, errorId: string) => void;
    maxRetries?: number;
    retryDelay?: number;
  }>,
  ErrorBoundaryState
> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: any) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
      lastErrorTime: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      hasError: true,
      error,
      errorId,
      lastErrorTime: Date.now()
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const { onError } = this.props;
    const { errorId } = this.state;

    this.setState({ errorInfo });

    if (onError && errorId) {
      onError(error, errorInfo, errorId);
    }

    // Log error for debugging
    console.error('Error caught by boundary:', error, errorInfo);
  }

  retry = () => {
    const { maxRetries = 3, retryDelay = 1000 } = this.props;
    const { retryCount } = this.state;

    if (retryCount >= maxRetries) {
      console.warn(`Max retries (${maxRetries}) exceeded`);
      return;
    }

    this.setState(prevState => ({
      retryCount: prevState.retryCount + 1
    }));

    // Delay retry to prevent immediate re-error
    this.retryTimeoutId = setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: null
      });
    }, retryDelay);
  };

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  render() {
    const { hasError, error, errorId } = this.state;
    const { fallback: Fallback, children } = this.props;

    if (hasError && error && errorId) {
      if (Fallback) {
        return <Fallback error={error} retry={this.retry} errorId={errorId} />;
      }

      return (
        <div data-testid="error-boundary-fallback">
          <h2>Something went wrong</h2>
          <details>
            <summary>Error details</summary>
            <pre data-testid="error-message">{error.message}</pre>
            <pre data-testid="error-stack">{error.stack}</pre>
          </details>
          <button data-testid="retry-button" onClick={this.retry}>
            Retry ({this.state.retryCount}/{this.props.maxRetries || 3})
          </button>
        </div>
      );
    }

    return children;
  }
}

// Components that throw different types of errors
const ThrowingComponent: React.FC<{
  errorType: 'render' | 'effect' | 'async' | 'memory' | 'network';
  shouldThrow?: boolean;
  delay?: number;
}> = ({ errorType, shouldThrow = true, delay = 0 }) => {
  const [shouldThrowState, setShouldThrowState] = React.useState(shouldThrow);

  // Render error
  if (errorType === 'render' && shouldThrowState) {
    throw new Error('Render error occurred');
  }

  // Effect error
  React.useEffect(() => {
    if (errorType === 'effect' && shouldThrowState) {
      setTimeout(() => {
        throw new Error('Effect error occurred');
      }, delay);
    }
  }, [errorType, shouldThrowState, delay]);

  // Async error
  React.useEffect(() => {
    if (errorType === 'async' && shouldThrowState) {
      const asyncError = async () => {
        await new Promise(resolve => setTimeout(resolve, delay));
        throw new Error('Async error occurred');
      };

      asyncError().catch(error => {
        // Async errors need to be handled differently
        console.error('Async error:', error);
      });
    }
  }, [errorType, shouldThrowState, delay]);

  // Memory error simulation
  React.useEffect(() => {
    if (errorType === 'memory' && shouldThrowState) {
      const createMemoryLeak = () => {
        const largeArray = new Array(1000000).fill('memory leak simulation');
        // Intentionally don't clean up
        setTimeout(createMemoryLeak, 10);
      };

      createMemoryLeak();
    }
  }, [errorType, shouldThrowState]);

  // Network error simulation
  React.useEffect(() => {
    if (errorType === 'network' && shouldThrowState) {
      fetch('/non-existent-endpoint')
        .catch(error => {
          throw new Error(`Network error: ${error.message}`);
        });
    }
  }, [errorType, shouldThrowState]);

  return (
    <div data-testid="throwing-component">
      <p>Component type: {errorType}</p>
      <p>Should throw: {shouldThrowState.toString()}</p>
      <button
        data-testid="toggle-error"
        onClick={() => setShouldThrowState(!shouldThrowState)}
      >
        Toggle Error
      </button>
    </div>
  );
};

// Component that simulates graph-specific errors
const GraphErrorComponent: React.FC<{
  errorType: 'cytoscape' | 'data' | 'layout' | 'navigation';
}> = ({ errorType }) => {
  const [shouldError, setShouldError] = React.useState(false);

  const triggerError = () => {
    setShouldError(true);
  };

  // Throw error during render when shouldError is true
  if (shouldError) {
    switch (errorType) {
      case 'cytoscape':
        // Simulate Cytoscape initialization error
        throw new Error('Failed to initialize Cytoscape: Invalid container');

      case 'data':
        // Simulate invalid graph data
        throw new Error('Invalid graph data: Missing required node properties');

      case 'layout':
        // Simulate layout calculation error
        throw new Error('Layout calculation failed: Invalid node positions');

      case 'navigation':
        // Simulate navigation error
        throw new Error('Navigation failed: Invalid account address');

      default:
        throw new Error('Unknown graph error type');
    }
  }

  return (
    <div data-testid="graph-error-component">
      <p>Graph error type: {errorType}</p>
      <button
        data-testid="trigger-graph-error"
        onClick={triggerError}
      >
        Trigger {errorType} Error
      </button>
    </div>
  );
};

describe('Error Boundary Tests', () => {
  let edgeCaseManager: EdgeCaseManager;
  let onErrorSpy: jest.Mock;

  beforeEach(() => {
    edgeCaseManager = EdgeCaseManager.getInstance();
    edgeCaseManager.reset();

    onErrorSpy = jest.fn();

    // Suppress console errors during tests
    jest.spyOn(console, 'error').mockImplementation(() => { });
  });

  afterEach(() => {
    edgeCaseManager.reset();
    jest.restoreAllMocks();
  });

  describe('Basic Error Boundary Functionality', () => {
    it('should catch and display render errors', () => {
      render(
        <TestErrorBoundary onError={onErrorSpy}>
          <ThrowingComponent errorType="render" />
        </TestErrorBoundary>
      );

      expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument();
      expect(screen.getByTestId('error-message')).toHaveTextContent('Render error occurred');
      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.any(Error),
        expect.any(Object),
        expect.stringMatching(/^error_\d+/)
      );
    });

    it('should provide retry functionality', () => {
      render(
        <TestErrorBoundary onError={onErrorSpy} retryDelay={10}>
          <ThrowingComponent errorType="render" />
        </TestErrorBoundary>
      );

      expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument();

      const retryButton = screen.getByTestId('retry-button');
      expect(retryButton).toHaveTextContent('Retry (0/3)');

      // Click retry
      act(() => {
        fireEvent.click(retryButton);
      });

      // Should still show error boundary since component still throws
      expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument();
      expect(screen.getByTestId('retry-button')).toHaveTextContent('Retry (1/3)');
    });

    it('should limit retry attempts', () => {
      render(
        <TestErrorBoundary onError={onErrorSpy} maxRetries={2} retryDelay={10}>
          <ThrowingComponent errorType="render" />
        </TestErrorBoundary>
      );

      const retryButton = screen.getByTestId('retry-button');

      // Try to retry beyond limit
      for (let i = 0; i < 5; i++) {
        if (retryButton.textContent?.includes('2/2')) break;

        act(() => {
          fireEvent.click(retryButton);
        });
      }

      expect(retryButton).toHaveTextContent('Retry (2/2)');
    });
  });

  describe('Custom Fallback Component', () => {
    const CustomFallback: React.FC<{
      error: Error;
      retry: () => void;
      errorId: string;
    }> = ({ error, retry, errorId }) => (
      <div data-testid="custom-fallback">
        <h3 data-testid="custom-error-title">Custom Error Handler</h3>
        <p data-testid="custom-error-id">Error ID: {errorId}</p>
        <p data-testid="custom-error-message">{error.message}</p>
        <button data-testid="custom-retry" onClick={retry}>
          Try Again
        </button>
      </div>
    );

    it('should use custom fallback component', () => {
      render(
        <TestErrorBoundary fallback={CustomFallback} onError={onErrorSpy}>
          <ThrowingComponent errorType="render" />
        </TestErrorBoundary>
      );

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
      expect(screen.getByTestId('custom-error-title')).toHaveTextContent('Custom Error Handler');
      expect(screen.getByTestId('custom-error-message')).toHaveTextContent('Render error occurred');
      expect(screen.getByTestId('custom-error-id')).toHaveTextContent(/^Error ID: error_\d+/);
    });
  });

  describe('Graph-Specific Error Handling', () => {
    it('should handle Cytoscape initialization errors', () => {
      render(
        <TestErrorBoundary onError={onErrorSpy}>
          <GraphErrorComponent errorType="cytoscape" />
        </TestErrorBoundary>
      );

      const triggerButton = screen.getByTestId('trigger-graph-error');

      act(() => {
        fireEvent.click(triggerButton);
      });

      expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument();
      expect(screen.getByTestId('error-message')).toHaveTextContent(
        'Failed to initialize Cytoscape: Invalid container'
      );
    });

    it('should handle invalid graph data errors', () => {
      render(
        <TestErrorBoundary onError={onErrorSpy}>
          <GraphErrorComponent errorType="data" />
        </TestErrorBoundary>
      );

      const triggerButton = screen.getByTestId('trigger-graph-error');

      act(() => {
        fireEvent.click(triggerButton);
      });

      expect(screen.getByTestId('error-message')).toHaveTextContent(
        'Invalid graph data: Missing required node properties'
      );
    });

    it('should handle layout calculation errors', () => {
      render(
        <TestErrorBoundary onError={onErrorSpy}>
          <GraphErrorComponent errorType="layout" />
        </TestErrorBoundary>
      );

      const triggerButton = screen.getByTestId('trigger-graph-error');

      act(() => {
        fireEvent.click(triggerButton);
      });

      expect(screen.getByTestId('error-message')).toHaveTextContent(
        'Layout calculation failed: Invalid node positions'
      );
    });

    it('should handle navigation errors', () => {
      render(
        <TestErrorBoundary onError={onErrorSpy}>
          <GraphErrorComponent errorType="navigation" />
        </TestErrorBoundary>
      );

      const triggerButton = screen.getByTestId('trigger-graph-error');

      act(() => {
        fireEvent.click(triggerButton);
      });

      expect(screen.getByTestId('error-message')).toHaveTextContent(
        'Navigation failed: Invalid account address'
      );
    });
  });

  describe('Error Recovery and State Restoration', () => {
    const RecoverableComponent: React.FC<{ shouldRecover?: boolean }> = ({ shouldRecover = false }) => {
      // If shouldRecover is true, don't throw error - component has "recovered"
      if (!shouldRecover) {
        throw new Error('Component error - no recovery');
      }

      return (
        <div data-testid="recoverable-component">
          <p>Component recovered successfully</p>
          <p data-testid="recovery-status">Recovered: true</p>
        </div>
      );
    };

    it('should allow component recovery after error', async () => {
      const { rerender } = render(
        <TestErrorBoundary onError={onErrorSpy} retryDelay={50}>
          <RecoverableComponent shouldRecover={false} />
        </TestErrorBoundary>
      );

      // Should show error boundary
      expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument();

      // Change props to allow recovery
      rerender(
        <TestErrorBoundary onError={onErrorSpy} retryDelay={50}>
          <RecoverableComponent shouldRecover={true} />
        </TestErrorBoundary>
      );

      // Click retry
      const retryButton = screen.getByTestId('retry-button');

      await act(async () => {
        fireEvent.click(retryButton);
        // Wait for retry delay + recovery time
        await new Promise(resolve => setTimeout(resolve, 200));
      });

      // Should show recovered component
      expect(screen.getByTestId('recoverable-component')).toBeInTheDocument();
      expect(screen.getByTestId('recovery-status')).toHaveTextContent('Recovered: true');
    });
  });

  describe('Error Context and Debugging', () => {
    it('should provide detailed error information', () => {
      render(
        <TestErrorBoundary onError={onErrorSpy}>
          <ThrowingComponent errorType="render" />
        </TestErrorBoundary>
      );

      // Check that error details are available
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
      expect(screen.getByTestId('error-stack')).toBeInTheDocument();

      // Check that onError was called with proper parameters
      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Render error occurred'
        }),
        expect.objectContaining({
          componentStack: expect.any(String)
        }),
        expect.stringMatching(/^error_\d+/)
      );
    });

    it('should track error frequency and patterns', async () => {
      const ErrorTrackingComponent: React.FC = () => {
        const [shouldError, setShouldError] = React.useState(false);

        const triggerError = () => {
          setShouldError(true);
        };

        // Throw error during render when shouldError is true
        if (shouldError) {
          // Use a unique error message each time
          throw new Error(`Error #${Date.now()}`);
        }

        return (
          <div data-testid="error-tracking-component">
            <button data-testid="trigger-tracked-error" onClick={triggerError}>
              Trigger Error
            </button>
          </div>
        );
      };

      const errorLog: Array<{ error: Error; errorId: string; timestamp: number }> = [];
      const trackingOnError = (error: Error, errorInfo: React.ErrorInfo, errorId: string) => {
        errorLog.push({ error, errorId, timestamp: Date.now() });
      };

      render(
        <TestErrorBoundary onError={trackingOnError} retryDelay={10}>
          <ErrorTrackingComponent />
        </TestErrorBoundary>
      );

      // Trigger multiple errors
      for (let i = 0; i < 3; i++) {
        // Wait for component to be ready
        await waitFor(() => {
          expect(screen.queryByTestId('trigger-tracked-error')).toBeInTheDocument();
        });

        // Trigger error
        act(() => {
          fireEvent.click(screen.getByTestId('trigger-tracked-error'));
        });

        // Wait for error boundary to show
        await waitFor(() => {
          expect(screen.queryByTestId('retry-button')).toBeInTheDocument();
        });

        // Click retry if available
        if (screen.queryByTestId('retry-button')) {
          act(() => {
            fireEvent.click(screen.getByTestId('retry-button'));
          });

          // Wait for component to recover after retry delay
          await new Promise(resolve => setTimeout(resolve, 15));
        }
      }

      expect(errorLog.length).toBeGreaterThan(0);
      errorLog.forEach((entry) => {
        expect(entry.error.message).toContain('Error #');
        expect(entry.errorId).toMatch(/^error_\d+/);
        expect(entry.timestamp).toBeGreaterThan(0);
      });
    });
  });

  describe('Integration with EdgeCaseManager', () => {
    it('should integrate with state corruption detection', async () => {
      const CorruptionTestComponent: React.FC = () => {
        const [state, setState] = React.useState({ count: 0, valid: true });

        React.useEffect(() => {
          // Simulate state corruption
          const corruptedState = { count: 'invalid' as any, valid: false };

          const isValid = edgeCaseManager.validateState(
            'corruption-test',
            { count: 0, valid: true },
            corruptedState
          );

          if (!isValid) {
            throw new Error('State corruption detected');
          }
        }, []);

        return <div data-testid="corruption-test-component">State is valid</div>;
      };

      render(
        <TestErrorBoundary onError={onErrorSpy}>
          <CorruptionTestComponent />
        </TestErrorBoundary>
      );

      expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument();
      expect(screen.getByTestId('error-message')).toHaveTextContent('State corruption detected');
    });

    it('should handle memory pressure errors', async () => {
      const MemoryPressureComponent: React.FC = () => {
        React.useEffect(() => {
          // Simulate memory pressure
          edgeCaseManager.handleMemoryPressure();

          // Simulate error due to memory pressure
          throw new Error('Component failed due to memory pressure');
        }, []);

        return <div data-testid="memory-pressure-component">Normal operation</div>;
      };

      render(
        <TestErrorBoundary onError={onErrorSpy}>
          <MemoryPressureComponent />
        </TestErrorBoundary>
      );

      expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument();
      expect(screen.getByTestId('error-message')).toHaveTextContent('Component failed due to memory pressure');
    });
  });
});