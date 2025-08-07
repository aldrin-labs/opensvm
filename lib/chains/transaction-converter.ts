/**
 * Unified transaction format converter for cross-chain analysis
 * 
 * This module provides functionality to convert chain-specific transaction
 * formats into a unified format that can be analyzed across different blockchains.
 */

import {
  ChainId,
  UnifiedTransaction,
  TokenTransfer,
  DeFiInteraction,
  MEVData,
  TransactionAnalytics,
  CHAIN_INFO
} from './types';
import { parseTransaction as parseSolanaTransaction } from '../transaction-parser';
import { Connection } from '@solana/web3.js';
import { ethers } from 'ethers';

// Chain-specific transaction interfaces
interface SolanaTransactionData {
  signature: string;
  slot: number;
  blockTime: number | null;
  meta: any;
  transaction: any;
}

interface EthereumTransactionData {
  tx: any;
  receipt: any;
  block?: any;
}

interface BitcoinTransactionData {
  txid: string;
  vin: any[];
  vout: any[];
  blocktime?: number;
  confirmations?: number;
  blockhash?: string;
}

interface PolygonTransactionData {
  tx: any;
  receipt: any;
  block?: any;
  bridgeData?: any;
}

// Conversion strategies for each chain
export class TransactionConverter {
  private static readonly CONVERSION_VERSION = '1.0.0';

  /**
   * Convert a chain-specific transaction to unified format
   */
  static async convertToUnified(
    chainId: ChainId,
    rawData: any,
    additionalContext?: any
  ): Promise<UnifiedTransaction> {
    try {
      switch (chainId) {
        case 'solana':
          return await this.convertSolanaTransaction(rawData, additionalContext);
        case 'ethereum':
          return await this.convertEthereumTransaction(rawData);
        case 'bitcoin':
          return await this.convertBitcoinTransaction(rawData);
        case 'polygon':
          return await this.convertPolygonTransaction(rawData);
        default:
          throw new Error(`Unsupported chain: ${chainId}`);
      }
    } catch (error) {
      console.error(`Error converting ${chainId} transaction:`, error);
      throw error;
    }
  }

  /**
   * Convert multiple transactions from different chains
   */
  static async convertBatch(
    transactions: Array<{
      chainId: ChainId;
      data: any;
      context?: any;
    }>
  ): Promise<UnifiedTransaction[]> {
    const results = await Promise.allSettled(
      transactions.map(({ chainId, data, context }) =>
        this.convertToUnified(chainId, data, context)
      )
    );

    return results
      .filter((result): result is PromiseFulfilledResult<UnifiedTransaction> => 
        result.status === 'fulfilled'
      )
      .map(result => result.value);
  }

  /**
   * Normalize transaction values across chains
   */
  static normalizeValue(
    value: string | number | bigint,
    chainId: ChainId
  ): string {
    const chainInfo = CHAIN_INFO[chainId];
    const decimals = chainInfo.decimals;
    
    // Convert to string and handle different input types
    let valueStr: string;
    if (typeof value === 'bigint') {
      valueStr = value.toString();
    } else if (typeof value === 'number') {
      valueStr = value.toString();
    } else {
      valueStr = value;
    }

    // Normalize to standard decimal representation
    const divisor = BigInt(10 ** decimals);
    const wholePart = BigInt(valueStr) / divisor;
    const fractionalPart = BigInt(valueStr) % divisor;
    
    if (fractionalPart === BigInt(0)) {
      return wholePart.toString();
    } else {
      const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
      return `${wholePart}.${fractionalStr.replace(/0+$/, '')}`;
    }
  }

  /**
   * Convert Solana transaction to unified format
   */
  private static async convertSolanaTransaction(
    data: SolanaTransactionData,
    connection?: Connection
  ): Promise<UnifiedTransaction> {
    const { signature, slot, blockTime, meta, transaction } = data;

    // Extract basic transaction info
    const success = meta?.err === null;
    const fee = meta?.fee?.toString() || '0';

    // Parse Solana-specific data
    let parsedData: any = {};
    if (connection) {
      try {
        const parsed = await parseSolanaTransaction(connection, signature);
        parsedData = parsed;
      } catch (error) {
        console.warn('Failed to parse Solana transaction details:', error);
      }
    }

    // Extract token transfers from Solana transaction
    const tokenTransfers = this.extractSolanaTokenTransfers(meta);

    // Analyze DeFi interactions
    const defiInteractions = this.analyzeSolanaDeFiInteractions(meta, parsedData);

    // Detect MEV patterns
    const mevData = this.detectSolanaMEV(meta, parsedData);

    // Calculate risk score
    const riskScore = this.calculateSolanaRiskScore(transaction, meta);

    return {
      id: signature,
      chainId: 'solana',
      blockNumber: slot,
      blockHash: null, // Solana uses slots instead of block hashes
      timestamp: blockTime ? blockTime * 1000 : Date.now(),
      status: success ? 'success' : 'failed',
      from: transaction?.message?.accountKeys?.[0]?.pubkey?.toString() || '',
      to: transaction?.message?.accountKeys?.[1]?.pubkey?.toString() || null,
      value: this.calculateSolanaTransferValue(meta).toString(),
      fee,
      tokenTransfers,
      defiInteractions,
      mevData,
      riskScore,
      analytics: {
        category: this.categorizeSolanaTransaction(transaction, meta, tokenTransfers),
        complexity: this.calculateSolanaComplexity(transaction, meta),
        patterns: this.identifySolanaPatterns(transaction, meta),
        labels: this.generateSolanaLabels(transaction, meta)
      },
      raw: data
    };
  }

  /**
   * Convert Ethereum transaction to unified format
   */
  private static async convertEthereumTransaction(
    data: EthereumTransactionData
  ): Promise<UnifiedTransaction> {
    const { tx, receipt, block } = data;

    // Parse token transfers from logs
    const tokenTransfers = receipt ? this.extractEthereumTokenTransfers(receipt.logs) : [];

    // Analyze DeFi interactions
    const defiInteractions = receipt ? this.analyzeEthereumDeFiInteractions(receipt) : [];

    // Detect MEV patterns
    const mevData = receipt ? this.detectEthereumMEV(receipt, block) : undefined;

    // Calculate risk score
    const riskScore = this.calculateEthereumRiskScore(tx, receipt);

    return {
      id: tx.hash,
      chainId: 'ethereum',
      blockNumber: receipt?.blockNumber || null,
      blockHash: receipt?.blockHash || null,
      timestamp: block?.timestamp ? block.timestamp * 1000 : Date.now(),
      status: receipt ? (receipt.status === 1 ? 'success' : 'failed') : 'pending',
      from: tx.from,
      to: tx.to || null,
      value: tx.value.toString(),
      fee: receipt ? (BigInt(receipt.gasUsed) * BigInt(tx.gasPrice || 0)).toString() : '0',
      gasUsed: receipt ? Number(receipt.gasUsed) : undefined,
      gasPrice: tx.gasPrice?.toString(),
      tokenTransfers,
      defiInteractions,
      mevData,
      riskScore,
      analytics: {
        category: this.categorizeEthereumTransaction(tx, receipt, tokenTransfers, defiInteractions),
        complexity: this.calculateEthereumComplexity(tx, receipt),
        patterns: this.identifyEthereumPatterns(tx, receipt),
        labels: this.generateEthereumLabels(tx, receipt)
      },
      raw: data
    };
  }

  /**
   * Convert Bitcoin transaction to unified format
   */
  private static async convertBitcoinTransaction(
    data: BitcoinTransactionData
  ): Promise<UnifiedTransaction> {
    const { txid, vin, vout, blocktime, confirmations, blockhash } = data;

    // Calculate values
    const inputValue = vin.reduce((sum: number, input: any) => sum + (input.value || 0), 0);
    const outputValue = vout.reduce((sum: number, output: any) => sum + output.value, 0);
    const fee = inputValue - outputValue;

    // Extract addresses
    const fromAddresses = this.extractBitcoinInputAddresses(vin);
    const toAddresses = this.extractBitcoinOutputAddresses(vout);

    // Create token transfers (Bitcoin native transfers)
    const tokenTransfers: TokenTransfer[] = vout
      .filter((output: any) => output.scriptPubKey?.addresses?.length > 0)
      .map((output: any) => ({
        tokenAddress: '0x0000000000000000000000000000000000000000',
        symbol: 'BTC',
        name: 'Bitcoin',
        decimals: 8,
        from: fromAddresses[0] || '',
        to: output.scriptPubKey.addresses[0],
        amount: output.value.toString()
      }));

    // Analyze transaction patterns
    const patterns = this.analyzeBitcoinPatterns(data);
    const riskScore = this.calculateBitcoinRiskScore(data, patterns);

    return {
      id: txid,
      chainId: 'bitcoin',
      blockNumber: null, // Bitcoin doesn't have sequential block numbers in the same way
      blockHash: blockhash || null,
      timestamp: blocktime ? blocktime * 1000 : Date.now(),
      status: confirmations && confirmations > 0 ? 'success' : 'pending',
      from: fromAddresses[0] || '',
      to: toAddresses[0] || null,
      value: outputValue.toString(),
      fee: fee.toString(),
      tokenTransfers,
      defiInteractions: [], // Bitcoin doesn't have DeFi
      riskScore,
      riskFactors: patterns.riskFactors,
      analytics: {
        category: this.categorizeBitcoinTransaction(data, patterns),
        complexity: this.calculateBitcoinComplexity(data),
        patterns: patterns.patterns,
        labels: patterns.labels
      },
      raw: data
    };
  }

  /**
   * Convert Polygon transaction to unified format
   */
  private static async convertPolygonTransaction(
    data: PolygonTransactionData
  ): Promise<UnifiedTransaction> {
    const { tx, receipt, block, bridgeData } = data;

    // Parse token transfers
    const tokenTransfers = receipt ? this.extractPolygonTokenTransfers(receipt.logs) : [];

    // Analyze DeFi interactions
    const defiInteractions = receipt ? this.analyzePolygonDeFiInteractions(receipt) : [];

    // Calculate risk score
    const riskScore = this.calculatePolygonRiskScore(tx, receipt, bridgeData);

    return {
      id: tx.hash,
      chainId: 'polygon',
      blockNumber: receipt?.blockNumber || null,
      blockHash: receipt?.blockHash || null,
      timestamp: block?.timestamp ? block.timestamp * 1000 : Date.now(),
      status: receipt ? (receipt.status === 1 ? 'success' : 'failed') : 'pending',
      from: tx.from,
      to: tx.to || null,
      value: tx.value.toString(),
      fee: receipt ? (BigInt(receipt.gasUsed) * BigInt(tx.gasPrice || 0)).toString() : '0',
      gasUsed: receipt ? Number(receipt.gasUsed) : undefined,
      gasPrice: tx.gasPrice?.toString(),
      tokenTransfers,
      defiInteractions,
      riskScore,
      analytics: {
        category: this.categorizePolygonTransaction(tx, receipt, tokenTransfers, defiInteractions, bridgeData),
        complexity: this.calculatePolygonComplexity(tx, receipt),
        patterns: this.identifyPolygonPatterns(tx, receipt, bridgeData),
        labels: this.generatePolygonLabels(tx, receipt, bridgeData)
      },
      raw: data
    };
  }

  // Helper methods for Solana conversion
  private static extractSolanaTokenTransfers(meta: any): TokenTransfer[] {
    const transfers: TokenTransfer[] = [];
    
    if (meta?.preTokenBalances && meta?.postTokenBalances) {
      // Compare pre and post token balances to find transfers
      const preBalances = new Map(
        meta.preTokenBalances.map((balance: any) => [
          `${balance.accountIndex}-${balance.mint}`,
          balance
        ])
      );

      meta.postTokenBalances.forEach((postBalance: any) => {
        const key = `${postBalance.accountIndex}-${postBalance.mint}`;
        const preBalance = preBalances.get(key);
        
        if (preBalance) {
          const preAmount = BigInt(preBalance.uiTokenAmount.amount || 0);
          const postAmount = BigInt(postBalance.uiTokenAmount.amount || 0);
          const diff = postAmount - preAmount;
          
          if (diff !== BigInt(0)) {
            transfers.push({
              tokenAddress: postBalance.mint,
              symbol: postBalance.uiTokenAmount.symbol || 'UNKNOWN',
              name: 'Unknown Token',
              decimals: postBalance.uiTokenAmount.decimals || 9,
              from: diff < 0 ? 'account' : 'external',
              to: diff > 0 ? 'account' : 'external',
              amount: diff.toString()
            });
          }
        }
      });
    }
    
    return transfers;
  }

  private static analyzeSolanaDeFiInteractions(meta: any, parsedData: any): DeFiInteraction[] {
    const interactions: DeFiInteraction[] = [];
    
    // Analyze log messages for DeFi protocols
    if (meta?.logMessages) {
      for (const log of meta.logMessages) {
        // Jupiter aggregator
        if (log.includes('Jupiter')) {
          interactions.push({
            protocol: 'Jupiter',
            type: 'swap',
            metadata: { log }
          });
        }
        
        // Raydium
        if (log.includes('Raydium')) {
          interactions.push({
            protocol: 'Raydium',
            type: 'swap',
            metadata: { log }
          });
        }
        
        // Solend
        if (log.includes('Solend')) {
          interactions.push({
            protocol: 'Solend',
            type: 'lending',
            metadata: { log }
          });
        }
      }
    }
    
    return interactions;
  }

  private static detectSolanaMEV(meta: any, parsedData: any): MEVData | undefined {
    // Basic MEV detection for Solana
    // This would be more sophisticated in production
    return undefined;
  }

  private static calculateSolanaTransferValue(meta: any): number {
    if (!meta?.preBalances || !meta?.postBalances) return 0;
    
    // Calculate net SOL transfer
    let totalTransfer = 0;
    for (let i = 0; i < meta.preBalances.length; i++) {
      const pre = meta.preBalances[i] || 0;
      const post = meta.postBalances[i] || 0;
      const diff = post - pre;
      if (diff > 0) totalTransfer += diff;
    }
    
    return totalTransfer;
  }

  private static calculateSolanaRiskScore(transaction: any, meta: any): number {
    let score = 0;
    
    // Failed transactions
    if (meta?.err) score += 30;
    
    // Complex instructions
    if (transaction?.message?.instructions?.length > 10) score += 20;
    
    // High compute units
    if (meta?.computeUnitsConsumed > 200000) score += 10;
    
    return Math.min(score, 100);
  }

  // Helper methods for categorization and analysis
  private static categorizeSolanaTransaction(
    transaction: any,
    meta: any,
    tokenTransfers: TokenTransfer[]
  ): 'transfer' | 'defi' | 'nft' | 'contract' | 'bridge' | 'unknown' {
    // Analyze program invocations
    if (meta?.logMessages) {
      const logs = meta.logMessages.join(' ');
      if (logs.includes('Jupiter') || logs.includes('Raydium')) return 'defi';
      if (logs.includes('Metaplex')) return 'nft';
      if (logs.includes('Wormhole')) return 'bridge';
    }
    
    if (tokenTransfers.length > 0) return 'transfer';
    return 'unknown';
  }

  private static calculateSolanaComplexity(transaction: any, meta: any): 'simple' | 'medium' | 'complex' {
    const instructionCount = transaction?.message?.instructions?.length || 0;
    const computeUnits = meta?.computeUnitsConsumed || 0;
    
    if (instructionCount <= 2 && computeUnits < 50000) return 'simple';
    if (instructionCount <= 10 && computeUnits < 200000) return 'medium';
    return 'complex';
  }

  private static identifySolanaPatterns(transaction: any, meta: any): string[] {
    const patterns: string[] = [];
    
    if (meta?.computeUnitsConsumed > 1000000) patterns.push('high-compute');
    if (transaction?.message?.instructions?.length > 20) patterns.push('complex-interaction');
    
    return patterns;
  }

  private static generateSolanaLabels(transaction: any, meta: any): string[] {
    const labels: string[] = [];
    
    if (meta?.err) labels.push('failed');
    if (meta?.computeUnitsConsumed > 500000) labels.push('high-compute');
    
    return labels;
  }

  // Additional helper methods for other chains would be implemented similarly...
  // (Ethereum, Bitcoin, Polygon specific helpers)

  private static extractEthereumTokenTransfers(logs: any[]): TokenTransfer[] {
    // Implementation would be similar to the main Ethereum client
    return [];
  }

  private static analyzeEthereumDeFiInteractions(receipt: any): DeFiInteraction[] {
    return [];
  }

  private static detectEthereumMEV(receipt: any, block: any): MEVData | undefined {
    return undefined;
  }

  private static calculateEthereumRiskScore(tx: any, receipt: any): number {
    return 0;
  }

  private static categorizeEthereumTransaction(
    tx: any,
    receipt: any,
    tokenTransfers: TokenTransfer[],
    defiInteractions: DeFiInteraction[]
  ): 'transfer' | 'defi' | 'nft' | 'contract' | 'bridge' | 'unknown' {
    return 'unknown';
  }

  private static calculateEthereumComplexity(tx: any, receipt: any): 'simple' | 'medium' | 'complex' {
    return 'simple';
  }

  private static identifyEthereumPatterns(tx: any, receipt: any): string[] {
    return [];
  }

  private static generateEthereumLabels(tx: any, receipt: any): string[] {
    return [];
  }

  // Bitcoin helper methods
  private static extractBitcoinInputAddresses(inputs: any[]): string[] {
    const addresses: string[] = [];
    for (const input of inputs) {
      if (input.addresses) {
        addresses.push(...input.addresses);
      }
    }
    return [...new Set(addresses)];
  }

  private static extractBitcoinOutputAddresses(outputs: any[]): string[] {
    const addresses: string[] = [];
    for (const output of outputs) {
      if (output.scriptPubKey?.addresses) {
        addresses.push(...output.scriptPubKey.addresses);
      }
    }
    return [...new Set(addresses)];
  }

  private static analyzeBitcoinPatterns(data: BitcoinTransactionData): {
    patterns: string[];
    labels: string[];
    riskFactors: string[];
  } {
    return { patterns: [], labels: [], riskFactors: [] };
  }

  private static calculateBitcoinRiskScore(data: BitcoinTransactionData, patterns: any): number {
    return 0;
  }

  private static categorizeBitcoinTransaction(
    data: BitcoinTransactionData,
    patterns: any
  ): 'transfer' | 'defi' | 'nft' | 'contract' | 'bridge' | 'unknown' {
    return 'transfer';
  }

  private static calculateBitcoinComplexity(data: BitcoinTransactionData): 'simple' | 'medium' | 'complex' {
    return 'simple';
  }

  // Polygon helper methods
  private static extractPolygonTokenTransfers(logs: any[]): TokenTransfer[] {
    return [];
  }

  private static analyzePolygonDeFiInteractions(receipt: any): DeFiInteraction[] {
    return [];
  }

  private static calculatePolygonRiskScore(tx: any, receipt: any, bridgeData: any): number {
    return 0;
  }

  private static categorizePolygonTransaction(
    tx: any,
    receipt: any,
    tokenTransfers: TokenTransfer[],
    defiInteractions: DeFiInteraction[],
    bridgeData: any
  ): 'transfer' | 'defi' | 'nft' | 'contract' | 'bridge' | 'unknown' {
    return 'unknown';
  }

  private static calculatePolygonComplexity(tx: any, receipt: any): 'simple' | 'medium' | 'complex' {
    return 'simple';
  }

  private static identifyPolygonPatterns(tx: any, receipt: any, bridgeData: any): string[] {
    return [];
  }

  private static generatePolygonLabels(tx: any, receipt: any, bridgeData: any): string[] {
    return [];
  }
}

/**
 * Cross-chain transaction analyzer
 */
export class CrossChainAnalyzer {
  /**
   * Analyze relationships between transactions across different chains
   */
  static async analyzeRelationships(
    transactions: UnifiedTransaction[]
  ): Promise<{
    bridgeTransactions: UnifiedTransaction[];
    relatedTransactions: Array<{
      tx1: UnifiedTransaction;
      tx2: UnifiedTransaction;
      relationship: 'bridge' | 'arbitrage' | 'same_user' | 'related_protocol';
      confidence: number;
    }>;
    crossChainFlows: Array<{
      from: { chainId: ChainId; address: string };
      to: { chainId: ChainId; address: string };
      amount: string;
      token: string;
      transactions: string[];
    }>;
  }> {
    const bridgeTransactions: UnifiedTransaction[] = [];
    const relatedTransactions: any[] = [];
    const crossChainFlows: any[] = [];

    // Group transactions by chain
    const txByChain = new Map<ChainId, UnifiedTransaction[]>();
    transactions.forEach(tx => {
      if (!txByChain.has(tx.chainId)) {
        txByChain.set(tx.chainId, []);
      }
      txByChain.get(tx.chainId)!.push(tx);
    });

    // Identify bridge transactions
    transactions.forEach(tx => {
      if (tx.analytics?.category === 'bridge') {
        bridgeTransactions.push(tx);
      }
    });

    // Find related transactions
    for (let i = 0; i < transactions.length; i++) {
      for (let j = i + 1; j < transactions.length; j++) {
        const tx1 = transactions[i];
        const tx2 = transactions[j];
        
        if (tx1.chainId === tx2.chainId) continue; // Skip same-chain transactions
        
        const relationship = this.analyzeTransactionRelationship(tx1, tx2);
        if (relationship) {
          relatedTransactions.push({
            tx1,
            tx2,
            ...relationship
          });
        }
      }
    }

    return {
      bridgeTransactions,
      relatedTransactions,
      crossChainFlows
    };
  }

  private static analyzeTransactionRelationship(
    tx1: UnifiedTransaction,
    tx2: UnifiedTransaction
  ): { relationship: string; confidence: number } | null {
    // Time-based analysis
    const timeDiff = Math.abs(tx1.timestamp - tx2.timestamp);
    const timeWindow = 10 * 60 * 1000; // 10 minutes

    if (timeDiff > timeWindow) return null;

    // Address analysis
    if (tx1.from === tx2.from || tx1.to === tx2.to) {
      return {
        relationship: 'same_user',
        confidence: 0.8
      };
    }

    // Value analysis for potential arbitrage
    const value1 = parseFloat(tx1.value);
    const value2 = parseFloat(tx2.value);
    const valueDiff = Math.abs(value1 - value2) / Math.max(value1, value2);

    if (valueDiff < 0.1 && timeDiff < 5 * 60 * 1000) {
      return {
        relationship: 'arbitrage',
        confidence: 0.6
      };
    }

    return null;
  }
}