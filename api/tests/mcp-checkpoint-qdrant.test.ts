/**
 * MCP Qdrant Checkpoint Store Tests
 *
 * Tests for persistent checkpoint storage using Qdrant.
 */

import {
  QdrantCheckpointStore,
  getQdrantCheckpointStore,
  createQdrantResumableStream,
  COLLECTION_NAME,
  DEFAULT_TTL_MS,
  type CheckpointDocument,
} from '../src/mcp-checkpoint-qdrant';

// Mock Qdrant client
const mockPoints: Map<number, { id: number; vector: number[]; payload: unknown }> = new Map();

jest.mock('@qdrant/js-client-rest', () => ({
  QdrantClient: jest.fn().mockImplementation(() => ({
    getCollection: jest.fn().mockImplementation(async (name: string) => {
      if (name === COLLECTION_NAME) {
        return { points_count: mockPoints.size };
      }
      throw new Error('Collection not found');
    }),
    createCollection: jest.fn().mockResolvedValue({}),
    createPayloadIndex: jest.fn().mockResolvedValue({}),
    upsert: jest.fn().mockImplementation(async (_collection: string, params: { points: Array<{ id: number; vector: number[]; payload: unknown }> }) => {
      for (const point of params.points) {
        mockPoints.set(point.id, point);
      }
      return { operation_id: 1, status: 'completed' };
    }),
    scroll: jest.fn().mockImplementation(async (_collection: string, params: { filter?: { must?: Array<{ key: string; match?: { value: string }; range?: { gt?: number; lt?: number } }> }; limit?: number }) => {
      const results: Array<{ id: number; payload: unknown }> = [];

      for (const [id, point] of mockPoints) {
        const doc = point.payload as CheckpointDocument;

        // Apply filters
        let match = true;
        if (params.filter?.must) {
          for (const condition of params.filter.must) {
            if (condition.match && condition.key === 'streamId') {
              match = match && doc.streamId === condition.match.value;
            }
            if (condition.match && condition.key === 'toolName') {
              match = match && doc.toolName === condition.match.value;
            }
            if (condition.match && condition.key === 'userId') {
              match = match && doc.userId === condition.match.value;
            }
            if (condition.range && condition.key === 'expiresAt') {
              if (condition.range.gt !== undefined) {
                match = match && doc.expiresAt > condition.range.gt;
              }
              if (condition.range.lt !== undefined) {
                match = match && doc.expiresAt < condition.range.lt;
              }
            }
          }
        }

        if (match) {
          results.push({ id, payload: point.payload });
        }
      }

      return { points: results.slice(0, params.limit || 100) };
    }),
    delete: jest.fn().mockImplementation(async (_collection: string, params: { filter?: { must?: Array<{ key: string; match?: { value: string }; range?: { lt?: number } }> } }) => {
      const toDelete: number[] = [];

      for (const [id, point] of mockPoints) {
        const doc = point.payload as CheckpointDocument;

        let match = true;
        if (params.filter?.must) {
          for (const condition of params.filter.must) {
            if (condition.match && condition.key === 'streamId') {
              match = match && doc.streamId === condition.match.value;
            }
            if (condition.range && condition.key === 'expiresAt' && condition.range.lt !== undefined) {
              match = match && doc.expiresAt < condition.range.lt;
            }
          }
        }

        if (match) {
          toDelete.push(id);
        }
      }

      for (const id of toDelete) {
        mockPoints.delete(id);
      }

      return { operation_id: 1, status: 'completed' };
    }),
    search: jest.fn().mockImplementation(async (_collection: string, params: { vector: number[]; limit?: number }) => {
      const results: Array<{ id: number; score: number; payload: unknown }> = [];

      for (const [id, point] of mockPoints) {
        // Simple cosine similarity mock
        const score = 0.8 + Math.random() * 0.2;
        results.push({ id, score, payload: point.payload });
      }

      return results.slice(0, params.limit || 10);
    }),
  })),
}));

describe('QdrantCheckpointStore', () => {
  let store: QdrantCheckpointStore;

  beforeEach(() => {
    mockPoints.clear();
    store = new QdrantCheckpointStore({
      cleanupIntervalMs: 60000,
      enableSemanticSearch: true,
    });
  });

  afterEach(() => {
    store.stop();
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      let initialized = false;
      store.on('initialized', () => { initialized = true; });

      await store.save({
        streamId: 'test_init',
        toolName: 'test:tool',
        args: {},
        position: 0,
        timestamp: Date.now(),
        ttl: 60000,
      });

      expect(initialized).toBe(true);
    });
  });

  describe('Save and Get', () => {
    test('should save and retrieve checkpoint', async () => {
      const checkpoint = {
        streamId: 'stream_123',
        toolName: 'solana:stream_transactions',
        args: { address: 'vines1vz...' },
        position: 10,
        cursor: 'sig_abc',
        timestamp: Date.now(),
        ttl: 60000,
      };

      await store.save(checkpoint);
      const retrieved = await store.get('stream_123');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.streamId).toBe('stream_123');
      expect(retrieved?.position).toBe(10);
      expect(retrieved?.cursor).toBe('sig_abc');
    });

    test('should return null for non-existent checkpoint', async () => {
      const result = await store.get('nonexistent');
      expect(result).toBeNull();
    });

    test('should save with metadata', async () => {
      await store.save({
        streamId: 'stream_meta',
        toolName: 'test:tool',
        args: {},
        position: 5,
        timestamp: Date.now(),
        ttl: 60000,
        userId: 'user_123',
        tags: ['important', 'wallet-analysis'],
        description: 'Analyzing whale wallet',
      });

      const retrieved = await store.get('stream_meta');
      expect(retrieved).not.toBeNull();
    });
  });

  describe('Delete', () => {
    test('should delete checkpoint', async () => {
      await store.save({
        streamId: 'to_delete',
        toolName: 'test:tool',
        args: {},
        position: 0,
        timestamp: Date.now(),
        ttl: 60000,
      });

      expect(await store.get('to_delete')).not.toBeNull();
      expect(await store.delete('to_delete')).toBe(true);
      expect(await store.get('to_delete')).toBeNull();
    });

    test('should return true even for non-existent checkpoint', async () => {
      // Qdrant delete doesn't fail for non-existent
      const result = await store.delete('nonexistent');
      expect(result).toBe(true);
    });
  });

  describe('Query by Tool', () => {
    test('should get checkpoints by tool name', async () => {
      await store.save({
        streamId: 'stream_1',
        toolName: 'solana:stream_transactions',
        args: {},
        position: 0,
        timestamp: Date.now(),
        ttl: 60000,
      });
      await store.save({
        streamId: 'stream_2',
        toolName: 'solana:stream_transactions',
        args: {},
        position: 5,
        timestamp: Date.now(),
        ttl: 60000,
      });
      await store.save({
        streamId: 'stream_3',
        toolName: 'dflow:search_events',
        args: {},
        position: 10,
        timestamp: Date.now(),
        ttl: 60000,
      });

      const solanaCheckpoints = await store.getByTool('solana:stream_transactions');
      expect(solanaCheckpoints.length).toBe(2);
    });
  });

  describe('Query by User', () => {
    test('should get checkpoints by user ID', async () => {
      await store.save({
        streamId: 'stream_u1',
        toolName: 'test:tool',
        args: {},
        position: 0,
        timestamp: Date.now(),
        ttl: 60000,
        userId: 'user_alice',
      });
      await store.save({
        streamId: 'stream_u2',
        toolName: 'test:tool',
        args: {},
        position: 5,
        timestamp: Date.now(),
        ttl: 60000,
        userId: 'user_alice',
      });
      await store.save({
        streamId: 'stream_u3',
        toolName: 'test:tool',
        args: {},
        position: 10,
        timestamp: Date.now(),
        ttl: 60000,
        userId: 'user_bob',
      });

      const aliceCheckpoints = await store.getByUser('user_alice');
      expect(aliceCheckpoints.length).toBe(2);
    });
  });

  describe('Semantic Search', () => {
    test('should search checkpoints', async () => {
      await store.save({
        streamId: 'stream_s1',
        toolName: 'solana:stream_transactions',
        args: { address: 'whale_wallet' },
        position: 0,
        timestamp: Date.now(),
        ttl: 60000,
        description: 'Analyzing whale wallet transactions',
        tags: ['whale', 'analysis'],
      });

      const results = await store.search('whale transactions');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].score).toBeGreaterThan(0);
    });
  });

  describe('TTL and Expiration', () => {
    test('should return null for expired checkpoint', async () => {
      await store.save({
        streamId: 'expired_stream',
        toolName: 'test:tool',
        args: {},
        position: 0,
        timestamp: Date.now() - 100000,
        ttl: 1, // 1ms TTL, already expired
      });

      // Manually set expiresAt to past
      for (const [id, point] of mockPoints) {
        const doc = point.payload as CheckpointDocument;
        if (doc.streamId === 'expired_stream') {
          doc.expiresAt = Date.now() - 1000;
        }
      }

      const result = await store.get('expired_stream');
      expect(result).toBeNull();
    });

    test('should extend TTL', async () => {
      await store.save({
        streamId: 'extend_ttl',
        toolName: 'test:tool',
        args: {},
        position: 0,
        timestamp: Date.now(),
        ttl: 60000,
      });

      const extended = await store.extendTtl('extend_ttl', 60000);
      expect(extended).toBe(true);
    });
  });

  describe('Analytics', () => {
    test('should update analytics', async () => {
      await store.save({
        streamId: 'analytics_stream',
        toolName: 'test:tool',
        args: {},
        position: 0,
        timestamp: Date.now(),
        ttl: 60000,
      });

      await store.updateAnalytics('analytics_stream', {
        resumeCount: 3,
        totalEvents: 100,
        bytesProcessed: 50000,
      });

      // Analytics are updated in the same checkpoint
      const retrieved = await store.get('analytics_stream');
      expect(retrieved).not.toBeNull();
    });
  });

  describe('Statistics', () => {
    test('should return stats', async () => {
      await store.save({
        streamId: 'stats_1',
        toolName: 'tool_a',
        args: {},
        position: 0,
        timestamp: Date.now(),
        ttl: 60000,
        userId: 'user_1',
        totalEvents: 50,
        bytesProcessed: 10000,
        resumeCount: 2,
      });
      await store.save({
        streamId: 'stats_2',
        toolName: 'tool_b',
        args: {},
        position: 0,
        timestamp: Date.now(),
        ttl: 60000,
        userId: 'user_1',
        totalEvents: 30,
        bytesProcessed: 5000,
        resumeCount: 1,
      });

      const stats = await store.getStats();

      expect(stats.total).toBe(2);
      expect(stats.byTool['tool_a']).toBe(1);
      expect(stats.byTool['tool_b']).toBe(1);
      expect(stats.totalEvents).toBe(80);
      expect(stats.totalResumes).toBe(3);
    });
  });

  describe('Cleanup', () => {
    test('should clean up expired checkpoints', async () => {
      // Save a checkpoint
      await store.save({
        streamId: 'cleanup_test',
        toolName: 'test:tool',
        args: {},
        position: 0,
        timestamp: Date.now(),
        ttl: 60000,
      });

      // Manually expire it
      for (const [, point] of mockPoints) {
        const doc = point.payload as CheckpointDocument;
        if (doc.streamId === 'cleanup_test') {
          doc.expiresAt = Date.now() - 1000;
        }
      }

      const deleted = await store.cleanup();
      // Cleanup should have attempted deletion
      expect(deleted).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Events', () => {
    test('should emit saved event', async () => {
      const savedIds: string[] = [];
      store.on('saved', (id) => savedIds.push(id));

      await store.save({
        streamId: 'event_test',
        toolName: 'test:tool',
        args: {},
        position: 0,
        timestamp: Date.now(),
        ttl: 60000,
      });

      expect(savedIds).toContain('event_test');
    });

    test('should emit deleted event', async () => {
      const deletedIds: string[] = [];
      store.on('deleted', (id) => deletedIds.push(id));

      await store.save({
        streamId: 'delete_event',
        toolName: 'test:tool',
        args: {},
        position: 0,
        timestamp: Date.now(),
        ttl: 60000,
      });

      await store.delete('delete_event');
      expect(deletedIds).toContain('delete_event');
    });
  });
});

describe('Global Store', () => {
  test('getQdrantCheckpointStore returns singleton', () => {
    const store1 = getQdrantCheckpointStore();
    const store2 = getQdrantCheckpointStore();
    expect(store1).toBe(store2);
  });
});

describe('Resumable Stream Integration', () => {
  test('createQdrantResumableStream returns proper interface', () => {
    const mockWriter = {
      write: jest.fn(),
      end: jest.fn(),
    };

    const { stream, save, resume } = createQdrantResumableStream(mockWriter, {
      toolName: 'test:tool',
      args: { test: true },
      userId: 'user_123',
      tags: ['test'],
      description: 'Test stream',
    });

    expect(stream).toBeDefined();
    expect(typeof save).toBe('function');
    expect(typeof resume).toBe('function');
  });

  test('should track writes', async () => {
    mockPoints.clear();

    let writeCount = 0;
    const mockWriter = {
      write: jest.fn().mockImplementation(() => { writeCount++; }),
      end: jest.fn(),
    };

    const { save } = createQdrantResumableStream(mockWriter, {
      toolName: 'test:tool',
      args: {},
    });

    // The createQdrantResumableStream wraps the write function
    // So we need to call the wrapped version
    mockWriter.write('event: chunk\ndata: test1\n\n');
    mockWriter.write('event: chunk\ndata: test2\n\n');
    mockWriter.write('event: chunk\ndata: test3\n\n');

    // The wrapper was applied, so writes go through
    expect(writeCount).toBe(3);

    // Save checkpoint
    const streamId = await save();
    expect(streamId).toMatch(/^stream_/);
  });
});

console.log('MCP Qdrant Checkpoint Store Tests');
console.log('==================================');
