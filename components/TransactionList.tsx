import { Card, CardHeader, CardContent, Text, Stack } from 'rinlab';
import { format } from 'date-fns';

interface Transaction {
  signature: string;
  timestamp: Date | null;
  status: 'Success' | 'Failed';
  fee: number;
}

interface TransactionListProps {
  transactions: Transaction[];
}

export default function TransactionList({ transactions }: TransactionListProps) {
  return (
    <Card>
      <CardHeader>
        <Text variant="heading">Recent Transactions</Text>
      </CardHeader>
      <CardContent>
        <Stack gap={2}>
          {transactions.map((tx, index) => (
            <div key={tx.signature} className={`flex items-center justify-between p-2 rounded-lg ${index % 2 === 0 ? 'bg-muted/50' : ''}`}>
              <div className="flex flex-col">
                <div className="flex items-center space-x-2">
                  <Text variant="default" className="font-mono text-sm">
                    {tx.signature.slice(0, 8)}...{tx.signature.slice(-8)}
                  </Text>
                  <div className={`px-2 py-0.5 rounded text-xs border ${tx.status === 'Success' ? 'bg-success/10 text-success border-success/30' : 'bg-destructive/10 text-destructive border-destructive/30'}`}>
                    {tx.status}
                  </div>
                </div>
                {tx.timestamp && (
                  <Text variant="label" className="text-xs">
                    {format(tx.timestamp, 'MMM d, yyyy HH:mm:ss')}
                  </Text>
                )}
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <Text variant="label" className="text-xs">Fee</Text>
                  <Text variant="default" className="text-sm">{tx.fee.toFixed(6)} SOL</Text>
                </div>
                <a 
                  href={`https://solscan.io/tx/${tx.signature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                    <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                  </svg>
                </a>
              </div>
            </div>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
} 