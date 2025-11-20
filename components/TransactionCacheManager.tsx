/**
 * Transaction Cache Manager Component
 * 
 * This component provides cache management functionality for transaction analysis data.
 * It integrates with the transaction analysis cache to provide performance optimizations.
 */

'use client';

import { useEffect } from 'react';
import { transactionCache } from '@/lib/caching/transaction-cache';

interface TransactionCacheManagerProps {
  signature?: string;
  onCacheHit?: (type: string) => void;
  onCacheMiss?: () => void;
}

export function TransactionCacheManager({ 
  signature, 
  onCacheHit, 
  onCacheMiss 
}: TransactionCacheManagerProps) {
  useEffect(() => {
    if (!signature) return;

    const cacheResult = transactionCache.get(signature);
    if (cacheResult) {
      onCacheHit?.(cacheResult.type);
    } else {
      onCacheMiss?.();
    }
  }, [signature, onCacheHit, onCacheMiss]);

  return null;
}