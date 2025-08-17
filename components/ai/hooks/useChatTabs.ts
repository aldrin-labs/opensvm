import { useState, useCallback } from 'react';
import type { Message, Note, AgentAction } from '../types';

export type ChatMode = 'agent' | 'assistant';

export interface ChatTab {
    id: string;
    name: string;
    mode: ChatMode;
    messages: Message[];
    input: string;
    isProcessing: boolean;
    notes: Note[];
    agentActions: AgentAction[];
    status?: string; // Current step/status for the tab
    lastActivity: number;
}

export interface UseChatTabsReturn {
    tabs: ChatTab[];
    activeTabId: string | null;
    activeTab: ChatTab | null;
    createTab: (name?: string, mode?: ChatMode) => string;
    closeTab: (tabId: string) => void;
    switchToTab: (tabId: string) => void;
    updateTab: (tabId: string, updates: Partial<ChatTab>) => void;
    updateActiveTabMode: (mode: ChatMode) => void;
    renameTab: (tabId: string, name: string) => void;
    duplicateTab: (tabId: string) => string;
}

export function useChatTabs(): UseChatTabsReturn {
    const [tabs, setTabs] = useState<ChatTab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);

    // Initialize with default tab if none exist
    const initializeDefaultTab = useCallback(() => {
        if (tabs.length === 0) {
            const initialMessage = {
                role: 'assistant' as const,
                content: 'Hello! I\'m your Solana blockchain agent. I can help you analyze transactions, accounts, smart contracts, and more. What would you like to explore?'
            };

            const defaultTab: ChatTab = {
                id: 'chat-1',
                name: 'CHAT',
                mode: 'agent',
                messages: [initialMessage],
                input: '',
                isProcessing: false,
                notes: [],
                agentActions: [],
                lastActivity: Date.now()
            };
            setTabs([defaultTab]);
            setActiveTabId(defaultTab.id);
            return defaultTab.id;
        }
        return tabs[0].id;
    }, [tabs.length]);

    // Create a new tab
    const createTab = useCallback((name?: string, mode: ChatMode = 'agent'): string => {
        // Defensive: sometimes a click handler might accidentally forward the event
        // Ensure name is a simple string, otherwise ignore it
        if (name && typeof name !== 'string') {
            name = undefined;
        }
        const tabNumber = tabs.length + 1;
        const initialMessage = {
            role: 'assistant' as const,
            content: mode === 'assistant'
                ? 'Hello! I\'m your helpful assistant. How can I help you today?'
                : 'Hello! I\'m your Solana blockchain agent. I can help you analyze transactions, accounts, smart contracts, and more. What would you like to explore?'
        };

        const newTab: ChatTab = {
            id: `chat-${Date.now()}`,
            name: name || `CHAT ${tabNumber}`,
            mode,
            messages: [initialMessage],
            input: '',
            isProcessing: false,
            notes: [],
            agentActions: [],
            lastActivity: Date.now()
        };

        setTabs(prev => [...prev, newTab]);
        setActiveTabId(newTab.id);
        return newTab.id;
    }, [tabs.length]);

    // Close a tab
    const closeTab = useCallback((tabId: string) => {
        setTabs(prev => {
            const filtered = prev.filter(tab => tab.id !== tabId);

            // If we closed the active tab, switch to another one
            if (tabId === activeTabId) {
                if (filtered.length > 0) {
                    // Switch to the previous tab, or the first one if we closed the first tab
                    const closedIndex = prev.findIndex(tab => tab.id === tabId);
                    const newActiveIndex = Math.max(0, closedIndex - 1);
                    setActiveTabId(filtered[newActiveIndex]?.id || null);
                } else {
                    setActiveTabId(null);
                }
            }

            return filtered;
        });
    }, [activeTabId]);

    // Switch to a tab
    const switchToTab = useCallback((tabId: string) => {
        setActiveTabId(tabId);
        // Update last activity
        setTabs(prev => prev.map(tab =>
            tab.id === tabId
                ? { ...tab, lastActivity: Date.now() }
                : tab
        ));
    }, []);

    // Update a tab
    const updateTab = useCallback((tabId: string, updates: Partial<ChatTab>) => {
        setTabs(prev => prev.map(tab =>
            tab.id === tabId
                ? { ...tab, ...updates, lastActivity: Date.now() }
                : tab
        ));
    }, []);

    // Update the mode of the active tab
    const updateActiveTabMode = useCallback((mode: ChatMode) => {
        if (activeTabId) {
            updateTab(activeTabId, { mode });
        }
    }, [activeTabId, updateTab]);

    // Rename a tab
    const renameTab = useCallback((tabId: string, name: string) => {
        updateTab(tabId, { name });
    }, [updateTab]);

    // Duplicate a tab
    const duplicateTab = useCallback((tabId: string): string => {
        const originalTab = tabs.find(tab => tab.id === tabId);
        if (!originalTab) return '';

        const newTab: ChatTab = {
            ...originalTab,
            id: `chat-${Date.now()}`,
            name: `${originalTab.name} Copy`,
            lastActivity: Date.now()
        };

        setTabs(prev => [...prev, newTab]);
        setActiveTabId(newTab.id);
        return newTab.id;
    }, [tabs]);

    // Get active tab
    const activeTab = activeTabId ? tabs.find(tab => tab.id === activeTabId) || null : null;

    // Initialize default tab if needed
    if (tabs.length === 0) {
        setTimeout(initializeDefaultTab, 0);
    }

    return {
        tabs,
        activeTabId,
        activeTab,
        createTab,
        closeTab,
        switchToTab,
        updateTab,
        updateActiveTabMode,
        renameTab,
        duplicateTab
    };
}
