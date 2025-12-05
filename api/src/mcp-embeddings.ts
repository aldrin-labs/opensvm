/**
 * MCP Embedding Service
 *
 * Production-ready embedding generation using multiple providers:
 * - OpenAI text-embedding-ada-002 / text-embedding-3-small
 * - Together AI embeddings
 * - Local fallback with simple TF-IDF
 *
 * Features:
 * - Automatic provider fallback
 * - Request batching for efficiency
 * - Caching to reduce API calls
 * - Dimension reduction for storage efficiency
 */

// ============================================================================
// Types
// ============================================================================

export type EmbeddingProvider = 'openai' | 'together' | 'local';

export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  model: string;
  dimensions: number;
  batchSize: number;
  cacheEnabled: boolean;
  cacheTtlMs: number;
  fallbackToLocal: boolean;
}

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  provider: EmbeddingProvider;
  cached: boolean;
  dimensions: number;
}

export interface BatchEmbeddingResult {
  embeddings: number[][];
  model: string;
  provider: EmbeddingProvider;
  tokensUsed?: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: EmbeddingConfig = {
  provider: 'openai',
  model: 'text-embedding-3-small',
  dimensions: 1536,
  batchSize: 100,
  cacheEnabled: true,
  cacheTtlMs: 86400000, // 24 hours
  fallbackToLocal: true,
};

// Provider-specific models
const PROVIDER_MODELS = {
  openai: {
    'text-embedding-ada-002': { dimensions: 1536, maxTokens: 8191 },
    'text-embedding-3-small': { dimensions: 1536, maxTokens: 8191 },
    'text-embedding-3-large': { dimensions: 3072, maxTokens: 8191 },
  },
  together: {
    'togethercomputer/m2-bert-80M-8k-retrieval': { dimensions: 768, maxTokens: 8192 },
    'sentence-transformers/msmarco-bert-base-dot-v5': { dimensions: 768, maxTokens: 512 },
  },
};

// ============================================================================
// Embedding Cache
// ============================================================================

interface CacheEntry {
  embedding: number[];
  timestamp: number;
  model: string;
}

class EmbeddingCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize: number = 10000, ttlMs: number = 86400000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  private hashText(text: string, model: string): string {
    // Simple hash for cache key
    let hash = 0;
    const str = `${model}:${text}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  get(text: string, model: string): number[] | null {
    const key = this.hashText(text, model);
    const entry = this.cache.get(key);

    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return entry.embedding;
  }

  set(text: string, model: string, embedding: number[]): void {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    const key = this.hashText(text, model);
    this.cache.set(key, {
      embedding,
      timestamp: Date.now(),
      model,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// ============================================================================
// Provider Implementations
// ============================================================================

/**
 * OpenAI Embeddings
 */
async function getOpenAIEmbedding(
  texts: string[],
  model: string,
  apiKey: string
): Promise<BatchEmbeddingResult> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: texts,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${error}`);
  }

  const data = await response.json();

  return {
    embeddings: data.data.map((d: any) => d.embedding),
    model,
    provider: 'openai',
    tokensUsed: data.usage?.total_tokens,
  };
}

/**
 * Together AI Embeddings
 */
async function getTogetherEmbedding(
  texts: string[],
  model: string,
  apiKey: string
): Promise<BatchEmbeddingResult> {
  const response = await fetch('https://api.together.xyz/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: texts,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Together API error: ${response.status} ${error}`);
  }

  const data = await response.json();

  return {
    embeddings: data.data.map((d: any) => d.embedding),
    model,
    provider: 'together',
    tokensUsed: data.usage?.total_tokens,
  };
}

/**
 * Local TF-IDF based embeddings (fallback)
 */
function getLocalEmbedding(texts: string[], dimensions: number): BatchEmbeddingResult {
  const embeddings = texts.map(text => localEmbed(text, dimensions));

  return {
    embeddings,
    model: 'local-tfidf',
    provider: 'local',
  };
}

/**
 * Simple local embedding using character n-grams
 */
function localEmbed(text: string, dimensions: number): number[] {
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const words = normalized.split(/\s+/).filter(w => w.length > 0);
  const vector = new Array(dimensions).fill(0);

  // Character trigrams
  for (let i = 0; i < normalized.length - 2; i++) {
    const trigram = normalized.slice(i, i + 3);
    let hash = 0;
    for (let j = 0; j < trigram.length; j++) {
      hash = ((hash << 5) - hash) + trigram.charCodeAt(j);
      hash = hash & hash;
    }
    const idx = Math.abs(hash) % dimensions;
    vector[idx] += 1;
  }

  // Word unigrams
  for (const word of words) {
    let hash = 0;
    for (let j = 0; j < word.length; j++) {
      hash = ((hash << 5) - hash) + word.charCodeAt(j);
      hash = hash & hash;
    }
    const idx = Math.abs(hash) % dimensions;
    vector[idx] += 2;
  }

  // Normalize
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return norm > 0 ? vector.map(v => v / norm) : vector;
}

// ============================================================================
// Main Embedding Service
// ============================================================================

export class EmbeddingService {
  private config: EmbeddingConfig;
  private cache: EmbeddingCache;
  private apiKeys: {
    openai?: string;
    together?: string;
  };

  constructor(
    config: Partial<EmbeddingConfig> = {},
    apiKeys: { openai?: string; together?: string } = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new EmbeddingCache(10000, this.config.cacheTtlMs);
    this.apiKeys = {
      openai: apiKeys.openai || process.env.OPENAI_API_KEY,
      together: apiKeys.together || process.env.TOGETHER_API_KEY,
    };
  }

  /**
   * Get embedding for a single text
   */
  async embed(text: string): Promise<EmbeddingResult> {
    // Check cache
    if (this.config.cacheEnabled) {
      const cached = this.cache.get(text, this.config.model);
      if (cached) {
        return {
          embedding: cached,
          model: this.config.model,
          provider: this.config.provider,
          cached: true,
          dimensions: cached.length,
        };
      }
    }

    // Get embedding
    const result = await this.embedBatch([text]);

    // Cache result
    if (this.config.cacheEnabled && result.embeddings.length > 0) {
      this.cache.set(text, result.model, result.embeddings[0]);
    }

    return {
      embedding: result.embeddings[0],
      model: result.model,
      provider: result.provider,
      cached: false,
      dimensions: result.embeddings[0].length,
    };
  }

  /**
   * Get embeddings for multiple texts
   */
  async embedBatch(texts: string[]): Promise<BatchEmbeddingResult> {
    if (texts.length === 0) {
      return { embeddings: [], model: this.config.model, provider: this.config.provider };
    }

    // Check which texts are cached
    const results: (number[] | null)[] = texts.map(t =>
      this.config.cacheEnabled ? this.cache.get(t, this.config.model) : null
    );

    const uncachedIndices = results
      .map((r, i) => (r === null ? i : -1))
      .filter(i => i >= 0);

    const uncachedTexts = uncachedIndices.map(i => texts[i]);

    // If all cached, return immediately
    if (uncachedTexts.length === 0) {
      return {
        embeddings: results as number[][],
        model: this.config.model,
        provider: this.config.provider,
      };
    }

    // Fetch uncached embeddings
    let batchResult: BatchEmbeddingResult;

    try {
      batchResult = await this.fetchEmbeddings(uncachedTexts);
    } catch (error) {
      if (this.config.fallbackToLocal) {
        console.warn('[Embeddings] API failed, falling back to local:', error);
        batchResult = getLocalEmbedding(uncachedTexts, this.config.dimensions);
      } else {
        throw error;
      }
    }

    // Merge cached and new results
    for (let i = 0; i < uncachedIndices.length; i++) {
      const idx = uncachedIndices[i];
      results[idx] = batchResult.embeddings[i];

      // Cache new embeddings
      if (this.config.cacheEnabled) {
        this.cache.set(texts[idx], batchResult.model, batchResult.embeddings[i]);
      }
    }

    return {
      embeddings: results as number[][],
      model: batchResult.model,
      provider: batchResult.provider,
      tokensUsed: batchResult.tokensUsed,
    };
  }

  /**
   * Fetch embeddings from the configured provider
   */
  private async fetchEmbeddings(texts: string[]): Promise<BatchEmbeddingResult> {
    const { provider, model, batchSize } = this.config;

    // Process in batches
    const allEmbeddings: number[][] = [];
    let totalTokens = 0;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      let result: BatchEmbeddingResult;

      switch (provider) {
        case 'openai':
          if (!this.apiKeys.openai) {
            throw new Error('OpenAI API key not configured');
          }
          result = await getOpenAIEmbedding(batch, model, this.apiKeys.openai);
          break;

        case 'together':
          if (!this.apiKeys.together) {
            throw new Error('Together API key not configured');
          }
          result = await getTogetherEmbedding(batch, model, this.apiKeys.together);
          break;

        case 'local':
        default:
          result = getLocalEmbedding(batch, this.config.dimensions);
      }

      allEmbeddings.push(...result.embeddings);
      if (result.tokensUsed) {
        totalTokens += result.tokensUsed;
      }
    }

    return {
      embeddings: allEmbeddings,
      model,
      provider,
      tokensUsed: totalTokens > 0 ? totalTokens : undefined,
    };
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  similarity(a: number[], b: number[]): number {
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

  /**
   * Find most similar embeddings
   */
  findMostSimilar(
    query: number[],
    candidates: { id: string; embedding: number[] }[],
    topK: number = 10,
    threshold: number = 0.5
  ): { id: string; score: number }[] {
    const scores = candidates.map(c => ({
      id: c.id,
      score: this.similarity(query, c.embedding),
    }));

    return scores
      .filter(s => s.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; enabled: boolean } {
    return {
      size: this.cache.size(),
      enabled: this.config.cacheEnabled,
    };
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Update configuration
   */
  configure(updates: Partial<EmbeddingConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalEmbeddings: EmbeddingService | null = null;

export function getEmbeddings(): EmbeddingService {
  if (!globalEmbeddings) {
    globalEmbeddings = new EmbeddingService();
  }
  return globalEmbeddings;
}

export function createEmbeddings(
  config?: Partial<EmbeddingConfig>,
  apiKeys?: { openai?: string; together?: string }
): EmbeddingService {
  globalEmbeddings = new EmbeddingService(config, apiKeys);
  return globalEmbeddings;
}

// ============================================================================
// Convenience function for memory store integration
// ============================================================================

/**
 * Create an embedding function for the memory store
 */
export function createEmbedFunction(
  config?: Partial<EmbeddingConfig>,
  apiKeys?: { openai?: string; together?: string }
): (text: string) => Promise<number[]> {
  const service = new EmbeddingService(config, apiKeys);

  return async (text: string) => {
    const result = await service.embed(text);
    return result.embedding;
  };
}

// ============================================================================
// Exports
// ============================================================================

export default {
  EmbeddingService,
  getEmbeddings,
  createEmbeddings,
  createEmbedFunction,
};
