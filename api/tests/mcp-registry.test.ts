/**
 * Jest Unit Tests for MCP Registry
 *
 * Tests server registration, tool routing, discovery,
 * health checking, and gateway functionality.
 */

import {
  MCPRegistry,
  createRegistry,
  getRegistry,
  createGatewayTools,
  type MCPServerInfo,
  type RegisteredTool,
  type RegistryConfig,
} from '../src/mcp-registry';

// ============================================================================
// Test Setup
// ============================================================================

describe('MCP Registry', () => {
  let registry: MCPRegistry;

  beforeEach(() => {
    // Create fresh registry for each test
    registry = new MCPRegistry({
      enableConfigDiscovery: false,
      enableHttpDiscovery: false,
      enableDnsDiscovery: false,
    });
  });

  // ============================================================================
  // Server Registration Tests
  // ============================================================================

  describe('Server Registration', () => {
    describe('registerServer()', () => {
      it('should register a server with minimal info', () => {
        const server = registry.registerServer({
          id: 'test-server',
          name: 'Test Server',
        });

        expect(server.id).toBe('test-server');
        expect(server.name).toBe('Test Server');
        expect(server.version).toBe('1.0.0'); // default
        expect(server.transport).toBe('http'); // default
        expect(server.status).toBe('unknown'); // default
        expect(server.errorCount).toBe(0);
      });

      it('should register a server with full info', () => {
        const server = registry.registerServer({
          id: 'full-server',
          name: 'Full Server',
          version: '2.0.0',
          description: 'A fully configured server',
          baseUrl: 'https://api.example.com',
          transport: 'http',
          capabilities: {
            tools: true,
            prompts: true,
            resources: true,
            sampling: false,
            logging: true,
          },
          author: 'Test Author',
          repository: 'https://github.com/test/server',
          documentation: 'https://docs.example.com',
          tags: ['test', 'example'],
          category: 'testing',
        });

        expect(server.version).toBe('2.0.0');
        expect(server.description).toBe('A fully configured server');
        expect(server.capabilities.prompts).toBe(true);
        expect(server.author).toBe('Test Author');
        expect(server.tags).toContain('test');
      });

      it('should notify discovery callbacks on registration', () => {
        const callback = jest.fn();
        registry.onServerDiscovered(callback);

        registry.registerServer({ id: 'cb-test', name: 'Callback Test' });

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'cb-test' })
        );
      });

      it('should allow multiple servers to be registered', () => {
        registry.registerServer({ id: 's1', name: 'Server 1' });
        registry.registerServer({ id: 's2', name: 'Server 2' });
        registry.registerServer({ id: 's3', name: 'Server 3' });

        const servers = registry.getServers();
        expect(servers.length).toBe(3);
      });
    });

    describe('unregisterServer()', () => {
      it('should remove a registered server', () => {
        registry.registerServer({ id: 'to-remove', name: 'Remove Me' });

        const removed = registry.unregisterServer('to-remove');

        expect(removed).toBe(true);
        expect(registry.getServer('to-remove')).toBeNull();
      });

      it('should return false for non-existent server', () => {
        const removed = registry.unregisterServer('non-existent');
        expect(removed).toBe(false);
      });

      it('should remove server tools when unregistering', () => {
        registry.registerServer({ id: 'srv', name: 'Server' });
        registry.registerTools('srv', [
          { name: 'tool1', description: 'Tool 1', inputSchema: { type: 'object', properties: {} } },
          { name: 'tool2', description: 'Tool 2', inputSchema: { type: 'object', properties: {} } },
        ]);

        const beforeCount = registry.getAllTools().length;
        registry.unregisterServer('srv');
        const afterCount = registry.getAllTools().length;

        expect(afterCount).toBeLessThan(beforeCount);
        expect(registry.findTool('tool1')).toBeNull();
      });
    });

    describe('getServer()', () => {
      it('should return server by ID', () => {
        registry.registerServer({ id: 'get-test', name: 'Get Test' });

        const server = registry.getServer('get-test');

        expect(server).not.toBeNull();
        expect(server!.name).toBe('Get Test');
      });

      it('should return null for unknown server', () => {
        const server = registry.getServer('unknown');
        expect(server).toBeNull();
      });
    });

    describe('getServers()', () => {
      it('should return all registered servers', () => {
        registry.registerServer({ id: 's1', name: 'S1' });
        registry.registerServer({ id: 's2', name: 'S2' });

        const servers = registry.getServers();

        expect(servers.length).toBe(2);
        expect(servers.map(s => s.id)).toContain('s1');
        expect(servers.map(s => s.id)).toContain('s2');
      });

      it('should return empty array when no servers registered', () => {
        const servers = registry.getServers();
        expect(servers).toEqual([]);
      });
    });
  });

  // ============================================================================
  // Tool Registration Tests
  // ============================================================================

  describe('Tool Registration', () => {
    beforeEach(() => {
      registry.registerServer({ id: 'tool-server', name: 'Tool Server' });
    });

    describe('registerTools()', () => {
      it('should register tools for a server', () => {
        registry.registerTools('tool-server', [
          { name: 'tool_a', description: 'Tool A', inputSchema: { type: 'object', properties: {} } },
          { name: 'tool_b', description: 'Tool B', inputSchema: { type: 'object', properties: {} } },
        ]);

        const tools = registry.getAllTools();
        expect(tools.length).toBe(2);
      });

      it('should set qualified name on tools', () => {
        registry.registerTools('tool-server', [
          { name: 'my_tool', description: 'My Tool', inputSchema: { type: 'object', properties: {} } },
        ]);

        const tool = registry.findTool('tool-server:my_tool');
        expect(tool).not.toBeNull();
        expect(tool!.qualifiedName).toBe('tool-server:my_tool');
      });

      it('should update server tool count', () => {
        registry.registerTools('tool-server', [
          { name: 't1', description: 'T1', inputSchema: { type: 'object', properties: {} } },
          { name: 't2', description: 'T2', inputSchema: { type: 'object', properties: {} } },
          { name: 't3', description: 'T3', inputSchema: { type: 'object', properties: {} } },
        ]);

        const server = registry.getServer('tool-server');
        expect(server!.toolCount).toBe(3);
      });

      it('should throw error for non-existent server', () => {
        expect(() => {
          registry.registerTools('non-existent', [
            { name: 'tool', description: 'Tool', inputSchema: { type: 'object', properties: {} } },
          ]);
        }).toThrow('Server not found');
      });
    });

    describe('findTool()', () => {
      beforeEach(() => {
        registry.registerTools('tool-server', [
          { name: 'search_tool', description: 'Search', inputSchema: { type: 'object', properties: {} } },
        ]);
      });

      it('should find tool by simple name', () => {
        const tool = registry.findTool('search_tool');
        expect(tool).not.toBeNull();
        expect(tool!.name).toBe('search_tool');
      });

      it('should find tool by qualified name', () => {
        const tool = registry.findTool('tool-server:search_tool');
        expect(tool).not.toBeNull();
      });

      it('should return null for unknown tool', () => {
        const tool = registry.findTool('unknown_tool');
        expect(tool).toBeNull();
      });
    });

    describe('getAllTools()', () => {
      it('should return unique tools', () => {
        registry.registerTools('tool-server', [
          { name: 'unique1', description: 'U1', inputSchema: { type: 'object', properties: {} } },
          { name: 'unique2', description: 'U2', inputSchema: { type: 'object', properties: {} } },
        ]);

        const tools = registry.getAllTools();
        const names = tools.map(t => t.qualifiedName);
        const uniqueNames = new Set(names);

        expect(names.length).toBe(uniqueNames.size);
      });
    });

    describe('getToolsByServer()', () => {
      it('should group tools by server', () => {
        registry.registerServer({ id: 'srv-a', name: 'Server A' });
        registry.registerServer({ id: 'srv-b', name: 'Server B' });

        registry.registerTools('srv-a', [
          { name: 'a1', description: 'A1', inputSchema: { type: 'object', properties: {} } },
        ]);
        registry.registerTools('srv-b', [
          { name: 'b1', description: 'B1', inputSchema: { type: 'object', properties: {} } },
          { name: 'b2', description: 'B2', inputSchema: { type: 'object', properties: {} } },
        ]);

        const byServer = registry.getToolsByServer();

        expect(byServer.get('srv-a')?.length).toBe(1);
        expect(byServer.get('srv-b')?.length).toBe(2);
      });
    });
  });

  // ============================================================================
  // Tool Routing Tests
  // ============================================================================

  describe('Tool Routing', () => {
    beforeEach(() => {
      registry.registerServer({ id: 'router-srv', name: 'Router Server' });
      registry.registerTools('router-srv', [
        { name: 'route_me', description: 'Route Me', inputSchema: { type: 'object', properties: {} } },
      ]);
    });

    describe('routeToolCall()', () => {
      it('should route tool call to correct server', async () => {
        const executor = jest.fn().mockResolvedValue({ result: 'success' });

        const result = await registry.routeToolCall('route_me', { arg: 'value' }, executor);

        expect(result.success).toBe(true);
        expect(result.serverId).toBe('router-srv');
        expect(executor).toHaveBeenCalledWith('router-srv', 'route_me', { arg: 'value' });
      });

      it('should return error for unknown tool', async () => {
        const executor = jest.fn();

        const result = await registry.routeToolCall('unknown_tool', {}, executor);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Tool not found');
        expect(executor).not.toHaveBeenCalled();
      });

      it('should return error for offline server', async () => {
        const server = registry.getServer('router-srv')!;
        server.status = 'offline';

        const executor = jest.fn();
        const result = await registry.routeToolCall('route_me', {}, executor);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Server offline');
      });

      it('should track call statistics', async () => {
        const executor = jest.fn().mockResolvedValue({ data: 'test' });

        await registry.routeToolCall('route_me', {}, executor);
        await registry.routeToolCall('route_me', {}, executor);

        const tool = registry.findTool('route_me');
        expect(tool!.callCount).toBe(2);
        expect(tool!.lastCalled).toBeDefined();
      });

      it('should handle executor errors', async () => {
        const executor = jest.fn().mockRejectedValue(new Error('Executor failed'));

        const result = await registry.routeToolCall('route_me', {}, executor);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Executor failed');
      });

      it('should measure latency', async () => {
        const executor = jest.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return { done: true };
        });

        const result = await registry.routeToolCall('route_me', {}, executor);

        expect(result.latencyMs).toBeGreaterThan(0);
      });
    });
  });

  // ============================================================================
  // Discovery Tests
  // ============================================================================

  describe('Discovery', () => {
    describe('discover()', () => {
      it('should discover from config when enabled', async () => {
        const configRegistry = new MCPRegistry({
          enableConfigDiscovery: true,
          enableHttpDiscovery: false,
          enableDnsDiscovery: false,
        });

        const results = await configRegistry.discover();

        const configResult = results.find(r => r.source === 'config');
        expect(configResult).toBeDefined();
        expect(configResult!.servers.length).toBeGreaterThan(0);
      });

      it('should include timestamp in discovery results', async () => {
        const results = await registry.discover();

        for (const result of results) {
          expect(result.timestamp).toBeDefined();
          expect(result.timestamp).toBeLessThanOrEqual(Date.now());
        }
      });
    });

    describe('onServerDiscovered()', () => {
      it('should register callback for new discoveries', () => {
        const discoveries: MCPServerInfo[] = [];

        registry.onServerDiscovered((server) => {
          discoveries.push(server);
        });

        registry.registerServer({ id: 'd1', name: 'Discovery 1' });
        registry.registerServer({ id: 'd2', name: 'Discovery 2' });

        expect(discoveries.length).toBe(2);
      });
    });
  });

  // ============================================================================
  // Health Check Tests
  // ============================================================================

  describe('Health Checking', () => {
    describe('checkServerHealth()', () => {
      it('should return unknown for non-existent server', async () => {
        const status = await registry.checkServerHealth('non-existent');
        expect(status).toBe('unknown');
      });

      it('should set stdio servers as online', async () => {
        registry.registerServer({
          id: 'stdio-srv',
          name: 'Stdio Server',
          transport: 'stdio',
        });

        const status = await registry.checkServerHealth('stdio-srv');
        expect(status).toBe('online');
      });
    });

    describe('checkAllServersHealth()', () => {
      it('should check all registered servers', async () => {
        registry.registerServer({ id: 'h1', name: 'H1', transport: 'stdio' });
        registry.registerServer({ id: 'h2', name: 'H2', transport: 'stdio' });

        const results = await registry.checkAllServersHealth();

        expect(results.size).toBe(2);
        expect(results.get('h1')).toBe('online');
        expect(results.get('h2')).toBe('online');
      });
    });

    describe('startHealthChecks() / stopHealthChecks()', () => {
      it('should start and stop health check interval', () => {
        registry.registerServer({ id: 'interval-test', name: 'Interval', transport: 'stdio' });

        registry.startHealthChecks();
        // Should not throw
        registry.startHealthChecks(); // Double start should be safe

        registry.stopHealthChecks();
        registry.stopHealthChecks(); // Double stop should be safe
      });
    });
  });

  // ============================================================================
  // Statistics Tests
  // ============================================================================

  describe('Statistics', () => {
    describe('getStats()', () => {
      it('should return correct counts', () => {
        registry.registerServer({ id: 's1', name: 'S1', category: 'cat-a' });
        registry.registerServer({ id: 's2', name: 'S2', category: 'cat-b' });
        registry.registerTools('s1', [
          { name: 't1', description: 'T1', inputSchema: { type: 'object', properties: {} } },
        ]);
        registry.registerTools('s2', [
          { name: 't2', description: 'T2', inputSchema: { type: 'object', properties: {} } },
          { name: 't3', description: 'T3', inputSchema: { type: 'object', properties: {} } },
        ]);

        const stats = registry.getStats();

        expect(stats.serverCount).toBe(2);
        expect(stats.totalTools).toBe(3);
        expect(stats.toolsByCategory['cat-a']).toBe(1);
        expect(stats.toolsByCategory['cat-b']).toBe(2);
      });

      it('should count online servers', () => {
        registry.registerServer({ id: 'on1', name: 'Online 1' });
        registry.registerServer({ id: 'on2', name: 'Online 2' });

        const server1 = registry.getServer('on1')!;
        const server2 = registry.getServer('on2')!;
        server1.status = 'online';
        server2.status = 'offline';

        const stats = registry.getStats();

        expect(stats.onlineServers).toBe(1);
      });
    });
  });

  // ============================================================================
  // Export/Import Tests
  // ============================================================================

  describe('Export/Import', () => {
    describe('export()', () => {
      it('should export registry state', () => {
        registry.registerServer({ id: 'exp', name: 'Export Test' });
        registry.registerTools('exp', [
          { name: 'exp_tool', description: 'Export', inputSchema: { type: 'object', properties: {} } },
        ]);

        const exported = registry.export();

        expect(exported.servers.length).toBe(1);
        expect(exported.tools.length).toBe(1);
        expect(exported.config).toBeDefined();
      });
    });

    describe('import()', () => {
      it('should import servers from exported data', () => {
        const registry1 = new MCPRegistry({ enableConfigDiscovery: false });
        registry1.registerServer({ id: 'imp', name: 'Import Test' });
        const exported = registry1.export();

        const registry2 = new MCPRegistry({ enableConfigDiscovery: false });
        registry2.import({ servers: exported.servers });

        expect(registry2.getServer('imp')).not.toBeNull();
      });

      it('should import config overrides', () => {
        registry.import({
          config: {
            healthCheckIntervalMs: 60000,
            enableLoadBalancing: false,
          },
        });

        const exported = registry.export();
        expect(exported.config.healthCheckIntervalMs).toBe(60000);
      });
    });
  });

  // ============================================================================
  // Gateway Tools Tests
  // ============================================================================

  describe('Gateway Tools', () => {
    describe('createGatewayTools()', () => {
      it('should include management tools', () => {
        const tools = createGatewayTools(registry);

        const managementToolNames = [
          'registry_list_servers',
          'registry_list_tools',
          'registry_server_health',
          'registry_stats',
          'registry_discover',
        ];

        for (const name of managementToolNames) {
          expect(tools.find(t => t.name === name)).toBeDefined();
        }
      });

      it('should include registered server tools', () => {
        registry.registerServer({ id: 'gw', name: 'Gateway' });
        registry.registerTools('gw', [
          { name: 'custom_tool', description: 'Custom', inputSchema: { type: 'object', properties: {} } },
        ]);

        const tools = createGatewayTools(registry);

        expect(tools.find(t => t.name === 'custom_tool')).toBeDefined();
      });

      it('should have proper input schemas on management tools', () => {
        const tools = createGatewayTools(registry);
        const listServers = tools.find(t => t.name === 'registry_list_servers');

        expect(listServers!.inputSchema).toBeDefined();
        expect(listServers!.inputSchema.type).toBe('object');
      });
    });
  });

  // ============================================================================
  // Global Registry Tests
  // ============================================================================

  describe('Global Registry', () => {
    describe('getRegistry()', () => {
      it('should return singleton instance', () => {
        const r1 = getRegistry();
        const r2 = getRegistry();
        expect(r1).toBe(r2);
      });
    });

    describe('createRegistry()', () => {
      it('should create new registry with config', () => {
        const newRegistry = createRegistry({
          healthCheckIntervalMs: 45000,
        });

        expect(newRegistry).toBeDefined();
      });
    });
  });
});
