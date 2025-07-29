import { useState, useEffect } from 'react';
import type { Transfer } from './types';

interface ApiTransfer {
  txId: string;
  date: string;
  from: string;
  to: string;
  tokenSymbol: string;
  tokenAmount: string;
  usdValue: string;
  currentUsdValue: string;
  transferType: string;
}

interface TransferResponse {
  data: ApiTransfer[];
  hasMore: boolean;
  total?: number;
  error?: string;
}

interface UseTransfersResult {
  transfers: Transfer[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  totalCount?: number;
}

const CACHE_PREFIX = 'transfers-cache';
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  transfers: Transfer[];
  timestamp: number;
  hasMore: boolean;
  cursor: string | null;
}

function getCacheKey(address: string): string {
  return `${CACHE_PREFIX}-${address}`;
}

function getFromCache(address: string): CacheEntry | null {
  if (typeof window === 'undefined') return null;

  try {
    const cacheKey = getCacheKey(address);
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;

    const entry: CacheEntry = JSON.parse(cached);
    const now = Date.now();

    if (now - entry.timestamp > CACHE_EXPIRY) {
      localStorage.removeItem(cacheKey);
      return null;
    }

    return entry;
  } catch (err) {
    console.error('Error reading from cache:', err);
    return null;
  }
}

function saveToCache(address: string, transfers: Transfer[], hasMore: boolean, cursor: string | null): void {
  if (typeof window === 'undefined') return;

  try {
    const cacheKey = getCacheKey(address);
    const entry: CacheEntry = {
      transfers,
      hasMore,
      cursor,
      timestamp: Date.now()
    };
    localStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch (err) {
    console.error('Error saving to cache:', err);
  }
}

export function useTransfers(address: string): UseTransfersResult {
  const cachedData = getFromCache(address);
  const [transfers, setTransfers] = useState<Transfer[]>(cachedData?.transfers || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(cachedData?.hasMore ?? true);
  const [cursor, setCursor] = useState<string | null>(cachedData?.cursor ?? null);
  const [totalCount, setTotalCount] = useState<number>();

  const fetchTransfers = async () => {
    if (loading || !hasMore) return;

    const controller = new AbortController();

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('limit', '1000');
      if (cursor) params.set('beforeSignature', cursor);

      const response = await fetch(`/api/account-transfers/${encodeURIComponent(address)}?${params.toString()}`, {
        signal: controller.signal
      });

      const result: TransferResponse & { nextPageSignature?: string } = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch transfers');
      }

      if (!Array.isArray(result.data)) {
        throw new Error('Invalid response format');
      }

      if (result.data.length === 0) {
        setHasMore(false);
        saveToCache(address, transfers, false, cursor);
        return;
      }

      const mapped = result.data.map(item => ({
        signature: item.txId,
        timestamp: item.date,
        type: item.transferType.toLowerCase(),
        amount: parseFloat(item.tokenAmount),
        token: item.tokenSymbol,
        tokenSymbol: item.tokenSymbol,
        from: item.from,
        to: item.to,
      }));

      const newTransfers = [...transfers, ...mapped];
      setTransfers(newTransfers);
      setCursor(result.nextPageSignature || null);
      setHasMore(result.hasMore);
      if (result.total) setTotalCount(result.total);
      saveToCache(address, newTransfers, result.hasMore, result.nextPageSignature || null);

    } catch (err) {
      if ((err as any)?.name === 'AbortError') return;
      console.error(err);
      setError((err as Error).message || 'Failed to fetch transfers');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchTransfers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const loadMore = () => {
    if (!loading && hasMore) fetchTransfers();
  };

  return {
    transfers,
    loading,
    error,
    hasMore,
    loadMore,
    totalCount
  };
}
