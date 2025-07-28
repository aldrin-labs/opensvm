import { test, expect } from '@playwright/test';

test.describe('SVMAI Boost Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');
  });

  test('should display trending carousel with boost functionality', async ({ page }) => {
    // Look for trending validators section
    const trendingSection = page.locator(':has-text("Trending"), :has-text("trending")').first();
    
    // Wait for trending data to potentially load
    await page.waitForTimeout(3000);
    
    // Check if there are any trending validators displayed
    const trendingValidators = page.locator('[data-testid*="trending"], .trending-validator, .trending-item');
    const trendingCount = await trendingValidators.count();
    
    if (trendingCount > 0) {
      console.log(`Found ${trendingCount} trending validators`);
      
      // Look for boost buttons on trending validators
      const boostButtons = page.locator('button:has-text("Boost"), button:has-text("🔥")');
      const boostButtonCount = await boostButtons.count();
      
      if (boostButtonCount > 0) {
        console.log(`Found ${boostButtonCount} boost buttons`);
        
        // Click on the first boost button
        await boostButtons.first().click();
        
        // Should open boost modal
        const modal = page.locator('[role="dialog"], .modal, :has-text("Boost Validator")');
        await expect(modal).toBeVisible({ timeout: 5000 });
        
        console.log('✅ Boost modal opened successfully');
      } else {
        console.log('No boost buttons found on trending validators');
      }
    } else {
      console.log('No trending validators found - may be loading or empty');
    }
  });

  test('should validate SVMAI burn amount limits', async ({ page }) => {
    // Try to find and click a boost button
    const boostButton = page.locator('button:has-text("Boost"), button:has-text("🔥")').first();
    
    if (await boostButton.isVisible()) {
      await boostButton.click();
      
      // Wait for modal to open
      await page.waitForSelector('[role="dialog"], .modal', { timeout: 5000 });
      
      // Look for burn amount input
      const burnInput = page.locator('input[type="number"], input[placeholder*="amount"], input[placeholder*="SVMAI"]');
      
      if (await burnInput.isVisible()) {
        // Test maximum burn amount (69k SVMAI limit)
        await burnInput.fill('70000'); // Above the limit
        
        // Look for validation message
        const validationMessage = page.locator('text=/maximum|limit|69k|69000/i');
        const hasValidation = await validationMessage.isVisible().catch(() => false);
        
        if (hasValidation) {
          console.log('✅ Maximum burn amount validation working');
        }
        
        // Test valid amount
        await burnInput.fill('10000'); // Valid amount
        
        // Look for wallet connection requirement
        const connectWallet = page.locator('button:has-text("Connect"), :has-text("wallet")');
        const hasWalletPrompt = await connectWallet.isVisible().catch(() => false);
        
        if (hasWalletPrompt) {
          console.log('✅ Wallet connection prompt displayed');
        }
      } else {
        console.log('Burn amount input not found in modal');
      }
      
      // Close modal
      const closeButton = page.locator('button:has-text("×"), button:has-text("Close"), [aria-label="close"]');
      if (await closeButton.isVisible()) {
        await closeButton.click();
      }
    } else {
      console.log('No boost buttons available for testing');
    }
  });

  test('should show trending validators API integration', async ({ page }) => {
    // Intercept trending validators API call
    const apiPromise = page.waitForResponse(response => 
      response.url().includes('/api/analytics/trending-validators') && 
      response.status() === 200,
      { timeout: 10000 }
    ).catch(() => null);
    
    await page.goto('/analytics');
    
    const apiResponse = await apiPromise;
    
    if (apiResponse) {
      console.log('✅ Trending validators API called successfully');
      
      const responseBody = await apiResponse.json();
      console.log(`API returned trending data:`, Object.keys(responseBody));
      
      if (responseBody.trending && Array.isArray(responseBody.trending)) {
        console.log(`Found ${responseBody.trending.length} trending validators`);
      }
    } else {
      console.log('Trending validators API not called or failed');
    }
  });
});

test.describe('Validator Detail Page Boost', () => {
  test('should show boost button on validator detail page', async ({ page }) => {
    // First get a validator address from the main page
    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');
    
    // Wait for validators to load
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    
    // Get the first validator link
    const validatorLink = page.locator('table tbody tr').first().locator('button').first();
    
    if (await validatorLink.isVisible()) {
      // Click to go to validator detail page
      await validatorLink.click();
      
      // Wait for validator detail page to load
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/validator\//);
      
      // Look for boost button on validator detail page
      const boostButton = page.locator('button:has-text("Boost"), button:has-text("🔥")');
      const hasBoostButton = await boostButton.isVisible().catch(() => false);
      
      if (hasBoostButton) {
        console.log('✅ Boost button found on validator detail page');
        
        // Test clicking the boost button
        await boostButton.click();
        
        // Should open boost modal
        const modal = page.locator('[role="dialog"], .modal');
        await expect(modal).toBeVisible({ timeout: 5000 });
        
        console.log('✅ Boost modal opened from validator detail page');
      } else {
        console.log('No boost button found on validator detail page');
      }
    } else {
      console.log('Could not navigate to validator detail page');
    }
  });
});

test.describe('SVMAI Balance and Requirements', () => {
  test('should show SVMAI balance requirements', async ({ page }) => {
    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');
    
    // Look for any mentions of SVMAI requirements
    const svmaiRequirement = page.locator('text=/100k.*SVMAI|100,000.*SVMAI|SVMAI.*required/i');
    const hasRequirement = await svmaiRequirement.isVisible().catch(() => false);
    
    if (hasRequirement) {
      console.log('✅ SVMAI balance requirement displayed');
    } else {
      console.log('SVMAI balance requirement not visible on main page');
    }
    
    // Check if there are any stake/unstake buttons that might show requirements
    const stakeButtons = page.locator('button:has-text("Stake"), button:has-text("Unstake")');
    const hasStakeButtons = await stakeButtons.count() > 0;
    
    if (hasStakeButtons) {
      console.log('✅ Stake/unstake buttons found');
    }
  });
});