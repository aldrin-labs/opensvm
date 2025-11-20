'use client';

import { useState, useEffect } from 'react';
import { getBlockDetails } from '@/lib/solana/solana';

interface DisplayBlockDetails {
  slot: number;
  timestamp: number | null;
  blockhash: string;
  parentSlot: number;
  transactionCount: number;
  previousBlockhash: string;
}

export default function BlockDetailsView({ slot }: { slot: string }) {
  const [block, setBlock] = useState<DisplayBlockDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBlock() {
      try {
        const blockDetails = await getBlockDetails(parseInt(slot));
        if (blockDetails) {
          setBlock({
            slot: blockDetails.slot,
            timestamp: blockDetails.blockTime,
            blockhash: blockDetails.blockhash,
            parentSlot: blockDetails.parentSlot,
            transactionCount: blockDetails.transactionCount,
            previousBlockhash: blockDetails.previousBlockhash
          });
        } else {
          setError('Block not found');
        }
      } catch (err) {
        setError('Failed to fetch block details');
      } finally {
        setLoading(false);
      }
    }

    fetchBlock();
  }, [slot]);

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
        <div>
          <h1 className="text-2xl font-bold mb-2">Block #{block.slot.toLocaleString()}</h1>
          <p className="text-muted-foreground">
            {block.timestamp
              ? new Date(block.timestamp * 1000).toLocaleString()
              : 'Timestamp not available'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border bg-card p-6">
            <div className="text-sm text-muted-foreground mb-2">Blockhash</div>
            <div className="font-mono break-all">{block.blockhash}</div>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <div className="text-sm text-muted-foreground mb-2">Previous Blockhash</div>
            <div className="font-mono break-all">{block.previousBlockhash}</div>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <div className="text-sm text-muted-foreground mb-2">Parent Slot</div>
            <div className="font-mono">{block.parentSlot.toLocaleString()}</div>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <div className="text-sm text-muted-foreground mb-2">Transactions</div>
            <div className="font-mono">{block.transactionCount.toLocaleString()}</div>
          </div>
        </div>
      </div>
    </main>
  );
}
