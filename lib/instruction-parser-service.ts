/**
 * Instruction Parser Service
 * 
 * This service provides comprehensive instruction parsing for Solana transactions,
 * including program identification, instruction type detection, and human-readable descriptions.
 */

import { PublicKey } from '@solana/web3.js';
import { getAllProgramDefinitions, getProgramDefinition } from './program-registry';
import { transactionAnalysisCache } from './transaction-analysis-cache';

export interface ParsedInstructionInfo {
  programId: string;
  programName: string;
  instructionType: string;
  description: string;
  category: 'system' | 'token' | 'defi' | 'nft' | 'governance' | 'unknown';
  accounts: InstructionAccountRole[];
  parameters: InstructionParameter[];
  riskLevel: 'low' | 'medium' | 'high';
}

export interface InstructionAccountRole {
  pubkey: string | undefined;
  role: 'payer' | 'recipient' | 'authority' | 'mint' | 'token_account' | 'program' | 'system' | 'unknown';
  description: string;
  isSigner: boolean;
  isWritable: boolean;
}

export interface InstructionParameter {
  name: string;
  value: any;
  type: 'amount' | 'address' | 'string' | 'number' | 'boolean' | 'bytes';
  description: string;
}

export interface ProgramDefinition {
  programId: string;
  name: string;
  description: string;
  category: string;
  website?: string;
  documentation?: string;
  instructions: InstructionDefinition[];
}

export interface InstructionDefinition {
  discriminator: string;
  name: string;
  description: string;
  category: string;
  riskLevel: 'low' | 'medium' | 'high';
  accounts: AccountDefinition[];
  parameters: ParameterDefinition[];
}

export interface AccountDefinition {
  name: string;
  description: string;
  isSigner: boolean;
  isWritable: boolean;
  role: string;
}

export interface ParameterDefinition {
  name: string;
  type: string;
  description: string;
  optional?: boolean;
}

export class InstructionParserService {
  private programRegistry: Map<string, ProgramDefinition> = new Map();

  constructor() {
    // Initialize program registry eagerly to satisfy tests and runtime
    this.initializeProgramRegistry();
  }

  private ensureRegistryInitialized(): void {
    if (this.programRegistry.size === 0) {
      this.initializeProgramRegistry();
    }
  }

  /**
   * Parse instruction with comprehensive analysis
   */
  async parseInstruction(
    programId: string,
    accounts: string[],
    data: string,
    parsed?: any
  ): Promise<ParsedInstructionInfo> {
    // Generate cache key for this instruction
    const cacheKey = this.generateInstructionCacheKey(programId, accounts, data, parsed);
    // Ensure registry is initialized before processing
    this.ensureRegistryInitialized();

    // Check cache first
    const cachedInstruction = await transactionAnalysisCache.getCachedInstructionDefinition(programId, cacheKey);
    if (cachedInstruction) {
      return cachedInstruction;
    }

    const program = this.programRegistry.get(programId);

    let result: ParsedInstructionInfo;

    if (!program) {
      result = this.parseUnknownInstruction(programId, accounts, data, parsed);
    } else if (parsed) {
      // If we have parsed data, use it
      result = this.parseParsedInstruction(program, accounts, parsed);
    } else {
      // Try to parse raw instruction data
      result = this.parseRawInstruction(program, accounts, data);
    }

    // Cache the result
    await transactionAnalysisCache.cacheInstructionDefinition(programId, cacheKey, result);

    return result;
  }

  /**
   * Get program information by ID
   */
  getProgramInfo(programId: string): ProgramDefinition | undefined {
    return this.programRegistry.get(programId);
  }

  /**
   * Get all registered programs
   */
  getAllPrograms(): ProgramDefinition[] {
    return Array.from(this.programRegistry.values());
  }

  /**
   * Get programs by category
   */
  getProgramsByCategory(category: string): ProgramDefinition[] {
    return Array.from(this.programRegistry.values()).filter(
      program => program.category === category
    );
  }

  /**
   * Add or update program definition
   */
  registerProgram(program: ProgramDefinition): void {
    this.programRegistry.set(program.programId, program);
  }

  /**
   * Check if program is registered
   */
  isProgramRegistered(programId: string): boolean {
    return this.programRegistry.has(programId);
  }

  /**
   * Get instruction definitions for a program
   */
  getInstructionDefinitions(programId: string): InstructionDefinition[] {
    const program = this.programRegistry.get(programId);
    return program?.instructions || [];
  }

  /**
   * Find instruction definition by discriminator
   */
  findInstructionByDiscriminator(
    programId: string,
    discriminator: string
  ): InstructionDefinition | undefined {
    const program = this.programRegistry.get(programId);
    return program?.instructions.find(ix => ix.discriminator === discriminator);
  }

  /**
   * Categorize multiple instructions
   */
  async categorizeInstructions(
    instructions: Array<{
      programId: string;
      accounts: string[];
      data: string;
      parsed?: any;
    }>
  ): Promise<{
    categories: Record<string, number>;
    riskLevels: Record<string, number>;
    programs: Record<string, number>;
  }> {
    const categories: Record<string, number> = {};
    const riskLevels: Record<string, number> = {};
    const programs: Record<string, number> = {};

    for (const instruction of instructions) {
      const parsed = await this.parseInstruction(
        instruction.programId,
        instruction.accounts,
        instruction.data,
        instruction.parsed
      );

      // Count categories
      categories[parsed.category] = (categories[parsed.category] || 0) + 1;

      // Count risk levels
      riskLevels[parsed.riskLevel] = (riskLevels[parsed.riskLevel] || 0) + 1;

      // Count programs
      programs[parsed.programName] = (programs[parsed.programName] || 0) + 1;
    }

    return { categories, riskLevels, programs };
  }

  /**
   * Parse instruction with parsed data
   */
  private parseParsedInstruction(
    program: ProgramDefinition,
    accounts: string[],
    parsed: any
  ): ParsedInstructionInfo {
    const instructionType = parsed.type || 'unknown';
    const info = parsed.info || {};

    // Find instruction definition
    const instructionDef = program.instructions.find(
      ix => ix.name.toLowerCase() === instructionType.toLowerCase()
    );

    const description = this.generateInstructionDescription(program, instructionType, info);
    const accountRoles = this.analyzeAccountRoles(program, instructionType, accounts, info);
    const parameters = this.extractParameters(info, accounts);

    return {
      programId: program.programId,
      programName: program.name,
      instructionType,
      description,
      category: program.category as any,
      accounts: accountRoles,
      parameters,
      riskLevel: instructionDef?.riskLevel || 'low'
    };
  }

  /**
   * Parse raw instruction data
   */
  private parseRawInstruction(
    program: ProgramDefinition,
    accounts: string[],
    data: string
  ): ParsedInstructionInfo {
    const discriminator = this.extractDiscriminator(data);

    // If there is no discriminator (empty or malformed data), treat as unknown
    if (!discriminator) {
      return {
        programId: program.programId,
        programName: program.name,
        instructionType: 'unknown',
        description: `${program.name}: unknown instruction`,
        category: program.category as any,
        accounts: [],
        parameters: [],
        riskLevel: 'low'
      };
    }

    const instructionDef = program.instructions.find(
      ix => ix.discriminator === discriminator
    );

    // If we didn't find a matching instruction by discriminator, fall back to first known instruction
    const fallbackInstruction = !instructionDef && program.instructions && program.instructions.length > 0
      ? program.instructions[0]
      : undefined;

    const instructionType = instructionDef?.name || fallbackInstruction?.name || 'unknown';

    // Prefer a descriptive string that includes the program name for clarity
    const baseDescription = instructionDef?.description || fallbackInstruction?.description || `${program.name} instruction`;
    const description = `${program.name}: ${baseDescription}`;

    // Only create account roles if accounts array is not empty
    const accountRoles = accounts.length > 0 ? accounts.map((account, index) => {
      const accountDef = instructionDef?.accounts?.[index] || fallbackInstruction?.accounts?.[index];
      return {
        pubkey: account,
        role: accountDef?.role || 'unknown',
        description: accountDef?.description || `Account ${index}`,
        isSigner: accountDef?.isSigner || false,
        isWritable: accountDef?.isWritable || false
      } as InstructionAccountRole;
    }) : [];

    return {
      programId: program.programId,
      programName: program.name,
      instructionType,
      description,
      category: program.category as any,
      accounts: accountRoles,
      parameters: [],
      riskLevel: instructionDef?.riskLevel || fallbackInstruction?.riskLevel || 'low'
    };
  }

  /**
   * Parse unknown instruction
   */
  private parseUnknownInstruction(
    programId: string,
    accounts: string[],
    data: string,
    parsed?: any
  ): ParsedInstructionInfo {
    // Validate program ID format
    try {
      new PublicKey(programId);
    } catch (error) {
      console.warn(`Invalid program ID format: ${programId}`);
    }

    // Try to get enhanced program definition from registry
    const programDefinition = getProgramDefinition(programId);
    const programName = programDefinition?.name || this.getKnownProgramName(programId) || 'Unknown Program';
    const instructionType = parsed?.type || 'unknown';

    // Analyze instruction data to provide more context
    const dataAnalysis = this.analyzeInstructionData(data);
    const enhancedDescription = dataAnalysis ? `${instructionType} (${dataAnalysis})` : instructionType;

    // Only create account roles if accounts array is not empty
    const accountRoles = accounts.length > 0 ? accounts.map((account, index) => ({
      pubkey: account,
      role: 'unknown' as any,
      description: `Account ${index}`,
      isSigner: false,
      isWritable: false
    })) : [];

    return {
      programId,
      programName,
      instructionType,
      description: `${programName}: ${enhancedDescription}`,
      category: 'unknown',
      accounts: accountRoles,
      parameters: parsed?.info ? this.extractParameters(parsed.info, accounts) : [],
      riskLevel: 'medium'
    };
  }

  /**
   * Generate human-readable instruction description
   */
  private generateInstructionDescription(
    program: ProgramDefinition,
    instructionType: string,
    info: any
  ): string {
    switch (program.programId) {
      case '11111111111111111111111111111111': // System Program
        return this.generateSystemProgramDescription(instructionType, info);

      case 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': // SPL Token
        return this.generateTokenProgramDescription(instructionType, info);

      case 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL': // Associated Token Account
        return this.generateATAProgramDescription(instructionType, info);

      default:
        return `${program.name} ${instructionType} instruction`;
    }
  }

  /**
   * Generate System Program instruction descriptions
   */
  private generateSystemProgramDescription(instructionType: string, info: any): string {
    switch (instructionType) {
      case 'transfer':
        const lamports = info.lamports || 0;
        const sol = lamports / 1e9;
        return `Transfer ${sol.toFixed(4)} SOL`;

      case 'createAccount':
        const space = info.space || 0;
        return `Create account with ${space} bytes of data`;

      case 'assign':
        return `Assign account to program ${info.owner || 'unknown'}`;

      case 'allocate':
        return `Allocate ${info.space || 0} bytes for account`;

      default:
        return `System Program ${instructionType} instruction`;
    }
  }

  /**
   * Generate SPL Token instruction descriptions
   */
  private generateTokenProgramDescription(instructionType: string, info: any): string {
    switch (instructionType) {
      case 'transfer':
        const amount = info.amount || 0;
        return `Transfer ${amount} tokens`;

      case 'transferChecked':
        const checkedAmount = info.tokenAmount?.uiAmount || 0;
        return `Transfer ${checkedAmount} tokens (checked)`;

      case 'mintTo':
        const mintAmount = info.amount || 0;
        return `Mint ${mintAmount} tokens`;

      case 'burn':
        const burnAmount = info.amount || 0;
        return `Burn ${burnAmount} tokens`;

      case 'approve':
        const approveAmount = info.amount || 0;
        return `Approve ${approveAmount} tokens for spending`;

      case 'initializeAccount':
        return 'Initialize token account';

      case 'initializeMint':
        return 'Initialize token mint';

      case 'closeAccount':
        return 'Close token account';

      default:
        return `Token ${instructionType} instruction`;
    }
  }

  /**
   * Generate Associated Token Account instruction descriptions
   */
  private generateATAProgramDescription(instructionType: string, info: any): string {
    switch (instructionType) {
      case 'create':
        const owner = info?.owner || 'unknown owner';
        const mint = info?.mint || 'unknown mint';
        return `Create associated token account for ${owner} (mint: ${mint})`;

      default:
        const additionalInfo = info ? ` with ${Object.keys(info).length} parameters` : '';
        return `ATA ${instructionType} instruction${additionalInfo}`;
    }
  }

  /**
   * Analyze account roles in instruction
   */
  private analyzeAccountRoles(
    program: ProgramDefinition,
    instructionType: string,
    accounts: string[],
    info: any
  ): InstructionAccountRole[] {
    const roles: InstructionAccountRole[] = [];

    // System Program account roles
    if (program.programId === '11111111111111111111111111111111') {
      switch (instructionType) {
        case 'transfer':
          if (accounts.length >= 2) {
            const transferAmount = info?.lamports || info?.amount || 'unknown amount';
            roles.push(
              { pubkey: accounts[0], role: 'payer', description: `Source account (transferring ${transferAmount} lamports)`, isSigner: true, isWritable: true },
              { pubkey: accounts[1], role: 'recipient', description: `Destination account (receiving ${transferAmount} lamports)`, isSigner: false, isWritable: true }
            );
          }
          break;

        case 'createAccount':
          if (accounts.length >= 2) {
            roles.push(
              { pubkey: accounts[0], role: 'payer', description: 'Funding account', isSigner: true, isWritable: true },
              { pubkey: accounts[1], role: 'recipient', description: 'New account', isSigner: true, isWritable: true }
            );
          }
          break;
      }
    }

    // SPL Token account roles
    if (program.programId === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') {
      switch (instructionType) {
        case 'transfer':
        case 'transferChecked':
          if (accounts.length >= 3) {
            roles.push(
              { pubkey: accounts[0], role: 'token_account', description: 'Source token account', isSigner: false, isWritable: true },
              { pubkey: accounts[1], role: 'token_account', description: 'Destination token account', isSigner: false, isWritable: true },
              { pubkey: accounts[2], role: 'authority', description: 'Transfer authority', isSigner: true, isWritable: false }
            );
          }
          break;

        case 'mintTo':
          if (accounts.length >= 3) {
            roles.push(
              { pubkey: accounts[0], role: 'mint', description: 'Token mint', isSigner: false, isWritable: true },
              { pubkey: accounts[1], role: 'token_account', description: 'Destination token account', isSigner: false, isWritable: true },
              { pubkey: accounts[2], role: 'authority', description: 'Mint authority', isSigner: true, isWritable: false }
            );
          }
          break;
      }
    }

    // Fill remaining accounts with generic roles
    for (let i = roles.length; i < accounts.length; i++) {
      roles.push({
        pubkey: accounts[i],
        role: 'unknown',
        description: `Account ${i}`,
        isSigner: false,
        isWritable: false
      });
    }

    return roles;
  }

  /**
   * Extract parameters from instruction info
   * Accepts optional accounts list to detect parameters that are addresses
   */
  private extractParameters(info: any, accounts: string[] = []): InstructionParameter[] {
    const parameters: InstructionParameter[] = [];

    for (const [key, value] of Object.entries(info)) {
      // Treat common address-like keys as addresses regardless of value contents
      const keyLooksLikeAddress = /source|destination|owner|mint|account|pubkey|recipient|payer/i.test(key);

      if (typeof value === 'object' && value !== null) {
        // Handle nested objects like tokenAmount
        if ('uiAmount' in value) {
          parameters.push({
            name: key,
            value: value.uiAmount,
            type: 'amount',
            description: `${key} amount`
          });
        } else {
          parameters.push({
            name: key,
            value: JSON.stringify(value),
            type: 'string',
            description: `${key} data`
          });
        }
      } else {
        // If the value matches one of the provided accounts, mark as address
        const valueLooksLikeAccount = (typeof value === 'string') && accounts.includes(value);

        const paramType = keyLooksLikeAddress || valueLooksLikeAccount
          ? 'address'
          : this.inferParameterType(value);

        parameters.push({
          name: key,
          value,
          type: paramType,
          description: `${key} parameter`
        });
      }
    }

    return parameters;
  }

  /**
   * Infer parameter type from value
   */
  private inferParameterType(value: any): 'amount' | 'address' | 'string' | 'number' | 'boolean' | 'bytes' {
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'string') {
      // Check if it looks like a Solana address
      if (value.length >= 32 && value.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(value)) {
        return 'address';
      }
      return 'string';
    }
    return 'bytes';
  }

  /**
   * Extract instruction discriminator from data
   */
  private extractDiscriminator(data: string): string {
    if (!data) return '';
    // Accept both short hex (e.g. '03') and full hex sequences.
    // Try exact match first for full-length hex discriminators
    if (data.length >= 8) {
      return data.slice(0, 8);
    }
    return data;
  }

  /**
   * Get known program name
   */
  private getKnownProgramName(programId: string): string | undefined {
    const knownPrograms: Record<string, string> = {
      '11111111111111111111111111111111': 'System Program',
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': 'SPL Token',
      'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL': 'Associated Token Account',
      'ComputeBudget111111111111111111111111111111': 'Compute Budget',
      'Vote111111111111111111111111111111111111111': 'Vote Program',
      'Stake11111111111111111111111111111111111111': 'Stake Program'
    };

    return knownPrograms[programId];
  }

  /**
   * Generate cache key for instruction parsing
   */
  private generateInstructionCacheKey(
    programId: string,
    accounts: string[],
    data: string,
    parsed?: any
  ): string {
    const accountsHash = accounts.join(',');
    const parsedHash = parsed ? JSON.stringify(parsed) : '';
    return `${programId}_${data}_${accountsHash}_${parsedHash}`.substring(0, 128);
  }

  /**
   * Initialize program registry with known programs
   */
  private initializeProgramRegistry(): void {
    // Load all program definitions from the registry
    const allPrograms = getAllProgramDefinitions();

    // Register each program
    allPrograms.forEach(program => {
      this.programRegistry.set(program.programId, program);
    });

    // Fallback to legacy initialization if registry is empty
    if (this.programRegistry.size === 0) {
      console.warn('Program registry is empty, falling back to legacy initialization');
      this.initializeProgramRegistryLegacy();
    }
  }

  /**
   * Legacy initialization method - replaced with program registry
   */
  private initializeProgramRegistryLegacy(): void {
    // System Program
    this.programRegistry.set('11111111111111111111111111111111', {
      programId: '11111111111111111111111111111111',
      name: 'System Program',
      description: 'Core Solana system program for account management',
      category: 'system',
      website: 'https://docs.solana.com/developing/runtime-facilities/programs#system-program',
      instructions: [
        {
          discriminator: '00000000',
          name: 'createAccount',
          description: 'Create a new account',
          category: 'account',
          riskLevel: 'low',
          accounts: [
            { name: 'funding', description: 'Funding account', isSigner: true, isWritable: true, role: 'payer' },
            { name: 'new', description: 'New account', isSigner: true, isWritable: true, role: 'recipient' }
          ],
          parameters: [
            { name: 'lamports', type: 'number', description: 'Lamports to fund the account' },
            { name: 'space', type: 'number', description: 'Space to allocate' },
            { name: 'owner', type: 'address', description: 'Owner program' }
          ]
        },
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
        },
        {
          discriminator: '00000001',
          name: 'assign',
          description: 'Assign account to a program',
          category: 'account',
          riskLevel: 'medium',
          accounts: [
            { name: 'account', description: 'Account to assign', isSigner: true, isWritable: true, role: 'recipient' }
          ],
          parameters: [
            { name: 'owner', type: 'address', description: 'New owner program' }
          ]
        },
        {
          discriminator: '00000008',
          name: 'allocate',
          description: 'Allocate space for account',
          category: 'account',
          riskLevel: 'low',
          accounts: [
            { name: 'account', description: 'Account to allocate', isSigner: true, isWritable: true, role: 'recipient' }
          ],
          parameters: [
            { name: 'space', type: 'number', description: 'Space to allocate in bytes' }
          ]
        }
      ]
    });

    // SPL Token Program
    this.programRegistry.set('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', {
      programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
      name: 'SPL Token',
      description: 'Solana Program Library Token program',
      category: 'token',
      website: 'https://spl.solana.com/token',
      documentation: 'https://docs.rs/spl-token/',
      instructions: [
        {
          discriminator: '00',
          name: 'initializeMint',
          description: 'Initialize a new token mint',
          category: 'mint',
          riskLevel: 'medium',
          accounts: [
            { name: 'mint', description: 'Token mint account', isSigner: false, isWritable: true, role: 'mint' },
            { name: 'rent', description: 'Rent sysvar', isSigner: false, isWritable: false, role: 'system' }
          ],
          parameters: [
            { name: 'decimals', type: 'number', description: 'Number of decimals' },
            { name: 'mintAuthority', type: 'address', description: 'Mint authority' },
            { name: 'freezeAuthority', type: 'address', description: 'Freeze authority (optional)', optional: true }
          ]
        },
        {
          discriminator: '01',
          name: 'initializeAccount',
          description: 'Initialize a token account',
          category: 'account',
          riskLevel: 'low',
          accounts: [
            { name: 'account', description: 'Token account', isSigner: false, isWritable: true, role: 'token_account' },
            { name: 'mint', description: 'Token mint', isSigner: false, isWritable: false, role: 'mint' },
            { name: 'owner', description: 'Account owner', isSigner: false, isWritable: false, role: 'authority' },
            { name: 'rent', description: 'Rent sysvar', isSigner: false, isWritable: false, role: 'system' }
          ],
          parameters: []
        },
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
        },
        {
          discriminator: '07',
          name: 'mintTo',
          description: 'Mint tokens to an account',
          category: 'mint',
          riskLevel: 'medium',
          accounts: [
            { name: 'mint', description: 'Token mint', isSigner: false, isWritable: true, role: 'mint' },
            { name: 'destination', description: 'Destination token account', isSigner: false, isWritable: true, role: 'token_account' },
            { name: 'authority', description: 'Mint authority', isSigner: true, isWritable: false, role: 'authority' }
          ],
          parameters: [
            { name: 'amount', type: 'number', description: 'Amount to mint' }
          ]
        },
        {
          discriminator: '08',
          name: 'burn',
          description: 'Burn tokens from an account',
          category: 'burn',
          riskLevel: 'medium',
          accounts: [
            { name: 'account', description: 'Token account to burn from', isSigner: false, isWritable: true, role: 'token_account' },
            { name: 'mint', description: 'Token mint', isSigner: false, isWritable: true, role: 'mint' },
            { name: 'authority', description: 'Burn authority', isSigner: true, isWritable: false, role: 'authority' }
          ],
          parameters: [
            { name: 'amount', type: 'number', description: 'Amount to burn' }
          ]
        },
        {
          discriminator: '0C',
          name: 'transferChecked',
          description: 'Transfer tokens with additional checks',
          category: 'transfer',
          riskLevel: 'low',
          accounts: [
            { name: 'source', description: 'Source token account', isSigner: false, isWritable: true, role: 'token_account' },
            { name: 'mint', description: 'Token mint', isSigner: false, isWritable: false, role: 'mint' },
            { name: 'destination', description: 'Destination token account', isSigner: false, isWritable: true, role: 'token_account' },
            { name: 'authority', description: 'Transfer authority', isSigner: true, isWritable: false, role: 'authority' }
          ],
          parameters: [
            { name: 'amount', type: 'number', description: 'Amount to transfer' },
            { name: 'decimals', type: 'number', description: 'Token decimals' }
          ]
        }
      ]
    });

    // Associated Token Account Program
    this.programRegistry.set('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', {
      programId: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
      name: 'Associated Token Account',
      description: 'Program for creating associated token accounts',
      category: 'token',
      website: 'https://spl.solana.com/associated-token-account',
      instructions: [
        {
          discriminator: '00',
          name: 'create',
          description: 'Create associated token account',
          category: 'account',
          riskLevel: 'low',
          accounts: [
            { name: 'payer', description: 'Funding account', isSigner: true, isWritable: true, role: 'payer' },
            { name: 'associatedAccount', description: 'Associated token account', isSigner: false, isWritable: true, role: 'token_account' },
            { name: 'owner', description: 'Wallet address', isSigner: false, isWritable: false, role: 'authority' },
            { name: 'mint', description: 'Token mint', isSigner: false, isWritable: false, role: 'mint' },
            { name: 'systemProgram', description: 'System program', isSigner: false, isWritable: false, role: 'program' },
            { name: 'tokenProgram', description: 'Token program', isSigner: false, isWritable: false, role: 'program' }
          ],
          parameters: []
        }
      ]
    });

    // Compute Budget Program
    this.programRegistry.set('ComputeBudget111111111111111111111111111111', {
      programId: 'ComputeBudget111111111111111111111111111111',
      name: 'Compute Budget',
      description: 'Program for setting compute budget and priority fees',
      category: 'system',
      website: 'https://docs.solana.com/developing/programming-model/runtime#compute-budget',
      instructions: [
        {
          discriminator: '00',
          name: 'requestUnits',
          description: 'Request compute units',
          category: 'budget',
          riskLevel: 'low',
          accounts: [],
          parameters: [
            { name: 'units', type: 'number', description: 'Compute units to request' },
            { name: 'additionalFee', type: 'number', description: 'Additional fee in lamports' }
          ]
        },
        {
          discriminator: '01',
          name: 'requestHeapFrame',
          description: 'Request heap frame',
          category: 'budget',
          riskLevel: 'low',
          accounts: [],
          parameters: [
            { name: 'bytes', type: 'number', description: 'Heap frame size in bytes' }
          ]
        },
        {
          discriminator: '02',
          name: 'setComputeUnitLimit',
          description: 'Set compute unit limit',
          category: 'budget',
          riskLevel: 'low',
          accounts: [],
          parameters: [
            { name: 'units', type: 'number', description: 'Compute unit limit' }
          ]
        },
        {
          discriminator: '03',
          name: 'setComputeUnitPrice',
          description: 'Set compute unit price (priority fee)',
          category: 'budget',
          riskLevel: 'low',
          accounts: [],
          parameters: [
            { name: 'microLamports', type: 'number', description: 'Price per compute unit in micro-lamports' }
          ]
        }
      ]
    });

    // Metaplex Token Metadata Program
    this.programRegistry.set('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s', {
      programId: 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
      name: 'Metaplex Token Metadata',
      description: 'Program for NFT and token metadata',
      category: 'nft',
      website: 'https://docs.metaplex.com/',
      instructions: [
        {
          discriminator: '2A',
          name: 'createMetadataAccount',
          description: 'Create metadata account for token',
          category: 'metadata',
          riskLevel: 'medium',
          accounts: [
            { name: 'metadata', description: 'Metadata account', isSigner: false, isWritable: true, role: 'recipient' },
            { name: 'mint', description: 'Token mint', isSigner: false, isWritable: false, role: 'mint' },
            { name: 'mintAuthority', description: 'Mint authority', isSigner: true, isWritable: false, role: 'authority' },
            { name: 'payer', description: 'Fee payer', isSigner: true, isWritable: true, role: 'payer' },
            { name: 'updateAuthority', description: 'Update authority', isSigner: false, isWritable: false, role: 'authority' }
          ],
          parameters: [
            { name: 'name', type: 'string', description: 'Token name' },
            { name: 'symbol', type: 'string', description: 'Token symbol' },
            { name: 'uri', type: 'string', description: 'Metadata URI' }
          ]
        }
      ]
    });

    // Jupiter Aggregator (popular DEX aggregator)
    this.programRegistry.set('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', {
      programId: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
      name: 'Jupiter Aggregator',
      description: 'DEX aggregator for optimal token swaps',
      category: 'defi',
      website: 'https://jup.ag/',
      instructions: [
        {
          discriminator: 'E445A52E51CB9A1D',
          name: 'route',
          description: 'Execute token swap route',
          category: 'swap',
          riskLevel: 'medium',
          accounts: [
            { name: 'tokenProgram', description: 'Token program', isSigner: false, isWritable: false, role: 'program' },
            { name: 'userTransferAuthority', description: 'User transfer authority', isSigner: true, isWritable: false, role: 'authority' },
            { name: 'userSourceTokenAccount', description: 'User source token account', isSigner: false, isWritable: true, role: 'token_account' },
            { name: 'userDestinationTokenAccount', description: 'User destination token account', isSigner: false, isWritable: true, role: 'token_account' }
          ],
          parameters: [
            { name: 'routePlan', type: 'bytes', description: 'Swap route plan' },
            { name: 'inAmount', type: 'number', description: 'Input token amount' },
            { name: 'quotedOutAmount', type: 'number', description: 'Expected output amount' },
            { name: 'slippageBps', type: 'number', description: 'Slippage tolerance in basis points' }
          ]
        }
      ]
    });

    // Raydium AMM
    this.programRegistry.set('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', {
      programId: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
      name: 'Raydium AMM',
      description: 'Automated Market Maker for token swaps',
      category: 'defi',
      website: 'https://raydium.io/',
      instructions: [
        {
          discriminator: '09',
          name: 'swap',
          description: 'Swap tokens in AMM pool',
          category: 'swap',
          riskLevel: 'medium',
          accounts: [
            { name: 'tokenProgram', description: 'Token program', isSigner: false, isWritable: false, role: 'program' },
            { name: 'ammId', description: 'AMM pool ID', isSigner: false, isWritable: true, role: 'program' },
            { name: 'ammAuthority', description: 'AMM authority', isSigner: false, isWritable: false, role: 'authority' },
            { name: 'userTokenSource', description: 'User source token account', isSigner: false, isWritable: true, role: 'token_account' },
            { name: 'userTokenDestination', description: 'User destination token account', isSigner: false, isWritable: true, role: 'token_account' }
          ],
          parameters: [
            { name: 'amountIn', type: 'number', description: 'Input token amount' },
            { name: 'minimumAmountOut', type: 'number', description: 'Minimum output amount' }
          ]
        }
      ]
    });
  }

  /**
   * Analyze instruction data to provide additional context
   */
  private analyzeInstructionData(data: string): string | null {
    if (!data || data.length === 0) {
      return null;
    }

    try {
      // Basic analysis of instruction data
      const dataLength = data.length;
      if (dataLength <= 8) {
        return `${dataLength / 2} bytes`;
      } else if (dataLength <= 64) {
        return `${dataLength / 2} bytes, likely simple operation`;
      } else {
        return `${dataLength / 2} bytes, complex operation`;
      }
    } catch (error) {
      return 'malformed data';
    }
  }
}

// Export singleton instance
export const instructionParserService = new InstructionParserService();

// Export utility functions
export function parseInstructions(transaction: any): Promise<ParsedInstructionInfo[]> {
  if (!transaction?.transaction?.message?.instructions) {
    return Promise.resolve([]);
  }

  const instructions = transaction.transaction.message.instructions;
  const accountKeys = transaction.transaction.message.accountKeys;

  return Promise.all(
    instructions.map(async (instruction: any, index: number) => {
      const programId = accountKeys[instruction.programIdIndex];
      const accounts = instruction.accounts.map((accountIndex: number) => accountKeys[accountIndex]);
      const data = instruction.data;
      const parsed = instruction.parsed;

      // Parse instruction with position context
      const parsedInstruction = await instructionParserService.parseInstruction(programId, accounts, data, parsed);

      // Add instruction position metadata
      return {
        ...parsedInstruction,
        instructionIndex: index,
        description: `[${index}] ${parsedInstruction.description}`
      };
    })
  );
}
