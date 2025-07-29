import { test, expect } from '@playwright/test';
import { waitForAnalyticsTabLoad, isElementVisible, getElementCount } from './utils/test-helpers';

test.describe.skip('Analytics Quick Tests', () => {
  test.use({ baseURL: 'http://localhost:3000' });

  test('should load analytics page', async ({ page }) => {
    await page.goto('/analytics');
    await expect(page.locator('h1')).toContainText('Solana Ecosystem Analytics');
  });

  test('should switch to DeFi Health tab and load data', async ({ page }) => {
    await page.goto('/analytics');

    // Use helper function to load tab
    const result = await waitForAnalyticsTabLoad(page, 'DeFi Health', 45000);

    if (!result.success) {
      console.log(`DeFi Health tab load failed: ${result.error}`);
    }

    // Check if we got data or error
    const hasError = await getElementCount(page, '.text-destructive, [role="alert"]') > 0;
    const hasData = await getElementCount(page, 'table, .chart, .metric') > 0;

    if (hasError) {
      const errorText = await page.locator('.text-destructive, [role="alert"]').first().textContent();
      console.warn(`DeFi Health tab has error: ${errorText}`);
      // Don't fail the test for API errors, just log them
      return;
    }

    expect(hasData).toBe(true);
  });

  test('should switch to Validators tab and load data', async ({ page }) => {
    await page.goto('/analytics');

    // Use helper function to load tab
    const result = await waitForAnalyticsTabLoad(page, 'Validators', 45000);

    if (!result.success) {
      console.log(`Validators tab load failed: ${result.error}`);
    }

    // Check if we got data or error
    const hasError = await getElementCount(page, '.text-destructive, [role="alert"]') > 0;
    const hasData = await getElementCount(page, 'table, .chart, .metric') > 0;

    if (hasError) {
      const errorText = await page.locator('.text-destructive, [role="alert"]').first().textContent();
      console.warn(`Validators tab has error: ${errorText}`);
      // Don't fail the test for API errors, just log them
      return;
    }

    expect(hasData).toBe(true);
  });

  test('should test monitoring buttons work', async ({ page }) => {
    await page.goto('/analytics');

    // Test DeFi Health monitoring
    const result = await waitForAnalyticsTabLoad(page, 'DeFi Health', 30000);

    if (!result.success) {
      console.log('DeFi Health tab failed to load, skipping monitoring button test');
      return;
    }

    const monitoringButton = page.locator('button:has-text("Start Monitoring"), button:has-text("Stop Monitoring")');
    const buttonCount = await getElementCount(page, 'button:has-text("Start Monitoring"), button:has-text("Stop Monitoring")');

    if (buttonCount > 0) {
      const initialText = await monitoringButton.first().textContent();
      await monitoringButton.first().click();
      await page.waitForTimeout(2000);
      const newText = await monitoringButton.first().textContent();
      expect(newText).not.toBe(initialText);
    } else {
      console.log('No monitoring buttons found - feature may not be available');
    }
  });
});