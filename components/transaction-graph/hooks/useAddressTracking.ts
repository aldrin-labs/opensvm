'use client';

import { useState, useCallback, useRef } from 'react';

export interface TrackingStats {
  totalTransactions: number;
  splTransfers: number;
  filteredSplTransfers: number;
  topVolumeByAddress: Array<{
    address: string;
    volume: number;
    tokenSymbol: string;
  }>;
  topVolumeByToken: Array<{
    token: string;
    volume: number;
    transactionCount: number;
  }>;
  lastUpdate: number;
  isTracking: boolean;
  trackedAddress: string | null;
}

export function useAddressTracking() {
  const [trackedAddress, setTrackedAddress] = useState<string | null>(null);
  const [isTrackingMode, setIsTrackingMode] = useState<boolean>(false);
  const [trackingStats, setTrackingStats] = useState<TrackingStats | null>(null);
  const trackingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const trackedTransactionsRef = useRef<Set<string>>(new Set());
  const MAX_TRACKED_TRANSACTIONS = 50; // Reduced from 100 to 50 for better performance

  // Address tracking functionality
  const startTrackingAddress = useCallback((address: string) => {
    console.log('Starting to track address:', address);
    setTrackedAddress(address);
    setIsTrackingMode(true);
    trackedTransactionsRef.current.clear();

    // Initialize stats
    setTrackingStats({
      totalTransactions: 0,
      splTransfers: 0,
      filteredSplTransfers: 0,
      topVolumeByAddress: [],
      topVolumeByToken: [],
      lastUpdate: Date.now(),
      isTracking: true,
      trackedAddress: address
    });

    // Clear existing interval
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
    }

    // Start tracking interval
    trackingIntervalRef.current = setInterval(() => {
      console.log(`Tracking status for ${address}: ${trackedTransactionsRef.current.size} transactions`);
    }, 5000);
  }, []);

  const stopTrackingAddress = useCallback(() => {
    console.log('Stopping address tracking');
    setTrackedAddress(null);
    setIsTrackingMode(false);
    setTrackingStats(null);
    trackedTransactionsRef.current.clear();

    // Clear interval
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
    }
  }, []);

  const updateTrackingStats = useCallback((newStats: Partial<TrackingStats>) => {
    setTrackingStats(prev => prev ? { ...prev, ...newStats, lastUpdate: Date.now() } : null);
  }, []);

  return {
    trackedAddress,
    isTrackingMode,
    trackingStats,
    trackedTransactionsRef,
    MAX_TRACKED_TRANSACTIONS,
    startTrackingAddress,
    stopTrackingAddress,
    updateTrackingStats,
    trackingIntervalRef
  };
}