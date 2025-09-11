import React from 'react';
import { Bot, MessageSquare } from 'lucide-react';
import type { ChatMode } from '../hooks/useChatTabs';

interface ModeSelectorProps {
    mode: ChatMode;
    onChange: (mode: ChatMode) => void;
    disabled?: boolean;
    className?: string;
}

export function ModeSelector({ mode, onChange, disabled = false, className = '' }: ModeSelectorProps) {
    return (
        <div className={`flex items-center rounded-lg p-1 ${className} bg-black border border-white/20`}>
            <button
                type="button"
                onClick={() => onChange('agent')}
                disabled={disabled}
                className={`
          flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all
          ${mode === 'agent'
                        ? 'bg-white text-black shadow-sm'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
                aria-pressed={mode === 'agent'}
                title="Agent mode: Autonomous actions and blockchain interactions"
            >
                <Bot size={14} />
                <span>Agent</span>
            </button>

            <button
                type="button"
                onClick={() => onChange('assistant')}
                disabled={disabled}
                className={`
          flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all
          ${mode === 'assistant'
                        ? 'bg-white text-black shadow-sm'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
                aria-pressed={mode === 'assistant'}
                title="Assistant mode: Information and analysis only"
            >
                <MessageSquare size={14} />
                <span>Assistant</span>
            </button>
        </div>
    );
}
