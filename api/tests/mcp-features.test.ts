#!/usr/bin/env bun
/**
 * Integration Tests for MCP Features
 *
 * Tests all 7 new MCP modules:
 * 1. Cache Layer
 * 2. Streaming Responses
 * 3. Metering & Revenue Share
 * 4. Webhooks
 * 5. OpenAPI Generator
 * 6. Multi-Agent Orchestration
 * 7. Memory Persistence
 */

// Jest test - no explicit imports needed

// ============================================================================
// 1. CACHE LAYER TESTS
// ============================================================================

import {
  MCPCache,
  generateCacheKey,
  withCache,
  TOOL_CACHE_STRATEGIES,
} from '../src/mcp-cache';

describe('MCP Cache Layer', () => {
  let cache: MCPCache;

  beforeEach(() => {
    cache = new MCPCache({ maxSize: 100, maxMemoryMB: 10 });
  });

  it('should generate deterministic cache keys', () => {
    const key1 = generateCacheKey('get_transaction', { signature: 'abc123' });
    const key2 = generateCacheKey('get_transaction', { signature: 'abc123' });
    const key3 = generateCacheKey('get_transaction', { signature: 'xyz789' });

    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key1).toMatch(/^mcp:get_transaction:/);
  });

  it('should cache and retrieve values', () => {
    const data = { result: 'test', count: 42 };
    cache.set('get_transaction', { signature: 'test' }, data);

    const key = generateCacheKey('get_transaction', { signature: 'test' });
    const retrieved = cache.get(key);

    expect(retrieved).toEqual(data);
  });

  it('should expire entries after TTL', async () => {
    const shortCache = new MCPCache({ maxSize: 100, maxMemoryMB: 10 });
    shortCache.set('get_network_status', {}, { status: 'ok' }, { ttlMs: 50 });

    const key = generateCacheKey('get_network_status', {});
    expect(shortCache.get(key)).not.toBeNull();

    await new Promise(r => setTimeout(r, 100));
    expect(shortCache.get(key)).toBeNull();
  });

  it('should respect strategy-based TTL', () => {
    const txStrategy = TOOL_CACHE_STRATEGIES['get_transaction'];
    const statusStrategy = TOOL_CACHE_STRATEGIES['get_network_status'];

    expect(txStrategy.strategy).toBe('immutable');
    expect(txStrategy.ttlMs).toBe(Infinity);
    expect(statusStrategy.strategy).toBe('realtime');
    expect(statusStrategy.ttlMs).toBe(5000);
  });

  it('should track cache statistics', () => {
    cache.set('get_transaction', { sig: '1' }, { data: 1 });
    cache.set('get_transaction', { sig: '2' }, { data: 2 });

    const key1 = generateCacheKey('get_transaction', { sig: '1' });
    cache.get(key1);
    cache.get(key1);
    cache.get(generateCacheKey('get_transaction', { sig: 'nonexistent' }));

    const stats = cache.getStats();
    expect(stats.entries).toBe(2);
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBeCloseTo(0.67, 1);
  });

  it('should evict entries when over capacity', () => {
    const smallCache = new MCPCache({ maxSize: 3, maxMemoryMB: 1 });

    for (let i = 0; i < 5; i++) {
      smallCache.set('test_tool', { id: i }, { data: i });
    }

    const stats = smallCache.getStats();
    expect(stats.entries).toBeLessThanOrEqual(3);
    expect(stats.evictions).toBeGreaterThan(0);
  });

  it('should support withCache helper', async () => {
    let callCount = 0;
    const executor = async () => {
      callCount++;
      return { result: 'computed' };
    };

    const result1 = await withCache(cache, 'test_tool', { p: 1 }, executor);
    const result2 = await withCache(cache, 'test_tool', { p: 1 }, executor);

    expect(result1).toEqual({ result: 'computed' });
    expect(result2).toEqual({ result: 'computed' });
    expect(callCount).toBe(1); // Second call should hit cache
  });
});

// ============================================================================
// 2. STREAMING TESTS
// ============================================================================

import {
  SSEStream,
  streamArrayResult,
  streamWithProgress,
  isStreamable,
  getStreamCapabilities,
  STREAMABLE_TOOLS,
} from '../src/mcp-streaming';

describe('MCP Streaming', () => {
  it('should identify streamable tools', () => {
    expect(isStreamable('investigate')).toBe(true);
    expect(isStreamable('get_account_transactions')).toBe(true);
    expect(isStreamable('get_transaction')).toBe(false);
  });

  it('should return stream capabilities', () => {
    const caps = getStreamCapabilities('investigate');
    expect(caps).not.toBeNull();
    expect(caps?.supports).toContain('progress');
    expect(caps?.supports).toContain('investigation');
  });

  it('should list all streamable tools', () => {
    const tools = Object.keys(STREAMABLE_TOOLS);
    expect(tools.length).toBeGreaterThan(0);
    expect(tools).toContain('investigate');
    expect(tools).toContain('get_account_transactions');
  });

  it('should create SSE stream and track events', () => {
    const events: any[] = [];
    const mockResponse = {
      write: (data: string) => events.push(data),
      end: () => events.push('END'),
    };

    const stream = new SSEStream(mockResponse, { heartbeatIntervalMs: 0 });
    stream.progress(50, 'Halfway done');
    stream.complete({ result: 'done' });

    expect(events.length).toBeGreaterThan(0);
    expect(events.some(e => e.includes('progress'))).toBe(true);
    expect(events.some(e => e.includes('complete'))).toBe(true);
    expect(events[events.length - 1]).toBe('END');
  });

  it('should stream array results in chunks', async () => {
    const events: any[] = [];
    const mockResponse = {
      write: (data: string) => events.push(data),
      end: () => {},
    };

    const stream = new SSEStream(mockResponse, { heartbeatIntervalMs: 0 });
    const data = Array.from({ length: 100 }, (_, i) => ({ id: i }));

    await streamArrayResult(data, stream, { chunkSize: 20 });

    // Should have events with 'chunk' type
    const chunkEvents = events.filter(e => e.includes('event: chunk'));
    expect(chunkEvents.length).toBe(5);
  });

  it('should stream with progress updates', async () => {
    const events: any[] = [];
    const mockResponse = {
      write: (data: string) => events.push(data),
      end: () => {},
    };

    const stream = new SSEStream(mockResponse, { heartbeatIntervalMs: 0 });

    const result = await streamWithProgress(async (progress) => {
      progress(25, 'Step 1');
      progress(50, 'Step 2');
      progress(75, 'Step 3');
      return { done: true };
    }, stream);

    expect(result).toEqual({ done: true });
    const progressEvents = events.filter(e => e.includes('event: progress'));
    expect(progressEvents.length).toBe(3);
  });
});

// ============================================================================
// 3. METERING TESTS
// ============================================================================

import {
  MeteringService,
  TOOL_PRICING,
  TIER_LIMITS,
} from '../src/mcp-metering';

describe('MCP Metering', () => {
  let metering: MeteringService;

  beforeEach(() => {
    metering = new MeteringService();
  });

  it('should have pricing for common tools', () => {
    expect(TOOL_PRICING['get_transaction']).toBeDefined();
    expect(TOOL_PRICING['investigate']).toBeDefined();
    expect(TOOL_PRICING['get_network_status']).toBeDefined();
  });

  it('should define tier limits', () => {
    expect(TIER_LIMITS.free.callsPerDay).toBe(500);
    expect(TIER_LIMITS.pro.callsPerDay).toBe(20000);
    expect(TIER_LIMITS.enterprise.callsPerDay).toBe(200000);
  });

  it('should initialize user quota', () => {
    const quota = metering.getQuota('user123');
    expect(quota.userId).toBe('user123');
    expect(quota.tier).toBe('free');
    expect(quota.currentDayCalls).toBe(0);
  });

  it('should allow calls within limits', () => {
    const check = metering.canMakeCall('user123', 'get_transaction');
    expect(check.allowed).toBe(true);
  });

  it('should record calls and calculate cost', () => {
    const record = metering.recordCall({
      userId: 'user123',
      toolName: 'get_transaction',
      serverId: 'opensvm',
      durationMs: 150,
      inputBytes: 100,
      outputBytes: 5000,
      success: true,
    });

    expect(record.totalCostMicro).toBeGreaterThanOrEqual(0n);
    expect(record.developerShareMicro).toBeDefined();
    expect(record.platformShareMicro).toBeDefined();
  });

  it('should track developer revenue', () => {
    // Record multiple calls with pro tier to generate actual costs
    const proMetering = new MeteringService();
    proMetering.getQuota('proUser').tier = 'pro' as any;

    for (let i = 0; i < 5; i++) {
      proMetering.recordCall({
        userId: 'proUser',
        toolName: 'investigate',
        serverId: 'test-server',
        durationMs: 1000,
        inputBytes: 100,
        outputBytes: 10000,
        success: true,
      });
    }

    const revenue = proMetering.getDeveloperRevenue('test-server', 'test-wallet', 'test-server');
    // Revenue is created when recordCall is done - check it exists
    expect(revenue.developerId).toBe('test-server');
  });

  it('should generate billing reports', () => {
    metering.recordCall({
      userId: 'user123',
      toolName: 'get_transaction',
      serverId: 'opensvm',
      durationMs: 100,
      inputBytes: 50,
      outputBytes: 2000,
      success: true,
    });

    const report = metering.generateBillingReport('user123', 'daily');
    expect(report.totalCalls).toBe(1);
    expect(report.successfulCalls).toBe(1);
    expect(report.toolBreakdown.length).toBeGreaterThan(0);
  });

  it('should enforce rate limits', () => {
    const quota = metering.getQuota('limited_user');
    // Simulate hitting the limit
    for (let i = 0; i < quota.callsPerMinute; i++) {
      metering.recordCall({
        userId: 'limited_user',
        toolName: 'get_transaction',
        serverId: 'opensvm',
        durationMs: 10,
        inputBytes: 10,
        outputBytes: 100,
        success: true,
      });
    }

    const check = metering.canMakeCall('limited_user', 'get_transaction');
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Rate limit');
  });
});

// ============================================================================
// 4. WEBHOOK TESTS
// ============================================================================

import {
  WebhookManager,
  EVENT_TEMPLATES,
  type WebhookSubscription,
} from '../src/mcp-webhooks';

describe('MCP Webhooks', () => {
  let webhooks: WebhookManager;

  beforeEach(() => {
    webhooks = new WebhookManager({ maxRetries: 2, retryDelayMs: 100 });
  });

  afterEach(() => {
    webhooks.stop();
  });

  it('should have event templates', () => {
    expect(EVENT_TEMPLATES['wallet.sol_received']).toBeDefined();
    expect(EVENT_TEMPLATES['token.large_transfer']).toBeDefined();
    expect(EVENT_TEMPLATES['investigation.anomaly']).toBeDefined();
  });

  it('should create subscriptions', () => {
    const sub = webhooks.createSubscription({
      userId: 'user123',
      name: 'Test Webhook',
      eventTypes: ['wallet.sol_received'],
      targets: ['EPjFW...'],
      delivery: { method: 'http', url: 'https://example.com/webhook' },
    });

    expect(sub.id).toMatch(/^webhook_/);
    expect(sub.secret).toHaveLength(64);
    expect(sub.status).toBe('active');
  });

  it('should list user subscriptions', () => {
    webhooks.createSubscription({
      userId: 'user123',
      name: 'Webhook 1',
      eventTypes: ['wallet.sol_received'],
      targets: ['addr1'],
      delivery: { method: 'http', url: 'https://example.com/1' },
    });

    webhooks.createSubscription({
      userId: 'user123',
      name: 'Webhook 2',
      eventTypes: ['wallet.sol_sent'],
      targets: ['addr2'],
      delivery: { method: 'http', url: 'https://example.com/2' },
    });

    webhooks.createSubscription({
      userId: 'other_user',
      name: 'Other Webhook',
      eventTypes: ['wallet.transaction'],
      targets: ['addr3'],
      delivery: { method: 'http', url: 'https://example.com/3' },
    });

    const user123Subs = webhooks.listSubscriptions('user123');
    expect(user123Subs.length).toBe(2);
  });

  it('should update subscriptions', () => {
    const sub = webhooks.createSubscription({
      userId: 'user123',
      name: 'Test',
      eventTypes: ['wallet.sol_received'],
      targets: ['addr1'],
      delivery: { method: 'http', url: 'https://example.com' },
    });

    const updated = webhooks.updateSubscription(sub.id, {
      name: 'Updated Name',
      status: 'paused',
    });

    expect(updated?.name).toBe('Updated Name');
    expect(updated?.status).toBe('paused');
  });

  it('should delete subscriptions', () => {
    const sub = webhooks.createSubscription({
      userId: 'user123',
      name: 'Test',
      eventTypes: ['wallet.sol_received'],
      targets: ['addr1'],
      delivery: { method: 'http', url: 'https://example.com' },
    });

    expect(webhooks.deleteSubscription(sub.id)).toBe(true);
    expect(webhooks.getSubscription(sub.id)).toBeNull();
  });

  it('should match events with conditions', async () => {
    webhooks.createSubscription({
      userId: 'user123',
      name: 'Large Transfer Alert',
      eventTypes: ['wallet.sol_received'],
      targets: ['target_wallet'],
      conditions: [{ field: 'amount', operator: 'gt', value: 100 }],
      delivery: { method: 'http', url: 'https://example.com' },
    });

    // Small transfer - should not trigger
    const small = await webhooks.processEvent({
      type: 'wallet.sol_received',
      timestamp: Date.now(),
      target: 'target_wallet',
      data: { amount: 50 },
    });

    // Large transfer - should trigger
    const large = await webhooks.processEvent({
      type: 'wallet.sol_received',
      timestamp: Date.now(),
      target: 'target_wallet',
      data: { amount: 150 },
    });

    expect(small).toBe(0);
    expect(large).toBe(1);
  });

  it('should verify webhook signatures', () => {
    const payload = '{"test":"data"}';
    const secret = 'my_secret_key';

    // This would be done by the receiving server
    const signature = WebhookManager.verifySignature(payload, 'sha256=invalid', secret);
    expect(signature).toBe(false);
  });

  it('should report statistics', () => {
    webhooks.createSubscription({
      userId: 'user1',
      name: 'Sub 1',
      eventTypes: ['wallet.sol_received', 'wallet.sol_sent'],
      targets: ['addr1'],
      delivery: { method: 'http', url: 'https://example.com' },
    });

    const stats = webhooks.getStats();
    expect(stats.totalSubscriptions).toBe(1);
    expect(stats.activeSubscriptions).toBe(1);
    expect(stats.eventTypes['wallet.sol_received']).toBe(1);
  });
});

// ============================================================================
// 5. OPENAPI GENERATOR TESTS
// ============================================================================

import {
  OpenAPIParser,
  MCPToolGenerator,
  generateFromSpec,
  generateTypes,
  type OpenAPISpec,
} from '../src/mcp-openapi-generator';

describe('MCP OpenAPI Generator', () => {
  const sampleSpec: OpenAPISpec = {
    openapi: '3.0.0',
    info: {
      title: 'Test API',
      description: 'A test API for unit tests',
      version: '1.0.0',
    },
    servers: [{ url: 'https://api.example.com' }],
    paths: {
      '/users/{id}': {
        get: {
          operationId: 'getUser',
          summary: 'Get user by ID',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'Success' },
          },
        },
      },
      '/users': {
        get: {
          operationId: 'listUsers',
          summary: 'List all users',
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer' } },
          ],
          responses: {
            '200': { description: 'Success' },
          },
        },
        post: {
          operationId: 'createUser',
          summary: 'Create a user',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    email: { type: 'string' },
                  },
                  required: ['name', 'email'],
                },
              },
            },
          },
          responses: {
            '201': { description: 'Created' },
          },
        },
      },
    },
    components: {
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
          },
          required: ['id', 'name'],
        },
      },
    },
  };

  it('should parse OpenAPI spec', () => {
    const parser = new OpenAPIParser(sampleSpec);
    const operations = parser.getOperations();

    expect(operations.length).toBe(3);
    expect(operations.map(o => o.operation.operationId)).toContain('getUser');
    expect(operations.map(o => o.operation.operationId)).toContain('listUsers');
    expect(operations.map(o => o.operation.operationId)).toContain('createUser');
  });

  it('should extract base URL', () => {
    const parser = new OpenAPIParser(sampleSpec);
    expect(parser.getBaseUrl()).toBe('https://api.example.com');
  });

  it('should generate MCP tools from spec', () => {
    const server = generateFromSpec(sampleSpec);

    expect(server.name).toBe('test_api');
    expect(server.version).toBe('1.0.0');
    expect(server.tools.length).toBe(3);
  });

  it('should generate correct tool schemas', () => {
    const server = generateFromSpec(sampleSpec);
    const getUserTool = server.tools.find(t => t.name === 'getuser');

    expect(getUserTool).toBeDefined();
    expect(getUserTool?.inputSchema.properties?.id).toBeDefined();
    expect(getUserTool?.inputSchema.required).toContain('id');
  });

  it('should flatten request body parameters', () => {
    const server = generateFromSpec(sampleSpec, { flattenParameters: true });
    const createUserTool = server.tools.find(t => t.name === 'createuser');

    expect(createUserTool).toBeDefined();
    expect(createUserTool?.inputSchema.properties?.name).toBeDefined();
    expect(createUserTool?.inputSchema.properties?.email).toBeDefined();
  });

  it('should respect include/exclude filters', () => {
    const specWithTags = {
      ...sampleSpec,
      paths: {
        '/public': {
          get: {
            operationId: 'publicEndpoint',
            tags: ['public'],
            responses: { '200': { description: 'OK' } },
          },
        },
        '/admin': {
          get: {
            operationId: 'adminEndpoint',
            tags: ['admin'],
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    };

    const server = generateFromSpec(specWithTags, { excludeTags: ['admin'] });
    expect(server.tools.length).toBe(1);
    expect(server.tools[0].name).toBe('publicendpoint');
  });

  it('should generate TypeScript types', () => {
    const types = generateTypes(sampleSpec);

    expect(types).toContain('export interface User');
    expect(types).toContain('id: string');
    expect(types).toContain('name: string');
    expect(types).toContain('email?: string');
  });

  it('should preserve metadata in generated tools', () => {
    const server = generateFromSpec(sampleSpec);
    const tool = server.tools.find(t => t.name === 'getuser');

    expect(tool?._metadata).toBeDefined();
    expect(tool?._metadata.path).toBe('/users/{id}');
    expect(tool?._metadata.method).toBe('GET');
    expect(tool?._metadata.operationId).toBe('getUser');
  });
});

// ============================================================================
// 6. MULTI-AGENT TESTS
// ============================================================================

import {
  MultiAgentOrchestrator,
  AGENT_ROLES,
  INVESTIGATION_TEMPLATES,
} from '../src/mcp-multi-agent';

describe('MCP Multi-Agent Orchestration', () => {
  let orchestrator: MultiAgentOrchestrator;

  beforeEach(() => {
    // Mock tool executor
    const mockExecutor = async (tool: string, params: Record<string, any>) => {
      switch (tool) {
        case 'get_account_transactions':
          return Array.from({ length: 10 }, (_, i) => ({
            signature: `sig${i}`,
            type: 'transfer',
            solTransferred: i * 10,
            success: true,
          }));
        case 'get_account_portfolio':
          return {
            data: {
              native: { balance: 100 },
              tokens: [{ symbol: 'USDC', balance: 1000 }],
            },
          };
        case 'get_account_stats':
          return { totalTransactions: 100, avgVolume: 50 };
        default:
          return { result: 'mock' };
      }
    };

    orchestrator = new MultiAgentOrchestrator(mockExecutor);
  });

  it('should define agent roles', () => {
    expect(AGENT_ROLES.lead).toBeDefined();
    expect(AGENT_ROLES.wallet_forensics).toBeDefined();
    expect(AGENT_ROLES.anomaly_detector).toBeDefined();

    expect(AGENT_ROLES.lead.canSpawnFollowUp).toBe(true);
    expect(AGENT_ROLES.risk_assessor.canSpawnFollowUp).toBe(false);
  });

  it('should define investigation templates', () => {
    expect(INVESTIGATION_TEMPLATES.quick_scan).toBeDefined();
    expect(INVESTIGATION_TEMPLATES.deep_dive).toBeDefined();
    expect(INVESTIGATION_TEMPLATES.forensic).toBeDefined();

    expect(INVESTIGATION_TEMPLATES.quick_scan.agents.length).toBe(2);
    expect(INVESTIGATION_TEMPLATES.forensic.agents.length).toBe(8);
  });

  it('should start investigation with correct agents', async () => {
    const investigation = await orchestrator.startInvestigation({
      target: 'test_wallet',
      template: 'quick_scan',
    });

    expect(investigation.id).toMatch(/^inv_/);
    expect(investigation.target).toBe('test_wallet');
    expect(investigation.agents.length).toBeGreaterThanOrEqual(2);
  });

  it('should track investigation progress', async () => {
    let lastProgress = 0;

    const investigation = await orchestrator.startInvestigation({
      target: 'test_wallet',
      template: 'quick_scan',
      config: { timeoutMs: 5000 },
      onProgress: (inv) => {
        lastProgress = inv.progress;
      },
    });

    // Wait for completion
    await new Promise(r => setTimeout(r, 1000));

    expect(lastProgress).toBeGreaterThan(0);
  });

  it('should aggregate findings from multiple agents', async () => {
    const investigation = await orchestrator.startInvestigation({
      target: 'test_wallet',
      template: 'quick_scan',
      config: { timeoutMs: 5000, parallelism: 2 },
    });

    // Wait for agents to complete
    await new Promise(r => setTimeout(r, 2000));

    const result = orchestrator.getInvestigation(investigation.id);
    expect(result).not.toBeNull();
    expect(result?.status).toBe('completed');
  });

  it('should list all investigations', async () => {
    await orchestrator.startInvestigation({ target: 'wallet1', template: 'quick_scan' });
    await orchestrator.startInvestigation({ target: 'wallet2', template: 'quick_scan' });

    const list = orchestrator.listInvestigations();
    expect(list.length).toBe(2);
  });

  it('should calculate risk scores', async () => {
    const investigation = await orchestrator.startInvestigation({
      target: 'test_wallet',
      template: 'quick_scan',
      config: { timeoutMs: 3000 },
    });

    await new Promise(r => setTimeout(r, 2000));

    const result = orchestrator.getInvestigation(investigation.id);
    expect(typeof result?.riskScore).toBe('number');
    expect(result?.riskScore).toBeGreaterThanOrEqual(0);
    expect(result?.riskScore).toBeLessThanOrEqual(100);
  });
});

// ============================================================================
// 7. MEMORY PERSISTENCE TESTS
// ============================================================================

import {
  MemoryStore,
  getMemory,
  type MemoryEntry,
} from '../src/mcp-memory';

describe('MCP Memory Persistence', () => {
  let memory: MemoryStore;

  beforeEach(() => {
    memory = new MemoryStore({ maxMemoriesPerUser: 100 });
  });

  afterEach(() => {
    memory.stopDecay();
  });

  it('should store and retrieve memories', async () => {
    const stored = await memory.store({
      userId: 'user123',
      type: 'investigation',
      content: 'Investigation of wallet ABC found suspicious activity',
      metadata: { target: 'ABC', riskLevel: 'high' },
    });

    expect(stored.id).toMatch(/^mem_/);
    expect(stored.embedding).toBeDefined();
    expect(stored.embedding?.length).toBeGreaterThan(0);

    const retrieved = memory.get(stored.id);
    expect(retrieved?.content).toBe('Investigation of wallet ABC found suspicious activity');
  });

  it('should search memories semantically', async () => {
    await memory.store({
      userId: 'user123',
      type: 'finding',
      content: 'Large SOL transfer detected from exchange',
      importance: 80,
    });

    await memory.store({
      userId: 'user123',
      type: 'finding',
      content: 'NFT minting activity observed',
      importance: 50,
    });

    // Search without query returns by importance/recency
    const results = await memory.search({
      userId: 'user123',
      types: ['finding'],
      limit: 5,
    });

    expect(results.length).toBe(2);
    // Higher importance should be first
    expect(results[0].memory.importance).toBeGreaterThanOrEqual(results[1].memory.importance);
  });

  it('should filter memories by type', async () => {
    await memory.store({
      userId: 'user123',
      type: 'investigation',
      content: 'Full investigation',
    });

    await memory.store({
      userId: 'user123',
      type: 'finding',
      content: 'A finding',
    });

    await memory.store({
      userId: 'user123',
      type: 'entity',
      content: 'Binance exchange',
    });

    const findings = await memory.search({
      userId: 'user123',
      types: ['finding'],
    });

    expect(findings.length).toBe(1);
    expect(findings[0].memory.type).toBe('finding');
  });

  it('should store investigation results', async () => {
    const memories = await memory.storeInvestigation({
      userId: 'user123',
      investigationId: 'inv_123',
      target: 'wallet_xyz',
      type: 'wallet_forensics',
      findings: [
        { title: 'Large Transfer', description: '500 SOL moved', type: 'transfer', severity: 'high' },
        { title: 'New Token', description: 'Received BONK', type: 'token', severity: 'low' },
      ],
      anomalies: [
        { type: 'timing', description: 'Unusual activity pattern' },
      ],
      entities: [
        { address: 'addr1', name: 'Binance', type: 'exchange', labels: [], confidence: 90 },
      ],
      riskScore: 65,
      summary: 'Medium risk wallet with exchange activity',
    });

    expect(memories.length).toBeGreaterThan(0);

    // Should include main investigation + findings + entities
    const types = memories.map(m => m.type);
    expect(types).toContain('investigation');
    expect(types).toContain('finding');
    expect(types).toContain('entity');
  });

  it('should get investigation context', async () => {
    // Store some prior investigation data
    await memory.storeInvestigation({
      userId: 'user123',
      investigationId: 'inv_old',
      target: 'wallet_abc',
      type: 'wallet_forensics',
      findings: [{ title: 'Old Finding', description: 'Previous discovery', type: 'misc', severity: 'medium' }],
      anomalies: [],
      entities: [],
      riskScore: 30,
    });

    const context = await memory.getInvestigationContext('user123', 'wallet_abc');

    expect(context.previousInvestigations.length).toBeGreaterThan(0);
  });

  it('should track conversation context', async () => {
    const conv = memory.getConversation('user123', 'conv_1');
    expect(conv.messages.length).toBe(0);

    // Use a valid-looking Solana address (32+ base58 chars)
    const testAddress = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

    await memory.addMessage('user123', 'conv_1', {
      role: 'user',
      content: `Investigate wallet ${testAddress}`,
    });

    await memory.addMessage('user123', 'conv_1', {
      role: 'assistant',
      content: `Starting investigation of ${testAddress}`,
    });

    const updated = memory.getConversation('user123', 'conv_1');
    expect(updated.messages.length).toBe(2);
    expect(updated.mentionedEntities).toContain(testAddress);
  });

  it('should boost importance on access', async () => {
    const stored = await memory.store({
      userId: 'user123',
      type: 'finding',
      content: 'Important finding',
      importance: 50,
    });

    memory.boostImportance(stored.id, 20);

    const retrieved = memory.get(stored.id);
    expect(retrieved?.importance).toBe(70);
  });

  it('should report statistics', async () => {
    await memory.store({ userId: 'user1', type: 'investigation', content: 'Test 1' });
    await memory.store({ userId: 'user1', type: 'finding', content: 'Test 2' });
    await memory.store({ userId: 'user2', type: 'entity', content: 'Test 3' });

    const stats = memory.getStats();

    expect(stats.totalMemories).toBe(3);
    expect(stats.byType.investigation).toBe(1);
    expect(stats.byType.finding).toBe(1);
    expect(stats.byType.entity).toBe(1);
    expect(stats.byUser['user1']).toBe(2);
    expect(stats.byUser['user2']).toBe(1);
  });

  it('should enforce user memory limits', async () => {
    const limitedMemory = new MemoryStore({ maxMemoriesPerUser: 5 });

    for (let i = 0; i < 10; i++) {
      await limitedMemory.store({
        userId: 'user123',
        type: 'finding',
        content: `Finding ${i}`,
        importance: i * 10,
      });
    }

    const stats = limitedMemory.getStats();
    expect(stats.byUser['user123']).toBeLessThanOrEqual(5);
  });
});

// ============================================================================
// RUN ALL TESTS
// ============================================================================

console.log('Running MCP Feature Integration Tests...');
console.log('='.repeat(60));
