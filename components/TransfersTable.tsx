'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTransfers } from '@/app/account/[address]/components/shared/hooks';
import type { Transfer } from '@/app/account/[address]/components/shared/types';
import { VTableWrapper } from '@/components/vtable';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/utils';
import { Tooltip } from '@/components/ui/tooltip';
import { useRouter } from 'next/navigation';
import { PinIcon, Search, X, Filter } from 'lucide-react';
import Link from 'next/link';
import {
  isSolanaOnlyTransaction
} from '@/lib/qdrant';

interface TransfersTableProps {
  address: string;
  transactionCategory?: TransactionCategory;
}

// Transaction category types
type TransactionCategory =
  | 'account-transfers'
  | 'all-txs'
  | 'trading-txs'
  | 'defi-txs'
  | 'nft-txs'
  | 'staking-txs'
  | 'utility-txs'
  | 'suspicious-txs'
  | 'custom-program-txs';

export function TransfersTable({ address, transactionCategory = 'account-transfers' }: TransfersTableProps) {
  const { transfers: rawTransfers, loading, error, hasMore, loadMore, totalCount } = useTransfers(address);
  const router = useRouter();
  const [sortField, setSortField] = useState<keyof Transfer>('timestamp');
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [pinnedRowIds, setPinnedRowIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [tokenFilter, setTokenFilter] = useState<string>('all');
  const [amountFilter, setAmountFilter] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // New state for comprehensive transaction filtering with localStorage persistence
  const [filterPreferences, setFilterPreferences] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('opensvm-filter-preferences');
        return saved ? JSON.parse(saved) : {
          transactionCategory: 'account-transfers' as TransactionCategory,
          solanaOnlyFilter: false,
          customProgramAddress: ''
        };
      } catch (error) {
        console.warn('Failed to load filter preferences from localStorage:', error);
        return {
          transactionCategory: 'account-transfers' as TransactionCategory,
          solanaOnlyFilter: false,
          customProgramAddress: ''
        };
      }
    }
    return {
      transactionCategory: 'account-transfers' as TransactionCategory,
      solanaOnlyFilter: false,
      customProgramAddress: ''
    };
  });

  // Update localStorage when filter preferences change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('opensvm-filter-preferences', JSON.stringify(filterPreferences));
      } catch (error) {
        console.warn('Failed to save filter preferences to localStorage:', error);
      }
    }
  }, [filterPreferences]);

  // Helper function to update filter preferences with proper typing
  const updateFilterPreference = useCallback((key: keyof typeof filterPreferences, value: any) => {
    setFilterPreferences((prev: typeof filterPreferences) => ({
      ...prev,
      [key]: value
    }));
  }, []);

  // Helper functions to categorize transactions
  const categorizeTransaction = useCallback((transfer: Transfer): TransactionCategory[] => {
    const categories: TransactionCategory[] = ['all-txs'];

    // Account transfers - basic token/SOL transfers
    if (transfer.type === 'transfer' || transfer.type === 'transferChecked') {
      categories.push('account-transfers');
    }

    // Trading transactions - DEX trades, swaps
    if (transfer.type?.includes('swap') || transfer.type?.includes('trade') || transfer.type?.includes('exchange')) {
      categories.push('trading-txs');
    }

    // DeFi transactions - lending, borrowing, liquidity provision
    if (transfer.type?.includes('deposit') || transfer.type?.includes('withdraw') ||
      transfer.type?.includes('borrow') || transfer.type?.includes('lend') ||
      transfer.type?.includes('stake') || transfer.type?.includes('unstake') ||
      transfer.mint?.includes('LP') || transfer.tokenSymbol?.includes('LP')) {
      categories.push('defi-txs');
    }

    // NFT transactions
    if (transfer.type?.includes('nft') || transfer.type?.includes('NFT') ||
      transfer.tokenSymbol?.includes('NFT') || transfer.amount === 1) {
      categories.push('nft-txs');
    }

    // Staking transactions
    if (transfer.type?.includes('stake') || transfer.type?.includes('delegate') ||
      transfer.type?.includes('reward') || transfer.type?.includes('commission')) {
      categories.push('staking-txs');
    }

    // Utility transactions - account creation, rent, etc.
    if (transfer.type?.includes('createAccount') || transfer.type?.includes('rent') ||
      transfer.type?.includes('fee') || transfer.amount === 0) {
      categories.push('utility-txs');
    }

    // Suspicious transactions - large amounts, unusual patterns
    if ((transfer.amount || 0) > 1000000 || transfer.type?.includes('unknown')) {
      categories.push('suspicious-txs');
    }

    // Custom program transactions
    if (filterPreferences.customProgramAddress &&
      (transfer.from === filterPreferences.customProgramAddress ||
        transfer.to === filterPreferences.customProgramAddress)) {
      categories.push('custom-program-txs');
    }

    return categories;
  }, [filterPreferences.customProgramAddress]);

  // Load any additional configuration on component mount
  useEffect(() => {
    // Any additional setup can be done here
    // Caching is now handled automatically by the API
  }, [address, transactionCategory, filterPreferences.transactionCategory, filterPreferences.solanaOnlyFilter]);  // Handle client-side navigation to account/transaction pages
  const handleAddressClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, targetAddress: string) => {
    if (!targetAddress) return;

    e.preventDefault();

    // Use router.push with scroll: false to prevent page reload
    router.push(`/account/${targetAddress}?tab=transactions`, {
      scroll: false
    });
  }, [router]);

  // Handle transaction hash clicks
  const handleTransactionClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, signature: string) => {
    if (!signature) return;

    e.preventDefault();

    // Navigate to transaction page
    router.push(`/tx/${signature}`, {
      scroll: false
    });
  }, [router]);

  // Map API data to the expected Transfer format
  const transfers = useMemo(() => {
    // Now we primarily use rawTransfers since API handles caching automatically
    const sourceData = rawTransfers;

    return sourceData.map(item => {
      // Handle raw transfer from API (the primary case now)
      const rawItem = item as any;
      return {
        signature: rawItem.signature || '',
        timestamp: rawItem.timestamp || '',
        type: rawItem.type || 'transfer',
        amount: rawItem.amount || 0,
        token: rawItem.tokenSymbol || 'SOL',
        tokenSymbol: rawItem.tokenSymbol || 'SOL',
        from: rawItem.from || '',
        to: rawItem.to || '',
        tokenName: rawItem.tokenName || 'Solana',
        usdValue: rawItem.usdValue,
        mint: rawItem.mint,
        isSolanaOnly: isSolanaOnlyTransaction(rawItem),
        cached: false,
        ...(rawItem as any)
      };
    });
  }, [rawTransfers]);

  // Handle row selection
  const handleRowSelect = useCallback((rowId: string) => {
    setSelectedRowId(prevId => prevId === rowId ? null : rowId);
  }, []);

  // Handle row pinning
  const handlePinRow = useCallback((rowId: string) => {
    setPinnedRowIds(prevIds => {
      const newIds = new Set(prevIds);
      if (newIds.has(rowId)) {
        newIds.delete(rowId);
      } else {
        newIds.add(rowId);
      }
      return newIds;
    });
    setSelectedRowId(null);
  }, []);

  const handleSort = (field: string, direction: 'asc' | 'desc' | null) => {
    if (direction === null) {
      // Reset to default sort
      setSortField('timestamp');
      setSortDirection('desc');
      return;
    }

    setSortField(field as keyof Transfer);
    setSortDirection(direction);
  };

  const columns = useMemo(() => [
    {
      field: 'timestamp',
      title: 'Time',
      width: 180,
      sortable: true,
      render: (row: Transfer) => {
        const date = new Date(row.timestamp);
        if (isNaN(date.getTime())) {
          return <div className="whitespace-nowrap" data-test="timestamp">-</div>;
        }

        return (
          <div className="whitespace-nowrap" data-test="timestamp">
            <time dateTime={date.toISOString()}>{date.toLocaleDateString() || '-'} {date.toLocaleTimeString() || '-'}</time>
          </div>
        );
      }
    },
    {
      field: 'type',
      title: 'Type',
      width: 100,
      sortable: true,
      render: (row: Transfer) => (
        <div className="capitalize" data-test="type">{row.type || 'transfer'}</div>
      )
    },
    {
      field: 'amount',
      title: 'Amount',
      width: 120,
      sortable: true,
      render: (row: Transfer) => (
        <div className="text-right font-mono" data-test="amount" title={row.amount?.toString() || '0'}>
          {row.amount !== undefined && row.amount !== null ? formatNumber(row.amount) : '0'}
        </div>
      )
    },
    {
      field: 'token',
      title: 'Token',
      width: 100,
      sortable: true,
      render: (row: Transfer) => (
        <div data-test="token" title={(row.tokenSymbol || row.token || 'SOL')}>{row.tokenSymbol || row.token || 'SOL'}</div>
      )
    },
    {
      field: 'tokenName',
      title: 'Token Name',
      width: 120,
      sortable: true,
      render: (row: Transfer) => (
        <div data-test="tokenName" title={(row.tokenName || 'Solana')}>{row.tokenName || 'Solana'}</div>
      )
    },
    {
      field: 'from',
      title: 'From',
      width: 200,
      sortable: true,
      render: (row: Transfer) => (
        <Tooltip content={row.from || ''}>
          <div className="truncate font-mono text-xs" data-test="from">
            <Link
              href={row.from ? `/account/${row.from}?tab=transactions` : '#'}
              className="hover:underline hover:text-primary text-primary/80 transition-colors"
              onClick={(e) => handleAddressClick(e, row.from || '')}
              data-address={row.from || ''}
            >
              {row.from}
            </Link>
          </div>
        </Tooltip>
      )
    },
    {
      field: 'to',
      title: 'To',
      width: 200,
      sortable: true,
      render: (row: Transfer) => (
        <Tooltip content={row.to || ''}>
          <div className="truncate font-mono text-xs" data-test="to">
            <Link
              href={row.to ? `/account/${row.to}?tab=transactions` : '#'}
              className="hover:underline hover:text-primary text-primary/80 transition-colors"
              onClick={(e) => handleAddressClick(e, row.to || '')}
              data-address={row.to || ''}
            >
              {row.to}
            </Link>
          </div>
        </Tooltip>
      )
    },
    {
      field: 'signature',
      title: 'Transaction',
      width: 200,
      sortable: false,
      render: (row: Transfer) => (
        <Tooltip content={row.signature || ''}>
          <div className="truncate font-mono text-xs" data-test="signature">
            {row.signature ? (
              <Link
                href={`/tx/${row.signature}`}
                onClick={(e) => handleTransactionClick(e, row.signature || '')}
                className="hover:underline hover:text-primary text-primary/80 transition-colors"
                prefetch={false}
                data-signature={row.signature}
              >
                {row.signature}
              </Link>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </div>
        </Tooltip>
      )
    }
  ], [handleAddressClick, handleTransactionClick]);


  const sortedTransfers = useMemo(() => {
    if (!transfers.length) return [];

    // Apply transaction category filtering first
    let filtered = transfers;

    if (filterPreferences.transactionCategory !== 'all-txs') {
      filtered = transfers.filter(transfer => {
        const categories = categorizeTransaction(transfer);
        return categories.includes(filterPreferences.transactionCategory);
      });
    }

    // Apply Solana-only filter if enabled
    if (filterPreferences.solanaOnlyFilter) {
      filtered = filtered.filter(transfer => isSolanaOnlyTransaction(transfer));
    }

    // Filter by transaction category
    if (transactionCategory && transactionCategory !== 'all-txs') {
      filtered = filtered.filter(transfer => {
        const categories = categorizeTransaction(transfer);
        return categories.includes(transactionCategory);
      });
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(transfer =>
        transfer.from?.toLowerCase().includes(lowerSearchTerm) ||
        transfer.to?.toLowerCase().includes(lowerSearchTerm) ||
        transfer.tokenSymbol?.toLowerCase().includes(lowerSearchTerm) ||
        transfer.token?.toLowerCase().includes(lowerSearchTerm) ||
        transfer.signature?.toLowerCase().includes(lowerSearchTerm)
      );
    }

    // Filter by type
    if (typeFilter !== 'all') {
      filtered = filtered.filter(transfer => transfer.type === typeFilter);
    }

    // Filter by token (only show this filter for ALL transactions category)
    if (tokenFilter !== 'all' && transactionCategory === 'all-txs') {
      filtered = filtered.filter(transfer =>
        (transfer.tokenSymbol || transfer.token || 'SOL') === tokenFilter
      );
    }

    // Filter by amount range
    if (amountFilter.min || amountFilter.max) {
      filtered = filtered.filter(transfer => {
        const amount = transfer.amount || 0;
        const min = amountFilter.min ? parseFloat(amountFilter.min) : -Infinity;
        const max = amountFilter.max ? parseFloat(amountFilter.max) : Infinity;
        return amount >= min && amount <= max;
      });
    }

    // Then sort the filtered results
    const sorted = [...filtered].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (aValue === undefined || aValue === null || bValue === undefined || bValue === null) return sortDirection === 'asc' ? -1 : 1;

      // Handle different types of values
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        if (sortField === 'timestamp') {
          // For timestamps, convert to Date objects for comparison
          const aDate = new Date(aValue).getTime();
          const bDate = new Date(bValue).getTime();
          return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
        }
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });

    return sorted;
  }, [transfers, sortField, sortDirection, searchTerm, typeFilter, tokenFilter, amountFilter, transactionCategory, filterPreferences, categorizeTransaction]);

  // Get unique values for filter dropdowns
  const uniqueTypes = useMemo(() => {
    const types = [...new Set(transfers.map(t => t.type || 'transfer'))];
    return types.sort();
  }, [transfers]);

  const uniqueTokens = useMemo(() => {
    const tokens = [...new Set(transfers.map(t => t.tokenSymbol || t.token || 'SOL'))];
    return tokens.sort();
  }, [transfers]);

  // Row identity function for selection
  const getRowId = useCallback((row: Transfer) => row.signature || '', []);

  // Pin button UI
  const renderPinButton = useCallback((rowId: string) => {
    const isPinned = pinnedRowIds.has(rowId);

    return (
      <Button
        variant="ghost"
        size="sm"
        className={`absolute right-2 top-1/2 transform -translate-y-1/2 z-10 ${isPinned ? 'text-yellow-500' : 'text-gray-500'}`}
        onClick={() => handlePinRow(rowId)}
      >
        <PinIcon className={`h-4 w-4 ${isPinned ? 'fill-yellow-500' : ''}`} />
      </Button>
    );
  }, [pinnedRowIds, handlePinRow]);
  if (error) {
    return (
      <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg" role="alert" aria-live="assertive">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold" id="transfers-heading">
          {transactionCategory === 'account-transfers' ? 'Account Transfers' :
            transactionCategory === 'all-txs' ? 'All Transactions' :
              transactionCategory === 'trading-txs' ? 'Trading Transactions' :
                transactionCategory === 'defi-txs' ? 'DeFi Transactions' :
                  transactionCategory === 'nft-txs' ? 'NFT Transactions' :
                    transactionCategory === 'staking-txs' ? 'Staking Transactions' :
                      transactionCategory === 'utility-txs' ? 'Utility Transactions' :
                        transactionCategory === 'suspicious-txs' ? 'Suspicious Transactions' :
                          transactionCategory === 'custom-program-txs' ? 'Custom Program Transactions' :
                            'Transactions'}
          {totalCount !== undefined && (
            <span className="ml-2 text-sm text-muted-foreground">
              ({sortedTransfers.length.toLocaleString()} of {totalCount.toLocaleString()})
            </span>
          )}
        </h2>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="h-4 w-4 text-muted-foreground" />
          </div>
          <input
            type="text"
            placeholder="Search transfers by address, token symbol, or signature..."
            className="w-full pl-10 pr-10 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Secondary Filters Row */}
        <div className="flex flex-wrap gap-4">
          {/* Solana Only Filter - only show for Account Transfers */}
          {transactionCategory === 'account-transfers' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateFilterPreference('solanaOnlyFilter', !filterPreferences.solanaOnlyFilter)}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${filterPreferences.solanaOnlyFilter
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
              >
                Solana Only
              </button>
            </div>
          )}

          {/* Custom Program Address Input - only show for Custom Program Txs */}
          {transactionCategory === 'custom-program-txs' && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Program Address"
                value={filterPreferences.customProgramAddress}
                onChange={(e) => updateFilterPreference('customProgramAddress', e.target.value)}
                className="border border-border rounded-lg px-3 py-1 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}

          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="border border-border rounded-lg px-3 py-1 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Types</option>
              {uniqueTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Token Filter */}
          <div className="flex items-center gap-2">
            <select
              value={tokenFilter}
              onChange={(e) => setTokenFilter(e.target.value)}
              className="border border-border rounded-lg px-3 py-1 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Tokens</option>
              {uniqueTokens.map(token => (
                <option key={token} value={token}>{token}</option>
              ))}
            </select>
          </div>

          {/* Amount Range Filter */}
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Min Amount"
              value={amountFilter.min}
              onChange={(e) => setAmountFilter(prev => ({ ...prev, min: e.target.value }))}
              className="w-24 border border-border rounded-lg px-2 py-1 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-muted-foreground">-</span>
            <input
              type="number"
              placeholder="Max Amount"
              value={amountFilter.max}
              onChange={(e) => setAmountFilter(prev => ({ ...prev, max: e.target.value }))}
              className="w-24 border border-border rounded-lg px-2 py-1 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Clear Filters */}
          {(typeFilter !== 'all' || tokenFilter !== 'all' || amountFilter.min || amountFilter.max || searchTerm ||
            filterPreferences.solanaOnlyFilter || filterPreferences.customProgramAddress) && (
              <button
                onClick={() => {
                  setTypeFilter('all');
                  setTokenFilter('all');
                  setAmountFilter({ min: '', max: '' });
                  setSearchTerm('');
                  setFilterPreferences((prev: typeof filterPreferences) => ({
                    ...prev,
                    solanaOnlyFilter: false,
                    customProgramAddress: ''
                  }));
                }}
                className="px-3 py-1 text-sm bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors"
              >
                Clear Filters
              </button>
            )}
        </div>
      </div>

      {/* Search Results Count */}
      {(searchTerm || typeFilter !== 'all' || tokenFilter !== 'all' || amountFilter.min || amountFilter.max ||
        filterPreferences.solanaOnlyFilter || filterPreferences.customProgramAddress) && (
          <div className="text-sm text-muted-foreground">
            Found {sortedTransfers.length} transfers
            {searchTerm && ` matching "${searchTerm}"`}
            {typeFilter !== 'all' && ` of type "${typeFilter}"`}
            {tokenFilter !== 'all' && ` with token "${tokenFilter}"`}
            {(amountFilter.min || amountFilter.max) && ` within amount range`}
            {filterPreferences.solanaOnlyFilter && ` (Solana only)`}
            {filterPreferences.customProgramAddress && ` (custom program: ${filterPreferences.customProgramAddress.slice(0, 8)}...)`}
          </div>
        )}

      <div className="border border-border rounded-lg overflow-hidden flex-1 bg-card/50 min-h-0" role="region" aria-labelledby="transfers-heading" aria-live="polite">
        <VTableWrapper
          columns={columns}
          data={sortedTransfers}
          rowKey={getRowId}
          loading={loading}
          onSort={handleSort}
          selectedRowId={selectedRowId}
          onRowSelect={handleRowSelect}
          renderRowAction={renderPinButton}
          pinnedRowIds={pinnedRowIds}
          onLoadMore={loadMore}
          infiniteScroll={true}
          virtualScrolling={true}
          maxRows={1000000}
          initialLoadSize={10000}
          scrollThreshold={300}
          responsive={true}
          aria-busy={loading ? 'true' : 'false'}
        />
      </div>

      {/* Load More button hidden when using infinite scroll in VTable */}

      {!hasMore && sortedTransfers.length > 0 && (
        <div className="text-center mt-4 text-sm text-muted-foreground">
          All {sortedTransfers.length.toLocaleString()} transfers loaded
        </div>
      )}
    </div>
  );
}
