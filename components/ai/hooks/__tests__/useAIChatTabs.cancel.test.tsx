import React from 'react';
import { render, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useAIChatTabs } from '../useAIChatTabs';

// Minimal agent stub with delayed responses
class FakeAgent {
    clearContext = jest.fn();
    async processMessage(message: any) {
        // Simulate planning vs user execution with small delays
        if (message.role === 'system') {
            return new Promise((resolve) => setTimeout(() => resolve({
                role: 'assistant' as const,
                content: '[ACTION]network.analyzeNetworkLoad:Get current TPS[/ACTION]'
            }), 50));
        }
        return new Promise((resolve) => setTimeout(() => resolve({
            role: 'assistant' as const,
            content: 'Done'
        }), 100));
    }
}

function HookHarness({ agent, onReady }: any) {
    const hook = useAIChatTabs({ agent });
    React.useEffect(() => {
        onReady(hook);
    }, [hook, onReady]);
    return null;
}

describe('useAIChatTabs cancel', () => {
    jest.useFakeTimers();

    it('stops processing and prevents further messages when canceled', async () => {
        const agent = new FakeAgent();
        let hookApi: any;

        render(<HookHarness agent={agent} onReady={(h: any) => (hookApi = h)} />);

        // Prime input and submit
        act(() => {
            hookApi.setInput('tps');
            hookApi.handleSubmit({ preventDefault: () => { } } as any);
        });

        // Immediately cancel
        act(() => {
            hookApi.cancel();
        });

        // Let pending timers run
        await act(async () => {
            jest.advanceTimersByTime(200);
        });

        // isProcessing should be false after cancel
        expect(hookApi.isProcessing).toBe(false);

        // Only the user message should have been appended (no plan/results)
        const msgs = hookApi.messages;
        const hasSummary = msgs.some((m: any) => typeof m.content === 'string' && m.content.includes('Execution Summary'));
        expect(hasSummary).toBe(false);
    });
});
