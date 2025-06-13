"use client";

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface SearchResult {
  address: string;
  type?: string;
  timestamp?: string;
  status?: 'success' | 'failed';
  amount?: number;
  network?: string;
}

interface SearchResultsTabProps {
  address: string;
}

export default function SearchResultsTab({ address }: SearchResultsTabProps) {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<string>('');
  const [searchSettings, setSearchSettings] = useState<any>({});

  useEffect(() => {
    // Retrieve search query and settings from localStorage
    const storedQuery = localStorage.getItem('lastSearchQuery');
    const storedSettings = localStorage.getItem('searchSettings');
    
    if (storedQuery) {
      setQuery(storedQuery);
    }
    
    if (storedSettings) {
      try {
        setSearchSettings(JSON.parse(storedSettings));
      } catch (e) {
        console.error('Error parsing search settings:', e);
      }
    }
    
    const fetchSearchResults = async () => {
      if (!storedQuery) {
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        
        // Build URL with filters
        let searchUrl = `/api/search/filtered?q=${encodeURIComponent(storedQuery)}`;
        
        // Add networks if available
        if (searchSettings.networks && searchSettings.networks.length > 0) {
          searchUrl += `&networks=${searchSettings.networks.join(',')}`;
        }
        
        // Add data types if available
        if (searchSettings.dataTypes && searchSettings.dataTypes.length > 0) {
          searchUrl += `&types=${searchSettings.dataTypes.join(',')}`;
        }
        
        // Add sort options
        if (searchSettings.sortBy) {
          searchUrl += `&sortBy=${searchSettings.sortBy}`;
        }
        
        if (searchSettings.sortOrder) {
          searchUrl += `&sortOrder=${searchSettings.sortOrder}`;
        }
        
        const response = await fetch(searchUrl);
        if (!response.ok) throw new Error('Failed to fetch results');
        const results = await response.json();
        
        if (results.error) {
          setError(results.error);
          setSearchResults([]);
        } else {
          setSearchResults(results);
          setError(null);
        }
      } catch (e) {
        setError('Failed to perform search');
        console.error(e);
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSearchResults();
  }, []);

  // Helper function to get badge color based on type
  const getTypeStyles = (type: string): string => {
    const typeStyles: Record<string, string> = {
      'transaction': 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      'tx': 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      'program': 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
      'token': 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      'nft': 'bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-400',
      'account': 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
      'block': 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
      'native': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400'
    };
    return typeStyles[type?.toLowerCase()] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
  };

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Search Results</h2>
          <p className="text-sm text-muted-foreground">Loading results from your search...</p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="p-4">
                <Skeleton className="h-6 w-1/3" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Search Results</h2>
          <p className="text-sm text-muted-foreground">Error loading search results</p>
        </div>
        <Card className="bg-red-50 dark:bg-red-900/10">
          <CardContent className="p-4">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!query || searchResults.length === 0) {
    return (
      <div className="w-full">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Search Results</h2>
          <p className="text-sm text-muted-foreground">No search results available</p>
        </div>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-muted-foreground">No results found for your search.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Search Results</h2>
        <p className="text-sm text-muted-foreground">
          Showing results for "{query}" 
          {searchSettings.networks && searchSettings.networks.length > 0 && 
            ` on ${searchSettings.networks.join(', ')}`}
        </p>
      </div>
      
      <div className="space-y-4">
        {searchResults.map((result, index) => (
          <Card key={index} className="overflow-hidden">
            <CardHeader className="p-4 bg-muted/30">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <h3 className="font-medium truncate">
                    {result.address.substring(0, 8)}...{result.address.substring(result.address.length - 8)}
                  </h3>
                  {result.type && (
                    <Badge className={getTypeStyles(result.type)}>
                      {result.type}
                    </Badge>
                  )}
                  {result.network && (
                    <Badge variant="outline">
                      {result.network}
                    </Badge>
                  )}
                </div>
                {result.timestamp && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(result.timestamp).toLocaleString()}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {result.status && (
                  <div>
                    <p className="text-xs text-muted-foreground">Status:</p>
                    <p className={`text-sm font-medium ${
                      result.status === 'success' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {result.status.charAt(0).toUpperCase() + result.status.slice(1)}
                    </p>
                  </div>
                )}
                {result.amount !== undefined && (
                  <div>
                    <p className="text-xs text-muted-foreground">Amount:</p>
                    <p className="text-sm font-medium">{result.amount}</p>
                  </div>
                )}
              </div>
              <div className="mt-2">
                <a 
                  href={`/${result.type?.toLowerCase() || 'account'}/${result.address}`}
                  className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  View details →
                </a>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
