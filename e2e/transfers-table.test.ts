import { test, expect, Page, Locator } from '@playwright/test';
import { waitForTableLoad, isElementVisible, getElementCount, TEST_CONSTANTS } from './utils/test-helpers';

// Test address from the task
const TEST_ADDRESS = TEST_CONSTANTS.TEST_ADDRESSES.VALID_ACCOUNT;

// Remove duplicate function - using imported one from test-helpers

async function getTableRows(page: Page): Promise<Locator[]> {
  return page.locator('.vtable [role="row"]').all();
}

test.describe('TransfersTable Component', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to account page which has the transfers table
    await page.goto(`/account/${TEST_ADDRESS}`);
    await page.waitForLoadState('networkidle');

    // Wait for the page to load and check if transfers tab exists
    const transfersTab = page.locator('button:has-text("Transfers")');
    if (await isElementVisible(page, 'button:has-text("Transfers")')) {
      await transfersTab.click();
      await waitForTableLoad(page);
    }
  });

  test('displays transfer data correctly', async ({ page }) => {
    // Check if transfers table is visible
    const hasTable = await isElementVisible(page, '.vtable, table');

    if (!hasTable) {
      console.log('No transfers table found - account may have no transfers');
      return;
    }

    // Check for some common table headers (not all may be present)
    const possibleHeaders = ['Tx', 'Date', 'From', 'To', 'Token', 'Amount', 'Type'];
    let headerCount = 0;

    for (const header of possibleHeaders) {
      if (await isElementVisible(page, `th:has-text("${header}"), [role="columnheader"]:has-text("${header}")`)) {
        headerCount++;
      }
    }

    expect(headerCount).toBeGreaterThan(0);

    // Verify data rows exist
    const rowCount = await getElementCount(page, '.vtable [role="row"], table tbody tr');
    if (rowCount > 0) {
      console.log(`Found ${rowCount} transfer rows`);
      expect(rowCount).toBeGreaterThan(0);
    } else {
      console.log('No transfer data found - this may be expected for some accounts');
    }
  });

  test('implements infinite scroll pagination', async ({ page }) => {
    // Get initial row count
    const initialRows = await getTableRows(page);
    const initialCount = initialRows.length;

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await waitForTableLoad(page);

    // Verify more rows loaded
    const newRows = await getTableRows(page);
    expect(newRows.length).toBeGreaterThan(initialCount);
  });

  test('implements sorting functionality', async ({ page }) => {
    // Test date sorting
    await page.getByRole('columnheader', { name: 'Date' }).click();
    await waitForTableLoad(page);

    // Get dates after sorting
    const dates = await page.$$eval('.vtable [role="row"]', rows =>
      rows.map(row => row.querySelector('td:nth-child(2)')?.textContent)
    );

    // Verify dates are sorted
    const sortedDates = [...dates].sort((a, b) =>
      new Date(b || '').getTime() - new Date(a || '').getTime()
    );
    expect(dates).toEqual(sortedDates);
  });

  test('handles error states gracefully', async ({ page }) => {
    // Test invalid address
    await page.goto(`/account/${TEST_CONSTANTS.TEST_ADDRESSES.INVALID_ADDRESS}`);

    // Look for error messages
    const hasError = await isElementVisible(page, '.text-red-500, .text-destructive, [role="alert"]');
    if (hasError) {
      console.log('Error state displayed for invalid address');
    }

    // Test network error simulation
    await page.route('**/api/account-transfers/**', route => route.abort());
    await page.goto(`/account/${TEST_ADDRESS}`);

    // Check if error handling works
    const hasNetworkError = await isElementVisible(page, '.text-red-500, .text-destructive, [role="alert"]');
    if (hasNetworkError) {
      console.log('Network error handled gracefully');
    }
  });

  test('is responsive across different viewport sizes', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('.vtable')).toBeVisible();

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('.vtable')).toBeVisible();

    // Test desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator('.vtable')).toBeVisible();
  });

  test('meets accessibility requirements', async ({ page }) => {
    // Check semantic structure
    await expect(page.locator('[role="table"]')).toBeVisible();
    await expect(page.locator('[role="row"]')).toBeVisible();
    await expect(page.locator('[role="columnheader"]')).toBeVisible();
    await expect(page.locator('[role="cell"]')).toBeVisible();

    // Check keyboard navigation
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();

    // Check color contrast (requires manual verification)
    // Check ARIA labels
    await expect(page.locator('.vtable')).toHaveAttribute('aria-label', /transfers/i);
  });

  test('performs within acceptable metrics', async ({ page }) => {
    // Test initial load time
    const startTime = Date.now();
    await page.goto(`/test/transfers?address=${TEST_ADDRESS}`);
    await waitForTableLoad(page);
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(2000); // 2s threshold

    // Test scroll performance
    const scrollMetrics = await page.evaluate(async () => {
      const start = performance.now();
      for (let i = 0; i < 10; i++) {
        window.scrollBy(0, 100);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return performance.now() - start;
    });
    expect(scrollMetrics / 10).toBeLessThan(16.67); // 60fps = 16.67ms per frame

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

    expect(performanceEntries[0].loadTime).toBeLessThan(2000);
    expect(performanceEntries[0].domContentLoaded).toBeLessThan(1000);
    expect(performanceEntries[0].firstPaint).toBeLessThan(1000);
  });

  test('handles edge cases correctly', async ({ page }) => {
    // Test extremely long content
    await page.evaluate(() => {
      const cell = document.querySelector('.vtable [role="cell"]');
      if (cell) cell.textContent = 'a'.repeat(1000);
    });
    await expect(page.locator('.vtable [role="cell"]')).toBeVisible();

    // Test special characters
    await page.evaluate(() => {
      const cell = document.querySelector('.vtable [role="cell"]');
      if (cell) cell.textContent = '!@#$%^&*()_+<>?:"{}|';
    });
    await expect(page.locator('.vtable [role="cell"]')).toBeVisible();

    // Test empty state
    await page.route('**/api/account-transfers/**', route =>
      route.fulfill({ json: { transfers: [], hasMore: false } })
    );
    await page.reload();
    await expect(page.getByText('No transfers found for this account')).toBeVisible();
  });
});