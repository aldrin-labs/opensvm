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

  // Helper function to categorize transfers (more inclusive logic)
  const categorizeTransfer = (transfer: any) => {
    const categories = ['all-txs']; // Every transaction belongs to all-txs

    const transferType = (transfer.type || '').toLowerCase();
    
    // Account transfers - be more inclusive for basic transfers
    if (
      transferType === 'transfer' ||
      transferType === 'transferchecked' ||
      transferType === 'in' ||
      transferType === 'out' ||
      transferType === 'send' ||
      transferType === 'receive' ||
      transferType === 'mint' ||
      transferType === 'burn' ||
      // If no specific type but has from/to addresses, consider it an account transfer
      (!transferType || transferType === 'unknown' || transferType === '') && 
      (transfer.from || transfer.to)
    ) {
      categories.push('account-transfers');
    }

    // Trading transactions
    if (transferType.includes('swap') || transferType.includes('trade') || 
        transferType.includes('exchange') || transferType.includes('dex')) {
      categories.push('trading-txs');
    }

    // DeFi transactions
    if (transferType.includes('deposit') || transferType.includes('withdraw') ||
        transferType.includes('borrow') || transferType.includes('lend') ||
        transferType.includes('stake') || transferType.includes('unstake') ||
        transferType.includes('yield') || transferType.includes('farm') ||
        transfer.mint?.includes('LP') || transfer.tokenSymbol?.includes('LP')) {
      categories.push('defi-txs');
    }

    // NFT transactions
    if (transferType.includes('nft') || transferType.includes('collectible') ||
        transfer.tokenSymbol?.includes('NFT') || 
        (transfer.amount === 1 && transfer.tokenSymbol && transfer.tokenSymbol !== 'SOL')) {
      categories.push('nft-txs');
    }

    // Staking transactions
    if (transferType.includes('stake') || transferType.includes('delegate') ||
        transferType.includes('reward') || transferType.includes('commission') ||
        transferType.includes('validator')) {
      categories.push('staking-txs');
    }

    // Utility transactions
    if (transferType.includes('createaccount') || transferType.includes('rent') ||
        transferType.includes('fee') || transferType.includes('initialize') ||
        transferType.includes('close') || transfer.amount === 0) {
      categories.push('utility-txs');
    }

    // Suspicious transactions
    if ((transfer.amount || 0) > 1000000 || transferType.includes('unknown') ||
        transferType.includes('suspicious') || transferType.includes('unusual')) {
      categories.push('suspicious-txs');
    }

    // If no specific category was assigned (other than all-txs), add to account-transfers as fallback
    if (categories.length === 1) {
      categories.push('account-transfers');
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
