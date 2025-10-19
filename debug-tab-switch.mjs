import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:3000/user/11111111111111111111111111111111', { 
      waitUntil: 'networkidle', 
      timeout: 90000 
    });
    
    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
    try {
      await page.locator('button:has-text("✕")').last().click({ timeout: 2000 });
    } catch (e) {}
    await page.waitForTimeout(500);
    
    // Click History tab first
    console.log('Clicking History tab...');
    await page.locator('button:has-text("History")').first().click();
    await page.waitForTimeout(2000);
    
    const historyContent = await page.locator('[role="tabpanel"][style*="none"]').count() === 0 ?
      await page.locator('[role="tabpanel"]').first().textContent() : '';
    
    console.log('History tab content (first 150 chars):', historyContent.slice(0, 150));
    
    // Now click Feed tab
    console.log('\nClicking Feed tab...');
    await page.locator('button:has-text("Feed")').first().click();
    await page.waitForTimeout(3000);
    
    const feedContent = await page.locator('[role="tabpanel"]').first().textContent();
    console.log('Feed tab content (first 150 chars):', feedContent?.slice(0, 150));
    
    // Check which tab is active
    const activeTab = await page.locator('[role="tab"][aria-selected="true"]').textContent();
    console.log('\nActive tab:', activeTab);
    
    // Check for UserFeedDisplay specific elements
    const feedCard = await page.locator('text=Feed').count();
    console.log('Feed heading count:', feedCard);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
