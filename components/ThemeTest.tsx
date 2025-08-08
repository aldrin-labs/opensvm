// Test file to verify theme switching functionality
import React from 'react';

export function ThemeTest() {
    const themes = ['paper', 'high-contrast', 'dos-blue', 'cyberpunk', 'solarized'];

    const handleThemeChange = (theme: string) => {
        // Direct DOM manipulation to test theme switching
        if (typeof document !== 'undefined') {
            // Remove all theme classes
            themes.forEach(t => document.documentElement.classList.remove(`theme-${t}`));
            // Add the new theme class
            document.documentElement.classList.add(`theme-${theme}`);
            // Store in localStorage
            localStorage.setItem('theme', theme);
            console.log(`Theme changed to: ${theme}`);
        }
    };

    return (
        <div className="fixed bottom-20 right-6 bg-background border border-border rounded-lg p-4 shadow-lg">
            <h3 className="text-sm font-medium mb-2">Test Theme Switcher</h3>
            <div className="flex flex-col gap-1">
                {themes.map((theme) => (
                    <button
                        key={theme}
                        onClick={() => handleThemeChange(theme)}
                        className="px-3 py-1 text-xs bg-muted hover:bg-accent rounded text-left"
                    >
                        {theme}
                    </button>
                ))}
            </div>
        </div>
    );
}
