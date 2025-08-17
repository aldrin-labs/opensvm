/**
 * Phase 3.3.2 & 3.3.3: Thread List UI with Rename & Pin Actions
 * Provides UI for past sessions with inline editing and organization
 */

import React, { useState, useEffect, useRef } from 'react';
import { ConversationMetadata } from '../types/conversation';
import { threadManager, ThreadListItem } from '../utils/threadManager';
import { track } from '../../../lib/ai/telemetry';

interface ThreadListProps {
    onSelectThread: (threadId: string) => void;
    currentThreadId?: string;
    className?: string;
}

interface EditingState {
    threadId: string;
    title: string;
}

export function ThreadList({
    onSelectThread,
    currentThreadId,
    className = ''
}: ThreadListProps) {
    const [threads, setThreads] = useState<ThreadListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<EditingState | null>(null);
    const [error, setError] = useState<string | null>(null);
    const editInputRef = useRef<HTMLInputElement>(null);

    // Load threads on mount and when thread operations occur
    const loadThreads = async () => {
        try {
            setLoading(true);
            setError(null);
            const threadsList = await threadManager.getThreadsList();
            setThreads(threadsList);

            track('thread_list_loaded', {
                thread_count: threadsList.length,
                pinned_count: threadsList.filter(t => t.meta.pinned).length
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load threads');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadThreads();
    }, []);

    // Focus input when editing starts
    useEffect(() => {
        if (editing && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editing]);

    const handleSelectThread = (threadId: string) => {
        onSelectThread(threadId);

        track('thread_open', {
            thread_id: threadId,
            is_current: threadId === currentThreadId
        });
    };

    const handleStartEdit = (thread: ThreadListItem) => {
        setEditing({
            threadId: thread.id,
            title: thread.meta.title
        });

        track('thread_rename_start', {
            thread_id: thread.id,
            current_title: thread.meta.title
        });
    };

    const handleSaveEdit = async () => {
        if (!editing) return;

        const newTitle = editing.title.trim();
        if (!newTitle) {
            handleCancelEdit();
            return;
        }

        try {
            const success = await threadManager.updateThreadMetadata(editing.threadId, {
                title: newTitle
            });

            if (success) {
                await loadThreads(); // Refresh list
                track('thread_renamed', {
                    thread_id: editing.threadId,
                    new_title: newTitle
                });
            }
        } catch (err) {
            console.error('Failed to rename thread:', err);
        }

        setEditing(null);
    };

    const handleCancelEdit = () => {
        track('thread_rename_cancel', {
            thread_id: editing?.threadId
        });
        setEditing(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSaveEdit();
        } else if (e.key === 'Escape') {
            handleCancelEdit();
        }
    };

    const handleTogglePin = async (thread: ThreadListItem) => {
        try {
            const success = await threadManager.updateThreadMetadata(thread.id, {
                pinned: !thread.meta.pinned
            });

            if (success) {
                await loadThreads(); // Refresh list to update sort order
                track('thread_pin_toggled', {
                    thread_id: thread.id,
                    pinned: !thread.meta.pinned
                });
            }
        } catch (err) {
            console.error('Failed to toggle thread pin:', err);
        }
    };

    const handleDeleteThread = async (thread: ThreadListItem) => {
        if (!confirm(`Delete "${thread.meta.title}"? This cannot be undone.`)) {
            return;
        }

        try {
            const success = await threadManager.deleteThread(thread.id);
            if (success) {
                await loadThreads(); // Refresh list
                track('thread_deleted_from_list', {
                    thread_id: thread.id,
                    title: thread.meta.title
                });
            }
        } catch (err) {
            console.error('Failed to delete thread:', err);
        }
    };

    const formatRelativeTime = (dateString: string): string => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        const diffDays = diffHours / 24;

        if (diffHours < 1) {
            return 'Just now';
        } else if (diffHours < 24) {
            return `${Math.floor(diffHours)}h ago`;
        } else if (diffDays < 7) {
            return `${Math.floor(diffDays)}d ago`;
        } else {
            return date.toLocaleDateString();
        }
    };

    if (loading) {
        return (
            <div className={`p-4 ${className}`} data-ai-threads="loading">
                <div className="flex items-center space-x-2 text-gray-400">
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">Loading conversations...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`p-4 ${className}`} data-ai-threads="error">
                <div className="text-red-400 text-sm mb-2">Failed to load conversations</div>
                <button
                    onClick={loadThreads}
                    className="text-blue-400 hover:text-blue-300 text-sm underline"
                >
                    Try again
                </button>
            </div>
        );
    }

    if (threads.length === 0) {
        return (
            <div className={`p-4 text-center text-gray-400 ${className}`} data-ai-threads="empty">
                <p className="text-sm">No conversations yet</p>
                <p className="text-xs mt-1">Start a new conversation to see it here</p>
            </div>
        );
    }

    // Group threads by pinned status
    const pinnedThreads = threads.filter(t => t.meta.pinned);
    const unpinnedThreads = threads.filter(t => !t.meta.pinned);

    const renderThread = (thread: ThreadListItem) => {
        const isEditing = editing?.threadId === thread.id;
        const isCurrent = thread.id === currentThreadId;

        return (
            <div
                key={thread.id}
                className={`group relative border border-gray-700 rounded-lg p-3 hover:bg-gray-800/50 transition-colors ${isCurrent ? 'ring-2 ring-blue-500 bg-gray-800/30' : ''
                    }`}
                data-thread-id={thread.id}
                data-ai-thread-item={isCurrent ? 'current' : 'available'}
            >
                {/* Pin indicator */}
                {thread.meta.pinned && (
                    <div className="absolute top-2 right-2">
                        <div className="w-2 h-2 bg-blue-400 rounded-full" title="Pinned" />
                    </div>
                )}

                {/* Title (editable) */}
                <div className="mb-2">
                    {isEditing ? (
                        <input
                            ref={editInputRef}
                            type="text"
                            value={editing.title}
                            onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                            onKeyDown={handleKeyDown}
                            onBlur={handleSaveEdit}
                            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            data-ai-action="edit-thread-title"
                        />
                    ) : (
                        <h3
                            className="text-white text-sm font-medium cursor-pointer hover:text-blue-300 truncate"
                            onClick={() => handleSelectThread(thread.id)}
                            title={thread.meta.title}
                        >
                            {thread.meta.title}
                        </h3>
                    )}
                </div>

                {/* Thread metadata */}
                <div className="text-xs text-gray-400 space-y-1">
                    <div className="flex justify-between">
                        <span>{thread.meta.messageCount} messages</span>
                        <span>{formatRelativeTime(thread.meta.updatedAt)}</span>
                    </div>

                    {thread.meta.lastMessage && (
                        <div className="text-gray-500 truncate">
                            <span className="capitalize">{thread.meta.lastMessage.role}: </span>
                            {thread.meta.lastMessage.content}
                        </div>
                    )}

                    {thread.meta.summary && (
                        <div className="text-gray-500 text-xs italic truncate">
                            {thread.meta.summary}
                        </div>
                    )}
                </div>

                {/* Actions (visible on hover) */}
                <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePin(thread);
                        }}
                        className="p-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white"
                        title={thread.meta.pinned ? 'Unpin' : 'Pin'}
                        data-ai-action="toggle-thread-pin"
                    >
                        {thread.meta.pinned ? '📌' : '📍'}
                    </button>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(thread);
                        }}
                        className="p-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white"
                        title="Rename"
                        data-ai-action="rename-thread"
                    >
                        ✏️
                    </button>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteThread(thread);
                        }}
                        className="p-1 rounded bg-gray-700 hover:bg-red-600 text-gray-300 hover:text-white"
                        title="Delete"
                        data-ai-action="delete-thread"
                    >
                        🗑️
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className={`space-y-3 ${className}`} data-ai-threads="list">
            {/* Header */}
            <div className="flex justify-between items-center px-2">
                <h2 className="text-lg font-semibold text-white">Conversations</h2>
                <span className="text-xs text-gray-400">
                    {threads.length}/{25}
                </span>
            </div>

            {/* Pinned threads section */}
            {pinnedThreads.length > 0 && (
                <div>
                    <h3 className="text-sm font-medium text-gray-300 mb-2 px-2">Pinned</h3>
                    <div className="space-y-2">
                        {pinnedThreads.map(renderThread)}
                    </div>
                </div>
            )}

            {/* Recent threads section */}
            {unpinnedThreads.length > 0 && (
                <div>
                    {pinnedThreads.length > 0 && (
                        <h3 className="text-sm font-medium text-gray-300 mb-2 px-2 mt-4">Recent</h3>
                    )}
                    <div className="space-y-2">
                        {unpinnedThreads.map(renderThread)}
                    </div>
                </div>
            )}

            {/* Refresh button */}
            <div className="pt-2 border-t border-gray-700">
                <button
                    onClick={loadThreads}
                    className="w-full text-center text-xs text-gray-400 hover:text-white py-2"
                    data-ai-action="refresh-threads"
                >
                    Refresh
                </button>
            </div>
        </div>
    );
}
