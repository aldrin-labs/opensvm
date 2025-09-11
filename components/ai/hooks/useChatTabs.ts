import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { Message, Note, AgentAction } from '../types';
import { chatPersistenceService } from '../../../lib/ai/services/ChatPersistenceService';

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
    pinned?: boolean; // Whether the tab is pinned (appears first and cannot be auto-removed)
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
    togglePin: (tabId: string) => void;
    forkTabAtMessage: (tabId: string, messageIndex: number, nameHint?: string) => string | null;
}

export function useChatTabs(): UseChatTabsReturn {
    // Synchronously create an initial default tab to avoid timing races (fallback UI in Chat.tsx)
    const [tabs, setTabs] = useState<ChatTab[]>(() => {
        // Attempt to hydrate from persistence
        if (typeof window !== 'undefined') {
            try {
                const raw = window.localStorage.getItem('aiChatTabsState');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed && Array.isArray(parsed.tabs)) {
                        // Basic validation of shape
                        const hydrated: ChatTab[] = parsed.tabs.map((t: any) => ({
                            id: typeof t.id === 'string' ? t.id : `chat-${Date.now()}`,
                            name: typeof t.name === 'string' ? t.name : 'CHAT',
                            mode: t.mode === 'assistant' ? 'assistant' : 'agent',
                            messages: Array.isArray(t.messages) ? t.messages.filter((m: any) => m && typeof m.content === 'string') : [],
                            input: typeof t.input === 'string' ? t.input : '',
                            isProcessing: false,
                            notes: Array.isArray(t.notes) ? t.notes : [],
                            agentActions: Array.isArray(t.agentActions) ? t.agentActions : [],
                            status: typeof t.status === 'string' ? t.status : undefined,
                            lastActivity: typeof t.lastActivity === 'number' ? t.lastActivity : Date.now(),
                            pinned: !!t.pinned
                        }));
                        if (hydrated.length > 0) {
                            return hydrated;
                        }
                    }
                }
            } catch {
                // ignore hydration failures
            }
        }
        // Fallback default tab
        const defaultTab: ChatTab = {
            id: 'chat-1',
            name: 'CHAT',
            mode: 'agent',
            messages: [],
            input: '',
            isProcessing: false,
            notes: [],
            agentActions: [],
            lastActivity: Date.now(),
            pinned: false
        };
        return [defaultTab];
    });
    const [activeTabId, setActiveTabId] = useState<string | null>(() => {
        if (typeof window !== 'undefined') {
            try {
                const raw = window.localStorage.getItem('aiChatTabsState');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed && typeof parsed.activeTabId === 'string') {
                        return parsed.activeTabId;
                    }
                }
            } catch { /* ignore */ }
        }
        return 'chat-1';
    });

    // Create a new tab
    const createTab = useCallback((name?: string, mode: ChatMode = 'agent'): string => {
        // Defensive: sometimes a click handler might accidentally forward the event
        // Ensure name is a simple string, otherwise ignore it
        if (name && typeof name !== 'string') {
            name = undefined;
        }
        const tabNumber = tabs.length + 1;
        const newTab: ChatTab = {
            id: `chat-${Date.now()}`,
            name: name || `CHAT ${tabNumber}`,
            mode,
            messages: [],
            input: '',
            isProcessing: false,
            notes: [],
            agentActions: [],
            lastActivity: Date.now(),
            pinned: false
        };

        setTabs(prev => [...prev, newTab]);
        setActiveTabId(newTab.id);
        return newTab.id;
    }, [tabs.length]);

    // Close a tab
    const closeTab = useCallback(async (tabId: string) => {
        // Find the tab to be closed and save it to persistence if it has meaningful content
        const tabToClose = tabs.find(tab => tab.id === tabId);
        let saveSuccessful = false;
        if (tabToClose && tabToClose.messages.length > 1) { // Only save if there are messages beyond initial greeting
            try {
                await chatPersistenceService.saveChatFromTab(tabToClose);
                saveSuccessful = true;
            } catch (error) {
                console.error('Error saving tab to persistence before closing:', error);
                // Continue with tab closure even if save fails
            }
        }

        setTabs(prev => {
            // Prevent closing the last remaining tab
            if (prev.length === 1) return prev;
            const filtered = prev.filter(tab => tab.id !== tabId);

            // If we closed the active tab, switch to another one
            if (tabId === activeTabId) {
                if (filtered.length > 0) {
                    const closedIndex = prev.findIndex(tab => tab.id === tabId);
                    // Prefer nearest pinned tab if available
                    const pinned = filtered.filter(t => t.pinned);
                    if (pinned.length > 0) {
                        setActiveTabId(pinned[0].id);
                    } else {
                        const newActiveIndex = Math.max(0, closedIndex - 1);
                        setActiveTabId(filtered[newActiveIndex]?.id || null);
                    }
                } else {
                    setActiveTabId(null);
                }
            }
            return filtered;
        });

        if (saveSuccessful) {
            // Trigger a reload of persisted tabs, assuming AIChatSidebar passes a reload func
            if (typeof window !== 'undefined' && (window as any).SVMAI_HISTORY_RELOAD) {
                (window as any).SVMAI_HISTORY_RELOAD();
            }
        }
    }, [activeTabId, tabs]);

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
            lastActivity: Date.now(),
            pinned: false
        };

        setTabs(prev => [...prev, newTab]);
        setActiveTabId(newTab.id);
        return newTab.id;
    }, [tabs]);

    // Toggle pin state
    const togglePin = useCallback((tabId: string) => {
        updateTab(tabId, { pinned: !tabs.find(t => t.id === tabId)?.pinned });
    }, [tabs, updateTab]);

    // Fork tab at message index (create new tab with messages up to index)
    const forkTabAtMessage = useCallback((tabId: string, messageIndex: number, nameHint?: string) => {
        const source = tabs.find(t => t.id === tabId);
        if (!source) return null;
        const slice = source.messages.slice(0, messageIndex + 1);
        if (slice.length === 0) return null;

        const newTab: ChatTab = {
            id: `chat-${Date.now()}`,
            name: nameHint ? nameHint : `${source.name.split(' ')[0]} Fork`,
            mode: source.mode,
            messages: slice,
            input: '',
            isProcessing: false,
            notes: [...source.notes],
            agentActions: [],
            lastActivity: Date.now(),
            pinned: false
        };
        setTabs(prev => [...prev, newTab]);
        setActiveTabId(newTab.id);
        return newTab.id;
    }, [tabs]);

    // Persist tabs + activeTabId (ensure pinned ordering persisted as-is)
    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                const payload = JSON.stringify({ tabs, activeTabId });
                (window as any).localStorage.setItem('aiChatTabsState', payload);
            } catch {
                // ignore persistence errors
            }
        }
    }, [tabs, activeTabId]);

    // Get active tab
    const activeTab = activeTabId ? tabs.find(tab => tab.id === activeTabId) || null : null;

    // Sort tabs with pinned first (stable within groups)
    const sortedTabs = useMemo(() => {
        return [...tabs].sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return a.lastActivity > b.lastActivity ? -1 : 1;
        });
    }, [tabs]);

    // Dispatch one-time tabs hydration event & set attributes for E2E observers
    const tabsHydrationDispatchedRef = useRef(false);
    useEffect(() => {
        if (typeof window !== 'undefined') {
            if (tabsHydrationDispatchedRef.current) return;
            tabsHydrationDispatchedRef.current = true;
            try {
                const totalMessages = tabs.reduce((acc, t) => acc + t.messages.length, 0);
                const pinnedCount = tabs.filter(t => t.pinned).length;
                const detail = {
                    count: tabs.length,
                    activeTabId,
                    pinned: pinnedCount,
                    totalMessages
                };
                const root = document.querySelector('[data-ai-sidebar-root]') as HTMLElement | null;
                if (root) {
                    root.setAttribute('data-ai-tabs-hydrated', '1');
                    root.setAttribute('data-ai-tab-count', String(tabs.length));
                    root.setAttribute('data-ai-total-messages', String(totalMessages));
                }
                window.dispatchEvent(new CustomEvent('svmai-tabs-hydrated', { detail }));
            } catch { /* noop */ }
        }
    }, [tabs, activeTabId]);

    return {
        tabs: sortedTabs,
        activeTabId,
        activeTab,
        createTab,
        closeTab,
        switchToTab,
        updateTab,
        updateActiveTabMode,
        renameTab,
        duplicateTab,
        togglePin,
        forkTabAtMessage,
    };
}
