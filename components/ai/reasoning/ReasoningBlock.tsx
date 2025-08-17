import React, { useState } from 'react';
import { track } from '../../../lib/ai/telemetry';

interface ReasoningBlockProps {
    text: string;
    tokensEst: number;
    initiallyExpanded?: boolean;
    messageId?: string;
}

export function ReasoningBlock({
    text,
    tokensEst,
    initiallyExpanded = false,
    messageId
}: ReasoningBlockProps) {
    const [expanded, setExpanded] = useState(initiallyExpanded);

    const toggleExpanded = () => {
        const newExpanded = !expanded;
        setExpanded(newExpanded);

        track('reasoning_toggle', {
            messageId: messageId || 'unknown',
            expanded: newExpanded,
            tokensEst,
            action: newExpanded ? 'expand' : 'collapse'
        });
    };

    return (
        <div
            className="reasoning-block border-l-2 border-gray-300 pl-3 my-2"
            data-reasoning-block="true"
            data-expanded={expanded}
            data-tokens-est={tokensEst}
            data-message-id={messageId}
        >
            <button
                onClick={toggleExpanded}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 rounded px-1"
                aria-expanded={expanded}
                aria-controls={`reasoning-content-${messageId || 'unknown'}`}
                type="button"
            >
                <span className={`transform transition-transform ${expanded ? 'rotate-90' : 'rotate-0'}`}>
                    ▶
                </span>
                <span className="font-medium">
                    Reasoning {expanded ? 'Hide' : 'Show'} ({tokensEst} tokens)
                </span>
            </button>

            {expanded && (
                <div
                    id={`reasoning-content-${messageId || 'unknown'}`}
                    className="mt-2 text-sm text-gray-700 bg-gray-50 p-3 rounded border"
                    data-reasoning-content="true"
                >
                    <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
                        {text}
                    </pre>
                </div>
            )}
        </div>
    );
}
