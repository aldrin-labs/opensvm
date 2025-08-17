import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReasoningBlock } from '../components/ai/reasoning/ReasoningBlock';

// Mock telemetry
jest.mock('../lib/ai/telemetry', () => ({
    track: jest.fn(),
}));

import { track } from '../lib/ai/telemetry';
const mockTrack = track as jest.MockedFunction<typeof track>;

describe('ReasoningBlock', () => {
    beforeEach(() => {
        mockTrack.mockClear();
    });

    it('renders collapsed by default', () => {
        render(<ReasoningBlock text="test reasoning" tokensEst={10} />);

        const button = screen.getByRole('button');
        expect(button.getAttribute('aria-expanded')).toBe('false');
        expect(button.textContent).toContain('Reasoning Show (10 tokens)');
        expect(screen.queryByText('test reasoning')).toBeNull();
    });

    it('renders expanded when initiallyExpanded=true', () => {
        render(<ReasoningBlock text="test reasoning" tokensEst={10} initiallyExpanded={true} />);

        const button = screen.getByRole('button');
        expect(button.getAttribute('aria-expanded')).toBe('true');
        expect(button.textContent).toContain('Reasoning Hide (10 tokens)');
        expect(screen.getByText('test reasoning')).toBeTruthy();
    });

    it('toggles expanded state and emits telemetry on click', () => {
        render(<ReasoningBlock text="test reasoning" tokensEst={15} messageId="msg-123" />);

        const button = screen.getByRole('button');

        // Click to expand
        fireEvent.click(button);
        expect(button.getAttribute('aria-expanded')).toBe('true');
        expect(screen.getByText('test reasoning')).toBeTruthy();
        expect(mockTrack).toHaveBeenCalledWith('reasoning_toggle', {
            messageId: 'msg-123',
            expanded: true,
            tokensEst: 15,
            action: 'expand'
        });

        // Click to collapse
        fireEvent.click(button);
        expect(button.getAttribute('aria-expanded')).toBe('false');
        expect(screen.queryByText('test reasoning')).toBeNull();
        expect(mockTrack).toHaveBeenCalledWith('reasoning_toggle', {
            messageId: 'msg-123',
            expanded: false,
            tokensEst: 15,
            action: 'collapse'
        });
    });

    it('includes data attributes for testing/automation', () => {
        const { container } = render(<ReasoningBlock text="test" tokensEst={20} messageId="msg-456" />);

        const reasoningBlock = container.querySelector('[data-reasoning-block="true"]');
        expect(reasoningBlock?.getAttribute('data-expanded')).toBe('false');
        expect(reasoningBlock?.getAttribute('data-tokens-est')).toBe('20');
        expect(reasoningBlock?.getAttribute('data-message-id')).toBe('msg-456');
    });
});
