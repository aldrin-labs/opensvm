import { chromium, Browser, Page } from 'playwright';

async function shot(page: Page, name: string, selector?: string) {
    const path = `screens/${name}.png`;
    if (selector) {
        const el = await page.waitForSelector(selector, { state: 'visible', timeout: 15000 });
        await el.screenshot({ path });
    } else {
        await page.screenshot({ path, fullPage: true });
    }
    console.log(`saved ${path}`);
}

async function run() {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
    const browser: Browser = await chromium.launch();
    const page = await browser.newPage();

    // 1) Home
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await shot(page, 'home');

    // 2) Account page (demo address) in e2e mode to simplify
    const demo = 'AMM55hANM7K1MaADr2APxqP5qEC5ZVtvaQVuF7mG5WH6';
    await page.goto(`${base}/account/${demo}?e2e=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-test="account-page-e2e"]', { timeout: 20000 });
    await shot(page, 'account-tabs', '[data-test="account-tabs"]');
    await page.click('[data-test="tab-all-txs"]');
    await page.waitForSelector('[data-test="transfers-table"]', { timeout: 15000 });
    await shot(page, 'account-transfers-table', '[data-test="transfers-table"]');

    // 3) AI Chat page
    await page.goto(`${base}/chat`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-test="ai-chat"]', { timeout: 15000 }).catch(() => { });
    await shot(page, 'ai-chat');

    await browser.close();
}

run().catch(err => { console.error(err); process.exit(1); });
