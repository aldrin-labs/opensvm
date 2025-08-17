'use client';

import React, { createContext, useContext, useMemo, useState, ReactNode, useCallback, useEffect } from 'react';
import { track, startTimer } from '@/lib/ai/telemetry';

interface AIChatSidebarContextValue {
    isOpen: boolean;
    open: () => void;
    close: () => void;
    toggle: (next?: boolean) => void;
    sidebarWidth: number;
    setSidebarWidth: (width: number) => void;
    isResizing: boolean;
    onResizeStart: () => void;
    onResizeEnd: () => void;
    openWithPrompt: (text: string, opts?: { submit?: boolean }) => void;
    registerInputController: (controller: { setInput: (value: string) => void; focusInput: () => void; submit?: () => void; }) => void;
}

const AIChatSidebarContext = createContext<AIChatSidebarContextValue | null>(null);

export function AIChatSidebarProvider({ children }: { children: ReactNode }) {
    // Initialize from URL so E2E can deterministically open on first paint (no flicker)
    const [isOpen, setIsOpen] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        try {
            const params = new URLSearchParams(window.location.search);
            const shouldOpen = params.get('ai');
            return shouldOpen === '1' || shouldOpen === 'true';
        } catch {
            return false;
        }
    });
    const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
        // Default to a wider layout so header controls are visible on first open
        if (typeof window === 'undefined') return 560;
        const saved = window.localStorage.getItem('aiSidebarWidth');
        const parsed = saved ? parseInt(saved, 10) : NaN;
        let initial = Number.isFinite(parsed) ? parsed : 560;
        // Migration: auto-bump previously saved narrow widths to ensure visibility of header controls
        if (Number.isFinite(parsed) && parsed! < 520) {
            initial = 560;
            try { window.localStorage.setItem('aiSidebarWidth', String(initial)); } catch { /* noop */ }
        }
        return Math.min(1920, Math.max(560, initial));
    });
    const [isResizing, setIsResizing] = useState<boolean>(false);

    const open = useCallback(() => { setIsOpen(true); try { track('sidebar_open'); startTimer('sidebar_open_fmp'); } catch { } }, []);
    const close = useCallback(() => { setIsOpen(false); try { track('sidebar_close'); } catch { } }, []);
    const toggle = useCallback((next?: boolean) => {
        setIsOpen((prev) => (typeof next === 'boolean' ? next : !prev));
    }, []);

    const onResizeStart = useCallback(() => setIsResizing(true), []);
    const onResizeEnd = useCallback(() => setIsResizing(false), []);

    const inputControllerRef = React.useRef<{ setInput: (value: string) => void; focusInput: () => void; submit?: () => void; } | null>(null);
    // If openWithPrompt is called before the input controller is registered, queue it
    const pendingPromptRef = React.useRef<{ text: string; submit?: boolean } | null>(null);

    const registerInputController = useCallback((controller: { setInput: (value: string) => void; focusInput: () => void; submit?: () => void; }) => {
        inputControllerRef.current = controller;
        // Flush any pending prompt queued before controller was ready
        if (pendingPromptRef.current) {
            const { text, submit } = pendingPromptRef.current;
            pendingPromptRef.current = null;
            try {
                setIsOpen(true);
                controller.setInput(text);
                controller.focusInput();
                if (submit) {
                    if (typeof window !== 'undefined') {
                        // More conservative scheduling to ensure tab state reflects new input before submit
                        requestAnimationFrame(() =>
                            requestAnimationFrame(() =>
                                requestAnimationFrame(() => {
                                    Promise.resolve().then(() => setTimeout(() => controller.submit?.(), 0));
                                })
                            )
                        );
                    } else {
                        setTimeout(() => controller.submit?.(), 0);
                    }
                }
            } catch { /* noop */ }
        }
    }, []);

    const openWithPrompt = useCallback((text: string, opts?: { submit?: boolean }) => {
        setIsOpen(true);
        const controller = inputControllerRef.current;
        if (!controller) {
            // Queue until controller is registered
            pendingPromptRef.current = { text, submit: opts?.submit };
            return;
        }
        try {
            controller.setInput(text);
            controller.focusInput();
            if (opts?.submit) {
                if (typeof window !== 'undefined') {
                    // Some concurrent render timing caused the tab input state not to be ready by the prior double rAF approach.
                    // Use a more conservative staged scheduler (triple rAF + microtask + timeout) to greatly reduce race risk.
                    requestAnimationFrame(() =>
                        requestAnimationFrame(() =>
                            requestAnimationFrame(() => {
                                Promise.resolve().then(() => {
                                    setTimeout(() => controller.submit?.(), 0);
                                });
                            })
                        )
                    );
                } else {
                    setTimeout(() => controller.submit?.(), 0);
                }
            }
        } catch { /* noop */ }
    }, []);

    // Support URL params to auto-open sidebar for manual/e2e testing
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const params = new URLSearchParams(window.location.search);
            const shouldOpen = params.get('ai');
            if (shouldOpen === '1' || shouldOpen === 'true') {
                const raw = params.get('aitext');
                const text = raw ? decodeURIComponent(raw) : '';
                const submitParam = params.get('aisubmit');
                // If aitext provided, auto-submit by default unless aisubmit explicitly disables it (0/false)
                const shouldAutoSubmit = (() => {
                    if (!text.trim()) return false;
                    if (!submitParam) return true; // default ON
                    return submitParam === '1' || submitParam === 'true';
                })();
                if (text && text.trim().length > 0) {
                    openWithPrompt(text, { submit: shouldAutoSubmit });
                } else {
                    open();
                }
            }
        } catch {
            // ignore
        }
        // run once on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Keyboard shortcut: Ctrl/Cmd+Shift+I toggles the AI sidebar
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handler = (e: KeyboardEvent) => {
            const isMac = navigator.platform.toUpperCase().includes('MAC');
            const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
            if (cmdOrCtrl && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
                e.preventDefault();
                toggle();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [toggle]);

    // Testing hook: expose minimal global API for opening the sidebar programmatically
    useEffect(() => {
        if (typeof window === 'undefined') return;
        (window as any).SVMAI = {
            open: () => open(),
            close: () => close(),
            toggle: () => toggle(),
            prompt: (text: string, submit?: boolean) => openWithPrompt(String(text ?? ''), { submit: !!submit }),
            // Deterministic test helpers for width control
            setWidth: (w: number) => {
                try {
                    const n = Number(w);
                    if (!Number.isFinite(n)) return;
                    const clamped = Math.min(1920, Math.max(560, n));
                    // Open to ensure layout shift is applied
                    open();
                    // Update provider state so Navbar effect reacts
                    setSidebarWidth(clamped);
                    try { window.localStorage.setItem('aiSidebarWidth', String(clamped)); } catch { /* noop */ }
                } catch { /* noop */ }
            },
            getWidth: () => {
                try {
                    const saved = window.localStorage.getItem('aiSidebarWidth');
                    const parsed = saved ? parseInt(saved, 10) : NaN;
                    return Number.isFinite(parsed) ? parsed : 400;
                } catch { return 400; }
            }
        };
        return () => {
            try { delete (window as any).SVMAI; } catch { /* noop */ }
        };
    }, [open, close, toggle, openWithPrompt, setSidebarWidth]);

    const value = useMemo<AIChatSidebarContextValue>(
        () => ({
            isOpen,
            open,
            close,
            toggle,
            sidebarWidth,
            setSidebarWidth: (width: number) => {
                const clamped = Math.min(1920, Math.max(560, width));
                setSidebarWidth(clamped);
                try {
                    if (typeof window !== 'undefined') {
                        window.localStorage.setItem('aiSidebarWidth', String(clamped));
                    }
                } catch { }
                try { track('width_change', { width: clamped }); } catch { }
            },
            isResizing,
            onResizeStart,
            onResizeEnd,
            openWithPrompt,
            registerInputController,
        }),
        [isOpen, open, close, toggle, sidebarWidth, isResizing, onResizeStart, onResizeEnd, openWithPrompt, registerInputController]
    );

    return (
        <AIChatSidebarContext.Provider value={value}>{children}</AIChatSidebarContext.Provider>
    );
}

export function useAIChatSidebar(): AIChatSidebarContextValue {
    const ctx = useContext(AIChatSidebarContext);
    if (ctx) return ctx;

    // Fallback state for usage outside provider (e.g., isolated tests)
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [sidebarWidth, setSidebarWidth] = useState<number>(400);
    const [isResizing, setIsResizing] = useState<boolean>(false);

    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => setIsOpen(false), []);
    const toggle = useCallback((next?: boolean) => {
        setIsOpen((prev) => (typeof next === 'boolean' ? next : !prev));
    }, []);

    const onResizeStart = useCallback(() => setIsResizing(true), []);
    const onResizeEnd = useCallback(() => setIsResizing(false), []);

    return {
        isOpen,
        open,
        close,
        toggle,
        sidebarWidth,
        setSidebarWidth,
        isResizing,
        onResizeStart,
        onResizeEnd,
        openWithPrompt: () => { },
        registerInputController: () => { },
    };
}


