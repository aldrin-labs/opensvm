'use client';

import Link from 'next/link';

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

// Changed to default export
export default function TransactionsInBlock({ block }: Props) {
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
      {/* Use VirtualizedList for better performance with large transaction lists */}
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