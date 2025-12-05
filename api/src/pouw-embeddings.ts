/**
 * PoUW Embeddings Service
 *
 * Generates real semantic embeddings for indexed blockchain data.
 * Supports multiple embedding providers with fallback:
 * 1. Together AI (primary - fast and cheap)
 * 2. OpenAI (fallback - high quality)
 * 3. Local hash-based (last resort)
 *
 * @module pouw-embeddings
 */

import { createHash } from 'crypto';

// ============================================================================
// Configuration
// ============================================================================

const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Embedding dimensions (must match Qdrant collection config)
const EMBEDDING_DIM = 384;

// Together AI embedding model
const TOGETHER_MODEL = 'togethercomputer/m2-bert-80M-8k-retrieval';

// OpenAI embedding model
const OPENAI_MODEL = 'text-embedding-3-small';

// Cache for embeddings (in-memory LRU)
const embeddingCache = new Map<string, { vector: number[]; timestamp: number }>();
const CACHE_MAX_SIZE = 1000;
const CACHE_TTL_MS = 3600000; // 1 hour

// ============================================================================
// Provider Selection
// ============================================================================

type EmbeddingProvider = 'together' | 'openai' | 'local';

function getProvider(): EmbeddingProvider {
  if (TOGETHER_API_KEY) return 'together';
  if (OPENAI_API_KEY) return 'openai';
  return 'local';
}

// ============================================================================
// Text Preprocessing
// ============================================================================

/**
 * Prepare text for embedding generation
 */
function preprocessText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000); // Max token limit
}

/**
 * Generate text representation for a transaction
 */
export function transactionToText(tx: {
  signature: string;
  type: string;
  category: string;
  programs: string[];
  labels: string[];
  success?: boolean;
}): string {
  const parts = [
    `transaction type ${tx.type}`,
    `category ${tx.category}`,
    tx.labels.length > 0 ? `labels ${tx.labels.join(' ')}` : '',
    tx.programs.length > 0 ? `programs ${tx.programs.slice(0, 3).join(' ')}` : '',
    tx.success === false ? 'failed transaction' : '',
  ].filter(Boolean);

  return preprocessText(parts.join(' '));
}

/**
 * Generate text representation for a pattern
 */
export function patternToText(pattern: {
  type: string;
  severity: string;
  evidence: string;
  confidence: number;
}): string {
  const parts = [
    `pattern type ${pattern.type}`,
    `severity ${pattern.severity}`,
    `evidence ${pattern.evidence}`,
    pattern.confidence > 0.8 ? 'high confidence' : pattern.confidence > 0.5 ? 'medium confidence' : 'low confidence',
  ];

  return preprocessText(parts.join(' '));
}

/**
 * Generate text representation for a wallet
 */
export function walletToText(wallet: {
  address: string;
  classification: string;
  behaviors: string[];
  confidence: number;
}): string {
  const parts = [
    `wallet classification ${wallet.classification}`,
    wallet.behaviors.length > 0 ? `behaviors ${wallet.behaviors.join(' ')}` : '',
    wallet.confidence > 0.8 ? 'high confidence' : '',
  ].filter(Boolean);

  return preprocessText(parts.join(' '));
}

/**
 * Generate text representation for an entity
 */
export function entityToText(entity: {
  address: string;
  entityType: string;
  name?: string;
  evidence: string[];
}): string {
  const parts = [
    `entity type ${entity.entityType}`,
    entity.name ? `name ${entity.name}` : '',
    entity.evidence.length > 0 ? `evidence ${entity.evidence.join(' ')}` : '',
  ].filter(Boolean);

  return preprocessText(parts.join(' '));
}

// ============================================================================
// Embedding Generation
// ============================================================================

/**
 * Generate local hash-based embedding (fallback)
 */
function generateLocalEmbedding(text: string): number[] {
  const hash = createHash('sha256').update(text).digest();
  const vector: number[] = [];

  for (let i = 0; i < EMBEDDING_DIM; i++) {
    const byte = hash[i % hash.length];
    vector.push((byte! / 127.5) - 1);
  }

  return vector;
}

/**
 * Generate embedding using Together AI
 */
async function generateTogetherEmbedding(text: string): Promise<number[]> {
  if (!TOGETHER_API_KEY) {
    throw new Error('Together API key not configured');
  }

  const response = await fetch('https://api.together.xyz/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOGETHER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: TOGETHER_MODEL,
      input: text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Together API error: ${error}`);
  }

  const data = await response.json();
  let embedding = data.data?.[0]?.embedding;

  if (!embedding) {
    throw new Error('No embedding returned from Together API');
  }

  // Resize if needed
  if (embedding.length !== EMBEDDING_DIM) {
    embedding = resizeEmbedding(embedding, EMBEDDING_DIM);
  }

  return embedding;
}

/**
 * Generate embedding using OpenAI
 */
async function generateOpenAIEmbedding(text: string): Promise<number[]> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: text,
      dimensions: EMBEDDING_DIM, // OpenAI supports dimension reduction
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  const embedding = data.data?.[0]?.embedding;

  if (!embedding) {
    throw new Error('No embedding returned from OpenAI API');
  }

  return embedding;
}

/**
 * Resize embedding to target dimension
 */
function resizeEmbedding(embedding: number[], targetDim: number): number[] {
  if (embedding.length === targetDim) return embedding;

  if (embedding.length > targetDim) {
    // Truncate and normalize
    return embedding.slice(0, targetDim);
  }

  // Pad with interpolated values
  const result: number[] = [];
  const ratio = embedding.length / targetDim;

  for (let i = 0; i < targetDim; i++) {
    const srcIdx = i * ratio;
    const lowIdx = Math.floor(srcIdx);
    const highIdx = Math.min(lowIdx + 1, embedding.length - 1);
    const fraction = srcIdx - lowIdx;
    result.push(embedding[lowIdx]! * (1 - fraction) + embedding[highIdx]! * fraction);
  }

  return result;
}

/**
 * Get cached embedding or generate new one
 */
function getCachedEmbedding(text: string): number[] | null {
  const cached = embeddingCache.get(text);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.vector;
  }
  return null;
}

/**
 * Cache an embedding
 */
function cacheEmbedding(text: string, vector: number[]): void {
  // LRU eviction
  if (embeddingCache.size >= CACHE_MAX_SIZE) {
    const oldestKey = embeddingCache.keys().next().value;
    if (oldestKey) embeddingCache.delete(oldestKey);
  }

  embeddingCache.set(text, { vector, timestamp: Date.now() });
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Generate embedding for text
 * Tries providers in order: Together -> OpenAI -> Local
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const processedText = preprocessText(text);

  // Check cache first
  const cached = getCachedEmbedding(processedText);
  if (cached) return cached;

  const provider = getProvider();
  let embedding: number[];

  try {
    switch (provider) {
      case 'together':
        embedding = await generateTogetherEmbedding(processedText);
        break;
      case 'openai':
        embedding = await generateOpenAIEmbedding(processedText);
        break;
      default:
        embedding = generateLocalEmbedding(processedText);
    }
  } catch (error) {
    console.error(`[PoUW Embeddings] ${provider} failed, falling back:`, error);

    // Try fallbacks
    if (provider === 'together' && OPENAI_API_KEY) {
      try {
        embedding = await generateOpenAIEmbedding(processedText);
      } catch {
        embedding = generateLocalEmbedding(processedText);
      }
    } else {
      embedding = generateLocalEmbedding(processedText);
    }
  }

  // Cache the result
  cacheEmbedding(processedText, embedding);

  return embedding;
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  // Process in parallel with concurrency limit
  const BATCH_SIZE = 10;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(generateEmbedding));
    results.push(...batchResults);
  }

  return results;
}

/**
 * Get current embedding provider info
 */
export function getEmbeddingProviderInfo(): {
  provider: EmbeddingProvider;
  model: string;
  dimension: number;
  cacheSize: number;
} {
  const provider = getProvider();
  return {
    provider,
    model: provider === 'together' ? TOGETHER_MODEL : provider === 'openai' ? OPENAI_MODEL : 'sha256-hash',
    dimension: EMBEDDING_DIM,
    cacheSize: embeddingCache.size,
  };
}

/**
 * Clear embedding cache
 */
export function clearEmbeddingCache(): void {
  embeddingCache.clear();
}

// ============================================================================
// Specialized Embedding Functions
// ============================================================================

/**
 * Generate embedding for a transaction
 */
export async function embedTransaction(tx: Parameters<typeof transactionToText>[0]): Promise<number[]> {
  return generateEmbedding(transactionToText(tx));
}

/**
 * Generate embedding for a pattern
 */
export async function embedPattern(pattern: Parameters<typeof patternToText>[0]): Promise<number[]> {
  return generateEmbedding(patternToText(pattern));
}

/**
 * Generate embedding for a wallet
 */
export async function embedWallet(wallet: Parameters<typeof walletToText>[0]): Promise<number[]> {
  return generateEmbedding(walletToText(wallet));
}

/**
 * Generate embedding for an entity
 */
export async function embedEntity(entity: Parameters<typeof entityToText>[0]): Promise<number[]> {
  return generateEmbedding(entityToText(entity));
}

/**
 * Generate embedding for a search query
 */
export async function embedQuery(query: string): Promise<number[]> {
  return generateEmbedding(query);
}

// ============================================================================
// Exports
// ============================================================================

export default {
  generateEmbedding,
  generateEmbeddingsBatch,
  getEmbeddingProviderInfo,
  clearEmbeddingCache,
  embedTransaction,
  embedPattern,
  embedWallet,
  embedEntity,
  embedQuery,
  transactionToText,
  patternToText,
  walletToText,
  entityToText,
};
