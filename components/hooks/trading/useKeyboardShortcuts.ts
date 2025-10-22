/**
 * useKeyboardShortcuts Hook
 * 
 * Manages keyboard shortcuts for the trading terminal.
 * Provides professional trader keyboard navigation and quick actions.
 * 
 * @module hooks/trading/useKeyboardShortcuts
 */

import { useEffect } from 'react';
import type { TileId } from './useTradingTerminal';

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

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle shortcuts when not typing in an input
      if (
        e.target instanceof HTMLInputElement || 
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Show keyboard shortcuts help
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setShowShortcuts(!showShortcuts);
        return;
      }

      // Toggle sections with number keys (1-4)
      if (e.key >= '1' && e.key <= '4') {
        e.preventDefault();
        const sectionIndex = parseInt(e.key) - 1;
        if (sectionIndex < sections.length) {
          toggleSection(sections[sectionIndex].id);
        }
        return;
      }

      // Maximize/restore tiles with Shift+number
      if (e.shiftKey && e.key >= '1' && e.key <= '4') {
        e.preventDefault();
        const sectionIndex = parseInt(e.key) - 1;
        if (sectionIndex < sections.length) {
          toggleMaximize(sections[sectionIndex].id as TileId);
        }
        return;
      }

      // Maximize chart with 'M' key
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMaximize('chart');
        return;
      }

      // Toggle screener with 'S' key
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        setScreenerExpanded(!screenerExpanded);
        return;
      }

      // Toggle AI Chat with 'C' key
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        toggleMaximize('aichat');
        return;
      }

      // Focus navigation with arrow keys
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        navigateTiles(e.key as 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown');
        return;
      }

      // Restore all with Escape
      if (e.key === 'Escape') {
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
  ]);
};

export default useKeyboardShortcuts;
