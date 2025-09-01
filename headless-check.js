const { chromium } = require('playwright');
(async () => {
  const legacyUrl = 'http://localhost:3001/account/So11111111111111111111111111111111111111112?tab=transactions';
  const canonicalParam = 'account-transfers';
  console.log('Navigating to legacy URL:', legacyUrl);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(legacyUrl, { waitUntil: 'domcontentloaded' });
  // Wait for either table or fallback placeholder
  await page.waitForSelector('[data-test=account-tabs]', { timeout: 15000 }).catch(()=>{});
  // Extract currently selected tab id from URL (client-side may have updated pushState)
  const finalUrl = page.url();
  console.log('Final URL after client handling:', finalUrl);
  const heading = await page.textContent('#transfers-heading').catch(()=>null);
  let rowCount = 0;
  try {
    // Use $$eval (must stay exactly with two $)
    rowCount = await page.$$eval('[data-test=timestamp]', els => els.length);
  } catch (e) {
    console.log('Row count eval failed:', e.message);
  }
  const hasTable = await page.$('[data-test=transfers-table]') !== null;
  console.log(JSON.stringify({ heading, rowCount, hasTable, finalUrl, expectedTab: canonicalParam }, null, 2));
  await browser.close();
})().catch(e => {
  console.error('Headless check failed:', e);
  process.exit(1);
});
