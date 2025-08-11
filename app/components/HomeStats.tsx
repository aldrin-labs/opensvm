'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { getClientConnection as getConnection } from '@/lib/solana-connection';
import { getRPCLatency } from '@/lib/solana';

// Dynamically import NetworkResponseChart with no SSR
const NetworkResponseChart = dynamic(
  () => import('@/components/NetworkResponseChart'),
  { ssr: false }
);

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

export default function HomeStats() {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [networkData, setNetworkData] = useState<NetworkData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchData() {
      try {
        setIsLoading(true);
        const connection = getConnection();
        const latency = await getRPCLatency();

        if (!mounted) return;

        // Get epoch info and other stats
        const epochInfo = await connection.getEpochInfo();
        const validators = await connection.getVoteAccounts();
        const perfSamples = await connection.getRecentPerformanceSamples(1);

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

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-background border border-border rounded-lg p-6 animate-pulse">
            <div className="h-8 bg-muted rounded w-24 mb-2"></div>
            <div className="h-4 bg-muted rounded w-16"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
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

      <div className="bg-background border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Network Performance</h2>
        <div className="h-[300px]">
          <NetworkResponseChart data={networkData} />
        </div>
      </div>
    </>
  );
}
