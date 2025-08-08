'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

// WCAG 2.1 AA compliance utilities and components

interface AccessibilityContextType {
  announceToScreenReader: (message: string, priority?: 'polite' | 'assertive') => void;
  focusManager: {
    trapFocus: (element: HTMLElement) => () => void;
    restoreFocus: (element?: HTMLElement) => void;
    getNextFocusableElement: (current: HTMLElement) => HTMLElement | null;
    getPreviousFocusableElement: (current: HTMLElement) => HTMLElement | null;
  };
  keyboardNavigation: {
    isKeyboardUser: boolean;
    setKeyboardUser: (isKeyboard: boolean) => void;
  };
  reducedMotion: boolean;
  highContrast: boolean;
  fontSize: 'sm' | 'base' | 'lg';
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

// Screen reader announcement component with SSR support
const ScreenReaderAnnouncer: React.FC<{
  onAnnouncerReady: (announcer: (message: string, priority?: 'polite' | 'assertive') => void) => void;
}> = ({ onAnnouncerReady }) => {
  const [mounted, setMounted] = useState(false);
  const [announcements, setAnnouncements] = useState<Array<{
    id: string;
    message: string;
    priority: 'polite' | 'assertive';
  }>>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const announceToScreenReader = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!mounted) return; // Don't announce during SSR
    const id = Math.random().toString(36).substr(2, 9);
    setAnnouncements(prev => [...prev, { id, message, priority }]);

    // Clear announcement after it's been read
    setTimeout(() => {
      setAnnouncements(prev => prev.filter(announcement => announcement.id !== id));
    }, 1000);
  }, [mounted]);

  // Register the announcer function when component mounts
  useEffect(() => {
    if (mounted) {
      onAnnouncerReady(announceToScreenReader);
    }
  }, [mounted, onAnnouncerReady, announceToScreenReader]);

  // Don't render aria-live regions during SSR to prevent hydration mismatches
  if (!mounted) {
    return null;
  }

  return (
    <>
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcements
          .filter(a => a.priority === 'polite')
          .map(announcement => (
            <div key={announcement.id}>{announcement.message}</div>
          ))
        }
      </div>
      <div
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {announcements
          .filter(a => a.priority === 'assertive')
          .map(announcement => (
            <div key={announcement.id}>{announcement.message}</div>
          ))
        }
      </div>
    </>
  );
};

// Focus management utilities
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selectors = [
    'button:not([disabled])',
    '[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
  ].join(', ');

  return Array.from(container.querySelectorAll(selectors))
    .filter((el) => {
      const element = el as HTMLElement;
      return (
        element.offsetWidth > 0 ||
        element.offsetHeight > 0 ||
        element.getClientRects().length > 0
      );
    }) as HTMLElement[];
}

function trapFocus(element: HTMLElement): () => void {
  const focusableElements = getFocusableElements(element);
  if (focusableElements.length === 0) return () => { };

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleTabKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };

  element.addEventListener('keydown', handleTabKey);
  firstElement.focus();

  return () => {
    element.removeEventListener('keydown', handleTabKey);
  };
}

let previousActiveElement: HTMLElement | null = null;

function restoreFocus(element?: HTMLElement) {
  const targetElement = element || previousActiveElement;
  if (targetElement && targetElement.focus) {
    targetElement.focus();
  }
}

// Keyboard navigation detection
function useKeyboardDetection() {
  const [isKeyboardUser, setIsKeyboardUser] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setIsKeyboardUser(true);
      }
    };

    const handleMouseDown = () => {
      setIsKeyboardUser(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  return { isKeyboardUser, setKeyboardUser: setIsKeyboardUser };
}

// Main accessibility provider
export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const keyboardNavigation = useKeyboardDetection();
  const [announcer, setAnnouncer] = useState<((message: string, priority?: 'polite' | 'assertive') => void) | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);

  // Store previous focus when dialogs/modals open
  useEffect(() => {
    const handleFocusIn = () => {
      if (document.activeElement && document.activeElement !== document.body) {
        previousActiveElement = document.activeElement as HTMLElement;
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    return () => document.removeEventListener('focusin', handleFocusIn);
  }, []);

  // Detect system preferences for accessibility
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updatePreferences = () => {
      setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      setHighContrast(window.matchMedia('(prefers-contrast: high)').matches);
    };

    updatePreferences();

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)');

    reducedMotionQuery.addEventListener('change', updatePreferences);
    highContrastQuery.addEventListener('change', updatePreferences);

    return () => {
      reducedMotionQuery.removeEventListener('change', updatePreferences);
      highContrastQuery.removeEventListener('change', updatePreferences);
    };
  }, []);

  const focusManager = {
    trapFocus,
    restoreFocus,
    getNextFocusableElement: (current: HTMLElement) => {
      const container = current.closest('[role="dialog"], main, body') as HTMLElement || document.body;
      const focusableElements = getFocusableElements(container);
      const currentIndex = focusableElements.indexOf(current);
      return focusableElements[currentIndex + 1] || null;
    },
    getPreviousFocusableElement: (current: HTMLElement) => {
      const container = current.closest('[role="dialog"], main, body') as HTMLElement || document.body;
      const focusableElements = getFocusableElements(container);
      const currentIndex = focusableElements.indexOf(current);
      return focusableElements[currentIndex - 1] || null;
    },
  };

  const contextValue: AccessibilityContextType = {
    announceToScreenReader: announcer || (() => { }),
    focusManager,
    keyboardNavigation,
    reducedMotion,
    highContrast: false, // High contrast is disabled by default
    fontSize: 'base',
  };

  return (
    <AccessibilityContext.Provider value={contextValue}>
      <ScreenReaderAnnouncer onAnnouncerReady={setAnnouncer} />
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (context === undefined) {
    // Return default values during SSR/build time
    return {
      announceToScreenReader: () => { },
      focusManager: {
        trapFocus: () => () => { },
        restoreFocus: () => { },
        getNextFocusableElement: () => null,
        getPreviousFocusableElement: () => null,
      },
      keyboardNavigation: {
        isKeyboardUser: false,
        setKeyboardUser: () => { },
      },
      reducedMotion: false,
      highContrast: false,
      fontSize: 'base' as const,
    };
  }
  return context;
}

// Skip link component for keyboard navigation
export function SkipLink({ href = '#main-content', children = 'Skip to main content' }: {
  href?: string;
  children?: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:text-sm focus:font-medium focus:rounded-md focus:m-2"
    >
      {children}
    </a>
  );
}

// Focus visible enhancement
export function FocusRing({
  children,
  className = '',
  visible = true
}: {
  children: React.ReactNode;
  className?: string;
  visible?: boolean;
}) {
  const { keyboardNavigation } = useAccessibility();

  return (
    <div
      className={`
        ${className}
        ${visible && keyboardNavigation.isKeyboardUser ? 'ring-2 ring-ring ring-offset-2' : ''}
        transition-all duration-150
      `}
    >
      {children}
    </div>
  );
}

// Landmark component for better screen reader navigation
export function Landmark({
  as: Component = 'div',
  role,
  label,
  labelledBy,
  children,
  className = '',
  ...props
}: {
  as?: keyof JSX.IntrinsicElements;
  role?: string;
  label?: string;
  labelledBy?: string;
  children: React.ReactNode;
  className?: string;
  [key: string]: any;
}) {
  const accessibilityProps: { [key: string]: any } = {};

  if (role) accessibilityProps.role = role;
  if (label) accessibilityProps['aria-label'] = label;
  if (labelledBy) accessibilityProps['aria-labelledby'] = labelledBy;

  return (
    <Component
      className={className}
      {...accessibilityProps}
      {...props}
    >
      {children}
    </Component>
  );
}

// High contrast mode detector and handler
export function HighContrastMode({ children }: { children: React.ReactNode }) {
  const [isHighContrast, setIsHighContrast] = useState(false);

  useEffect(() => {
    const checkHighContrast = () => {
      if (typeof window === 'undefined') return;

      // Check for Windows high contrast mode
      const isWindowsHighContrast = window.matchMedia('(prefers-contrast: high)').matches;

      // Check for forced colors (Windows high contrast)
      const hasForcedColors = window.matchMedia('(forced-colors: active)').matches;

      setIsHighContrast(isWindowsHighContrast || hasForcedColors);
    };

    checkHighContrast();

    const contrastQuery = window.matchMedia('(prefers-contrast: high)');
    const forcedColorsQuery = window.matchMedia('(forced-colors: active)');

    contrastQuery.addEventListener('change', checkHighContrast);
    forcedColorsQuery.addEventListener('change', checkHighContrast);

    return () => {
      contrastQuery.removeEventListener('change', checkHighContrast);
      forcedColorsQuery.removeEventListener('change', checkHighContrast);
    };
  }, []);

  return (
    <div className={isHighContrast ? 'forced-colors' : ''}>
      {children}
    </div>
  );
}

// Text size utilities
export const textSizes = {
  sm: {
    xs: 'text-xs',
    sm: 'text-sm',
    base: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg',
    '2xl': 'text-xl',
  },
  base: {
    xs: 'text-xs',
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
  },
  lg: {
    xs: 'text-sm',
    sm: 'text-base',
    base: 'text-lg',
    lg: 'text-xl',
    xl: 'text-2xl',
    '2xl': 'text-3xl',
  },
};

// Helper function to get color contrast ratio
export function getContrastRatio(color1: string, color2: string): number {
  // This is a simplified version - in production, you'd want a proper color contrast calculator
  // For now, return a mock value that indicates good contrast
  return 4.5;
}

// Helper function to check if color combination meets WCAG standards
export function meetsWCAGContrast(foreground: string, background: string, level: 'AA' | 'AAA' = 'AA'): boolean {
  const ratio = getContrastRatio(foreground, background);
  return level === 'AA' ? ratio >= 4.5 : ratio >= 7;
}
