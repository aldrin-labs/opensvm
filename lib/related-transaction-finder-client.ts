// Client-side types and utilities for related transaction finder
// These can be safely imported in client components

export interface RelatedTransaction {
  signature: string;
  slot: number;
  blockTime: number | null;
  relationship: TransactionRelationship;
  relevanceScore: number;
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
  confidence: number;
}

export type RelationshipType =
  | 'account_sequence'
  | 'program_pattern'
  | 'token_flow'
  | 'temporal_cluster'
  | 'defi_protocol'
  | 'multi_step'
  | 'arbitrage_pattern'
  | 'batch_operation'
  | 'wallet_activity'
  | 'contract_interaction';

export interface SharedElements {
  accounts: string[];
  programs: string[];
  tokens: string[];
  instructionTypes: string[];
  timeWindow: number;
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

// API client function to find related transactions
export async function findRelatedTransactions(query: RelatedTransactionQuery): Promise<RelatedTransactionResult> {
  const response = await fetch('/api/find-related-transactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`Failed to find related transactions: ${response.statusText}`);
  }

  const data = await response.json();
  return data.result;
}

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
