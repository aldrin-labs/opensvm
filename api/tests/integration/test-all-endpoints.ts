#!/usr/bin/env bun
/**
 * Test all possible MCP endpoints and routing
 */

const testData = {
  jsonrpc: "2.0",
  id: 1,
  method: "tools.list",
  params: {}
};

async function testAllEndpoints() {
  const endpoints = [
    '/api/mcp',
    '/.netlify/functions/mcp',
    '/mcp',
    '/api/functions/mcp',
    '/.netlify/functions/health',
    '/api/health'
  ];

  for (const endpoint of endpoints) {
    const url = `https://dflow.opensvm.com${endpoint}`;
    console.log(`\n🔍 Testing ${url}:`);
    
    try {
      const isHealth = endpoint.includes('health');
      
      if (isHealth) {
        const response = await fetch(url, { method: 'GET' });
        const status = response.status;
        const text = await response.text();
        console.log('Status:', status);
        console.log('Response type:', text.substring(0, 50));
      } else {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testData)
        });
        
        const status = response.status;
        const text = await response.text();
        console.log('Status:', status);
        console.log('Response type:', text.substring(0, 50));
      }
      
      if (status === 200) {
        console.log('✅ Working!');
      } else if (status === 404) {
        console.log('❌ Not found');
      } else {
        console.log('⚠️ Unexpected status:', status);
      }
      
    } catch (error) {
      console.log('❌ Error:', error.message);
    }
  }

  console.log('\n📋 Summary:');
  console.log('Expected MCP endpoint: /api/mcp');
  console.log('Working internal: /.netlify/functions/mcp');
  console.log('Issue: Routing from public to internal URL');
}

testAllEndpoints();