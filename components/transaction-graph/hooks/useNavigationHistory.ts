'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

interface UseNavigationHistoryProps {
    initialSignature?: string;
    onNavigate: (signature: string) => void;
}

interface UseNavigationHistoryReturn {
    navigationHistory: string[];
    currentHistoryIndex: number;
    canGoBack: boolean;
    canGoForward: boolean;
    navigateBack: () => void;
    navigateForward: () => void;
    addToHistory: (signature: string) => void;
    isNavigatingHistory: boolean;
}

export function useNavigationHistory({
    initialSignature,
    onNavigate
}: UseNavigationHistoryProps): UseNavigationHistoryReturn {
    const [navigationHistory, setNavigationHistory] = useState<string[]>(
        initialSignature ? [initialSignature] : []
    );
    const [currentHistoryIndex, setCurrentHistoryIndex] = useState<number>(
        initialSignature ? 0 : -1
    );
    const [isNavigatingHistory, setIsNavigatingHistory] = useState<boolean>(false);
    const isNavigatingRef = useRef<boolean>(false);

    // Calculate navigation capabilities
    const canGoBack = currentHistoryIndex > 0;
    const canGoForward = currentHistoryIndex < navigationHistory.length - 1;

    // Navigate back in history
    const navigateBack = useCallback(() => {
        if (!canGoBack) return;

        const newIndex = currentHistoryIndex - 1;
        const signature = navigationHistory[newIndex];

        setCurrentHistoryIndex(newIndex);
        setIsNavigatingHistory(true);
        isNavigatingRef.current = true;
        onNavigate(signature);

        setTimeout(() => {
            setIsNavigatingHistory(false);
            isNavigatingRef.current = false;
        }, 100);
    }, [currentHistoryIndex, navigationHistory, canGoBack, onNavigate]);

    // Navigate forward in history
    const navigateForward = useCallback(() => {
        if (!canGoForward) return;

        const newIndex = currentHistoryIndex + 1;
        const signature = navigationHistory[newIndex];

        setCurrentHistoryIndex(newIndex);
        setIsNavigatingHistory(true);
        isNavigatingRef.current = true;
        onNavigate(signature);

        setTimeout(() => {
            setIsNavigatingHistory(false);
            isNavigatingRef.current = false;
        }, 100);
    }, [currentHistoryIndex, navigationHistory, canGoForward, onNavigate]);

        // Add a new entry to history
    const addToHistory = useCallback((signature: string) => {
        // Skip if currently navigating (use ref to avoid stale closure)
        if (isNavigatingRef.current) return;
        
        setNavigationHistory(prev => {
            // If we're not at the end of history, truncate forward history
            const newHistory = prev.slice(0, currentHistoryIndex + 1);

            // Only add if it's different from the current
            if (newHistory[newHistory.length - 1] !== signature) {
                newHistory.push(signature);
                setCurrentHistoryIndex(newHistory.length - 1);
            }

            return newHistory;
        });
    }, [currentHistoryIndex]);

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
        isNavigatingHistory
    };
} 