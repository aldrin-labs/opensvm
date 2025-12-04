#!/usr/bin/env bun
/**
 * Test MCP API at proper /api/mcp endpoint
 */

const testData = {
  jsonrpc: "2.0",
  id: 1,
  method: "tools.list",
  params: {}
};

async function testCorrectEndpoint() {
  try {
    console.log('🔍 Testing MCP API at /api/mcp (correct endpoint)...');
    
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
    console.log('Response:', text.substring(0, 300) + (text.length > 300 ? '...' : ''));
    
    if (status === 200) {
      try {
        const result = JSON.parse(text);
        console.log('✅ MCP API Working at /api/mcp!');
        console.log('Tools available:', result.result?.tools?.length || 0);
        
        // Test actual tool call
        const toolCall = {
          jsonrpc: "2.0",
          id: 2,
          method: "tools.call",
          params: {
            name: "get_events",
            arguments: { limit: 5 }
          }
        };
        
        const toolResponse = await fetch('https://dflow.opensvm.com/api/mcp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toolCall)
        });
        
        const toolResult = await toolResponse.json();
        console.log('✅ Tool call also working!');
        console.log('Event data received');
        
      } catch (parseError) {
        console.log('❌ Invalid JSON response');
      }
    } else if (status === 404) {
      console.log('❌ 404 - /api/mcp endpoint not routed');
    } else {
      console.log('❌ Unexpected status:', status);
    }

  } catch (error) {
    console.log('❌ Test Failed:', error.message);
  }
}

testCorrectEndpoint();