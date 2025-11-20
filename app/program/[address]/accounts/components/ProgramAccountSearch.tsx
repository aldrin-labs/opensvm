'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import {
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Hash,
  Wallet,
  Calendar,
  Database,
  AlertCircle,
  CheckCircle,
  Settings,
  Clock,
  MoreHorizontal,
  Loader,
  Square,
  CheckSquare,
  Target
} from 'lucide-react';
import { IntelligentDashboard } from '@/components/IntelligentDashboard';
import { getViewportTracker, ViewportStats } from '@/lib/ui/viewport-tracker';
import { UserHistoryService } from '@/lib/user/user-history';
import { useTheme } from '@/lib/design-system/theme-provider';
import { formatDistanceToNow } from 'date-fns';

interface ProgramAccount {
  address: string;
  data: string;
  executable: boolean;
  lamports: number;
  owner: string;
  rentEpoch: number;
  dataSize: number;
  decoded?: any;
  lastActivity?: number;
  createdAt?: number;
}

interface PDADerivation {
  seeds: string[];
  programId: string;
  bump: number;
}

interface ProgramAccountSearchProps {
  programId: string;
}

export function ProgramAccountSearch({ programId }: ProgramAccountSearchProps) {
  const [accounts, setAccounts] = useState<ProgramAccount[]>([]);
  const [displayedAccounts, setDisplayedAccounts] = useState<ProgramAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchType, setSearchType] = useState<'all' | 'filtered' | 'pda'>('all');
  const [filters, setFilters] = useState({
    minBalance: '',
    maxBalance: '',
    dataSize: '',
    executable: 'all'
  });
  const [pdaSeeds, setPdaSeeds] = useState<string[]>(['']);
  const [derivedPDAs, setDerivedPDAs] = useState<{ address: string; bump: number; seeds: string[] }[]>([]);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [viewportStats, setViewportStats] = useState<ViewportStats | null>(null);
  const [currentWallet, setCurrentWallet] = useState<string>('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const tableRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<HTMLDivElement>(null);
  const viewportTracker = useRef(getViewportTracker());

  // Items per page for pagination
  const ITEMS_PER_PAGE = 50;

  // Initialize viewport tracker
  useEffect(() => {
    if (tableRef.current) {
      const tracker = viewportTracker.current;
      tracker.initialize(tableRef.current);
      
      const unsubscribe = tracker.subscribe((stats) => {
        setViewportStats(stats);
      });

      return () => {
        unsubscribe();
        tracker.destroy();
      };
    }
  }, []);

  // Track account rows for viewport
  const trackAccountRow = useCallback((address: string, element: HTMLElement, account: ProgramAccount) => {
    viewportTracker.current.trackItem(address, element, account);
  }, []);

  // Compact time formatting
  const formatCompactTime = (timestamp: number | undefined) => {
    if (!timestamp) return 'Unknown';
    
    try {
      const distance = formatDistanceToNow(timestamp, { addSuffix: true });
      return distance
        .replace('about ', '')
        .replace('less than a minute ago', 'now')
        .replace(' minutes ago', 'm ago')
        .replace(' hours ago', 'h ago')
        .replace(' days ago', 'd ago')
        .replace(' months ago', 'mo ago')
        .replace(' years ago', 'y ago');
    } catch {
      return 'Unknown';
    }
  };

  // Pagination: Update displayed accounts
  const updateDisplayedAccounts = useCallback(() => {
    const startIndex = 0;
    const endIndex = page * ITEMS_PER_PAGE;
    const newDisplayed = accounts.slice(startIndex, endIndex);
    setDisplayedAccounts(newDisplayed);
    setHasMore(endIndex < accounts.length);
  }, [accounts, page]);

  useEffect(() => {
    updateDisplayedAccounts();
  }, [updateDisplayedAccounts]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && hasMore && !loadingMore && !loading) {
          setLoadingMore(true);
          setTimeout(() => {
            setPage(prev => prev + 1);
            setLoadingMore(false);
          }, 500);
        }
      },
      { threshold: 1 }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading]);

  const searchAccounts = useCallback(async () => {
    if (!programId) return;

    setLoading(true);
    setError(null);
    setPage(1);

    try {
      const response = await fetch('/api/program-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          programId,
          searchType,
          filters,
          pdaSeeds: searchType === 'pda' ? pdaSeeds.filter(s => s.trim()) : undefined
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.data?.accounts) {
        setAccounts(data.data.accounts);
        
        // Track user history
        if (currentWallet) {
          UserHistoryService.addHistoryEntry({
            id: Date.now().toString(),
            walletAddress: currentWallet,
            pageType: 'program',
            pageTitle: `Program Accounts - ${programId}`,
            path: `/program/${programId}/accounts`,
            timestamp: Date.now(),
            metadata: {
              programId,
              accountCount: data.data.accounts.length,
              searchType
            }
          });
        }
      }
      
      if (data.derivedPDAs) {
        setDerivedPDAs(data.derivedPDAs);
      }
    } catch (err) {
      console.error('Error searching accounts:', err);
      setError(err instanceof Error ? err.message : 'Failed to search accounts');
    } finally {
      setLoading(false);
    }
  }, [programId, searchType, filters, pdaSeeds, currentWallet]);

  const addSeed = () => {
    setPdaSeeds([...pdaSeeds, '']);
  };

  const removeSeed = (index: number) => {
    setPdaSeeds(pdaSeeds.filter((_, i) => i !== index));
  };

  const updateSeed = (index: number, value: string) => {
    const newSeeds = [...pdaSeeds];
    newSeeds[index] = value;
    setPdaSeeds(newSeeds);
  };

  const toggleAccountExpanded = (address: string) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(address)) {
      newExpanded.delete(address);
    } else {
      newExpanded.add(address);
    }
    setExpandedAccounts(newExpanded);
  };

  const toggleAccountSelected = (address: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const newSelected = new Set(selectedAccounts);
    if (newSelected.has(address)) {
      newSelected.delete(address);
    } else {
      newSelected.add(address);
    }
    setSelectedAccounts(newSelected);
  };

  const selectAllVisible = () => {
    const visibleAddresses = displayedAccounts.map(acc => acc.address);
    setSelectedAccounts(new Set([...selectedAccounts, ...visibleAddresses]));
  };

  const clearSelection = () => {
    setSelectedAccounts(new Set());
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatSOL = (lamports: number) => {
    return (lamports / 1e9).toFixed(6);
  };

  const formatDataSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const exportAccounts = () => {
    const toExport = selectedAccounts.size > 0 
      ? accounts.filter(acc => selectedAccounts.has(acc.address))
      : accounts;
      
    const dataStr = JSON.stringify(toExport, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `program_accounts_${programId}_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Auto-search on component mount
  useEffect(() => {
    if (programId && searchType === 'all') {
      searchAccounts();
    }
  }, [programId, searchType, searchAccounts]);

  // Get current wallet from wallet context
  useEffect(() => {
    // TODO: Replace with actual wallet context when available
    // For now, leave empty until real wallet integration
    setCurrentWallet('');
  }, []);

  return (
    <div className="flex space-x-6">
      {/* Main Content - 70% width */}
      <div className="flex-1 space-y-6">
        {/* Search Controls */}
        <div className="rounded-lg border bg-card text-card-foreground p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Account Search</h2>
            <div className="flex items-center space-x-2">
              {selectedAccounts.size > 0 && (
                <div className="flex items-center space-x-2 text-sm text-primary">
                  <CheckSquare className="w-4 h-4" />
                  <span>{selectedAccounts.size} selected</span>
                  <button
                    onClick={clearSelection}
                    className="text-muted-foreground hover:text-card-foreground transition-colors"
                  >
                    Clear
                  </button>
                </div>
              )}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-2 px-3 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span>Filters</span>
                {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Search Type Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <button
              onClick={() => setSearchType('all')}
              className={`p-4 rounded-lg border-2 transition-colors ${
                searchType === 'all'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-muted hover:bg-muted/80'
              }`}
            >
              <Database className="w-6 h-6 mx-auto mb-2" />
              <div className="font-medium">All Accounts</div>
              <div className="text-sm text-muted-foreground">Search all program accounts</div>
            </button>
            
            <button
              onClick={() => setSearchType('filtered')}
              className={`p-4 rounded-lg border-2 transition-colors ${
                searchType === 'filtered'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-muted hover:bg-muted/80'
              }`}
            >
              <Filter className="w-6 h-6 mx-auto mb-2" />
              <div className="font-medium">Filtered Search</div>
              <div className="text-sm text-muted-foreground">Apply custom filters</div>
            </button>
            
            <button
              onClick={() => setSearchType('pda')}
              className={`p-4 rounded-lg border-2 transition-colors ${
                searchType === 'pda'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-muted hover:bg-muted/80'
              }`}
            >
              <Hash className="w-6 h-6 mx-auto mb-2" />
              <div className="font-medium">PDA Derivation</div>
              <div className="text-sm text-muted-foreground">Derive Program Derived Addresses</div>
            </button>
          </div>

          {/* Filters Panel */}
          {showFilters && (searchType === 'filtered' || searchType === 'all') && (
            <div className="bg-muted rounded-lg p-4 mb-4">
              <h3 className="font-medium mb-3">Search Filters</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Min Balance (SOL)</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={filters.minBalance}
                    onChange={(e) => setFilters({...filters, minBalance: e.target.value})}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground focus:border-primary focus:outline-none"
                    placeholder="0.0"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Max Balance (SOL)</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={filters.maxBalance}
                    onChange={(e) => setFilters({...filters, maxBalance: e.target.value})}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground focus:border-primary focus:outline-none"
                    placeholder="1000.0"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Data Size (bytes)</label>
                  <input
                    type="number"
                    value={filters.dataSize}
                    onChange={(e) => setFilters({...filters, dataSize: e.target.value})}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground focus:border-primary focus:outline-none"
                    placeholder="Any size"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Executable</label>
                  <select
                    value={filters.executable}
                    onChange={(e) => setFilters({...filters, executable: e.target.value})}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground focus:border-primary focus:outline-none"
                  >
                    <option value="all">All</option>
                    <option value="true">Executable only</option>
                    <option value="false">Non-executable only</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* PDA Seeds Input */}
          {searchType === 'pda' && (
            <div className="bg-muted rounded-lg p-4 mb-4">
              <h3 className="font-medium mb-3">PDA Seeds</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Enter the seeds used to derive Program Derived Addresses. Each seed can be text or hex (prefix with 0x).
              </p>
              
              {pdaSeeds.map((seed, index) => (
                <div key={index} className="flex items-center space-x-2 mb-2">
                  <input
                    type="text"
                    value={seed}
                    onChange={(e) => updateSeed(index, e.target.value)}
                    className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-foreground focus:border-primary focus:outline-none"
                    placeholder={`Seed ${index + 1} (text or 0x...)`}
                  />
                  {pdaSeeds.length > 1 && (
                    <button
                      onClick={() => removeSeed(index)}
                      className="px-3 py-2 text-destructive hover:text-destructive/80 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              
              <button
                onClick={addSeed}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Add Seed
              </button>
            </div>
          )}

          {/* Search Button */}
          <div className="flex items-center justify-between">
            <button
              onClick={searchAccounts}
              disabled={loading}
              className="flex items-center space-x-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
              <span>{loading ? 'Searching...' : 'Search Accounts'}</span>
            </button>

            <div className="flex items-center space-x-2">
              {displayedAccounts.length > 0 && (
                <button
                  onClick={selectAllVisible}
                  className="flex items-center space-x-2 px-3 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors"
                >
                  <Target className="w-4 h-4" />
                  <span>Select Visible</span>
                </button>
              )}
              
              {accounts.length > 0 && (
                <button
                  onClick={exportAccounts}
                  className="flex items-center space-x-2 px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Export ({selectedAccounts.size || accounts.length})</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <span className="text-red-400 font-medium">Error</span>
            </div>
            <p className="text-red-300 mt-1">{error}</p>
          </div>
        )}

        {/* Derived PDAs */}
        {searchType === 'pda' && derivedPDAs.length > 0 && (
          <div className="rounded-lg border bg-card text-card-foreground p-6">
            <h3 className="text-lg font-semibold mb-4">Derived PDAs</h3>
            <div className="space-y-3">
              {derivedPDAs.map((pda, index) => (
                <div key={index} className="bg-muted rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Hash className="w-4 h-4 text-primary" />
                      <span className="font-mono text-sm">{pda.address}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-muted-foreground">Bump: {pda.bump}</span>
                      <button
                        onClick={() => copyToClipboard(pda.address)}
                        className="text-muted-foreground hover:text-card-foreground transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <a
                        href={`https://explorer.solana.com/address/${pda.address}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-card-foreground transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Seeds: {pda.seeds.map(seed => `"${seed}"`).join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Enhanced Results Table */}
        {displayedAccounts.length > 0 && (
          <div className="rounded-lg border bg-card text-card-foreground overflow-hidden">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Found Accounts ({accounts.length})</h3>
                <div className="text-sm text-muted-foreground">
                  Showing {displayedAccounts.length} of {accounts.length} • 
                  Total Balance: {formatSOL(accounts.reduce((sum, acc) => sum + acc.lamports, 0))} SOL
                </div>
              </div>
            </div>

            {/* Table Header */}
            <div className="bg-muted px-6 py-3 grid grid-cols-12 gap-4 text-sm font-medium text-muted-foreground border-b border-border">
              <div className="col-span-1 flex items-center">
                <Square className="w-4 h-4" />
              </div>
              <div className="col-span-4">Account</div>
              <div className="col-span-2">Balance</div>
              <div className="col-span-2">Data Size</div>
              <div className="col-span-2">Last Activity</div>
              <div className="col-span-1">Actions</div>
            </div>

            {/* Scrollable Table Body */}
            <div ref={tableRef} className="max-h-96 overflow-y-auto">
              {displayedAccounts.map((account, index) => (
                <AccountRow
                  key={account.address}
                  account={account}
                  index={index}
                  isSelected={selectedAccounts.has(account.address)}
                  isExpanded={expandedAccounts.has(account.address)}
                  onToggleSelected={toggleAccountSelected}
                  onToggleExpanded={toggleAccountExpanded}
                  onTrackRef={trackAccountRow}
                  formatSOL={formatSOL}
                  formatDataSize={formatDataSize}
                  formatCompactTime={formatCompactTime}
                  copyToClipboard={copyToClipboard}
                />
              ))}
              
              {/* Loading More Indicator */}
              {loadingMore && (
                <div className="px-6 py-4 text-center">
                  <Loader className="w-5 h-5 animate-spin mx-auto text-primary" />
                  <span className="text-sm text-muted-foreground ml-2">Loading more accounts...</span>
                </div>
              )}

              {/* Intersection Observer Target */}
              <div ref={observerRef} className="h-1" />
            </div>
          </div>
        )}

        {!loading && !error && accounts.length === 0 && searchType !== 'pda' && (
          <div className="text-center py-12">
            <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">No accounts found</h3>
            <p className="text-muted-foreground/80">
              {searchType === 'all' 
                ? 'This program has no associated accounts'
                : 'No accounts match your search criteria'
              }
            </p>
          </div>
        )}
      </div>

      {/* Intelligent Dashboard - 30% width */}
      <div className="w-96">
        <IntelligentDashboard 
          viewportStats={viewportStats}
          programId={programId}
          currentWallet={currentWallet}
        />
      </div>
    </div>
  );
}

// Separate AccountRow component for better performance
interface AccountRowProps {
  account: ProgramAccount;
  index: number;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleSelected: (address: string, event: React.MouseEvent) => void;
  onToggleExpanded: (address: string) => void;
  onTrackRef: (address: string, element: HTMLElement, account: ProgramAccount) => void;
  formatSOL: (lamports: number) => string;
  formatDataSize: (size: number) => string;
  formatCompactTime: (timestamp: number | undefined) => string;
  copyToClipboard: (text: string) => void;
}

const AccountRow = React.memo(({ 
  account, 
  index, 
  isSelected, 
  isExpanded, 
  onToggleSelected, 
  onToggleExpanded,
  onTrackRef,
  formatSOL, 
  formatDataSize, 
  formatCompactTime, 
  copyToClipboard 
}: AccountRowProps) => {
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (rowRef.current) {
      onTrackRef(account.address, rowRef.current, account);
    }
  }, [account.address, onTrackRef, account]);

  return (
    <div 
      ref={rowRef}
      className={`border-b border-border transition-colors ${
        isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50'
      }`}
    >
      <div 
        className="px-6 py-4 grid grid-cols-12 gap-4 cursor-pointer"
        onClick={() => onToggleExpanded(account.address)}
      >
        <div className="col-span-1 flex items-center">
          <button
            onClick={(e) => onToggleSelected(account.address, e)}
            className="text-muted-foreground hover:text-card-foreground transition-colors"
          >
            {isSelected ? (
              <CheckSquare className="w-4 h-4 text-primary" />
            ) : (
              <Square className="w-4 h-4" />
            )}
          </button>
        </div>
        
        <div className="col-span-4 flex items-center space-x-3">
          <Wallet className="w-4 h-4 text-primary flex-shrink-0" />
          <div className="min-w-0">
            <a
              href={`/account/${account.address}`}
              className="font-mono text-sm truncate text-primary hover:text-primary/80 hover:underline transition-colors cursor-pointer group relative"
              onClick={(e) => e.stopPropagation()}
              title={`View account: ${account.address}`}
            >
              {account.address}
              <span className="absolute bottom-full left-0 mb-1 px-2 py-1 text-xs bg-popover text-popover-foreground rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                Click to view account details
              </span>
            </a>
            {account.executable && (
              <span className="inline-block mt-1 px-2 py-1 bg-green-500/20 text-green-600 dark:text-green-400 rounded text-xs">
                Executable
              </span>
            )}
          </div>
        </div>
        
        <div className="col-span-2 text-sm">
          <div className="font-mono">{formatSOL(account.lamports)} SOL</div>
        </div>
        
        <div className="col-span-2 text-sm">
          <div>{formatDataSize(account.dataSize)}</div>
        </div>
        
        <div className="col-span-2 text-sm flex items-center space-x-1">
          <Clock className="w-3 h-3 text-muted-foreground" />
          <span 
            title={account.lastActivity ? new Date(account.lastActivity).toLocaleString() : 'Unknown'}
            className="text-muted-foreground"
          >
            {formatCompactTime(account.lastActivity)}
          </span>
        </div>
        
        <div className="col-span-1 flex items-center space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              copyToClipboard(account.address);
            }}
            className="text-muted-foreground hover:text-card-foreground transition-colors"
          >
            <Copy className="w-3 h-3" />
          </button>
          <a
            href={`https://explorer.solana.com/address/${account.address}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-muted-foreground hover:text-card-foreground transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
          {isExpanded ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="px-6 pb-4 bg-muted/30">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-xs text-muted-foreground">Balance</div>
              <div className="font-mono">{formatSOL(account.lamports)} SOL</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Data Size</div>
              <div className="font-mono">{formatDataSize(account.dataSize)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Rent Epoch</div>
              <div className="font-mono">{account.rentEpoch}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Executable</div>
              <div className="flex items-center space-x-1">
                {account.executable ? (
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-muted-foreground" />
                )}
                <span>{account.executable ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </div>

          {account.data && account.data !== '11111111111111111111111111111111' && (
            <div>
              <div className="text-xs text-muted-foreground mb-2">Account Data (Base58)</div>
              <div className="bg-background border border-border p-3 rounded font-mono text-xs break-all">
                {account.data.length > 200 ? (
                  <>
                    {account.data.substring(0, 200)}...
                    <span className="text-muted-foreground ml-2">({account.data.length} chars total)</span>
                  </>
                ) : (
                  account.data
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

AccountRow.displayName = 'AccountRow';
