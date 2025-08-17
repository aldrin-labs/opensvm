import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ChatUI } from '../ChatUI';
import { AIChatSidebarProvider } from '../../../contexts/AIChatSidebarContext';

describe('ChatUI Quick Actions', () => {
    function renderWithProvider(ui: React.ReactElement) {
        return render(<AIChatSidebarProvider>{ui}</AIChatSidebarProvider>);
    }

    it('renders quick action buttons in sidebar agent tab', () => {
        renderWithProvider(
            <ChatUI
                messages={[]}
                input={''}
                isProcessing={false}
                onInputChange={() => { }}
                onSubmit={() => { }}
                activeTab="agent"
                variant="sidebar"
            />
        );

        expect(screen.getByRole('toolbar', { name: /Quick actions/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /TPS/i })).toBeInTheDocument();
        // Note: Other quick actions are temporarily disabled in current implementation
        // expect(screen.getByRole('button', { name: /Explain Tx/i })).toBeInTheDocument();
        // expect(screen.getByRole('button', { name: /Wallet Summary/i })).toBeInTheDocument();
    });
});
