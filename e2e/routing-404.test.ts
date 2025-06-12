import { test, expect } from '@playwright/test';

test.describe('Routing and 404 Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the homepage before each test
    await page.goto('/');
  });

  test('should display custom 404 page for invalid transaction signature', async ({ page }) => {
    // Navigate to an invalid transaction URL
    await page.goto('/tx/invalid-signature');
    
    // Should show custom 404 page
    await expect(page.locator('h1')).toContainText('404');
    await expect(page.locator('h2')).toContainText('Page Not Found');
    
    // Should have blockchain-specific guidance
    await expect(page.locator('text=Check transaction signatures are valid')).toBeVisible();
    
    // Should have navigation options
    await expect(page.locator('text=Go Home')).toBeVisible();
    await expect(page.locator('text=Search')).toBeVisible();
    await expect(page.locator('text=Go Back')).toBeVisible();
  });

  test('should display custom 404 page for invalid account address', async ({ page }) => {
    // Navigate to an invalid account URL
    await page.goto('/account/invalid-address');
    
    // Should show custom 404 page
    await expect(page.locator('h1')).toContainText('404');
    
    // Should have quick navigation links
    await expect(page.locator('a[href="/tokens"]')).toBeVisible();
    await expect(page.locator('a[href="/programs"]')).toBeVisible();
    await expect(page.locator('a[href="/blocks"]')).toBeVisible();
    await expect(page.locator('a[href="/nfts"]')).toBeVisible();
  });

  test('should display custom 404 page for invalid block slot', async ({ page }) => {
    // Navigate to an invalid block URL (negative number)
    await page.goto('/block/-123');
    
    // Should show custom 404 page
    await expect(page.locator('h1')).toContainText('404');
  });

  test('should display custom 404 page for invalid token mint', async ({ page }) => {
    // Navigate to an invalid token URL
    await page.goto('/token/invalid-mint');
    
    // Should show custom 404 page
    await expect(page.locator('h1')).toContainText('404');
  });

  test('should display custom 404 page for invalid program address', async ({ page }) => {
    // Navigate to an invalid program URL
    await page.goto('/program/invalid-program');
    
    // Should show custom 404 page
    await expect(page.locator('h1')).toContainText('404');
  });

  test('should handle non-existent routes', async ({ page }) => {
    // Navigate to a completely non-existent route
    await page.goto('/non-existent-route');
    
    // Should show custom 404 page
    await expect(page.locator('h1')).toContainText('404');
  });

  test('should redirect bare paths to appropriate listing pages', async ({ page }) => {
    // Test bare /token redirect
    await page.goto('/token');
    await expect(page).toHaveURL('/tokens');
    
    // Test bare /program redirect  
    await page.goto('/program');
    await expect(page).toHaveURL('/programs');
    
    // Test bare /block redirect
    await page.goto('/block');
    await expect(page).toHaveURL('/blocks');
  });

  test('should handle valid routes correctly', async ({ page }) => {
    // This would test with actual valid blockchain data
    // For now, we'll test that the routes accept properly formatted parameters
    
    // Valid transaction signature format (88 characters, base58)
    const validTxSignature = '3Eq21vXNB5s86c62bVuUfTeaMif1N2kUqRPBmGRJhyTA5E233pZy4kEz3Z7c9E8UwGRZpBPZ';
    await page.goto(`/tx/${validTxSignature}`);
    
    // Should not show 404 (might show loading or data not found, but not 404)
    await expect(page.locator('h1')).not.toContainText('404');
  });

  test('should handle URL-encoded parameters', async ({ page }) => {
    // Test that URL encoding is handled properly
    const address = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
    const encoded = encodeURIComponent(address);
    
    await page.goto(`/account/${encoded}`);
    
    // Should not show 404 for valid encoded address
    await expect(page.locator('h1')).not.toContainText('404');
  });

  test('should provide functional navigation from 404 page', async ({ page }) => {
    // Navigate to invalid URL
    await page.goto('/invalid-route');
    
    // Click "Go Home" button
    await page.click('text=Go Home');
    await expect(page).toHaveURL('/');
    
    // Go back to 404 page
    await page.goto('/invalid-route');
    
    // Test quick navigation links
    await page.click('a[href="/tokens"]');
    await expect(page).toHaveURL('/tokens');
  });

  test('should prevent injection attempts', async ({ page }) => {
    // Test various injection patterns
    const injectionAttempts = [
      '/tx/<script>alert("xss")</script>',
      '/account/\'; DROP TABLE users; --',
      '/block/../../../etc/passwd',
      '/token/javascript:alert(1)',
    ];

    for (const attempt of injectionAttempts) {
      await page.goto(attempt);
      // Should show 404, not execute any malicious code
      await expect(page.locator('h1')).toContainText('404');
    }
  });
});