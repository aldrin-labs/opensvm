/**
 * MCP Spec-Compliant Gateway Tests
 *
 * Tests the gateway implementation against MCP specification 2025-11-25
 */

// Mock the MCP SDK before importing
jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn().mockImplementation(() => ({
    setRequestHandler: jest.fn(),
    connect: jest.fn(),
  })),
}));

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn(),
}));

jest.mock('@modelcontextprotocol/sdk/types.js', () => ({
  CallToolRequestSchema: {},
  ErrorCode: { MethodNotFound: 'MethodNotFound', InvalidParams: 'InvalidParams', InvalidRequest: 'InvalidRequest' },
  ListToolsRequestSchema: {},
  ListPromptsRequestSchema: {},
  GetPromptRequestSchema: {},
  ListResourcesRequestSchema: {},
  ReadResourceRequestSchema: {},
  McpError: class McpError extends Error {
    constructor(code: string, message: string) {
      super(message);
      this.name = 'McpError';
    }
  },
}));

// Mock the tool discovery module (with .js extension as it appears in the import)
jest.mock('../src/mcp-tool-discovery.js', () => ({
  MCPGateway: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    getRegistry: jest.fn().mockReturnValue({
      getAllTools: jest.fn().mockReturnValue([]),
      getAllPrompts: jest.fn().mockReturnValue([]),
      getAllResources: jest.fn().mockReturnValue([]),
      getAllModules: jest.fn().mockReturnValue([]),
      getStats: jest.fn().mockReturnValue({ totalModules: 0, loadedModules: 0, totalTools: 0, byNamespace: {} }),
      getNamespaces: jest.fn().mockReturnValue([]),
      getToolsByNamespace: jest.fn().mockReturnValue([]),
      getTool: jest.fn().mockReturnValue(undefined),
    }),
    executeTool: jest.fn().mockResolvedValue({}),
  })),
  ToolRegistry: jest.fn(),
}));

import {
  PROTOCOL_VERSION,
  SERVER_CAPABILITIES,
  SERVER_INFO,
  GATEWAY_TOOLS,
  GATEWAY_PROMPTS,
  GATEWAY_RESOURCES,
  ProgressTracker,
  SubscriptionManager,
  LoggingManager,
  generateToolAnnotations,
  paginate,
} from '../src/mcp-spec-gateway';

describe('MCP Protocol Constants', () => {
  test('protocol version should be 2025-11-25', () => {
    expect(PROTOCOL_VERSION).toBe('2025-11-25');
  });

  test('server info should have required fields', () => {
    expect(SERVER_INFO).toHaveProperty('name');
    expect(SERVER_INFO).toHaveProperty('version');
    expect(SERVER_INFO.name).toBe('opensvm-mcp-gateway');
  });
});

describe('Server Capabilities', () => {
  test('should declare logging capability', () => {
    expect(SERVER_CAPABILITIES).toHaveProperty('logging');
  });

  test('should declare completions capability', () => {
    expect(SERVER_CAPABILITIES).toHaveProperty('completions');
  });

  test('should declare prompts capability with listChanged', () => {
    expect(SERVER_CAPABILITIES.prompts).toHaveProperty('listChanged', true);
  });

  test('should declare resources capability with subscribe and listChanged', () => {
    expect(SERVER_CAPABILITIES.resources).toHaveProperty('subscribe', true);
    expect(SERVER_CAPABILITIES.resources).toHaveProperty('listChanged', true);
  });

  test('should declare tools capability with listChanged', () => {
    expect(SERVER_CAPABILITIES.tools).toHaveProperty('listChanged', true);
  });
});

describe('Gateway Tools', () => {
  test('should have 7 gateway management tools', () => {
    expect(GATEWAY_TOOLS.length).toBe(7);
  });

  test('all tools should have name, description, and inputSchema', () => {
    GATEWAY_TOOLS.forEach(tool => {
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('inputSchema');
    });
  });

  test('all tools should have annotations', () => {
    GATEWAY_TOOLS.forEach(tool => {
      expect(tool).toHaveProperty('annotations');
    });
  });

  test('tool annotations should have spec-compliant fields', () => {
    GATEWAY_TOOLS.forEach(tool => {
      const annotations = tool.annotations!;
      // At least one hint should be defined
      const hasHint =
        annotations.readOnlyHint !== undefined ||
        annotations.destructiveHint !== undefined ||
        annotations.idempotentHint !== undefined ||
        annotations.openWorldHint !== undefined;
      expect(hasHint).toBe(true);
    });
  });

  test('read-only tools should have readOnlyHint: true', () => {
    const readOnlyTools = GATEWAY_TOOLS.filter(t => t.name.includes('list_') || t.name.includes('get_') || t.name.includes('search_'));
    readOnlyTools.forEach(tool => {
      expect(tool.annotations?.readOnlyHint).toBe(true);
    });
  });

  test('inputSchema should have type: object', () => {
    GATEWAY_TOOLS.forEach(tool => {
      expect(tool.inputSchema.type).toBe('object');
    });
  });

  test('tools with required params should declare them', () => {
    const searchTool = GATEWAY_TOOLS.find(t => t.name === 'gateway:search_tools');
    expect(searchTool?.inputSchema.required).toContain('query');

    const infoTool = GATEWAY_TOOLS.find(t => t.name === 'gateway:get_tool_info');
    expect(infoTool?.inputSchema.required).toContain('tool_name');
  });
});

describe('Gateway Prompts', () => {
  test('should have 3 gateway prompts', () => {
    expect(GATEWAY_PROMPTS.length).toBe(3);
  });

  test('all prompts should have name and description', () => {
    GATEWAY_PROMPTS.forEach(prompt => {
      expect(prompt).toHaveProperty('name');
      expect(prompt).toHaveProperty('description');
    });
  });

  test('prompts with arguments should define them', () => {
    const taskPrompt = GATEWAY_PROMPTS.find(p => p.name === 'find_tools_for_task');
    expect(taskPrompt?.arguments).toBeDefined();
    expect(taskPrompt?.arguments?.length).toBeGreaterThan(0);
    expect(taskPrompt?.arguments?.[0].required).toBe(true);
  });
});

describe('Gateway Resources', () => {
  test('should have 5 gateway resources', () => {
    expect(GATEWAY_RESOURCES.length).toBe(5);
  });

  test('all resources should have uri, name, description, mimeType', () => {
    GATEWAY_RESOURCES.forEach(resource => {
      expect(resource).toHaveProperty('uri');
      expect(resource).toHaveProperty('name');
      expect(resource).toHaveProperty('description');
      expect(resource).toHaveProperty('mimeType');
    });
  });

  test('resource URIs should use gateway:// scheme', () => {
    GATEWAY_RESOURCES.forEach(resource => {
      expect(resource.uri).toMatch(/^gateway:\/\//);
    });
  });

  test('should include protocol resource', () => {
    const protocolResource = GATEWAY_RESOURCES.find(r => r.uri === 'gateway://protocol');
    expect(protocolResource).toBeDefined();
  });

  test('should include capabilities resource', () => {
    const capabilitiesResource = GATEWAY_RESOURCES.find(r => r.uri === 'gateway://capabilities');
    expect(capabilitiesResource).toBeDefined();
  });
});

describe('Tool Annotations Generator', () => {
  test('should generate readOnlyHint for get_ tools', () => {
    const annotations = generateToolAnnotations('solana:get_transaction');
    expect(annotations.readOnlyHint).toBe(true);
    expect(annotations.destructiveHint).toBe(false);
  });

  test('should generate readOnlyHint for list_ tools', () => {
    const annotations = generateToolAnnotations('kalshi:list_markets');
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
    const annotations = generateToolAnnotations('lp:set_boost');
    expect(annotations.idempotentHint).toBe(true);
  });

  test('should generate openWorldHint for external tools', () => {
    const solanaAnnotations = generateToolAnnotations('solana:get_transaction');
    expect(solanaAnnotations.openWorldHint).toBe(true);

    const kalshiAnnotations = generateToolAnnotations('kalshi:list_markets');
    expect(kalshiAnnotations.openWorldHint).toBe(true);
  });

  test('should not generate destructiveHint for read-only tools', () => {
    const annotations = generateToolAnnotations('gateway:list_modules');
    expect(annotations.readOnlyHint).toBe(true);
    expect(annotations.destructiveHint).toBe(false);
  });
});

describe('Pagination', () => {
  const testItems = Array.from({ length: 50 }, (_, i) => ({ id: i, name: `item_${i}` }));

  test('should return first page with default limit', () => {
    const result = paginate(testItems);
    expect(result.items.length).toBe(20);
    expect(result.items[0].id).toBe(0);
    expect(result.nextCursor).toBe('20');
  });

  test('should return items with custom limit', () => {
    const result = paginate(testItems, { limit: 10 });
    expect(result.items.length).toBe(10);
    expect(result.nextCursor).toBe('10');
  });

  test('should return items from cursor position', () => {
    const result = paginate(testItems, { cursor: '20' });
    expect(result.items.length).toBe(20);
    expect(result.items[0].id).toBe(20);
    expect(result.nextCursor).toBe('40');
  });

  test('should return no nextCursor on last page', () => {
    const result = paginate(testItems, { cursor: '40' });
    expect(result.items.length).toBe(10);
    expect(result.nextCursor).toBeUndefined();
  });

  test('should return total count', () => {
    const result = paginate(testItems);
    expect(result.total).toBe(50);
  });

  test('should handle empty items', () => {
    const result = paginate([]);
    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBeUndefined();
    expect(result.total).toBe(0);
  });

  test('should handle limit larger than items', () => {
    const result = paginate(testItems, { limit: 100 });
    expect(result.items.length).toBe(50);
    expect(result.nextCursor).toBeUndefined();
  });
});

describe('ProgressTracker', () => {
  let tracker: ProgressTracker;

  beforeEach(() => {
    tracker = new ProgressTracker();
  });

  test('should create unique tokens', () => {
    const token1 = tracker.createToken(100);
    const token2 = tracker.createToken(100);
    expect(token1).not.toBe(token2);
  });

  test('should track progress', () => {
    const token = tracker.createToken(100);
    tracker.updateProgress(token, 50, 'Halfway');
    const progress = tracker.getProgress(token);
    expect(progress?.current).toBe(50);
    expect(progress?.message).toBe('Halfway');
  });

  test('should emit progress events', () => {
    const events: unknown[] = [];
    tracker.on('progress', (data) => events.push(data));

    const token = tracker.createToken(100);
    tracker.updateProgress(token, 50);

    expect(events.length).toBe(1);
  });

  test('should complete progress', () => {
    const token = tracker.createToken(100);
    tracker.updateProgress(token, 50);
    tracker.completeProgress(token);

    const progress = tracker.getProgress(token);
    expect(progress).toBeUndefined();
  });
});

describe('SubscriptionManager', () => {
  let manager: SubscriptionManager;

  beforeEach(() => {
    manager = new SubscriptionManager();
  });

  test('should subscribe to resource', () => {
    manager.subscribe('gateway://stats');
    expect(manager.isSubscribed('gateway://stats')).toBe(true);
  });

  test('should unsubscribe from resource', () => {
    manager.subscribe('gateway://stats');
    expect(manager.unsubscribe('gateway://stats')).toBe(true);
    expect(manager.isSubscribed('gateway://stats')).toBe(false);
  });

  test('should return false when unsubscribing non-existent subscription', () => {
    expect(manager.unsubscribe('gateway://nonexistent')).toBe(false);
  });

  test('should list subscriptions', () => {
    manager.subscribe('gateway://stats');
    manager.subscribe('gateway://tools');

    const subs = manager.getSubscriptions();
    expect(subs).toContain('gateway://stats');
    expect(subs).toContain('gateway://tools');
  });

  test('should emit events', () => {
    const events: string[] = [];
    manager.on('subscribed', (uri) => events.push(`sub:${uri}`));
    manager.on('unsubscribed', (uri) => events.push(`unsub:${uri}`));

    manager.subscribe('gateway://stats');
    manager.unsubscribe('gateway://stats');

    expect(events).toEqual(['sub:gateway://stats', 'unsub:gateway://stats']);
  });

  test('should notify updates for subscribed resources', () => {
    const updates: string[] = [];
    manager.on('resourceUpdated', (uri) => updates.push(uri));

    manager.subscribe('gateway://stats');
    manager.notifyUpdate('gateway://stats');
    manager.notifyUpdate('gateway://nonsubscribed');

    expect(updates).toEqual(['gateway://stats']);
  });
});

describe('LoggingManager', () => {
  let logger: LoggingManager;

  beforeEach(() => {
    logger = new LoggingManager();
  });

  test('should have default level of info', () => {
    expect(logger.getLevel()).toBe('info');
  });

  test('should set log level', () => {
    logger.setLevel('debug');
    expect(logger.getLevel()).toBe('debug');
  });

  test('should emit messages at or above current level', () => {
    const messages: unknown[] = [];
    logger.on('message', (msg) => messages.push(msg));

    logger.setLevel('warning');
    logger.debug('test', 'debug message');
    logger.info('test', 'info message');
    logger.warning('test', 'warning message');
    logger.error('test', 'error message');

    expect(messages.length).toBe(2); // warning and error only
  });

  test('should include logger name in messages', () => {
    const messages: { logger?: string }[] = [];
    logger.on('message', (msg) => messages.push(msg));

    logger.info('my-logger', 'test');

    expect(messages[0].logger).toBe('my-logger');
  });

  test('should emit levelChanged event', () => {
    const levels: string[] = [];
    logger.on('levelChanged', (level) => levels.push(level));

    logger.setLevel('error');

    expect(levels).toEqual(['error']);
  });
});

describe('MCP Spec Compliance', () => {
  test('protocol version matches spec', () => {
    // MCP 2025-11-25 specification
    expect(PROTOCOL_VERSION).toBe('2025-11-25');
  });

  test('server capabilities match spec structure', () => {
    // ServerCapabilities interface requirements
    expect(typeof SERVER_CAPABILITIES).toBe('object');

    // Optional fields should be objects when present
    if (SERVER_CAPABILITIES.logging) {
      expect(typeof SERVER_CAPABILITIES.logging).toBe('object');
    }
    if (SERVER_CAPABILITIES.completions) {
      expect(typeof SERVER_CAPABILITIES.completions).toBe('object');
    }
    if (SERVER_CAPABILITIES.prompts) {
      expect(typeof SERVER_CAPABILITIES.prompts).toBe('object');
    }
    if (SERVER_CAPABILITIES.resources) {
      expect(typeof SERVER_CAPABILITIES.resources).toBe('object');
    }
    if (SERVER_CAPABILITIES.tools) {
      expect(typeof SERVER_CAPABILITIES.tools).toBe('object');
    }
  });

  test('tool inputSchema matches spec', () => {
    // Tool.inputSchema requirements
    GATEWAY_TOOLS.forEach(tool => {
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema).toHaveProperty('properties');
    });
  });

  test('tool annotations match spec structure', () => {
    // ToolAnnotations interface requirements
    GATEWAY_TOOLS.forEach(tool => {
      const annotations = tool.annotations;
      if (annotations) {
        // All hints should be boolean when defined
        if (annotations.readOnlyHint !== undefined) {
          expect(typeof annotations.readOnlyHint).toBe('boolean');
        }
        if (annotations.destructiveHint !== undefined) {
          expect(typeof annotations.destructiveHint).toBe('boolean');
        }
        if (annotations.idempotentHint !== undefined) {
          expect(typeof annotations.idempotentHint).toBe('boolean');
        }
        if (annotations.openWorldHint !== undefined) {
          expect(typeof annotations.openWorldHint).toBe('boolean');
        }
      }
    });
  });

  test('resources match spec structure', () => {
    // Resource interface requirements
    GATEWAY_RESOURCES.forEach(resource => {
      expect(typeof resource.uri).toBe('string');
      expect(typeof resource.name).toBe('string');
      if (resource.description) {
        expect(typeof resource.description).toBe('string');
      }
      if (resource.mimeType) {
        expect(typeof resource.mimeType).toBe('string');
      }
    });
  });

  test('prompts match spec structure', () => {
    // Prompt interface requirements
    GATEWAY_PROMPTS.forEach(prompt => {
      expect(typeof prompt.name).toBe('string');
      if (prompt.description) {
        expect(typeof prompt.description).toBe('string');
      }
      if (prompt.arguments) {
        expect(Array.isArray(prompt.arguments)).toBe(true);
        prompt.arguments.forEach(arg => {
          expect(typeof arg.name).toBe('string');
          if (arg.required !== undefined) {
            expect(typeof arg.required).toBe('boolean');
          }
        });
      }
    });
  });
});

console.log('MCP Spec-Compliant Gateway Tests');
console.log('Protocol Version:', PROTOCOL_VERSION);
console.log('================================');
