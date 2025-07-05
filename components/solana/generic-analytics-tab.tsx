'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, ExternalLink, Heart, TrendingUp, Users, Star, Target, DollarSign, Activity, BarChart3 } from 'lucide-react';

interface GenericItem {
  name: string;
  description: string;
  website: string;
  likes: number;
  [key: string]: any; // Allow additional properties
}

interface GenericTabProps {
  apiEndpoint: string;
  title: string;
  description: string;
  itemName: string; // e.g., "aggregators", "marketplaces"
  columns: Array<{
    key: string;
    label: string;
    format?: 'currency' | 'number' | 'percent' | 'text';
    icon?: any;
  }>;
  sortOptions: Array<{
    key: string;
    label: string;
  }>;
}

export function GenericAnalyticsTab({ 
  apiEndpoint, 
  title, 
  description, 
  itemName, 
  columns, 
  sortOptions 
}: GenericTabProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>(sortOptions[0]?.key || 'likes');
  const [likedItems, setLikedItems] = useState<Set<string>>(new Set());

  // Safe formatting functions
  const formatValue = (value: any, format: string = 'text'): string => {
    if (value == null || (typeof value === 'number' && isNaN(value))) {
      switch (format) {
        case 'currency':
          return '$0';
        case 'percent':
          return '0%';
        case 'number':
          return '0';
        default:
          return 'N/A';
      }
    }

    switch (format) {
      case 'currency':
        if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
        if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
        if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
        return `$${value.toFixed(0)}`;
      case 'number':
        if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
        if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
        return value.toString();
      case 'percent':
        return `${Math.max(0, Math.min(100, value)).toFixed(1)}%`;
      default:
        return value.toString();
    }
  };

  const handleLike = (itemName: string) => {
    const newLiked = new Set(likedItems);
    if (newLiked.has(itemName)) {
      newLiked.delete(itemName);
    } else {
      newLiked.add(itemName);
    }
    setLikedItems(newLiked);

    // Update the data with new like count
    if (data && data[itemName]) {
      const updatedItems = data[itemName].map((item: GenericItem) => {
        if (item.name === itemName) {
          return {
            ...item,
            likes: newLiked.has(itemName) ? item.likes + 1 : item.likes - 1
          };
        }
        return item;
      });
      setData({ ...data, [itemName]: updatedItems });
    }
  };

  const getSortedItems = () => {
    if (!data || !data[itemName]) return [];
    
    return [...data[itemName]].sort((a: any, b: any) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return bVal - aVal;
      }
      
      return String(bVal).localeCompare(String(aVal));
    });
  };

  const getSummaryCards = () => {
    if (!data || !data.summary) return [];
    
    const summary = data.summary;
    const cards = [];
    
    // Dynamic summary cards based on available data
    if (summary.totalActiveUsers !== undefined) {
      cards.push({
        icon: Users,
        label: 'Active Users',
        value: formatValue(summary.totalActiveUsers, 'number')
      });
    }
    
    if (summary.totalVolume24h !== undefined) {
      cards.push({
        icon: DollarSign,
        label: '24h Volume',
        value: formatValue(summary.totalVolume24h, 'currency')
      });
    }
    
    if (summary.totalTVL !== undefined) {
      cards.push({
        icon: TrendingUp,
        label: 'Total TVL',
        value: formatValue(summary.totalTVL, 'currency')
      });
    }
    
    if (summary.avgRating !== undefined) {
      cards.push({
        icon: Star,
        label: 'Avg Rating',
        value: summary.avgRating.toFixed(1)
      });
    }
    
    if (summary.totalPlatforms !== undefined) {
      cards.push({
        icon: Target,
        label: `Total ${title}`,
        value: summary.totalPlatforms.toString()
      });
    }
    
    return cards;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(apiEndpoint);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error(`Error fetching ${title.toLowerCase()} data:`, err);
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [apiEndpoint, title]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading {title.toLowerCase()} data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-destructive text-center py-8">
        Error loading {title.toLowerCase()} data: {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-muted-foreground text-center py-8">
        No {title.toLowerCase()} data available
      </div>
    );
  }

  const summaryCards = getSummaryCards();
  const sortedItems = getSortedItems();

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      {summaryCards.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {summaryCards.map((card, index) => (
            <div key={index} className="bg-card p-4 rounded-lg border">
              <div className="flex items-center space-x-2">
                <card.icon className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="text-xl font-bold">{card.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sort Controls */}
      <div className="flex flex-wrap gap-2">
        <span className="text-sm font-medium text-muted-foreground">Sort by:</span>
        {sortOptions.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              sortBy === key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Main Table */}
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Platform</th>
                {columns.map((col) => (
                  <th key={col.key} className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    {col.label}
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Likes</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item: any, index: number) => (
                <tr key={item.name} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                          <span className="text-sm font-bold text-primary">{index + 1}</span>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{item.name}</span>
                          {item.isVerified && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              Verified
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground max-w-xs truncate">{item.description}</p>
                        {item.category && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground mt-1">
                            {item.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-4">
                      <div className="flex items-center space-x-1">
                        {col.icon && <col.icon className="h-4 w-4 text-muted-foreground" />}
                        <span className="font-medium">
                          {formatValue(item[col.key], col.format)}
                        </span>
                      </div>
                    </td>
                  ))}
                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-2">
                      <Heart 
                        className={`h-4 w-4 cursor-pointer transition-colors ${
                          likedItems.has(item.name) 
                            ? 'text-red-500 fill-current' 
                            : 'text-muted-foreground hover:text-red-500'
                        }`}
                        onClick={() => handleLike(item.name)}
                      />
                      <span className="text-sm font-medium">{item.likes}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <a
                      href={item.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1 text-sm text-primary hover:text-primary/80 transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>Visit</span>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}