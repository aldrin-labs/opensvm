import { describe, it, expect } from '@jest/globals';
import {
  getAllProgramDefinitions,
  getProgramDefinition,
  getProgramsByCategory,
  searchPrograms,
  getProgramRegistryStats,
  getProgramsWithInstructionType,
  getAllInstructionCategories,
  getProgramsByRiskLevel,
  getInstructionDefinition,
  isProgramHighRisk,
  getSimilarPrograms,
  getProgramMetadata,
  validateProgramDefinition,
  exportProgramRegistry,
  PROGRAM_CATEGORIES,
  RISK_LEVELS
} from '../lib/program-registry';

describe('Program Registry', () => {
  describe('Basic functionality', () => {
    it('should return all program definitions', () => {
      const programs = getAllProgramDefinitions();
      expect(programs).toBeDefined();
      expect(Array.isArray(programs)).toBe(true);
      expect(programs.length).toBeGreaterThan(0);
    });

    it('should get program by ID', () => {
      const systemProgram = getProgramDefinition('11111111111111111111111111111111');
      expect(systemProgram).toBeDefined();
      expect(systemProgram?.name).toBe('System Program');
      expect(systemProgram?.category).toBe('system');
    });

    it('should return undefined for unknown program', () => {
      const unknownProgram = getProgramDefinition('UnknownProgramId123456789');
      expect(unknownProgram).toBeUndefined();
    });

    it('should get programs by category', () => {
      const systemPrograms = getProgramsByCategory('system');
      expect(systemPrograms).toBeDefined();
      expect(Array.isArray(systemPrograms)).toBe(true);
      expect(systemPrograms.length).toBeGreaterThan(0);
      expect(systemPrograms.every(p => p.category === 'system')).toBe(true);
    });
  });

  describe('Search functionality', () => {
    it('should search programs by name', () => {
      const results = searchPrograms('System');
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(p => p.name.includes('System'))).toBe(true);
    });

    it('should search programs by description', () => {
      const results = searchPrograms('token');
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should search programs by program ID', () => {
      const results = searchPrograms('11111111111111111111111111111111');
      expect(results).toBeDefined();
      expect(results.length).toBe(1);
      expect(results[0].programId).toBe('11111111111111111111111111111111');
    });
  });

  describe('Statistics and analytics', () => {
    it('should return program registry stats', () => {
      const stats = getProgramRegistryStats();
      expect(stats).toBeDefined();
      expect(stats.totalPrograms).toBeGreaterThan(0);
      expect(stats.totalInstructions).toBeGreaterThan(0);
      expect(typeof stats.categoryCounts).toBe('object');
      expect(typeof stats.riskLevelCounts).toBe('object');
      expect(typeof stats.programsWithDocumentation).toBe('number');
    });

    it('should get all instruction categories', () => {
      const categories = getAllInstructionCategories();
      expect(categories).toBeDefined();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);
      expect(categories.includes('transfer')).toBe(true);
    });

    it('should get programs by risk level', () => {
      const highRiskPrograms = getProgramsByRiskLevel('high');
      expect(highRiskPrograms).toBeDefined();
      expect(Array.isArray(highRiskPrograms)).toBe(true);
      
      const lowRiskPrograms = getProgramsByRiskLevel('low');
      expect(lowRiskPrograms).toBeDefined();
      expect(Array.isArray(lowRiskPrograms)).toBe(true);
      expect(lowRiskPrograms.length).toBeGreaterThan(0);
    });
  });

  describe('Instruction analysis', () => {
    it('should get programs with specific instruction type', () => {
      const transferPrograms = getProgramsWithInstructionType('transfer');
      expect(transferPrograms).toBeDefined();
      expect(Array.isArray(transferPrograms)).toBe(true);
      expect(transferPrograms.length).toBeGreaterThan(0);
    });

    it('should get instruction definition', () => {
      const instructionDef = getInstructionDefinition('11111111111111111111111111111111', 'transfer');
      expect(instructionDef).toBeDefined();
      expect(instructionDef?.program.name).toBe('System Program');
      expect(instructionDef?.instruction.name).toBe('transfer');
    });

    it('should return undefined for unknown instruction', () => {
      const instructionDef = getInstructionDefinition('11111111111111111111111111111111', 'unknownInstruction');
      expect(instructionDef).toBeUndefined();
    });
  });

  describe('Risk assessment', () => {
    it('should assess program risk correctly', () => {
      const systemProgramRisk = isProgramHighRisk('11111111111111111111111111111111');
      expect(typeof systemProgramRisk).toBe('boolean');
      
      const unknownProgramRisk = isProgramHighRisk('UnknownProgramId123456789');
      expect(unknownProgramRisk).toBe(true); // Unknown programs should be high risk
    });
  });

  describe('Similar programs', () => {
    it('should get similar programs', () => {
      const similarPrograms = getSimilarPrograms('11111111111111111111111111111111');
      expect(similarPrograms).toBeDefined();
      expect(Array.isArray(similarPrograms)).toBe(true);
      // Should not include the original program
      expect(similarPrograms.every(p => p.programId !== '11111111111111111111111111111111')).toBe(true);
    });
  });

  describe('Program metadata', () => {
    it('should get program metadata', () => {
      const metadata = getProgramMetadata('11111111111111111111111111111111');
      expect(metadata).toBeDefined();
      expect(metadata?.program.name).toBe('System Program');
      expect(metadata?.stats.instructionCount).toBeGreaterThan(0);
      expect(typeof metadata?.stats.riskDistribution).toBe('object');
      expect(typeof metadata?.stats.categoryDistribution).toBe('object');
    });

    it('should return undefined for unknown program metadata', () => {
      const metadata = getProgramMetadata('UnknownProgramId123456789');
      expect(metadata).toBeUndefined();
    });
  });

  describe('Validation', () => {
    it('should validate correct program definition', () => {
      const validProgram = {
        programId: '11111111111111111111111111111111',
        name: 'Test Program',
        description: 'Test description',
        category: 'test',
        instructions: [
          {
            discriminator: '00',
            name: 'testInstruction',
            description: 'Test instruction',
            category: 'test',
            riskLevel: 'low' as const,
            accounts: [],
            parameters: []
          }
        ]
      };

      const validation = validateProgramDefinition(validProgram);
      expect(validation.isValid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    it('should detect invalid program definition', () => {
      const invalidProgram = {
        programId: '', // Invalid: empty
        name: '', // Invalid: empty
        description: 'Test description',
        category: 'test',
        instructions: [] // Invalid: no instructions
      };

      const validation = validateProgramDefinition(invalidProgram as any);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Export functionality', () => {
    it('should export program registry', () => {
      const exportData = exportProgramRegistry();
      expect(exportData).toBeDefined();
      expect(exportData.version).toBeDefined();
      expect(exportData.timestamp).toBeDefined();
      expect(Array.isArray(exportData.programs)).toBe(true);
      expect(exportData.stats).toBeDefined();
    });
  });

  describe('Constants', () => {
    it('should have program categories defined', () => {
      expect(PROGRAM_CATEGORIES).toBeDefined();
      expect(PROGRAM_CATEGORIES.system).toBeDefined();
      expect(PROGRAM_CATEGORIES.token).toBeDefined();
      expect(PROGRAM_CATEGORIES.defi).toBeDefined();
      expect(PROGRAM_CATEGORIES.nft).toBeDefined();
      expect(PROGRAM_CATEGORIES.governance).toBeDefined();
    });

    it('should have risk levels defined', () => {
      expect(RISK_LEVELS).toBeDefined();
      expect(RISK_LEVELS.low).toBeDefined();
      expect(RISK_LEVELS.medium).toBeDefined();
      expect(RISK_LEVELS.high).toBeDefined();
    });
  });

  describe('Comprehensive coverage', () => {
    it('should have major Solana programs', () => {
      const programs = getAllProgramDefinitions();
      const programIds = programs.map(p => p.programId);

      // Core programs
      expect(programIds).toContain('11111111111111111111111111111111'); // System
      expect(programIds).toContain('Vote111111111111111111111111111111111111111'); // Vote
      expect(programIds).toContain('Stake11111111111111111111111111111111111111'); // Stake

      // SPL programs
      expect(programIds).toContain('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'); // SPL Token
      expect(programIds).toContain('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'); // Associated Token Account

      // DeFi programs
      expect(programIds).toContain('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'); // Jupiter
      expect(programIds).toContain('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'); // Raydium
      expect(programIds).toContain('whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc'); // Whirlpool

      // NFT programs
      expect(programIds).toContain('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'); // Metaplex Token Metadata
      expect(programIds).toContain('cndy3Z4yapfJBmL3ShUp5exZKqR3z33thTzeNMm2gRZ'); // Candy Machine

      // Governance programs
      expect(programIds).toContain('GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw'); // SPL Governance

      // Utility programs
      expect(programIds).toContain('ComputeBudget111111111111111111111111111111'); // Compute Budget
    });

    it('should have comprehensive instruction coverage', () => {
      const stats = getProgramRegistryStats();
      expect(stats.totalInstructions).toBeGreaterThan(50); // Should have many instructions
      
      // Check that we have instructions across different categories
      const categories = getAllInstructionCategories();
      expect(categories).toContain('transfer');
      expect(categories).toContain('mint');
      expect(categories).toContain('swap');
      expect(categories).toContain('governance');
      expect(categories).toContain('trading');
    });

    it('should have proper documentation links', () => {
      const programs = getAllProgramDefinitions();
      const programsWithDocs = programs.filter(p => p.documentation || p.website);
      expect(programsWithDocs.length).toBeGreaterThan(0);
      
      // Check that major programs have documentation
      const systemProgram = getProgramDefinition('11111111111111111111111111111111');
      expect(systemProgram?.website).toBeDefined();
      
      const splTokenProgram = getProgramDefinition('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
      expect(splTokenProgram?.website).toBeDefined();
      expect(splTokenProgram?.documentation).toBeDefined();
    });
  });
});