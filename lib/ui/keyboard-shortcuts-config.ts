/**
 * Keyboard Shortcuts Configuration
 * Manages customizable keyboard shortcuts with localStorage persistence
 */

import { safeStorage, safeJsonParse } from './safe-storage';

export interface ShortcutAction {
  id: string;
  name: string;
  description: string;
  category: 'navigation' | 'panels' | 'trading' | 'general';
  defaultKey: string;
  customKey?: string;
}

export const DEFAULT_SHORTCUTS: ShortcutAction[] = [
  // General
  {
    id: 'help',
    name: 'Show Shortcuts Help',
    description: 'Display keyboard shortcuts reference',
    category: 'general',
    defaultKey: '?',
  },
  {
    id: 'escape',
    name: 'Close/Restore',
    description: 'Close modals or restore maximized panels',
    category: 'general',
    defaultKey: 'Escape',
  },
  
  // Navigation
  {
    id: 'nav-left',
    name: 'Navigate Left',
    description: 'Move focus to the left panel',
    category: 'navigation',
    defaultKey: 'ArrowLeft',
  },
  {
    id: 'nav-right',
    name: 'Navigate Right',
    description: 'Move focus to the right panel',
    category: 'navigation',
    defaultKey: 'ArrowRight',
  },
  {
    id: 'nav-up',
    name: 'Navigate Up',
    description: 'Move focus to the panel above',
    category: 'navigation',
    defaultKey: 'ArrowUp',
  },
  {
    id: 'nav-down',
    name: 'Navigate Down',
    description: 'Move focus to the panel below',
    category: 'navigation',
    defaultKey: 'ArrowDown',
  },
  
  // Panels
  {
    id: 'toggle-section-1',
    name: 'Toggle Section 1',
    description: 'Expand/collapse first section',
    category: 'panels',
    defaultKey: '1',
  },
  {
    id: 'toggle-section-2',
    name: 'Toggle Section 2',
    description: 'Expand/collapse second section',
    category: 'panels',
    defaultKey: '2',
  },
  {
    id: 'toggle-section-3',
    name: 'Toggle Section 3',
    description: 'Expand/collapse third section',
    category: 'panels',
    defaultKey: '3',
  },
  {
    id: 'toggle-section-4',
    name: 'Toggle Section 4',
    description: 'Expand/collapse fourth section',
    category: 'panels',
    defaultKey: '4',
  },
  {
    id: 'maximize-section-1',
    name: 'Maximize Section 1',
    description: 'Maximize/restore first section',
    category: 'panels',
    defaultKey: 'Shift+1',
  },
  {
    id: 'maximize-section-2',
    name: 'Maximize Section 2',
    description: 'Maximize/restore second section',
    category: 'panels',
    defaultKey: 'Shift+2',
  },
  {
    id: 'maximize-section-3',
    name: 'Maximize Section 3',
    description: 'Maximize/restore third section',
    category: 'panels',
    defaultKey: 'Shift+3',
  },
  {
    id: 'maximize-section-4',
    name: 'Maximize Section 4',
    description: 'Maximize/restore fourth section',
    category: 'panels',
    defaultKey: 'Shift+4',
  },
  
  // Trading
  {
    id: 'maximize-chart',
    name: 'Maximize Chart',
    description: 'Maximize/restore trading chart',
    category: 'trading',
    defaultKey: 'M',
  },
  {
    id: 'toggle-screener',
    name: 'Toggle Screener',
    description: 'Expand/collapse market screener',
    category: 'trading',
    defaultKey: 'S',
  },
  {
    id: 'toggle-ai-chat',
    name: 'Toggle AI Chat',
    description: 'Maximize/restore AI assistant',
    category: 'trading',
    defaultKey: 'C',
  },
];

const STORAGE_KEY = 'opensvm-keyboard-shortcuts';

/**
 * Load custom shortcuts from localStorage
 */
export function loadCustomShortcuts(): Map<string, string> {
  if (typeof window === 'undefined') return new Map();
  
  try {
    const stored = safeStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = safeJsonParse<Record<string, string>>(stored, {});
      return new Map(Object.entries(parsed));
    }
  } catch (error) {
    console.error('Failed to load custom shortcuts:', error);
  }
  
  return new Map();
}

/**
 * Save custom shortcuts to localStorage
 */
export function saveCustomShortcuts(shortcuts: Map<string, string>): void {
  if (typeof window === 'undefined') return;
  
  try {
    const obj = Object.fromEntries(shortcuts);
    safeStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch (error) {
    console.error('Failed to save custom shortcuts:', error);
  }
}

/**
 * Reset shortcuts to defaults
 */
export function resetShortcuts(): void {
  if (typeof window === 'undefined') return;
  
  try {
    safeStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to reset shortcuts:', error);
  }
}

/**
 * Get effective shortcut key (custom or default)
 */
export function getShortcutKey(actionId: string): string {
  const customShortcuts = loadCustomShortcuts();
  const customKey = customShortcuts.get(actionId);
  
  if (customKey) return customKey;
  
  const action = DEFAULT_SHORTCUTS.find(s => s.id === actionId);
  return action?.defaultKey || '';
}

/**
 * Get all shortcuts with custom overrides applied
 */
export function getAllShortcuts(): ShortcutAction[] {
  const customShortcuts = loadCustomShortcuts();
  
  return DEFAULT_SHORTCUTS.map(shortcut => ({
    ...shortcut,
    customKey: customShortcuts.get(shortcut.id),
  }));
}

/**
 * Validate shortcut key (check for conflicts)
 */
export function validateShortcutKey(
  actionId: string,
  key: string,
  existingShortcuts: ShortcutAction[]
): { valid: boolean; error?: string } {
  if (!key || key.trim() === '') {
    return { valid: false, error: 'Shortcut key cannot be empty' };
  }
  
  // Check for conflicts with other shortcuts
  const conflict = existingShortcuts.find(
    s => s.id !== actionId && (s.customKey || s.defaultKey) === key
  );
  
  if (conflict) {
    return {
      valid: false,
      error: `Conflict with "${conflict.name}"`,
    };
  }
  
  return { valid: true };
}

/**
 * Format key for display (e.g., "Shift+1" -> "⇧1")
 */
export function formatKeyDisplay(key: string): string {
  return key
    .replace('Shift+', '⇧')
    .replace('Ctrl+', '⌃')
    .replace('Alt+', '⌥')
    .replace('Meta+', '⌘')
    .replace('ArrowLeft', '←')
    .replace('ArrowRight', '→')
    .replace('ArrowUp', '↑')
    .replace('ArrowDown', '↓')
    .replace('Escape', 'Esc');
}
