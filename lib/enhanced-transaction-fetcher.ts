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

import type { TransactionMetadataEnrichment } from './transaction-metadata-enricher';

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
  programName?: string;
  accounts: string[];
  data: string;
  parsed?: any;
  stackHeight?: number;
  description?: string;
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

    // Validate transaction signature format before making RPC call
    if (!this.isValidTransactionSignature(signature)) {
      console.error(`[EnhancedTransactionFetcher] Invalid signature format: ${signature} (length: ${signature.length})`);
      throw new Error(`Invalid transaction signature format: ${signature}`);
    }

    console.log(`[EnhancedTransactionFetcher] Fetching transaction: ${signature}`);

    // Fetch the parsed transaction with timeout
    const tx = await Promise.race([
      this.connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed'
      }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Transaction fetch timed out')), 8000); // 8 second timeout
      })
    ]) as ParsedTransactionWithMeta;

    if (!tx) {
      throw new Error(`Transaction not found: ${signature}`);
    }

    // Get account states before and after transaction (lightweight version)
    const accountStates = this.getAccountStatesLightweight(tx);

    // Parse instructions with basic data (skip heavy processing)
    const instructionData = this.parseInstructionsBasic(tx);

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

    // Skip metadata enrichment for now to avoid timeouts
    // This can be done asynchronously later if needed

    return enhancedData;
  }

  /**
   * Fetch basic transaction data for faster response (fallback method)
   */
  async fetchBasicTransaction(signature: string): Promise<ParsedTransactionWithMeta> {
    await this.init();

    // Validate transaction signature format before making RPC call
    if (!this.isValidTransactionSignature(signature)) {
      console.error(`[EnhancedTransactionFetcher] Invalid signature format: ${signature} (length: ${signature.length})`);
      throw new Error(`Invalid transaction signature format: ${signature}`);
    }

    console.log(`[EnhancedTransactionFetcher] Fetching basic transaction: ${signature}`);

    // Fetch the parsed transaction with shorter timeout
    const tx = await Promise.race([
      this.connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed'
      }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Basic transaction fetch timed out')), 5000); // 5 second timeout
      })
    ]) as ParsedTransactionWithMeta;

    if (!tx) {
      throw new Error(`Transaction not found: ${signature}`);
    }

    return tx;
  }

  /**
   * Get account states before and after transaction (lightweight version)
   */
  private getAccountStatesLightweight(tx: ParsedTransactionWithMeta): AccountStateData[] {
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

      // Find token changes for this account (simplified)
      const tokenChanges: TokenStateChange[] = [];

      // Match pre and post token balances
      const preTokens = preTokenBalances.filter(tb => tb.accountIndex === i);
      const postTokens = postTokenBalances.filter(tb => tb.accountIndex === i);

      // Simple token change tracking
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

      // Skip heavy account state fetching for performance
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
   * Get account states before and after transaction
   */
  // private async getAccountStates(tx: ParsedTransactionWithMeta): Promise<AccountStateData[]> {
  //   const accountKeys = tx.transaction.message.accountKeys;
  //   const preBalances = tx.meta?.preBalances || [];
  //   const postBalances = tx.meta?.postBalances || [];
  //   const preTokenBalances = tx.meta?.preTokenBalances || [];
  //   const postTokenBalances = tx.meta?.postTokenBalances || [];

  //   const accountStates: AccountStateData[] = [];

  //   for (let i = 0; i < accountKeys.length; i++) {
  //     const accountKey = accountKeys[i];
  //     const address = accountKey.pubkey.toString();

  //     // Calculate lamports difference
  //     const preLamports = preBalances[i] || 0;
  //     const postLamports = postBalances[i] || 0;
  //     const lamportsDiff = postLamports - preLamports;

  //     // Find token changes for this account
  //     const tokenChanges: TokenStateChange[] = [];

  //     // Match pre and post token balances
  //     const preTokens = preTokenBalances.filter(tb => tb.accountIndex === i);
  //     const postTokens = postTokenBalances.filter(tb => tb.accountIndex === i);

  //     // Create a map of token changes
  //     const tokenChangeMap = new Map<string, TokenStateChange>();

  //     preTokens.forEach(preToken => {
  //       const postToken = postTokens.find(pt => pt.mint === preToken.mint);
  //       tokenChangeMap.set(preToken.mint, {
  //         mint: preToken.mint,
  //         beforeAmount: preToken.uiTokenAmount.amount,
  //         afterAmount: postToken?.uiTokenAmount.amount || '0',
  //         difference: (BigInt(postToken?.uiTokenAmount.amount || '0') - BigInt(preToken.uiTokenAmount.amount)).toString(),
  //         decimals: preToken.uiTokenAmount.decimals,
  //         uiAmountBefore: preToken.uiTokenAmount.uiAmount,
  //         uiAmountAfter: postToken?.uiTokenAmount.uiAmount || 0
  //       });
  //     });

  //     postTokens.forEach(postToken => {
  //       if (!tokenChangeMap.has(postToken.mint)) {
  //         tokenChangeMap.set(postToken.mint, {
  //           mint: postToken.mint,
  //           beforeAmount: '0',
  //           afterAmount: postToken.uiTokenAmount.amount,
  //           difference: postToken.uiTokenAmount.amount,
  //           decimals: postToken.uiTokenAmount.decimals,
  //           uiAmountBefore: 0,
  //           uiAmountAfter: postToken.uiTokenAmount.uiAmount
  //         });
  //       }
  //     });

  //     tokenChanges.push(...tokenChangeMap.values());

  //     // For now, we'll set beforeState and afterState to null
  //     // In a full implementation, we would fetch account data at specific slots
  //     accountStates.push({
  //       address,
  //       beforeState: null,
  //       afterState: null,
  //       lamportsDiff,
  //       tokenChanges,
  //       dataChanges: null
  //     });
  //   }

  //   return accountStates;
  // }

  /**
   * Parse instructions with basic data (faster version)
   */
  private parseInstructionsBasic(tx: ParsedTransactionWithMeta): EnhancedInstructionData[] {
    const instructions = tx.transaction.message.instructions;
    const logs = tx.meta?.logMessages || [];

    const enhancedInstructions: EnhancedInstructionData[] = [];

    for (let i = 0; i < instructions.length; i++) {
      const instruction = instructions[i];

      // Basic instruction parsing without heavy analysis
      const enhancedInstruction = this.parseInstructionBasic(instruction, i.toString(), logs);

      // Skip inner instruction processing for performance
      enhancedInstruction.innerInstructions = [];

      enhancedInstructions.push(enhancedInstruction);
    }

    return enhancedInstructions;
  }

  /**
   * Parse instructions with enhanced metadata
   */
  // private async parseInstructions(tx: ParsedTransactionWithMeta): Promise<EnhancedInstructionData[]> {
  //   const instructions = tx.transaction.message.instructions;
  //   const innerInstructions = tx.meta?.innerInstructions || [];
  //   const logs = tx.meta?.logMessages || [];

  //   const enhancedInstructions: EnhancedInstructionData[] = [];

  //   for (let i = 0; i < instructions.length; i++) {
  //     const instruction = instructions[i];
  //     const innerIxs = innerInstructions.find(inner => inner.index === i);

  //     // Parse inner instructions recursively
  //     const parsedInnerInstructions: EnhancedInstructionData[] = [];
  //     if (innerIxs) {
  //       for (let j = 0; j < innerIxs.instructions.length; j++) {
  //         const innerIx = innerIxs.instructions[j];
  //         parsedInnerInstructions.push(await this.parseInstruction(innerIx, `${i}.${j}`, logs));
  //       }
  //     }

  //     const enhancedInstruction = await this.parseInstruction(instruction, i.toString(), logs);
  //     enhancedInstruction.innerInstructions = parsedInnerInstructions;

  //     enhancedInstructions.push(enhancedInstruction);
  //   }

  //   return enhancedInstructions;
  // }

  /**
   * Parse a single instruction with basic data (faster version)
   */
  private parseInstructionBasic(
    instruction: ParsedInstruction | PartiallyDecodedInstruction,
    index: string,
    logs: string[]
  ): EnhancedInstructionData {
    const programId = instruction.programId.toString();

    // Extract relevant logs for this instruction
    const instructionLogs = logs.filter(log =>
      log.includes(`Program ${programId}`) ||
      log.includes(`invoke [${index}]`)
    );

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

    // Simple program name lookup without heavy parsing
    const programName = this.getProgramName(programId) || 'Unknown Program';
    const description = parsed ? this.generateInstructionDescription(parsed) : 'Unknown instruction';

    // Basic account info without roles
    const enhancedAccounts: InstructionAccountInfo[] = accounts.map((accountPubkey: string) => ({
      pubkey: accountPubkey,
      isSigner: false,
      isWritable: false,
      role: 'unknown' as any
    }));

    return {
      index: parseInt(index.split('.')[0]),
      programId,
      programName,
      instructionType: parsed?.type || 'unknown',
      description,
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
   * Parse a single instruction with enhanced data
   */
  // private async parseInstruction(
  //   instruction: ParsedInstruction | PartiallyDecodedInstruction,
  //   index: string,
  //   logs: string[]
  // ): Promise<EnhancedInstructionData> {
  //   const programId = instruction.programId.toString();

  //   // Extract relevant logs for this instruction
  //   const instructionLogs = logs.filter(log =>
  //     log.includes(`Program ${programId}`) ||
  //     log.includes(`invoke [${index}]`)
  //   );

  //   // Use instruction parser service for comprehensive analysis
  //   // Handle different instruction types safely
  //   let accounts: string[] = [];
  //   let data: string = '';
  //   let parsed: any = undefined;

  //   if ('accounts' in instruction && instruction.accounts) {
  //     accounts = instruction.accounts.map((acc: any) => acc.toString());
  //   }

  //   if ('data' in instruction && instruction.data) {
  //     data = instruction.data;
  //   }

  //   if ('parsed' in instruction) {
  //     parsed = instruction.parsed;
  //   }

  //   const parsedInfo = await instructionParserService.parseInstruction(
  //     programId,
  //     accounts,
  //     data,
  //     parsed
  //   );

  //   // Build enhanced account info with roles from parser and fallback detection
  //   const enhancedAccounts: InstructionAccountInfo[] = accounts.map((accountPubkey: string, i: number) => {
  //     const roleInfo = parsedInfo.accounts[i];

  //     // Use determineAccountRole as fallback when parser doesn't provide role
  //     const fallbackRole = roleInfo?.role || this.determineAccountRole(accountPubkey, instruction);

  //     return {
  //       pubkey: accountPubkey,
  //       isSigner: roleInfo?.isSigner || false,
  //       isWritable: roleInfo?.isWritable || false,
  //       role: fallbackRole as any || undefined
  //     };
  //   });

  //   // Use helper functions as fallbacks for enhanced data
  //   const programName = parsedInfo.programName || this.getProgramName(programId) || 'Unknown Program';
  //   const description = parsedInfo.description || (parsed ? this.generateInstructionDescription(parsed) : 'Unknown instruction');

  //   return {
  //     index: parseInt(index.split('.')[0]),
  //     programId,
  //     programName,
  //     instructionType: parsedInfo.instructionType,
  //     description,
  //     accounts: enhancedAccounts,
  //     data: {
  //       raw: data,
  //       parsed,
  //       discriminator: this.extractDiscriminator(data)
  //     },
  //     innerInstructions: [],
  //     logs: instructionLogs
  //   };
  // }

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

      const programId = ix.programId.toString();

      return {
        programId,
        programName: this.getProgramName(programId),
        accounts,
        data,
        parsed,
        stackHeight,
        description: parsed ? this.generateInstructionDescription(parsed) : undefined
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
  // private determineAccountRole(
  //   accountPubkey: string,
  //   instruction: ParsedInstruction | PartiallyDecodedInstruction
  // ): string | undefined {
  //   if ('parsed' in instruction && instruction.parsed?.info) {
  //     const info = instruction.parsed.info;

  //     if (info.source === accountPubkey) return 'payer';
  //     if (info.destination === accountPubkey) return 'recipient';
  //     if (info.authority === accountPubkey) return 'authority';
  //   }

  //   return undefined;
  // }

  /**
   * Extract instruction discriminator from data
   */
  private extractDiscriminator(data: string): string | undefined {
    if (data.length >= 16) {
      return data.slice(0, 16); // First 8 bytes as hex
    }
    return undefined;
  }

  /**
   * Validate transaction signature format
   * Solana transaction signatures are base58 encoded and exactly 88 characters long
   */
  private isValidTransactionSignature(signature: string): boolean {
    // Check length - Solana signatures are always 88 characters when base58 encoded
    if (signature.length !== 88) {
      return false;
    }

    // Check if it contains only valid base58 characters
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
    if (!base58Regex.test(signature)) {
      return false;
    }

    return true;
  }
}

// Export singleton instance
export const enhancedTransactionFetcher = new EnhancedTransactionFetcher();