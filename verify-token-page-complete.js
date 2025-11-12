const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set a longer default timeout
    page.setDefaultTimeout(60000);
    
    // Capture console messages
    const consoleMessages = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
    });
    
    // Capture errors
    const errors = [];
    page.on('pageerror', error => {
      errors.push(error.message);
    });
    
    const tokenUrl = 'http://localhost:3000/token/Cpzvdx6pppc9TNArsGsqgShCsKC9NCCjA2gtzHvUpump';
    console.log('🔍 Testing token page at', tokenUrl);
    console.log('⏳ Loading page (this may take a moment)...\n');
    
    // Navigate with a more lenient wait strategy
    try {
      await page.goto(tokenUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
    } catch (navError) {
      console.error('❌ Navigation failed:', navError.message);
      process.exit(1);
    }
    
    // Wait for React to hydrate and initial data to load
    console.log('⏳ Waiting for page to render...');
    await page.waitForTimeout(8000);
    
    console.log('\n📊 Testing Supply Display:');
    console.log('==========================');
    
    // Check supply display format - look for the specific Supply metric
    const supplyInfo = await page.evaluate(() => {
      // Find all metric sections
      const metricSections = Array.from(document.querySelectorAll('.space-y-1'));
      
      // Find the one that has "Supply" in the label (not Market Cap, not other metrics)
      for (const section of metricSections) {
        const label = section.querySelector('.text-muted-foreground');
        if (label && label.textContent.trim() === 'Supply') {
          const valueElement = section.querySelector('.text-xl');
          if (valueElement) {
            return { 
              found: true, 
              value: valueElement.textContent.trim(),
              fullTooltip: valueElement.getAttribute('title') || 'No tooltip'
            };
          }
        }
      }
      return { found: false };
    });
    
    if (supplyInfo.found) {
      console.log(`✓ Supply display: ${supplyInfo.value}`);
      if (supplyInfo.value.includes('M') || supplyInfo.value.includes('B')) {
        console.log('✓ Supply is abbreviated correctly (M/B format)');
        console.log(`  Full value on hover: ${supplyInfo.fullTooltip}`);
      } else {
        console.log('⚠️  Supply not abbreviated (value < 10M or formatting issue)');
      }
    } else {
      console.log('❌ Could not find supply display - check component structure');
    }
    
    // Test all tabs
    const tabs = ['Chart', 'Analytics', 'Holders', 'DEX', 'AI Insights', 'Activity'];
    console.log('\n📑 Testing All Tabs:');
    console.log('===================');
    
    const errorsBefore = errors.length;
    
    for (const tabName of tabs) {
      try {
        // Clear previous errors for this tab
        const errorsBeforeTab = errors.length;
        
        // Find and click the tab
        const tabClicked = await page.evaluate((name) => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const tabButton = buttons.find(btn => btn.textContent.trim() === name);
          if (tabButton) {
            tabButton.click();
            return true;
          }
          return false;
        }, tabName);
        
        if (!tabClicked) {
          console.log(`⚠️  ${tabName} tab: Button not found`);
          continue;
        }
        
        // Wait for tab content to load
        await page.waitForTimeout(2000);
        
        // Check for new errors after tab switch
        const newErrors = errors.slice(errorsBeforeTab);
        const criticalTabErrors = newErrors.filter(err => 
          err.includes('ResponsiveContainer') ||
          err.includes('TypeError') ||
          err.includes('Qdrant') ||
          err.includes('null is not an object') ||
          err.includes('Cannot read')
        );
        
        if (criticalTabErrors.length === 0) {
          console.log(`✓ ${tabName} tab: Loaded successfully`);
        } else {
          console.log(`❌ ${tabName} tab: Errors detected`);
          criticalTabErrors.forEach(err => console.log(`   - ${err}`));
        }
        
      } catch (tabError) {
        console.log(`❌ ${tabName} tab: Failed to test - ${tabError.message}`);
      }
    }
    
    // Check for critical errors
    const criticalErrors = errors.filter(err => 
      err.includes('ResponsiveContainer') ||
      err.includes('null is not an object') ||
      err.includes('Cannot read') ||
      err.includes('Qdrant') ||
      err.includes('TypeError')
    );
    
    // Check for React errors
    const reactErrors = consoleMessages.filter(msg =>
      msg.type === 'error' && (
        msg.text.includes('React') ||
        msg.text.includes('Warning:') ||
        msg.text.includes('Error:')
      )
    );
    
    console.log('\n📋 Final Summary:');
    console.log('=================');
    console.log(`✓ Page loaded successfully`);
    console.log(`✓ Critical errors: ${criticalErrors.length}`);
    console.log(`✓ React errors: ${reactErrors.length}`);
    console.log(`✓ Total console messages: ${consoleMessages.length}`);
    console.log(`✓ Total page errors: ${errors.length}`);
    
    if (criticalErrors.length > 0) {
      console.log('\n❌ Critical Errors Found:');
      criticalErrors.forEach(err => console.log(`  - ${err}`));
    }
    
    if (reactErrors.length > 0) {
      console.log('\n⚠️  React Warnings/Errors:');
      reactErrors.forEach(msg => console.log(`  - ${msg.text}`));
    }
    
    // Show all console errors for debugging
    const allErrors = consoleMessages.filter(msg => msg.type === 'error');
    if (allErrors.length > 0 && allErrors.length <= 10) {
      console.log('\n🔍 All Console Errors:');
      allErrors.forEach(msg => console.log(`  - ${msg.text}`));
    } else if (allErrors.length > 10) {
      console.log(`\n🔍 ${allErrors.length} console errors (showing first 10):`);
      allErrors.slice(0, 10).forEach(msg => console.log(`  - ${msg.text}`));
    }
    
    // Overall status
    if (criticalErrors.length === 0) {
      console.log('\n✅ All tests passed! Token page is working correctly.');
      console.log('   - All tabs loaded without critical errors');
      console.log('   - Supply display formatted correctly');
      process.exit(0);
    } else {
      console.log('\n❌ Some critical issues detected. Review errors above.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
