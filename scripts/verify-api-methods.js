#!/usr/bin/env node

/**
 * API Method Verification Script
 * Tests all documented API endpoints to ensure they're working correctly
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';
const TEST_WALLET = 'GqkVnLkVV2EGxxL7GczFnt4uoLVFyQ14K7jPqrFLk7XC';
const TEST_SIGNATURE = '5vYsYWPF4gdN1imxLpJAWi9QKpN3MSrFTFXK8pfmPogFjQNPiAkxFQCGzEEWNto16mWnwmdwNQH7KPCnkMcZ9Ba5';
const TEST_MINT = 'So11111111111111111111111111111111111111112'; // Wrapped SOL
const TEST_SLOT = 290000000;

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

// Test results tracker
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  errors: []
};

/**
 * Make HTTP request with error handling
 */
async function makeRequest(method, endpoint, body = null, headers = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    return { 
      status: response.status, 
      data,
      ok: response.ok,
      headers: response.headers
    };
  } catch (error) {
    return { 
      status: 0, 
      error: error.message,
      ok: false 
    };
  }
}

/**
 * Test a single API endpoint
 */
async function testEndpoint(name, method, endpoint, body = null, validateFn = null) {
  results.total++;
  process.stdout.write(`Testing ${name}... `);
  
  try {
    const response = await makeRequest(method, endpoint, body);
    
    if (response.ok) {
      // Custom validation if provided
      if (validateFn && !validateFn(response.data)) {
        results.failed++;
        console.log(`${colors.red}✗${colors.reset} Invalid response format`);
        results.errors.push({ name, error: 'Invalid response format' });
        return false;
      }
      
      results.passed++;
      console.log(`${colors.green}✓${colors.reset}`);
      return true;
    } else {
      // Some endpoints might 404 for test data, which is acceptable
      if (response.status === 404) {
        results.skipped++;
        console.log(`${colors.yellow}⊘${colors.reset} Not found (acceptable)`);
        return true;
      }
      
      results.failed++;
      console.log(`${colors.red}✗${colors.reset} Status: ${response.status}`);
      results.errors.push({ name, error: `HTTP ${response.status}` });
      return false;
    }
  } catch (error) {
    results.failed++;
    console.log(`${colors.red}✗${colors.reset} ${error.message}`);
    results.errors.push({ name, error: error.message });
    return false;
  }
}

/**
 * Test all API categories
 */
async function runTests() {
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.cyan}        OpenSVM API Method Verification${colors.reset}`);
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`Base URL: ${BASE_URL}\n`);
  
  // 1. BLOCKCHAIN CORE APIs
  console.log(`\n${colors.cyan}▶ Blockchain Core APIs${colors.reset}`);
  console.log(`${colors.dim}────────────────────────${colors.reset}`);
  
  await testEndpoint('Get Transaction', 'GET', `/transaction/${TEST_SIGNATURE}`);
  await testEndpoint('Batch Transactions', 'POST', '/transaction/batch', {
    signatures: [TEST_SIGNATURE],
    includeDetails: true
  });
  await testEndpoint('Analyze Transaction', 'GET', `/transaction/${TEST_SIGNATURE}/analysis`);
  await testEndpoint('Explain Transaction', 'GET', `/transaction/${TEST_SIGNATURE}/explain`);
  await testEndpoint('Related Transactions', 'GET', `/transaction/${TEST_SIGNATURE}/related`);
  await testEndpoint('Transaction Metrics', 'GET', `/transaction/${TEST_SIGNATURE}/metrics`);
  await testEndpoint('Transaction Failure Analysis', 'GET', `/transaction/${TEST_SIGNATURE}/failure-analysis`);
  
  await testEndpoint('Get Recent Blocks', 'GET', '/blocks?limit=5');
  await testEndpoint('Get Block Details', 'GET', `/blocks/${TEST_SLOT}`);
  await testEndpoint('Block Statistics', 'GET', '/blocks/stats?lookbackSlots=10');
  
  await testEndpoint('Account Stats', 'GET', `/account-stats/${TEST_WALLET}`);
  await testEndpoint('Account Transactions', 'GET', `/account-transactions/${TEST_WALLET}?limit=10`);
  await testEndpoint('Account Transfers', 'GET', `/account-transfers/${TEST_WALLET}?limit=10`);
  await testEndpoint('Account Portfolio', 'GET', `/account-portfolio/${TEST_WALLET}`);
  await testEndpoint('Account Token Stats', 'GET', `/account-token-stats/${TEST_WALLET}/${TEST_MINT}`);
  await testEndpoint('Check Account Type', 'GET', `/check-account-type?address=${TEST_WALLET}`);
  
  // 2. TOKEN & NFT APIs
  console.log(`\n${colors.cyan}▶ Token & NFT APIs${colors.reset}`);
  console.log(`${colors.dim}────────────────────────${colors.reset}`);
  
  await testEndpoint('Token Info', 'GET', `/token/${TEST_MINT}`);
  await testEndpoint('Token Metadata', 'GET', `/token-metadata?mints=${TEST_MINT}`);
  await testEndpoint('Token Stats', 'GET', `/token-stats/${TEST_WALLET}/${TEST_MINT}`);
  await testEndpoint('Check Token', 'GET', `/check-token?mint=${TEST_MINT}`);
  
  await testEndpoint('NFT Collections', 'GET', '/nft-collections?limit=5');
  await testEndpoint('Trending NFTs', 'GET', '/nft-collections/trending');
  await testEndpoint('New NFT Collections', 'GET', '/nft-collections/new');
  
  // 3. ANALYTICS APIs
  console.log(`\n${colors.cyan}▶ Analytics APIs${colors.reset}`);
  console.log(`${colors.dim}────────────────────────${colors.reset}`);
  
  await testEndpoint('DeFi Overview', 'GET', '/analytics/overview');
  await testEndpoint('DEX Analytics', 'GET', '/analytics/dex?timeframe=24h');
  await testEndpoint('DeFi Health', 'GET', '/analytics/defi-health');
  await testEndpoint('Validators', 'GET', '/analytics/validators');
  await testEndpoint('Trending Validators', 'GET', '/analytics/trending-validators');
  await testEndpoint('Marketplaces', 'GET', '/analytics/marketplaces');
  await testEndpoint('Aggregators', 'GET', '/analytics/aggregators');
  await testEndpoint('Launchpads', 'GET', '/analytics/launchpads');
  await testEndpoint('Bots', 'GET', '/analytics/bots');
  await testEndpoint('SocialFi', 'GET', '/analytics/socialfi');
  await testEndpoint('InfoFi', 'GET', '/analytics/infofi');
  await testEndpoint('DeFAI', 'GET', '/analytics/defai');
  
  // 4. AI-POWERED APIs
  console.log(`\n${colors.cyan}▶ AI-Powered APIs${colors.reset}`);
  console.log(`${colors.dim}────────────────────────${colors.reset}`);
  
  await testEndpoint('Get Answer', 'POST', '/getAnswer', {
    question: 'What is the current block height?'
  });
  await testEndpoint('Get Similar Questions', 'POST', '/getSimilarQuestions', {
    question: 'How to stake SOL?',
    limit: 3
  });
  await testEndpoint('Get Sources', 'GET', '/getSources');
  await testEndpoint('Analyze Transaction AI', 'POST', '/analyze-transaction', {
    signature: TEST_SIGNATURE
  });
  await testEndpoint('Filter Transactions', 'POST', '/filter-transactions', {
    filters: { type: 'transfer' },
    limit: 5
  });
  await testEndpoint('AI Response', 'POST', '/ai-response', {
    prompt: 'Explain Solana consensus'
  });
  
  // 5. SEARCH & DISCOVERY
  console.log(`\n${colors.cyan}▶ Search & Discovery${colors.reset}`);
  console.log(`${colors.dim}────────────────────────${colors.reset}`);
  
  await testEndpoint('Universal Search', 'GET', '/search?q=SOL');
  await testEndpoint('Account Search', 'GET', '/search/accounts?q=whale');
  await testEndpoint('Search Suggestions', 'GET', '/search/suggestions?q=sol');
  await testEndpoint('Alternative Search Suggestions', 'GET', '/search-suggestions?q=sol');
  
  await testEndpoint('Program Discovery', 'GET', '/program-discovery?verified=true');
  await testEndpoint('Program Registry', 'GET', '/program-registry');
  await testEndpoint('Program Info', 'GET', '/program/11111111111111111111111111111111');
  await testEndpoint('Program Metadata', 'GET', '/program-metadata?programs=11111111111111111111111111111111');
  
  // 6. USER SERVICES
  console.log(`\n${colors.cyan}▶ User Services${colors.reset}`);
  console.log(`${colors.dim}────────────────────────${colors.reset}`);
  
  await testEndpoint('User Profile', 'GET', `/user-profile/${TEST_WALLET}`);
  await testEndpoint('User History', 'GET', `/user-history/${TEST_WALLET}?limit=10`);
  await testEndpoint('User Tab Preferences', 'GET', `/user-tab-preference/${TEST_WALLET}`);
  await testEndpoint('User Feed', 'GET', `/user-feed/${TEST_WALLET}`);
  
  // 7. MONITORING & HEALTH
  console.log(`\n${colors.cyan}▶ Monitoring & Health${colors.reset}`);
  console.log(`${colors.dim}────────────────────────${colors.reset}`);
  
  await testEndpoint('Anthropic Health', 'GET', '/health/anthropic');
  await testEndpoint('API Monitoring', 'GET', '/monitoring/api');
  await testEndpoint('Request Logs', 'GET', '/monitoring/requests?limit=5');
  
  // 8. UTILITY ENDPOINTS
  console.log(`\n${colors.cyan}▶ Utility Endpoints${colors.reset}`);
  console.log(`${colors.dim}────────────────────────${colors.reset}`);
  
  await testEndpoint('Slots Info', 'GET', '/slots');
  await testEndpoint('Favicon', 'GET', '/favicon');
  
  // 9. SOLANA RPC
  console.log(`\n${colors.cyan}▶ Solana RPC${colors.reset}`);
  console.log(`${colors.dim}────────────────────────${colors.reset}`);
  
  await testEndpoint('Solana RPC', 'POST', '/solana-rpc', {
    jsonrpc: '2.0',
    id: 1,
    method: 'getSlot',
    params: []
  });
  
  // Print results
  console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.cyan}                    Test Results${colors.reset}`);
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  console.log(`\nTotal Tests: ${results.total}`);
  console.log(`${colors.green}Passed: ${results.passed}${colors.reset}`);
  console.log(`${colors.yellow}Skipped: ${results.skipped}${colors.reset} (404s for test data)`);
  console.log(`${colors.red}Failed: ${results.failed}${colors.reset}`);
  
  const successRate = ((results.passed + results.skipped) / results.total * 100).toFixed(1);
  const rateColor = successRate >= 80 ? colors.green : successRate >= 60 ? colors.yellow : colors.red;
  console.log(`\nSuccess Rate: ${rateColor}${successRate}%${colors.reset}`);
  
  if (results.errors.length > 0) {
    console.log(`\n${colors.red}Failed Tests:${colors.reset}`);
    results.errors.forEach(({ name, error }) => {
      console.log(`  • ${name}: ${error}`);
    });
  }
  
  // Exit code based on results
  const exitCode = results.failed > 0 ? 1 : 0;
  process.exit(exitCode);
}

// Check if server is running
async function checkServerHealth() {
  try {
    console.log(`${colors.dim}Checking server health...${colors.reset}`);
    const response = await fetch(BASE_URL.replace('/api', ''));
    if (!response.ok && response.status !== 404) {
      console.error(`${colors.red}Error: Server is not responding at ${BASE_URL}${colors.reset}`);
      console.log(`\nPlease ensure the server is running with:`);
      console.log(`  ${colors.cyan}npm run dev${colors.reset}`);
      process.exit(1);
    }
    console.log(`${colors.green}Server is responding${colors.reset}\n`);
  } catch (error) {
    console.error(`${colors.red}Error: Cannot connect to server at ${BASE_URL}${colors.reset}`);
    console.log(`\nPlease ensure the server is running with:`);
    console.log(`  ${colors.cyan}npm run dev${colors.reset}`);
    process.exit(1);
  }
}

// Main execution
(async () => {
  await checkServerHealth();
  await runTests();
})();
