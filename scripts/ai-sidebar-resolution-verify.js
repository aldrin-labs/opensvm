const { chromium } = require('playwright');
const fs = require('fs');

function nowISO() {
  return new Date().toISOString();
}

function includesAny(haystack, needles) {
  const s = haystack.toLowerCase();
  return needles.some(n => s.includes(n.toLowerCase()));
}

async function sendPrompt(page, text) {
  return page.evaluate((q) => {
    try {
      window.SVMAI.prompt(q, true);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e && e.message || e) };
    }
  }, text);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const results = {
    startedAt: nowISO(),
    finishedAt: null,
    queries: [],
    summary: {
      total: 0,
      passed: 0,
      failed: 0
    }
  };

  try {
    // Open with AI + mock enabled to avoid external dependencies and ensure deterministic outputs
    await page.goto('http://localhost:3000/?ai=true&aimock=1', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2500);

    // Ensure API is available
    const hasApi = await page.evaluate(() => !!(window.SVMAI && typeof window.SVMAI.prompt === 'function'));
    if (!hasApi) {
      results.queries.push({
        id: 'PREP-API',
        query: 'check SVMAI api',
        passed: false,
        details: 'window.SVMAI.prompt not available'
      });
      throw new Error('SVMAI API not available');
    }

    // Test 1: Network TPS query
    {
      const query = 'What is the current TPS on Solana?';
      const send = await sendPrompt(page, query);
      await page.waitForTimeout(2200); // mock inserts a minimum processing delay internally, add a bit more

      const bodyText = await page.evaluate(() => document.body.textContent || '');
      // Mock response includes phrases like "TPS", "network load", "Current TPS: 2,847"
      const passed = includesAny(bodyText, ['TPS', 'network load', 'Current TPS', 'Network Performance Metrics']);

      results.queries.push({
        id: 'NET-TPS',
        query,
        passed,
        patternsFound: passed,
        excerpt: bodyText.slice(0, 300)
      });
    }

    // Test 2: Account analysis query
    {
      const query = 'Analyze this account: 11111111111111111111111111111111';
      const send = await sendPrompt(page, query);
      await page.waitForTimeout(2200);

      const bodyText = await page.evaluate(() => document.body.textContent || '');
      // Mock response includes "Account analysis", "Balance:", "Owner:", "Account Details"
      const passed = includesAny(bodyText, ['Account analysis', 'Account Details', 'Balance:', 'Owner:']);

      results.queries.push({
        id: 'ACC-ANALYZE',
        query,
        passed,
        patternsFound: passed,
        excerpt: bodyText.slice(0, 300)
      });
    }

    // Test 3: Transaction analysis query
    {
      const query = 'Explain this transaction: abc123';
      const send = await sendPrompt(page, query);
      await page.waitForTimeout(2200);

      const bodyText = await page.evaluate(() => document.body.textContent || '');
      // Mock response includes "Transaction Analysis Complete", "Signature:", "Status:"
      const passed = includesAny(bodyText, ['Transaction Analysis Complete', 'Signature:', 'Status:']);

      results.queries.push({
        id: 'TX-EXPLAIN',
        query,
        passed,
        patternsFound: passed,
        excerpt: bodyText.slice(0, 300)
      });
    }

    // Summaries
    results.summary.total = results.queries.length;
    results.summary.passed = results.queries.filter(q => q.passed).length;
    results.summary.failed = results.summary.total - results.summary.passed;
    results.finishedAt = nowISO();

    const outfile = `ai-sidebar-resolution-verify-results-${nowISO().slice(0,10)}.json`;
    fs.writeFileSync(outfile, JSON.stringify(results, null, 2));

    console.log('=== AI SIDEBAR RESOLUTION VERIFY ===');
    results.queries.forEach(q => {
      console.log(`[${q.passed ? 'PASS' : 'FAIL'}] ${q.id} - ${q.query}`);
    });
    console.log(`Summary: ${results.summary.passed}/${results.summary.total} passed`);
    console.log(`Saved results to: ${outfile}`);

    // Non-zero exit if any failure for CI style signaling
    if (results.summary.failed > 0) process.exitCode = 1;

  } catch (err) {
    console.error('Verification error:', err && err.message || err);
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  run().catch(err => {
    console.error(err);
    process.exit(2);
  });
}
