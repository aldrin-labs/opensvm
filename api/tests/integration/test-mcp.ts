#!/usr/bin/env bun
/**
 * Test MCP API directly
 */

const testData = {
  jsonrpc: "2.0",
  id: 1,
  method: "tools.list",
  params: {}
};

async function testMCPAPI() {
  try {
    const response = await fetch('http://localhost:3000', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();
    console.log('✅ MCP API Test Results:');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));

    // Test tool call
    const toolCallData = {
      jsonrpc: "2.0",
      id: 2,
      method: "tools.call",
      params: {
        name: "get_events",
        arguments: { limit: 5 }
      }
    };

    const toolResponse = await fetch('http://localhost:3000', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(toolCallData)
    });

    const toolResult = await toolResponse.json();
    console.log('\n✅ Tool Call Test Results:');
    console.log('Status:', toolResponse.status);
    console.log('Response:', JSON.stringify(toolResult, null, 2));

  } catch (error) {
    console.log('❌ Test Failed:', error.message);
  }
}

testMCPAPI();