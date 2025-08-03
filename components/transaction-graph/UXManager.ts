'use client';

import { MemoryManager } from './MemoryManager';

// Enhanced UX interfaces
export interface LoadingState {
  isLoading: boolean;
  progress?: number; // 0-100
  message?: string;
  type: 'initial' | 'navigation' | 'data' | 'layout' | 'search';
  startTime: number;
  estimatedDuration?: number;
}

export interface ErrorRecoveryState {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  isRecoverable: boolean;
  recoveryActions: RecoveryAction[];
  userMessage: string;
  technicalDetails: string;
}

export interface RecoveryAction {
  id: string;
  label: string;
  description: string;
  action: () => Promise<void> | void;
  isPrimary: boolean;
  icon?: string;
}

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  description: string;
  action: (event: KeyboardEvent) => void;
  scope?: 'global' | 'graph' | 'navigation';
  preventDefault?: boolean;
}

export interface AccessibilityConfig {
  enableScreenReader: boolean;
  enableHighContrast: boolean;
  enableReducedMotion: boolean;
  enableFocusIndicators: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  colorScheme: 'light' | 'dark' | 'auto';
  announceChanges: boolean;
  keyboardOnlyNavigation: boolean;
}

export interface FocusManager {
  trapFocus: (container: HTMLElement) => () => void;
  restoreFocus: (element: HTMLElement | null) => void;
  getFocusableElements: (container: HTMLElement) => HTMLElement[];
  setFocusToFirst: (container: HTMLElement) => void;
  setFocusToLast: (container: HTMLElement) => void;
}

export interface UXMetrics {
  loadingTimes: Record<string, number>;
  errorCounts: Record<string, number>;
  keyboardUsageCount: number;
  accessibilityViolations: number;
  userInteractions: number;
  taskCompletionRate: number;
}

// Main UX Manager
export class UXManager {
  private static instance: UXManager | null = null;
  private memoryManager = MemoryManager.getInstance();

  // State management
  private loadingStates = new Map<string, LoadingState>();
  private errorStates = new Map<string, ErrorRecoveryState>();
  private keyboardShortcuts = new Map<string, KeyboardShortcut>();
  private accessibilityConfig: AccessibilityConfig = {
    enableScreenReader: false,
    enableHighContrast: false,
    enableReducedMotion: false,
    enableFocusIndicators: true,
    fontSize: 'medium',
    colorScheme: 'auto',
    announceChanges: true,
    keyboardOnlyNavigation: false
  };

  // Focus management
  private focusHistory: HTMLElement[] = [];
  private currentFocusTrap: (() => void) | null = null;
  private lastFocusedElement: HTMLElement | null = null;

  // Performance tracking
  private uxMetrics: UXMetrics = {
    loadingTimes: {},
    errorCounts: {},
    keyboardUsageCount: 0,
    accessibilityViolations: 0,
    userInteractions: 0,
    taskCompletionRate: 0
  };

  // Event handlers
  private eventHandlers = {
    onLoadingStart: (id: string, state: LoadingState) => {},
    onLoadingProgress: (id: string, progress: number) => {},
    onLoadingComplete: (id: string, duration: number) => {},
    onError: (id: string, state: ErrorRecoveryState) => {},
    onErrorRecovered: (id: string, action: string) => {},
    onKeyboardShortcut: (shortcut: KeyboardShortcut, event: KeyboardEvent) => {},
    onAccessibilityViolation: (violation: string, element?: HTMLElement) => {},
    onUserInteraction: (type: string, target?: HTMLElement) => {}
  };

  private constructor() {
    this.initializeAccessibility();
    this.setupKeyboardHandlers();
    this.setupFocusManagement();
    this.detectAccessibilityPreferences();
  }

  static getInstance(): UXManager {
    if (!UXManager.instance) {
      UXManager.instance = new UXManager();
    }
    return UXManager.instance;
  }

  /**
   * Configure event handlers
   */
  setEventHandlers(handlers: Partial<typeof this.eventHandlers>): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  /**
   * Loading state management
   */
  startLoading(
    id: string,
    type: LoadingState['type'],
    message?: string,
    estimatedDuration?: number
  ): void {
    const loadingState: LoadingState = {
      isLoading: true,
      progress: 0,
      message,
      type,
      startTime: Date.now(),
      estimatedDuration
    };

    this.loadingStates.set(id, loadingState);
    this.eventHandlers.onLoadingStart(id, loadingState);

    // Auto-complete if no progress updates after estimated duration
    if (estimatedDuration) {
      this.memoryManager.safeSetTimeout(() => {
        if (this.loadingStates.has(id)) {
          this.completeLoading(id);
        }
      }, estimatedDuration + 1000);
    }
  }

  updateLoadingProgress(id: string, progress: number, message?: string): void {
    const state = this.loadingStates.get(id);
    if (state) {
      state.progress = Math.max(0, Math.min(100, progress));
      if (message) state.message = message;
      
      this.eventHandlers.onLoadingProgress(id, progress);
    }
  }

  completeLoading(id: string): void {
    const state = this.loadingStates.get(id);
    if (state) {
      const duration = Date.now() - state.startTime;
      this.uxMetrics.loadingTimes[state.type] = duration;
      
      this.loadingStates.delete(id);
      this.eventHandlers.onLoadingComplete(id, duration);
    }
  }

  getLoadingState(id: string): LoadingState | null {
    return this.loadingStates.get(id) || null;
  }

  isLoading(id?: string): boolean {
    if (id) {
      return this.loadingStates.has(id);
    }
    return this.loadingStates.size > 0;
  }

  /**
   * Error recovery management
   */
  reportError(
    id: string,
    error: Error,
    severity: ErrorRecoveryState['severity'] = 'medium',
    recoveryActions: RecoveryAction[] = []
  ): void {
    const errorState: ErrorRecoveryState = {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      severity,
      isRecoverable: recoveryActions.length > 0,
      recoveryActions: [
        ...recoveryActions,
        ...this.getDefaultRecoveryActions(error, severity)
      ],
      userMessage: this.generateUserFriendlyMessage(error, severity),
      technicalDetails: `${error.name}: ${error.message}\n${error.stack || ''}`
    };

    this.errorStates.set(id, errorState);
    this.uxMetrics.errorCounts[severity] = (this.uxMetrics.errorCounts[severity] || 0) + 1;
    
    this.eventHandlers.onError(id, errorState);

    // Announce error to screen readers
    if (this.accessibilityConfig.announceChanges) {
      this.announceToScreenReader(errorState.userMessage);
    }
  }

  async executeRecoveryAction(id: string, actionId: string): Promise<void> {
    const errorState = this.errorStates.get(id);
    if (!errorState) return;

    const action = errorState.recoveryActions.find(a => a.id === actionId);
    if (!action) return;

    try {
      await action.action();
      
      // Clear error state on successful recovery
      this.errorStates.delete(id);
      this.eventHandlers.onErrorRecovered(id, actionId);

      // Announce recovery to screen readers
      if (this.accessibilityConfig.announceChanges) {
        this.announceToScreenReader('Error resolved successfully');
      }

    } catch (recoveryError) {
      console.error('Recovery action failed:', recoveryError);
      
      // Update error state with recovery failure
      errorState.userMessage = 'Recovery action failed. Please try another option.';
      errorState.technicalDetails += `\nRecovery error: ${recoveryError}`;
    }
  }

  getErrorState(id: string): ErrorRecoveryState | null {
    return this.errorStates.get(id) || null;
  }

  clearError(id: string): void {
    this.errorStates.delete(id);
  }

  /**
   * Keyboard shortcuts management
   */
  registerKeyboardShortcut(shortcut: KeyboardShortcut): void {
    const key = this.getShortcutKey(shortcut);
    this.keyboardShortcuts.set(key, shortcut);
  }

  unregisterKeyboardShortcut(shortcut: Partial<KeyboardShortcut>): void {
    const key = this.getShortcutKey(shortcut as KeyboardShortcut);
    this.keyboardShortcuts.delete(key);
  }

  /**
   * Accessibility configuration
   */
  updateAccessibilityConfig(config: Partial<AccessibilityConfig>): void {
    this.accessibilityConfig = { ...this.accessibilityConfig, ...config };
    this.applyAccessibilitySettings();
  }

  getAccessibilityConfig(): AccessibilityConfig {
    return { ...this.accessibilityConfig };
  }

  /**
   * Focus management
   */
  createFocusManager(): FocusManager {
    return {
      trapFocus: (container: HTMLElement) => this.trapFocus(container),
      restoreFocus: (element: HTMLElement | null) => this.restoreFocus(element),
      getFocusableElements: (container: HTMLElement) => this.getFocusableElements(container),
      setFocusToFirst: (container: HTMLElement) => this.setFocusToFirst(container),
      setFocusToLast: (container: HTMLElement) => this.setFocusToLast(container)
    };
  }

  /**
   * Screen reader announcements
   */
  announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    if (!this.accessibilityConfig.enableScreenReader) return;

    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.setAttribute('class', 'sr-only');
    announcement.textContent = message;

    document.body.appendChild(announcement);

    // Remove after announcement
    this.memoryManager.safeSetTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }

  /**
   * Accessibility violation reporting
   */
  reportAccessibilityViolation(violation: string, element?: HTMLElement): void {
    this.uxMetrics.accessibilityViolations++;
    this.eventHandlers.onAccessibilityViolation(violation, element);
    
    if (process.env.NODE_ENV === 'development') {
      console.warn('Accessibility violation:', violation, element);
    }
  }

  /**
   * User interaction tracking
   */
  trackUserInteraction(type: string, target?: HTMLElement): void {
    this.uxMetrics.userInteractions++;
    this.eventHandlers.onUserInteraction(type, target);
  }

  /**
   * Private methods
   */
  private initializeAccessibility(): void {
    if (typeof window === 'undefined') return;

    // Set up default ARIA live region
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.setAttribute('class', 'sr-only');
    liveRegion.id = 'ux-live-region';
    document.body.appendChild(liveRegion);

    // Apply initial accessibility settings
    this.applyAccessibilitySettings();
  }

  private setupKeyboardHandlers(): void {
    if (typeof window === 'undefined') return;

    this.memoryManager.safeAddEventListener(
      document,
      'keydown',
      (event: KeyboardEvent) => {
        this.handleKeyboardShortcut(event);
        this.uxMetrics.keyboardUsageCount++;
      },
      undefined,
      'Global keyboard shortcut handler'
    );

    // Register default shortcuts
    this.registerDefaultShortcuts();
  }

  private setupFocusManagement(): void {
    if (typeof window === 'undefined') return;

    // Track focus changes
    this.memoryManager.safeAddEventListener(
      document,
      'focusin',
      (event: FocusEvent) => {
        const target = event.target as HTMLElement;
        if (target && target !== this.lastFocusedElement) {
          this.focusHistory.push(target);
          this.lastFocusedElement = target;
          
          // Keep focus history manageable
          if (this.focusHistory.length > 50) {
            this.focusHistory.shift();
          }
        }
      },
      undefined,
      'Focus tracking'
    );
  }

  private detectAccessibilityPreferences(): void {
    if (typeof window === 'undefined') return;

    // Detect reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.accessibilityConfig.enableReducedMotion = prefersReducedMotion.matches;

    prefersReducedMotion.addListener((e) => {
      this.accessibilityConfig.enableReducedMotion = e.matches;
      this.applyAccessibilitySettings();
    });

    // Detect color scheme preference
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
    if (this.accessibilityConfig.colorScheme === 'auto') {
      this.accessibilityConfig.colorScheme = prefersDarkScheme.matches ? 'dark' : 'light';
    }

    prefersDarkScheme.addListener((e) => {
      if (this.accessibilityConfig.colorScheme === 'auto') {
        this.accessibilityConfig.colorScheme = e.matches ? 'dark' : 'light';
        this.applyAccessibilitySettings();
      }
    });

    // Detect high contrast preference
    const prefersHighContrast = window.matchMedia('(prefers-contrast: high)');
    this.accessibilityConfig.enableHighContrast = prefersHighContrast.matches;
  }

  private applyAccessibilitySettings(): void {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;

    // Apply font size
    root.setAttribute('data-font-size', this.accessibilityConfig.fontSize);

    // Apply color scheme
    root.setAttribute('data-color-scheme', this.accessibilityConfig.colorScheme);

    // Apply high contrast
    if (this.accessibilityConfig.enableHighContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    // Apply reduced motion
    if (this.accessibilityConfig.enableReducedMotion) {
      root.classList.add('reduced-motion');
    } else {
      root.classList.remove('reduced-motion');
    }

    // Apply focus indicators
    if (this.accessibilityConfig.enableFocusIndicators) {
      root.classList.add('focus-indicators');
    } else {
      root.classList.remove('focus-indicators');
    }
  }

  private handleKeyboardShortcut(event: KeyboardEvent): void {
    const shortcutKey = this.getShortcutKey({
      key: event.key,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey
    } as KeyboardShortcut);

    const shortcut = this.keyboardShortcuts.get(shortcutKey);
    if (shortcut) {
      if (shortcut.preventDefault) {
        event.preventDefault();
      }
      
      shortcut.action(event);
      this.eventHandlers.onKeyboardShortcut(shortcut, event);
    }
  }

  private getShortcutKey(shortcut: KeyboardShortcut): string {
    const modifiers = [];
    if (shortcut.ctrlKey) modifiers.push('ctrl');
    if (shortcut.shiftKey) modifiers.push('shift');
    if (shortcut.altKey) modifiers.push('alt');
    if (shortcut.metaKey) modifiers.push('meta');
    
    return [...modifiers, shortcut.key.toLowerCase()].join('+');
  }

  private registerDefaultShortcuts(): void {
    // Navigation shortcuts
    this.registerKeyboardShortcut({
      key: 'Tab',
      description: 'Navigate to next focusable element',
      action: () => {}, // Browser default
      scope: 'global',
      preventDefault: false
    });

    this.registerKeyboardShortcut({
      key: 'Tab',
      shiftKey: true,
      description: 'Navigate to previous focusable element',
      action: () => {}, // Browser default
      scope: 'global',
      preventDefault: false
    });

    // Graph shortcuts
    this.registerKeyboardShortcut({
      key: 'Escape',
      description: 'Close current modal or reset focus',
      action: () => {
        if (this.currentFocusTrap) {
          this.currentFocusTrap();
        }
      },
      scope: 'global'
    });

    this.registerKeyboardShortcut({
      key: 'f',
      ctrlKey: true,
      description: 'Focus search',
      action: (event) => {
        event.preventDefault();
        const searchInput = document.querySelector('[data-search-input]') as HTMLElement;
        if (searchInput) {
          searchInput.focus();
        }
      },
      scope: 'global',
      preventDefault: true
    });
  }

  private trapFocus(container: HTMLElement): () => void {
    const focusableElements = this.getFocusableElements(container);
    if (focusableElements.length === 0) return () => {};

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Store current focus to restore later
    const previouslyFocused = document.activeElement as HTMLElement;

    // Focus first element
    firstElement.focus();

    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    this.memoryManager.safeAddEventListener(
      container,
      'keydown',
      handleTabKey,
      undefined,
      'Focus trap'
    );

    // Return cleanup function
    return () => {
      if (previouslyFocused) {
        previouslyFocused.focus();
      }
      this.currentFocusTrap = null;
    };
  }

  private restoreFocus(element: HTMLElement | null): void {
    if (element) {
      element.focus();
    } else if (this.focusHistory.length > 0) {
      const lastFocused = this.focusHistory[this.focusHistory.length - 1];
      if (document.contains(lastFocused)) {
        lastFocused.focus();
      }
    }
  }

  private getFocusableElements(container: HTMLElement): HTMLElement[] {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(', ');

    return Array.from(container.querySelectorAll(selector)) as HTMLElement[];
  }

  private setFocusToFirst(container: HTMLElement): void {
    const focusableElements = this.getFocusableElements(container);
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
  }

  private setFocusToLast(container: HTMLElement): void {
    const focusableElements = this.getFocusableElements(container);
    if (focusableElements.length > 0) {
      focusableElements[focusableElements.length - 1].focus();
    }
  }

  private generateUserFriendlyMessage(error: Error, severity: ErrorRecoveryState['severity']): string {
    const messages = {
      low: 'Something minor went wrong, but you can continue.',
      medium: 'We encountered an issue. Please try again.',
      high: 'An important feature is temporarily unavailable.',
      critical: 'A serious error occurred. Please refresh the page.'
    };

    return messages[severity] || messages.medium;
  }

  private getDefaultRecoveryActions(error: Error, severity: ErrorRecoveryState['severity']): RecoveryAction[] {
    const actions: RecoveryAction[] = [];

    // Always provide refresh action for high/critical errors
    if (severity === 'high' || severity === 'critical') {
      actions.push({
        id: 'refresh-page',
        label: 'Refresh Page',
        description: 'Reload the page to reset the application',
        action: () => window.location.reload(),
        isPrimary: true,
        icon: 'refresh'
      });
    }

    // Provide retry action for recoverable errors
    if (severity !== 'critical') {
      actions.push({
        id: 'retry',
        label: 'Try Again',
        description: 'Attempt the operation again',
        action: async () => {
          // Generic retry - specific implementations should override
          await new Promise(resolve => setTimeout(resolve, 1000));
        },
        isPrimary: severity === 'low' || severity === 'medium',
        icon: 'retry'
      });
    }

    return actions;
  }

  /**
   * Get UX metrics
   */
  getUXMetrics(): UXMetrics {
    return { ...this.uxMetrics };
  }

  /**
   * Reset UX metrics
   */
  resetUXMetrics(): void {
    this.uxMetrics = {
      loadingTimes: {},
      errorCounts: {},
      keyboardUsageCount: 0,
      accessibilityViolations: 0,
      userInteractions: 0,
      taskCompletionRate: 0
    };
  }

  /**
   * Destroy the manager
   */
  destroy(): void {
    this.loadingStates.clear();
    this.errorStates.clear();
    this.keyboardShortcuts.clear();
    this.focusHistory = [];
    
    if (this.currentFocusTrap) {
      this.currentFocusTrap();
    }
    
    UXManager.instance = null;
  }
}

export default UXManager;