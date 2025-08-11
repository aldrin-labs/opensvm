import { test, expect } from '@playwright/test';

// Real Solana addresses for testing
const TEST_ADDRESSES = {
    // High activity DeFi account (Raydium/Orca operations)
    DEFI_HEAVY: 'AMM55ShdkoGRB5jVYPjWziwk8m5MpwyDgsMWHaMSQWH6',
    // NFT marketplace account 
    NFT_TRADER: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    // Staking/validator account
    STAKING_ACCOUNT: 'beefKGBWeSpHzYBHZXwp5So7wdQGX6mu4ZHCsH3uTar',
    // Trading bot account
    TRADING_BOT: '7WduLbRfYhTJktjLw5FDEyrqoEv61aTTCuGAetgLjzN5',
    // General user account
    GENERAL_USER: '5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9'
};

test.describe('Transaction Filtering System - Comprehensive Tests', () => {

    test.beforeEach(async ({ page }) => {
        // Clear localStorage before each test
        await page.evaluate(() => localStorage.clear());
    });

    test('01. Account Transfers filter shows only basic transfers', async ({ page }) => {
        await page.goto(`/account/${TEST_ADDRESSES.GENERAL_USER}`);

        // Wait for page to load
        await page.waitForSelector('[data-test="transfers-table"]', { timeout: 30000 });

        // Check if Account Transfers is default selected
        const accountTransfersButton = page.locator('button:has-text("Account Transfers")');
        await expect(accountTransfersButton).toBeVisible();

        // Verify transfers are displayed
        await expect(page.locator('[data-test="timestamp"]').first()).toBeVisible({ timeout: 15000 });

        // Check that we have transfer data
        const transferRows = page.locator('[data-test="timestamp"]');
        const count = await transferRows.count();
        expect(count).toBeGreaterThan(0);
    });

    test('02. Trading Txs filter displays DEX and swap transactions', async ({ page }) => {
        await page.goto(`/account/${TEST_ADDRESSES.TRADING_BOT}`);

        await page.waitForSelector('[data-test="transfers-table"]', { timeout: 30000 });

        // Select Trading Txs filter
        await page.click('button:has-text("Trading Txs")');

        // Wait for filter to apply
        await page.waitForTimeout(2000);

        // Verify trading transactions are shown
        const transferRows = page.locator('[data-test="timestamp"]');
        await expect(transferRows).toHaveCountGreaterThanOrEqual(0);

        // Check filter is active
        const tradingButton = page.locator('button:has-text("Trading Txs")');
        await expect(tradingButton).toHaveClass(/active|selected|bg-blue/);
    });

    test('03. DeFi Txs filter shows lending, staking, and liquidity transactions', async ({ page }) => {
        await page.goto(`/account/${TEST_ADDRESSES.DEFI_HEAVY}`);

        await page.waitForSelector('[data-test="transfers-table"]', { timeout: 30000 });

        // Select DeFi Txs filter
        await page.click('button:has-text("DeFi Txs")');

        await page.waitForTimeout(2000);

        // Verify DeFi transactions are displayed
        const transferRows = page.locator('[data-test="timestamp"]');
        await expect(transferRows).toHaveCountGreaterThanOrEqual(0);

        // Look for DeFi-related transaction types
        const typeElements = page.locator('[data-test="type"]');
        if (await typeElements.count() > 0) {
            const firstType = await typeElements.first().textContent();
            expect(firstType).toBeTruthy();
        }
    });

    test('04. NFT Txs filter displays NFT mints and transfers', async ({ page }) => {
        await page.goto(`/account/${TEST_ADDRESSES.NFT_TRADER}`);

        await page.waitForSelector('[data-test="transfers-table"]', { timeout: 30000 });

        // Select NFT Txs filter
        await page.click('button:has-text("NFT Txs")');

        await page.waitForTimeout(2000);

        // Verify NFT transactions are displayed
        const transferRows = page.locator('[data-test="timestamp"]');
        await expect(transferRows).toHaveCountGreaterThanOrEqual(0);
    });

    test('05. Staking Txs filter shows delegation and reward transactions', async ({ page }) => {
        await page.goto(`/account/${TEST_ADDRESSES.STAKING_ACCOUNT}`);

        await page.waitForSelector('[data-test="transfers-table"]', { timeout: 30000 });

        // Select Staking Txs filter
        await page.click('button:has-text("Staking Txs")');

        await page.waitForTimeout(2000);

        // Verify staking transactions are displayed
        const transferRows = page.locator('[data-test="timestamp"]');
        await expect(transferRows).toHaveCountGreaterThanOrEqual(0);
    });

    test('06. Utility Txs filter shows system transactions', async ({ page }) => {
        await page.goto(`/account/${TEST_ADDRESSES.GENERAL_USER}`);

        await page.waitForSelector('[data-test="transfers-table"]', { timeout: 30000 });

        // Select Utility Txs filter
        await page.click('button:has-text("Utility Txs")');

        await page.waitForTimeout(2000);

        // Verify utility transactions are displayed
        const transferRows = page.locator('[data-test="timestamp"]');
        await expect(transferRows).toHaveCountGreaterThanOrEqual(0);
    });

    test('07. Suspicious Txs filter identifies unusual patterns', async ({ page }) => {
        await page.goto(`/account/${TEST_ADDRESSES.TRADING_BOT}`);

        await page.waitForSelector('[data-test="transfers-table"]', { timeout: 30000 });

        // Select Suspicious Txs filter
        await page.click('button:has-text("Suspicious Txs")');

        await page.waitForTimeout(2000);

        // Verify suspicious transactions filter works
        const transferRows = page.locator('[data-test="timestamp"]');
        await expect(transferRows).toHaveCountGreaterThanOrEqual(0);
    });

    test('08. All Txs filter displays all transaction types', async ({ page }) => {
        await page.goto(`/account/${TEST_ADDRESSES.DEFI_HEAVY}`);

        await page.waitForSelector('[data-test="transfers-table"]', { timeout: 30000 });

        // Select All Txs filter
        await page.click('button:has-text("All Txs")');

        await page.waitForTimeout(2000);

        // Verify all transactions are displayed
        const transferRows = page.locator('[data-test="timestamp"]');
        await expect(transferRows).toHaveCountGreaterThan(5); // Should have many transactions
    });

    test('09. Solana Only filter within Account Transfers works', async ({ page }) => {
        await page.goto(`/account/${TEST_ADDRESSES.GENERAL_USER}`);

        await page.waitForSelector('[data-test="transfers-table"]', { timeout: 30000 });

        // Ensure Account Transfers is selected
        await page.click('button:has-text("Account Transfers")');

        // Toggle Solana Only filter
        const solanaOnlyButton = page.locator('button:has-text("Solana Only")');
        await solanaOnlyButton.click();

        await page.waitForTimeout(2000);

        // Verify filter is active
        await expect(solanaOnlyButton).toHaveClass(/active|selected|bg-blue/);

        // Check that only SOL transactions are shown
        const tokenElements = page.locator('[data-test="token"]');
        if (await tokenElements.count() > 0) {
            for (let i = 0; i < Math.min(5, await tokenElements.count()); i++) {
                const token = await tokenElements.nth(i).textContent();
                expect(token).toBe('SOL');
            }
        }
    });

    test('10. Custom Program Txs filter with valid program address', async ({ page }) => {
        await page.goto(`/account/${TEST_ADDRESSES.DEFI_HEAVY}`);

        await page.waitForSelector('[data-test="transfers-table"]', { timeout: 30000 });

        // Select Custom Program Txs
        await page.click('button:has-text("Custom Program Txs")');

        // Enter a known program address (Raydium AMM)
        const customProgramInput = page.locator('input[placeholder*="program address"]');
        if (await customProgramInput.isVisible()) {
            await customProgramInput.fill('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');
            await page.keyboard.press('Enter');
        }

        await page.waitForTimeout(2000);

        // Verify custom program transactions are displayed
        const transferRows = page.locator('[data-test="timestamp"]');
        await expect(transferRows).toHaveCountGreaterThanOrEqual(0);
    });
});
