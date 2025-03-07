'use client';

import Link from 'next/link';
import { memo } from 'react';
import VirtualizedList from './VirtualizedList';

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
}

// TransactionItem component
const TransactionItem = ({ transaction }: { transaction: Transaction }) => (
  <Link
    href={`/tx/${transaction.signature}`}
    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/10 transition-colors"
  >
    <div className="flex flex-col">
      <div className="text-sm font-mono text-foreground truncate max-w-[200px]">
        {transaction.signature}
      </div>
      <div className="text-xs text-muted-foreground">
        {transaction.type}
      </div>
    </div>
    <div className="text-xs text-muted-foreground">
      {transaction.timestamp ? new Date(transaction.timestamp * 1000).toLocaleString() : 'Pending'}
    </div>
  </Link>
);

// Main component with memo for performance
const TransactionsInBlock = memo(function TransactionsInBlock({ block }: Props) {
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
      <VirtualizedList
        items={block.transactions}
        height={300}
        itemHeight={70}
        className="space-y-3"
        renderItem={(transaction) => (
          <TransactionItem transaction={transaction} />
        )}
      />
    </div>
  );
});

export default TransactionsInBlock;