'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import BlockExploreTable from '@/components/BlockExploreTable';
import { Button } from '@/components/ui/button';
import { getRecentBlocks, getBlockStats, type BlockListResponse } from '@/lib/block-data';
import { BlockDetails } from '@/lib/solana/solana';
import { formatLargeNumber } from '@/utils/format';
import { useSSEStream, type BlockchainEvent } from '@/lib/hooks/useSSEStream';

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

  // Use SSE for real-time block updates
  const { isConnected, error: streamError, connectionStatus } = useSSEStream({
    autoConnect: true,
    eventTypes: ['block', 'transaction'],
    maxEvents: 1000,
    onEvent: useCallback((event: BlockchainEvent) => {
      console.log('Received blockchain event:', event);

      if (event.type === 'block') {
        // Add new block to the beginning of the list
        const blockData = event.data;
        if (blockData && typeof blockData.slot === 'number') {
          const newBlock: BlockDetails = {
            slot: blockData.slot,
            blockhash: blockData.blockhash || '',
            previousBlockhash: blockData.previousBlockhash || '',
            parentSlot: blockData.parentSlot || 0,
            blockTime: blockData.blockTime || null,
            timestamp: blockData.timestamp || blockData.blockTime || Math.floor(Date.now() / 1000),
            transactionCount: blockData.transactions?.length || blockData.transactionCount || 0,
            transactions: blockData.transactions || [],
            successCount: 0, // Will be calculated from transactions
            failureCount: 0, // Will be calculated from transactions
            totalSolVolume: 0, // Will be calculated from transactions
            totalFees: 0, // Will be calculated from transactions
            rewards: blockData.rewards || [],
            programs: blockData.programs || [],
            tokenTransfers: blockData.tokenTransfers || []
          };

          setBlocks(prev => {
            // Avoid duplicates and keep most recent blocks
            const filtered = prev.filter(b => b.slot !== newBlock.slot);
            return [newBlock, ...filtered].slice(0, 100); // Keep max 100 blocks
          });

          // Update current slot in stats
          setStats(prev => ({
            ...prev,
            currentSlot: Math.max(prev.currentSlot, newBlock.slot)
          }));
        }
      }
    }, [])
  });

  // Initial data loading
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Load initial blocks and stats
        const [blocksResponse, blockStats] = await Promise.all([
          getRecentBlocks(50),
          getBlockStats()
        ]);

        setBlocks(blocksResponse.blocks);
        setHasMore(blocksResponse.hasMore);
        setCursor(blocksResponse.cursor);
        setStats(blockStats);
      } catch (err) {
        console.error('Error loading initial blocks:', err);
        setError('Failed to load block data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Update stats periodically (less frequently since we have real-time updates)
  useEffect(() => {
    const updateStats = async () => {
      try {
        const blockStats = await getBlockStats();
        setStats(prev => ({
          ...blockStats,
          // Preserve current slot if it's higher (from real-time updates)
          currentSlot: Math.max(prev.currentSlot, blockStats.currentSlot)
        }));
      } catch (err) {
        console.warn('Failed to update stats:', err);
      }
    };

    // Update stats every 60 seconds (less frequent than before)
    const interval = setInterval(updateStats, 60000);
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
          View latest blocks and transactions on the Solana network with real-time streaming updates.
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
              <div className={`w-2 h-2 rounded-full ${isConnected
                  ? 'bg-green-500 animate-pulse'
                  : connectionStatus === 'connecting'
                    ? 'bg-yellow-500 animate-pulse'
                    : 'bg-red-500'
                }`}></div>
            </div>
          </div>
          <div className={`text-2xl font-bold ${isConnected
              ? 'text-green-600'
              : connectionStatus === 'connecting'
                ? 'text-yellow-600'
                : 'text-red-600'
            }`}>
            {isConnected ? 'Live' : connectionStatus === 'connecting' ? 'Connecting' : 'Offline'}
          </div>
          {streamError && (
            <div className="text-xs text-red-500 mt-1">
              {streamError}
            </div>
          )}
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
          Block data is streamed in real-time from the Solana RPC via Server-Sent Events (SSE).
          New blocks appear automatically as they are confirmed on the network.
          Click on any block to view detailed information including transactions and program activity.
        </p>
      </div>
    </div>
  );
}
