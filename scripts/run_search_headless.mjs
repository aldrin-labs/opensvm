import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import process from 'process';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3002';
const OUT_DIR = 'screenshots';
const REPORTS_DIR = 'reports-ai';

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {}
}

async function run() {
  await ensureDir(OUT_DIR);
  await ensureDir(REPORTS_DIR);

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
    ],
  });

  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
    bypassCSP: true,
  });
  const page = await ctx.newPage();

  try {
    // Navigate to search page (guaranteed to include EnhancedSearchBar)
    await page.goto(`${BASE_URL}/search`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Screenshot initial state
    await page.screenshot({ path: path.join(OUT_DIR, 'search-initial.png') });

    // Find search input
    const input = page.locator('input[aria-label="Search input"]');
    await input.first().waitFor({ state: 'visible', timeout: 15000 });

    // Type a query that should produce suggestions and submit
    await input.fill('sol');

    // Wait briefly for suggestions container to appear (best-effort)
    try {
      await page.waitForSelector('text=/Press\\s+Enter\\s+to\\s+select/i', { timeout: 3000 });
    } catch {
      // Ignore if suggestions footer not present
    }
    await page.screenshot({ path: path.join(OUT_DIR, 'search-typed.png') });

    // Press Enter to submit
    await input.press('Enter');

    // Wait for navigation to search results with query param
    await page.waitForURL(/\/search\?.*q=/i, { timeout: 20000 });

    // Wait for heading
    await page.waitForSelector('h1:has-text("Search Results for")', { timeout: 20000 });

    // Either results table or "No results found"
    const table = page.locator('table[aria-label="SVM search results"]');
    const noResults = page.locator('text=/No results found/i');

    await Promise.race([
      table.waitFor({ state: 'visible', timeout: 10000 }),
      noResults.waitFor({ state: 'visible', timeout: 10000 }),
    ]).catch(() => { /* tolerate if neither appears quickly */ });

    // Save HTML for inspection
    const html = await page.content();
    await fs.writeFile(path.join(REPORTS_DIR, 'search_results.html'), html, 'utf8');

    // Final screenshot
    await page.screenshot({ path: path.join(OUT_DIR, 'search-results.png'), fullPage: true });

    console.log('Headless search flow completed. Artifacts saved to:', OUT_DIR, REPORTS_DIR);
  } catch (err) {
    console.error('Headless search flow failed:', err);
    await page.screenshot({ path: path.join(OUT_DIR, 'search-error.png'), fullPage: true }).catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
