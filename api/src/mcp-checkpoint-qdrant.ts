#!/usr/bin/env bun
/**
 * MCP Checkpoint Persistence with Qdrant
 *
 * Provides persistent checkpoint storage using Qdrant vector database.
 * Features:
 * - Survives server restarts
 * - TTL-based expiration
 * - Semantic search on checkpoints
 * - Query by tool name, user, tags
 * - Analytics and metrics
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { EventEmitter } from 'events';
import type { Checkpoint } from './mcp-streaming-advanced.js';

// ============================================================================
// Configuration
// ============================================================================

const COLLECTION_NAME = 'mcp_stream_checkpoints';
const VECTOR_SIZE = 384; // For semantic embeddings
const DEFAULT_TTL_MS = 3600000; // 1 hour

interface QdrantCheckpointConfig {
  url?: string;
  apiKey?: string;
  collectionName?: string;
  cleanupIntervalMs?: number;
  enableSemanticSearch?: boolean;
}

interface CheckpointDocument {
  streamId: string;
  toolName: string;
  args: Record<string, unknown>;
  position: number;
  cursor?: string;
  timestamp: number;
  expiresAt: number;
  data?: unknown;
  ttl: number;
  // Metadata for querying
  userId?: string;
  tags?: string[];
  description?: string;
  // Analytics
  resumeCount: number;
  totalEvents: number;
  bytesProcessed: number;
}

interface CheckpointSearchResult {
  checkpoint: Checkpoint;
  score: number;
  distance?: number;
}

// ============================================================================
// Simple Text Embedding (for semantic search)
// ============================================================================

function simpleTextEmbedding(text: string): number[] {
  // Simple bag-of-characters embedding for demo
  // In production, use a proper embedding model
  const vector = new Array(VECTOR_SIZE).fill(0);
  const normalized = text.toLowerCase();

  for (let i = 0; i < normalized.length; i++) {
    const charCode = normalized.charCodeAt(i);
    const idx = charCode % VECTOR_SIZE;
    vector[idx] += 1;
  }

  // Normalize
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (magnitude > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= magnitude;
    }
  }

  return vector;
}

function checkpointToEmbedding(checkpoint: CheckpointDocument): number[] {
  // Create searchable text from checkpoint
  const text = [
    checkpoint.toolName,
    checkpoint.description || '',
    checkpoint.tags?.join(' ') || '',
    JSON.stringify(checkpoint.args),
  ].join(' ');

  return simpleTextEmbedding(text);
}

// ============================================================================
// Qdrant Checkpoint Store
// ============================================================================

export class QdrantCheckpointStore extends EventEmitter {
  private client: QdrantClient;
  private collectionName: string;
  private cleanupTimer: Timer | null = null;
  private initialized = false;
  private enableSemanticSearch: boolean;

  constructor(config: QdrantCheckpointConfig = {}) {
    super();
    this.client = new QdrantClient({
      url: config.url || process.env.QDRANT_SERVER || 'http://localhost:6333',
      apiKey: config.apiKey || process.env.QDRANT || undefined,
    });
    this.collectionName = config.collectionName || COLLECTION_NAME;
    this.enableSemanticSearch = config.enableSemanticSearch ?? true;

    // Start cleanup timer
    const cleanupInterval = config.cleanupIntervalMs || 60000;
    this.startCleanup(cleanupInterval);
  }

  /**
   * Initialize the collection if it doesn't exist
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const exists = await this.client.getCollection(this.collectionName).catch(() => null);

      if (!exists) {
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: VECTOR_SIZE,
            distance: 'Cosine',
          },
        });

        // Create indexes for efficient querying
        await this.createIndexes();

        console.log(`[Qdrant] Created checkpoint collection: ${this.collectionName}`);
      }

      this.initialized = true;
      this.emit('initialized');
    } catch (error) {
      console.error('[Qdrant] Failed to initialize:', error);
      throw error;
    }
  }

  private async createIndexes(): Promise<void> {
    const indexes = [
      'streamId',
      'toolName',
      'userId',
      'expiresAt',
    ];

    for (const field of indexes) {
      try {
        await this.client.createPayloadIndex(this.collectionName, {
          field_name: field,
          field_schema: 'keyword',
        });
      } catch (error: unknown) {
        // Index might already exist
        const msg = error instanceof Error ? error.message : String(error);
        if (!msg.includes('already exists')) {
          console.warn(`[Qdrant] Failed to create index for ${field}:`, msg);
        }
      }
    }

    // Integer index for expiresAt (for range queries)
    try {
      await this.client.createPayloadIndex(this.collectionName, {
        field_name: 'expiresAt',
        field_schema: 'integer',
      });
    } catch {
      // Ignore if exists
    }
  }

  /**
   * Save a checkpoint
   */
  async save(checkpoint: Checkpoint & {
    userId?: string;
    tags?: string[];
    description?: string;
    resumeCount?: number;
    totalEvents?: number;
    bytesProcessed?: number;
  }): Promise<void> {
    await this.initialize();

    const doc: CheckpointDocument = {
      streamId: checkpoint.streamId,
      toolName: checkpoint.toolName,
      args: checkpoint.args,
      position: checkpoint.position,
      cursor: checkpoint.cursor,
      timestamp: checkpoint.timestamp || Date.now(),
      expiresAt: Date.now() + (checkpoint.ttl || DEFAULT_TTL_MS),
      data: checkpoint.data,
      ttl: checkpoint.ttl || DEFAULT_TTL_MS,
      userId: checkpoint.userId,
      tags: checkpoint.tags,
      description: checkpoint.description,
      resumeCount: checkpoint.resumeCount || 0,
      totalEvents: checkpoint.totalEvents || 0,
      bytesProcessed: checkpoint.bytesProcessed || 0,
    };

    const vector = this.enableSemanticSearch
      ? checkpointToEmbedding(doc)
      : new Array(VECTOR_SIZE).fill(0);

    // Generate a numeric ID from streamId
    const pointId = this.streamIdToPointId(checkpoint.streamId);

    await this.client.upsert(this.collectionName, {
      wait: true,
      points: [{
        id: pointId,
        vector,
        payload: doc,
      }],
    });

    this.emit('saved', checkpoint.streamId);
  }

  /**
   * Get a checkpoint by stream ID
   */
  async get(streamId: string): Promise<Checkpoint | null> {
    await this.initialize();

    try {
      const result = await this.client.scroll(this.collectionName, {
        filter: {
          must: [
            { key: 'streamId', match: { value: streamId } },
          ],
        },
        limit: 1,
        with_payload: true,
      });

      if (!result.points || result.points.length === 0) {
        return null;
      }

      const doc = result.points[0].payload as CheckpointDocument;

      // Check TTL
      if (Date.now() > doc.expiresAt) {
        await this.delete(streamId);
        return null;
      }

      return this.documentToCheckpoint(doc);
    } catch (error) {
      console.error('[Qdrant] Failed to get checkpoint:', error);
      return null;
    }
  }

  /**
   * Delete a checkpoint
   */
  async delete(streamId: string): Promise<boolean> {
    await this.initialize();

    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        filter: {
          must: [
            { key: 'streamId', match: { value: streamId } },
          ],
        },
      });

      this.emit('deleted', streamId);
      return true;
    } catch (error) {
      console.error('[Qdrant] Failed to delete checkpoint:', error);
      return false;
    }
  }

  /**
   * Get all checkpoints for a tool
   */
  async getByTool(toolName: string, limit = 100): Promise<Checkpoint[]> {
    await this.initialize();

    try {
      const result = await this.client.scroll(this.collectionName, {
        filter: {
          must: [
            { key: 'toolName', match: { value: toolName } },
            { key: 'expiresAt', range: { gt: Date.now() } },
          ],
        },
        limit,
        with_payload: true,
      });

      return (result.points || [])
        .map(p => this.documentToCheckpoint(p.payload as CheckpointDocument));
    } catch (error) {
      console.error('[Qdrant] Failed to get checkpoints by tool:', error);
      return [];
    }
  }

  /**
   * Get all checkpoints for a user
   */
  async getByUser(userId: string, limit = 100): Promise<Checkpoint[]> {
    await this.initialize();

    try {
      const result = await this.client.scroll(this.collectionName, {
        filter: {
          must: [
            { key: 'userId', match: { value: userId } },
            { key: 'expiresAt', range: { gt: Date.now() } },
          ],
        },
        limit,
        with_payload: true,
      });

      return (result.points || [])
        .map(p => this.documentToCheckpoint(p.payload as CheckpointDocument));
    } catch (error) {
      console.error('[Qdrant] Failed to get checkpoints by user:', error);
      return [];
    }
  }

  /**
   * Semantic search for checkpoints
   */
  async search(
    query: string,
    options: {
      limit?: number;
      toolName?: string;
      userId?: string;
      tags?: string[];
    } = {}
  ): Promise<CheckpointSearchResult[]> {
    await this.initialize();

    if (!this.enableSemanticSearch) {
      console.warn('[Qdrant] Semantic search is disabled');
      return [];
    }

    try {
      const vector = simpleTextEmbedding(query);

      const filter: { must: Array<{ key: string; match: { value: string } } | { key: string; match: { any: string[] } } | { key: string; range: { gt: number } }> } = {
        must: [
          { key: 'expiresAt', range: { gt: Date.now() } },
        ],
      };

      if (options.toolName) {
        filter.must.push({ key: 'toolName', match: { value: options.toolName } });
      }
      if (options.userId) {
        filter.must.push({ key: 'userId', match: { value: options.userId } });
      }
      if (options.tags?.length) {
        filter.must.push({ key: 'tags', match: { any: options.tags } });
      }

      const result = await this.client.search(this.collectionName, {
        vector,
        filter,
        limit: options.limit || 10,
        with_payload: true,
      });

      return result.map(r => ({
        checkpoint: this.documentToCheckpoint(r.payload as CheckpointDocument),
        score: r.score,
      }));
    } catch (error) {
      console.error('[Qdrant] Search failed:', error);
      return [];
    }
  }

  /**
   * Get checkpoints with specific tags
   */
  async getByTags(tags: string[], limit = 100): Promise<Checkpoint[]> {
    await this.initialize();

    try {
      const result = await this.client.scroll(this.collectionName, {
        filter: {
          must: [
            { key: 'tags', match: { any: tags } },
            { key: 'expiresAt', range: { gt: Date.now() } },
          ],
        },
        limit,
        with_payload: true,
      });

      return (result.points || [])
        .map(p => this.documentToCheckpoint(p.payload as CheckpointDocument));
    } catch (error) {
      console.error('[Qdrant] Failed to get checkpoints by tags:', error);
      return [];
    }
  }

  /**
   * Update checkpoint analytics
   */
  async updateAnalytics(
    streamId: string,
    analytics: {
      resumeCount?: number;
      totalEvents?: number;
      bytesProcessed?: number;
    }
  ): Promise<void> {
    await this.initialize();

    const checkpoint = await this.get(streamId);
    if (!checkpoint) return;

    await this.save({
      ...checkpoint,
      ...analytics,
    });
  }

  /**
   * Extend checkpoint TTL
   */
  async extendTtl(streamId: string, additionalMs: number): Promise<boolean> {
    await this.initialize();

    try {
      const result = await this.client.scroll(this.collectionName, {
        filter: {
          must: [
            { key: 'streamId', match: { value: streamId } },
          ],
        },
        limit: 1,
        with_payload: true,
      });

      if (!result.points || result.points.length === 0) {
        return false;
      }

      const doc = result.points[0].payload as CheckpointDocument;
      doc.expiresAt += additionalMs;
      doc.ttl += additionalMs;

      const vector = this.enableSemanticSearch
        ? checkpointToEmbedding(doc)
        : new Array(VECTOR_SIZE).fill(0);

      await this.client.upsert(this.collectionName, {
        wait: true,
        points: [{
          id: this.streamIdToPointId(streamId),
          vector,
          payload: doc,
        }],
      });

      return true;
    } catch (error) {
      console.error('[Qdrant] Failed to extend TTL:', error);
      return false;
    }
  }

  /**
   * Get collection statistics
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    expired: number;
    byTool: Record<string, number>;
    byUser: Record<string, number>;
    totalBytes: number;
    totalEvents: number;
    totalResumes: number;
  }> {
    await this.initialize();

    try {
      const info = await this.client.getCollection(this.collectionName);
      const total = info.points_count || 0;

      // Get all points for detailed stats
      const result = await this.client.scroll(this.collectionName, {
        limit: 10000,
        with_payload: true,
      });

      const now = Date.now();
      let active = 0;
      let expired = 0;
      const byTool: Record<string, number> = {};
      const byUser: Record<string, number> = {};
      let totalBytes = 0;
      let totalEvents = 0;
      let totalResumes = 0;

      for (const point of result.points || []) {
        const doc = point.payload as CheckpointDocument;

        if (doc.expiresAt > now) {
          active++;
        } else {
          expired++;
        }

        byTool[doc.toolName] = (byTool[doc.toolName] || 0) + 1;
        if (doc.userId) {
          byUser[doc.userId] = (byUser[doc.userId] || 0) + 1;
        }

        totalBytes += doc.bytesProcessed || 0;
        totalEvents += doc.totalEvents || 0;
        totalResumes += doc.resumeCount || 0;
      }

      return {
        total,
        active,
        expired,
        byTool,
        byUser,
        totalBytes,
        totalEvents,
        totalResumes,
      };
    } catch (error) {
      console.error('[Qdrant] Failed to get stats:', error);
      return {
        total: 0,
        active: 0,
        expired: 0,
        byTool: {},
        byUser: {},
        totalBytes: 0,
        totalEvents: 0,
        totalResumes: 0,
      };
    }
  }

  /**
   * Clean up expired checkpoints
   */
  async cleanup(): Promise<number> {
    await this.initialize();

    try {
      const result = await this.client.delete(this.collectionName, {
        wait: true,
        filter: {
          must: [
            { key: 'expiresAt', range: { lt: Date.now() } },
          ],
        },
      });

      const deleted = typeof result === 'object' && 'operation_id' in result ? 1 : 0;
      if (deleted > 0) {
        this.emit('cleanup', deleted);
      }
      return deleted;
    } catch (error) {
      console.error('[Qdrant] Cleanup failed:', error);
      return 0;
    }
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(intervalMs: number): void {
    this.cleanupTimer = setInterval(async () => {
      await this.cleanup();
    }, intervalMs);
  }

  /**
   * Stop the store
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.emit('stopped');
  }

  /**
   * Convert stream ID to numeric point ID
   */
  private streamIdToPointId(streamId: string): number {
    // Simple hash function for stream ID
    let hash = 0;
    for (let i = 0; i < streamId.length; i++) {
      const char = streamId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Convert document to checkpoint
   */
  private documentToCheckpoint(doc: CheckpointDocument): Checkpoint {
    return {
      streamId: doc.streamId,
      toolName: doc.toolName,
      args: doc.args,
      position: doc.position,
      cursor: doc.cursor,
      timestamp: doc.timestamp,
      data: doc.data,
      ttl: doc.ttl,
    };
  }
}

// ============================================================================
// Factory function
// ============================================================================

let globalStore: QdrantCheckpointStore | null = null;

export function getQdrantCheckpointStore(config?: QdrantCheckpointConfig): QdrantCheckpointStore {
  if (!globalStore) {
    globalStore = new QdrantCheckpointStore(config);
  }
  return globalStore;
}

// ============================================================================
// Integration with ResumableStream
// ============================================================================

export function createQdrantResumableStream(
  writer: { write: (data: string) => void; end: () => void },
  config: {
    toolName: string;
    args: Record<string, unknown>;
    userId?: string;
    tags?: string[];
    description?: string;
    resumeFrom?: string;
    checkpointInterval?: number;
    qdrantStore?: QdrantCheckpointStore;
  }
): { stream: EventEmitter; save: () => Promise<string>; resume: () => Promise<boolean> } {
  const store = config.qdrantStore || getQdrantCheckpointStore();
  const streamId = `stream_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  let position = 0;
  let cursor: string | undefined;
  let totalEvents = 0;
  let bytesProcessed = 0;
  let resumeCount = 0;

  const emitter = new EventEmitter();

  const save = async (): Promise<string> => {
    await store.save({
      streamId,
      toolName: config.toolName,
      args: config.args,
      position,
      cursor,
      timestamp: Date.now(),
      ttl: 3600000,
      userId: config.userId,
      tags: config.tags,
      description: config.description,
      resumeCount,
      totalEvents,
      bytesProcessed,
    });
    return streamId;
  };

  const resume = async (): Promise<boolean> => {
    if (!config.resumeFrom) return false;

    const checkpoint = await store.get(config.resumeFrom);
    if (!checkpoint) return false;

    position = checkpoint.position;
    cursor = checkpoint.cursor;
    resumeCount++;

    emitter.emit('resumed', checkpoint);
    return true;
  };

  // Track events
  const originalWrite = writer.write;
  writer.write = (data: string) => {
    position++;
    totalEvents++;
    bytesProcessed += data.length;
    originalWrite(data);
  };

  return { stream: emitter, save, resume };
}

// ============================================================================
// Exports
// ============================================================================

export {
  COLLECTION_NAME,
  DEFAULT_TTL_MS,
  type QdrantCheckpointConfig,
  type CheckpointDocument,
  type CheckpointSearchResult,
};
