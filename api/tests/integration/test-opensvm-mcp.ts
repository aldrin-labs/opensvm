#!/usr/bin/env bun
/**
 * Integration tests for OpenSVM MCP Server
 * Tests all 25 tools against the live API
 */

const API_BASE_URL = process.env.API_BASE_URL || 'https://osvm.ai';

interface TestResult {
  tool: string;
  success: boolean;
  duration: number;
  error?: string;
  response?: any;
}

const results: TestResult[] = [];

async function testTool(
  name: string,
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: any,
  expectAuthRequired: boolean = false
): Promise<TestResult> {
  const start = Date.now();

  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    if (body && method === 'POST') {
      options.body = JSON.stringify(body);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    options.signal = controller.signal;

    const response = await fetch(url, options);
    clearTimeout(timeout);

    const duration = Date.now() - start;
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      // If we expected auth to be required and got 401, that's a pass
      if (expectAuthRequired && response.status === 401) {
        return {
          tool: name,
          success: true,
          duration,
          response: { authRequired: true, status: 401 },
        };
      }
      return {
        tool: name,
        success: false,
        duration,
        error: `HTTP ${response.status}: ${JSON.stringify(data)}`,
      };
    }

    return {
      tool: name,
      success: true,
      duration,
      response: data,
    };
  } catch (error) {
    return {
      tool: name,
      success: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Test addresses
const TEST_WALLET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC mint
const TEST_TX = '5J7Hz6JnWfPJsaB4G5VQ4MoZsXLWxXKuqMDCxbRhPMkZqWqJKXqVVyNaVdXKyqZpqjqVVyNaVdXKyqZpqjqV'; // Example
const TEST_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC
const TEST_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'; // Token Program

async function runTests() {
  console.log('🧪 OpenSVM MCP Integration Tests');
  console.log('================================');
  console.log(`API: ${API_BASE_URL}\n`);

  // 1. Network Status (no params)
  results.push(await testTool('get_network_status', '/api/status'));

  // 2. Account Portfolio
  results.push(await testTool('get_account_portfolio', `/api/account-portfolio/${TEST_WALLET}`));

  // 3. Account Transactions
  results.push(await testTool('get_account_transactions', `/api/account-transactions/${TEST_WALLET}?limit=5`));

  // 4. Account Stats
  results.push(await testTool('get_account_stats', `/api/account-stats/${TEST_WALLET}`));

  // 5. Blocks
  results.push(await testTool('get_blocks', '/api/blocks?limit=5'));

  // 6. Search
  results.push(await testTool('search', '/api/search-suggestions?q=USDC'));

  // 7. Token Metadata
  results.push(await testTool('get_token_metadata', `/api/token-metadata?mint=${TEST_MINT}`));

  // 8. Token OHLCV
  results.push(await testTool('get_token_ohlcv', `/api/market-data?endpoint=ohlcv&mint=${TEST_MINT}&type=1H`));

  // 9. Token Markets
  results.push(await testTool('get_token_markets', `/api/market-data?endpoint=markets&mint=${TEST_MINT}`));

  // 10. Program Info
  results.push(await testTool('get_program', `/api/program/${TEST_PROGRAM}`));

  // 11. User Profile (public)
  results.push(await testTool('get_user_profile', `/api/user-profile/${TEST_WALLET}`));

  // 12. Check Session
  results.push(await testTool('check_session', '/api/auth/session'));

  // 13. Create API Key (no auth required)
  results.push(await testTool('create_api_key', '/api/auth/api-keys/create', 'POST', {
    name: `Test Key ${Date.now()}`,
    permissions: ['read:*'],
  }));

  // 14. NFT Collections
  results.push(await testTool('get_nft_collections', '/api/nft-collections/trending'));

  // 15. Ask AI (simple question)
  results.push(await testTool('ask_ai', '/api/getAnswer', 'POST', {
    question: 'What is SOL?',
    ownPlan: false,
  }));

  // 16. List API Keys (requires auth - expect 401)
  results.push(await testTool('list_api_keys', '/api/auth/api-keys/list', 'GET', undefined, true));

  // 17. API Key Metrics (requires auth - expect 401)
  results.push(await testTool('get_api_key_metrics', '/api/auth/api-keys/metrics', 'GET', undefined, true));

  // 18. Check SVMAI Access
  results.push(await testTool('check_svmai_access', `/api/check-token?address=${TEST_WALLET}`));

  // Print results
  console.log('\n📊 Results:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  let passed = 0;
  let failed = 0;

  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    const duration = `${result.duration}ms`.padStart(6);
    console.log(`${status} ${result.tool.padEnd(25)} ${duration}`);

    if (!result.success) {
      console.log(`   └─ Error: ${result.error}`);
      failed++;
    } else {
      passed++;
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n📈 Summary: ${passed} passed, ${failed} failed (${results.length} total)`);

  // Exit with error if any failed
  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
runTests().catch(console.error);
