'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'paper' | 'high-contrast' | 'dos-blue' | 'cyberpunk' | 'solarized';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'dos-blue';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'high-contrast' : 'paper';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('cyberpunk');
  const [mounted, setMounted] = useState(false);

  // Effect to initialize theme on client-side only
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    // Reset to cyberpunk if no theme is saved or if the saved theme is the old default (dos)
    if (!savedTheme) {
      setTheme('cyberpunk');
    } else if (['paper', 'high-contrast', 'dos-blue', 'cyberpunk', 'solarized'].includes(savedTheme)) {
      setTheme(savedTheme);
    }
    setMounted(true);
  }, []);

  // Effect to handle theme changes
  useEffect(() => {
    if (!mounted) return;

    document.documentElement.classList.remove(
      'theme-paper',
      'theme-high-contrast',
      'theme-dos-blue',
      'theme-cyberpunk',
      'theme-solarized'
    );
    document.documentElement.classList.add(`theme-${theme}`);
    localStorage.setItem('theme', theme);
  }, [theme, mounted]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
