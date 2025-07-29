/**
 * Accessibility utilities for transaction explorer components
 */

import React from 'react';

// Keyboard navigation constants
export const KEYBOARD_KEYS = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
  PAGE_UP: 'PageUp',
  PAGE_DOWN: 'PageDown'
} as const;

// ARIA live region types
export const LIVE_REGIONS = {
  POLITE: 'polite',
  ASSERTIVE: 'assertive',
  OFF: 'off'
} as const;

// Focus management utilities
export class FocusManager {
  private static focusableSelectors = [
    'button:not([disabled])',
    '[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]'
  ].join(', ');

  static getFocusableElements(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll(this.focusableSelectors));
  }

  static getFirstFocusableElement(container: HTMLElement): HTMLElement | null {
    const elements = this.getFocusableElements(container);
    return elements[0] || null;
  }

  static getLastFocusableElement(container: HTMLElement): HTMLElement | null {
    const elements = this.getFocusableElements(container);
    return elements[elements.length - 1] || null;
  }

  static trapFocus(container: HTMLElement, event: KeyboardEvent): void {
    if (event.key !== KEYBOARD_KEYS.TAB) return;

    const focusableElements = this.getFocusableElements(container);
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  }

  static moveFocus(
    container: HTMLElement,
    direction: 'next' | 'previous' | 'first' | 'last'
  ): void {
    const focusableElements = this.getFocusableElements(container);
    if (focusableElements.length === 0) return;

    const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement);

    let targetIndex: number;
    switch (direction) {
      case 'next':
        targetIndex = currentIndex < focusableElements.length - 1 ? currentIndex + 1 : 0;
        break;
      case 'previous':
        targetIndex = currentIndex > 0 ? currentIndex - 1 : focusableElements.length - 1;
        break;
      case 'first':
        targetIndex = 0;
        break;
      case 'last':
        targetIndex = focusableElements.length - 1;
        break;
      default:
        return;
    }

    focusableElements[targetIndex]?.focus();
  }
}

// Screen reader utilities
export class ScreenReaderUtils {
  static announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;

    document.body.appendChild(announcement);

    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }

  static createScreenReaderOnlyText(text: string): string {
    return `<span class="sr-only">${text}</span>`;
  }

  static formatForScreenReader(value: any, type: 'currency' | 'number' | 'percentage' | 'address'): string {
    switch (type) {
      case 'currency':
        return `${Math.abs(Number(value))} SOL ${Number(value) >= 0 ? 'received' : 'sent'}`;
      case 'number':
        return Number(value).toLocaleString();
      case 'percentage':
        return `${Number(value).toFixed(2)} percent`;
      case 'address':
        return `Address ${String(value).replace(/(.{4})/g, '$1 ')}`;
      default:
        return String(value);
    }
  }
}

// High contrast mode utilities
export class HighContrastUtils {
  private static readonly HIGH_CONTRAST_CLASS = 'high-contrast-mode';
  private static readonly STORAGE_KEY = 'opensvm-high-contrast';

  static isHighContrastEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(this.STORAGE_KEY) === 'true' ||
      window.matchMedia('(prefers-contrast: high)').matches;
  }

  static enableHighContrast(): void {
    if (typeof window === 'undefined') return;
    document.documentElement.classList.add(this.HIGH_CONTRAST_CLASS);
    localStorage.setItem(this.STORAGE_KEY, 'true');
  }

  static disableHighContrast(): void {
    if (typeof window === 'undefined') return;
    document.documentElement.classList.remove(this.HIGH_CONTRAST_CLASS);
    localStorage.setItem(this.STORAGE_KEY, 'false');
  }

  static toggleHighContrast(): boolean {
    const isEnabled = this.isHighContrastEnabled();
    if (isEnabled) {
      this.disableHighContrast();
    } else {
      this.enableHighContrast();
    }
    return !isEnabled;
  }

  static getHighContrastColors() {
    return {
      background: '#000000',
      foreground: '#ffffff',
      primary: '#ffff00',
      secondary: '#00ffff',
      accent: '#ff00ff',
      muted: '#808080',
      border: '#ffffff',
      destructive: '#ff0000',
      success: '#00ff00',
      warning: '#ffff00'
    };
  }
}

// Keyboard navigation hook
export function useKeyboardNavigation(
  containerRef: React.RefObject<HTMLElement>,
  options: {
    onEscape?: () => void;
    onEnter?: () => void;
    trapFocus?: boolean;
    roving?: boolean;
  } = {}
) {
  const handleKeyDown = React.useCallback((event: KeyboardEvent) => {
    if (!containerRef.current) return;

    switch (event.key) {
      case KEYBOARD_KEYS.ESCAPE:
        if (options.onEscape) {
          event.preventDefault();
          options.onEscape();
        }
        break;

      case KEYBOARD_KEYS.ENTER:
        if (options.onEnter) {
          event.preventDefault();
          options.onEnter();
        }
        break;

      case KEYBOARD_KEYS.TAB:
        if (options.trapFocus) {
          FocusManager.trapFocus(containerRef.current, event);
        }
        break;

      case KEYBOARD_KEYS.ARROW_DOWN:
        if (options.roving) {
          event.preventDefault();
          FocusManager.moveFocus(containerRef.current, 'next');
        }
        break;

      case KEYBOARD_KEYS.ARROW_UP:
        if (options.roving) {
          event.preventDefault();
          FocusManager.moveFocus(containerRef.current, 'previous');
        }
        break;

      case KEYBOARD_KEYS.HOME:
        if (options.roving) {
          event.preventDefault();
          FocusManager.moveFocus(containerRef.current, 'first');
        }
        break;

      case KEYBOARD_KEYS.END:
        if (options.roving) {
          event.preventDefault();
          FocusManager.moveFocus(containerRef.current, 'last');
        }
        break;
    }
  }, [containerRef, options]);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleKeyDown]);
}

// Touch-friendly utilities for mobile
export class TouchUtils {
  static readonly MIN_TOUCH_TARGET_SIZE = 44; // 44px minimum touch target

  static isTouchDevice(): boolean {
    return typeof window !== 'undefined' &&
      ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }

  static addTouchFriendlyProps(element: HTMLElement): void {
    if (!this.isTouchDevice()) return;

    // Ensure minimum touch target size
    const rect = element.getBoundingClientRect();
    if (rect.width < this.MIN_TOUCH_TARGET_SIZE || rect.height < this.MIN_TOUCH_TARGET_SIZE) {
      element.style.minWidth = `${this.MIN_TOUCH_TARGET_SIZE}px`;
      element.style.minHeight = `${this.MIN_TOUCH_TARGET_SIZE}px`;
    }

    // Add touch-friendly padding
    element.style.padding = '12px';
  }

  static createTouchFriendlyButton(
    text: string,
    onClick: () => void,
    options: {
      ariaLabel?: string;
      className?: string;
      disabled?: boolean;
    } = {}
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = text;
    button.onclick = onClick;
    button.className = `min-h-[44px] min-w-[44px] p-3 ${options.className || ''}`;

    if (options.ariaLabel) {
      button.setAttribute('aria-label', options.ariaLabel);
    }

    if (options.disabled) {
      button.disabled = true;
      button.setAttribute('aria-disabled', 'true');
    }

    return button;
  }
}

// Reduced motion utilities
export class MotionUtils {
  static prefersReducedMotion(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  static getAnimationDuration(defaultDuration: number): number {
    return this.prefersReducedMotion() ? 0 : defaultDuration;
  }

  static respectMotionPreferences(element: HTMLElement): void {
    if (this.prefersReducedMotion()) {
      element.style.animation = 'none';
      element.style.transition = 'none';
    }
  }
}

// Color contrast utilities
export class ContrastUtils {
  static getContrastRatio(color1: string, color2: string): number {
    const luminance1 = this.getLuminance(color1);
    const luminance2 = this.getLuminance(color2);

    const lighter = Math.max(luminance1, luminance2);
    const darker = Math.min(luminance1, luminance2);

    return (lighter + 0.05) / (darker + 0.05);
  }

  private static getLuminance(color: string): number {
    const rgb = this.hexToRgb(color);
    if (!rgb) return 0;

    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  private static hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  static meetsWCAGAA(foreground: string, background: string): boolean {
    return this.getContrastRatio(foreground, background) >= 4.5;
  }

  static meetsWCAGAAA(foreground: string, background: string): boolean {
    return this.getContrastRatio(foreground, background) >= 7;
  }
}

// Export React hook for accessibility
export function useAccessibility() {
  const [highContrast, setHighContrast] = React.useState(false);
  const [reducedMotion, setReducedMotion] = React.useState(false);

  React.useEffect(() => {
    setHighContrast(HighContrastUtils.isHighContrastEnabled());
    setReducedMotion(MotionUtils.prefersReducedMotion());

    const handleContrastChange = () => setHighContrast(HighContrastUtils.isHighContrastEnabled());
    const handleMotionChange = () => setReducedMotion(MotionUtils.prefersReducedMotion());

    // Listen for system preference changes
    if (typeof window === 'undefined') return () => { };

    const contrastQuery = window.matchMedia('(prefers-contrast: high)');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    contrastQuery.addEventListener('change', handleContrastChange);
    motionQuery.addEventListener('change', handleMotionChange);

    return () => {
      contrastQuery.removeEventListener('change', handleContrastChange);
      motionQuery.removeEventListener('change', handleMotionChange);
    };
  }, []);

  const toggleHighContrast = React.useCallback(() => {
    const newState = HighContrastUtils.toggleHighContrast();
    setHighContrast(newState);
    ScreenReaderUtils.announceToScreenReader(
      `High contrast mode ${newState ? 'enabled' : 'disabled'}`
    );
  }, []);

  const announceToScreenReader = React.useCallback(
    (message: string, priority: 'polite' | 'assertive' = 'polite') => {
      ScreenReaderUtils.announceToScreenReader(message, priority);
    },
    []
  );

  return {
    highContrast,
    reducedMotion,
    toggleHighContrast,
    announceToScreenReader,
    isTouchDevice: TouchUtils.isTouchDevice()
  };
}