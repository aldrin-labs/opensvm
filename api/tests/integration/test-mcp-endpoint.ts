#!/usr/bin/env bun
/**
 * Test MCP API at proper endpoint
 */

const testData = {
  jsonrpc: "2.0",
  id: 1,
  method: "tools.list",
  params: {}
};

async function testMCPAPI() {
  try {
    console.log('🔍 Testing MCP API at dflow.opensvm.com/api/mcp...');
    
    const response = await fetch('https://dflow.opensvm.com/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    const status = response.status;
    const text = await response.text();
    
    console.log('Status:', status);
    console.log('Response:', text.substring(0, 500) + (text.length > 500 ? '...' : ''));
    
    if (status === 200) {
      try {
        const result = JSON.parse(text);
        console.log('✅ MCP API Working!');
        console.log('Tools available:', result.result?.tools?.length || 0);
      } catch (parseError) {
        console.log('❌ Invalid JSON response');
      }
    } else if (status === 404) {
      console.log('❌ 404 - Endpoint not found');
    } else {
      console.log('❌ Unexpected status:', status);
    }

  } catch (error) {
    console.log('❌ Test Failed:', error.message);
  }
}

testMCPAPI();