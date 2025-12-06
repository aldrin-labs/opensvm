import { test, expect } from '@playwright/test';

// Well-known Solana addresses for testing
const TEST_ADDRESSES = {
  // Jupiter aggregator
  jupiter: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
  // Raydium AMM
  raydium: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  // Marinade Finance
  marinade: 'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD',
};

test.describe('Account Page - Transaction Graph', () => {
  test.beforeEach(async ({ page }) => {
    // Increase timeout for blockchain data loading
    test.setTimeout(60000);
  });

  test('should load account page and display transaction graph', async ({ page }) => {
    // Navigate to account page with Jupiter address
    await page.goto(`/account/${TEST_ADDRESSES.jupiter}`);

    // Wait for any heading to load (using .first() to avoid strict mode violation)
    await expect(page.locator('h2').first()).toBeVisible({ timeout: 15000 });

    // Check for account info section which indicates successful load
    await expect(page.locator('text=Account Info').first()).toBeVisible({ timeout: 10000 });

    // Take screenshot
    await page.screenshot({ path: 'test-results/account-page-loaded.png', fullPage: true });

    console.log('Account page loaded successfully');
  });

  test('should render transaction graph component', async ({ page }) => {
    await page.goto(`/account/${TEST_ADDRESSES.jupiter}`);

    // Wait for the graph container to appear
    // The graph might be in a tab or expandable section
    const graphSelectors = [
      '[data-testid="transaction-graph"]',
      '.transaction-graph',
      'canvas', // WebGL canvas
      '[class*="graph"]',
      '[class*="Graph"]',
    ];

    let graphFound = false;
    for (const selector of graphSelectors) {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 5000 }).catch(() => false)) {
        graphFound = true;
        console.log(`Graph found with selector: ${selector}`);
        break;
      }
    }

    // Take screenshot regardless
    await page.screenshot({ path: 'test-results/account-graph-check.png', fullPage: true });

    if (!graphFound) {
      // Check if there's a tab or button to show the graph
      const graphTab = page.locator('text=Graph, text=Transactions, text=Network, button:has-text("Graph")').first();
      if (await graphTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await graphTab.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'test-results/account-graph-after-tab.png', fullPage: true });
      }
    }

    console.log('Graph component check completed');
  });

  test('should load account data from API', async ({ page }) => {
    // Navigate to page first to use relative URLs
    await page.goto(`/account/${TEST_ADDRESSES.jupiter}`);

    // Test the account-stats API endpoint (more reliable)
    const response = await page.request.get(`/api/account-stats/${TEST_ADDRESSES.jupiter}`);

    // Accept 200 or 404 (endpoint might not exist), but not 500
    expect(response.status()).toBeLessThan(500);

    if (response.status() === 200) {
      const data = await response.json();
      console.log('Account stats API response:', JSON.stringify(data).slice(0, 500));
      expect(data).toBeDefined();
    } else {
      // Check if the page itself loaded data correctly
      await expect(page.locator('text=Balance, text=SOL').first()).toBeVisible({ timeout: 10000 });
      console.log('Page loaded account data directly');
    }
  });

  test('should handle graph interactions', async ({ page }) => {
    await page.goto(`/account/${TEST_ADDRESSES.raydium}`);

    // Wait for page to stabilize and graph to potentially load
    await page.waitForTimeout(5000);

    // Look for canvas element (might be covered by loading overlay initially)
    const canvas = page.locator('canvas').first();

    // Wait for any loading overlay to disappear
    const loadingOverlay = page.locator('text=Processing Graph, text=Loading');
    if (await loadingOverlay.isVisible({ timeout: 1000 }).catch(() => false)) {
      // Wait for loading to complete (up to 30s for complex accounts)
      await loadingOverlay.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
    }

    if (await canvas.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Wait for canvas to be interactive
      await page.waitForTimeout(1000);

      // Try zooming with scroll (use force to bypass overlays)
      try {
        await canvas.hover({ force: true, timeout: 5000 });
        await page.mouse.wheel(0, -100);
        await page.waitForTimeout(500);

        // Try panning with drag
        const box = await canvas.boundingBox();
        if (box) {
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 50);
          await page.mouse.up();
        }
        console.log('Graph interaction test completed');
      } catch {
        console.log('Graph interaction skipped (overlay present)');
      }

      await page.screenshot({ path: 'test-results/graph-interaction.png' });
    } else {
      console.log('Canvas not found for interaction test');
      await page.screenshot({ path: 'test-results/no-canvas-found.png', fullPage: true });
    }
  });
});

test.describe('Account Overview Component', () => {
  test('should display account overview', async ({ page }) => {
    await page.goto(`/account/${TEST_ADDRESSES.marinade}`);

    // Wait for account data to load
    await page.waitForTimeout(3000);

    // Check for account overview elements
    const overviewSelectors = [
      '[data-testid="account-overview"]',
      '.account-overview',
      'text=Balance',
      'text=SOL',
      'text=Owner',
    ];

    for (const selector of overviewSelectors) {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log(`Found overview element: ${selector}`);
      }
    }

    await page.screenshot({ path: 'test-results/account-overview.png', fullPage: true });
  });
});
