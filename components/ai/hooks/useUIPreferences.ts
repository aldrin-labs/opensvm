import { useCallback, useEffect, useState } from 'react';

export type Density = 'comfortable' | 'compact';
export type FontSize = 12 | 13 | 14;

export interface UIPreferences {
    density: Density;
    fontSize: FontSize;
    showRoleLabels: boolean;
    showReasoningDefault: boolean;
}

const KEY = 'aiUIPrefs.v1';
const defaultPrefs: UIPreferences = {
    density: 'comfortable',
    fontSize: 12,
    showRoleLabels: true,
    showReasoningDefault: false,
};

function load(): UIPreferences {
    if (typeof window === 'undefined') return defaultPrefs;
    try {
        const raw = window.localStorage.getItem(KEY);
        if (!raw) return defaultPrefs;
        const parsed = JSON.parse(raw);
        return { ...defaultPrefs, ...parsed };
    } catch { return defaultPrefs; }
}

export function useUIPreferences() {
    const [prefs, setPrefs] = useState<UIPreferences>(() => load());

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try { window.localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* noop */ }
    }, [prefs]);

    const update = useCallback(<K extends keyof UIPreferences>(key: K, value: UIPreferences[K]) => {
        setPrefs(prev => {
            const next = { ...prev, [key]: value };
            const eventType = key === 'density' ? 'density_change'
                : key === 'fontSize' ? 'font_size_change'
                    : key === 'showRoleLabels' ? 'role_labels_change'
                        : key === 'showReasoningDefault' ? 'reasoning_default_change'
                            : key + '_change';
            try { window.dispatchEvent(new CustomEvent('svmai:event', { detail: { type: eventType, ts: Date.now(), payload: { value } } })); } catch { }
            return next;
        });
    }, []);

    // Global snapshot API
    if (typeof window !== 'undefined') {
        (window as any).SVMAI = (window as any).SVMAI || {};
        (window as any).SVMAI.getPreferences = () => prefs;
    }

    return { prefs, update };
}
