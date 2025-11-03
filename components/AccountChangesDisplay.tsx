'use client';

import React, { useState, useMemo, useRef } from 'react';
import {
  useKeyboardNavigation,
  useAccessibility
} from '@/lib/accessibility-utils';
import {
  useMobileDetection,
  useSwipeGestures
} from '@/lib/mobile-utils';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  AlertTriangleIcon,
  ShieldCheckIcon,
  InfoIcon,
  CopyIcon,
  CheckIcon,
  ExternalLinkIcon,
  FilterIcon,
  EyeIcon,
  MinusIcon
} from 'lucide-react';
import Link from 'next/link';
import type { DetailedTransactionInfo } from '@/lib/solana';
import {
  analyzeAccountChanges,
  formatSolAmount,
  formatTokenAmount,
  getChangeDirection,
  getChangeColor,
  getRiskColor,
  type AccountChange,
  type AccountChangesAnalysis,
  type AccountChangesResponse
} from '@/lib/account-changes-analyzer-client';
import AccountDataDiff from './AccountDataDiff';

interface AccountChangesDisplayProps {
  transaction: DetailedTransactionInfo;
  className?: string;
}

const AccountChangesDisplay: React.FC<AccountChangesDisplayProps> = ({
  transaction,
  className = ''
}) => {
  const [expandedAccounts, setExpandedAccounts] = useState<Set<number>>(new Set());
  const [showOnlyChanged, setShowOnlyChanged] = useState(true);
  const [selectedChangeType, setSelectedChangeType] = useState<'all' | 'sol' | 'token'>('all');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AccountChangesAnalysis | null>(null);
  const [accountChanges, setAccountChanges] = useState<AccountChange[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Accessibility hooks
  const { highContrast, announceToScreenReader } = useAccessibility();
  const containerRef = useRef<HTMLDivElement>(null);

  // Mobile detection
  const { isMobile } = useMobileDetection();

  // Load account changes analysis
  React.useEffect(() => {
    let isMounted = true;

    const loadAnalysis = async () => {
      try {
        setIsLoading(true);
        const result = await analyzeAccountChanges(transaction);
        if (isMounted) {
          setAnalysis(result.analysis);
          setAccountChanges(result.accountChanges);
        }
      } catch (error) {
        console.error('Failed to analyze transaction:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadAnalysis();

    return () => {
      isMounted = false;
    };
  }, [transaction]);


  // Filter account changes based on user preferences
  const filteredChanges = useMemo(() => {
    let filtered = accountChanges;

    if (showOnlyChanged) {
      filtered = filtered.filter(change =>
        change.balanceChange !== 0 ||
        change.tokenChanges.length > 0 ||
        change.dataChange?.hasChanged ||
        change.ownerChange?.hasChanged
      );
    }

    if (selectedChangeType === 'sol') {
      filtered = filtered.filter(change => change.balanceChange !== 0);
    } else if (selectedChangeType === 'token') {
      filtered = filtered.filter(change => change.tokenChanges.length > 0);
    }

    return filtered;
  }, [accountChanges, showOnlyChanged, selectedChangeType]);

  // Swipe gestures for mobile navigation
  useSwipeGestures(containerRef, {
    onSwipeLeft: () => {
      if (isMobile && expandedAccounts.size > 0) {
        // Collapse all accounts on swipe left
        setExpandedAccounts(new Set());
        announceToScreenReader('All account details collapsed');
      }
    },
    onSwipeRight: () => {
      if (isMobile && expandedAccounts.size === 0 && filteredChanges.length > 0) {
        // Expand first account on swipe right
        setExpandedAccounts(new Set([filteredChanges[0].accountIndex]));
        announceToScreenReader('First account details expanded');
      }
    }
  });

  // Keyboard navigation
  useKeyboardNavigation(containerRef, {
    roving: true
  });

  const toggleAccount = (index: number) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedAccounts(newExpanded);
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getRiskIcon = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'low':
        return <ShieldCheckIcon className="w-5 h-5 text-green-500" />;
      case 'medium':
        return <InfoIcon className="w-5 h-5 text-yellow-500" />;
      case 'high':
        return <AlertTriangleIcon className="w-5 h-5 text-red-500" />;
      default:
        return <InfoIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  // Show loading state while analysis is being computed
  if (isLoading || !analysis) {
    return (
      <div
        className={`bg-background rounded-lg border border-border ${className} ${highContrast ? 'high-contrast-mode' : ''}`}
        role="region"
        aria-labelledby="account-changes-heading"
      >
        <div className="p-6">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <h2 className="text-xl font-semibold text-foreground">
              Analyzing Account Changes...
            </h2>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`bg-background rounded-lg border border-border ${className} ${highContrast ? 'high-contrast-mode' : ''}`}
      role="region"
      aria-labelledby="account-changes-heading"
    >
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2
            id="account-changes-heading"
            className="text-xl font-semibold text-foreground"
          >
            Account Changes
          </h2>
          <div
            className="flex items-center space-x-2"
            role="status"
            aria-label={`Risk level: ${analysis.riskAssessment.level}`}
          >
            {getRiskIcon(analysis.riskAssessment.level)}
            <span className={`font-medium ${getRiskColor(analysis.riskAssessment.level)} risk-${analysis.riskAssessment.level}`}>
              {analysis.riskAssessment.level.toUpperCase()} RISK
            </span>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-muted/20 p-3 rounded-lg">
            <div className="text-sm text-muted-foreground">Total Accounts</div>
            <div className="text-lg font-semibold text-foreground">{analysis.totalAccounts}</div>
          </div>
          <div className="bg-muted/20 p-3 rounded-lg">
            <div className="text-sm text-muted-foreground">Changed</div>
            <div className="text-lg font-semibold text-foreground">{analysis.changedAccounts}</div>
          </div>
          <div className="bg-muted/20 p-3 rounded-lg">
            <div className="text-sm text-muted-foreground">SOL Changes</div>
            <div className="text-lg font-semibold text-foreground">
              {analysis.solChanges.positiveChanges + analysis.solChanges.negativeChanges}
            </div>
          </div>
          <div className="bg-muted/20 p-3 rounded-lg">
            <div className="text-sm text-muted-foreground">Token Changes</div>
            <div className="text-lg font-semibold text-foreground">{analysis.tokenChanges.totalTokensAffected}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <FilterIcon className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filters:</span>
          </div>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyChanged}
              onChange={(e) => setShowOnlyChanged(e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-sm text-foreground">Only show changed accounts</span>
          </label>

          <select
            value={selectedChangeType}
            onChange={(e) => setSelectedChangeType(e.target.value as 'all' | 'sol' | 'token')}
            className="px-3 py-1 bg-background border border-border rounded-md text-sm"
          >
            <option value="all">All Changes</option>
            <option value="sol">SOL Changes Only</option>
            <option value="token">Token Changes Only</option>
          </select>
        </div>
      </div>

      {/* Risk Assessment */}
      {analysis.riskAssessment.factors.length > 0 && (
        <div className="p-4 bg-muted/10 border-b border-border">
          <div className="flex items-start space-x-3">
            {getRiskIcon(analysis.riskAssessment.level)}
            <div className="flex-1">
              <h3 className="font-medium text-foreground mb-2">Risk Assessment</h3>
              <div className="space-y-2">
                <div>
                  <span className="text-sm text-muted-foreground">Risk Factors:</span>
                  <ul className="list-disc list-inside text-sm text-foreground ml-4">
                    {analysis.riskAssessment.factors.map((factor, index) => (
                      <li key={index}>{factor}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Recommendations:</span>
                  <ul className="list-disc list-inside text-sm text-foreground ml-4">
                    {analysis.riskAssessment.recommendations.map((rec, index) => (
                      <li key={index}>{rec}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Account Changes List */}
      <div className="divide-y divide-border">
        {filteredChanges.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            <EyeIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No account changes match the current filters</p>
            <button
              onClick={() => {
                setShowOnlyChanged(false);
                setSelectedChangeType('all');
              }}
              className="mt-2 text-primary hover:text-primary/80 text-sm"
            >
              Show all accounts
            </button>
          </div>
        ) : (
          filteredChanges.map((change) => (
            <AccountChangeItem
              key={change.accountIndex}
              change={change}
              isExpanded={expandedAccounts.has(change.accountIndex)}
              onToggle={() => toggleAccount(change.accountIndex)}
              onCopy={copyToClipboard}
              copiedField={copiedField}
            />
          ))
        )}
      </div>

      {/* Summary Footer */}
      {analysis.solChanges.totalSolChange !== 0 && (
        <div className="p-4 bg-muted/10 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Net SOL Change:</span>
            <span className={`font-medium ${getChangeColor(analysis.solChanges.totalSolChange)}`}>
              {formatSolAmount(analysis.solChanges.totalSolChange)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// Individual account change item component
interface AccountChangeItemProps {
  change: AccountChange;
  isExpanded: boolean;
  onToggle: () => void;
  onCopy: (text: string, field: string) => void;
  copiedField: string | null;
}

const AccountChangeItem: React.FC<AccountChangeItemProps> = ({
  change,
  isExpanded,
  onToggle,
  onCopy,
  copiedField
}) => {
  const hasChanges = change.balanceChange !== 0 || change.tokenChanges.length > 0;
  const changeDirection = getChangeDirection(change.balanceChange);

  return (
    <div className="p-4">
      {/* Account Header */}
      <div
        className="flex items-center justify-between cursor-pointer hover:bg-muted/20 p-2 rounded-md transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            {isExpanded ? (
              <ChevronDownIcon className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRightIcon className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="text-sm font-medium text-muted-foreground">
              Account {change.accountIndex + 1}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
              {change.pubkey.substring(0, 8)}...{change.pubkey.substring(-4)}
            </code>

            {hasChanges && (
              <div className="flex items-center space-x-1">
                {changeDirection === 'increase' && (
                  <TrendingUpIcon className="w-4 h-4 text-green-500" />
                )}
                {changeDirection === 'decrease' && (
                  <TrendingDownIcon className="w-4 h-4 text-red-500" />
                )}
                {change.tokenChanges.length > 0 && (
                  <span className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-1 rounded text-xs">
                    {change.tokenChanges.length} token{change.tokenChanges.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {change.balanceChange !== 0 && (
            <span className={`text-sm font-medium ${getChangeColor(change.balanceChange)}`}>
              {change.balanceChange > 0 ? '+' : ''}{formatSolAmount(change.balanceChange)}
            </span>
          )}

          <div className="flex items-center space-x-1">
            <Link
              href={`/account/${change.pubkey}`}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              title="View account details"
            >
              <ExternalLinkIcon className="w-4 h-4" />
            </Link>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCopy(change.pubkey, `account-${change.accountIndex}`);
              }}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              title="Copy account address"
            >
              {copiedField === `account-${change.accountIndex}` ? (
                <CheckIcon className="w-4 h-4 text-green-500" />
              ) : (
                <CopyIcon className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-4 ml-6 space-y-4">
          {/* SOL Balance Changes */}
          <div className="bg-muted/10 p-4 rounded-lg">
            <h4 className="font-medium text-foreground mb-3">SOL Balance</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Before</span>
                <div className="font-mono text-foreground">{formatSolAmount(change.preBalance)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">After</span>
                <div className="font-mono text-foreground">{formatSolAmount(change.postBalance)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Change</span>
                <div className={`font-mono font-medium ${getChangeColor(change.balanceChange)}`}>
                  {change.balanceChange === 0 ? (
                    <span className="flex items-center">
                      <MinusIcon className="w-3 h-3 mr-1" />
                      No change
                    </span>
                  ) : (
                    <>
                      {change.balanceChange > 0 ? '+' : ''}{formatSolAmount(change.balanceChange)}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Rent Exempt Status */}
            {change.rentExemptStatus?.changed && (
              <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                <div className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Rent Exempt Status Changed:</strong>{' '}
                  {change.rentExemptStatus.preRentExempt ? 'Exempt' : 'Not Exempt'} → {' '}
                  {change.rentExemptStatus.postRentExempt ? 'Exempt' : 'Not Exempt'}
                </div>
              </div>
            )}
          </div>

          {/* Token Changes */}
          {change.tokenChanges.length > 0 && (
            <div className="bg-muted/10 p-4 rounded-lg">
              <h4 className="font-medium text-foreground mb-3">Token Changes</h4>
              <div className="space-y-3">
                {change.tokenChanges.map((tokenChange, index) => (
                  <div key={index} className="border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
                          {tokenChange.mint.substring(0, 8)}...
                        </code>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${tokenChange.significance === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                            tokenChange.significance === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                              'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          }`}>
                          {tokenChange.significance}
                        </span>
                      </div>
                      <button
                        onClick={() => onCopy(tokenChange.mint, `token-${index}`)}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                        title="Copy token mint"
                      >
                        {copiedField === `token-${index}` ? (
                          <CheckIcon className="w-3 h-3 text-green-500" />
                        ) : (
                          <CopyIcon className="w-3 h-3" />
                        )}
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Before</span>
                        <div className="font-mono text-foreground">
                          {formatTokenAmount(tokenChange.preAmount, tokenChange.decimals)}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">After</span>
                        <div className="font-mono text-foreground">
                          {formatTokenAmount(tokenChange.postAmount, tokenChange.decimals)}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Change</span>
                        <div className={`font-mono font-medium ${getChangeColor(tokenChange.change)}`}>
                          {tokenChange.change > 0 ? '+' : ''}{formatTokenAmount(tokenChange.change, tokenChange.decimals)}
                          {tokenChange.changePercent !== 0 && (
                            <span className="text-xs ml-1">
                              ({tokenChange.changePercent > 0 ? '+' : ''}{tokenChange.changePercent.toFixed(1)}%)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data Changes */}
          {change.dataChange?.hasChanged && (
            <AccountDataDiff
              dataChange={change.dataChange}
              accountAddress={change.pubkey}
            />
          )}

          {/* Ownership Changes */}
          {change.ownerChange?.hasChanged && (
            <div className="bg-muted/10 p-4 rounded-lg">
              <h4 className="font-medium text-foreground mb-3">Ownership Change</h4>
              <div className="text-sm space-y-2">
                <div>
                  <span className="text-muted-foreground">Previous Owner:</span>
                  <code className="ml-2 font-mono text-foreground">
                    {change.ownerChange.preOwner || 'Unknown'}
                  </code>
                </div>
                <div>
                  <span className="text-muted-foreground">New Owner:</span>
                  <code className="ml-2 font-mono text-foreground">
                    {change.ownerChange.postOwner || 'Unknown'}
                  </code>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AccountChangesDisplay;
