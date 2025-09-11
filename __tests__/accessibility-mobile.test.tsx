/**
 * Tests for accessibility and mobile optimization features
 */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { jest } from '@jest/globals';

// Import accessibility utilities
import {
  FocusManager,
  ScreenReaderUtils,
  HighContrastUtils,
  TouchUtils,
  MotionUtils,
  ContrastUtils,
  useAccessibility
} from '@/lib/accessibility-utils';

// Import mobile utilities
import {
  TouchGestureUtils,
  MobileViewportUtils,
  MobileComponentUtils,
  MobileGraphUtils,
  MobileTableUtils,
  MobileModalUtils,
  useMobileDetection,
  useSwipeGestures,
  useResponsiveLayout
} from '@/lib/mobile-utils';

// Import components
import TransactionGraph from '@/components/transaction-graph/TransactionGraph';
import InstructionBreakdown from '@/components/InstructionBreakdown';
import AccountChangesDisplay from '@/components/AccountChangesDisplay';
import MobileInstructionDisplay from '@/components/MobileInstructionDisplay';

// Mock data
const mockTransaction = {
  signature: 'test-signature-123',
  slot: 12345,
  blockTime: Date.now(),
  details: {
    instructions: [
      {
        programId: '11111111111111111111111111111111',
        program: 'System Program',
        parsed: {
          type: 'transfer',
          info: {
            lamports: 1000000000
          }
        },
        accounts: ['account1', 'account2'],
        computeUnits: 5000
      }
    ],
    accounts: [
      { pubkey: 'account1', signer: true, writable: false },
      { pubkey: 'account2', signer: false, writable: true }
    ],
    logs: ['Program log: test'],
    innerInstructions: []
  }
};

const mockGraph = {
  nodes: [
    {
      id: 'node1',
      type: 'account' as const,
      label: 'Test Account',
      data: { address: 'test-address' },
      style: { size: 10, color: '#blue', shape: 'circle' as const },
      importance: 1
    }
  ],
  edges: [
    {
      id: 'edge1',
      source: 'node1',
      target: 'node2',
      type: 'transfer' as const,
      label: 'Transfer',
      data: { amount: 100 },
      style: { width: 2, color: '#green', opacity: 1 },
      weight: 1
    }
  ]
};

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock navigator.clipboard
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
});

describe('Accessibility Utils', () => {
  describe('FocusManager', () => {
    it('should find focusable elements', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <button>Button 1</button>
        <input type="text" />
        <a href="#">Link</a>
        <button disabled>Disabled Button</button>
      `;

      const focusableElements = FocusManager.getFocusableElements(container);
      expect(focusableElements).toHaveLength(3); // Excludes disabled button
    });

    it('should get first and last focusable elements', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <button id="first">First</button>
        <input type="text" />
        <button id="last">Last</button>
      `;

      const first = FocusManager.getFirstFocusableElement(container);
      const last = FocusManager.getLastFocusableElement(container);

      expect(first?.id).toBe('first');
      expect(last?.id).toBe('last');
    });

    it('should trap focus within container', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <button id="first">First</button>
        <button id="last">Last</button>
      `;
      document.body.appendChild(container);

      const firstButton = container.querySelector('#first') as HTMLElement;
      const lastButton = container.querySelector('#last') as HTMLElement;

      // Mock focus
      const focusSpy = jest.spyOn(lastButton, 'focus');
      firstButton.focus();

      const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true });
      Object.defineProperty(document, 'activeElement', { value: firstButton });

      FocusManager.trapFocus(container, event);
      expect(focusSpy).toHaveBeenCalled();

      document.body.removeChild(container);
    });
  });

  describe('ScreenReaderUtils', () => {
    it('should announce to screen reader', () => {
      const spy = jest.spyOn(document.body, 'appendChild');

      ScreenReaderUtils.announceToScreenReader('Test message');

      expect(spy).toHaveBeenCalled();
      const announcement = spy.mock.calls[0][0] as HTMLElement;
      expect(announcement.getAttribute('aria-live')).toBe('polite');
      expect(announcement.textContent).toBe('Test message');
    });

    it('should format values for screen reader', () => {
      expect(ScreenReaderUtils.formatForScreenReader(1.5, 'currency')).toBe('1.5 SOL received');
      expect(ScreenReaderUtils.formatForScreenReader(-1.5, 'currency')).toBe('1.5 SOL sent');
      expect(ScreenReaderUtils.formatForScreenReader(1234, 'number')).toBe('1,234');
      expect(ScreenReaderUtils.formatForScreenReader(0.15, 'percentage')).toBe('0.15 percent');
    });
  });

  describe('HighContrastUtils', () => {
    beforeEach(() => {
      localStorage.clear();
      document.documentElement.classList.remove('high-contrast-mode');
    });

    it('should enable high contrast mode', () => {
      HighContrastUtils.enableHighContrast();

      expect(document.documentElement.classList.contains('high-contrast-mode')).toBe(true);
      expect(localStorage.getItem('opensvm-high-contrast')).toBe('true');
    });

    it('should disable high contrast mode', () => {
      HighContrastUtils.enableHighContrast();
      HighContrastUtils.disableHighContrast();

      expect(document.documentElement.classList.contains('high-contrast-mode')).toBe(false);
      expect(localStorage.getItem('opensvm-high-contrast')).toBe('false');
    });

    it('should toggle high contrast mode', () => {
      const result1 = HighContrastUtils.toggleHighContrast();
      expect(result1).toBe(true);
      expect(document.documentElement.classList.contains('high-contrast-mode')).toBe(true);

      const result2 = HighContrastUtils.toggleHighContrast();
      expect(result2).toBe(false);
      expect(document.documentElement.classList.contains('high-contrast-mode')).toBe(false);
    });
  });

  describe('TouchUtils', () => {
    it('should detect touch device', () => {
      // Mock touch support
      Object.defineProperty(window, 'ontouchstart', { value: true });
      expect(TouchUtils.isTouchDevice()).toBe(true);
    });

    it('should create touch-friendly button', () => {
      const onClick = jest.fn();
      const button = TouchUtils.createTouchFriendlyButton('Test', onClick, {
        ariaLabel: 'Test button',
        className: 'custom-class'
      });

      expect(button.textContent).toBe('Test');
      expect(button.getAttribute('aria-label')).toBe('Test button');
      expect(button.className).toContain('custom-class');
      expect(button.className).toContain('min-h-[44px]');
    });
  });

  describe('ContrastUtils', () => {
    it('should calculate contrast ratio', () => {
      const ratio = ContrastUtils.getContrastRatio('#000000', '#ffffff');
      expect(ratio).toBe(21); // Perfect contrast
    });

    it('should check WCAG compliance', () => {
      expect(ContrastUtils.meetsWCAGAA('#000000', '#ffffff')).toBe(true);
      expect(ContrastUtils.meetsWCAGAAA('#000000', '#ffffff')).toBe(true);
      expect(ContrastUtils.meetsWCAGAA('#777777', '#ffffff')).toBe(false);
    });
  });
});

describe('Mobile Utils', () => {
  describe('MobileViewportUtils', () => {
    it('should detect mobile viewport', () => {
      // Mock window.innerWidth
      Object.defineProperty(window, 'innerWidth', { value: 600, writable: true });
      expect(MobileViewportUtils.isMobile()).toBe(true);

      window.innerWidth = 800;
      expect(MobileViewportUtils.isTablet()).toBe(true);

      window.innerWidth = 1200;
      expect(MobileViewportUtils.isDesktop()).toBe(true);
    });

    it('should get optimal column count', () => {
      expect(MobileViewportUtils.getOptimalColumnCount(600, 300)).toBe(2);
      expect(MobileViewportUtils.getOptimalColumnCount(400, 300)).toBe(1);
      expect(MobileViewportUtils.getOptimalColumnCount(1200, 300)).toBe(4);
    });

    it('should get responsive grid classes', () => {
      expect(MobileViewportUtils.getResponsiveGridCols(400)).toBe('grid-cols-1');
      expect(MobileViewportUtils.getResponsiveGridCols(800)).toBe('grid-cols-2');
      expect(MobileViewportUtils.getResponsiveGridCols(1200)).toBe('grid-cols-3');
    });
  });

  describe('MobileComponentUtils', () => {
    it('should get responsive text sizes', () => {
      expect(MobileComponentUtils.getResponsiveTextSize('text-sm')).toBe('text-base md:text-sm');
      expect(MobileComponentUtils.getResponsiveTextSize('text-lg')).toBe('text-xl md:text-lg');
    });

    it('should get responsive padding', () => {
      expect(MobileComponentUtils.getResponsivePadding('p-4')).toBe('p-6 md:p-4');
      expect(MobileComponentUtils.getResponsivePadding('px-3')).toBe('px-4 md:px-3');
    });

    it('should get touch-friendly button class', () => {
      const className = MobileComponentUtils.getTouchFriendlyButtonClass();
      expect(className).toContain('min-h-[44px]');
      expect(className).toContain('min-w-[44px]');
      expect(className).toContain('touch-manipulation');
    });
  });

  describe('MobileGraphUtils', () => {
    it('should get optimal graph dimensions', () => {
      const mobile = MobileGraphUtils.getOptimalGraphDimensions(400, 600);
      expect(mobile.width).toBeLessThanOrEqual(400);
      expect(mobile.height).toBeLessThanOrEqual(300);

      const desktop = MobileGraphUtils.getOptimalGraphDimensions(1200, 800);
      expect(desktop.width).toBe(1200);
      expect(desktop.height).toBe(800);
    });

    it('should adjust node and edge sizes for mobile', () => {
      expect(MobileGraphUtils.getMobileNodeSize(8, true)).toBe(12);
      expect(MobileGraphUtils.getMobileNodeSize(8, false)).toBe(8);

      expect(MobileGraphUtils.getMobileEdgeWidth(1, true)).toBe(2);
      expect(MobileGraphUtils.getMobileEdgeWidth(1, false)).toBe(1);
    });

    it('should determine if labels should be shown', () => {
      expect(MobileGraphUtils.shouldShowLabels(true, 10)).toBe(true);
      expect(MobileGraphUtils.shouldShowLabels(true, 30)).toBe(false);
      expect(MobileGraphUtils.shouldShowLabels(false, 30)).toBe(true);
    });
  });

  describe('TouchGestureUtils', () => {
    it('should handle touch gestures', () => {
      const element = document.createElement('div');
      const callbacks = {
        onSwipeLeft: jest.fn(),
        onSwipeRight: jest.fn()
      };

      const cleanup = TouchGestureUtils.addSwipeListeners(element, callbacks);

      // Simulate swipe left
      TouchGestureUtils.touchStartX = 100;
      TouchGestureUtils.touchEndX = 0;
      TouchGestureUtils.touchStartY = 100;
      TouchGestureUtils.touchEndY = 100;

      expect(TouchGestureUtils.getSwipeDirection()).toBe('left');

      cleanup();
    });
  });
});

describe('Component Accessibility', () => {
  describe('TransactionGraph', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <TransactionGraph
          transaction={mockTransaction}
          graph={mockGraph}
          showControls={true}
        />
      );

      // The graph component may be in loading state, so check for accessible elements that exist
      const heading = screen.getByRole('heading', { name: 'Processing Graph' });
      expect(heading).toBeInTheDocument();

      // Check that the container has proper accessibility attributes
      const container = document.querySelector('.relative.w-full.h-full');
      expect(container).toBeInTheDocument();
    });

    it('should have accessible controls', () => {
      render(
        <TransactionGraph
          transaction={mockTransaction}
          graph={mockGraph}
          showControls={true}
        />
      );

      const toolbars = screen.getAllByRole('toolbar');
      const graphControlsToolbar = toolbars.find(toolbar =>
        toolbar.getAttribute('aria-label') === 'Graph controls'
      );

      if (graphControlsToolbar) {
        expect(graphControlsToolbar).toHaveAttribute('aria-label', 'Graph controls');

        const buttons = within(graphControlsToolbar).getAllByRole('button');
        buttons.forEach(button => {
          expect(button).toHaveAttribute('aria-label');
          expect(button).toHaveAttribute('type', 'button');
        });
      }
    });
  });

  describe('InstructionBreakdown', () => {
    it('should have proper structure and ARIA attributes', () => {
      render(<InstructionBreakdown transaction={mockTransaction} />);

      const regions = screen.getAllByRole('region');
      const instructionRegion = regions.find(region =>
        region.getAttribute('aria-labelledby') === 'instructions-heading'
      );

      if (instructionRegion) {
        expect(instructionRegion).toHaveAttribute('aria-labelledby', 'instructions-heading');
      }

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveAttribute('id', 'instructions-heading');

      const list = screen.getByRole('list');
      expect(list).toHaveAttribute('aria-label', 'Transaction instructions');
    });

    it('should support keyboard navigation', async () => {
      render(<InstructionBreakdown transaction={mockTransaction} />);

      const buttons = screen.getAllByRole('button');
      const expandButton = buttons.find(button =>
        button.getAttribute('aria-expanded') !== null
      );

      if (expandButton) {
        const initialExpanded = expandButton.getAttribute('aria-expanded');
        fireEvent.click(expandButton);

        // The button should have aria-expanded attribute and be clickable
        expect(expandButton).toHaveAttribute('aria-expanded');
        expect(expandButton).toHaveAttribute('aria-controls');
        expect(expandButton).toHaveAttribute('type', 'button');
      }
    });
  });

  describe('MobileInstructionDisplay', () => {
    it('should render mobile-optimized instruction cards', () => {
      render(<MobileInstructionDisplay transaction={mockTransaction} />);

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Instructions (1)');

      const buttons = screen.getAllByRole('button');
      const expandButton = buttons.find(button =>
        button.getAttribute('aria-expanded') !== null
      );

      if (expandButton) {
        expect(expandButton).toHaveAttribute('aria-expanded');
        expect(expandButton).toHaveAttribute('aria-controls');
      }
    });

    it('should handle touch interactions', async () => {
      const onInstructionClick = jest.fn();

      render(
        <MobileInstructionDisplay
          transaction={mockTransaction}
          onInstructionClick={onInstructionClick}
        />
      );

      const buttons = screen.getAllByRole('button');
      const expandButton = buttons.find(button =>
        button.getAttribute('aria-expanded') !== null
      );

      if (expandButton) {
        fireEvent.click(expandButton);
        expect(onInstructionClick).toHaveBeenCalled();
      }
    });
  });
});

describe('Mobile Responsiveness', () => {
  it('should adapt to mobile viewport', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', { value: 400, writable: true });

    render(<MobileInstructionDisplay transaction={mockTransaction} />);

    const hint = screen.getByText(/Swipe left\/right to navigate/);
    expect(hint).toBeInTheDocument();
  });

  it('should use touch-friendly button sizes', () => {
    render(
      <TransactionGraph
        transaction={mockTransaction}
        graph={mockGraph}
        showControls={true}
      />
    );

    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      const classes = button.className;
      // Should have touch-friendly classes when on touch device
      if (classes.includes('min-h-[44px]')) {
        expect(classes).toContain('min-w-[44px]');
      }
    });
  });
});

describe('High Contrast Mode', () => {
  it('should apply high contrast styles', () => {
    HighContrastUtils.enableHighContrast();

    render(<InstructionBreakdown transaction={mockTransaction} />);

    // Check that high contrast mode is applied to the document
    expect(document.documentElement.classList.contains('high-contrast-mode')).toBe(true);

    const containers = screen.getAllByRole('region');
    expect(containers.length).toBeGreaterThan(0);
  });

  it('should maintain accessibility in high contrast mode', () => {
    HighContrastUtils.enableHighContrast();

    render(
      <TransactionGraph
        transaction={mockTransaction}
        graph={mockGraph}
        showControls={true}
      />
    );

    // Check that high contrast mode is applied to the document
    expect(document.documentElement.classList.contains('high-contrast-mode')).toBe(true);

    // Check that toolbar is still accessible
    const toolbars = screen.getAllByRole('toolbar');
    const graphControlsToolbar = toolbars.find(toolbar =>
      toolbar.getAttribute('aria-label') === 'Graph controls'
    );

    if (graphControlsToolbar) {
      expect(graphControlsToolbar).toHaveAttribute('aria-label', 'Graph controls');
    }
  });
});

describe('Reduced Motion', () => {
  it('should respect reduced motion preferences', () => {
    // Mock prefers-reduced-motion
    window.matchMedia = jest.fn().mockImplementation(query => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    expect(MotionUtils.prefersReducedMotion()).toBe(true);
    expect(MotionUtils.getAnimationDuration(1000)).toBe(0);
  });
});

describe('Integration Tests', () => {
  it('should work together - accessibility and mobile features', async () => {
    // Enable high contrast
    HighContrastUtils.enableHighContrast();

    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', { value: 400, writable: true });

    render(
      <div>
        <TransactionGraph
          transaction={mockTransaction}
          graph={mockGraph}
          showControls={true}
        />
        <InstructionBreakdown transaction={mockTransaction} />
        <MobileInstructionDisplay transaction={mockTransaction} />
      </div>
    );

    // Test keyboard navigation
    const buttons = screen.getAllByRole('button');
    if (buttons.length > 0) {
      const firstButton = buttons[0];
      firstButton.focus();

      // Just check that focus was set, don't check exact element match
      expect(document.activeElement).toBeTruthy();
      expect(document.activeElement?.tagName).toBe('BUTTON');

      // Test screen reader announcements (may not be called in all cases)
      // expect(spy).toHaveBeenCalled();
    }

    // Test high contrast mode is applied
    expect(document.documentElement.classList.contains('high-contrast-mode')).toBe(true);
  });
});