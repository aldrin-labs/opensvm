'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  ZAxis
} from 'recharts';

interface TransactionVisualizationProps {
  transactionData: any;
  isLoading?: boolean;
}

const TransactionVisualization: React.FC<TransactionVisualizationProps> = ({ 
  transactionData, 
  isLoading = false 
}) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-[300px] w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  if (!transactionData || !transactionData.data) {
    return (
      <div className="text-center p-6 bg-muted/30 rounded-lg">
        <p className="text-muted-foreground">No transaction data available</p>
      </div>
    );
  }

  const { transaction } = transactionData.data;

  if (!transaction) {
    return (
      <div className="text-center p-6 bg-muted/30 rounded-lg">
        <p className="text-muted-foreground">Transaction details not available</p>
      </div>
    );
  }

  // Format transaction instructions for visualization
  const instructionsData = transaction.instructions?.map((instruction: any, index: number) => ({
    name: instruction.programId ? `Program ${instruction.programId.substring(0, 6)}...` : `Instruction ${index + 1}`,
    accounts: instruction.accounts?.length || 0,
    data: instruction.data ? instruction.data.length / 2 : 0, // Hex data length divided by 2 for byte count
  })) || [];

  // Format account interactions
  const accountInteractions: Record<string, number> = {};
  if (transaction.instructions) {
    transaction.instructions.forEach((instruction: any) => {
      if (instruction.accounts) {
        instruction.accounts.forEach((account: string) => {
          accountInteractions[account] = (accountInteractions[account] || 0) + 1;
        });
      }
    });
  }
  
  const accountInteractionsData = Object.entries(accountInteractions)
    .map(([account, count]) => ({
      account: account.substring(0, 6) + '...' + account.substring(account.length - 4),
      interactions: count
    }))
    .sort((a, b) => b.interactions - a.interactions)
    .slice(0, 10);

  // Format token transfers if available
  const tokenTransfersData = transaction.tokenTransfers?.map((transfer: any, index: number) => ({
    token: transfer.tokenSymbol || `Token ${index + 1}`,
    amount: parseFloat(transfer.amount) || 0,
    from: transfer.fromUserAccount.substring(0, 6) + '...',
    to: transfer.toUserAccount.substring(0, 6) + '...'
  })) || [];

  // Format transaction fee comparison
  const feeComparisonData = [
    { name: 'This Transaction', fee: transaction.fee || 0 },
    { name: 'Average Fee', fee: 0.000005 }, // Example average fee
    { name: 'Median Fee', fee: 0.000004 }  // Example median fee
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Transaction Details</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline">{transactionData.query.substring(0, 6)}...{transactionData.query.substring(transactionData.query.length - 4)}</Badge>
            <Badge className={transaction.status === 'success' ? 'bg-green-500' : 'bg-red-500'}>
              {transaction.status || 'Unknown'}
            </Badge>
          </div>
        </div>
        
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Transaction Fee</p>
          <p className="text-lg font-bold">
            {transaction.fee || 0} SOL
          </p>
        </div>
      </div>

      {/* Transaction Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted/30 p-3 rounded-md">
              <p className="text-sm text-muted-foreground">Block</p>
              <p className="text-lg font-bold truncate">
                {transaction.block || 'Unknown'}
              </p>
            </div>
            <div className="bg-muted/30 p-3 rounded-md">
              <p className="text-sm text-muted-foreground">Time</p>
              <p className="text-lg font-bold">
                {transaction.blockTime ? new Date(transaction.blockTime * 1000).toLocaleString() : 'Unknown'}
              </p>
            </div>
            <div className="bg-muted/30 p-3 rounded-md">
              <p className="text-sm text-muted-foreground">Instructions</p>
              <p className="text-lg font-bold">
                {transaction.instructions?.length || 0}
              </p>
            </div>
            <div className="bg-muted/30 p-3 rounded-md">
              <p className="text-sm text-muted-foreground">Status</p>
              <p className={`text-lg font-bold ${transaction.status === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                {transaction.status || 'Unknown'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Instructions Visualization */}
        {instructionsData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Instructions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={instructionsData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 50 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45} 
                      textAnchor="end" 
                      height={60} 
                    />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="accounts" fill="#8884d8" name="Accounts" />
                    <Bar dataKey="data" fill="#82ca9d" name="Data Size (bytes)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Account Interactions */}
        {accountInteractionsData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Account Interactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={accountInteractionsData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 50 }}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis 
                      dataKey="account" 
                      type="category" 
                      width={100}
                    />
                    <Tooltip />
                    <Bar dataKey="interactions" fill="#8884d8" name="Interactions" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Token Transfers */}
      {tokenTransfersData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Token Transfers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart
                  margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                >
                  <CartesianGrid />
                  <XAxis 
                    type="category" 
                    dataKey="token" 
                    name="Token" 
                    angle={-45} 
                    textAnchor="end" 
                    height={60}
                  />
                  <YAxis type="number" dataKey="amount" name="Amount" />
                  <ZAxis range={[100, 500]} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter 
                    name="Token Transfers" 
                    data={tokenTransfersData} 
                    fill="#8884d8"
                    shape="circle"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Token</th>
                    <th className="text-right py-2">Amount</th>
                    <th className="text-right py-2">From</th>
                    <th className="text-right py-2">To</th>
                  </tr>
                </thead>
                <tbody>
                  {tokenTransfersData.map((transfer: any, index: any) => (
                    <tr key={index} className="border-b">
                      <td className="py-2">{transfer.token}</td>
                      <td className="text-right py-2">{transfer.amount.toLocaleString()}</td>
                      <td className="text-right py-2">{transfer.from}</td>
                      <td className="text-right py-2">{transfer.to}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction Fee Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction Fee Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={feeComparisonData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => typeof value === 'number' ? value.toFixed(6) + ' SOL' : value} />
                <Bar dataKey="fee" fill="#82ca9d" name="Fee (SOL)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Programs */}
      {transaction.programs && transaction.programs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Programs Involved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {transaction.programs.map((program: any, index: number) => (
                <div key={index} className="bg-muted/30 p-3 rounded-md">
                  <p className="text-sm text-muted-foreground">Program {index + 1}</p>
                  <p className="font-medium truncate">{program}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TransactionVisualization;
