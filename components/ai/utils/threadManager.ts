/**
 * Phase 3.3.2: Thread Storage & Management
 * LocalStorage-based store with list management sorted by updatedAt desc
 */

import {
    ConversationMetadata,
    ConversationThread,
    ConversationMessage,
    createDefaultMetadata,
    updateConversationMetadata,
    migrateConversationMetadata,
    CONVERSATION_SCHEMA_VERSION
} from '../types/conversation';
import { track } from '../../../lib/ai/telemetry';

// Storage keys
const THREADS_LIST_KEY = 'svmai_conversation_threads';
const THREAD_PREFIX = 'svmai_thread_';
// Maximum number of threads to keep in storage (chosen to balance performance and storage limits; adjust as needed)
export const MAX_THREADS = Number(process.env.NEXT_PUBLIC_SVMAI_MAX_THREADS) || 25;

export interface ThreadListItem {
    id: string;
    meta: ConversationMetadata;
}

export interface ThreadStorageStats {
    totalThreads: number;
    pinnedThreads: number;
    averageMessageCount: number;
    oldestThreadDate: string | null;
    newestThreadDate: string | null;
    totalStorageKB: number;
}

class ThreadManager {
    private listCache: ThreadListItem[] | null = null;

    // Get list of all threads sorted by pinned status and updatedAt
    async getThreadsList(): Promise<ThreadListItem[]> {
        if (this.listCache) {
            return this.listCache;
        }

        try {
            const stored = localStorage.getItem(THREADS_LIST_KEY);
            if (!stored) {
                this.listCache = [];
                return [];
            }

            const parsed = JSON.parse(stored);
            const migrated = parsed.map((item: any) => ({
                id: item.id,
                meta: migrateConversationMetadata(item.meta)
            }));

            // Sort: pinned first, then by updatedAt desc
            migrated.sort((a: ThreadListItem, b: ThreadListItem) => {
                if (a.meta.pinned !== b.meta.pinned) {
                    return a.meta.pinned ? -1 : 1;
                }
                return new Date(b.meta.updatedAt).getTime() - new Date(a.meta.updatedAt).getTime();
            });

            this.listCache = migrated;
            return migrated;
        } catch (error) {
            console.error('Failed to load threads list:', error);
            this.listCache = [];
            return [];
        }
    }

    // Save threads list to storage
    private async saveThreadsList(threads: ThreadListItem[]): Promise<void> {
        try {
            // Enforce max threads limit (keep pinned + most recent)
            let filteredThreads = threads;
            if (threads.length > MAX_THREADS) {
                const pinned = threads.filter(t => t.meta.pinned);
                const unpinned = threads.filter(t => !t.meta.pinned);

                // Keep all pinned + most recent unpinned up to MAX_THREADS
                const maxUnpinned = Math.max(0, MAX_THREADS - pinned.length);
                filteredThreads = [
                    ...pinned,
                    ...unpinned.slice(0, maxUnpinned)
                ];

                // Clean up removed threads from storage
                const removedIds = unpinned.slice(maxUnpinned).map(t => t.id);
                for (const id of removedIds) {
                    this.deleteThreadData(id);
                }

                track('threads_pruned', {
                    removed_count: removedIds.length,
                    total_before: threads.length,
                    total_after: filteredThreads.length
                });
            }

            localStorage.setItem(THREADS_LIST_KEY, JSON.stringify(filteredThreads));
            this.listCache = filteredThreads;
        } catch (error) {
            console.error('Failed to save threads list:', error);
            throw error;
        }
    }

    // Load full thread data including messages
    async loadThread(threadId: string): Promise<ConversationThread | null> {
        try {
            const key = THREAD_PREFIX + threadId;
            const stored = localStorage.getItem(key);

            if (!stored) {
                return null;
            }

            const parsed = JSON.parse(stored);

            // Migrate metadata if needed
            const thread: ConversationThread = {
                meta: migrateConversationMetadata(parsed.meta),
                messages: parsed.messages || []
            };

            track('thread_loaded', {
                thread_id: threadId,
                message_count: thread.messages.length,
                age_days: Math.floor((Date.now() - new Date(thread.meta.createdAt).getTime()) / (1000 * 60 * 60 * 24))
            });

            return thread;
        } catch (error) {
            console.error(`Failed to load thread ${threadId}:`, error);
            return null;
        }
    }

    // Save full thread data
    async saveThread(thread: ConversationThread): Promise<void> {
        try {
            const key = THREAD_PREFIX + thread.meta.id;

            // Update metadata based on current messages
            const updatedMeta = updateConversationMetadata(thread.meta, thread.messages);
            const threadToSave = {
                ...thread,
                meta: updatedMeta
            };

            // Save thread data
            localStorage.setItem(key, JSON.stringify(threadToSave));

            // Update threads list
            const threads = await this.getThreadsList();
            const existingIndex = threads.findIndex(t => t.id === thread.meta.id);

            const listItem: ThreadListItem = {
                id: thread.meta.id,
                meta: updatedMeta
            };

            if (existingIndex >= 0) {
                threads[existingIndex] = listItem;
            } else {
                threads.unshift(listItem);
            }

            await this.saveThreadsList(threads);

            track('thread_saved', {
                thread_id: thread.meta.id,
                message_count: thread.messages.length,
                is_new: existingIndex < 0
            });
        } catch (error) {
            console.error('Failed to save thread:', error);
            throw error;
        }
    }

    // Create new thread
    async createThread(initialMessage?: ConversationMessage): Promise<ConversationThread> {
        const meta = createDefaultMetadata();
        const messages = initialMessage ? [initialMessage] : [];

        const thread: ConversationThread = {
            meta,
            messages
        };

        await this.saveThread(thread);

        track('thread_created', {
            thread_id: meta.id,
            has_initial_message: !!initialMessage
        });

        return thread;
    }

    // Delete thread
    async deleteThread(threadId: string): Promise<boolean> {
        try {
            // Remove from threads list
            const threads = await this.getThreadsList();
            const updatedThreads = threads.filter(t => t.id !== threadId);

            if (updatedThreads.length === threads.length) {
                return false; // Thread not found
            }

            await this.saveThreadsList(updatedThreads);

            // Remove thread data
            this.deleteThreadData(threadId);

            track('thread_deleted', {
                thread_id: threadId
            });

            return true;
        } catch (error) {
            console.error(`Failed to delete thread ${threadId}:`, error);
            return false;
        }
    }

    // Update thread metadata (for rename, pin operations)
    async updateThreadMetadata(threadId: string, updates: Partial<ConversationMetadata>): Promise<boolean> {
        try {
            const thread = await this.loadThread(threadId);
            if (!thread) return false;

            const updatedMeta = {
                ...thread.meta,
                ...updates,
                updatedAt: new Date().toISOString(),
                version: CONVERSATION_SCHEMA_VERSION
            };

            const updatedThread = {
                ...thread,
                meta: updatedMeta
            };

            await this.saveThread(updatedThread);

            track('thread_metadata_updated', {
                thread_id: threadId,
                updated_fields: Object.keys(updates)
            });

            return true;
        } catch (error) {
            console.error(`Failed to update thread metadata ${threadId}:`, error);
            return false;
        }
    }

    // Get storage statistics
    async getStorageStats(): Promise<ThreadStorageStats> {
        const threads = await this.getThreadsList();

        if (threads.length === 0) {
            return {
                totalThreads: 0,
                pinnedThreads: 0,
                averageMessageCount: 0,
                oldestThreadDate: null,
                newestThreadDate: null,
                totalStorageKB: 0
            };
        }

        const pinnedCount = threads.filter(t => t.meta.pinned).length;
        const avgMessageCount = threads.reduce((sum, t) => sum + t.meta.messageCount, 0) / threads.length;
        const dates = threads.map(t => new Date(t.meta.updatedAt).getTime());

        // Calculate storage size
        let totalSize = 0;
        for (const thread of threads) {
            const key = THREAD_PREFIX + thread.id;
            const stored = localStorage.getItem(key);
            if (stored) {
                totalSize += stored.length * 2; // UTF-16 encoding
            }
        }

        return {
            totalThreads: threads.length,
            pinnedThreads: pinnedCount,
            averageMessageCount: Math.round(avgMessageCount * 10) / 10,
            oldestThreadDate: new Date(Math.min(...dates)).toISOString(),
            newestThreadDate: new Date(Math.max(...dates)).toISOString(),
            totalStorageKB: Math.round(totalSize / 1024 * 10) / 10
        };
    }

    // Clear cache (force reload from storage)
    clearCache(): void {
        this.listCache = null;
    }

    // Internal helper to delete thread data
    private deleteThreadData(threadId: string): void {
        const key = THREAD_PREFIX + threadId;
        localStorage.removeItem(key);
    }

    // Export all threads for backup
    async exportAllThreads(): Promise<{ threads: ConversationThread[], stats: ThreadStorageStats }> {
        const threadsList = await this.getThreadsList();
        const threads: ConversationThread[] = [];

        for (const item of threadsList) {
            const thread = await this.loadThread(item.id);
            if (thread) {
                threads.push(thread);
            }
        }

        const stats = await this.getStorageStats();

        track('threads_exported', {
            thread_count: threads.length,
            total_messages: threads.reduce((sum, t) => sum + t.messages.length, 0)
        });

        return { threads, stats };
    }
}

// Singleton instance
export const threadManager = new ThreadManager();

// Global API exposure for agents
if (typeof window !== 'undefined') {
    window.SVMAI = window.SVMAI || {};
    window.SVMAI.threads = () => threadManager.getThreadsList();
    window.SVMAI.loadThread = (id: string) => threadManager.loadThread(id);
    window.SVMAI.getStorageStats = () => threadManager.getStorageStats();
}
