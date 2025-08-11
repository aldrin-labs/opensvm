'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { NavigationItem } from '../types';

interface UseNavigationHistoryProps {
    initialSignature?: string;
    initialAccount?: string;
    onNavigate: (signature: string) => void;
    onAccountNavigate?: (address: string) => void;
}

interface UseNavigationHistoryReturn {
    navigationHistory: NavigationItem[];
    currentHistoryIndex: number;
    canGoBack: boolean;
    canGoForward: boolean;
    navigateBack: () => void;
    navigateForward: () => void;
    addToHistory: (item: NavigationItem) => void;
    navigateToIndex: (index: number) => void;
    goHome: () => void;
    isNavigatingHistory: boolean;
    viewportStates: Map<string, { x: number; y: number; zoom: number }>;
}

export function useNavigationHistory({
    initialSignature,
    initialAccount,
    onNavigate,
    onAccountNavigate
}: UseNavigationHistoryProps): UseNavigationHistoryReturn {
    const [navigationHistory, setNavigationHistory] = useState<NavigationItem[]>(() => {
        const items: NavigationItem[] = [];
        if (initialAccount) {
            items.push({
                id: initialAccount,
                type: 'account',
                label: initialAccount,
                address: initialAccount,
                timestamp: Date.now()
            });
        }
        if (initialSignature) {
            items.push({
                id: initialSignature,
                type: 'transaction',
                label: initialSignature,
                signature: initialSignature,
                timestamp: Date.now()
            });
        }
        return items;
    });

    const [currentHistoryIndex, setCurrentHistoryIndex] = useState<number>(
        Math.max(0, navigationHistory.length - 1)
    );
    const [isNavigatingHistory, setIsNavigatingHistory] = useState<boolean>(false);
    const isNavigatingRef = useRef<boolean>(false);
    const [viewportStates, setViewportStates] = useState<Map<string, { x: number; y: number; zoom: number }>>(new Map());

    // Calculate navigation capabilities
    const canGoBack = currentHistoryIndex > 0;
    const canGoForward = currentHistoryIndex < navigationHistory.length - 1;

    // Navigate back in history
    const navigateBack = useCallback(() => {
        if (!canGoBack) return;

        const newIndex = currentHistoryIndex - 1;
        const item = navigationHistory[newIndex];

        setCurrentHistoryIndex(newIndex);
        setIsNavigatingHistory(true);
        isNavigatingRef.current = true;

        if (item.type === 'transaction' && item.signature) {
            onNavigate(item.signature);
        } else if (item.type === 'account' && item.address && onAccountNavigate) {
            onAccountNavigate(item.address);
        }

        setTimeout(() => {
            setIsNavigatingHistory(false);
            isNavigatingRef.current = false;
        }, 100);
    }, [currentHistoryIndex, navigationHistory, canGoBack, onNavigate, onAccountNavigate]);

    // Navigate forward in history
    const navigateForward = useCallback(() => {
        if (!canGoForward) return;

        const newIndex = currentHistoryIndex + 1;
        const item = navigationHistory[newIndex];

        setCurrentHistoryIndex(newIndex);
        setIsNavigatingHistory(true);
        isNavigatingRef.current = true;

        if (item.type === 'transaction' && item.signature) {
            onNavigate(item.signature);
        } else if (item.type === 'account' && item.address && onAccountNavigate) {
            onAccountNavigate(item.address);
        }

        setTimeout(() => {
            setIsNavigatingHistory(false);
            isNavigatingRef.current = false;
        }, 100);
    }, [currentHistoryIndex, navigationHistory, canGoForward, onNavigate, onAccountNavigate]);

    // Add a new entry to history
    const addToHistory = useCallback((item: NavigationItem) => {
        // Skip if currently navigating (use ref to avoid stale closure)
        if (isNavigatingRef.current) return;

        setNavigationHistory(prev => {
            // If we're not at the end of history, truncate forward history
            const newHistory = prev.slice(0, currentHistoryIndex + 1);

            // Only add if it's different from the current
            if (newHistory[newHistory.length - 1]?.id !== item.id) {
                newHistory.push(item);
                setCurrentHistoryIndex(newHistory.length - 1);
            }

            return newHistory;
        });
    }, [currentHistoryIndex]);

    // Navigate to specific index in history
    const navigateToIndex = useCallback((index: number) => {
        if (index < 0 || index >= navigationHistory.length) return;

        const item = navigationHistory[index];
        setCurrentHistoryIndex(index);
        setIsNavigatingHistory(true);
        isNavigatingRef.current = true;

        if (item.type === 'transaction' && item.signature) {
            onNavigate(item.signature);
        } else if (item.type === 'account' && item.address && onAccountNavigate) {
            onAccountNavigate(item.address);
        }

        setTimeout(() => {
            setIsNavigatingHistory(false);
            isNavigatingRef.current = false;
        }, 100);
    }, [navigationHistory, onNavigate, onAccountNavigate]);

    // Go to home (initial account)
    const goHome = useCallback(() => {
        if (navigationHistory.length === 0) return;

        const homeItem = navigationHistory.find(item => item.type === 'account');
        if (homeItem && homeItem.address && onAccountNavigate) {
            const homeIndex = navigationHistory.findIndex(item => item.id === homeItem.id);
            setCurrentHistoryIndex(homeIndex);
            setIsNavigatingHistory(true);
            isNavigatingRef.current = true;

            onAccountNavigate(homeItem.address);

            setTimeout(() => {
                setIsNavigatingHistory(false);
                isNavigatingRef.current = false;
            }, 100);
        }
    }, [navigationHistory, onAccountNavigate]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.altKey && e.key === 'ArrowLeft') {
                e.preventDefault();
                navigateBack();
            } else if (e.altKey && e.key === 'ArrowRight') {
                e.preventDefault();
                navigateForward();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [navigateBack, navigateForward]);

    return {
        navigationHistory,
        currentHistoryIndex,
        canGoBack,
        canGoForward,
        navigateBack,
        navigateForward,
        addToHistory,
        navigateToIndex,
        goHome,
        isNavigatingHistory,
        viewportStates
    };
} 