/**
 * Unified Accessibility Messaging System
 * 
 * Provides consistent screen reader announcements and accessibility messaging
 * across the entire application. All components should use these utilities
 * for consistent user experience.
 * 
 * @see docs/architecture/development-guidelines.md#accessibility-patterns
 */

/**
 * Message types for different contexts
 */
export enum MessageType {
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
  NAVIGATION = 'navigation',
  ACTION = 'action',
  STATUS = 'status',
  LOADING = 'loading'
}

/**
 * Priority levels for screen reader announcements
 */
export enum AnnouncementPriority {
  POLITE = 'polite',
  ASSERTIVE = 'assertive',
  OFF = 'off'
}

/**
 * Standard message templates for consistent phrasing
 */
const MESSAGE_TEMPLATES = {
  // Navigation messages
  navigation: {
    pageLoaded: (pageName: string) => `${pageName} page loaded`,
    sectionEntered: (sectionName: string) => `Entered ${sectionName} section`,
    tabSelected: (tabName: string) => `${tabName} tab selected`,
    modalOpened: (modalName: string) => `${modalName} dialog opened`,
    modalClosed: (modalName: string) => `${modalName} dialog closed`,
    menuOpened: (menuName: string) => `${menuName} menu opened`,
    menuClosed: (menuName: string) => `${menuName} menu closed`
  },

  // Action messages
  action: {
    copied: (item: string) => `${item} copied to clipboard`,
    saved: (item: string) => `${item} saved successfully`,
    deleted: (item: string) => `${item} deleted successfully`,
    expanded: (item: string) => `${item} expanded`,
    collapsed: (item: string) => `${item} collapsed`,
    selected: (item: string) => `${item} selected`,
    deselected: (item: string) => `${item} deselected`,
    filtered: (count: number, type: string) => `Showing ${count} ${type}${count !== 1 ? 's' : ''}`,
    sorted: (column: string, direction: string) => `Sorted by ${column}, ${direction}ending order`
  },

  // Status messages
  status: {
    loading: (item: string) => `Loading ${item}...`,
    loaded: (item: string, count?: number) =>
      count !== undefined ? `${item} loaded, ${count} items` : `${item} loaded`,
    empty: (item: string) => `No ${item} found`,
    error: (item: string) => `Error loading ${item}`,
    offline: () => 'Application is offline',
    online: () => 'Application is back online',
    connected: (service: string) => `Connected to ${service}`,
    disconnected: (service: string) => `Disconnected from ${service}`
  },

  // Form messages
  form: {
    fieldRequired: (fieldName: string) => `${fieldName} is required`,
    fieldInvalid: (fieldName: string, reason?: string) =>
      `${fieldName} is invalid${reason ? `: ${reason}` : ''}`,
    fieldValid: (fieldName: string) => `${fieldName} is valid`,
    formSubmitted: () => 'Form submitted successfully',
    formError: (errorCount: number) => `Form has ${errorCount} error${errorCount !== 1 ? 's' : ''}`,
    validationComplete: () => 'Form validation complete'
  },

  // Search messages
  search: {
    searching: (query: string) => `Searching for ${query}...`,
    resultsFound: (count: number, query: string) =>
      `Found ${count} result${count !== 1 ? 's' : ''} for ${query}`,
    noResults: (query: string) => `No results found for ${query}`,
    suggestionsAvailable: (count: number) => `${count} suggestion${count !== 1 ? 's' : ''} available`,
    filterApplied: (filterName: string) => `${filterName} filter applied`,
    filterRemoved: (filterName: string) => `${filterName} filter removed`
  },

  // Transaction-specific messages
  transaction: {
    analyzing: () => 'Analyzing transaction...',
    analyzed: () => 'Transaction analysis complete',
    instructionExpanded: (index: number, type: string) =>
      `Instruction ${index + 1} expanded: ${type}`,
    instructionCollapsed: (index: number) => `Instruction ${index + 1} collapsed`,
    accountChangeExpanded: (index: number) => `Account ${index + 1} changes expanded`,
    accountChangeCollapsed: (index: number) => `Account ${index + 1} changes collapsed`,
    riskAssessed: (level: string) => `Transaction risk level: ${level}`,
    graphUpdated: () => 'Transaction graph updated',
    graphFiltered: (nodeCount: number) => `Graph filtered to ${nodeCount} nodes`
  },

  // AI messages
  ai: {
    thinking: () => 'AI is thinking...',
    responding: () => 'AI is responding...',
    responseComplete: () => 'AI response complete',
    analysisStarted: (type: string) => `Starting ${type} analysis...`,
    analysisComplete: (type: string) => `${type} analysis complete`,
    contextUpdated: () => 'AI context updated',
    conversationReset: () => 'Conversation reset'
  },

  // Mobile-specific messages
  mobile: {
    swipeHint: (direction: string, action: string) => `Swipe ${direction} to ${action}`,
    gestureDetected: (gesture: string) => `${gesture} gesture detected`,
    orientationChanged: (orientation: string) => `Screen orientation changed to ${orientation}`,
    keyboardShown: () => 'Virtual keyboard shown',
    keyboardHidden: () => 'Virtual keyboard hidden'
  }
} as const;

/**
 * Accessibility messaging utility class
 */
export class AccessibilityMessenger {
  private static instance: AccessibilityMessenger;
  private liveRegion: HTMLElement | null = null;
  private politeRegion: HTMLElement | null = null;
  private assertiveRegion: HTMLElement | null = null;

  private constructor() {
    this.initializeLiveRegions();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AccessibilityMessenger {
    if (!AccessibilityMessenger.instance) {
      AccessibilityMessenger.instance = new AccessibilityMessenger();
    }
    return AccessibilityMessenger.instance;
  }

  /**
   * Initialize ARIA live regions for announcements
   */
  private initializeLiveRegions(): void {
    if (typeof window === 'undefined') return;

    // Use liveRegion as a general live region for accessibility announcements
    this.liveRegion = document.createElement('div');
    this.liveRegion.setAttribute('aria-live', 'polite');
    this.liveRegion.setAttribute('aria-atomic', 'true');
    this.liveRegion.setAttribute('class', 'sr-only');
    this.liveRegion.setAttribute('id', 'general-announcements');
    document.body.appendChild(this.liveRegion);
    console.log('Initialized general live region for accessibility:', this.liveRegion);

    // Create polite live region
    this.politeRegion = document.createElement('div');
    this.politeRegion.setAttribute('aria-live', 'polite');
    this.politeRegion.setAttribute('aria-atomic', 'true');
    this.politeRegion.setAttribute('class', 'sr-only');
    this.politeRegion.setAttribute('id', 'polite-announcements');
    document.body.appendChild(this.politeRegion);

    // Create assertive live region
    this.assertiveRegion = document.createElement('div');
    this.assertiveRegion.setAttribute('aria-live', 'assertive');
    this.assertiveRegion.setAttribute('aria-atomic', 'true');
    this.assertiveRegion.setAttribute('class', 'sr-only');
    this.assertiveRegion.setAttribute('id', 'assertive-announcements');
    document.body.appendChild(this.assertiveRegion);
  }

  /**
   * Announce message to screen readers
   */
  announce(
    message: string,
    priority: AnnouncementPriority = AnnouncementPriority.POLITE,
    delay: number = 100
  ): void {
    if (typeof window === 'undefined') return;

    const region = priority === AnnouncementPriority.ASSERTIVE
      ? this.assertiveRegion
      : this.politeRegion;

    if (!region) return;

    // Clear previous message
    region.textContent = '';

    // Set new message after a brief delay to ensure screen readers pick it up
    setTimeout(() => {
      region.textContent = message;

      // Clear message after announcement to avoid repetition
      setTimeout(() => {
        region.textContent = '';
      }, 1000);
    }, delay);
  }

  /**
   * Navigation-related announcements
   */
  navigation = {
    pageLoaded: (pageName: string) =>
      this.announce(MESSAGE_TEMPLATES.navigation.pageLoaded(pageName)),

    sectionEntered: (sectionName: string) =>
      this.announce(MESSAGE_TEMPLATES.navigation.sectionEntered(sectionName)),

    tabSelected: (tabName: string) =>
      this.announce(MESSAGE_TEMPLATES.navigation.tabSelected(tabName)),

    modalOpened: (modalName: string) =>
      this.announce(MESSAGE_TEMPLATES.navigation.modalOpened(modalName), AnnouncementPriority.ASSERTIVE),

    modalClosed: (modalName: string) =>
      this.announce(MESSAGE_TEMPLATES.navigation.modalClosed(modalName)),

    menuOpened: (menuName: string) =>
      this.announce(MESSAGE_TEMPLATES.navigation.menuOpened(menuName)),

    menuClosed: (menuName: string) =>
      this.announce(MESSAGE_TEMPLATES.navigation.menuClosed(menuName))
  };

  /**
   * Action-related announcements
   */
  action = {
    copied: (item: string) =>
      this.announce(MESSAGE_TEMPLATES.action.copied(item)),

    saved: (item: string) =>
      this.announce(MESSAGE_TEMPLATES.action.saved(item)),

    deleted: (item: string) =>
      this.announce(MESSAGE_TEMPLATES.action.deleted(item)),

    expanded: (item: string) =>
      this.announce(MESSAGE_TEMPLATES.action.expanded(item)),

    collapsed: (item: string) =>
      this.announce(MESSAGE_TEMPLATES.action.collapsed(item)),

    selected: (item: string) =>
      this.announce(MESSAGE_TEMPLATES.action.selected(item)),

    deselected: (item: string) =>
      this.announce(MESSAGE_TEMPLATES.action.deselected(item)),

    filtered: (count: number, type: string) =>
      this.announce(MESSAGE_TEMPLATES.action.filtered(count, type)),

    sorted: (column: string, direction: string) =>
      this.announce(MESSAGE_TEMPLATES.action.sorted(column, direction))
  };

  /**
   * Status-related announcements
   */
  status = {
    loading: (item: string) =>
      this.announce(MESSAGE_TEMPLATES.status.loading(item)),

    loaded: (item: string, count?: number) =>
      this.announce(MESSAGE_TEMPLATES.status.loaded(item, count)),

    empty: (item: string) =>
      this.announce(MESSAGE_TEMPLATES.status.empty(item)),

    error: (item: string) =>
      this.announce(MESSAGE_TEMPLATES.status.error(item), AnnouncementPriority.ASSERTIVE),

    offline: () =>
      this.announce(MESSAGE_TEMPLATES.status.offline(), AnnouncementPriority.ASSERTIVE),

    online: () =>
      this.announce(MESSAGE_TEMPLATES.status.online()),

    connected: (service: string) =>
      this.announce(MESSAGE_TEMPLATES.status.connected(service)),

    disconnected: (service: string) =>
      this.announce(MESSAGE_TEMPLATES.status.disconnected(service), AnnouncementPriority.ASSERTIVE)
  };

  /**
   * Form-related announcements
   */
  form = {
    fieldRequired: (fieldName: string) =>
      this.announce(MESSAGE_TEMPLATES.form.fieldRequired(fieldName), AnnouncementPriority.ASSERTIVE),

    fieldInvalid: (fieldName: string, reason?: string) =>
      this.announce(MESSAGE_TEMPLATES.form.fieldInvalid(fieldName, reason), AnnouncementPriority.ASSERTIVE),

    fieldValid: (fieldName: string) =>
      this.announce(MESSAGE_TEMPLATES.form.fieldValid(fieldName)),

    formSubmitted: () =>
      this.announce(MESSAGE_TEMPLATES.form.formSubmitted()),

    formError: (errorCount: number) =>
      this.announce(MESSAGE_TEMPLATES.form.formError(errorCount), AnnouncementPriority.ASSERTIVE),

    validationComplete: () =>
      this.announce(MESSAGE_TEMPLATES.form.validationComplete())
  };

  /**
   * Search-related announcements
   */
  search = {
    searching: (query: string) =>
      this.announce(MESSAGE_TEMPLATES.search.searching(query)),

    resultsFound: (count: number, query: string) =>
      this.announce(MESSAGE_TEMPLATES.search.resultsFound(count, query)),

    noResults: (query: string) =>
      this.announce(MESSAGE_TEMPLATES.search.noResults(query)),

    suggestionsAvailable: (count: number) =>
      this.announce(MESSAGE_TEMPLATES.search.suggestionsAvailable(count)),

    filterApplied: (filterName: string) =>
      this.announce(MESSAGE_TEMPLATES.search.filterApplied(filterName)),

    filterRemoved: (filterName: string) =>
      this.announce(MESSAGE_TEMPLATES.search.filterRemoved(filterName))
  };

  /**
   * Transaction-specific announcements
   */
  transaction = {
    analyzing: () =>
      this.announce(MESSAGE_TEMPLATES.transaction.analyzing()),

    analyzed: () =>
      this.announce(MESSAGE_TEMPLATES.transaction.analyzed()),

    instructionExpanded: (index: number, type: string) =>
      this.announce(MESSAGE_TEMPLATES.transaction.instructionExpanded(index, type)),

    instructionCollapsed: (index: number) =>
      this.announce(MESSAGE_TEMPLATES.transaction.instructionCollapsed(index)),

    accountChangeExpanded: (index: number) =>
      this.announce(MESSAGE_TEMPLATES.transaction.accountChangeExpanded(index)),

    accountChangeCollapsed: (index: number) =>
      this.announce(MESSAGE_TEMPLATES.transaction.accountChangeCollapsed(index)),

    riskAssessed: (level: string) =>
      this.announce(MESSAGE_TEMPLATES.transaction.riskAssessed(level)),

    graphUpdated: () =>
      this.announce(MESSAGE_TEMPLATES.transaction.graphUpdated()),

    graphFiltered: (nodeCount: number) =>
      this.announce(MESSAGE_TEMPLATES.transaction.graphFiltered(nodeCount))
  };

  /**
   * AI-related announcements
   */
  ai = {
    thinking: () =>
      this.announce(MESSAGE_TEMPLATES.ai.thinking()),

    responding: () =>
      this.announce(MESSAGE_TEMPLATES.ai.responding()),

    responseComplete: () =>
      this.announce(MESSAGE_TEMPLATES.ai.responseComplete()),

    analysisStarted: (type: string) =>
      this.announce(MESSAGE_TEMPLATES.ai.analysisStarted(type)),

    analysisComplete: (type: string) =>
      this.announce(MESSAGE_TEMPLATES.ai.analysisComplete(type)),

    contextUpdated: () =>
      this.announce(MESSAGE_TEMPLATES.ai.contextUpdated()),

    conversationReset: () =>
      this.announce(MESSAGE_TEMPLATES.ai.conversationReset())
  };

  /**
   * Mobile-specific announcements
   */
  mobile = {
    swipeHint: (direction: string, action: string) =>
      this.announce(MESSAGE_TEMPLATES.mobile.swipeHint(direction, action)),

    gestureDetected: (gesture: string) =>
      this.announce(MESSAGE_TEMPLATES.mobile.gestureDetected(gesture)),

    orientationChanged: (orientation: string) =>
      this.announce(MESSAGE_TEMPLATES.mobile.orientationChanged(orientation)),

    keyboardShown: () =>
      this.announce(MESSAGE_TEMPLATES.mobile.keyboardShown()),

    keyboardHidden: () =>
      this.announce(MESSAGE_TEMPLATES.mobile.keyboardHidden())
  };
}

/**
 * Global accessibility messenger instance
 */
export const accessibilityMessenger = AccessibilityMessenger.getInstance();

/**
 * Hook for using accessibility messaging in React components
 */
export function useAccessibilityMessenger() {
  return accessibilityMessenger;
}

/**
 * Utility function for quick announcements
 */
export function announceToScreenReader(
  message: string,
  priority: AnnouncementPriority = AnnouncementPriority.POLITE
): void {
  accessibilityMessenger.announce(message, priority);
}

/**
 * Context-aware announcement helper
 */
export function announceContextualMessage(
  context: keyof typeof MESSAGE_TEMPLATES,
  messageKey: string,
  ...args: any[]
): void {
  const template = (MESSAGE_TEMPLATES as any)[context]?.[messageKey];
  if (typeof template === 'function') {
    const message = template(...args);
    accessibilityMessenger.announce(message);
  }
}