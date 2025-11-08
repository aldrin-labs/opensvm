'use client';

export function TransactionsInBlock() {
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h2 className="text-xl font-semibold text-foreground mb-4">Transactions in Block</h2>
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        Click on any block in the Recent Blocks section
      </div>
    </div>
  );
}
