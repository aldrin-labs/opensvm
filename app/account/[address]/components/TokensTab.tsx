"use client";

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { VTableWrapper } from '@/components/vtable';
import { formatNumber } from '@/lib/utils';

// Enhanced number formatting functions
const formatCurrency = (value: number, currency = 'USD'): string => {
  if (value === 0) return '$0.00';
  if (Math.abs(value) < 0.01) return '<$0.01';
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
};

const formatTokenAmount = (balance: number, decimals: number = 6): string => {
  if (balance === 0) return '0';
  if (balance < 0.001) return '<0.001';
  if (balance >= 1e6) return `${(balance / 1e6).toFixed(2)}M`;
  if (balance >= 1e3) return `${(balance / 1e3).toFixed(2)}K`;
  
  // For smaller amounts, show appropriate decimal places
  if (balance >= 1) return balance.toFixed(2);
  if (balance >= 0.1) return balance.toFixed(3);
  return balance.toFixed(4);
};

const formatPrice = (price: number): string => {
  if (price === 0) return '$0.0000';
  if (price < 0.0001) return '<$0.0001';
  if (price >= 1) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(6)}`;
};

const formatPercentage = (percentage: number): string => {
  if (Math.abs(percentage) < 0.01) return '0.00%';
  return `${percentage > 0 ? '+' : ''}${percentage.toFixed(2)}%`;
};
import { 
  Eye, EyeOff, TrendingUp, TrendingDown, Activity, Calendar, ArrowUpDown, 
  Search, X, Filter, DollarSign, PieChart, Star, StarOff, ExternalLink,
  Copy, Send, ArrowUpRight, ArrowDownRight
} from 'lucide-react';

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
  portfolioPercentage?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  isWatchlisted?: boolean;
  profitLoss?: number;
  profitLossPercentage?: number;
}

interface Props {
  solBalance: number;
  tokenBalances: { mint: string; balance: number; }[];
  tokenAccounts?: any[]; // Add tokenAccounts which contain proper metadata
  walletAddress: string;
}

interface TokenAccountSelection {
  mint: string;
  symbol: string;
  accounts: string[];
}

interface FilterPreferences {
  showZeroBalance: boolean;
  tokenTypeFilter: 'all' | 'fungible' | 'nft';
  valueRangeFilter: { min: string; max: string };
  balanceRangeFilter: { min: string; max: string };
  activityFilter: 'all' | 'active' | 'inactive';
  riskFilter: 'all' | 'low' | 'medium' | 'high';
}

export default function TokensTab({ solBalance, tokenBalances, tokenAccounts, walletAddress }: Props) {
  const router = useRouter();
  const [sortField, setSortField] = useState<string>('value');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [watchlistedTokens, setWatchlistedTokens] = useState<Set<string>>(new Set());
  const [tokenAccountSelection, setTokenAccountSelection] = useState<TokenAccountSelection | null>(null);
  const [loadingTokenAccounts, setLoadingTokenAccounts] = useState<string | null>(null);

  // State for real portfolio data from backend API
  const [portfolioData, setPortfolioData] = useState<{
    data?: any;
    loading: boolean;
    error?: string;
  }>({
    loading: true
  });

  // Fetch real portfolio data from backend API
  useEffect(() => {
    let mounted = true;
    
    const fetchPortfolioData = async () => {
      if (!walletAddress) return;
      
      try {
        setPortfolioData(prev => ({ ...prev, loading: true, error: undefined }));
        
        const response = await fetch(`/api/account-portfolio/${walletAddress}`);
        const result = await response.json();
        
        if (!mounted) return;
        
        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch portfolio data');
        }
        
        setPortfolioData({
          data: result.data,
          loading: false
        });
        
      } catch (error) {
        console.error('Error fetching portfolio data:', error);
        if (mounted) {
          setPortfolioData({
            loading: false,
            error: error instanceof Error ? error.message : 'Failed to fetch portfolio data'
          });
        }
      }
    };

    fetchPortfolioData();

    return () => {
      mounted = false;
    };
  }, [walletAddress]);

  // Load filter preferences from localStorage
  const [filterPreferences, setFilterPreferences] = useState<FilterPreferences>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('opensvm-tokens-filter-preferences');
        return saved ? JSON.parse(saved) : {
          showZeroBalance: false,
          tokenTypeFilter: 'all',
          valueRangeFilter: { min: '', max: '' },
          balanceRangeFilter: { min: '', max: '' },
          activityFilter: 'all',
          riskFilter: 'all'
        };
      } catch (error) {
        console.warn('Failed to load token filter preferences from localStorage:', error);
        return {
          showZeroBalance: false,
          tokenTypeFilter: 'all',
          valueRangeFilter: { min: '', max: '' },
          balanceRangeFilter: { min: '', max: '' },
          activityFilter: 'all',
          riskFilter: 'all'
        };
      }
    }
    return {
      showZeroBalance: false,
      tokenTypeFilter: 'all',
      valueRangeFilter: { min: '', max: '' },
      balanceRangeFilter: { min: '', max: '' },
      activityFilter: 'all',
      riskFilter: 'all'
    };
  });

  // Save filter preferences to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('opensvm-tokens-filter-preferences', JSON.stringify(filterPreferences));
      } catch (error) {
        console.warn('Failed to save token filter preferences to localStorage:', error);
      }
    }
  }, [filterPreferences]);

  // Helper function to update filter preferences
  const updateFilterPreference = useCallback((key: keyof FilterPreferences, value: any) => {
    setFilterPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  // Convert portfolio data to enriched token info using real data from API
  const tokenInfo = useMemo((): TokenInfo[] => {
    const tokens: TokenInfo[] = [];
    
    // Use real portfolio data if available, fallback to props data
    const apiData = portfolioData.data;
    
    // Add SOL from API data or props
    if (apiData?.native) {
      const native = apiData.native;
      if (native.balance > 0 || filterPreferences.showZeroBalance) {
        tokens.push({
          mint: 'So11111111111111111111111111111111111111112',
          balance: native.balance,
          symbol: native.symbol || 'SOL',
          name: native.name || 'Solana',
          decimals: native.decimals || 9,
          price: native.price || undefined,
          value: native.value || undefined,
          change24h: native.change24h || undefined,
          transferCount: undefined, // Would need transaction analysis
          logo: '/solana-logo.svg',
          riskLevel: undefined,
          profitLoss: undefined,
          profitLossPercentage: undefined
        });
      }
    } else if (solBalance > 0 || filterPreferences.showZeroBalance) {
      // Fallback to props data if API data not available
      tokens.push({
        mint: 'So11111111111111111111111111111111111111112',
        balance: solBalance,
        symbol: 'SOL',
        name: 'Solana',
        decimals: 9,
        price: undefined,
        value: undefined,
        change24h: undefined,
        transferCount: undefined,
        logo: '/solana-logo.svg',
        riskLevel: undefined,
        profitLoss: undefined,
        profitLossPercentage: undefined
      });
    }

    // Add tokens from API data
    if (apiData?.tokens && Array.isArray(apiData.tokens)) {
      const apiTokens = apiData.tokens
        .filter((token: any) => token.balance > 0 || filterPreferences.showZeroBalance)
        .map((token: any) => ({
          mint: token.mint,
          balance: token.balance,
          symbol: token.symbol || token.mint.slice(0, 4).toUpperCase(),
          name: token.name || 'Unknown Token',
          decimals: token.decimals || 6,
          price: token.price || undefined,
          value: token.value || undefined,
          change24h: token.change24h || undefined,
          transferCount: undefined, // Would need transaction analysis
          logo: token.logo || undefined,
          riskLevel: undefined,
          profitLoss: undefined,
          profitLossPercentage: undefined
        }));
      
      tokens.push(...apiTokens);
    } else {
      // Fallback to props data if API data not available
      const tokenInfos = tokenBalances
        .filter(tokenBalance => tokenBalance.balance > 0 || filterPreferences.showZeroBalance)
        .map(tokenBalance => {
          const tokenAccount = tokenAccounts?.find(ta => ta.mint === tokenBalance.mint);
          
          return {
            mint: tokenBalance.mint,
            balance: tokenBalance.balance,
            symbol: tokenAccount?.symbol || tokenBalance.mint.slice(0, 4).toUpperCase(),
            name: tokenAccount?.name || 'Unknown Token',
            decimals: tokenAccount?.decimals || 6,
            price: undefined,
            value: undefined,
            change24h: undefined,
            transferCount: undefined,
            logo: tokenAccount?.icon || undefined,
            riskLevel: undefined,
            profitLoss: undefined,
            profitLossPercentage: undefined
          };
        });
      
      tokens.push(...tokenInfos);
    }

    // Calculate portfolio percentages if we have total value
    const totalValue = apiData?.totalValue || 0;
    
    return tokens.map(token => ({
      ...token,
      portfolioPercentage: totalValue > 0 && token.value ? (token.value / totalValue) * 100 : 0,
      isWatchlisted: watchlistedTokens.has(token.mint)
    }));
  }, [portfolioData.data, solBalance, tokenBalances, tokenAccounts, watchlistedTokens, filterPreferences.showZeroBalance]);

  // Calculate portfolio statistics using real API data
  const portfolioStats = useMemo(() => {
    const tokenCount = tokenInfo.filter(token => token.balance > 0).length;
    const totalTokens = tokenInfo.length;
    
    // Use real data from API if available
    const apiData = portfolioData.data;
    const totalValue = apiData?.totalValue || undefined;
    const pricesAvailable = apiData?.summary?.pricesAvailable || false;

    return {
      totalValue: totalValue,
      totalProfitLoss: undefined, // Would need historical data for P&L calculation
      totalProfitLossPercentage: undefined,
      tokenCount,
      totalTokens,
      pricesAvailable,
      loading: portfolioData.loading,
      error: portfolioData.error
    };
  }, [tokenInfo, portfolioData]);

  // Filter and search tokens
  const filteredTokens = useMemo(() => {
    let list = tokenInfo;

    // Filter by zero balance
    if (!filterPreferences.showZeroBalance) {
      list = list.filter(t => t.balance > 0);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      list = list.filter(t =>
        t.symbol?.toLowerCase().includes(query) ||
        t.name?.toLowerCase().includes(query) ||
        t.mint.toLowerCase().includes(query)
      );
    }

    // Filter by token type (assuming NFTs have balance of 1 and no decimals > 0)
    if (filterPreferences.tokenTypeFilter !== 'all') {
      if (filterPreferences.tokenTypeFilter === 'nft') {
        list = list.filter(t => t.balance === 1 && t.decimals === 0);
      } else if (filterPreferences.tokenTypeFilter === 'fungible') {
        list = list.filter(t => !(t.balance === 1 && t.decimals === 0));
      }
    }

    // Filter by value range
    if (filterPreferences.valueRangeFilter.min || filterPreferences.valueRangeFilter.max) {
      list = list.filter(t => {
        const value = t.value || 0;
        const min = filterPreferences.valueRangeFilter.min ? parseFloat(filterPreferences.valueRangeFilter.min) : 0;
        const max = filterPreferences.valueRangeFilter.max ? parseFloat(filterPreferences.valueRangeFilter.max) : Infinity;
        return value >= min && value <= max;
      });
    }

    // Filter by balance range
    if (filterPreferences.balanceRangeFilter.min || filterPreferences.balanceRangeFilter.max) {
      list = list.filter(t => {
        const balance = t.balance || 0;
        const min = filterPreferences.balanceRangeFilter.min ? parseFloat(filterPreferences.balanceRangeFilter.min) : 0;
        const max = filterPreferences.balanceRangeFilter.max ? parseFloat(filterPreferences.balanceRangeFilter.max) : Infinity;
        return balance >= min && balance <= max;
      });
    }

    // Filter by activity level
    if (filterPreferences.activityFilter !== 'all') {
      if (filterPreferences.activityFilter === 'active') {
        list = list.filter(t => (t.transferCount || 0) > 0);
      } else if (filterPreferences.activityFilter === 'inactive') {
        list = list.filter(t => (t.transferCount || 0) === 0);
      }
    }

    // Filter by risk level
    if (filterPreferences.riskFilter !== 'all') {
      list = list.filter(t => t.riskLevel === filterPreferences.riskFilter);
    }

    return list;
  }, [tokenInfo, filterPreferences, searchQuery]);

  // Sort tokens
  const sortedTokens = useMemo(() => {
    return [...filteredTokens].sort((a, b) => {
      let aValue: any = a[sortField as keyof TokenInfo];
      let bValue: any = b[sortField as keyof TokenInfo];

      if (aValue === undefined) aValue = 0;
      if (bValue === undefined) bValue = 0;

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

  const handleToggleWatchlist = useCallback((mint: string) => {
    setWatchlistedTokens(prev => {
      const newSet = new Set(prev);
      if (newSet.has(mint)) {
        newSet.delete(mint);
      } else {
        newSet.add(mint);
      }
      return newSet;
    });
  }, []);

  const handleCopyAddress = useCallback((address: string) => {
    navigator.clipboard.writeText(address);
  }, []);

  // Function to find token accounts for a given mint
  const findTokenAccounts = useCallback(async (mint: string, symbol: string) => {
    setLoadingTokenAccounts(mint);
    try {
      // For SOL, use the wallet address directly
      if (mint === 'So11111111111111111111111111111111111111112') {
        router.push(`/account/${walletAddress}`);
        return;
      }

      // Mock implementation - in a real app, you'd query the blockchain
      // to find all token accounts for this mint owned by this wallet
      const mockTokenAccounts = [
        `${walletAddress}${mint.slice(-8)}ATA1`, // Associated Token Account
        `${walletAddress}${mint.slice(-8)}ATA2`, // Secondary account (if exists)
      ];

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Filter out accounts that don't actually exist (mock logic)
      const existingAccounts = mockTokenAccounts.filter(() => Math.random() > 0.5);
      
      if (existingAccounts.length === 0) {
        // No token accounts found - this shouldn't happen if we have a balance
        console.warn(`No token accounts found for mint ${mint}`);
        return;
      } else if (existingAccounts.length === 1) {
        // Single token account - navigate directly
        router.push(`/account/${existingAccounts[0]}`);
      } else {
        // Multiple token accounts - show selection popup
        setTokenAccountSelection({
          mint,
          symbol,
          accounts: existingAccounts
        });
      }
    } catch (error) {
      console.error('Error finding token accounts:', error);
    } finally {
      setLoadingTokenAccounts(null);
    }
  }, [walletAddress, router]);

  // Handle token account selection from popup
  const handleTokenAccountSelect = useCallback((accountAddress: string) => {
    setTokenAccountSelection(null);
    router.push(`/account/${accountAddress}`);
  }, [router]);

  // Close token account selection popup
  const closeTokenAccountSelection = useCallback(() => {
    setTokenAccountSelection(null);
  }, []);

  const columns = useMemo(() => [
    {
      field: 'symbol',
      title: 'Token',
      width: 200,
      sortable: true,
      render: (row: TokenInfo) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 border border-border flex items-center justify-center">
            <span className="text-sm font-bold text-foreground">{row.symbol?.slice(0, 2) || 'T'}</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => findTokenAccounts(row.mint, row.symbol || 'UNK')}
                disabled={loadingTokenAccounts === row.mint}
                className="font-medium text-foreground hover:text-primary transition-colors cursor-pointer disabled:opacity-50"
                title="Click to view token account"
              >
                {loadingTokenAccounts === row.mint ? 'Loading...' : (row.symbol || 'UNK')}
              </button>
              <button
                onClick={() => handleToggleWatchlist(row.mint)}
                className="text-muted-foreground hover:text-yellow-500 transition-colors"
              >
                {row.isWatchlisted ? <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" /> : <StarOff className="w-4 h-4" />}
              </button>
            </div>
            <div className="text-xs text-muted-foreground">{row.name || 'Unknown'}</div>
          </div>
        </div>
      )
    },
    {
      field: 'balance',
      title: 'Balance',
      width: 140,
      sortable: true,
      render: (row: TokenInfo) => (
        <div className="text-right">
          <div className="font-mono text-foreground">{formatTokenAmount(row.balance, row.decimals)}</div>
          <div className="text-xs text-muted-foreground">{row.symbol || 'UNK'}</div>
        </div>
      )
    },
    {
      field: 'price',
      title: 'Price',
      width: 120,
      sortable: true,
      render: (row: TokenInfo) => (
        <div className="text-right">
          {row.price !== undefined ? (
            <div className="font-mono text-foreground">{formatPrice(row.price)}</div>
          ) : (
            <div className="font-mono text-muted-foreground text-sm">No price</div>
          )}
        </div>
      )
    },
    {
      field: 'value',
      title: 'Value',
      width: 150,
      sortable: true,
      render: (row: TokenInfo) => (
        <div className="text-right">
          {row.value !== undefined ? (
            <>
              <div className="font-mono font-bold text-foreground">{formatCurrency(row.value)}</div>
              {row.portfolioPercentage !== undefined && row.portfolioPercentage > 0 && (
                <div className="text-xs text-muted-foreground">
                  {row.portfolioPercentage.toFixed(1)}% of portfolio
                </div>
              )}
            </>
          ) : (
            <>
              <div className="font-mono text-muted-foreground text-sm">No price</div>
              <div className="text-xs text-muted-foreground">
                Price needed
              </div>
            </>
          )}
        </div>
      )
    },
    {
      field: 'change24h',
      title: '24h Change',
      width: 130,
      sortable: true,
      render: (row: TokenInfo) => {
        if (row.change24h !== undefined) {
          const change = row.change24h;
          const isPositive = change >= 0;
          return (
            <div className={`flex items-center gap-1 ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span className="font-mono">{formatPercentage(change)}</span>
            </div>
          );
        }
        return (
          <div className="text-muted-foreground text-sm">
            No data
          </div>
        );
      }
    },
    {
      field: 'profitLoss',
      title: 'P&L',
      width: 120,
      sortable: false,
      render: (row: TokenInfo) => (
        <div className="text-right text-muted-foreground text-sm">
          No price data
        </div>
      )
    },
    {
      field: 'transferCount',
      title: 'Activity',
      width: 100,
      sortable: false,
      render: (row: TokenInfo) => (
        <div className="flex items-center gap-1">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground text-sm">No data</span>
        </div>
      )
    },
    {
      field: 'actions',
      title: 'Actions',
      width: 120,
      sortable: false,
      render: (row: TokenInfo) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleCopyAddress(row.mint)}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            title="Copy mint address"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            title="Send token"
          >
            <Send className="w-4 h-4" />
          </button>
          <button
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            title="View on explorer"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ], [handleToggleWatchlist, handleCopyAddress]);

  const getRowId = useCallback((row: TokenInfo) => row.mint, []);

  const clearFilters = () => {
    setSearchQuery('');
    setFilterPreferences({
      showZeroBalance: false,
      tokenTypeFilter: 'all',
      valueRangeFilter: { min: '', max: '' },
      balanceRangeFilter: { min: '', max: '' },
      activityFilter: 'all',
      riskFilter: 'all'
    });
  };

  const hasActiveFilters = searchQuery || 
    filterPreferences.tokenTypeFilter !== 'all' ||
    filterPreferences.valueRangeFilter.min || filterPreferences.valueRangeFilter.max ||
    filterPreferences.balanceRangeFilter.min || filterPreferences.balanceRangeFilter.max ||
    filterPreferences.activityFilter !== 'all' ||
    filterPreferences.riskFilter !== 'all';

  return (
    <div className="h-full flex flex-col space-y-4 bg-background text-foreground">
      {/* Portfolio Overview */}
      <div className="flex-shrink-0 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg p-4 border border-border">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            {portfolioStats.loading ? (
              <div className="text-2xl font-bold text-muted-foreground font-mono">Loading...</div>
            ) : portfolioStats.totalValue !== undefined ? (
              <div className="text-2xl font-bold text-foreground font-mono">{formatCurrency(portfolioStats.totalValue)}</div>
            ) : (
              <div className="text-2xl font-bold text-muted-foreground font-mono">
                {portfolioStats.error ? 'Error' : 'No price data'}
              </div>
            )}
            <div className="text-sm text-muted-foreground">Total Value</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-muted-foreground font-mono">-</div>
            <div className="text-sm text-muted-foreground">P&L</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{portfolioStats.tokenCount}</div>
            <div className="text-sm text-muted-foreground">Tokens Held</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{portfolioStats.totalTokens}</div>
            <div className="text-sm text-muted-foreground">Total Tokens</div>
          </div>
        </div>
        {portfolioStats.error && (
          <div className="mt-3 text-sm text-red-600 text-center">
            {portfolioStats.error}
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex-shrink-0 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-foreground">
          Tokens ({filteredTokens.length})
        </h2>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowUpDown className="w-4 h-4" />
          Sorted by {sortField} ({sortDirection})
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex-shrink-0 space-y-4">
        {/* Search Input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="h-4 w-4 text-muted-foreground" />
          </div>
          <input
            type="text"
            placeholder="Search tokens by symbol, name, or mint address..."
            className="w-full pl-10 pr-10 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => updateFilterPreference('showZeroBalance', !filterPreferences.showZeroBalance)}
            className="flex items-center gap-2 px-3 py-1 bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors text-sm"
          >
            {filterPreferences.showZeroBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {filterPreferences.showZeroBalance ? 'Hide Zero Balance' : 'Show Zero Balance'}
          </button>

          <select
            value={filterPreferences.tokenTypeFilter}
            onChange={(e) => updateFilterPreference('tokenTypeFilter', e.target.value)}
            className="border border-border rounded-lg px-3 py-1 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Types</option>
            <option value="fungible">Fungible Tokens</option>
            <option value="nft">NFTs</option>
          </select>

          <select
            value={filterPreferences.activityFilter}
            onChange={(e) => updateFilterPreference('activityFilter', e.target.value)}
            className="border border-border rounded-lg px-3 py-1 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Activity</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <input
            type="number"
            placeholder="Min Value ($)"
            value={filterPreferences.valueRangeFilter.min}
            onChange={(e) => updateFilterPreference('valueRangeFilter', { ...filterPreferences.valueRangeFilter, min: e.target.value })}
            className="w-28 border border-border rounded-lg px-2 py-1 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-muted-foreground">-</span>
          <input
            type="number"
            placeholder="Max Value ($)"
            value={filterPreferences.valueRangeFilter.max}
            onChange={(e) => updateFilterPreference('valueRangeFilter', { ...filterPreferences.valueRangeFilter, max: e.target.value })}
            className="w-28 border border-border rounded-lg px-2 py-1 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-1 text-sm bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Filter Results Count */}
        {hasActiveFilters && (
          <div className="text-sm text-muted-foreground">
            Found {filteredTokens.length} tokens
            {searchQuery && ` matching "${searchQuery}"`}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 w-full border border-border rounded-lg bg-card/50 tokens-vtable-container overflow-hidden min-h-0">
        <VTableWrapper
          columns={columns}
          data={sortedTokens}
          rowKey={getRowId}
          loading={false}
          onSort={handleSort}
          virtualScrolling={true}
          maxRows={100000}
          initialLoadSize={5000}
          responsive={true}
          minColumnWidth={120}
        />
      </div>

      {/* Footer Info */}
      {!filterPreferences.showZeroBalance && tokenInfo.some(t => t.balance === 0) && (
        <div className="flex-shrink-0 text-sm text-muted-foreground text-center">
          {tokenInfo.filter(t => t.balance === 0).length} tokens with zero balance hidden.
          <button
            onClick={() => updateFilterPreference('showZeroBalance', true)}
            className="ml-2 text-primary hover:text-primary/80 underline"
          >
            Show all tokens
          </button>
        </div>
      )}

      {/* Token Account Selection Popup */}
      {tokenAccountSelection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                Select {tokenAccountSelection.symbol} Token Account
              </h3>
              <button
                onClick={closeTokenAccountSelection}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Multiple token accounts found for {tokenAccountSelection.symbol}. Please select the account you want to view:
            </p>
            <div className="space-y-2">
              {tokenAccountSelection.accounts.map((account, index) => (
                <button
                  key={account}
                  onClick={() => handleTokenAccountSelect(account)}
                  className="w-full p-3 text-left bg-muted/30 hover:bg-muted/60 rounded-lg transition-colors border border-border"
                >
                  <div className="font-mono text-sm text-foreground">{account}</div>
                  <div className="text-xs text-muted-foreground">
                    {index === 0 ? 'Associated Token Account' : `Secondary Account ${index}`}
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border">
              <button
                onClick={closeTokenAccountSelection}
                className="w-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
