#!/usr/bin/env bun
/**
 * MCP Registry and Gateway Tests
 */

import {
  MCPRegistry,
  createRegistry,
  createGatewayTools,
} from '../src/mcp-registry.js';

async function runTests() {
  console.log('MCP Registry & Gateway Tests');
  console.log('='.repeat(50));

  let passed = 0;
  let failed = 0;

  // Test 1: Create Registry
  try {
    console.log('\n1. Create Registry');
    const registry = createRegistry();
    console.log('   ✅ Registry created');
    passed++;
  } catch (e) {
    console.log(`   ❌ Failed: ${e}`);
    failed++;
  }

  // Test 2: Register Server
  try {
    console.log('\n2. Register Server');
    const registry = new MCPRegistry();
    const server = registry.registerServer({
      id: 'test-server',
      name: 'Test Server',
      version: '1.0.0',
      transport: 'http',
      baseUrl: 'https://test.example.com',
    });

    if (server.id === 'test-server' && server.status === 'unknown') {
      console.log(`   ✅ Server registered: ${server.name}`);
      passed++;
    } else {
      throw new Error('Server not registered correctly');
    }
  } catch (e) {
    console.log(`   ❌ Failed: ${e}`);
    failed++;
  }

  // Test 3: Register Tools
  try {
    console.log('\n3. Register Tools');
    const registry = new MCPRegistry();
    registry.registerServer({ id: 'test', name: 'Test', transport: 'http' });
    registry.registerTools('test', [
      { name: 'tool_a', description: 'Tool A', inputSchema: { type: 'object', properties: {} } },
      { name: 'tool_b', description: 'Tool B', inputSchema: { type: 'object', properties: {} } },
    ]);

    const tools = registry.getAllTools();
    if (tools.length === 2) {
      console.log(`   ✅ Registered ${tools.length} tools`);
      passed++;
    } else {
      throw new Error(`Expected 2 tools, got ${tools.length}`);
    }
  } catch (e) {
    console.log(`   ❌ Failed: ${e}`);
    failed++;
  }

  // Test 4: Find Tool
  try {
    console.log('\n4. Find Tool');
    const registry = new MCPRegistry();
    registry.registerServer({ id: 'srv', name: 'Server', transport: 'http' });
    registry.registerTools('srv', [
      { name: 'my_tool', description: 'My Tool', inputSchema: { type: 'object', properties: {} } },
    ]);

    const byName = registry.findTool('my_tool');
    const byQualified = registry.findTool('srv:my_tool');

    if (byName && byQualified && byName.qualifiedName === 'srv:my_tool') {
      console.log(`   ✅ Found tool by name and qualified name`);
      passed++;
    } else {
      throw new Error('Tool not found correctly');
    }
  } catch (e) {
    console.log(`   ❌ Failed: ${e}`);
    failed++;
  }

  // Test 5: Discovery (Config)
  try {
    console.log('\n5. Discovery from Config');
    const registry = new MCPRegistry({ enableHttpDiscovery: false });
    const results = await registry.discover();

    const configResult = results.find(r => r.source === 'config');
    if (configResult && configResult.servers.length >= 2) {
      console.log(`   ✅ Discovered ${configResult.servers.length} servers from config`);
      console.log(`      - ${configResult.servers.map(s => s.name).join(', ')}`);
      passed++;
    } else {
      throw new Error('Config discovery failed');
    }
  } catch (e) {
    console.log(`   ❌ Failed: ${e}`);
    failed++;
  }

  // Test 6: Get Stats
  try {
    console.log('\n6. Registry Stats');
    const registry = new MCPRegistry();
    registry.registerServer({ id: 's1', name: 'Server 1', transport: 'http', category: 'blockchain' });
    registry.registerServer({ id: 's2', name: 'Server 2', transport: 'http', category: 'markets' });
    registry.registerTools('s1', [
      { name: 't1', description: 'T1', inputSchema: { type: 'object', properties: {} } },
      { name: 't2', description: 'T2', inputSchema: { type: 'object', properties: {} } },
    ]);
    registry.registerTools('s2', [
      { name: 't3', description: 'T3', inputSchema: { type: 'object', properties: {} } },
    ]);

    const stats = registry.getStats();
    if (stats.serverCount === 2 && stats.totalTools === 3) {
      console.log(`   ✅ Stats: ${stats.serverCount} servers, ${stats.totalTools} tools`);
      console.log(`      Categories: ${JSON.stringify(stats.toolsByCategory)}`);
      passed++;
    } else {
      throw new Error('Stats incorrect');
    }
  } catch (e) {
    console.log(`   ❌ Failed: ${e}`);
    failed++;
  }

  // Test 7: Route Tool Call
  try {
    console.log('\n7. Route Tool Call');
    const registry = new MCPRegistry();
    registry.registerServer({ id: 'router', name: 'Router Test', transport: 'http' });
    registry.registerTools('router', [
      { name: 'routed_tool', description: 'Routed', inputSchema: { type: 'object', properties: {} } },
    ]);

    const mockExecutor = async (serverId: string, tool: string, args: any) => {
      return { executed: true, serverId, tool, args };
    };

    const result = await registry.routeToolCall('routed_tool', { test: true }, mockExecutor);

    if (result.success && result.serverId === 'router') {
      console.log(`   ✅ Tool call routed to ${result.serverId}`);
      console.log(`      Latency: ${result.latencyMs}ms`);
      passed++;
    } else {
      throw new Error('Routing failed');
    }
  } catch (e) {
    console.log(`   ❌ Failed: ${e}`);
    failed++;
  }

  // Test 8: Gateway Tools
  try {
    console.log('\n8. Gateway Tools');
    const registry = new MCPRegistry();
    registry.registerServer({ id: 'gw', name: 'Gateway', transport: 'http' });
    registry.registerTools('gw', [
      { name: 'gw_tool', description: 'Gateway Tool', inputSchema: { type: 'object', properties: {} } },
    ]);

    const gatewayTools = createGatewayTools(registry);

    // Should include management tools + registered tools
    const hasManagement = gatewayTools.some(t => t.name === 'registry_list_servers');
    const hasRegistered = gatewayTools.some(t => t.name === 'gw_tool');

    if (hasManagement && hasRegistered) {
      console.log(`   ✅ Gateway has ${gatewayTools.length} tools (management + registered)`);
      passed++;
    } else {
      throw new Error('Gateway tools incomplete');
    }
  } catch (e) {
    console.log(`   ❌ Failed: ${e}`);
    failed++;
  }

  // Test 9: Export/Import
  try {
    console.log('\n9. Export/Import Registry');
    const registry1 = new MCPRegistry();
    registry1.registerServer({ id: 'exp', name: 'Exportable', transport: 'http' });
    registry1.registerTools('exp', [
      { name: 'exp_tool', description: 'Exp', inputSchema: { type: 'object', properties: {} } },
    ]);

    const exported = registry1.export();

    const registry2 = new MCPRegistry();
    registry2.import({ servers: exported.servers });

    const server = registry2.getServer('exp');
    if (server && server.name === 'Exportable') {
      console.log(`   ✅ Registry exported and imported successfully`);
      passed++;
    } else {
      throw new Error('Export/import failed');
    }
  } catch (e) {
    console.log(`   ❌ Failed: ${e}`);
    failed++;
  }

  // Test 10: Unregister Server
  try {
    console.log('\n10. Unregister Server');
    const registry = new MCPRegistry();
    registry.registerServer({ id: 'temp', name: 'Temporary', transport: 'http' });
    registry.registerTools('temp', [
      { name: 'temp_tool', description: 'Temp', inputSchema: { type: 'object', properties: {} } },
    ]);

    const beforeCount = registry.getAllTools().length;
    const removed = registry.unregisterServer('temp');
    const afterCount = registry.getAllTools().length;

    if (removed && afterCount < beforeCount) {
      console.log(`   ✅ Server unregistered, tools removed (${beforeCount} → ${afterCount})`);
      passed++;
    } else {
      throw new Error('Unregister failed');
    }
  } catch (e) {
    console.log(`   ❌ Failed: ${e}`);
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
