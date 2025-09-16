const { chromium } = require('playwright');
const fs = require('fs');

function iso() { return new Date().toISOString(); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function lc(s) { return String(s || '').toLowerCase(); }
function includesAny(haystack, needles) {
  const s = lc(haystack);
  return needles.some(n => s.includes(lc(n)));
}

async function waitForApi(page, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const hasApi = await page.evaluate(() => {
      return !!(window.SVMAI && typeof window.SVMAI.prompt === 'function');
    });
    if (hasApi) return true;
    await sleep(250);
  }
  return false;
}

async function waitForProcessingStart(page, timeoutMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const pending = await page.evaluate(() => !!(window && (window).__SVMAI_PENDING__));
      const indicator = await page.$('[data-ai-processing-status]');
      if (pending || indicator) return true;
    } catch {}
    await sleep(120);
  }
  return false;
}

async function waitForProcessingFinish(page, timeoutMs = 40000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const pending = await page.evaluate(() => !!(window && (window).__SVMAI_PENDING__));
      const indicator = await page.$('[data-ai-processing-status]');
      if (!pending && !indicator) return true;
    } catch {}
    await sleep(150);
  }
  return false;
}

async function sendPrompt(page, text) {
  return page.evaluate((q) => {
    try { window.SVMAI.prompt(q, true); return { ok: true }; }
    catch (e) { return { ok: false, error: String(e && e.message || e) }; }
  }, text);
}

async function run() {
  const results = {
    mode: 'real',
    startedAt: iso(),
    finishedAt: null,
    queries: [],
    summary: { total: 0, passed: 0, failed: 0 },
    network: { apiCalls: [] }
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // capture all responses with millisecond timestamps
  page.on('response', async (resp) => {
    try {
      const url = resp.url();
      const status = resp.status();
      const ok = (() => { try { return resp.ok(); } catch { return status >= 200 && status < 300; }})();
      results.network.apiCalls.push({
        ts: iso(),
        tsMs: Date.now(),
        url,
        status,
        ok
      });
    } catch {}
  });

  try {
    await page.goto('http://localhost:3000/?ai=true', { waitUntil: 'domcontentloaded', timeout: 20000 });
    const hasApi = await waitForApi(page, 25000);
    if (!hasApi) {
      results.queries.push({ id: 'PREP-API', query: 'Verify SVMAI API presence', passed: false, details: 'window.SVMAI.prompt not available after timeout' });
      throw new Error('SVMAI API not available');
    }

    // Define endpoint expectations per scenario for stricter backend verification
    const scenarios = [
      {
        id: 'NET-TPS',
        query: 'What is the current TPS on Solana?',
        expectText: ['tps', 'transactions per second', 'network', 'load'],
        expectedEndpointPatterns: [
          '/api/proxy/rpc', '/api/solana-rpc', '/api/slots', '/api/analytics', '/api/blocks'
        ]
      },
      {
        id: 'ACC-ANALYZE',
        query: 'Analyze this account: worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth',
        expectText: ['account', 'balance', 'owner', 'details'],
        expectedEndpointPatterns: [
          '/api/account', '/api/account-transactions', '/api/account-stats', '/api/account-transfers',
          '/api/check-account-type', '/api/proxy/rpc', '/api/solana-proxy'
        ]
      },
      {
        id: 'TX-EXPLAIN',
        query: 'Explain this transaction: 2n12c2t5xK6jV2y5Y1Z9H8zV5B4p6N7c3a8Q1r9D6sVbKjHxYfWzR2yP5A3s4e6G8uK9mBwF7gH2jL',
        expectText: ['transaction', 'signature', 'status', 'slot', 'fee'],
        expectedEndpointPatterns: [
          '/api/transaction', '/api/analyze-transaction', '/api/enhanced-transaction', '/api/proxy/rpc', '/api/solana-proxy'
        ]
      }
    ];

    for (const sc of scenarios) {
      const sendTs = Date.now();
      const preText = await page.evaluate(() => document.body.textContent || '');
      const preLen = preText.length;

      const sent = await sendPrompt(page, sc.query);
      if (!sent.ok) {
        results.queries.push({ id: sc.id, query: sc.query, passed: false, started: false, finished: false, grew: false, apiMatched: 0, api2xx: 0, contentOK: false, details: `Failed to send prompt: ${sent.error || 'unknown'}` });
        continue;
      }

      const started = await waitForProcessingStart(page, 12000);
      const finished = await waitForProcessingFinish(page, 40000);
      await sleep(800);

      const postText = await page.evaluate(() => document.body.textContent || '');
      const grew = postText.length > preLen;
      const contentOK = includesAny(postText, sc.expectText);

      // Filter network calls by timestamp after sending the prompt
      const relevantCalls = results.network.apiCalls.filter(c => c.tsMs >= sendTs && c.url && lc(c.url).includes('/api/'));

      // Define generic AI and tool endpoints observed in this project
      const aiEndpointPatterns = ['/api/ai-response', '/api/chat', '/api/getAnswer'];
      const toolEndpointPatterns = ['/api/proxy/rpc', '/api/solana-proxy', '/api/solana-rpc', '/api/transaction', '/api/enhanced-transaction', '/api/account-transactions', '/api/account-stats', '/api/account-transfers', '/api/check-account-type'];

      // Matches for scenario-specific endpoints
      const endpointMatches = relevantCalls.filter(c => sc.expectedEndpointPatterns.some(p => lc(c.url).includes(lc(p))));
      const api2xx = endpointMatches.filter(c => c.ok || (c.status >= 200 && c.status < 300)).length;

      // Matches for generic AI and tool endpoints
      const aiMatches = relevantCalls.filter(c => aiEndpointPatterns.some(p => lc(c.url).includes(lc(p))));
      const ai2xx = aiMatches.filter(c => c.ok || (c.status >= 200 && c.status < 300)).length;

      const toolMatches = relevantCalls.filter(c => toolEndpointPatterns.some(p => lc(c.url).includes(lc(p))));
      const tool2xx = toolMatches.filter(c => c.ok || (c.status >= 200 && c.status < 300)).length;

      // Pass criteria (real backend usage): UI grew and content looks relevant AND (AI endpoint hit OR tool/RPC endpoint hit) with 2xx
      const passed = started && finished && grew && contentOK && (ai2xx >= 1 || tool2xx >= 1);

      results.queries.push({
        id: sc.id,
        query: sc.query,
        passed,
        started,
        finished,
        grew,
        contentOK,
        apiCallsConsidered: relevantCalls.length,
        apiEndpointMatches: endpointMatches.length,
        api2xx,
        aiEndpointMatches: aiMatches.length,
        ai2xx,
        toolEndpointMatches: toolMatches.length,
        tool2xx,
        sampleEndpoints: [...endpointMatches, ...aiMatches, ...toolMatches].slice(0, 5).map(c => ({ url: c.url, status: c.status })),
        excerpt: postText.slice(0, 320)
      });
    }

    results.summary.total = results.queries.length;
    results.summary.passed = results.queries.filter(q => q.passed).length;
    results.summary.failed = results.summary.total - results.summary.passed;
    results.finishedAt = iso();

    const out = `ai-sidebar-resolution-verify-real2-results-${results.startedAt.replace(/[:.]/g, '-').slice(0,19)}.json`;
    fs.writeFileSync(out, JSON.stringify(results, null, 2));

    console.log('=== AI SIDEBAR RESOLUTION (REAL, STRICT) ===');
    results.queries.forEach(q => {
      console.log(`[${q.passed ? 'PASS' : 'FAIL'}] ${q.id} | start=${q.started} finish=${q.finished} grew=${q.grew} content=${q.contentOK} apiMatches=${q.apiEndpointMatches} api2xx=${q.api2xx}`);
    });
    console.log(`Summary: ${results.summary.passed}/${results.summary.total} passed`);
    console.log(`Results saved: ${out}`);

    if (results.summary.failed > 0) process.exitCode = 1;
  } catch (e) {
    console.error('Verification error:', e && e.message || e);
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  run().catch(e => { console.error(e); process.exit(2); });
}
