'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTransfers } from '@/app/account/[address]/components/shared/hooks';
import type { Transfer } from '@/app/account/[address]/components/shared/types';
import { VTableWrapper } from '@/components/vtable';
import { Button } from '@/components/ui/button';
import { formatNumber, truncateMiddle } from '@/lib/utils';
import { Tooltip } from '@/components/ui/tooltip';
import { useRouter, usePathname } from 'next/navigation';
import { PinIcon, Search, X, Filter } from 'lucide-react';
import { useCallback as useStableCallback } from 'react';
import Link from 'next/link';

interface TransfersTableProps {
  address: string;
}

export function TransfersTable({ address }: TransfersTableProps) {
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

  // Handle client-side navigation to account/transaction pages
  const handleAddressClick = useStableCallback((e: React.MouseEvent<HTMLAnchorElement>, targetAddress: string) => {
    if (!targetAddress) return;
    
    e.preventDefault();
    
    // Use router.push with scroll: false to prevent page reload
    router.push(`/account/${targetAddress}?tab=transactions`, { 
      scroll: false 
    });
  }, [router]);

  // Handle transaction hash clicks
  const handleTransactionClick = useStableCallback((e: React.MouseEvent<HTMLAnchorElement>, signature: string) => {
    if (!signature) return;
    
    e.preventDefault();
    
    // Navigate to transaction page
    router.push(`/tx/${signature}`, { 
      scroll: false 
    });
  }, [router]);

  // Map API data to the expected Transfer format
  const transfers = useMemo(() => {
    return rawTransfers.map(item => {
      // Handle different field names between API and component
      return {
        signature: item.signature || '',
        timestamp: item.timestamp || '',
        type: item.type || 'transfer',
        amount: item.amount || 0,
        token: item.tokenSymbol || 'SOL',
        tokenSymbol: item.tokenSymbol || 'SOL',
        from: item.from || '',
        to: item.to || '',
        tokenName: item.tokenName || 'Solana', // Default for SOL
        ...(item as any) // Keep any other fields that might be present
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

    // First filter by search term
    let filtered = transfers;
    if (searchTerm.trim()) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = transfers.filter(transfer => 
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

    // Filter by token
    if (tokenFilter !== 'all') {
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
  }, [transfers, sortField, sortDirection, searchTerm, typeFilter, tokenFilter, amountFilter]);

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
          Transfers
          {totalCount !== undefined && (
            <span className="ml-2 text-sm text-muted-foreground">
              ({totalCount.toLocaleString()})
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

        {/* Filters Row */}
        <div className="flex flex-wrap gap-4">
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
          {(typeFilter !== 'all' || tokenFilter !== 'all' || amountFilter.min || amountFilter.max || searchTerm) && (
            <button
              onClick={() => {
                setTypeFilter('all');
                setTokenFilter('all');
                setAmountFilter({ min: '', max: '' });
                setSearchTerm('');
              }}
              className="px-3 py-1 text-sm bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Search Results Count */}
      {(searchTerm || typeFilter !== 'all' || tokenFilter !== 'all' || amountFilter.min || amountFilter.max) && (
        <div className="text-sm text-muted-foreground">
          Found {sortedTransfers.length} transfers
          {searchTerm && ` matching "${searchTerm}"`}
          {typeFilter !== 'all' && ` of type "${typeFilter}"`}
          {tokenFilter !== 'all' && ` with token "${tokenFilter}"`}
          {(amountFilter.min || amountFilter.max) && ` within amount range`}
        </div>
      )}

      <div className="border border-border rounded-lg overflow-hidden h-[500px]" role="region" aria-labelledby="transfers-heading" aria-live="polite">
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
          aria-busy={loading ? 'true' : 'false'}
        />
      </div>

      {hasMore && (
        <div className="flex justify-center mt-4">
          <Button
            onClick={loadMore}
            disabled={loading}
            variant="outline"
            className="w-full md:w-auto hover:bg-primary/10"
          >
            {loading ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  );
}
