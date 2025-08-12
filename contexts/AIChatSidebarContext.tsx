'use client';

import React, { createContext, useContext, useMemo, useState, ReactNode, useCallback } from 'react';

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
    openWithPrompt: (text: string) => void;
    registerInputController: (controller: { setInput: (value: string) => void; focusInput: () => void; submit?: () => void; }) => void;
}

const AIChatSidebarContext = createContext<AIChatSidebarContextValue | null>(null);

export function AIChatSidebarProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
        if (typeof window === 'undefined') return 400;
        const saved = window.localStorage.getItem('aiSidebarWidth');
        const parsed = saved ? parseInt(saved, 10) : NaN;
        const initial = Number.isFinite(parsed) ? parsed : 400;
        return Math.min(1920, Math.max(300, initial));
    });
    const [isResizing, setIsResizing] = useState<boolean>(false);

    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => setIsOpen(false), []);
    const toggle = useCallback((next?: boolean) => {
        setIsOpen((prev) => (typeof next === 'boolean' ? next : !prev));
    }, []);

    const onResizeStart = useCallback(() => setIsResizing(true), []);
    const onResizeEnd = useCallback(() => setIsResizing(false), []);

    const inputControllerRef = React.useRef<{ setInput: (value: string) => void; focusInput: () => void; submit?: () => void; } | null>(null);

    const registerInputController = useCallback((controller: { setInput: (value: string) => void; focusInput: () => void; submit?: () => void; }) => {
        inputControllerRef.current = controller;
    }, []);

    const openWithPrompt = useCallback((text: string) => {
        setIsOpen(true);
        setTimeout(() => {
            inputControllerRef.current?.setInput(text);
            inputControllerRef.current?.focusInput();
        }, 0);
    }, []);

    const value = useMemo<AIChatSidebarContextValue>(
        () => ({
            isOpen,
            open,
            close,
            toggle,
            sidebarWidth,
            setSidebarWidth: (width: number) => {
                const clamped = Math.min(1920, Math.max(300, width));
                setSidebarWidth(clamped);
                try {
                    if (typeof window !== 'undefined') {
                        window.localStorage.setItem('aiSidebarWidth', String(clamped));
                    }
                } catch { }
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


