const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Capture console messages and errors
  const logs = [];
  page.on('console', msg => {
    logs.push({
      type: msg.type(),
      text: msg.text(),
      timestamp: new Date().toISOString()
    });
  });
  
  page.on('pageerror', error => {
    logs.push({
      type: 'pageerror',
      text: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  });
  
  // Navigate to the page with AI enabled
  console.log('Navigating to /?ai=1...');
  await page.goto('http://localhost:3003/?ai=1', { waitUntil: 'networkidle0' });
  
  // Wait a bit for React to hydrate
  await page.waitForTimeout(3000);
  
  // Check if React is present and working
  const reactStatus = await page.evaluate(() => {
    // Check if React is available
    const hasReact = typeof window.React !== 'undefined' || 
                    typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined' ||
                    document.querySelector('[data-reactroot]') !== null ||
                    document.querySelector('#__next') !== null;
    
    // Check for React hydration errors
    const reactErrors = window.__REACT_ERROR_OVERLAY_GLOBAL_HOOK__?.errors || [];
    
    // Check if the AIChatSidebarProvider is working
    const hasAISidebarContext = typeof window.SVMAI === 'object' && 
                               typeof window.SVMAI.open === 'function';
    
    // Check if any React components are mounted
    const hasReactComponents = document.querySelectorAll('[data-reactid], [data-react-component]').length > 0 ||
                              document.querySelector('[data-ai-sidebar]') !== null ||
                              document.querySelector('[data-ai-sidebar-root]') !== null;
    
    // Get all elements with data- attributes
    const allElements = Array.from(document.querySelectorAll('*'));
    const dataElements = allElements.filter(el => {
      return Array.from(el.attributes).some(attr => attr.name.startsWith('data-'));
    }).map(el => {
      const attrs = {};
      for (const attr of el.attributes) {
        if (attr.name.startsWith('data-')) {
          attrs[attr.name] = attr.value;
        }
      }
      return {
        tagName: el.tagName,
        className: el.className,
        id: el.id,
        attributes: attrs
      };
    });
    
    return {
      hasReact,
      reactErrors,
      hasAISidebarContext,
      hasReactComponents,
      dataElements: dataElements.slice(0, 10), // First 10 elements with data attributes
      totalDataElements: dataElements.length
    };
  });
  
  console.log('=== React Status ===');
  console.log(JSON.stringify(reactStatus, null, 2));
  
  console.log('\n=== Console Logs ===');
  logs.forEach(log => {
    console.log(`[${log.type.toUpperCase()}] ${log.text}`);
    if (log.stack) {
      console.log(`Stack: ${log.stack}`);
    }
  });
  
  // Check what's actually in the DOM
  const domStructure = await page.evaluate(() => {
    const body = document.body;
    const getStructure = (element, maxDepth = 3, currentDepth = 0) => {
      if (currentDepth >= maxDepth) return '[...]';
      
      const result = {
        tagName: element.tagName,
        id: element.id,
        className: element.className,
        dataAttributes: {},
        children: []
      };
      
      // Get data attributes
      for (const attr of element.attributes) {
        if (attr.name.startsWith('data-')) {
          result.dataAttributes[attr.name] = attr.value;
        }
      }
      
      // Get immediate children
      for (const child of element.children) {
        if (child.tagName) {
          result.children.push(getStructure(child, maxDepth, currentDepth + 1));
        }
      }
      
      return result;
    };
    
    return getStructure(body);
  });
  
  console.log('\n=== DOM Structure (first 3 levels) ===');
  console.log(JSON.stringify(domStructure, null, 2));
  
  await browser.close();
})().catch(console.error);
