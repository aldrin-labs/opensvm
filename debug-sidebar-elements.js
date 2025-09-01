const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('Navigating to /?ai=1...');
  await page.goto('http://localhost:3001/?ai=1');
  
  // Wait for page to load
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  // Check what sidebar-related elements exist
  console.log('\n=== Checking for sidebar elements ===');
  
  const sidebarElements = await page.evaluate(() => {
    const elements = [];
    
    // Check for various sidebar-related selectors
    const selectors = [
      '[data-ai-sidebar]',
      '[data-ai-sidebar-root]',
      '[data-ai-sidebar-container]',
      '[data-ai-sidebar-early]',
      '[data-ai-chat-ui]',
      '.sidebar', // generic class
      '[class*="sidebar"]', // any class containing "sidebar"
      '[data-open]'
    ];
    
    selectors.forEach(selector => {
      const found = document.querySelectorAll(selector);
      if (found.length > 0) {
        found.forEach((el, i) => {
          elements.push({
            selector,
            index: i,
            tagName: el.tagName,
            attributes: Array.from(el.attributes).reduce((acc, attr) => {
              acc[attr.name] = attr.value;
              return acc;
            }, {}),
            visible: el.offsetWidth > 0 && el.offsetHeight > 0,
            textContent: el.textContent?.substring(0, 100) + '...'
          });
        });
      } else {
        elements.push({ selector, found: false });
      }
    });
    
    return elements;
  });
  
  console.log('Found elements:');
  sidebarElements.forEach(el => {
    if (el.found === false) {
      console.log(`  ${el.selector}: NOT FOUND`);
    } else {
      console.log(`  ${el.selector}[${el.index}]: ${el.tagName} - visible: ${el.visible}`);
      console.log(`    Attributes:`, el.attributes);
    }
  });
  
  // Check if SVMAI global is available
  const svmaiStatus = await page.evaluate(() => {
    const w = window;
    return {
      hasSVMAI: !!w.SVMAI,
      hasOpen: !!(w.SVMAI && w.SVMAI.open),
      openType: w.SVMAI ? typeof w.SVMAI.open : 'undefined'
    };
  });
  
  console.log('\n=== SVMAI Global Status ===');
  console.log(svmaiStatus);
  
  // Try to call SVMAI.open() and see what happens
  if (svmaiStatus.hasSVMAI && svmaiStatus.hasOpen) {
    console.log('\n=== Calling SVMAI.open() ===');
    await page.evaluate(() => {
      const w = window;
      w.SVMAI.open();
    });
    
    await page.waitForTimeout(2000);
    
    // Check again for sidebar elements after calling open
    const afterOpenElements = await page.evaluate(() => {
      const elements = [];
      const selectors = ['[data-ai-sidebar]', '[data-ai-sidebar-root]', '[data-open="1"]'];
      
      selectors.forEach(selector => {
        const found = document.querySelectorAll(selector);
        elements.push({
          selector,
          count: found.length,
          visible: Array.from(found).some(el => el.offsetWidth > 0 && el.offsetHeight > 0)
        });
      });
      
      return elements;
    });
    
    console.log('After SVMAI.open() call:');
    afterOpenElements.forEach(el => {
      console.log(`  ${el.selector}: count=${el.count}, anyVisible=${el.visible}`);
    });
  }
  
  await page.waitForTimeout(5000); // Keep browser open for manual inspection
  await browser.close();
})();
