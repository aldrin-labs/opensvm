'use client';

import React, { useState, useMemo } from 'react';
import { Clock, MessageCircle, Coins, Calendar, Search, Trash2, MoreVertical } from 'lucide-react';
import type { ChatTab } from '../hooks/useChatTabs';

interface HistoryPanelProps {
    tabs: ChatTab[];
    activeTabId: string | null;
    onTabClick: (tabId: string) => void;
    onTabDelete?: (tabId: string) => void;
    className?: string;
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
    className = ''
}: HistoryPanelProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'lastUpdated' | 'created' | 'messages' | 'tokens'>('lastUpdated');
    const [expandedItem, setExpandedItem] = useState<string | null>(null);

    // Convert tabs to stats with proper date handling
    const chatStats: ChatStats[] = useMemo(() => {
        return tabs.map(tab => {
            // Use lastActivity as creation time (or current time if not available)
            const createdAt = new Date(tab.lastActivity || Date.now());
            // For last updated, use the most recent activity or creation time
            const lastUpdated = tab.messages && tab.messages.length > 0
                ? new Date(tab.lastActivity || Date.now())
                : createdAt;

            return {
                id: tab.id,
                name: tab.name,
                createdAt,
                lastUpdated,
                messageCount: tab.messages ? tab.messages.length : 0,
                estimatedTokens: estimateTokensFromMessages(tab.messages || []),
                mode: tab.mode,
                status: tab.status
            };
        });
    }, [tabs]);    // Filter and sort chats
    const filteredAndSortedChats = useMemo(() => {
        let filtered = chatStats;

        // Apply search filter
        if (searchQuery.trim()) {
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
    }, [chatStats, searchQuery, sortBy]);

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
                    <h2 className="text-lg font-semibold">Chat History</h2>
                    <div className="text-sm text-white/60">
                        {totalStats.totalChats} chats
                    </div>
                </div>

                {/* Search */}
                <div className="relative mb-3">
                    <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50" />
                    <input
                        type="text"
                        placeholder="Search chats..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white/10 border border-white/20 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-white/40 focus:bg-white/15"
                    />
                </div>

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
                {filteredAndSortedChats.length === 0 ? (
                    <div className="text-center text-white/50 py-8">
                        {searchQuery ? 'No chats found matching your search.' : 'No chat history yet.'}
                    </div>
                ) : (
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
                                                <div className="absolute right-0 top-full mt-1 w-32 bg-slate-800 border border-white/20 rounded-md shadow-lg z-10">
                                                    {onTabDelete && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onTabDelete(chat.id);
                                                                setExpandedItem(null);
                                                            }}
                                                            className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2 text-red-400"
                                                        >
                                                            <Trash2 size={14} />
                                                            Delete
                                                        </button>
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
            </div>
        </div>
    );
}
