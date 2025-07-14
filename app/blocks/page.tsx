'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import BlockExploreTable from '@/components/BlockExploreTable';
import { Button } from '@/components/ui/button';
import { getRecentBlocks, getBlockStats, type BlockListResponse } from '@/lib/block-data';
import { BlockDetails } from '@/lib/solana';
import { formatLargeNumber } from '@/utils/format';

export default function BlocksPage() {
  const router = useRouter();
  const [blocks, setBlocks] = useState<BlockDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<number | undefined>();
  const [stats, setStats] = useState({
    currentSlot: 0,
    avgBlockTime: 0,
    recentTPS: 0,
    totalTransactions: 0
  });

  // Auto-refresh data every 30 seconds for real-time updates
  useEffect(() => {
    const loadBlocks = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Load blocks and stats in parallel
        const [blocksResponse, blockStats] = await Promise.all([
          getRecentBlocks(50),
          getBlockStats()
        ]);
        
        setBlocks(blocksResponse.blocks);
        setHasMore(blocksResponse.hasMore);
        setCursor(blocksResponse.cursor);
        setStats(blockStats);
      } catch (err) {
        console.error('Error loading blocks:', err);
        setError('Failed to load block data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadBlocks();

    // Set up auto-refresh
    const interval = setInterval(loadBlocks, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const handleBlockClick = (slot: number) => {
    router.push(`/block/${slot}`);
  };

  const loadMore = async () => {
    if (!hasMore || isLoading || !cursor) return;

    try {
      setIsLoading(true);
      const response: BlockListResponse = await getRecentBlocks(50, cursor - 1);
      setBlocks(prev => [...prev, ...response.blocks]);
      setHasMore(response.hasMore);
      setCursor(response.cursor);
    } catch (err) {
      console.error('Error loading more blocks:', err);
      setError('Failed to load more blocks. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Recent Blocks</h1>
        <p className="text-muted-foreground">
          View latest blocks and transactions on the Solana network. Data updates every 30 seconds.
        </p>
      </div>

      {/* Block Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-background border border-border rounded-lg p-6">
          <div className="text-sm text-muted-foreground">Current Slot</div>
          <div className="text-2xl font-bold text-foreground">
            {formatLargeNumber(stats.currentSlot)}
          </div>
        </div>
        <div className="bg-background border border-border rounded-lg p-6">
          <div className="text-sm text-muted-foreground">Avg Block Time</div>
          <div className="text-2xl font-bold text-foreground">
            {stats.avgBlockTime.toFixed(2)}s
          </div>
        </div>
        <div className="bg-background border border-border rounded-lg p-6">
          <div className="text-sm text-muted-foreground">Recent TPS</div>
          <div className="text-2xl font-bold text-foreground">
            {formatLargeNumber(Math.round(stats.recentTPS))}
          </div>
        </div>
        <div className="bg-background border border-border rounded-lg p-6">
          <div className="text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              Live Status
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            </div>
          </div>
          <div className="text-2xl font-bold text-green-600">Active</div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-destructive">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        <BlockExploreTable
          blocks={blocks}
          onBlockClick={handleBlockClick}
          isLoading={isLoading && blocks.length === 0}
        />

        {hasMore && !isLoading && (
          <div className="flex justify-center">
            <Button onClick={loadMore} variant="outline">
              Load More Blocks
            </Button>
          </div>
        )}

        {isLoading && blocks.length > 0 && (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="ml-2 text-muted-foreground">Loading more blocks...</span>
          </div>
        )}
      </div>

      <div className="mt-8 text-sm text-muted-foreground">
        <p>
          Block data is fetched directly from the Solana RPC and updated in real-time. 
          Click on any block to view detailed information including transactions and program activity.
        </p>
      </div>
    </div>
  );
}
