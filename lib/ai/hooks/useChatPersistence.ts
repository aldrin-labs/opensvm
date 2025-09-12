import { useEffect, useCallback, useState } from 'react';
import { chatPersistenceService } from '../services/ChatPersistenceService';
import type { AIChatModel, MessageSearchResult } from '../models/ChatModels';
import type { ChatTab } from '../../../components/ai/hooks/useChatTabs';

export interface UseChatPersistenceOptions {
    userId?: string;
    autoSave?: boolean;
    enableSearch?: boolean;
}

export interface UseChatPersistenceReturn {
    // Configuration
    isConfigured: boolean;
    isAutoSaveEnabled: boolean;
    isSearchEnabled: boolean;

    // Actions
    configure: (options: UseChatPersistenceOptions) => void;
    saveChat: (chatTab: ChatTab) => Promise<boolean>;
    searchChats: (query: string) => Promise<MessageSearchResult[]>;
    loadChatHistory: () => Promise<AIChatModel[]>;
    deleteChat: (chatId: string) => Promise<boolean>;

    // Auto-save
    autoSaveChat: (chatTab: ChatTab) => void;

    // Real-time search
    realtimeSearch: (query: string) => Promise<MessageSearchResult[]>;

    // State
    searchResults: MessageSearchResult[];
    chatHistory: AIChatModel[];
    isLoading: boolean;
    error: string | null;
}

export function useChatPersistence(options?: UseChatPersistenceOptions): UseChatPersistenceReturn {
    const [isConfigured, setIsConfigured] = useState(false);
    const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState(false);
    const [isSearchEnabled, setIsSearchEnabled] = useState(false);
    const [searchResults, setSearchResults] = useState<MessageSearchResult[]>([]);
    const [chatHistory, setChatHistory] = useState<AIChatModel[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const configure = useCallback((newOptions: UseChatPersistenceOptions) => {
        try {
            chatPersistenceService.configure({
                autoSave: newOptions.autoSave || false,
                userId: newOptions.userId,
                enableSearch: newOptions.enableSearch || false
            });

            setIsConfigured(!!newOptions.userId);
            setIsAutoSaveEnabled(newOptions.autoSave || false);
            setIsSearchEnabled(newOptions.enableSearch || false);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Configuration failed');
        }
    }, []);

    const loadChatHistory = useCallback(async (): Promise<AIChatModel[]> => {
        try {
            setIsLoading(true);
            setError(null);
            const history = await chatPersistenceService.getUserChatHistory();
            setChatHistory(history);
            return history;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load chat history');
            return [];
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Configure the service when options change
    useEffect(() => {
        if (options) {
            configure(options);
        }
    }, [options, configure]);

    const saveChat = useCallback(async (chatTab: ChatTab): Promise<boolean> => {
        try {
            setIsLoading(true);
            setError(null);
            const success = await chatPersistenceService.saveChatFromTab(chatTab);

            if (success) {
                // Refresh chat history after successful save
                await loadChatHistory();
            }

            return success;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save chat');
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [loadChatHistory]);

    const searchChats = useCallback(async (query: string): Promise<MessageSearchResult[]> => {
        try {
            setIsLoading(true);
            setError(null);
            const results = await chatPersistenceService.searchUserChats(query);
            setSearchResults(results);
            return results;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Search failed');
            return [];
        } finally {
            setIsLoading(false);
        }
    }, []);

    const deleteChat = useCallback(async (chatId: string): Promise<boolean> => {
        try {
            setIsLoading(true);
            setError(null);
            const success = await chatPersistenceService.deleteUserChat(chatId);

            if (success) {
                // Remove from local state
                setChatHistory(prev => prev.filter(chat => chat.id !== chatId));
            }

            return success;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete chat');
            return false;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const autoSaveChat = useCallback((chatTab: ChatTab) => {
        if (isAutoSaveEnabled) {
            chatPersistenceService.autoSaveChat(chatTab).catch(err => {
                console.error('Auto-save failed:', err);
                setError('Auto-save failed');
            });
        }
    }, [isAutoSaveEnabled]);

    const realtimeSearch = useCallback(async (query: string): Promise<MessageSearchResult[]> => {
        if (!isSearchEnabled || query.length < 3) {
            return [];
        }

        try {
            const results = await chatPersistenceService.realtimeSearch(query);
            setSearchResults(results);
            return results;
        } catch (err) {
            console.error('Real-time search failed:', err);
            return [];
        }
    }, [isSearchEnabled]);

    // Auto-load chat history when configured
    useEffect(() => {
        if (isConfigured && isSearchEnabled) {
            loadChatHistory().catch(console.error);
        }
    }, [isConfigured, isSearchEnabled, loadChatHistory]);

    return {
        // Configuration
        isConfigured,
        isAutoSaveEnabled,
        isSearchEnabled,

        // Actions
        configure,
        saveChat,
        searchChats,
        loadChatHistory,
        deleteChat,

        // Auto-save
        autoSaveChat,

        // Real-time search
        realtimeSearch,

        // State
        searchResults,
        chatHistory,
        isLoading,
        error
    };
}
