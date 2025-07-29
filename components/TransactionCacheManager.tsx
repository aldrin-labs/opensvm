/**
 * Transaction Cache Manager Component
 * 
 * This component provides cache management functionality for transaction analysis data.
 * It integrates with the transaction analysis cache to provide performance optimizations.
 */

'use client';

import React, { useEffect, useCallback } from 'react';
import { transactionAnalysisCache } from '@/lib/transaction-analysis-cache';


const TransactionCacheManager: React.FC<TransactionCacheManagerProps> = ({ signature, onCacheHit, onCacheMiss }) => {
    useEffect(() => {
        if (!signature) return;

        const cacheResult = transactionAnalysisCache.get(signature);
        if (cacheResult) {
            onCacheHit?.(cacheResult.type);
        } else {
            onCacheMiss?.(signature);
        }
    }, [signature, onCacheHit, onCacheMiss]);

    return null;
};

interface TransactionCacheManagerProps {
    signature?: string;
    onCacheHit?: (type: string) => void;
    onCacheMiss?: (key: string) => void;
}