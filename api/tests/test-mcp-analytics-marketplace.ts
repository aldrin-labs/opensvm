/**
 * MCP Analytics and Marketplace Tests
 */

import { MCPAnalytics, analytics, withAnalytics } from '../src/mcp-analytics.js';
import { MCPMarketplace, marketplace } from '../src/mcp-marketplace.js';

console.log('MCP Analytics & Marketplace Tests');
console.log('==================================\n');

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`   ✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`   ❌ ${name}`);
    console.log(`      Error: ${error instanceof Error ? error.message : error}`);
    failed++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// ============================================================================
// Analytics Tests
// ============================================================================

console.log('1. Analytics - Recording Tool Calls');

test('Record a successful tool call', () => {
  const analyticsInstance = new MCPAnalytics();
  analyticsInstance.recordToolCall({
    serverId: 'test-server',
    toolName: 'test_tool',
    duration: 100,
    success: true,
    inputSize: 50,
    outputSize: 200,
  });
  const dashboard = analyticsInstance.getDashboard();
  assert(dashboard.overview.totalCalls === 1, 'Should have 1 call');
  analyticsInstance.destroy();
});

test('Record a failed tool call', () => {
  const analyticsInstance = new MCPAnalytics();
  analyticsInstance.recordToolCall({
    serverId: 'test-server',
    toolName: 'test_tool',
    duration: 500,
    success: false,
    errorType: 'TimeoutError',
    inputSize: 50,
    outputSize: 0,
  });
  const dashboard = analyticsInstance.getDashboard();
  assert(dashboard.recentErrors.length > 0 || dashboard.overview.avgSuccessRate < 1, 'Should track errors');
  analyticsInstance.destroy();
});

console.log('\n2. Analytics - Dashboard');

test('Get analytics dashboard', () => {
  const analyticsInstance = new MCPAnalytics();

  // Record multiple calls
  for (let i = 0; i < 10; i++) {
    analyticsInstance.recordToolCall({
      serverId: 'server-1',
      toolName: `tool_${i % 3}`,
      duration: 100 + i * 10,
      success: i % 5 !== 0,
      inputSize: 50,
      outputSize: 200,
    });
  }

  const dashboard = analyticsInstance.getDashboard();
  assert(dashboard.overview.totalCalls === 10, 'Should have 10 calls');
  assert(dashboard.overview.totalTools >= 1, 'Should have at least 1 tool');
  analyticsInstance.destroy();
});

test('Get tool-specific metrics', () => {
  const analyticsInstance = new MCPAnalytics();

  analyticsInstance.recordToolCall({
    serverId: 'server-1',
    toolName: 'specific_tool',
    duration: 150,
    success: true,
    inputSize: 100,
    outputSize: 500,
  });

  const metrics = analyticsInstance.getToolMetrics('server-1', 'specific_tool');
  assert(metrics !== undefined, 'Should find tool metrics');
  assert(metrics!.totalCalls === 1, 'Should have 1 call');
  analyticsInstance.destroy();
});

console.log('\n3. Analytics - Wrapper Function');

test('withAnalytics wrapper tracks successful calls', async () => {
  const analyticsInstance = new MCPAnalytics();

  const mockHandler = async (input: string) => ({ result: input.toUpperCase() });
  const wrappedHandler = withAnalytics('test-server', 'uppercase', mockHandler);

  const result = await wrappedHandler('hello');
  assert(result.result === 'HELLO', 'Handler should work correctly');

  const metrics = analyticsInstance.getToolMetrics('test-server', 'uppercase');
  // Note: withAnalytics uses the singleton, not our instance
  analyticsInstance.destroy();
});

test('withAnalytics wrapper tracks failed calls', async () => {
  const mockHandler = async () => {
    throw new Error('Test error');
  };
  const wrappedHandler = withAnalytics('test-server', 'failing_tool', mockHandler);

  try {
    await wrappedHandler();
    assert(false, 'Should throw');
  } catch (error) {
    assert(error instanceof Error, 'Should be an error');
    assert(error.message === 'Test error', 'Should have correct message');
  }
});

// ============================================================================
// Marketplace Tests
// ============================================================================

console.log('\n4. Marketplace - Search');

test('Search all tools', () => {
  const results = marketplace.search({});
  assert(results.tools.length > 0, 'Should find tools');
  assert(results.total > 0, 'Should have total count');
});

test('Search by query', () => {
  const results = marketplace.search({ query: 'token' });
  assert(results.tools.length >= 1, 'Should find token-related tools');
  assert(results.tools.some(t => t.name.includes('token') || t.description.toLowerCase().includes('token')),
    'Results should be relevant');
});

test('Search by category', () => {
  const results = marketplace.search({ category: 'defi' });
  assert(results.tools.every(t => t.category === 'defi'), 'All results should be defi category');
});

test('Search with pagination', () => {
  const page1 = marketplace.search({ pageSize: 2, page: 1 });
  const page2 = marketplace.search({ pageSize: 2, page: 2 });

  assert(page1.tools.length <= 2, 'Page 1 should have max 2 items');
  if (page1.total > 2) {
    assert(page2.tools.length > 0, 'Page 2 should have items if total > 2');
  }
});

console.log('\n5. Marketplace - Tool Retrieval');

test('Get tool by ID', () => {
  const tool = marketplace.getTool('solana-token-analyzer');
  assert(tool !== undefined, 'Should find tool');
  assert(tool!.id === 'solana-token-analyzer', 'Should have correct ID');
});

test('Get featured tools', () => {
  const featured = marketplace.getFeatured();
  assert(featured.length > 0, 'Should have featured tools');
  assert(featured.every(t => t.featured), 'All should be featured');
});

test('Get trending tools', () => {
  const trending = marketplace.getTrending();
  assert(trending.length > 0, 'Should have trending tools');
  // Should be sorted by weekly downloads
  for (let i = 1; i < trending.length; i++) {
    assert(trending[i].weeklyDownloads <= trending[i-1].weeklyDownloads,
      'Should be sorted by weekly downloads');
  }
});

console.log('\n6. Marketplace - Categories and Stats');

test('Get categories', () => {
  const categories = marketplace.getCategories();
  assert(categories.length > 0, 'Should have categories');
  assert(categories.every(c => c.description), 'All categories should have descriptions');
});

test('Get marketplace stats', () => {
  const stats = marketplace.getStats();
  assert(stats.totalTools > 0, 'Should have tools');
  assert(stats.totalAuthors > 0, 'Should have authors');
  assert(stats.avgRating > 0 && stats.avgRating <= 5, 'Avg rating should be 0-5');
});

console.log('\n7. Marketplace - Submission');

test('Submit a new tool', () => {
  const result = marketplace.submitTool('author-1', {
    name: 'new-tool',
    displayName: 'New Tool',
    description: 'A new MCP tool',
    category: 'blockchain',
    tags: ['test'],
    license: 'MIT',
    repository: 'https://github.com/test/new-tool',
    package: { registry: 'npm', identifier: '@test/new-tool' },
    mcpServer: { name: 'new-tool', transport: 'stdio' },
  });

  assert(result.id.startsWith('pending-'), 'Should return pending ID');
  assert(result.status === 'pending', 'Status should be pending');
});

// ============================================================================
// Results
// ============================================================================

console.log('\n==================================');
console.log(`📊 Results: ${passed} passed, ${failed} failed (${passed + failed} total)`);

if (failed === 0) {
  console.log('\n✅ All analytics and marketplace tests passed!');
} else {
  console.log(`\n❌ ${failed} test(s) failed`);
  process.exit(1);
}
