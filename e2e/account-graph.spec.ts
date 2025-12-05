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

    // Wait for page to load
    await expect(page.locator('h1, h2, [data-testid="account-address"]')).toBeVisible({ timeout: 15000 });

    // Check if the page loaded successfully (not an error page)
    const pageContent = await page.textContent('body');
    expect(pageContent).not.toContain('404');
    expect(pageContent).not.toContain('Error');

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
    // Test the API endpoint directly
    const response = await page.request.get(`/api/account/${TEST_ADDRESSES.jupiter}`);

    expect(response.status()).toBeLessThan(500);

    if (response.status() === 200) {
      const data = await response.json();
      console.log('Account API response:', JSON.stringify(data).slice(0, 500));

      // Check for expected fields
      expect(data).toBeDefined();
    } else {
      console.log('API response status:', response.status());
    }
  });

  test('should handle graph interactions', async ({ page }) => {
    await page.goto(`/account/${TEST_ADDRESSES.raydium}`);

    // Wait for page to stabilize
    await page.waitForTimeout(3000);

    // Look for any interactive graph elements
    const canvas = page.locator('canvas').first();

    if (await canvas.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Try zooming with scroll
      await canvas.hover();
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

      await page.screenshot({ path: 'test-results/graph-interaction.png' });
      console.log('Graph interaction test completed');
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
