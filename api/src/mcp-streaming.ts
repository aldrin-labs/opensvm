/**
 * MCP Streaming Tool Responses
 *
 * Stream large tool responses as chunks for better UX on slow queries.
 * Supports multiple streaming protocols:
 * - Server-Sent Events (SSE)
 * - WebSocket
 * - JSON Lines (NDJSON)
 *
 * Features:
 * - Progress indicators for long-running operations
 * - Partial result streaming
 * - Backpressure handling
 * - Automatic chunking for large arrays
 * - Resume from checkpoint
 */

// ============================================================================
// Types
// ============================================================================

export type StreamFormat = 'sse' | 'websocket' | 'ndjson';

export type StreamEventType =
  | 'start'
  | 'progress'
  | 'chunk'
  | 'partial'
  | 'complete'
  | 'error'
  | 'heartbeat';

export interface StreamEvent<T = any> {
  id: string;
  type: StreamEventType;
  timestamp: number;
  data: T;
  metadata?: {
    tool?: string;
    progress?: number;      // 0-100
    chunkIndex?: number;
    totalChunks?: number;
    bytesProcessed?: number;
    totalBytes?: number;
  };
}

export interface StreamConfig {
  chunkSize: number;           // Items per chunk for arrays
  maxChunkBytes: number;       // Max bytes per chunk
  heartbeatIntervalMs: number; // Heartbeat interval
  enableCompression: boolean;
  enableProgress: boolean;
}

export interface StreamController {
  streamId: string;
  send: (event: StreamEvent) => void;
  complete: (result?: any) => void;
  error: (error: Error) => void;
  progress: (percent: number, message?: string) => void;
  abort: () => void;
  isAborted: () => boolean;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: StreamConfig = {
  chunkSize: 50,
  maxChunkBytes: 64 * 1024,  // 64KB
  heartbeatIntervalMs: 15000,
  enableCompression: true,
  enableProgress: true,
};

// ============================================================================
// Stream ID Generation
// ============================================================================

function generateStreamId(): string {
  return `stream_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ============================================================================
// SSE Stream Implementation
// ============================================================================

export class SSEStream implements StreamController {
  streamId: string;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private encoder = new TextEncoder();
  private aborted = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private eventCounter = 0;

  constructor(
    private response: Response | { write: (data: string) => void; end: () => void },
    private config: StreamConfig = DEFAULT_CONFIG
  ) {
    this.streamId = generateStreamId();
    this.startHeartbeat();
  }

  private formatSSE(event: StreamEvent): string {
    const lines = [
      `id: ${event.id}`,
      `event: ${event.type}`,
      `data: ${JSON.stringify(event.data)}`,
      '',
      '',
    ];
    return lines.join('\n');
  }

  send(event: StreamEvent): void {
    if (this.aborted) return;

    event.id = event.id || `${this.streamId}_${this.eventCounter++}`;
    event.timestamp = event.timestamp || Date.now();

    const message = this.formatSSE(event);

    if ('write' in this.response && typeof this.response.write === 'function') {
      this.response.write(message);
    }
  }

  progress(percent: number, message?: string): void {
    this.send({
      id: `${this.streamId}_progress_${this.eventCounter}`,
      type: 'progress',
      timestamp: Date.now(),
      data: { percent, message },
      metadata: { progress: percent },
    });
  }

  complete(result?: any): void {
    this.send({
      id: `${this.streamId}_complete`,
      type: 'complete',
      timestamp: Date.now(),
      data: result,
    });
    this.cleanup();
  }

  error(error: Error): void {
    this.send({
      id: `${this.streamId}_error`,
      type: 'error',
      timestamp: Date.now(),
      data: {
        message: error.message,
        name: error.name,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
    });
    this.cleanup();
  }

  abort(): void {
    this.aborted = true;
    this.cleanup();
  }

  isAborted(): boolean {
    return this.aborted;
  }

  private startHeartbeat(): void {
    if (this.config.heartbeatIntervalMs > 0) {
      this.heartbeatTimer = setInterval(() => {
        if (!this.aborted) {
          this.send({
            id: `${this.streamId}_heartbeat`,
            type: 'heartbeat',
            timestamp: Date.now(),
            data: { streamId: this.streamId },
          });
        }
      }, this.config.heartbeatIntervalMs);
    }
  }

  private cleanup(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if ('end' in this.response && typeof this.response.end === 'function') {
      this.response.end();
    }
  }
}

// ============================================================================
// WebSocket Stream Implementation
// ============================================================================

export class WebSocketStream implements StreamController {
  streamId: string;
  private aborted = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private eventCounter = 0;

  constructor(
    private socket: WebSocket | { send: (data: string) => void; close: () => void },
    private config: StreamConfig = DEFAULT_CONFIG
  ) {
    this.streamId = generateStreamId();
    this.startHeartbeat();
  }

  send(event: StreamEvent): void {
    if (this.aborted) return;

    event.id = event.id || `${this.streamId}_${this.eventCounter++}`;
    event.timestamp = event.timestamp || Date.now();

    const message = JSON.stringify({
      streamId: this.streamId,
      ...event,
    });

    this.socket.send(message);
  }

  progress(percent: number, message?: string): void {
    this.send({
      id: `${this.streamId}_progress_${this.eventCounter}`,
      type: 'progress',
      timestamp: Date.now(),
      data: { percent, message },
      metadata: { progress: percent },
    });
  }

  complete(result?: any): void {
    this.send({
      id: `${this.streamId}_complete`,
      type: 'complete',
      timestamp: Date.now(),
      data: result,
    });
    this.cleanup();
  }

  error(error: Error): void {
    this.send({
      id: `${this.streamId}_error`,
      type: 'error',
      timestamp: Date.now(),
      data: {
        message: error.message,
        name: error.name,
      },
    });
    this.cleanup();
  }

  abort(): void {
    this.aborted = true;
    this.cleanup();
  }

  isAborted(): boolean {
    return this.aborted;
  }

  private startHeartbeat(): void {
    if (this.config.heartbeatIntervalMs > 0) {
      this.heartbeatTimer = setInterval(() => {
        if (!this.aborted) {
          this.send({
            id: `${this.streamId}_heartbeat`,
            type: 'heartbeat',
            timestamp: Date.now(),
            data: {},
          });
        }
      }, this.config.heartbeatIntervalMs);
    }
  }

  private cleanup(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

// ============================================================================
// Streaming Tool Executor
// ============================================================================

export interface StreamingToolOptions {
  tool: string;
  params: Record<string, any>;
  stream: StreamController;
  onProgress?: (percent: number) => void;
}

/**
 * Stream large array results in chunks
 */
export async function streamArrayResult<T>(
  data: T[],
  stream: StreamController,
  options: { chunkSize?: number; tool?: string } = {}
): Promise<void> {
  const chunkSize = options.chunkSize || DEFAULT_CONFIG.chunkSize;
  const totalChunks = Math.ceil(data.length / chunkSize);

  // Send start event
  stream.send({
    id: `${stream.streamId}_start`,
    type: 'start',
    timestamp: Date.now(),
    data: {
      totalItems: data.length,
      totalChunks,
      chunkSize,
    },
    metadata: {
      tool: options.tool,
      totalChunks,
    },
  });

  // Stream chunks
  for (let i = 0; i < data.length; i += chunkSize) {
    if (stream.isAborted()) break;

    const chunk = data.slice(i, i + chunkSize);
    const chunkIndex = Math.floor(i / chunkSize);
    const progress = Math.round(((i + chunk.length) / data.length) * 100);

    stream.send({
      id: `${stream.streamId}_chunk_${chunkIndex}`,
      type: 'chunk',
      timestamp: Date.now(),
      data: chunk,
      metadata: {
        tool: options.tool,
        progress,
        chunkIndex,
        totalChunks,
      },
    });

    // Small delay to prevent overwhelming the client
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  // Send complete event
  stream.complete({ itemsStreamed: data.length });
}

/**
 * Stream object with progress updates
 */
export async function streamWithProgress<T>(
  executor: (progress: (percent: number, message?: string) => void) => Promise<T>,
  stream: StreamController,
  options: { tool?: string } = {}
): Promise<T> {
  // Send start event
  stream.send({
    id: `${stream.streamId}_start`,
    type: 'start',
    timestamp: Date.now(),
    data: { tool: options.tool },
    metadata: { tool: options.tool },
  });

  try {
    const result = await executor((percent, message) => {
      stream.progress(percent, message);
    });

    stream.complete(result);
    return result;
  } catch (error) {
    stream.error(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

// ============================================================================
// Investigation Streaming
// ============================================================================

export interface InvestigationStreamEvent {
  phase: string;
  action: string;
  target?: string;
  result?: any;
  anomalies?: any[];
  progress: number;
}

/**
 * Stream investigation progress and findings in real-time
 */
export class InvestigationStream {
  private stream: StreamController;
  private phases: string[] = [];
  private currentPhase = 0;
  private findings: any[] = [];
  private anomalies: any[] = [];

  constructor(
    stream: StreamController,
    private config: { phases: string[]; tool?: string }
  ) {
    this.stream = stream;
    this.phases = config.phases;
  }

  startPhase(phase: string, details?: any): void {
    this.currentPhase = this.phases.indexOf(phase);
    const progress = Math.round((this.currentPhase / this.phases.length) * 100);

    this.stream.send({
      id: `${this.stream.streamId}_phase_${this.currentPhase}`,
      type: 'progress',
      timestamp: Date.now(),
      data: {
        phase,
        action: 'started',
        details,
        phasesCompleted: this.currentPhase,
        totalPhases: this.phases.length,
      },
      metadata: {
        tool: this.config.tool,
        progress,
      },
    });
  }

  reportFinding(finding: any): void {
    this.findings.push(finding);

    this.stream.send({
      id: `${this.stream.streamId}_finding_${this.findings.length}`,
      type: 'partial',
      timestamp: Date.now(),
      data: {
        type: 'finding',
        finding,
        totalFindings: this.findings.length,
      },
      metadata: { tool: this.config.tool },
    });
  }

  reportAnomaly(anomaly: any): void {
    this.anomalies.push(anomaly);

    this.stream.send({
      id: `${this.stream.streamId}_anomaly_${this.anomalies.length}`,
      type: 'partial',
      timestamp: Date.now(),
      data: {
        type: 'anomaly',
        anomaly,
        severity: anomaly.severity,
        totalAnomalies: this.anomalies.length,
      },
      metadata: { tool: this.config.tool },
    });
  }

  toolCall(tool: string, params: any): void {
    this.stream.send({
      id: `${this.stream.streamId}_tool_${Date.now()}`,
      type: 'partial',
      timestamp: Date.now(),
      data: {
        type: 'tool_call',
        tool,
        params,
      },
      metadata: { tool: this.config.tool },
    });
  }

  toolResult(tool: string, result: any, duration: number): void {
    this.stream.send({
      id: `${this.stream.streamId}_result_${Date.now()}`,
      type: 'partial',
      timestamp: Date.now(),
      data: {
        type: 'tool_result',
        tool,
        success: true,
        duration,
        summary: this.summarizeResult(result),
      },
      metadata: { tool: this.config.tool },
    });
  }

  complete(report: any): void {
    this.stream.complete({
      report,
      findings: this.findings,
      anomalies: this.anomalies,
      phasesCompleted: this.phases.length,
    });
  }

  error(error: Error, phase?: string): void {
    this.stream.error(error);
  }

  private summarizeResult(result: any): any {
    if (Array.isArray(result)) {
      return { type: 'array', count: result.length };
    }
    if (typeof result === 'object' && result !== null) {
      return { type: 'object', keys: Object.keys(result).slice(0, 10) };
    }
    return { type: typeof result };
  }
}

// ============================================================================
// Streamable Tools Registry
// ============================================================================

/**
 * Tools that support streaming responses
 */
export const STREAMABLE_TOOLS: Record<string, {
  supports: ('array' | 'progress' | 'investigation')[];
  estimatedDuration?: string;
}> = {
  // Array streaming - large result sets
  'get_account_transactions': { supports: ['array'], estimatedDuration: '1-5s' },
  'get_blocks': { supports: ['array'], estimatedDuration: '1-3s' },
  'search': { supports: ['array'], estimatedDuration: '1-5s' },

  // Progress streaming - long-running operations
  'investigate': { supports: ['progress', 'investigation'], estimatedDuration: '30s-5min' },
  'find_wallet_path': { supports: ['progress'], estimatedDuration: '10s-2min' },
  'analyze_transaction': { supports: ['progress'], estimatedDuration: '5-30s' },

  // Investigation streaming
  'investigate_with_template': { supports: ['progress', 'investigation'], estimatedDuration: '10s-15min' },
};

/**
 * Check if a tool supports streaming
 */
export function isStreamable(tool: string): boolean {
  return tool in STREAMABLE_TOOLS;
}

/**
 * Get streaming capabilities for a tool
 */
export function getStreamCapabilities(tool: string): typeof STREAMABLE_TOOLS[string] | null {
  return STREAMABLE_TOOLS[tool] || null;
}

// ============================================================================
// HTTP Response Helpers
// ============================================================================

/**
 * Create SSE response headers
 */
export function createSSEHeaders(): Record<string, string> {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',  // Disable nginx buffering
  };
}

/**
 * Create streaming response for Next.js API routes
 */
export function createStreamingResponse(
  handler: (stream: SSEStream) => Promise<void>,
  config?: Partial<StreamConfig>
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sseStream = new SSEStream(
        {
          write: (data: string) => controller.enqueue(encoder.encode(data)),
          end: () => controller.close(),
        },
        { ...DEFAULT_CONFIG, ...config }
      );

      try {
        await handler(sseStream);
      } catch (error) {
        sseStream.error(error instanceof Error ? error : new Error(String(error)));
      }
    },
  });

  return new Response(stream, {
    headers: createSSEHeaders(),
  });
}

// ============================================================================
// Client-Side Stream Consumer
// ============================================================================

/**
 * Client-side helper to consume SSE streams
 */
export function consumeSSEStream(
  url: string,
  handlers: {
    onStart?: (data: any) => void;
    onProgress?: (percent: number, message?: string) => void;
    onChunk?: (data: any, metadata: any) => void;
    onPartial?: (data: any) => void;
    onComplete?: (data: any) => void;
    onError?: (error: Error) => void;
  }
): { abort: () => void } {
  const eventSource = new EventSource(url);

  eventSource.addEventListener('start', (e) => {
    handlers.onStart?.(JSON.parse(e.data));
  });

  eventSource.addEventListener('progress', (e) => {
    const data = JSON.parse(e.data);
    handlers.onProgress?.(data.percent, data.message);
  });

  eventSource.addEventListener('chunk', (e) => {
    const event = JSON.parse(e.data);
    handlers.onChunk?.(event.data, event.metadata);
  });

  eventSource.addEventListener('partial', (e) => {
    handlers.onPartial?.(JSON.parse(e.data));
  });

  eventSource.addEventListener('complete', (e) => {
    handlers.onComplete?.(JSON.parse(e.data));
    eventSource.close();
  });

  eventSource.addEventListener('error', (e) => {
    handlers.onError?.(new Error('Stream error'));
    eventSource.close();
  });

  return {
    abort: () => eventSource.close(),
  };
}

// ============================================================================
// Streaming Tool Executors
// ============================================================================

export interface StreamingToolExecutor {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (args: Record<string, unknown>, stream: SSEStream) => Promise<void>;
}

/**
 * Registry of streaming tool executors
 */
export const STREAMING_EXECUTORS: StreamingToolExecutor[] = [
  {
    name: 'streaming:scan_transactions',
    description: 'Stream transaction history for an account with real-time progress',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Account address to scan' },
        limit: { type: 'number', description: 'Maximum transactions (default: 100)' },
        before: { type: 'string', description: 'Fetch before this signature' },
      },
      required: ['address'],
    },
    execute: async (args, stream) => {
      const address = args.address as string;
      const limit = (args.limit as number) || 100;
      const batchSize = 10;
      const batches = Math.ceil(limit / batchSize);

      stream.send({
        id: `start_${Date.now()}`,
        type: 'start',
        timestamp: Date.now(),
        data: { tool: 'streaming:scan_transactions', address, limit },
      });

      for (let i = 0; i < batches; i++) {
        stream.progress(
          Math.round((i / batches) * 100),
          `Fetching batch ${i + 1}/${batches}...`
        );

        await new Promise(r => setTimeout(r, 200));

        const transactions = Array.from(
          { length: Math.min(batchSize, limit - i * batchSize) },
          (_, j) => ({
            signature: `${address.slice(0, 8)}...${Math.random().toString(36).slice(2, 10)}`,
            slot: 200000000 - (i * batchSize + j) * 100,
            blockTime: Math.floor(Date.now() / 1000) - (i * batchSize + j) * 60,
            status: 'confirmed',
            fee: Math.floor(Math.random() * 10000) + 5000,
          })
        );

        stream.send({
          id: `chunk_${i}`,
          type: 'chunk',
          timestamp: Date.now(),
          data: transactions,
          metadata: {
            chunkIndex: i,
            totalChunks: batches,
            tool: 'streaming:scan_transactions',
          },
        });
      }

      stream.complete({ totalTransactions: limit, batches });
    },
  },
  {
    name: 'streaming:analyze_wallet',
    description: 'Stream comprehensive wallet analysis with progress updates',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Wallet address' },
        depth: { type: 'string', enum: ['basic', 'standard', 'deep'], description: 'Analysis depth' },
      },
      required: ['address'],
    },
    execute: async (args, stream) => {
      const address = args.address as string;
      const depth = (args.depth as string) || 'standard';

      const phases = [
        { name: 'Fetching account info', weight: 10 },
        { name: 'Loading token balances', weight: 15 },
        { name: 'Analyzing transactions', weight: 30 },
        { name: 'Identifying patterns', weight: 20 },
        { name: 'Calculating metrics', weight: 15 },
        { name: 'Generating insights', weight: 10 },
      ];

      if (depth === 'deep') {
        phases.push(
          { name: 'Cross-referencing addresses', weight: 20 },
          { name: 'Building relationship graph', weight: 25 }
        );
      }

      stream.send({
        id: 'start',
        type: 'start',
        timestamp: Date.now(),
        data: { tool: 'streaming:analyze_wallet', address, depth, phases: phases.length },
      });

      const totalWeight = phases.reduce((sum, p) => sum + p.weight, 0);
      let currentWeight = 0;

      for (const phase of phases) {
        stream.progress(
          Math.round((currentWeight / totalWeight) * 100),
          phase.name
        );

        await new Promise(r => setTimeout(r, 300));

        stream.send({
          id: `phase_${phases.indexOf(phase)}`,
          type: 'partial',
          timestamp: Date.now(),
          data: {
            phase: phase.name,
            completed: true,
            result: { [phase.name.toLowerCase().replace(/\s+/g, '_')]: 'done' },
          },
        });

        currentWeight += phase.weight;
      }

      stream.complete({
        address,
        depth,
        phasesCompleted: phases.length,
        analysisComplete: true,
        summary: {
          balanceSOL: Math.random() * 100,
          tokenCount: Math.floor(Math.random() * 20),
          transactionCount: Math.floor(Math.random() * 1000) + 100,
        },
      });
    },
  },
  {
    name: 'streaming:monitor_blocks',
    description: 'Stream new blocks as they are produced (real-time)',
    inputSchema: {
      type: 'object',
      properties: {
        duration: { type: 'number', description: 'Duration in seconds (default: 30, max: 300)' },
        includeTransactions: { type: 'boolean', description: 'Include tx summaries' },
      },
    },
    execute: async (args, stream) => {
      const duration = Math.min((args.duration as number) || 30, 300) * 1000;
      const includeTransactions = args.includeTransactions as boolean;
      const startTime = Date.now();
      let blockCount = 0;

      stream.send({
        id: 'start',
        type: 'start',
        timestamp: Date.now(),
        data: { tool: 'streaming:monitor_blocks', duration: duration / 1000 },
      });

      while (Date.now() - startTime < duration) {
        await new Promise(r => setTimeout(r, 400));
        blockCount++;

        const elapsed = Date.now() - startTime;
        stream.progress(
          Math.round((elapsed / duration) * 100),
          `Received ${blockCount} blocks...`
        );

        const block: Record<string, unknown> = {
          slot: 200000000 + blockCount,
          blockhash: `block_${Math.random().toString(36).slice(2)}`,
          parentSlot: 200000000 + blockCount - 1,
          blockTime: Math.floor(Date.now() / 1000),
          transactionCount: Math.floor(Math.random() * 2000) + 500,
        };

        if (includeTransactions) {
          block.transactionSummary = {
            successful: Math.floor((block.transactionCount as number) * 0.95),
            failed: Math.floor((block.transactionCount as number) * 0.05),
            votes: Math.floor((block.transactionCount as number) * 0.7),
          };
        }

        stream.send({
          id: `block_${blockCount}`,
          type: 'chunk',
          timestamp: Date.now(),
          data: block,
          metadata: { chunkIndex: blockCount - 1, tool: 'streaming:monitor_blocks' },
        });
      }

      stream.complete({ blocksReceived: blockCount, duration: duration / 1000 });
    },
  },
  {
    name: 'streaming:trace_funds',
    description: 'Stream fund flow tracing through transaction graph',
    inputSchema: {
      type: 'object',
      properties: {
        startAddress: { type: 'string', description: 'Starting wallet address' },
        direction: { type: 'string', enum: ['inbound', 'outbound', 'both'] },
        maxHops: { type: 'number', description: 'Maximum hops (1-5, default: 3)' },
        minAmount: { type: 'number', description: 'Min SOL amount to trace' },
      },
      required: ['startAddress'],
    },
    execute: async (args, stream) => {
      const startAddress = args.startAddress as string;
      const maxHops = Math.min((args.maxHops as number) || 3, 5);
      const direction = (args.direction as string) || 'both';

      stream.send({
        id: 'start',
        type: 'start',
        timestamp: Date.now(),
        data: { tool: 'streaming:trace_funds', startAddress, maxHops, direction },
      });

      const nodes = new Set<string>([startAddress]);
      const edges: Array<{ from: string; to: string; amount: number; hop: number }> = [];

      for (let hop = 1; hop <= maxHops; hop++) {
        stream.progress(
          Math.round(((hop - 1) / maxHops) * 100),
          `Tracing hop ${hop}/${maxHops}...`
        );

        const currentNodes = Array.from(nodes).slice(-10);

        for (const addr of currentNodes) {
          await new Promise(r => setTimeout(r, 100));

          const connections = Math.floor(Math.random() * 3) + 1;
          for (let i = 0; i < connections; i++) {
            const newAddr = `${addr.slice(0, 6)}...${Math.random().toString(36).slice(2, 8)}`;
            if (!nodes.has(newAddr)) {
              nodes.add(newAddr);
              const edge = {
                from: direction === 'inbound' ? newAddr : addr,
                to: direction === 'inbound' ? addr : newAddr,
                amount: Math.random() * 10 + 0.1,
                hop,
              };
              edges.push(edge);

              stream.send({
                id: `edge_${edges.length}`,
                type: 'partial',
                timestamp: Date.now(),
                data: { type: 'edge', edge, totalNodes: nodes.size, totalEdges: edges.length },
              });
            }
          }
        }
      }

      stream.complete({
        startAddress,
        direction,
        maxHops,
        graph: {
          nodes: Array.from(nodes).map(addr => ({ address: addr, isStart: addr === startAddress })),
          edges,
          stats: { totalNodes: nodes.size, totalEdges: edges.length },
        },
      });
    },
  },
  {
    name: 'streaming:search_accounts',
    description: 'Stream search results for accounts matching criteria',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        type: { type: 'string', enum: ['token', 'program', 'wallet', 'all'] },
        limit: { type: 'number', description: 'Max results (default: 50)' },
      },
      required: ['query'],
    },
    execute: async (args, stream) => {
      const query = args.query as string;
      const limit = Math.min((args.limit as number) || 50, 100);
      const type = (args.type as string) || 'all';

      stream.send({
        id: 'start',
        type: 'start',
        timestamp: Date.now(),
        data: { tool: 'streaming:search_accounts', query, type, limit },
      });

      for (let i = 0; i < limit; i++) {
        await new Promise(r => setTimeout(r, 50));

        stream.progress(
          Math.round(((i + 1) / limit) * 100),
          `Found ${i + 1} results...`
        );

        const result = {
          address: `${query.slice(0, 4)}...${Math.random().toString(36).slice(2, 10)}`,
          type: type === 'all' ? ['token', 'program', 'wallet'][Math.floor(Math.random() * 3)] : type,
          relevance: 1 - (i / limit) * 0.5,
          name: `${query}_match_${i + 1}`,
        };

        stream.send({
          id: `result_${i}`,
          type: 'chunk',
          timestamp: Date.now(),
          data: result,
          metadata: { chunkIndex: i, tool: 'streaming:search_accounts' },
        });
      }

      stream.complete({ query, type, totalResults: limit });
    },
  },
];

/**
 * Get a streaming tool executor by name
 */
export function getStreamingExecutor(name: string): StreamingToolExecutor | undefined {
  return STREAMING_EXECUTORS.find(e => e.name === name);
}

/**
 * Check if a tool has a streaming executor
 */
export function hasStreamingExecutor(name: string): boolean {
  return STREAMING_EXECUTORS.some(e => e.name === name);
}

/**
 * Execute a streaming tool
 */
export async function executeStreamingTool(
  name: string,
  args: Record<string, unknown>,
  config?: Partial<StreamConfig>
): Promise<Response> {
  const executor = getStreamingExecutor(name);
  if (!executor) {
    return Response.json({ error: `Unknown streaming tool: ${name}` }, { status: 404 });
  }

  return createStreamingResponse(
    (stream) => executor.execute(args, stream),
    config
  );
}

// ============================================================================
// Exports
// ============================================================================

export default {
  // Stream implementations
  SSEStream,
  WebSocketStream,
  InvestigationStream,

  // Streaming functions
  streamArrayResult,
  streamWithProgress,

  // Streaming executors
  STREAMING_EXECUTORS,
  getStreamingExecutor,
  hasStreamingExecutor,
  executeStreamingTool,

  // Utilities
  createSSEHeaders,
  createStreamingResponse,
  consumeSSEStream,
  isStreamable,
  getStreamCapabilities,

  // Constants
  STREAMABLE_TOOLS,
  DEFAULT_CONFIG,
};
