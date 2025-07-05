"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { NetworkTPSChart } from './NetworkTPSChart';
import NetworkResponseChart from './NetworkResponseChart';
import { getNetworkStats, getRPCLatency } from '@/lib/solana';

interface ChartData {
  timestamp: number;
  tps: number;
  blockTime: number;
  successRate: number;
  latency: number;
}

interface NetworkChartsProps {
  networkId: string;
  isLive?: boolean;
}

const MAX_DATA_POINTS = 30; // Keep last 5 minutes of data (30 points at 10s intervals)

// Memoize initial data creation
const createInitialData = (): ChartData[] => {
  const now = Date.now();
  return Array.from({ length: 5 }, (_, i) => ({
    timestamp: now - (4 - i) * 10000, // Last 5 points, 10 seconds apart
    tps: 0,
    blockTime: 400, // Default Solana block time in ms
    successRate: 100,
    latency: 0
  }));
};

const NetworkChartsComponent = function({ networkId, isLive = false }: NetworkChartsProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>(() => createInitialData());

  // Memoize data processing to avoid unnecessary re-computations
  const { tpsData, responseData } = useMemo(() => {
    const tpsData = chartData.map(d => ({
      timestamp: d.timestamp,
      tps: d.tps
    }));

    const responseData = chartData.map(d => ({
      timestamp: d.timestamp,
      blockTime: d.blockTime,
      successRate: d.successRate,
      latency: d.latency
    }));

    return { tpsData, responseData };
  }, [chartData]);

  // Memoize data fetching function to prevent recreation
  const fetchData = useCallback(async () => {
    try {
      const [stats, latency] = await Promise.all([
        getNetworkStats(),
        getRPCLatency()
      ]);

      if (!stats) {
        throw new Error('Failed to fetch network stats');
      }

      const newDataPoint = {
        timestamp: Date.now(),
        tps: Math.max(0, stats.tps || 0),
        blockTime: stats.tps > 0 ? 1000 / stats.tps : 400, // Convert to ms, default to 400ms
        successRate: Math.min(100, Math.max(0, stats.successRate || 100)), // Clamp between 0-100
        latency: Math.max(0, latency || 0)
      };

      setChartData(prevData => {
        const newData = [...prevData, newDataPoint];
        return newData.slice(-MAX_DATA_POINTS);
      });
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Error fetching network data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch network data');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let interval: NodeJS.Timeout;

    const runFetch = async () => {
      if (mounted) {
        await fetchData();
      }
    };

    // Initial fetch
    runFetch();

    // Set up polling if live
    if (isLive) {
      interval = setInterval(() => {
        if (mounted) {
          fetchData();
        }
      }, 13000); // 13 seconds refresh interval to avoid race conditions with cache and provide smooth data updates
    }

    return () => {
      mounted = false;
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [networkId, isLive, fetchData]);

  // Loading state with skeleton animation
  if (loading && chartData.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        <Card className="p-4 h-[300px] animate-pulse bg-gray-100 dark:bg-gray-800" />
        <Card className="p-4 h-[300px] animate-pulse bg-gray-100 dark:bg-gray-800" />
      </div>
    );
  }

  // Error state
  if (error && chartData.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        <Card className="p-4">
          <div className="text-red-500">Error loading network data: {error}</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
      <Card className="p-4">
        <NetworkTPSChart data={tpsData} />
      </Card>
      <Card className="p-4">
        <NetworkResponseChart data={responseData} />
      </Card>
    </div>
  );
};

// Export memoized component for performance
export const NetworkCharts = React.memo(NetworkChartsComponent);
