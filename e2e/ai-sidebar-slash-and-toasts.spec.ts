import { test, expect } from '@playwright/test';

test.describe('AI Sidebar - Slash completion and toasts', () => {
    test('slash completion: Tab and Enter prefix-complete, then submit shows Processing', async ({ page }) => {
        await page.setViewportSize({ width: 1600, height: 900 });
        // Use relative URL so Playwright baseURL controls the target host/port
        await page.goto('/?ai=1&aimock=1&aitext=hi');

        // Ensure the sidebar is visible via stable selector
        const sidebar = page.locator('[data-ai-sidebar]');
        await expect(sidebar).toBeVisible();

        const input = page.locator('[data-ai-chat-input]');
        await expect(input).toBeVisible();

        // Type a partial slash command
        await input.fill('/t');

        // Suggestions list should appear and aria-activedescendant should be set
        const list = page.locator('[data-ai-slash-list]');
        await expect(list).toBeVisible();
        await expect(input).toHaveAttribute('aria-activedescendant', /ai-slash-option-/);

        // Press Enter: since it's a prefix, it should autocomplete to /tps and not submit yet
        await input.press('Enter');
        await expect(input).toHaveValue('/tps ');
        // Wait a moment for any state updates
        await page.waitForTimeout(100);
        // No processing status yet (use stable selector)
        await expect(page.locator('[data-ai-processing-status]')).toHaveCount(0);

        // Press Tab to ensure it keeps the chosen command (idempotent) and caret at end
        await input.press('Tab');
        await expect(input).toHaveValue('/tps ');

        // Now submit; should show Processing status
        await input.press('Enter');
        // Wait for processing indicator with longer timeout (processing might take a moment to appear)
        await expect(page.locator('[data-ai-processing-status]')).toContainText(/Processing/i, { timeout: 5000 });

        // Cancel to clean up state quickly (optional if cancel button present)
        const maybeCancel = page.getByRole('button', { name: /Cancel processing/i });
        if (await maybeCancel.isVisible().catch(() => false)) {
            await maybeCancel.click();
            await expect(page.locator('[data-ai-processing-status]')).toBeHidden({ timeout: 26000 });
        }
    });

    test('Share shows an ephemeral "Link copied" toast', async ({ page }) => {
        await page.setViewportSize({ width: 1600, height: 900 });
        // Use relative URL so Playwright baseURL controls the target host/port
        await page.goto('/?ai=1&aimock=1&aitext=hi');

        const sidebar2 = page.locator('[data-ai-sidebar]');
        await expect(sidebar2).toBeVisible();

        // Open the more menu
        const moreBtn = sidebar2.getByRole('button', { name: /More options/i });
        // In some headless environments the button may be computed just outside viewport; fall back to DOM click
        try {
            await moreBtn.click({ timeout: 2000 });
        } catch {
            await moreBtn.scrollIntoViewIfNeeded();
            await moreBtn.evaluate((el: HTMLElement) => el.click());
        }

        // Click Share
        const shareItem = page.getByRole('menuitem', { name: /Share/i });
        await shareItem.click();

        // Expect the toast to appear
        const toast = page.locator('[data-ai-toast="shared"]');
        await expect(toast).toBeVisible();
        // And disappear shortly
        await expect(toast).toBeHidden({ timeout: 3000 });
    });
});
