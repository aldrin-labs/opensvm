#!/usr/bin/env bun
/**
 * Test script for DFlow MCP Server
 * This script verifies that the server can start up and tools are properly defined
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function testServer() {
  console.log('🧪 Testing DFlow MCP Server...\n');

  try {
    // Test if the server can start and list tools
    console.log('📝 Testing tool listing...');
    
    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    };

    const { stdout, stderr } = await execAsync(`echo '${JSON.stringify(request)}' | bun run src/index.ts`);
    
    if (stderr) {
      console.error('❌ Server stderr:', stderr);
    }

    try {
      const response = JSON.parse(stdout.trim());
      
      if (response.result && response.result.tools) {
        const tools = response.result.tools;
        console.log(`✅ Server started successfully with ${tools.length} tools\n`);
        
        // List some key tools
        const sampleTools = tools.slice(0, 5).map((t: any) => t.name);
        console.log('📋 Sample tools:', sampleTools.join(', '));
        
        // Validate tool structure
        const hasRequiredFields = tools.every((tool: any) => 
          tool.name && 
          tool.description && 
          tool.inputSchema
        );
        
        if (hasRequiredFields) {
          console.log('✅ All tools have required fields');
        } else {
          console.log('❌ Some tools missing required fields');
        }
      } else {
        console.log('❌ Invalid response structure:', response);
      }
    } catch (parseError) {
      console.log('❌ Failed to parse response:', parseError);
      console.log('Raw response:', stdout);
    }

  } catch (error) {
    console.error('❌ Server test failed:', error);
    process.exit(1);
  }

  console.log('\n🎉 Server test completed!');
}

// Run the test
testServer().catch(console.error);