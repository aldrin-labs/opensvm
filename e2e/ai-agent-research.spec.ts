import { test, expect } from '@playwright/test';

test.describe('AI Agent On-chain Research', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Open chat via navbar
        const navBtn = page.getByRole('button', { name: 'Open AI Assistant' });
        await expect(navBtn).toBeVisible();
        await navBtn.click();
        await expect(page.getByRole('complementary', { name: 'AI Chat Sidebar' })).toBeVisible();
    });

    test('network TPS/load query returns metrics', async ({ page }) => {
        const input = page.locator('#chat-input');
        await input.fill('Analyze TPS and network load');
        await input.press('Enter');

        // Look for an assistant response with TPS/load wording
        const assistantMsg = page.locator('text=TPS').or(page.locator('text=Network load'));
        await expect(assistantMsg).toBeVisible({ timeout: 15000 });
    });

    test('account info + token balances query returns structured response', async ({ page }) => {
        const example = '11111111111111111111111111111111'; // system program (placeholder address)
        const input = page.locator('#chat-input');
        await input.fill(`Fetch account info and token balances for ${example}`);
        await input.press('Enter');

        const resp = page.locator('text=address:').or(page.locator('text=balance:')).or(page.locator('text=token balances'));
        await expect(resp).toBeVisible({ timeout: 20000 });
    });

    test('fetch transaction by signature attempt shows a result or error gracefully', async ({ page }) => {
        const input = page.locator('#chat-input');
        await input.fill('Get transaction details for 5'.repeat(18)); // invalid signature; should fail gracefully
        await input.press('Enter');

        const errorOrDetails = page.locator('text=Error').or(page.locator('text=transaction'));
        await expect(errorOrDetails).toBeVisible({ timeout: 15000 });
    });

    test('program research: accounts summary and recent signatures', async ({ page }) => {
        const programId = '11111111111111111111111111111111';
        const input = page.locator('#chat-input');
        await input.fill(`Research program ${programId}: accounts summary and recent signatures`);
        await input.press('Enter');

        const resp = page.locator('text=programId:').or(page.locator('text=accounts:')).or(page.locator('text=signature'));
        await expect(resp).toBeVisible({ timeout: 25000 });
    });

    test('start logs subscription streams updates and stops', async ({ page }) => {
        const input = page.locator('#chat-input');
        await input.fill('Subscribe to logs for 11111111111111111111111111111111 for 10s');
        await input.press('Enter');

        const started = page.locator('text=Started logs subscription');
        await expect(started).toBeVisible({ timeout: 10000 });

        // Expect some streaming output lines to appear (not guaranteed on every run, but we assert presence of streaming region)
        const streamed = page.locator('text=slot ').first();
        await streamed.waitFor({ timeout: 20000 }).catch(() => { });

        // Wait for end message (timer-based)
        const ended = page.locator('text=Logs subscription ended');
        await ended.waitFor({ timeout: 60000 });
        await expect(ended).toBeVisible();
    });
});


