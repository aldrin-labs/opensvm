import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Loading profile page...');
    await page.goto('http://localhost:3000/user/11111111111111111111111111111111', { 
      waitUntil: 'domcontentloaded', 
      timeout: 60000 
    });
    
    await page.waitForTimeout(5000);
    
    // Get all button text
    const buttons = await page.locator('button').allTextContents();
    console.log('Buttons on page:', buttons);
    
    // Get tab triggers
    const tabs = await page.locator('[role="tab"]').allTextContents();
    console.log('Tabs on page:', tabs);
    
    // Get main headings
    const headings = await page.locator('h1, h2').allTextContents();
    console.log('Headings:', headings);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
