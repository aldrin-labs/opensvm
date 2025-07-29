import { describe, it, expect, beforeEach } from '@jest/globals';
import { DynamicProgramDiscoveryService } from '../lib/dynamic-program-discovery';

describe('Dynamic Program Discovery Service', () => {
  let discoveryService: DynamicProgramDiscoveryService;

  beforeEach(() => {
    discoveryService = new DynamicProgramDiscoveryService();
  });

  describe('Program Discovery', () => {
    it('should discover program from transaction data', async () => {
      const programId = 'TestProgram1111111111111111111111111111';
      const mockTransactionData = [
        {
          signature: 'test_signature_1',
          feePayer: 'test_payer_1',
          blockTime: Math.floor(Date.now() / 1000),
          instructions: [
            {
              programId,
              data: '01000000abcdef',
              accounts: [
                { pubkey: 'account1', isSigner: true, isWritable: true },
                { pubkey: 'account2', isSigner: false, isWritable: true }
              ]
            }
          ]
        }
      ];

      const discovered = await discoveryService.discoverProgram(programId, mockTransactionData);
      
      expect(discovered).toBeDefined();
      expect(discovered?.programId).toBe(programId);
      expect(discovered?.transactionCount).toBe(1);
      expect(discovered?.uniqueUsers).toBe(1);
      expect(discovered?.instructions.length).toBeGreaterThan(0);
    });

    it('should return null for empty transaction data', async () => {
      const programId = 'TestProgram1111111111111111111111111111';
      const discovered = await discoveryService.discoverProgram(programId, []);
      
      expect(discovered).toBeNull();
    });

    it('should categorize DeFi programs correctly', async () => {
      const programId = 'DeFiProgram1111111111111111111111111111';
      const mockTransactionData = [
        {
          signature: 'test_signature_1',
          feePayer: 'test_payer_1',
          blockTime: Math.floor(Date.now() / 1000),
          instructions: [
            {
              programId,
              data: '09000000swap1234', // Contains 'swap' pattern
              accounts: [
                { pubkey: 'account1', isSigner: true, isWritable: true },
                { pubkey: 'account2', isSigner: false, isWritable: true },
                { pubkey: 'account3', isSigner: false, isWritable: true },
                { pubkey: 'account4', isSigner: false, isWritable: true }
              ]
            }
          ]
        }
      ];

      const discovered = await discoveryService.discoverProgram(programId, mockTransactionData);
      
      expect(discovered?.category).toBe('defi');
      expect(discovered?.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('Community Definitions', () => {
    it('should add valid community definition', async () => {
      const definition = {
        programId: 'CommunityProgram111111111111111111111111',
        name: 'Test Community Program',
        description: 'A test program contributed by the community',
        category: 'defi',
        instructions: [
          {
            discriminator: '01',
            name: 'testInstruction',
            description: 'Test instruction',
            category: 'test',
            riskLevel: 'low' as const,
            accounts: [],
            parameters: []
          }
        ]
      };

      const result = await discoveryService.addCommunityDefinition(definition, 'test_user');
      
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid community definition', async () => {
      const invalidDefinition = {
        programId: '', // Invalid: empty
        name: '',
        description: 'Test description',
        category: 'test',
        instructions: []
      };

      const result = await discoveryService.addCommunityDefinition(invalidDefinition as any, 'test_user');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle voting on community definitions', async () => {
      const definition = {
        programId: 'VotingProgram111111111111111111111111111',
        name: 'Test Voting Program',
        description: 'A test program for voting',
        category: 'governance',
        instructions: [
          {
            discriminator: '01',
            name: 'vote',
            description: 'Cast a vote',
            category: 'governance',
            riskLevel: 'low' as const,
            accounts: [],
            parameters: []
          }
        ]
      };

      // Add definition first
      await discoveryService.addCommunityDefinition(definition, 'test_user');

      // Vote on it
      const voteResult = await discoveryService.voteOnCommunityDefinition(
        definition.programId,
        'up',
        'voter_user'
      );

      expect(voteResult.success).toBe(true);
    });
  });

  describe('Usage Statistics', () => {
    it('should update program usage statistics', async () => {
      const programId = 'StatsProgram111111111111111111111111111';
      const mockTransactionData = [
        {
          signature: 'test_signature_1',
          feePayer: 'test_payer_1',
          blockTime: Math.floor(Date.now() / 1000),
          instructions: [
            {
              programId,
              data: '01000000',
              accounts: []
            }
          ]
        },
        {
          signature: 'test_signature_2',
          feePayer: 'test_payer_2',
          blockTime: Math.floor(Date.now() / 1000),
          instructions: [
            {
              programId,
              data: '02000000',
              accounts: []
            }
          ]
        }
      ];

      await discoveryService.updateProgramUsageStats(programId, mockTransactionData);
      const stats = await discoveryService.getProgramUsageStats(programId);

      expect(stats).toBeDefined();
      expect(stats?.totalTransactions).toBe(2);
      expect(stats?.uniqueUsers).toBe(2);
      expect(stats?.popularInstructions.length).toBeGreaterThan(0);
    });

    it('should calculate trending programs', async () => {
      // Add some mock usage data
      const programId1 = 'TrendingProgram1111111111111111111111111';
      const programId2 = 'TrendingProgram2222222222222222222222222';

      const mockData1 = Array.from({ length: 100 }, (_, i) => ({
        signature: `sig_${i}`,
        feePayer: `payer_${i % 10}`,
        blockTime: Math.floor(Date.now() / 1000),
        instructions: [{ programId: programId1, data: '01000000', accounts: [] }]
      }));

      const mockData2 = Array.from({ length: 50 }, (_, i) => ({
        signature: `sig_${i}`,
        feePayer: `payer_${i % 5}`,
        blockTime: Math.floor(Date.now() / 1000),
        instructions: [{ programId: programId2, data: '01000000', accounts: [] }]
      }));

      await discoveryService.updateProgramUsageStats(programId1, mockData1);
      await discoveryService.updateProgramUsageStats(programId2, mockData2);

      const trending = await discoveryService.getTrendingPrograms(5);

      expect(trending.length).toBeGreaterThan(0);
      expect(trending[0].trendScore).toBeGreaterThan(0);
    });
  });

  describe('Search and Export', () => {
    it('should search discovered programs', async () => {
      const programId = 'SearchableProgram11111111111111111111111';
      const mockTransactionData = [
        {
          signature: 'test_signature_1',
          feePayer: 'test_payer_1',
          blockTime: Math.floor(Date.now() / 1000),
          instructions: [
            {
              programId,
              data: '01000000',
              accounts: []
            }
          ]
        }
      ];

      await discoveryService.discoverProgram(programId, mockTransactionData);
      
      const searchResults = discoveryService.searchDiscoveredPrograms('Searchable');
      
      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults[0].programId).toBe(programId);
    });

    it('should export discovery data', () => {
      const exportData = discoveryService.exportDiscoveryData();
      
      expect(exportData).toBeDefined();
      expect(exportData.timestamp).toBeDefined();
      expect(Array.isArray(exportData.discoveredPrograms)).toBe(true);
      expect(Array.isArray(exportData.communityDefinitions)).toBe(true);
      expect(Array.isArray(exportData.usageStats)).toBe(true);
    });
  });

  describe('Integration with Static Registry', () => {
    it('should handle known programs from static registry', async () => {
      const systemProgramId = '11111111111111111111111111111111';
      const mockTransactionData = [
        {
          signature: 'test_signature_1',
          feePayer: 'test_payer_1',
          blockTime: Math.floor(Date.now() / 1000),
          instructions: [
            {
              programId: systemProgramId,
              data: '02000000',
              accounts: []
            }
          ]
        }
      ];

      const discovered = await discoveryService.discoverProgram(systemProgramId, mockTransactionData);
      
      expect(discovered).toBeDefined();
      expect(discovered?.name).toBe('System Program');
      expect(discovered?.confidence).toBe(1.0);
      expect(discovered?.discoveryMethod).toBe('metadata');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed transaction data gracefully', async () => {
      const programId = 'ErrorProgram111111111111111111111111111';
      const malformedData = [
        {
          // Missing required fields
          signature: 'test_signature_1'
        }
      ];

      const discovered = await discoveryService.discoverProgram(programId, malformedData as any);
      
      // Should handle gracefully and return null or minimal data
      expect(discovered).toBeDefined();
    });

    it('should handle duplicate community definitions', async () => {
      const definition = {
        programId: 'DuplicateProgram1111111111111111111111111',
        name: 'Duplicate Program',
        description: 'A duplicate program definition',
        category: 'test',
        instructions: [
          {
            discriminator: '01',
            name: 'testInstruction',
            description: 'Test instruction',
            category: 'test',
            riskLevel: 'low' as const,
            accounts: [],
            parameters: []
          }
        ]
      };

      // Add first definition
      const result1 = await discoveryService.addCommunityDefinition(definition, 'user1');
      expect(result1.success).toBe(true);

      // Try to add duplicate
      const result2 = await discoveryService.addCommunityDefinition(definition, 'user2');
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('already exists');
    });
  });
});