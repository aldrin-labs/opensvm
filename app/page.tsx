'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { getConnection, getRPCLatency } from '@/lib/solana';
import { AIChatSidebar } from '@/components/ai/AIChatSidebar';
import { RecentBlocks } from '@/components/RecentBlocks';
import TransactionsInBlock from '@/components/TransactionsInBlock';
import NetworkResponseChart from '@/components/NetworkResponseChart';

// Define the HeroSection component
const HeroSection = () => {
  return (
    <div className="text-center mb-12">
      <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-4">
        OpenSVM Explorer
      </h1>
      <p className="text-xl text-muted-foreground">
        The quieter you become, the more you are able to hear.
      </p>
    </div>
  );
};

// Define the SearchForm component
const SearchForm = ({ 
  searchQuery, 
  setSearchQuery, 
  handleSearch 
}: { 
  searchQuery: string; 
  setSearchQuery: (query: string) => void; 
  handleSearch: (e: React.FormEvent) => void; 
}) => {
  return (
    <div className="max-w-2xl mx-auto mb-16">
      <form onSubmit={handleSearch} className="relative">
        <Input
          type="text"
          placeholder="Search transactions, blocks, programs and tokens..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-12 pl-12 pr-4 bg-muted/50 border-0"
        />
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
        <Button 
          type="submit"
          className="absolute right-2 top-1/2 transform -translate-y-1/2 px-6"
        >
          Search
        </Button>
      </form>
    </div>
  );
};

// Define the StatsDisplay component
const StatsDisplay = ({ stats }: { stats: NetworkStats | null }) => {
  return (
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
  );
};

// Define the NetworkStatsDisplay component
const NetworkStatsDisplay = ({ stats }: { stats: NetworkStats | null }) => {
  return (
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
  );
};


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

  // Define handler functions using useCallback
  const handleOpenAIChat = useCallback(() => {
    setIsAIChatOpen(true);
  }, []);

  const handleCloseAIChat = useCallback(() => {
    setIsAIChatOpen(false);
  }, []);

  const handleSidebarWidthChange = useCallback((width: number) => {
    setSidebarWidth(width);
  }, []);

  const handleResizeStart = useCallback(() => {
    setIsResizing(true);
  }, []);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  // Define mainStyle using useMemo
  const mainStyle = useMemo(() => ({
    width: isAIChatOpen ? `calc(100% - ${sidebarWidth}px)` : '100%',
    transition: !isResizing ? 'all 300ms ease-in-out' : 'none',
    marginRight: isAIChatOpen ? `${sidebarWidth}px` : 0
  }), [isAIChatOpen, sidebarWidth, isResizing]);

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
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
        style={mainStyle}
      >
        <div className="container mx-auto px-4 py-12">
          {/* Hero Section */}
          <HeroSection />

          {/* Search Bar */}
          <SearchForm 
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            handleSearch={handleSearch}
          />

          {/* Stats Grid */}
          <StatsDisplay stats={stats} />

          {/* Network Stats */}
          <NetworkStatsDisplay stats={stats} />

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
                blocks={blocks || []}
                onBlockSelect={handleBlockSelect}
                isLoading={blocksLoading}
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
              onClick={handleOpenAIChat}
            >
              AI Assistant
            </Button>
          </div>
        </div>
      </main>

      {/* AI Chat Sidebar - Only render when open */}
      {isAIChatOpen && (
        <AIChatSidebar 
          isOpen={isAIChatOpen}
          onClose={handleCloseAIChat}
          onWidthChange={handleSidebarWidthChange}
          onResizeStart={handleResizeStart}
          onResizeEnd={handleResizeEnd}
          initialWidth={sidebarWidth}
        />
      )}
    </div>
  );
}