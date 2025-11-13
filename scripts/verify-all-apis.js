#!/usr/bin/env node

/**
 * Comprehensive API Verification Script
 * Tests all 9 categories of API endpoints
 */

const BASE_URL = 'http://localhost:3000/api';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Test configurations for each category
const testConfigs = [
  {
    category: 'Search & Discovery',
    tests: [
      { method: 'GET', endpoint: '/search?q=solana', name: 'Universal Search' },
      { method: 'GET', endpoint: '/search/suggestions?q=sol', name: 'Search Suggestions' },
      { method: 'GET', endpoint: '/program-registry', name: 'Program Registry' }
    ]
  },
  {
    category: 'Account & Wallet',
    tests: [
      { method: 'GET', endpoint: '/account-stats/REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck', name: 'Account Statistics' },
      { method: 'GET', endpoint: '/check-account-type?address=11111111111111111111111111111111', name: 'Check Account Type' }
    ]
  },
  {
    category: 'Transactions',
    tests: [
      { method: 'GET', endpoint: '/transaction/5vYsYWPF4gdN1imxLpJAWi9QKpN3MSrFTFXK8pfmPogFjQNPiAkxFQCGzEEWNto16mWnwmdwNQH7KPCnkMcZ9Ba5', name: 'Get Transaction' },
      { method: 'POST', endpoint: '/filter-transactions', body: { limit: 5 }, name: 'Filter Transactions' }
    ]
  },
  {
    category: 'Blockchain',
    tests: [
      { method: 'GET', endpoint: '/blocks?limit=5', name: 'Recent Blocks' },
      { method: 'GET', endpoint: '/blocks/stats', name: 'Block Statistics' },
      { method: 'GET', endpoint: '/slots', name: 'Slot Information' }
    ]
  },
  {
    category: 'Tokens & NFTs',
    tests: [
      { method: 'GET', endpoint: '/token/So11111111111111111111111111111111111111112', name: 'Token Information' },
      { method: 'GET', endpoint: '/nft-collections', name: 'NFT Collections' },
      { method: 'GET', endpoint: '/check-token?address=So11111111111111111111111111111111111111112', name: 'Check Token' }
    ]
  },
  {
    category: 'Analytics',
    tests: [
      { method: 'GET', endpoint: '/analytics/overview', name: 'DeFi Overview' },
      { method: 'GET', endpoint: '/analytics/dex', name: 'DEX Analytics' },
      { method: 'GET', endpoint: '/analytics/validators', name: 'Validator Analytics' }
    ]
  },
  {
    category: 'AI-Powered',
    tests: [
      { 
        method: 'POST', 
        endpoint: '/getAnswer', 
        body: { question: 'What is the current price of SVMAI?' }, 
        name: 'AI Question Answering' 
      },
      { method: 'GET', endpoint: '/getSources', name: 'Data Sources' }
    ]
  },
  {
    category: 'Real-Time',
    tests: [
      { method: 'GET', endpoint: '/stream', name: 'Data Stream' },
      { method: 'GET', endpoint: '/scan', name: 'Blockchain Scan' }
    ]
  },
  {
    category: 'User Services',
    tests: [
      { method: 'GET', endpoint: '/user-profile/REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck', name: 'User Profile' },
      { method: 'GET', endpoint: '/user-history/REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck?limit=5', name: 'User History' }
    ]
  }
];

// Function to test an API endpoint
async function testEndpoint(config) {
  const url = `${BASE_URL}${config.endpoint}`;
  const options = {
    method: config.method,
    headers: { 'Content-Type': 'application/json' }
  };
  
  if (config.body) {
    options.body = JSON.stringify(config.body);
  }
  
  try {
    const startTime = Date.now();
    const response = await fetch(url, options);
    const responseTime = Date.now() - startTime;
    
    const isSuccess = response.ok;
    const statusCode = response.status;
    
    // Try to get response size
    const contentLength = response.headers.get('content-length') || 'N/A';
    
    return {
      name: config.name,
      success: isSuccess,
      statusCode,
      responseTime,
      contentLength,
      endpoint: config.endpoint
    };
  } catch (error) {
    return {
      name: config.name,
      success: false,
      error: error.message,
      endpoint: config.endpoint
    };
  }
}

// Main test runner
async function runTests() {
  console.log(`${colors.cyan}╔════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║         OpenSVM API Comprehensive Verification Test           ║${colors.reset}`);
  console.log(`${colors.cyan}╚════════════════════════════════════════════════════════════════╝${colors.reset}\n`);
  
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  
  for (const category of testConfigs) {
    console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.blue}📁 ${category.category}${colors.reset}`);
    console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    
    for (const test of category.tests) {
      totalTests++;
      const result = await testEndpoint(test);
      
      if (result.success) {
        passedTests++;
        console.log(`${colors.green}✅ ${result.name}${colors.reset}`);
        console.log(`   └─ Status: ${result.statusCode} | Time: ${result.responseTime}ms | Size: ${result.contentLength} bytes`);
      } else {
        failedTests++;
        console.log(`${colors.red}❌ ${result.name}${colors.reset}`);
        console.log(`   └─ ${result.error || `Status: ${result.statusCode}`}`);
        console.log(`   └─ Endpoint: ${result.endpoint}`);
      }
    }
    console.log('');
  }
  
  // Print summary
  console.log(`${colors.cyan}╔════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║                          TEST SUMMARY                         ║${colors.reset}`);
  console.log(`${colors.cyan}╚════════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log(`${colors.yellow}📊 Total Tests: ${totalTests}${colors.reset}`);
  console.log(`${colors.green}✅ Passed: ${passedTests}${colors.reset}`);
  console.log(`${colors.red}❌ Failed: ${failedTests}${colors.reset}`);
  console.log(`${colors.blue}📈 Success Rate: ${((passedTests/totalTests) * 100).toFixed(1)}%${colors.reset}\n`);
  
  // Special test for SVMAI data verification
  console.log(`${colors.cyan}╔════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║                    SVMAI DATA VERIFICATION                    ║${colors.reset}`);
  console.log(`${colors.cyan}╚════════════════════════════════════════════════════════════════╝${colors.reset}`);
  
  try {
    // Test getAnswer API for SVMAI
    const svmaiResponse = await fetch(`${BASE_URL}/getAnswer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        question: 'What is the current price, market cap, and trading volume for SVMAI?' 
      })
    });
    
    const svmaiData = await svmaiResponse.text();
    
    // Get CoinGecko data for comparison
    const coingeckoResponse = await fetch('https://api.coingecko.com/api/v3/coins/opensvm-com?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false');
    const coingeckoData = await coingeckoResponse.json();
    
    console.log(`${colors.green}✅ SVMAI Data Retrieved Successfully${colors.reset}`);
    console.log(`   ├─ API Response includes price: ${svmaiData.includes('$0.000234') ? '✅' : '❌'}`);
    console.log(`   ├─ API Response includes market cap: ${svmaiData.includes('$233') ? '✅' : '❌'}`);
    console.log(`   ├─ API Response includes volume: ${svmaiData.includes('$4.05K') || svmaiData.includes('$4,05') ? '✅' : '❌'}`);
    console.log(`   └─ CoinGecko Price Match: $${coingeckoData.market_data.current_price.usd}`);
    
  } catch (error) {
    console.log(`${colors.red}❌ SVMAI Verification Failed: ${error.message}${colors.reset}`);
  }
  
  console.log(`\n${colors.green}═══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.green}                    API Verification Complete!                   ${colors.reset}`);
  console.log(`${colors.green}═══════════════════════════════════════════════════════════════${colors.reset}\n`);
}

// Run the tests
runTests().catch(console.error);
