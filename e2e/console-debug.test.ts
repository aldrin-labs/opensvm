import { test } from '@playwright/test';

const ADDRESS = 'AMM55ShdkoGRB5jVYPjWziwk8m5MpwyDgsMWHaMSQWH6';

test('console diagnostics on account page', async ({ page }) => {
    page.on('console', (msg) => {
        console.log(`[browser:${msg.type()}]`, msg.text());
    });
    page.on('pageerror', (err) => {
        console.log('[pageerror]', err.message);
    });
    page.on('requestfailed', (req) => {
        console.log('[requestfailed]', req.url(), req.failure()?.errorText);
    });

    await page.goto(`/account/${ADDRESS}?e2e=1`);
    await page.waitForTimeout(10000);

    const html = await page.content();
    console.log('body length', html.length);

    const buttons = await page.locator('button').count();
    console.log('buttons:', buttons);

    const anchorCount = await page.locator('[data-test="account-page-e2e"]').count();
    console.log('anchor:', anchorCount);

    const transfers = await page.locator('[data-test="transfers-table"]').count();
    console.log('transfers-table:', transfers);

    const tabsContainer = await page.locator('[data-test="account-tabs"]').count();
    console.log('account-tabs:', tabsContainer);

    const allTab = await page.locator('[data-test="tab-all-txs"]').count();
    console.log('tab-all-txs:', allTab);
});
