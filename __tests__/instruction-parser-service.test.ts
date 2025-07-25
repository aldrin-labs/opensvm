import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { InstructionParserService } from '../lib/instruction-parser-service';
import type { ParsedInstructionInfo, ProgramDefinition } from '../lib/instruction-parser-service';

// Mock the program registry
jest.mock('../lib/program-registry', () => ({
  getAllProgramDefinitions: jest.fn(() => [
    {
      programId: '11111111111111111111111111111111',
      name: 'System Program',
      description: 'Core Solana system program',
      category: 'system',
      instructions: [
        {
          discriminator: '00000002',
          name: 'transfer',
          description: 'Transfer SOL between accounts',
          category: 'transfer',
          riskLevel: 'low',
          accounts: [
            { name: 'from', description: 'Source account', isSigner: true, isWritable: true, role: 'payer' },
            { name: 'to', description: 'Destination account', isSigner: false, isWritable: true, role: 'recipient' }
          ],
          parameters: [
            { name: 'lamports', type: 'number', description: 'Lamports to transfer' }
          ]
        }
      ]
    },
    {
      programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
      name: 'SPL Token',
      description: 'Solana Program Library Token program',
      category: 'token',
      instructions: [
        {
          discriminator: '03',
          name: 'transfer',
          description: 'Transfer tokens between accounts',
          category: 'transfer',
          riskLevel: 'low',
          accounts: [
            { name: 'source', description: 'Source token account', isSigner: false, isWritable: true, role: 'token_account' },
            { name: 'destination', description: 'Destination token account', isSigner: false, isWritable: true, role: 'token_account' },
            { name: 'authority', description: 'Transfer authority', isSigner: true, isWritable: false, role: 'authority' }
          ],
          parameters: [
            { name: 'amount', type: 'number', description: 'Amount to transfer' }
          ]
        }
      ]
    }
  ]),
  getProgramDefinition: jest.fn((programId: string) => {
    if (programId === '11111111111111111111111111111111') {
      return {
        programId: '11111111111111111111111111111111',
        name: 'System Program',
        description: 'Core Solana system program',
        category: 'system',
        instructions: []
      };
    }
    return undefined;
  })
}));

// Mock the transaction analysis cache
jest.mock('../lib/transaction-analysis-cache', () => ({
  transactionAnalysisCache: {
    getCachedInstructionDefinition: jest.fn(() => Promise.resolve(null)),
    cacheInstructionDefinition: jest.fn(() => Promise.resolve())
  }
}));

// Mock Qdrant client to avoid ES module issues
jest.mock('@qdrant/js-client-rest', () => ({
  QdrantClient: jest.fn().mockImplementation(() => ({
    createCollection: jest.fn(),
    getCollection: jest.fn(),
    upsert: jest.fn(),
    search: jest.fn()
  }))
}));

describe('InstructionParserService', () => {
  let parserService: InstructionParserService;

  beforeEach(() => {
    parserService = new InstructionParserService();
    jest.clearAllMocks();
  });

  describe('parseInstruction', () => {
    it('should parse a known system program instruction', async () => {
      const result = await parserService.parseInstruction(
        '11111111111111111111111111111111',
        ['from_account', 'to_account'],
        '00000002',
        {
          type: 'transfer',
          info: {
            lamports: 1000000000
          }
        }
      );

      expect(result.programId).toBe('11111111111111111111111111111111');
      expect(result.programName).toBe('System Program');
      expect(result.instructionType).toBe('transfer');
      expect(result.description).toContain('Transfer');
      expect(result.category).toBe('system');
      expect(result.riskLevel).toBe('low');
      expect(result.accounts).toHaveLength(2);
      expect(result.parameters).toHaveLength(1);
      expect(result.parameters[0].name).toBe('lamports');
      expect(result.parameters[0].value).toBe(1000000000);
    });

    it('should parse a token program instruction', async () => {
      const result = await parserService.parseInstruction(
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        ['source_account', 'dest_account', 'authority'],
        '03',
        {
          type: 'transfer',
          info: {
            amount: '1000000'
          }
        }
      );

      expect(result.programId).toBe('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
      expect(result.programName).toBe('SPL Token');
      expect(result.instructionType).toBe('transfer');
      expect(result.category).toBe('token');
      expect(result.accounts).toHaveLength(3);
      expect(result.accounts[2].role).toBe('authority');
    });

    it('should handle unknown program instructions', async () => {
      const result = await parserService.parseInstruction(
        'UnknownProgramId123456789',
        ['account1', 'account2'],
        'unknown_data',
        null
      );

      expect(result.programId).toBe('UnknownProgramId123456789');
      expect(result.programName).toBe('Unknown Program');
      expect(result.instructionType).toBe('unknown');
      expect(result.category).toBe('unknown');
      expect(result.riskLevel).toBe('medium');
      expect(result.accounts).toHaveLength(2);
      expect(result.accounts[0].role).toBe('unknown');
    });

    it('should parse raw instruction data without parsed info', async () => {
      const result = await parserService.parseInstruction(
        '11111111111111111111111111111111',
        ['from_account', 'to_account'],
        '00000002'
      );

      expect(result.programId).toBe('11111111111111111111111111111111');
      expect(result.programName).toBe('System Program');
      expect(result.instructionType).toBe('transfer');
      expect(result.description).toContain('System Program');
      expect(result.accounts).toHaveLength(2);
    });

    it('should handle malformed instruction data gracefully', async () => {
      const result = await parserService.parseInstruction(
        '11111111111111111111111111111111',
        [],
        '',
        null
      );

      expect(result.programId).toBe('11111111111111111111111111111111');
      expect(result.programName).toBe('System Program');
      expect(result.instructionType).toBe('unknown');
      expect(result.accounts).toHaveLength(0);
    });
  });

  describe('getProgramInfo', () => {
    it('should return program information for known programs', () => {
      const programInfo = parserService.getProgramInfo('11111111111111111111111111111111');
      
      expect(programInfo).toBeDefined();
      expect(programInfo?.name).toBe('System Program');
      expect(programInfo?.category).toBe('system');
    });

    it('should return undefined for unknown programs', () => {
      const programInfo = parserService.getProgramInfo('UnknownProgramId');
      
      expect(programInfo).toBeUndefined();
    });
  });

  describe('getAllPrograms', () => {
    it('should return all registered programs', () => {
      const programs = parserService.getAllPrograms();
      
      expect(programs).toBeDefined();
      expect(Array.isArray(programs)).toBe(true);
      expect(programs.length).toBeGreaterThan(0);
      expect(programs.some(p => p.name === 'System Program')).toBe(true);
      expect(programs.some(p => p.name === 'SPL Token')).toBe(true);
    });
  });

  describe('getProgramsByCategory', () => {
    it('should return programs filtered by category', () => {
      const systemPrograms = parserService.getProgramsByCategory('system');
      
      expect(systemPrograms).toBeDefined();
      expect(Array.isArray(systemPrograms)).toBe(true);
      expect(systemPrograms.every(p => p.category === 'system')).toBe(true);
    });

    it('should return empty array for non-existent category', () => {
      const nonExistentPrograms = parserService.getProgramsByCategory('non_existent');
      
      expect(nonExistentPrograms).toBeDefined();
      expect(Array.isArray(nonExistentPrograms)).toBe(true);
      expect(nonExistentPrograms).toHaveLength(0);
    });
  });

  describe('registerProgram', () => {
    it('should register a new program', () => {
      const newProgram: ProgramDefinition = {
        programId: 'TestProgramId123',
        name: 'Test Program',
        description: 'A test program',
        category: 'test',
        instructions: []
      };

      parserService.registerProgram(newProgram);
      
      const retrievedProgram = parserService.getProgramInfo('TestProgramId123');
      expect(retrievedProgram).toBeDefined();
      expect(retrievedProgram?.name).toBe('Test Program');
    });

    it('should update existing program when re-registered', () => {
      const updatedProgram: ProgramDefinition = {
        programId: '11111111111111111111111111111111',
        name: 'Updated System Program',
        description: 'Updated description',
        category: 'system',
        instructions: []
      };

      parserService.registerProgram(updatedProgram);
      
      const retrievedProgram = parserService.getProgramInfo('11111111111111111111111111111111');
      expect(retrievedProgram?.name).toBe('Updated System Program');
      expect(retrievedProgram?.description).toBe('Updated description');
    });
  });

  describe('isProgramRegistered', () => {
    it('should return true for registered programs', () => {
      expect(parserService.isProgramRegistered('11111111111111111111111111111111')).toBe(true);
    });

    it('should return false for unregistered programs', () => {
      expect(parserService.isProgramRegistered('UnregisteredProgramId')).toBe(false);
    });
  });

  describe('getInstructionDefinitions', () => {
    it('should return instruction definitions for a program', () => {
      const instructions = parserService.getInstructionDefinitions('11111111111111111111111111111111');
      
      expect(instructions).toBeDefined();
      expect(Array.isArray(instructions)).toBe(true);
      expect(instructions.length).toBeGreaterThan(0);
      expect(instructions[0].name).toBe('transfer');
    });

    it('should return empty array for unknown programs', () => {
      const instructions = parserService.getInstructionDefinitions('UnknownProgramId');
      
      expect(instructions).toBeDefined();
      expect(Array.isArray(instructions)).toBe(true);
      expect(instructions).toHaveLength(0);
    });
  });

  describe('findInstructionByDiscriminator', () => {
    it('should find instruction by discriminator', () => {
      const instruction = parserService.findInstructionByDiscriminator(
        '11111111111111111111111111111111',
        '00000002'
      );
      
      expect(instruction).toBeDefined();
      expect(instruction?.name).toBe('transfer');
      expect(instruction?.discriminator).toBe('00000002');
    });

    it('should return undefined for unknown discriminator', () => {
      const instruction = parserService.findInstructionByDiscriminator(
        '11111111111111111111111111111111',
        'unknown_discriminator'
      );
      
      expect(instruction).toBeUndefined();
    });
  });

  describe('categorizeInstructions', () => {
    it('should categorize multiple instructions correctly', async () => {
      const instructions = [
        {
          programId: '11111111111111111111111111111111',
          accounts: ['account1', 'account2'],
          data: '00000002',
          parsed: { type: 'transfer', info: { lamports: 1000000 } }
        },
        {
          programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
          accounts: ['source', 'dest', 'authority'],
          data: '03',
          parsed: { type: 'transfer', info: { amount: '1000' } }
        }
      ];

      const categorization = await parserService.categorizeInstructions(instructions);
      
      expect(categorization.categories).toBeDefined();
      expect(categorization.riskLevels).toBeDefined();
      expect(categorization.programs).toBeDefined();
      
      expect(categorization.categories.system).toBe(1);
      expect(categorization.categories.token).toBe(1);
      expect(categorization.riskLevels.low).toBe(2);
      expect(categorization.programs['System Program']).toBe(1);
      expect(categorization.programs['SPL Token']).toBe(1);
    });

    it('should handle empty instruction list', async () => {
      const categorization = await parserService.categorizeInstructions([]);
      
      expect(categorization.categories).toEqual({});
      expect(categorization.riskLevels).toEqual({});
      expect(categorization.programs).toEqual({});
    });
  });

  describe('instruction description generation', () => {
    it('should generate appropriate descriptions for system program transfers', async () => {
      const result = await parserService.parseInstruction(
        '11111111111111111111111111111111',
        ['from', 'to'],
        '00000002',
        {
          type: 'transfer',
          info: { lamports: 1500000000 }
        }
      );

      expect(result.description).toContain('Transfer');
      expect(result.description).toContain('1.5000');
      expect(result.description).toContain('SOL');
    });

    it('should generate appropriate descriptions for token transfers', async () => {
      const result = await parserService.parseInstruction(
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        ['source', 'dest', 'authority'],
        '03',
        {
          type: 'transfer',
          info: { amount: '1000000' }
        }
      );

      expect(result.description).toContain('Transfer');
      expect(result.description).toContain('1000000');
      expect(result.description).toContain('tokens');
    });
  });

  describe('account role analysis', () => {
    it('should correctly identify account roles in system transfers', async () => {
      const result = await parserService.parseInstruction(
        '11111111111111111111111111111111',
        ['payer_account', 'recipient_account'],
        '00000002',
        {
          type: 'transfer',
          info: { lamports: 1000000 }
        }
      );

      expect(result.accounts).toHaveLength(2);
      expect(result.accounts[0].role).toBe('payer');
      expect(result.accounts[0].isSigner).toBe(true);
      expect(result.accounts[0].isWritable).toBe(true);
      expect(result.accounts[1].role).toBe('recipient');
      expect(result.accounts[1].isSigner).toBe(false);
      expect(result.accounts[1].isWritable).toBe(true);
    });

    it('should correctly identify account roles in token transfers', async () => {
      const result = await parserService.parseInstruction(
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        ['source_token_account', 'dest_token_account', 'authority_account'],
        '03',
        {
          type: 'transfer',
          info: { amount: '1000' }
        }
      );

      expect(result.accounts).toHaveLength(3);
      expect(result.accounts[0].role).toBe('token_account');
      expect(result.accounts[1].role).toBe('token_account');
      expect(result.accounts[2].role).toBe('authority');
      expect(result.accounts[2].isSigner).toBe(true);
    });
  });

  describe('parameter extraction', () => {
    it('should extract parameters from parsed instruction info', async () => {
      const result = await parserService.parseInstruction(
        '11111111111111111111111111111111',
        ['from', 'to'],
        '00000002',
        {
          type: 'transfer',
          info: {
            lamports: 1000000000,
            source: 'source_account',
            destination: 'dest_account'
          }
        }
      );

      expect(result.parameters).toHaveLength(3);
      
      const lamportsParam = result.parameters.find(p => p.name === 'lamports');
      expect(lamportsParam).toBeDefined();
      expect(lamportsParam?.value).toBe(1000000000);
      expect(lamportsParam?.type).toBe('number');
      
      const sourceParam = result.parameters.find(p => p.name === 'source');
      expect(sourceParam).toBeDefined();
      expect(sourceParam?.type).toBe('address');
    });

    it('should handle nested objects in parameters', async () => {
      const result = await parserService.parseInstruction(
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        ['source', 'dest', 'authority'],
        '0C',
        {
          type: 'transferChecked',
          info: {
            tokenAmount: {
              amount: '1000000',
              decimals: 6,
              uiAmount: 1.0,
              uiAmountString: '1.0'
            }
          }
        }
      );

      const tokenAmountParam = result.parameters.find(p => p.name === 'tokenAmount');
      expect(tokenAmountParam).toBeDefined();
      expect(tokenAmountParam?.value).toBe(1.0);
      expect(tokenAmountParam?.type).toBe('amount');
    });
  });

  describe('error handling', () => {
    it('should handle null parsed data gracefully', async () => {
      const result = await parserService.parseInstruction(
        '11111111111111111111111111111111',
        ['account1', 'account2'],
        'some_data',
        null
      );

      expect(result).toBeDefined();
      expect(result.programId).toBe('11111111111111111111111111111111');
      expect(result.instructionType).toBe('transfer');
      expect(result.parameters).toHaveLength(0);
    });

    it('should handle empty accounts array', async () => {
      const result = await parserService.parseInstruction(
        '11111111111111111111111111111111',
        [],
        '00000002',
        { type: 'transfer', info: { lamports: 1000 } }
      );

      expect(result).toBeDefined();
      expect(result.accounts).toHaveLength(0);
    });

    it('should handle invalid instruction data', async () => {
      const result = await parserService.parseInstruction(
        '11111111111111111111111111111111',
        ['account1'],
        'invalid_data',
        { type: 'invalid_type', info: {} }
      );

      expect(result).toBeDefined();
      expect(result.instructionType).toBe('invalid_type');
      expect(result.description).toContain('System Program');
    });
  });

  describe('performance and caching', () => {
    it('should generate consistent cache keys', async () => {
      const programId = '11111111111111111111111111111111';
      const accounts = ['account1', 'account2'];
      const data = '00000002';
      const parsed = { type: 'transfer', info: { lamports: 1000 } };

      // Parse the same instruction twice
      await parserService.parseInstruction(programId, accounts, data, parsed);
      await parserService.parseInstruction(programId, accounts, data, parsed);

      // Cache should have been called with the same key both times
      const { transactionAnalysisCache } = require('../lib/transaction-analysis-cache');
      expect(transactionAnalysisCache.getCachedInstructionDefinition).toHaveBeenCalledTimes(2);
      expect(transactionAnalysisCache.cacheInstructionDefinition).toHaveBeenCalledTimes(2);
    });

    it('should handle large numbers of instructions efficiently', async () => {
      const startTime = Date.now();
      const instructions = Array.from({ length: 100 }, (_, i) => ({
        programId: '11111111111111111111111111111111',
        accounts: [`account${i}`, `account${i + 1}`],
        data: '00000002',
        parsed: { type: 'transfer', info: { lamports: 1000 * i } }
      }));

      const categorization = await parserService.categorizeInstructions(instructions);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(categorization.categories.system).toBe(100);
      expect(categorization.programs['System Program']).toBe(100);
    });
  });
});