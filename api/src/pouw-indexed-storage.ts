/**
 * PoUW Indexed Data Storage
 *
 * Stores and queries the results of Proof-of-Useful-Work.
 * This data is the actual value produced by mining - indexed transactions,
 * detected patterns, classified wallets, and extracted entities.
 *
 * Hybrid storage: Uses Qdrant when QDRANT_URL is set, otherwise in-memory.
 *
 * @module pouw-indexed-storage
 */

import {
  IndexedTransaction,
  DetectedPattern,
  ClassifiedWallet,
  ExtractedEntity,
} from './pouw-data-provider';

// Qdrant storage functions (lazy import to avoid loading when not needed)
let qdrantStorage: typeof import('./pouw-qdrant-storage') | null = null;

// Check if Qdrant is configured
const USE_QDRANT = !!process.env.QDRANT_URL;

async function getQdrantStorage() {
  if (!qdrantStorage && USE_QDRANT) {
    qdrantStorage = await import('./pouw-qdrant-storage');
  }
  return qdrantStorage;
}

// ============================================================================
// Types
// ============================================================================

export interface IndexedDataStats {
  transactions: {
    total: number;
    byType: Record<string, number>;
    byCategory: Record<string, number>;
    successRate: number;
  };
  patterns: {
    total: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
  };
  wallets: {
    total: number;
    byClassification: Record<string, number>;
    averageConfidence: number;
  };
  entities: {
    total: number;
    byType: Record<string, number>;
  };
  lastUpdated: number;
  contributingWorkers: number;
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface TransactionSearchOptions extends SearchOptions {
  type?: string;
  category?: string;
  success?: boolean;
  minFee?: number;
  maxFee?: number;
  startTime?: number;
  endTime?: number;
  program?: string;
  account?: string;
  labels?: string[];
}

export interface PatternSearchOptions extends SearchOptions {
  type?: string;
  severity?: string;
  minConfidence?: number;
}

export interface WalletSearchOptions extends SearchOptions {
  classification?: string;
  minConfidence?: number;
  behavior?: string;
}

export interface EntitySearchOptions extends SearchOptions {
  entityType?: string;
  minConfidence?: number;
}

// ============================================================================
// In-Memory Storage (Use Qdrant in production)
// ============================================================================

class IndexedDataStorage {
  private transactions = new Map<string, IndexedTransaction>();
  private patterns: DetectedPattern[] = [];
  private wallets = new Map<string, ClassifiedWallet>();
  private entities = new Map<string, ExtractedEntity>();
  private contributingWorkers = new Set<string>();
  private lastUpdated = Date.now();

  // ============================================================================
  // Transaction Storage
  // ============================================================================

  /**
   * Store indexed transactions
   */
  storeTransactions(
    transactions: IndexedTransaction[],
    workerId?: string
  ): { stored: number; duplicates: number } {
    let stored = 0;
    let duplicates = 0;

    for (const tx of transactions) {
      if (this.transactions.has(tx.signature)) {
        duplicates++;
      } else {
        this.transactions.set(tx.signature, tx);
        stored++;
      }
    }

    if (workerId) {
      this.contributingWorkers.add(workerId);
    }
    this.lastUpdated = Date.now();

    console.log(`[PoUW Storage] Stored ${stored} transactions (${duplicates} duplicates)`);
    return { stored, duplicates };
  }

  /**
   * Get transaction by signature
   */
  getTransaction(signature: string): IndexedTransaction | null {
    return this.transactions.get(signature) || null;
  }

  /**
   * Search transactions
   */
  searchTransactions(options: TransactionSearchOptions = {}): IndexedTransaction[] {
    const {
      limit = 50,
      offset = 0,
      sortBy = 'timestamp',
      sortOrder = 'desc',
      type,
      category,
      success,
      minFee,
      maxFee,
      startTime,
      endTime,
      program,
      account,
      labels,
    } = options;

    let results = Array.from(this.transactions.values());

    // Apply filters
    if (type) {
      results = results.filter(tx => tx.type === type);
    }
    if (category) {
      results = results.filter(tx => tx.category === category);
    }
    if (success !== undefined) {
      results = results.filter(tx => tx.success === success);
    }
    if (minFee !== undefined) {
      results = results.filter(tx => tx.fee >= minFee);
    }
    if (maxFee !== undefined) {
      results = results.filter(tx => tx.fee <= maxFee);
    }
    if (startTime) {
      results = results.filter(tx => tx.timestamp >= startTime);
    }
    if (endTime) {
      results = results.filter(tx => tx.timestamp <= endTime);
    }
    if (program) {
      results = results.filter(tx => tx.programs.includes(program));
    }
    if (account) {
      results = results.filter(tx => tx.accounts.includes(account));
    }
    if (labels && labels.length > 0) {
      results = results.filter(tx =>
        labels.some(label => tx.labels.includes(label))
      );
    }

    // Sort
    results.sort((a, b) => {
      const aVal = (a as any)[sortBy] || 0;
      const bVal = (b as any)[sortBy] || 0;
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    // Paginate
    return results.slice(offset, offset + limit);
  }

  /**
   * Get transaction types and categories
   */
  getTransactionFacets(): { types: string[]; categories: string[] } {
    const types = new Set<string>();
    const categories = new Set<string>();

    for (const tx of this.transactions.values()) {
      types.add(tx.type);
      categories.add(tx.category);
    }

    return {
      types: Array.from(types).sort(),
      categories: Array.from(categories).sort(),
    };
  }

  // ============================================================================
  // Pattern Storage
  // ============================================================================

  /**
   * Store detected patterns
   */
  storePatterns(
    patterns: DetectedPattern[],
    workerId?: string
  ): { stored: number } {
    // Deduplicate by checking transaction overlap
    for (const pattern of patterns) {
      const isDuplicate = this.patterns.some(existing =>
        existing.type === pattern.type &&
        existing.transactions.some(tx => pattern.transactions.includes(tx))
      );

      if (!isDuplicate) {
        this.patterns.push(pattern);
      }
    }

    if (workerId) {
      this.contributingWorkers.add(workerId);
    }
    this.lastUpdated = Date.now();

    console.log(`[PoUW Storage] Stored ${patterns.length} patterns`);
    return { stored: patterns.length };
  }

  /**
   * Search patterns
   */
  searchPatterns(options: PatternSearchOptions = {}): DetectedPattern[] {
    const {
      limit = 50,
      offset = 0,
      sortBy = 'confidence',
      sortOrder = 'desc',
      type,
      severity,
      minConfidence,
    } = options;

    let results = [...this.patterns];

    if (type) {
      results = results.filter(p => p.type === type);
    }
    if (severity) {
      results = results.filter(p => p.severity === severity);
    }
    if (minConfidence !== undefined) {
      results = results.filter(p => p.confidence >= minConfidence);
    }

    results.sort((a, b) => {
      const aVal = (a as any)[sortBy] || 0;
      const bVal = (b as any)[sortBy] || 0;
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return results.slice(offset, offset + limit);
  }

  /**
   * Get pattern types and severities
   */
  getPatternFacets(): { types: string[]; severities: string[] } {
    const types = new Set<string>();
    const severities = new Set<string>();

    for (const pattern of this.patterns) {
      types.add(pattern.type);
      severities.add(pattern.severity);
    }

    return {
      types: Array.from(types).sort(),
      severities: Array.from(severities).sort(),
    };
  }

  // ============================================================================
  // Wallet Storage
  // ============================================================================

  /**
   * Store classified wallets
   */
  storeWallets(
    wallets: ClassifiedWallet[],
    workerId?: string
  ): { stored: number; updated: number } {
    let stored = 0;
    let updated = 0;

    for (const wallet of wallets) {
      const existing = this.wallets.get(wallet.address);
      if (existing) {
        // Merge classifications - keep higher confidence
        if (wallet.confidence > existing.confidence) {
          this.wallets.set(wallet.address, wallet);
          updated++;
        }
      } else {
        this.wallets.set(wallet.address, wallet);
        stored++;
      }
    }

    if (workerId) {
      this.contributingWorkers.add(workerId);
    }
    this.lastUpdated = Date.now();

    console.log(`[PoUW Storage] Stored ${stored} wallets, updated ${updated}`);
    return { stored, updated };
  }

  /**
   * Get wallet classification
   */
  getWallet(address: string): ClassifiedWallet | null {
    return this.wallets.get(address) || null;
  }

  /**
   * Search wallets
   */
  searchWallets(options: WalletSearchOptions = {}): ClassifiedWallet[] {
    const {
      limit = 50,
      offset = 0,
      sortBy = 'confidence',
      sortOrder = 'desc',
      classification,
      minConfidence,
      behavior,
    } = options;

    let results = Array.from(this.wallets.values());

    if (classification) {
      results = results.filter(w => w.classification === classification);
    }
    if (minConfidence !== undefined) {
      results = results.filter(w => w.confidence >= minConfidence);
    }
    if (behavior) {
      results = results.filter(w => w.behaviors.includes(behavior));
    }

    results.sort((a, b) => {
      const aVal = (a as any)[sortBy] || 0;
      const bVal = (b as any)[sortBy] || 0;
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return results.slice(offset, offset + limit);
  }

  /**
   * Get wallet classifications and behaviors
   */
  getWalletFacets(): { classifications: string[]; behaviors: string[] } {
    const classifications = new Set<string>();
    const behaviors = new Set<string>();

    for (const wallet of this.wallets.values()) {
      classifications.add(wallet.classification);
      for (const behavior of wallet.behaviors) {
        behaviors.add(behavior);
      }
    }

    return {
      classifications: Array.from(classifications).sort(),
      behaviors: Array.from(behaviors).sort(),
    };
  }

  // ============================================================================
  // Entity Storage
  // ============================================================================

  /**
   * Store extracted entities
   */
  storeEntities(
    entities: ExtractedEntity[],
    workerId?: string
  ): { stored: number; updated: number } {
    let stored = 0;
    let updated = 0;

    for (const entity of entities) {
      const existing = this.entities.get(entity.address);
      if (existing) {
        // Merge - add new evidence
        if (entity.confidence >= existing.confidence) {
          const merged: ExtractedEntity = {
            ...entity,
            evidence: [...new Set([...existing.evidence, ...entity.evidence])],
          };
          this.entities.set(entity.address, merged);
          updated++;
        }
      } else {
        this.entities.set(entity.address, entity);
        stored++;
      }
    }

    if (workerId) {
      this.contributingWorkers.add(workerId);
    }
    this.lastUpdated = Date.now();

    console.log(`[PoUW Storage] Stored ${stored} entities, updated ${updated}`);
    return { stored, updated };
  }

  /**
   * Get entity by address
   */
  getEntity(address: string): ExtractedEntity | null {
    return this.entities.get(address) || null;
  }

  /**
   * Search entities
   */
  searchEntities(options: EntitySearchOptions = {}): ExtractedEntity[] {
    const {
      limit = 50,
      offset = 0,
      sortBy = 'confidence',
      sortOrder = 'desc',
      entityType,
      minConfidence,
    } = options;

    let results = Array.from(this.entities.values());

    if (entityType) {
      results = results.filter(e => e.entityType === entityType);
    }
    if (minConfidence !== undefined) {
      results = results.filter(e => e.confidence >= minConfidence);
    }

    results.sort((a, b) => {
      const aVal = (a as any)[sortBy] || 0;
      const bVal = (b as any)[sortBy] || 0;
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return results.slice(offset, offset + limit);
  }

  /**
   * Get entity types
   */
  getEntityFacets(): { types: string[] } {
    const types = new Set<string>();

    for (const entity of this.entities.values()) {
      types.add(entity.entityType);
    }

    return {
      types: Array.from(types).sort(),
    };
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Get comprehensive statistics
   */
  getStats(): IndexedDataStats {
    // Transaction stats
    const txByType: Record<string, number> = {};
    const txByCategory: Record<string, number> = {};
    let successCount = 0;

    for (const tx of this.transactions.values()) {
      txByType[tx.type] = (txByType[tx.type] || 0) + 1;
      txByCategory[tx.category] = (txByCategory[tx.category] || 0) + 1;
      if (tx.success) successCount++;
    }

    // Pattern stats
    const patternBySeverity: Record<string, number> = {};
    const patternByType: Record<string, number> = {};

    for (const pattern of this.patterns) {
      patternBySeverity[pattern.severity] = (patternBySeverity[pattern.severity] || 0) + 1;
      patternByType[pattern.type] = (patternByType[pattern.type] || 0) + 1;
    }

    // Wallet stats
    const walletByClassification: Record<string, number> = {};
    let totalConfidence = 0;

    for (const wallet of this.wallets.values()) {
      walletByClassification[wallet.classification] =
        (walletByClassification[wallet.classification] || 0) + 1;
      totalConfidence += wallet.confidence;
    }

    // Entity stats
    const entityByType: Record<string, number> = {};

    for (const entity of this.entities.values()) {
      entityByType[entity.entityType] = (entityByType[entity.entityType] || 0) + 1;
    }

    return {
      transactions: {
        total: this.transactions.size,
        byType: txByType,
        byCategory: txByCategory,
        successRate: this.transactions.size > 0
          ? successCount / this.transactions.size
          : 0,
      },
      patterns: {
        total: this.patterns.length,
        bySeverity: patternBySeverity,
        byType: patternByType,
      },
      wallets: {
        total: this.wallets.size,
        byClassification: walletByClassification,
        averageConfidence: this.wallets.size > 0
          ? totalConfidence / this.wallets.size
          : 0,
      },
      entities: {
        total: this.entities.size,
        byType: entityByType,
      },
      lastUpdated: this.lastUpdated,
      contributingWorkers: this.contributingWorkers.size,
    };
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.transactions.clear();
    this.patterns = [];
    this.wallets.clear();
    this.entities.clear();
    this.contributingWorkers.clear();
    this.lastUpdated = Date.now();
    console.log('[PoUW Storage] Cleared all data');
  }
}

// ============================================================================
// Hybrid Storage Wrapper
// ============================================================================

/**
 * Hybrid storage that uses Qdrant when available, falls back to in-memory.
 * All write operations go to both storages when Qdrant is enabled.
 * Read operations prefer Qdrant when available.
 */
class HybridIndexedDataStorage {
  private inMemory = new IndexedDataStorage();
  private qdrantEnabled = USE_QDRANT;

  constructor() {
    if (this.qdrantEnabled) {
      console.log('[PoUW Storage] Qdrant enabled - using hybrid storage');
    } else {
      console.log('[PoUW Storage] Using in-memory storage only');
    }
  }

  // ============================================================================
  // Transaction Operations
  // ============================================================================

  async storeTransactionsAsync(
    transactions: IndexedTransaction[],
    workerId?: string
  ): Promise<{ stored: number; duplicates: number }> {
    // Always store in memory for fast reads
    const memResult = this.inMemory.storeTransactions(transactions, workerId);

    // Also store in Qdrant if enabled
    if (this.qdrantEnabled) {
      try {
        const qdrant = await getQdrantStorage();
        if (qdrant) {
          await qdrant.storeTransactionsQdrant(transactions, workerId);
        }
      } catch (error) {
        console.error('[PoUW Storage] Qdrant store failed, using in-memory:', error);
      }
    }

    return memResult;
  }

  // Sync version for backwards compatibility
  storeTransactions(
    transactions: IndexedTransaction[],
    workerId?: string
  ): { stored: number; duplicates: number } {
    const result = this.inMemory.storeTransactions(transactions, workerId);

    // Fire and forget Qdrant storage
    if (this.qdrantEnabled) {
      this.storeTransactionsAsync(transactions, workerId).catch(console.error);
    }

    return result;
  }

  async getTransactionAsync(signature: string): Promise<IndexedTransaction | null> {
    // Try memory first
    const memResult = this.inMemory.getTransaction(signature);
    if (memResult) return memResult;

    // Try Qdrant
    if (this.qdrantEnabled) {
      try {
        const qdrant = await getQdrantStorage();
        if (qdrant) {
          return await qdrant.getTransactionQdrant(signature);
        }
      } catch (error) {
        console.error('[PoUW Storage] Qdrant get failed:', error);
      }
    }

    return null;
  }

  getTransaction(signature: string): IndexedTransaction | null {
    return this.inMemory.getTransaction(signature);
  }

  async searchTransactionsAsync(options: TransactionSearchOptions = {}): Promise<IndexedTransaction[]> {
    if (this.qdrantEnabled) {
      try {
        const qdrant = await getQdrantStorage();
        if (qdrant) {
          return await qdrant.searchTransactionsQdrant(options);
        }
      } catch (error) {
        console.error('[PoUW Storage] Qdrant search failed, using in-memory:', error);
      }
    }
    return this.inMemory.searchTransactions(options);
  }

  searchTransactions(options: TransactionSearchOptions = {}): IndexedTransaction[] {
    return this.inMemory.searchTransactions(options);
  }

  getTransactionFacets(): { types: string[]; categories: string[] } {
    return this.inMemory.getTransactionFacets();
  }

  // ============================================================================
  // Pattern Operations
  // ============================================================================

  async storePatternsAsync(
    patterns: DetectedPattern[],
    workerId?: string
  ): Promise<{ stored: number }> {
    const memResult = this.inMemory.storePatterns(patterns, workerId);

    if (this.qdrantEnabled) {
      try {
        const qdrant = await getQdrantStorage();
        if (qdrant) {
          await qdrant.storePatternsQdrant(patterns, workerId);
        }
      } catch (error) {
        console.error('[PoUW Storage] Qdrant store patterns failed:', error);
      }
    }

    return memResult;
  }

  storePatterns(patterns: DetectedPattern[], workerId?: string): { stored: number } {
    const result = this.inMemory.storePatterns(patterns, workerId);

    if (this.qdrantEnabled) {
      this.storePatternsAsync(patterns, workerId).catch(console.error);
    }

    return result;
  }

  async searchPatternsAsync(options: PatternSearchOptions = {}): Promise<DetectedPattern[]> {
    if (this.qdrantEnabled) {
      try {
        const qdrant = await getQdrantStorage();
        if (qdrant) {
          return await qdrant.searchPatternsQdrant(options);
        }
      } catch (error) {
        console.error('[PoUW Storage] Qdrant search patterns failed:', error);
      }
    }
    return this.inMemory.searchPatterns(options);
  }

  searchPatterns(options: PatternSearchOptions = {}): DetectedPattern[] {
    return this.inMemory.searchPatterns(options);
  }

  getPatternFacets(): { types: string[]; severities: string[] } {
    return this.inMemory.getPatternFacets();
  }

  // ============================================================================
  // Wallet Operations
  // ============================================================================

  async storeWalletsAsync(
    wallets: ClassifiedWallet[],
    workerId?: string
  ): Promise<{ stored: number; updated: number }> {
    const memResult = this.inMemory.storeWallets(wallets, workerId);

    if (this.qdrantEnabled) {
      try {
        const qdrant = await getQdrantStorage();
        if (qdrant) {
          await qdrant.storeWalletsQdrant(wallets, workerId);
        }
      } catch (error) {
        console.error('[PoUW Storage] Qdrant store wallets failed:', error);
      }
    }

    return memResult;
  }

  storeWallets(wallets: ClassifiedWallet[], workerId?: string): { stored: number; updated: number } {
    const result = this.inMemory.storeWallets(wallets, workerId);

    if (this.qdrantEnabled) {
      this.storeWalletsAsync(wallets, workerId).catch(console.error);
    }

    return result;
  }

  async getWalletAsync(address: string): Promise<ClassifiedWallet | null> {
    const memResult = this.inMemory.getWallet(address);
    if (memResult) return memResult;

    if (this.qdrantEnabled) {
      try {
        const qdrant = await getQdrantStorage();
        if (qdrant) {
          return await qdrant.getWalletQdrant(address);
        }
      } catch (error) {
        console.error('[PoUW Storage] Qdrant get wallet failed:', error);
      }
    }

    return null;
  }

  getWallet(address: string): ClassifiedWallet | null {
    return this.inMemory.getWallet(address);
  }

  async searchWalletsAsync(options: WalletSearchOptions = {}): Promise<ClassifiedWallet[]> {
    if (this.qdrantEnabled) {
      try {
        const qdrant = await getQdrantStorage();
        if (qdrant) {
          return await qdrant.searchWalletsQdrant(options);
        }
      } catch (error) {
        console.error('[PoUW Storage] Qdrant search wallets failed:', error);
      }
    }
    return this.inMemory.searchWallets(options);
  }

  searchWallets(options: WalletSearchOptions = {}): ClassifiedWallet[] {
    return this.inMemory.searchWallets(options);
  }

  getWalletFacets(): { classifications: string[]; behaviors: string[] } {
    return this.inMemory.getWalletFacets();
  }

  // ============================================================================
  // Entity Operations
  // ============================================================================

  async storeEntitiesAsync(
    entities: ExtractedEntity[],
    workerId?: string
  ): Promise<{ stored: number; updated: number }> {
    const memResult = this.inMemory.storeEntities(entities, workerId);

    if (this.qdrantEnabled) {
      try {
        const qdrant = await getQdrantStorage();
        if (qdrant) {
          await qdrant.storeEntitiesQdrant(entities, workerId);
        }
      } catch (error) {
        console.error('[PoUW Storage] Qdrant store entities failed:', error);
      }
    }

    return memResult;
  }

  storeEntities(entities: ExtractedEntity[], workerId?: string): { stored: number; updated: number } {
    const result = this.inMemory.storeEntities(entities, workerId);

    if (this.qdrantEnabled) {
      this.storeEntitiesAsync(entities, workerId).catch(console.error);
    }

    return result;
  }

  async getEntityAsync(address: string): Promise<ExtractedEntity | null> {
    const memResult = this.inMemory.getEntity(address);
    if (memResult) return memResult;

    if (this.qdrantEnabled) {
      try {
        const qdrant = await getQdrantStorage();
        if (qdrant) {
          return await qdrant.getEntityQdrant(address);
        }
      } catch (error) {
        console.error('[PoUW Storage] Qdrant get entity failed:', error);
      }
    }

    return null;
  }

  getEntity(address: string): ExtractedEntity | null {
    return this.inMemory.getEntity(address);
  }

  async searchEntitiesAsync(options: EntitySearchOptions = {}): Promise<ExtractedEntity[]> {
    if (this.qdrantEnabled) {
      try {
        const qdrant = await getQdrantStorage();
        if (qdrant) {
          return await qdrant.searchEntitiesQdrant(options);
        }
      } catch (error) {
        console.error('[PoUW Storage] Qdrant search entities failed:', error);
      }
    }
    return this.inMemory.searchEntities(options);
  }

  searchEntities(options: EntitySearchOptions = {}): ExtractedEntity[] {
    return this.inMemory.searchEntities(options);
  }

  getEntityFacets(): { types: string[] } {
    return this.inMemory.getEntityFacets();
  }

  // ============================================================================
  // Statistics & Semantic Search
  // ============================================================================

  async getStatsAsync(): Promise<IndexedDataStats> {
    if (this.qdrantEnabled) {
      try {
        const qdrant = await getQdrantStorage();
        if (qdrant) {
          const qdrantStats = await qdrant.getStatsQdrant();
          // Merge with in-memory stats for contributing workers count
          const memStats = this.inMemory.getStats();
          return {
            ...qdrantStats,
            contributingWorkers: Math.max(qdrantStats.contributingWorkers, memStats.contributingWorkers),
          };
        }
      } catch (error) {
        console.error('[PoUW Storage] Qdrant stats failed:', error);
      }
    }
    return this.inMemory.getStats();
  }

  getStats(): IndexedDataStats {
    return this.inMemory.getStats();
  }

  /**
   * Semantic search across all indexed data
   * Only available when Qdrant is enabled
   */
  async semanticSearch(
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
    enabled: boolean;
  }> {
    if (!this.qdrantEnabled) {
      return {
        transactions: [],
        patterns: [],
        wallets: [],
        entities: [],
        enabled: false,
      };
    }

    try {
      const qdrant = await getQdrantStorage();
      if (qdrant) {
        const results = await qdrant.semanticSearch(query, options);
        return { ...results, enabled: true };
      }
    } catch (error) {
      console.error('[PoUW Storage] Semantic search failed:', error);
    }

    return {
      transactions: [],
      patterns: [],
      wallets: [],
      entities: [],
      enabled: false,
    };
  }

  /**
   * Check if Qdrant is enabled
   */
  isQdrantEnabled(): boolean {
    return this.qdrantEnabled;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.inMemory.clear();
    // Note: Qdrant collections are not cleared - use admin tools for that
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const indexedStorage = new HybridIndexedDataStorage();

// ============================================================================
// Exports
// ============================================================================

export default {
  indexedStorage,
};
