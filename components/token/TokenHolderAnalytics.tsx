'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { Users, Wallet, TrendingUp, AlertCircle, Shield, Zap, Download } from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface Props {
  mint: string;
  totalHolders: number;
  top10Balance?: number;
  top50Balance?: number;
  top100Balance?: number;
}

interface HolderData {
  address: string;
  balance: number;
  percentage: number;
  rank: number;
}

export function TokenHolderAnalytics({ mint, totalHolders, top10Balance, top50Balance, top100Balance }: Props) {
  const [holders, setHolders] = useState<HolderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [distribution, setDistribution] = useState<any>(null);

  useEffect(() => {
    async function fetchHolders() {
      try {
        setLoading(true);
        
        // Fetch top holders
        const response = await fetch(`/api/token/${mint}/holders`);
        if (response.ok) {
          const data = await response.json();
          setHolders(data.holders || []);
          
          // Calculate distribution
          const totalSupply = data.totalSupply || 0;
          const top10 = data.holders.slice(0, 10).reduce((sum: number, h: HolderData) => sum + h.balance, 0);
          const top50 = data.holders.slice(0, 50).reduce((sum: number, h: HolderData) => sum + h.balance, 0);
          const top100 = data.holders.slice(0, 100).reduce((sum: number, h: HolderData) => sum + h.balance, 0);
          
          setDistribution({
            top10Percentage: (top10 / totalSupply) * 100,
            top50Percentage: (top50 / totalSupply) * 100,
            top100Percentage: (top100 / totalSupply) * 100,
            remaining: 100 - (top100 / totalSupply) * 100
          });
        }
      } catch (error) {
        console.error('Failed to fetch holders:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchHolders();
  }, [mint]);

  // Prepare pie chart data
  const pieData = distribution ? [
    { name: 'Top 10', value: distribution.top10Percentage, color: 'hsl(var(--chart-1))' },
    { name: 'Top 11-50', value: distribution.top50Percentage - distribution.top10Percentage, color: 'hsl(var(--chart-2))' },
    { name: 'Top 51-100', value: distribution.top100Percentage - distribution.top50Percentage, color: 'hsl(var(--chart-3))' },
    { name: 'Others', value: distribution.remaining, color: 'hsl(var(--chart-4))' },
  ] : [];

  // Prepare bar chart data for top holders
  const barData = holders.slice(0, 10).map((holder, index) => ({
    name: `#${index + 1}`,
    balance: holder.balance || 0,
    percentage: holder.percentage || 0,
  }));

  // Calculate concentration metrics
  const giniCoefficient = distribution ? 
    (distribution.top10Percentage > 50 ? 'High' : 
     distribution.top10Percentage > 30 ? 'Medium' : 'Low') : 'N/A';
  
  const whaleRisk = distribution?.top10Percentage > 60 ? 'High' : 
                    distribution?.top10Percentage > 40 ? 'Medium' : 'Low';

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-2 shadow-lg">
          <p className="text-sm font-medium">{payload[0].name}</p>
          <p className="text-sm text-muted-foreground">
            {(payload[0].value || 0).toFixed(2)}%
          </p>
        </div>
      );
    }
    return null;
  };

  const exportToCSV = () => {
    if (holders.length === 0) return;

    // Create CSV header
    const headers = ['Rank', 'Address', 'Balance', 'Percentage'];
    
    // Create CSV rows
    const rows = holders.map((holder, index) => [
      index + 1,
      holder.address,
      holder.balance,
      holder.percentage.toFixed(4)
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `token-holders-${mint}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total Holders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalHolders)}</div>
            <p className="text-xs text-muted-foreground mt-1">Active wallets</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Concentration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{giniCoefficient}</div>
            <p className="text-xs text-muted-foreground mt-1">Gini coefficient</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Whale Risk
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant={whaleRisk === 'High' ? 'destructive' : whaleRisk === 'Medium' ? 'default' : 'secondary'}>
                {whaleRisk}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Top 10 control</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Decentralization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {distribution ? (100 - distribution.top10Percentage).toFixed(1) : '0'}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Non-whale holdings</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Holder Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }: any) => `${name}: ${(percentage || 0).toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Holders Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Holders</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value: any) => [`${(value || 0).toFixed(2)}%`, 'Holdings']}
                />
                <Bar dataKey="percentage" fill="hsl(var(--chart-1))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Holder Concentration Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Concentration Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm">Top 10 Holders</span>
                <span className="text-sm font-medium">
                  {distribution ? distribution.top10Percentage.toFixed(2) : '0'}%
                </span>
              </div>
              <Progress value={distribution?.top10Percentage || 0} className="h-2" />
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm">Top 50 Holders</span>
                <span className="text-sm font-medium">
                  {distribution ? distribution.top50Percentage.toFixed(2) : '0'}%
                </span>
              </div>
              <Progress value={distribution?.top50Percentage || 0} className="h-2" />
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm">Top 100 Holders</span>
                <span className="text-sm font-medium">
                  {distribution ? distribution.top100Percentage.toFixed(2) : '0'}%
                </span>
              </div>
              <Progress value={distribution?.top100Percentage || 0} className="h-2" />
            </div>
          </div>

          {/* Risk Assessment */}
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Risk Assessment
            </h4>
            <div className="space-y-2 text-sm">
              {distribution?.top10Percentage > 60 && (
                <p className="text-red-500">
                  ⚠️ High concentration risk: Top 10 holders control over 60% of supply
                </p>
              )}
              {distribution?.top10Percentage > 40 && distribution?.top10Percentage <= 60 && (
                <p className="text-yellow-500">
                  ⚠️ Moderate concentration: Top 10 holders control {distribution.top10Percentage.toFixed(1)}% of supply
                </p>
              )}
              {distribution?.top10Percentage <= 40 && (
                <p className="text-green-500">
                  ✓ Good distribution: Token is well-distributed among holders
                </p>
              )}
              {totalHolders < 100 && (
                <p className="text-yellow-500">
                  ⚠️ Low holder count: Only {totalHolders} holders detected
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Holders Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Top Holders</CardTitle>
          <Button 
            onClick={exportToCSV} 
            disabled={holders.length === 0}
            size="sm"
            variant="outline"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Rank</th>
                  <th className="text-left p-2">Address</th>
                  <th className="text-right p-2">Balance</th>
                  <th className="text-right p-2">Percentage</th>
                </tr>
              </thead>
              <tbody>
                {holders.slice(0, 20).map((holder, index) => {
                  // Calculate background intensity based on rank
                  const getRowStyle = (rank: number) => {
                    if (rank === 1) {
                      return 'bg-primary/20 hover:bg-primary/25';
                    } else if (rank <= 3) {
                      return 'bg-primary/15 hover:bg-primary/20';
                    } else if (rank <= 10) {
                      return 'bg-primary/10 hover:bg-primary/15';
                    } else if (rank <= 20) {
                      return 'bg-primary/5 hover:bg-primary/10';
                    }
                    return 'hover:bg-muted/50';
                  };

                  return (
                    <tr 
                      key={holder.address} 
                      className={`border-b transition-colors ${getRowStyle(index + 1)}`}
                    >
                      <td className="p-2">
                        <Badge variant={index < 3 ? "default" : "outline"}>#{index + 1}</Badge>
                      </td>
                      <td className="p-2 font-mono text-xs">
                        <a 
                          href={`/account/${holder.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline cursor-pointer"
                        >
                          {holder.address.slice(0, 8)}...{holder.address.slice(-8)}
                        </a>
                      </td>
                      <td className="p-2 text-right font-semibold">{formatNumber(holder.balance)}</td>
                      <td className="p-2 text-right">
                        <Badge variant="secondary">{(holder.percentage || 0).toFixed(2)}%</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
