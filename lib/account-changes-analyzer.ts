/**
 * Account Changes Analyzer
 * 
 * This service analyzes account state changes in Solana transactions,
 * calculating before/after states, balance changes, and token changes.
 */

import type { DetailedTransactionInfo } from './solana';
import { transactionAnalysisCache } from './transaction-analysis-cache';

export interface AccountChange {
  accountIndex: number;
  pubkey: string;
  preBalance: number;
  postBalance: number;
  balanceChange: number;
  preTokenBalances: TokenBalance[];
  postTokenBalances: TokenBalance[];
  tokenChanges: TokenChange[];
  dataChange?: {
    hasChanged: boolean;
    preData?: string;
    postData?: string;
    dataSize: number;
    sizeChange?: number;
    significance: 'low' | 'medium' | 'high';
    dataType?: string;
  };
  ownerChange?: {
    hasChanged: boolean;
    preOwner?: string;
    postOwner?: string;
  };
  rentExemptStatus?: {
    preRentExempt: boolean;
    postRentExempt: boolean;
    changed: boolean;
  };
}

export interface TokenBalance {
  mint: string;
  amount: string;
  decimals: number;
  uiAmount: number | null;
  uiAmountString: string;
  owner?: string;
}

export interface TokenChange {
  mint: string;
  symbol?: string;
  name?: string;
  decimals: number;
  preAmount: number;
  postAmount: number;
  change: number;
  changePercent: number;
  usdValue?: number;
  significance: 'low' | 'medium' | 'high';
}

export interface AccountChangesAnalysis {
  totalAccounts: number;
  changedAccounts: number;
  solChanges: {
    totalSolChange: number;
    positiveChanges: number;
    negativeChanges: number;
    largestIncrease: AccountChange | null;
    largestDecrease: AccountChange | null;
  };
  tokenChanges: {
    totalTokensAffected: number;
    uniqueTokens: string[];
    significantChanges: TokenChange[];
  };
  dataChanges: {
    accountsWithDataChanges: number;
    significantDataChanges: AccountChange[];
  };
  ownershipChanges: {
    accountsWithOwnershipChanges: number;
    ownershipTransfers: AccountChange[];
  };
  riskAssessment: {
    level: 'low' | 'medium' | 'high';
    factors: string[];
    recommendations: string[];
  };
}

class AccountChangesAnalyzer {
  /**
   * Analyze all account changes in a transaction
   */
  public async analyzeTransaction(transaction: DetailedTransactionInfo): Promise<AccountChangesAnalysis> {
    // Skip cache operations in browser - just do the analysis directly
    let cachedAnalysis = null;
    if (typeof window === 'undefined') {
      // Check cache first (server-side only)
      cachedAnalysis = await transactionAnalysisCache.getCachedAccountChanges(transaction.signature);
    }
    
    if (cachedAnalysis) {
      console.log(`Using cached account changes analysis for transaction ${transaction.signature}`);
      return cachedAnalysis;
    }

    const accountChanges = this.calculateAccountChanges(transaction);
    
    const analysis: AccountChangesAnalysis = {
      totalAccounts: transaction.details?.accounts?.length || 0,
      changedAccounts: accountChanges.filter(change => this.hasSignificantChange(change)).length,
      solChanges: this.analyzeSolChanges(accountChanges),
      tokenChanges: this.analyzeTokenChanges(accountChanges),
      dataChanges: this.analyzeDataChanges(accountChanges),
      ownershipChanges: this.analyzeOwnershipChanges(accountChanges),
      riskAssessment: this.assessRisk(accountChanges, transaction)
    };

    // Cache the result (server-side only)
    if (typeof window === 'undefined') {
      await transactionAnalysisCache.cacheAccountChanges(transaction.signature, analysis);
    }
    
    return analysis;
  }

  /**
   * Calculate detailed changes for each account
   */
  public calculateAccountChanges(transaction: DetailedTransactionInfo): AccountChange[] {
    const accounts = transaction.details?.accounts || [];
    const preBalances = transaction.details?.preBalances || [];
    const postBalances = transaction.details?.postBalances || [];
    const preTokenBalances = transaction.details?.preTokenBalances || [];
    const postTokenBalances = transaction.details?.postTokenBalances || [];

    return accounts.map((account, index) => {
      const preBalance = preBalances[index] || 0;
      const postBalance = postBalances[index] || 0;
      const balanceChange = postBalance - preBalance;

      // Get token balances for this account
      const accountPreTokens = preTokenBalances.filter(tb => tb.accountIndex === index);
      const accountPostTokens = postTokenBalances.filter(tb => tb.accountIndex === index);

      // Calculate token changes
      const tokenChanges = this.calculateTokenChanges(accountPreTokens, accountPostTokens);

      // Analyze data changes (if available)
      const dataChange = this.analyzeAccountDataChange(account, index, transaction);

      // Analyze ownership changes
      const ownerChange = this.analyzeOwnershipChange(account, index, transaction);

      // Calculate rent exempt status
      const rentExemptStatus = this.analyzeRentExemptStatus(preBalance, postBalance);

      return {
        accountIndex: index,
        pubkey: account.pubkey,
        preBalance,
        postBalance,
        balanceChange,
        preTokenBalances: accountPreTokens.map(this.normalizeTokenBalance),
        postTokenBalances: accountPostTokens.map(this.normalizeTokenBalance),
        tokenChanges,
        dataChange,
        ownerChange,
        rentExemptStatus
      };
    });
  }

  /**
   * Calculate token balance changes for an account
   */
  private calculateTokenChanges(
    preTokenBalances: any[],
    postTokenBalances: any[]
  ): TokenChange[] {
    const changes: TokenChange[] = [];
    const processedMints = new Set<string>();

    // Process all token balances
    const allTokenBalances = [...preTokenBalances, ...postTokenBalances];
    
    for (const tokenBalance of allTokenBalances) {
      const mint = tokenBalance.mint;
      if (processedMints.has(mint)) continue;
      processedMints.add(mint);

      const preBalance = preTokenBalances.find(tb => tb.mint === mint);
      const postBalance = postTokenBalances.find(tb => tb.mint === mint);

      const preAmount = preBalance?.uiTokenAmount?.uiAmount || 0;
      const postAmount = postBalance?.uiTokenAmount?.uiAmount || 0;
      const change = postAmount - preAmount;

      if (change !== 0) {
        const changePercent = preAmount > 0 ? (change / preAmount) * 100 : 100;
        
        changes.push({
          mint,
          decimals: tokenBalance.uiTokenAmount?.decimals || 0,
          preAmount,
          postAmount,
          change,
          changePercent,
          significance: this.assessTokenChangeSignificance(change, changePercent)
        });
      }
    }

    return changes.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  }

  /**
   * Analyze SOL balance changes
   */
  private analyzeSolChanges(accountChanges: AccountChange[]) {
    const solChanges = accountChanges.filter(change => change.balanceChange !== 0);
    const totalSolChange = solChanges.reduce((sum, change) => sum + change.balanceChange, 0);
    
    const positiveChanges = solChanges.filter(change => change.balanceChange > 0);
    const negativeChanges = solChanges.filter(change => change.balanceChange < 0);

    const largestIncrease = positiveChanges.length > 0 
      ? positiveChanges.reduce((max, change) => 
          change.balanceChange > max.balanceChange ? change : max
        )
      : null;

    const largestDecrease = negativeChanges.length > 0
      ? negativeChanges.reduce((min, change) => 
          change.balanceChange < min.balanceChange ? change : min
        )
      : null;

    return {
      totalSolChange,
      positiveChanges: positiveChanges.length,
      negativeChanges: negativeChanges.length,
      largestIncrease,
      largestDecrease
    };
  }

  /**
   * Analyze token changes across all accounts
   */
  private analyzeTokenChanges(accountChanges: AccountChange[]) {
    const allTokenChanges = accountChanges.flatMap(change => change.tokenChanges);
    const uniqueTokens = [...new Set(allTokenChanges.map(change => change.mint))];
    const significantChanges = allTokenChanges.filter(change => 
      change.significance === 'high' || Math.abs(change.change) > 1000
    );

    return {
      totalTokensAffected: allTokenChanges.length,
      uniqueTokens,
      significantChanges
    };
  }

  /**
   * Analyze account data changes
   */
  private analyzeDataChanges(accountChanges: AccountChange[]) {
    const accountsWithDataChanges = accountChanges.filter(
      change => change.dataChange?.hasChanged
    );
    
    const significantDataChanges = accountsWithDataChanges.filter(
      change => change.dataChange?.significance === 'high'
    );

    return {
      accountsWithDataChanges: accountsWithDataChanges.length,
      significantDataChanges
    };
  }

  /**
   * Analyze ownership changes
   */
  private analyzeOwnershipChanges(accountChanges: AccountChange[]) {
    const ownershipChanges = accountChanges.filter(
      change => change.ownerChange?.hasChanged
    );

    return {
      accountsWithOwnershipChanges: ownershipChanges.length,
      ownershipTransfers: ownershipChanges
    };
  }

  /**
   * Assess overall risk level of the transaction
   */
  private assessRisk(
    accountChanges: AccountChange[], 
    transaction: DetailedTransactionInfo
  ): AccountChangesAnalysis['riskAssessment'] {
    const factors: string[] = [];
    let riskScore = 0;

    // Check for large SOL transfers
    const largeSolChanges = accountChanges.filter(
      change => Math.abs(change.balanceChange) > 1e9 // > 1 SOL
    );
    if (largeSolChanges.length > 0) {
      factors.push('Large SOL transfers detected');
      riskScore += 2;
    }

    // Check for significant token changes
    const significantTokenChanges = accountChanges.flatMap(change => 
      change.tokenChanges.filter(tc => tc.significance === 'high')
    );
    if (significantTokenChanges.length > 0) {
      factors.push('Significant token balance changes');
      riskScore += 2;
    }

    // Check for ownership changes
    const ownershipChanges = accountChanges.filter(
      change => change.ownerChange?.hasChanged
    );
    if (ownershipChanges.length > 0) {
      factors.push('Account ownership changes detected');
      riskScore += 3;
    }

    // Check for data changes
    const dataChanges = accountChanges.filter(
      change => change.dataChange?.significance === 'high'
    );
    if (dataChanges.length > 0) {
      factors.push('Significant account data modifications');
      riskScore += 2;
    }

    // Check for failed transaction
    if (!transaction.success) {
      factors.push('Transaction failed');
      riskScore += 1;
    }

    // Check for many account interactions
    if (accountChanges.length > 10) {
      factors.push('High number of account interactions');
      riskScore += 1;
    }

    // Determine risk level
    let level: 'low' | 'medium' | 'high';
    if (riskScore >= 6) {
      level = 'high';
    } else if (riskScore >= 3) {
      level = 'medium';
    } else {
      level = 'low';
    }

    // Generate recommendations
    const recommendations = this.generateRiskRecommendations(level, factors);

    return {
      level,
      factors,
      recommendations
    };
  }

  /**
   * Generate risk-based recommendations
   */
  private generateRiskRecommendations(
    level: 'low' | 'medium' | 'high',
    factors: string[]
  ): string[] {
    const recommendations: string[] = [];

    if (level === 'high') {
      recommendations.push('Carefully review all account changes before proceeding');
      recommendations.push('Verify the transaction source and intended recipients');
    }

    if (level === 'medium' || level === 'high') {
      recommendations.push('Double-check token amounts and recipients');
      recommendations.push('Ensure you understand the purpose of this transaction');
    }

    if (factors.includes('Account ownership changes detected')) {
      recommendations.push('Ownership changes are permanent - verify this is intended');
    }

    if (factors.includes('Large SOL transfers detected')) {
      recommendations.push('Verify the SOL transfer amounts and destinations');
    }

    if (factors.includes('Transaction failed')) {
      recommendations.push('Investigate why the transaction failed');
      recommendations.push('Check if any partial state changes occurred');
    }

    if (recommendations.length === 0) {
      recommendations.push('Transaction appears to have standard risk profile');
    }

    return recommendations;
  }

  /**
   * Helper methods
   */
  private hasSignificantChange(change: AccountChange): boolean {
    return (
      change.balanceChange !== 0 ||
      change.tokenChanges.length > 0 ||
      change.dataChange?.hasChanged ||
      change.ownerChange?.hasChanged
    );
  }

  private normalizeTokenBalance(tokenBalance: any): TokenBalance {
    return {
      mint: tokenBalance.mint,
      amount: tokenBalance.uiTokenAmount?.amount || '0',
      decimals: tokenBalance.uiTokenAmount?.decimals || 0,
      uiAmount: tokenBalance.uiTokenAmount?.uiAmount || 0,
      uiAmountString: tokenBalance.uiTokenAmount?.uiAmountString || '0',
      owner: tokenBalance.owner
    };
  }

  private assessTokenChangeSignificance(
    change: number,
    changePercent: number
  ): 'low' | 'medium' | 'high' {
    if (Math.abs(change) > 10000 || Math.abs(changePercent) > 50) {
      return 'high';
    } else if (Math.abs(change) > 100 || Math.abs(changePercent) > 10) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  private analyzeAccountDataChange(
    account: any,
    index: number,
    transaction: DetailedTransactionInfo
  ) {
    // Check if we have account data information
    const preAccountData = this.getAccountDataFromTransaction(transaction, index, 'pre');
    const postAccountData = this.getAccountDataFromTransaction(transaction, index, 'post');
    
    if (!preAccountData && !postAccountData) {
      return {
        hasChanged: false,
        dataSize: 0,
        significance: 'low' as const
      };
    }
    
    const preData = preAccountData?.data || '';
    const postData = postAccountData?.data || '';
    const preSize = preData.length;
    const postSize = postData.length;
    
    const hasChanged = preData !== postData;
    const sizeChange = postSize - preSize;
    const maxSize = Math.max(preSize, postSize);
    
    // Determine significance based on data size and change magnitude
    let significance: 'low' | 'medium' | 'high' = 'low';
    
    if (hasChanged) {
      if (maxSize > 10000 || Math.abs(sizeChange) > 1000) {
        significance = 'high';
      } else if (maxSize > 1000 || Math.abs(sizeChange) > 100) {
        significance = 'medium';
      }
    }
    
    return {
      hasChanged,
      preData: preData.length > 0 ? preData : undefined,
      postData: postData.length > 0 ? postData : undefined,
      dataSize: maxSize,
      sizeChange,
      significance,
      dataType: this.detectAccountDataType(account, preData, postData)
    };
  }

  private analyzeOwnershipChange(
    account: any,
    index: number,
    transaction: DetailedTransactionInfo
  ) {
    // This would require pre/post owner information
    // For now, we'll return a placeholder implementation
    return {
      hasChanged: false
    };
  }

  private analyzeRentExemptStatus(preBalance: number, postBalance: number) {
    const RENT_EXEMPT_THRESHOLD = 890880; // Approximate rent-exempt threshold in lamports
    
    const preRentExempt = preBalance >= RENT_EXEMPT_THRESHOLD;
    const postRentExempt = postBalance >= RENT_EXEMPT_THRESHOLD;
    
    return {
      preRentExempt,
      postRentExempt,
      changed: preRentExempt !== postRentExempt
    };
  }

  /**
   * Get account data from transaction (pre or post)
   */
  private getAccountDataFromTransaction(
    transaction: DetailedTransactionInfo,
    accountIndex: number,
    type: 'pre' | 'post'
  ) {
    // In a real implementation, this would extract account data from the transaction
    // For now, we'll simulate based on available transaction information
    const account = transaction.details?.accounts?.[accountIndex];
    if (!account) return null;

    // Check if this is a program account or has data
    const isProgram = account.executable;
    const hasData = account.owner !== '11111111111111111111111111111111'; // Not system program

    if (isProgram || hasData) {
      // Simulate account data based on account type
      return {
        data: this.simulateAccountData(account, type),
        owner: account.owner,
        executable: account.executable
      };
    }

    return null;
  }

  /**
   * Simulate account data for demonstration purposes
   */
  private simulateAccountData(account: any, type: 'pre' | 'post'): string {
    // This is a simulation - in reality, account data would come from the transaction
    const baseData = account.pubkey.substring(0, 16);
    
    if (account.owner === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') {
      // Token account data simulation
      return type === 'pre' ? 
        `${baseData}:token:mint:amount:1000` : 
        `${baseData}:token:mint:amount:2000`;
    } else if (account.executable) {
      // Program account data simulation
      return `${baseData}:program:code:${type}`;
    } else {
      // Generic account data simulation
      return `${baseData}:data:${type}:state`;
    }
  }

  /**
   * Detect the type of account data
   */
  private detectAccountDataType(account: any, preData: string, postData: string): string {
    if (account.executable) {
      return 'program';
    }
    
    if (account.owner === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') {
      return 'token_account';
    }
    
    if (account.owner === 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL') {
      return 'associated_token_account';
    }
    
    if (account.owner === 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s') {
      return 'metadata_account';
    }
    
    if (preData.includes('mint') || postData.includes('mint')) {
      return 'token_mint';
    }
    
    return 'generic';
  }
}

// Export singleton instance
export const accountChangesAnalyzer = new AccountChangesAnalyzer();

// Export main analysis function
export function analyzeAccountChanges(transaction: any) {
  return accountChangesAnalyzer.analyzeTransaction(transaction);
}

// Export utility functions
export function formatSolAmount(lamports: number): string {
  return (lamports / 1e9).toFixed(9) + ' SOL';
}

export function formatTokenAmount(
  amount: number,
  decimals: number,
  symbol?: string
): string {
  const formatted = amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.min(decimals, 6)
  });
  return symbol ? `${formatted} ${symbol}` : formatted;
}

export function getChangeDirection(change: number): 'increase' | 'decrease' | 'none' {
  if (change > 0) return 'increase';
  if (change < 0) return 'decrease';
  return 'none';
}

export function getChangeColor(change: number): string {
  if (change > 0) return 'text-green-600 dark:text-green-400';
  if (change < 0) return 'text-red-600 dark:text-red-400';
  return 'text-muted-foreground';
}

export function getRiskColor(level: 'low' | 'medium' | 'high'): string {
  switch (level) {
    case 'low':
      return 'text-green-600 dark:text-green-400';
    case 'medium':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'high':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-muted-foreground';
  }
}