/**
 * MCP Memory/Context Persistence
 *
 * Long-term memory system for investigation context and semantic search.
 * "Continue investigating X" - resumes with full context from previous sessions.
 *
 * Features:
 * - Vector database storage for semantic retrieval
 * - Investigation context persistence
 * - Cross-session memory continuity
 * - Automatic context summarization
 * - Entity and relationship memory
 * - Temporal memory decay
 * - User-specific memory isolation
 *
 * Embedding Providers:
 * - OpenAI text-embedding-3-small (recommended)
 * - Together AI embeddings
 * - Local TF-IDF fallback
 */

// Import embedding service for production use
import type { EmbeddingService } from './mcp-embeddings.js';

// ============================================================================
// Types
// ============================================================================

export type MemoryType =
  | 'investigation'    // Full investigation context
  | 'finding'          // Specific finding from investigation
  | 'entity'           // Known entity (wallet, protocol, etc.)
  | 'relationship'     // Relationship between entities
  | 'conversation'     // Conversation history
  | 'preference'       // User preferences
  | 'knowledge';       // General knowledge from investigations

export interface MemoryEntry {
  id: string;
  userId: string;
  type: MemoryType;
  content: string;           // Main text content for embedding
  metadata: MemoryMetadata;
  embedding?: number[];      // Vector embedding
  createdAt: number;
  updatedAt: number;
  accessedAt: number;
  accessCount: number;
  importance: number;        // 0-100, affects retrieval and decay
  decayRate: number;         // How fast importance decays
}

export interface MemoryMetadata {
  // Common fields
  title?: string;
  summary?: string;
  tags?: string[];
  source?: string;

  // Investigation-specific
  investigationId?: string;
  target?: string;
  riskLevel?: string;
  findingCount?: number;
  anomalyCount?: number;

  // Entity-specific
  entityType?: string;
  address?: string;
  labels?: string[];

  // Relationship-specific
  fromEntity?: string;
  toEntity?: string;
  relationshipType?: string;
  strength?: number;

  // Conversation-specific
  conversationId?: string;
  messageCount?: number;

  // Timestamps for context
  investigationStartedAt?: number;
  investigationEndedAt?: number;

  // Any additional structured data
  data?: Record<string, any>;
}

export interface MemoryQuery {
  userId: string;
  query?: string;           // Natural language query for semantic search
  types?: MemoryType[];
  tags?: string[];
  minImportance?: number;
  maxAge?: number;          // Max age in ms
  target?: string;          // Filter by investigation target
  limit?: number;
  includeEmbeddings?: boolean;
}

export interface MemorySearchResult {
  memory: MemoryEntry;
  score: number;            // Relevance score 0-1
  matchedOn: string[];      // What matched (semantic, tag, etc.)
}

export interface ConversationContext {
  userId: string;
  conversationId: string;
  messages: ConversationMessage[];
  activeInvestigation?: string;
  mentionedEntities: string[];
  lastActivity: number;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: { tool: string; params: any; result: any }[];
}

export interface MemoryStats {
  totalMemories: number;
  byType: Record<MemoryType, number>;
  byUser: Record<string, number>;
  averageImportance: number;
  oldestMemory: number;
  newestMemory: number;
  totalEmbeddings: number;
}

// ============================================================================
// Configuration
// ============================================================================

export interface MemoryConfig {
  // Storage
  vectorDimensions: number;
  maxMemoriesPerUser: number;
  maxConversationLength: number;

  // Retrieval
  defaultLimit: number;
  similarityThreshold: number;

  // Decay
  decayIntervalMs: number;
  minImportance: number;
  defaultDecayRate: number;

  // Summarization
  summarizeAfterMessages: number;
  maxSummaryLength: number;
}

const DEFAULT_CONFIG: MemoryConfig = {
  vectorDimensions: 1536,    // OpenAI ada-002 dimensions
  maxMemoriesPerUser: 10000,
  maxConversationLength: 100,
  defaultLimit: 10,
  similarityThreshold: 0.7,
  decayIntervalMs: 86400000, // 1 day
  minImportance: 10,
  defaultDecayRate: 0.95,    // Lose 5% importance per decay cycle
  summarizeAfterMessages: 20,
  maxSummaryLength: 500,
};

// ============================================================================
// Simple Vector Operations (for in-memory implementation)
// ============================================================================

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

// Simple text-to-vector (for testing - use real embeddings in production)
function simpleEmbed(text: string, dimensions: number): number[] {
  const words = text.toLowerCase().split(/\s+/);
  const vector = new Array(dimensions).fill(0);

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    for (let j = 0; j < word.length; j++) {
      const idx = (word.charCodeAt(j) * (i + 1) * (j + 1)) % dimensions;
      vector[idx] += 1 / words.length;
    }
  }

  // Normalize
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return norm > 0 ? vector.map(v => v / norm) : vector;
}

// ============================================================================
// Memory Store Implementation
// ============================================================================

export class MemoryStore {
  private memories = new Map<string, MemoryEntry>();
  private byUser = new Map<string, Set<string>>();
  private byType = new Map<MemoryType, Set<string>>();
  private conversations = new Map<string, ConversationContext>();
  private config: MemoryConfig;
  private decayTimer?: ReturnType<typeof setInterval>;

  // External embedding function (can be replaced with OpenAI, etc.)
  private embedFunction: (text: string) => Promise<number[]>;

  constructor(
    config: Partial<MemoryConfig> = {},
    embedFunction?: (text: string) => Promise<number[]>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.embedFunction = embedFunction || (async (text) =>
      simpleEmbed(text, this.config.vectorDimensions)
    );
  }

  // ==========================================================================
  // Memory CRUD
  // ==========================================================================

  /**
   * Store a new memory
   */
  async store(params: {
    userId: string;
    type: MemoryType;
    content: string;
    metadata?: MemoryMetadata;
    importance?: number;
    decayRate?: number;
  }): Promise<MemoryEntry> {
    const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();

    // Generate embedding
    const embedding = await this.embedFunction(params.content);

    const memory: MemoryEntry = {
      id,
      userId: params.userId,
      type: params.type,
      content: params.content,
      metadata: params.metadata || {},
      embedding,
      createdAt: now,
      updatedAt: now,
      accessedAt: now,
      accessCount: 0,
      importance: params.importance ?? 50,
      decayRate: params.decayRate ?? this.config.defaultDecayRate,
    };

    this.memories.set(id, memory);

    // Index by user
    if (!this.byUser.has(params.userId)) {
      this.byUser.set(params.userId, new Set());
    }
    this.byUser.get(params.userId)!.add(id);

    // Index by type
    if (!this.byType.has(params.type)) {
      this.byType.set(params.type, new Set());
    }
    this.byType.get(params.type)!.add(id);

    // Check limits
    await this.enforceUserLimits(params.userId);

    return memory;
  }

  /**
   * Retrieve memory by ID
   */
  get(id: string): MemoryEntry | null {
    const memory = this.memories.get(id);
    if (memory) {
      memory.accessedAt = Date.now();
      memory.accessCount++;
    }
    return memory || null;
  }

  /**
   * Update memory
   */
  async update(id: string, updates: {
    content?: string;
    metadata?: Partial<MemoryMetadata>;
    importance?: number;
  }): Promise<MemoryEntry | null> {
    const memory = this.memories.get(id);
    if (!memory) return null;

    if (updates.content) {
      memory.content = updates.content;
      memory.embedding = await this.embedFunction(updates.content);
    }

    if (updates.metadata) {
      memory.metadata = { ...memory.metadata, ...updates.metadata };
    }

    if (updates.importance !== undefined) {
      memory.importance = updates.importance;
    }

    memory.updatedAt = Date.now();
    return memory;
  }

  /**
   * Delete memory
   */
  delete(id: string): boolean {
    const memory = this.memories.get(id);
    if (!memory) return false;

    this.memories.delete(id);
    this.byUser.get(memory.userId)?.delete(id);
    this.byType.get(memory.type)?.delete(id);

    return true;
  }

  // ==========================================================================
  // Semantic Search
  // ==========================================================================

  /**
   * Search memories with semantic similarity
   */
  async search(query: MemoryQuery): Promise<MemorySearchResult[]> {
    const results: MemorySearchResult[] = [];

    // Get candidate memories
    let candidates: MemoryEntry[] = [];

    if (query.types && query.types.length > 0) {
      for (const type of query.types) {
        const typeIds = this.byType.get(type) || new Set();
        for (const id of typeIds) {
          const memory = this.memories.get(id);
          if (memory && memory.userId === query.userId) {
            candidates.push(memory);
          }
        }
      }
    } else {
      const userIds = this.byUser.get(query.userId) || new Set();
      for (const id of userIds) {
        const memory = this.memories.get(id);
        if (memory) candidates.push(memory);
      }
    }

    // Apply filters
    const now = Date.now();
    candidates = candidates.filter(m => {
      if (query.minImportance && m.importance < query.minImportance) return false;
      if (query.maxAge && now - m.createdAt > query.maxAge) return false;
      if (query.target && m.metadata.target !== query.target) return false;
      if (query.tags && query.tags.length > 0) {
        if (!m.metadata.tags?.some(t => query.tags!.includes(t))) return false;
      }
      return true;
    });

    // Semantic search if query provided
    if (query.query) {
      const queryEmbedding = await this.embedFunction(query.query);

      for (const memory of candidates) {
        if (!memory.embedding) continue;

        const similarity = cosineSimilarity(queryEmbedding, memory.embedding);
        if (similarity >= this.config.similarityThreshold) {
          results.push({
            memory,
            score: similarity,
            matchedOn: ['semantic'],
          });
        }
      }

      // Sort by score
      results.sort((a, b) => b.score - a.score);
    } else {
      // No query - return by importance and recency
      candidates.sort((a, b) => {
        const scoreA = a.importance * 0.5 + (1 - (now - a.accessedAt) / (30 * 86400000)) * 50;
        const scoreB = b.importance * 0.5 + (1 - (now - b.accessedAt) / (30 * 86400000)) * 50;
        return scoreB - scoreA;
      });

      for (const memory of candidates) {
        results.push({
          memory,
          score: memory.importance / 100,
          matchedOn: ['importance', 'recency'],
        });
      }
    }

    // Apply limit
    const limit = query.limit || this.config.defaultLimit;
    return results.slice(0, limit);
  }

  /**
   * Find related memories
   */
  async findRelated(memoryId: string, limit: number = 5): Promise<MemorySearchResult[]> {
    const memory = this.memories.get(memoryId);
    if (!memory || !memory.embedding) return [];

    const results: MemorySearchResult[] = [];

    for (const [id, candidate] of this.memories) {
      if (id === memoryId) continue;
      if (candidate.userId !== memory.userId) continue;
      if (!candidate.embedding) continue;

      const similarity = cosineSimilarity(memory.embedding, candidate.embedding);
      if (similarity >= this.config.similarityThreshold) {
        results.push({
          memory: candidate,
          score: similarity,
          matchedOn: ['semantic'],
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  // ==========================================================================
  // Investigation Memory
  // ==========================================================================

  /**
   * Store investigation results as memories
   */
  async storeInvestigation(params: {
    userId: string;
    investigationId: string;
    target: string;
    type: string;
    findings: any[];
    anomalies: any[];
    entities: any[];
    riskScore: number;
    summary?: string;
  }): Promise<MemoryEntry[]> {
    const memories: MemoryEntry[] = [];

    // Store main investigation
    const mainContent = this.buildInvestigationContent(params);
    const main = await this.store({
      userId: params.userId,
      type: 'investigation',
      content: mainContent,
      metadata: {
        investigationId: params.investigationId,
        target: params.target,
        title: `Investigation of ${params.target}`,
        summary: params.summary,
        riskLevel: this.getRiskLevel(params.riskScore),
        findingCount: params.findings.length,
        anomalyCount: params.anomalies.length,
        tags: ['investigation', params.type],
        investigationStartedAt: Date.now(),
      },
      importance: 70 + Math.min(30, params.riskScore * 0.3),
    });
    memories.push(main);

    // Store significant findings as separate memories
    for (const finding of params.findings.slice(0, 10)) {
      const findingMemory = await this.store({
        userId: params.userId,
        type: 'finding',
        content: `${finding.title}: ${finding.description}`,
        metadata: {
          investigationId: params.investigationId,
          target: params.target,
          tags: ['finding', finding.type, finding.severity],
          data: finding,
        },
        importance: this.severityToImportance(finding.severity),
      });
      memories.push(findingMemory);
    }

    // Store identified entities
    for (const entity of params.entities) {
      const existing = await this.search({
        userId: params.userId,
        types: ['entity'],
        query: entity.address,
        limit: 1,
      });

      if (existing.length === 0) {
        const entityMemory = await this.store({
          userId: params.userId,
          type: 'entity',
          content: `${entity.name} (${entity.type}): ${entity.address}`,
          metadata: {
            address: entity.address,
            entityType: entity.type,
            labels: entity.labels,
            tags: ['entity', entity.type],
          },
          importance: 60,
        });
        memories.push(entityMemory);
      }
    }

    return memories;
  }

  /**
   * Get investigation context for resumption
   */
  async getInvestigationContext(userId: string, target: string): Promise<{
    previousInvestigations: MemoryEntry[];
    relatedFindings: MemoryEntry[];
    knownEntities: MemoryEntry[];
    relationshipContext: string;
  }> {
    // Find previous investigations of this target
    const previousInvestigations = await this.search({
      userId,
      types: ['investigation'],
      target,
      limit: 5,
    });

    // Find related findings
    const relatedFindings = await this.search({
      userId,
      types: ['finding'],
      target,
      limit: 20,
    });

    // Find known entities
    const knownEntities = await this.search({
      userId,
      types: ['entity'],
      query: target,
      limit: 10,
    });

    // Build relationship context
    const relationships = await this.search({
      userId,
      types: ['relationship'],
      query: target,
      limit: 10,
    });

    const relationshipContext = relationships
      .map(r => r.memory.content)
      .join('\n');

    return {
      previousInvestigations: previousInvestigations.map(r => r.memory),
      relatedFindings: relatedFindings.map(r => r.memory),
      knownEntities: knownEntities.map(r => r.memory),
      relationshipContext,
    };
  }

  // ==========================================================================
  // Conversation Memory
  // ==========================================================================

  /**
   * Get or create conversation context
   */
  getConversation(userId: string, conversationId: string): ConversationContext {
    const key = `${userId}:${conversationId}`;
    let context = this.conversations.get(key);

    if (!context) {
      context = {
        userId,
        conversationId,
        messages: [],
        mentionedEntities: [],
        lastActivity: Date.now(),
      };
      this.conversations.set(key, context);
    }

    return context;
  }

  /**
   * Add message to conversation
   */
  async addMessage(
    userId: string,
    conversationId: string,
    message: Omit<ConversationMessage, 'timestamp'>
  ): Promise<ConversationContext> {
    const context = this.getConversation(userId, conversationId);

    context.messages.push({
      ...message,
      timestamp: Date.now(),
    });

    context.lastActivity = Date.now();

    // Extract mentioned entities
    const entities = this.extractEntities(message.content);
    context.mentionedEntities = [...new Set([...context.mentionedEntities, ...entities])];

    // Trim if too long
    if (context.messages.length > this.config.maxConversationLength) {
      await this.summarizeAndTrimConversation(context);
    }

    return context;
  }

  /**
   * Get conversation summary for context
   */
  async getConversationSummary(userId: string, conversationId: string): Promise<string> {
    const context = this.getConversation(userId, conversationId);

    if (context.messages.length === 0) {
      return 'No previous conversation.';
    }

    const recentMessages = context.messages.slice(-10);
    const summary = recentMessages
      .map(m => `${m.role}: ${m.content.slice(0, 200)}`)
      .join('\n');

    const entityList = context.mentionedEntities.length > 0
      ? `\nMentioned entities: ${context.mentionedEntities.join(', ')}`
      : '';

    const activeInv = context.activeInvestigation
      ? `\nActive investigation: ${context.activeInvestigation}`
      : '';

    return `Recent conversation:\n${summary}${entityList}${activeInv}`;
  }

  // ==========================================================================
  // Memory Decay
  // ==========================================================================

  /**
   * Start decay timer
   */
  startDecay(): void {
    if (this.decayTimer) return;

    this.decayTimer = setInterval(() => {
      this.applyDecay();
    }, this.config.decayIntervalMs);
  }

  /**
   * Stop decay timer
   */
  stopDecay(): void {
    if (this.decayTimer) {
      clearInterval(this.decayTimer);
      this.decayTimer = undefined;
    }
  }

  /**
   * Apply decay to all memories
   */
  private applyDecay(): void {
    const toDelete: string[] = [];

    for (const [id, memory] of this.memories) {
      // Apply decay rate
      memory.importance *= memory.decayRate;

      // Boost for recent access
      const daysSinceAccess = (Date.now() - memory.accessedAt) / 86400000;
      if (daysSinceAccess < 7) {
        memory.importance = Math.min(100, memory.importance * 1.1);
      }

      // Mark for deletion if below threshold
      if (memory.importance < this.config.minImportance) {
        toDelete.push(id);
      }
    }

    // Delete low-importance memories
    for (const id of toDelete) {
      this.delete(id);
    }
  }

  /**
   * Boost memory importance (called when memory is useful)
   */
  boostImportance(id: string, amount: number = 10): void {
    const memory = this.memories.get(id);
    if (memory) {
      memory.importance = Math.min(100, memory.importance + amount);
      memory.accessedAt = Date.now();
      memory.accessCount++;
    }
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Get memory statistics
   */
  getStats(): MemoryStats {
    const byType: Record<MemoryType, number> = {} as any;
    const byUser: Record<string, number> = {};
    let totalImportance = 0;
    let oldest = Date.now();
    let newest = 0;
    let totalEmbeddings = 0;

    for (const memory of this.memories.values()) {
      byType[memory.type] = (byType[memory.type] || 0) + 1;
      byUser[memory.userId] = (byUser[memory.userId] || 0) + 1;
      totalImportance += memory.importance;
      oldest = Math.min(oldest, memory.createdAt);
      newest = Math.max(newest, memory.createdAt);
      if (memory.embedding) totalEmbeddings++;
    }

    return {
      totalMemories: this.memories.size,
      byType,
      byUser,
      averageImportance: this.memories.size > 0 ? totalImportance / this.memories.size : 0,
      oldestMemory: oldest,
      newestMemory: newest,
      totalEmbeddings,
    };
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private async enforceUserLimits(userId: string): Promise<void> {
    const userMemories = this.byUser.get(userId);
    if (!userMemories || userMemories.size <= this.config.maxMemoriesPerUser) return;

    // Get all user memories sorted by importance
    const memories: MemoryEntry[] = [];
    for (const id of userMemories) {
      const memory = this.memories.get(id);
      if (memory) memories.push(memory);
    }

    memories.sort((a, b) => a.importance - b.importance);

    // Delete lowest importance memories
    const toDelete = memories.slice(0, memories.length - this.config.maxMemoriesPerUser);
    for (const memory of toDelete) {
      this.delete(memory.id);
    }
  }

  private buildInvestigationContent(params: {
    target: string;
    type: string;
    findings: any[];
    anomalies: any[];
    riskScore: number;
    summary?: string;
  }): string {
    const parts = [
      `Investigation of ${params.target}`,
      `Type: ${params.type}`,
      `Risk Score: ${params.riskScore}`,
      `Findings: ${params.findings.length}`,
      `Anomalies: ${params.anomalies.length}`,
    ];

    if (params.summary) {
      parts.push(`Summary: ${params.summary}`);
    }

    // Add key findings
    const keyFindings = params.findings
      .filter(f => f.severity === 'high' || f.severity === 'critical')
      .slice(0, 5)
      .map(f => f.title);

    if (keyFindings.length > 0) {
      parts.push(`Key findings: ${keyFindings.join(', ')}`);
    }

    return parts.join('\n');
  }

  private getRiskLevel(score: number): string {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'low';
    return 'minimal';
  }

  private severityToImportance(severity: string): number {
    switch (severity) {
      case 'critical': return 90;
      case 'high': return 75;
      case 'medium': return 55;
      case 'low': return 35;
      default: return 25;
    }
  }

  private extractEntities(text: string): string[] {
    const entities: string[] = [];

    // Extract Solana addresses (base58, 32-44 chars)
    const addressRegex = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
    const addresses = text.match(addressRegex) || [];
    entities.push(...addresses);

    // Extract transaction signatures (88 chars)
    const sigRegex = /[1-9A-HJ-NP-Za-km-z]{87,88}/g;
    const signatures = text.match(sigRegex) || [];
    entities.push(...signatures);

    return [...new Set(entities)];
  }

  private async summarizeAndTrimConversation(context: ConversationContext): Promise<void> {
    // Take first half and summarize
    const toSummarize = context.messages.slice(0, Math.floor(context.messages.length / 2));
    const summary = toSummarize
      .map(m => `${m.role}: ${m.content.slice(0, 100)}`)
      .join('\n');

    // Store as memory
    await this.store({
      userId: context.userId,
      type: 'conversation',
      content: `Conversation summary: ${summary}`,
      metadata: {
        conversationId: context.conversationId,
        messageCount: toSummarize.length,
        tags: ['conversation', 'summary'],
      },
      importance: 40,
    });

    // Keep only recent messages
    context.messages = context.messages.slice(Math.floor(context.messages.length / 2));
  }
}

// ============================================================================
// Qdrant Integration (for production)
// ============================================================================

export interface VectorDBAdapter {
  upsert(id: string, vector: number[], payload: any): Promise<void>;
  search(vector: number[], limit: number, filter?: any): Promise<{ id: string; score: number; payload: any }[]>;
  delete(id: string): Promise<void>;
}

/**
 * Qdrant adapter for production deployments
 */
export class QdrantAdapter implements VectorDBAdapter {
  private baseUrl: string;
  private collection: string;
  private apiKey?: string;

  constructor(baseUrl: string, collection: string, apiKey?: string) {
    this.baseUrl = baseUrl;
    this.collection = collection;
    this.apiKey = apiKey;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) h['api-key'] = this.apiKey;
    return h;
  }

  async upsert(id: string, vector: number[], payload: any): Promise<void> {
    await fetch(`${this.baseUrl}/collections/${this.collection}/points`, {
      method: 'PUT',
      headers: this.headers(),
      body: JSON.stringify({
        points: [{
          id,
          vector,
          payload,
        }],
      }),
    });
  }

  async search(vector: number[], limit: number, filter?: any): Promise<{ id: string; score: number; payload: any }[]> {
    const response = await fetch(`${this.baseUrl}/collections/${this.collection}/points/search`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        vector,
        limit,
        filter,
        with_payload: true,
      }),
    });

    const data = await response.json();
    return data.result || [];
  }

  async delete(id: string): Promise<void> {
    await fetch(`${this.baseUrl}/collections/${this.collection}/points/delete`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        points: [id],
      }),
    });
  }
}

// ============================================================================
// Qdrant Memory Store (Production-Ready)
// ============================================================================

const MCP_MEMORY_COLLECTION = 'mcp_memories';
const MCP_CONVERSATIONS_COLLECTION = 'mcp_conversations';

/**
 * Production-ready memory store using Qdrant for persistent vector storage
 *
 * Features:
 * - Persistent storage across restarts
 * - Scalable to millions of memories
 * - Real semantic search with embeddings
 * - Automatic collection and index creation
 * - Timeout handling for reliability
 */
export class QdrantMemoryStore {
  private baseUrl: string;
  private apiKey?: string;
  private config: MemoryConfig;
  private embedFunction: (text: string) => Promise<number[]>;
  private initialized = false;
  private decayTimer?: ReturnType<typeof setInterval>;

  constructor(
    qdrantUrl: string,
    qdrantApiKey?: string,
    config: Partial<MemoryConfig> = {},
    embedFunction?: (text: string) => Promise<number[]>
  ) {
    this.baseUrl = qdrantUrl;
    this.apiKey = qdrantApiKey;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.embedFunction = embedFunction || (async (text) =>
      simpleEmbed(text, this.config.vectorDimensions)
    );
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) h['api-key'] = this.apiKey;
    return h;
  }

  /**
   * Execute request with timeout
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number = 10000): Promise<T> {
    const timeoutPromise = new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('Qdrant operation timed out')), timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Initialize Qdrant collections and indexes
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Check/create memories collection
      await this.ensureCollection(MCP_MEMORY_COLLECTION);
      await this.ensureCollection(MCP_CONVERSATIONS_COLLECTION);

      // Create indexes for efficient filtering
      await this.ensureIndex(MCP_MEMORY_COLLECTION, 'userId', 'keyword');
      await this.ensureIndex(MCP_MEMORY_COLLECTION, 'type', 'keyword');
      await this.ensureIndex(MCP_MEMORY_COLLECTION, 'importance', 'integer');
      await this.ensureIndex(MCP_MEMORY_COLLECTION, 'createdAt', 'integer');
      await this.ensureIndex(MCP_MEMORY_COLLECTION, 'target', 'keyword');

      await this.ensureIndex(MCP_CONVERSATIONS_COLLECTION, 'userId', 'keyword');
      await this.ensureIndex(MCP_CONVERSATIONS_COLLECTION, 'conversationId', 'keyword');

      this.initialized = true;
      console.log('[QdrantMemoryStore] Initialized successfully');
    } catch (error) {
      console.error('[QdrantMemoryStore] Initialization failed:', error);
      throw error;
    }
  }

  private async ensureCollection(name: string): Promise<void> {
    try {
      const checkResponse = await this.withTimeout(
        fetch(`${this.baseUrl}/collections/${name}`, {
          headers: this.headers(),
        })
      );

      if (checkResponse.ok) {
        console.log(`[QdrantMemoryStore] Collection ${name} exists`);
        return;
      }

      // Create collection
      const createResponse = await this.withTimeout(
        fetch(`${this.baseUrl}/collections/${name}`, {
          method: 'PUT',
          headers: this.headers(),
          body: JSON.stringify({
            vectors: {
              size: this.config.vectorDimensions,
              distance: 'Cosine',
            },
          }),
        })
      );

      if (!createResponse.ok) {
        const error = await createResponse.text();
        throw new Error(`Failed to create collection ${name}: ${error}`);
      }

      console.log(`[QdrantMemoryStore] Created collection ${name}`);
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        return; // Collection exists, that's fine
      }
      throw error;
    }
  }

  private async ensureIndex(
    collection: string,
    field: string,
    type: 'keyword' | 'integer' | 'float' | 'bool'
  ): Promise<void> {
    try {
      await this.withTimeout(
        fetch(`${this.baseUrl}/collections/${collection}/index`, {
          method: 'PUT',
          headers: this.headers(),
          body: JSON.stringify({
            field_name: field,
            field_schema: type,
          }),
        })
      );
    } catch (error: any) {
      // Index might already exist, ignore
      if (!error.message?.includes('already exists')) {
        console.warn(`[QdrantMemoryStore] Failed to create index ${field}:`, error.message);
      }
    }
  }

  // ==========================================================================
  // Memory CRUD
  // ==========================================================================

  /**
   * Store a new memory
   */
  async store(params: {
    userId: string;
    type: MemoryType;
    content: string;
    metadata?: MemoryMetadata;
    importance?: number;
    decayRate?: number;
  }): Promise<MemoryEntry> {
    await this.initialize();

    const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();

    // Generate embedding
    const embedding = await this.embedFunction(params.content);

    const memory: MemoryEntry = {
      id,
      userId: params.userId,
      type: params.type,
      content: params.content,
      metadata: params.metadata || {},
      embedding,
      createdAt: now,
      updatedAt: now,
      accessedAt: now,
      accessCount: 0,
      importance: params.importance ?? 50,
      decayRate: params.decayRate ?? this.config.defaultDecayRate,
    };

    // Store in Qdrant
    await this.withTimeout(
      fetch(`${this.baseUrl}/collections/${MCP_MEMORY_COLLECTION}/points`, {
        method: 'PUT',
        headers: this.headers(),
        body: JSON.stringify({
          wait: true,
          points: [{
            id,
            vector: embedding,
            payload: {
              ...memory,
              embedding: undefined, // Don't store embedding in payload (it's in the vector)
            },
          }],
        }),
      })
    );

    // Enforce user limits
    await this.enforceUserLimits(params.userId);

    return memory;
  }

  /**
   * Retrieve memory by ID
   */
  async get(id: string): Promise<MemoryEntry | null> {
    await this.initialize();

    const response = await this.withTimeout(
      fetch(`${this.baseUrl}/collections/${MCP_MEMORY_COLLECTION}/points/${id}`, {
        headers: this.headers(),
      })
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.result) return null;

    const memory = data.result.payload as MemoryEntry;
    memory.embedding = data.result.vector;

    // Update access stats
    memory.accessedAt = Date.now();
    memory.accessCount++;
    await this.updateMemory(id, { accessedAt: memory.accessedAt, accessCount: memory.accessCount });

    return memory;
  }

  /**
   * Update memory
   */
  async update(id: string, updates: {
    content?: string;
    metadata?: Partial<MemoryMetadata>;
    importance?: number;
  }): Promise<MemoryEntry | null> {
    const memory = await this.get(id);
    if (!memory) return null;

    let newEmbedding = memory.embedding;
    if (updates.content) {
      memory.content = updates.content;
      newEmbedding = await this.embedFunction(updates.content);
    }

    if (updates.metadata) {
      memory.metadata = { ...memory.metadata, ...updates.metadata };
    }

    if (updates.importance !== undefined) {
      memory.importance = updates.importance;
    }

    memory.updatedAt = Date.now();

    // Update in Qdrant
    await this.withTimeout(
      fetch(`${this.baseUrl}/collections/${MCP_MEMORY_COLLECTION}/points`, {
        method: 'PUT',
        headers: this.headers(),
        body: JSON.stringify({
          wait: true,
          points: [{
            id,
            vector: newEmbedding,
            payload: {
              ...memory,
              embedding: undefined,
            },
          }],
        }),
      })
    );

    return memory;
  }

  private async updateMemory(id: string, updates: Partial<MemoryEntry>): Promise<void> {
    await this.withTimeout(
      fetch(`${this.baseUrl}/collections/${MCP_MEMORY_COLLECTION}/points/payload`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          points: [id],
          payload: updates,
        }),
      })
    );
  }

  /**
   * Delete memory
   */
  async delete(id: string): Promise<boolean> {
    await this.initialize();

    const response = await this.withTimeout(
      fetch(`${this.baseUrl}/collections/${MCP_MEMORY_COLLECTION}/points/delete`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          points: [id],
        }),
      })
    );

    return response.ok;
  }

  // ==========================================================================
  // Semantic Search
  // ==========================================================================

  /**
   * Search memories with semantic similarity
   */
  async search(query: MemoryQuery): Promise<MemorySearchResult[]> {
    await this.initialize();

    // Build filter
    const must: any[] = [{ key: 'userId', match: { value: query.userId } }];

    if (query.types && query.types.length > 0) {
      must.push({
        key: 'type',
        match: { any: query.types },
      });
    }

    if (query.minImportance) {
      must.push({
        key: 'importance',
        range: { gte: query.minImportance },
      });
    }

    if (query.maxAge) {
      const minTime = Date.now() - query.maxAge;
      must.push({
        key: 'createdAt',
        range: { gte: minTime },
      });
    }

    if (query.target) {
      must.push({
        key: 'target',
        match: { value: query.target },
      });
    }

    const limit = query.limit || this.config.defaultLimit;

    // Semantic search if query provided
    if (query.query) {
      const queryEmbedding = await this.embedFunction(query.query);

      const response = await this.withTimeout(
        fetch(`${this.baseUrl}/collections/${MCP_MEMORY_COLLECTION}/points/search`, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({
            vector: queryEmbedding,
            limit,
            filter: { must },
            with_payload: true,
            with_vector: query.includeEmbeddings,
            score_threshold: this.config.similarityThreshold,
          }),
        })
      );

      const data = await response.json();
      const results = (data.result || []).map((point: any) => ({
        memory: {
          ...point.payload,
          embedding: point.vector,
        } as MemoryEntry,
        score: point.score,
        matchedOn: ['semantic'],
      }));

      return results;
    }

    // No query - scroll through results sorted by importance/recency
    const response = await this.withTimeout(
      fetch(`${this.baseUrl}/collections/${MCP_MEMORY_COLLECTION}/points/scroll`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          limit,
          filter: { must },
          with_payload: true,
          with_vector: query.includeEmbeddings,
        }),
      })
    );

    const data = await response.json();
    const now = Date.now();

    const results = (data.result?.points || []).map((point: any) => {
      const memory = point.payload as MemoryEntry;
      const score = memory.importance * 0.5 + (1 - (now - memory.accessedAt) / (30 * 86400000)) * 50;
      return {
        memory: {
          ...memory,
          embedding: point.vector,
        },
        score: score / 100,
        matchedOn: ['importance', 'recency'],
      };
    });

    // Sort by score
    results.sort((a: any, b: any) => b.score - a.score);

    return results;
  }

  /**
   * Find related memories
   */
  async findRelated(memoryId: string, limit: number = 5): Promise<MemorySearchResult[]> {
    const memory = await this.get(memoryId);
    if (!memory || !memory.embedding) return [];

    const response = await this.withTimeout(
      fetch(`${this.baseUrl}/collections/${MCP_MEMORY_COLLECTION}/points/search`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          vector: memory.embedding,
          limit: limit + 1, // +1 to exclude self
          filter: {
            must: [{ key: 'userId', match: { value: memory.userId } }],
            must_not: [{ has_id: [memoryId] }],
          },
          with_payload: true,
          score_threshold: this.config.similarityThreshold,
        }),
      })
    );

    const data = await response.json();
    return (data.result || []).map((point: any) => ({
      memory: point.payload as MemoryEntry,
      score: point.score,
      matchedOn: ['semantic'],
    }));
  }

  // ==========================================================================
  // Investigation Memory
  // ==========================================================================

  /**
   * Store investigation results as memories
   */
  async storeInvestigation(params: {
    userId: string;
    investigationId: string;
    target: string;
    type: string;
    findings: any[];
    anomalies: any[];
    entities: any[];
    riskScore: number;
    summary?: string;
  }): Promise<MemoryEntry[]> {
    const memories: MemoryEntry[] = [];

    // Store main investigation
    const mainContent = this.buildInvestigationContent(params);
    const main = await this.store({
      userId: params.userId,
      type: 'investigation',
      content: mainContent,
      metadata: {
        investigationId: params.investigationId,
        target: params.target,
        title: `Investigation of ${params.target}`,
        summary: params.summary,
        riskLevel: this.getRiskLevel(params.riskScore),
        findingCount: params.findings.length,
        anomalyCount: params.anomalies.length,
        tags: ['investigation', params.type],
        investigationStartedAt: Date.now(),
      },
      importance: 70 + Math.min(30, params.riskScore * 0.3),
    });
    memories.push(main);

    // Store significant findings
    for (const finding of params.findings.slice(0, 10)) {
      const findingMemory = await this.store({
        userId: params.userId,
        type: 'finding',
        content: `${finding.title}: ${finding.description}`,
        metadata: {
          investigationId: params.investigationId,
          target: params.target,
          tags: ['finding', finding.type, finding.severity],
          data: finding,
        },
        importance: this.severityToImportance(finding.severity),
      });
      memories.push(findingMemory);
    }

    // Store entities
    for (const entity of params.entities) {
      const existing = await this.search({
        userId: params.userId,
        types: ['entity'],
        query: entity.address,
        limit: 1,
      });

      if (existing.length === 0) {
        const entityMemory = await this.store({
          userId: params.userId,
          type: 'entity',
          content: `${entity.name} (${entity.type}): ${entity.address}`,
          metadata: {
            address: entity.address,
            entityType: entity.type,
            labels: entity.labels,
            tags: ['entity', entity.type],
          },
          importance: 60,
        });
        memories.push(entityMemory);
      }
    }

    return memories;
  }

  /**
   * Get investigation context for resumption
   */
  async getInvestigationContext(userId: string, target: string): Promise<{
    previousInvestigations: MemoryEntry[];
    relatedFindings: MemoryEntry[];
    knownEntities: MemoryEntry[];
    relationshipContext: string;
  }> {
    const previousInvestigations = await this.search({
      userId,
      types: ['investigation'],
      target,
      limit: 5,
    });

    const relatedFindings = await this.search({
      userId,
      types: ['finding'],
      target,
      limit: 20,
    });

    const knownEntities = await this.search({
      userId,
      types: ['entity'],
      query: target,
      limit: 10,
    });

    const relationships = await this.search({
      userId,
      types: ['relationship'],
      query: target,
      limit: 10,
    });

    const relationshipContext = relationships
      .map(r => r.memory.content)
      .join('\n');

    return {
      previousInvestigations: previousInvestigations.map(r => r.memory),
      relatedFindings: relatedFindings.map(r => r.memory),
      knownEntities: knownEntities.map(r => r.memory),
      relationshipContext,
    };
  }

  // ==========================================================================
  // Conversation Memory
  // ==========================================================================

  /**
   * Get or create conversation context
   */
  async getConversation(userId: string, conversationId: string): Promise<ConversationContext> {
    await this.initialize();

    const key = `${userId}:${conversationId}`;

    const response = await this.withTimeout(
      fetch(`${this.baseUrl}/collections/${MCP_CONVERSATIONS_COLLECTION}/points/scroll`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          limit: 1,
          filter: {
            must: [
              { key: 'userId', match: { value: userId } },
              { key: 'conversationId', match: { value: conversationId } },
            ],
          },
          with_payload: true,
        }),
      })
    );

    const data = await response.json();
    const points = data.result?.points || [];

    if (points.length > 0) {
      return points[0].payload as ConversationContext;
    }

    // Create new conversation
    const context: ConversationContext = {
      userId,
      conversationId,
      messages: [],
      mentionedEntities: [],
      lastActivity: Date.now(),
    };

    await this.saveConversation(context);
    return context;
  }

  private async saveConversation(context: ConversationContext): Promise<void> {
    const key = `${context.userId}:${context.conversationId}`;
    const vector = new Array(this.config.vectorDimensions).fill(0);

    await this.withTimeout(
      fetch(`${this.baseUrl}/collections/${MCP_CONVERSATIONS_COLLECTION}/points`, {
        method: 'PUT',
        headers: this.headers(),
        body: JSON.stringify({
          wait: true,
          points: [{
            id: key,
            vector,
            payload: context,
          }],
        }),
      })
    );
  }

  /**
   * Add message to conversation
   */
  async addMessage(
    userId: string,
    conversationId: string,
    message: Omit<ConversationMessage, 'timestamp'>
  ): Promise<ConversationContext> {
    const context = await this.getConversation(userId, conversationId);

    context.messages.push({
      ...message,
      timestamp: Date.now(),
    });

    context.lastActivity = Date.now();

    // Extract entities
    const entities = this.extractEntities(message.content);
    context.mentionedEntities = [...new Set([...context.mentionedEntities, ...entities])];

    // Trim if too long
    if (context.messages.length > this.config.maxConversationLength) {
      await this.summarizeAndTrimConversation(context);
    }

    await this.saveConversation(context);
    return context;
  }

  /**
   * Get conversation summary
   */
  async getConversationSummary(userId: string, conversationId: string): Promise<string> {
    const context = await this.getConversation(userId, conversationId);

    if (context.messages.length === 0) {
      return 'No previous conversation.';
    }

    const recentMessages = context.messages.slice(-10);
    const summary = recentMessages
      .map(m => `${m.role}: ${m.content.slice(0, 200)}`)
      .join('\n');

    const entityList = context.mentionedEntities.length > 0
      ? `\nMentioned entities: ${context.mentionedEntities.join(', ')}`
      : '';

    const activeInv = context.activeInvestigation
      ? `\nActive investigation: ${context.activeInvestigation}`
      : '';

    return `Recent conversation:\n${summary}${entityList}${activeInv}`;
  }

  // ==========================================================================
  // Memory Decay
  // ==========================================================================

  startDecay(): void {
    if (this.decayTimer) return;

    this.decayTimer = setInterval(() => {
      this.applyDecay();
    }, this.config.decayIntervalMs);
  }

  stopDecay(): void {
    if (this.decayTimer) {
      clearInterval(this.decayTimer);
      this.decayTimer = undefined;
    }
  }

  private async applyDecay(): Promise<void> {
    try {
      // Get all memories that need decay applied
      const response = await this.withTimeout(
        fetch(`${this.baseUrl}/collections/${MCP_MEMORY_COLLECTION}/points/scroll`, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({
            limit: 1000,
            with_payload: true,
          }),
        }),
        30000
      );

      const data = await response.json();
      const points = data.result?.points || [];

      const toDelete: string[] = [];
      const toUpdate: { id: string; importance: number }[] = [];

      for (const point of points) {
        const memory = point.payload as MemoryEntry;
        let newImportance = memory.importance * memory.decayRate;

        // Boost for recent access
        const daysSinceAccess = (Date.now() - memory.accessedAt) / 86400000;
        if (daysSinceAccess < 7) {
          newImportance = Math.min(100, newImportance * 1.1);
        }

        if (newImportance < this.config.minImportance) {
          toDelete.push(point.id);
        } else if (Math.abs(newImportance - memory.importance) > 0.01) {
          toUpdate.push({ id: point.id, importance: newImportance });
        }
      }

      // Batch delete
      if (toDelete.length > 0) {
        await this.withTimeout(
          fetch(`${this.baseUrl}/collections/${MCP_MEMORY_COLLECTION}/points/delete`, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify({ points: toDelete }),
          })
        );
        console.log(`[QdrantMemoryStore] Decay deleted ${toDelete.length} memories`);
      }

      // Batch update importance
      for (const update of toUpdate) {
        await this.updateMemory(update.id, { importance: update.importance });
      }
    } catch (error) {
      console.error('[QdrantMemoryStore] Decay error:', error);
    }
  }

  boostImportance(id: string, amount: number = 10): void {
    // Fire and forget - don't block
    this.get(id).then(memory => {
      if (memory) {
        this.updateMemory(id, {
          importance: Math.min(100, memory.importance + amount),
          accessedAt: Date.now(),
          accessCount: memory.accessCount + 1,
        });
      }
    }).catch(() => {});
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  async getStats(): Promise<MemoryStats> {
    await this.initialize();

    const response = await this.withTimeout(
      fetch(`${this.baseUrl}/collections/${MCP_MEMORY_COLLECTION}`, {
        headers: this.headers(),
      })
    );

    const collectionInfo = await response.json();
    const pointsCount = collectionInfo.result?.points_count || 0;

    // Get sample for detailed stats
    const sampleResponse = await this.withTimeout(
      fetch(`${this.baseUrl}/collections/${MCP_MEMORY_COLLECTION}/points/scroll`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          limit: 1000,
          with_payload: true,
        }),
      })
    );

    const sampleData = await sampleResponse.json();
    const points = sampleData.result?.points || [];

    const byType: Record<MemoryType, number> = {} as any;
    const byUser: Record<string, number> = {};
    let totalImportance = 0;
    let oldest = Date.now();
    let newest = 0;

    for (const point of points) {
      const memory = point.payload as MemoryEntry;
      byType[memory.type] = (byType[memory.type] || 0) + 1;
      byUser[memory.userId] = (byUser[memory.userId] || 0) + 1;
      totalImportance += memory.importance;
      oldest = Math.min(oldest, memory.createdAt);
      newest = Math.max(newest, memory.createdAt);
    }

    return {
      totalMemories: pointsCount,
      byType,
      byUser,
      averageImportance: points.length > 0 ? totalImportance / points.length : 0,
      oldestMemory: oldest,
      newestMemory: newest,
      totalEmbeddings: pointsCount,
    };
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private async enforceUserLimits(userId: string): Promise<void> {
    const countResponse = await this.withTimeout(
      fetch(`${this.baseUrl}/collections/${MCP_MEMORY_COLLECTION}/points/count`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          filter: {
            must: [{ key: 'userId', match: { value: userId } }],
          },
        }),
      })
    );

    const countData = await countResponse.json();
    const userCount = countData.result?.count || 0;

    if (userCount <= this.config.maxMemoriesPerUser) return;

    // Find lowest importance memories to delete
    const scrollResponse = await this.withTimeout(
      fetch(`${this.baseUrl}/collections/${MCP_MEMORY_COLLECTION}/points/scroll`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          limit: userCount,
          filter: {
            must: [{ key: 'userId', match: { value: userId } }],
          },
          with_payload: true,
        }),
      })
    );

    const scrollData = await scrollResponse.json();
    const points = scrollData.result?.points || [];

    // Sort by importance ascending
    points.sort((a: any, b: any) => a.payload.importance - b.payload.importance);

    // Delete lowest importance
    const toDelete = points.slice(0, points.length - this.config.maxMemoriesPerUser);
    if (toDelete.length > 0) {
      await this.withTimeout(
        fetch(`${this.baseUrl}/collections/${MCP_MEMORY_COLLECTION}/points/delete`, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({
            points: toDelete.map((p: any) => p.id),
          }),
        })
      );
    }
  }

  private buildInvestigationContent(params: {
    target: string;
    type: string;
    findings: any[];
    anomalies: any[];
    riskScore: number;
    summary?: string;
  }): string {
    const parts = [
      `Investigation of ${params.target}`,
      `Type: ${params.type}`,
      `Risk Score: ${params.riskScore}`,
      `Findings: ${params.findings.length}`,
      `Anomalies: ${params.anomalies.length}`,
    ];

    if (params.summary) {
      parts.push(`Summary: ${params.summary}`);
    }

    const keyFindings = params.findings
      .filter(f => f.severity === 'high' || f.severity === 'critical')
      .slice(0, 5)
      .map(f => f.title);

    if (keyFindings.length > 0) {
      parts.push(`Key findings: ${keyFindings.join(', ')}`);
    }

    return parts.join('\n');
  }

  private getRiskLevel(score: number): string {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'low';
    return 'minimal';
  }

  private severityToImportance(severity: string): number {
    switch (severity) {
      case 'critical': return 90;
      case 'high': return 75;
      case 'medium': return 55;
      case 'low': return 35;
      default: return 25;
    }
  }

  private extractEntities(text: string): string[] {
    const entities: string[] = [];
    const addressRegex = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
    const addresses = text.match(addressRegex) || [];
    entities.push(...addresses);
    const sigRegex = /[1-9A-HJ-NP-Za-km-z]{87,88}/g;
    const signatures = text.match(sigRegex) || [];
    entities.push(...signatures);
    return [...new Set(entities)];
  }

  private async summarizeAndTrimConversation(context: ConversationContext): Promise<void> {
    const toSummarize = context.messages.slice(0, Math.floor(context.messages.length / 2));
    const summary = toSummarize
      .map(m => `${m.role}: ${m.content.slice(0, 100)}`)
      .join('\n');

    await this.store({
      userId: context.userId,
      type: 'conversation',
      content: `Conversation summary: ${summary}`,
      metadata: {
        conversationId: context.conversationId,
        messageCount: toSummarize.length,
        tags: ['conversation', 'summary'],
      },
      importance: 40,
    });

    context.messages = context.messages.slice(Math.floor(context.messages.length / 2));
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalMemory: MemoryStore | QdrantMemoryStore | null = null;

export function getMemory(): MemoryStore | QdrantMemoryStore {
  if (!globalMemory) {
    // Default to in-memory store, use createQdrantMemory for production
    globalMemory = new MemoryStore();
    globalMemory.startDecay();
  }
  return globalMemory;
}

export function createMemory(
  config?: Partial<MemoryConfig>,
  embedFunction?: (text: string) => Promise<number[]>
): MemoryStore {
  const memory = new MemoryStore(config, embedFunction);
  memory.startDecay();
  globalMemory = memory;
  return memory;
}

/**
 * Create a Qdrant-backed memory store for production use
 *
 * Usage:
 * ```typescript
 * import { createQdrantMemory } from './mcp-memory.js';
 *
 * const memory = await createQdrantMemory({
 *   qdrantUrl: process.env.QDRANT_SERVER,
 *   qdrantApiKey: process.env.QDRANT,
 *   openaiApiKey: process.env.OPENAI_API_KEY,
 * });
 *
 * // Use like in-memory store
 * await memory.store({ userId: 'user1', type: 'knowledge', content: '...' });
 * const results = await memory.search({ userId: 'user1', query: '...' });
 * ```
 */
export async function createQdrantMemory(options: {
  qdrantUrl: string;
  qdrantApiKey?: string;
  openaiApiKey?: string;
  togetherApiKey?: string;
  config?: Partial<MemoryConfig>;
}): Promise<QdrantMemoryStore> {
  // Dynamically import embedding service to avoid circular deps
  const { createEmbedFunction } = await import('./mcp-embeddings.js');

  // Determine provider based on available keys
  const provider = options.openaiApiKey ? 'openai' :
                   options.togetherApiKey ? 'together' : 'local';

  const embedFunction = createEmbedFunction(
    {
      provider,
      model: provider === 'openai' ? 'text-embedding-3-small' :
             provider === 'together' ? 'togethercomputer/m2-bert-80M-8k-retrieval' :
             'local-tfidf',
      dimensions: provider === 'together' ? 768 : 1536,
      fallbackToLocal: true,
    },
    {
      openai: options.openaiApiKey,
      together: options.togetherApiKey,
    }
  );

  const memory = new QdrantMemoryStore(
    options.qdrantUrl,
    options.qdrantApiKey,
    options.config,
    embedFunction
  );

  // Initialize collections and indexes
  await memory.initialize();
  memory.startDecay();

  globalMemory = memory;

  console.log(`[Memory] Initialized Qdrant store with ${provider} embeddings at ${options.qdrantUrl}`);

  return memory;
}

/**
 * Create a production-ready memory store with OpenAI embeddings
 *
 * Usage:
 * ```typescript
 * import { createProductionMemory } from './mcp-memory.js';
 *
 * const memory = await createProductionMemory({
 *   openaiApiKey: process.env.OPENAI_API_KEY,
 *   qdrantUrl: process.env.QDRANT_URL,
 *   qdrantApiKey: process.env.QDRANT_API_KEY,
 * });
 * ```
 */
export async function createProductionMemory(options: {
  openaiApiKey?: string;
  togetherApiKey?: string;
  qdrantUrl?: string;
  qdrantApiKey?: string;
  qdrantCollection?: string;
  config?: Partial<MemoryConfig>;
}): Promise<MemoryStore> {
  // Dynamically import embedding service to avoid circular deps
  const { createEmbedFunction } = await import('./mcp-embeddings.js');

  // Determine provider based on available keys
  const provider = options.openaiApiKey ? 'openai' :
                   options.togetherApiKey ? 'together' : 'local';

  const embedFunction = createEmbedFunction(
    {
      provider,
      model: provider === 'openai' ? 'text-embedding-3-small' :
             provider === 'together' ? 'togethercomputer/m2-bert-80M-8k-retrieval' :
             'local-tfidf',
      dimensions: provider === 'together' ? 768 : 1536,
      fallbackToLocal: true,
    },
    {
      openai: options.openaiApiKey,
      together: options.togetherApiKey,
    }
  );

  const memory = createMemory(options.config, embedFunction);

  console.log(`[Memory] Initialized with ${provider} embeddings`);

  return memory;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  MemoryStore,
  QdrantAdapter,
  QdrantMemoryStore,
  getMemory,
  createMemory,
  createQdrantMemory,
  createProductionMemory,
};
