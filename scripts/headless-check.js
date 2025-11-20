const { chromium } = require('playwright');
(async () => {
  const targetUrl = 'http://localhost:3000';
  const canonicalParam = 'account-transfers';
  console.log('Navigating to target URL:', targetUrl);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    // Attempt to use a search feature with multiple fallbacks
    const query = 'transfers';
    const searchSelectors = [
      'input[data-test="search-input"]',
      'input[data-testid="search-input"]',
      'input[placeholder*="Search"]',
      'input[aria-label="Search"]',
      'input[type="search"]'
    ];

    let searchInput = null;
    for (const sel of searchSelectors) {
      searchInput = await page.$(sel);
      if (searchInput) break;
    }

    if (searchInput) {
      await searchInput.focus();
      await searchInput.fill(query);
      await searchInput.press('Enter');
      // Wait for possible results containers
      const resultsSelectors = [
        '[data-test="search-results"]',
        '[data-test="transfers-table"]',
        '.results',
        '.search-results',
        'table'
      ];
      let foundResults = false;
      for (const rs of resultsSelectors) {
        const el = await page.waitForSelector(rs, { timeout: 8000 }).catch(() => null);
        if (el) {
          foundResults = true;
          break;
        }
      }
      console.log('Search attempted. resultsFound=', foundResults);
    } else {
      console.log('Search input not found. Skipping search interaction.');
    }

    // Extract minimal status
    const finalUrl = page.url();
    const heading = await page.textContent('h1, #transfers-heading, .page-title').catch(() => null);
    let rowCount = 0;
    try {
      rowCount = await page.$$eval('[data-test="timestamp"]', els => els.length);
    } catch (e) {
      console.log('Row count eval failed:', e?.message ?? e);
    }
    const hasTable = (await page.$('[data-test="transfers-table"]')) !== null;
    console.log(JSON.stringify({ heading, rowCount, hasTable, finalUrl, expectedTab: canonicalParam }, null, 2));
  } catch (err) {
    console.error('Headless test error:', err?.message ?? err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})().catch(e => {
  console.error('Headless check failed:', e);
  process.exit(1);
});
