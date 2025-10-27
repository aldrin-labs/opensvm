'use client';

import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, Users, Eye, Star, Fish, Filter, X, ChevronDown, ChevronUp } from 'lucide-react';

interface MarketScreenerProps {
  selectedMarket: string;
  onMarketChange: (market: string) => void;
  isExpanded: boolean;
  onExpandChange: (expanded: boolean) => void;
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

export default function MarketScreener({ selectedMarket, onMarketChange, isExpanded, onExpandChange }: MarketScreenerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [markets, setMarkets] = useState<Market[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  
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

  // Generate mock market data
  useEffect(() => {
    const generateMarkets = () => {
      const baseTokens = ['SOL', 'USDC', 'BONK', 'JTO', 'JUP', 'PYTH', 'WIF', 'ORCA', 'RAY', 'MNGO'];
      const quoteTokens = ['USDC', 'SOL', 'USDT'];
      const sources = ['Jupiter', 'Raydium', 'Orca', 'Meteora'];
      
      const mockMarkets: Market[] = [];
      
      for (let i = 0; i < 50; i++) {
        const base = baseTokens[Math.floor(Math.random() * baseTokens.length)];
        const quote = quoteTokens[Math.floor(Math.random() * quoteTokens.length)];
        
        if (base === quote) continue;
        
        mockMarkets.push({
          symbol: `${base}/${quote}`,
          baseToken: base,
          quoteToken: quote,
          price: Math.random() * 1000,
          change24h: (Math.random() - 0.5) * 40,
          volume24h: Math.random() * 10000000,
          source: sources[Math.floor(Math.random() * sources.length)],
          marketCap: Math.random() * 100000000,
          liquidity: Math.random() * 5000000,
        });
      }
      
      return mockMarkets;
    };

    setMarkets(generateMarkets());
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

  return (
    <div className={`market-screener flex flex-col bg-background border-r border-border ${isExpanded ? 'w-96' : 'w-72'} transition-all duration-300`}>
      {/* Header */}
      <div className="screener-header flex items-center justify-between px-3 py-2 bg-card border-b border-border">
        <h2 className="text-sm font-bold text-primary">Market Screener</h2>
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
      <div className="markets-list flex-1 overflow-y-auto">
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
              className={`w-full px-3 py-2 flex items-center justify-between hover:bg-muted transition-colors border-b border-border/50 ${
                selectedMarket === market.symbol ? 'bg-primary/10' : ''
              }`}
            >
              <div className="flex flex-col items-start">
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
              <div className="flex flex-col items-end">
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
