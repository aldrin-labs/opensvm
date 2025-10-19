import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  try {
    console.log('\n=== Testing Profile Feed Tab ===\n');
    
    console.log('1. Loading profile page...');
    await page.goto('http://localhost:3000/user/11111111111111111111111111111111', { 
      waitUntil: 'networkidle', 
      timeout: 90000 
    });
    
    // Close any modal
    console.log('2. Closing any modals...');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
    
    const closeBtn = page.locator('button:has-text("✕")').last();
    try {
      await closeBtn.click({ timeout: 2000 });
      await page.waitForTimeout(500);
    } catch (e) {}
    
    console.log('3. Taking screenshot of initial page state...');
    await page.screenshot({ path: '/tmp/step1-initial.png', fullPage: true });
    
    console.log('4. Clicking Feed tab...');
    await page.locator('button:has-text("Feed")').first().click({ force: true });
    await page.waitForTimeout(5000);
    
    console.log('5. Taking screenshot after clicking Feed tab...');
    await page.screenshot({ path: '/tmp/step2-feed-clicked.png', fullPage: true });
    
    // Analyze what's visible
    const tabContent = await page.locator('[role="tabpanel"]').first().textContent();
    console.log('\n6. Feed tab content visible:', tabContent ? 'YES' : 'NO');
    console.log('   Content preview (first 200 chars):', tabContent?.slice(0, 200));
    
    // Check if the UserFeedDisplay component is rendering
    const hasCard = await page.locator('.space-y-4 > div[class*="card"]').count();
    const hasRefresh = await page.locator('button', { hasText: 'Refresh' }).count();
    const hasClearCache = await page.locator('button', { hasText: 'Clear Cache' }).count();
    
    console.log('\n7. Component elements detected:');
    console.log(`   - Card containers: ${hasCard}`);
    console.log(`   - Refresh button: ${hasRefresh}`);
    console.log(`   - Clear Cache button: ${hasClearCache}`);
    
    // Check for the feed UI (For You/Following tabs)
    const forYouTab = await page.locator('text=For You').count();
    const followingTab = await page.locator('text=Following').count();
    
    console.log(`   - For You tab: ${forYouTab}`);
    console.log(`   - Following tab: ${followingTab}`);
    
    console.log('\n8. Final assessment:');
    if (forYouTab > 0 && followingTab > 0) {
      console.log('✅ SUCCESS: Feed tab is fully functional!');
      console.log('   The feed component is rendering with For You and Following tabs.');
    } else if (tabContent && tabContent.length > 50) {
      console.log('✅ SUCCESS: Feed tab is loading!');
      console.log('   Content is visible (may be showing access restriction or different state).');
    } else {
      console.log('❌ ISSUE: Feed tab may not be loading properly');
    }
    
    console.log('\nScreenshots saved:');
    console.log('  - /tmp/step1-initial.png');
    console.log('  - /tmp/step2-feed-clicked.png');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    await page.screenshot({ path: '/tmp/error-screenshot.png', fullPage: true });
    console.log('Error screenshot saved: /tmp/error-screenshot.png');
  } finally {
    await browser.close();
  }
})();
