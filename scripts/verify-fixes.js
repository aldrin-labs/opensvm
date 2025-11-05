#!/usr/bin/env node

/**
 * Quick verification script for the fixed endpoints
 */

const BASE_URL = 'http://localhost:3000/api';

async function testEndpoint(name, method, url, body = null) {
  const startTime = Date.now();
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'verify-test'
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    const elapsed = Date.now() - startTime;
    const data = await response.json().catch(() => null);
    
    if (response.ok) {
      console.log(`✅ ${name}`);
      console.log(`   └─ Status: ${response.status} | Time: ${elapsed}ms`);
      if (elapsed < 1000) {
        console.log(`   └─ ⚡ Sub-second response!`);
      }
    } else {
      console.log(`❌ ${name}`);
      console.log(`   └─ Status: ${response.status} | Time: ${elapsed}ms`);
      if (data?.error) {
        console.log(`   └─ Error: ${data.error}`);
      }
    }
    
    return { success: response.ok, elapsed };
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   └─ Error: ${error.message}`);
    return { success: false, elapsed: Date.now() - startTime };
  }
}

async function runTests() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔧 Testing Fixed Endpoints');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Test transaction endpoint with various signatures
  console.log('\n📁 Transaction Endpoint Tests:');
  
  // Test with valid signature
  await testEndpoint(
    'Valid Transaction',
    'GET',
    `${BASE_URL}/transaction/4RwR2w12LydcoutGYJz2TbVxY8HVV44FCN2xoo1L9xu7ZcFxFBpoxxpSFTRWf9MPwMzmr9yTuJZjGqSmzcrawF43`
  );
  
  // Test with demo signature (should work now)
  await testEndpoint(
    'Demo Transaction',
    'GET',
    `${BASE_URL}/transaction/demo-test-signature`
  );
  
  // Test with invalid signature (should return 400, not 404)
  await testEndpoint(
    'Invalid Transaction',
    'GET',
    `${BASE_URL}/transaction/invalid`
  );
  
  console.log('\n📁 Filter Transactions Tests:');
  
  // Test with valid body
  await testEndpoint(
    'Valid Filter Request',
    'POST',
    `${BASE_URL}/filter-transactions`,
    { transactions: [] }
  );
  
  // Test with missing body (should return proper error)
  await testEndpoint(
    'Missing transactions field',
    'POST',
    `${BASE_URL}/filter-transactions`,
    {}
  );
  
  // Test with invalid type (should return proper error)
  await testEndpoint(
    'Invalid transactions type',
    'POST',
    `${BASE_URL}/filter-transactions`,
    { transactions: "not-an-array" }
  );
  
  console.log('\n📁 User History Tests:');
  
  // Test without auth (should return empty data, not 401)
  await testEndpoint(
    'User History (No Auth)',
    'GET',
    `${BASE_URL}/user-history/7aDTuuAN98tBanLcJQgq2oVaXztBzMgLNRu84iVqnVVH`
  );
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⚡ Testing Performance (Cached Endpoints)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Test validators endpoint twice (second should be cached)
  console.log('\n📁 Validators Caching:');
  const v1 = await testEndpoint('Validators (First Call)', 'GET', `${BASE_URL}/analytics/validators`);
  const v2 = await testEndpoint('Validators (Cached)', 'GET', `${BASE_URL}/analytics/validators`);
  
  if (v2.elapsed < v1.elapsed / 2) {
    console.log(`   └─ ✅ Cache working! ${Math.round((1 - v2.elapsed/v1.elapsed) * 100)}% faster`);
  }
  
  // Test slots endpoint twice
  console.log('\n📁 Slots Caching:');
  const s1 = await testEndpoint('Slots (First Call)', 'GET', `${BASE_URL}/slots?limit=10`);
  const s2 = await testEndpoint('Slots (Cached)', 'GET', `${BASE_URL}/slots?limit=10`);
  
  if (s2.elapsed < s1.elapsed / 2) {
    console.log(`   └─ ✅ Cache working! ${Math.round((1 - s2.elapsed/s1.elapsed) * 100)}% faster`);
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Count successful tests
  const results = [
    v1.success, v2.success, s1.success, s2.success
  ];
  
  const successCount = results.filter(r => r).length;
  const successRate = (successCount / results.length * 100).toFixed(1);
  
  console.log(`Success Rate: ${successRate}%`);
  console.log(`Cache Performance: ${v2.elapsed < 1000 && s2.elapsed < 1000 ? '✅ Sub-second' : '⚠️  Needs improvement'}`);
}

runTests().catch(console.error);
