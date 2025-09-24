'use client';

import { useState, useEffect } from 'react';
import { useTransfers } from '@/app/account/[address]/components/shared/hooks';

export interface TabStatus {
  count: number;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
}

export interface TransferCounts {
  'tokens': TabStatus;
  'account-transfers': TabStatus;
  'all-txs': TabStatus;
  'trading-txs': TabStatus;
  'defi-txs': TabStatus;
  'nft-txs': TabStatus;
  'staking-txs': TabStatus;
  'utility-txs': TabStatus;
  'suspicious-txs': TabStatus;
  'custom-program-txs': TabStatus;
}

const defaultTabStatus: TabStatus = {
  count: 0,
  loading: false,
  error: null,
  hasMore: false
};

export function useTransferCounts(address: string, tokenBalances: { mint: string; balance: number; }[] = []): TransferCounts {
  // Get transfer data for different categories
  const accountTransfers = useTransfers(address);
  
  const [counts, setCounts] = useState<TransferCounts>({
    'tokens': { ...defaultTabStatus, count: tokenBalances.length + 1 }, // +1 for SOL
    'account-transfers': defaultTabStatus,
    'all-txs': defaultTabStatus,
    'trading-txs': defaultTabStatus,
    'defi-txs': defaultTabStatus,
    'nft-txs': defaultTabStatus,
    'staking-txs': defaultTabStatus,
    'utility-txs': defaultTabStatus,
    'suspicious-txs': defaultTabStatus,
    'custom-program-txs': defaultTabStatus,
  });

  // Helper function to categorize transfers (similar to TransfersTable logic)
  const categorizeTransfer = (transfer: any) => {
    const categories = ['all-txs'];

    if (
      transfer.type === 'transfer' ||
      transfer.type === 'transferChecked' ||
      transfer.type === 'in' ||
      transfer.type === 'out'
    ) {
      categories.push('account-transfers');
    }

    if (transfer.type?.includes('swap') || transfer.type?.includes('trade') || transfer.type?.includes('exchange')) {
      categories.push('trading-txs');
    }

    if (transfer.type?.includes('deposit') || transfer.type?.includes('withdraw') ||
      transfer.type?.includes('borrow') || transfer.type?.includes('lend') ||
      transfer.type?.includes('stake') || transfer.type?.includes('unstake') ||
      transfer.mint?.includes('LP') || transfer.tokenSymbol?.includes('LP')) {
      categories.push('defi-txs');
    }

    if (transfer.type?.includes('nft') || transfer.type?.includes('NFT') ||
      transfer.tokenSymbol?.includes('NFT') || transfer.amount === 1) {
      categories.push('nft-txs');
    }

    if (transfer.type?.includes('stake') || transfer.type?.includes('delegate') ||
      transfer.type?.includes('reward') || transfer.type?.includes('commission')) {
      categories.push('staking-txs');
    }

    if (transfer.type?.includes('createAccount') || transfer.type?.includes('rent') ||
      transfer.type?.includes('fee') || transfer.amount === 0) {
      categories.push('utility-txs');
    }

    if ((transfer.amount || 0) > 1000000 || transfer.type?.includes('unknown')) {
      categories.push('suspicious-txs');
    }

    return categories;
  };

  // Update counts when transfer data changes
  useEffect(() => {
    if (!accountTransfers.transfers) return;

    // Count transfers by category
    const categoryCounts = {
      'all-txs': 0,
      'account-transfers': 0,
      'trading-txs': 0,
      'defi-txs': 0,
      'nft-txs': 0,
      'staking-txs': 0,
      'utility-txs': 0,
      'suspicious-txs': 0,
      'custom-program-txs': 0,
    };

    accountTransfers.transfers.forEach(transfer => {
      const categories = categorizeTransfer(transfer);
      categories.forEach(category => {
        if (category in categoryCounts) {
          categoryCounts[category as keyof typeof categoryCounts]++;
        }
      });
    });

    setCounts(prev => ({
      ...prev,
      'tokens': {
        count: tokenBalances.length + 1, // +1 for SOL
        loading: false,
        error: null,
        hasMore: false
      },
      'account-transfers': {
        count: categoryCounts['account-transfers'],
        loading: accountTransfers.loading,
        error: accountTransfers.error,
        hasMore: accountTransfers.hasMore
      },
      'all-txs': {
        count: categoryCounts['all-txs'],
        loading: accountTransfers.loading,
        error: accountTransfers.error,
        hasMore: accountTransfers.hasMore
      },
      'trading-txs': {
        count: categoryCounts['trading-txs'],
        loading: accountTransfers.loading,
        error: accountTransfers.error,
        hasMore: accountTransfers.hasMore
      },
      'defi-txs': {
        count: categoryCounts['defi-txs'],
        loading: accountTransfers.loading,
        error: accountTransfers.error,
        hasMore: accountTransfers.hasMore
      },
      'nft-txs': {
        count: categoryCounts['nft-txs'],
        loading: accountTransfers.loading,
        error: accountTransfers.error,
        hasMore: accountTransfers.hasMore
      },
      'staking-txs': {
        count: categoryCounts['staking-txs'],
        loading: accountTransfers.loading,
        error: accountTransfers.error,
        hasMore: accountTransfers.hasMore
      },
      'utility-txs': {
        count: categoryCounts['utility-txs'],
        loading: accountTransfers.loading,
        error: accountTransfers.error,
        hasMore: accountTransfers.hasMore
      },
      'suspicious-txs': {
        count: categoryCounts['suspicious-txs'],
        loading: accountTransfers.loading,
        error: accountTransfers.error,
        hasMore: accountTransfers.hasMore
      },
      'custom-program-txs': {
        count: categoryCounts['custom-program-txs'],
        loading: accountTransfers.loading,
        error: accountTransfers.error,
        hasMore: accountTransfers.hasMore
      },
    }));
  }, [accountTransfers.transfers, accountTransfers.loading, accountTransfers.error, accountTransfers.hasMore, tokenBalances.length]);

  return counts;
}
