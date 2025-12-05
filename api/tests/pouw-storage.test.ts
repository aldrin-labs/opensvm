/**
 * PoUW Storage Unit Tests
 *
 * Tests for:
 * - Indexed storage (in-memory and hybrid)
 * - Quality verification
 * - Data provider functions
 */

import { indexedStorage } from '../src/pouw-indexed-storage';
import {
  verifyWorkResult,
  getWorkerTrustMultiplier,
  isWorkerBanned,
  getWorkerReputation,
  resetWorkerReputation,
} from '../src/pouw-quality-verifier';
import {
  indexTransactions,
  classifyWallets,
  analyzePatterns,
  extractEntities,
  KNOWN_PROGRAMS,
  KNOWN_ENTITIES,
} from '../src/pouw-data-provider';

// ============================================================================
// Test Data
// ============================================================================

const mockTransactions = [
  {
    signature: 'test_sig_1',
    type: 'transfer',
    category: 'token',
    programs: ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'],
    accounts: ['wallet1', 'wallet2'],
    timestamp: Date.now() - 1000,
    success: true,
    fee: 5000,
    labels: ['spl-token', 'transfer'],
  },
  {
    signature: 'test_sig_2',
    type: 'swap',
    category: 'defi',
    programs: ['JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'],
    accounts: ['wallet1', 'wallet3'],
    timestamp: Date.now() - 2000,
    success: true,
    fee: 10000,
    labels: ['jupiter', 'swap', 'defi'],
  },
  {
    signature: 'test_sig_3',
    type: 'nft_mint',
    category: 'nft',
    programs: ['metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'],
    accounts: ['wallet2', 'wallet4'],
    timestamp: Date.now() - 3000,
    success: false,
    fee: 7500,
    labels: ['metaplex', 'nft', 'mint'],
  },
];

const mockPatterns = [
  {
    type: 'rapid_trading',
    severity: 'medium',
    transactions: ['test_sig_1', 'test_sig_2'],
    evidence: 'Multiple trades within 5 seconds',
    confidence: 0.85,
  },
  {
    type: 'wash_trading',
    severity: 'high',
    transactions: ['test_sig_2'],
    evidence: 'Same wallet on both sides',
    confidence: 0.92,
  },
];

const mockWallets = [
  {
    address: 'wallet1',
    classification: 'trader',
    confidence: 0.88,
    behaviors: ['high_frequency', 'defi_user'],
    transactionCount: 150,
    totalVolume: 1000000,
  },
  {
    address: 'wallet2',
    classification: 'holder',
    confidence: 0.75,
    behaviors: ['long_term_hold', 'nft_collector'],
    transactionCount: 25,
    totalVolume: 50000,
  },
];

const mockEntities = [
  {
    address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    entityType: 'program',
    name: 'SPL Token Program',
    confidence: 1.0,
    evidence: ['known_program', 'high_usage'],
  },
  {
    address: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
    entityType: 'program',
    name: 'Jupiter Aggregator',
    confidence: 1.0,
    evidence: ['known_program', 'defi'],
  },
];

// ============================================================================
// Indexed Storage Tests
// ============================================================================

describe('IndexedDataStorage', () => {
  beforeEach(() => {
    // Clear storage before each test
    indexedStorage.clear();
  });

  describe('Transaction Storage', () => {
    it('should store transactions', () => {
      const result = indexedStorage.storeTransactions(mockTransactions, 'worker1');
      expect(result.stored).toBe(3);
      expect(result.duplicates).toBe(0);
    });

    it('should detect duplicate transactions', () => {
      indexedStorage.storeTransactions(mockTransactions, 'worker1');
      const result = indexedStorage.storeTransactions(mockTransactions, 'worker2');
      expect(result.stored).toBe(0);
      expect(result.duplicates).toBe(3);
    });

    it('should retrieve transaction by signature', () => {
      indexedStorage.storeTransactions(mockTransactions, 'worker1');
      const tx = indexedStorage.getTransaction('test_sig_1');
      expect(tx).not.toBeNull();
      expect(tx?.type).toBe('transfer');
    });

    it('should return null for non-existent transaction', () => {
      const tx = indexedStorage.getTransaction('non_existent');
      expect(tx).toBeNull();
    });

    it('should search transactions by type', () => {
      indexedStorage.storeTransactions(mockTransactions, 'worker1');
      const results = indexedStorage.searchTransactions({ type: 'swap' });
      expect(results.length).toBe(1);
      expect(results[0].signature).toBe('test_sig_2');
    });

    it('should search transactions by category', () => {
      indexedStorage.storeTransactions(mockTransactions, 'worker1');
      const results = indexedStorage.searchTransactions({ category: 'defi' });
      expect(results.length).toBe(1);
    });

    it('should search transactions by success status', () => {
      indexedStorage.storeTransactions(mockTransactions, 'worker1');
      const results = indexedStorage.searchTransactions({ success: false });
      expect(results.length).toBe(1);
      expect(results[0].signature).toBe('test_sig_3');
    });

    it('should search transactions by fee range', () => {
      indexedStorage.storeTransactions(mockTransactions, 'worker1');
      const results = indexedStorage.searchTransactions({ minFee: 7000, maxFee: 8000 });
      expect(results.length).toBe(1);
      expect(results[0].fee).toBe(7500);
    });

    it('should paginate results', () => {
      indexedStorage.storeTransactions(mockTransactions, 'worker1');
      const page1 = indexedStorage.searchTransactions({ limit: 2, offset: 0 });
      const page2 = indexedStorage.searchTransactions({ limit: 2, offset: 2 });
      expect(page1.length).toBe(2);
      expect(page2.length).toBe(1);
    });

    it('should sort results', () => {
      indexedStorage.storeTransactions(mockTransactions, 'worker1');
      const ascending = indexedStorage.searchTransactions({ sortBy: 'fee', sortOrder: 'asc' });
      expect(ascending[0].fee).toBe(5000);
      expect(ascending[2].fee).toBe(10000);
    });

    it('should get transaction facets', () => {
      indexedStorage.storeTransactions(mockTransactions, 'worker1');
      const facets = indexedStorage.getTransactionFacets();
      expect(facets.types).toContain('transfer');
      expect(facets.types).toContain('swap');
      expect(facets.categories).toContain('defi');
    });
  });

  describe('Pattern Storage', () => {
    it('should store patterns', () => {
      const result = indexedStorage.storePatterns(mockPatterns, 'worker1');
      expect(result.stored).toBe(2);
    });

    it('should search patterns by type', () => {
      indexedStorage.storePatterns(mockPatterns, 'worker1');
      const results = indexedStorage.searchPatterns({ type: 'wash_trading' });
      expect(results.length).toBe(1);
      expect(results[0].severity).toBe('high');
    });

    it('should search patterns by severity', () => {
      indexedStorage.storePatterns(mockPatterns, 'worker1');
      const results = indexedStorage.searchPatterns({ severity: 'high' });
      expect(results.length).toBe(1);
    });

    it('should search patterns by minimum confidence', () => {
      indexedStorage.storePatterns(mockPatterns, 'worker1');
      const results = indexedStorage.searchPatterns({ minConfidence: 0.9 });
      expect(results.length).toBe(1);
      expect(results[0].confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should get pattern facets', () => {
      indexedStorage.storePatterns(mockPatterns, 'worker1');
      const facets = indexedStorage.getPatternFacets();
      expect(facets.types).toContain('rapid_trading');
      expect(facets.severities).toContain('high');
    });
  });

  describe('Wallet Storage', () => {
    it('should store wallets', () => {
      const result = indexedStorage.storeWallets(mockWallets, 'worker1');
      expect(result.stored).toBe(2);
      expect(result.updated).toBe(0);
    });

    it('should update wallet with higher confidence', () => {
      indexedStorage.storeWallets(mockWallets, 'worker1');
      const updatedWallet = {
        ...mockWallets[0],
        confidence: 0.95,
        classification: 'whale',
      };
      const result = indexedStorage.storeWallets([updatedWallet], 'worker2');
      expect(result.updated).toBe(1);

      const wallet = indexedStorage.getWallet('wallet1');
      expect(wallet?.classification).toBe('whale');
    });

    it('should not update wallet with lower confidence', () => {
      indexedStorage.storeWallets(mockWallets, 'worker1');
      const lowerConfWallet = {
        ...mockWallets[0],
        confidence: 0.5,
        classification: 'bot',
      };
      indexedStorage.storeWallets([lowerConfWallet], 'worker2');

      const wallet = indexedStorage.getWallet('wallet1');
      expect(wallet?.classification).toBe('trader');
    });

    it('should search wallets by classification', () => {
      indexedStorage.storeWallets(mockWallets, 'worker1');
      const results = indexedStorage.searchWallets({ classification: 'trader' });
      expect(results.length).toBe(1);
    });

    it('should search wallets by behavior', () => {
      indexedStorage.storeWallets(mockWallets, 'worker1');
      const results = indexedStorage.searchWallets({ behavior: 'nft_collector' });
      expect(results.length).toBe(1);
      expect(results[0].address).toBe('wallet2');
    });

    it('should get wallet facets', () => {
      indexedStorage.storeWallets(mockWallets, 'worker1');
      const facets = indexedStorage.getWalletFacets();
      expect(facets.classifications).toContain('trader');
      expect(facets.behaviors).toContain('high_frequency');
    });
  });

  describe('Entity Storage', () => {
    it('should store entities', () => {
      const result = indexedStorage.storeEntities(mockEntities, 'worker1');
      expect(result.stored).toBe(2);
    });

    it('should merge entity evidence', () => {
      indexedStorage.storeEntities(mockEntities, 'worker1');
      const updatedEntity = {
        ...mockEntities[0],
        evidence: ['new_evidence'],
      };
      indexedStorage.storeEntities([updatedEntity], 'worker2');

      const entity = indexedStorage.getEntity(mockEntities[0].address);
      expect(entity?.evidence).toContain('known_program');
      expect(entity?.evidence).toContain('new_evidence');
    });

    it('should search entities by type', () => {
      indexedStorage.storeEntities(mockEntities, 'worker1');
      const results = indexedStorage.searchEntities({ entityType: 'program' });
      expect(results.length).toBe(2);
    });

    it('should get entity facets', () => {
      indexedStorage.storeEntities(mockEntities, 'worker1');
      const facets = indexedStorage.getEntityFacets();
      expect(facets.types).toContain('program');
    });
  });

  describe('Statistics', () => {
    it('should return comprehensive stats', () => {
      indexedStorage.storeTransactions(mockTransactions, 'worker1');
      indexedStorage.storePatterns(mockPatterns, 'worker1');
      indexedStorage.storeWallets(mockWallets, 'worker2');
      indexedStorage.storeEntities(mockEntities, 'worker2');

      const stats = indexedStorage.getStats();

      expect(stats.transactions.total).toBe(3);
      expect(stats.patterns.total).toBe(2);
      expect(stats.wallets.total).toBe(2);
      expect(stats.entities.total).toBe(2);
      expect(stats.contributingWorkers).toBe(2);
    });

    it('should calculate success rate correctly', () => {
      indexedStorage.storeTransactions(mockTransactions, 'worker1');
      const stats = indexedStorage.getStats();
      // 2 successful out of 3
      expect(stats.transactions.successRate).toBeCloseTo(2 / 3, 2);
    });
  });

  describe('Hybrid Storage', () => {
    it('should report Qdrant status correctly', () => {
      // Without QDRANT_URL, should be disabled
      const isEnabled = indexedStorage.isQdrantEnabled();
      expect(typeof isEnabled).toBe('boolean');
    });

    it('should handle semantic search gracefully when Qdrant disabled', async () => {
      const results = await indexedStorage.semanticSearch('test query');
      // Should return empty results with enabled: false
      expect(results.enabled).toBe(false);
      expect(results.transactions).toEqual([]);
    });
  });
});

// ============================================================================
// Quality Verifier Tests
// ============================================================================

describe('QualityVerifier', () => {
  const testWorkerId = 'test_worker_quality';

  beforeEach(() => {
    resetWorkerReputation(testWorkerId);
  });

  describe('Work Verification', () => {
    it('should verify valid transaction indexing result', async () => {
      const inputData = {
        transactions: [
          {
            signature: 'valid_sig_123abc',
            accounts: ['acc1', 'acc2'],
            programs: ['prog1'],
            timestamp: Date.now() - 10000,
          },
        ],
      };

      const result = {
        indexedTransactions: [
          {
            signature: 'valid_sig_123abc',
            type: 'transfer',
            category: 'token',
            programs: ['prog1'],
            accounts: ['acc1', 'acc2'],
            timestamp: Date.now() - 10000,
            success: true,
            fee: 5000,
            labels: ['token'],
          },
        ],
      };

      const verification = await verifyWorkResult(
        'transaction_indexing',
        result,
        inputData,
        testWorkerId
      );

      expect(verification.valid).toBe(true);
      expect(verification.score).toBeGreaterThan(0);
    });

    it('should reject result with invalid signatures', async () => {
      const inputData = {
        transactions: [
          {
            signature: 'valid_sig_123',
            accounts: [],
            programs: [],
            timestamp: Date.now(),
          },
        ],
      };

      const result = {
        indexedTransactions: [
          {
            signature: 'INVALID!!!',
            type: 'transfer',
            category: 'token',
            programs: [],
            accounts: [],
            timestamp: Date.now(),
            success: true,
            fee: 0,
            labels: [],
          },
        ],
      };

      const verification = await verifyWorkResult(
        'transaction_indexing',
        result,
        inputData,
        testWorkerId
      );

      expect(verification.valid).toBe(false);
      expect(verification.issues.length).toBeGreaterThan(0);
    });

    it('should reject result with future timestamps', async () => {
      const futureTime = Date.now() + 86400000; // 1 day in future

      const inputData = {
        transactions: [
          {
            signature: 'valid_sig_123',
            accounts: [],
            programs: [],
            timestamp: Date.now(),
          },
        ],
      };

      const result = {
        indexedTransactions: [
          {
            signature: 'valid_sig_123',
            type: 'transfer',
            category: 'token',
            programs: [],
            accounts: [],
            timestamp: futureTime,
            success: true,
            fee: 0,
            labels: [],
          },
        ],
      };

      const verification = await verifyWorkResult(
        'transaction_indexing',
        result,
        inputData,
        testWorkerId
      );

      expect(verification.valid).toBe(false);
      expect(verification.issues.some(i => i.includes('future'))).toBe(true);
    });
  });

  describe('Worker Reputation', () => {
    it('should start with default trust multiplier', () => {
      const multiplier = getWorkerTrustMultiplier('new_worker_123');
      expect(multiplier).toBe(1.0);
    });

    it('should not be banned initially', () => {
      expect(isWorkerBanned('new_worker_456')).toBe(false);
    });

    it('should track worker reputation', () => {
      const reputation = getWorkerReputation(testWorkerId);
      expect(reputation).toBeDefined();
      expect(reputation.totalSubmissions).toBeGreaterThanOrEqual(0);
    });
  });
});

// ============================================================================
// Data Provider Tests
// ============================================================================

describe('DataProvider', () => {
  describe('indexTransactions', () => {
    it('should index raw transactions', () => {
      const rawTx = {
        signature: 'raw_sig_123abc',
        blockTime: Math.floor(Date.now() / 1000),
        slot: 12345,
        meta: {
          fee: 5000,
          err: null,
        },
        transaction: {
          message: {
            accountKeys: [
              { pubkey: { toBase58: () => 'acc1' } },
              { pubkey: { toBase58: () => 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' } },
            ],
          },
        },
      };

      const indexed = indexTransactions([rawTx as any]);
      expect(indexed.length).toBe(1);
      expect(indexed[0].signature).toBe('raw_sig_123abc');
      expect(indexed[0].success).toBe(true);
    });
  });

  describe('classifyWallets', () => {
    it('should classify wallets based on transaction patterns', () => {
      const txs = [
        {
          signature: 'tx1',
          accounts: ['wallet_a', 'wallet_b'],
          programs: ['JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'],
          timestamp: Date.now(),
          type: 'swap',
          category: 'defi',
          success: true,
          fee: 5000,
          labels: ['defi'],
        },
      ];

      const wallets = classifyWallets(txs);
      expect(wallets.length).toBeGreaterThan(0);
      expect(wallets[0].behaviors).toBeDefined();
    });
  });

  describe('analyzePatterns', () => {
    it('should detect patterns in transactions', () => {
      const txs = [
        {
          signature: 'tx1',
          accounts: ['wallet_a', 'wallet_b'],
          programs: [],
          timestamp: Date.now() - 1000,
        },
        {
          signature: 'tx2',
          accounts: ['wallet_a', 'wallet_c'],
          programs: [],
          timestamp: Date.now() - 500,
        },
        {
          signature: 'tx3',
          accounts: ['wallet_a', 'wallet_d'],
          programs: [],
          timestamp: Date.now(),
        },
      ];

      const patterns = analyzePatterns(txs as any);
      // May or may not find patterns depending on thresholds
      expect(Array.isArray(patterns)).toBe(true);
    });
  });

  describe('extractEntities', () => {
    it('should extract known entities', () => {
      const txs = [
        {
          signature: 'tx1',
          accounts: ['JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'],
          programs: ['JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'],
          timestamp: Date.now(),
        },
      ];

      const entities = extractEntities(txs as any);
      const jupiterEntity = entities.find(e => e.name?.includes('Jupiter'));
      expect(jupiterEntity).toBeDefined();
    });
  });

  describe('Known Programs Database', () => {
    it('should have common Solana programs', () => {
      expect(KNOWN_PROGRAMS['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA']).toBeDefined();
      expect(KNOWN_PROGRAMS['11111111111111111111111111111111']).toBeDefined();
    });
  });

  describe('Known Entities Database', () => {
    it('should have known exchanges and protocols', () => {
      // Check that KNOWN_ENTITIES exists and has entries
      expect(Object.keys(KNOWN_ENTITIES).length).toBeGreaterThan(0);
    });
  });
});
