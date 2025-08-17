"use client";
import React from 'react';

interface ChatErrorBoundaryState { hasError: boolean; error?: any; }

export class ChatErrorBoundary extends React.Component<React.PropsWithChildren, ChatErrorBoundaryState> {
    state: ChatErrorBoundaryState = { hasError: false };

    static getDerivedStateFromError(error: any): ChatErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: any, info: any) {
        // eslint-disable-next-line no-console
        console.error('[ChatErrorBoundary] render error', error, info);
        if (typeof window !== 'undefined') {
            (window as any).__SVMAI_CHAT_ERROR__ = String(error?.message || error);
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div data-ai-chat-error className="p-4 text-red-400 text-xs font-mono whitespace-pre-wrap border-t border-red-600/40">
                    ChatUI failed to render. {this.state.error?.message || String(this.state.error)}
                </div>
            );
        }
        return this.props.children;
    }
}
