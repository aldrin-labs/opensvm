const { chromium } = require('@playwright/test');

(async () => {
  const PORT = process.env.PORT || 3003; // dev server picked 3003 dynamically
  const base = `http://localhost:${PORT}`;
  console.log(`[validate] Using base URL: ${base}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  const logs = [];
  page.on('console', msg => {
    const txt = `[browser:${msg.type()}] ${msg.text()}`;
    logs.push(txt);
    if (/Fallback probe/.test(msg.text()) || /activating fallback/i.test(msg.text())) {
      console.log(txt);
    }
  });

  let hadError = false;
  try {
    console.log('[validate] Navigating to /chat');
    await page.goto(`${base}/chat`, { waitUntil: 'domcontentloaded' });

    // Allow hydration & dynamic imports
    await page.waitForTimeout(1500);

    // Probe elements
    const primaryRoot = await page.$('[data-ai-chat-ui]');
    const primaryInput = await page.$('[data-ai-chat-ui] [data-ai-chat-input], [data-ai-chat-input]:not([aria-label*="fallback"])');
    const fallbackForm = await page.$('[data-ai-fallback-form]');
    const fallbackInput = await page.$('[data-ai-fallback-form] [data-ai-chat-input]');

    console.log(`[validate] Initial detection: primaryRoot=${!!primaryRoot} primaryInput=${!!primaryInput} fallbackForm=${!!fallbackForm}`);

    if (!primaryInput) {
      // Wait a bit longer before concluding missing primary input
      await page.waitForTimeout(1500);
    }

    const primaryRoot2 = await page.$('[data-ai-chat-ui]');
    const primaryInput2 = await page.$('[data-ai-chat-ui] [data-ai-chat-input], [data-ai-chat-input]:not([aria-label*="fallback"])');
    const fallbackForm2 = await page.$('[data-ai-fallback-form]');

    console.log(`[validate] Second detection: primaryRoot=${!!primaryRoot2} primaryInput=${!!primaryInput2} fallbackForm=${!!fallbackForm2}`);

    // Conditions indicating a regression:
    // 1. Fallback displayed while primary input eventually appears.
    // 2. No primary input after retries (indicates real failure).
    if (fallbackForm2 && primaryInput2) {
      console.error('[validate] ❌ Fallback active even though primary input mounted.');
      hadError = true;
    } else if (!primaryInput2) {
      console.error('[validate] ❌ Primary chat input did not appear; fallback logic may have failed or ChatUI not mounting.');
      hadError = true;
    } else {
      console.log('[validate] ✅ Primary chat input present with no conflicting fallback.');
    }

    // Output recent relevant console lines
    const probeLogs = logs.filter(l => /Fallback probe|activating fallback|Primary input appeared/i.test(l));
    if (probeLogs.length) {
      console.log('[validate] Collected probe logs:');
      probeLogs.forEach(l => console.log('  ' + l));
    }

  } catch (e) {
    hadError = true;
    console.error('[validate] Exception during validation:', e);
  } finally {
    await context.close();
    await browser.close();
  }

  if (hadError) {
    process.exit(1);
  }
})();
