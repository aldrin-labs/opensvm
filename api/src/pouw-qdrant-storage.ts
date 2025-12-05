/**
 * PoUW Qdrant Storage
 *
 * Persistent vector storage for indexed blockchain data using Qdrant.
 * Enables semantic search across transactions, patterns, wallets, and entities.
 *
 * Collections:
 * - pouw_transactions: Indexed transaction data
 * - pouw_patterns: Detected suspicious patterns
 * - pouw_wallets: Classified wallet addresses
 * - pouw_entities: Extracted known entities
 *
 * @module pouw-qdrant-storage
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { createHash } from 'crypto';
import {
  IndexedTransaction,
  DetectedPattern,
  ClassifiedWallet,
  ExtractedEntity,
} from './pouw-data-provider';
import { IndexedDataStats } from './pouw-indexed-storage';
import {
  embedTransaction,
  embedPattern,
  embedWallet,
  embedEntity,
  embedQuery,
  getEmbeddingProviderInfo,
} from './pouw-embeddings';

// ============================================================================
// Configuration
// ============================================================================

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const VECTOR_SIZE = 384; // Must match embedding dimension
const COLLECTION_PREFIX = 'pouw_';

// Use real embeddings when API keys are available
const USE_REAL_EMBEDDINGS = !!(process.env.TOGETHER_API_KEY || process.env.OPENAI_API_KEY);

// Collection names
const COLLECTIONS = {
  transactions: `${COLLECTION_PREFIX}transactions`,
  patterns: `${COLLECTION_PREFIX}patterns`,
  wallets: `${COLLECTION_PREFIX}wallets`,
  entities: `${COLLECTION_PREFIX}entities`,
};

// ============================================================================
// Qdrant Client
// ============================================================================

let qdrantClient: QdrantClient | null = null;

function getClient(): QdrantClient {
  if (!qdrantClient) {
    qdrantClient = new QdrantClient({
      url: QDRANT_URL,
      apiKey: QDRANT_API_KEY,
    });

    const providerInfo = getEmbeddingProviderInfo();
    console.log(`[PoUW Qdrant] Using embedding provider: ${providerInfo.provider} (${providerInfo.model})`);
  }
  return qdrantClient;
}

// ============================================================================
// Vector Generation (Fallback hash-based)
// ============================================================================

function generateHashVector(text: string, size: number = VECTOR_SIZE): number[] {
  const hash = createHash('sha256').update(text).digest();
  const vector: number[] = [];

  for (let i = 0; i < size; i++) {
    const byte = hash[i % hash.length];
    vector.push((byte! / 127.5) - 1);
  }

  return vector;
}

// ============================================================================
// Async Vector Generation with Real Embeddings
// ============================================================================

async function transactionToVectorAsync(tx: IndexedTransaction): Promise<number[]> {
  if (USE_REAL_EMBEDDINGS) {
    try {
      return await embedTransaction(tx);
    } catch (error) {
      console.warn('[PoUW Qdrant] Embedding failed, using hash:', error);
    }
  }
  return generateHashVector(`${tx.type} ${tx.category} ${tx.programs.join(' ')} ${tx.labels.join(' ')}`);
}

async function patternToVectorAsync(pattern: DetectedPattern): Promise<number[]> {
  if (USE_REAL_EMBEDDINGS) {
    try {
      return await embedPattern(pattern);
    } catch (error) {
      console.warn('[PoUW Qdrant] Embedding failed, using hash:', error);
    }
  }
  return generateHashVector(`${pattern.type} ${pattern.severity} ${pattern.evidence}`);
}

async function walletToVectorAsync(wallet: ClassifiedWallet): Promise<number[]> {
  if (USE_REAL_EMBEDDINGS) {
    try {
      return await embedWallet(wallet);
    } catch (error) {
      console.warn('[PoUW Qdrant] Embedding failed, using hash:', error);
    }
  }
  return generateHashVector(`${wallet.classification} ${wallet.behaviors.join(' ')}`);
}

async function entityToVectorAsync(entity: ExtractedEntity): Promise<number[]> {
  if (USE_REAL_EMBEDDINGS) {
    try {
      return await embedEntity(entity);
    } catch (error) {
      console.warn('[PoUW Qdrant] Embedding failed, using hash:', error);
    }
  }
  return generateHashVector(`${entity.entityType} ${entity.name || ''} ${entity.evidence.join(' ')}`);
}

async function queryToVectorAsync(query: string): Promise<number[]> {
  if (USE_REAL_EMBEDDINGS) {
    try {
      return await embedQuery(query);
    } catch (error) {
      console.warn('[PoUW Qdrant] Embedding failed, using hash:', error);
    }
  }
  return generateHashVector(query);
}

// Sync versions for backwards compatibility
function transactionToVector(tx: IndexedTransaction): number[] {
  return generateHashVector(`${tx.type} ${tx.category} ${tx.programs.join(' ')} ${tx.labels.join(' ')}`);
}

function patternToVector(pattern: DetectedPattern): number[] {
  return generateHashVector(`${pattern.type} ${pattern.severity} ${pattern.evidence}`);
}

function walletToVector(wallet: ClassifiedWallet): number[] {
  return generateHashVector(`${wallet.classification} ${wallet.behaviors.join(' ')}`);
}

function entityToVector(entity: ExtractedEntity): number[] {
  return generateHashVector(`${entity.entityType} ${entity.name || ''} ${entity.evidence.join(' ')}`);
}

function generateVector(text: string): number[] {
  return generateHashVector(text);
}

// ============================================================================
// Collection Initialization
// ============================================================================

async function ensureCollections(): Promise<void> {
  const client = getClient();

  for (const [name, collectionName] of Object.entries(COLLECTIONS)) {
    try {
      const exists = await client.collectionExists(collectionName);
      if (!exists.exists) {
        await client.createCollection(collectionName, {
          vectors: {
            size: VECTOR_SIZE,
            distance: 'Cosine',
          },
        });
        console.log(`[PoUW Qdrant] Created collection: ${collectionName}`);

        // Create indexes for filtering
        if (name === 'transactions') {
          await client.createPayloadIndex(collectionName, {
            field_name: 'type',
            field_schema: 'keyword',
          });
          await client.createPayloadIndex(collectionName, {
            field_name: 'category',
            field_schema: 'keyword',
          });
          await client.createPayloadIndex(collectionName, {
            field_name: 'success',
            field_schema: 'bool',
          });
          await client.createPayloadIndex(collectionName, {
            field_name: 'timestamp',
            field_schema: 'integer',
          });
        } else if (name === 'patterns') {
          await client.createPayloadIndex(collectionName, {
            field_name: 'type',
            field_schema: 'keyword',
          });
          await client.createPayloadIndex(collectionName, {
            field_name: 'severity',
            field_schema: 'keyword',
          });
        } else if (name === 'wallets') {
          await client.createPayloadIndex(collectionName, {
            field_name: 'classification',
            field_schema: 'keyword',
          });
        } else if (name === 'entities') {
          await client.createPayloadIndex(collectionName, {
            field_name: 'entityType',
            field_schema: 'keyword',
          });
        }
      }
    } catch (error) {
      console.error(`[PoUW Qdrant] Error ensuring collection ${collectionName}:`, error);
    }
  }
}

// Initialize collections on module load
let initPromise: Promise<void> | null = null;
function init(): Promise<void> {
  if (!initPromise) {
    initPromise = ensureCollections();
  }
  return initPromise;
}

// ============================================================================
// Transaction Storage
// ============================================================================

export async function storeTransactionsQdrant(
  transactions: IndexedTransaction[],
  workerId?: string
): Promise<{ stored: number; duplicates: number }> {
  await init();
  const client = getClient();

  // Generate vectors - use real embeddings when available
  const vectors = await Promise.all(
    transactions.map(tx => transactionToVectorAsync(tx))
  );

  const points = transactions.map((tx, i) => ({
    id: createHash('md5').update(tx.signature).digest('hex'),
    vector: vectors[i]!,
    payload: {
      signature: tx.signature,
      type: tx.type,
      category: tx.category,
      programs: tx.programs,
      accounts: tx.accounts,
      timestamp: tx.timestamp,
      success: tx.success,
      fee: tx.fee,
      labels: tx.labels,
      workerId,
      indexedAt: Date.now(),
    },
  }));

  try {
    await client.upsert(COLLECTIONS.transactions, {
      wait: true,
      points,
    });
    console.log(`[PoUW Qdrant] Stored ${points.length} transactions (${USE_REAL_EMBEDDINGS ? 'semantic' : 'hash'} vectors)`);
    return { stored: points.length, duplicates: 0 };
  } catch (error) {
    console.error('[PoUW Qdrant] Error storing transactions:', error);
    return { stored: 0, duplicates: 0 };
  }
}

export async function searchTransactionsQdrant(options: {
  query?: string;
  type?: string;
  category?: string;
  success?: boolean;
  startTime?: number;
  endTime?: number;
  program?: string;
  limit?: number;
  offset?: number;
}): Promise<IndexedTransaction[]> {
  await init();
  const client = getClient();

  const {
    query,
    type,
    category,
    success,
    startTime,
    endTime,
    program,
    limit = 50,
    offset = 0,
  } = options;

  // Build filter
  const must: any[] = [];
  if (type) must.push({ key: 'type', match: { value: type } });
  if (category) must.push({ key: 'category', match: { value: category } });
  if (success !== undefined) must.push({ key: 'success', match: { value: success } });
  if (startTime) must.push({ key: 'timestamp', range: { gte: startTime } });
  if (endTime) must.push({ key: 'timestamp', range: { lte: endTime } });
  if (program) must.push({ key: 'programs', match: { any: [program] } });

  const filter = must.length > 0 ? { must } : undefined;

  try {
    let results;
    if (query) {
      // Semantic search with real embeddings
      const vector = await queryToVectorAsync(query);
      results = await client.search(COLLECTIONS.transactions, {
        vector,
        filter,
        limit: limit + offset,
        with_payload: true,
      });
    } else {
      // Scroll without vector
      const scrollResult = await client.scroll(COLLECTIONS.transactions, {
        filter,
        limit: limit + offset,
        with_payload: true,
      });
      results = scrollResult.points;
    }

    return results.slice(offset, offset + limit).map((point: any) => ({
      signature: point.payload.signature,
      type: point.payload.type,
      category: point.payload.category,
      programs: point.payload.programs,
      accounts: point.payload.accounts,
      timestamp: point.payload.timestamp,
      success: point.payload.success,
      fee: point.payload.fee,
      labels: point.payload.labels,
    }));
  } catch (error) {
    console.error('[PoUW Qdrant] Error searching transactions:', error);
    return [];
  }
}

export async function getTransactionQdrant(signature: string): Promise<IndexedTransaction | null> {
  await init();
  const client = getClient();

  const id = createHash('md5').update(signature).digest('hex');

  try {
    const points = await client.retrieve(COLLECTIONS.transactions, {
      ids: [id],
      with_payload: true,
    });

    if (points.length === 0) return null;

    const p = points[0]!.payload as any;
    return {
      signature: p.signature,
      type: p.type,
      category: p.category,
      programs: p.programs,
      accounts: p.accounts,
      timestamp: p.timestamp,
      success: p.success,
      fee: p.fee,
      labels: p.labels,
    };
  } catch (error) {
    console.error('[PoUW Qdrant] Error getting transaction:', error);
    return null;
  }
}

// ============================================================================
// Pattern Storage
// ============================================================================

export async function storePatternsQdrant(
  patterns: DetectedPattern[],
  workerId?: string
): Promise<{ stored: number }> {
  await init();
  const client = getClient();

  // Generate vectors with real embeddings
  const vectors = await Promise.all(
    patterns.map(p => patternToVectorAsync(p))
  );

  const points = patterns.map((pattern, i) => ({
    id: createHash('md5').update(`${pattern.type}_${pattern.transactions.join('_')}_${Date.now()}_${i}`).digest('hex'),
    vector: vectors[i]!,
    payload: {
      type: pattern.type,
      severity: pattern.severity,
      transactions: pattern.transactions,
      evidence: pattern.evidence,
      confidence: pattern.confidence,
      workerId,
      detectedAt: Date.now(),
    },
  }));

  try {
    await client.upsert(COLLECTIONS.patterns, {
      wait: true,
      points,
    });
    console.log(`[PoUW Qdrant] Stored ${points.length} patterns (${USE_REAL_EMBEDDINGS ? 'semantic' : 'hash'} vectors)`);
    return { stored: points.length };
  } catch (error) {
    console.error('[PoUW Qdrant] Error storing patterns:', error);
    return { stored: 0 };
  }
}

export async function searchPatternsQdrant(options: {
  query?: string;
  type?: string;
  severity?: string;
  minConfidence?: number;
  limit?: number;
  offset?: number;
}): Promise<DetectedPattern[]> {
  await init();
  const client = getClient();

  const { query, type, severity, minConfidence, limit = 50, offset = 0 } = options;

  const must: any[] = [];
  if (type) must.push({ key: 'type', match: { value: type } });
  if (severity) must.push({ key: 'severity', match: { value: severity } });
  if (minConfidence) must.push({ key: 'confidence', range: { gte: minConfidence } });

  const filter = must.length > 0 ? { must } : undefined;

  try {
    let results;
    if (query) {
      const vector = await queryToVectorAsync(query);
      results = await client.search(COLLECTIONS.patterns, {
        vector,
        filter,
        limit: limit + offset,
        with_payload: true,
      });
    } else {
      const scrollResult = await client.scroll(COLLECTIONS.patterns, {
        filter,
        limit: limit + offset,
        with_payload: true,
      });
      results = scrollResult.points;
    }

    return results.slice(offset, offset + limit).map((point: any) => ({
      type: point.payload.type,
      severity: point.payload.severity,
      transactions: point.payload.transactions,
      evidence: point.payload.evidence,
      confidence: point.payload.confidence,
    }));
  } catch (error) {
    console.error('[PoUW Qdrant] Error searching patterns:', error);
    return [];
  }
}

// ============================================================================
// Wallet Storage
// ============================================================================

export async function storeWalletsQdrant(
  wallets: ClassifiedWallet[],
  workerId?: string
): Promise<{ stored: number; updated: number }> {
  await init();
  const client = getClient();

  // Generate vectors with real embeddings
  const vectors = await Promise.all(
    wallets.map(w => walletToVectorAsync(w))
  );

  const points = wallets.map((wallet, i) => ({
    id: createHash('md5').update(wallet.address).digest('hex'),
    vector: vectors[i]!,
    payload: {
      address: wallet.address,
      classification: wallet.classification,
      confidence: wallet.confidence,
      behaviors: wallet.behaviors,
      transactionCount: wallet.transactionCount,
      totalVolume: wallet.totalVolume,
      workerId,
      classifiedAt: Date.now(),
    },
  }));

  try {
    await client.upsert(COLLECTIONS.wallets, {
      wait: true,
      points,
    });
    console.log(`[PoUW Qdrant] Stored ${points.length} wallets (${USE_REAL_EMBEDDINGS ? 'semantic' : 'hash'} vectors)`);
    return { stored: points.length, updated: 0 };
  } catch (error) {
    console.error('[PoUW Qdrant] Error storing wallets:', error);
    return { stored: 0, updated: 0 };
  }
}

export async function searchWalletsQdrant(options: {
  query?: string;
  classification?: string;
  minConfidence?: number;
  behavior?: string;
  limit?: number;
  offset?: number;
}): Promise<ClassifiedWallet[]> {
  await init();
  const client = getClient();

  const { query, classification, minConfidence, behavior, limit = 50, offset = 0 } = options;

  const must: any[] = [];
  if (classification) must.push({ key: 'classification', match: { value: classification } });
  if (minConfidence) must.push({ key: 'confidence', range: { gte: minConfidence } });
  if (behavior) must.push({ key: 'behaviors', match: { any: [behavior] } });

  const filter = must.length > 0 ? { must } : undefined;

  try {
    let results;
    if (query) {
      const vector = await queryToVectorAsync(query);
      results = await client.search(COLLECTIONS.wallets, {
        vector,
        filter,
        limit: limit + offset,
        with_payload: true,
      });
    } else {
      const scrollResult = await client.scroll(COLLECTIONS.wallets, {
        filter,
        limit: limit + offset,
        with_payload: true,
      });
      results = scrollResult.points;
    }

    return results.slice(offset, offset + limit).map((point: any) => ({
      address: point.payload.address,
      classification: point.payload.classification,
      confidence: point.payload.confidence,
      behaviors: point.payload.behaviors,
      transactionCount: point.payload.transactionCount,
      totalVolume: point.payload.totalVolume,
    }));
  } catch (error) {
    console.error('[PoUW Qdrant] Error searching wallets:', error);
    return [];
  }
}

export async function getWalletQdrant(address: string): Promise<ClassifiedWallet | null> {
  await init();
  const client = getClient();

  const id = createHash('md5').update(address).digest('hex');

  try {
    const points = await client.retrieve(COLLECTIONS.wallets, {
      ids: [id],
      with_payload: true,
    });

    if (points.length === 0) return null;

    const p = points[0]!.payload as any;
    return {
      address: p.address,
      classification: p.classification,
      confidence: p.confidence,
      behaviors: p.behaviors,
      transactionCount: p.transactionCount,
      totalVolume: p.totalVolume,
    };
  } catch (error) {
    console.error('[PoUW Qdrant] Error getting wallet:', error);
    return null;
  }
}

// ============================================================================
// Entity Storage
// ============================================================================

export async function storeEntitiesQdrant(
  entities: ExtractedEntity[],
  workerId?: string
): Promise<{ stored: number; updated: number }> {
  await init();
  const client = getClient();

  // Generate vectors with real embeddings
  const vectors = await Promise.all(
    entities.map(e => entityToVectorAsync(e))
  );

  const points = entities.map((entity, i) => ({
    id: createHash('md5').update(entity.address).digest('hex'),
    vector: vectors[i]!,
    payload: {
      address: entity.address,
      entityType: entity.entityType,
      name: entity.name,
      confidence: entity.confidence,
      evidence: entity.evidence,
      workerId,
      extractedAt: Date.now(),
    },
  }));

  try {
    await client.upsert(COLLECTIONS.entities, {
      wait: true,
      points,
    });
    console.log(`[PoUW Qdrant] Stored ${points.length} entities (${USE_REAL_EMBEDDINGS ? 'semantic' : 'hash'} vectors)`);
    return { stored: points.length, updated: 0 };
  } catch (error) {
    console.error('[PoUW Qdrant] Error storing entities:', error);
    return { stored: 0, updated: 0 };
  }
}

export async function searchEntitiesQdrant(options: {
  query?: string;
  entityType?: string;
  minConfidence?: number;
  limit?: number;
  offset?: number;
}): Promise<ExtractedEntity[]> {
  await init();
  const client = getClient();

  const { query, entityType, minConfidence, limit = 50, offset = 0 } = options;

  const must: any[] = [];
  if (entityType) must.push({ key: 'entityType', match: { value: entityType } });
  if (minConfidence) must.push({ key: 'confidence', range: { gte: minConfidence } });

  const filter = must.length > 0 ? { must } : undefined;

  try {
    let results;
    if (query) {
      const vector = await queryToVectorAsync(query);
      results = await client.search(COLLECTIONS.entities, {
        vector,
        filter,
        limit: limit + offset,
        with_payload: true,
      });
    } else {
      const scrollResult = await client.scroll(COLLECTIONS.entities, {
        filter,
        limit: limit + offset,
        with_payload: true,
      });
      results = scrollResult.points;
    }

    return results.slice(offset, offset + limit).map((point: any) => ({
      address: point.payload.address,
      entityType: point.payload.entityType,
      name: point.payload.name,
      confidence: point.payload.confidence,
      evidence: point.payload.evidence,
    }));
  } catch (error) {
    console.error('[PoUW Qdrant] Error searching entities:', error);
    return [];
  }
}

export async function getEntityQdrant(address: string): Promise<ExtractedEntity | null> {
  await init();
  const client = getClient();

  const id = createHash('md5').update(address).digest('hex');

  try {
    const points = await client.retrieve(COLLECTIONS.entities, {
      ids: [id],
      with_payload: true,
    });

    if (points.length === 0) return null;

    const p = points[0]!.payload as any;
    return {
      address: p.address,
      entityType: p.entityType,
      name: p.name,
      confidence: p.confidence,
      evidence: p.evidence,
    };
  } catch (error) {
    console.error('[PoUW Qdrant] Error getting entity:', error);
    return null;
  }
}

// ============================================================================
// Statistics
// ============================================================================

export async function getStatsQdrant(): Promise<IndexedDataStats> {
  await init();
  const client = getClient();

  try {
    const [txInfo, patternInfo, walletInfo, entityInfo] = await Promise.all([
      client.getCollection(COLLECTIONS.transactions),
      client.getCollection(COLLECTIONS.patterns),
      client.getCollection(COLLECTIONS.wallets),
      client.getCollection(COLLECTIONS.entities),
    ]);

    return {
      transactions: {
        total: txInfo.points_count || 0,
        byType: {},
        byCategory: {},
        successRate: 0,
      },
      patterns: {
        total: patternInfo.points_count || 0,
        bySeverity: {},
        byType: {},
      },
      wallets: {
        total: walletInfo.points_count || 0,
        byClassification: {},
        averageConfidence: 0,
      },
      entities: {
        total: entityInfo.points_count || 0,
        byType: {},
      },
      lastUpdated: Date.now(),
      contributingWorkers: 0,
    };
  } catch (error) {
    console.error('[PoUW Qdrant] Error getting stats:', error);
    return {
      transactions: { total: 0, byType: {}, byCategory: {}, successRate: 0 },
      patterns: { total: 0, bySeverity: {}, byType: {} },
      wallets: { total: 0, byClassification: {}, averageConfidence: 0 },
      entities: { total: 0, byType: {} },
      lastUpdated: Date.now(),
      contributingWorkers: 0,
    };
  }
}

// ============================================================================
// Semantic Search
// ============================================================================

export async function semanticSearch(
  query: string,
  options: {
    collections?: ('transactions' | 'patterns' | 'wallets' | 'entities')[];
    limit?: number;
  } = {}
): Promise<{
  transactions: IndexedTransaction[];
  patterns: DetectedPattern[];
  wallets: ClassifiedWallet[];
  entities: ExtractedEntity[];
}> {
  const { collections = ['transactions', 'patterns', 'wallets', 'entities'], limit = 10 } = options;

  const results: {
    transactions: IndexedTransaction[];
    patterns: DetectedPattern[];
    wallets: ClassifiedWallet[];
    entities: ExtractedEntity[];
  } = {
    transactions: [],
    patterns: [],
    wallets: [],
    entities: [],
  };

  const promises: Promise<void>[] = [];

  if (collections.includes('transactions')) {
    promises.push(
      searchTransactionsQdrant({ query, limit }).then(r => { results.transactions = r; })
    );
  }
  if (collections.includes('patterns')) {
    promises.push(
      searchPatternsQdrant({ query, limit }).then(r => { results.patterns = r; })
    );
  }
  if (collections.includes('wallets')) {
    promises.push(
      searchWalletsQdrant({ query, limit }).then(r => { results.wallets = r; })
    );
  }
  if (collections.includes('entities')) {
    promises.push(
      searchEntitiesQdrant({ query, limit }).then(r => { results.entities = r; })
    );
  }

  await Promise.all(promises);
  return results;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  // Transactions
  storeTransactionsQdrant,
  searchTransactionsQdrant,
  getTransactionQdrant,

  // Patterns
  storePatternsQdrant,
  searchPatternsQdrant,

  // Wallets
  storeWalletsQdrant,
  searchWalletsQdrant,
  getWalletQdrant,

  // Entities
  storeEntitiesQdrant,
  searchEntitiesQdrant,
  getEntityQdrant,

  // Stats & Search
  getStatsQdrant,
  semanticSearch,
};
