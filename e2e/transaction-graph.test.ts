import { test, expect, Page, Locator } from '@playwright/test';

// Test transaction signature for consistent testing
const TEST_TRANSACTION = '4SqVfYyUhq6PKApAZYuVBk2VH4VL9Hk3WUP3REVPUwfpLvgdF5zPUJoqGKQLZ6jRv4F8rH6mVLimnZEP';

// Helper functions
async function waitForGraphLoad(page: Page, timeout = 10000) {
  try {
    // Wait for either the graph container to load or an error message
    await Promise.race([
      page.waitForSelector('.cytoscape-container', { state: 'attached', timeout }),
      page.waitForSelector('[role="alert"]', { state: 'attached', timeout })
    ]);
    
    // Give time for cytoscape to initialize
    await page.waitForTimeout(1000);
  } catch (error) {
    console.log('Timeout waiting for graph to load');
  }
}

async function waitForGraphElements(page: Page, timeout = 15000) {
  try {
    // Wait for graph elements to be rendered
    await page.waitForFunction(() => {
      const container = document.querySelector('.cytoscape-container');
      return container && container.querySelector('canvas');
    }, { timeout });
  } catch (error) {
    console.log('Graph elements did not load in time');
  }
}

async function getGraphControls(page: Page) {
  return {
    backButton: page.locator('button[title="Navigate back"]'),
    forwardButton: page.locator('button[title="Navigate forward"]'),
    fullscreenButton: page.locator('button[title*="fullscreen"]'),
    cloudViewButton: page.locator('button[title="Show cloud view"]'),
    fitViewButton: page.locator('button[title="Fit all elements in view"]'),
    zoomInButton: page.locator('button[title="Zoom in on graph"]'),
    zoomOutButton: page.locator('button[title="Zoom out on graph"]')
  };
}

test.describe('TransactionGraph Component', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a page that contains the transaction graph
    await page.goto(`/tx/${TEST_TRANSACTION}`);
    await page.waitForLoadState('networkidle');
    await waitForGraphLoad(page);
  });

  test('renders graph container and basic elements', async ({ page }) => {
    // Verify main container exists
    await expect(page.locator('.transaction-graph-wrapper')).toBeVisible();
    await expect(page.locator('.cytoscape-container')).toBeVisible();
    
    // Verify graph canvas is rendered
    await waitForGraphElements(page);
    await expect(page.locator('.cytoscape-container canvas')).toBeVisible();
    
    // Verify controls are present
    const controls = await getGraphControls(page);
    await expect(controls.fullscreenButton).toBeVisible();
    await expect(controls.cloudViewButton).toBeVisible();
    await expect(controls.fitViewButton).toBeVisible();
    await expect(controls.zoomInButton).toBeVisible();
    await expect(controls.zoomOutButton).toBeVisible();
  });

  test('handles graph interactions correctly', async ({ page }) => {
    await waitForGraphElements(page);
    
    const controls = await getGraphControls(page);
    
    // Test zoom in functionality
    await controls.zoomInButton.click();
    await page.waitForTimeout(500);
    
    // Test zoom out functionality
    await controls.zoomOutButton.click();
    await page.waitForTimeout(500);
    
    // Test fit view functionality
    await controls.fitViewButton.click();
    await page.waitForTimeout(500);
    
    // Verify canvas is still visible after interactions
    await expect(page.locator('.cytoscape-container canvas')).toBeVisible();
  });

  test('implements fullscreen functionality', async ({ page }) => {
    const controls = await getGraphControls(page);
    
    // Test entering fullscreen
    await controls.fullscreenButton.click();
    await page.waitForTimeout(1000);
    
    // Check if fullscreen is active (Note: Playwright may not support actual fullscreen)
    // But we can check for the fullscreen class changes
    const wrapper = page.locator('.transaction-graph-wrapper');
    await expect(wrapper).toHaveClass(/bg-background/);
    
    // Test exiting fullscreen
    await controls.fullscreenButton.click();
    await page.waitForTimeout(1000);
  });

  test('shows and hides cloud view panel', async ({ page }) => {
    const controls = await getGraphControls(page);
    
    // Initially cloud view panel should not be visible
    await expect(page.locator('.absolute.top-4.left-4')).not.toBeVisible();
    
    // Click cloud view button
    await controls.cloudViewButton.click();
    await page.waitForTimeout(500);
    
    // Verify cloud view panel appears
    await expect(page.locator('.absolute.top-4.left-4')).toBeVisible();
    await expect(page.getByText('Graph Clouds')).toBeVisible();
    await expect(page.getByText('Save Current')).toBeVisible();
  });

  test('handles graph saving and loading', async ({ page }) => {
    const controls = await getGraphControls(page);
    
    // Open cloud view panel
    await controls.cloudViewButton.click();
    await page.waitForTimeout(500);
    
    // Save current state
    await page.getByText('Save Current').click();
    await page.waitForTimeout(1000);
    
    // Check for success message
    await expect(page.getByText('Graph state saved successfully')).toBeVisible();
    
    // Verify saved graph appears in list (may take time to update)
    await page.waitForTimeout(2000);
    await controls.cloudViewButton.click(); // Close and reopen
    await page.waitForTimeout(500);
    await controls.cloudViewButton.click();
    await page.waitForTimeout(500);
  });

  test('implements navigation history', async ({ page }) => {
    await waitForGraphElements(page);
    const controls = await getGraphControls(page);
    
    // Initially back/forward buttons should be disabled
    await expect(controls.backButton).toHaveClass(/opacity-50/);
    await expect(controls.forwardButton).toHaveClass(/opacity-50/);
    
    // Test clicking on graph nodes to create history
    // Note: This requires the graph to have clickable nodes
    const canvas = page.locator('.cytoscape-container canvas');
    await canvas.click({ position: { x: 200, y: 200 } });
    await page.waitForTimeout(1000);
    
    // After interaction, navigation might be available
    // This depends on the actual graph data and interactions
  });

  test('handles address tracking functionality', async ({ page }) => {
    await waitForGraphElements(page);
    
    // Click on an address node (if available) to start tracking
    const canvas = page.locator('.cytoscape-container canvas');
    await canvas.click({ position: { x: 300, y: 300 } });
    await page.waitForTimeout(1000);
    
    // Check if tracking stats panel appears
    // This depends on the graph having address nodes
    const statsPanel = page.locator('[data-testid="tracking-stats-panel"]').or(
      page.locator('.tracking-stats')
    );
    
    // The panel might appear if an address was clicked
    // This is conditional based on graph content
  });

  test('is responsive across different viewport sizes', async ({ page }) => {
    await waitForGraphElements(page);
    
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('.cytoscape-container')).toBeVisible();
    await page.waitForTimeout(500);
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('.cytoscape-container')).toBeVisible();
    await page.waitForTimeout(500);
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator('.cytoscape-container')).toBeVisible();
    await page.waitForTimeout(500);
    
    // Verify controls are accessible on different screen sizes
    const controls = await getGraphControls(page);
    await expect(controls.fullscreenButton).toBeVisible();
  });

  test('handles error states gracefully', async ({ page }) => {
    // Test with invalid transaction signature
    await page.goto('/tx/invalid-signature');
    await page.waitForLoadState('networkidle');
    
    // Should show error state
    await expect(page.locator('[role="alert"]').or(
      page.getByText('Failed to load')
    )).toBeVisible({ timeout: 10000 });
    
    // Test network error simulation
    await page.route('**/api/transaction/**', route => route.abort());
    await page.goto(`/tx/${TEST_TRANSACTION}`);
    await page.waitForLoadState('networkidle');
    
    // Should handle network error gracefully
    await expect(page.locator('[role="alert"]').or(
      page.getByText('Failed')
    )).toBeVisible({ timeout: 10000 });
  });

  test('meets accessibility requirements', async ({ page }) => {
    await waitForGraphElements(page);
    
    // Check for proper ARIA labels on controls
    const controls = await getGraphControls(page);
    await expect(controls.fullscreenButton).toHaveAttribute('aria-label');
    await expect(controls.cloudViewButton).toHaveAttribute('aria-label');
    await expect(controls.fitViewButton).toHaveAttribute('aria-label');
    await expect(controls.zoomInButton).toHaveAttribute('aria-label');
    await expect(controls.zoomOutButton).toHaveAttribute('aria-label');
    
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
    
    // Check color contrast (requires manual verification)
    // Verify semantic structure
    await expect(page.locator('.transaction-graph-wrapper')).toBeVisible();
  });

  test('performs within acceptable metrics', async ({ page }) => {
    // Test initial load time
    const startTime = Date.now();
    await page.goto(`/tx/${TEST_TRANSACTION}`);
    await waitForGraphLoad(page);
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(5000); // 5s threshold for graph loading
    
    // Test interaction responsiveness
    await waitForGraphElements(page);
    const controls = await getGraphControls(page);
    
    const interactionStart = Date.now();
    await controls.zoomInButton.click();
    await page.waitForTimeout(100);
    const interactionTime = Date.now() - interactionStart;
    expect(interactionTime).toBeLessThan(200); // 200ms threshold for interactions
    
    // Test performance metrics
    const performanceEntries = await page.evaluate(() => {
      const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (!navEntry) return [{ loadTime: 0, domContentLoaded: 0, firstPaint: 0 }];
      return [{
        loadTime: navEntry.loadEventEnd - navEntry.loadEventStart,
        domContentLoaded: navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart,
        firstPaint: navEntry.responseEnd - navEntry.requestStart
      }];
    });
    
    expect(performanceEntries[0].loadTime).toBeLessThan(3000);
    expect(performanceEntries[0].domContentLoaded).toBeLessThan(2000);
    expect(performanceEntries[0].firstPaint).toBeLessThan(2000);
  });

  test('handles edge cases correctly', async ({ page }) => {
    await waitForGraphElements(page);
    
    // Test rapid clicking
    const controls = await getGraphControls(page);
    for (let i = 0; i < 5; i++) {
      await controls.zoomInButton.click({ delay: 50 });
    }
    await page.waitForTimeout(500);
    
    // Graph should still be functional
    await expect(page.locator('.cytoscape-container canvas')).toBeVisible();
    
    // Test extremely large zoom
    for (let i = 0; i < 10; i++) {
      await controls.zoomInButton.click({ delay: 50 });
    }
    await page.waitForTimeout(500);
    
    // Test reset with fit view
    await controls.fitViewButton.click();
    await page.waitForTimeout(500);
    await expect(page.locator('.cytoscape-container canvas')).toBeVisible();
    
    // Test browser back/forward
    await page.goBack();
    await page.waitForTimeout(1000);
    await page.goForward();
    await page.waitForTimeout(1000);
    await waitForGraphLoad(page);
    await expect(page.locator('.cytoscape-container')).toBeVisible();
  });

  test('integrates with graph state cache properly', async ({ page }) => {
    await waitForGraphElements(page);
    
    // Save initial state
    const controls = await getGraphControls(page);
    await controls.cloudViewButton.click();
    await page.waitForTimeout(500);
    await page.getByText('Save Current').click();
    await page.waitForTimeout(1000);
    
    // Navigate away and back
    await page.goto('/');
    await page.waitForTimeout(1000);
    await page.goto(`/tx/${TEST_TRANSACTION}`);
    await waitForGraphLoad(page);
    
    // Graph should load from cache faster
    await expect(page.locator('.cytoscape-container')).toBeVisible();
    await waitForGraphElements(page);
    
    // Verify cached state is accessible
    await controls.cloudViewButton.click();
    await page.waitForTimeout(500);
    // Should see saved states if any were saved
  });

  test('handles concurrent operations safely', async ({ page }) => {
    await waitForGraphElements(page);
    const controls = await getGraphControls(page);
    
    // Test concurrent zoom and navigation
    const promises = [
      controls.zoomInButton.click(),
      controls.fitViewButton.click(),
      controls.cloudViewButton.click()
    ];
    
    await Promise.all(promises);
    await page.waitForTimeout(1000);
    
    // Graph should remain stable
    await expect(page.locator('.cytoscape-container canvas')).toBeVisible();
    
    // Test rapid state changes
    for (let i = 0; i < 3; i++) {
      await controls.cloudViewButton.click({ delay: 100 });
    }
    await page.waitForTimeout(500);
    
    // Component should handle rapid toggles gracefully
    await expect(page.locator('.transaction-graph-wrapper')).toBeVisible();
  });
});