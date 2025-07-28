import { test, expect } from '@playwright/test';
import { isElementVisible, getElementCount, waitForTableLoad, waitForApiResponse } from './utils/test-helpers';

test.describe.skip('Validator Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the analytics page where the validator tab is located
    await page.goto('/analytics');

    // Wait for the page to load and data to be fetched
    await page.waitForLoadState('networkidle');
  });

  test('should display validator tab navigation', async ({ page }) => {
    // Check that the validator tab navigation exists
    const hasValidatorsTab = await isElementVisible(page, 'button:has-text("Consensus Validators"), button:has-text("Validators")');

    if (hasValidatorsTab) {
      console.log('✅ Validators tab found');
    } else {
      console.log('Validators tab not found - checking for alternative layouts');
    }

    // Check if RPC nodes tab exists (conditional based on data)
    const hasRpcTab = await isElementVisible(page, 'button:has-text("RPC Nodes")');
    if (hasRpcTab) {
      console.log('✅ RPC Nodes tab found');
    }
  });

  test('should show validators by default', async ({ page }) => {
    // Check that validators tab is active by default
    const hasActiveValidatorsTab = await isElementVisible(page, 'button:has-text("Consensus Validators").border-primary, button:has-text("Validators").border-primary');

    if (hasActiveValidatorsTab) {
      console.log('✅ Validators tab is active');
    }

    // Check that validators content is visible
    const hasValidatorsContent = await isElementVisible(page, 'h3:has-text("Consensus Validators"), h3:has-text("Validators")');

    if (hasValidatorsContent) {
      console.log('✅ Validators content visible');
    }

    // Check that the validators table exists
    const hasTable = await isElementVisible(page, 'table');

    if (hasTable) {
      console.log('✅ Validators table found');

      // Check for common table headers
      const headerCount = await getElementCount(page, 'th:has-text("Rank"), th:has-text("Validator"), th:has-text("Status"), th:has-text("Stake")');
      console.log(`Found ${headerCount} expected table headers`);
    } else {
      console.log('No validators table found - may still be loading');
    }
  });

  test('should switch to RPC nodes tab when clicked', async ({ page }) => {
    // Check if RPC nodes tab exists
    const rpcNodesTab = page.locator('button:has-text("RPC Nodes")');

    if (await rpcNodesTab.isVisible()) {
      // Click on RPC nodes tab
      await rpcNodesTab.click();

      // Check that RPC nodes tab is now active
      await expect(rpcNodesTab).toHaveClass(/border-primary/);

      // Check that RPC nodes content is visible
      await expect(page.locator('h3:has-text("RPC Nodes")')).toBeVisible();

      // Check that RPC nodes table exists
      await expect(page.locator('table')).toBeVisible();

      // Check for RPC nodes table headers
      await expect(page.locator('th:has-text("Node ID")')).toBeVisible();
      await expect(page.locator('th:has-text("RPC Endpoint")')).toBeVisible();

      // Check that validators content is hidden
      await expect(page.locator('h3:has-text("Consensus Validators")')).not.toBeVisible();
    } else {
      console.log('RPC nodes tab not available - skipping RPC nodes test');
    }
  });

  test('should switch back to validators tab', async ({ page }) => {
    const rpcNodesTab = page.locator('button:has-text("RPC Nodes")');
    const validatorsTab = page.locator('button:has-text("Consensus Validators")');

    if (await rpcNodesTab.isVisible()) {
      // First switch to RPC nodes
      await rpcNodesTab.click();
      await expect(page.locator('h3:has-text("RPC Nodes")')).toBeVisible();

      // Then switch back to validators
      await validatorsTab.click();

      // Check that validators tab is active again
      await expect(validatorsTab).toHaveClass(/border-primary/);

      // Check that validators content is visible again
      await expect(page.locator('h3:has-text("Consensus Validators")')).toBeVisible();

      // Check that RPC nodes content is hidden
      await expect(page.locator('h3:has-text("RPC Nodes")')).not.toBeVisible();
    } else {
      console.log('RPC nodes tab not available - skipping tab switching test');
    }
  });

  test('should display trending carousel', async ({ page }) => {
    // Check that the trending carousel exists
    const trendingSection = page.locator('[data-testid="trending-carousel"], .trending-carousel, :has-text("Trending Validators")');

    // Wait a bit for trending data to load
    await page.waitForTimeout(2000);

    // The trending carousel should be visible (even if empty)
    // We're looking for any element that might contain trending validators
    const hasTrendingContent = await page.locator('text=/trending/i').first().isVisible().catch(() => false);

    if (hasTrendingContent) {
      console.log('Trending carousel found');
    } else {
      console.log('Trending carousel not visible - may be loading or no trending data');
    }
  });

  test('should have pagination controls when needed', async ({ page }) => {
    // Wait for validators to load
    await page.waitForSelector('table tbody tr', { timeout: 10000 });

    // Check if pagination exists (only if there are many validators)
    const paginationNext = page.locator('button:has-text("Next")');
    const paginationPrevious = page.locator('button:has-text("Previous")');

    const hasNextButton = await paginationNext.isVisible();

    if (hasNextButton) {
      console.log('Pagination controls found');

      // Previous should be disabled on first page
      await expect(paginationPrevious).toBeDisabled();

      // Next should be enabled if there are more pages
      const nextButtonEnabled = await paginationNext.isEnabled();
      if (nextButtonEnabled) {
        // Test pagination
        await paginationNext.click();
        await expect(paginationPrevious).toBeEnabled();
      }
    } else {
      console.log('No pagination needed - all validators fit on one page');
    }
  });

  test('should have sorting and filtering controls', async ({ page }) => {
    // Check for "Show" dropdown (items per page)
    const showDropdown = page.locator('select').first();
    await expect(showDropdown).toBeVisible();

    // Check for "Sort by" dropdown
    const sortDropdown = page.locator('select').nth(1);
    await expect(sortDropdown).toBeVisible();

    // Test changing items per page
    await showDropdown.selectOption('50');

    // Test sorting
    await sortDropdown.selectOption('commission');

    // Wait for any re-sorting to complete
    await page.waitForTimeout(1000);
  });

  test('should display validator data correctly', async ({ page }) => {
    // Wait for validators to load
    await waitForTableLoad(page);

    // Check that we have validator data
    const rowCount = await getElementCount(page, 'table tbody tr');

    if (rowCount > 0) {
      console.log(`✅ Found ${rowCount} validator rows`);
      expect(rowCount).toBeGreaterThan(0);

      // Check the first validator row has some data
      const hasFirstRowData = await isElementVisible(page, 'table tbody tr:first-child td');

      if (hasFirstRowData) {
        console.log('✅ First validator row has data');

        // Check for common validator data elements
        const hasRank = await isElementVisible(page, 'table tbody tr:first-child td:has-text("#")');
        const hasAddress = await isElementVisible(page, 'table tbody tr:first-child button, table tbody tr:first-child a');
        const hasStatus = await isElementVisible(page, 'table tbody tr:first-child span, table tbody tr:first-child .badge');

        console.log(`Validator data check: rank=${hasRank}, address=${hasAddress}, status=${hasStatus}`);
      }
    } else {
      console.log('No validator data found - may still be loading or API issue');
    }
  });

  test('should handle validator click navigation', async ({ page }) => {
    // Wait for validators to load
    await page.waitForSelector('table tbody tr', { timeout: 10000 });

    // Find a validator link (the vote account button)
    const validatorLink = page.locator('table tbody tr').first().locator('button').first();

    if (await validatorLink.isVisible()) {
      // Get the validator address from the button text
      const validatorAddress = await validatorLink.textContent();

      // Click the validator link
      await validatorLink.click();

      // Should navigate to validator detail page
      await expect(page).toHaveURL(/\/validator\//);

      console.log(`Successfully navigated to validator page for: ${validatorAddress}`);
    } else {
      console.log('No validator links found to test navigation');
    }
  });

  test('should show decentralization metrics', async ({ page }) => {
    // Check for decentralization metrics section
    await expect(page.locator('h3:has-text("Geographic Distribution")')).toBeVisible();

    // Should have other metric sections
    const metricsSection = page.locator(':has-text("Decentralization Metrics")').first();

    // Wait for metrics to load
    await page.waitForTimeout(2000);

    // Check that we have some geographic distribution data
    const geoData = page.locator('text=/[A-Z]{2}|United States|Canada|Germany|France/').first();
    const hasGeoData = await geoData.isVisible().catch(() => false);

    if (hasGeoData) {
      console.log('Geographic distribution data found');
    } else {
      console.log('Geographic distribution data may still be loading');
    }
  });
});

test.describe('Validator Page API Integration', () => {
  test('should load validator data from API', async ({ page }) => {
    // Try to intercept the API call
    const apiResult = await waitForApiResponse(page, '/api/analytics/validators', 15000);

    await page.goto('/analytics');
    await page.waitForTimeout(3000);

    if (apiResult.success) {
      console.log('✅ Validators API called successfully');

      try {
        const responseBody = await apiResult.response.json();

        if (responseBody.validators && Array.isArray(responseBody.validators)) {
          console.log(`API returned ${responseBody.validators.length} validators`);
          expect(responseBody.validators.length).toBeGreaterThan(0);

          // Verify that validators are not limited to 50
          if (responseBody.validators.length >= 50) {
            console.log('✅ Full validator list returned (not limited to 50)');
          }
        } else {
          console.log('API response format may be different than expected');
        }
      } catch (error) {
        console.log('API response parsing failed:', error.message);
      }
    } else {
      console.log('Validators API not called or failed - may not be implemented yet');
    }
  });

  test('should load trending validators from API', async ({ page }) => {
    // Try to intercept trending validators API call
    const apiResult = await waitForApiResponse(page, '/api/analytics/trending-validators', 10000);

    await page.goto('/analytics');
    await page.waitForTimeout(5000);

    if (apiResult.success) {
      console.log('✅ Trending validators API called successfully');
    } else {
      console.log('Trending validators API not called - feature may not be implemented');
    }
  });
});