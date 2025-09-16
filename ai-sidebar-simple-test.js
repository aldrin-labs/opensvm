const { chromium } = require('playwright');

// Simple AI Sidebar Test Script
async function testAISidebar() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    console.log('Starting Simple AI Sidebar Test...');
    
    // Navigate to homepage with minimal wait
    console.log('Navigating to homepage...');
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    // Wait a bit for React to mount
    await page.waitForTimeout(3000);
    
    // Test 1: Check if SVMAI API is available
    console.log('\n=== Test 1: SVMAI API Availability ===');
    const hasSVMAI = await page.evaluate(() => {
      return typeof window.SVMAI !== 'undefined' && 
             typeof window.SVMAI.open === 'function' &&
             typeof window.SVMAI.close === 'function' &&
             typeof window.SVMAI.toggle === 'function' &&
             typeof window.SVMAI.prompt === 'function' &&
             typeof window.SVMAI.setWidth === 'function' &&
             typeof window.SVMAI.getWidth === 'function';
    });
    
    console.log(`SVMAI API available: ${hasSVMAI ? 'YES' : 'NO'}`);
    
    if (!hasSVMAI) {
      console.log('SVMAI API not available, skipping further tests');
      return;
    }
    
    // Test 2: Try to open sidebar using API
    console.log('\n=== Test 2: Opening Sidebar via API ===');
    const openResult = await page.evaluate(() => {
      try {
        window.SVMAI.open();
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log(`Sidebar open API call: ${openResult.success ? 'SUCCESS' : 'FAILED'}`);
    if (!openResult.success) {
      console.log(`Error: ${openResult.error}`);
    }
    
    // Wait for sidebar to potentially open
    await page.waitForTimeout(2000);
    
    // Test 3: Check if sidebar is visible
    console.log('\n=== Test 3: Sidebar Visibility Check ===');
    
    // Try multiple selectors for the sidebar
    const sidebarSelectors = [
      '[data-testid="ai-sidebar"]',
      '[data-ai-sidebar-root]',
      '.ai-sidebar',
      '#ai-sidebar',
      '[data-ai-sidebar-visible="1"]'
    ];
    
    let sidebarFound = false;
    let foundSelector = '';
    
    for (const selector of sidebarSelectors) {
      const exists = await page.$(selector) !== null;
      if (exists) {
        sidebarFound = true;
        foundSelector = selector;
        break;
      }
    }
    
    console.log(`Sidebar element found: ${sidebarFound ? 'YES' : 'NO'}`);
    if (sidebarFound) {
      console.log(`Found with selector: ${foundSelector}`);
      
      // Check if it's visible
      const isVisible = await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        if (!element) return false;
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      }, foundSelector);
      
      console.log(`Sidebar visible: ${isVisible ? 'YES' : 'NO'}`);
    }
    
    // Test 4: Try to use SVMAI.prompt to send a message
    console.log('\n=== Test 4: Testing SVMAI.prompt API ===');
    const promptResult = await page.evaluate(() => {
      try {
        window.SVMAI.prompt('Hello, this is a test message', true);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log(`SVMAI.prompt API call: ${promptResult.success ? 'SUCCESS' : 'FAILED'}`);
    if (!promptResult.success) {
      console.log(`Error: ${promptResult.error}`);
    }
    
    // Wait a bit for processing
    await page.waitForTimeout(3000);
    
    // Test 5: Check for processing indicator
    console.log('\n=== Test 5: Processing Indicator Check ===');
    const processingIndicator = await page.$('[data-ai-processing-status]') !== null;
    console.log(`Processing indicator found: ${processingIndicator ? 'YES' : 'NO'}`);
    
    // Test 6: Check global pending flag
    console.log('\n=== Test 6: Global Pending Flag ===');
    const globalPending = await page.evaluate(() => window.__SVMAI_PENDING__);
    console.log(`Global pending flag: ${globalPending === true ? 'TRUE' : globalPending === false ? 'FALSE' : 'UNDEFINED'}`);
    
    // Test 7: Check for chat messages
    console.log('\n=== Test 7: Chat Messages Check ===');
    const messages = await page.$$('[data-testid="chat-message"]');
    console.log(`Number of chat messages found: ${messages.length}`);
    
    // Test 8: Try SVMAI.getWidth
    console.log('\n=== Test 8: SVMAI.getWidth API ===');
    const widthResult = await page.evaluate(() => {
      try {
        const width = window.SVMAI.getWidth();
        return { success: true, width };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log(`SVMAI.getWidth API call: ${widthResult.success ? 'SUCCESS' : 'FAILED'}`);
    if (widthResult.success) {
      console.log(`Current width: ${widthResult.width}px`);
    } else {
      console.log(`Error: ${widthResult.error}`);
    }
    
    // Summary
    console.log('\n=== TEST SUMMARY ===');
    console.log(`SVMAI API Available: ${hasSVMAI ? '✓' : '✗'}`);
    console.log(`Sidebar Open (API): ${openResult.success ? '✓' : '✗'}`);
    console.log(`Sidebar Visible: ${sidebarFound ? '✓' : '✗'}`);
    console.log(`Processing Indicator: ${processingIndicator ? '✓' : '✗'}`);
    console.log(`Chat Messages: ${messages.length > 0 ? messages.length : 'None'}`);
    
  } catch (error) {
    console.error('Test execution failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the test
testAISidebar().catch(console.error);
