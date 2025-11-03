// Client-side utilities and types for account changes analysis
// These can be safely imported in client components

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

// API response type that includes both analysis and detailed changes
export interface AccountChangesResponse {
  analysis: AccountChangesAnalysis;
  accountChanges: AccountChange[];
}

// API client function to analyze account changes
export async function analyzeAccountChanges(transaction: any): Promise<AccountChangesResponse> {
  const response = await fetch('/api/analyze-account-changes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ transaction }),
  });

  if (!response.ok) {
    throw new Error(`Failed to analyze account changes: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
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
