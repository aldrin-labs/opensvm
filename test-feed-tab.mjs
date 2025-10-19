import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to a profile page
    console.log('Navigating to profile page...');
    await page.goto('http://localhost:3000/user/11111111111111111111111111111111', { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Wait for the page to load
    await page.waitForTimeout(3000);
    
    // Take a screenshot of the initial state
    await page.screenshot({ path: '/tmp/profile-initial.png', fullPage: true });
    console.log('Screenshot saved: /tmp/profile-initial.png');
    
    // Find and click the Feed tab
    console.log('Looking for Feed tab...');
    const feedTab = page.locator('button:has-text("Feed")').first();
    const isVisible = await feedTab.isVisible().catch(() => false);
    
    if (isVisible) {
      console.log('Found Feed tab, clicking...');
      await feedTab.click();
      await page.waitForTimeout(3000);
      
      // Take a screenshot after clicking the Feed tab
      await page.screenshot({ path: '/tmp/profile-feed-tab.png', fullPage: true });
      console.log('Screenshot saved: /tmp/profile-feed-tab.png');
      
      // Check if the feed content is visible
      const feedContent = await page.locator('text=Feed').count();
      console.log(`Feed content elements found: ${feedContent}`);
      
      // Check for loading state
      const loadingIndicator = await page.locator('[class*="animate-spin"]').count();
      console.log(`Loading indicators found: ${loadingIndicator}`);
      
      // Check for error messages
      const errorMessages = await page.locator('text=/error|Error|ERROR/i').count();
      console.log(`Error messages found: ${errorMessages}`);
      
      // Get the page content
      const pageContent = await page.content();
      const hasFeedDisplay = pageContent.includes('Feed') || pageContent.includes('For You') || pageContent.includes('Following');
      console.log(`Has feed display elements: ${hasFeedDisplay}`);
      
      console.log('✅ Feed tab test completed successfully!');
    } else {
      console.log('❌ Feed tab not found!');
    }
    
  } catch (error) {
    console.error('Error during test:', error.message);
    await page.screenshot({ path: '/tmp/profile-error.png', fullPage: true });
    console.log('Error screenshot saved: /tmp/profile-error.png');
  } finally {
    await browser.close();
  }
})();
