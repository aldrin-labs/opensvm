'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

interface AccountVisualizationProps {
  accountData: any;
  isLoading?: boolean;
}

const AccountVisualization: React.FC<AccountVisualizationProps> = ({ 
  accountData, 
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

  if (!accountData || !accountData.data) {
    return (
      <div className="text-center p-6 bg-muted/30 rounded-lg">
        <p className="text-muted-foreground">No account data available</p>
      </div>
    );
  }

  const { 
    portfolio, 
    nativeBalance, 
    tokenBalances, 
    nfts, 
    recentTransactions, 
    solTransfers, 
    splTransfers, 
    recentSwaps, 
    domains 
  } = accountData.data;

  // Format portfolio data for pie chart
  const portfolioData = [];
  
  // Add SOL balance
  const solBalance = nativeBalance?.solana || portfolio?.nativeBalance?.solana || 0;
  if (solBalance > 0) {
    portfolioData.push({
      name: 'SOL',
      value: parseFloat(solBalance)
    });
  }
  
  // Add token balances
  const tokens = tokenBalances || portfolio?.tokens || [];
  tokens.forEach((token: any) => {
    if (token.amount && token.amount > 0 && token.symbol) {
      portfolioData.push({
        name: token.symbol,
        value: parseFloat(token.amount)
      });
    }
  });

  // Format transaction history data
  const transactionHistory = recentTransactions?.slice(0, 10).map((tx: any, index: number) => ({
    date: new Date(tx.blockTime * 1000).toLocaleDateString(),
    value: index + 1, // Just for visualization purposes
    status: tx.status
  })) || [];

  // Format token distribution data
  const tokenDistribution = tokens.slice(0, 5).map((token: any) => ({
    name: token.symbol || 'Unknown',
    value: parseFloat(token.amount) || 0,
    usdValue: token.usdValue || 0
  }));

  // Format NFT count by collection
  const nftCollections: Record<string, number> = {};
  if (nfts) {
    nfts.forEach((nft: any) => {
      const collection = nft.metadata?.collection?.name || 'Other';
      nftCollections[collection] = (nftCollections[collection] || 0) + 1;
    });
  }
  
  const nftCollectionData = Object.entries(nftCollections).map(([name, count]) => ({
    name,
    count
  }));

  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Account Overview</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline">{accountData.query.substring(0, 6)}...{accountData.query.substring(accountData.query.length - 4)}</Badge>
            {domains && domains.length > 0 && (
              <Badge className="bg-blue-500">
                {domains[0].name}
              </Badge>
            )}
          </div>
        </div>
        
        <div className="text-right">
          <p className="text-sm text-muted-foreground">SOL Balance</p>
          <p className="text-lg font-bold">
            {solBalance} SOL
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Portfolio Composition */}
        {portfolioData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Portfolio Composition</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={portfolioData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {portfolioData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => value.toFixed(4)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Tokens */}
        {tokenDistribution.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Top Token Holdings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={tokenDistribution}
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
                    <Tooltip formatter={(value) => value.toFixed(4)} />
                    <Bar dataKey="value" fill="#82ca9d" name="Amount" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Transaction History */}
      {transactionHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Transaction Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={transactionHistory}
                  margin={{ top: 5, right: 30, left: 20, bottom: 50 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    angle={-45} 
                    textAnchor="end" 
                    height={60} 
                  />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#8884d8" 
                    name="Transactions" 
                    dot={{ stroke: '#8884d8', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* NFT Collections */}
      {nftCollectionData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>NFT Collections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={nftCollectionData}
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
                  <Bar dataKey="count" fill="#8884d8" name="NFTs" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Account Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Account Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted/30 p-3 rounded-md">
              <p className="text-sm text-muted-foreground">Token Types</p>
              <p className="text-lg font-bold">
                {tokens.length}
              </p>
            </div>
            <div className="bg-muted/30 p-3 rounded-md">
              <p className="text-sm text-muted-foreground">NFTs</p>
              <p className="text-lg font-bold">
                {nfts?.length || 0}
              </p>
            </div>
            <div className="bg-muted/30 p-3 rounded-md">
              <p className="text-sm text-muted-foreground">Recent Transactions</p>
              <p className="text-lg font-bold">
                {recentTransactions?.length || 0}
              </p>
            </div>
            <div className="bg-muted/30 p-3 rounded-md">
              <p className="text-sm text-muted-foreground">Recent Swaps</p>
              <p className="text-lg font-bold">
                {recentSwaps?.length || 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountVisualization;
