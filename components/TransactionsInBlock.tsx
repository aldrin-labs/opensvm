'use client';

import Link from 'next/link';
import { useState, memo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface Transaction {
  signature: string;
  type: 'Success' | 'Failed';
  timestamp: number | null;
}

interface Block {
  slot: number;
  transactions?: Transaction[];
}

interface Props {
  block: Block | null;
  isLoading?: boolean;
}

// Memoized to prevent unnecessary re-renders (Bug #6 fix)
const TransactionsInBlock = memo(function TransactionsInBlock({ block, isLoading = false }: Props) {
  const [copiedSig, setCopiedSig] = useState<string | null>(null);

  const copyToClipboard = async (signature: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(signature);
      setCopiedSig(signature);
      setTimeout(() => setCopiedSig(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Loading skeleton (Bug #7 fix - prevents layout shift)
  if (isLoading) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Transactions in Block
        </h2>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-3 rounded-lg border border-border">
              <div className="flex items-center justify-between">
                <div className="flex-1 space-y-2">
                  <Skeleton height={16} width="60%" />
                  <Skeleton height={12} width="30%" />
                </div>
                <Skeleton height={12} width={100} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  if (!block || !block.transactions) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Transactions in Block
        </h2>
        <div className="text-muted-foreground text-center py-8">
          Select a block to view its transactions
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-foreground">
          Transactions in Block
        </h2>
        <Link
          href={`/block/${block.slot}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          View Block Details →
        </Link>
      </div>
      <div className="space-y-3">
        {block.transactions.map((tx) => (
          <Link
            key={tx.signature}
            href={`/tx/${tx.signature}`}
            className="group relative flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/10 transition-colors"
          >
            <div className="flex flex-col flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div 
                  className="text-sm font-mono text-foreground truncate max-w-[200px]"
                  title={tx.signature}
                >
                  {tx.signature}
                </div>
                <button
                  onClick={(e) => copyToClipboard(tx.signature, e)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-accent/20 rounded"
                  title="Copy full signature"
                  aria-label="Copy transaction signature"
                >
                  {copiedSig === tx.signature ? (
                    <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
              <div className="text-xs text-muted-foreground">
                {tx.type}
              </div>
            </div>
            <div className="text-xs text-muted-foreground whitespace-nowrap ml-2">
              {tx.timestamp ? new Date(tx.timestamp * 1000).toLocaleString() : 'Pending'}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
});

export default TransactionsInBlock;
