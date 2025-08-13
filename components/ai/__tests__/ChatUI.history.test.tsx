import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ChatUI } from '../ChatUI';

function Wrapper() {
    const [input, setInput] = React.useState('');
    return (
        <ChatUI
            messages={[]}
            input={input}
            isProcessing={false}
            onInputChange={setInput}
            onSubmit={() => setInput('')}
            variant="sidebar"
            activeTab="agent"
        />
    );
}

describe('ChatUI input history', () => {
    it('navigates previous prompts with ArrowUp at start', () => {
        // Mock missing DOM methods in JSDOM
        (HTMLElement.prototype as any).scrollIntoView = (HTMLElement.prototype as any).scrollIntoView || jest.fn();
        (HTMLElement.prototype as any).scrollTo = (HTMLElement.prototype as any).scrollTo || jest.fn();

        render(<Wrapper />);
        const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

        // submit two prompts: Enter triggers ChatUI onSubmit which we hook to clear input
        fireEvent.change(textarea, { target: { value: 'first question' } });
        fireEvent.keyDown(textarea, { key: 'Enter' });
        fireEvent.change(textarea, { target: { value: 'second question' } });
        fireEvent.keyDown(textarea, { key: 'Enter' });

        // caret at start for history nav
        textarea.focus();
        textarea.setSelectionRange(0, 0);
        fireEvent.keyDown(textarea, { key: 'ArrowUp' });
        return waitFor(() => expect(textarea.value).toBe('second question'));

        // move caret to start again and go further back
        // ensure focused and caret at start again
        textarea.focus();
        textarea.setSelectionRange(0, 0);
        fireEvent.keyDown(textarea, { key: 'ArrowUp' });
        return waitFor(() => expect(textarea.value).toBe('first question'));

        // caret at end for ArrowDown navigation (forward in history)
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        fireEvent.keyDown(textarea, { key: 'ArrowDown' });
        return waitFor(() => expect(textarea.value).toBe('second question'));
    });
});
