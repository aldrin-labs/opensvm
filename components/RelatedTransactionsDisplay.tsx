'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  NetworkIcon,
  FilterIcon,
  SortAscIcon,
  SortDescIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  CopyIcon,
  CheckIcon,
  RefreshCwIcon,
  AlertTriangleIcon,
  InfoIcon,
  TrendingUpIcon,
  ClockIcon,
  UsersIcon,
  DollarSignIcon,
  SearchIcon,
  EyeIcon,
  EyeOffIcon
} from 'lucide-react';
import Link from 'next/link';
import type { DetailedTransactionInfo } from '@/lib/solana';
import { 
  relatedTransactionFinder,
  formatRelationshipType,
  getRelationshipIcon,
  getStrengthColor,
  formatRelevanceScore,
  type RelatedTransactionQuery,
  type RelatedTransactionResult,
  type RelatedTransaction,
  type RelationshipType,
  type TransactionInsight
} from '@/lib/related-transaction-finder';
import { 
  relationshipStrengthScorer,
  formatStrengthLevel,
  getStrengthLevelColor,
  formatComponentScore,
  getRelevanceCategoryColor,
  type RelationshipScore,
  type RelevanceRanking
} from '@/lib/relationship-strength-scorer';

interface RelatedTransactionsDisplayProps {
  transaction: DetailedTransactionInfo;
  className?: string;
  maxResults?: number;
  timeWindowHours?: number;
  minRelevanceScore?: number;
  showAdvancedFilters?: boolean;
}

interface FilterState {
  relationshipTypes: RelationshipType[];
  strengthLevels: ('weak' | 'medium' | 'strong')[];
  timeRange: 'all' | '1h' | '6h' | '24h' | '7d';
  minRelevance: number;
  searchQuery: string;
  sortBy: 'relevance' | 'time' | 'strength' | 'type';
  sortOrder: 'asc' | 'desc';
}

interface GroupedTransactions {
  [key: string]: RelatedTransaction[];
}

const RelatedTransactionsDisplay: React.FC<RelatedTransactionsDisplayProps> = ({
  transaction,
  className = '',
  maxResults = 20,
  timeWindowHours = 24,
  minRelevanceScore = 0.1,
  showAdvancedFilters = true
}) => {
  const [result, setResult] = useState<RelatedTransactionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['insights', 'relationships']));
  const [copiedSignature, setCopiedSignature] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<RelatedTransaction | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    relationshipTypes: [],
    strengthLevels: [],
    timeRange: 'all',
    minRelevance: minRelevanceScore,
    searchQuery: '',
    sortBy: 'relevance',
    sortOrder: 'desc'
  });

  const loadRelatedTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const query: RelatedTransactionQuery = {
        signature: transaction.signature,
        maxResults,
        timeWindowHours,
        minRelevanceScore,
        includeTokenFlows: true,
        includeDeFiPatterns: true
      };

      const relatedResult = await relatedTransactionFinder.findRelatedTransactions(query);
      setResult(relatedResult);
      
    } catch (err) {
      console.error('Failed to load related transactions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load related transactions');
    } finally {
      setLoading(false);
    }
  }, [transaction.signature, maxResults, timeWindowHours, minRelevanceScore]);

  // Load related transactions on component mount
  useEffect(() => {
    loadRelatedTransactions();
  }, [loadRelatedTransactions]);

  // Filter and sort transactions based on current filters
  const filteredTransactions = useMemo(() => {
    if (!result) return [];

    let filtered = result.relatedTransactions;

    // Apply relationship type filter
    if (filters.relationshipTypes.length > 0) {
      filtered = filtered.filter(tx => 
        filters.relationshipTypes.includes(tx.relationship.type)
      );
    }

    // Apply strength level filter
    if (filters.strengthLevels.length > 0) {
      filtered = filtered.filter(tx => 
        filters.strengthLevels.includes(tx.relationship.strength)
      );
    }

    // Apply time range filter
    if (filters.timeRange !== 'all') {
      const now = Date.now();
      const timeRanges = {
        '1h': 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000
      };
      
      const maxAge = timeRanges[filters.timeRange];
      filtered = filtered.filter(tx => 
        tx.blockTime && (now - tx.blockTime) <= maxAge
      );
    }

    // Apply relevance filter
    filtered = filtered.filter(tx => tx.relevanceScore >= filters.minRelevance);

    // Apply search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(tx => 
        tx.signature.toLowerCase().includes(query) ||
        tx.summary.toLowerCase().includes(query) ||
        formatRelationshipType(tx.relationship.type).toLowerCase().includes(query)
      );
    }

    // Sort transactions
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (filters.sortBy) {
        case 'relevance':
          comparison = a.relevanceScore - b.relevanceScore;
          break;
        case 'time':
          comparison = (a.blockTime || 0) - (b.blockTime || 0);
          break;
        case 'strength':
          const strengthOrder = { weak: 1, medium: 2, strong: 3 };
          comparison = strengthOrder[a.relationship.strength] - strengthOrder[b.relationship.strength];
          break;
        case 'type':
          comparison = a.relationship.type.localeCompare(b.relationship.type);
          break;
      }
      
      return filters.sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [result, filters]);

  // Group transactions by relationship type
  const groupedTransactions = useMemo(() => {
    const grouped: GroupedTransactions = {};
    
    filteredTransactions.forEach(tx => {
      const type = tx.relationship.type;
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(tx);
    });
    
    return grouped;
  }, [filteredTransactions]);

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const copySignature = async (signature: string) => {
    try {
      await navigator.clipboard.writeText(signature);
      setCopiedSignature(signature);
      setTimeout(() => setCopiedSignature(null), 2000);
    } catch (err) {
      console.error('Failed to copy signature:', err);
    }
  };

  const formatTimeAgo = (timestamp: number | null) => {
    if (!timestamp) return 'Unknown time';
    
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (60 * 1000));
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const getInsightIcon = (type: TransactionInsight['type']) => {
    switch (type) {
      case 'pattern': return <TrendingUpIcon className="w-4 h-4 text-blue-500" />;
      case 'anomaly': return <AlertTriangleIcon className="w-4 h-4 text-red-500" />;
      case 'opportunity': return <DollarSignIcon className="w-4 h-4 text-green-500" />;
      case 'warning': return <AlertTriangleIcon className="w-4 h-4 text-yellow-500" />;
      default: return <InfoIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  const getInsightColor = (severity: TransactionInsight['severity']) => {
    switch (severity) {
      case 'high': return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20';
      case 'medium': return 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20';
      case 'low': return 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20';
      default: return 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/20';
    }
  };

  if (loading) {
    return (
      <div className={`bg-background rounded-lg border border-border p-6 ${className}`}>
        <div className="flex items-center space-x-3 mb-4">
          <div className="animate-spin">
            <NetworkIcon className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Related Transactions</h2>
        </div>
        <div className="space-y-3">
          <div className="animate-pulse bg-muted/20 h-4 rounded w-3/4"></div>
          <div className="animate-pulse bg-muted/20 h-4 rounded w-1/2"></div>
          <div className="animate-pulse bg-muted/20 h-4 rounded w-2/3"></div>
        </div>
        <p className="text-sm text-muted-foreground mt-4">Discovering related transactions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-background rounded-lg border border-border p-6 ${className}`}>
        <div className="flex items-center space-x-3 mb-4">
          <AlertTriangleIcon className="w-6 h-6 text-red-500" />
          <h2 className="text-xl font-semibold text-foreground">Related Transactions</h2>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
          <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
        </div>
        <button
          onClick={loadRelatedTransactions}
          className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          <RefreshCwIcon className="w-4 h-4" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  if (!result || result.relatedTransactions.length === 0) {
    return (
      <div className={`bg-background rounded-lg border border-border p-6 ${className}`}>
        <div className="flex items-center space-x-3 mb-4">
          <NetworkIcon className="w-6 h-6 text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground">Related Transactions</h2>
        </div>
        <div className="text-center py-8">
          <NetworkIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No related transactions found</p>
          <p className="text-sm text-muted-foreground mt-2">
            Try adjusting the time window or relevance threshold
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-background rounded-lg border border-border ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <NetworkIcon className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Related Transactions</h2>
            <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
              {filteredTransactions.length} found
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            {showAdvancedFilters && (
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-md transition-colors ${
                  showFilters 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Toggle filters"
              >
                <FilterIcon className="w-4 h-4" />
              </button>
            )}
            
            <button
              onClick={loadRelatedTransactions}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              title="Refresh"
            >
              <RefreshCwIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search and Quick Stats */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center space-x-4">
            <span>Found in {result.searchTimeMs}ms</span>
            <span>•</span>
            <span>{result.totalFound} total discovered</span>
            {result.totalFound > filteredTransactions.length && (
              <>
                <span>•</span>
                <span>{result.totalFound - filteredTransactions.length} filtered out</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Advanced Filters */}
      {showFilters && showAdvancedFilters && (
        <div className="p-6 border-b border-border bg-muted/5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Search</label>
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={filters.searchQuery}
                  onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
                  className="w-full pl-10 pr-3 py-2 bg-background border border-border rounded-md text-sm"
                />
              </div>
            </div>

            {/* Time Range */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Time Range</label>
              <select
                value={filters.timeRange}
                onChange={(e) => setFilters(prev => ({ ...prev, timeRange: e.target.value as any }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm"
              >
                <option value="all">All time</option>
                <option value="1h">Last hour</option>
                <option value="6h">Last 6 hours</option>
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Sort By</label>
              <div className="flex space-x-2">
                <select
                  value={filters.sortBy}
                  onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value as any }))}
                  className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-sm"
                >
                  <option value="relevance">Relevance</option>
                  <option value="time">Time</option>
                  <option value="strength">Strength</option>
                  <option value="type">Type</option>
                </select>
                <button
                  onClick={() => setFilters(prev => ({ 
                    ...prev, 
                    sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc' 
                  }))}
                  className="p-2 bg-background border border-border rounded-md hover:bg-muted transition-colors"
                  title={`Sort ${filters.sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                >
                  {filters.sortOrder === 'asc' ? (
                    <SortAscIcon className="w-4 h-4" />
                  ) : (
                    <SortDescIcon className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Min Relevance */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Min Relevance ({(filters.minRelevance * 100).toFixed(0)}%)
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={filters.minRelevance}
                onChange={(e) => setFilters(prev => ({ ...prev, minRelevance: parseFloat(e.target.value) }))}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* Insights Section */}
      {result.insights.length > 0 && (
        <div className="p-6 border-b border-border">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection('insights')}
          >
            <h3 className="text-lg font-medium text-foreground flex items-center space-x-2">
              <span>Insights ({result.insights.length})</span>
              {expandedSections.has('insights') ? (
                <ChevronDownIcon className="w-5 h-5" />
              ) : (
                <ChevronRightIcon className="w-5 h-5" />
              )}
            </h3>
          </div>
          
          {expandedSections.has('insights') && (
            <div className="mt-4 space-y-3">
              {result.insights.map((insight, index) => (
                <div key={index} className={`p-4 rounded-lg border ${getInsightColor(insight.severity)}`}>
                  <div className="flex items-start space-x-3">
                    {getInsightIcon(insight.type)}
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-medium text-foreground">{insight.title}</h4>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          insight.severity === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                          insight.severity === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                          'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        }`}>
                          {insight.severity}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{insight.description}</p>
                      <div className="flex items-center space-x-2 mt-2 text-xs text-muted-foreground">
                        <span>{insight.relatedTransactions.length} related transactions</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}     
 {/* Relationship Summary */}
      <div className="p-6 border-b border-border">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => toggleSection('summary')}
        >
          <h3 className="text-lg font-medium text-foreground flex items-center space-x-2">
            <span>Relationship Summary</span>
            {expandedSections.has('summary') ? (
              <ChevronDownIcon className="w-5 h-5" />
            ) : (
              <ChevronRightIcon className="w-5 h-5" />
            )}
          </h3>
        </div>
        
        {expandedSections.has('summary') && (
          <div className="mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(result.relationshipSummary).map(([type, count]) => (
                <div key={type} className="bg-muted/10 p-3 rounded-lg">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-lg">{getRelationshipIcon(type as RelationshipType)}</span>
                    <span className="font-medium text-foreground">{count}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatRelationshipType(type as RelationshipType)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Related Transactions List */}
      <div className="p-6">
        <div
          className="flex items-center justify-between cursor-pointer mb-4"
          onClick={() => toggleSection('relationships')}
        >
          <h3 className="text-lg font-medium text-foreground flex items-center space-x-2">
            <span>Related Transactions ({filteredTransactions.length})</span>
            {expandedSections.has('relationships') ? (
              <ChevronDownIcon className="w-5 h-5" />
            ) : (
              <ChevronRightIcon className="w-5 h-5" />
            )}
          </h3>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowFilters(!showFilters);
              }}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Toggle view mode"
            >
              {showFilters ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
            </button>
          </div>
        </div>
        
        {expandedSections.has('relationships') && (
          <div className="space-y-4">
            {Object.entries(groupedTransactions).map(([type, transactions]) => (
              <div key={type} className="border border-border rounded-lg">
                <div className="bg-muted/5 px-4 py-3 border-b border-border">
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">{getRelationshipIcon(type as RelationshipType)}</span>
                    <h4 className="font-medium text-foreground">
                      {formatRelationshipType(type as RelationshipType)}
                    </h4>
                    <span className="bg-muted text-muted-foreground px-2 py-1 rounded text-sm">
                      {transactions.length}
                    </span>
                  </div>
                </div>
                
                <div className="divide-y divide-border">
                  {transactions.map((tx, index) => (
                    <div key={tx.signature} className="p-4 hover:bg-muted/5 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          {/* Transaction Header */}
                          <div className="flex items-center space-x-3 mb-2">
                            <Link
                              href={`/tx/${tx.signature}`}
                              className="font-mono text-sm text-primary hover:text-primary/80 transition-colors truncate"
                              title={tx.signature}
                            >
                              {tx.signature.substring(0, 16)}...{tx.signature.slice(-8)}
                            </Link>
                            
                            <button
                              onClick={() => copySignature(tx.signature)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              title="Copy signature"
                            >
                              {copiedSignature === tx.signature ? (
                                <CheckIcon className="w-3 h-3 text-green-500" />
                              ) : (
                                <CopyIcon className="w-3 h-3" />
                              )}
                            </button>
                            
                            <Link
                              href={`/tx/${tx.signature}`}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              title="View transaction"
                            >
                              <ExternalLinkIcon className="w-3 h-3" />
                            </Link>
                          </div>

                          {/* Transaction Summary */}
                          <p className="text-sm text-muted-foreground mb-2">{tx.summary}</p>

                          {/* Relationship Details */}
                          <div className="flex items-center space-x-4 text-xs">
                            <div className="flex items-center space-x-1">
                              <span className="text-muted-foreground">Strength:</span>
                              <span className={`font-medium ${getStrengthColor(tx.relationship.strength)}`}>
                                {tx.relationship.strength}
                              </span>
                            </div>
                            
                            <div className="flex items-center space-x-1">
                              <span className="text-muted-foreground">Relevance:</span>
                              <span className="font-medium text-foreground">
                                {formatRelevanceScore(tx.relevanceScore)}
                              </span>
                            </div>
                            
                            <div className="flex items-center space-x-1">
                              <ClockIcon className="w-3 h-3 text-muted-foreground" />
                              <span className="text-muted-foreground">
                                {formatTimeAgo(tx.blockTime)}
                              </span>
                            </div>
                          </div>

                          {/* Shared Elements */}
                          {(tx.relationship.sharedElements.accounts.length > 0 || 
                            tx.relationship.sharedElements.programs.length > 0 || 
                            tx.relationship.sharedElements.tokens.length > 0) && (
                            <div className="mt-3 pt-3 border-t border-border">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                                {tx.relationship.sharedElements.accounts.length > 0 && (
                                  <div>
                                    <div className="flex items-center space-x-1 mb-1">
                                      <UsersIcon className="w-3 h-3 text-muted-foreground" />
                                      <span className="text-muted-foreground">Shared Accounts:</span>
                                    </div>
                                    <div className="space-y-1">
                                      {tx.relationship.sharedElements.accounts.slice(0, 2).map((account, i) => (
                                        <div key={i} className="font-mono text-foreground">
                                          {account.substring(0, 8)}...{account.substring(-4)}
                                        </div>
                                      ))}
                                      {tx.relationship.sharedElements.accounts.length > 2 && (
                                        <div className="text-muted-foreground">
                                          +{tx.relationship.sharedElements.accounts.length - 2} more
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {tx.relationship.sharedElements.programs.length > 0 && (
                                  <div>
                                    <div className="flex items-center space-x-1 mb-1">
                                      <span className="text-muted-foreground">Programs:</span>
                                    </div>
                                    <div className="space-y-1">
                                      {tx.relationship.sharedElements.programs.slice(0, 2).map((program, i) => (
                                        <div key={i} className="text-foreground">
                                          {program.substring(0, 12)}...
                                        </div>
                                      ))}
                                      {tx.relationship.sharedElements.programs.length > 2 && (
                                        <div className="text-muted-foreground">
                                          +{tx.relationship.sharedElements.programs.length - 2} more
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {tx.relationship.sharedElements.tokens.length > 0 && (
                                  <div>
                                    <div className="flex items-center space-x-1 mb-1">
                                      <DollarSignIcon className="w-3 h-3 text-muted-foreground" />
                                      <span className="text-muted-foreground">Tokens:</span>
                                    </div>
                                    <div className="space-y-1">
                                      {tx.relationship.sharedElements.tokens.slice(0, 2).map((token, i) => (
                                        <div key={i} className="text-foreground">
                                          {token}
                                        </div>
                                      ))}
                                      {tx.relationship.sharedElements.tokens.length > 2 && (
                                        <div className="text-muted-foreground">
                                          +{tx.relationship.sharedElements.tokens.length - 2} more
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Token Transfers */}
                          {tx.tokenTransfers && tx.tokenTransfers.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-border">
                              <div className="text-xs text-muted-foreground mb-2">Token Transfers:</div>
                              <div className="space-y-1">
                                {tx.tokenTransfers.slice(0, 3).map((transfer, i) => (
                                  <div key={i} className="flex items-center justify-between text-xs">
                                    <span className="font-mono text-foreground">
                                      {transfer.amount} {transfer.symbol}
                                    </span>
                                    {transfer.usdValue && (
                                      <span className="text-muted-foreground">
                                        ~${transfer.usdValue.toLocaleString()}
                                      </span>
                                    )}
                                  </div>
                                ))}
                                {tx.tokenTransfers.length > 3 && (
                                  <div className="text-xs text-muted-foreground">
                                    +{tx.tokenTransfers.length - 3} more transfers
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Relevance Score Indicator */}
                        <div className="flex flex-col items-end space-y-2 ml-4">
                          <div className="text-right">
                            <div className="text-sm font-medium text-foreground">
                              {formatRelevanceScore(tx.relevanceScore)}
                            </div>
                            <div className="text-xs text-muted-foreground">relevance</div>
                          </div>
                          
                          <div className="w-16 bg-muted rounded-full h-2">
                            <div 
                              className="bg-primary rounded-full h-2 transition-all"
                              style={{ width: `${tx.relevanceScore * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {filteredTransactions.length === 0 && (
              <div className="text-center py-8">
                <FilterIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No transactions match the current filters</p>
                <button
                  onClick={() => setFilters({
                    relationshipTypes: [],
                    strengthLevels: [],
                    timeRange: 'all',
                    minRelevance: 0.1,
                    searchQuery: '',
                    sortBy: 'relevance',
                    sortOrder: 'desc'
                  })}
                  className="mt-2 text-primary hover:text-primary/80 transition-colors text-sm"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg border border-border max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">Transaction Details</h3>
                <button
                  onClick={() => setSelectedTransaction(null)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Signature</label>
                  <div className="font-mono text-sm text-foreground break-all">
                    {selectedTransaction.signature}
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Relationship</label>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-lg">{getRelationshipIcon(selectedTransaction.relationship.type)}</span>
                    <span className="text-foreground">{formatRelationshipType(selectedTransaction.relationship.type)}</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStrengthColor(selectedTransaction.relationship.strength)}`}>
                      {selectedTransaction.relationship.strength}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedTransaction.relationship.description}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Summary</label>
                  <p className="text-sm text-foreground mt-1">{selectedTransaction.summary}</p>
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setSelectedTransaction(null)}
                    className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Close
                  </button>
                  <Link
                    href={`/tx/${selectedTransaction.signature}`}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                  >
                    View Transaction
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RelatedTransactionsDisplay;