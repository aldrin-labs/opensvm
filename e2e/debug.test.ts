import { test, expect } from '@playwright/test';

// Using a well-known high-activity Solana address 
const KNOWN_ACTIVE_ADDRESS = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC mint authority - definitely has activity

test.describe('Debug Tests', () => {
    test('Wait for account data to load properly', async ({ page }) => {
        console.log('Testing with address:', KNOWN_ACTIVE_ADDRESS);

        await page.goto(`/account/${KNOWN_ACTIVE_ADDRESS}`);

        // Wait for loading to disappear first
        console.log('Waiting for loading to finish...');
        try {
            await page.waitForSelector('text=Loading account information...', { state: 'hidden', timeout: 60000 });
            console.log('Loading finished!');
        } catch (error) {
            console.log('Loading timeout, continuing anyway...');
        }

        // Wait for any content to appear
        await page.waitForTimeout(5000);

        // Take a screenshot
        await page.screenshot({ path: 'debug-loaded.png', fullPage: true });

        // Check what's actually on the page now
        const bodyText = await page.textContent('body');
        console.log('Page content length after loading:', bodyText?.length);

        // Look for data-test elements
        const dataTestElements = await page.locator('[data-test]').count();
        console.log('Elements with data-test attributes:', dataTestElements);

        // Check for tab elements
        const tabElements = await page.locator('button:has-text("Account Transfers")').count();
        console.log('Account Transfers tab elements:', tabElements);

        // Check for any tab buttons
        const allTabButtons = await page.locator('button').count();
        console.log('Total button elements:', allTabButtons);

        // Check for transfers table
        const transfersTable = await page.locator('[data-test="transfers-table"]').count();
        console.log('Transfers table elements:', transfersTable);

        // Look for any error messages
        const errorMessages = await page.locator('text=Error').count();
        console.log('Error message elements:', errorMessages);

        // Get button text to see what tabs exist
        const buttons = await page.locator('button').all();
        for (let i = 0; i < Math.min(10, buttons.length); i++) {
            const text = await buttons[i].textContent();
            console.log(`Button ${i}: "${text}"`);
        }
    });

    test('Examine page content in detail', async ({ page }) => {
        console.log('Testing with address:', KNOWN_ACTIVE_ADDRESS);

        await page.goto(`/account/${KNOWN_ACTIVE_ADDRESS}`);

        // Wait for loading to disappear
        try {
            await page.waitForSelector('text=Loading account information...', { state: 'hidden', timeout: 60000 });
            console.log('Loading finished!');
        } catch (error) {
            console.log('Loading timeout, continuing...');
        }

        await page.waitForTimeout(5000);

        // Get the main content area
        const mainContent = await page.locator('main').textContent();
        console.log('Main content:', mainContent?.substring(0, 500));

        // Check for specific text that should be on an account page
        const hasAccountText = await page.locator('text=Account').count();
        const hasTransferText = await page.locator('text=Transfer').count();
        const hasTransactionText = await page.locator('text=Transaction').count();

        console.log('Has "Account" text:', hasAccountText);
        console.log('Has "Transfer" text:', hasTransferText);
        console.log('Has "Transaction" text:', hasTransactionText);

        // Check if we're on the right route
        const currentUrl = page.url();
        console.log('Current URL:', currentUrl);

        // Look for any loading indicators still present
        const loadingElements = await page.locator('text=Loading').count();
        console.log('Loading elements still present:', loadingElements);

        // Check for error boundaries or error states
        const errorBoundary = await page.locator('[data-testid="error-boundary"]').count();
        console.log('Error boundary elements:', errorBoundary);

        test('Debug lazy loading tabs', async ({ page }) => {
            console.log('Testing lazy loading with:', KNOWN_ACTIVE_ADDRESS);

            await page.goto(`/account/${KNOWN_ACTIVE_ADDRESS}`);

            // Wait for account info
            await page.waitForSelector('text=Account Info', { timeout: 30000 });
            console.log('Account info loaded');

            // Look for table skeleton (lazy loading started)
            try {
                await page.waitForSelector('.space-y-2', { timeout: 20000 });
                console.log('Table skeleton appeared - lazy loading started');
            } catch (e) {
                console.log('No skeleton found');
            }

            // Wait longer and see what actually loads in the tabs area
            await page.waitForTimeout(30000); // Wait 30 seconds

            // Take screenshot to see current state
            await page.screenshot({ path: 'debug-tabs-loading.png', fullPage: true });

            // Check what's in the bottom section where tabs should be
            const bottomSection = await page.locator('div').last().textContent();
            console.log('Bottom section content (last 200 chars):', bottomSection?.slice(-200));

            // Look for any tab-like text
            const hasTabText = await page.locator('text=Transfer').count();
            const hasAllTxsText = await page.locator('text=All Txs').count();
            const hasAccountTransfersText = await page.locator('text=Account Transfers').count();

            console.log('Tab text counts - Transfer:', hasTabText, 'All Txs:', hasAllTxsText, 'Account Transfers:', hasAccountTransfersText);

            // Check for error messages or "unavailable" text from lazy loading fallback
            const hasUnavailableText = await page.locator('text=unavailable').count();
            const hasErrorText = await page.locator('text=Error').count();

            console.log('Error indicators - unavailable:', hasUnavailableText, 'error:', hasErrorText);
        });
    });
});