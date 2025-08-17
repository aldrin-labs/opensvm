/**
 * Phase 3.3: Memory Management & Message Limits
 * Provides automatic memory management for large conversation histories
 */

import React from 'react';
import { Message } from '../types';

export interface MemoryManagementConfig {
    maxMessages?: number;
    maxTokens?: number;
    retentionRatio?: number; // How much to keep when limit is reached (0.5 = keep 50%)
    preserveRecent?: number; // Always preserve N most recent messages
    preserveImportant?: boolean; // Preserve messages marked as important
}

export interface MemoryStats {
    totalMessages: number;
    estimatedTokens: number;
    isNearLimit: boolean;
    percentUsed: number;
    lastCleanup?: number;
}

const DEFAULT_CONFIG: Required<MemoryManagementConfig> = {
    maxMessages: 1000,
    maxTokens: 50000,
    retentionRatio: 0.7,
    preserveRecent: 50,
    preserveImportant: true
};

// Simple token estimation function
function estimateTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
}

// Message importance scoring
function getMessageImportanceScore(message: Message, index: number, totalMessages: number): number {
    let score = 0;

    // Recent messages are more important
    const recencyBonus = (totalMessages - index) / totalMessages * 2;
    score += recencyBonus;

    // Assistant messages with structured content are important
    if (message.role === 'assistant') {
        if (message.content.includes('```') || message.content.includes('<REASONING>')) {
            score += 1.5;
        }
        if (message.content.length > 500) {
            score += 1;
        }
    }

    // User questions/commands are important
    if (message.role === 'user') {
        if (message.content.startsWith('/') || message.content.includes('?')) {
            score += 1;
        }
    }

    return score;
}

export class MemoryManager {
    private config: Required<MemoryManagementConfig>;
    private lastCleanup = 0;

    constructor(config: MemoryManagementConfig = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // Check if cleanup is needed
    shouldCleanup(messages: Message[]): boolean {
        const stats = this.getMemoryStats(messages);
        return stats.isNearLimit ||
            messages.length > this.config.maxMessages ||
            stats.estimatedTokens > this.config.maxTokens;
    }

    // Get current memory statistics
    getMemoryStats(messages: Message[]): MemoryStats {
        const totalMessages = messages.length;
        const estimatedTokens = messages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);

        const messageProgress = totalMessages / this.config.maxMessages;
        const tokenProgress = estimatedTokens / this.config.maxTokens;
        const percentUsed = Math.max(messageProgress, tokenProgress) * 100;

        return {
            totalMessages,
            estimatedTokens,
            isNearLimit: percentUsed > 85,
            percentUsed,
            lastCleanup: this.lastCleanup
        };
    }

    // Perform intelligent cleanup
    cleanupMessages(messages: Message[]): {
        cleaned: Message[],
        removedCount: number,
        preservedImportant: number
    } {
        const stats = this.getMemoryStats(messages);

        if (!this.shouldCleanup(messages)) {
            return { cleaned: messages, removedCount: 0, preservedImportant: 0 };
        }

        const targetSize = Math.floor(messages.length * this.config.retentionRatio);
        const toRemove = messages.length - targetSize;

        if (toRemove <= 0) {
            return { cleaned: messages, removedCount: 0, preservedImportant: 0 };
        }

        // Always preserve recent messages
        const recentMessages = messages.slice(-this.config.preserveRecent);
        const candidatesForRemoval = messages.slice(0, -this.config.preserveRecent);

        // Score messages by importance
        const scoredCandidates = candidatesForRemoval.map((msg, idx) => ({
            message: msg,
            originalIndex: idx,
            score: getMessageImportanceScore(msg, idx, messages.length)
        }));

        // Sort by importance (lowest first for removal)
        scoredCandidates.sort((a, b) => a.score - b.score);

        // Remove least important messages
        const toKeepFromCandidates = Math.max(0, candidatesForRemoval.length - toRemove);
        const keptCandidates = scoredCandidates
            .slice(toRemove)
            .sort((a, b) => a.originalIndex - b.originalIndex)
            .map(item => item.message);

        const preservedImportant = scoredCandidates
            .slice(0, toRemove)
            .filter(item => item.score > 2).length;

        const cleaned = [...keptCandidates, ...recentMessages];

        this.lastCleanup = Date.now();

        return {
            cleaned,
            removedCount: toRemove,
            preservedImportant
        };
    }

    // Update configuration
    updateConfig(newConfig: Partial<MemoryManagementConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    // Get configuration
    getConfig(): MemoryManagementConfig {
        return { ...this.config };
    }
}

// React hook for memory management
export function useMemoryManagement(
    messages: Message[],
    config?: MemoryManagementConfig,
    enabled = true
): {
    manager: MemoryManager;
    stats: MemoryStats;
    shouldCleanup: boolean;
    cleanup: () => { cleaned: Message[], removedCount: number, preservedImportant: number };
} {
    const manager = React.useMemo(() => new MemoryManager(config), [config]);
    const stats = React.useMemo(() => manager.getMemoryStats(messages), [manager, messages]);
    const shouldCleanup = React.useMemo(() => enabled && manager.shouldCleanup(messages), [enabled, manager, messages]);

    const cleanup = React.useCallback(() => {
        return manager.cleanupMessages(messages);
    }, [manager, messages]);

    return {
        manager,
        stats,
        shouldCleanup,
        cleanup
    };
}

// Helper for tracking memory usage
export function trackMemoryUsage(stats: MemoryStats): void {
    if (typeof window !== 'undefined' && (window as any).track) {
        (window as any).track('memory_usage', {
            totalMessages: stats.totalMessages,
            estimatedTokens: stats.estimatedTokens,
            percentUsed: stats.percentUsed,
            isNearLimit: stats.isNearLimit,
            timestamp: Date.now()
        });
    }
}
