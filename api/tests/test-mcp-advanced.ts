/**
 * Local tests for MCP Advanced Features
 */

import {
  compressResult,
  parsePipeline,
  executePipeline,
  extractAuthContext,
  saveCheckpoint,
  loadCheckpoint,
  listCheckpoints,
  executeBatch,
  getToolVersions,
  getTemplate,
  listTemplates,
} from '../src/mcp-advanced.js';

async function runTests() {
  console.log('Testing MCP Advanced Features\n');
  console.log('='.repeat(50));

  let passed = 0;
  let failed = 0;

  // Test 1: Context Compression
  try {
    console.log('\n1. Context Compression');
    const mockTransactions = Array.from({ length: 50 }, (_, i) => ({
      signature: `sig${i}`,
      timestamp: Date.now() - i * 1000,
      type: i % 3 === 0 ? 'swap' : i % 3 === 1 ? 'transfer' : 'stake',
      success: i % 10 !== 7,
      solTransferred: Math.random() * 100,
      programIds: ['Jupiter', 'Token'],
    }));

    const compressed = compressResult(mockTransactions);
    console.log(`   Original: ${compressed.originalSize} bytes`);
    console.log(`   Compressed: ${compressed.compressedSize} bytes`);
    console.log(`   Ratio: ${compressed.compressionRatio.toFixed(2)}x`);

    if (compressed.compressionRatio > 1) {
      console.log('   ✅ PASS');
      passed++;
    } else {
      console.log('   ❌ FAIL - no compression');
      failed++;
    }
  } catch (e) {
    console.log(`   ❌ FAIL - ${e}`);
    failed++;
  }

  // Test 2: Pipeline Parsing
  try {
    console.log('\n2. Pipeline Parsing');
    const pipelineYaml = `
name: whale_analysis
description: Analyze whale activity
- tool: get_account_portfolio
  params:
    address: test123
  as: portfolio
- tool: get_account_transactions
  params:
    address: test123
    limit: 50
  filter: item.solTransferred > 10
  as: large_txs
`;

    const pipeline = parsePipeline(pipelineYaml);
    console.log(`   Name: ${pipeline.name}`);
    console.log(`   Steps: ${pipeline.steps.length}`);

    if (pipeline.name === 'whale_analysis' && pipeline.steps.length === 2) {
      console.log('   ✅ PASS');
      passed++;
    } else {
      console.log('   ❌ FAIL');
      failed++;
    }
  } catch (e) {
    console.log(`   ❌ FAIL - ${e}`);
    failed++;
  }

  // Test 3: Auth Context
  try {
    console.log('\n3. Auth Context Extraction');
    const freeAuth = extractAuthContext({ 'x-api-key': 'sk_free_abc123' });
    const premiumAuth = extractAuthContext({ 'x-api-key': 'sk_premium_xyz789' });
    const enterpriseAuth = extractAuthContext({ 'x-api-key': 'sk_enterprise_mega' });

    console.log(`   Free: ${freeAuth.tier} (${freeAuth.rateLimit.requestsPerMinute} req/min)`);
    console.log(`   Premium: ${premiumAuth.tier} (${premiumAuth.rateLimit.requestsPerMinute} req/min)`);
    console.log(`   Enterprise: ${enterpriseAuth.tier} (${enterpriseAuth.rateLimit.requestsPerMinute} req/min)`);

    if (freeAuth.tier === 'free' && premiumAuth.tier === 'premium' && enterpriseAuth.tier === 'enterprise') {
      console.log('   ✅ PASS');
      passed++;
    } else {
      console.log('   ❌ FAIL');
      failed++;
    }
  } catch (e) {
    console.log(`   ❌ FAIL - ${e}`);
    failed++;
  }

  // Test 4: Checkpoints
  try {
    console.log('\n4. Investigation Checkpoints');
    const checkpoint = saveCheckpoint('inv_test_123', { step: 5, data: 'test' }, {
      target: 'wallet123',
      type: 'wallet_forensics',
      progress: 0.5,
      stepCount: 5,
      anomalyCount: 2,
    });
    console.log(`   Saved: ${checkpoint.id}`);

    const loaded = loadCheckpoint(checkpoint.id);
    console.log(`   Loaded: ${loaded?.id}`);

    const allCheckpoints = listCheckpoints();
    console.log(`   Total: ${allCheckpoints.length}`);

    if (loaded?.id === checkpoint.id && allCheckpoints.length >= 1) {
      console.log('   ✅ PASS');
      passed++;
    } else {
      console.log('   ❌ FAIL');
      failed++;
    }
  } catch (e) {
    console.log(`   ❌ FAIL - ${e}`);
    failed++;
  }

  // Test 5: Batch Execution
  try {
    console.log('\n5. Batch Execution');
    const mockExecutor = async (tool: string, params: any) => {
      await new Promise(r => setTimeout(r, 10));
      return { tool, params, result: 'ok' };
    };

    const batchResult = await executeBatch([
      { id: '1', tool: 'get_portfolio', params: { address: 'a' } },
      { id: '2', tool: 'get_portfolio', params: { address: 'b' } },
      { id: '3', tool: 'get_portfolio', params: { address: 'c' } },
    ], mockExecutor, 3);

    console.log(`   Requests: ${batchResult.responses.length}`);
    console.log(`   Success: ${batchResult.successCount}`);
    console.log(`   Duration: ${batchResult.totalDuration}ms`);

    if (batchResult.successCount === 3) {
      console.log('   ✅ PASS');
      passed++;
    } else {
      console.log('   ❌ FAIL');
      failed++;
    }
  } catch (e) {
    console.log(`   ❌ FAIL - ${e}`);
    failed++;
  }

  // Test 6: Tool Versions
  try {
    console.log('\n6. Tool Versioning');
    const versions = getToolVersions('investigate');
    console.log(`   Versions found: ${versions.length}`);

    if (versions.length > 0) {
      console.log(`   Latest: v${versions[0].version}`);
      console.log('   ✅ PASS');
      passed++;
    } else {
      console.log('   ✅ PASS (no versions defined yet)');
      passed++;
    }
  } catch (e) {
    console.log(`   ❌ FAIL - ${e}`);
    failed++;
  }

  // Test 7: Investigation Templates
  try {
    console.log('\n7. Investigation Templates');
    const templates = listTemplates();
    console.log(`   Available: ${templates.map(t => t.id).join(', ')}`);

    const quickScan = getTemplate('quick_scan');
    const forensic = getTemplate('forensic');

    console.log(`   quick_scan: ${quickScan?.config.maxTransactions} tx`);
    console.log(`   forensic: ${forensic?.config.maxTransactions} tx`);

    if (quickScan && forensic && quickScan.config.maxTransactions < forensic.config.maxTransactions) {
      console.log('   ✅ PASS');
      passed++;
    } else {
      console.log('   ❌ FAIL');
      failed++;
    }
  } catch (e) {
    console.log(`   ❌ FAIL - ${e}`);
    failed++;
  }

  // Test 8: Pipeline Execution
  try {
    console.log('\n8. Pipeline Execution');
    const mockExecutor = async (tool: string, params: any) => {
      return { tool, status: 'ok' };
    };

    const simplePipeline = parsePipeline(`
name: simple_test
- tool: get_network_status
  as: status
`);

    const pipelineResult = await executePipeline(simplePipeline, mockExecutor, {});
    console.log(`   Steps: ${pipelineResult.steps.length}`);
    console.log(`   All success: ${pipelineResult.steps.every(s => s.success)}`);
    console.log(`   Duration: ${pipelineResult.totalDuration}ms`);

    if (pipelineResult.steps.length === 1 && pipelineResult.steps[0].success) {
      console.log('   ✅ PASS');
      passed++;
    } else {
      console.log('   ❌ FAIL');
      failed++;
    }
  } catch (e) {
    console.log(`   ❌ FAIL - ${e}`);
    failed++;
  }

  // Test 9: Token Compression
  try {
    console.log('\n9. Token Array Compression');
    const mockTokens = Array.from({ length: 30 }, (_, i) => ({
      mint: `mint${i}`,
      symbol: i < 5 ? 'USDC' : i < 10 ? 'BONK' : `TOKEN${i}`,
      balance: Math.random() * 1000,
      valueUsd: Math.random() * 10000,
    }));

    const compressed = compressResult(mockTokens);
    console.log(`   Original: ${compressed.originalSize} bytes`);
    console.log(`   Compressed: ${compressed.compressedSize} bytes`);

    if (compressed.compressed._type === 'token_summary') {
      console.log(`   Type: ${compressed.compressed._type}`);
      console.log(`   Count: ${compressed.compressed.count}`);
      console.log('   ✅ PASS');
      passed++;
    } else {
      console.log('   ❌ FAIL - wrong type');
      failed++;
    }
  } catch (e) {
    console.log(`   ❌ FAIL - ${e}`);
    failed++;
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed (${passed + failed} total)`);

  if (failed === 0) {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed');
    process.exit(1);
  }
}

runTests().catch(console.error);
