"use client";

import { useState, useMemo, useCallback } from 'react';
import { VTableWrapper } from '@/components/vtable';
import { formatNumber } from '@/lib/utils';
import { Eye, EyeOff, TrendingUp, TrendingDown, Activity, Calendar, ArrowUpDown } from 'lucide-react';

interface TokenInfo {
  mint: string;
  balance: number;
  symbol?: string;
  name?: string;
  decimals?: number;
  price?: number;
  value?: number;
  change24h?: number;
  transferCount?: number;
  firstTransferDate?: string;
  lastTransferDate?: string;
  firstTransferFrom?: string;
  lastTransferTo?: string;
  totalVolume?: number;
  logo?: string;
}

interface Props {
  solBalance: number;
  tokenBalances: { mint: string; balance: number; }[];
}

export default function TokensTab({ solBalance, tokenBalances }: Props) {
  const [showZeroBalance, setShowZeroBalance] = useState(false);
  const [sortField, setSortField] = useState<string>('value');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Convert token balances to enriched token info
  const tokenInfo = useMemo((): TokenInfo[] => {
    // Add SOL as the first token
    const solTokenInfo: TokenInfo = {
      mint: 'So11111111111111111111111111111111111111112', // SOL mint
      balance: solBalance,
      symbol: 'SOL',
      name: 'Solana',
      decimals: 9,
      price: 235.19, // Mock price - would be fetched from API
      value: solBalance * 235.19,
      change24h: 5.2, // Mock data
      transferCount: 142, // Mock data
      firstTransferDate: '2023-01-15',
      lastTransferDate: '2024-01-05',
      firstTransferFrom: '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj',
      lastTransferTo: '2wmVCSfPxGPjrnMMn7rchp4uaeoTqN39mXFC2zhPiRGE',
      totalVolume: 1250.75, // Mock data
      logo: '/solana-logo.png'
    };

    const tokenInfos = tokenBalances.map(token => {
      // Mock additional data - in real app this would come from token registry and APIs
      const mockPrice = Math.random() * 100;
      const mockChange = (Math.random() - 0.5) * 20;
      
      return {
        mint: token.mint,
        balance: token.balance,
        symbol: token.mint.slice(0, 4).toUpperCase(), // Mock symbol
        name: `Token ${token.mint.slice(0, 8)}`, // Mock name
        decimals: 6,
        price: mockPrice,
        value: token.balance * mockPrice,
        change24h: mockChange,
        transferCount: Math.floor(Math.random() * 100),
        firstTransferDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        lastTransferDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        firstTransferFrom: `${Math.random().toString(36).substr(2, 8)}...`,
        lastTransferTo: `${Math.random().toString(36).substr(2, 8)}...`,
        totalVolume: Math.random() * 10000,
        logo: '/token-placeholder.png'
      };
    });

    return [solTokenInfo, ...tokenInfos];
  }, [solBalance, tokenBalances]);

  // Filter tokens based on zero balance setting
  const filteredTokens = useMemo(() => {
    if (showZeroBalance) {
      return tokenInfo;
    }
    return tokenInfo.filter(token => token.balance > 0);
  }, [tokenInfo, showZeroBalance]);

  // Sort tokens
  const sortedTokens = useMemo(() => {
    return [...filteredTokens].sort((a, b) => {
      let aValue: any = a[sortField as keyof TokenInfo];
      let bValue: any = b[sortField as keyof TokenInfo];

      // Handle undefined values
      if (aValue === undefined) aValue = 0;
      if (bValue === undefined) bValue = 0;

      // Handle different types
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return 0;
    });
  }, [filteredTokens, sortField, sortDirection]);

  const handleSort = useCallback((field: string, direction: 'asc' | 'desc' | null) => {
    if (direction === null) {
      setSortField('value');
      setSortDirection('desc');
    } else {
      setSortField(field);
      setSortDirection(direction);
    }
  }, []);

  const columns = useMemo(() => [
    {
      field: 'symbol',
      title: 'Token',
      width: 150,
      sortable: true,
      render: (row: TokenInfo) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <span className="text-xs font-bold">{row.symbol?.slice(0, 2) || 'T'}</span>
          </div>
          <div>
            <div className="font-medium">{row.symbol || 'UNK'}</div>
            <div className="text-xs text-gray-500">{row.name || 'Unknown'}</div>
          </div>
        </div>
      )
    },
    {
      field: 'balance',
      title: 'Balance',
      width: 120,
      sortable: true,
      render: (row: TokenInfo) => (
        <div className="text-right">
          <div className="font-mono">{formatNumber(row.balance)}</div>
          <div className="text-xs text-gray-500">{row.symbol || 'UNK'}</div>
        </div>
      )
    },
    {
      field: 'price',
      title: 'Price',
      width: 100,
      sortable: true,
      render: (row: TokenInfo) => (
        <div className="text-right">
          <div className="font-mono">${row.price?.toFixed(4) || '0.0000'}</div>
        </div>
      )
    },
    {
      field: 'value',
      title: 'Value',
      width: 120,
      sortable: true,
      render: (row: TokenInfo) => (
        <div className="text-right">
          <div className="font-mono font-bold">${row.value?.toFixed(2) || '0.00'}</div>
        </div>
      )
    },
    {
      field: 'change24h',
      title: '24h Change',
      width: 100,
      sortable: true,
      render: (row: TokenInfo) => {
        const change = row.change24h || 0;
        const isPositive = change >= 0;
        return (
          <div className={`flex items-center gap-1 ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span className="font-mono">{change.toFixed(2)}%</span>
          </div>
        );
      }
    },
    {
      field: 'transferCount',
      title: 'Transfers',
      width: 100,
      sortable: true,
      render: (row: TokenInfo) => (
        <div className="flex items-center gap-1">
          <Activity className="w-4 h-4 text-gray-400" />
          <span>{row.transferCount || 0}</span>
        </div>
      )
    },
    {
      field: 'firstTransferFrom',
      title: 'First Transfer',
      width: 180,
      sortable: true,
      render: (row: TokenInfo) => (
        <div className="text-xs">
          <div className="font-mono">{row.firstTransferFrom || 'N/A'}</div>
          <div className="text-gray-500 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {row.firstTransferDate || 'N/A'}
          </div>
        </div>
      )
    },
    {
      field: 'lastTransferTo',
      title: 'Last Transfer',
      width: 180,
      sortable: true,
      render: (row: TokenInfo) => (
        <div className="text-xs">
          <div className="font-mono">{row.lastTransferTo || 'N/A'}</div>
          <div className="text-gray-500 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {row.lastTransferDate || 'N/A'}
          </div>
        </div>
      )
    },
    {
      field: 'totalVolume',
      title: 'Total Volume',
      width: 120,
      sortable: true,
      render: (row: TokenInfo) => (
        <div className="text-right">
          <div className="font-mono">${row.totalVolume?.toFixed(2) || '0.00'}</div>
        </div>
      )
    }
  ], []);

  const getRowId = useCallback((row: TokenInfo) => row.mint, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">
          Tokens ({filteredTokens.length})
        </h2>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowZeroBalance(!showZeroBalance)}
            className="flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
          >
            {showZeroBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showZeroBalance ? 'Hide Zero Balance' : 'Show Zero Balance'}
          </button>
          
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <ArrowUpDown className="w-4 h-4" />
            Sorted by {sortField} ({sortDirection})
          </div>
        </div>
      </div>

      <div className="border border-border rounded-lg overflow-hidden h-[600px]">
        <VTableWrapper
          columns={columns}
          data={sortedTokens}
          rowKey={getRowId}
          loading={false}
          onSort={handleSort}
        />
      </div>

      {!showZeroBalance && tokenInfo.some(t => t.balance === 0) && (
        <div className="text-sm text-gray-500 text-center">
          {tokenInfo.filter(t => t.balance === 0).length} tokens with zero balance hidden.
          <button
            onClick={() => setShowZeroBalance(true)}
            className="ml-2 text-blue-500 hover:text-blue-600 underline"
          >
            Show all tokens
          </button>
        </div>
      )}
    </div>
  );
}
