#!/usr/bin/env bun
/**
 * Unified MCP Registry Tests
 *
 * Comprehensive tests for the unified registry including:
 * - CRUD operations
 * - Schema format conversion
 * - Caching
 * - Event system
 * - Health checking
 * - Pagination
 */

import {
  UnifiedMCPRegistry,
  createUnifiedRegistry,
  SCHEMA_VERSIONS,
  type OfficialServerJSON,
  type MCPBManifest,
  type UnifiedServer,
} from '../src/mcp-registry-unified.js';

console.log('Unified MCP Registry Tests');
console.log('='.repeat(60));

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      console.log(`   [PASS] ${name}`);
      passed++;
    } catch (error) {
      console.log(`   [FAIL] ${name}`);
      console.log(`      Error: ${error instanceof Error ? error.message : error}`);
      failed++;
    }
  })();
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// ============================================================================
// Test Data
// ============================================================================

const sampleOfficialServer: OfficialServerJSON = {
  $schema: SCHEMA_VERSIONS.OFFICIAL,
  name: 'io.example/test-server',
  title: 'Test Server',
  description: 'A test server for unit testing',
  version: '1.0.0',
  websiteUrl: 'https://example.com',
  repository: { url: 'https://github.com/example/test', source: 'github' },
  icons: [{ src: 'https://example.com/icon.png', sizes: ['192x192'] }],
  remotes: [{ type: 'http', url: 'https://api.example.com' }],
  _meta: {
    tags: ['test', 'example'],
    category: 'testing',
    capabilities: { tools: 5, prompts: 2, resources: 1 },
  },
};

const sampleMCPBManifest: MCPBManifest = {
  $schema: SCHEMA_VERSIONS.MCPB_V03,
  manifest_version: '0.3',
  name: 'mcpb-test-server',
  display_name: 'MCPB Test Server',
  version: '2.0.0',
  description: 'A test MCPB manifest for unit testing',
  author: { name: 'Test Author', email: 'test@example.com' },
  repository: { type: 'git', url: 'https://github.com/example/mcpb-test' },
  homepage: 'https://mcpb.example.com',
  icons: [{ src: 'https://mcpb.example.com/icon.png', size: '192x192' }],
  keywords: ['mcpb', 'test'],
  server: {
    type: 'node',
    entry_point: 'src/index.ts',
    mcp_config: {
      command: 'node',
      args: ['dist/index.js'],
      env: { API_KEY: '${API_KEY}' },
    },
  },
  tools: [
    { name: 'tool_a', description: 'Tool A' },
    { name: 'tool_b', description: 'Tool B' },
  ],
};

// ============================================================================
// Basic Registry Tests
// ============================================================================

async function runTests() {
  console.log('\n1. Basic Registry Operations');

  await test('Create registry with default config', () => {
    const registry = new UnifiedMCPRegistry();
    assert(registry !== null, 'Registry should be created');
  });

  await test('Create registry with custom config', () => {
    const registry = createUnifiedRegistry({
      cacheTtlMs: 120000,
      healthCheckIntervalMs: 30000,
    });
    assert(registry !== null, 'Registry with custom config should be created');
  });

  // ============================================================================
  // CRUD Operations
  // ============================================================================

  console.log('\n2. CRUD Operations');

  await test('Register server (unified format)', () => {
    const registry = new UnifiedMCPRegistry();
    const server = registry.register({
      id: 'test-unified',
      name: 'test-unified',
      displayName: 'Test Unified Server',
      version: '1.0.0',
      description: 'Test server in unified format',
      transport: 'http',
      baseUrl: 'https://test.com',
    });

    assert(server.id === 'test-unified', 'Server ID should match');
    assert(server.schemaFormat === 'internal', 'Schema format should be internal');
  });

  await test('Register server (official format)', () => {
    const registry = new UnifiedMCPRegistry();
    const server = registry.register(sampleOfficialServer, 'official');

    assert(server.id === 'test-server', 'ID should be extracted from name');
    assert(server.schemaFormat === 'official', 'Schema format should be official');
    assert(server.displayName === 'Test Server', 'Display name should match title');
  });

  await test('Register server (MCPB format)', () => {
    const registry = new UnifiedMCPRegistry();
    const server = registry.register(sampleMCPBManifest, 'mcpb');

    assert(server.id === 'mcpb-test-server', 'ID should match manifest name');
    assert(server.schemaFormat === 'mcpb', 'Schema format should be mcpb');
    assert(server.displayName === 'MCPB Test Server', 'Display name should match');
    assert(server.transport === 'stdio', 'Transport should be stdio for MCPB');
  });

  await test('Get server by ID', () => {
    const registry = new UnifiedMCPRegistry();
    registry.register({ id: 'get-test', name: 'get-test', displayName: 'Get Test', version: '1.0.0', description: 'Test' });

    const server = registry.get('get-test');
    assert(server !== null, 'Server should be found');
    assert(server!.id === 'get-test', 'Server ID should match');
  });

  await test('Update server', () => {
    const registry = new UnifiedMCPRegistry();
    registry.register({ id: 'update-test', name: 'update-test', displayName: 'Before', version: '1.0.0', description: 'Test' });

    const updated = registry.update('update-test', { displayName: 'After', version: '2.0.0' });
    assert(updated !== null, 'Update should succeed');
    assert(updated!.displayName === 'After', 'Display name should be updated');
    assert(updated!.version === '2.0.0', 'Version should be updated');
    assert(updated!.id === 'update-test', 'ID should not change');
  });

  await test('Remove server', () => {
    const registry = new UnifiedMCPRegistry();
    registry.register({ id: 'remove-test', name: 'remove-test', displayName: 'Remove Test', version: '1.0.0', description: 'Test' });

    const removed = registry.remove('remove-test');
    assert(removed === true, 'Remove should succeed');

    const server = registry.get('remove-test');
    assert(server === null, 'Server should not exist after removal');
  });

  // ============================================================================
  // List and Pagination
  // ============================================================================

  console.log('\n3. List and Pagination');

  await test('List all servers', () => {
    const registry = new UnifiedMCPRegistry();
    registry.register({ id: 's1', name: 's1', displayName: 'Server 1', version: '1.0.0', description: 'Test 1', category: 'cat1' });
    registry.register({ id: 's2', name: 's2', displayName: 'Server 2', version: '1.0.0', description: 'Test 2', category: 'cat2' });
    registry.register({ id: 's3', name: 's3', displayName: 'Server 3', version: '1.0.0', description: 'Test 3', category: 'cat1' });

    const result = registry.list();
    assert(result.servers.length === 3, 'Should return all servers');
    assert(result.total === 3, 'Total should be 3');
  });

  await test('Filter by category', () => {
    const registry = new UnifiedMCPRegistry();
    registry.register({ id: 's1', name: 's1', displayName: 'Server 1', version: '1.0.0', description: 'Test 1', category: 'blockchain' });
    registry.register({ id: 's2', name: 's2', displayName: 'Server 2', version: '1.0.0', description: 'Test 2', category: 'markets' });
    registry.register({ id: 's3', name: 's3', displayName: 'Server 3', version: '1.0.0', description: 'Test 3', category: 'blockchain' });

    const result = registry.list({ category: 'blockchain' });
    assert(result.servers.length === 2, 'Should return 2 blockchain servers');
  });

  await test('Filter by tags', () => {
    const registry = new UnifiedMCPRegistry();
    registry.register({ id: 's1', name: 's1', displayName: 'Server 1', version: '1.0.0', description: 'Test 1', tags: ['solana', 'defi'] });
    registry.register({ id: 's2', name: 's2', displayName: 'Server 2', version: '1.0.0', description: 'Test 2', tags: ['ethereum'] });

    const result = registry.list({ tags: ['solana'] });
    assert(result.servers.length === 1, 'Should return 1 server with solana tag');
  });

  await test('Search servers', () => {
    const registry = new UnifiedMCPRegistry();
    registry.register({ id: 's1', name: 's1', displayName: 'Blockchain Explorer', version: '1.0.0', description: 'Explore blockchain' });
    registry.register({ id: 's2', name: 's2', displayName: 'Market Data', version: '1.0.0', description: 'Get market data' });

    const result = registry.list({ search: 'blockchain' });
    assert(result.servers.length === 1, 'Should find 1 server matching blockchain');
  });

  await test('Pagination', () => {
    const registry = new UnifiedMCPRegistry();
    for (let i = 1; i <= 25; i++) {
      registry.register({ id: `s${i}`, name: `s${i}`, displayName: `Server ${i}`, version: '1.0.0', description: `Test ${i}` });
    }

    const page1 = registry.list({ page: 1, pageSize: 10 });
    assert(page1.servers.length === 10, 'Page 1 should have 10 servers');
    assert(page1.hasMore === true, 'Should have more pages');

    const page2 = registry.list({ page: 2, pageSize: 10 });
    assert(page2.servers.length === 10, 'Page 2 should have 10 servers');

    const page3 = registry.list({ page: 3, pageSize: 10 });
    assert(page3.servers.length === 5, 'Page 3 should have 5 servers');
    assert(page3.hasMore === false, 'Should not have more pages');
  });

  // ============================================================================
  // Tool Management
  // ============================================================================

  console.log('\n4. Tool Management');

  await test('Register tools', () => {
    const registry = new UnifiedMCPRegistry();
    registry.register({ id: 'tool-test', name: 'tool-test', displayName: 'Tool Test', version: '1.0.0', description: 'Test' });
    registry.registerTools('tool-test', [
      { name: 'get_data', description: 'Get data', inputSchema: { type: 'object', properties: {} } },
      { name: 'set_data', description: 'Set data', inputSchema: { type: 'object', properties: {} } },
    ]);

    const tools = registry.getAllTools();
    assert(tools.length === 2, 'Should have 2 tools');
  });

  await test('Find tool by name', () => {
    const registry = new UnifiedMCPRegistry();
    registry.register({ id: 'find-test', name: 'find-test', displayName: 'Find Test', version: '1.0.0', description: 'Test' });
    registry.registerTools('find-test', [
      { name: 'my_tool', description: 'My tool', inputSchema: { type: 'object', properties: {} } },
    ]);

    const byName = registry.findTool('my_tool');
    const byQualified = registry.findTool('find-test:my_tool');

    assert(byName !== null, 'Should find by simple name');
    assert(byQualified !== null, 'Should find by qualified name');
    assert(byName!.qualifiedName === 'find-test:my_tool', 'Qualified name should match');
  });

  // ============================================================================
  // Schema Conversion
  // ============================================================================

  console.log('\n5. Schema Conversion');

  await test('Convert to Official format', () => {
    const registry = new UnifiedMCPRegistry();
    const server = registry.register({
      id: 'convert-official',
      name: 'convert-official',
      displayName: 'Convert Official',
      version: '1.0.0',
      description: 'Test conversion',
      baseUrl: 'https://test.com',
      tags: ['test'],
      category: 'testing',
    });

    const official = registry.toOfficialFormat(server);
    assert(official.$schema === SCHEMA_VERSIONS.OFFICIAL, 'Should have official schema');
    assert(official.name.includes('/'), 'Name should be in reverse-DNS format');
    assert(official.remotes?.[0]?.url === 'https://test.com', 'URL should be preserved');
  });

  await test('Convert to MCPB format', () => {
    const registry = new UnifiedMCPRegistry();
    const server = registry.register({
      id: 'convert-mcpb',
      name: 'convert-mcpb',
      displayName: 'Convert MCPB',
      version: '2.0.0',
      description: 'Test MCPB conversion',
      author: { name: 'Test Author' },
    });

    const mcpb = registry.toMCPBFormat(server);
    assert(mcpb.manifest_version === '0.3', 'Should have MCPB manifest version');
    assert(mcpb.author.name === 'Test Author', 'Author should be preserved');
    assert(mcpb.server.type === 'node', 'Server type should be node');
  });

  // ============================================================================
  // Export/Import
  // ============================================================================

  console.log('\n6. Export/Import');

  await test('Export in unified format', () => {
    const registry = new UnifiedMCPRegistry();
    registry.register({ id: 'exp1', name: 'exp1', displayName: 'Export 1', version: '1.0.0', description: 'Test' });
    registry.register({ id: 'exp2', name: 'exp2', displayName: 'Export 2', version: '1.0.0', description: 'Test' });

    const exported = registry.export('unified');
    assert(exported.length === 2, 'Should export 2 servers');
    assert(exported[0].id === 'exp1', 'First server ID should match');
  });

  await test('Export in official format', () => {
    const registry = new UnifiedMCPRegistry();
    registry.register({ id: 'exp-off', name: 'exp-off', displayName: 'Export Official', version: '1.0.0', description: 'Test' });

    const exported = registry.export('official');
    assert(exported.length === 1, 'Should export 1 server');
    assert(exported[0].$schema === SCHEMA_VERSIONS.OFFICIAL, 'Should have official schema');
  });

  await test('Import servers', () => {
    const registry = new UnifiedMCPRegistry();
    const count = registry.import([
      { id: 'imp1', name: 'imp1', displayName: 'Import 1', version: '1.0.0', description: 'Test' },
      { id: 'imp2', name: 'imp2', displayName: 'Import 2', version: '1.0.0', description: 'Test' },
    ], 'unified');

    assert(count === 2, 'Should import 2 servers');
    assert(registry.get('imp1') !== null, 'First server should exist');
    assert(registry.get('imp2') !== null, 'Second server should exist');
  });

  // ============================================================================
  // Event System
  // ============================================================================

  console.log('\n7. Event System');

  await test('Server registration event', async () => {
    const registry = new UnifiedMCPRegistry();
    let eventReceived = false;

    registry.on('server:registered', (event) => {
      eventReceived = true;
      assert(event.data.id === 'event-test', 'Event should contain server data');
    });

    registry.register({ id: 'event-test', name: 'event-test', displayName: 'Event Test', version: '1.0.0', description: 'Test' });
    assert(eventReceived, 'Registration event should be emitted');
  });

  await test('Server removal event', async () => {
    const registry = new UnifiedMCPRegistry();
    let eventReceived = false;

    registry.on('server:removed', () => {
      eventReceived = true;
    });

    registry.register({ id: 'remove-event', name: 'remove-event', displayName: 'Remove Event', version: '1.0.0', description: 'Test' });
    registry.remove('remove-event');
    assert(eventReceived, 'Removal event should be emitted');
  });

  // ============================================================================
  // Statistics
  // ============================================================================

  console.log('\n8. Statistics');

  await test('Get registry stats', () => {
    const registry = new UnifiedMCPRegistry();
    registry.register({ id: 'stat1', name: 'stat1', displayName: 'Stat 1', version: '1.0.0', description: 'Test', category: 'blockchain', status: 'online' });
    registry.register({ id: 'stat2', name: 'stat2', displayName: 'Stat 2', version: '1.0.0', description: 'Test', category: 'markets', status: 'online' });
    registry.registerTools('stat1', [
      { name: 't1', description: 'Tool 1', inputSchema: { type: 'object', properties: {} } },
      { name: 't2', description: 'Tool 2', inputSchema: { type: 'object', properties: {} } },
    ]);

    const stats = registry.getStats();
    assert(stats.serverCount === 2, 'Should count 2 servers');
    assert(stats.totalTools === 2, 'Should count 2 tools');
    assert(stats.toolsByCategory.blockchain === 2, 'Should have 2 tools in blockchain');
    assert(stats.cacheStats !== undefined, 'Should have cache stats');
  });

  // ============================================================================
  // Results
  // ============================================================================

  console.log('\n' + '='.repeat(60));
  console.log(`\nResults: ${passed} passed, ${failed} failed (${passed + failed} total)`);

  if (failed === 0) {
    console.log('\n[SUCCESS] All unified registry tests passed!');
  } else {
    console.log(`\n[ERROR] ${failed} test(s) failed`);
    process.exit(1);
  }
}

runTests().catch(console.error);
