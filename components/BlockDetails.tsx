'use client';

import { useState, useEffect } from 'react';
import { getBlockDetails, type BlockDetails as BlockDetailsType } from '@/lib/solana';
import { Button } from '@/components/ui/button';
import TransactionsInBlock from '@/components/TransactionsInBlock';
import Link from 'next/link';
import { Copy } from 'lucide-react';
import { ShareButton } from '@/components/ShareButton';

// Helper functions
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
};

export default function BlockDetails({ slot }: { slot: string }) {
  const [block, setBlock] = useState<BlockDetailsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTransactions, setShowTransactions] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [previousBlockTime, setPreviousBlockTime] = useState<number | null>(null);

  useEffect(() => {
    async function fetchBlock() {
      try {
        setTransactionsLoading(true);
        console.log('Fetching block details for slot:', slot);
        const blockDetails = await getBlockDetails(parseInt(slot));
        if (blockDetails) {
          // Store current block time for next block's delta calculation
          if (blockDetails.blockTime) {
            setPreviousBlockTime(blockDetails.blockTime);
          }

          setBlock(blockDetails);
        } else {
          setError('Block not found');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch block details');
      } finally {
        setLoading(false);
        setTransactionsLoading(false);
      }
    }

    fetchBlock();
  }, [slot, previousBlockTime]);

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-12">Loading block details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-12 text-red-500">{error}</div>
      </div>
    );
  }

  if (!block) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-12">Block not found</div>
      </div>
    );
  }

  return (
    <main className="container mx-auto p-4">
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <Link
            href={`/block/${parseInt(slot) - 1}`}
            className="text-sm text-muted-foreground hover:text-foreground"
            target="_blank"
            rel="noopener noreferrer"
          >
            ← Previous Block
          </Link>
          <Link
            href={`/block/${parseInt(slot) + 1}`}
            className="text-sm text-muted-foreground hover:text-foreground"
            target="_blank"
            rel="noopener noreferrer"
          >
            Next Block →
          </Link>
        </div>
        <div>
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-2xl font-bold">
              Block #{block?.slot?.toLocaleString() ?? 'Unknown'}
              {block.blockTimeDelta && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  (+{block.blockTimeDelta.toFixed(2)}s)
                </span>
              )}
            </h1>
            <ShareButton entityType="block" entityId={slot} />
          </div>
          <p className="text-muted-foreground">
            {block?.timestamp
              ? new Date(block.timestamp).toLocaleString()
              : 'Timestamp not available'}
          </p>
        </div>

        {/* Program Invocations */}
        {block.programs.length > 0 && (
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Program Invocations</h2>
            <div className="space-y-2">
              {block.programs.slice(0, 5).map(({ address, count, name }) => (
                <div key={address} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Link href={`/program/${address}`} className="font-mono text-sm hover:underline" target="_blank" rel="noopener noreferrer">
                      {address}
                    </Link>
                    <button 
                      onClick={() => copyToClipboard(address)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    {name && (
                      <span className="text-xs text-muted-foreground">({name})</span>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">{count}x</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Block Rewards */}
        {block.rewards && block.rewards.length > 0 && (
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Block Rewards</h2>
            <div className="space-y-2">
              {block.rewards.map((reward) => (
                <div key={reward.pubkey} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Link href={`/account/${reward.pubkey}`} className="font-mono text-sm hover:underline" target="_blank" rel="noopener noreferrer">
                      {reward.pubkey}
                    </Link>
                    <button 
                      onClick={() => copyToClipboard(reward.pubkey)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {(reward.lamports / 1e9).toFixed(4)} SOL
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Token Transfers */}
        {block.tokenTransfers.length > 0 && (
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Token Transfers</h2>
            <div className="space-y-2">
              {block.tokenTransfers.map(({ mint, symbol, amount }) => (
                <div key={mint} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Link href={`/token/${mint}`} className="font-mono text-sm hover:underline" target="_blank" rel="noopener noreferrer">
                      {symbol ?? mint}
                    </Link>
                    <button 
                      onClick={() => copyToClipboard(mint)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {amount.toLocaleString()} tokens
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border bg-card p-6">
            <div className="text-sm text-muted-foreground mb-2">Blockhash</div>
            <div className="font-mono break-all">{block?.blockhash ?? 'Unknown'}</div>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <div className="text-sm text-muted-foreground mb-2">Previous Blockhash</div>
            <div className="font-mono break-all">{block?.previousBlockhash ?? 'Unknown'}</div>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <div className="text-sm text-muted-foreground mb-2">Parent Slot</div>
            <div className="font-mono">{block?.parentSlot?.toLocaleString() ?? 'Unknown'}</div>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <div className="text-sm text-muted-foreground mb-2">Transactions</div>
            <div className="font-mono space-y-2">
              <div className="flex items-center gap-2">
                <span>{block.transactionCount.toLocaleString()}</span>
                {block.transactionCount > 0 && (
                  <span className="text-sm group relative">
                    (<span className="text-green-500 hover:underline cursor-help">{((block.successCount / block.transactionCount) * 100).toFixed(1)}%</span>
                    {' / '}
                    <span className="text-red-500 hover:underline cursor-help">{((block.failureCount / block.transactionCount) * 100).toFixed(1)}%</span>)
                    <span className="invisible group-hover:visible absolute left-0 -bottom-8 w-24 bg-popover text-popover-foreground p-2 rounded-md text-xs shadow-lg text-center">
                      Success rate
                    </span>
                  </span>
                )}
              </div>
              <div className="text-sm text-muted-foreground flex gap-4">
                <div className="group relative cursor-help">
                  <div className="hover:underline">{block.totalSolVolume.toFixed(4)} SOL</div>
                  <span className="invisible group-hover:visible absolute left-0 -bottom-8 w-24 bg-popover text-popover-foreground p-2 rounded-md text-xs shadow-lg text-center">
                    SOL moved
                  </span>
                </div>
                <div className="group relative cursor-help">
                  <div className="hover:underline">{block.totalFees.toFixed(4)} SOL</div>
                  <span className="invisible group-hover:visible absolute left-0 -bottom-8 w-24 bg-popover text-popover-foreground p-2 rounded-md text-xs shadow-lg text-center">
                    TX fees
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center mt-4">
          <Button 
            onClick={() => setShowTransactions(!showTransactions)}
            variant="outline"
            className="w-full md:w-auto"
            disabled={transactionsLoading}
          >
            {transactionsLoading ? 'Loading Transactions...' : 
             showTransactions ? 'Hide Transactions' : 
             `Show Transactions (${block?.transactionCount ?? 0})`}
          </Button>
        </div>

        {showTransactions && (
          <div className="mt-8">
            <TransactionsInBlock block={{ slot: block.slot, transactions: block.transactions }} />
          </div>
        )}
      </div>
    </main>
  );
}
