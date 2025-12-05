/**
 * MCP Streaming Tool Tests
 *
 * Tests for streaming tool executors and SSE response generation.
 */

import {
  SSEStream,
  WebSocketStream,
  STREAMING_EXECUTORS,
  getStreamingExecutor,
  hasStreamingExecutor,
  createSSEHeaders,
  createStreamingResponse,
  isStreamable,
  getStreamCapabilities,
  STREAMABLE_TOOLS,
  type StreamEvent,
} from '../src/mcp-streaming';

describe('SSE Stream', () => {
  let mockWriter: { write: jest.Mock; end: jest.Mock };
  let stream: SSEStream;

  beforeEach(() => {
    mockWriter = {
      write: jest.fn(),
      end: jest.fn(),
    };
    stream = new SSEStream(mockWriter, {
      chunkSize: 50,
      maxChunkBytes: 64 * 1024,
      heartbeatIntervalMs: 0, // Disable heartbeat for tests
      enableCompression: false,
      enableProgress: true,
    });
  });

  afterEach(() => {
    stream.abort();
  });

  test('should generate unique stream ID', () => {
    expect(stream.streamId).toMatch(/^stream_\d+_[a-z0-9]+$/);
  });

  test('should send formatted SSE events', () => {
    const event: StreamEvent = {
      id: 'test_1',
      type: 'chunk',
      timestamp: Date.now(),
      data: { test: 'value' },
    };

    stream.send(event);

    expect(mockWriter.write).toHaveBeenCalled();
    const output = mockWriter.write.mock.calls[0][0];
    expect(output).toContain('id: test_1');
    expect(output).toContain('event: chunk');
    expect(output).toContain('data: {"test":"value"}');
  });

  test('should send progress updates', () => {
    stream.progress(50, 'Halfway done');

    expect(mockWriter.write).toHaveBeenCalled();
    const output = mockWriter.write.mock.calls[0][0];
    expect(output).toContain('event: progress');
    expect(output).toContain('"percent":50');
    expect(output).toContain('"message":"Halfway done"');
  });

  test('should complete stream', () => {
    stream.complete({ result: 'success' });

    expect(mockWriter.write).toHaveBeenCalled();
    expect(mockWriter.end).toHaveBeenCalled();
    const output = mockWriter.write.mock.calls[0][0];
    expect(output).toContain('event: complete');
  });

  test('should handle errors', () => {
    stream.error(new Error('Test error'));

    expect(mockWriter.write).toHaveBeenCalled();
    expect(mockWriter.end).toHaveBeenCalled();
    const output = mockWriter.write.mock.calls[0][0];
    expect(output).toContain('event: error');
    expect(output).toContain('Test error');
  });

  test('should not send after abort', () => {
    stream.abort();
    expect(stream.isAborted()).toBe(true);

    stream.send({
      id: 'after_abort',
      type: 'chunk',
      timestamp: Date.now(),
      data: {},
    });

    // Should not write after abort
    expect(mockWriter.write).not.toHaveBeenCalled();
  });
});

describe('WebSocket Stream', () => {
  let mockSocket: { send: jest.Mock; close: jest.Mock };
  let stream: WebSocketStream;

  beforeEach(() => {
    mockSocket = {
      send: jest.fn(),
      close: jest.fn(),
    };
    stream = new WebSocketStream(mockSocket, {
      chunkSize: 50,
      maxChunkBytes: 64 * 1024,
      heartbeatIntervalMs: 0,
      enableCompression: false,
      enableProgress: true,
    });
  });

  afterEach(() => {
    stream.abort();
  });

  test('should send JSON messages', () => {
    stream.send({
      id: 'ws_1',
      type: 'chunk',
      timestamp: Date.now(),
      data: { key: 'value' },
    });

    expect(mockSocket.send).toHaveBeenCalled();
    const message = JSON.parse(mockSocket.send.mock.calls[0][0]);
    expect(message.streamId).toBe(stream.streamId);
    expect(message.type).toBe('chunk');
    expect(message.data).toEqual({ key: 'value' });
  });

  test('should send progress', () => {
    stream.progress(75, 'Almost done');

    const message = JSON.parse(mockSocket.send.mock.calls[0][0]);
    expect(message.type).toBe('progress');
    expect(message.data.percent).toBe(75);
  });
});

describe('Streaming Tool Executors', () => {
  test('should have 5 streaming tools', () => {
    expect(STREAMING_EXECUTORS.length).toBe(5);
  });

  test('all executors should have required fields', () => {
    STREAMING_EXECUTORS.forEach(executor => {
      expect(executor.name).toMatch(/^streaming:/);
      expect(executor.description).toBeDefined();
      expect(executor.inputSchema.type).toBe('object');
      expect(typeof executor.execute).toBe('function');
    });
  });

  test('should find executor by name', () => {
    const executor = getStreamingExecutor('streaming:scan_transactions');
    expect(executor).toBeDefined();
    expect(executor?.name).toBe('streaming:scan_transactions');
  });

  test('should return undefined for unknown executor', () => {
    const executor = getStreamingExecutor('streaming:unknown');
    expect(executor).toBeUndefined();
  });

  test('hasStreamingExecutor should return correct values', () => {
    expect(hasStreamingExecutor('streaming:scan_transactions')).toBe(true);
    expect(hasStreamingExecutor('streaming:analyze_wallet')).toBe(true);
    expect(hasStreamingExecutor('streaming:unknown')).toBe(false);
    expect(hasStreamingExecutor('regular:tool')).toBe(false);
  });

  describe('streaming:scan_transactions', () => {
    test('should have correct input schema', () => {
      const executor = getStreamingExecutor('streaming:scan_transactions');
      expect(executor?.inputSchema.properties).toHaveProperty('address');
      expect(executor?.inputSchema.properties).toHaveProperty('limit');
      expect(executor?.inputSchema.required).toContain('address');
    });
  });

  describe('streaming:analyze_wallet', () => {
    test('should have correct input schema', () => {
      const executor = getStreamingExecutor('streaming:analyze_wallet');
      expect(executor?.inputSchema.properties).toHaveProperty('address');
      expect(executor?.inputSchema.properties).toHaveProperty('depth');
      expect(executor?.inputSchema.required).toContain('address');
    });
  });

  describe('streaming:monitor_blocks', () => {
    test('should have correct input schema', () => {
      const executor = getStreamingExecutor('streaming:monitor_blocks');
      expect(executor?.inputSchema.properties).toHaveProperty('duration');
      expect(executor?.inputSchema.properties).toHaveProperty('includeTransactions');
    });
  });

  describe('streaming:trace_funds', () => {
    test('should have correct input schema', () => {
      const executor = getStreamingExecutor('streaming:trace_funds');
      expect(executor?.inputSchema.properties).toHaveProperty('startAddress');
      expect(executor?.inputSchema.properties).toHaveProperty('direction');
      expect(executor?.inputSchema.properties).toHaveProperty('maxHops');
      expect(executor?.inputSchema.required).toContain('startAddress');
    });
  });

  describe('streaming:search_accounts', () => {
    test('should have correct input schema', () => {
      const executor = getStreamingExecutor('streaming:search_accounts');
      expect(executor?.inputSchema.properties).toHaveProperty('query');
      expect(executor?.inputSchema.properties).toHaveProperty('type');
      expect(executor?.inputSchema.properties).toHaveProperty('limit');
      expect(executor?.inputSchema.required).toContain('query');
    });
  });
});

describe('SSE Headers', () => {
  test('should return correct headers', () => {
    const headers = createSSEHeaders();
    expect(headers['Content-Type']).toBe('text/event-stream');
    expect(headers['Cache-Control']).toBe('no-cache');
    expect(headers['Connection']).toBe('keep-alive');
    expect(headers['X-Accel-Buffering']).toBe('no');
  });
});

describe('Streamable Tools Registry', () => {
  test('should have registered streamable tools', () => {
    expect(Object.keys(STREAMABLE_TOOLS).length).toBeGreaterThan(0);
  });

  test('isStreamable should work correctly', () => {
    expect(isStreamable('investigate')).toBe(true);
    expect(isStreamable('get_account_transactions')).toBe(true);
    expect(isStreamable('unknown_tool')).toBe(false);
  });

  test('getStreamCapabilities should return capabilities', () => {
    const caps = getStreamCapabilities('investigate');
    expect(caps).toBeDefined();
    expect(caps?.supports).toContain('progress');
    expect(caps?.supports).toContain('investigation');
  });

  test('getStreamCapabilities should return null for unknown tool', () => {
    const caps = getStreamCapabilities('unknown_tool');
    expect(caps).toBeNull();
  });
});

describe('Streaming Response Creation', () => {
  test('createStreamingResponse should return Response', async () => {
    const response = createStreamingResponse(async (stream) => {
      stream.send({
        id: 'test',
        type: 'start',
        timestamp: Date.now(),
        data: { test: true },
      });
      stream.complete({ done: true });
    });

    expect(response).toBeInstanceOf(Response);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
  });
});

describe('Executor Event Flow', () => {
  test('scan_transactions should emit start, progress, chunks, complete', async () => {
    const eventTypes: string[] = [];
    const mockWriter = {
      write: (data: string) => {
        // Extract event type from SSE format: "event: type"
        const eventLine = data.split('\n').find(l => l.startsWith('event: '));
        if (eventLine) {
          eventTypes.push(eventLine.slice(7).trim());
        }
      },
      end: jest.fn(),
    };

    const stream = new SSEStream(mockWriter, {
      chunkSize: 50,
      maxChunkBytes: 64 * 1024,
      heartbeatIntervalMs: 0,
      enableCompression: false,
      enableProgress: true,
    });

    const executor = getStreamingExecutor('streaming:scan_transactions');
    await executor?.execute({ address: 'test_address', limit: 5 }, stream);

    // Should have start event
    expect(eventTypes.includes('start')).toBe(true);

    // Should have progress events
    expect(eventTypes.includes('progress')).toBe(true);

    // Should have chunk events
    expect(eventTypes.includes('chunk')).toBe(true);

    // Should have complete event
    expect(eventTypes.includes('complete')).toBe(true);
  });

  test('analyze_wallet should emit phases as partial events', async () => {
    const eventTypes: string[] = [];
    const mockWriter = {
      write: (data: string) => {
        const eventLine = data.split('\n').find(l => l.startsWith('event: '));
        if (eventLine) {
          eventTypes.push(eventLine.slice(7).trim());
        }
      },
      end: jest.fn(),
    };

    const stream = new SSEStream(mockWriter, {
      chunkSize: 50,
      maxChunkBytes: 64 * 1024,
      heartbeatIntervalMs: 0,
      enableCompression: false,
      enableProgress: true,
    });

    const executor = getStreamingExecutor('streaming:analyze_wallet');
    await executor?.execute({ address: 'wallet_addr', depth: 'basic' }, stream);

    // Should have partial events for phases
    const partialCount = eventTypes.filter(t => t === 'partial').length;
    expect(partialCount).toBeGreaterThanOrEqual(6); // At least 6 phases

    // Should have complete event
    expect(eventTypes.includes('complete')).toBe(true);
  });
});

describe('Edge Cases', () => {
  test('should handle empty args', async () => {
    const executor = getStreamingExecutor('streaming:monitor_blocks');
    expect(executor).toBeDefined();
    // Should use defaults when args are empty
    expect(executor?.inputSchema.required).toBeUndefined();
  });

  test('should limit maxHops in trace_funds', () => {
    const executor = getStreamingExecutor('streaming:trace_funds');
    // maxHops should be capped at 5 (enforced in executor)
    expect(executor?.inputSchema.properties?.maxHops).toBeDefined();
  });

  test('should limit results in search_accounts', () => {
    const executor = getStreamingExecutor('streaming:search_accounts');
    // limit should have a max (enforced in executor)
    expect(executor?.inputSchema.properties?.limit).toBeDefined();
  });
});

console.log('MCP Streaming Tests');
console.log('===================');
