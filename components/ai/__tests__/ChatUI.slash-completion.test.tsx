import { render, screen, fireEvent } from '@testing-library/react';
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
            onSubmit={() => { }}
            variant="sidebar"
            activeTab="agent"
        />
    );
}

describe('ChatUI slash completion', () => {
    it('shows suggestions and completes with Tab', () => {
        render(<Wrapper />);
        const textarea = screen.getByRole('textbox');

        // Start typing a slash command
        fireEvent.change(textarea, { target: { value: '/t' } });
        // Suggestions visible
        expect(screen.getByRole('listbox', { name: /slash command suggestions/i })).toBeInTheDocument();
        // Press Tab to autocomplete first suggestion (tps)
        fireEvent.keyDown(textarea, { key: 'Tab' });
        expect((textarea as HTMLTextAreaElement).value).toMatch(/^\/tps\s/);
    });
});
