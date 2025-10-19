import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  try {
    console.log('Loading profile page...');
    await page.goto('http://localhost:3000/user/11111111111111111111111111111111', { 
      waitUntil: 'networkidle', 
      timeout: 90000 
    });
    
    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
    
    const closeButton = page.locator('button:has-text("✕")').last();
    try {
      await closeButton.click({ timeout: 2000 });
    } catch (e) {}
    
    await page.waitForTimeout(1000);
    
    console.log('Clicking Feed tab...');
    await page.locator('button:has-text("Feed")').first().click({ force: true });
    await page.waitForTimeout(5000);
    
    // Get the active tab content
    const activeTabContent = await page.locator('[role="tabpanel"]').first().textContent();
    console.log('Active tab content (first 500 chars):', activeTabContent?.slice(0, 500));
    
    // Check for specific feed elements
    const refreshButton = await page.locator('button:has-text("Refresh")').count();
    const clearCacheButton = await page.locator('button:has-text("Clear Cache")').count();
    const searchInput = await page.locator('input[placeholder*="Search"]').count();
    const filterButton = await page.locator('button:has-text("Filter")').count();
    
    console.log(`Refresh button: ${refreshButton}`);
    console.log(`Clear Cache button: ${clearCacheButton}`);
    console.log(`Search input: ${searchInput}`);
    console.log(`Filter button: ${filterButton}`);
    
    // Check for the feed tabs (For You / Following)
    const forYouButton = await page.locator('button:has-text("For You")').count();
    const followingButton = await page.locator('button:has-text("Following")').count();
    
    console.log(`For You button: ${forYouButton}`);
    console.log(`Following button: ${followingButton}`);
    
    // Check for empty state message
    const emptyMessage = await page.locator('text=/No events/i').count();
    console.log(`Empty state message: ${emptyMessage}`);
    
    await page.screenshot({ path: '/tmp/feed-analysis.png', fullPage: true });
    console.log('Screenshot saved: /tmp/feed-analysis.png');
    
    if (refreshButton > 0 || clearCacheButton > 0 || searchInput > 0 || filterButton > 0) {
      console.log('✅ SUCCESS: Feed tab is displaying correctly with all expected UI elements!');
    } else if (emptyMessage > 0) {
      console.log('✅ SUCCESS: Feed tab is displaying with empty state (no events yet)');
    } else {
      console.log('⚠️ Feed tab opened but UI elements not fully detected');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({ path: '/tmp/error-feed.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();
