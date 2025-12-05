'use client';

import { useEffect, useCallback, useRef } from 'react';

interface KeyboardShortcutHandlers {
  onNavigateBack?: () => void;
  onNavigateForward?: () => void;
  onGoHome?: () => void;
  onToggleMultiView?: () => void;
  onToggleFullscreen?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitGraph?: () => void;
  onResetView?: () => void;
  onTogglePathFinding?: () => void;
  onEscapePathFinding?: () => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  isPathFindingMode?: boolean;
}

/**
 * Hook for keyboard shortcuts in the graph component
 * Provides power-user navigation and control
 */
export function useGraphKeyboardShortcuts(handlers: KeyboardShortcutHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const h = handlersRef.current;
    const isModKey = event.ctrlKey || event.metaKey;
    const isShiftKey = event.shiftKey;

    // Ignore if user is typing in an input
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      (event.target as HTMLElement)?.isContentEditable
    ) {
      return;
    }

    switch (event.key) {
      // Navigation History
      case '[':
        if (isModKey && h.onNavigateBack) {
          event.preventDefault();
          h.onNavigateBack();
        }
        break;

      case ']':
        if (isModKey && h.onNavigateForward) {
          event.preventDefault();
          h.onNavigateForward();
        }
        break;

      case 'h':
      case 'H':
        if (isModKey && h.onGoHome) {
          event.preventDefault();
          h.onGoHome();
        }
        break;

      // Multi-Account View
      case 'm':
      case 'M':
        if (!isModKey && h.onToggleMultiView) {
          event.preventDefault();
          h.onToggleMultiView();
        }
        break;

      // Fullscreen
      case 'f':
      case 'F':
        if (!isModKey && h.onToggleFullscreen) {
          event.preventDefault();
          h.onToggleFullscreen();
        }
        break;

      // Zoom Controls
      case '+':
      case '=':
        if (isModKey && h.onZoomIn) {
          event.preventDefault();
          h.onZoomIn();
        }
        break;

      case '-':
        if (isModKey && h.onZoomOut) {
          event.preventDefault();
          h.onZoomOut();
        }
        break;

      case '0':
        if (isModKey && h.onFitGraph) {
          event.preventDefault();
          h.onFitGraph();
        }
        break;

      case 'r':
      case 'R':
        if (isModKey && h.onResetView) {
          event.preventDefault();
          h.onResetView();
        }
        break;

      // Path Finding
      case 'p':
      case 'P':
        if (!isModKey && h.onTogglePathFinding) {
          event.preventDefault();
          h.onTogglePathFinding();
        }
        break;

      case 'Escape':
        if (h.isPathFindingMode && h.onEscapePathFinding) {
          event.preventDefault();
          h.onEscapePathFinding();
        }
        break;

      // Selection
      case 'a':
      case 'A':
        if (isModKey && h.onSelectAll) {
          event.preventDefault();
          h.onSelectAll();
        }
        break;

      case 'd':
      case 'D':
        if (isModKey && isShiftKey && h.onDeselectAll) {
          event.preventDefault();
          h.onDeselectAll();
        }
        break;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Return shortcut descriptions for UI display
  const shortcuts = [
    { key: 'Ctrl+[', description: 'Navigate back' },
    { key: 'Ctrl+]', description: 'Navigate forward' },
    { key: 'Ctrl+H', description: 'Go to home/initial view' },
    { key: 'M', description: 'Toggle multi-account view' },
    { key: 'F', description: 'Toggle fullscreen' },
    { key: 'Ctrl++', description: 'Zoom in' },
    { key: 'Ctrl+-', description: 'Zoom out' },
    { key: 'Ctrl+0', description: 'Fit graph to view' },
    { key: 'Ctrl+R', description: 'Reset view' },
    { key: 'P', description: 'Toggle path finding mode' },
    { key: 'Esc', description: 'Exit path finding mode' },
    { key: 'Ctrl+A', description: 'Select all nodes' },
    { key: 'Ctrl+Shift+D', description: 'Deselect all' },
  ];

  return { shortcuts };
}

export default useGraphKeyboardShortcuts;
