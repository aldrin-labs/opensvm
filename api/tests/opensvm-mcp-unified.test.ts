/**
 * OpenSVM Unified MCP Server Tests
 *
 * Tests the consolidated MCP server tool definitions without importing SDK
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

import {
  createServer,
  ALL_TOOLS,
  PROMPTS,
  RESOURCES,
  NAMESPACES,
} from '../src/opensvm-mcp-unified';

describe('OpenSVM Unified MCP Server', () => {
  describe('Namespace Structure', () => {
    test('should have all expected namespaces', () => {
      const expectedNamespaces = ['solana', 'dflow', 'kalshi', 'lp', 'governance', 'federation', 'agent', 'bank'];
      expectedNamespaces.forEach(ns => {
        expect(NAMESPACES).toHaveProperty(ns);
      });
    });

    test('each namespace should have prefix and description', () => {
      Object.entries(NAMESPACES).forEach(([name, config]) => {
        expect(config).toHaveProperty('prefix');
        expect(config).toHaveProperty('description');
        expect(config.prefix).toBe(`${name}:`);
        expect(config.description.length).toBeGreaterThan(10);
      });
    });
  });

  describe('Tool Registry', () => {
    test('should have substantial number of tools', () => {
      expect(ALL_TOOLS.length).toBeGreaterThan(80);
    });

    test('all tools should have name, description, and inputSchema', () => {
      ALL_TOOLS.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool.name.length).toBeGreaterThan(0);
        expect(tool.description.length).toBeGreaterThan(10);
      });
    });

    test('all tools should use namespace prefix', () => {
      const namespaceKeys = Object.keys(NAMESPACES);
      ALL_TOOLS.forEach(tool => {
        const hasValidNamespace = namespaceKeys.some(ns => tool.name.startsWith(`${ns}:`));
        expect(hasValidNamespace).toBe(true);
      });
    });

    test('inputSchema should have type property', () => {
      ALL_TOOLS.forEach(tool => {
        expect(tool.inputSchema).toHaveProperty('type');
        expect(tool.inputSchema.type).toBe('object');
      });
    });
  });

  describe('Solana Namespace Tools', () => {
    const solanaTools = ALL_TOOLS.filter(t => t.name.startsWith('solana:'));

    test('should have core transaction tools', () => {
      const toolNames = solanaTools.map(t => t.name);
      expect(toolNames).toContain('solana:get_transaction');
      expect(toolNames).toContain('solana:explain_transaction');
      expect(toolNames).toContain('solana:analyze_transaction');
    });

    test('should have account tools', () => {
      const toolNames = solanaTools.map(t => t.name);
      expect(toolNames).toContain('solana:get_account_portfolio');
      expect(toolNames).toContain('solana:get_account_transactions');
      expect(toolNames).toContain('solana:get_account_stats');
    });

    test('should have block tools', () => {
      const toolNames = solanaTools.map(t => t.name);
      expect(toolNames).toContain('solana:get_blocks');
      expect(toolNames).toContain('solana:get_block');
    });

    test('should have token tools', () => {
      const toolNames = solanaTools.map(t => t.name);
      expect(toolNames).toContain('solana:get_token_ohlcv');
      expect(toolNames).toContain('solana:get_token_markets');
      expect(toolNames).toContain('solana:get_token_metadata');
    });

    test('should have search tools', () => {
      const toolNames = solanaTools.map(t => t.name);
      expect(toolNames).toContain('solana:search');
      expect(toolNames).toContain('solana:find_wallet_path');
    });

    test('transaction tool should require signature', () => {
      const getTx = solanaTools.find(t => t.name === 'solana:get_transaction');
      expect(getTx?.inputSchema.required).toContain('signature');
    });
  });

  describe('DFlow Namespace Tools', () => {
    const dflowTools = ALL_TOOLS.filter(t => t.name.startsWith('dflow:'));

    test('should have event tools', () => {
      const toolNames = dflowTools.map(t => t.name);
      expect(toolNames).toContain('dflow:get_event');
      expect(toolNames).toContain('dflow:get_events');
      expect(toolNames).toContain('dflow:search_events');
    });

    test('should have market tools', () => {
      const toolNames = dflowTools.map(t => t.name);
      expect(toolNames).toContain('dflow:get_market');
      expect(toolNames).toContain('dflow:get_markets');
      expect(toolNames).toContain('dflow:get_market_by_mint');
    });

    test('should have trade tools', () => {
      const toolNames = dflowTools.map(t => t.name);
      expect(toolNames).toContain('dflow:get_trades');
      expect(toolNames).toContain('dflow:get_trades_by_mint');
    });

    test('should have series tools', () => {
      const toolNames = dflowTools.map(t => t.name);
      expect(toolNames).toContain('dflow:get_series');
      expect(toolNames).toContain('dflow:get_series_by_ticker');
    });

    test('should have utility tools', () => {
      const toolNames = dflowTools.map(t => t.name);
      expect(toolNames).toContain('dflow:get_outcome_mints');
      expect(toolNames).toContain('dflow:filter_outcome_mints');
      expect(toolNames).toContain('dflow:get_tags_by_categories');
    });
  });

  describe('Kalshi Namespace Tools', () => {
    const kalshiTools = ALL_TOOLS.filter(t => t.name.startsWith('kalshi:'));

    test('should have exchange tools', () => {
      const toolNames = kalshiTools.map(t => t.name);
      expect(toolNames).toContain('kalshi:get_exchange_status');
      expect(toolNames).toContain('kalshi:get_announcements');
      expect(toolNames).toContain('kalshi:get_schedule');
    });

    test('should have market tools', () => {
      const toolNames = kalshiTools.map(t => t.name);
      expect(toolNames).toContain('kalshi:list_markets');
      expect(toolNames).toContain('kalshi:get_market');
      expect(toolNames).toContain('kalshi:get_orderbook');
      expect(toolNames).toContain('kalshi:search_markets');
    });

    test('should have portfolio tools', () => {
      const toolNames = kalshiTools.map(t => t.name);
      expect(toolNames).toContain('kalshi:get_balance');
      expect(toolNames).toContain('kalshi:get_positions');
      expect(toolNames).toContain('kalshi:get_fills');
    });

    test('should have order tools', () => {
      const toolNames = kalshiTools.map(t => t.name);
      expect(toolNames).toContain('kalshi:list_orders');
      expect(toolNames).toContain('kalshi:create_order');
      expect(toolNames).toContain('kalshi:cancel_order');
    });

    test('create_order should have required fields', () => {
      const createOrder = kalshiTools.find(t => t.name === 'kalshi:create_order');
      expect(createOrder?.inputSchema.required).toContain('ticker');
      expect(createOrder?.inputSchema.required).toContain('action');
      expect(createOrder?.inputSchema.required).toContain('side');
      expect(createOrder?.inputSchema.required).toContain('type');
      expect(createOrder?.inputSchema.required).toContain('count');
    });
  });

  describe('LP Namespace Tools', () => {
    const lpTools = ALL_TOOLS.filter(t => t.name.startsWith('lp:'));

    test('should have 15 LP tools', () => {
      expect(lpTools.length).toBe(15);
    });

    test('should have pool management tools', () => {
      const toolNames = lpTools.map(t => t.name);
      expect(toolNames).toContain('lp:create_pool');
      expect(toolNames).toContain('lp:get_pool');
      expect(toolNames).toContain('lp:list_pools');
      expect(toolNames).toContain('lp:set_boost');
    });

    test('should have position tools', () => {
      const toolNames = lpTools.map(t => t.name);
      expect(toolNames).toContain('lp:add_liquidity');
      expect(toolNames).toContain('lp:remove_liquidity');
      expect(toolNames).toContain('lp:get_position');
      expect(toolNames).toContain('lp:get_positions');
    });

    test('should have reward tools', () => {
      const toolNames = lpTools.map(t => t.name);
      expect(toolNames).toContain('lp:claim_rewards');
      expect(toolNames).toContain('lp:get_pending_rewards');
      expect(toolNames).toContain('lp:get_apr');
    });

    test('should have stats tools', () => {
      const toolNames = lpTools.map(t => t.name);
      expect(toolNames).toContain('lp:get_provider_stats');
      expect(toolNames).toContain('lp:get_global_stats');
      expect(toolNames).toContain('lp:get_leaderboard');
      expect(toolNames).toContain('lp:get_staking_boost');
    });

    test('add_liquidity should have lock_duration enum', () => {
      const addLiquidity = lpTools.find(t => t.name === 'lp:add_liquidity');
      const lockDuration = addLiquidity?.inputSchema.properties?.lock_duration as { enum?: string[] };
      expect(lockDuration?.enum).toContain('7d');
      expect(lockDuration?.enum).toContain('365d');
    });
  });

  describe('Governance Namespace Tools', () => {
    const govTools = ALL_TOOLS.filter(t => t.name.startsWith('governance:'));

    test('should have action management tools', () => {
      const toolNames = govTools.map(t => t.name);
      expect(toolNames).toContain('governance:queue_action');
      expect(toolNames).toContain('governance:queue_batch');
      expect(toolNames).toContain('governance:execute');
      expect(toolNames).toContain('governance:execute_batch');
    });

    test('should have multi-sig tools', () => {
      const toolNames = govTools.map(t => t.name);
      expect(toolNames).toContain('governance:sign');
      expect(toolNames).toContain('governance:get_signatures');
    });

    test('should have query tools', () => {
      const toolNames = govTools.map(t => t.name);
      expect(toolNames).toContain('governance:get_action');
      expect(toolNames).toContain('governance:get_actions_by_status');
      expect(toolNames).toContain('governance:get_ready_actions');
      expect(toolNames).toContain('governance:get_pending_actions');
    });

    test('queue_action should have action_type enum', () => {
      const queueAction = govTools.find(t => t.name === 'governance:queue_action');
      const actionType = queueAction?.inputSchema.properties?.action_type as { enum?: string[] };
      expect(actionType?.enum).toContain('parameter_change');
      expect(actionType?.enum).toContain('emergency');
      expect(actionType?.enum).toContain('upgrade');
    });
  });

  describe('Bank Namespace Tools', () => {
    const bankTools = ALL_TOOLS.filter(t => t.name.startsWith('bank:'));

    test('should have bank integration tools', () => {
      const toolNames = bankTools.map(t => t.name);
      expect(toolNames).toContain('bank:get_wallets');
      expect(toolNames).toContain('bank:create_wallet');
      expect(toolNames).toContain('bank:simulate_trade');
    });
  });

  describe('Prompts', () => {
    test('should have expected prompts', () => {
      const promptNames = PROMPTS.map(p => p.name);
      expect(promptNames).toContain('investigate_wallet');
      expect(promptNames).toContain('analyze_market');
      expect(promptNames).toContain('optimize_liquidity');
      expect(promptNames).toContain('governance_review');
      expect(promptNames).toContain('portfolio_overview');
    });

    test('prompts should have name and description', () => {
      PROMPTS.forEach(prompt => {
        expect(prompt).toHaveProperty('name');
        expect(prompt).toHaveProperty('description');
        expect(prompt.name.length).toBeGreaterThan(0);
        expect(prompt.description.length).toBeGreaterThan(10);
      });
    });

    test('prompts with arguments should define them', () => {
      const walletPrompt = PROMPTS.find(p => p.name === 'investigate_wallet');
      expect(walletPrompt?.arguments).toBeDefined();
      expect(walletPrompt?.arguments?.length).toBeGreaterThan(0);
      expect(walletPrompt?.arguments?.[0].name).toBe('address');
    });
  });

  describe('Resources', () => {
    test('should have expected resources', () => {
      const resourceUris = RESOURCES.map(r => r.uri);
      expect(resourceUris).toContain('opensvm://namespaces');
      expect(resourceUris).toContain('opensvm://tools/summary');
      expect(resourceUris).toContain('opensvm://solana/network-status');
      expect(resourceUris).toContain('opensvm://kalshi/exchange-status');
    });

    test('resources should have uri, name, description, and mimeType', () => {
      RESOURCES.forEach(resource => {
        expect(resource).toHaveProperty('uri');
        expect(resource).toHaveProperty('name');
        expect(resource).toHaveProperty('description');
        expect(resource).toHaveProperty('mimeType');
        expect(resource.uri).toMatch(/^opensvm:\/\//);
      });
    });
  });

  describe('Server Creation', () => {
    test('should create server without config', () => {
      const server = createServer();
      expect(server).toBeDefined();
    });

    test('should create server with partial config', () => {
      const server = createServer({
        opensvmApiUrl: 'https://custom.api.com',
        requestTimeout: 60000,
      });
      expect(server).toBeDefined();
    });

    test('should create server with full config', () => {
      const server = createServer({
        opensvmApiUrl: 'https://osvm.ai',
        dflowApiUrl: 'https://prediction-markets-api.dflow.net',
        kalshiApiUrl: 'https://api.elections.kalshi.com/trade-api/v2',
        kalshiApiKeyId: 'test-key',
        kalshiPrivateKey: 'test-private-key',
        opensvmApiKey: 'test-api-key',
        requestTimeout: 30000,
      });
      expect(server).toBeDefined();
    });
  });

  describe('Tool Distribution', () => {
    test('should have balanced tool distribution across namespaces', () => {
      const distribution: Record<string, number> = {};

      ALL_TOOLS.forEach(tool => {
        const namespace = tool.name.split(':')[0];
        distribution[namespace] = (distribution[namespace] || 0) + 1;
      });

      // Each namespace should have at least 3 tools
      Object.entries(distribution).forEach(([, count]) => {
        expect(count).toBeGreaterThanOrEqual(3);
      });
    });

    test('should not have duplicate tool names', () => {
      const toolNames = ALL_TOOLS.map(t => t.name);
      const uniqueNames = new Set(toolNames);
      expect(uniqueNames.size).toBe(toolNames.length);
    });
  });

  describe('Input Schema Validation', () => {
    test('tools with required fields should specify them correctly', () => {
      ALL_TOOLS.forEach(tool => {
        if (tool.inputSchema.required && tool.inputSchema.required.length > 0) {
          const properties = tool.inputSchema.properties || {};
          (tool.inputSchema.required as string[]).forEach((requiredField: string) => {
            expect(properties).toHaveProperty(requiredField);
          });
        }
      });
    });

    test('enum fields should have valid values', () => {
      ALL_TOOLS.forEach(tool => {
        const properties = tool.inputSchema.properties || {};
        Object.entries(properties).forEach(([, prop]: [string, { enum?: string[] }]) => {
          if (prop.enum) {
            expect(Array.isArray(prop.enum)).toBe(true);
            expect(prop.enum.length).toBeGreaterThan(0);
          }
        });
      });
    });

    test('numeric fields should have reasonable constraints', () => {
      ALL_TOOLS.forEach(tool => {
        const properties = tool.inputSchema.properties || {};
        Object.entries(properties).forEach(([, prop]: [string, { type?: string; minimum?: number; maximum?: number }]) => {
          if (prop.type === 'integer' || prop.type === 'number') {
            // If minimum is set, it should be reasonable
            if (prop.minimum !== undefined) {
              expect(prop.minimum).toBeLessThan(Number.MAX_SAFE_INTEGER);
            }
            // If maximum is set, it should be greater than minimum
            if (prop.minimum !== undefined && prop.maximum !== undefined) {
              expect(prop.maximum).toBeGreaterThanOrEqual(prop.minimum);
            }
          }
        });
      });
    });
  });

  describe('Tool Naming Conventions', () => {
    test('tools should use snake_case after namespace', () => {
      ALL_TOOLS.forEach(tool => {
        const [, toolName] = tool.name.split(':');
        // Should not have uppercase letters
        expect(toolName).toBe(toolName.toLowerCase());
        // Should not have hyphens (use underscores)
        expect(toolName).not.toContain('-');
      });
    });

    test('tool names should be descriptive', () => {
      ALL_TOOLS.forEach(tool => {
        const [, toolName] = tool.name.split(':');
        // Should be at least 4 characters (some like 'sign' are short)
        expect(toolName.length).toBeGreaterThanOrEqual(4);
        // Should contain a verb or noun prefix (get_, list_, create_, etc.)
        // Note: some tools like 'search', 'sign', 'execute' don't have underscores
        const hasValidPrefix = /^(get_|list_|create_|add_|remove_|set_|search|find_|analyze_|explain_|claim_|queue_|execute|sign|is_|time_|filter_|expire_|simulate_|cancel_)/.test(toolName);
        expect(hasValidPrefix).toBe(true);
      });
    });
  });

  describe('Cross-Namespace Consistency', () => {
    test('similar operations should have similar naming', () => {
      // get_* operations
      const getTools = ALL_TOOLS.filter(t => t.name.includes(':get_'));
      expect(getTools.length).toBeGreaterThan(20);

      // list_* operations
      const listTools = ALL_TOOLS.filter(t => t.name.includes(':list_'));
      expect(listTools.length).toBeGreaterThan(3);

      // create_* operations
      const createTools = ALL_TOOLS.filter(t => t.name.includes(':create_'));
      expect(createTools.length).toBeGreaterThan(2);
    });

    test('similar tools across namespaces should have similar schemas', () => {
      // Market listing tools
      const kalshiListMarkets = ALL_TOOLS.find(t => t.name === 'kalshi:list_markets');
      const dflowGetMarkets = ALL_TOOLS.find(t => t.name === 'dflow:get_markets');

      // Both should support limit and cursor
      expect(kalshiListMarkets?.inputSchema.properties).toHaveProperty('limit');
      expect(dflowGetMarkets?.inputSchema.properties).toHaveProperty('limit');
    });
  });
});

describe('Tool Categories', () => {
  test('should have read-only tools for data queries', () => {
    const readOnlyPatterns = ['get_', 'list_', 'search_', 'find_', 'is_', 'time_'];
    const readOnlyTools = ALL_TOOLS.filter(tool => {
      const [, name] = tool.name.split(':');
      return readOnlyPatterns.some(p => name.startsWith(p));
    });

    expect(readOnlyTools.length).toBeGreaterThan(50);
  });

  test('should have mutating tools for state changes', () => {
    const mutatingPatterns = ['create_', 'add_', 'remove_', 'set_', 'claim_', 'queue_', 'execute_', 'sign_', 'cancel_', 'expire_'];
    const mutatingTools = ALL_TOOLS.filter(tool => {
      const [, name] = tool.name.split(':');
      return mutatingPatterns.some(p => name.startsWith(p));
    });

    // 13 mutating tools in the unified server
    expect(mutatingTools.length).toBeGreaterThanOrEqual(10);
  });

  test('should have analysis tools', () => {
    const analysisPatterns = ['analyze_', 'explain_', 'simulate_'];
    const analysisTools = ALL_TOOLS.filter(tool => {
      const [, name] = tool.name.split(':');
      return analysisPatterns.some(p => name.startsWith(p));
    });

    expect(analysisTools.length).toBeGreaterThan(2);
  });
});

console.log('OpenSVM Unified MCP Server Tests');
console.log('============================================================');
console.log(`Total tools: ${ALL_TOOLS.length}`);
console.log(`Namespaces: ${Object.keys(NAMESPACES).length}`);
console.log(`Prompts: ${PROMPTS.length}`);
console.log(`Resources: ${RESOURCES.length}`);
console.log('============================================================');
