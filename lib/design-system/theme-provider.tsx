'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { designTokens, themeColors } from './tokens';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeVariant = 'default' | 'paper' | 'high-contrast' | 'cyberpunk' | 'solarized' | 'dos-blue';

interface ThemeConfig {
  mode: ThemeMode;
  variant: ThemeVariant;
  fontSize: 'sm' | 'base' | 'lg';
  reducedMotion: boolean;
  highContrast: boolean;
  focusVisible: boolean;
}

interface ThemeContextType {
  config: ThemeConfig;
  resolvedTheme: 'light' | 'dark';
  updateConfig: (updates: Partial<ThemeConfig>) => void;
  resetToDefaults: () => void;
  tokens: typeof designTokens;
  colors: typeof themeColors.light | typeof themeColors.dark;
}

const defaultConfig: ThemeConfig = {
  mode: 'system',
  variant: 'cyberpunk',
  fontSize: 'base',
  reducedMotion: false,
  highContrast: false,
  focusVisible: true,
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getSystemPreferences(): Partial<ThemeConfig> {
  if (typeof window === 'undefined') return {};

  return {
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    highContrast: window.matchMedia('(prefers-contrast: high)').matches,
  };
}

interface EnhancedThemeProviderProps {
  children: React.ReactNode;
  defaultConfig?: Partial<ThemeConfig>;
  storageKey?: string;
  enableTransitions?: boolean;
}

export function EnhancedThemeProvider({
  children,
  defaultConfig: customDefaults,
  storageKey = 'opensvm-theme-config',
  enableTransitions = true,
}: EnhancedThemeProviderProps) {
  const [config, setConfig] = useState<ThemeConfig>(() => {
    // Try to load from localStorage immediately
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsedConfig = JSON.parse(stored) as Partial<ThemeConfig>;
          return { ...defaultConfig, ...customDefaults, ...parsedConfig };
        }
      } catch (error) {
        console.warn('Failed to load theme config from localStorage:', error);
      }
    }
    return {
      ...defaultConfig,
      ...customDefaults,
    };
  });
  const [mounted, setMounted] = useState(false);

  // Apply theme immediately on first render to avoid flash
  useEffect(() => {
    const root = document.documentElement;

    // Apply cyberpunk theme immediately if no other theme is set
    if (!root.classList.contains('theme-paper') &&
      !root.classList.contains('theme-high-contrast') &&
      !root.classList.contains('theme-dos-blue') &&
      !root.classList.contains('theme-cyberpunk') &&
      !root.classList.contains('theme-solarized')) {
      root.classList.add('theme-cyberpunk');
    }

    setMounted(true);
  }, []);

  // Resolve the actual theme based on mode and system preferences
  const resolvedTheme = useMemo(() => {
    if (config.mode === 'system') {
      return mounted ? getSystemTheme() : 'light';
    }
    return config.mode;
  }, [config.mode, mounted]);

  // Get theme colors based on resolved theme
  const colors = useMemo(() => {
    return themeColors[resolvedTheme];
  }, [resolvedTheme]);

  // Initialize theme from localStorage and system preferences
  useEffect(() => {
    // This effect now only handles system preferences since localStorage is loaded in useState
    const systemPrefs = getSystemPreferences();
    if (Object.keys(systemPrefs).length > 0) {
      setConfig(prev => ({ ...prev, ...systemPrefs }));
    }
  }, []);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;

    // Remove existing theme variant classes only (preserve other classes)
    const themeClasses = ['theme-paper', 'theme-high-contrast', 'theme-cyberpunk', 'theme-solarized', 'theme-dos-blue'];
    const fontClasses = ['font-size-sm', 'font-size-base', 'font-size-lg'];
    
    themeClasses.forEach(cls => root.classList.remove(cls));
    fontClasses.forEach(cls => root.classList.remove(cls));

    // Apply theme variant (default to cyberpunk for dark theme)
    const themeVariant = config.variant === 'default' ? 'cyberpunk' : config.variant;
    root.classList.add(`theme-${themeVariant}`);

    // Apply color scheme - force dark theme
    root.setAttribute('data-theme', 'dark');
    root.style.colorScheme = 'dark';
    
    // Ensure dark class is present
    root.classList.add('dark');

    // Apply font size
    root.classList.add(`font-size-${config.fontSize}`);

    // Apply accessibility preferences
    if (config.reducedMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }

    if (config.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    if (!config.focusVisible) {
      root.classList.add('no-focus-visible');
    } else {
      root.classList.remove('no-focus-visible');
    }

    // Set CSS custom properties for runtime theming
    root.style.setProperty('--theme-transition-duration',
      config.reducedMotion ? '0ms' : (enableTransitions ? '300ms' : '0ms')
    );

  }, [config, resolvedTheme, enableTransitions]);  // Save config to localStorage
  useEffect(() => {
    if (!mounted) return;

    try {
      localStorage.setItem(storageKey, JSON.stringify(config));
    } catch (error) {
      console.warn('Failed to save theme config to localStorage:', error);
    }
  }, [config, storageKey, mounted]);  // Listen for system theme changes
  useEffect(() => {
    if (!mounted || config.mode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      // Force re-render by updating a dummy state
      setConfig(prev => ({ ...prev }));
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [config.mode, mounted]);

  const updateConfig = (updates: Partial<ThemeConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const resetToDefaults = () => {
    setConfig({ ...defaultConfig, ...customDefaults });
  };

  const contextValue: ThemeContextType = {
    config,
    resolvedTheme,
    updateConfig,
    resetToDefaults,
    tokens: designTokens,
    colors,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    // Return default values during SSR/build time
    return {
      config: defaultConfig,
      resolvedTheme: 'light' as const,
      updateConfig: () => { },
      resetToDefaults: () => { },
      tokens: designTokens,
      colors: themeColors.light,
    };
  }
  return context;
}

// Utility hook for responsive design
export function useResponsive() {
  const [breakpoint, setBreakpoint] = useState<keyof typeof designTokens.breakpoints>('md');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateBreakpoint = () => {
      const width = window.innerWidth;
      if (width < 640) setBreakpoint('xs');
      else if (width < 768) setBreakpoint('sm');
      else if (width < 1024) setBreakpoint('md');
      else if (width < 1280) setBreakpoint('lg');
      else if (width < 1536) setBreakpoint('xl');
      else setBreakpoint('2xl');
    };

    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);
    return () => window.removeEventListener('resize', updateBreakpoint);
  }, []);

  return {
    breakpoint,
    isMobile: breakpoint === 'xs' || breakpoint === 'sm',
    isTablet: breakpoint === 'md',
    isDesktop: breakpoint === 'lg' || breakpoint === 'xl' || breakpoint === '2xl',
    isLarge: breakpoint === 'xl' || breakpoint === '2xl',
  };
}

// Utility hook for system preferences
export function useSystemPreferences() {
  const [preferences, setPreferences] = useState({
    reducedMotion: false,
    highContrast: false,
    darkMode: false,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updatePreferences = () => {
      setPreferences({
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        highContrast: window.matchMedia('(prefers-contrast: high)').matches,
        darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
      });
    };

    updatePreferences();

    const queries = [
      window.matchMedia('(prefers-reduced-motion: reduce)'),
      window.matchMedia('(prefers-contrast: high)'),
      window.matchMedia('(prefers-color-scheme: dark)'),
    ];

    queries.forEach(query => query.addEventListener('change', updatePreferences));
    return () => queries.forEach(query => query.removeEventListener('change', updatePreferences));
  }, []);

  return preferences;
}
