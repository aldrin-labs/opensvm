const { chromium } = require('playwright');
const fetch = require('node-fetch');

(async () => {
  const legacyUrl = 'http://localhost:3001/account/So11111111111111111111111111111111111111112?tab=transactions';
  const apiUrl = 'http://localhost:3001/api/account-transfers/So11111111111111111111111111111111111111112?limit=2';
  console.log('[warmup] Hitting root and API to trigger compilation...');
  try { await fetch('http://localhost:3001/'); } catch(e){ console.log('Root fetch error (ignored):', e.message); }
  try { const r = await fetch(apiUrl); console.log('[api] status', r.status); } catch(e){ console.log('API fetch error (ignored):', e.message); }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(120000);
  console.log('[nav] Opening legacy tab param URL:', legacyUrl);
  const started = Date.now();
  try {
    await page.goto(legacyUrl, { waitUntil: 'domcontentloaded' });
  } catch (e) {
    console.log('[nav] First attempt timed out after', Date.now()-started, 'ms, retrying once...');
    // Retry once (often first compile delay)
    await page.goto(legacyUrl, { waitUntil: 'domcontentloaded' });
  }

  // Wait up to 20s for either table or error container
  const sel = '[data-test=transfers-table], #transfers-heading, [data-test=account-tabs]';
  try { await page.waitForSelector(sel, { timeout: 20000 }); } catch {}

  const finalUrl = page.url();
  const heading = await page.textContent('#transfers-heading').catch(()=>null);
  const tabText = await page.textContent('[data-test=tab-account-transfers]').catch(()=>null);
  let rowCount = 0;
  let tablePresent = false;
  try {
    tablePresent = (await page.$('[data-test=transfers-table]')) !== null;
    rowCount = await page.$$eval('[data-test=timestamp]', els => els.length);
  } catch {}

  const htmlSnippet = (await page.content()).slice(0, 2000);
  console.log(JSON.stringify({
    finalUrl,
    heading,
    tabText,
    tablePresent,
    rowCount,
    legacyParamHandled: finalUrl.includes('account-transfers'),
    snippet: htmlSnippet
  }, null, 2));
  await browser.close();
})().catch(e => {
  console.error('Headless check failed:', e);
  process.exit(1);
});
