// Debug script to test processing indicator timing
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3002/?ai=1');
  await page.waitForLoadState('domcontentloaded');
  
  // Wait for SVMAI to be available
  await page.waitForFunction(() => window.SVMAI);
  
  console.log('Testing processing indicator timing...');
  
  const result = await page.evaluate(async () => {
    const w = window;
    console.log('Mock mode check:', w.location.search.includes('ai=1'));
    console.log('SVMAI available:', !!w.SVMAI);
    
    const start = performance.now();
    const timings = {
      start,
      beforePrompt: null,
      afterPrompt: null,
      indicatorAppear: null,
      indicatorDisappear: null,
      pendingSet: null,
      pendingCleared: null
    };
    
    // Listen for pending changes
    const pendingListener = (e) => {
      console.log('Pending change event:', e.detail);
      if (e.detail?.phase === 'pending-set-prompt') {
        timings.pendingSet = performance.now() - start;
      }
    };
    window.addEventListener('svmai-pending-change', pendingListener);
    
    // Monitor processing indicator
    const checkIndicator = () => {
      const indicator = document.querySelector('[data-ai-processing-status][data-ai-processing-active="1"]');
      if (indicator && !timings.indicatorAppear) {
        timings.indicatorAppear = performance.now() - start;
        console.log('Processing indicator appeared at:', timings.indicatorAppear);
      } else if (!indicator && timings.indicatorAppear && !timings.indicatorDisappear) {
        timings.indicatorDisappear = performance.now() - start;
        console.log('Processing indicator disappeared at:', timings.indicatorDisappear);
      }
    };
    
    const observer = new MutationObserver(checkIndicator);
    observer.observe(document.body, { 
      childList: true, 
      subtree: true, 
      attributes: true,
      attributeFilter: ['data-ai-processing-status', 'data-ai-processing-active']
    });
    
    // Check initially
    checkIndicator();
    
    console.log('Calling SVMAI.prompt...');
    timings.beforePrompt = performance.now() - start;
    await w.SVMAI.prompt('Test processing cycle', true);
    timings.afterPrompt = performance.now() - start;
    
    console.log('Waiting for processing to complete...');
    
    // Wait for processing to complete
    await new Promise(resolve => {
      const pollForCompletion = () => {
        const hasIndicator = !!document.querySelector('[data-ai-processing-status][data-ai-processing-active="1"]');
        const isPending = !!w.__SVMAI_PENDING__;
        
        if (!hasIndicator && !isPending) {
          if (!timings.indicatorDisappear) {
            timings.indicatorDisappear = performance.now() - start;
          }
          if (!timings.pendingCleared) {
            timings.pendingCleared = performance.now() - start;
          }
          resolve();
        } else {
          setTimeout(pollForCompletion, 50);
        }
      };
      setTimeout(pollForCompletion, 100);
    });
    
    observer.disconnect();
    window.removeEventListener('svmai-pending-change', pendingListener);
    
    const visibleDuration = timings.indicatorDisappear - timings.indicatorAppear;
    console.log('Final timings:', {
      ...timings,
      visibleDuration,
      minRequiredMet: visibleDuration >= 400
    });
    
    return {
      ...timings,
      visibleDuration,
      minRequiredMet: visibleDuration >= 400
    };
  });
  
  console.log('Result:', result);
  
  await browser.close();
})();
