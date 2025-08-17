'use client';

import React from 'react';
import { Copy, Bookmark, Share2, GitBranch, Search, Globe } from 'lucide-react';
import type { Message } from '../types';

export type MessageActionType = 'copy' | 'save' | 'share' | 'fork' | 'site-search' | 'web-search';

interface MessageActionsProps {
    message: Message;
    onAction: (action: MessageActionType, message: Message) => void;
    className?: string;
}

export function MessageActions({ message, onAction, className = '' }: MessageActionsProps) {
    const actions = [
        {
            type: 'copy' as const,
            icon: Copy,
            label: 'Copy message',
            shortcut: 'Ctrl+C'
        },
        {
            type: 'save' as const,
            icon: Bookmark,
            label: 'Save to Knowledge',
            shortcut: 'Ctrl+S'
        },
        {
            type: 'share' as const,
            icon: Share2,
            label: 'Share message',
            shortcut: null
        },
        {
            type: 'fork' as const,
            icon: GitBranch,
            label: 'Fork thread from here',
            shortcut: null
        },
        {
            type: 'site-search' as const,
            icon: Search,
            label: 'Search site',
            shortcut: null
        },
        {
            type: 'web-search' as const,
            icon: Globe,
            label: 'Search web',
            shortcut: null
        }
    ];

    return (
        <div
            className={`flex items-center gap-1 bg-black/90 backdrop-blur-sm rounded-md px-2 py-1 shadow-lg border border-white/10 ${className}`}
            data-ai-msg-actions
            role="toolbar"
            aria-label="Message actions"
        >
            {actions.map(({ type, icon: Icon, label, shortcut }) => (
                <button
                    key={type}
                    onClick={() => onAction(type, message)}
                    className="flex items-center justify-center w-8 h-8 rounded hover:bg-white/10 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors"
                    title={shortcut ? `${label} (${shortcut})` : label}
                    aria-label={label}
                    data-ai-action={type}
                >
                    <Icon size={14} className="text-white/70 hover:text-white" />
                </button>
            ))}
        </div>
    );
}
