'use client';

import { useCallback, useRef, useState } from 'react';

export interface TransactionTooltipData {
    type?: string;
    amount?: number;
    tokenSymbol?: string;
    tokenMint?: string;
    programName?: string;
    isFunding?: boolean;
    timestamp?: number;
    fee?: number;
}

export interface UseEdgeHoverReturn {
    hoveredSignature: string | null;
    position: { x: number; y: number } | null;
    data: TransactionTooltipData | null;
    isLoading: boolean;
    show: (signature: string, position: { x: number; y: number }) => void;
    hide: () => void;
}

const cache = new Map<string, { data: TransactionTooltipData; ts: number }>();
const TTL = 30_000; // 30s

export function useEdgeHover(): UseEdgeHoverReturn {
    const [hoveredSignature, setHoveredSignature] = useState<string | null>(null);
    const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
    const [data, setData] = useState<TransactionTooltipData | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const abortRef = useRef<AbortController | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const show = useCallback((signature: string, pos: { x: number; y: number }) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            // cache
            const now = Date.now();
            const cached = cache.get(signature);
            if (cached && now - cached.ts < TTL) {
                setHoveredSignature(signature);
                setPosition(pos);
                setData(cached.data);
                setIsLoading(false);
                return;
            }

            if (abortRef.current) abortRef.current.abort();
            abortRef.current = new AbortController();
            setHoveredSignature(signature);
            setPosition(pos);
            setIsLoading(true);
            setData(null);
            try {
                const res = await fetch(`/api/transaction/${signature}`, {
                    headers: { 'Cache-Control': 'no-cache' },
                    signal: abortRef.current.signal
                });
                if (res.ok) {
                    const body = await res.json();
                    const tooltip: TransactionTooltipData = {
                        type: body?.classification?.type || body?.type,
                        amount: body?.amount,
                        tokenMint: body?.tokenMint,
                        tokenSymbol: body?.tokenSymbol,
                        isFunding: body?.isFunding,
                        timestamp: body?.blockTime,
                        fee: body?.fee
                    };
                    cache.set(signature, { data: tooltip, ts: now });
                    setData(tooltip);
                }
            } catch (_) {
                // ignore
            } finally {
                setIsLoading(false);
            }
        }, 120);
    }, []);

    const hide = useCallback(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
            debounceRef.current = null;
        }
        if (abortRef.current) {
            abortRef.current.abort();
            abortRef.current = null;
        }
        setHoveredSignature(null);
        setPosition(null);
        setData(null);
        setIsLoading(false);
    }, []);

    return { hoveredSignature, position, data, isLoading, show, hide };
}


