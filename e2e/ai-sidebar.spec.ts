import { test, expect } from '@playwright/test';

// Basic e2e smoke to validate AI sidebar opens, quick actions exist, and prompt path works
// Runs against PLAYWRIGHT_BASE_URL or https://osvm.ai by default (see playwright.config.ts)

test.describe('AI Sidebar', () => {
    test('toggle via URL params and window API; quick actions render', async ({ page }) => {
        await page.setViewportSize({ width: 1600, height: 900 });
        await page.goto('/?ai=1&aimock=1&aitext=What%20is%20the%20current%20Solana%20TPS%3F');

        // Sidebar should mount; input should exist
        const input = page.locator('[data-ai-chat-input], #chat-input');
        await expect(input).toBeVisible();

        // Quick actions bar (sidebar + agent tab)
        const quickTPS = page.locator('[data-ai-quick="tps"]');
        await expect(quickTPS).toBeVisible();

        // Use window.SVMAI API to prompt and auto-submit
        await page.evaluate(() => (window as any).SVMAI?.prompt('What is the current Solana TPS?', true));

        // Expect a processing indicator to appear (use stable selector)
        await expect(page.locator('[data-ai-processing-status]')).toContainText(/Processing/i);
    });

    test('context-aware quick actions and shortcut on tx page', async ({ page }) => {
        await page.setViewportSize({ width: 1600, height: 900 });
        await page.goto('/tx/1111111111111111111111111111111111111111111111111111111111111111111111?ai=1&aimock=1');

        const input = page.locator('[data-ai-chat-input], #chat-input');
        await expect(input).toBeVisible();

        // Context quick action should be present
        const quickContext = page.locator('[data-ai-quick="context"]');
        await expect(quickContext).toBeVisible();

        // Keyboard shortcut Cmd/Ctrl+Shift+P should insert context-aware text
        await input.click();
        const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
        await page.keyboard.down(mod);
        await page.keyboard.down('Shift');
        await page.keyboard.press('KeyP');
        await page.keyboard.up('Shift');
        await page.keyboard.up(mod);

        // Expect the input to contain the tx signature
        await expect(input).toHaveValue(/Explain this transaction:/i);
    });
});
