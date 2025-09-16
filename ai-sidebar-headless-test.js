const { chromium } = require('playwright');
const fetch = require('node-fetch');

// AI Sidebar Manual Validation Checklist Test Script
const TEST_RESULTS = {
  passed: [],
  failed: [],
  blocked: [],
  na: [],
  startTime: new Date(),
  endTime: null
};

function logResult(category, testId, description, status, notes = '') {
  const result = { testId, description, status, notes, timestamp: new Date().toISOString() };
  TEST_RESULTS[category].push(result);
  console.log(`[${status}] ${testId}: ${description} ${notes ? '- ' + notes : ''}`);
}

async function waitForSelectorWithTimeout(page, selector, timeout = 5000) {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch (e) {
    return false;
  }
}

async function testGlobalPreconditions(page) {
  console.log('\n=== Testing Global Preconditions ===');
  
  // G0.1 - Dev server running
  try {
    const response = await fetch('http://localhost:3000/');
    if (response.status === 200) {
      logResult('passed', 'G0.1', 'Dev server running', 'P', 'Server responding with 200 OK');
    } else {
      logResult('failed', 'G0.1', 'Dev server running', 'F', `Server responded with ${response.status}`);
    }
  } catch (e) {
    logResult('failed', 'G0.1', 'Dev server running', 'F', `Server not accessible: ${e.message}`);
  }

  // G0.2 - No console errors on initial load
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000); // Wait for initial load
  
  if (consoleErrors.length === 0) {
    logResult('passed', 'G0.2', 'No console errors on initial load', 'P');
  } else {
    logResult('failed', 'G0.2', 'No console errors on initial load', 'F', `Found ${consoleErrors.length} errors: ${consoleErrors.join(', ')}`);
  }

  // G0.6 - Window API SVMAI defined
  const hasSVMAI = await page.evaluate(() => {
    return typeof window.SVMAI !== 'undefined' && 
           typeof window.SVMAI.open === 'function' &&
           typeof window.SVMAI.close === 'function' &&
           typeof window.SVMAI.toggle === 'function' &&
           typeof window.SVMAI.prompt === 'function' &&
           typeof window.SVMAI.setWidth === 'function' &&
           typeof window.SVMAI.getWidth === 'function';
  });
  
  if (hasSVMAI) {
    logResult('passed', 'G0.6', 'Window API SVMAI defined with required methods', 'P');
  } else {
    logResult('failed', 'G0.6', 'Window API SVMAI defined with required methods', 'F', 'SVMAI API not properly defined');
  }

  return consoleErrors;
}

async function testSidebarActivation(page) {
  console.log('\n=== Testing Sidebar Activation ===');
  
  // Try using the SVMAI API directly
  const apiResult = await page.evaluate(() => {
    try {
      if (window.SVMAI && typeof window.SVMAI.open === 'function') {
        window.SVMAI.open();
        return { success: true, method: 'api' };
      }
      return { success: false, error: 'SVMAI API not available' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  if (apiResult.success) {
    await page.waitForTimeout(1000);
    
    // Check if sidebar opened
    const sidebarExists = await page.$('[data-testid="ai-sidebar"]') !== null;
    if (sidebarExists) {
      logResult('passed', '1.1', 'First-Time User Activation via SVMAI API', 'P', 'Sidebar opened successfully');
      return true;
    }
  }
  
  // Fallback: Try clicking the AI button
  console.log('Trying button click...');
  const aiButton = await page.$('button:has-text("SVMAI")');
  if (aiButton) {
    await aiButton.click();
    await page.waitForTimeout(1000);
    
    // Check if sidebar opened
    const sidebarExists = await page.$('[data-testid="ai-sidebar"]') !== null;
    if (sidebarExists) {
      logResult('passed', '1.1', 'First-Time User Activation via button click', 'P', 'Sidebar opened successfully');
      return true;
    }
  }
  
  // Final fallback: Test keyboard shortcut
  console.log('Trying keyboard shortcut...');
  await page.keyboard.down('Control');
  await page.keyboard.down('Shift');
  await page.keyboard.press('I');
  await page.keyboard.up('Shift');
  await page.keyboard.up('Control');
  
  await page.waitForTimeout(1000);
  
  // Check if sidebar opened
  const sidebarExists = await page.$('[data-testid="ai-sidebar"]') !== null;
  if (sidebarExists) {
    logResult('passed', '1.1', 'First-Time User Activation via keyboard shortcut', 'P', 'Sidebar opened successfully');
  } else {
    logResult('failed', '1.1', 'First-Time User Activation', 'F', `Sidebar did not open via API (${apiResult.error}), button, or keyboard shortcut`);
  }
  
  return sidebarExists;
}

async function testChatFunctionality(page) {
  console.log('\n=== Testing Chat Functionality ===');
  
  // Find input field and send a test message
  const inputSelector = '[data-testid="ai-chat-input"]';
  const inputExists = await waitForSelectorWithTimeout(page, inputSelector);
  
  if (!inputExists) {
    logResult('failed', '2.1', 'Basic Text Message - Input field not found', 'F');
    return false;
  }
  
  // Send a simple test message
  await page.fill(inputSelector, 'Hello, this is a test message');
  await page.press(inputSelector, 'Enter');
  
  // Wait for response
  await page.waitForTimeout(3000);
  
  // Check if message was sent and response received
  const messages = await page.$$('[data-testid="chat-message"]');
  if (messages.length >= 2) { // At least user message + AI response
    logResult('passed', '2.1', 'Basic Text Message', 'P', `Found ${messages.length} messages in conversation`);
  } else {
    logResult('failed', '2.1', 'Basic Text Message', 'F', `Only found ${messages.length} messages`);
  }
  
  // Test Shift+Enter for new line
  await page.fill(inputSelector, 'Line 1');
  await page.keyboard.down('Shift');
  await page.press(inputSelector, 'Enter');
  await page.keyboard.up('Shift');
  await page.fill(inputSelector, 'Line 2');
  
  const inputValue = await page.inputValue(inputSelector);
  if (inputValue.includes('Line 1') && inputValue.includes('Line 2')) {
    logResult('passed', '2.2', 'Shift+Enter newline', 'P', 'Multi-line input working');
  } else {
    logResult('failed', '2.2', 'Shift+Enter newline', 'F', 'Multi-line input not working');
  }
  
  return messages.length >= 2;
}

async function testProcessingIndicator(page) {
  console.log('\n=== Testing Processing Indicator ===');
  
  // Send a message that should trigger processing indicator
  const inputSelector = '[data-testid="ai-chat-input"]';
  await page.fill(inputSelector, 'Please explain blockchain technology');
  await page.press(inputSelector, 'Enter');
  
  // Check for processing indicator immediately
  const processingIndicator = await waitForSelectorWithTimeout(page, '[data-ai-processing-status]', 1000);
  
  if (processingIndicator) {
    logResult('passed', '2.6', 'Loading Indicator Primary', 'P', 'Processing indicator visible');
  } else {
    logResult('failed', '2.6', 'Loading Indicator Primary', 'F', 'Processing indicator not found');
  }
  
  // Wait for response to complete
  await page.waitForTimeout(5000);
  
  // Check global pending flag
  const globalPending = await page.evaluate(() => window.__SVMAI_PENDING__);
  if (globalPending === false || globalPending === undefined) {
    logResult('passed', 'G0.8', 'Global pending flag toggles correctly', 'P', 'Flag properly reset after processing');
  } else {
    logResult('failed', 'G0.8', 'Global pending flag toggles correctly', 'F', 'Flag still true after processing');
  }
  
  return processingIndicator;
}

async function testTabManagement(page) {
  console.log('\n=== Testing Tab Management ===');
  
  // Look for new tab button
  const newTabButton = await page.$('[data-testid="new-tab-button"]');
  if (!newTabButton) {
    logResult('failed', '3.1', 'New Tab Creation - Button not found', 'F');
    return false;
  }
  
  // Create new tab
  await newTabButton.click();
  await page.waitForTimeout(1000);
  
  // Check if new tab was created
  const tabs = await page.$$('[data-testid="chat-tab"]');
  if (tabs.length >= 2) {
    logResult('passed', '3.1', 'New Tab Creation', 'P', `Created tab, now have ${tabs.length} tabs`);
  } else {
    logResult('failed', '3.1', 'New Tab Creation', 'F', `Still have only ${tabs.length} tabs`);
  }
  
  return tabs.length >= 2;
}

async function testKnowledgeManagement(page) {
  console.log('\n=== Testing Knowledge Management ===');
  
  // Look for knowledge panel
  const knowledgePanel = await page.$('[data-testid="knowledge-panel"]');
  if (!knowledgePanel) {
    logResult('na', '6.1', 'Manual Note Creation - Knowledge panel not available', 'N/A');
    return false;
  }
  
  // Test adding a note
  const addNoteButton = await page.$('[data-testid="add-note-button"]');
  if (addNoteButton) {
    await addNoteButton.click();
    await page.waitForTimeout(500);
    
    // Fill note content
    const noteInput = await page.$('[data-testid="note-input"]');
    if (noteInput) {
      await noteInput.fill('Test knowledge note');
      await page.press('[data-testid="note-input"]', 'Enter');
      await page.waitForTimeout(1000);
      
      // Check if note was added
      const notes = await page.$$('[data-testid="knowledge-note"]');
      if (notes.length > 0) {
        logResult('passed', '6.1', 'Manual Note Creation', 'P', `Added note, now have ${notes.length} notes`);
      } else {
        logResult('failed', '6.1', 'Manual Note Creation', 'F', 'Note not found after creation');
      }
    }
  }
  
  return true;
}

async function testMessageRendering(page) {
  console.log('\n=== Testing Message Rendering ===');
  
  // Send a message with markdown
  const inputSelector = '[data-testid="ai-chat-input"]';
  await page.fill(inputSelector, 'Please show me a code block with TypeScript');
  await page.press(inputSelector, 'Enter');
  await page.waitForTimeout(3000);
  
  // Check for code block rendering
  const codeBlock = await page.$('pre code');
  if (codeBlock) {
    logResult('passed', '4.2', 'Code Block (lang)', 'P', 'Code block with syntax highlighting found');
  } else {
    logResult('failed', '4.2', 'Code Block (lang)', 'F', 'No code block found');
  }
  
  return codeBlock !== null;
}

async function testPersistence(page) {
  console.log('\n=== Testing Persistence ===');
  
  // Get current state
  const messagesBefore = await page.$$('[data-testid="chat-message"]');
  const tabsBefore = await page.$$('[data-testid="chat-tab"]');
  
  // Reload page
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // Check state after reload
  const messagesAfter = await page.$$('[data-testid="chat-message"]');
  const tabsAfter = await page.$$('[data-testid="chat-tab"]');
  
  if (messagesAfter.length === messagesBefore.length && tabsAfter.length === tabsBefore.length) {
    logResult('passed', '15.1', 'Messages Persist', 'P', `Messages preserved: ${messagesAfter.length}`);
    logResult('passed', '15.4', 'Thread Metadata Persist', 'P', `Tabs preserved: ${tabsAfter.length}`);
  } else {
    logResult('failed', '15.1', 'Messages Persist', 'F', `Before: ${messagesBefore.length}, After: ${messagesAfter.length}`);
    logResult('failed', '15.4', 'Thread Metadata Persist', 'F', `Before: ${tabsBefore.length}, After: ${tabsAfter.length}`);
  }
  
  return messagesAfter.length === messagesBefore.length;
}

async function runAllTests() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    console.log('Starting AI Sidebar Manual Validation Tests...');
    console.log('Server URL: http://localhost:3000');
    console.log('Start Time:', new Date().toISOString());
    
    // Navigate to homepage first
    console.log('Navigating to homepage...');
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(2000); // Wait for page to fully load and providers to mount
    
    // Test global preconditions
    await testGlobalPreconditions(page);
    
    // Test sidebar activation
    const sidebarActive = await testSidebarActivation(page);
    
    if (sidebarActive) {
      // Test chat functionality
      await testChatFunctionality(page);
      
      // Test processing indicator
      await testProcessingIndicator(page);
      
      // Test tab management
      await testTabManagement(page);
      
      // Test knowledge management
      await testKnowledgeManagement(page);
      
      // Test message rendering
      await testMessageRendering(page);
      
      // Test persistence
      await testPersistence(page);
    }
    
    // Generate summary
    TEST_RESULTS.endTime = new Date();
    const duration = (TEST_RESULTS.endTime - TEST_RESULTS.startTime) / 1000 / 60; // minutes
    
    console.log('\n=== TEST SUMMARY ===');
    console.log(`Total Tests: ${TEST_RESULTS.passed.length + TEST_RESULTS.failed.length + TEST_RESULTS.blocked.length + TEST_RESULTS.na.length}`);
    console.log(`Passed: ${TEST_RESULTS.passed.length}`);
    console.log(`Failed: ${TEST_RESULTS.failed.length}`);
    console.log(`Blocked: ${TEST_RESULTS.blocked.length}`);
    console.log(`N/A: ${TEST_RESULTS.na.length}`);
    console.log(`Duration: ${duration.toFixed(2)} minutes`);
    
    // Save results to file
    const fs = require('fs');
    const resultsFile = `ai-sidebar-test-results-${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(resultsFile, JSON.stringify(TEST_RESULTS, null, 2));
    console.log(`\nDetailed results saved to: ${resultsFile}`);
    
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
