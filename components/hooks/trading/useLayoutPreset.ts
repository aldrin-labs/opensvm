/**
 * useLayoutPreset Hook
 *
 * Manages layout preset selection and persistence.
 * Loads saved preference from localStorage and provides methods to change presets.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getLayoutPreset,
  loadLayoutPreference,
  saveLayoutPreference,
  DEFAULT_PRESET_ID,
  type LayoutPreset,
} from '@/lib/trading/layout-presets';

export interface UseLayoutPresetReturn {
  currentPreset: LayoutPreset;
  currentPresetId: string;
  changePreset: (presetId: string) => void;
  isLoading: boolean;
}

/**
 * Hook for managing trading terminal layout presets
 *
 * @returns Layout preset state and controls
 *
 * @example
 * ```tsx
 * const { currentPreset, changePreset } = useLayoutPreset();
 *
 * // Access current preset config
 * const widgets = currentPreset.widgets;
 *
 * // Change preset
 * changePreset('dayTrader');
 * ```
 */
export function useLayoutPreset(): UseLayoutPresetReturn {
  const [currentPresetId, setCurrentPresetId] = useState<string>(DEFAULT_PRESET_ID);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved preference on mount
  useEffect(() => {
    const savedPresetId = loadLayoutPreference();
    setCurrentPresetId(savedPresetId);
    setIsLoading(false);
  }, []);

  // Change preset and save to localStorage
  const changePreset = useCallback((presetId: string) => {
    setCurrentPresetId(presetId);
    saveLayoutPreference(presetId);

    // Announce to screen readers
    if (typeof window !== 'undefined') {
      const preset = getLayoutPreset(presetId);
      const announcement = `Layout changed to ${preset.name}`;
      const liveRegion = document.createElement('div');
      liveRegion.setAttribute('role', 'status');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.className = 'sr-only';
      liveRegion.textContent = announcement;
      document.body.appendChild(liveRegion);
      setTimeout(() => document.body.removeChild(liveRegion), 1000);
    }
  }, []);

  const currentPreset = getLayoutPreset(currentPresetId);

  return {
    currentPreset,
    currentPresetId,
    changePreset,
    isLoading,
  };
}

export default useLayoutPreset;
