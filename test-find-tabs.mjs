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
    
    console.log('Page loaded, looking for tabs...');
    
    // Look for tab elements with specific text
    const historyTab = await page.locator('text=History').count();
    const statsTab = await page.locator('text=Stats').count();
    const feedTab = await page.locator('text=Feed').count();
    
    console.log(`History tab: ${historyTab}`);
    console.log(`Stats tab: ${statsTab}`);
    console.log(`Feed tab: ${feedTab}`);
    
    // Get all elements that contain "Feed"
    const feedElements = await page.locator(':text("Feed")').all();
    console.log(`Total elements containing "Feed": ${feedElements.length}`);
    
    for (let i = 0; i < feedElements.length; i++) {
      const text = await feedElements[i].textContent();
      const tagName = await feedElements[i].evaluate(el => el.tagName);
      console.log(`  Element ${i}: ${tagName} - "${text}"`);
    }
    
    // Try to click the Feed button if it exists
    const feedButton = page.locator('button:has-text("Feed")');
    const count = await feedButton.count();
    console.log(`Feed buttons found: ${count}`);
    
    if (count > 0) {
      console.log('Clicking Feed tab...');
      await feedButton.first().click();
      await page.waitForTimeout(3000);
      
      // Check what's visible after clicking
      const forYou = await page.locator('text=For You').count();
      const following = await page.locator('text=Following').count();
      console.log(`For You: ${forYou}, Following: ${following}`);
      
      await page.screenshot({ path: '/tmp/feed-clicked.png', fullPage: true });
      console.log('Screenshot after clicking Feed: /tmp/feed-clicked.png');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({ path: '/tmp/error.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();
