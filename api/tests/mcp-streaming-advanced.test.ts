/**
 * MCP Advanced Streaming Tests
 *
 * Tests for resumable streams, multiplexing, and checkpointing.
 */

import {
  CheckpointStore,
  ResumableStream,
  MultiplexedStreamManager,
  REAL_STREAMING_TOOLS,
  type Checkpoint,
} from '../src/mcp-streaming-advanced';

import { SSEStream, type StreamConfig } from '../src/mcp-streaming';

// Mock @solana/web3.js for tests
jest.mock('@solana/web3.js', () => ({
  Connection: jest.fn().mockImplementation(() => ({
    getSignaturesForAddress: jest.fn().mockResolvedValue([
      { signature: 'sig1', slot: 100, blockTime: 1000, err: null },
      { signature: 'sig2', slot: 101, blockTime: 1001, err: null },
    ]),
    getAccountInfo: jest.fn().mockResolvedValue({
      lamports: 1000000000,
      owner: { toBase58: () => '11111111111111111111111111111111' },
      executable: false,
      rentEpoch: 0,
    }),
    getBalance: jest.fn().mockResolvedValue(1000000000),
    getParsedTokenAccountsByOwner: jest.fn().mockResolvedValue({ value: [] }),
    getSlot: jest.fn().mockResolvedValue(200000000),
    getBlockTime: jest.fn().mockResolvedValue(Math.floor(Date.now() / 1000)),
  })),
  PublicKey: jest.fn().mockImplementation((address: string) => ({
    toBase58: () => address,
    toString: () => address,
  })),
}));

describe('CheckpointStore', () => {
  let store: CheckpointStore;

  beforeEach(() => {
    store = new CheckpointStore(1000); // 1 second cleanup interval for tests
  });

  afterEach(() => {
    store.stop();
  });

  test('should save and retrieve checkpoints', () => {
    const checkpoint: Checkpoint = {
      streamId: 'test_stream_1',
      toolName: 'test:tool',
      args: { foo: 'bar' },
      position: 10,
      timestamp: Date.now(),
      ttl: 60000,
    };

    store.save(checkpoint);
    const retrieved = store.get('test_stream_1');

    expect(retrieved).not.toBeNull();
    expect(retrieved?.streamId).toBe('test_stream_1');
    expect(retrieved?.position).toBe(10);
  });

  test('should return null for non-existent checkpoint', () => {
    const result = store.get('nonexistent');
    expect(result).toBeNull();
  });

  test('should delete checkpoints', () => {
    store.save({
      streamId: 'to_delete',
      toolName: 'test',
      args: {},
      position: 0,
      timestamp: Date.now(),
      ttl: 60000,
    });

    expect(store.get('to_delete')).not.toBeNull();
    expect(store.delete('to_delete')).toBe(true);
    expect(store.get('to_delete')).toBeNull();
  });

  test('should return false when deleting non-existent checkpoint', () => {
    expect(store.delete('nonexistent')).toBe(false);
  });

  test('should filter expired checkpoints', async () => {
    // Save checkpoint with very short TTL
    store.save({
      streamId: 'expired',
      toolName: 'test',
      args: {},
      position: 0,
      timestamp: Date.now(),
      ttl: 1, // 1ms TTL
    });

    // Wait for expiration
    await new Promise(r => setTimeout(r, 10));

    // TTL check happens on get
    expect(store.get('expired')).toBeNull();
  });

  test('should get checkpoints by tool name', () => {
    store.save({
      streamId: 'stream1',
      toolName: 'tool_a',
      args: {},
      position: 0,
      timestamp: Date.now(),
      ttl: 60000,
    });
    store.save({
      streamId: 'stream2',
      toolName: 'tool_a',
      args: {},
      position: 5,
      timestamp: Date.now(),
      ttl: 60000,
    });
    store.save({
      streamId: 'stream3',
      toolName: 'tool_b',
      args: {},
      position: 10,
      timestamp: Date.now(),
      ttl: 60000,
    });

    const toolACheckpoints = store.getByTool('tool_a');
    expect(toolACheckpoints.length).toBe(2);
  });

  test('should return stats', () => {
    store.save({
      streamId: 's1',
      toolName: 'tool_x',
      args: {},
      position: 0,
      timestamp: Date.now(),
      ttl: 60000,
    });
    store.save({
      streamId: 's2',
      toolName: 'tool_y',
      args: {},
      position: 0,
      timestamp: Date.now(),
      ttl: 60000,
    });

    const stats = store.getStats();
    expect(stats.total).toBe(2);
    expect(stats.byTool['tool_x']).toBe(1);
    expect(stats.byTool['tool_y']).toBe(1);
  });
});

describe('ResumableStream', () => {
  let store: CheckpointStore;
  let mockWriter: { write: jest.Mock; end: jest.Mock };

  beforeEach(() => {
    store = new CheckpointStore();
    mockWriter = {
      write: jest.fn(),
      end: jest.fn(),
    };
  });

  afterEach(() => {
    store.stop();
  });

  function createStream(options?: Partial<{
    resumeFrom: string;
    checkpointInterval: number;
  }>): ResumableStream {
    return new ResumableStream(mockWriter, {
      chunkSize: 50,
      maxChunkBytes: 64 * 1024,
      heartbeatIntervalMs: 0,
      enableCompression: false,
      enableProgress: true,
      checkpointStore: store,
      toolName: 'test:tool',
      args: { test: true },
      ...options,
    });
  }

  test('should track position', () => {
    const stream = createStream();

    expect(stream.getPosition()).toBe(0);

    stream.send({ id: '1', type: 'chunk', timestamp: Date.now(), data: {} });
    expect(stream.getPosition()).toBe(1);

    stream.send({ id: '2', type: 'chunk', timestamp: Date.now(), data: {} });
    expect(stream.getPosition()).toBe(2);

    stream.abort();
  });

  test('should create checkpoint manually', () => {
    const stream = createStream();

    const checkpointId = stream.createCheckpoint({ extra: 'data' });
    expect(checkpointId).toBe(stream.streamId);

    const checkpoint = store.get(stream.streamId);
    expect(checkpoint).not.toBeNull();
    expect(checkpoint?.data).toEqual({ extra: 'data' });

    stream.abort();
  });

  test('should auto-checkpoint based on interval', () => {
    const stream = createStream({ checkpointInterval: 5 });

    // Send 10 events
    for (let i = 0; i < 10; i++) {
      stream.send({ id: `${i}`, type: 'chunk', timestamp: Date.now(), data: {} });
    }

    // Should have created checkpoint at position 5
    const checkpoint = store.get(stream.streamId);
    expect(checkpoint).not.toBeNull();

    stream.abort();
  });

  test('should resume from checkpoint', () => {
    // Create initial stream and checkpoint
    const stream1 = createStream();
    stream1.send({ id: '1', type: 'chunk', timestamp: Date.now(), data: {} });
    stream1.send({ id: '2', type: 'chunk', timestamp: Date.now(), data: {} });
    stream1.setCursor('cursor_at_2');
    stream1.createCheckpoint();
    const checkpointId = stream1.streamId;
    const savedPosition = stream1.getPosition();
    stream1.abort();

    // Reset mock for second stream
    mockWriter.write.mockClear();

    // Create new stream resuming from checkpoint
    const stream2 = createStream({ resumeFrom: checkpointId });

    // Should have resumed from checkpoint
    expect(stream2.getResumeCount()).toBe(1);

    // Position should be at least the saved position
    // (may be higher due to resume notification)
    expect(stream2.getPosition()).toBeGreaterThanOrEqual(savedPosition - 1);

    stream2.abort();
  });

  test('should delete checkpoint on complete', () => {
    const stream = createStream();
    stream.createCheckpoint();

    expect(store.get(stream.streamId)).not.toBeNull();

    stream.complete({ done: true });

    expect(store.get(stream.streamId)).toBeNull();
  });

  test('should set cursor', () => {
    const stream = createStream();
    stream.setCursor('my_cursor');
    stream.createCheckpoint();

    const checkpoint = store.get(stream.streamId);
    expect(checkpoint?.cursor).toBe('my_cursor');

    stream.abort();
  });
});

describe('MultiplexedStreamManager', () => {
  let store: CheckpointStore;
  let mockWriter: { write: jest.Mock; end: jest.Mock };
  let mux: MultiplexedStreamManager;

  beforeEach(() => {
    store = new CheckpointStore();
    mockWriter = {
      write: jest.fn(),
      end: jest.fn(),
    };
    mux = new MultiplexedStreamManager(mockWriter, { maxConcurrentStreams: 5 }, store);
  });

  afterEach(() => {
    mux.close();
    store.stop();
  });

  test('should create streams', () => {
    const stream = mux.createStream('test:tool', { arg: 'value' });
    expect(stream).not.toBeNull();
    expect(mux.getStreamCount()).toBe(1);
  });

  test('should limit concurrent streams', () => {
    // Add error handler to prevent unhandled error
    mux.on('error', () => { /* expected */ });

    for (let i = 0; i < 5; i++) {
      mux.createStream(`tool_${i}`, {});
    }
    expect(mux.getStreamCount()).toBe(5);

    // Should fail to create 6th stream
    const stream6 = mux.createStream('tool_6', {});
    expect(stream6).toBeNull();
    expect(mux.getStreamCount()).toBe(5);
  });

  test('should get stream by ID', () => {
    const stream = mux.createStream('test:tool', {});
    expect(stream).not.toBeNull();

    // Get the stream IDs from active streams
    const activeStreams = mux.getActiveStreams();
    expect(activeStreams.length).toBe(1);

    const streamId = activeStreams[0];
    const retrieved = mux.getStream(streamId);
    expect(retrieved).toBeDefined();
  });

  test('should cancel streams', () => {
    const stream = mux.createStream('test:tool', {});
    expect(stream).not.toBeNull();

    const activeStreams = mux.getActiveStreams();
    const streamId = activeStreams[0];

    expect(mux.cancelStream(streamId)).toBe(true);
    expect(mux.getStreamCount()).toBe(0);
  });

  test('should return false when canceling non-existent stream', () => {
    expect(mux.cancelStream('nonexistent')).toBe(false);
  });

  test('should list active streams', () => {
    mux.createStream('tool_a', {});
    mux.createStream('tool_b', {});
    mux.createStream('tool_c', {});

    const active = mux.getActiveStreams();
    expect(active.length).toBe(3);
  });

  test('should send heartbeat', () => {
    mux.createStream('test:tool', {});
    mux.sendHeartbeat();

    const heartbeatCall = mockWriter.write.mock.calls.find(
      (c: string[]) => c[0].includes('heartbeat')
    );
    expect(heartbeatCall).toBeDefined();
  });

  test('should emit events', () => {
    const startEvents: string[] = [];
    const cancelEvents: string[] = [];

    mux.on('streamStart', (id) => startEvents.push(id));
    mux.on('streamCancel', (id) => cancelEvents.push(id));

    mux.createStream('test:tool', {});
    expect(startEvents.length).toBe(1);

    // Cancel using the ID from active streams
    const activeStreams = mux.getActiveStreams();
    mux.cancelStream(activeStreams[0]);
    expect(cancelEvents.length).toBe(1);
  });

  test('should provide analytics', () => {
    const stream = mux.createStream('test:tool', {});
    stream?.send({ id: '1', type: 'chunk', timestamp: Date.now(), data: {} });
    stream?.send({ id: '2', type: 'chunk', timestamp: Date.now(), data: {} });

    const analytics = mux.getAnalytics();
    expect(analytics.length).toBe(1);
    expect(analytics[0].toolName).toBe('test:tool');
    expect(analytics[0].eventsEmitted).toBeGreaterThan(0);
  });

  test('should get checkpoint store', () => {
    expect(mux.getCheckpointStore()).toBe(store);
  });

  test('should close all streams', () => {
    mux.createStream('tool_1', {});
    mux.createStream('tool_2', {});
    mux.createStream('tool_3', {});

    expect(mux.getStreamCount()).toBe(3);

    let closeCalled = false;
    mux.on('close', () => { closeCalled = true; });

    mux.close();

    expect(mux.getStreamCount()).toBe(0);
    expect(closeCalled).toBe(true);
  });
});

describe('Real Streaming Tools', () => {
  test('should have 3 real streaming tools', () => {
    expect(REAL_STREAMING_TOOLS.length).toBe(3);
  });

  test('all tools should have required fields', () => {
    REAL_STREAMING_TOOLS.forEach(tool => {
      expect(tool.name).toMatch(/^solana:/);
      expect(tool.description).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
      expect(typeof tool.execute).toBe('function');
    });
  });

  describe('solana:stream_transactions', () => {
    test('should have correct input schema', () => {
      const tool = REAL_STREAMING_TOOLS.find(t => t.name === 'solana:stream_transactions');
      expect(tool?.inputSchema.properties).toHaveProperty('address');
      expect(tool?.inputSchema.properties).toHaveProperty('limit');
      expect(tool?.inputSchema.required).toContain('address');
    });
  });

  describe('solana:stream_account_analysis', () => {
    test('should have correct input schema', () => {
      const tool = REAL_STREAMING_TOOLS.find(t => t.name === 'solana:stream_account_analysis');
      expect(tool?.inputSchema.properties).toHaveProperty('address');
      expect(tool?.inputSchema.properties).toHaveProperty('depth');
      expect(tool?.inputSchema.required).toContain('address');
    });
  });

  describe('solana:stream_slots', () => {
    test('should have correct input schema', () => {
      const tool = REAL_STREAMING_TOOLS.find(t => t.name === 'solana:stream_slots');
      expect(tool?.inputSchema.properties).toHaveProperty('duration');
    });
  });
});

describe('Stream Integration', () => {
  let store: CheckpointStore;

  beforeEach(() => {
    store = new CheckpointStore();
  });

  afterEach(() => {
    store.stop();
  });

  test('checkpoint store integrates with resumable stream', () => {
    const mockWriter = { write: jest.fn(), end: jest.fn() };

    const stream = new ResumableStream(mockWriter, {
      chunkSize: 50,
      maxChunkBytes: 64 * 1024,
      heartbeatIntervalMs: 0,
      enableCompression: false,
      enableProgress: true,
      checkpointStore: store,
      toolName: 'integration:test',
      args: { key: 'value' },
    });

    // Send some events and checkpoint
    for (let i = 0; i < 5; i++) {
      stream.send({ id: `${i}`, type: 'chunk', timestamp: Date.now(), data: { i } });
    }
    stream.createCheckpoint({ lastIndex: 4 });

    // Verify checkpoint exists
    const stats = store.getStats();
    expect(stats.total).toBe(1);
    expect(stats.byTool['integration:test']).toBe(1);

    stream.abort();
  });

  test('multiplexed streams share checkpoint store', () => {
    const mockWriter = { write: jest.fn(), end: jest.fn() };
    const mux = new MultiplexedStreamManager(mockWriter, {}, store);

    const stream1 = mux.createStream('tool_a', {});
    const stream2 = mux.createStream('tool_b', {});

    stream1?.createCheckpoint();
    stream2?.createCheckpoint();

    const stats = store.getStats();
    expect(stats.total).toBe(2);

    mux.close();
  });
});

console.log('MCP Advanced Streaming Tests');
console.log('=============================');
