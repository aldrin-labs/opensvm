/**
 * Transaction Metadata Enricher
 * 
 * This service enriches transaction data with additional metadata including:
 * - Transaction categorization
 * - Risk assessment
 * - Performance analysis
 * - Context-aware descriptions
 */

import { EnhancedTransactionData } from './enhanced-transaction-fetcher';

export interface TransactionMetadataEnrichment {
  category: TransactionCategory;
  subCategory: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: RiskFactor[];
  performanceMetrics: PerformanceMetrics;
  contextualDescription: string;
  tags: string[];
  relatedPrograms: ProgramContext[];
  estimatedValue: EstimatedValue;
  complexity: TransactionComplexity;
}

export interface TransactionCategory {
  primary: 'transfer' | 'defi' | 'nft' | 'governance' | 'system' | 'unknown';
  secondary: string;
  confidence: number;
}

export interface RiskFactor {
  type: 'high_value' | 'unknown_program' | 'complex_flow' | 'suspicious_pattern' | 'new_account';
  severity: 'low' | 'medium' | 'high';
  description: string;
  evidence: string[];
}

export interface PerformanceMetrics {
  efficiency: number;
  costEffectiveness: number;
  complexity: number;
  gasOptimization: number;
}

export interface ProgramContext {
  programId: string;
  name: string;
  category: string;
  trustLevel: 'verified' | 'known' | 'unknown' | 'suspicious';
  description: string;
}

export interface EstimatedValue {
  totalValue: number;
  currency: 'SOL' | 'USD';
  breakdown: ValueBreakdown[];
  confidence: number;
}

export interface ValueBreakdown {
  type: 'sol_transfer' | 'token_transfer' | 'fee' | 'rent';
  amount: number;
  currency: 'SOL' | 'USD';
  description: string;
}

export interface TransactionComplexity {
  score: number;
  factors: ComplexityFactor[];
  level: 'simple' | 'moderate' | 'complex' | 'very_complex';
}

export interface ComplexityFactor {
  factor: 'instruction_count' | 'account_count' | 'program_diversity' | 'nested_calls' | 'data_size';
  weight: number;
  value: number;
  contribution: number;
}

export class TransactionMetadataEnricher {
  /**
   * Enrich transaction with comprehensive metadata
   */
  async enrichTransaction(transaction: EnhancedTransactionData): Promise<TransactionMetadataEnrichment> {
    const category = this.categorizeTransaction(transaction);
    const riskAssessment = this.assessRisk(transaction);
    const performanceMetrics = this.calculatePerformanceMetrics(transaction);
    const contextualDescription = this.generateContextualDescription(transaction, category);
    const tags = this.generateTags(transaction, category);
    const relatedPrograms = this.analyzePrograms(transaction);
    const estimatedValue = this.estimateValue(transaction);
    const complexity = this.analyzeComplexity(transaction);

    return {
      category,
      subCategory: this.determineSubCategory(transaction, category),
      riskLevel: riskAssessment.level,
      riskFactors: riskAssessment.factors,
      performanceMetrics,
      contextualDescription,
      tags,
      relatedPrograms,
      estimatedValue,
      complexity
    };
  }

  /**
   * Categorize transaction based on instructions and patterns
   */
  private categorizeTransaction(transaction: EnhancedTransactionData): TransactionCategory {
    const instructions = transaction.instructionData;
    const programIds = instructions.map(ix => ix.programId);

    // Check for DeFi patterns
    if (this.isDeFiTransaction(programIds, instructions)) {
      return {
        primary: 'defi',
        secondary: this.getDeFiSubCategory(programIds, instructions),
        confidence: 0.9
      };
    }

    // Check for NFT patterns
    if (this.isNFTTransaction(programIds, instructions)) {
      return {
        primary: 'nft',
        secondary: this.getNFTSubCategory(instructions),
        confidence: 0.85
      };
    }

    // Check for governance patterns
    if (this.isGovernanceTransaction(programIds)) {
      return {
        primary: 'governance',
        secondary: 'voting',
        confidence: 0.8
      };
    }

    // Check for simple transfers
    if (this.isSimpleTransfer(instructions)) {
      return {
        primary: 'transfer',
        secondary: this.getTransferType(instructions),
        confidence: 0.95
      };
    }

    // Check for system operations
    if (this.isSystemTransaction(programIds)) {
      return {
        primary: 'system',
        secondary: this.getSystemSubCategory(instructions),
        confidence: 0.9
      };
    }

    return {
      primary: 'unknown',
      secondary: 'unclassified',
      confidence: 0.1
    };
  }

  /**
   * Assess transaction risk level and factors
   */
  private assessRisk(transaction: EnhancedTransactionData): { level: 'low' | 'medium' | 'high' | 'critical', factors: RiskFactor[] } {
    const factors: RiskFactor[] = [];
    let maxSeverity: 'low' | 'medium' | 'high' = 'low';

    // Check for high-value transactions
    const totalValue = this.calculateTotalValue(transaction);
    if (totalValue > 100) { // > 100 SOL
      factors.push({
        type: 'high_value',
        severity: 'medium',
        description: 'High-value transaction detected',
        evidence: [`Transaction value: ${totalValue.toFixed(2)} SOL`]
      });
      maxSeverity = 'medium';
    }

    // Check for unknown programs
    const unknownPrograms = transaction.instructionData.filter(ix => !ix.programName);
    if (unknownPrograms.length > 0) {
      factors.push({
        type: 'unknown_program',
        severity: 'medium',
        description: 'Transaction involves unknown programs',
        evidence: unknownPrograms.map(ix => `Unknown program: ${ix.programId}`)
      });
      maxSeverity = 'medium';
    }

    // Check for complex transaction flows
    const complexity = this.calculateComplexityScore(transaction);
    if (complexity > 80) {
      factors.push({
        type: 'complex_flow',
        severity: 'medium',
        description: 'Complex transaction with multiple operations',
        evidence: [`Complexity score: ${complexity}`]
      });
      maxSeverity = 'medium';
    }

    // Check for new accounts
    const newAccounts = this.detectNewAccounts(transaction);
    if (newAccounts.length > 0) {
      factors.push({
        type: 'new_account',
        severity: 'low',
        description: 'Transaction creates new accounts',
        evidence: newAccounts.map(addr => `New account: ${addr}`)
      });
    }

    // Determine overall risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (factors.length === 0) {
      riskLevel = 'low';
    } else if (factors.length > 3) {
      riskLevel = 'high';
    } else if (maxSeverity === 'medium' || factors.length > 1) {
      riskLevel = 'medium';
    }

    return { level: riskLevel, factors };
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformanceMetrics(transaction: EnhancedTransactionData): PerformanceMetrics {
    const metrics = transaction.metrics;

    const efficiency = metrics.efficiency;
    const costEffectiveness = this.calculateCostEffectiveness(transaction);
    const complexity = this.calculateComplexityScore(transaction);
    const gasOptimization = this.calculateGasOptimization(transaction);

    return {
      efficiency,
      costEffectiveness,
      complexity,
      gasOptimization
    };
  }

  /**
   * Generate contextual description
   */
  private generateContextualDescription(transaction: EnhancedTransactionData, category: TransactionCategory): string {
    const instructions = transaction.instructionData;
    const totalValue = this.calculateTotalValue(transaction);

    switch (category.primary) {
      case 'transfer':
        if (category.secondary === 'sol') {
          return `SOL transfer of ${totalValue.toFixed(4)} SOL`;
        } else if (category.secondary === 'token') {
          const tokenTransfers = this.getTokenTransfers(transaction);
          return `Token transfer: ${tokenTransfers.map(t => `${t.amount} ${t.symbol || 'tokens'}`).join(', ')}`;
        }
        return 'Transfer transaction';

      case 'defi':
        return `DeFi operation: ${category.secondary}`;

      case 'nft':
        return `NFT operation: ${category.secondary}`;

      case 'system':
        return `System operation: ${category.secondary}`;

      case 'governance':
        return 'Governance transaction';

      default:
        return `Transaction with ${instructions.length} instruction${instructions.length > 1 ? 's' : ''}`;
    }
  }

  /**
   * Generate relevant tags
   */
  private generateTags(transaction: EnhancedTransactionData, category: TransactionCategory): string[] {
    const tags: string[] = [];

    // Add category tags
    tags.push(category.primary);
    if (category.secondary !== category.primary) {
      tags.push(category.secondary);
    }

    // Add program tags
    const uniquePrograms = [...new Set(transaction.instructionData.map(ix => ix.programName).filter(Boolean))];
    tags.push(...uniquePrograms.map(name => name!.toLowerCase().replace(/\s+/g, '_')));

    // Add value tags
    const totalValue = this.calculateTotalValue(transaction);
    if (totalValue > 100) tags.push('high_value');
    else if (totalValue > 10) tags.push('medium_value');
    else tags.push('low_value');

    // Add complexity tags
    const complexity = this.calculateComplexityScore(transaction);
    if (complexity > 80) tags.push('complex');
    else if (complexity > 40) tags.push('moderate');
    else tags.push('simple');

    // Add success/failure tag
    tags.push(transaction.meta.err ? 'failed' : 'success');

    return tags;
  }

  /**
   * Analyze programs involved in transaction
   */
  private analyzePrograms(transaction: EnhancedTransactionData): ProgramContext[] {
    const uniquePrograms = new Map<string, ProgramContext>();

    transaction.instructionData.forEach(ix => {
      if (!uniquePrograms.has(ix.programId)) {
        uniquePrograms.set(ix.programId, {
          programId: ix.programId,
          name: ix.programName || 'Unknown Program',
          category: this.getProgramCategory(ix.programId),
          trustLevel: this.getProgramTrustLevel(ix.programId),
          description: this.getProgramDescription(ix.programId)
        });
      }
    });

    return Array.from(uniquePrograms.values());
  }

  /**
   * Estimate transaction value
   */
  private estimateValue(transaction: EnhancedTransactionData): EstimatedValue {
    const breakdown: ValueBreakdown[] = [];
    let totalValue = 0;

    // Calculate SOL transfers
    const solTransfers = this.calculateSOLTransfers(transaction);
    if (solTransfers > 0) {
      breakdown.push({
        type: 'sol_transfer',
        amount: solTransfers,
        currency: 'SOL',
        description: 'SOL transfers'
      });
      totalValue += solTransfers;
    }

    // Calculate token transfers (simplified - would need price data)
    const tokenTransfers = this.getTokenTransfers(transaction);
    tokenTransfers.forEach(transfer => {
      breakdown.push({
        type: 'token_transfer',
        amount: transfer.amount,
        currency: 'SOL', // Simplified
        description: `${transfer.symbol || 'Token'} transfer`
      });
    });

    // Add fees
    const fee = transaction.metrics.totalFee / 1e9;
    breakdown.push({
      type: 'fee',
      amount: fee,
      currency: 'SOL',
      description: 'Transaction fee'
    });

    return {
      totalValue,
      currency: 'SOL',
      breakdown,
      confidence: 0.8
    };
  }

  /**
   * Analyze transaction complexity
   */
  private analyzeComplexity(transaction: EnhancedTransactionData): TransactionComplexity {
    const factors: ComplexityFactor[] = [];
    let totalScore = 0;

    // Instruction count factor
    const instructionCount = transaction.metrics.instructionCount + transaction.metrics.innerInstructionCount;
    const instructionWeight = 20;
    const instructionScore = Math.min(instructionCount * 10, 100);
    factors.push({
      factor: 'instruction_count',
      weight: instructionWeight,
      value: instructionCount,
      contribution: instructionScore * instructionWeight / 100
    });
    totalScore += instructionScore * instructionWeight / 100;

    // Account count factor
    const accountCount = transaction.accountStates.length;
    const accountWeight = 15;
    const accountScore = Math.min(accountCount * 5, 100);
    factors.push({
      factor: 'account_count',
      weight: accountWeight,
      value: accountCount,
      contribution: accountScore * accountWeight / 100
    });
    totalScore += accountScore * accountWeight / 100;

    // Program diversity factor
    const uniquePrograms = new Set(transaction.instructionData.map(ix => ix.programId)).size;
    const programWeight = 25;
    const programScore = Math.min(uniquePrograms * 20, 100);
    factors.push({
      factor: 'program_diversity',
      weight: programWeight,
      value: uniquePrograms,
      contribution: programScore * programWeight / 100
    });
    totalScore += programScore * programWeight / 100;

    // Nested calls factor
    const nestedCalls = transaction.instructionData.reduce((sum, ix) => sum + ix.innerInstructions.length, 0);
    const nestedWeight = 20;
    const nestedScore = Math.min(nestedCalls * 15, 100);
    factors.push({
      factor: 'nested_calls',
      weight: nestedWeight,
      value: nestedCalls,
      contribution: nestedScore * nestedWeight / 100
    });
    totalScore += nestedScore * nestedWeight / 100;

    // Data size factor
    const dataSize = transaction.metrics.size;
    const dataWeight = 20;
    const dataScore = Math.min(dataSize / 1000 * 10, 100);
    factors.push({
      factor: 'data_size',
      weight: dataWeight,
      value: dataSize,
      contribution: dataScore * dataWeight / 100
    });
    totalScore += dataScore * dataWeight / 100;

    // Determine complexity level
    let level: 'simple' | 'moderate' | 'complex' | 'very_complex';
    if (totalScore < 25) level = 'simple';
    else if (totalScore < 50) level = 'moderate';
    else if (totalScore < 75) level = 'complex';
    else level = 'very_complex';

    return {
      score: totalScore,
      factors,
      level
    };
  }

  // Helper methods for transaction analysis
  private isDeFiTransaction(programIds: string[], instructions: any[]): boolean {
    const defiPrograms = [
      'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter
      'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', // Whirlpool
      '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', // Raydium
    ];

    // Check program IDs first
    const hasDeFiProgram = programIds.some(id => defiPrograms.includes(id));

    // Analyze instructions for DeFi patterns
    const hasDeFiInstructions = instructions.some(ix =>
      ix.instructionType?.toLowerCase().includes('swap') ||
      ix.instructionType?.toLowerCase().includes('liquidity') ||
      ix.instructionType?.toLowerCase().includes('pool') ||
      ix.instructionType?.toLowerCase().includes('trade')
    );

    return hasDeFiProgram || hasDeFiInstructions;
  }

  private isNFTTransaction(programIds: string[], instructions: any[]): boolean {
    const nftPrograms = [
      'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s', // Metaplex
      'cndy3Z4yapfJBmL3ShUp5exZKqR3z33thTzeNMm2gRZ', // Candy Machine
    ];

    // Check program IDs first
    const hasNFTProgram = programIds.some(id => nftPrograms.includes(id));

    // Analyze instructions for NFT patterns
    const hasNFTInstructions = instructions.some(ix =>
      ix.instructionType?.toLowerCase().includes('mint') ||
      ix.instructionType?.toLowerCase().includes('nft') ||
      ix.instructionType?.toLowerCase().includes('metadata') ||
      ix.instructionType?.toLowerCase().includes('collection')
    );

    return hasNFTProgram || hasNFTInstructions;
  }

  private isGovernanceTransaction(programIds: string[]): boolean {
    const govPrograms = [
      'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw', // Governance
    ];
    return programIds.some(id => govPrograms.includes(id));
  }

  private isSimpleTransfer(instructions: any[]): boolean {
    return instructions.length <= 2 &&
      instructions.every(ix =>
        ix.instructionType === 'transfer' ||
        ix.instructionType === 'transferChecked'
      );
  }

  private isSystemTransaction(programIds: string[]): boolean {
    return programIds.includes('11111111111111111111111111111111');
  }

  private calculateTotalValue(transaction: EnhancedTransactionData): number {
    return transaction.accountStates.reduce((total, account) => {
      return total + Math.abs(account.lamportsDiff) / 1e9;
    }, 0);
  }

  private calculateComplexityScore(transaction: EnhancedTransactionData): number {
    const instructionCount = transaction.metrics.instructionCount;
    const accountCount = transaction.accountStates.length;
    const programCount = new Set(transaction.instructionData.map(ix => ix.programId)).size;

    return Math.min((instructionCount * 10) + (accountCount * 5) + (programCount * 15), 100);
  }

  private calculateCostEffectiveness(transaction: EnhancedTransactionData): number {
    const fee = transaction.metrics.totalFee;
    const value = this.calculateTotalValue(transaction) * 1e9; // Convert to lamports

    if (value === 0) return 50; // Neutral score for zero-value transactions

    const ratio = fee / value;
    return Math.max(0, Math.min(100, 100 - (ratio * 1000))); // Lower ratio = higher score
  }

  private calculateGasOptimization(transaction: EnhancedTransactionData): number {
    const efficiency = transaction.metrics.efficiency;
    const instructionCount = transaction.metrics.instructionCount;

    // Penalize transactions with many instructions but low efficiency
    const optimizationScore = efficiency - (instructionCount > 5 ? (instructionCount - 5) * 5 : 0);

    return Math.max(0, Math.min(100, optimizationScore));
  }

  private calculateSOLTransfers(transaction: EnhancedTransactionData): number {
    return transaction.accountStates.reduce((total, account) => {
      if (account.lamportsDiff > 0) {
        return total + (account.lamportsDiff / 1e9);
      }
      return total;
    }, 0);
  }

  private getTokenTransfers(transaction: EnhancedTransactionData): Array<{ amount: number, symbol?: string }> {
    const transfers: Array<{ amount: number, symbol?: string }> = [];

    transaction.accountStates.forEach(account => {
      account.tokenChanges.forEach(change => {
        if (change.uiAmountAfter && change.uiAmountBefore) {
          const amount = Math.abs((change.uiAmountAfter || 0) - (change.uiAmountBefore || 0));
          if (amount > 0) {
            transfers.push({ amount, symbol: undefined }); // Would need token registry for symbols
          }
        }
      });
    });

    return transfers;
  }

  private detectNewAccounts(transaction: EnhancedTransactionData): string[] {
    try {
      // Analyze account changes to detect new accounts
      const newAccounts: string[] = [];

      // Check for accounts with zero pre-balance but non-zero post-balance
      const transactionData = transaction as any;
      if (transactionData.accountChanges) {
        transactionData.accountChanges.forEach((change: any, index: number) => {
          const preBalance = transactionData.preBalances?.[index] || 0;
          const postBalance = transactionData.postBalances?.[index] || 0;

          // If account had no balance before but has balance after, likely new
          if (preBalance === 0 && postBalance > 0) {
            newAccounts.push(change.account);
          }
        });
      }

      // Check for system program account creation instructions
      if (transactionData.instructions) {
        transactionData.instructions.forEach((ix: any) => {
          if (ix.programId === '11111111111111111111111111111111' &&
            ix.instructionType?.toLowerCase().includes('create')) {
            // Extract created account from instruction accounts
            const createdAccount = ix.accounts?.[1]; // Usually the second account
            if (createdAccount && !newAccounts.includes(createdAccount)) {
              newAccounts.push(createdAccount);
            }
          }
        });
      }

      console.log(`Detected ${newAccounts.length} new accounts in transaction`);
      return newAccounts;
    } catch (error) {
      console.error('Error detecting new accounts:', error);
      return [];
    }
  }

  private getDeFiSubCategory(programIds: string[], instructions: any[]): string {
    // Analyze specific DeFi operations based on programs and instructions

    // Jupiter-specific operations
    if (programIds.includes('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4')) {
      return 'jupiter_swap';
    }

    // Whirlpool-specific operations
    if (programIds.includes('whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc')) {
      if (instructions.some(ix => ix.instructionType?.includes('liquidity'))) return 'whirlpool_liquidity';
      return 'whirlpool_operation';
    }

    // Raydium-specific operations
    if (programIds.includes('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM')) {
      if (instructions.some(ix => ix.instructionType?.includes('swap'))) return 'raydium_swap';
      if (instructions.some(ix => ix.instructionType?.includes('liquidity'))) return 'raydium_liquidity';
      return 'raydium_operation';
    }

    // Generic DeFi operation analysis
    if (instructions.some(ix => ix.instructionType?.includes('swap'))) return 'swap';
    if (instructions.some(ix => ix.instructionType?.includes('liquidity'))) return 'liquidity';
    if (instructions.some(ix => ix.instructionType?.includes('pool'))) return 'pool_operation';

    return 'defi_operation';
  }

  private getNFTSubCategory(instructions: any[]): string {
    if (instructions.some(ix => ix.instructionType?.includes('mint'))) return 'mint';
    if (instructions.some(ix => ix.instructionType?.includes('transfer'))) return 'transfer';
    return 'nft_operation';
  }

  private getTransferType(instructions: any[]): string {
    if (instructions.some(ix => ix.programId === '11111111111111111111111111111111')) return 'sol';
    if (instructions.some(ix => ix.programId === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')) return 'token';
    return 'transfer';
  }

  private getSystemSubCategory(instructions: any[]): string {
    if (instructions.some(ix => ix.instructionType === 'createAccount')) return 'account_creation';
    if (instructions.some(ix => ix.instructionType === 'transfer')) return 'sol_transfer';
    return 'system_operation';
  }

  private determineSubCategory(transaction: EnhancedTransactionData, category: TransactionCategory): string {
    try {
      // Analyze transaction data for more specific subcategorization
      const transactionData = transaction as any;
      const instructions = transactionData.instructions || [];
      const programIds = instructions.map((ix: any) => ix.programId).filter(Boolean);

      // Use transaction-specific analysis based on category
      switch (category.primary) {
        case 'defi':
          return this.getDeFiSubCategory(programIds, instructions);

        case 'nft':
          return this.getNFTSubCategory(instructions);

        case 'transfer':
          return this.getTransferType(instructions);

        case 'system':
          return this.getSystemSubCategory(instructions);

        default:
          // Analyze transaction complexity for unknown categories
          if (instructions.length > 5) return 'complex_operation';
          if (instructions.length > 1) return 'multi_instruction';
          return category.secondary || 'simple_operation';
      }
    } catch (error) {
      console.error('Error determining subcategory:', error);
      return category.secondary || 'unknown';
    }
  }

  private getProgramCategory(programId: string): string {
    const categories: Record<string, string> = {
      '11111111111111111111111111111111': 'system',
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': 'token',
      'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL': 'token',
      'ComputeBudget111111111111111111111111111111': 'system'
    };
    return categories[programId] || 'unknown';
  }

  private getProgramTrustLevel(programId: string): 'verified' | 'known' | 'unknown' | 'suspicious' {
    const verifiedPrograms = [
      '11111111111111111111111111111111',
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
      'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
    ];

    if (verifiedPrograms.includes(programId)) return 'verified';
    return 'unknown';
  }

  private getProgramDescription(programId: string): string {
    const descriptions: Record<string, string> = {
      '11111111111111111111111111111111': 'Core Solana system program for account management',
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': 'SPL Token program for token operations',
      'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL': 'Associated Token Account program'
    };
    return descriptions[programId] || 'Unknown program';
  }
}

// Export singleton instance
export const transactionMetadataEnricher = new TransactionMetadataEnricher();