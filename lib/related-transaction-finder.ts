/**
 * Related Transaction Finder Service
 * 
 * This service discovers relationships between Solana transactions based on:
 * - Account-based relationships (shared accounts)
 * - Program usage patterns (same programs used)
 * - Temporal proximity (transactions close in time)
 * - Transaction flow patterns (token flows, account sequences)
 * - DeFi protocol interactions
 */

import type { DetailedTransactionInfo } from './solana';
import { transactionAnalysisCache } from './transaction-analysis-cache';

export interface RelatedTransaction {
  signature: string;
  slot: number;
  blockTime: number | null;
  relationship: TransactionRelationship;
  relevanceScore: number; // 0-1 scale
  summary: string;
  accounts: string[];
  programs: string[];
  tokenTransfers?: TokenTransfer[];
}

export interface TransactionRelationship {
  type: RelationshipType;
  strength: 'weak' | 'medium' | 'strong';
  description: string;
  sharedElements: SharedElements;
  confidence: number; // 0-1 scale
}

export type RelationshipType = 
  | 'account_sequence'      // Same accounts used in sequence
  | 'program_pattern'       // Same programs used
  | 'token_flow'           // Token transfers between related accounts
  | 'temporal_cluster'     // Transactions close in time
  | 'defi_protocol'        // Same DeFi protocols
  | 'multi_step'           // Multi-step transaction sequence
  | 'arbitrage_pattern'    // Arbitrage opportunity pattern
  | 'batch_operation'      // Part of batch operations
  | 'wallet_activity'      // Same wallet activity pattern
  | 'contract_interaction'; // Contract interaction pattern

export interface SharedElements {
  accounts: string[];
  programs: string[];
  tokens: string[];
  instructionTypes: string[];
  timeWindow: number; // seconds between transactions
}

export interface TokenTransfer {
  mint: string;
  symbol: string;
  amount: string;
  from: string;
  to: string;
  usdValue?: number;
}

export interface RelatedTransactionQuery {
  signature: string;
  maxResults?: number;
  timeWindowHours?: number;
  minRelevanceScore?: number;
  relationshipTypes?: RelationshipType[];
  includeTokenFlows?: boolean;
  includeDeFiPatterns?: boolean;
}

export interface RelatedTransactionResult {
  sourceTransaction: string;
  relatedTransactions: RelatedTransaction[];
  totalFound: number;
  searchTimeMs: number;
  relationshipSummary: {
    [key in RelationshipType]?: number;
  };
  insights: TransactionInsight[];
}

export interface TransactionInsight {
  type: 'pattern' | 'anomaly' | 'opportunity' | 'warning';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  relatedTransactions: string[];
}

// Mock transaction database for development
interface MockTransactionDB {
  [signature: string]: DetailedTransactionInfo;
}

class RelatedTransactionFinder {
  private transactionCache = new Map<string, DetailedTransactionInfo>();
  private relationshipCache = new Map<string, RelatedTransactionResult>();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes

  // Mock database - in production this would connect to actual blockchain data
  private mockDB: MockTransactionDB = {};

  constructor() {
    this.initializeMockData();
  }

  /**
   * Find related transactions for a given transaction
   */
  async findRelatedTransactions(query: RelatedTransactionQuery): Promise<RelatedTransactionResult> {
    const startTime = Date.now();
    
    try {
      // Check cache first using the new caching system
      const cachedResult = await transactionAnalysisCache.getCachedRelatedTransactions(
        query.signature,
        query
      );
      
      if (cachedResult) {
        console.log(`Using cached related transactions for ${query.signature}`);
        return cachedResult;
      }

      // Get source transaction
      const sourceTransaction = await this.getTransaction(query.signature);
      if (!sourceTransaction) {
        throw new Error(`Transaction ${query.signature} not found`);
      }

      // Find related transactions using multiple strategies
      const relatedTransactions = await this.discoverRelatedTransactions(sourceTransaction, query);
      
      // Sort by relevance score
      relatedTransactions.sort((a, b) => b.relevanceScore - a.relevanceScore);
      
      // Limit results
      const maxResults = query.maxResults || 20;
      const limitedResults = relatedTransactions.slice(0, maxResults);
      
      // Generate insights
      const insights = this.generateTransactionInsights(sourceTransaction, limitedResults);
      
      // Create relationship summary
      const relationshipSummary = this.createRelationshipSummary(limitedResults);
      
      const result: RelatedTransactionResult = {
        sourceTransaction: query.signature,
        relatedTransactions: limitedResults,
        totalFound: relatedTransactions.length,
        searchTimeMs: Date.now() - startTime,
        relationshipSummary,
        insights
      };

      // Cache result using the new caching system
      await transactionAnalysisCache.cacheRelatedTransactions(
        query.signature,
        result,
        query
      );
      
      return result;

    } catch (error) {
      console.error('Error finding related transactions:', error);
      throw error;
    }
  }

  /**
   * Discover related transactions using multiple relationship detection strategies
   */
  private async discoverRelatedTransactions(
    sourceTransaction: DetailedTransactionInfo,
    query: RelatedTransactionQuery
  ): Promise<RelatedTransaction[]> {
    const relatedTransactions: RelatedTransaction[] = [];
    const seenSignatures = new Set<string>([sourceTransaction.signature]);

    // Strategy 1: Account-based relationships
    const accountRelated = await this.findAccountBasedRelationships(sourceTransaction, query);
    this.addUniqueTransactions(relatedTransactions, accountRelated, seenSignatures);

    // Strategy 2: Program usage patterns
    const programRelated = await this.findProgramBasedRelationships(sourceTransaction, query);
    this.addUniqueTransactions(relatedTransactions, programRelated, seenSignatures);

    // Strategy 3: Temporal proximity
    const temporalRelated = await this.findTemporalRelationships(sourceTransaction, query);
    this.addUniqueTransactions(relatedTransactions, temporalRelated, seenSignatures);

    // Strategy 4: Token flow patterns
    if (query.includeTokenFlows !== false) {
      const tokenFlowRelated = await this.findTokenFlowRelationships(sourceTransaction, query);
      this.addUniqueTransactions(relatedTransactions, tokenFlowRelated, seenSignatures);
    }

    // Strategy 5: DeFi protocol patterns
    if (query.includeDeFiPatterns !== false) {
      const defiRelated = await this.findDeFiProtocolRelationships(sourceTransaction, query);
      this.addUniqueTransactions(relatedTransactions, defiRelated, seenSignatures);
    }

    // Strategy 6: Multi-step transaction sequences
    const sequenceRelated = await this.findTransactionSequences(sourceTransaction, query);
    this.addUniqueTransactions(relatedTransactions, sequenceRelated, seenSignatures);

    return relatedTransactions;
  }

  /**
   * Find transactions that share accounts with the source transaction
   */
  private async findAccountBasedRelationships(
    sourceTransaction: DetailedTransactionInfo,
    query: RelatedTransactionQuery
  ): Promise<RelatedTransaction[]> {
    const related: RelatedTransaction[] = [];
    const sourceAccounts = this.extractAccounts(sourceTransaction);
    const timeWindow = (query.timeWindowHours || 24) * 60 * 60 * 1000;

    // Search for transactions with shared accounts
    const candidates = await this.searchTransactionsByAccounts(
      sourceAccounts,
      sourceTransaction.blockTime,
      timeWindow
    );

    for (const candidate of candidates) {
      if (candidate.signature === sourceTransaction.signature) continue;

      const sharedAccounts = this.findSharedAccounts(sourceAccounts, this.extractAccounts(candidate));
      
      if (sharedAccounts.length > 0) {
        const relationship = this.analyzeAccountRelationship(
          sourceTransaction,
          candidate,
          sharedAccounts
        );

        if (relationship.confidence >= (query.minRelevanceScore || 0.1)) {
          related.push({
            signature: candidate.signature,
            slot: candidate.slot,
            blockTime: candidate.blockTime,
            relationship,
            relevanceScore: relationship.confidence,
            summary: this.generateTransactionSummary(candidate),
            accounts: this.extractAccounts(candidate),
            programs: this.extractPrograms(candidate),
            tokenTransfers: this.extractTokenTransfers(candidate)
          });
        }
      }
    }

    return related;
  }

  /**
   * Find transactions that use the same programs
   */
  private async findProgramBasedRelationships(
    sourceTransaction: DetailedTransactionInfo,
    query: RelatedTransactionQuery
  ): Promise<RelatedTransaction[]> {
    const related: RelatedTransaction[] = [];
    const sourcePrograms = this.extractPrograms(sourceTransaction);
    const timeWindow = (query.timeWindowHours || 24) * 60 * 60 * 1000;

    // Search for transactions using the same programs
    const candidates = await this.searchTransactionsByPrograms(
      sourcePrograms,
      sourceTransaction.blockTime,
      timeWindow
    );

    for (const candidate of candidates) {
      if (candidate.signature === sourceTransaction.signature) continue;

      const sharedPrograms = this.findSharedPrograms(sourcePrograms, this.extractPrograms(candidate));
      
      if (sharedPrograms.length > 0) {
        const relationship = this.analyzeProgramRelationship(
          sourceTransaction,
          candidate,
          sharedPrograms
        );

        if (relationship.confidence >= (query.minRelevanceScore || 0.1)) {
          related.push({
            signature: candidate.signature,
            slot: candidate.slot,
            blockTime: candidate.blockTime,
            relationship,
            relevanceScore: relationship.confidence,
            summary: this.generateTransactionSummary(candidate),
            accounts: this.extractAccounts(candidate),
            programs: this.extractPrograms(candidate),
            tokenTransfers: this.extractTokenTransfers(candidate)
          });
        }
      }
    }

    return related;
  }

  /**
   * Find transactions that occurred close in time
   */
  private async findTemporalRelationships(
    sourceTransaction: DetailedTransactionInfo,
    query: RelatedTransactionQuery
  ): Promise<RelatedTransaction[]> {
    const related: RelatedTransaction[] = [];
    const timeWindow = (query.timeWindowHours || 1) * 60 * 60 * 1000; // Default 1 hour for temporal

    // Search for transactions in time window
    const candidates = await this.searchTransactionsByTimeWindow(
      sourceTransaction.blockTime,
      timeWindow
    );

    for (const candidate of candidates) {
      if (candidate.signature === sourceTransaction.signature) continue;

      const relationship = this.analyzeTemporalRelationship(sourceTransaction, candidate);

      if (relationship.confidence >= (query.minRelevanceScore || 0.1)) {
        related.push({
          signature: candidate.signature,
          slot: candidate.slot,
          blockTime: candidate.blockTime,
          relationship,
          relevanceScore: relationship.confidence,
          summary: this.generateTransactionSummary(candidate),
          accounts: this.extractAccounts(candidate),
          programs: this.extractPrograms(candidate),
          tokenTransfers: this.extractTokenTransfers(candidate)
        });
      }
    }

    return related;
  }

  /**
   * Find transactions with token flow relationships
   */
  private async findTokenFlowRelationships(
    sourceTransaction: DetailedTransactionInfo,
    query: RelatedTransactionQuery
  ): Promise<RelatedTransaction[]> {
    const related: RelatedTransaction[] = [];
    const sourceTokenTransfers = this.extractTokenTransfers(sourceTransaction);
    
    if (sourceTokenTransfers.length === 0) return related;

    const timeWindow = (query.timeWindowHours || 24) * 60 * 60 * 1000;

    // Search for transactions involving the same tokens
    const tokenMints = sourceTokenTransfers.map(t => t.mint);
    const candidates = await this.searchTransactionsByTokens(
      tokenMints,
      sourceTransaction.blockTime,
      timeWindow
    );

    for (const candidate of candidates) {
      if (candidate.signature === sourceTransaction.signature) continue;

      const candidateTokenTransfers = this.extractTokenTransfers(candidate);
      const relationship = this.analyzeTokenFlowRelationship(
        sourceTransaction,
        candidate,
        sourceTokenTransfers,
        candidateTokenTransfers
      );

      if (relationship.confidence >= (query.minRelevanceScore || 0.1)) {
        related.push({
          signature: candidate.signature,
          slot: candidate.slot,
          blockTime: candidate.blockTime,
          relationship,
          relevanceScore: relationship.confidence,
          summary: this.generateTransactionSummary(candidate),
          accounts: this.extractAccounts(candidate),
          programs: this.extractPrograms(candidate),
          tokenTransfers: candidateTokenTransfers
        });
      }
    }

    return related;
  }

  /**
   * Find transactions using the same DeFi protocols
   */
  private async findDeFiProtocolRelationships(
    sourceTransaction: DetailedTransactionInfo,
    query: RelatedTransactionQuery
  ): Promise<RelatedTransaction[]> {
    const related: RelatedTransaction[] = [];
    const sourcePrograms = this.extractPrograms(sourceTransaction);
    
    // Known DeFi program IDs
    const defiPrograms = [
      'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB', // Jupiter
      '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', // Raydium
      'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', // Orca
      'So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo', // Solend
      'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD'  // Marinade
    ];

    const sourceDeFiPrograms = sourcePrograms.filter(p => defiPrograms.includes(p));
    if (sourceDeFiPrograms.length === 0) return related;

    const timeWindow = (query.timeWindowHours || 24) * 60 * 60 * 1000;

    // Search for transactions using the same DeFi protocols
    const candidates = await this.searchTransactionsByPrograms(
      sourceDeFiPrograms,
      sourceTransaction.blockTime,
      timeWindow
    );

    for (const candidate of candidates) {
      if (candidate.signature === sourceTransaction.signature) continue;

      const candidateDeFiPrograms = this.extractPrograms(candidate).filter(p => defiPrograms.includes(p));
      const sharedDeFiPrograms = this.findSharedPrograms(sourceDeFiPrograms, candidateDeFiPrograms);

      if (sharedDeFiPrograms.length > 0) {
        const relationship = this.analyzeDeFiProtocolRelationship(
          sourceTransaction,
          candidate,
          sharedDeFiPrograms
        );

        if (relationship.confidence >= (query.minRelevanceScore || 0.1)) {
          related.push({
            signature: candidate.signature,
            slot: candidate.slot,
            blockTime: candidate.blockTime,
            relationship,
            relevanceScore: relationship.confidence,
            summary: this.generateTransactionSummary(candidate),
            accounts: this.extractAccounts(candidate),
            programs: this.extractPrograms(candidate),
            tokenTransfers: this.extractTokenTransfers(candidate)
          });
        }
      }
    }

    return related;
  }

  /**
   * Find multi-step transaction sequences
   */
  private async findTransactionSequences(
    sourceTransaction: DetailedTransactionInfo,
    query: RelatedTransactionQuery
  ): Promise<RelatedTransaction[]> {
    const related: RelatedTransaction[] = [];
    const sourceAccounts = this.extractAccounts(sourceTransaction);
    const timeWindow = 60 * 60 * 1000; // 1 hour for sequences

    // Look for transactions that might be part of a sequence
    const candidates = await this.searchTransactionsByAccounts(
      sourceAccounts,
      sourceTransaction.blockTime,
      timeWindow
    );

    // Sort by time to identify sequences
    candidates.sort((a, b) => (a.blockTime || 0) - (b.blockTime || 0));

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      if (candidate.signature === sourceTransaction.signature) continue;

      const relationship = this.analyzeSequenceRelationship(
        sourceTransaction,
        candidate,
        candidates
      );

      if (relationship.confidence >= (query.minRelevanceScore || 0.1)) {
        related.push({
          signature: candidate.signature,
          slot: candidate.slot,
          blockTime: candidate.blockTime,
          relationship,
          relevanceScore: relationship.confidence,
          summary: this.generateTransactionSummary(candidate),
          accounts: this.extractAccounts(candidate),
          programs: this.extractPrograms(candidate),
          tokenTransfers: this.extractTokenTransfers(candidate)
        });
      }
    }

    return related;
  }

  /**
   * Analyze account-based relationship
   */
  private analyzeAccountRelationship(
    source: DetailedTransactionInfo,
    candidate: DetailedTransactionInfo,
    sharedAccounts: string[]
  ): TransactionRelationship {
    const sourceAccounts = this.extractAccounts(source);
    const candidateAccounts = this.extractAccounts(candidate);
    
    const sharedRatio = sharedAccounts.length / Math.max(sourceAccounts.length, candidateAccounts.length);
    const timeDistance = Math.abs((source.blockTime || 0) - (candidate.blockTime || 0));
    
    let strength: 'weak' | 'medium' | 'strong' = 'weak';
    let confidence = sharedRatio * 0.7;
    
    // Boost confidence for recent transactions
    if (timeDistance < 60 * 60 * 1000) { // 1 hour
      confidence += 0.2;
    }
    
    // Determine strength
    if (sharedRatio > 0.7) strength = 'strong';
    else if (sharedRatio > 0.3) strength = 'medium';
    
    return {
      type: 'account_sequence',
      strength,
      description: `Shares ${sharedAccounts.length} account${sharedAccounts.length !== 1 ? 's' : ''} with the source transaction`,
      sharedElements: {
        accounts: sharedAccounts,
        programs: [],
        tokens: [],
        instructionTypes: [],
        timeWindow: timeDistance / 1000
      },
      confidence: Math.min(confidence, 1)
    };
  }

  /**
   * Analyze program-based relationship
   */
  private analyzeProgramRelationship(
    source: DetailedTransactionInfo,
    candidate: DetailedTransactionInfo,
    sharedPrograms: string[]
  ): TransactionRelationship {
    const sourcePrograms = this.extractPrograms(source);
    const candidatePrograms = this.extractPrograms(candidate);
    
    const sharedRatio = sharedPrograms.length / Math.max(sourcePrograms.length, candidatePrograms.length);
    const timeDistance = Math.abs((source.blockTime || 0) - (candidate.blockTime || 0));
    
    let strength: 'weak' | 'medium' | 'strong' = 'weak';
    let confidence = sharedRatio * 0.6;
    
    // Boost confidence for exact program matches
    if (sharedRatio === 1.0) {
      confidence += 0.3;
    }
    
    // Determine strength
    if (sharedRatio > 0.8) strength = 'strong';
    else if (sharedRatio > 0.4) strength = 'medium';
    
    return {
      type: 'program_pattern',
      strength,
      description: `Uses ${sharedPrograms.length} of the same program${sharedPrograms.length !== 1 ? 's' : ''}`,
      sharedElements: {
        accounts: [],
        programs: sharedPrograms,
        tokens: [],
        instructionTypes: [],
        timeWindow: timeDistance / 1000
      },
      confidence: Math.min(confidence, 1)
    };
  }

  /**
   * Analyze temporal relationship
   */
  private analyzeTemporalRelationship(
    source: DetailedTransactionInfo,
    candidate: DetailedTransactionInfo
  ): TransactionRelationship {
    const timeDistance = Math.abs((source.blockTime || 0) - (candidate.blockTime || 0));
    const slotDistance = Math.abs(source.slot - candidate.slot);
    
    let strength: 'weak' | 'medium' | 'strong' = 'weak';
    let confidence = 0.1;
    
    // Very close in time (same block or adjacent)
    if (slotDistance <= 1) {
      strength = 'strong';
      confidence = 0.8;
    } else if (timeDistance < 60 * 1000) { // 1 minute
      strength = 'strong';
      confidence = 0.7;
    } else if (timeDistance < 5 * 60 * 1000) { // 5 minutes
      strength = 'medium';
      confidence = 0.5;
    } else if (timeDistance < 60 * 60 * 1000) { // 1 hour
      strength = 'weak';
      confidence = 0.3;
    }
    
    return {
      type: 'temporal_cluster',
      strength,
      description: `Occurred ${this.formatTimeDistance(timeDistance)} ${timeDistance < (candidate.blockTime || 0) - (source.blockTime || 0) ? 'after' : 'before'} the source transaction`,
      sharedElements: {
        accounts: [],
        programs: [],
        tokens: [],
        instructionTypes: [],
        timeWindow: timeDistance / 1000
      },
      confidence
    };
  }

  /**
   * Analyze token flow relationship
   */
  private analyzeTokenFlowRelationship(
    source: DetailedTransactionInfo,
    candidate: DetailedTransactionInfo,
    sourceTokens: TokenTransfer[],
    candidateTokens: TokenTransfer[]
  ): TransactionRelationship {
    const sharedTokens = this.findSharedTokens(sourceTokens, candidateTokens);
    const flowConnections = this.findTokenFlowConnections(sourceTokens, candidateTokens);
    
    let strength: 'weak' | 'medium' | 'strong' = 'weak';
    let confidence = 0.1;
    
    // Direct token flow (output of source becomes input of candidate)
    if (flowConnections.length > 0) {
      strength = 'strong';
      confidence = 0.8;
    } else if (sharedTokens.length > 0) {
      strength = 'medium';
      confidence = 0.5;
    }
    
    return {
      type: 'token_flow',
      strength,
      description: flowConnections.length > 0 
        ? `Direct token flow connection with ${flowConnections.length} token${flowConnections.length !== 1 ? 's' : ''}`
        : `Involves ${sharedTokens.length} of the same token${sharedTokens.length !== 1 ? 's' : ''}`,
      sharedElements: {
        accounts: [],
        programs: [],
        tokens: sharedTokens,
        instructionTypes: [],
        timeWindow: Math.abs((source.blockTime || 0) - (candidate.blockTime || 0)) / 1000
      },
      confidence
    };
  }

  /**
   * Analyze DeFi protocol relationship
   */
  private analyzeDeFiProtocolRelationship(
    source: DetailedTransactionInfo,
    candidate: DetailedTransactionInfo,
    sharedDeFiPrograms: string[]
  ): TransactionRelationship {
    const confidence = 0.6 + (sharedDeFiPrograms.length * 0.1);
    
    return {
      type: 'defi_protocol',
      strength: sharedDeFiPrograms.length > 1 ? 'strong' : 'medium',
      description: `Uses the same DeFi protocol${sharedDeFiPrograms.length !== 1 ? 's' : ''} for related operations`,
      sharedElements: {
        accounts: [],
        programs: sharedDeFiPrograms,
        tokens: [],
        instructionTypes: [],
        timeWindow: Math.abs((source.blockTime || 0) - (candidate.blockTime || 0)) / 1000
      },
      confidence: Math.min(confidence, 1)
    };
  }

  /**
   * Analyze sequence relationship
   */
  private analyzeSequenceRelationship(
    source: DetailedTransactionInfo,
    candidate: DetailedTransactionInfo,
    allCandidates: DetailedTransactionInfo[]
  ): TransactionRelationship {
    const sourceIndex = allCandidates.findIndex(t => t.signature === source.signature);
    const candidateIndex = allCandidates.findIndex(t => t.signature === candidate.signature);
    
    const isSequential = Math.abs(sourceIndex - candidateIndex) === 1;
    const timeDistance = Math.abs((source.blockTime || 0) - (candidate.blockTime || 0));
    
    let confidence = 0.1;
    let strength: 'weak' | 'medium' | 'strong' = 'weak';
    
    if (isSequential && timeDistance < 5 * 60 * 1000) { // 5 minutes
      confidence = 0.7;
      strength = 'strong';
    } else if (timeDistance < 60 * 60 * 1000) { // 1 hour
      confidence = 0.4;
      strength = 'medium';
    }
    
    return {
      type: 'multi_step',
      strength,
      description: `Part of a multi-step transaction sequence`,
      sharedElements: {
        accounts: this.findSharedAccounts(this.extractAccounts(source), this.extractAccounts(candidate)),
        programs: [],
        tokens: [],
        instructionTypes: [],
        timeWindow: timeDistance / 1000
      },
      confidence
    };
  }  /**

   * Helper methods for transaction analysis
   */
  private extractAccounts(transaction: DetailedTransactionInfo): string[] {
    const accounts = new Set<string>();
    
    // Add accounts from transaction message
    transaction.transaction.message.accountKeys.forEach(account => {
      accounts.add(account.pubkey.toString());
    });
    
    // Add accounts from parsed instructions
    transaction.parsedInstructions?.forEach(instruction => {
      instruction.accounts?.forEach(account => {
        accounts.add(account);
      });
    });
    
    return Array.from(accounts);
  }

  private extractPrograms(transaction: DetailedTransactionInfo): string[] {
    const programs = new Set<string>();
    
    transaction.parsedInstructions?.forEach(instruction => {
      if (instruction.programId) {
        programs.add(instruction.programId);
      }
    });
    
    return Array.from(programs);
  }

  private extractTokenTransfers(transaction: DetailedTransactionInfo): TokenTransfer[] {
    const transfers: TokenTransfer[] = [];
    
    // Extract from account changes
    transaction.accountChanges?.forEach(change => {
      change.tokenChanges?.forEach(tokenChange => {
        transfers.push({
          mint: tokenChange.mint,
          symbol: this.getTokenSymbol(tokenChange.mint),
          amount: Math.abs(tokenChange.change).toString(),
          from: tokenChange.change < 0 ? change.account : 'unknown',
          to: tokenChange.change > 0 ? change.account : 'unknown',
          usdValue: this.calculateUsdValue(tokenChange.mint, Math.abs(tokenChange.change))
        });
      });
    });
    
    return transfers;
  }

  private findSharedAccounts(accounts1: string[], accounts2: string[]): string[] {
    return accounts1.filter(account => accounts2.includes(account));
  }

  private findSharedPrograms(programs1: string[], programs2: string[]): string[] {
    return programs1.filter(program => programs2.includes(program));
  }

  private findSharedTokens(tokens1: TokenTransfer[], tokens2: TokenTransfer[]): string[] {
    const mints1 = tokens1.map(t => t.mint);
    const mints2 = tokens2.map(t => t.mint);
    return mints1.filter(mint => mints2.includes(mint));
  }

  private findTokenFlowConnections(sourceTokens: TokenTransfer[], candidateTokens: TokenTransfer[]): string[] {
    const connections: string[] = [];
    
    for (const sourceToken of sourceTokens) {
      for (const candidateToken of candidateTokens) {
        // Check if output of source becomes input of candidate
        if (sourceToken.mint === candidateToken.mint && 
            sourceToken.to === candidateToken.from) {
          connections.push(sourceToken.mint);
        }
      }
    }
    
    return connections;
  }

  private addUniqueTransactions(
    existing: RelatedTransaction[],
    newTransactions: RelatedTransaction[],
    seenSignatures: Set<string>
  ): void {
    for (const transaction of newTransactions) {
      if (!seenSignatures.has(transaction.signature)) {
        existing.push(transaction);
        seenSignatures.add(transaction.signature);
      }
    }
  }

  private generateTransactionSummary(transaction: DetailedTransactionInfo): string {
    const programs = this.extractPrograms(transaction);
    const accounts = this.extractAccounts(transaction);
    const instructionCount = transaction.parsedInstructions?.length || 0;
    
    if (programs.length > 0) {
      const programNames = programs.map(p => this.getProgramName(p)).join(', ');
      return `${instructionCount} instruction${instructionCount !== 1 ? 's' : ''} using ${programNames}`;
    }
    
    return `Transaction with ${instructionCount} instruction${instructionCount !== 1 ? 's' : ''} affecting ${accounts.length} account${accounts.length !== 1 ? 's' : ''}`;
  }

  private generateTransactionInsights(
    sourceTransaction: DetailedTransactionInfo,
    relatedTransactions: RelatedTransaction[]
  ): TransactionInsight[] {
    const insights: TransactionInsight[] = [];
    
    // Pattern insights
    const relationshipTypes = relatedTransactions.map(t => t.relationship.type);
    const typeCount = this.countRelationshipTypes(relationshipTypes);
    
    if (typeCount.defi_protocol > 2) {
      insights.push({
        type: 'pattern',
        title: 'DeFi Protocol Activity',
        description: `This transaction is part of active DeFi protocol usage with ${typeCount.defi_protocol} related DeFi transactions`,
        severity: 'medium',
        relatedTransactions: relatedTransactions
          .filter(t => t.relationship.type === 'defi_protocol')
          .map(t => t.signature)
      });
    }
    
    if (typeCount.multi_step > 1) {
      insights.push({
        type: 'pattern',
        title: 'Multi-Step Operation',
        description: `This appears to be part of a multi-step operation with ${typeCount.multi_step} sequential transactions`,
        severity: 'low',
        relatedTransactions: relatedTransactions
          .filter(t => t.relationship.type === 'multi_step')
          .map(t => t.signature)
      });
    }
    
    // Anomaly insights
    const highValueTransactions = relatedTransactions.filter(t => 
      t.tokenTransfers?.some(transfer => (transfer.usdValue || 0) > 10000)
    );
    
    if (highValueTransactions.length > 0) {
      insights.push({
        type: 'anomaly',
        title: 'High-Value Related Transactions',
        description: `${highValueTransactions.length} related transaction${highValueTransactions.length !== 1 ? 's' : ''} involve${highValueTransactions.length === 1 ? 's' : ''} high-value token transfers`,
        severity: 'high',
        relatedTransactions: highValueTransactions.map(t => t.signature)
      });
    }
    
    // Opportunity insights
    const arbitragePatterns = relatedTransactions.filter(t => 
      t.relationship.type === 'token_flow' && t.relationship.strength === 'strong'
    );
    
    if (arbitragePatterns.length > 1) {
      insights.push({
        type: 'opportunity',
        title: 'Potential Arbitrage Pattern',
        description: `Token flow patterns suggest potential arbitrage opportunities across ${arbitragePatterns.length} transactions`,
        severity: 'medium',
        relatedTransactions: arbitragePatterns.map(t => t.signature)
      });
    }
    
    // Warning insights
    const temporalClusters = relatedTransactions.filter(t => 
      t.relationship.type === 'temporal_cluster' && t.relationship.sharedElements.timeWindow < 60
    );
    
    if (temporalClusters.length > 5) {
      insights.push({
        type: 'warning',
        title: 'High Transaction Frequency',
        description: `${temporalClusters.length} transactions occurred within 1 minute - monitor for potential bot activity`,
        severity: 'medium',
        relatedTransactions: temporalClusters.map(t => t.signature)
      });
    }
    
    return insights;
  }

  private createRelationshipSummary(relatedTransactions: RelatedTransaction[]): { [key in RelationshipType]?: number } {
    const summary: { [key in RelationshipType]?: number } = {};
    
    for (const transaction of relatedTransactions) {
      const type = transaction.relationship.type;
      summary[type] = (summary[type] || 0) + 1;
    }
    
    return summary;
  }

  private countRelationshipTypes(types: RelationshipType[]): { [key in RelationshipType]: number } {
    const count = {} as { [key in RelationshipType]: number };
    
    // Initialize all types to 0
    const allTypes: RelationshipType[] = [
      'account_sequence', 'program_pattern', 'token_flow', 'temporal_cluster',
      'defi_protocol', 'multi_step', 'arbitrage_pattern', 'batch_operation',
      'wallet_activity', 'contract_interaction'
    ];
    
    allTypes.forEach(type => count[type] = 0);
    
    // Count occurrences
    types.forEach(type => count[type]++);
    
    return count;
  }

  private formatTimeDistance(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days !== 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
    if (minutes > 0) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }

  private getTokenSymbol(mint: string): string {
    const knownTokens: Record<string, string> = {
      'So11111111111111111111111111111111111111112': 'SOL',
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
      'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 'mSOL'
    };
    
    return knownTokens[mint] || 'UNKNOWN';
  }

  private getProgramName(programId: string): string {
    const knownPrograms: Record<string, string> = {
      'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB': 'Jupiter',
      '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM': 'Raydium',
      'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc': 'Orca',
      'So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo': 'Solend',
      'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD': 'Marinade',
      '11111111111111111111111111111111': 'System Program',
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': 'SPL Token'
    };
    
    return knownPrograms[programId] || `Program ${programId.substring(0, 8)}...`;
  }

  private calculateUsdValue(mint: string, amount: number): number | undefined {
    const prices: Record<string, number> = {
      'So11111111111111111111111111111111111111112': 100, // SOL
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 1, // USDC
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 1, // USDT
      'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 95 // mSOL
    };
    
    const price = prices[mint];
    if (!price) return undefined;
    
    const decimals = mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' || 
                    mint === 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' ? 6 : 9;
    
    return (amount / Math.pow(10, decimals)) * price;
  }

  /**
   * Mock search methods - in production these would query actual blockchain data
   */
  private async searchTransactionsByAccounts(
    accounts: string[],
    baseTime: number | null,
    timeWindow: number
  ): Promise<DetailedTransactionInfo[]> {
    // Mock implementation - return sample transactions
    return this.generateMockTransactions(accounts, baseTime, timeWindow, 'accounts');
  }

  private async searchTransactionsByPrograms(
    programs: string[],
    baseTime: number | null,
    timeWindow: number
  ): Promise<DetailedTransactionInfo[]> {
    // Mock implementation - return sample transactions
    return this.generateMockTransactions(programs, baseTime, timeWindow, 'programs');
  }

  private async searchTransactionsByTimeWindow(
    baseTime: number | null,
    timeWindow: number
  ): Promise<DetailedTransactionInfo[]> {
    // Mock implementation - return sample transactions
    return this.generateMockTransactions([], baseTime, timeWindow, 'temporal');
  }

  private async searchTransactionsByTokens(
    tokens: string[],
    baseTime: number | null,
    timeWindow: number
  ): Promise<DetailedTransactionInfo[]> {
    // Mock implementation - return sample transactions
    return this.generateMockTransactions(tokens, baseTime, timeWindow, 'tokens');
  }

  private generateMockTransactions(
    searchCriteria: string[],
    baseTime: number | null,
    timeWindow: number,
    searchType: string
  ): DetailedTransactionInfo[] {
    const transactions: DetailedTransactionInfo[] = [];
    const count = Math.min(Math.floor(Math.random() * 10) + 3, 15); // 3-15 transactions
    
    for (let i = 0; i < count; i++) {
      const timeOffset = (Math.random() - 0.5) * timeWindow;
      const mockTime = (baseTime || Date.now()) + timeOffset;
      
      transactions.push({
        signature: `mock-${searchType}-${i}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        slot: Math.floor(Math.random() * 1000000) + 100000,
        blockTime: mockTime,
        success: Math.random() > 0.1, // 90% success rate
        parsedInstructions: this.generateMockInstructions(searchCriteria, searchType),
        accountChanges: this.generateMockAccountChanges(),
        transaction: {
          message: {
            accountKeys: this.generateMockAccountKeys(searchCriteria, searchType)
          }
        } as any
      });
    }
    
    return transactions;
  }

  private generateMockInstructions(searchCriteria: string[], searchType: string): any[] {
    const instructions = [];
    const count = Math.floor(Math.random() * 3) + 1; // 1-3 instructions
    
    for (let i = 0; i < count; i++) {
      let programId = '11111111111111111111111111111111'; // Default system program
      
      if (searchType === 'programs' && searchCriteria.length > 0) {
        programId = searchCriteria[Math.floor(Math.random() * searchCriteria.length)];
      } else if (searchType === 'accounts' || searchType === 'tokens') {
        // Use known DeFi programs for more realistic results
        const defiPrograms = [
          'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB',
          '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
          'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc'
        ];
        programId = defiPrograms[Math.floor(Math.random() * defiPrograms.length)];
      }
      
      instructions.push({
        programId,
        parsed: {
          type: ['swap', 'transfer', 'stake', 'unstake'][Math.floor(Math.random() * 4)],
          info: {
            amount: Math.floor(Math.random() * 1000000000).toString()
          }
        },
        accounts: this.generateMockAccountsForInstruction(searchCriteria, searchType)
      });
    }
    
    return instructions;
  }

  private generateMockAccountKeys(searchCriteria: string[], searchType: string): any[] {
    const accounts = [];
    const count = Math.floor(Math.random() * 5) + 3; // 3-7 accounts
    
    // Include search criteria accounts if relevant
    if (searchType === 'accounts') {
      searchCriteria.forEach(account => {
        accounts.push({ pubkey: { toString: () => account } });
      });
    }
    
    // Add random accounts
    for (let i = accounts.length; i < count; i++) {
      accounts.push({
        pubkey: { toString: () => this.generateRandomAddress() }
      });
    }
    
    return accounts;
  }

  private generateMockAccountsForInstruction(searchCriteria: string[], searchType: string): string[] {
    const accounts = [];
    const count = Math.floor(Math.random() * 4) + 2; // 2-5 accounts
    
    // Include some search criteria if relevant
    if (searchType === 'accounts' && searchCriteria.length > 0) {
      accounts.push(searchCriteria[0]);
    }
    
    // Add random accounts
    for (let i = accounts.length; i < count; i++) {
      accounts.push(this.generateRandomAddress());
    }
    
    return accounts;
  }

  private generateMockAccountChanges(): any[] {
    const changes = [];
    const count = Math.floor(Math.random() * 3) + 1; // 1-3 account changes
    
    for (let i = 0; i < count; i++) {
      changes.push({
        account: this.generateRandomAddress(),
        solChange: (Math.random() - 0.5) * 1000000000, // -0.5 to +0.5 SOL
        tokenChanges: this.generateMockTokenChanges()
      });
    }
    
    return changes;
  }

  private generateMockTokenChanges(): any[] {
    const changes = [];
    const count = Math.floor(Math.random() * 3); // 0-2 token changes
    
    const tokens = [
      'So11111111111111111111111111111111111111112', // SOL
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' // USDT
    ];
    
    for (let i = 0; i < count; i++) {
      changes.push({
        mint: tokens[Math.floor(Math.random() * tokens.length)],
        change: (Math.random() - 0.5) * 1000000000 // Random change
      });
    }
    
    return changes;
  }

  private generateRandomAddress(): string {
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 44; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private generateCacheKey(query: RelatedTransactionQuery): string {
    return `${query.signature}-${query.maxResults || 20}-${query.timeWindowHours || 24}-${query.minRelevanceScore || 0.1}`;
  }

  private async getTransaction(signature: string): Promise<DetailedTransactionInfo | null> {
    // Check cache first
    if (this.transactionCache.has(signature)) {
      return this.transactionCache.get(signature)!;
    }
    
    // Check mock database
    if (this.mockDB[signature]) {
      const transaction = this.mockDB[signature];
      this.transactionCache.set(signature, transaction);
      return transaction;
    }
    
    // In production, this would fetch from blockchain
    return null;
  }

  private initializeMockData(): void {
    // Initialize with some sample transactions for testing
    const sampleTransaction: DetailedTransactionInfo = {
      signature: 'sample-transaction-signature-123',
      slot: 123456,
      blockTime: Date.now() - 60000, // 1 minute ago
      success: true,
      parsedInstructions: [
        {
          programId: 'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB',
          parsed: {
            type: 'swap',
            info: {
              amount: '1000000000'
            }
          },
          accounts: ['account1', 'account2', 'account3']
        }
      ],
      accountChanges: [
        {
          account: 'account1',
          solChange: -1000000000,
          tokenChanges: [
            {
              mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
              change: 100000000
            }
          ]
        }
      ],
      transaction: {
        message: {
          accountKeys: [
            { pubkey: { toString: () => 'account1' } },
            { pubkey: { toString: () => 'account2' } },
            { pubkey: { toString: () => 'account3' } }
          ]
        }
      } as any
    };
    
    this.mockDB['sample-transaction-signature-123'] = sampleTransaction;
  }

  /**
   * Public utility methods
   */
  public async getRelationshipTypes(): Promise<RelationshipType[]> {
    return [
      'account_sequence',
      'program_pattern', 
      'token_flow',
      'temporal_cluster',
      'defi_protocol',
      'multi_step',
      'arbitrage_pattern',
      'batch_operation',
      'wallet_activity',
      'contract_interaction'
    ];
  }

  public clearCache(): void {
    this.transactionCache.clear();
    this.relationshipCache.clear();
  }

  public getCacheStats(): { transactionCache: number; relationshipCache: number } {
    return {
      transactionCache: this.transactionCache.size,
      relationshipCache: this.relationshipCache.size
    };
  }
}

// Export singleton instance
export const relatedTransactionFinder = new RelatedTransactionFinder();

// Export utility functions
export function formatRelationshipType(type: RelationshipType): string {
  const formatted = type.replace(/_/g, ' ');
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function getRelationshipIcon(type: RelationshipType): string {
  const icons: Record<RelationshipType, string> = {
    account_sequence: '🔗',
    program_pattern: '⚙️',
    token_flow: '💸',
    temporal_cluster: '⏰',
    defi_protocol: '🏦',
    multi_step: '📋',
    arbitrage_pattern: '🔄',
    batch_operation: '📦',
    wallet_activity: '👛',
    contract_interaction: '📜'
  };
  
  return icons[type] || '🔍';
}

export function getStrengthColor(strength: 'weak' | 'medium' | 'strong'): string {
  const colors = {
    weak: 'text-gray-600 dark:text-gray-400',
    medium: 'text-yellow-600 dark:text-yellow-400', 
    strong: 'text-green-600 dark:text-green-400'
  };
  
  return colors[strength];
}

export function formatRelevanceScore(score: number): string {
  return `${(score * 100).toFixed(0)}%`;
}