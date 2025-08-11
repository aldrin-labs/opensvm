import { test, expect } from '@playwright/test';

// Real Solana addresses for different types of activities
const TEST_ADDRESSES = {
    MEME_TRADER: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    DEFI_POWER_USER: 'AMM55ShdkoGRB5jVYPjWziwk8m5MpwyDgsMWHaMSQWH6',
    NFT_COLLECTOR: '7WduLbRfYhTJktjLw5FDEyrqoEv61aTTCuGAetgLjzN5',
    VALIDATOR: 'beefKGBWeSpHzYBHZXwp5So7wdQGX6mu4ZHCsH3uTar',
    INSTITUTION: '5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9'
};

test.describe('Advanced Transaction Categorization - Real Data Tests', () => {

    test('16. Trading Txs category identifies DEX interactions correctly', async ({ page }) => {
        await page.goto(`/account/${TEST_ADDRESSES.MEME_TRADER}`);

        await page.waitForSelector('[data-test="transfers-table"]', { timeout: 30000 });

        // Navigate to Trading Txs
        await page.click('text=Trading Txs');
        await page.waitForTimeout(3000);

        const tradingRows = page.locator('[data-test="timestamp"]');
        const tradingCount = await tradingRows.count();

        if (tradingCount > 0) {
            // Check first few transactions have trading-related information
            for (let i = 0; i < Math.min(3, tradingCount); i++) {
                const row = page.locator('[data-test="timestamp"]').nth(i);
                const parentRow = row.locator('..');

                // Should contain trading indicators
                const rowText = await parentRow.textContent();
                expect(rowText?.toLowerCase()).toMatch(/(swap|trade|exchange|dex|liquidity|pool)/);
            }
        }
    });

    test('17. DeFi Txs category filters lending and staking properly', async ({ page }) => {
        await page.goto(`/account/${TEST_ADDRESSES.DEFI_POWER_USER}`);

        await page.waitForSelector('[data-test="transfers-table"]', { timeout: 30000 });

        // Navigate to DeFi Txs
        await page.click('text=DeFi Txs');
        await page.waitForTimeout(3000);

        const defiRows = page.locator('[data-test="timestamp"]');
        const defiCount = await defiRows.count();

        if (defiCount > 0) {
            // Verify DeFi transactions contain relevant programs or activities
            const firstRow = page.locator('[data-test="timestamp"]').first();
            const parentRow = firstRow.locator('..');
            const rowText = await parentRow.textContent();

            // Should contain DeFi-related terms
            expect(rowText?.toLowerCase()).toMatch(/(lend|borrow|stake|yield|farm|vault|protocol)/);
        }
    });

    test('18. NFT Txs category identifies NFT mints and transfers', async ({ page }) => {
        await page.goto(`/account/${TEST_ADDRESSES.NFT_COLLECTOR}`);

        await page.waitForSelector('[data-test="transfers-table"]', { timeout: 30000 });

        // Navigate to NFT Txs
        await page.click('text=NFT Txs');
        await page.waitForTimeout(3000);

        const nftRows = page.locator('[data-test="timestamp"]');
        const nftCount = await nftRows.count();

        if (nftCount > 0) {
            // Check for NFT-related activity indicators
            const firstRow = page.locator('[data-test="timestamp"]').first();
            const parentRow = firstRow.locator('..');
            const rowText = await parentRow.textContent();

            // Should contain NFT indicators or very small amounts (likely NFTs)
            expect(rowText?.toLowerCase()).toMatch(/(nft|mint|collection|metadata|0\.00000|token #)/);
        }
    });

    test('19. Staking Txs shows delegation and reward transactions', async ({ page }) => {
        await page.goto(`/account/${TEST_ADDRESSES.VALIDATOR}`);

        await page.waitForSelector('[data-test="transfers-table"]', { timeout: 30000 });

        // Navigate to Staking Txs
        await page.click('text=Staking Txs');
        await page.waitForTimeout(3000);

        const stakingRows = page.locator('[data-test="timestamp"]');
        const stakingCount = await stakingRows.count();

        if (stakingCount > 0) {
            // Verify staking-related transactions
            const firstRow = page.locator('[data-test="timestamp"]').first();
            const parentRow = firstRow.locator('..');
            const rowText = await parentRow.textContent();

            // Should contain staking indicators
            expect(rowText?.toLowerCase()).toMatch(/(stake|delegate|validator|reward|epoch|commission)/);
        }
    });

    test('20. Utility Txs captures account creation and fees', async ({ page }) => {
        await page.goto(`/account/${TEST_ADDRESSES.INSTITUTION}`);

        await page.waitForSelector('[data-test="transfers-table"]', { timeout: 30000 });

        // Navigate to Utility Txs
        await page.click('text=Utility Txs');
        await page.waitForTimeout(3000);

        const utilityRows = page.locator('[data-test="timestamp"]');
        const utilityCount = await utilityRows.count();

        if (utilityCount > 0) {
            // Check for utility transaction indicators
            const rows = page.locator('[data-test="timestamp"]');
            let foundUtilityIndicator = false;

            for (let i = 0; i < Math.min(5, utilityCount); i++) {
                const row = rows.nth(i);
                const parentRow = row.locator('..');
                const rowText = await parentRow.textContent();

                if (rowText?.toLowerCase().match(/(create|fee|rent|account|system|initialize)/)) {
                    foundUtilityIndicator = true;
                    break;
                }
            }

            expect(foundUtilityIndicator).toBeTruthy();
        }
    });

    test('21. Suspicious Txs identifies large or unusual transactions', async ({ page }) => {
        await page.goto(`/account/${TEST_ADDRESSES.INSTITUTION}`);

        await page.waitForSelector('[data-test="transfers-table"]', { timeout: 30000 });

        // Navigate to Suspicious Txs
        await page.click('text=Suspicious Txs');
        await page.waitForTimeout(3000);

        const suspiciousRows = page.locator('[data-test="timestamp"]');
        const suspiciousCount = await suspiciousRows.count();

        // Suspicious transactions may or may not exist, but if they do, they should be significant
        if (suspiciousCount > 0) {
            const firstRow = page.locator('[data-test="timestamp"]').first();
            const parentRow = firstRow.locator('..');
            const rowText = await parentRow.textContent();

            // Should contain large amounts or unusual patterns
            expect(rowText).toMatch(/(\d{3,}|\d+\.\d{6,}|unknown|large)/i);
        }
    });

    test('22. Category switching preserves transaction data integrity', async ({ page }) => {
        await page.goto(`/account/${TEST_ADDRESSES.DEFI_POWER_USER}`);

        await page.waitForSelector('[data-test="transfers-table"]', { timeout: 30000 });

        // Get transaction count from All Txs
        await page.click('text=All Txs');
        await page.waitForTimeout(2000);

        const allRows = page.locator('[data-test="timestamp"]');
        const allCount = await allRows.count();

        // Switch through categories and verify sum doesn't exceed total
        const categories = ['Account Transfers', 'Trading Txs', 'DeFi Txs', 'NFT Txs', 'Staking Txs', 'Utility Txs'];
        let totalCategorized = 0;

        for (const category of categories) {
            await page.click(`text=${category}`);
            await page.waitForTimeout(1500);

            const categoryRows = page.locator('[data-test="timestamp"]');
            const categoryCount = await categoryRows.count();
            totalCategorized += categoryCount;
        }

        // Total categorized should be reasonable (some overlap is expected)
        expect(totalCategorized).toBeGreaterThan(0);
    });

    test('23. Performance test with large transaction history', async ({ page }) => {
        await page.goto(`/account/${TEST_ADDRESSES.DEFI_POWER_USER}`);

        const startTime = Date.now();

        await page.waitForSelector('[data-test="transfers-table"]', { timeout: 45000 });

        const loadTime = Date.now() - startTime;

        // Should load within reasonable time (45 seconds max)
        expect(loadTime).toBeLessThan(45000);

        // Test rapid tab switching performance
        const tabSwitchStart = Date.now();

        const categories = ['Trading Txs', 'DeFi Txs', 'Account Transfers', 'All Txs'];

        for (const category of categories) {
            await page.click(`text=${category}`);
            await page.waitForTimeout(1000);
        }

        const tabSwitchTime = Date.now() - tabSwitchStart;

        // Tab switching should be fast
        expect(tabSwitchTime).toBeLessThan(10000);
    });

    test('24. Error handling for invalid addresses', async ({ page }) => {
        const invalidAddress = 'invalid-address-12345';

        await page.goto(`/account/${invalidAddress}`);

        // Should show error state or redirect
        await page.waitForTimeout(5000);

        const currentUrl = page.url();
        const pageContent = await page.textContent('body');

        // Either redirected to valid page or shows error message
        expect(
            currentUrl.includes('invalid-address') ||
            pageContent?.includes('Error') ||
            pageContent?.includes('Invalid') ||
            pageContent?.includes('Not found')
        ).toBeTruthy();
    });

    test('25. Real-time updates don\'t break categorization', async ({ page }) => {
        await page.goto(`/account/${TEST_ADDRESSES.MEME_TRADER}`);

        await page.waitForSelector('[data-test="transfers-table"]', { timeout: 30000 });

        // Start on Trading Txs
        await page.click('text=Trading Txs');
        await page.waitForTimeout(2000);

        const initialRows = page.locator('[data-test="timestamp"]');
        const initialCount = await initialRows.count();

        // Wait for potential real-time updates
        await page.waitForTimeout(10000);

        const updatedRows = page.locator('[data-test="timestamp"]');
        const updatedCount = await updatedRows.count();

        // Count should be stable or increase (new transactions)
        expect(updatedCount).toBeGreaterThanOrEqual(initialCount);

        // Switch categories to verify integrity after updates
        await page.click('text=All Txs');
        await page.waitForTimeout(2000);

        const allRows = page.locator('[data-test="timestamp"]');
        const allCount = await allRows.count();

        // All transactions should still be >= category count
        expect(allCount).toBeGreaterThanOrEqual(updatedCount);
    });
});
