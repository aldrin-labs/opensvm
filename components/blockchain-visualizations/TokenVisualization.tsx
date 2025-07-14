'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AreaChart, 
  Area, 
  BarChart,
  Bar,
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

interface TokenVisualizationProps {
  tokenData: any;
  isLoading?: boolean;
}

const TokenVisualization: React.FC<TokenVisualizationProps> = ({ 
  tokenData, 
  isLoading = false 
}) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-[200px] w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-[150px] w-full" />
          <Skeleton className="h-[150px] w-full" />
        </div>
      </div>
    );
  }

  if (!tokenData || !tokenData.data) {
    return (
      <div className="text-center p-6 bg-muted/30 rounded-lg">
        <p className="text-muted-foreground">No token data available</p>
      </div>
    );
  }

  const { metadata, price, historicalPrice, holders, stats } = tokenData.data;

  // Format historical price data for chart
  const priceChartData = historicalPrice?.map((dataPoint: any) => ({
    date: new Date(dataPoint.date).toLocaleDateString(),
    price: dataPoint.price,
  })) || [];

  // Format top holders data for chart
  const holdersData = holders?.slice(0, 5).map((holder: any) => ({
    address: holder.address.substring(0, 6) + '...' + holder.address.substring(holder.address.length - 4),
    amount: parseFloat(holder.amount),
  })) || [];

  // Format token distribution data for pie chart
  const distributionData = [];
  
  if (holders) {
    // Calculate total supply
    const totalSupply = holders.reduce((sum: number, holder: any) => sum + parseFloat(holder.amount), 0);
    
    // Top 5 holders
    const top5Amount = holders.slice(0, 5).reduce((sum: number, holder: any) => sum + parseFloat(holder.amount), 0);
    
    // Next 15 holders
    const next15Amount = holders.slice(5, 20).reduce((sum: number, holder: any) => sum + parseFloat(holder.amount), 0);
    
    // Rest of holders
    const restAmount = totalSupply - top5Amount - next15Amount;
    
    distributionData.push(
      { name: 'Top 5 Holders', value: top5Amount },
      { name: 'Next 15 Holders', value: next15Amount },
      { name: 'Other Holders', value: restAmount }
    );
  }

  // Colors for pie chart
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{metadata?.name || 'Unknown Token'}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline">{metadata?.symbol || '???'}</Badge>
            {price && (
              <Badge className={price.usdPrice > 0 ? 'bg-green-500' : 'bg-red-500'}>
                ${price.usdPrice?.toFixed(6) || '0.00'}
              </Badge>
            )}
          </div>
        </div>
        
        {price && (
          <div className="text-right">
            <p className="text-sm text-muted-foreground">24h Change</p>
            <p className={`text-lg font-bold ${(price['24hrChange'] || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {price['24hrChange']?.toFixed(2) || '0.00'}%
            </p>
          </div>
        )}
      </div>

      {/* Price History Chart */}
      {priceChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Price History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={priceChartData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area 
                    type="monotone" 
                    dataKey="price" 
                    stroke="#8884d8" 
                    fill="#8884d8" 
                    fillOpacity={0.3} 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Holders Chart */}
        {holdersData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Top Holders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={holdersData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 50 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="address" 
                      angle={-45} 
                      textAnchor="end" 
                      height={60} 
                    />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="amount" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Token Distribution Pie Chart */}
        {distributionData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Token Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distributionData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    >
                      {distributionData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Token Stats */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Token Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-muted/30 p-3 rounded-md">
                <p className="text-sm text-muted-foreground">Market Cap</p>
                <p className="text-lg font-bold">
                  ${stats.marketCap?.toLocaleString() || 'N/A'}
                </p>
              </div>
              <div className="bg-muted/30 p-3 rounded-md">
                <p className="text-sm text-muted-foreground">24h Volume</p>
                <p className="text-lg font-bold">
                  ${stats.volume24h?.toLocaleString() || 'N/A'}
                </p>
              </div>
              <div className="bg-muted/30 p-3 rounded-md">
                <p className="text-sm text-muted-foreground">Circulating Supply</p>
                <p className="text-lg font-bold">
                  {stats.circulatingSupply?.toLocaleString() || 'N/A'}
                </p>
              </div>
              <div className="bg-muted/30 p-3 rounded-md">
                <p className="text-sm text-muted-foreground">Total Holders</p>
                <p className="text-lg font-bold">
                  {holders?.length.toLocaleString() || 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TokenVisualization;
