import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { ChatUI } from '../ChatUI';

// Mock the query classifier to avoid complex dependencies
jest.mock('@/lib/ai/query-classifier', () => ({
  classifyQuery: jest.fn(() => ({ type: 'knowledge', confidence: 0.9, suggestedTools: [] })),
  shouldBypassPlanning: jest.fn(() => true),
  QueryType: { KNOWLEDGE_BASED: 'knowledge' }
}));

function Wrapper() {
    const [input, setInput] = React.useState('');
    const [history, setHistory] = React.useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = React.useState<number | null>(null);
    const [draft, setDraft] = React.useState('');

    const handleInputChange = (value: string) => {
        setInput(value);
    };

    const handleSubmit = () => {
        if (input.trim()) {
            setHistory(prev => [...prev, input.trim()]);
            setHistoryIndex(null);
            setDraft('');
        }
        setInput('');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const el = e.currentTarget;

        // ArrowUp: Navigate to previous input in history
        if (e.key === 'ArrowUp' && el.selectionStart === 0 && el.selectionEnd === 0) {
            e.preventDefault();
            if (history.length > 0) {
                let newIndex: number;
                if (historyIndex === null) {
                    setDraft(input);
                    newIndex = history.length - 1;
                } else if (historyIndex > 0) {
                    newIndex = historyIndex - 1;
                } else {
                    return;
                }
                setHistoryIndex(newIndex);
                setInput(history[newIndex]);
            }
        }

        // ArrowDown: Navigate forward in history
        if (e.key === 'ArrowDown' && el.selectionStart === el.value.length) {
            e.preventDefault();
            if (historyIndex !== null) {
                if (historyIndex < history.length - 1) {
                    const newIndex = historyIndex + 1;
                    setHistoryIndex(newIndex);
                    setInput(history[newIndex]);
                } else {
                    setHistoryIndex(null);
                    setInput(draft);
                }
            }
        }

        // Enter: Submit
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div>
            <textarea
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                data-testid="chat-input"
            />
        </div>
    );
}

describe('ChatUI input history', () => {
    it('navigates previous prompts with ArrowUp at start', async () => {
        render(<Wrapper />);
        const textarea = screen.getByTestId('chat-input') as HTMLTextAreaElement;

        // Submit first question
        await act(async () => {
            fireEvent.change(textarea, { target: { value: 'first question' } });
        });
        await act(async () => {
            fireEvent.keyDown(textarea, { key: 'Enter' });
        });

        // Submit second question
        await act(async () => {
            fireEvent.change(textarea, { target: { value: 'second question' } });
        });
        await act(async () => {
            fireEvent.keyDown(textarea, { key: 'Enter' });
        });

        // Input should be cleared after submit
        expect(textarea.value).toBe('');

        // Navigate to previous (second question)
        textarea.focus();
        textarea.setSelectionRange(0, 0);
        await act(async () => {
            fireEvent.keyDown(textarea, { key: 'ArrowUp' });
        });

        await waitFor(() => expect(textarea.value).toBe('second question'));

        // Navigate to first question
        textarea.setSelectionRange(0, 0);
        await act(async () => {
            fireEvent.keyDown(textarea, { key: 'ArrowUp' });
        });

        await waitFor(() => expect(textarea.value).toBe('first question'));

        // Navigate forward to second question
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        await act(async () => {
            fireEvent.keyDown(textarea, { key: 'ArrowDown' });
        });

        await waitFor(() => expect(textarea.value).toBe('second question'));
    });
});
