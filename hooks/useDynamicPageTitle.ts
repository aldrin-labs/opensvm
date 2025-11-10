/**
 * Dynamic Page Title Hook
 * Updates page title dynamically based on loaded data and context
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';

interface DynamicTitleOptions {
  /**
   * The base title or dynamic title based on loaded data
   */
  title: string;
  
  /**
   * Optional suffix (defaults to "| OpenSVM")
   */
  suffix?: string;
  
  /**
   * If true, will not update the title
   */
  disabled?: boolean;
  
  /**
   * Dependencies that trigger title updates
   * Use this to pass data objects that should trigger title updates
   */
  dependencies?: readonly unknown[];
  
  /**
   * Debounce delay in milliseconds (default: 100ms)
   * Prevents rapid title updates when data changes quickly
   */
  debounceMs?: number;
}

/**
 * Hook to dynamically update page title based on context
 * 
 * @example
 * // In a transaction page component:
 * useDynamicPageTitle({
 *   title: transaction ? `Transaction ${transaction.signature.slice(0, 8)}...` : 'Transaction',
 *   dependencies: [transaction]
 * });
 * 
 * @example
 * // In a token page component:
 * useDynamicPageTitle({
 *   title: tokenData?.symbol ? `${tokenData.symbol} Token` : `Token ${mint.slice(0, 8)}...`,
 *   dependencies: [tokenData]
 * });
 */
export function useDynamicPageTitle(options: DynamicTitleOptions) {
  const { title, suffix = '| OpenSVM', disabled = false, dependencies = [], debounceMs = 100 } = options;
  const previousTitleRef = useRef<string>('');
  const originalTitleRef = useRef<string>('');
  const isMountedRef = useRef<boolean>(true);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Store original title once on mount
  useEffect(() => {
    if (typeof document !== 'undefined' && !originalTitleRef.current) {
      originalTitleRef.current = document.title;
    }
    
    // Mark as mounted
    isMountedRef.current = true;
    
    // Cleanup: restore original title only on actual unmount
    return () => {
      isMountedRef.current = false;
      
      // Clear any pending debounced updates
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      
      try {
        if (originalTitleRef.current && typeof document !== 'undefined') {
          document.title = originalTitleRef.current;
        }
      } catch (error) {
        console.warn('Failed to restore original page title:', error);
      }
    };
  }, []); // Empty deps - only run on mount/unmount

  // Memoized update function
  const updateTitle = useCallback((fullTitle: string) => {
    try {
      if (previousTitleRef.current !== fullTitle) {
        document.title = fullTitle;
        previousTitleRef.current = fullTitle;

        // Dispatch custom event for tracking/analytics
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('page-title-updated', {
              detail: { title: fullTitle, timestamp: Date.now() }
            })
          );
        }
      }
    } catch (error) {
      console.warn('Failed to update page title:', error);
    }
  }, []);

  // Update title when dependencies change (with debounce)
  useEffect(() => {
    if (disabled || typeof document === 'undefined' || !isMountedRef.current) return;

    // Clear any existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Construct the full title
    const fullTitle = suffix ? `${title} ${suffix}` : title;

    // Debounce the update
    debounceTimeoutRef.current = setTimeout(() => {
      updateTitle(fullTitle);
    }, debounceMs);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, suffix, disabled, debounceMs, updateTitle, ...(dependencies || [])]);
}

/**
 * Utility functions for generating contextual titles
 */
export const TitleGenerators = {
  /**
   * Generate title for transaction pages
   */
  transaction: (signature?: string, status?: string) => {
    if (!signature) return 'Transaction Details';
    const shortSig = signature.slice(0, 8);
    return status ? `Transaction ${shortSig}... (${status})` : `Transaction ${shortSig}...`;
  },

  /**
   * Generate title for account pages
   */
  account: (address?: string, label?: string, balance?: number) => {
    if (label) return `${label} Account`;
    if (!address) return 'Account Details';
    const shortAddr = address.slice(0, 8);
    if (balance !== undefined) {
      return `Account ${shortAddr}... (${balance.toFixed(2)} SOL)`;
    }
    return `Account ${shortAddr}...`;
  },

  /**
   * Generate title for token pages
   */
  token: (mint?: string, symbol?: string, name?: string, price?: number) => {
    if (symbol && name) {
      return price ? `$${symbol} - ${name} ($${price.toFixed(2)})` : `$${symbol} - ${name}`;
    }
    if (symbol) {
      return price ? `$${symbol} Token ($${price.toFixed(2)})` : `$${symbol} Token`;
    }
    if (!mint) return 'Token Details';
    const shortMint = mint.slice(0, 8);
    return `Token ${shortMint}...`;
  },

  /**
   * Generate title for block pages
   */
  block: (slot?: number, blockTime?: number, transactionCount?: number) => {
    if (!slot) return 'Block Details';
    if (transactionCount !== undefined) {
      return `Block #${slot.toLocaleString()} (${transactionCount} txs)`;
    }
    return `Block #${slot.toLocaleString()}`;
  },

  /**
   * Generate title for program pages
   */
  program: (programId?: string, programName?: string, accountCount?: number) => {
    if (programName) {
      return accountCount !== undefined 
        ? `${programName} Program (${accountCount} accounts)` 
        : `${programName} Program`;
    }
    if (!programId) return 'Program Details';
    const shortId = programId.slice(0, 8);
    return `Program ${shortId}...`;
  },

  /**
   * Generate title for validator pages
   */
  validator: (validatorId?: string, name?: string, commission?: number) => {
    if (name) {
      return commission !== undefined 
        ? `${name} Validator (${commission}% commission)` 
        : `${name} Validator`;
    }
    if (!validatorId) return 'Validator Details';
    const shortId = validatorId.slice(0, 8);
    return `Validator ${shortId}...`;
  },

  /**
   * Generate title for analytics pages
   */
  analytics: (metric?: string, timeframe?: string) => {
    if (metric && timeframe) return `${metric} Analytics - ${timeframe}`;
    if (metric) return `${metric} Analytics`;
    return 'Network Analytics';
  },

  /**
   * Generate title for search pages
   */
  search: (query?: string, resultCount?: number) => {
    if (!query) return 'Search';
    if (resultCount !== undefined) {
      return `Search: "${query}" (${resultCount} results)`;
    }
    return `Search: "${query}"`;
  }
};
