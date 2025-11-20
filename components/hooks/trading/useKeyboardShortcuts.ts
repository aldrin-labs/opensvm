/**
 * useKeyboardShortcuts Hook
 * 
 * Manages keyboard shortcuts for the trading terminal.
 * Provides professional trader keyboard navigation and quick actions.
 * Supports customizable shortcuts via localStorage.
 * 
 * @module hooks/trading/useKeyboardShortcuts
 */

import { useEffect, useState } from 'react';
import type { TileId } from './useTradingTerminal';
import { getShortcutKey } from '@/lib/ui/keyboard-shortcuts-config';

export interface KeyboardShortcutsConfig {
  maximizedTile: TileId | null;
  showShortcuts: boolean;
  screenerExpanded: boolean;
  sections: Array<{ id: string; name: string }>;
  
  // Callback functions
  setShowShortcuts: (show: boolean) => void;
  toggleSection: (sectionId: string) => void;
  toggleMaximize: (tileId: TileId) => void;
  setScreenerExpanded: (expanded: boolean) => void;
  navigateTiles: (direction: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown') => void;
}

/**
 * Available keyboard shortcuts:
 * 
 * - `?` or `Shift+/`: Show/hide keyboard shortcuts help
 * - `1-4`: Toggle sections 1-4
 * - `Shift+1-4`: Maximize/restore sections 1-4
 * - `M`: Maximize/restore chart
 * - `S`: Toggle screener
 * - `C`: Toggle AI chat
 * - `Arrow keys`: Navigate between tiles
 * - `Escape`: Restore all / close modals
 * 
 * @param config - Configuration object with state and callbacks
 * 
 * @example
 * ```tsx
 * useKeyboardShortcuts({
 *   maximizedTile,
 *   showShortcuts,
 *   screenerExpanded,
 *   sections,
 *   setShowShortcuts,
 *   toggleSection,
 *   toggleMaximize,
 *   setScreenerExpanded,
 *   navigateTiles,
 * });
 * ```
 */
export const useKeyboardShortcuts = (config: KeyboardShortcutsConfig): void => {
  const {
    maximizedTile,
    showShortcuts,
    screenerExpanded,
    sections,
    setShowShortcuts,
    toggleSection,
    toggleMaximize,
    setScreenerExpanded,
    navigateTiles,
  } = config;

  // Load custom shortcuts on mount and when settings change
  const [shortcuts, setShortcuts] = useState<Record<string, string>>({});

  useEffect(() => {
    // Load shortcuts from config
    const loadShortcuts = () => {
      setShortcuts({
        help: getShortcutKey('help'),
        escape: getShortcutKey('escape'),
        navLeft: getShortcutKey('nav-left'),
        navRight: getShortcutKey('nav-right'),
        navUp: getShortcutKey('nav-up'),
        navDown: getShortcutKey('nav-down'),
        toggleSection1: getShortcutKey('toggle-section-1'),
        toggleSection2: getShortcutKey('toggle-section-2'),
        toggleSection3: getShortcutKey('toggle-section-3'),
        toggleSection4: getShortcutKey('toggle-section-4'),
        maximizeSection1: getShortcutKey('maximize-section-1'),
        maximizeSection2: getShortcutKey('maximize-section-2'),
        maximizeSection3: getShortcutKey('maximize-section-3'),
        maximizeSection4: getShortcutKey('maximize-section-4'),
        maximizeChart: getShortcutKey('maximize-chart'),
        toggleScreener: getShortcutKey('toggle-screener'),
        toggleAiChat: getShortcutKey('toggle-ai-chat'),
      });
    };

    loadShortcuts();

    // Listen for storage changes (when settings are saved)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'opensvm-keyboard-shortcuts') {
        loadShortcuts();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    const matchesKey = (e: KeyboardEvent, shortcutKey: string): boolean => {
      const parts = shortcutKey.split('+');
      const key = parts[parts.length - 1];
      const hasShift = parts.includes('Shift');
      const hasCtrl = parts.includes('Ctrl');
      const hasAlt = parts.includes('Alt');
      const hasMeta = parts.includes('Meta');

      return (
        e.key.toUpperCase() === key.toUpperCase() &&
        e.shiftKey === hasShift &&
        e.ctrlKey === hasCtrl &&
        e.altKey === hasAlt &&
        e.metaKey === hasMeta
      );
    };

    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle shortcuts when not typing in an input
      if (
        e.target instanceof HTMLInputElement || 
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Show keyboard shortcuts help
      if (matchesKey(e, shortcuts.help)) {
        e.preventDefault();
        setShowShortcuts(!showShortcuts);
        return;
      }

      // Toggle sections with configured keys
      if (matchesKey(e, shortcuts.toggleSection1)) {
        e.preventDefault();
        if (sections.length > 0) toggleSection(sections[0].id);
        return;
      }
      if (matchesKey(e, shortcuts.toggleSection2)) {
        e.preventDefault();
        if (sections.length > 1) toggleSection(sections[1].id);
        return;
      }
      if (matchesKey(e, shortcuts.toggleSection3)) {
        e.preventDefault();
        if (sections.length > 2) toggleSection(sections[2].id);
        return;
      }
      if (matchesKey(e, shortcuts.toggleSection4)) {
        e.preventDefault();
        if (sections.length > 3) toggleSection(sections[3].id);
        return;
      }

      // Maximize/restore tiles with configured keys
      if (matchesKey(e, shortcuts.maximizeSection1)) {
        e.preventDefault();
        if (sections.length > 0) toggleMaximize(sections[0].id as TileId);
        return;
      }
      if (matchesKey(e, shortcuts.maximizeSection2)) {
        e.preventDefault();
        if (sections.length > 1) toggleMaximize(sections[1].id as TileId);
        return;
      }
      if (matchesKey(e, shortcuts.maximizeSection3)) {
        e.preventDefault();
        if (sections.length > 2) toggleMaximize(sections[2].id as TileId);
        return;
      }
      if (matchesKey(e, shortcuts.maximizeSection4)) {
        e.preventDefault();
        if (sections.length > 3) toggleMaximize(sections[3].id as TileId);
        return;
      }

      // Maximize chart with configured key
      if (matchesKey(e, shortcuts.maximizeChart)) {
        e.preventDefault();
        toggleMaximize('chart');
        return;
      }

      // Toggle screener with configured key
      if (matchesKey(e, shortcuts.toggleScreener)) {
        e.preventDefault();
        setScreenerExpanded(!screenerExpanded);
        return;
      }

      // Toggle AI Chat with configured key
      if (matchesKey(e, shortcuts.toggleAiChat)) {
        e.preventDefault();
        toggleMaximize('aichat');
        return;
      }

      // Focus navigation with configured arrow keys
      if (matchesKey(e, shortcuts.navLeft)) {
        e.preventDefault();
        navigateTiles('ArrowLeft');
        return;
      }
      if (matchesKey(e, shortcuts.navRight)) {
        e.preventDefault();
        navigateTiles('ArrowRight');
        return;
      }
      if (matchesKey(e, shortcuts.navUp)) {
        e.preventDefault();
        navigateTiles('ArrowUp');
        return;
      }
      if (matchesKey(e, shortcuts.navDown)) {
        e.preventDefault();
        navigateTiles('ArrowDown');
        return;
      }

      // Restore all with Escape
      if (matchesKey(e, shortcuts.escape)) {
        if (maximizedTile) {
          toggleMaximize(maximizedTile);
        } else if (showShortcuts) {
          setShowShortcuts(false);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    
    // Cleanup event listener on unmount
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [
    maximizedTile,
    showShortcuts,
    screenerExpanded,
    sections,
    setShowShortcuts,
    toggleSection,
    toggleMaximize,
    setScreenerExpanded,
    navigateTiles,
    shortcuts,
  ]);
};

export default useKeyboardShortcuts;
