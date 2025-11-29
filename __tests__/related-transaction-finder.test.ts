import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { 
  RelatedTransactionQuery,
  RelatedTransactionResult,
  RelatedTransaction,
  TransactionRelationship
} from '../lib/related-transaction-finder';
import type { DetailedTransactionInfo } from '../lib/solana';

// Create shared mock for transaction analysis cache
const mockTransactionAnalysisCache = {
  getCachedRelatedTransactions: jest.fn(() => Promise.resolve(null)),
  cacheRelatedTransactions: jest.fn(() => Promise.resolve())
};

// Mock the transaction analysis cache at the path used by the finder
jest.mock('../lib/caching/transaction-analysis-cache', () => ({
  transactionAnalysisCache: mockTransactionAnalysisCache
}));

// Also mock the re-export path used in the test
jest.mock('../lib/transaction-analysis-cache', () => ({
  transactionAnalysisCache: mockTransactionAnalysisCache
}));

// Import after mocking
const { RelatedTransactionFinder } = require('../lib/related-transaction-finder');

describe('RelatedTransactionFinder', () => {
  let finder: any;
  let mockSourceTransaction: DetailedTransactionInfo;
  let mockRelatedTransactions: DetailedTransactionInfo[];

  beforeEach(() => {
    jest.clearAllMocks();
    finder = new RelatedTransactionFinder();

    // Create mock source transaction
    mockSourceTransaction = {
      signature: 'source-signature-123',
      slot: 123456789,
      blockTime: Date.now(),
      success: true,
      details: {
        accounts: [
          { pubkey: 'account1', executable: false, owner: '11111111111111111111111111111111' },
          { pubkey: 'account2', executable: false, owner: '11111111111111111111111111111111' },
          { pubkey: 'token_account1', executable: false, owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' }
        ],
        instructions: [
          {
            program: 'System Program',
            programId: '11111111111111111111111111111111',
            instructionType: 'transfer'
          }
        ]
      },
      parsedInstructions: [
        {
          programId: '11111111111111111111111111111111',
          program: 'System Program',
          instructionType: 'transfer'
        }
      ]
    };

    // Create mock related transactions
    mockRelatedTransactions = [
      {
        signature: 'related-signature-1',
        slot: 123456790,
        blockTime: mockSourceTransaction.blockTime! + 60000, // 1 minute later
        success: true,
        details: {
          accounts: [
            { pubkey: 'account1', executable: false, owner: '11111111111111111111111111111111' }, // Shared account
            { pubkey: 'account3', executable: false, owner: '11111111111111111111111111111111' }
          ],
          instructions: [
            {
              program: 'System Program',
              programId: '11111111111111111111111111111111',
              instructionType: 'transfer'
            }
          ]
        },
        parsedInstructions: [
          {
            programId: '11111111111111111111111111111111',
            program: 'System Program',
            instructionType: 'transfer'
          }
        ]
      },
      {
        signature: 'related-signature-2',
        slot: 123456791,
        blockTime: mockSourceTransaction.blockTime! + 120000, // 2 minutes later
        success: true,
        details: {
          accounts: [
            { pubkey: 'account4', executable: false, owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
            { pubkey: 'account5', executable: false, owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' }
          ],
          instructions: [
            {
              program: 'SPL Token',
              programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
              instructionType: 'transfer'
            }
          ]
        },
        parsedInstructions: [
          {
            programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            program: 'SPL Token',
            instructionType: 'transfer'
          }
        ]
      }
    ];

    // Mock the search methods
    jest.spyOn(finder, 'searchTransactionsByAccounts').mockImplementation(async (accounts, blockTime, timeWindow) => {
      return mockRelatedTransactions.filter(tx => 
        tx.details?.accounts?.some(acc => accounts.includes(acc.pubkey))
      );
    });

    jest.spyOn(finder, 'searchTransactionsByPrograms').mockImplementation(async (programs, blockTime, timeWindow) => {
      return mockRelatedTransactions.filter(tx => 
        tx.parsedInstructions?.some(inst => programs.includes(inst.programId))
      );
    });

    jest.spyOn(finder, 'searchTransactionsByTimeWindow').mockImplementation(async (blockTime, timeWindow) => {
      return mockRelatedTransactions.filter(tx => 
        Math.abs((tx.blockTime || 0) - blockTime) <= timeWindow
      );
    });

    jest.spyOn(finder, 'searchTransactionsByTokens').mockImplementation(async (tokens, blockTime, timeWindow) => {
      return mockRelatedTransactions.filter(tx => 
        tx.details?.accounts?.some(acc => acc.owner === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
      );
    });

    jest.spyOn(finder, 'getTransaction').mockImplementation(async (signature) => {
      if (signature === mockSourceTransaction.signature) {
        return mockSourceTransaction;
      }
      return mockRelatedTransactions.find(tx => tx.signature === signature) || null;
    });
  });

  describe('findRelatedTransactions', () => {
    it('should find related transactions with basic query', async () => {
      const query: RelatedTransactionQuery = {
        signature: mockSourceTransaction.signature,
        maxResults: 10
      };

      const result = await finder.findRelatedTransactions(query);

      expect(result).toBeDefined();
      expect(result.sourceTransaction).toBe(mockSourceTransaction.signature);
      expect(result.relatedTransactions).toBeDefined();
      expect(Array.isArray(result.relatedTransactions)).toBe(true);
      expect(result.totalFound).toBeGreaterThanOrEqual(0);
      expect(result.searchTimeMs).toBeGreaterThan(0);
      expect(result.relationshipSummary).toBeDefined();
      expect(result.insights).toBeDefined();
    });

    it('should find account-based relationships', async () => {
      const query: RelatedTransactionQuery = {
        signature: mockSourceTransaction.signature,
        relationshipTypes: ['account_sequence']
      };

      const result = await finder.findRelatedTransactions(query);

      const accountRelated = result.relatedTransactions.filter(tx => 
        tx.relationship.type === 'account_sequence'
      );
      expect(accountRelated.length).toBeGreaterThan(0);
      expect(accountRelated[0].relationship.sharedElements.accounts).toContain('account1');
    });

    it('should find program-based relationships', async () => {
      const query: RelatedTransactionQuery = {
        signature: mockSourceTransaction.signature,
        relationshipTypes: ['program_pattern']
      };

      const result = await finder.findRelatedTransactions(query);

      const programRelated = result.relatedTransactions.filter(tx => 
        tx.relationship.type === 'program_pattern'
      );
      expect(programRelated.length).toBeGreaterThan(0);
      expect(programRelated[0].relationship.sharedElements.programs).toContain('11111111111111111111111111111111');
    });

    it('should find temporal relationships', async () => {
      const query: RelatedTransactionQuery = {
        signature: mockSourceTransaction.signature,
        relationshipTypes: ['temporal_cluster'],
        timeWindowHours: 1
      };

      const result = await finder.findRelatedTransactions(query);

      const temporalRelated = result.relatedTransactions.filter(tx => 
        tx.relationship.type === 'temporal_cluster'
      );
      expect(temporalRelated.length).toBeGreaterThan(0);
      expect(temporalRelated[0].relationship.sharedElements.timeWindow).toBeLessThan(3600); // Within 1 hour
    });

    it('should respect maxResults limit', async () => {
      const query: RelatedTransactionQuery = {
        signature: mockSourceTransaction.signature,
        maxResults: 1
      };

      const result = await finder.findRelatedTransactions(query);

      expect(result.relatedTransactions.length).toBeLessThanOrEqual(1);
    });

    it('should filter by minimum relevance score', async () => {
      const query: RelatedTransactionQuery = {
        signature: mockSourceTransaction.signature,
        minRelevanceScore: 0.8
      };

      const result = await finder.findRelatedTransactions(query);

      result.relatedTransactions.forEach(tx => {
        expect(tx.relevanceScore).toBeGreaterThanOrEqual(0.8);
      });
    });

    it('should sort results by relevance score', async () => {
      const query: RelatedTransactionQuery = {
        signature: mockSourceTransaction.signature
      };

      const result = await finder.findRelatedTransactions(query);

      for (let i = 1; i < result.relatedTransactions.length; i++) {
        expect(result.relatedTransactions[i].relevanceScore)
          .toBeLessThanOrEqual(result.relatedTransactions[i - 1].relevanceScore);
      }
    });

    it('should handle non-existent source transaction', async () => {
      const query: RelatedTransactionQuery = {
        signature: 'non-existent-signature'
      };

      await expect(finder.findRelatedTransactions(query)).rejects.toThrow('Transaction non-existent-signature not found');
    });

    it('should use cached results when available', async () => {
      const { transactionAnalysisCache } = require('../lib/transaction-analysis-cache');
      
      const cachedResult: RelatedTransactionResult = {
        sourceTransaction: mockSourceTransaction.signature,
        relatedTransactions: [],
        totalFound: 0,
        searchTimeMs: 100,
        relationshipSummary: {},
        insights: []
      };

      transactionAnalysisCache.getCachedRelatedTransactions.mockResolvedValueOnce(cachedResult);

      const query: RelatedTransactionQuery = {
        signature: mockSourceTransaction.signature
      };

      const result = await finder.findRelatedTransactions(query);

      expect(result).toEqual(cachedResult);
      expect(transactionAnalysisCache.getCachedRelatedTransactions).toHaveBeenCalledWith(
        mockSourceTransaction.signature,
        query
      );
    });

    it('should cache new results', async () => {
      const query: RelatedTransactionQuery = {
        signature: mockSourceTransaction.signature
      };

      const result = await finder.findRelatedTransactions(query);

      const { transactionAnalysisCache } = require('../lib/transaction-analysis-cache');
      expect(transactionAnalysisCache.cacheRelatedTransactions).toHaveBeenCalledWith(
        mockSourceTransaction.signature,
        result,
        query
      );
    });
  });

  describe('relationship analysis', () => {
    it('should analyze account relationships correctly', () => {
      const sharedAccounts = ['account1'];
      const relationship = finder.analyzeAccountRelationship(
        mockSourceTransaction,
        mockRelatedTransactions[0],
        sharedAccounts
      );

      expect(relationship.type).toBe('account_sequence');
      expect(relationship.strength).toBeOneOf(['weak', 'medium', 'strong']);
      expect(relationship.description).toContain('Shares 1 account');
      expect(relationship.sharedElements.accounts).toEqual(sharedAccounts);
      expect(relationship.confidence).toBeGreaterThan(0);
      expect(relationship.confidence).toBeLessThanOrEqual(1);
    });

    it('should analyze program relationships correctly', () => {
      const sharedPrograms = ['11111111111111111111111111111111'];
      const relationship = finder.analyzeProgramRelationship(
        mockSourceTransaction,
        mockRelatedTransactions[0],
        sharedPrograms
      );

      expect(relationship.type).toBe('program_pattern');
      expect(relationship.strength).toBeOneOf(['weak', 'medium', 'strong']);
      expect(relationship.description).toContain('Uses 1 of the same program');
      expect(relationship.sharedElements.programs).toEqual(sharedPrograms);
      expect(relationship.confidence).toBeGreaterThan(0);
    });

    it('should analyze temporal relationships correctly', () => {
      const relationship = finder.analyzeTemporalRelationship(
        mockSourceTransaction,
        mockRelatedTransactions[0]
      );

      expect(relationship.type).toBe('temporal_cluster');
      expect(relationship.strength).toBeOneOf(['weak', 'medium', 'strong']);
      expect(relationship.description).toContain('Occurred');
      expect(relationship.sharedElements.timeWindow).toBeDefined();
      expect(relationship.confidence).toBeGreaterThan(0);
    });

    it('should calculate relationship strength based on shared elements', () => {
      const manySharedAccounts = ['account1', 'account2', 'account3'];
      const strongRelationship = finder.analyzeAccountRelationship(
        mockSourceTransaction,
        {
          ...mockRelatedTransactions[0],
          details: {
            ...mockRelatedTransactions[0].details!,
            accounts: manySharedAccounts.map(pubkey => ({ pubkey, executable: false, owner: '11111111111111111111111111111111' }))
          }
        },
        manySharedAccounts
      );

      expect(strongRelationship.strength).toBe('strong');
      expect(strongRelationship.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('token flow analysis', () => {
    it('should detect token flow relationships', () => {
      const sourceTokens = [
        {
          mint: 'token_mint_1',
          symbol: 'TEST',
          amount: '1000',
          from: 'account1',
          to: 'account2'
        }
      ];

      const candidateTokens = [
        {
          mint: 'token_mint_1',
          symbol: 'TEST',
          amount: '1000',
          from: 'account2',
          to: 'account3'
        }
      ];

      const relationship = finder.analyzeTokenFlowRelationship(
        mockSourceTransaction,
        mockRelatedTransactions[0],
        sourceTokens,
        candidateTokens
      );

      expect(relationship.type).toBe('token_flow');
      expect(relationship.strength).toBe('strong'); // Direct flow connection
      expect(relationship.description).toContain('Direct token flow connection');
      expect(relationship.sharedElements.tokens).toContain('token_mint_1');
    });

    it('should find token flow connections', () => {
      const sourceTokens = [
        { mint: 'token1', symbol: 'T1', amount: '100', from: 'acc1', to: 'acc2' }
      ];

      const candidateTokens = [
        { mint: 'token1', symbol: 'T1', amount: '100', from: 'acc2', to: 'acc3' }
      ];

      const connections = finder.findTokenFlowConnections(sourceTokens, candidateTokens);

      expect(connections).toContain('token1');
    });

    it('should find shared tokens without direct flow', () => {
      const sourceTokens = [
        { mint: 'token1', symbol: 'T1', amount: '100', from: 'acc1', to: 'acc2' }
      ];

      const candidateTokens = [
        { mint: 'token1', symbol: 'T1', amount: '50', from: 'acc3', to: 'acc4' }
      ];

      const sharedTokens = finder.findSharedTokens(sourceTokens, candidateTokens);

      expect(sharedTokens).toContain('token1');
    });
  });

  describe('DeFi protocol analysis', () => {
    it('should detect DeFi protocol relationships', () => {
      const defiPrograms = ['JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB']; // Jupiter
      const relationship = finder.analyzeDeFiProtocolRelationship(
        mockSourceTransaction,
        mockRelatedTransactions[0],
        defiPrograms
      );

      expect(relationship.type).toBe('defi_protocol');
      expect(relationship.strength).toBeOneOf(['medium', 'strong']);
      expect(relationship.description).toContain('DeFi protocol');
      expect(relationship.sharedElements.programs).toEqual(defiPrograms);
    });

    it('should handle multiple DeFi protocols', () => {
      const multipleDefiPrograms = [
        'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB', // Jupiter
        '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'  // Raydium
      ];

      const relationship = finder.analyzeDeFiProtocolRelationship(
        mockSourceTransaction,
        mockRelatedTransactions[0],
        multipleDefiPrograms
      );

      expect(relationship.strength).toBe('strong');
      expect(relationship.confidence).toBeGreaterThan(0.6);
    });
  });

  describe('transaction sequence analysis', () => {
    it('should detect multi-step transaction sequences', () => {
      const allCandidates = [mockSourceTransaction, ...mockRelatedTransactions];
      const relationship = finder.analyzeSequenceRelationship(
        mockSourceTransaction,
        mockRelatedTransactions[0],
        allCandidates
      );

      expect(relationship.type).toBe('multi_step');
      expect(relationship.strength).toBeOneOf(['weak', 'medium', 'strong']);
      expect(relationship.description).toContain('multi-step');
    });

    it('should identify sequential transactions', () => {
      const sequentialTransactions = [
        mockSourceTransaction,
        {
          ...mockRelatedTransactions[0],
          blockTime: mockSourceTransaction.blockTime! + 30000 // 30 seconds later
        }
      ];

      const relationship = finder.analyzeSequenceRelationship(
        mockSourceTransaction,
        sequentialTransactions[1],
        sequentialTransactions
      );

      expect(relationship.strength).toBe('strong');
      expect(relationship.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('insight generation', () => {
    it('should generate transaction insights', () => {
      const relatedTransactions: RelatedTransaction[] = [
        {
          signature: 'related-1',
          slot: 123456790,
          blockTime: Date.now(),
          relationship: {
            type: 'defi_protocol',
            strength: 'strong',
            description: 'DeFi interaction',
            sharedElements: { accounts: [], programs: ['JUP'], tokens: [], instructionTypes: [], timeWindow: 60 },
            confidence: 0.8
          },
          relevanceScore: 0.8,
          summary: 'DeFi transaction',
          accounts: [],
          programs: ['JUP']
        },
        {
          signature: 'related-2',
          slot: 123456791,
          blockTime: Date.now(),
          relationship: {
            type: 'defi_protocol',
            strength: 'strong',
            description: 'DeFi interaction',
            sharedElements: { accounts: [], programs: ['JUP'], tokens: [], instructionTypes: [], timeWindow: 120 },
            confidence: 0.8
          },
          relevanceScore: 0.8,
          summary: 'DeFi transaction',
          accounts: [],
          programs: ['JUP']
        },
        {
          signature: 'related-3',
          slot: 123456792,
          blockTime: Date.now(),
          relationship: {
            type: 'defi_protocol',
            strength: 'strong',
            description: 'DeFi interaction',
            sharedElements: { accounts: [], programs: ['JUP'], tokens: [], instructionTypes: [], timeWindow: 180 },
            confidence: 0.8
          },
          relevanceScore: 0.8,
          summary: 'DeFi transaction',
          accounts: [],
          programs: ['JUP']
        }
      ];

      const insights = finder.generateTransactionInsights(mockSourceTransaction, relatedTransactions);

      expect(insights).toBeDefined();
      expect(Array.isArray(insights)).toBe(true);
      
      const defiInsight = insights.find((insight: any) => insight.title === 'DeFi Protocol Activity');
      expect(defiInsight).toBeDefined();
      expect(defiInsight.type).toBe('pattern');
      expect(defiInsight.severity).toBe('medium');
    });

    it('should detect multi-step operation patterns', () => {
      const multiStepTransactions: RelatedTransaction[] = [
        {
          signature: 'step-1',
          slot: 123456790,
          blockTime: Date.now(),
          relationship: {
            type: 'multi_step',
            strength: 'strong',
            description: 'Multi-step operation',
            sharedElements: { accounts: ['acc1'], programs: [], tokens: [], instructionTypes: [], timeWindow: 60 },
            confidence: 0.8
          },
          relevanceScore: 0.8,
          summary: 'Step 1',
          accounts: ['acc1'],
          programs: []
        },
        {
          signature: 'step-2',
          slot: 123456791,
          blockTime: Date.now(),
          relationship: {
            type: 'multi_step',
            strength: 'strong',
            description: 'Multi-step operation',
            sharedElements: { accounts: ['acc1'], programs: [], tokens: [], instructionTypes: [], timeWindow: 120 },
            confidence: 0.8
          },
          relevanceScore: 0.8,
          summary: 'Step 2',
          accounts: ['acc1'],
          programs: []
        }
      ];

      const insights = finder.generateTransactionInsights(mockSourceTransaction, multiStepTransactions);

      const multiStepInsight = insights.find((insight: any) => insight.title === 'Multi-Step Operation');
      expect(multiStepInsight).toBeDefined();
      expect(multiStepInsight.type).toBe('pattern');
      expect(multiStepInsight.severity).toBe('low');
    });
  });

  describe('utility functions', () => {
    it('should extract accounts from transactions correctly', () => {
      const accounts = finder.extractAccounts(mockSourceTransaction);

      expect(accounts).toContain('account1');
      expect(accounts).toContain('account2');
      expect(accounts).toContain('token_account1');
    });

    it('should extract programs from transactions correctly', () => {
      const programs = finder.extractPrograms(mockSourceTransaction);

      expect(programs).toContain('11111111111111111111111111111111');
    });

    it('should generate transaction summaries', () => {
      const summary = finder.generateTransactionSummary(mockSourceTransaction);

      expect(summary).toContain('instruction');
      expect(summary).toContain('System Program');
    });

    it('should find shared accounts correctly', () => {
      const accounts1 = ['account1', 'account2', 'account3'];
      const accounts2 = ['account2', 'account3', 'account4'];
      
      const shared = finder.findSharedAccounts(accounts1, accounts2);

      expect(shared).toEqual(['account2', 'account3']);
    });

    it('should find shared programs correctly', () => {
      const programs1 = ['program1', 'program2'];
      const programs2 = ['program2', 'program3'];
      
      const shared = finder.findSharedPrograms(programs1, programs2);

      expect(shared).toEqual(['program2']);
    });

    it('should format time distances correctly', () => {
      const timeDistance = 60000; // 1 minute in milliseconds
      const formatted = finder.formatTimeDistance(timeDistance);

      expect(formatted).toContain('minute');
    });
  });

  describe('performance and edge cases', () => {
    it('should handle large numbers of related transactions efficiently', async () => {
      // Mock many related transactions
      const manyRelatedTransactions = Array.from({ length: 100 }, (_, i) => ({
        ...mockRelatedTransactions[0],
        signature: `related-${i}`,
        slot: 123456790 + i
      }));

      jest.spyOn(finder, 'searchTransactionsByAccounts').mockResolvedValueOnce(manyRelatedTransactions);

      const query: RelatedTransactionQuery = {
        signature: mockSourceTransaction.signature,
        maxResults: 50
      };

      const startTime = Date.now();
      const result = await finder.findRelatedTransactions(query);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.relatedTransactions.length).toBeLessThanOrEqual(50);
    });

    it('should handle transactions with no relationships', async () => {
      jest.spyOn(finder, 'searchTransactionsByAccounts').mockResolvedValueOnce([]);
      jest.spyOn(finder, 'searchTransactionsByPrograms').mockResolvedValueOnce([]);
      jest.spyOn(finder, 'searchTransactionsByTimeWindow').mockResolvedValueOnce([]);

      const query: RelatedTransactionQuery = {
        signature: mockSourceTransaction.signature
      };

      const result = await finder.findRelatedTransactions(query);

      expect(result.relatedTransactions).toHaveLength(0);
      expect(result.totalFound).toBe(0);
      expect(result.insights).toHaveLength(0);
    });

    it('should handle malformed transaction data gracefully', async () => {
      const malformedTransaction = {
        ...mockSourceTransaction,
        details: null,
        parsedInstructions: undefined
      } as any;

      jest.spyOn(finder, 'getTransaction').mockResolvedValueOnce(malformedTransaction);

      const query: RelatedTransactionQuery = {
        signature: mockSourceTransaction.signature
      };

      const result = await finder.findRelatedTransactions(query);

      expect(result).toBeDefined();
      expect(result.relatedTransactions).toBeDefined();
    });

    it('should handle search method failures gracefully', async () => {
      jest.spyOn(finder, 'searchTransactionsByAccounts').mockRejectedValueOnce(new Error('Search failed'));
      jest.spyOn(finder, 'searchTransactionsByPrograms').mockResolvedValueOnce([]);
      jest.spyOn(finder, 'searchTransactionsByTimeWindow').mockResolvedValueOnce([]);

      const query: RelatedTransactionQuery = {
        signature: mockSourceTransaction.signature
      };

      const result = await finder.findRelatedTransactions(query);

      expect(result).toBeDefined();
      // Should still work with other search methods
    });
  });

  describe('relationship summary', () => {
    it('should create relationship summary correctly', () => {
      const relatedTransactions: RelatedTransaction[] = [
        {
          signature: 'related-1',
          slot: 123456790,
          blockTime: Date.now(),
          relationship: { type: 'account_sequence', strength: 'strong', description: '', sharedElements: { accounts: [], programs: [], tokens: [], instructionTypes: [], timeWindow: 0 }, confidence: 0.8 },
          relevanceScore: 0.8,
          summary: '',
          accounts: [],
          programs: []
        },
        {
          signature: 'related-2',
          slot: 123456791,
          blockTime: Date.now(),
          relationship: { type: 'program_pattern', strength: 'medium', description: '', sharedElements: { accounts: [], programs: [], tokens: [], instructionTypes: [], timeWindow: 0 }, confidence: 0.6 },
          relevanceScore: 0.6,
          summary: '',
          accounts: [],
          programs: []
        },
        {
          signature: 'related-3',
          slot: 123456792,
          blockTime: Date.now(),
          relationship: { type: 'account_sequence', strength: 'weak', description: '', sharedElements: { accounts: [], programs: [], tokens: [], instructionTypes: [], timeWindow: 0 }, confidence: 0.4 },
          relevanceScore: 0.4,
          summary: '',
          accounts: [],
          programs: []
        }
      ];

      const summary = finder.createRelationshipSummary(relatedTransactions);

      expect(summary.account_sequence).toBe(2);
      expect(summary.program_pattern).toBe(1);
    });
  });
});