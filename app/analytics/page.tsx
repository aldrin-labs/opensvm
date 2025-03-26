'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState('overview');

  // Sample data for demonstration
  const networkStats = {
    tps: 4289,
    activeAccounts: 1243789,
    totalTransactions: 245789032,
    avgBlockTime: 0.4,
    validators: 1789,
    currentEpoch: 371,
    stakingYield: 6.8,
    marketCap: 21543000000,
    totalValueLocked: 543000000
  };

  const mockChartData = [
    { date: 'Jan', value: 2500 },
    { date: 'Feb', value: 3500 },
    { date: 'Mar', value: 3100 },
    { date: 'Apr', value: 4500 },
    { date: 'May', value: 4100 },
    { date: 'Jun', value: 5200 },
    { date: 'Jul', value: 5900 }
  ];

  // Simple chart component
  const SimpleChart = ({ data }: { data: { date: string; value: number }[] }) => (
    <div className="w-full h-48 flex items-end justify-between gap-1 mt-4">
      {data.map((item, i) => (
        <div key={i} className="flex flex-col items-center">
          <div 
            className="bg-primary/80 hover:bg-primary transition-all w-12 rounded-t-sm" 
            style={{ height: `${(item.value / 6000) * 100}%` }}
          />
          <span className="text-xs mt-1 text-muted-foreground">{item.date}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Network Analytics</h1>
        <p className="text-muted-foreground">
          Solana network performance metrics and analytics dashboard.
        </p>
      </div>

      <Tabs defaultValue="overview" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="validators">Validators</TabsTrigger>
          <TabsTrigger value="defi">DeFi</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Current TPS</CardTitle>
                <CardDescription>Transactions per second</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{networkStats.tps.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">+12.5% from last week</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Active Accounts</CardTitle>
                <CardDescription>Unique accounts with activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{networkStats.activeAccounts.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">+3.2% from last week</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
                <CardDescription>All-time transaction count</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{networkStats.totalTransactions.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">+0.8% from yesterday</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Network Activity</CardTitle>
              <CardDescription>Transaction volume over time</CardDescription>
            </CardHeader>
            <CardContent>
              <SimpleChart data={mockChartData} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>Key network performance indicators</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium mb-2">Average Block Time</h3>
                  <div className="text-2xl font-bold">{networkStats.avgBlockTime} seconds</div>
                  <p className="text-xs text-muted-foreground mt-1">Consistent with network targets</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-2">Current Epoch</h3>
                  <div className="text-2xl font-bold">{networkStats.currentEpoch}</div>
                  <p className="text-xs text-muted-foreground mt-1">Progressing normally</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validators" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Validator Statistics</CardTitle>
              <CardDescription>Network validators and staking data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium mb-2">Active Validators</h3>
                  <div className="text-2xl font-bold">{networkStats.validators.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1">+5 validators this week</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-2">Staking Yield</h3>
                  <div className="text-2xl font-bold">{networkStats.stakingYield}%</div>
                  <p className="text-xs text-muted-foreground mt-1">Annual percentage yield</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="defi" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>DeFi Metrics</CardTitle>
              <CardDescription>Decentralized finance statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium mb-2">Market Cap</h3>
                  <div className="text-2xl font-bold">${(networkStats.marketCap / 1000000000).toFixed(2)}B</div>
                  <p className="text-xs text-muted-foreground mt-1">+2.3% in the last 24h</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-2">Total Value Locked</h3>
                  <div className="text-2xl font-bold">${(networkStats?.totalValueLocked || 0) / 1000000 > 0 ? ((networkStats?.totalValueLocked || 0) / 1000000).toFixed(2) : 0}M</div>
                  <p className="text-xs text-muted-foreground mt-1">Across all Solana DeFi protocols</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}