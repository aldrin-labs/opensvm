const { chromium } = require('playwright');
const fetch = require('node-fetch');

// AI Sidebar AI Resolution Test - Tests actual AI query processing and backend API integration
const TEST_RESULTS = {
  passed: [],
  failed: [],
  blocked: [],
  na: [],
  startTime: new Date(),
  endTime: null,
  aiResponses: []
};

function logResult(category, testId, description, status, notes = '', data = null) {
  const result = { testId, description, status, notes, timestamp: new Date().toISOString(), data };
  TEST_RESULTS[category].push(result);
  console.log(`[${status}] ${testId}: ${description} ${notes ? '- ' + notes : ''}`);
  if (data) {
    console.log(`  Data: ${JSON.stringify(data, null, 2)}`);
  }
}

async function testAIQueryResolution(page) {
  console.log('\n=== Testing AI Query Resolution ===');
  
  // Test 1: Network Performance Query
  console.log('\n--- Test: Network Performance Query ---');
  const networkQuery = "What is the current TPS on Solana?";
  
  // Use SVMAI.prompt to send the query
  const promptResult = await page.evaluate((query) => {
    try {
      window.SVMAI.prompt(query, true);
      return { success: true, query };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, networkQuery);
  
  if (promptResult.success) {
    logResult('passed', 'AI.1', 'Network Query Sent', 'P', `Query: "${networkQuery}"`);
    
    // Wait for processing and response
    await page.waitForTimeout(5000);
    
    // Check for AI response in the DOM
    const messages = await page.$$('[data-testid="chat-message"]');
    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
    
    if (lastMessage) {
      const messageText = await lastMessage.textContent();
      const hasNetworkData = messageText.toLowerCase().includes('tps') || 
                            messageText.toLowerCase().includes('transactions');
      
      if (hasNetworkData) {
        logResult('passed', 'AI.2', 'Network Response Received', 'P', `Response contains network data: ${messageText.substring(0, 100)}...`);
        TEST_RESULTS.aiResponses.push({
          query: networkQuery,
          response: messageText,
          type: 'network',
          success: true
        });
      } else {
        logResult('failed', 'AI.2', 'Network Response Received', 'F', `Response lacks network data: ${messageText.substring(0, 100)}...`);
      }
    } else {
      logResult('failed', 'AI.2', 'Network Response Received', 'F', 'No response message found');
    }
  } else {
    logResult('failed', 'AI.1', 'Network Query Sent', 'F', promptResult.error);
  }
}

async function testBackendAPIIntegration(page) {
  console.log('\n=== Testing Backend API Integration ===');
  
  // Test RPC API calls
  try {
    const response = await fetch('http://localhost:3000/api/health');
    if (response.ok) {
      logResult('passed', 'API.1', 'Backend API Health Check', 'P', 'API responding correctly');
    } else {
      logResult('failed', 'API.1', 'Backend API Health Check', 'F', `HTTP ${response.status}`);
    }
  } catch (error) {
    logResult('failed', 'API.1', 'Backend API Health Check', 'F', error.message);
  }
}

async function runAllTests() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    console.log('Starting AI Sidebar AI Resolution Tests...');
    console.log('Server URL: http://localhost:3000');
    console.log('Start Time:', new Date().toISOString());
    
    // Navigate to homepage with AI parameter to auto-open sidebar
    console.log('Navigating to homepage with AI parameter...');
    await page.goto('http://localhost:3000/?ai=true', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);
    
    // Test basic sidebar functionality first
    const hasSVMAI = await page.evaluate(() => {
      return typeof window.SVMAI !== 'undefined' && 
             typeof window.SVMAI.open === 'function' &&
             typeof window.SVMAI.prompt === 'function';
    });
    
    if (!hasSVMAI) {
      console.log('SVMAI API not available, trying to open manually...');
      await page.evaluate(() => window.SVMAI && window.SVMAI.open());
      await page.waitForTimeout(2000);
    }
    
    // Test AI query resolution
    await testAIQueryResolution(page);
    
    // Test backend API integration
    await testBackendAPIIntegration(page);
    
    // Generate summary
    TEST_RESULTS.endTime = new Date();
    const duration = (TEST_RESULTS.endTime - TEST_RESULTS.startTime) / 1000 / 60; // minutes
    
    console.log('\n=== AI RESOLUTION TEST SUMMARY ===');
    console.log(`Total Tests: ${TEST_RESULTS.passed.length + TEST_RESULTS.failed.length + TEST_RESULTS.blocked.length + TEST_RESULTS.na.length}`);
    console.log(`Passed: ${TEST_RESULTS.passed.length}`);
    console.log(`Failed: ${TEST_RESULTS.failed.length}`);
    console.log(`Blocked: ${TEST_RESULTS.blocked.length}`);
    console.log(`N/A: ${TEST_RESULTS.na.length}`);
    console.log(`Duration: ${duration.toFixed(2)} minutes`);
    
    // Show AI responses summary
    if (TEST_RESULTS.aiResponses.length > 0) {
      console.log('\n=== AI RESPONSES SUMMARY ===');
      TEST_RESULTS.aiResponses.forEach((response, index) => {
        console.log(`${index + 1}. ${response.type.toUpperCase()} Query: "${response.query}"`);
        console.log(`   Response: ${response.response.substring(0, 150)}...`);
        console.log(`   Success: ${response.success ? '✓' : '✗'}`);
      });
    }
    
    // Save results to file
    const fs = require('fs');
    const resultsFile = `ai-sidebar-ai-resolution-results-${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(resultsFile, JSON.stringify(TEST_RESULTS, null, 2));
    console.log(`\nDetailed results saved to: ${resultsFile}`);
    
    // Return overall success status
    const success = TEST_RESULTS.failed.length === 0 && TEST_RESULTS.aiResponses.length > 0;
    console.log(`\nOverall Test Result: ${success ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`AI Sidebar AI Resolution Capability: ${success ? 'WORKING' : 'ISSUES DETECTED'}`);
    
  } catch (error) {
    console.error('Test execution failed:', error);
  } finally {
    await browser.close();
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests, TEST_RESULTS };
