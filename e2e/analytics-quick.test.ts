import { test, expect } from '@playwright/test';

test.describe('Analytics Quick Tests', () => {
  test.use({ baseURL: 'http://localhost:3000' });

  test('should load analytics page', async ({ page }) => {
    await page.goto('/analytics');
    await expect(page.locator('h1')).toContainText('Solana Ecosystem Analytics');
  });

  test('should switch to DeFi Health tab and load data', async ({ page }) => {
    await page.goto('/analytics');
    
    // Click DeFi Health tab
    await page.click('button:has-text("DeFi Health")');
    
    // Wait for loading to complete (max 30 seconds)
    await page.waitForFunction(() => {
      const loadingElement = document.querySelector('.animate-spin');
      const errorElement = document.querySelector('.text-destructive');
      const dataElement = document.querySelector('text=Protocol Health') || 
                          document.querySelector('text=Raydium') ||
                          document.querySelector('table');
      
      // Return true if no loading spinner AND (we have data OR an error)
      return !loadingElement && (dataElement || errorElement);
    }, undefined, { timeout: 30000 });

    // Check if we got data or error
    const hasError = await page.locator('.text-destructive').count() > 0;
    const hasData = await page.locator('text=Raydium').count() > 0 || 
                   await page.locator('table').count() > 0;
    
    if (hasError) {
      const errorText = await page.locator('.text-destructive').textContent();
      throw new Error(`DeFi Health tab has error: ${errorText}`);
    }
    
    expect(hasData).toBe(true);
  });

  test('should switch to Validators tab and load data', async ({ page }) => {
    await page.goto('/analytics');
    
    // Click Validators tab
    await page.click('button:has-text("Validators")');
    
    // Wait for loading to complete (max 30 seconds)
    await page.waitForFunction(() => {
      const loadingElement = document.querySelector('.animate-spin');
      const errorElement = document.querySelector('.text-destructive');
      const dataElement = document.querySelector('text=Validator Performance') || 
                          document.querySelector('text=Coinbase Cloud') ||
                          document.querySelector('table');
      
      // Return true if no loading spinner AND (we have data OR an error)
      return !loadingElement && (dataElement || errorElement);
    }, undefined, { timeout: 30000 });

    // Check if we got data or error
    const hasError = await page.locator('.text-destructive').count() > 0;
    const hasData = await page.locator('text=Coinbase Cloud').count() > 0 || 
                   await page.locator('table').count() > 0;
    
    if (hasError) {
      const errorText = await page.locator('.text-destructive').textContent();
      throw new Error(`Validators tab has error: ${errorText}`);
    }
    
    expect(hasData).toBe(true);
  });

  test('should test monitoring buttons work', async ({ page }) => {
    await page.goto('/analytics');
    
    // Test DeFi Health monitoring
    await page.click('button:has-text("DeFi Health")');
    await page.waitForTimeout(3000); // Wait for tab to load
    
    const monitoringButton = page.locator('button:has-text("Start Monitoring"), button:has-text("Stop Monitoring")');
    if (await monitoringButton.count() > 0) {
      const initialText = await monitoringButton.textContent();
      await monitoringButton.click();
      await page.waitForTimeout(2000);
      const newText = await monitoringButton.textContent();
      expect(newText).not.toBe(initialText);
    }
  });
});