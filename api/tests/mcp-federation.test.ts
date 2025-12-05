/**
 * MCP Federation Network Tests
 *
 * Integration tests for:
 * - Server registration and discovery
 * - Trust calculation and decay
 * - Tool forwarding
 * - Gossip protocol
 * - Health monitoring
 */

// Jest test - no explicit imports needed
import {
  FederationNetwork,
  TrustCalculator,
  FederatedServer,
  FederatedTool,
  TrustMetrics,
  createFederationNetwork,
  createFederationHandler,
} from '../src/mcp-federation';

console.log('Running MCP Federation Tests...');
console.log('============================================================');

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockServer(overrides: Partial<FederatedServer> = {}): FederatedServer {
  const id = `srv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    name: `Test Server ${id.slice(-4)}`,
    description: 'A test MCP server',
    endpoint: `http://localhost:${3000 + Math.floor(Math.random() * 1000)}`,
    mcpVersion: '1.0.0',
    owner: 'test_wallet_' + Math.random().toString(36).slice(2, 8),
    tools: [
      {
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: { type: 'object', properties: { input: { type: 'string' } } },
        category: 'testing',
      },
    ],
    capabilities: {
      streaming: true,
      batching: true,
      webhooks: false,
      customAuth: false,
      maxConcurrentRequests: 10,
      supportedAuthMethods: ['bearer'],
    },
    trustScore: 50,
    registeredAt: Date.now(),
    lastSeenAt: Date.now(),
    metadata: {
      version: '1.0.0',
      region: 'us-east',
      tags: ['test'],
      revenueSharePercent: 70,
      minTrustRequired: 0,
    },
    ...overrides,
  };
}

function createMockTool(overrides: Partial<FederatedTool> = {}): FederatedTool {
  return {
    name: 'mock_tool',
    description: 'A mock tool for testing',
    inputSchema: { type: 'object', properties: {} },
    category: 'testing',
    ...overrides,
  };
}

function createMockMetrics(overrides: Partial<TrustMetrics> = {}): TrustMetrics {
  return {
    uptime: 99,
    avgResponseTimeMs: 150,
    successRate: 98,
    totalRequests: 1000,
    totalErrors: 20,
    qualityScore: 85,
    reportCount: 0,
    verifiedOwner: false,
    auditedCode: false,
    ...overrides,
  };
}

// ============================================================================
// Trust Calculator Tests
// ============================================================================

describe('Trust Calculator', () => {
  it('should calculate trust score from metrics', () => {
    const metrics = createMockMetrics();
    const score = TrustCalculator.calculate(metrics);

    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('should give higher scores to better metrics', () => {
    const goodMetrics = createMockMetrics({
      uptime: 100,
      avgResponseTimeMs: 50,
      successRate: 100,
      qualityScore: 100,
      totalRequests: 10000,
    });

    const badMetrics = createMockMetrics({
      uptime: 50,
      avgResponseTimeMs: 500,
      successRate: 70,
      qualityScore: 40,
      totalRequests: 10,
    });

    const goodScore = TrustCalculator.calculate(goodMetrics);
    const badScore = TrustCalculator.calculate(badMetrics);

    expect(goodScore).toBeGreaterThan(badScore);
  });

  it('should boost score for verified owners', () => {
    const unverified = createMockMetrics({ verifiedOwner: false });
    const verified = createMockMetrics({ verifiedOwner: true });

    const unverifiedScore = TrustCalculator.calculate(unverified);
    const verifiedScore = TrustCalculator.calculate(verified);

    expect(verifiedScore).toBeGreaterThan(unverifiedScore);
  });

  it('should boost score for audited code', () => {
    const unaudited = createMockMetrics({ auditedCode: false });
    const audited = createMockMetrics({ auditedCode: true });

    const unauditedScore = TrustCalculator.calculate(unaudited);
    const auditedScore = TrustCalculator.calculate(audited);

    expect(auditedScore).toBeGreaterThan(unauditedScore);
  });

  it('should penalize abuse reports', () => {
    const clean = createMockMetrics({ reportCount: 0 });
    const reported = createMockMetrics({ reportCount: 3 });

    const cleanScore = TrustCalculator.calculate(clean);
    const reportedScore = TrustCalculator.calculate(reported);

    expect(cleanScore).toBeGreaterThan(reportedScore);
  });

  it('should apply decay over time', () => {
    const currentScore = 80;
    const decayRate = 0.99;

    const after1Day = TrustCalculator.applyDecay(currentScore, 1, decayRate);
    const after7Days = TrustCalculator.applyDecay(currentScore, 7, decayRate);
    const after30Days = TrustCalculator.applyDecay(currentScore, 30, decayRate);

    expect(after1Day).toBeLessThan(currentScore);
    expect(after7Days).toBeLessThan(after1Day);
    expect(after30Days).toBeLessThan(after7Days);
  });

  it('should cap scores at 0-100', () => {
    const extremeGood = createMockMetrics({
      uptime: 100,
      avgResponseTimeMs: 1,
      successRate: 100,
      qualityScore: 100,
      totalRequests: 1000000,
      verifiedOwner: true,
      auditedCode: true,
    });

    const extremeBad = createMockMetrics({
      uptime: 0,
      avgResponseTimeMs: 10000,
      successRate: 0,
      qualityScore: 0,
      totalRequests: 0,
      reportCount: 10,
    });

    const goodScore = TrustCalculator.calculate(extremeGood);
    const badScore = TrustCalculator.calculate(extremeBad);

    expect(goodScore).toBeLessThanOrEqual(100);
    expect(badScore).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// Federation Network - Server Registration Tests
// ============================================================================

describe('Federation Network - Server Registration', () => {
  let network: FederationNetwork;

  beforeEach(() => {
    network = createFederationNetwork({
      discoveryEnabled: false,
      announceEnabled: false,
      healthCheckIntervalMs: 100000, // Don't run during tests
      gossipIntervalMs: 100000,
    });
  });

  afterEach(() => {
    network.stop();
  });

  it('should register a new server', async () => {
    const server = createMockServer();
    // Mock the ping to return true
    const originalPing = (network as any).pingServer;
    (network as any).pingServer = async () => true;

    const result = await network.registerServer(server);

    expect(result.success).toBe(true);
    expect(result.serverId).toBe(server.id);

    (network as any).pingServer = originalPing;
  });

  it('should reject server without endpoint', async () => {
    const server = createMockServer({ endpoint: '' });

    await expect(network.registerServer(server)).rejects.toThrow('Invalid server');
  });

  it('should reject server without owner', async () => {
    const server = createMockServer({ owner: '' });

    await expect(network.registerServer(server)).rejects.toThrow('Invalid server');
  });

  it('should reject server without tools', async () => {
    const server = createMockServer({ tools: [] });

    await expect(network.registerServer(server)).rejects.toThrow('Invalid server');
  });

  it('should get server by ID', async () => {
    const server = createMockServer();
    (network as any).pingServer = async () => true;

    await network.registerServer(server);
    const retrieved = network.getServer(server.id);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(server.id);
    expect(retrieved?.name).toBe(server.name);
  });

  it('should return null for non-existent server', () => {
    const retrieved = network.getServer('non_existent_id');
    expect(retrieved).toBeNull();
  });

  it('should assign starting trust score to new servers', async () => {
    const server = createMockServer();
    (network as any).pingServer = async () => true;

    await network.registerServer(server);
    const retrieved = network.getServer(server.id);

    expect(retrieved?.trustScore).toBe(30); // Default newServerTrust
  });
});

// ============================================================================
// Federation Network - Server Listing Tests
// ============================================================================

describe('Federation Network - Server Listing', () => {
  let network: FederationNetwork;

  beforeEach(async () => {
    network = createFederationNetwork({
      discoveryEnabled: false,
      announceEnabled: false,
      healthCheckIntervalMs: 100000,
      gossipIntervalMs: 100000,
      minTrustScore: 10,
    });
    (network as any).pingServer = async () => true;

    // Register multiple servers
    await network.registerServer(createMockServer({
      id: 'server1',
      name: 'Server 1',
      tools: [createMockTool({ name: 'tool_a', category: 'analytics' })],
    }));
    await network.registerServer(createMockServer({
      id: 'server2',
      name: 'Server 2',
      tools: [createMockTool({ name: 'tool_b', category: 'trading' })],
    }));
    await network.registerServer(createMockServer({
      id: 'server3',
      name: 'Server 3',
      tools: [
        createMockTool({ name: 'tool_a', category: 'analytics' }),
        createMockTool({ name: 'tool_c', category: 'analytics' }),
      ],
    }));
  });

  afterEach(() => {
    network.stop();
  });

  it('should list all servers', () => {
    const servers = network.listServers();
    expect(servers.length).toBe(3);
  });

  it('should filter by minimum trust', () => {
    // Set one server's trust below threshold
    const server1 = network.getServer('server1');
    if (server1) server1.trustScore = 5;

    const servers = network.listServers({ minTrust: 10 });
    expect(servers.length).toBe(2);
  });

  it('should filter by category', () => {
    const servers = network.listServers({ category: 'analytics' });
    expect(servers.length).toBe(2); // server1 and server3
  });

  it('should filter by required tools', () => {
    const servers = network.listServers({ hasTools: ['tool_a'] });
    expect(servers.length).toBe(2);

    const servers2 = network.listServers({ hasTools: ['tool_a', 'tool_c'] });
    expect(servers2.length).toBe(1);
  });

  it('should limit results', () => {
    const servers = network.listServers({ limit: 2 });
    expect(servers.length).toBe(2);
  });

  it('should sort by trust score descending', () => {
    const server1 = network.getServer('server1');
    const server2 = network.getServer('server2');
    const server3 = network.getServer('server3');

    if (server1) server1.trustScore = 80;
    if (server2) server2.trustScore = 60;
    if (server3) server3.trustScore = 90;

    const servers = network.listServers();
    expect(servers[0].id).toBe('server3');
    expect(servers[1].id).toBe('server1');
    expect(servers[2].id).toBe('server2');
  });
});

// ============================================================================
// Federation Network - Tool Search Tests
// ============================================================================

describe('Federation Network - Tool Search', () => {
  let network: FederationNetwork;

  beforeEach(async () => {
    network = createFederationNetwork({
      discoveryEnabled: false,
      announceEnabled: false,
      healthCheckIntervalMs: 100000,
      gossipIntervalMs: 100000,
    });
    (network as any).pingServer = async () => true;

    await network.registerServer(createMockServer({
      id: 'server1',
      tools: [
        createMockTool({ name: 'get_balance', description: 'Get wallet balance', category: 'wallet' }),
        createMockTool({ name: 'transfer_sol', description: 'Transfer SOL tokens', category: 'wallet' }),
      ],
    }));
    await network.registerServer(createMockServer({
      id: 'server2',
      tools: [
        createMockTool({ name: 'analyze_transaction', description: 'Analyze a transaction', category: 'analytics' }),
        createMockTool({ name: 'get_price', description: 'Get token price', category: 'trading' }),
      ],
    }));
  });

  afterEach(() => {
    network.stop();
  });

  it('should search tools by name', () => {
    const results = network.searchTools('balance');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].tool.name).toBe('get_balance');
  });

  it('should search tools by description', () => {
    const results = network.searchTools('transaction');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].tool.name).toBe('analyze_transaction');
  });

  it('should filter by category', () => {
    // Search with category filter - results include all wallet tools, sorted by relevance
    const results = network.searchTools('balance', { category: 'wallet' });
    expect(results.length).toBeGreaterThan(0);
    // The top result should match the query best
    expect(results[0].tool.name).toBe('get_balance');
  });

  it('should limit search results', () => {
    const results = network.searchTools('', { limit: 2 });
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('should sort by relevance score', () => {
    const results = network.searchTools('get');
    // Scores should be descending
    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
    }
  });

  it('should boost results by server trust score', () => {
    const server1 = network.getServer('server1');
    const server2 = network.getServer('server2');

    if (server1) server1.trustScore = 90;
    if (server2) server2.trustScore = 30;

    const results = network.searchTools('get');
    // Server1's tool should rank higher
    const server1Result = results.find(r => r.server.id === 'server1');
    const server2Result = results.find(r => r.server.id === 'server2');

    if (server1Result && server2Result) {
      expect(server1Result.score).toBeGreaterThan(server2Result.score);
    }
  });
});

// ============================================================================
// Federation Network - Trust Management Tests
// ============================================================================

describe('Federation Network - Trust Management', () => {
  let network: FederationNetwork;

  beforeEach(async () => {
    network = createFederationNetwork({
      discoveryEnabled: false,
      announceEnabled: false,
      healthCheckIntervalMs: 100000,
      gossipIntervalMs: 100000,
    });
    (network as any).pingServer = async () => true;

    await network.registerServer(createMockServer({ id: 'test_server' }));
  });

  afterEach(() => {
    network.stop();
  });

  it('should get trust metrics for a server', () => {
    const metrics = network.getTrustMetrics('test_server');

    expect(metrics).not.toBeNull();
    expect(metrics?.uptime).toBe(100);
    expect(metrics?.successRate).toBe(100);
    expect(metrics?.totalRequests).toBe(0);
  });

  it('should return null for non-existent server metrics', () => {
    const metrics = network.getTrustMetrics('non_existent');
    expect(metrics).toBeNull();
  });

  it('should record reports and increase report count', async () => {
    const initialMetrics = network.getTrustMetrics('test_server');
    const initialReportCount = initialMetrics?.reportCount || 0;

    await network.reportServer('test_server', 'Spam responses');

    const metrics = network.getTrustMetrics('test_server');
    expect(metrics?.reportCount).toBe(initialReportCount + 1);
    // Trust recalculation happens - report penalty is applied
    // The exact score depends on other metrics, but reportCount should increase
  });

  it('should verify owner and increase trust', async () => {
    const initialServer = network.getServer('test_server');
    const initialTrust = initialServer?.trustScore || 0;

    await network.verifyOwner('test_server', 'mock_signature');

    const metrics = network.getTrustMetrics('test_server');
    expect(metrics?.verifiedOwner).toBe(true);

    const updatedServer = network.getServer('test_server');
    expect(updatedServer?.trustScore).toBeGreaterThan(initialTrust);
  });
});

// ============================================================================
// Federation Network - Statistics Tests
// ============================================================================

describe('Federation Network - Statistics', () => {
  let network: FederationNetwork;

  beforeEach(async () => {
    network = createFederationNetwork({
      networkId: 'test-network',
      discoveryEnabled: false,
      announceEnabled: false,
      healthCheckIntervalMs: 100000,
      gossipIntervalMs: 100000,
    });
    (network as any).pingServer = async () => true;

    await network.registerServer(createMockServer({
      id: 'server1',
      tools: [createMockTool(), createMockTool({ name: 'tool2' })],
    }));
    await network.registerServer(createMockServer({
      id: 'server2',
      tools: [createMockTool()],
    }));
  });

  afterEach(() => {
    network.stop();
  });

  it('should return network statistics', () => {
    const stats = network.getNetworkStats();

    expect(stats.networkId).toBe('test-network');
    expect(stats.totalServers).toBe(2);
    expect(stats.totalTools).toBe(3);
    expect(stats.totalPeers).toBe(0);
    expect(stats.averageTrust).toBe(30); // Default new server trust
  });
});

// ============================================================================
// Federation Handler Tests
// ============================================================================

describe('Federation Handler', () => {
  let network: FederationNetwork;
  let handler: ReturnType<typeof createFederationHandler>;
  let thisServer: FederatedServer;

  beforeEach(async () => {
    network = createFederationNetwork({
      discoveryEnabled: false,
      announceEnabled: false,
      healthCheckIntervalMs: 100000,
      gossipIntervalMs: 100000,
    });
    (network as any).pingServer = async () => true;

    thisServer = createMockServer({ id: 'this_server', name: 'This Server' });
    handler = createFederationHandler(network, thisServer);

    await network.registerServer(createMockServer({ id: 'other_server' }));
  });

  afterEach(() => {
    network.stop();
  });

  it('should return server info', () => {
    const info = handler.info();
    expect(info.id).toBe('this_server');
    expect(info.name).toBe('This Server');
  });

  it('should list servers', () => {
    const servers = handler.servers({});
    expect(servers.length).toBe(1);
  });

  it('should search tools', () => {
    const results = handler.searchTools({ q: 'test' });
    expect(Array.isArray(results)).toBe(true);
  });

  it('should register new server', async () => {
    const newServer = createMockServer({ id: 'new_server' });
    const result = await handler.register(newServer);

    expect(result.success).toBe(true);
    expect(result.serverId).toBe('new_server');
  });

  it('should exchange server lists in gossip', () => {
    const result = handler.gossip({ servers: [] });

    expect(result.servers).toBeDefined();
    expect(Array.isArray(result.servers)).toBe(true);
  });

  it('should receive messages', async () => {
    const result = await handler.message({
      type: 'ping',
      senderId: 'other',
      timestamp: Date.now(),
      payload: {},
    });

    expect(result.received).toBe(true);
  });

  it('should return statistics', () => {
    const stats = handler.stats();

    expect(stats.totalServers).toBeGreaterThan(0);
    expect(stats.networkId).toBeDefined();
  });

  it('should accept abuse reports', async () => {
    const result = await handler.report({
      serverId: 'other_server',
      reason: 'Test report',
    });

    expect(result.reported).toBe(true);
  });
});

// ============================================================================
// Tool Forwarding Tests
// ============================================================================

describe('Federation Network - Tool Forwarding', () => {
  let network: FederationNetwork;

  beforeEach(async () => {
    network = createFederationNetwork({
      discoveryEnabled: false,
      announceEnabled: false,
      healthCheckIntervalMs: 100000,
      gossipIntervalMs: 100000,
      minTrustScore: 10,
    });
    (network as any).pingServer = async () => true;

    await network.registerServer(createMockServer({
      id: 'tool_server',
      tools: [createMockTool({ name: 'remote_tool' })],
    }));

    // Set trust high enough
    const server = network.getServer('tool_server');
    if (server) server.trustScore = 50;
  });

  afterEach(() => {
    network.stop();
  });

  it('should reject calls to non-existent servers', async () => {
    const result = await network.callTool({
      serverId: 'non_existent',
      tool: 'some_tool',
      params: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should reject calls to low-trust servers', async () => {
    const server = network.getServer('tool_server');
    if (server) server.trustScore = 5;

    const result = await network.callTool({
      serverId: 'tool_server',
      tool: 'remote_tool',
      params: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('trust score too low');
  });

  it('should fail to find tool when no servers available', async () => {
    // Set all servers to low trust
    const server = network.getServer('tool_server');
    if (server) server.trustScore = 5;

    const result = await network.callToolAuto('remote_tool', {});

    expect(result.success).toBe(false);
    expect(result.error).toContain('No servers found');
  });
});

console.log('============================================================');
console.log('Federation tests complete');
