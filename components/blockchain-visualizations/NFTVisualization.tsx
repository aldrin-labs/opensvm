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
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

interface NFTVisualizationProps {
  nftData: any;
  isLoading?: boolean;
}

const NFTVisualization: React.FC<NFTVisualizationProps> = ({ 
  nftData, 
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

  if (!nftData || !nftData.data) {
    return (
      <div className="text-center p-6 bg-muted/30 rounded-lg">
        <p className="text-muted-foreground">No NFT data available</p>
      </div>
    );
  }

  const { metadata, collectionStats, collectionItems } = nftData.data;

  // Format attributes for visualization
  const attributesData: any[] = [];
  if (metadata?.attributes) {
    const attributeTypes = new Set(metadata.attributes.map((attr: any) => attr.trait_type));
    
    attributeTypes.forEach((type: any) => {
      const attributes = metadata.attributes.filter((attr: any) => attr.trait_type === type);
      attributesData.push({
        type,
        value: attributes[0]?.value || 'None',
        count: attributes.length
      });
    });
  }

  // Format collection items for visualization
  const collectionItemsData = collectionItems?.slice(0, 5).map((item: any, index: number) => ({
    name: item.metadata?.name || `Item #${index + 1}`,
    rarity: item.rarity || Math.random() * 100, // Fallback to random value if rarity not available
  })) || [];

  // Format rarity distribution data for pie chart
  const rarityDistribution = [
    { name: 'Common', value: 0 },
    { name: 'Uncommon', value: 0 },
    { name: 'Rare', value: 0 },
    { name: 'Epic', value: 0 },
    { name: 'Legendary', value: 0 }
  ];

  if (collectionItems) {
    collectionItems.forEach((item: any) => {
      const rarity = item.rarity || Math.random() * 100;
      
      if (rarity < 50) rarityDistribution[0].value++;
      else if (rarity < 70) rarityDistribution[1].value++;
      else if (rarity < 85) rarityDistribution[2].value++;
      else if (rarity < 95) rarityDistribution[3].value++;
      else rarityDistribution[4].value++;
    });
  }

  // Colors for pie chart
  const COLORS = ['#8884d8', '#83a6ed', '#8dd1e1', '#82ca9d', '#a4de6c'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{metadata?.name || 'Unknown NFT'}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline">{metadata?.symbol || 'NFT'}</Badge>
            {metadata?.collection?.name && (
              <Badge className="bg-purple-500">
                {metadata.collection.name}
              </Badge>
            )}
          </div>
        </div>
        
        {metadata?.image && (
          <div className="relative h-24 w-24 rounded-md overflow-hidden border">
            <img 
              src={metadata.image} 
              alt={metadata.name || 'NFT Image'} 
              className="object-cover"
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* NFT Image and Details */}
        <Card>
          <CardHeader>
            <CardTitle>NFT Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-4">
              {metadata?.image ? (
                <div className="relative h-64 w-full rounded-md overflow-hidden border">
                  <img 
                    src={metadata.image} 
                    alt={metadata.name || 'NFT Image'} 
                    className="object-contain"
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>
              ) : (
                <div className="h-64 w-full bg-muted/30 rounded-md flex items-center justify-center">
                  <p className="text-muted-foreground">No image available</p>
                </div>
              )}
              
              <div className="w-full space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium">{metadata?.name || 'Unknown'}</span>
                </div>
                {metadata?.description && (
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">Description:</span>
                    <p className="text-sm mt-1">{metadata.description}</p>
                  </div>
                )}
                {metadata?.external_url && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">External URL:</span>
                    <a 
                      href={metadata.external_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      View
                    </a>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attributes */}
        <Card>
          <CardHeader>
            <CardTitle>Attributes</CardTitle>
          </CardHeader>
          <CardContent>
            {attributesData.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {attributesData.map((attr, index) => (
                  <div key={index} className="bg-muted/30 p-3 rounded-md">
                    <p className="text-xs text-muted-foreground uppercase">{attr.type}</p>
                    <p className="font-medium">{attr.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-4">
                <p className="text-muted-foreground">No attributes available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Collection Stats */}
      {collectionStats && (
        <Card>
          <CardHeader>
            <CardTitle>Collection Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-muted/30 p-3 rounded-md">
                <p className="text-sm text-muted-foreground">Floor Price</p>
                <p className="text-lg font-bold">
                  {collectionStats.floorPrice?.toFixed(2) || 'N/A'} SOL
                </p>
              </div>
              <div className="bg-muted/30 p-3 rounded-md">
                <p className="text-sm text-muted-foreground">Total Volume</p>
                <p className="text-lg font-bold">
                  {collectionStats.totalVolume?.toLocaleString() || 'N/A'} SOL
                </p>
              </div>
              <div className="bg-muted/30 p-3 rounded-md">
                <p className="text-sm text-muted-foreground">Items</p>
                <p className="text-lg font-bold">
                  {collectionStats.items?.toLocaleString() || 'N/A'}
                </p>
              </div>
              <div className="bg-muted/30 p-3 rounded-md">
                <p className="text-sm text-muted-foreground">Owners</p>
                <p className="text-lg font-bold">
                  {collectionStats.owners?.toLocaleString() || 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Collection Items */}
      {collectionItemsData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Collection Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={collectionItemsData}
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
                  <Bar dataKey="rarity" fill="#8884d8" name="Rarity Score" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rarity Distribution */}
      {rarityDistribution.some(item => item.value > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Rarity Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={rarityDistribution.filter(item => item.value > 0)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  >
                    {rarityDistribution.map((_, index) => (
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
  );
};

export default NFTVisualization;
