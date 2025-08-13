import { test, expect } from '@playwright/test';

test.describe('AI Sidebar Cancel', () => {
    test('cancel mid-processing stops status and re-enables input', async ({ page }) => {
        await page.setViewportSize({ width: 1600, height: 900 });
        // Avoid auto-submit races; enable mock and open AI with prefilled text only
        await page.goto('/?ai=1&aimock=1&aitext=What%20is%20the%20current%20Solana%20TPS%3F');

        const input = page.locator('[data-ai-chat-input], #chat-input');
        await expect(input).toBeVisible();
        await input.click();

        // Ensure input has content then submit via Enter (more reliable than clicking a possibly disabled button)
        const val = await input.inputValue();
        if (!val || !val.trim()) {
            await input.fill('What is the current Solana TPS?');
        }
        await input.press('Enter');

        const processing = page.locator('[data-ai-processing-status]');
        await expect(processing).toContainText(/Processing/i);

        // Cancel via keyboard (Esc) or fallback to cancel button if available
        await page.keyboard.press('Escape');
        const cancelBtn = page.getByRole('button', { name: /Cancel processing/i });
        if (await cancelBtn.isVisible().catch(() => false)) {
            await cancelBtn.click();
        }

        // Status should disappear shortly and input should be enabled again
        await expect(page.locator('[data-ai-processing-status]')).toHaveCount(0, { timeout: 3000 });
        await expect(input).toBeEnabled();

        // Sanity: sending again should bring back status
        await input.fill('What is the current Solana TPS?');
        await input.press('Enter');
        await expect(page.locator('[data-ai-processing-status]')).toContainText(/Processing/i);
    });
});
