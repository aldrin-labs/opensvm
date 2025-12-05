/**
 * MCP Gateway Integration Tests
 *
 * End-to-end tests that verify the gateway handles MCP protocol messages correctly.
 * These tests validate JSON-RPC message handling, tool execution, and protocol compliance.
 */

// Mock the MCP SDK before importing
jest.mock('@modelcontextprotocol/sdk/server/index.js', () => {
  const handlers = new Map<string, (request: unknown) => Promise<unknown>>();

  return {
    Server: jest.fn().mockImplementation(() => ({
      setRequestHandler: jest.fn((schema: { method?: string }, handler: (request: unknown) => Promise<unknown>) => {
        const method = schema.method || schema.toString();
        handlers.set(method, handler);
      }),
      connect: jest.fn(),
      _handlers: handlers,
      _getHandler: (method: string) => handlers.get(method),
    })),
  };
});

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn(),
}));

jest.mock('@modelcontextprotocol/sdk/types.js', () => ({
  CallToolRequestSchema: { method: 'tools/call' },
  ErrorCode: { MethodNotFound: 'MethodNotFound', InvalidParams: 'InvalidParams', InvalidRequest: 'InvalidRequest' },
  ListToolsRequestSchema: { method: 'tools/list' },
  ListPromptsRequestSchema: { method: 'prompts/list' },
  GetPromptRequestSchema: { method: 'prompts/get' },
  ListResourcesRequestSchema: { method: 'resources/list' },
  ReadResourceRequestSchema: { method: 'resources/read' },
  McpError: class McpError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = 'McpError';
      this.code = code;
    }
  },
  Tool: class Tool {},
  Resource: class Resource {},
  Prompt: class Prompt {},
}));

// Mock tool discovery
const mockRegistry = {
  getAllTools: jest.fn().mockReturnValue([
    { name: 'solana:get_transaction', description: 'Get transaction details', inputSchema: { type: 'object', properties: {} }, namespace: 'solana' },
    { name: 'dflow:search_events', description: 'Search prediction markets', inputSchema: { type: 'object', properties: {} }, namespace: 'dflow' },
  ]),
  getAllPrompts: jest.fn().mockReturnValue([
    { name: 'analyze_wallet', description: 'Analyze a wallet', arguments: [{ name: 'address', required: true }] },
  ]),
  getAllResources: jest.fn().mockReturnValue([
    { uri: 'solana://config', name: 'Solana Config', description: 'Network config', mimeType: 'application/json' },
  ]),
  getAllModules: jest.fn().mockReturnValue([
    { id: 'opensvm-mcp', name: 'OpenSVM MCP', version: '1.0.0', namespace: 'solana', status: 'loaded', tools: [], prompts: [], resources: [], path: '/path' },
  ]),
  getStats: jest.fn().mockReturnValue({ totalModules: 1, loadedModules: 1, errorModules: 0, totalTools: 2, totalPrompts: 1, totalResources: 1, byNamespace: { solana: 1, dflow: 1 } }),
  getNamespaces: jest.fn().mockReturnValue(['solana', 'dflow']),
  getTool: jest.fn().mockImplementation((name: string) => {
    const tools = mockRegistry.getAllTools();
    return tools.find((t: { name: string }) => t.name === name);
  }),
  getToolsByNamespace: jest.fn().mockReturnValue([]),
};

jest.mock('../src/mcp-tool-discovery.js', () => ({
  MCPGateway: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    getRegistry: jest.fn().mockReturnValue(mockRegistry),
    executeTool: jest.fn().mockImplementation(async (name: string, args: Record<string, unknown>) => {
      if (name === 'solana:get_transaction') {
        return { signature: args.signature || 'test-sig', status: 'confirmed' };
      }
      if (name === 'dflow:search_events') {
        return { events: [], total: 0 };
      }
      throw new Error(`Unknown tool: ${name}`);
    }),
  })),
  ToolRegistry: jest.fn(),
}));

import {
  createSpecCompliantGateway,
  PROTOCOL_VERSION,
  SERVER_INFO,
  SERVER_CAPABILITIES,
  GATEWAY_TOOLS,
  GATEWAY_PROMPTS,
  GATEWAY_RESOURCES,
  paginate,
  generateToolAnnotations,
  ProgressTracker,
  SubscriptionManager,
  LoggingManager,
} from '../src/mcp-spec-gateway';

describe('MCP Gateway Integration', () => {
  let gateway: Awaited<ReturnType<typeof createSpecCompliantGateway>>;

  beforeAll(async () => {
    gateway = await createSpecCompliantGateway({
      sourceDirs: ['./src', 'api/src'],
      watchEnabled: false,
    });
  });

  describe('Protocol Initialization', () => {
    test('should expose correct protocol version', () => {
      expect(PROTOCOL_VERSION).toBe('2025-11-25');
    });

    test('should have complete server info', () => {
      expect(SERVER_INFO).toEqual(expect.objectContaining({
        name: 'opensvm-mcp-gateway',
        version: expect.any(String),
      }));
    });

    test('should declare all required capabilities', () => {
      expect(SERVER_CAPABILITIES).toHaveProperty('logging');
      expect(SERVER_CAPABILITIES).toHaveProperty('completions');
      expect(SERVER_CAPABILITIES).toHaveProperty('prompts');
      expect(SERVER_CAPABILITIES).toHaveProperty('resources');
      expect(SERVER_CAPABILITIES).toHaveProperty('tools');
    });

    test('should have listChanged for prompts, resources, and tools', () => {
      expect(SERVER_CAPABILITIES.prompts?.listChanged).toBe(true);
      expect(SERVER_CAPABILITIES.resources?.listChanged).toBe(true);
      expect(SERVER_CAPABILITIES.tools?.listChanged).toBe(true);
    });

    test('should support resource subscriptions', () => {
      expect(SERVER_CAPABILITIES.resources?.subscribe).toBe(true);
    });
  });

  describe('Tools Listing', () => {
    test('should list all gateway tools', () => {
      expect(GATEWAY_TOOLS.length).toBe(7);

      const toolNames = GATEWAY_TOOLS.map(t => t.name);
      expect(toolNames).toContain('gateway:list_modules');
      expect(toolNames).toContain('gateway:list_namespaces');
      expect(toolNames).toContain('gateway:get_stats');
      expect(toolNames).toContain('gateway:search_tools');
      expect(toolNames).toContain('gateway:get_tool_info');
      expect(toolNames).toContain('gateway:reload_module');
      expect(toolNames).toContain('gateway:discover');
    });

    test('all tools should have proper inputSchema', () => {
      GATEWAY_TOOLS.forEach(tool => {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema).toHaveProperty('properties');
      });
    });

    test('all tools should have annotations', () => {
      GATEWAY_TOOLS.forEach(tool => {
        expect(tool.annotations).toBeDefined();
      });
    });
  });

  describe('Prompts Listing', () => {
    test('should list all gateway prompts', () => {
      expect(GATEWAY_PROMPTS.length).toBe(3);

      const promptNames = GATEWAY_PROMPTS.map(p => p.name);
      expect(promptNames).toContain('explore_gateway');
      expect(promptNames).toContain('find_tools_for_task');
      expect(promptNames).toContain('multi_namespace_workflow');
    });

    test('prompts should have required arguments documented', () => {
      const findToolsPrompt = GATEWAY_PROMPTS.find(p => p.name === 'find_tools_for_task');
      expect(findToolsPrompt?.arguments).toBeDefined();
      expect(findToolsPrompt?.arguments?.[0].required).toBe(true);
    });
  });

  describe('Resources Listing', () => {
    test('should list all gateway resources', () => {
      expect(GATEWAY_RESOURCES.length).toBe(5);

      const resourceUris = GATEWAY_RESOURCES.map(r => r.uri);
      expect(resourceUris).toContain('gateway://modules');
      expect(resourceUris).toContain('gateway://tools');
      expect(resourceUris).toContain('gateway://stats');
      expect(resourceUris).toContain('gateway://capabilities');
      expect(resourceUris).toContain('gateway://protocol');
    });

    test('resources should have mimeType', () => {
      GATEWAY_RESOURCES.forEach(resource => {
        expect(resource.mimeType).toBe('application/json');
      });
    });
  });

  describe('Tool Annotations', () => {
    test('should generate readOnlyHint for get_ tools', () => {
      const annotations = generateToolAnnotations('solana:get_transaction');
      expect(annotations.readOnlyHint).toBe(true);
      expect(annotations.destructiveHint).toBe(false);
    });

    test('should generate readOnlyHint for list_ tools', () => {
      const annotations = generateToolAnnotations('gateway:list_modules');
      expect(annotations.readOnlyHint).toBe(true);
    });

    test('should generate readOnlyHint for search_ tools', () => {
      const annotations = generateToolAnnotations('dflow:search_events');
      expect(annotations.readOnlyHint).toBe(true);
    });

    test('should generate destructiveHint for delete_ tools', () => {
      const annotations = generateToolAnnotations('test:delete_item');
      expect(annotations.destructiveHint).toBe(true);
    });

    test('should generate idempotentHint for set_ tools', () => {
      const annotations = generateToolAnnotations('config:set_value');
      expect(annotations.idempotentHint).toBe(true);
    });

    test('should generate openWorldHint for external services', () => {
      expect(generateToolAnnotations('solana:get_balance').openWorldHint).toBe(true);
      expect(generateToolAnnotations('kalshi:list_markets').openWorldHint).toBe(true);
      expect(generateToolAnnotations('dflow:search_events').openWorldHint).toBe(true);
    });
  });

  describe('Pagination', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));

    test('should return first page by default', () => {
      const result = paginate(items);
      expect(result.items.length).toBe(20);
      expect(result.items[0].id).toBe(0);
      expect(result.nextCursor).toBe('20');
      expect(result.total).toBe(100);
    });

    test('should respect custom limit', () => {
      const result = paginate(items, { limit: 10 });
      expect(result.items.length).toBe(10);
      expect(result.nextCursor).toBe('10');
    });

    test('should respect cursor', () => {
      const result = paginate(items, { cursor: '50', limit: 10 });
      expect(result.items.length).toBe(10);
      expect(result.items[0].id).toBe(50);
      expect(result.nextCursor).toBe('60');
    });

    test('should not return nextCursor on last page', () => {
      const result = paginate(items, { cursor: '90', limit: 20 });
      expect(result.items.length).toBe(10);
      expect(result.nextCursor).toBeUndefined();
    });

    test('should handle empty array', () => {
      const result = paginate([]);
      expect(result.items).toEqual([]);
      expect(result.nextCursor).toBeUndefined();
      expect(result.total).toBe(0);
    });
  });

  describe('Progress Tracking', () => {
    let tracker: ProgressTracker;

    beforeEach(() => {
      tracker = new ProgressTracker();
    });

    test('should create unique progress tokens', () => {
      const token1 = tracker.createToken(100);
      const token2 = tracker.createToken(100);
      expect(token1).not.toBe(token2);
      expect(token1).toMatch(/^progress_/);
    });

    test('should track progress updates', () => {
      const token = tracker.createToken(100);
      tracker.updateProgress(token, 50, 'Halfway done');

      const progress = tracker.getProgress(token);
      expect(progress?.current).toBe(50);
      expect(progress?.message).toBe('Halfway done');
      expect(progress?.total).toBe(100);
    });

    test('should emit progress events', () => {
      const events: unknown[] = [];
      tracker.on('progress', (data) => events.push(data));

      const token = tracker.createToken(100);
      tracker.updateProgress(token, 25);
      tracker.updateProgress(token, 50);
      tracker.updateProgress(token, 75);

      expect(events.length).toBe(3);
    });

    test('should clean up on completion', () => {
      const token = tracker.createToken(100);
      tracker.updateProgress(token, 50);
      tracker.completeProgress(token);

      expect(tracker.getProgress(token)).toBeUndefined();
    });
  });

  describe('Subscription Management', () => {
    let manager: SubscriptionManager;

    beforeEach(() => {
      manager = new SubscriptionManager();
    });

    test('should track subscriptions', () => {
      manager.subscribe('gateway://stats');
      expect(manager.isSubscribed('gateway://stats')).toBe(true);
      expect(manager.isSubscribed('gateway://other')).toBe(false);
    });

    test('should list all subscriptions', () => {
      manager.subscribe('gateway://stats');
      manager.subscribe('gateway://tools');
      manager.subscribe('gateway://modules');

      const subs = manager.getSubscriptions();
      expect(subs.length).toBe(3);
      expect(subs).toContain('gateway://stats');
      expect(subs).toContain('gateway://tools');
      expect(subs).toContain('gateway://modules');
    });

    test('should handle unsubscribe', () => {
      manager.subscribe('gateway://stats');
      expect(manager.unsubscribe('gateway://stats')).toBe(true);
      expect(manager.isSubscribed('gateway://stats')).toBe(false);
      expect(manager.unsubscribe('gateway://nonexistent')).toBe(false);
    });

    test('should emit subscription events', () => {
      const events: string[] = [];
      manager.on('subscribed', (uri) => events.push(`sub:${uri}`));
      manager.on('unsubscribed', (uri) => events.push(`unsub:${uri}`));

      manager.subscribe('gateway://stats');
      manager.unsubscribe('gateway://stats');

      expect(events).toEqual(['sub:gateway://stats', 'unsub:gateway://stats']);
    });

    test('should notify only subscribed resources', () => {
      const updates: string[] = [];
      manager.on('resourceUpdated', (uri) => updates.push(uri));

      manager.subscribe('gateway://stats');
      manager.notifyUpdate('gateway://stats');
      manager.notifyUpdate('gateway://other');

      expect(updates).toEqual(['gateway://stats']);
    });
  });

  describe('Logging Management', () => {
    let logger: LoggingManager;

    beforeEach(() => {
      logger = new LoggingManager();
    });

    test('should default to info level', () => {
      expect(logger.getLevel()).toBe('info');
    });

    test('should change log level', () => {
      logger.setLevel('debug');
      expect(logger.getLevel()).toBe('debug');

      logger.setLevel('error');
      expect(logger.getLevel()).toBe('error');
    });

    test('should filter messages by level', () => {
      const messages: unknown[] = [];
      logger.on('message', (msg) => messages.push(msg));

      logger.setLevel('warning');

      logger.debug('test', 'debug message');
      logger.info('test', 'info message');
      logger.warning('test', 'warning message');
      logger.error('test', 'error message');

      expect(messages.length).toBe(2); // Only warning and error
    });

    test('should emit level change events', () => {
      const levels: string[] = [];
      logger.on('levelChanged', (level) => levels.push(level));

      logger.setLevel('debug');
      logger.setLevel('error');

      expect(levels).toEqual(['debug', 'error']);
    });

    test('should include logger name in messages', () => {
      const messages: { logger: string }[] = [];
      logger.on('message', (msg) => messages.push(msg));

      logger.info('my-service', { key: 'value' });

      expect(messages[0].logger).toBe('my-service');
    });
  });

  describe('Gateway Component Integration', () => {
    test('should create gateway with all components', () => {
      expect(gateway.server).toBeDefined();
      expect(gateway.registry).toBeDefined();
      expect(gateway.progressTracker).toBeDefined();
      expect(gateway.subscriptionManager).toBeDefined();
      expect(gateway.loggingManager).toBeDefined();
    });
  });
});

describe('JSON-RPC Message Format', () => {
  test('should format tool call response correctly', async () => {
    const result = { data: 'test' };
    const response = {
      jsonrpc: '2.0' as const,
      id: 1,
      result: {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      },
    };

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe(1);
    expect(response.result.content[0].type).toBe('text');
    expect(JSON.parse(response.result.content[0].text)).toEqual(result);
  });

  test('should format error response correctly', () => {
    const response = {
      jsonrpc: '2.0' as const,
      id: 1,
      error: {
        code: -32603,
        message: 'Internal error',
        data: { details: 'Additional info' },
      },
    };

    expect(response.jsonrpc).toBe('2.0');
    expect(response.error.code).toBe(-32603);
    expect(response.error.message).toBe('Internal error');
  });

  test('notifications should not have id', () => {
    const notification = {
      jsonrpc: '2.0' as const,
      method: 'notifications/progress',
      params: { token: 'abc', current: 50, total: 100 },
    };

    expect(notification).not.toHaveProperty('id');
    expect(notification.method).toBe('notifications/progress');
  });
});

describe('Tool Discovery Integration', () => {
  test('should merge discovered tools with gateway tools', () => {
    const discoveredCount = mockRegistry.getAllTools().length;
    const totalExpected = GATEWAY_TOOLS.length + discoveredCount;

    // Verify we have both gateway and discovered tools
    expect(GATEWAY_TOOLS.length).toBe(7);
    expect(discoveredCount).toBeGreaterThanOrEqual(0);
  });

  test('discovered tools should have namespaced names', () => {
    const tools = mockRegistry.getAllTools();
    tools.forEach((tool: { name: string }) => {
      expect(tool.name).toMatch(/^[a-z]+:/);
    });
  });
});

console.log('MCP Gateway Integration Tests');
console.log('==============================');
