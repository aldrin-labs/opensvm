'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  AlertTriangle,
  Clock,
  TrendingUp,
  TrendingDown,
  Play,
  Pause,
  RotateCcw,
  Activity,
  Blocks,
  Timer,
  Zap
} from 'lucide-react';

interface SlotInfo {
  slot: number;
  blockTime: number | null;
  blockHeight: number;
  parentSlot: number;
  transactionCount: number;
  leader: string;
  skipRate: number;
  producedBy?: string;
  timestamp: number;
}

interface SlotMetrics {
  averageBlockTime: number;
  skippedSlots: number;
  totalSlots: number;
  skipRate: number;
  slotsPerSecond: number;
  epochProgress: number;
}

interface SlotsData {
  slots: SlotInfo[];
  currentSlot: number;
  epochInfo: {
    epoch: number;
    slotIndex: number;
    slotsInEpoch: number;
    absoluteSlot: number;
    blockHeight: number;
    transactionCount: number;
  };
  metrics: SlotMetrics;
  pagination: {
    limit: number;
    fromSlot: number;
    hasMore: boolean;
    nextCursor: number | null;
  };
}

export default function SlotsPage() {
  const router = useRouter();
  const [data, setData] = useState<SlotsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  // Format functions
  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const formatPercent = (num: number) => {
    return `${num.toFixed(2)}%`;
  };

  // Fetch slots data
  const fetchSlotsData = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/slots?limit=50');

      if (!response.ok) {
        throw new Error('Failed to fetch slots data');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch slots data');
      }

      setData(result.data);
    } catch (err) {
      console.error('Error fetching slots:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch slots data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle auto-refresh
  useEffect(() => {
    fetchSlotsData();

    if (autoRefresh) {
      const intervalId = setInterval(fetchSlotsData, 5000); // Refresh every 5 seconds
      return () => clearInterval(intervalId);
    }
  }, [autoRefresh, fetchSlotsData]);

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };

  const handleSlotClick = (slot: number) => {
    router.push(`/block/${slot}`);
  };

  // Pagination
  const totalSlots = data?.slots.length || 0;
  const totalPages = Math.ceil(totalSlots / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSlots = data?.slots.slice(startIndex, startIndex + itemsPerPage) || [];

  if (loading && !data) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading slots...</span>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-lg font-semibold mb-2">Error Loading Slots</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={fetchSlotsData}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">Slots Explorer</h1>
            <p className="text-muted-foreground">
              Monitor Solana slots, block production, and network performance in real-time.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleAutoRefresh}
              className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${autoRefresh
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
            >
              {autoRefresh ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            </button>

            <button
              onClick={fetchSlotsData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-destructive font-medium">Error: {error}</span>
            </div>
          </div>
        )}
      </div>

      {data && (
        <>
          {/* Network Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-8">
            <div className="bg-background border rounded-lg p-6 shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Current Slot</p>
                  <p className="text-2xl font-bold">{formatNumber(data.currentSlot)}</p>
                </div>
                <Activity className="h-8 w-8 text-primary" />
              </div>
            </div>

            <div className="bg-background border rounded-lg p-6 shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Current Epoch</p>
                  <p className="text-2xl font-bold">{data.epochInfo.epoch}</p>
                  <p className="text-xs text-muted-foreground">{formatPercent(data.metrics.epochProgress)} complete</p>
                </div>
                <Timer className="h-8 w-8 text-primary" />
              </div>
            </div>

            <div className="bg-background border rounded-lg p-6 shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avg Block Time</p>
                  <p className="text-2xl font-bold">{data.metrics.averageBlockTime.toFixed(2)}s</p>
                </div>
                <Clock className="h-8 w-8 text-primary" />
              </div>
            </div>

            <div className="bg-background border rounded-lg p-6 shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Slots/Second</p>
                  <p className="text-2xl font-bold">{data.metrics.slotsPerSecond.toFixed(1)}</p>
                </div>
                <Zap className="h-8 w-8 text-primary" />
              </div>
            </div>

            <div className="bg-background border rounded-lg p-6 shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Skip Rate</p>
                  <p className="text-2xl font-bold">{formatPercent(data.metrics.skipRate)}</p>
                  <p className="text-xs text-muted-foreground">{data.metrics.skippedSlots} skipped</p>
                </div>
                <div className="flex items-center">
                  {data.metrics.skipRate > 5 ? (
                    <TrendingUp className="h-8 w-8 text-destructive" />
                  ) : (
                    <TrendingDown className="h-8 w-8 text-green-500" />
                  )}
                </div>
              </div>
            </div>

            <div className="bg-background border rounded-lg p-6 shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Block Height</p>
                  <p className="text-2xl font-bold">{formatNumber(data.epochInfo.blockHeight)}</p>
                </div>
                <Blocks className="h-8 w-8 text-primary" />
              </div>
            </div>
          </div>

          {/* Slots Table */}
          <div className="bg-background border rounded-lg shadow">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold">Recent Slots</h3>
              <p className="text-sm text-muted-foreground">
                Showing {paginatedSlots.length} of {totalSlots} slots
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 font-medium">Slot</th>
                    <th className="text-left p-4 font-medium">Status</th>
                    <th className="text-left p-4 font-medium">Timestamp</th>
                    <th className="text-left p-4 font-medium">Transactions</th>
                    <th className="text-left p-4 font-medium">Leader</th>
                    <th className="text-left p-4 font-medium">Parent Slot</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSlots.map((slot) => (
                    <tr
                      key={slot.slot}
                      className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => handleSlotClick(slot.slot)}
                    >
                      <td className="p-4">
                        <div className="font-mono font-medium text-primary">
                          {formatNumber(slot.slot)}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {slot.skipRate === 0 ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              ✓ Confirmed
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                              ⚠ Skipped
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-muted-foreground">
                          {slot.blockTime
                            ? formatTimeAgo(slot.blockTime * 1000)
                            : 'N/A'
                          }
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium">
                          {formatNumber(slot.transactionCount)}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-mono text-sm">
                          {slot.leader === 'Unknown' || slot.leader === 'Skipped'
                            ? slot.leader
                            : `${slot.leader.slice(0, 8)}...`
                          }
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-mono text-sm text-muted-foreground">
                          {formatNumber(slot.parentSlot)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-6 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 bg-primary text-primary-foreground rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 bg-primary text-primary-foreground rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
