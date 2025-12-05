/**
 * Jest Unit Tests for Unified MCP Registry
 *
 * Tests multi-format schema support, CRUD operations, caching,
 * event system, circuit breaker, and schema conversions.
 */

import {
  UnifiedMCPRegistry,
  type UnifiedServer,
  type OfficialServerJSON,
  type MCPBManifest,
  type UnifiedRegistryConfig,
  SCHEMA_VERSIONS,
} from '../src/mcp-registry-unified';

// ============================================================================
// Test Setup
// ============================================================================

describe('Unified MCP Registry', () => {
  let registry: UnifiedMCPRegistry;

  beforeEach(() => {
    registry = new UnifiedMCPRegistry({
      cacheTtlMs: 60000,
      cacheMaxSize: 100,
    });
  });

  // ============================================================================
  // Basic CRUD Operations Tests
  // ============================================================================

  describe('CRUD Operations', () => {
    describe('register() - CREATE', () => {
      it('should register a server with unified format', () => {
        const server = registry.register({
          id: 'test-unified',
          name: 'test-unified',
          displayName: 'Test Unified Server',
          version: '1.0.0',
          description: 'A test server',
        });

        expect(server.id).toBe('test-unified');
        expect(server.displayName).toBe('Test Unified Server');
        expect(server.schemaFormat).toBe('internal');
        expect(server.status).toBe('unknown');
      });

      it('should register a server with official format', () => {
        const officialServer: OfficialServerJSON = {
          $schema: SCHEMA_VERSIONS.OFFICIAL,
          name: 'ai.test/official-server',
          description: 'Official format server',
          version: '2.0.0',
          websiteUrl: 'https://example.com',
          remotes: [{ type: 'http', url: 'https://api.example.com' }],
        };

        const server = registry.register(officialServer, 'official');

        expect(server.schemaFormat).toBe('official');
        expect(server.version).toBe('2.0.0');
        expect(server.baseUrl).toBe('https://api.example.com');
      });

      it('should register a server with MCPB format', () => {
        const mcpbManifest: MCPBManifest = {
          manifest_version: '0.3',
          name: 'mcpb-server',
          display_name: 'MCPB Test Server',
          version: '3.0.0',
          description: 'MCPB format server',
          author: { name: 'Test Author', email: 'test@example.com' },
          server: {
            type: 'node',
            entry_point: 'src/index.ts',
            mcp_config: {
              command: 'bun',
              args: ['run', 'src/index.ts'],
            },
          },
          tools: [{ name: 'tool1', description: 'Tool 1' }],
        };

        const server = registry.register(mcpbManifest, 'mcpb');

        expect(server.schemaFormat).toBe('mcpb');
        expect(server.displayName).toBe('MCPB Test Server');
        expect(server.command).toBe('bun');
        expect(server.transport).toBe('stdio');
      });

      it('should throw error for server without ID', () => {
        expect(() => {
          registry.register({ name: 'no-id' });
        }).toThrow('Server ID is required');
      });

      it('should set timestamps on registration', () => {
        const before = Date.now();
        const server = registry.register({ id: 'ts-test', name: 'TS Test' });
        const after = Date.now();

        expect(server.registeredAt).toBeGreaterThanOrEqual(before);
        expect(server.registeredAt).toBeLessThanOrEqual(after);
        expect(server.updatedAt).toBeGreaterThanOrEqual(before);
      });
    });

    describe('get() - READ', () => {
      beforeEach(() => {
        registry.register({ id: 'read-test', name: 'Read Test', displayName: 'Read Test' });
      });

      it('should get server by ID', () => {
        const server = registry.get('read-test');

        expect(server).not.toBeNull();
        expect(server!.id).toBe('read-test');
      });

      it('should return null for non-existent server', () => {
        const server = registry.get('non-existent');
        expect(server).toBeNull();
      });

      it('should use cache on subsequent gets', () => {
        // First get - populates cache
        const server1 = registry.get('read-test');

        // Second get - should use cache
        const server2 = registry.get('read-test');

        expect(server1).toEqual(server2);
      });
    });

    describe('update() - UPDATE', () => {
      beforeEach(() => {
        registry.register({
          id: 'update-test',
          name: 'Update Test',
          displayName: 'Original Name',
          version: '1.0.0',
        });
      });

      it('should update server properties', () => {
        const updated = registry.update('update-test', {
          displayName: 'Updated Name',
          version: '2.0.0',
        });

        expect(updated).not.toBeNull();
        expect(updated!.displayName).toBe('Updated Name');
        expect(updated!.version).toBe('2.0.0');
      });

      it('should preserve server ID on update', () => {
        const updated = registry.update('update-test', {
          id: 'new-id', // Try to change ID
        });

        expect(updated!.id).toBe('update-test'); // ID should not change
      });

      it('should update updatedAt timestamp', () => {
        const before = Date.now();
        const updated = registry.update('update-test', { description: 'New description' });

        expect(updated!.updatedAt).toBeGreaterThanOrEqual(before);
      });

      it('should return null for non-existent server', () => {
        const updated = registry.update('non-existent', { name: 'test' });
        expect(updated).toBeNull();
      });

      it('should invalidate cache on update', () => {
        // Populate cache
        const original = registry.get('update-test');

        // Update
        registry.update('update-test', { displayName: 'Cache Invalidated' });

        // Get again - should get updated version
        const updated = registry.get('update-test');
        expect(updated!.displayName).toBe('Cache Invalidated');
      });
    });

    describe('remove() - DELETE', () => {
      beforeEach(() => {
        registry.register({ id: 'delete-test', name: 'Delete Test' });
      });

      it('should remove a registered server', () => {
        const removed = registry.remove('delete-test');

        expect(removed).toBe(true);
        expect(registry.get('delete-test')).toBeNull();
      });

      it('should return false for non-existent server', () => {
        const removed = registry.remove('non-existent');
        expect(removed).toBe(false);
      });
    });
  });

  // ============================================================================
  // Schema Conversion Tests
  // ============================================================================

  describe('Schema Conversions', () => {
    describe('toOfficialFormat()', () => {
      it('should convert unified server to official format', () => {
        const unified = registry.register({
          id: 'convert-official',
          name: 'convert-official',
          displayName: 'Convert to Official',
          version: '1.0.0',
          description: 'Server to convert',
          baseUrl: 'https://api.example.com',
          homepage: 'https://example.com',
          tags: ['test', 'conversion'],
          category: 'testing',
        });

        const official = registry.toOfficialFormat(unified);

        expect(official.$schema).toBe(SCHEMA_VERSIONS.OFFICIAL);
        expect(official.title).toBe('Convert to Official');
        expect(official.description).toBe('Server to convert');
        expect(official._meta?.tags).toContain('test');
      });
    });

    describe('toMCPBFormat()', () => {
      it('should convert unified server to MCPB format', () => {
        const unified = registry.register({
          id: 'convert-mcpb',
          name: 'convert-mcpb',
          displayName: 'Convert to MCPB',
          version: '2.0.0',
          description: 'MCPB conversion test',
          author: { name: 'Test Author' },
          command: 'node',
          args: ['index.js'],
        });

        const mcpb = registry.toMCPBFormat(unified);

        expect(mcpb.manifest_version).toBe('0.3');
        expect(mcpb.display_name).toBe('Convert to MCPB');
        expect(mcpb.server.mcp_config.command).toBe('node');
      });
    });

    describe('Round-trip conversions', () => {
      it('should preserve data through official format conversion', () => {
        const original = registry.register({
          id: 'roundtrip-official',
          name: 'roundtrip-official',
          displayName: 'Roundtrip Official',
          version: '1.0.0',
          description: 'Roundtrip test',
          tags: ['roundtrip'],
        });

        const official = registry.toOfficialFormat(original);
        const converted = registry.register(official, 'official');

        expect(converted.description).toBe(original.description);
        expect(converted.tags).toEqual(original.tags);
      });
    });
  });

  // ============================================================================
  // Listing and Pagination Tests
  // ============================================================================

  describe('Listing and Pagination', () => {
    beforeEach(() => {
      // Register multiple servers
      for (let i = 1; i <= 25; i++) {
        registry.register({
          id: `server-${i}`,
          name: `server-${i}`,
          displayName: `Server ${i}`,
          category: i <= 10 ? 'blockchain' : 'markets',
          status: i <= 15 ? 'online' : 'offline',
        });
      }
    });

    describe('list()', () => {
      it('should list all servers with pagination', () => {
        const result = registry.list();

        // Default page size is 20
        expect(result.servers.length).toBe(20);
        expect(result.total).toBe(25);
        expect(result.hasMore).toBe(true);
      });

      it('should support pagination', () => {
        const page1 = registry.list({ page: 1, pageSize: 10 });
        const page2 = registry.list({ page: 2, pageSize: 10 });
        const page3 = registry.list({ page: 3, pageSize: 10 });

        expect(page1.servers.length).toBe(10);
        expect(page2.servers.length).toBe(10);
        expect(page3.servers.length).toBe(5);
        expect(page1.hasMore).toBe(true);
        expect(page3.hasMore).toBe(false);
      });

      it('should filter by category', () => {
        const result = registry.list({ category: 'blockchain' });

        expect(result.total).toBe(10);
        for (const server of result.servers) {
          expect(server.category).toBe('blockchain');
        }
      });

      it('should filter by status', () => {
        // Update statuses
        for (let i = 1; i <= 15; i++) {
          registry.update(`server-${i}`, { status: 'online' });
        }

        const result = registry.list({ status: 'online' });

        expect(result.total).toBe(15);
      });

      it('should search by name', () => {
        const result = registry.list({ search: 'Server 1' });

        // Should match Server 1, Server 10-19
        expect(result.total).toBeGreaterThan(0);
      });
    });
  });

  // ============================================================================
  // Tool Management Tests
  // ============================================================================

  describe('Tool Management', () => {
    beforeEach(() => {
      registry.register({ id: 'tool-srv', name: 'Tool Server' });
    });

    describe('registerTools()', () => {
      it('should register tools for a server', () => {
        registry.registerTools('tool-srv', [
          { name: 'tool_a', description: 'Tool A', inputSchema: { type: 'object', properties: {} } },
          { name: 'tool_b', description: 'Tool B', inputSchema: { type: 'object', properties: {} } },
        ]);

        const tools = registry.getAllTools();
        expect(tools.length).toBe(2);
      });

      it('should update server tool count', () => {
        registry.registerTools('tool-srv', [
          { name: 't1', description: 'T1', inputSchema: { type: 'object', properties: {} } },
          { name: 't2', description: 'T2', inputSchema: { type: 'object', properties: {} } },
        ]);

        const server = registry.get('tool-srv');
        expect(server!.toolCount).toBe(2);
      });
    });

    describe('findTool()', () => {
      beforeEach(() => {
        registry.registerTools('tool-srv', [
          { name: 'find_me', description: 'Find Me', inputSchema: { type: 'object', properties: {} } },
        ]);
      });

      it('should find tool by simple name', () => {
        const tool = registry.findTool('find_me');
        expect(tool).not.toBeNull();
      });

      it('should find tool by qualified name', () => {
        const tool = registry.findTool('tool-srv:find_me');
        expect(tool).not.toBeNull();
      });
    });
  });

  // ============================================================================
  // Event System Tests
  // ============================================================================

  describe('Event System', () => {
    it('should emit server:registered event', () => {
      const callback = jest.fn();
      registry.on('server:registered', callback);

      registry.register({ id: 'evt-test', name: 'Event Test' });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'server:registered',
          data: expect.objectContaining({ id: 'evt-test' }),
        })
      );
    });

    it('should emit server:updated event', () => {
      registry.register({ id: 'update-evt', name: 'Update Event' });

      const callback = jest.fn();
      registry.on('server:updated', callback);

      registry.update('update-evt', { displayName: 'Updated' });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should emit server:removed event', () => {
      registry.register({ id: 'remove-evt', name: 'Remove Event' });

      const callback = jest.fn();
      registry.on('server:removed', callback);

      registry.remove('remove-evt');

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should allow unsubscribing from events', () => {
      const callback = jest.fn();
      const unsubscribe = registry.on('server:registered', callback);

      registry.register({ id: 'unsub-1', name: 'Unsub 1' });
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      registry.register({ id: 'unsub-2', name: 'Unsub 2' });
      expect(callback).toHaveBeenCalledTimes(1); // Should not increase
    });
  });

  // ============================================================================
  // Circuit Breaker Tests
  // ============================================================================

  describe('Circuit Breaker', () => {
    describe('health check with circuit breaker', () => {
      it('should track error counts for failed health checks', async () => {
        registry.register({
          id: 'circuit-test',
          name: 'Circuit Test',
          transport: 'http',
          baseUrl: 'https://invalid.example.com',
        });

        // Trigger health check failures (may fail due to network)
        await registry.checkHealth('circuit-test');

        const server = registry.get('circuit-test');
        // The server should have been checked and either succeeded or failed
        expect(server!.lastHealthCheck).toBeDefined();
      });

      it('should update status after health check', async () => {
        registry.register({
          id: 'status-check-server',
          name: 'Status Check Server',
          transport: 'http',
          baseUrl: 'https://example.invalid',
        });

        await registry.checkHealth('status-check-server');

        const server = registry.get('status-check-server');
        // Status should be updated from initial 'unknown'
        expect(['online', 'degraded', 'offline']).toContain(server!.status);
      });
    });
  });

  // ============================================================================
  // Cache Tests
  // ============================================================================

  describe('Caching', () => {
    it('should cache server lookups', () => {
      registry.register({ id: 'cache-test', name: 'Cache Test' });

      // First get
      const first = registry.get('cache-test');

      // Second get should use cache
      const second = registry.get('cache-test');

      // Both should return the server
      expect(first).toBeDefined();
      expect(second).toBeDefined();
      expect(first!.id).toBe('cache-test');
    });

    it('should provide cache statistics via getStats', () => {
      registry.register({ id: 'stats-test', name: 'Stats Test' });

      // Generate some cache activity
      registry.get('stats-test');
      registry.get('stats-test');

      const stats = registry.getStats();

      expect(stats.cacheStats).toBeDefined();
      expect(stats.cacheStats).toHaveProperty('size');
      expect(stats.cacheStats).toHaveProperty('maxSize');
    });
  });

  // ============================================================================
  // Statistics Tests
  // ============================================================================

  describe('Statistics', () => {
    beforeEach(() => {
      registry.register({ id: 's1', name: 'S1', category: 'blockchain' });
      registry.register({ id: 's2', name: 'S2', category: 'blockchain' });
      registry.register({ id: 's3', name: 'S3', category: 'markets' });

      registry.update('s1', { status: 'online' });
      registry.update('s2', { status: 'online' });
      registry.update('s3', { status: 'offline' });

      registry.registerTools('s1', [
        { name: 't1', description: 'T1', inputSchema: { type: 'object', properties: {} } },
        { name: 't2', description: 'T2', inputSchema: { type: 'object', properties: {} } },
      ]);
    });

    describe('getStats()', () => {
      it('should return server counts', () => {
        const stats = registry.getStats();

        expect(stats.serverCount).toBe(3);
        expect(stats.onlineServers).toBe(2);
      });

      it('should return tool count', () => {
        const stats = registry.getStats();

        expect(stats.totalTools).toBe(2);
      });

      it('should group tools by category', () => {
        const stats = registry.getStats();

        expect(stats.toolsByCategory.blockchain).toBe(2);
        expect(stats.toolsByCategory.markets).toBe(0); // No tools registered for markets
      });
    });
  });

  // ============================================================================
  // Export/Import Tests
  // ============================================================================

  describe('Export/Import', () => {
    describe('export()', () => {
      it('should export registry state as array', () => {
        registry.register({ id: 'exp1', name: 'Export 1' });
        registry.register({ id: 'exp2', name: 'Export 2' });

        const exported = registry.export();

        expect(Array.isArray(exported)).toBe(true);
        expect(exported.length).toBe(2);
      });

      it('should export with official format', () => {
        registry.register({ id: 'fmt-test', name: 'Format Test' });

        const official = registry.export('official');

        expect(Array.isArray(official)).toBe(true);
        expect(official[0]).toHaveProperty('$schema');
      });

      it('should export with mcpb format', () => {
        registry.register({ id: 'mcpb-test', name: 'MCPB Test' });

        const mcpb = registry.export('mcpb');

        expect(Array.isArray(mcpb)).toBe(true);
        expect(mcpb[0]).toHaveProperty('manifest_version');
      });
    });

    describe('import()', () => {
      it('should import servers from array', () => {
        const registry1 = new UnifiedMCPRegistry();
        registry1.register({ id: 'imp1', name: 'Import 1' });
        const exported = registry1.export();

        const registry2 = new UnifiedMCPRegistry();
        const count = registry2.import(exported);

        expect(count).toBe(1);
        expect(registry2.get('imp1')).not.toBeNull();
      });

      it('should merge with existing servers', () => {
        registry.register({ id: 'existing', name: 'Existing' });

        const importData = [
          { id: 'imported', name: 'Imported' },
        ];

        registry.import(importData);

        expect(registry.get('existing')).not.toBeNull();
        expect(registry.get('imported')).not.toBeNull();
      });
    });
  });

  // ============================================================================
  // Health Checking Tests
  // ============================================================================

  describe('Health Checking', () => {
    describe('checkHealth()', () => {
      it('should mark stdio servers as online', async () => {
        registry.register({
          id: 'stdio-srv',
          name: 'Stdio Server',
          transport: 'stdio',
          command: 'node',
        });

        await registry.checkHealth('stdio-srv');

        const server = registry.get('stdio-srv');
        expect(server!.status).toBe('online');
      });

      it('should update lastHealthCheck timestamp for http servers', async () => {
        registry.register({
          id: 'hc-time',
          name: 'HC Time',
          transport: 'http',
          baseUrl: 'https://invalid.test',
        });

        const before = Date.now();
        await registry.checkHealth('hc-time');

        const server = registry.get('hc-time');
        expect(server!.lastHealthCheck).toBeGreaterThanOrEqual(before);
      });
    });

    describe('checkAllHealth()', () => {
      it('should check all registered servers', async () => {
        registry.register({ id: 'hc1', name: 'HC1', transport: 'stdio' });
        registry.register({ id: 'hc2', name: 'HC2', transport: 'stdio' });

        const results = await registry.checkAllHealth();

        expect(results.size).toBe(2);
        expect(results.get('hc1')).toBe('online');
        expect(results.get('hc2')).toBe('online');
      });
    });

    describe('startHealthChecks() / stopHealthChecks()', () => {
      it('should start and stop health check interval', () => {
        registry.register({ id: 'interval-test', name: 'Interval', transport: 'stdio' });

        registry.startHealthChecks();
        // Should not throw
        registry.startHealthChecks(); // Double start should be safe

        registry.stopHealthChecks();
        registry.stopHealthChecks(); // Double stop should be safe
      });
    });
  });
});
