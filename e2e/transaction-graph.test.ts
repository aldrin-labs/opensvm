import { test, expect } from '@playwright/test';
import { TEST_CONSTANTS } from './utils/test-helpers';

// NOTE: Selectors updated to match TransactionGraph DOM. '.cytoscape-container' and '.transaction-graph-wrapper' replaced with '#cy-container'.
// If you update the component structure, update these selectors accordingly.

// Test transaction signature for consistent testing - using a working transaction ID
const TEST_TRANSACTION = '5JbxvGuxz64CgFidRvBEV6TGEpwtbBSvaxVJiXGJrMnqHKGmKk5wXJMhM1VujQ7WGjE3VDJp1oucukwW6LEuLWFo';

// Helper functions
async function waitForGraphLoad(page: any, timeout = 10000) {
  try {
    // Wait for either the graph container to load or an error message
    await Promise.race([
      page.waitForSelector('#cy-container', { state: 'attached', timeout }),
      page.waitForSelector('[role="alert"]', { state: 'attached', timeout })
    ]);

    // Give time for cytoscape to initialize
    await page.waitForTimeout(2000);
  } catch (error) {
    console.error('Error waiting for graph load:', error);
    throw error;
  }
}

// Helper function to wait for the TransactionGraph to be visible
async function waitForTransactionGraph(page: any) {
  try {
    // First, click on the "Graph" tab to make the TransactionGraph component visible
    // The tabs are Button components, not data-value elements
    const graphTab = page.locator('button:has-text("Graph")');
    const tabCount = await graphTab.count();

    if (tabCount === 0) {
      console.log('Graph tab not found, checking all available tabs...');
      const allTabs = page.locator('button');
      const tabTexts = await allTabs.evaluateAll((buttons: any) =>
        buttons.map((btn: any) => btn.textContent?.trim())
      );
      console.log('Available tabs:', tabTexts);
      throw new Error('Graph tab not found');
    }

    // Click on the "Graph" tab to make the TransactionGraph component visible
    await graphTab.click();
    await page.waitForTimeout(1000); // Wait for the tab to load

    // Now wait for the TransactionGraph component to be visible
    await page.waitForSelector('#cy-container', { state: 'visible', timeout: 15000 });

    // Give additional time for the graph to fully initialize
    await page.waitForTimeout(3000);
  } catch (error) {
    console.error('Error waiting for TransactionGraph:', error);

    // Try alternative selectors
    try {
      await page.waitForSelector('.transaction-graph, [data-testid*="graph"]', { state: 'visible', timeout: 5000 });
      console.log('Found graph with alternative selector');
    } catch (altError) {
      console.error('Alternative selectors also failed:', altError);

      // Check what's actually on the page
      const pageContent = await page.content();
      console.log('Page content preview:', pageContent.substring(0, 500));

      // Don't throw error, just log and continue
      console.log('Continuing test without graph visibility check');
    }
  }
}

test.describe('TransactionGraph Component', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the transaction overview page (which is where the transaction page redirects to)
    console.log('Navigating to transaction overview page:', `/tx/${TEST_TRANSACTION}/overview`);
    await page.goto(`/tx/${TEST_TRANSACTION}/overview`);
    await page.waitForLoadState('networkidle');

    // Add debugging to see what's on the page
    const pageTitle = await page.title();
    console.log('Page title:', pageTitle);

    // Check if there are any error messages
    const errorElements = page.locator('[role="alert"], .text-red-500, .text-destructive');
    const errorCount = await errorElements.count();
    if (errorCount > 0) {
      const errorText = await errorElements.first().textContent();
      console.log('Error found on page:', errorText);
    }

    // Debug: Check what elements are actually on the page
    console.log('Checking page elements...');

    // Check for loading spinners
    const loadingSpinners = page.locator('.loading, [data-loading], .spinner');
    const spinnerCount = await loadingSpinners.count();
    console.log(`Loading spinners found: ${spinnerCount}`);

    // Check for any graph-related elements
    const graphElements = page.locator('#cy-container, .transaction-graph, [data-testid*="graph"]');
    const graphCount = await graphElements.count();
    console.log(`Graph elements found: ${graphCount}`);

    // Check for any content at all
    const contentElements = page.locator('main, .container, .content');
    const contentCount = await contentElements.count();
    console.log(`Content elements found: ${contentCount}`);

    // Check for tabs (Button components)
    const tabElements = page.locator('button');
    const tabCount = await tabElements.count();
    console.log(`Tab elements found: ${tabCount}`);
    if (tabCount > 0) {
      const tabTexts = await tabElements.evaluateAll((buttons: any) =>
        buttons.map((btn: any) => btn.textContent?.trim())
      );
      console.log('Available tabs:', tabTexts);
    }

    // Wait for the page to load completely
    await waitForGraphLoad(page);
  });

  test('renders transaction page with tabs', async ({ page }) => {
    // Check that the page loads and shows tabs
    const tabElements = page.locator('button');
    await expect(tabElements.first()).toBeVisible();

    const tabCount = await tabElements.count();
    expect(tabCount).toBeGreaterThan(0);

    console.log('✅ Transaction page with tabs is visible');
  });

  test('renders graph container when graph tab is clicked', async ({ page }) => {
    // Wait for the TransactionGraph to be visible by clicking the graph tab
    await waitForTransactionGraph(page);

    // Check that the main graph container exists
    const graphContainer = page.locator('#cy-container');
    await expect(graphContainer).toBeVisible();

    // Check that the graph is properly initialized
    const cytoscapeContainer = page.locator('#cy-container');
    await expect(cytoscapeContainer).toBeVisible();

    console.log('✅ Graph container is visible after clicking graph tab');
  });

  test('shows loading state for TransactionGraph', async ({ page }) => {
    // Click on the graph tab
    const graphTab = page.locator('button:has-text("Graph")');
    await graphTab.click();
    await page.waitForTimeout(1000);

    // Check that there's a loading spinner or container for the graph
    const loadingSpinner = page.locator('.loading, [data-loading], .spinner');
    const graphContainer = page.locator('#cy-container, .transaction-graph');

    // Either the loading spinner should be visible or the graph container should exist
    const spinnerVisible = await loadingSpinner.isVisible();
    const containerExists = await graphContainer.count() > 0;

    expect(spinnerVisible || containerExists).toBe(true);

    console.log('✅ Loading state or graph container is present');
  });
});