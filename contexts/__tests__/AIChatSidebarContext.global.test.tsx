import React from 'react';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AIChatSidebarProvider } from '../AIChatSidebarContext';

function Dummy() { return <div>dummy</div>; }

describe('AIChatSidebarProvider global API', () => {
    it('exposes window.SVMAI with expected methods', async () => {
        render(
            <AIChatSidebarProvider>
                <Dummy />
            </AIChatSidebarProvider>
        );

        await waitFor(() => {
            const api = (window as any).SVMAI;
            expect(api).toBeTruthy();
            expect(typeof api.open).toBe('function');
            expect(typeof api.close).toBe('function');
            expect(typeof api.toggle).toBe('function');
            expect(typeof api.prompt).toBe('function');
        });
    });
});
