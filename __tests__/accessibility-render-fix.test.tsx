import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { AccessibilityProvider, useAccessibility } from '../lib/accessibility';

// Mock window.matchMedia
const mockMatchMedia = jest.fn((query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: jest.fn(), // deprecated
  removeListener: jest.fn(), // deprecated
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: mockMatchMedia,
});

// Mock console.error to capture render warnings
const originalError = console.error;
let consoleErrors: string[] = [];

beforeEach(() => {
  consoleErrors = [];
  console.error = jest.fn((...args) => {
    consoleErrors.push(args.join(' '));
  });
});

afterEach(() => {
  console.error = originalError;
});

// Test component that uses the accessibility context
const TestComponent = () => {
  const { announceToScreenReader } = useAccessibility();
  
  React.useEffect(() => {
    // This should not cause a render-time setState error
    announceToScreenReader('Test announcement');
  }, [announceToScreenReader]);

  return <div data-testid="test-component">Test Component</div>;
};

describe('Accessibility Provider Render Fix', () => {
  test('should not cause setState during render errors', async () => {
    // Render the component
    await act(async () => {
      render(
        <AccessibilityProvider>
          <TestComponent />
        </AccessibilityProvider>
      );
    });

    // Check that the component rendered successfully
    expect(screen.getByTestId('test-component')).toBeTruthy();

    // Check that no render-time setState errors occurred
    const renderErrors = consoleErrors.filter(error => 
      error.includes('Cannot update a component') && 
      error.includes('while rendering a different component')
    );
    
    expect(renderErrors).toHaveLength(0);
  });

  test('should still allow screen reader announcements after mount', async () => {
    let announceFunction: ((message: string) => void) | null = null;

    const TestComponentWithAnnouncement = () => {
      const { announceToScreenReader } = useAccessibility();
      announceFunction = announceToScreenReader;
      return <div data-testid="announcement-test">Ready</div>;
    };

    await act(async () => {
      render(
        <AccessibilityProvider>
          <TestComponentWithAnnouncement />
        </AccessibilityProvider>
      );
    });

    // Wait for component to be fully mounted
    await act(async () => {
      // Small delay to ensure all effects have run
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    // Test that announcements work without errors
    await act(async () => {
      if (announceFunction) {
        announceFunction('Test announcement message');
      }
    });

    // Check for aria-live regions
    const politeRegion = document.querySelector('[aria-live="polite"]');
    const assertiveRegion = document.querySelector('[aria-live="assertive"]');
    
    expect(politeRegion).toBeTruthy();
    expect(assertiveRegion).toBeTruthy();

    // Verify no render errors occurred
    const renderErrors = consoleErrors.filter(error => 
      error.includes('Cannot update a component') && 
      error.includes('while rendering a different component')
    );
    
    expect(renderErrors).toHaveLength(0);
  });

  test('should handle multiple rapid announcements without render errors', async () => {
    let announceFunction: ((message: string) => void) | null = null;

    const TestComponentWithMultipleAnnouncements = () => {
      const { announceToScreenReader } = useAccessibility();
      announceFunction = announceToScreenReader;
      return <div data-testid="multiple-test">Ready</div>;
    };

    await act(async () => {
      render(
        <AccessibilityProvider>
          <TestComponentWithMultipleAnnouncements />
        </AccessibilityProvider>
      );
    });

    // Wait for component to be fully mounted
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    // Make multiple rapid announcements
    await act(async () => {
      if (announceFunction) {
        announceFunction('First announcement');
        announceFunction('Second announcement');
        announceFunction('Third announcement');
      }
    });

    // Verify no render errors occurred
    const renderErrors = consoleErrors.filter(error => 
      error.includes('Cannot update a component') && 
      error.includes('while rendering a different component')
    );
    
    expect(renderErrors).toHaveLength(0);
  });
});
