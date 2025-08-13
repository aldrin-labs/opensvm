import { test, expect } from '@playwright/test';

test.describe('AI Agent On-chain Research', () => {
    test.beforeEach(async ({ page }) => {
        // Enable sidebar and deterministic mock via URL flags
        await page.goto('/?ai=1&aimock=1');
        await expect(page.getByRole('complementary', { name: 'AI Chat Sidebar' })).toBeVisible();
    });

    test('network TPS/load query returns metrics', async ({ page }) => {
        const input = page.locator('#chat-input');
        await input.fill('Analyze TPS and network load');
        await input.press('Enter');

        // Look for an assistant response with TPS/load wording in assistant bubbles
        const assistantMsg = page.locator('[data-ai-message-role="assistant"]:has-text("TPS")').or(
            page.locator('[data-ai-message-role="assistant"]:has-text("Network load")')
        );
        await expect(assistantMsg.first()).toBeVisible({ timeout: 15000 });
    });

    test('account info + token balances query returns structured response', async ({ page }) => {
        const example = '11111111111111111111111111111111'; // system program (placeholder address)
        const input = page.locator('#chat-input');
        await input.fill(`Fetch account info and token balances for ${example}`);
        await input.press('Enter');

        const resp = page.locator('[data-ai-message-role="assistant"]:has-text("address:")')
            .or(page.locator('[data-ai-message-role="assistant"]:has-text("balance:")'))
            .or(page.locator('[data-ai-message-role="assistant"]:has-text("token balances")'));
        await expect(resp.first()).toBeVisible({ timeout: 20000 });
    });

    test('fetch transaction by signature attempt shows a result or error gracefully', async ({ page }) => {
        const input = page.locator('#chat-input');
        await input.fill('Get transaction details for 5'.repeat(18)); // invalid signature; should fail gracefully
        await input.press('Enter');

        const errorOrDetails = page.locator('[data-ai-message-role="assistant"]:has-text("Error")')
            .or(page.locator('[data-ai-message-role="assistant"]:has-text("transaction")'));
        await expect(errorOrDetails.first()).toBeVisible({ timeout: 15000 });
    });

    test('program research: accounts summary and recent signatures', async ({ page }) => {
        const programId = '11111111111111111111111111111111';
        const input = page.locator('#chat-input');
        await input.fill(`Research program ${programId}: accounts summary and recent signatures`);
        await input.press('Enter');

        const resp = page.locator('[data-ai-message-role="assistant"]:has-text("programId:")')
            .or(page.locator('[data-ai-message-role="assistant"]:has-text("accounts:")'))
            .or(page.locator('[data-ai-message-role="assistant"]:has-text("signature")'));
        await expect(resp.first()).toBeVisible({ timeout: 25000 });
    });

    test('start logs subscription streams updates and stops', async ({ page }) => {
        const input = page.locator('#chat-input');
        await input.fill('Subscribe to logs for 11111111111111111111111111111111 for 10s');
        await input.press('Enter');

        const started = page.locator('[data-ai-message-role="assistant"]:has-text("Started logs subscription")');
        await expect(started.first()).toBeVisible({ timeout: 10000 });

        // In mock mode, we immediately finish; just assert end message appears in assistant bubble
        const ended = page.locator('[data-ai-message-role="assistant"]:has-text("Logs subscription ended")');
        await expect(ended.first()).toBeVisible({ timeout: 15000 });
    });
});


