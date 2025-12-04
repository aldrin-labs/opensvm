#!/usr/bin/env bun
/**
 * Test direct Netlify function URLs
 */

async function testDirectFunctions() {
  try {
    console.log('🔍 Testing direct Netlify function URLs...');
    
    // Test direct function URLs
    const urls = [
      'https://dflow.opensvm.com/.netlify/functions/health',
      'https://dflow.opensvm.com/.netlify/functions/mcp'
    ];

    for (const url of urls) {
      console.log(`\n📋 Testing ${url}:`);
      
      try {
        // For health - GET request
        if (url.includes('health')) {
          const response = await fetch(url);
          const status = response.status;
          const text = await response.text();
          console.log('Status:', status);
          console.log('Response:', text.substring(0, 200) + (text.length > 200 ? '...' : ''));
        }
        // For MCP - POST request
        else if (url.includes('mcp')) {
          const testData = {
            jsonrpc: "2.0",
            id: 1,
            method: "tools.list",
            params: {}
          };
          
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(testData)
          });
          
          const status = response.status;
          const text = await response.text();
          console.log('Status:', status);
          console.log('Response:', text.substring(0, 200) + (text.length > 200 ? '...' : ''));
        }
        
        if (status === 200) {
          console.log('✅ Working!');
        } else if (status === 404) {
          console.log('❌ 404 - Function not found');
        } else {
          console.log('❌ Unexpected status:', status);
        }
      } catch (error) {
        console.log('❌ Error:', error.message);
      }
    }

  } catch (error) {
    console.log('❌ Test Failed:', error.message);
  }
}

testDirectFunctions();