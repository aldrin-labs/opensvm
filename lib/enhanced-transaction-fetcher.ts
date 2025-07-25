/**
 * Enhanced Transaction Fetcher
 * 
 * This service provides comprehensive transaction data collection including:
 * - Pre/post account states
 * - Detailed instruction parsing
 * - Account change analysis
 * - Transaction metadata enrichment
 */

import {
  Connection,
  PublicKey,
  ParsedTransactionWithMeta,
  ParsedInstruction,
  PartiallyDecodedInstruction,
  AccountInfo,
  TokenBalance
} from '@solana/web3.js';
import { getConnection } from './solana-connection';
import { instructionParserService } from './instruction-parser-service';
import { transactionMetadataEnricher, type TransactionMetadataEnrichment } from './transaction-metadata-enricher';

// Enhanced transaction data types
export interface EnhancedTransactionData {
  signature: string;
  slot: number;
  blockTime: number | null;
  meta: EnhancedTransactionMeta;
  transaction: EnhancedTransactionInfo;
  accountStates: AccountStateData[];
  instructionData: EnhancedInstructionData[];
  metrics: TransactionMetrics;
  enrichment?: TransactionMetadataEnrichment;
}

export interface EnhancedTransactionMeta {
  err: any;
  fee: number;
  preBalances: number[];
  postBalances: number[];
  preTokenBalances: TokenBalance[];
  postTokenBalances: TokenBalance[];
  logMessages: string[];
  innerInstructions: any[];
  computeUnitsConsumed?: number;
  loadedAddresses?: {
    readonly: PublicKey[];
    writable: PublicKey[];
  };
}

export interface EnhancedTransactionInfo {
  signatures: string[];
  message: {
    accountKeys: EnhancedAccountKey[];
    instructions: EnhancedInstruction[];
    recentBlockhash: string;
  };
}

export interface EnhancedAccountKey {
  pubkey: string;
  signer: boolean;
  writable: boolean;
  source: 'transaction' | 'lookupTable';
}

export interface EnhancedInstruction {
  programId: string;
  accounts: string[];
  data: string;
  parsed?: any;
  stackHeight?: number;
}

export interface AccountStateData {
  address: string;
  beforeState: AccountInfo<Buffer> | null;
  afterState: AccountInfo<Buffer> | null;
  lamportsDiff: number;
  tokenChanges: TokenStateChange[];
  dataChanges: AccountDataChange | null;
}

export interface TokenStateChange {
  mint: string;
  beforeAmount: string;
  afterAmount: string;
  difference: string;
  decimals: number;
  uiAmountBefore: number | null;
  uiAmountAfter: number | null;
}

export interface AccountDataChange {
  beforeHash: string;
  afterHash: string;
  sizeChange: number;
  hasSignificantChanges: boolean;
  changedFields?: string[];
}

export interface EnhancedInstructionData {
  index: number;
  programId: string;
  programName?: string;
  instructionType?: string;
  description?: string;
  accounts: InstructionAccountInfo[];
  data: {
    raw: string;
    parsed?: any;
    discriminator?: string;
  };
  innerInstructions: EnhancedInstructionData[];
  computeUnits?: number;
  logs: string[];
}

export interface InstructionAccountInfo {
  pubkey: string;
  isSigner: boolean;
  isWritable: boolean;
  role?: 'payer' | 'recipient' | 'authority' | 'program' | 'system';
}

export interface TransactionMetrics {
  totalFee: number;
  computeUnitsUsed: number;
  computeUnitsRequested: number;
  efficiency: number;
  size: number;
  accountsModified: number;
  instructionCount: number;
  innerInstructionCount: number;
  priorityFee?: number;
  baseFee: number;
  feePerComputeUnit: number;
}

export class EnhancedTransactionFetcher {
  private connection: Connection;

  constructor(connection?: Connection) {
    this.connection = connection || null as any; // Will be set in init
  }

  private async init() {
    if (!this.connection) {
      this.connection = await getConnection();
    }
  }

  /**
   * Fetch comprehensive transaction data with enhanced metadata
   */
  async fetchEnhancedTransaction(signature: string): Promise<EnhancedTransactionData> {
    await this.init();

    // Fetch the parsed transaction
    const tx = await this.connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed'
    });

    if (!tx) {
      throw new Error(`Transaction not found: ${signature}`);
    }

    // Get account states before and after transaction
    const accountStates = await this.getAccountStates(tx);

    // Parse instructions with enhanced data
    const instructionData = await this.parseInstructions(tx);

    // Calculate transaction metrics
    const metrics = this.calculateMetrics(tx, instructionData);

    // Build enhanced transaction data
    const enhancedData: EnhancedTransactionData = {
      signature,
      slot: tx.slot,
      blockTime: tx.blockTime || null,
      meta: {
        err: tx.meta?.err || null,
        fee: tx.meta?.fee || 0,
        preBalances: tx.meta?.preBalances || [],
        postBalances: tx.meta?.postBalances || [],
        preTokenBalances: tx.meta?.preTokenBalances || [],
        postTokenBalances: tx.meta?.postTokenBalances || [],
        logMessages: tx.meta?.logMessages || [],
        innerInstructions: tx.meta?.innerInstructions || [],
        computeUnitsConsumed: tx.meta?.computeUnitsConsumed,
        loadedAddresses: tx.meta?.loadedAddresses
      },
      transaction: {
        signatures: tx.transaction.signatures,
        message: {
          accountKeys: this.enhanceAccountKeys(tx),
          instructions: this.enhanceInstructions(tx),
          recentBlockhash: tx.transaction.message.recentBlockhash
        }
      },
      accountStates,
      instructionData,
      metrics
    };

    // Add metadata enrichment
    try {
      enhancedData.enrichment = await transactionMetadataEnricher.enrichTransaction(enhancedData);
    } catch (error) {
      console.warn('Failed to enrich transaction metadata:', error);
      // Continue without enrichment rather than failing the entire request
    }

    return enhancedData;
  }

  /**
   * Get account states before and after transaction
   */
  private async getAccountStates(tx: ParsedTransactionWithMeta): Promise<AccountStateData[]> {
    const accountKeys = tx.transaction.message.accountKeys;
    const preBalances = tx.meta?.preBalances || [];
    const postBalances = tx.meta?.postBalances || [];
    const preTokenBalances = tx.meta?.preTokenBalances || [];
    const postTokenBalances = tx.meta?.postTokenBalances || [];

    const accountStates: AccountStateData[] = [];

    for (let i = 0; i < accountKeys.length; i++) {
      const accountKey = accountKeys[i];
      const address = accountKey.pubkey.toString();
      
      // Calculate lamports difference
      const preLamports = preBalances[i] || 0;
      const postLamports = postBalances[i] || 0;
      const lamportsDiff = postLamports - preLamports;

      // Find token changes for this account
      const tokenChanges: TokenStateChange[] = [];
      
      // Match pre and post token balances
      const preTokens = preTokenBalances.filter(tb => tb.accountIndex === i);
      const postTokens = postTokenBalances.filter(tb => tb.accountIndex === i);

      // Create a map of token changes
      const tokenChangeMap = new Map<string, TokenStateChange>();

      preTokens.forEach(preToken => {
        const postToken = postTokens.find(pt => pt.mint === preToken.mint);
        tokenChangeMap.set(preToken.mint, {
          mint: preToken.mint,
          beforeAmount: preToken.uiTokenAmount.amount,
          afterAmount: postToken?.uiTokenAmount.amount || '0',
          difference: (BigInt(postToken?.uiTokenAmount.amount || '0') - BigInt(preToken.uiTokenAmount.amount)).toString(),
          decimals: preToken.uiTokenAmount.decimals,
          uiAmountBefore: preToken.uiTokenAmount.uiAmount,
          uiAmountAfter: postToken?.uiTokenAmount.uiAmount || 0
        });
      });

      postTokens.forEach(postToken => {
        if (!tokenChangeMap.has(postToken.mint)) {
          tokenChangeMap.set(postToken.mint, {
            mint: postToken.mint,
            beforeAmount: '0',
            afterAmount: postToken.uiTokenAmount.amount,
            difference: postToken.uiTokenAmount.amount,
            decimals: postToken.uiTokenAmount.decimals,
            uiAmountBefore: 0,
            uiAmountAfter: postToken.uiTokenAmount.uiAmount
          });
        }
      });

      tokenChanges.push(...tokenChangeMap.values());

      // For now, we'll set beforeState and afterState to null
      // In a full implementation, we would fetch account data at specific slots
      accountStates.push({
        address,
        beforeState: null,
        afterState: null,
        lamportsDiff,
        tokenChanges,
        dataChanges: null
      });
    }

    return accountStates;
  }

  /**
   * Parse instructions with enhanced metadata
   */
  private async parseInstructions(tx: ParsedTransactionWithMeta): Promise<EnhancedInstructionData[]> {
    const instructions = tx.transaction.message.instructions;
    const innerInstructions = tx.meta?.innerInstructions || [];
    const logs = tx.meta?.logMessages || [];

    const enhancedInstructions: EnhancedInstructionData[] = [];

    for (let i = 0; i < instructions.length; i++) {
      const instruction = instructions[i];
      const innerIxs = innerInstructions.find(inner => inner.index === i);

      // Parse inner instructions recursively
      const parsedInnerInstructions: EnhancedInstructionData[] = [];
      if (innerIxs) {
        for (let j = 0; j < innerIxs.instructions.length; j++) {
          const innerIx = innerIxs.instructions[j];
          parsedInnerInstructions.push(await this.parseInstruction(innerIx, `${i}.${j}`, logs));
        }
      }

      const enhancedInstruction = await this.parseInstruction(instruction, i.toString(), logs);
      enhancedInstruction.innerInstructions = parsedInnerInstructions;
      
      enhancedInstructions.push(enhancedInstruction);
    }

    return enhancedInstructions;
  }

  /**
   * Parse a single instruction with enhanced data
   */
  private async parseInstruction(
    instruction: ParsedInstruction | PartiallyDecodedInstruction,
    index: string,
    logs: string[]
  ): Promise<EnhancedInstructionData> {
    const programId = instruction.programId.toString();
    
    // Extract relevant logs for this instruction
    const instructionLogs = logs.filter(log => 
      log.includes(`Program ${programId}`) || 
      log.includes(`invoke [${index}]`)
    );

    // Use instruction parser service for comprehensive analysis
    // Handle different instruction types safely
    let accounts: string[] = [];
    let data: string = '';
    let parsed: any = undefined;
    
    if ('accounts' in instruction && instruction.accounts) {
      accounts = instruction.accounts.map((acc: any) => acc.toString());
    }
    
    if ('data' in instruction && instruction.data) {
      data = instruction.data;
    }
    
    if ('parsed' in instruction) {
      parsed = instruction.parsed;
    }
    
    const parsedInfo = await instructionParserService.parseInstruction(
      programId,
      accounts,
      data,
      parsed
    );

    // Build enhanced account info with roles from parser
    const enhancedAccounts: InstructionAccountInfo[] = accounts.map((accountPubkey: string, i: number) => {
      const roleInfo = parsedInfo.accounts[i];
      return {
        pubkey: accountPubkey,
        isSigner: roleInfo?.isSigner || false,
        isWritable: roleInfo?.isWritable || false,
        role: roleInfo?.role as any || undefined
      };
    });

    return {
      index: parseInt(index.split('.')[0]),
      programId,
      programName: parsedInfo.programName,
      instructionType: parsedInfo.instructionType,
      description: parsedInfo.description,
      accounts: enhancedAccounts,
      data: {
        raw: data,
        parsed,
        discriminator: this.extractDiscriminator(data)
      },
      innerInstructions: [],
      logs: instructionLogs
    };
  }

  /**
   * Calculate comprehensive transaction metrics
   */
  private calculateMetrics(
    tx: ParsedTransactionWithMeta,
    instructions: EnhancedInstructionData[]
  ): TransactionMetrics {
    const fee = tx.meta?.fee || 0;
    const computeUnitsUsed = tx.meta?.computeUnitsConsumed || 0;
    const instructionCount = instructions.length;
    const innerInstructionCount = instructions.reduce(
      (sum, ix) => sum + ix.innerInstructions.length,
      0
    );

    // Calculate transaction size (approximate)
    const size = JSON.stringify(tx).length;

    // Count modified accounts
    const accountsModified = (tx.meta?.preBalances || []).filter(
      (pre, i) => pre !== (tx.meta?.postBalances || [])[i]
    ).length;

    // Estimate compute units requested (would need more sophisticated calculation)
    const computeUnitsRequested = Math.max(computeUnitsUsed, 200000); // Default estimate

    // Calculate efficiency
    const efficiency = computeUnitsUsed > 0 ? (computeUnitsUsed / computeUnitsRequested) * 100 : 0;

    // Calculate fee breakdown
    const baseFee = 5000; // Base fee in lamports
    const priorityFee = Math.max(0, fee - baseFee);
    const feePerComputeUnit = computeUnitsUsed > 0 ? fee / computeUnitsUsed : 0;

    return {
      totalFee: fee,
      computeUnitsUsed,
      computeUnitsRequested,
      efficiency,
      size,
      accountsModified,
      instructionCount,
      innerInstructionCount,
      priorityFee,
      baseFee,
      feePerComputeUnit
    };
  }

  /**
   * Enhance account keys with additional metadata
   */
  private enhanceAccountKeys(tx: ParsedTransactionWithMeta): EnhancedAccountKey[] {
    return tx.transaction.message.accountKeys.map(key => ({
      pubkey: key.pubkey.toString(),
      signer: key.signer,
      writable: key.writable,
      source: 'transaction' as const
    }));
  }

  /**
   * Enhance instructions with additional metadata
   */
  private enhanceInstructions(tx: ParsedTransactionWithMeta): EnhancedInstruction[] {
    return tx.transaction.message.instructions.map(ix => {
      let accounts: string[] = [];
      let data: string = '';
      let parsed: any = undefined;
      let stackHeight: number | undefined = undefined;
      
      if ('accounts' in ix && ix.accounts) {
        accounts = ix.accounts.map((acc: any) => acc.toString());
      }
      
      if ('data' in ix && ix.data) {
        data = ix.data;
      }
      
      if ('parsed' in ix) {
        parsed = ix.parsed;
      }
      
      if ('stackHeight' in ix && typeof ix.stackHeight === 'number') {
        stackHeight = ix.stackHeight;
      }
      
      return {
        programId: ix.programId.toString(),
        accounts,
        data,
        parsed,
        stackHeight
      };
    });
  }

  /**
   * Get program name from program ID
   */
  private getProgramName(programId: string): string | undefined {
    const knownPrograms: Record<string, string> = {
      '11111111111111111111111111111111': 'System Program',
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': 'SPL Token',
      'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL': 'Associated Token Account',
      'ComputeBudget111111111111111111111111111111': 'Compute Budget',
      'Vote111111111111111111111111111111111111111': 'Vote Program'
    };

    return knownPrograms[programId];
  }

  /**
   * Generate human-readable instruction description
   */
  private generateInstructionDescription(parsed: any): string {
    if (!parsed || !parsed.type) return 'Unknown instruction';

    switch (parsed.type) {
      case 'transfer':
        return `Transfer ${parsed.info?.lamports || 0} lamports`;
      case 'transferChecked':
        return `Transfer ${parsed.info?.tokenAmount?.uiAmount || 0} tokens`;
      case 'createAccount':
        return 'Create new account';
      case 'initializeAccount':
        return 'Initialize token account';
      default:
        return `${parsed.type} instruction`;
    }
  }

  /**
   * Determine account role in instruction
   */
  private determineAccountRole(
    accountPubkey: string,
    instruction: ParsedInstruction | PartiallyDecodedInstruction
  ): string | undefined {
    if ('parsed' in instruction && instruction.parsed?.info) {
      const info = instruction.parsed.info;
      
      if (info.source === accountPubkey) return 'payer';
      if (info.destination === accountPubkey) return 'recipient';
      if (info.authority === accountPubkey) return 'authority';
    }

    return undefined;
  }

  /**
   * Extract instruction discriminator from data
   */
  private extractDiscriminator(data: string): string | undefined {
    if (data.length >= 16) {
      return data.slice(0, 16); // First 8 bytes as hex
    }
    return undefined;
  }
}

// Export singleton instance
export const enhancedTransactionFetcher = new EnhancedTransactionFetcher();