'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSettings } from '@/lib/settings';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2 } from 'lucide-react';
import { getClientConnection as getConnection } from '@/lib/solana/solana-connection';
import { getRPCLatency } from '@/lib/solana/solana';
import { useAIChatSidebar } from '@/contexts/AIChatSidebarContext';
import { RecentBlocks } from '@/components/RecentBlocks';
import TransactionsInBlock from '@/components/TransactionsInBlock';
import NetworkResponseChart from '@/components/NetworkResponseChart';
import { RecentChats } from '@/components/RecentChats';
import { SearchSuggestions } from '@/components/search/SearchSuggestions';
import { SearchSuggestion } from '@/components/search/types';
import { debounce } from '@/lib/utils';

interface Block {
  slot: number;
  transactions?: {
    signature: string;
    type: 'Success' | 'Failed';
    timestamp: number | null;
  }[];
}

interface NetworkStats {
  epoch: number;
  epochProgress: number;
  blockHeight: number;
  activeValidators: number | null;
  tps: number;
  successRate: number;
}

interface NetworkData {
  timestamp: number;
  successRate: number;
  latency: number;
}

export default function HomePage() {
  const settings = useSettings();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { isOpen: isAIChatOpen, open: openAIChat, close: closeAIChat, sidebarWidth, setSidebarWidth, isResizing, onResizeStart, onResizeEnd } = useAIChatSidebar();
  const [networkData, setNetworkData] = useState<NetworkData[]>([]);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [homeSearchLoading, setHomeSearchLoading] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchData() {
      try {
        setIsLoading(true);
        const connection = getConnection();
        const latency = await getRPCLatency();

        // Get current slot and blocks in one batch
        const slot = await connection.getSlot();
        const startSlot = Math.max(0, slot - 9);
        const slots = await connection.getBlocks(startSlot, slot);

        if (!mounted) return;

        // Update blocks
        const blockData = slots.map(slot => ({ slot }));
        setBlocks(blockData);

        // Get epoch info and other stats
        const [epochInfo, validators, perfSamples] = await Promise.all([
          connection.getEpochInfo(),
          connection.getVoteAccounts(),
          connection.getRecentPerformanceSamples(1)
        ]);

        if (!mounted) return;

        const tps = perfSamples[0] ? Math.round(perfSamples[0].numTransactions / perfSamples[0].samplePeriodSecs) : 0;

        const newStats = {
          epoch: epochInfo.epoch,
          epochProgress: (epochInfo.slotIndex / epochInfo.slotsInEpoch) * 100,
          blockHeight: epochInfo.absoluteSlot,
          activeValidators: validators.current.length + validators.delinquent.length,
          tps,
          successRate: 100,
        };

        setStats(newStats);

        // Update network data
        setNetworkData(prev => {
          const newData = [...prev, {
            timestamp: Date.now(),
            successRate: newStats.successRate,
            latency
          }];
          return newData.slice(-30); // Keep last 30 data points
        });
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Fetch suggestions function - memoized to prevent infinite re-renders
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setSuggestionsLoading(true);
    try {
      const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setSuggestions(Array.isArray(data) ? data : []);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setSuggestionsLoading(false);
    }
  }, []);

  // Debounced version of fetchSuggestions - memoized to prevent infinite re-renders
  const debouncedFetchSuggestions = useMemo(() => debounce(fetchSuggestions, 300), [fetchSuggestions]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery || homeSearchLoading) return;
    
    setHomeSearchLoading(true);
    try {
      setShowSuggestions(false);
      // Give React time to render the spinner before navigation
      await new Promise(resolve => setTimeout(resolve, 100));
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
    } finally {
      // Reset loading state after navigation
      setTimeout(() => setHomeSearchLoading(false), 500);
    }
  };

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    debouncedFetchSuggestions(value);
  }, [debouncedFetchSuggestions]);

  const handleInputFocus = () => {
    if (searchQuery.length >= 2) {
      setShowSuggestions(true);
    }
  };

  const handleInputBlur = () => {
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => setShowSuggestions(false), 150);
  };

  const handleBlockSelect = async (block: Block) => {
    try {
      const connection = getConnection();
      const blockInfo = await connection.getBlock(block.slot, {
        maxSupportedTransactionVersion: 0
      });

      if (blockInfo) {
        const blockWithTx: Block = {
          ...block,
          transactions: blockInfo.transactions.map(tx => {
            const signature = tx.transaction.signatures[0];
            if (!signature) {
              throw new Error('Transaction signature not found');
            }
            return {
              signature,
              type: tx.meta?.err ? 'Failed' : 'Success',
              timestamp: blockInfo.blockTime
            };
          })
        };
        setSelectedBlock(blockWithTx);
      }
    } catch (err) {
      console.error('Error fetching block transactions:', err);
    }
  };

  return (
    <div className="relative ai-page-container">
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-4">
              OpenSVM Explorer
            </h1>
            <p className="text-xl text-muted-foreground">
              The quieter you become, the more you are able to hear.
            </p>
          </div>

          {/* Search Bar */}
          <div className="max-w-4xl mx-auto mb-16">
            <form onSubmit={handleSearch} className="relative">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-blue-500/20 to-teal-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative bg-background/80 backdrop-blur-sm border border-border/50 rounded-2xl shadow-2xl shadow-black/10 dark:shadow-black/30 overflow-hidden">
                  <div className="flex items-center">
                    <div className="flex-1 relative">
                      <Search className="absolute left-6 top-1/2 transform -translate-y-1/2 text-muted-foreground/60 group-hover:text-primary/80 transition-colors duration-300" size={22} />
                      <Input
                        type="text"
                        placeholder="Search transactions, blocks, programs and tokens..."
                        value={searchQuery}
                        onChange={handleInputChange}
                        onFocus={handleInputFocus}
                        onBlur={handleInputBlur}
                        className="w-full h-16 pl-16 pr-6 bg-transparent border-0 text-lg placeholder:text-muted-foreground/50 focus:ring-0 focus:outline-none"
                      />
                    </div>
                    <div className="px-2">
                      <Button
                        type="submit"
                        disabled={homeSearchLoading}
                        className="h-12 px-8 bg-gradient-to-r from-purple-600 via-blue-600 to-teal-600 hover:from-purple-700 hover:via-blue-700 hover:to-teal-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                      >
                        {homeSearchLoading ? (
                          <>
                            <Loader2 className="mr-2 animate-spin" size={18} />
                            Searching...
                          </>
                        ) : (
                          <>
                            <Search className="mr-2" size={18} />
                            Search
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <SearchSuggestions
                showSuggestions={showSuggestions}
                suggestions={suggestions}
                suggestionsRef={suggestionsRef}
                setQuery={setSearchQuery}
                setShowSuggestions={setShowSuggestions}
                handleSubmit={handleSearch}
                onSubmitValue={(value) => {
                  setSearchQuery(value);
                  setShowSuggestions(false);
                  router.push(`/search?q=${encodeURIComponent(value)}`);
                }}
                isLoading={suggestionsLoading}
              />
            </form>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-background border border-border rounded-lg p-6">
              <div className="text-3xl font-mono text-foreground mb-2">
                {isLoading ? (
                  <div className="h-9 w-32 bg-muted animate-pulse rounded"></div>
                ) : (
                  stats?.blockHeight?.toLocaleString() ?? '0'
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                Blocks Processed
              </div>
            </div>
            <div className="bg-background border border-border rounded-lg p-6">
              <div className="text-3xl font-mono text-foreground mb-2">
                {isLoading ? (
                  <div className="h-9 w-24 bg-muted animate-pulse rounded"></div>
                ) : (
                  stats?.activeValidators?.toLocaleString() ?? '0'
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                Active Validators
              </div>
            </div>
            <div className="bg-background border border-border rounded-lg p-6">
              <div className="text-3xl font-mono text-foreground mb-2">
                {isLoading ? (
                  <div className="h-9 w-20 bg-muted animate-pulse rounded"></div>
                ) : (
                  stats?.tps?.toLocaleString() ?? '0'
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                TPS
              </div>
            </div>
          </div>

          {/* Network Stats */}
          <div className="bg-background border border-border rounded-lg p-6 mb-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="text-sm text-muted-foreground mb-2">Current Epoch</div>
                <div className="text-2xl font-mono text-foreground">
                  {isLoading ? (
                    <div className="h-8 w-16 bg-muted animate-pulse rounded"></div>
                  ) : (
                    stats?.epoch ?? '0'
                  )}
                </div>
                <div className="w-full bg-muted h-1 mt-2 rounded-full overflow-hidden">
                  <div
                    className="bg-primary h-1 transition-all duration-500"
                    style={{ width: `${stats?.epochProgress ?? 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-2">Network Load</div>
                <div className="text-2xl font-mono text-foreground">
                  {isLoading ? (
                    <div className="h-8 w-20 bg-muted animate-pulse rounded"></div>
                  ) : (
                    // Calculate network load based on TPS capacity (theoretical max ~65k TPS)
                    stats?.tps ? `${Math.min(100, ((stats.tps / 65000) * 100)).toFixed(1)}%` : '0%'
                  )}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-2">Block Height</div>
                <div className="text-2xl font-mono text-foreground">
                  {isLoading ? (
                    <div className="h-8 w-32 bg-muted animate-pulse rounded"></div>
                  ) : (
                    stats?.blockHeight?.toLocaleString() ?? '0'
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Network Performance Chart */}
          <div className="bg-background border border-border rounded-lg p-6 mb-12">
            <h2 className="text-xl font-semibold mb-4 text-foreground">Network Performance</h2>
            <div className="h-[300px]">
              <NetworkResponseChart data={networkData} />
            </div>
          </div>

          {/* Recent Activity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-background border border-border rounded-lg p-6">
              <RecentBlocks
                blocks={blocks}
                onBlockSelect={handleBlockSelect}
                isLoading={isLoading}
              />
            </div>
            <div className="bg-background border border-border rounded-lg p-6">
              <TransactionsInBlock block={selectedBlock} isLoading={isLoading && !selectedBlock} />
            </div>
          </div>

          {/* Recent Messages */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <RecentChats isLoading={isLoading} />
          </div>

          {/* AI Assistant Button */}
          <div className="fixed bottom-6 right-6">
            <Button
              className="bg-[#00DC82] text-black hover:bg-[#00DC82]/90 h-12 px-6 rounded-full shadow-lg"
              onClick={openAIChat}
            >
              SVMAI
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
