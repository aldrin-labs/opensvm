'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { SecurityUtils } from '../SecurityUtils';
import { MemoryManager } from '../MemoryManager';

export interface AccountTooltipData {
    solBalance: number;
    tokenBalances: Array<{ mint: string; symbol?: string; balance: number }>;
    transactionCounts?: { totalIn: number; totalOut: number };
    topRecipients?: Array<{ address: string; amount: number; symbol?: string }>;
    accountType?: 'wallet' | 'program' | 'token_account' | 'system';
}

export interface UseAccountHoverReturn {
    hoveredAccount: string | null;
    tooltipPosition: { x: number; y: number } | null;
    tooltipData: AccountTooltipData | null;
    isLoading: boolean;
    error: string | null;
    showTooltip: (address: string, position: { x: number; y: number }) => void;
    hideTooltip: () => void;
}

export function useAccountHover(): UseAccountHoverReturn {
    const [hoveredAccount, setHoveredAccount] = useState<string | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
    const [tooltipData, setTooltipData] = useState<AccountTooltipData | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const requestCountRef = useRef<number>(0);
    const memoryManager = useRef<MemoryManager | null>(null);

    // Initialize memory manager
    useEffect(() => {
        memoryManager.current = MemoryManager.getInstance();
    }, []);

    const handleTooltipRequest = useCallback(async (address: string, position: { x: number; y: number }) => {
        try {
            // Cancel any in-flight requests to prevent race conditions
            if (abortRef.current) {
                abortRef.current.abort();
            }
            abortRef.current = new AbortController();

            setHoveredAccount(address);
            setTooltipPosition(position);
            setIsLoading(true);
            setTooltipData(null);
            requestCountRef.current += 1;

            // 🔒 SECURITY: Timeout protection (prevent hanging requests)
            const timeoutId = setTimeout(() => {
                if (abortRef.current) {
                    abortRef.current.abort();
                }
            }, 10000); // 10 second timeout

            try {
                const res = await fetch(`/api/account-stats/${encodeURIComponent(address)}`, {
                    method: 'GET',
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Content-Type': 'application/json'
                    },
                    signal: abortRef.current.signal
                });

                clearTimeout(timeoutId);

                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                }

                const data = await res.json();

                // 🔒 SECURITY: Validate response data structure
                if (!data || typeof data !== 'object') {
                    throw new Error('Invalid response format');
                }

                // 📊 BUSINESS LOGIC: Sanitize and validate response data
                const sanitizedTooltipData: AccountTooltipData = {
                    solBalance: typeof data.solBalance === 'number' ? Math.max(0, data.solBalance) : 0,
                    tokenBalances: Array.isArray(data.topTokens) ?
                        data.topTokens.slice(0, 10).map((token: any) => ({
                            mint: SecurityUtils.sanitizeText(token?.mint || ''),
                            symbol: token?.symbol ? SecurityUtils.sanitizeText(token.symbol) : undefined,
                            balance: typeof token?.balance === 'number' ? Math.max(0, token.balance) : 0
                        })) : [],
                    transactionCounts: data.transactionCounts && typeof data.transactionCounts === 'object' ? {
                        totalIn: typeof data.transactionCounts.totalIn === 'number' ? Math.max(0, data.transactionCounts.totalIn) : 0,
                        totalOut: typeof data.transactionCounts.totalOut === 'number' ? Math.max(0, data.transactionCounts.totalOut) : 0
                    } : undefined,
                    topRecipients: Array.isArray(data.topRecipients) ?
                        data.topRecipients.slice(0, 5).map((recipient: any) => ({
                            address: SecurityUtils.sanitizeText(recipient?.address || ''),
                            amount: typeof recipient?.amount === 'number' ? Math.max(0, recipient.amount) : 0,
                            symbol: recipient?.symbol ? SecurityUtils.sanitizeText(recipient.symbol) : undefined
                        })) : undefined,
                    accountType: ['wallet', 'program', 'token_account', 'system'].includes(data.accountType) ?
                        data.accountType : 'wallet'
                };

                setTooltipData(sanitizedTooltipData);

            } catch (fetchError) {
                clearTimeout(timeoutId);

                if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                    // Request was cancelled, this is expected
                    return;
                }

                console.error('Failed to fetch account data:', fetchError);
                setError(fetchError instanceof Error ? fetchError.message : 'Failed to load account data');
            }

        } catch (error) {
            console.error('Error in tooltip request handler:', error);
            setError(error instanceof Error ? error.message : 'Unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const showTooltip = useCallback((address: string, position: { x: number; y: number }) => {
        try {
            // 🔒 SECURITY: Validate and sanitize address input
            const sanitizedAddress = SecurityUtils.validateSolanaAddress(address);

            // 🔒 SECURITY: Rate limiting check
            if (!SecurityUtils.checkRateLimit(`tooltip_${sanitizedAddress}`, 10, 60000)) { // 10 requests per minute
                setError('Rate limit exceeded. Please wait before hovering again.');
                return;
            }

            // 📊 PERFORMANCE: Prevent excessive requests
            if (requestCountRef.current > 50) {
                setError('Too many requests. Please refresh the page.');
                return;
            }

            // Clear previous error
            setError(null);

            // Debounce to prevent spamming network calls with exponential backoff
            if (debounceRef.current) {
                if (memoryManager.current) {
                    memoryManager.current.unregisterResource(`debounce_${Date.now()}`);
                }
                clearTimeout(debounceRef.current);
            }

            const debounceDelay = Math.min(120 + (requestCountRef.current * 10), 1000); // Progressive delay

            if (memoryManager.current) {
                const timeoutId = memoryManager.current.safeSetTimeout(async () => {
                    await handleTooltipRequest(sanitizedAddress, position);
                }, debounceDelay, `Account hover debounce for ${sanitizedAddress}`);
                debounceRef.current = timeoutId as any;
            } else {
                debounceRef.current = setTimeout(async () => {
                    await handleTooltipRequest(sanitizedAddress, position);
                }, debounceDelay);
            }

        } catch (validationError) {
            setError(validationError instanceof Error ? validationError.message : 'Invalid address format');
            console.error('Address validation failed:', validationError);
        }
    }, [handleTooltipRequest]);

    const hideTooltip = useCallback(() => {
        try {
            // 📊 PERFORMANCE: Proper cleanup to prevent memory leaks
            if (debounceRef.current) {
                if (memoryManager.current) {
                    memoryManager.current.unregisterResource(`debounce_${Date.now()}`);
                }
                clearTimeout(debounceRef.current);
                debounceRef.current = null;
            }

            if (abortRef.current) {
                abortRef.current.abort();
                abortRef.current = null;
            }

            setHoveredAccount(null);
            setTooltipPosition(null);
            setTooltipData(null);
            setIsLoading(false);
            setError(null);

        } catch (cleanupError) {
            console.error('Error during tooltip cleanup:', cleanupError);
        }
    }, []);

    return {
        hoveredAccount,
        tooltipPosition,
        tooltipData,
        isLoading,
        error,
        showTooltip,
        hideTooltip
    };
}


