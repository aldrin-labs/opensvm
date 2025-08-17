import React, { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface ReasoningBlockProps {
    reasoning: {
        text: string;
        tokensEst: number;
    };
    collapsed?: boolean;
    onToggle?: (expanded: boolean) => void;
    className?: string;
}

export function ReasoningBlock({
    reasoning,
    collapsed = true,
    onToggle,
    className = ''
}: ReasoningBlockProps) {
    const [isExpanded, setIsExpanded] = useState(!collapsed);

    const handleToggle = () => {
        const newExpanded = !isExpanded;
        setIsExpanded(newExpanded);
        onToggle?.(newExpanded);

        // Fire event for agent tracking
        try {
            window.dispatchEvent(new CustomEvent('svmai:event', {
                detail: {
                    type: newExpanded ? 'reasoning_expand' : 'reasoning_collapse',
                    ts: Date.now(),
                    payload: {
                        tokens: reasoning.tokensEst,
                        expanded: newExpanded
                    }
                }
            }));
        } catch (error) {
            // Ignore custom event errors
        }
    };

    const toggleId = `reasoning-toggle-${Math.random().toString(36).substr(2, 9)}`;
    const contentId = `reasoning-content-${Math.random().toString(36).substr(2, 9)}`;

    return (
        <div className={`reasoning-block ${className}`} data-ai-reasoning-block>
            <button
                id={toggleId}
                onClick={handleToggle}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300 transition-colors py-1 px-2 rounded hover:bg-slate-800/50 focus:outline-none focus:ring-1 focus:ring-slate-400"
                aria-expanded={isExpanded}
                aria-controls={contentId}
                data-ai-reasoning-toggle
                type="button"
            >
                {isExpanded ? (
                    <ChevronDown size={12} aria-hidden="true" />
                ) : (
                    <ChevronRight size={12} aria-hidden="true" />
                )}
                <span className="font-medium">
                    Reasoning
                    <span className="text-slate-500 ml-1">
                        ({reasoning.tokensEst} token{reasoning.tokensEst !== 1 ? 's' : ''})
                    </span>
                </span>
            </button>

            <div
                id={contentId}
                aria-labelledby={toggleId}
                className={`reasoning-content transition-all duration-150 ease-in-out overflow-hidden ${isExpanded ? 'max-h-none opacity-100' : 'max-h-0 opacity-0'
                    }`}
                aria-hidden={!isExpanded}
                data-ai-reasoning-content
            >
                <div className="mt-1 p-3 bg-slate-900/50 border border-slate-700/50 rounded text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {reasoning.text}
                </div>
            </div>
        </div>
    );
}
