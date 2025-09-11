'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Clock, MessageCircle, Coins, Calendar, Search, Trash2, MoreVertical, RefreshCw, Database, X } from 'lucide-react';
import type { ChatTab } from '../hooks/useChatTabs';
import { chatPersistenceService } from '../../../lib/ai/services/ChatPersistenceService';
import type { AIChatModel, ChatSearchResult, MessageSearchResult } from '../../../lib/ai/models/ChatModels';

// Extend the Window interface to include SVMAI_HISTORY_RELOAD globally
declare global {
    interface Window {
        SVMAI_HISTORY_RELOAD?: () => void;
    }
}

interface HistoryPanelProps {
    tabs: ChatTab[];
    activeTabId: string | null;
    onTabClick: (tabId: string) => void;
    onTabDelete?: (tabId: string) => void;
    className?: string;
    userId?: string;
    enablePersistence?: boolean;
    onReload?: () => void;
}

interface ChatStats {
    id: string;
    name: string;
    createdAt: Date;
    lastUpdated: Date;
    messageCount: number;
    estimatedTokens: number;
    mode: 'agent' | 'assistant';
    status?: string;
}

// Estimate tokens from messages (rough calculation: ~4 chars per token)
const estimateTokensFromMessages = (messages: any[]): number => {
    if (!messages || messages.length === 0) return 0;
    const totalChars = messages.reduce((sum, msg) => {
        return sum + (typeof msg.content === 'string' ? msg.content.length : 0);
    }, 0);
    return Math.ceil(totalChars / 4);
};

// Format date for display
const formatDate = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return `${diffDays} days ago`;
    } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
};

// Format relative time
const formatRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export function HistoryPanel({
    tabs,
    activeTabId,
    onTabClick,
    onTabDelete,
    className = '',
    userId,
    enablePersistence = false,
    onReload
}: HistoryPanelProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'lastUpdated' | 'created' | 'messages' | 'tokens'>('lastUpdated');
    const [expandedItem, setExpandedItem] = useState<string | null>(null);
    const [persistedChats, setPersistedChats] = useState<AIChatModel[]>([]);
    const [searchResults, setSearchResults] = useState<MessageSearchResult[]>([]);
    const [chatSearchResults, setChatSearchResults] = useState<ChatSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoadingPersisted, setIsLoadingPersisted] = useState(false);
    const [searchMode, setSearchMode] = useState<'local' | 'semantic'>('local');
    const [searchType, setSearchType] = useState<'messages' | 'chats' | 'both'>('both');

    // Configure persistence service when component mounts or userId changes
    useEffect(() => {
        if (enablePersistence && userId) {
            chatPersistenceService.configure({
                autoSave: true,
                userId,
                enableSearch: true
            });
            loadPersistedChats();
        }
    }, [userId, enablePersistence]);

    // Auto-save active tab changes
    useEffect(() => {
        if (enablePersistence && userId && activeTabId) {
            const activeTab = tabs.find(tab => tab.id === activeTabId);
            if (activeTab) {
                chatPersistenceService.saveChatFromTab(activeTab).catch(console.error);
            }
        }
    }, [activeTabId, tabs, userId, enablePersistence]);

    const loadPersistedChats = async () => {
        if (!userId) return;

        setIsLoadingPersisted(true);
        try {
            const chats = await chatPersistenceService.getUserChats(userId);
            setPersistedChats(chats);
        } catch (error) {
            console.error('Error loading persisted chats:', error);
        } finally {
            setIsLoadingPersisted(false);
        }
    };

    // Expose loadPersistedChats globally for external triggers (e.g., from AIChatSidebar's closeTab)
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.SVMAI_HISTORY_RELOAD = loadPersistedChats;
            return () => {
                delete window.SVMAI_HISTORY_RELOAD;
            };
        }
    }, [loadPersistedChats]); // Depend on loadPersistedChats to ensure correct context for loading chats

    // Trigger reload when the onReload prop changes (from AIChatSidebar)
    useEffect(() => {
        if (onReload) {
            onReload(); // Call the actual reload function passed from AIChatSidebar
        }
    }, [onReload]);

    const performSemanticSearch = async (query: string) => {
        if (!query.trim() || !userId) return;

        setIsSearching(true);
        try {
            if (searchType === 'messages' || searchType === 'both') {
                const results = await chatPersistenceService.searchChatHistory({
                    query,
                    user_id: userId,
                    limit: 20,
                    include_context: true
                });
                setSearchResults(results);
            }

            if (searchType === 'chats' || searchType === 'both') {
                const chatResults = await chatPersistenceService.searchChats({
                    query,
                    user_id: userId,
                    limit: 10,
                    search_titles: true,
                    search_summaries: true
                });
                setChatSearchResults(chatResults);
            }
        } catch (error) {
            console.error('Error performing semantic search:', error);
            setSearchResults([]);
            setChatSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    // Handle search query changes
    useEffect(() => {
        if (searchMode === 'semantic' && searchQuery.trim()) {
            const debounceTimer = setTimeout(() => {
                performSemanticSearch(searchQuery);
            }, 500);
            return () => clearTimeout(debounceTimer);
        } else {
            setSearchResults([]);
            setChatSearchResults([]);
        }
    }, [searchQuery, searchMode, searchType, userId]);


    // Convert both active tabs and persisted chats to ChatStats for unified display
    const chatStats: ChatStats[] = useMemo(() => {
        // Create a map to keep track of chat IDs to avoid duplicates, preferring active tabs
        const uniqueChats = new Map<string, ChatStats>();

        // Add currently active tabs
        tabs.forEach(tab => {
            const createdAt = new Date(tab.lastActivity || Date.now());
            const lastUpdated = tab.messages && tab.messages.length > 0
                ? new Date(tab.lastActivity || Date.now())
                : createdAt;

            uniqueChats.set(tab.id, {
                id: tab.id,
                name: tab.name,
                createdAt,
                lastUpdated,
                messageCount: tab.messages ? tab.messages.length : 0,
                estimatedTokens: estimateTokensFromMessages(tab.messages || []),
                mode: tab.mode,
                status: tab.status
            });
        });

        // Add persisted chats, only if an active tab with the same ID doesn't already exist
        persistedChats.forEach(chat => {
            if (!uniqueChats.has(chat.id)) {
                uniqueChats.set(chat.id, {
                    id: chat.id,
                    name: chat.title,
                    createdAt: new Date(chat.created_at),
                    lastUpdated: new Date(chat.updated_at),
                    messageCount: chat.metadata.total_messages,
                    estimatedTokens: chat.metadata.estimated_tokens,
                    mode: chat.mode,
                    status: chat.status
                });
            }
        });

        return Array.from(uniqueChats.values());
    }, [tabs, persistedChats]);

    // Filter and sort chats
    const filteredAndSortedChats = useMemo(() => {
        let filtered = chatStats;

        // Apply search filter
        if (searchQuery.trim() && searchMode === 'local') { // Only apply local search filter for local mode
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(chat =>
                chat.name.toLowerCase().includes(query)
            );
        }

        // Apply sorting
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'lastUpdated':
                    return b.lastUpdated.getTime() - a.lastUpdated.getTime();
                case 'created':
                    return b.createdAt.getTime() - a.createdAt.getTime();
                case 'messages':
                    return b.messageCount - a.messageCount;
                case 'tokens':
                    return b.estimatedTokens - a.estimatedTokens;
                default:
                    return 0;
            }
        });

        return filtered;
    }, [chatStats, searchQuery, sortBy, searchMode]);

    // Calculate total stats
    const totalStats = useMemo(() => {
        return {
            totalChats: chatStats.length,
            totalMessages: chatStats.reduce((sum, chat) => sum + chat.messageCount, 0),
            totalTokens: chatStats.reduce((sum, chat) => sum + chat.estimatedTokens, 0)
        };
    }, [chatStats]);

    return (
        <div className={`flex flex-col h-full bg-black text-white ${className}`} data-ai-history-panel>
            {/* Header */}
            <div className="flex-shrink-0 p-4 border-b border-white/20">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold">Chat History</h2>
                        {enablePersistence && userId && (
                            <div className="flex items-center gap-1">
                                <Database size={14} className="text-green-400" />
                                <span className="text-xs text-green-400">Persisted</span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="text-sm text-white/60">
                            {totalStats.totalChats} chats
                        </div>
                        {enablePersistence && (
                            <button
                                onClick={loadPersistedChats}
                                disabled={isLoadingPersisted}
                                className="p-1 hover:bg-white/10 rounded transition-colors"
                                title="Refresh persisted chats"
                            >
                                <RefreshCw size={14} className={`text-white/60 ${isLoadingPersisted ? 'animate-spin' : ''}`} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Search */}
                <div className="relative mb-3">
                    <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50" />
                    <input
                        type="text"
                        placeholder={searchMode === 'semantic' ? "Semantic search across all chats..." : "Search chats..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white/10 border border-white/20 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-white/40 focus:bg-white/15"
                    />
                    {isSearching && (
                        <RefreshCw size={16} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/50 animate-spin" />
                    )}
                </div>

                {/* Search mode toggle (only show if persistence is enabled) */}
                {enablePersistence && userId && (
                    <div className="space-y-2 mb-3">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-white/60">Mode:</span>
                            <div className="flex bg-white/10 rounded-lg p-1">
                                <button
                                    onClick={() => setSearchMode('local')}
                                    className={`px-2 py-1 text-xs rounded transition-colors ${searchMode === 'local'
                                        ? 'bg-white/20 text-white'
                                        : 'text-white/60 hover:text-white/80'
                                        }`}
                                >
                                    Local
                                </button>
                                <button
                                    onClick={() => setSearchMode('semantic')}
                                    className={`px-2 py-1 text-xs rounded transition-colors ${searchMode === 'semantic'
                                        ? 'bg-white/20 text-white'
                                        : 'text-white/60 hover:text-white/80'
                                        }`}
                                >
                                    Semantic
                                </button>
                            </div>
                        </div>

                        {/* Search type toggle (only show for semantic search) */}
                        {searchMode === 'semantic' && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-white/60">Type:</span>
                                <div className="flex bg-white/10 rounded-lg p-1">
                                    <button
                                        onClick={() => setSearchType('both')}
                                        className={`px-2 py-1 text-xs rounded transition-colors ${searchType === 'both'
                                            ? 'bg-white/20 text-white'
                                            : 'text-white/60 hover:text-white/80'
                                            }`}
                                    >
                                        Both
                                    </button>
                                    <button
                                        onClick={() => setSearchType('chats')}
                                        className={`px-2 py-1 text-xs rounded transition-colors ${searchType === 'chats'
                                            ? 'bg-white/20 text-white'
                                            : 'text-white/60 hover:text-white/80'
                                            }`}
                                    >
                                        Chats
                                    </button>
                                    <button
                                        onClick={() => setSearchType('messages')}
                                        className={`px-2 py-1 text-xs rounded transition-colors ${searchType === 'messages'
                                            ? 'bg-white/20 text-white'
                                            : 'text-white/60 hover:text-white/80'
                                            }`}
                                    >
                                        Messages
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Sort selector */}
                <div className="flex items-center gap-2">
                    <span className="text-sm text-white/60">Sort by:</span>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm focus:outline-none focus:border-white/40"
                    >
                        <option value="lastUpdated">Last Updated</option>
                        <option value="created">Created</option>
                        <option value="messages">Messages</option>
                        <option value="tokens">Tokens</option>
                    </select>
                </div>

                {/* Summary stats */}
                <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                    <div className="bg-white/5 rounded p-2 text-center">
                        <div className="text-white/60">Total Messages</div>
                        <div className="font-semibold">{totalStats.totalMessages.toLocaleString()}</div>
                    </div>
                    <div className="bg-white/5 rounded p-2 text-center">
                        <div className="text-white/60">Est. Tokens</div>
                        <div className="font-semibold">{totalStats.totalTokens.toLocaleString()}</div>
                    </div>
                    <div className="bg-white/5 rounded p-2 text-center">
                        <div className="text-white/60">Active Chats</div>
                        <div className="font-semibold">{chatStats.filter(c => c.messageCount > 0).length}</div>
                    </div>
                </div>
            </div>

            {/* Chat list */}
            <div className="flex-1 overflow-y-auto p-2">
                {/* Show semantic search results if available */}
                {searchMode === 'semantic' && searchResults.length > 0 && (
                    <div className="mb-4">
                        <h3 className="text-sm font-medium text-white/80 mb-2 flex items-center gap-2">
                            <Search size={14} />
                            Search Results ({searchResults.length})
                        </h3>
                        <div className="space-y-2">
                            {searchResults.map((result, index) => (
                                <div
                                    key={`${result.message.id}-${index}`}
                                    className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 cursor-pointer hover:bg-blue-500/15 transition-colors"
                                    onClick={() => onTabClick(result.chat.id)}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-medium truncate text-blue-300">{result.chat.title}</h4>
                                            <div className="text-xs text-white/60 mt-1">
                                                Relevance: {(result.relevance_score * 100).toFixed(1)}%
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-sm text-white/80 bg-white/5 rounded p-2 mt-2">
                                        <div className="font-medium text-xs text-white/60 mb-1">
                                            {result.message.role === 'user' ? 'You' : 'Assistant'}:
                                        </div>
                                        {result.message.content.substring(0, 150)}
                                        {result.message.content.length > 150 && '...'}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <hr className="border-white/20 my-4" />
                    </div>
                )}

                {/* Show chat search results if available */}
                {searchMode === 'semantic' && chatSearchResults.length > 0 && (
                    <div className="mb-4">
                        <h3 className="text-sm font-medium text-white/80 mb-2 flex items-center gap-2">
                            <MessageCircle size={14} />
                            Chat Results ({chatSearchResults.length})
                        </h3>
                        <div className="space-y-2">
                            {chatSearchResults.map((result, index) => (
                                <div
                                    key={`${result.chat.id}-chat-${index}`}
                                    className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 cursor-pointer hover:bg-green-500/15 transition-colors"
                                    onClick={() => onTabClick(result.chat.id)}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-medium truncate text-green-300">{result.chat.title}</h4>
                                            <div className="text-xs text-white/60 mt-1">
                                                Relevance: {(result.relevance_score * 100).toFixed(1)}% • {result.messages.length} messages
                                            </div>
                                            <div className="text-xs text-white/50 mt-1">
                                                Matched: {result.matched_content.join(', ')}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-sm text-white/80 bg-white/5 rounded p-2 mt-2">
                                        <div className="font-medium text-xs text-white/60 mb-1">
                                            Summary:
                                        </div>
                                        {result.chat.metadata.summary || 'No summary available'}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <hr className="border-white/20 my-4" />
                    </div>
                )}

                {/* Regular chat list (show when no semantic search or when local search) */}
                {(searchMode === 'local' || !searchQuery.trim()) && filteredAndSortedChats.length > 0 && (
                    <div className="space-y-2">
                        {filteredAndSortedChats.map((chat) => (
                            <div
                                key={chat.id}
                                className={`group relative rounded-lg border transition-all cursor-pointer ${chat.id === activeTabId
                                    ? 'bg-white/10 border-white/30'
                                    : 'bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/20'
                                    }`}
                                onClick={() => onTabClick(chat.id)}
                            >
                                <div className="p-3">
                                    {/* Chat name and mode */}
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-medium truncate">{chat.name}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-xs px-2 py-0.5 rounded ${chat.mode === 'agent' ? 'bg-blue-500/20 text-blue-300' : 'bg-green-500/20 text-green-300'
                                                    }`}>
                                                    {chat.mode === 'agent' ? 'AI Agent' : 'Assistant'}
                                                </span>
                                                {chat.status && (
                                                    <span className="text-xs text-white/50">{chat.status}</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Action menu */}
                                        <div className="relative">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setExpandedItem(expandedItem === chat.id ? null : chat.id);
                                                }}
                                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-opacity"
                                                title="More options"
                                            >
                                                <MoreVertical size={14} />
                                            </button>

                                            {expandedItem === chat.id && (
                                                <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-white/20 rounded-md shadow-lg z-10">
                                                    {/* Check if this chat is currently an active tab */}
                                                    {tabs.find(tab => tab.id === chat.id) ? (
                                                        // If it's an active tab, show "Close Tab" option
                                                        onTabDelete && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onTabDelete(chat.id);
                                                                    setExpandedItem(null);
                                                                }}
                                                                className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2 text-orange-400"
                                                            >
                                                                <X size={14} />
                                                                Close Tab
                                                            </button>
                                                        )
                                                    ) : (
                                                        // If it's a persisted chat, show "Delete from History" option
                                                        enablePersistence && userId && (
                                                            <button
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    try {
                                                                        const success = await chatPersistenceService.deleteUserChat(chat.id);
                                                                        if (success) {
                                                                            // Refresh persisted chats to update UI
                                                                            await loadPersistedChats();
                                                                        }
                                                                    } catch (error) {
                                                                        console.error('Error deleting chat from history:', error);
                                                                    }
                                                                    setExpandedItem(null);
                                                                }}
                                                                className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2 text-red-400"
                                                            >
                                                                <Trash2 size={14} />
                                                                Delete from History
                                                            </button>
                                                        )
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Stats row */}
                                    <div className="grid grid-cols-2 gap-4 text-xs text-white/60">
                                        <div className="flex items-center gap-1">
                                            <MessageCircle size={12} />
                                            <span>{chat.messageCount} messages</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Coins size={12} />
                                            <span>{chat.estimatedTokens.toLocaleString()} tokens</span>
                                        </div>
                                    </div>

                                    {/* Dates row */}
                                    <div className="grid grid-cols-2 gap-4 text-xs text-white/50 mt-2">
                                        <div className="flex items-center gap-1">
                                            <Calendar size={12} />
                                            <span>Created {formatDate(chat.createdAt)}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Clock size={12} />
                                            <span>Updated {formatRelativeTime(chat.lastUpdated)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Show empty state when no chats or search results */}
                {((searchMode === 'local' || !searchQuery.trim()) && filteredAndSortedChats.length === 0) &&
                    (searchMode !== 'semantic' || searchResults.length === 0) && (
                        <div className="text-center text-white/50 py-8">
                            {searchQuery ? 'No chats found matching your search.' : 'No chat history yet.'}
                            {enablePersistence && userId && !isLoadingPersisted && (
                                <div className="mt-2 text-xs">
                                    Your chats will be automatically saved when logged in.
                                </div>
                            )}
                        </div>
                    )}
            </div>
        </div>
    );
}
