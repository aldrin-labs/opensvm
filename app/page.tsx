'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { getConnection, getRPCLatency } from '@/lib/solana';
import { AIChatSidebar } from '@/components/ai/AIChatSidebar';
import { RecentBlocks } from '@/components/RecentBlocks';
import TransactionsInBlock from '@/components/TransactionsInBlock';
import NetworkResponseChart from '@/components/NetworkResponseChart';
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
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const [networkData, setNetworkData] = useState<NetworkData[]>([]);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchData() {
      try {
        setIsLoading(true);
        const connection = await getConnection();
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

  // Fetch suggestions function
  const fetchSuggestions = async (query: string) => {
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
  };

  // Debounced version of fetchSuggestions
  const debouncedFetchSuggestions = debounce(fetchSuggestions, 300);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    setShowSuggestions(false);
    router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    debouncedFetchSuggestions(value);
  };

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
      const connection = await getConnection();
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
    <div className="relative">
      <main 
        className="min-h-screen bg-background"
        style={{ 
          width: isAIChatOpen ? `calc(100% - ${sidebarWidth}px)` : '100%',
          transition: !isResizing ? 'all 300ms ease-in-out' : 'none',
          marginRight: isAIChatOpen ? `${sidebarWidth}px` : 0
        }}
      >
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
          <div className="max-w-2xl mx-auto mb-16">
            <form onSubmit={handleSearch} className="relative">
              <Input
                type="text"
                placeholder="Search transactions, blocks, programs and tokens..."
                value={searchQuery}
                onChange={handleInputChange}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                className="w-full h-12 pl-12 pr-4 bg-muted/50 border-0"
              />
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
              <Button
                type="submit"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 px-6"
              >
                Search
              </Button>
              
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
                {stats?.blockHeight?.toLocaleString() ?? '...'}
              </div>
              <div className="text-sm text-muted-foreground">
                Blocks Processed
              </div>
            </div>
            <div className="bg-background border border-border rounded-lg p-6">
              <div className="text-3xl font-mono text-foreground mb-2">
                {stats?.activeValidators?.toLocaleString() ?? '...'}
              </div>
              <div className="text-sm text-muted-foreground">
                Active Validators
              </div>
            </div>
            <div className="bg-background border border-border rounded-lg p-6">
              <div className="text-3xl font-mono text-foreground mb-2">
                {stats?.tps?.toLocaleString() ?? '...'}
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
                <div className="text-2xl font-mono text-foreground">{stats?.epoch ?? '...'}</div>
                <div className="w-full bg-muted h-1 mt-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-primary h-1" 
                    style={{ width: `${stats?.epochProgress ?? 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-2">Network Load</div>
                <div className="text-2xl font-mono text-foreground">
                  {stats?.epochProgress?.toFixed(2) ?? '0'}%
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-2">Block Height</div>
                <div className="text-2xl font-mono text-foreground">
                  {stats?.blockHeight?.toLocaleString() ?? '...'}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-background border border-border rounded-lg p-6">
              <RecentBlocks 
                blocks={blocks}
                onBlockSelect={handleBlockSelect}
                isLoading={isLoading}
              />
            </div>
            <div className="bg-background border border-border rounded-lg p-6">
              <TransactionsInBlock block={selectedBlock} />
            </div>
          </div>

          {/* AI Assistant Button */}
          <div className="fixed bottom-6 right-6">
            <Button
              className="bg-[#00DC82] text-black hover:bg-[#00DC82]/90 h-12 px-6 rounded-full shadow-lg"
              onClick={() => setIsAIChatOpen(true)}
            >
              AI Assistant
            </Button>
          </div>
        </div>
      </main>

      {/* AI Chat Sidebar */}
      <AIChatSidebar 
        isOpen={isAIChatOpen}
        onClose={() => setIsAIChatOpen(false)}
        onWidthChange={setSidebarWidth}
        onResizeStart={() => setIsResizing(true)}
        onResizeEnd={() => setIsResizing(false)}
        initialWidth={sidebarWidth}
      />
    </div>
  );
}
