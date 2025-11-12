'use client';

import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, Users, Eye, Star, Fish, Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface MarketScreenerProps {
  selectedMarket: string;
  onMarketChange: (market: string) => void;
  isExpanded: boolean;
  onExpandChange: (expanded: boolean) => void;
  isLoading?: boolean;
}

type TabType = 'trending' | 'all' | 'user' | 'monitor' | 'followers' | 'kols' | 'whales';

interface Market {
  symbol: string;
  baseToken: string;
  quoteToken: string;
  price: number;
  change24h: number;
  volume24h: number;
  source: string;
  marketCap?: number;
  liquidity?: number;
}

export default function MarketScreener({ selectedMarket, onMarketChange, isExpanded, onExpandChange, isLoading = false }: MarketScreenerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [markets, setMarkets] = useState<Market[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isRealData, setIsRealData] = useState(false);
  const [dataSource, setDataSource] = useState('Loading...');

  // Filter states
  const [filters, setFilters] = useState({
    minVolume: '',
    maxVolume: '',
    minChange: '',
    maxChange: '',
    minPrice: '',
    maxPrice: '',
    sources: [] as string[],
  });

  const tabs = [
    { id: 'trending' as TabType, label: 'Trending', icon: TrendingUp },
    { id: 'all' as TabType, label: 'All', icon: Search },
    { id: 'user' as TabType, label: 'My Pairs', icon: Users },
    { id: 'monitor' as TabType, label: 'Monitor', icon: Eye },
    { id: 'followers' as TabType, label: 'Followers', icon: Star },
    { id: 'kols' as TabType, label: 'KOLs', icon: TrendingUp },
    { id: 'whales' as TabType, label: 'Whales', icon: Fish },
  ];

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch real market data from API
  useEffect(() => {
    const fetchMarkets = async () => {
      setIsLoadingData(true);

      try {
        // Map tab types to API query types
        const typeMap: Record<TabType, string> = {
          'trending': 'trending',
          'all': 'all',
          'user': 'volume',
          'monitor': 'gainers',
          'followers': 'volume',
          'kols': 'trending',
          'whales': 'volume',
        };

        const response = await fetch(`/api/trading/markets?type=${typeMap[activeTab]}`);

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();

        if (data.markets && data.markets.length > 0) {
          setMarkets(data.markets);
          setIsRealData(data.isRealData);
          setDataSource(data.dataSource);
        } else {
          // Fallback to mock data if API returns empty
          const generateMockMarkets = () => {
            const baseTokens = ['SOL', 'BONK', 'JTO', 'JUP', 'PYTH', 'WIF', 'ORCA', 'RAY', 'MNGO'];
            const mockMarkets: Market[] = baseTokens.map(base => ({
              symbol: `${base}/USDC`,
              baseToken: base,
              quoteToken: 'USDC',
              price: Math.random() * 100,
              change24h: (Math.random() - 0.5) * 40,
              volume24h: Math.random() * 10000000,
              source: 'Mock',
              marketCap: Math.random() * 100000000,
              liquidity: Math.random() * 5000000,
            }));
            return mockMarkets;
          };

          setMarkets(generateMockMarkets());
          setIsRealData(false);
          setDataSource('Mock Data (API empty)');
        }
      } catch (error) {
        console.error('Failed to fetch markets:', error);

        // Fallback to mock data on error
        const generateMockMarkets = () => {
          const baseTokens = ['SOL', 'BONK', 'JTO', 'JUP', 'PYTH', 'WIF', 'ORCA', 'RAY', 'MNGO'];
          const mockMarkets: Market[] = baseTokens.map(base => ({
            symbol: `${base}/USDC`,
            baseToken: base,
            quoteToken: 'USDC',
            price: Math.random() * 100,
            change24h: (Math.random() - 0.5) * 40,
            volume24h: Math.random() * 10000000,
            source: 'Mock',
            marketCap: Math.random() * 100000000,
            liquidity: Math.random() * 5000000,
          }));
          return mockMarkets;
        };

        setMarkets(generateMockMarkets());
        setIsRealData(false);
        setDataSource('Mock Data (API error)');
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchMarkets();

    // Refresh data periodically
    const interval = setInterval(fetchMarkets, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [activeTab]);

  // Filter markets based on debounced search and filters
  const filteredMarkets = markets.filter(market => {
    const matchesSearch = market.symbol.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                         market.baseToken.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                         market.quoteToken.toLowerCase().includes(debouncedSearch.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (filters.minVolume && market.volume24h < parseFloat(filters.minVolume)) return false;
    if (filters.maxVolume && market.volume24h > parseFloat(filters.maxVolume)) return false;
    if (filters.minChange && market.change24h < parseFloat(filters.minChange)) return false;
    if (filters.maxChange && market.change24h > parseFloat(filters.maxChange)) return false;
    if (filters.minPrice && market.price < parseFloat(filters.minPrice)) return false;
    if (filters.maxPrice && market.price > parseFloat(filters.maxPrice)) return false;
    if (filters.sources.length > 0 && !filters.sources.includes(market.source)) return false;
    
    return true;
  });

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={`market-screener flex flex-col bg-background border-r border-border ${isExpanded ? 'w-96' : 'w-72'} transition-all duration-300`}>
        <div className="screener-header flex items-center justify-between px-3 py-2 bg-card border-b border-border">
          <h2 className="text-sm font-bold text-primary">Market Screener</h2>
          <div className="flex items-center gap-1">
            <Skeleton className="w-6 h-6 rounded" />
            <Skeleton className="w-6 h-6 rounded" />
          </div>
        </div>
        <div className="tabs-container flex overflow-x-auto border-b border-border bg-card">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={`tab-skeleton-${i}`} className="h-10 w-20 m-1" />
          ))}
        </div>
        <div className="search-container p-2 border-b border-border">
          <Skeleton className="h-8 w-full rounded" />
        </div>
        <div className="markets-list flex-1 overflow-y-auto p-2 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={`market-skeleton-${i}`} className="flex items-center justify-between p-2">
              <div className="flex flex-col gap-1 flex-1">
                <Skeleton className="h-4 w-24" />
                {isExpanded && <Skeleton className="h-3 w-16" />}
              </div>
              <div className="flex flex-col gap-1 items-end">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          ))}
        </div>
        {isExpanded && (
          <div className="screener-footer px-3 py-2 border-t border-border bg-card">
            <Skeleton className="h-3 w-32" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`market-screener flex flex-col h-full bg-background border-r border-border ${isExpanded ? 'w-96' : 'w-72'} transition-all duration-300`}>
      {/* Header */}
      <div className="screener-header flex items-center justify-between px-3 py-2 bg-card border-b border-border">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-primary">Market Screener</h2>
          {dataSource && !isLoadingData && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border"
                 style={{
                   backgroundColor: isRealData ? 'rgba(34, 197, 94, 0.1)' : 'rgba(234, 179, 8, 0.1)',
                   borderColor: isRealData ? 'rgba(34, 197, 94, 0.3)' : 'rgba(234, 179, 8, 0.3)',
                   color: isRealData ? 'rgb(34, 197, 94)' : 'rgb(234, 179, 8)'
                 }}
                 title={dataSource}>
              <span className="w-1 h-1 rounded-full"
                    style={{
                      backgroundColor: isRealData ? 'rgb(34, 197, 94)' : 'rgb(234, 179, 8)'
                    }}></span>
              <span>{isRealData ? 'Live' : 'Demo'}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-1 rounded hover:bg-muted ${showFilters ? 'bg-primary/20 text-primary' : ''}`}
            title="Filters"
          >
            <Filter size={16} />
          </button>
          <button
            onClick={() => onExpandChange(!isExpanded)}
            className="p-1 rounded hover:bg-muted"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container flex overflow-x-auto border-b border-border bg-card scrollbar-thin scrollbar-thumb-border">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1 px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={14} />
              {isExpanded && <span>{tab.label}</span>}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="search-container p-2 border-b border-border">
        <div className="relative">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pairs..."
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-background border border-border rounded focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && isExpanded && (
        <div className="filters-panel p-3 border-b border-border bg-card/50 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-primary">Filters</span>
            <button
              onClick={() => setFilters({ minVolume: '', maxVolume: '', minChange: '', maxChange: '', minPrice: '', maxPrice: '', sources: [] })}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear All
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="Min Volume"
              value={filters.minVolume}
              onChange={(e) => setFilters({ ...filters, minVolume: e.target.value })}
              className="px-2 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:border-primary"
            />
            <input
              type="number"
              placeholder="Max Volume"
              value={filters.maxVolume}
              onChange={(e) => setFilters({ ...filters, maxVolume: e.target.value })}
              className="px-2 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:border-primary"
            />
            <input
              type="number"
              placeholder="Min Change %"
              value={filters.minChange}
              onChange={(e) => setFilters({ ...filters, minChange: e.target.value })}
              className="px-2 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:border-primary"
            />
            <input
              type="number"
              placeholder="Max Change %"
              value={filters.maxChange}
              onChange={(e) => setFilters({ ...filters, maxChange: e.target.value })}
              className="px-2 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:border-primary"
            />
          </div>
        </div>
      )}

      {/* Markets List */}
      <div className="markets-list flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
        {filteredMarkets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
            <div>No markets found</div>
            {debouncedSearch && (
              <div className="text-xs mt-2">
                for "{debouncedSearch}"
              </div>
            )}
          </div>
        ) : (
          filteredMarkets.map((market, index) => (
            <button
              key={index}
              onClick={() => onMarketChange(market.symbol)}
              className={`w-full px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-muted transition-colors duration-150 border-b border-border/50 ${
                selectedMarket === market.symbol ? 'bg-primary/10' : ''
              }`}
              style={{ display: 'flex' }}
            >
              <div className="flex flex-col items-start flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-foreground">{market.symbol}</span>
                  {isExpanded && (
                    <span className="text-xs text-muted-foreground">{market.source}</span>
                  )}
                </div>
                {isExpanded && (
                  <span className="text-xs text-muted-foreground">Vol: {formatNumber(market.volume24h)}</span>
                )}
              </div>
              <div className="flex flex-col items-end flex-shrink-0">
                <span className="text-sm font-mono text-foreground">${market.price.toFixed(2)}</span>
                <span className={`text-xs font-medium ${market.change24h >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {market.change24h >= 0 ? '+' : ''}{market.change24h.toFixed(2)}%
                </span>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Footer Stats */}
      {isExpanded && (
        <div className="screener-footer px-3 py-2 border-t border-border bg-card text-xs text-muted-foreground">
          {filteredMarkets.length} of {markets.length} markets
          {debouncedSearch && ` • Searching: "${debouncedSearch}"`}
          {!debouncedSearch && ` • ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}
        </div>
      )}
    </div>
  );
}
