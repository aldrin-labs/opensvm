#!/usr/bin/env node

/**
 * Manual Search Bar QA Testing Script
 * 
 * This script performs basic testing to identify the search bar visibility issue
 */

const fs = require('fs');

async function manualSearchBarQA() {
  console.log('🔍 Manual Search Bar QA Testing...\n');
  
  const results = {
    timestamp: new Date().toISOString(),
    findings: [],
    screenshots: [],
    recommendations: []
  };

  // Check the homepage for search bar
  console.log('📍 Checking homepage structure...');
  const { chromium } = require('playwright');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    
    // Take initial screenshot
    await page.screenshot({ path: 'screenshots/manual-qa-homepage.png', fullPage: true });
    
    console.log('📋 Checking all input elements on page...');
    
    // Get all input elements
    const inputs = await page.locator('input').all();
    console.log(`Found ${inputs.length} input elements on page`);
    
    // Check each input for search-related attributes
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const attributes = await input.evaluate(el => ({
        type: el.type,
        placeholder: el.placeholder,
        'aria-label': el.getAttribute('aria-label'),
        'data-testid': el.getAttribute('data-testid'),
        className: el.className,
        visible: el.offsetParent !== null
      }));
      const isVisible = await input.isVisible();
      attributes.visible = isVisible;
      
      console.log(`Input ${i}:`, attributes);
      
      // Check if this is a search input
      const isSearchInput = 
        attributes.type === 'search' ||
        attributes['aria-label']?.toLowerCase().includes('search') ||
        attributes.placeholder?.toLowerCase().includes('search') ||
        attributes['data-testid']?.toLowerCase().includes('search') ||
        attributes.className?.toLowerCase().includes('search');
      
      if (isSearchInput) {
        console.log(`✅ Found search input at index ${i}`);
        results.findings.push({
          type: 'search-input-found',
          index: i,
          attributes: attributes,
          visible: attributes.visible,
          issue: attributes.visible ? null : 'Search input exists but is not visible'
        });
        
        if (!attributes.visible) {
          results.recommendations.push('Search input is hidden - check responsive design or CSS visibility');
        }
      }
    }
    
    // Check navigation elements that might contain search
    console.log('\n🔍 Checking navigation and header...');
    const navElements = await page.locator('nav, header, .navbar, .nav').first();
    const hasNav = await navElements.count();
    
    if (hasNav > 0) {
      console.log('✅ Navigation element found');
      const navSearchInputs = await navElements.locator('input').all();
      console.log(`Found ${navSearchInputs.length} inputs in navigation`);
      
      for (let i = 0; i < navSearchInputs.length; i++) {
        const input = navSearchInputs[i];
        const isVisible = await input.isVisible();
        const attrs = await input.evaluate(el => ({
          type: el.type,
          placeholder: el.placeholder,
          'data-testid': el.getAttribute('data-testid')
        }));
        
        console.log(`Nav input ${i}: visible=${isVisible}, attrs=`, attrs);
        
        if (!isVisible) {
          results.findings.push({
            type: 'hidden-nav-search',
            index: i,
            attributes: attrs,
            issue: 'Search input in navigation is not visible'
          });
          
          results.recommendations.push('Search input in navigation is hidden - check mobile menu or responsive breakpoint');
        }
      }
    }
    
    // Check for mobile menu that might contain search
    console.log('\n📱 Checking for mobile menu...');
    const mobileMenuButton = await page.locator('button[aria-label*="menu" i], .mobile-menu-toggle, .hamburger').first();
    const hasMobileMenu = await mobileMenuButton.count();
    
    if (hasMobileMenu > 0) {
      console.log('✅ Mobile menu button found');
      await mobileMenuButton.click();
      await page.waitForTimeout(1000);
      
      await page.screenshot({ path: 'screenshots/manual-qa-mobile-menu.png' });
      
      // Check for search in mobile menu
      const mobileSearchInputs = await page.locator('input').all();
      for (let i = 0; i < mobileSearchInputs.length; i++) {
        const input = mobileSearchInputs[i];
        const isVisible = await input.isVisible();
        const attrs = await input.evaluate(el => ({
          type: el.type,
          placeholder: el.placeholder,
          'data-testid': el.getAttribute('data-testid')
        }));
        
        console.log(`Mobile menu input ${i}: visible=${isVisible}, attrs=`, attrs);
        
        if (isVisible) {
          results.findings.push({
            type: 'mobile-menu-search',
            index: i,
            attributes: attrs,
            visible: true,
            note: 'Search found in mobile menu'
          });
        }
      }
    }
    
    // Test different viewport sizes
    console.log('\n📐 Testing different viewport sizes...');
    
    const viewports = [
      { name: 'Desktop', width: 1280, height: 720 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Mobile', width: 375, height: 667 }
    ];
    
    for (const viewport of viewports) {
      console.log(`\n🔍 Testing ${viewport.name} (${viewport.width}x${viewport.height})...`);
      
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.reload();
      await page.waitForTimeout(1000);
      
      await page.screenshot({ path: `screenshots/manual-qa-${viewport.name.toLowerCase()}.png`, fullPage: true });
      
      // Check for search input visibility at this viewport
      const searchInputs = await page.locator('input').filter({
        has: page.locator('[aria-label*="search" i], [placeholder*="search" i]')
      }).all();
      
      let visibleSearchCount = 0;
      for (const input of searchInputs) {
        const isVisible = await input.isVisible();
        if (isVisible) visibleSearchCount++;
      }
      
      console.log(`Found ${visibleSearchCount} visible search inputs at ${viewport.name} viewport`);
      
      results.findings.push({
        type: 'viewport-test',
        viewport: viewport.name,
        width: viewport.width,
        height: viewport.height,
        visibleSearchInputs: visibleSearchCount,
        issue: visibleSearchCount === 0 ? `No visible search inputs at ${viewport.name} viewport` : null
      });
      
      if (visibleSearchCount === 0) {
        results.recommendations.push(`Search functionality is not accessible at ${viewport.name} viewport - implement responsive design fixes`);
      }
    }
    
    // Test search page directly
    console.log('\n🔍 Testing search page directly...');
    await page.goto('http://localhost:3000/search', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'screenshots/manual-qa-search-page.png', fullPage: true });
    
    // Check for search components on search page
    const searchPageInputs = await page.locator('input').all();
    console.log(`Found ${searchPageInputs.length} inputs on search page`);
    
    for (let i = 0; i < searchPageInputs.length; i++) {
      const input = searchPageInputs[i];
      const isVisible = await input.isVisible();
      const attrs = await input.evaluate(el => ({
        type: el.type,
        placeholder: el.placeholder,
        'aria-label': el.getAttribute('aria-label')
      }));
      
      console.log(`Search page input ${i}: visible=${isVisible}, attrs=`, attrs);
      
      if (isVisible && (attrs.type === 'search' || attrs.placeholder?.toLowerCase().includes('search'))) {
        // Try to interact with visible search input
        try {
          await input.fill('SOL');
          console.log('✅ Successfully filled search input on search page');
          
          // Look for search button
          const searchButton = await page.locator('button[type="submit"], .search-button').first();
          const hasSearchButton = await searchButton.count();
          
          if (hasSearchButton > 0) {
            await searchButton.click();
            await page.waitForTimeout(2000);
            await page.screenshot({ path: 'screenshots/manual-qa-search-results.png' });
            
            const currentUrl = page.url();
            console.log(`Search navigation result: ${currentUrl}`);
            
            results.findings.push({
              type: 'search-functionality',
              status: 'success',
              note: 'Search functionality works on search page'
            });
          }
        } catch (error) {
          console.log(`❌ Failed to interact with search input: ${error.message}`);
          results.findings.push({
            type: 'search-functionality',
            status: 'failed',
            error: error.message,
            note: 'Search interaction failed'
          });
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Manual QA test failed:', error);
    results.findings.push({
      type: 'test-error',
      error: error.message
    });
  } finally {
    await browser.close();
  }
  
  // Analyze results and create final report
  console.log('\n📊 Generating Analysis Report...');
  
  const issues = results.findings.filter(f => f.issue || f.error);
  const hiddenSearchCount = results.findings.filter(f => f.type === 'hidden-nav-search' || (f.type === 'search-input-found' && !f.visible)).length;
  const viewportIssues = results.findings.filter(f => f.type === 'viewport-test' && f.issue);
  
  const summary = {
    totalFindings: results.findings.length,
    issuesFound: issues.length,
    hiddenSearchInputs: hiddenSearchCount,
    viewportProblems: viewportIssues.length,
    severity: issues.length > 5 ? 'critical' : issues.length > 2 ? 'high' : 'medium'
  };
  
  results.summary = summary;
  
  console.log('\n🎯 QA Summary:');
  console.log(`- Total findings: ${summary.totalFindings}`);
  console.log(`- Issues found: ${summary.issuesFound}`);
  console.log(`- Hidden search inputs: ${summary.hiddenSearchInputs}`);
  console.log(`- Viewport problems: ${summary.viewportProblems}`);
  console.log(`- Overall severity: ${summary.severity}`);
  
  if (issues.length > 0) {
    console.log('\n🚨 Key Issues:');
    issues.forEach(issue => {
      console.log(`  • ${issue.type}: ${issue.issue || issue.error}`);
    });
  }
  
  // Save detailed results
  fs.writeFileSync('/home/larp/aldrin/opensvm/manual-search-qa-results.json', JSON.stringify(results, null, 2));
  console.log('\n💾 Detailed manual QA results saved to: manual-search-qa-results.json');
  
  return results;
}

// Run the manual QA test
manualSearchBarQA()
  .then(results => {
    console.log('\n✅ Manual Search Bar QA Testing Completed!');
    process.exit(results.summary.severity === 'critical' ? 1 : 0);
  })
  .catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
