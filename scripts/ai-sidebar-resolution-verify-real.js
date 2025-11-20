const { chromium } = require('playwright');
const fs = require('fs');

function iso() { return new Date().toISOString(); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function includesAny(haystack, needles) {
  const s = (haystack || '').toLowerCase();
  return needles.some(n => s.includes(String(n).toLowerCase()));
}

async function waitForProcessingStart(page, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const pending = await page.evaluate(() => {
        const w = window;
        return !!(w && (w).__SVMAI_PENDING__);
      });
      const processingIndicator = await page.$('[data-ai-processing-status]');
      if (pending || processingIndicator) return true;
    } catch {}
    await sleep(120);
  }
  return false;
}

async function waitForProcessingFinish(page, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const pending = await page.evaluate(() => {
        const w = window;
        return !!(w && (w).__SVMAI_PENDING__);
      });
      const processingIndicator = await page.$('[data-ai-processing-status]');
      if (!pending && !processingIndicator) return true;
    } catch {}
    await sleep(150);
  }
  return false;
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
  const results = {
    mode: 'real',
    startedAt: iso(),
    finishedAt: null,
    summary: { total: 0, passed: 0, failed: 0 },
    queries: [],
    network: {
      apiCalls: []
    }
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Capture localhost:3000 API responses
  page.on('response', async (resp) => {
    try {
      const url = resp.url();
      if (!url) return;
      // Normalize to capture both absolute and relative
      if (url.includes('://localhost:3000/') || url.includes('://127.0.0.1:3000/') || url.includes('/api/')) {
        const status = resp.status();
        let ok = false;
        try { ok = resp.ok(); } catch {}
        results.network.apiCalls.push({
          ts: iso(),
          url,
          status,
          ok
        });
      }
    } catch {}
  });

  try {
    // Open site with sidebar enabled (no mock flags)
    await page.goto('http://localhost:3000/?ai=true', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(2000);

    // Ensure SVMAI API present
    const hasApi = await page.evaluate(() => !!(window.SVMAI && typeof window.SVMAI.prompt === 'function'));
    if (!hasApi) {
      results.queries.push({
        id: 'PREP-API',
        query: 'Verify SVMAI API presence',
        passed: false,
        details: 'window.SVMAI.prompt not available'
      });
      throw new Error('SVMAI API not available in real mode');
    }

    // Define the real queries
    const scenarios = [
      {
        id: 'NET-TPS',
        query: 'What is the current TPS on Solana?',
        expectText: ['tps', 'transactions per second', 'network', 'load']
      },
      {
        id: 'ACC-ANALYZE',
        query: 'Analyze this account: 11111111111111111111111111111111',
        expectText: ['account', 'balance', 'owner', 'details']
      },
      {
        id: 'TX-EXPLAIN',
        query: 'Explain this transaction: 5j7sVQs1F3bV5Gq1Z1Q1',
        expectText: ['transaction', 'signature', 'status', 'slot', 'fee']
      }
    ];

    for (const sc of scenarios) {
      const preNetworkCount = results.network.apiCalls.length;
      const preBodyText = await page.evaluate(() => document.body.textContent || '');
      const preLength = (preBodyText || '').length;

      const sent = await sendPrompt(page, sc.query);
      if (!sent.ok) {
        results.queries.push({
          id: sc.id,
          query: sc.query,
          passed: false,
          details: `Failed to send prompt: ${sent.error || 'unknown'}`
        });
        continue;
      }

      // Wait for processing start and finish
      const started = await waitForProcessingStart(page, 10000);
      const finished = await waitForProcessingFinish(page, 35000);
      // Give a final small buffer for rendering
      await sleep(800);

      const postBodyText = await page.evaluate(() => document.body.textContent || '');
      const postLength = (postBodyText || '').length;
      const grew = postLength > preLength;

      // Check network API activity since this query
      const newCalls = results.network.apiCalls.slice(preNetworkCount);
      const apiOKCount = newCalls.filter(c => c.ok || (c.status >= 200 && c.status < 300)).length;

      // Validate response content heuristically
      const contentOK = includesAny(postBodyText, sc.expectText);

      const passed = (started && finished && grew && apiOKCount >= 1 && contentOK);
      // Note: Allow agent to work fully client-side; keep API requirement soft by default,
      // but we still record calls. If strict API requirement is desired, replace condition with apiOKCount >= 1.

      results.queries.push({
        id: sc.id,
        query: sc.query,
        passed,
        started,
        finished,
        grew,
        apiCallsRecorded: newCalls.length,
        api2xxCount: apiOKCount,
        contentOK,
        excerpt: (postBodyText || '').slice(0, 320)
      });
    }

    results.summary.total = results.queries.length;
    results.summary.passed = results.queries.filter(q => q.passed).length;
    results.summary.failed = results.summary.total - results.summary.passed;
    results.finishedAt = iso();

    const out = `ai-sidebar-resolution-verify-real-results-${results.startedAt.replace(/[:.]/g, '-').slice(0, 19)}.json`;
    fs.writeFileSync(out, JSON.stringify(results, null, 2));

    console.log('=== AI SIDEBAR RESOLUTION (REAL) ===');
    results.queries.forEach(q => {
      console.log(`[${q.passed ? 'PASS' : 'FAIL'}] ${q.id} - ${q.query} | start=${q.started} finish=${q.finished} grew=${q.grew} api2xx=${q.api2xxCount} content=${q.contentOK}`);
    });
    console.log(`Summary: ${results.summary.passed}/${results.summary.total} passed`);
    console.log(`Results saved: ${out}`);

    if (results.summary.failed > 0) process.exitCode = 1;

  } catch (err) {
    console.error('Real verification error:', err && err.message || err);
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  run().catch(e => {
    console.error(e);
    process.exit(2);
  });
}
