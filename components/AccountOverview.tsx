"use client";

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { type TokenAccount } from '@/lib/solana';
import PortfolioPieChart from './PortfolioPieChart';

interface Props {
  address: string;
  solBalance: number;
  tokenAccounts: TokenAccount[];
  isSystemProgram?: boolean;
  parsedOwner?: string;
}

export default function AccountOverview({ 
  address, 
  solBalance, 
  tokenAccounts,
  isSystemProgram,
  parsedOwner
}: Props) {
  const [accountStats, setAccountStats] = useState<{
    totalTransactions: string | number | null;
    tokenTransfers: number | null;
  }>({ totalTransactions: null, tokenTransfers: null });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    async function fetchAccountStats() {
      try {
        setStatsLoading(true);
        const response = await fetch(`/api/account-stats/${address}`);
        if (!response.ok) throw new Error('Failed to fetch account stats');
        const data = await response.json();
        setAccountStats({
          totalTransactions: data.totalTransactions ?? null,
          tokenTransfers: data.tokenTransfers ?? null
        });
      } catch (error) {
        console.error('Error fetching account stats:', error);
        setAccountStats({ totalTransactions: null, tokenTransfers: null });
      } finally {
        setStatsLoading(false);
      }
    }

    fetchAccountStats();
  }, [address]);

  return (
    <div className="rounded-lg border border-neutral-800 bg-black">
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-4">Overview</h2>
        
        <div className="space-y-4">
          <div>
            <div className="text-sm text-neutral-400">SOL Balance</div>
            <div className="flex items-center gap-2">
              <div className="text-lg">{solBalance.toFixed(4)} SOL</div>
              <div className="text-sm text-neutral-400">(${(solBalance * 235.19).toFixed(2)})</div>
            </div>
          </div>

          <div>
            <div className="text-sm text-neutral-400">Token Balance</div>
            <div className="flex items-center gap-2">
              <div className="text-lg">{tokenAccounts.length} Tokens</div>
              <div className="text-sm text-neutral-400">($0.00)</div>
            </div>
            {tokenAccounts && tokenAccounts.length > 0 && (
              <div className="mt-2">
                <button className="w-full flex items-center justify-between bg-neutral-900 rounded-lg p-3 hover:bg-neutral-900/80">
                  <div className="text-sm font-mono">
                    {tokenAccounts[0]?.mint?.slice(0, 8)}...
                  </div>
                  <div className="text-sm">
                    {tokenAccounts[0]?.uiAmount?.toLocaleString()}
                  </div>
                  <div className="text-xs text-neutral-400">
                    {tokenAccounts[0]?.symbol || 'Unknown'}
                  </div>
                </button>
                {tokenAccounts.length > 1 && (
                  <div className="text-xs text-neutral-400 mt-2 text-center">
                    + {tokenAccounts.length - 1} more tokens
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <div className="text-sm text-neutral-400">Total Transactions</div>
            {statsLoading ? (
              <div className="flex items-center mt-1">
                <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
              </div>
            ) : accountStats.totalTransactions === null ? (
              <div className="text-sm text-neutral-500">-</div>
            ) : (
              <div className="text-lg">
                {typeof accountStats.totalTransactions === 'number' 
                  ? accountStats.totalTransactions.toLocaleString()
                  : accountStats.totalTransactions}
              </div>
            )}
          </div>

          <div>
            <div className="text-sm text-neutral-400">Token Transfers</div>
            {statsLoading ? (
              <div className="flex items-center mt-1">
                <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
              </div>
            ) : accountStats.tokenTransfers === null ? (
              <div className="text-sm text-neutral-500">-</div>
            ) : (
              <div className="text-lg">{accountStats.tokenTransfers.toLocaleString()}</div>
            )}
          </div>

          {parsedOwner && (
            <div>
              <div className="text-sm text-neutral-400">Owner</div>
              <div className="text-sm font-mono break-all">{parsedOwner}</div>
            </div>
          )}

          {isSystemProgram !== undefined && (
            <div>
              <div className="text-sm text-neutral-400">Type</div>
              <div className="text-sm">{isSystemProgram ? 'System Program' : 'User Account'}</div>
            </div>
          )}

          <div>
            <div className="text-sm text-neutral-400 mb-2">Portfolio Breakdown</div>
            <PortfolioPieChart solBalance={solBalance} tokenBalances={tokenAccounts.map(t => ({ mint: t.mint, balance: t.uiAmount || 0 }))} />
          </div>
        </div>
      </div>
    </div>
  );
}
