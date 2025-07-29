import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { 
  RelatedTransactionQuery,
  RelatedTransaction,
  TransactionRelationship
} from '../../lib/related-transaction-finder';
import type { DetailedTransactionInfo } from '../../lib/solana';

// Mock dependencies
jest.mock('@qdrant/js-client-rest', () => ({
  QdrantClient: jest.fn().mockImplementation(() => ({
    createCollection: jest.fn().mockResolvedValue({}),
    getCollection: jest.fn().mockResolvedValue({ status: 'green' }),
    upsert: jest.fn().mockResolvedValue({}),
    search: jest.fn().mockResolvedValue({ points: [] })
  }))
}));

describe('Related Transaction Discovery Integration Tests', () => {
  let mockSourceTransaction: DetailedTransactionInfo;
  let mockTransactionDatabase: DetailedTransactionInfo[];

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a realistic source transaction
    mockSourceTransaction = {
      signature: 'source_tx_abc123',
      slot: 150000000,
      blockTime: 1640995200000, // Jan 1, 2022
      success: true,
      details: {
        accounts: [
          { pubkey: 'wallet_alice', executable: false, owner: '11111111111111111111111111111111' },
          { pubkey: 'wallet_bob', executable: false, owner: '11111111111111111111111111111111' },
          { pubkey: 'token_account_alice', executable: false, owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
          { pubkey: 'usdc_mint', executable: false, owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' }
        ],
        instructions: [
          {
            program: 'System Program',
            programId: '11111111111111111111111111111111',
            instructionType: 'transfer',
            accounts: ['wallet_alice', 'wallet_bob'],
            data: '00000002'
          }
        ],
        preBalances: [5000000000, 2000000000, 2039280, 0],
        postBalances: [4000000000, 2995000000, 2039280, 0]
      },
      parsedInstructions: [
        {
          programId: '11111111111111111111111111111111',
          program: 'System Program',
          instructionType: 'transfer'
        }
      ]
    };

    // Create a realistic transaction database with various relationship types
    mockTransactionDatabase = [
      // Account-based relationship (same accounts used)
      {
        signature: 'related_account_tx1',
        slot: 150000001,
        blockTime: 1640995260000, // 1 minute later
        success: true,
        details: {
          accounts: [
            { pubkey: 'wallet_alice', executable: false, owner: '11111111111111111111111111111111' }, // Shared
            { pubkey: 'wallet_charlie', executable: false, owner: '11111111111111111111111111111111' }
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

      // Program-based relationship (same program, different accounts)
      {
        signature: 'related_program_tx1',
        slot: 150000002,
        blockTime: 1640995320000, // 2 minutes later
        success: true,
        details: {
          accounts: [
            { pubkey: 'wallet_dave', executable: false, owner: '11111111111111111111111111111111' },
            { pubkey: 'wallet_eve', executable: false, owner: '11111111111111111111111111111111' }
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

      // Token flow relationship (token transfer chain)
      {
        signature: 'related_token_flow_tx1',
        slot: 150000003,
        blockTime: 1640995380000, // 3 minutes later
        success: true,
        details: {
          accounts: [
            { pubkey: 'wallet_bob', executable: false, owner: '11111111111111111111111111111111' }, // Received SOL, now using it
            { pubkey: 'token_account_bob', executable: false, owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
            { pubkey: 'token_account_frank', executable: false, owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' }
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
      },

      // DeFi protocol relationship
      {
        signature: 'related_defi_tx1',
        slot: 150000004,
        blockTime: 1640995440000, // 4 minutes later
        success: true,
        details: {
          accounts: [
            { pubkey: 'wallet_alice', executable: false, owner: '11111111111111111111111111111111' }, // Same user
            { pubkey: 'jupiter_program_account', executable: false, owner: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4' }
          ],
          instructions: [
            {
              program: 'Jupiter',
              programId: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
              instructionType: 'swap'
            }
          ]
        },
        parsedInstructions: [
          {
            programId: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
            program: 'Jupiter',
            instructionType: 'swap'
          }
        ]
      },

      // Temporal cluster (close in time, different accounts/programs)
      {
        signature: 'related_temporal_tx1',
        slot: 150000005,
        blockTime: 1640995230000, // 30 seconds later
        success: true,
        details: {
          accounts: [
            { pubkey: 'wallet_george', executable: false, owner: '11111111111111111111111111111111' },
            { pubkey: 'wallet_helen', executable: false, owner: '11111111111111111111111111111111' }
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
      },

      // Multi-step sequence (part of a larger operation)
      {
        signature: 'related_sequence_tx1',
        slot: 150000006,
        blockTime: 1640995210000, // 10 seconds later
        success: true,
        details: {
          accounts: [
            { pubkey: 'wallet_alice', executable: false, owner: '11111111111111111111111111111111' }, // Same user
            { pubkey: 'associated_token_program', executable: true, owner: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL' }
          ],
          instructions: [
            {
              program: 'Associated Token Account',
              programId: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
              instructionType: 'create'
            }
          ]
        },
        parsedInstructions: [
          {
            programId: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
            program: 'Associated Token Account',
            instructionType: 'create'
          }
        ]
      },

      // Unrelated transaction (should not be found)
      {
        signature: 'unrelated_tx1',
        slot: 160000000, // Much later
        blockTime: 1641081600000, // Next day
        success: true,
        details: {
          accounts: [
            { pubkey: 'wallet_unrelated1', executable: false, owner: '11111111111111111111111111111111' },
            { pubkey: 'wallet_unrelated2', executable: false, owner: '11111111111111111111111111111111' }
          ],
          instructions: [
            {
              program: 'Vote Program',
              programId: 'Vote111111111111111111111111111111111111111',
              instructionType: 'vote'
            }
          ]
        },
        parsedInstructions: [
          {
            programId: 'Vote111111111111111111111111111111111111111',
            program: 'Vote Program',
            instructionType: 'vote'
          }
        ]
      }
    ];
  });

  describe('Relationship Discovery Accuracy', () => {
    it('should accurately identify account-based relationships', async () => {
      const { RelatedTransactionFinder } = require('../../lib/related-transaction-finder');

      const finder = new RelatedTransactionFinder();

      // Mock search methods to return relevant transactions
      jest.spyOn(finder, 'getTransaction').mockImplementation(async (signature) => {
        if (signature === mockSourceTransaction.signature) {
          return mockSourceTransaction;
        }
        return mockTransactionDatabase.find(tx => tx.signature === signature) || null;
      });

      jest.spyOn(finder, 'searchTransactionsByAccounts').mockImplementation(async (accounts, blockTime, timeWindow) => {
        return mockTransactionDatabase.filter(tx => 
          tx.details?.accounts?.some(acc => accounts.includes(acc.pubkey)) &&
          Math.abs((tx.blockTime || 0) - blockTime) <= timeWindow
        );
      });

      const result = await finder.findRelatedTransactions({
        signature: mockSourceTransaction.signature,
        relationshipTypes: ['account_sequence'],
        timeWindowHours: 24
      });

      expect(result.relatedTransactions.length).toBeGreaterThan(0);

      const accountRelated = result.relatedTransactions.filter(tx => 
        tx.relationship.type === 'account_sequence'
      );

      expect(accountRelated.length).toBeGreaterThan(0);

      // Verify the relationship is correctly identified
      const aliceRelated = accountRelated.find(tx => 
        tx.relationship.sharedElements.accounts.includes('wallet_alice')
      );
      expect(aliceRelated).toBeDefined();
      expect(aliceRelated?.signature).toBe('related_account_tx1');
      expect(aliceRelated?.relationship.strength).toBeOneOf(['weak', 'medium', 'strong']);
    });

    it('should accurately identify program-based relationships', async () => {
      const { RelatedTransactionFinder } = require('../../lib/related-transaction-finder');

      const finder = new RelatedTransactionFinder();

      jest.spyOn(finder, 'getTransaction').mockResolvedValue(mockSourceTransaction);
      jest.spyOn(finder, 'searchTransactionsByPrograms').mockImplementation(async (programs, blockTime, timeWindow) => {
        return mockTransactionDatabase.filter(tx => 
          tx.parsedInstructions?.some(inst => programs.includes(inst.programId)) &&
          Math.abs((tx.blockTime || 0) - blockTime) <= timeWindow
        );
      });

      const result = await finder.findRelatedTransactions({
        signature: mockSourceTransaction.signature,
        relationshipTypes: ['program_pattern'],
        timeWindowHours: 24
      });

      const programRelated = result.relatedTransactions.filter(tx => 
        tx.relationship.type === 'program_pattern'
      );

      expect(programRelated.length).toBeGreaterThan(0);

      // Verify System Program relationship
      const systemProgramRelated = programRelated.find(tx => 
        tx.relationship.sharedElements.programs.includes('11111111111111111111111111111111')
      );
      expect(systemProgramRelated).toBeDefined();
      expect(systemProgramRelated?.signature).toBe('related_program_tx1');
    });

    it('should accurately identify token flow relationships', async () => {
      const { RelatedTransactionFinder } = require('../../lib/related-transaction-finder');

      const finder = new RelatedTransactionFinder();

      jest.spyOn(finder, 'getTransaction').mockResolvedValue(mockSourceTransaction);
      jest.spyOn(finder, 'searchTransactionsByTokens').mockImplementation(async (tokens, blockTime, timeWindow) => {
        return mockTransactionDatabase.filter(tx => 
          tx.details?.accounts?.some(acc => acc.owner === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') &&
          Math.abs((tx.blockTime || 0) - blockTime) <= timeWindow
        );
      });

      // Mock token transfer extraction
      jest.spyOn(finder, 'extractTokenTransfers').mockImplementation((transaction) => {
        if (transaction.signature === mockSourceTransaction.signature) {
          return [
            {
              mint: 'usdc_mint',
              symbol: 'USDC',
              amount: '1000',
              from: 'wallet_alice',
              to: 'wallet_bob'
            }
          ];
        }
        if (transaction.signature === 'related_token_flow_tx1') {
          return [
            {
              mint: 'usdc_mint',
              symbol: 'USDC',
              amount: '500',
              from: 'wallet_bob',
              to: 'wallet_frank'
            }
          ];
        }
        return [];
      });

      const result = await finder.findRelatedTransactions({
        signature: mockSourceTransaction.signature,
        relationshipTypes: ['token_flow'],
        includeTokenFlows: true,
        timeWindowHours: 24
      });

      const tokenFlowRelated = result.relatedTransactions.filter(tx => 
        tx.relationship.type === 'token_flow'
      );

      expect(tokenFlowRelated.length).toBeGreaterThan(0);

      // Verify token flow connection
      const usdcFlowRelated = tokenFlowRelated.find(tx => 
        tx.relationship.sharedElements.tokens.includes('usdc_mint')
      );
      expect(usdcFlowRelated).toBeDefined();
      expect(usdcFlowRelated?.signature).toBe('related_token_flow_tx1');
    });

    it('should accurately identify DeFi protocol relationships', async () => {
      const { RelatedTransactionFinder } = require('../../lib/related-transaction-finder');

      const finder = new RelatedTransactionFinder();

      jest.spyOn(finder, 'getTransaction').mockResolvedValue(mockSourceTransaction);
      jest.spyOn(finder, 'searchTransactionsByPrograms').mockImplementation(async (programs, blockTime, timeWindow) => {
        const defiPrograms = [
          'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter
          '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', // Raydium
          'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc'  // Whirlpool
        ];
        
        return mockTransactionDatabase.filter(tx => 
          tx.parsedInstructions?.some(inst => 
            defiPrograms.includes(inst.programId) && programs.some(p => defiPrograms.includes(p))
          ) &&
          Math.abs((tx.blockTime || 0) - blockTime) <= timeWindow
        );
      });

      const result = await finder.findRelatedTransactions({
        signature: mockSourceTransaction.signature,
        relationshipTypes: ['defi_protocol'],
        includeDeFiPatterns: true,
        timeWindowHours: 24
      });

      const defiRelated = result.relatedTransactions.filter(tx => 
        tx.relationship.type === 'defi_protocol'
      );

      expect(defiRelated.length).toBeGreaterThan(0);

      // Verify DeFi relationship
      const jupiterRelated = defiRelated.find(tx => 
        tx.signature === 'related_defi_tx1'
      );
      expect(jupiterRelated).toBeDefined();
      expect(jupiterRelated?.relationship.sharedElements.programs).toContain('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4');
    });

    it('should accurately identify temporal clusters', async () => {
      const { RelatedTransactionFinder } = require('../../lib/related-transaction-finder');

      const finder = new RelatedTransactionFinder();

      jest.spyOn(finder, 'getTransaction').mockResolvedValue(mockSourceTransaction);
      jest.spyOn(finder, 'searchTransactionsByTimeWindow').mockImplementation(async (blockTime, timeWindow) => {
        return mockTransactionDatabase.filter(tx => 
          Math.abs((tx.blockTime || 0) - blockTime) <= timeWindow
        );
      });

      const result = await finder.findRelatedTransactions({
        signature: mockSourceTransaction.signature,
        relationshipTypes: ['temporal_cluster'],
        timeWindowHours: 1 // 1 hour window
      });

      const temporalRelated = result.relatedTransactions.filter(tx => 
        tx.relationship.type === 'temporal_cluster'
      );

      expect(temporalRelated.length).toBeGreaterThan(0);

      // Verify temporal relationship
      const closeInTime = temporalRelated.find(tx => 
        tx.signature === 'related_temporal_tx1'
      );
      expect(closeInTime).toBeDefined();
      expect(closeInTime?.relationship.sharedElements.timeWindow).toBeLessThan(3600); // Within 1 hour
    });

    it('should accurately identify multi-step sequences', async () => {
      const { RelatedTransactionFinder } = require('../../lib/related-transaction-finder');

      const finder = new RelatedTransactionFinder();

      jest.spyOn(finder, 'getTransaction').mockResolvedValue(mockSourceTransaction);
      jest.spyOn(finder, 'searchTransactionsByAccounts').mockImplementation(async (accounts, blockTime, timeWindow) => {
        return mockTransactionDatabase.filter(tx => 
          tx.details?.accounts?.some(acc => accounts.includes(acc.pubkey)) &&
          Math.abs((tx.blockTime || 0) - blockTime) <= timeWindow
        );
      });

      const result = await finder.findRelatedTransactions({
        signature: mockSourceTransaction.signature,
        relationshipTypes: ['multi_step'],
        timeWindowHours: 1
      });

      const sequenceRelated = result.relatedTransactions.filter(tx => 
        tx.relationship.type === 'multi_step'
      );

      expect(sequenceRelated.length).toBeGreaterThan(0);

      // Verify sequence relationship
      const sequenceStep = sequenceRelated.find(tx => 
        tx.signature === 'related_sequence_tx1'
      );
      expect(sequenceStep).toBeDefined();
      expect(sequenceStep?.relationship.sharedElements.accounts).toContain('wallet_alice');
    });
  });

  describe('Relationship Strength and Ranking', () => {
    it('should correctly rank relationships by strength and relevance', async () => {
      const { RelatedTransactionFinder } = require('../../lib/related-transaction-finder');

      const finder = new RelatedTransactionFinder();

      // Mock all search methods to return all related transactions
      jest.spyOn(finder, 'getTransaction').mockResolvedValue(mockSourceTransaction);
      jest.spyOn(finder, 'searchTransactionsByAccounts').mockResolvedValue(
        mockTransactionDatabase.filter(tx => 
          tx.details?.accounts?.some(acc => 
            mockSourceTransaction.details?.accounts?.some(sourceAcc => sourceAcc.pubkey === acc.pubkey)
          )
        )
      );
      jest.spyOn(finder, 'searchTransactionsByPrograms').mockResolvedValue(
        mockTransactionDatabase.filter(tx => 
          tx.parsedInstructions?.some(inst => 
            mockSourceTransaction.parsedInstructions?.some(sourceInst => sourceInst.programId === inst.programId)
          )
        )
      );
      jest.spyOn(finder, 'searchTransactionsByTimeWindow').mockResolvedValue(mockTransactionDatabase);

      const result = await finder.findRelatedTransactions({
        signature: mockSourceTransaction.signature,
        maxResults: 10
      });

      expect(result.relatedTransactions.length).toBeGreaterThan(0);

      // Verify transactions are sorted by relevance score (descending)
      for (let i = 1; i < result.relatedTransactions.length; i++) {
        expect(result.relatedTransactions[i].relevanceScore)
          .toBeLessThanOrEqual(result.relatedTransactions[i - 1].relevanceScore);
      }

      // Verify relationship strength assessment
      result.relatedTransactions.forEach(tx => {
        expect(tx.relationship.strength).toBeOneOf(['weak', 'medium', 'strong']);
        expect(tx.relationship.confidence).toBeGreaterThan(0);
        expect(tx.relationship.confidence).toBeLessThanOrEqual(1);
        expect(tx.relevanceScore).toBeGreaterThan(0);
        expect(tx.relevanceScore).toBeLessThanOrEqual(1);
      });

      // Account-based relationships should generally have higher relevance
      const accountRelated = result.relatedTransactions.filter(tx => 
        tx.relationship.type === 'account_sequence'
      );
      const programRelated = result.relatedTransactions.filter(tx => 
        tx.relationship.type === 'program_pattern'
      );

      if (accountRelated.length > 0 && programRelated.length > 0) {
        expect(accountRelated[0].relevanceScore).toBeGreaterThan(programRelated[0].relevanceScore);
      }
    });

    it('should filter out low-relevance relationships', async () => {
      const { RelatedTransactionFinder } = require('../../lib/related-transaction-finder');

      const finder = new RelatedTransactionFinder();

      jest.spyOn(finder, 'getTransaction').mockResolvedValue(mockSourceTransaction);
      jest.spyOn(finder, 'searchTransactionsByTimeWindow').mockResolvedValue(mockTransactionDatabase);

      const result = await finder.findRelatedTransactions({
        signature: mockSourceTransaction.signature,
        minRelevanceScore: 0.5 // High threshold
      });

      // All returned transactions should meet the minimum relevance score
      result.relatedTransactions.forEach(tx => {
        expect(tx.relevanceScore).toBeGreaterThanOrEqual(0.5);
      });

      // Should exclude the unrelated transaction
      const unrelatedTx = result.relatedTransactions.find(tx => 
        tx.signature === 'unrelated_tx1'
      );
      expect(unrelatedTx).toBeUndefined();
    });
  });

  describe('Insight Generation Accuracy', () => {
    it('should generate accurate transaction insights', async () => {
      const { RelatedTransactionFinder } = require('../../lib/related-transaction-finder');

      const finder = new RelatedTransactionFinder();

      // Mock to return DeFi-heavy related transactions
      const defiHeavyRelated: RelatedTransaction[] = Array.from({ length: 4 }, (_, i) => ({
        signature: `defi_tx_${i}`,
        slot: 150000000 + i,
        blockTime: 1640995200000 + (i * 60000),
        relationship: {
          type: 'defi_protocol',
          strength: 'strong',
          description: 'DeFi protocol interaction',
          sharedElements: {
            accounts: ['wallet_alice'],
            programs: ['JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'],
            tokens: [],
            instructionTypes: [],
            timeWindow: i * 60
          },
          confidence: 0.8
        },
        relevanceScore: 0.8,
        summary: `DeFi transaction ${i}`,
        accounts: ['wallet_alice'],
        programs: ['JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4']
      }));

      jest.spyOn(finder, 'getTransaction').mockResolvedValue(mockSourceTransaction);
      jest.spyOn(finder, 'searchTransactionsByPrograms').mockResolvedValue([]);
      jest.spyOn(finder, 'searchTransactionsByAccounts').mockResolvedValue([]);
      jest.spyOn(finder, 'searchTransactionsByTimeWindow').mockResolvedValue([]);

      // Mock the discovery methods to return DeFi transactions
      jest.spyOn(finder, 'findDeFiProtocolRelationships').mockResolvedValue(defiHeavyRelated);

      const result = await finder.findRelatedTransactions({
        signature: mockSourceTransaction.signature,
        includeDeFiPatterns: true
      });

      expect(result.insights).toBeDefined();
      expect(result.insights.length).toBeGreaterThan(0);

      // Should detect DeFi activity pattern
      const defiInsight = result.insights.find(insight => 
        insight.title === 'DeFi Protocol Activity'
      );
      expect(defiInsight).toBeDefined();
      expect(defiInsight?.type).toBe('pattern');
      expect(defiInsight?.severity).toBe('medium');
      expect(defiInsight?.relatedTransactions.length).toBe(4);
    });

    it('should detect multi-step operation patterns', async () => {
      const { RelatedTransactionFinder } = require('../../lib/related-transaction-finder');

      const finder = new RelatedTransactionFinder();

      // Mock multi-step sequence
      const multiStepRelated: RelatedTransaction[] = [
        {
          signature: 'step_1',
          slot: 150000001,
          blockTime: 1640995210000,
          relationship: {
            type: 'multi_step',
            strength: 'strong',
            description: 'Multi-step operation',
            sharedElements: {
              accounts: ['wallet_alice'],
              programs: [],
              tokens: [],
              instructionTypes: [],
              timeWindow: 10
            },
            confidence: 0.9
          },
          relevanceScore: 0.9,
          summary: 'Step 1 of operation',
          accounts: ['wallet_alice'],
          programs: []
        },
        {
          signature: 'step_2',
          slot: 150000002,
          blockTime: 1640995220000,
          relationship: {
            type: 'multi_step',
            strength: 'strong',
            description: 'Multi-step operation',
            sharedElements: {
              accounts: ['wallet_alice'],
              programs: [],
              tokens: [],
              instructionTypes: [],
              timeWindow: 20
            },
            confidence: 0.9
          },
          relevanceScore: 0.9,
          summary: 'Step 2 of operation',
          accounts: ['wallet_alice'],
          programs: []
        }
      ];

      jest.spyOn(finder, 'getTransaction').mockResolvedValue(mockSourceTransaction);
      jest.spyOn(finder, 'findTransactionSequences').mockResolvedValue(multiStepRelated);

      const result = await finder.findRelatedTransactions({
        signature: mockSourceTransaction.signature
      });

      const multiStepInsight = result.insights.find(insight => 
        insight.title === 'Multi-Step Operation'
      );
      expect(multiStepInsight).toBeDefined();
      expect(multiStepInsight?.type).toBe('pattern');
      expect(multiStepInsight?.severity).toBe('low');
      expect(multiStepInsight?.relatedTransactions.length).toBe(2);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large numbers of related transactions efficiently', async () => {
      const { RelatedTransactionFinder } = require('../../lib/related-transaction-finder');

      const finder = new RelatedTransactionFinder();

      // Create a large set of related transactions
      const largeTransactionSet = Array.from({ length: 1000 }, (_, i) => ({
        signature: `large_tx_${i}`,
        slot: 150000000 + i,
        blockTime: 1640995200000 + (i * 1000),
        success: true,
        details: {
          accounts: [
            { pubkey: i % 10 === 0 ? 'wallet_alice' : `wallet_${i}`, executable: false, owner: '11111111111111111111111111111111' },
            { pubkey: `wallet_target_${i}`, executable: false, owner: '11111111111111111111111111111111' }
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
      }));

      jest.spyOn(finder, 'getTransaction').mockResolvedValue(mockSourceTransaction);
      jest.spyOn(finder, 'searchTransactionsByAccounts').mockResolvedValue(largeTransactionSet);
      jest.spyOn(finder, 'searchTransactionsByPrograms').mockResolvedValue(largeTransactionSet);
      jest.spyOn(finder, 'searchTransactionsByTimeWindow').mockResolvedValue(largeTransactionSet);

      const startTime = Date.now();
      const result = await finder.findRelatedTransactions({
        signature: mockSourceTransaction.signature,
        maxResults: 50
      });
      const endTime = Date.now();

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(10000); // 10 seconds

      // Should respect maxResults limit
      expect(result.relatedTransactions.length).toBeLessThanOrEqual(50);

      // Should still provide accurate results
      expect(result.totalFound).toBeGreaterThan(50);
      expect(result.relationshipSummary).toBeDefined();
    });

    it('should handle concurrent discovery requests', async () => {
      const { RelatedTransactionFinder } = require('../../lib/related-transaction-finder');

      const finder = new RelatedTransactionFinder();

      jest.spyOn(finder, 'getTransaction').mockImplementation(async (signature) => {
        if (signature.startsWith('concurrent_')) {
          return {
            ...mockSourceTransaction,
            signature
          };
        }
        return mockSourceTransaction;
      });

      jest.spyOn(finder, 'searchTransactionsByAccounts').mockResolvedValue(mockTransactionDatabase.slice(0, 2));

      // Create multiple concurrent requests
      const concurrentRequests = Array.from({ length: 5 }, (_, i) => 
        finder.findRelatedTransactions({
          signature: `concurrent_tx_${i}`,
          maxResults: 10
        })
      );

      const results = await Promise.all(concurrentRequests);

      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result).toBeDefined();
        expect(result.sourceTransaction).toBe(`concurrent_tx_${index}`);
        expect(result.relatedTransactions).toBeDefined();
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle transactions with no relationships gracefully', async () => {
      const { RelatedTransactionFinder } = require('../../lib/related-transaction-finder');

      const finder = new RelatedTransactionFinder();

      jest.spyOn(finder, 'getTransaction').mockResolvedValue(mockSourceTransaction);
      jest.spyOn(finder, 'searchTransactionsByAccounts').mockResolvedValue([]);
      jest.spyOn(finder, 'searchTransactionsByPrograms').mockResolvedValue([]);
      jest.spyOn(finder, 'searchTransactionsByTimeWindow').mockResolvedValue([]);
      jest.spyOn(finder, 'searchTransactionsByTokens').mockResolvedValue([]);

      const result = await finder.findRelatedTransactions({
        signature: mockSourceTransaction.signature
      });

      expect(result).toBeDefined();
      expect(result.relatedTransactions).toHaveLength(0);
      expect(result.totalFound).toBe(0);
      expect(result.insights).toHaveLength(0);
      expect(result.relationshipSummary).toEqual({});
    });

    it('should handle malformed transaction data', async () => {
      const { RelatedTransactionFinder } = require('../../lib/related-transaction-finder');

      const finder = new RelatedTransactionFinder();

      const malformedTransaction = {
        signature: 'malformed_tx',
        slot: 150000000,
        blockTime: null,
        success: true,
        details: null,
        parsedInstructions: undefined
      } as any;

      jest.spyOn(finder, 'getTransaction').mockResolvedValue(malformedTransaction);
      jest.spyOn(finder, 'searchTransactionsByAccounts').mockResolvedValue([]);

      const result = await finder.findRelatedTransactions({
        signature: 'malformed_tx'
      });

      expect(result).toBeDefined();
      expect(result.relatedTransactions).toBeDefined();
      expect(result.searchTimeMs).toBeGreaterThan(0);
    });

    it('should handle search failures gracefully', async () => {
      const { RelatedTransactionFinder } = require('../../lib/related-transaction-finder');

      const finder = new RelatedTransactionFinder();

      jest.spyOn(finder, 'getTransaction').mockResolvedValue(mockSourceTransaction);
      jest.spyOn(finder, 'searchTransactionsByAccounts').mockRejectedValue(new Error('Search failed'));
      jest.spyOn(finder, 'searchTransactionsByPrograms').mockResolvedValue(mockTransactionDatabase.slice(0, 1));

      // Should not throw error, but continue with other search methods
      const result = await finder.findRelatedTransactions({
        signature: mockSourceTransaction.signature
      });

      expect(result).toBeDefined();
      expect(result.relatedTransactions).toBeDefined();
      // Should still find some relationships from working search methods
    });
  });
});