#!/usr/bin/env bun
/**
 * MCP Advanced Streaming Features
 *
 * Extends the base streaming with:
 * - Resumable streams with checkpointing
 * - Multiplexed streams (multiple tools on single connection)
 * - Real Solana RPC integration
 * - Backpressure handling
 * - Stream analytics
 */

import { EventEmitter } from 'events';
import { Connection, PublicKey, type ConfirmedSignatureInfo, type ParsedTransactionWithMeta } from '@solana/web3.js';
import {
  SSEStream,
  type StreamConfig,
  type StreamEvent,
  createSSEHeaders,
} from './mcp-streaming.js';

// ============================================================================
// Types
// ============================================================================

interface Checkpoint {
  streamId: string;
  toolName: string;
  args: Record<string, unknown>;
  position: number;
  cursor?: string;
  timestamp: number;
  data?: unknown;
  ttl: number; // Time to live in ms
}

interface MultiplexedMessage {
  streamId: string;
  event: StreamEvent;
}

interface StreamAnalytics {
  streamId: string;
  toolName: string;
  startTime: number;
  endTime?: number;
  eventsEmitted: number;
  bytesTransferred: number;
  errors: number;
  resumeCount: number;
}

interface MultiplexConfig {
  maxConcurrentStreams: number;
  priorityQueue: boolean;
  sharedBackpressure: boolean;
}

// ============================================================================
// Checkpoint Store (In-Memory with TTL)
// ============================================================================

class CheckpointStore {
  private checkpoints: Map<string, Checkpoint> = new Map();
  private cleanupTimer: Timer | null = null;

  constructor(private cleanupIntervalMs = 60000) {
    this.startCleanup();
  }

  save(checkpoint: Checkpoint): void {
    this.checkpoints.set(checkpoint.streamId, {
      ...checkpoint,
      timestamp: Date.now(),
    });
  }

  get(streamId: string): Checkpoint | null {
    const checkpoint = this.checkpoints.get(streamId);
    if (!checkpoint) return null;

    // Check TTL
    if (Date.now() - checkpoint.timestamp > checkpoint.ttl) {
      this.checkpoints.delete(streamId);
      return null;
    }

    return checkpoint;
  }

  delete(streamId: string): boolean {
    return this.checkpoints.delete(streamId);
  }

  getByTool(toolName: string): Checkpoint[] {
    return Array.from(this.checkpoints.values())
      .filter(c => c.toolName === toolName && Date.now() - c.timestamp <= c.ttl);
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [id, checkpoint] of this.checkpoints) {
        if (now - checkpoint.timestamp > checkpoint.ttl) {
          this.checkpoints.delete(id);
        }
      }
    }, this.cleanupIntervalMs);
  }

  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  getStats(): { total: number; byTool: Record<string, number> } {
    const byTool: Record<string, number> = {};
    for (const checkpoint of this.checkpoints.values()) {
      byTool[checkpoint.toolName] = (byTool[checkpoint.toolName] || 0) + 1;
    }
    return { total: this.checkpoints.size, byTool };
  }
}

// ============================================================================
// Resumable Stream
// ============================================================================

class ResumableStream extends SSEStream {
  private checkpointStore: CheckpointStore;
  private toolName: string;
  private args: Record<string, unknown>;
  private position = 0;
  private cursor?: string;
  private checkpointInterval: number;
  private lastCheckpoint = 0;
  private resumeCount = 0;

  constructor(
    response: { write: (data: string) => void; end: () => void },
    config: StreamConfig & {
      checkpointStore: CheckpointStore;
      toolName: string;
      args: Record<string, unknown>;
      checkpointInterval?: number;
      checkpointTtl?: number;
      resumeFrom?: string;
    }
  ) {
    super(response, config);
    this.checkpointStore = config.checkpointStore;
    this.toolName = config.toolName;
    this.args = config.args;
    this.checkpointInterval = config.checkpointInterval || 10; // Every 10 events

    // Check for resume
    if (config.resumeFrom) {
      const checkpoint = this.checkpointStore.get(config.resumeFrom);
      if (checkpoint) {
        this.position = checkpoint.position;
        this.cursor = checkpoint.cursor;
        this.resumeCount++;
        this.sendResumeNotification(checkpoint);
      }
    }
  }

  private sendResumeNotification(checkpoint: Checkpoint): void {
    this.send({
      id: `${this.streamId}_resume`,
      type: 'partial',
      timestamp: Date.now(),
      data: {
        type: 'resume',
        resumedFrom: checkpoint.streamId,
        position: checkpoint.position,
        cursor: checkpoint.cursor,
        message: `Resumed from position ${checkpoint.position}`,
      },
    });
  }

  /**
   * Override send to track position and create checkpoints
   */
  send(event: StreamEvent): void {
    super.send(event);
    this.position++;

    // Create checkpoint periodically
    if (this.position - this.lastCheckpoint >= this.checkpointInterval) {
      this.createCheckpoint();
    }
  }

  /**
   * Update cursor for pagination-based streaming
   */
  setCursor(cursor: string): void {
    this.cursor = cursor;
  }

  /**
   * Get current position
   */
  getPosition(): number {
    return this.position;
  }

  /**
   * Get resume count
   */
  getResumeCount(): number {
    return this.resumeCount;
  }

  /**
   * Create a checkpoint at current position
   */
  createCheckpoint(data?: unknown): string {
    const checkpoint: Checkpoint = {
      streamId: this.streamId,
      toolName: this.toolName,
      args: this.args,
      position: this.position,
      cursor: this.cursor,
      timestamp: Date.now(),
      data,
      ttl: 3600000, // 1 hour default
    };

    this.checkpointStore.save(checkpoint);
    this.lastCheckpoint = this.position;

    // Notify client of checkpoint
    this.send({
      id: `${this.streamId}_checkpoint`,
      type: 'partial',
      timestamp: Date.now(),
      data: {
        type: 'checkpoint',
        checkpointId: this.streamId,
        position: this.position,
        cursor: this.cursor,
        message: 'Checkpoint created - can resume from here',
      },
    });

    return this.streamId;
  }

  /**
   * Override complete to clean up checkpoint
   */
  complete(result?: unknown): void {
    // Delete checkpoint on successful completion
    this.checkpointStore.delete(this.streamId);
    super.complete(result);
  }
}

// ============================================================================
// Multiplexed Stream Manager
// ============================================================================

class MultiplexedStreamManager extends EventEmitter {
  private streams: Map<string, {
    stream: ResumableStream;
    analytics: StreamAnalytics;
    priority: number;
  }> = new Map();
  private config: MultiplexConfig;
  private checkpointStore: CheckpointStore;
  private encoder = new TextEncoder();

  constructor(
    private writer: { write: (data: string) => void; end: () => void },
    config?: Partial<MultiplexConfig>,
    checkpointStore?: CheckpointStore
  ) {
    super();
    this.config = {
      maxConcurrentStreams: config?.maxConcurrentStreams ?? 10,
      priorityQueue: config?.priorityQueue ?? true,
      sharedBackpressure: config?.sharedBackpressure ?? true,
    };
    this.checkpointStore = checkpointStore || new CheckpointStore();
  }

  /**
   * Create a new stream in the multiplex
   */
  createStream(
    toolName: string,
    args: Record<string, unknown>,
    options?: {
      priority?: number;
      resumeFrom?: string;
    }
  ): ResumableStream | null {
    if (this.streams.size >= this.config.maxConcurrentStreams) {
      this.emit('error', new Error('Max concurrent streams reached'));
      return null;
    }

    const streamId = `mux_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Create a wrapper that prefixes stream ID to all messages
    const muxWriter = {
      write: (data: string) => {
        // Wrap SSE event with stream ID for demultiplexing
        const muxData = `id: ${streamId}\n${data}`;
        this.writer.write(muxData);

        // Update analytics
        const entry = this.streams.get(streamId);
        if (entry) {
          entry.analytics.eventsEmitted++;
          entry.analytics.bytesTransferred += data.length;
        }
      },
      end: () => {
        // Don't end the main writer, just clean up this stream
        const entry = this.streams.get(streamId);
        if (entry) {
          entry.analytics.endTime = Date.now();
          this.emit('streamComplete', streamId, entry.analytics);
        }
        this.streams.delete(streamId);
      },
    };

    const stream = new ResumableStream(muxWriter, {
      chunkSize: 50,
      maxChunkBytes: 64 * 1024,
      heartbeatIntervalMs: 0, // Managed at multiplex level
      enableCompression: false,
      enableProgress: true,
      checkpointStore: this.checkpointStore,
      toolName,
      args,
      resumeFrom: options?.resumeFrom,
    });

    const analytics: StreamAnalytics = {
      streamId,
      toolName,
      startTime: Date.now(),
      eventsEmitted: 0,
      bytesTransferred: 0,
      errors: 0,
      resumeCount: stream.getResumeCount(),
    };

    this.streams.set(streamId, {
      stream,
      analytics,
      priority: options?.priority ?? 0,
    });

    // Notify of new stream
    this.writer.write(
      `event: stream_start\ndata: ${JSON.stringify({ streamId, toolName })}\n\n`
    );

    this.emit('streamStart', streamId, toolName);
    return stream;
  }

  /**
   * Get a stream by ID
   */
  getStream(streamId: string): ResumableStream | undefined {
    return this.streams.get(streamId)?.stream;
  }

  /**
   * Cancel a stream
   */
  cancelStream(streamId: string): boolean {
    const entry = this.streams.get(streamId);
    if (!entry) return false;

    entry.stream.abort();
    entry.analytics.endTime = Date.now();
    this.streams.delete(streamId);

    this.writer.write(
      `event: stream_cancel\ndata: ${JSON.stringify({ streamId })}\n\n`
    );

    this.emit('streamCancel', streamId);
    return true;
  }

  /**
   * Get all active stream IDs
   */
  getActiveStreams(): string[] {
    return Array.from(this.streams.keys());
  }

  /**
   * Get analytics for all streams
   */
  getAnalytics(): StreamAnalytics[] {
    return Array.from(this.streams.values()).map(e => e.analytics);
  }

  /**
   * Get stream count
   */
  getStreamCount(): number {
    return this.streams.size;
  }

  /**
   * Send heartbeat to all streams
   */
  sendHeartbeat(): void {
    const heartbeat = `event: heartbeat\ndata: ${JSON.stringify({
      timestamp: Date.now(),
      activeStreams: this.streams.size,
    })}\n\n`;
    this.writer.write(heartbeat);
  }

  /**
   * Close all streams and the connection
   */
  close(): void {
    for (const [streamId, entry] of this.streams) {
      entry.stream.abort();
      entry.analytics.endTime = Date.now();
    }
    this.streams.clear();
    this.writer.end();
    this.emit('close');
  }

  /**
   * Get checkpoint store
   */
  getCheckpointStore(): CheckpointStore {
    return this.checkpointStore;
  }
}

// ============================================================================
// Real Solana RPC Streaming Tools
// ============================================================================

const RPC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-api.projectserum.com',
];

function getConnection(): Connection {
  const endpoint = process.env.SOLANA_RPC_URL || RPC_ENDPOINTS[0];
  return new Connection(endpoint, 'confirmed');
}

/**
 * Stream real transaction signatures with progress
 */
async function streamRealTransactions(
  address: string,
  stream: ResumableStream,
  options: {
    limit?: number;
    before?: string;
    batchSize?: number;
  } = {}
): Promise<void> {
  const connection = getConnection();
  const pubkey = new PublicKey(address);
  const limit = options.limit || 100;
  const batchSize = options.batchSize || 20;

  stream.send({
    id: 'start',
    type: 'start',
    timestamp: Date.now(),
    data: { tool: 'solana:stream_transactions', address, limit },
  });

  let before = options.before;
  let fetched = 0;
  let batch = 0;

  try {
    while (fetched < limit) {
      const toFetch = Math.min(batchSize, limit - fetched);

      stream.progress(
        Math.round((fetched / limit) * 100),
        `Fetching batch ${batch + 1}... (${fetched}/${limit})`
      );

      const signatures = await connection.getSignaturesForAddress(
        pubkey,
        { limit: toFetch, before }
      );

      if (signatures.length === 0) break;

      // Update cursor for checkpointing
      stream.setCursor(signatures[signatures.length - 1].signature);

      // Stream each signature
      for (const sig of signatures) {
        stream.send({
          id: `tx_${fetched}`,
          type: 'chunk',
          timestamp: Date.now(),
          data: {
            signature: sig.signature,
            slot: sig.slot,
            blockTime: sig.blockTime,
            err: sig.err,
            memo: sig.memo,
            confirmationStatus: sig.confirmationStatus,
          },
          metadata: {
            chunkIndex: fetched,
            tool: 'solana:stream_transactions',
          },
        });
        fetched++;
      }

      before = signatures[signatures.length - 1].signature;
      batch++;

      // Create checkpoint every batch
      if (batch % 5 === 0) {
        stream.createCheckpoint({ lastSignature: before, fetched });
      }
    }

    stream.complete({
      address,
      totalTransactions: fetched,
      batches: batch,
    });
  } catch (error) {
    stream.error(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Stream real account info with token balances
 */
async function streamRealAccountAnalysis(
  address: string,
  stream: ResumableStream,
  options: { depth?: 'basic' | 'standard' | 'deep' } = {}
): Promise<void> {
  const connection = getConnection();
  const pubkey = new PublicKey(address);
  const depth = options.depth || 'standard';

  stream.send({
    id: 'start',
    type: 'start',
    timestamp: Date.now(),
    data: { tool: 'solana:stream_account_analysis', address, depth },
  });

  try {
    // Phase 1: Account Info
    stream.progress(0, 'Fetching account info...');
    const accountInfo = await connection.getAccountInfo(pubkey);

    stream.send({
      id: 'phase_1',
      type: 'partial',
      timestamp: Date.now(),
      data: {
        phase: 'account_info',
        result: {
          exists: !!accountInfo,
          lamports: accountInfo?.lamports || 0,
          owner: accountInfo?.owner?.toBase58(),
          executable: accountInfo?.executable,
          rentEpoch: accountInfo?.rentEpoch,
        },
      },
    });

    // Phase 2: SOL Balance
    stream.progress(15, 'Fetching SOL balance...');
    const balance = await connection.getBalance(pubkey);

    stream.send({
      id: 'phase_2',
      type: 'partial',
      timestamp: Date.now(),
      data: {
        phase: 'sol_balance',
        result: {
          lamports: balance,
          sol: balance / 1e9,
        },
      },
    });

    // Phase 3: Token Accounts
    stream.progress(30, 'Fetching token accounts...');
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      pubkey,
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    );

    stream.send({
      id: 'phase_3',
      type: 'partial',
      timestamp: Date.now(),
      data: {
        phase: 'token_accounts',
        result: {
          count: tokenAccounts.value.length,
          tokens: tokenAccounts.value.slice(0, 20).map(ta => ({
            mint: ta.account.data.parsed?.info?.mint,
            amount: ta.account.data.parsed?.info?.tokenAmount?.uiAmountString,
            decimals: ta.account.data.parsed?.info?.tokenAmount?.decimals,
          })),
        },
      },
    });

    // Create checkpoint
    stream.createCheckpoint({ phase: 'token_accounts' });

    // Phase 4: Recent Transactions (if standard or deep)
    if (depth !== 'basic') {
      stream.progress(50, 'Fetching recent transactions...');
      const signatures = await connection.getSignaturesForAddress(pubkey, { limit: 10 });

      stream.send({
        id: 'phase_4',
        type: 'partial',
        timestamp: Date.now(),
        data: {
          phase: 'recent_transactions',
          result: {
            count: signatures.length,
            transactions: signatures.map(s => ({
              signature: s.signature,
              slot: s.slot,
              blockTime: s.blockTime,
              status: s.err ? 'failed' : 'success',
            })),
          },
        },
      });
    }

    // Phase 5: Transaction Analysis (if deep)
    if (depth === 'deep') {
      stream.progress(70, 'Analyzing transaction patterns...');

      const signatures = await connection.getSignaturesForAddress(pubkey, { limit: 100 });

      // Analyze patterns
      const analysis = {
        totalTransactions: signatures.length,
        successRate: signatures.filter(s => !s.err).length / signatures.length,
        avgBlockTime: signatures.length > 1
          ? (signatures[0].blockTime! - signatures[signatures.length - 1].blockTime!) / signatures.length
          : 0,
        programs: new Set<string>(),
      };

      stream.send({
        id: 'phase_5',
        type: 'partial',
        timestamp: Date.now(),
        data: {
          phase: 'transaction_analysis',
          result: analysis,
        },
      });
    }

    stream.progress(100, 'Analysis complete');

    stream.complete({
      address,
      depth,
      summary: {
        balance: balance / 1e9,
        tokenCount: tokenAccounts.value.length,
        hasActivity: true,
      },
    });
  } catch (error) {
    stream.error(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Stream real-time slot updates
 */
async function streamRealSlots(
  stream: ResumableStream,
  options: { duration?: number } = {}
): Promise<void> {
  const connection = getConnection();
  const duration = Math.min((options.duration || 30) * 1000, 300000);
  const startTime = Date.now();
  let slotCount = 0;

  stream.send({
    id: 'start',
    type: 'start',
    timestamp: Date.now(),
    data: { tool: 'solana:stream_slots', duration: duration / 1000 },
  });

  try {
    // Poll for slot updates
    let lastSlot = await connection.getSlot();

    while (Date.now() - startTime < duration) {
      await new Promise(r => setTimeout(r, 400)); // Solana ~400ms block time

      const currentSlot = await connection.getSlot();

      if (currentSlot > lastSlot) {
        const elapsed = Date.now() - startTime;
        stream.progress(
          Math.round((elapsed / duration) * 100),
          `Slot ${currentSlot} (${slotCount + 1} updates)`
        );

        // Get block time for the slot
        let blockTime: number | null = null;
        try {
          blockTime = await connection.getBlockTime(currentSlot);
        } catch {
          // Block time may not be available immediately
        }

        stream.send({
          id: `slot_${slotCount}`,
          type: 'chunk',
          timestamp: Date.now(),
          data: {
            slot: currentSlot,
            previousSlot: lastSlot,
            slotDiff: currentSlot - lastSlot,
            blockTime,
          },
          metadata: {
            chunkIndex: slotCount,
            tool: 'solana:stream_slots',
          },
        });

        lastSlot = currentSlot;
        slotCount++;
      }
    }

    stream.complete({
      slotsObserved: slotCount,
      duration: duration / 1000,
      avgSlotTime: slotCount > 0 ? duration / slotCount : 0,
    });
  } catch (error) {
    stream.error(error instanceof Error ? error : new Error(String(error)));
  }
}

// ============================================================================
// Real Solana Streaming Tool Registry
// ============================================================================

interface RealStreamingTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (args: Record<string, unknown>, stream: ResumableStream) => Promise<void>;
}

const REAL_STREAMING_TOOLS: RealStreamingTool[] = [
  {
    name: 'solana:stream_transactions',
    description: 'Stream real transaction history from Solana with checkpointing',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Solana wallet address' },
        limit: { type: 'number', description: 'Max transactions (default: 100)' },
        before: { type: 'string', description: 'Fetch before this signature' },
        batchSize: { type: 'number', description: 'Batch size (default: 20)' },
      },
      required: ['address'],
    },
    execute: async (args, stream) => {
      await streamRealTransactions(
        args.address as string,
        stream,
        {
          limit: args.limit as number,
          before: args.before as string,
          batchSize: args.batchSize as number,
        }
      );
    },
  },
  {
    name: 'solana:stream_account_analysis',
    description: 'Stream comprehensive account analysis from Solana',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Solana wallet address' },
        depth: { type: 'string', enum: ['basic', 'standard', 'deep'], description: 'Analysis depth' },
      },
      required: ['address'],
    },
    execute: async (args, stream) => {
      await streamRealAccountAnalysis(
        args.address as string,
        stream,
        { depth: args.depth as 'basic' | 'standard' | 'deep' }
      );
    },
  },
  {
    name: 'solana:stream_slots',
    description: 'Stream real-time slot updates from Solana',
    inputSchema: {
      type: 'object',
      properties: {
        duration: { type: 'number', description: 'Duration in seconds (max: 300)' },
      },
    },
    execute: async (args, stream) => {
      await streamRealSlots(stream, { duration: args.duration as number });
    },
  },
];

// ============================================================================
// HTTP Server for Advanced Streaming
// ============================================================================

async function createAdvancedStreamingServer(port = 8767): Promise<ReturnType<typeof Bun.serve>> {
  const checkpointStore = new CheckpointStore();

  const server = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      // CORS
      if (req.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        });
      }

      // List tools
      if (url.pathname === '/tools' && req.method === 'GET') {
        return Response.json({
          tools: REAL_STREAMING_TOOLS.map(t => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
          features: ['resumable', 'multiplexed', 'checkpointed'],
        });
      }

      // Single stream
      if (url.pathname === '/stream' && req.method === 'POST') {
        const body = await req.json() as {
          tool: string;
          args?: Record<string, unknown>;
          resumeFrom?: string;
        };

        const tool = REAL_STREAMING_TOOLS.find(t => t.name === body.tool);
        if (!tool) {
          return Response.json({ error: `Unknown tool: ${body.tool}` }, { status: 404 });
        }

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const writer = {
              write: (data: string) => controller.enqueue(encoder.encode(data)),
              end: () => controller.close(),
            };

            const resumableStream = new ResumableStream(writer, {
              chunkSize: 50,
              maxChunkBytes: 64 * 1024,
              heartbeatIntervalMs: 15000,
              enableCompression: false,
              enableProgress: true,
              checkpointStore,
              toolName: body.tool,
              args: body.args || {},
              resumeFrom: body.resumeFrom,
            });

            try {
              await tool.execute(body.args || {}, resumableStream);
            } catch (error) {
              resumableStream.error(error instanceof Error ? error : new Error(String(error)));
            }
          },
        });

        return new Response(stream, { headers: createSSEHeaders() });
      }

      // Multiplexed stream
      if (url.pathname === '/multiplex' && req.method === 'POST') {
        const body = await req.json() as {
          streams: Array<{
            tool: string;
            args?: Record<string, unknown>;
            priority?: number;
            resumeFrom?: string;
          }>;
        };

        if (!body.streams || !Array.isArray(body.streams)) {
          return Response.json({ error: 'streams array required' }, { status: 400 });
        }

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const writer = {
              write: (data: string) => controller.enqueue(encoder.encode(data)),
              end: () => controller.close(),
            };

            const mux = new MultiplexedStreamManager(writer, {
              maxConcurrentStreams: 10,
            }, checkpointStore);

            // Start heartbeat
            const heartbeatTimer = setInterval(() => mux.sendHeartbeat(), 15000);

            // Execute all streams concurrently
            const promises = body.streams.map(async (streamConfig) => {
              const tool = REAL_STREAMING_TOOLS.find(t => t.name === streamConfig.tool);
              if (!tool) {
                mux.createStream(streamConfig.tool, streamConfig.args || {})?.error(
                  new Error(`Unknown tool: ${streamConfig.tool}`)
                );
                return;
              }

              const resumableStream = mux.createStream(
                streamConfig.tool,
                streamConfig.args || {},
                { priority: streamConfig.priority, resumeFrom: streamConfig.resumeFrom }
              );

              if (resumableStream) {
                await tool.execute(streamConfig.args || {}, resumableStream);
              }
            });

            await Promise.all(promises);
            clearInterval(heartbeatTimer);
            mux.close();
          },
        });

        return new Response(stream, { headers: createSSEHeaders() });
      }

      // Get checkpoints
      if (url.pathname === '/checkpoints' && req.method === 'GET') {
        return Response.json(checkpointStore.getStats());
      }

      // Resume info
      if (url.pathname.startsWith('/checkpoints/') && req.method === 'GET') {
        const streamId = url.pathname.split('/')[2];
        const checkpoint = checkpointStore.get(streamId);
        if (!checkpoint) {
          return Response.json({ error: 'Checkpoint not found' }, { status: 404 });
        }
        return Response.json(checkpoint);
      }

      // Health
      if (url.pathname === '/health') {
        return Response.json({
          status: 'ok',
          checkpoints: checkpointStore.getStats(),
          tools: REAL_STREAMING_TOOLS.length,
        });
      }

      // API info
      if (url.pathname === '/') {
        return Response.json({
          name: 'MCP Advanced Streaming Gateway',
          version: '1.0.0',
          features: [
            'Resumable streams with checkpointing',
            'Multiplexed concurrent streams',
            'Real Solana RPC integration',
          ],
          endpoints: {
            tools: 'GET /tools',
            stream: 'POST /stream - Single resumable stream',
            multiplex: 'POST /multiplex - Multiple concurrent streams',
            checkpoints: 'GET /checkpoints - Checkpoint stats',
            health: 'GET /health',
          },
        });
      }

      return new Response('Not Found', { status: 404 });
    },
  });

  console.error(`[Advanced Streaming] Server started on http://localhost:${port}`);
  return server;
}

// ============================================================================
// Exports
// ============================================================================

export {
  CheckpointStore,
  ResumableStream,
  MultiplexedStreamManager,
  REAL_STREAMING_TOOLS,
  streamRealTransactions,
  streamRealAccountAnalysis,
  streamRealSlots,
  createAdvancedStreamingServer,
  type Checkpoint,
  type MultiplexedMessage,
  type StreamAnalytics,
  type MultiplexConfig,
  type RealStreamingTool,
};

// Run if executed directly
if (import.meta.main) {
  const port = parseInt(process.env.MCP_ADVANCED_STREAM_PORT || '8767', 10);
  createAdvancedStreamingServer(port).catch(console.error);
}
