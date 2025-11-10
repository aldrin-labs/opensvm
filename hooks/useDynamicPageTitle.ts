/**
 * Dynamic Page Title Hook
 * Updates page title dynamically based on loaded data and context
 */

'use client';

import { useEffect, useRef } from 'react';

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
   */
  dependencies?: any[];
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
  const { title, suffix = '| OpenSVM', disabled = false, dependencies = [] } = options;
  const previousTitleRef = useRef<string>('');

  useEffect(() => {
    if (disabled || typeof document === 'undefined') return;

    // Construct the full title
    const fullTitle = suffix ? `${title} ${suffix}` : title;

    // Only update if the title has changed
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

    // Cleanup: restore to default on unmount if needed
    return () => {
      // We don't restore the title on unmount as Next.js will handle it
      // when navigating to a new page
    };
  }, [title, suffix, disabled, ...dependencies]);
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
