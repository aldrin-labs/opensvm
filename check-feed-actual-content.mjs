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
    
    // Aggressively close all overlays
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    // Try clicking outside the overlay
    await page.mouse.click(100, 100);
    await page.waitForTimeout(500);
    
    // Force click close buttons
    const closeButtons = await page.locator('button').all();
    for (const btn of closeButtons) {
      const text = await btn.textContent().catch(() => '');
      if (text.includes('✕') || text.includes('×') || text.includes('Close')) {
        try {
          await btn.click({ force: true, timeout: 1000 });
          await page.waitForTimeout(300);
        } catch (e) {}
      }
    }
    
    console.log('Forcing click on Feed tab...');
    await page.locator('button:has-text("Feed")').first().click({ force: true });
    await page.waitForTimeout(5000);
    
    //Get ALL tab panel content to see what's actually visible
    const allTabPanels = await page.locator('[role="tabpanel"]').all();
    console.log(`\nFound ${allTabPanels.length} tab panels`);
    
    for (let i = 0; i < allTabPanels.length; i++) {
      const isHidden = await allTabPanels[i].isHidden();
      if (!isHidden) {
        const content = await allTabPanels[i].textContent();
        console.log(`\nVisible tab panel ${i} content (first 300 chars):`);
        console.log(content?.slice(0, 300));
      }
    }
    
    await page.screenshot({ path: '/tmp/feed-actual-state.png', fullPage: true });
    console.log('\nScreenshot saved: /tmp/feed-actual-state.png');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
