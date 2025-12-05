#!/usr/bin/env node

/**
 * Interactive Search Bar Testing
 * 
 * This script opens the website in a visible browser for real manual testing
 */

const { chromium } = require('playwright');

async function interactiveSearchTest() {
  console.log('🌐 Starting Interactive Search Bar Testing...\n');
  console.log('⚠️  IMPORTANT: A browser window should have opened');
  console.log('📝 Please manually test the following and report back:\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  try {
    console.log('📍 Opening localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    
    console.log('📸 Taking homepage screenshot...');
    await page.screenshot({ path: 'screenshots/manual-interactive-01-homepage.png', fullPage: true });
    
    // Test 1: Check if search bar is visible
    console.log('\n🔍 TEST 1: Search Bar Visibility');
    const searchInputs = await page.locator('input[type="text"]').all();
    console.log(`Found ${searchInputs.length} input elements`);
    
    for (let i = 0; i < searchInputs.length; i++) {
      const input = searchInputs[i];
      const visible = await input.isVisible();
      const placeholder = await input.getAttribute('placeholder');
      
      console.log(`   Input ${i}: ${visible ? '✅ VISIBLE' : '❌ HIDDEN'} - "${placeholder}"`);
      
      if (visible) {
