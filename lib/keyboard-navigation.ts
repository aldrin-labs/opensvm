/**
 * Keyboard Navigation Utility
 * Provides consistent keyboard accessibility across the platform
 */

/**
 * Focus trap for modal dialogs and dropdowns
 */
export function createFocusTrap(container: HTMLElement): () => void {
  const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    
    const focusableElements = Array.from(container.querySelectorAll(focusableSelector)) as HTMLElement[];
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        lastElement?.focus();
        e.preventDefault();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        firstElement?.focus();
        e.preventDefault();
      }
    }
  };
  
  container.addEventListener('keydown', handleKeyDown);
  
  // Focus first element
  const focusableElements = container.querySelectorAll(focusableSelector);
  (focusableElements[0] as HTMLElement)?.focus();
  
  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Handle escape key to close modals/dropdowns
 */
export function handleEscapeKey(callback: () => void): () => void {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      callback();
    }
  };
  
  document.addEventListener('keydown', handleKeyDown);
  
  return () => {
    document.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Arrow key navigation for lists and grids
 */
export interface ArrowNavigationOptions {
  items: HTMLElement[];
  currentIndex: number;
  onIndexChange: (newIndex: number) => void;
  orientation?: 'vertical' | 'horizontal' | 'grid';
  gridColumns?: number;
  loop?: boolean;
}

export function setupArrowNavigation({
  items,
  currentIndex,
  onIndexChange,
  orientation = 'vertical',
  gridColumns = 3,
  loop = true,
}: ArrowNavigationOptions): () => void {
  const handleKeyDown = (e: KeyboardEvent) => {
    let newIndex = currentIndex;
    
    switch (e.key) {
      case 'ArrowUp':
        if (orientation === 'vertical' || orientation === 'grid') {
          newIndex = orientation === 'grid' 
            ? currentIndex - gridColumns 
            : currentIndex - 1;
          e.preventDefault();
        }
        break;
      
      case 'ArrowDown':
        if (orientation === 'vertical' || orientation === 'grid') {
          newIndex = orientation === 'grid' 
            ? currentIndex + gridColumns 
            : currentIndex + 1;
          e.preventDefault();
        }
        break;
      
      case 'ArrowLeft':
        if (orientation === 'horizontal' || orientation === 'grid') {
          newIndex = currentIndex - 1;
          e.preventDefault();
        }
        break;
      
      case 'ArrowRight':
        if (orientation === 'horizontal' || orientation === 'grid') {
          newIndex = currentIndex + 1;
          e.preventDefault();
        }
        break;
      
      case 'Home':
        newIndex = 0;
        e.preventDefault();
        break;
      
      case 'End':
        newIndex = items.length - 1;
        e.preventDefault();
        break;
      
      default:
        return;
    }
    
    // Handle looping
    if (loop) {
      if (newIndex < 0) newIndex = items.length - 1;
      if (newIndex >= items.length) newIndex = 0;
    } else {
      // Clamp to valid range
      newIndex = Math.max(0, Math.min(items.length - 1, newIndex));
    }
    
    // Only update if index changed and is valid
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < items.length) {
      onIndexChange(newIndex);
      items[newIndex]?.focus();
    }
  };
  
  document.addEventListener('keydown', handleKeyDown);
  
  return () => {
    document.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Announce to screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
  if (typeof document === 'undefined') return;
  
  const announcement = document.createElement('div');
  announcement.setAttribute('role', priority === 'assertive' ? 'alert' : 'status');
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

/**
 * Skip to main content link for keyboard users
 */
export function setupSkipLink() {
  if (typeof document === 'undefined') return;
  
  const existingSkipLink = document.getElementById('skip-to-content');
  if (existingSkipLink) return;
  
  const skipLink = document.createElement('a');
  skipLink.id = 'skip-to-content';
  skipLink.href = '#main-content';
  skipLink.textContent = 'Skip to main content';
  skipLink.className = 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md';
  
  document.body.insertBefore(skipLink, document.body.firstChild);
}

/**
 * Keyboard shortcut manager
 */
export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  handler: (e: KeyboardEvent) => void;
  description?: string;
}

export class KeyboardShortcutManager {
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private handleKeyDown: (e: KeyboardEvent) => void;
  
  constructor() {
    this.handleKeyDown = (e: KeyboardEvent) => {
      const key = this.getShortcutKey(e);
      const shortcut = this.shortcuts.get(key);
      
      if (shortcut) {
        // Don't trigger if user is typing in an input
        if (e.target instanceof HTMLInputElement || 
            e.target instanceof HTMLTextAreaElement ||
            e.target instanceof HTMLSelectElement) {
          return;
        }
        
        e.preventDefault();
        shortcut.handler(e);
      }
    };
  }
  
  private getShortcutKey(e: KeyboardEvent): string {
    const parts = [];
    if (e.ctrlKey) parts.push('ctrl');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');
    if (e.metaKey) parts.push('meta');
    parts.push(e.key.toLowerCase());
    return parts.join('+');
  }
  
  register(shortcut: KeyboardShortcut): () => void {
    const parts = [];
    if (shortcut.ctrl) parts.push('ctrl');
    if (shortcut.shift) parts.push('shift');
    if (shortcut.alt) parts.push('alt');
    if (shortcut.meta) parts.push('meta');
    parts.push(shortcut.key.toLowerCase());
    const key = parts.join('+');
    
    this.shortcuts.set(key, shortcut);
    
    return () => {
      this.shortcuts.delete(key);
    };
  }
  
  start(): () => void {
    document.addEventListener('keydown', this.handleKeyDown);
    return () => this.stop();
  }
  
  stop() {
    document.removeEventListener('keydown', this.handleKeyDown);
  }
  
  getShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }
}
