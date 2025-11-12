#!/usr/bin/env node

/**
 * Token Routes Caching and Latency Test
 * Tests all token-related API routes for caching and performance
 */

const testMint = 'Cpzvdx6pppc9TNArsGsqgShCsKC9NCCjA2gtzHvUpump';
const baseUrl = 'http://localhost:3000';

const routes = [
  {
    name: 'Token Details',
    path: `/api/token/${testMint}`,
    expectsCaching: true
  },
  {
    name: 'Token Holders',
    path: `/api/token/${testMint}/holders`,
    expectsCaching: true
  }
];

async function measureLatency(url, requestNumber) {
  const start = Date.now();
  try {
    const response = await fetch(url);
    const latency = Date.now() - start;
    const data = await response.json();
    
    return {
      success: true,
      latency,
      status: response.status,
      cached: data.cached || false,
      cacheAge: data.cacheAge || null,
      dataSize: JSON.stringify(data).length
    };
  } catch (error) {
    return {
      success: false,
      latency: Date.now() - start,
      error: error.message
    };
  }
}

async function testRoute(route) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing: ${route.name}`);
  console.log(`Path: ${route.path}`);
  console.log(`Expected Caching: ${route.expectsCaching ? 'YES' : 'NO'}`);
  console.log('='.repeat(80));

  const url = `${baseUrl}${route.path}`;
  const results = [];

  // Test 1: First request (should be uncached)
  console.log('\n📊 Request #1 (Initial - should fetch fresh data)');
  const result1 = await measureLatency(url, 1);
  results.push(result1);
  
  if (result1.success) {
    console.log(`  ✓ Status: ${result1.status}`);
    console.log(`  ⏱️  Latency: ${result1.latency}ms`);
    console.log(`  💾 Cached: ${result1.cached}`);
    console.log(`  📦 Data Size: ${(result1.dataSize / 1024).toFixed(2)} KB`);
  } else {
    console.log(`  ✗ Error: ${result1.error}`);
    return { route: route.name, results, passed: false };
  }

  // Wait 2 seconds
  console.log('\n⏳ Waiting 2 seconds...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: Second request (should be cached if caching enabled)
  console.log('\n📊 Request #2 (Should be cached if enabled)');
  const result2 = await measureLatency(url, 2);
  results.push(result2);
  
  if (result2.success) {
    console.log(`  ✓ Status: ${result2.status}`);
    console.log(`  ⏱️  Latency: ${result2.latency}ms`);
    console.log(`  💾 Cached: ${result2.cached}`);
    if (result2.cacheAge !== null) {
      console.log(`  🕐 Cache Age: ${result2.cacheAge}s`);
    }
    console.log(`  📦 Data Size: ${(result2.dataSize / 1024).toFixed(2)} KB`);
    
    // Check if latency improved
    const improvement = ((result1.latency - result2.latency) / result1.latency * 100).toFixed(1);
    console.log(`  📈 Latency Change: ${improvement}% ${improvement > 0 ? 'faster' : 'slower'}`);
  } else {
    console.log(`  ✗ Error: ${result2.error}`);
  }

  // Wait 65 seconds to test background refresh (if caching enabled)
  if (route.expectsCaching) {
    console.log('\n⏳ Waiting 65 seconds to test background refresh...');
    await new Promise(resolve => setTimeout(resolve, 65000));

    // Test 3: Request after 1 minute (should trigger background refresh)
    console.log('\n📊 Request #3 (After 1 min - should trigger background refresh)');
    const result3 = await measureLatency(url, 3);
    results.push(result3);
    
    if (result3.success) {
      console.log(`  ✓ Status: ${result3.status}`);
      console.log(`  ⏱️  Latency: ${result3.latency}ms`);
      console.log(`  💾 Cached: ${result3.cached}`);
      if (result3.cacheAge !== null) {
        console.log(`  🕐 Cache Age: ${result3.cacheAge}s`);
      }
      console.log(`  📦 Data Size: ${(result3.dataSize / 1024).toFixed(2)} KB`);
      
      if (result3.cacheAge && result3.cacheAge > 60) {
        console.log(`  ⚠️  Cache is older than 60s - background refresh should have been triggered`);
      }
    } else {
      console.log(`  ✗ Error: ${result3.error}`);
    }
  }

  // Analysis
  console.log('\n📋 Analysis:');
  const avgLatency = results.reduce((sum, r) => sum + (r.success ? r.latency : 0), 0) / results.filter(r => r.success).length;
  console.log(`  Average Latency: ${avgLatency.toFixed(0)}ms`);
  
  const cachingWorking = route.expectsCaching ? results.some(r => r.cached) : true;
  console.log(`  Caching Status: ${cachingWorking ? '✓ Working' : '✗ Not Working'}`);
  
  const passed = results.every(r => r.success) && cachingWorking;
  console.log(`  Overall: ${passed ? '✓ PASSED' : '✗ FAILED'}`);

  return { route: route.name, results, passed, avgLatency };
}

async function main() {
  console.log('🚀 Token Routes Caching and Latency Test');
  console.log(`Testing against: ${baseUrl}`);
  console.log(`Test Token: ${testMint}`);
  console.log(`Total Routes: ${routes.length}`);

  const allResults = [];

  for (const route of routes) {
    const result = await testRoute(route);
    allResults.push(result);
  }

  // Summary
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  
  allResults.forEach(result => {
    const status = result.passed ? '✓' : '✗';
    const avgLatency = result.avgLatency ? `${result.avgLatency.toFixed(0)}ms avg` : 'N/A';
    console.log(`${status} ${result.route.padEnd(30)} - ${avgLatency}`);
  });

  const totalPassed = allResults.filter(r => r.passed).length;
  const totalTests = allResults.length;
  
  console.log('\n' + '='.repeat(80));
  console.log(`Results: ${totalPassed}/${totalTests} routes passed`);
  console.log('='.repeat(80));

  process.exit(totalPassed === totalTests ? 0 : 1);
}

main().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
