const { chromium } = require('playwright');

async function debugAISidebar() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    console.log('Navigating to homepage with mock mode...');
    await page.goto('http://localhost:3000/?ai=true&aimock=1', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    // Test with mock mode
    console.log('Sending mock query...');
    const mockResult = await page.evaluate(() => {
      try {
        window.SVMAI.prompt('What is the current TPS on Solana?', true);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('Mock result:', mockResult);
    await page.waitForTimeout(5000);
    
    // Check all possible message selectors
    const selectors = [
      '[data-testid="chat-message"]',
      '[data-ai-chat-message]',
      '.chat-message',
      '.message',
      '[role="article"]',
      'div[class*="message"]'
    ];
    
    console.log('\nChecking for message elements:');
    for (const selector of selectors) {
      const elements = await page.$$(selector);
      console.log(`Selector '${selector}': ${elements.length} elements found`);
      if (elements.length > 0) {
        const text = await elements[0].textContent();
        console.log(`  First element text: ${text.substring(0, 100)}...`);
      }
    }
    
    // Check for any text content that might contain responses
    const bodyText = await page.evaluate(() => document.body.textContent);
    const hasMockResponse = bodyText.includes('TPS') || bodyText.includes('transactions') || bodyText.includes('mock');
    console.log(`\nBody contains relevant content: ${hasMockResponse}`);
    
    // Check for specific mock response patterns
    const mockPatterns = ['2,847 TPS', 'mock', 'test mode', 'Network Performance'];
    console.log('\nChecking for mock response patterns:');
    for (const pattern of mockPatterns) {
      const found = bodyText.includes(pattern);
      console.log(`  '${pattern}': ${found ? '✓' : '✗'}`);
    }
    
    // Check if sidebar is actually open and visible
    const sidebarCheck = await page.evaluate(() => {
      const sidebar = document.querySelector('[data-ai-sidebar-root]');
      return {
        exists: !!sidebar,
        visible: sidebar ? window.getComputedStyle(sidebar).display !== 'none' : false,
        width: sidebar ? sidebar.style.width : 'not set'
      };
    });
    console.log('\nSidebar status:', sidebarCheck);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugAISidebar().catch(console.error);
