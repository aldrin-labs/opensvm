'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import EnhancedSearchBar from '@/components/EnhancedSearchBar';
import { Select } from '@/components/ui/select';
import { sanitizeSearchQuery, formatNumber, isValidSolanaAddress, isValidTransactionSignature } from '@/lib/utils';

interface SearchResult {
  address: string;
  balance?: number;
  type?: string;
  timestamp?: string;
  status?: 'success' | 'failed';
  amount?: number;
}

interface SearchState {
  currentPage: number;
  itemsPerPage: number;
  sortField: string;
  sortDirection: 'asc' | 'desc';
}

function SearchResults() {
  const [searchState, setSearchState] = useState<SearchState>({
    currentPage: 1,
    itemsPerPage: 25,
    sortField: 'timestamp',
    sortDirection: 'desc'
  });
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const query = searchParams?.get('q') || '';
  const router = useRouter();
  const [searchResults, setSearchResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Handle redirects on mount
  useEffect(() => {
    async function handleRedirect() {
      if (!query) return;

      setIsLoading(true);
      try {
        // Check if query is a block number
        if (/^\d+$/.test(query)) {
          router.push(`/block/${query}`);
          return;
        }
        
        // Check if query is a transaction signature (88 chars)
        if (isValidTransactionSignature(query)) {
          router.push(`/tx/${query}`);
          return;
        }
        
        // Check if query is a valid Solana address
        if (isValidSolanaAddress(query)) {
          try {
            // Check account type using API
            const response = await fetch(`/api/check-account-type?address=${encodeURIComponent(query)}`);
            const data = await response.json();
            
            switch (data.type) {
              case 'token':
                console.log('Redirecting to token page:', query);
                router.push(`/token/${query}`);
                return;
              case 'program':
                console.log('Redirecting to program page:', query);
                router.push(`/program/${query}`);
                return;
              case 'account':
              default:
                console.log('Redirecting to account page:', query);
                router.push(`/account/${query}`);
                return;
            }
          } catch (error) {
            console.error('Error checking account type:', error);
            // On error, default to account page
            router.push(`/account/${query}`);
            return;
          }
        }
      } finally {
        setIsLoading(false);
      }
    }

    handleRedirect();
  }, [query, router]);
  
  // Handle general search
  useEffect(() => {
    async function performSearch() {
      if (!query) {
        setSearchResults(null);
        return;
      }

      const sanitizedQuery = sanitizeSearchQuery(query);
      if (!sanitizedQuery) {
        setSearchResults(null);
        return;
      }

      try {
        setIsLoading(true);
        
        // Build URL with filters
        let searchUrl = `/api/search/filtered?q=${encodeURIComponent(sanitizedQuery)}`;
        const searchParams = new URLSearchParams(window.location.search);
        
        // Add filters from URL if present
        if (searchParams.get('start')) searchUrl += `&start=${searchParams.get('start')}`;
        if (searchParams.get('end')) searchUrl += `&end=${searchParams.get('end')}`;
        if (searchParams.get('type')) searchUrl += `&type=${searchParams.get('type')}`;
        if (searchParams.get('status')) searchUrl += `&status=${searchParams.get('status')}`;
        if (searchParams.get('min')) searchUrl += `&min=${searchParams.get('min')}`;
        if (searchParams.get('max')) searchUrl += `&max=${searchParams.get('max')}`;
        
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
    }

    performSearch();
  }, [query]);

  if (!query) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Please enter a search query</h1>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Loading...</h1>
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Loading Results</h2>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSort = (field: string) => {
    setSearchState(prev => ({
      ...prev,
      sortField: field,
      sortDirection: prev.sortField === field && prev.sortDirection === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handlePageChange = (page: number) => {
    setSearchState(prev => ({
      ...prev,
      currentPage: page
    }));
  };

  const handleItemsPerPageChange = (items: number) => {
    setSearchState(prev => ({
      ...prev,
      itemsPerPage: items,
      currentPage: 1
    }));
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <EnhancedSearchBar />
      </div>
      
      <h1 className="text-2xl font-bold mb-6">Search Results for "{query}"</h1>
      
      {/* Results Controls */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <Select
            value={searchState.itemsPerPage.toString()}
            onChange={(e) => handleItemsPerPageChange(parseInt(e.target.value))}
          >
            <option value="25">25 per page</option>
            <option value="50">50 per page</option>
            <option value="100">100 per page</option>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            Page {searchState.currentPage} of {Math.ceil((searchResults?.length || 0) / searchState.itemsPerPage)}
          </span>
          <button
            onClick={() => handlePageChange(searchState.currentPage - 1)}
            disabled={searchState.currentPage === 1}
            className="px-3 py-1 rounded border disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => handlePageChange(searchState.currentPage + 1)}
            disabled={searchState.currentPage >= Math.ceil((searchResults?.length || 0) / searchState.itemsPerPage)}
            className="px-3 py-1 rounded border disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
      
      {error ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Results</h2>
                <div className="flex gap-4">
                  <button
                    onClick={() => handleSort('timestamp')}
                    className="text-sm text-gray-500 hover:text-gray-900"
                  >
                    Date {searchState.sortField === 'timestamp' && (searchState.sortDirection === 'asc' ? '↑' : '↓')}
                  </button>
                  <button
                    onClick={() => handleSort('amount')}
                    className="text-sm text-gray-500 hover:text-gray-900"
                  >
                    Amount {searchState.sortField === 'amount' && (searchState.sortDirection === 'asc' ? '↑' : '↓')}
                  </button>
                  <button
                    onClick={() => handleSort('type')}
                    className="text-sm text-gray-500 hover:text-gray-900"
                  >
                    Type {searchState.sortField === 'type' && (searchState.sortDirection === 'asc' ? '↑' : '↓')}
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {searchResults?.error ? (
                <p className="text-red-500">{searchResults.error}</p>
              ) : searchResults?.length ? (
                <div className="space-y-4">
                  {searchResults
                    .sort((a: SearchResult, b: SearchResult) => {
                      const aValue = a[searchState.sortField as keyof SearchResult];
                      const bValue = b[searchState.sortField as keyof SearchResult];
                      if (!aValue || !bValue) return 0;
                      return searchState.sortDirection === 'asc' 
                        ? aValue > bValue ? 1 : -1
                        : aValue < bValue ? 1 : -1;
                    })
                    .slice(
                      (searchState.currentPage - 1) * searchState.itemsPerPage,
                      searchState.currentPage * searchState.itemsPerPage
                    )
                    .map((result: SearchResult) => (
                      <div 
                        key={result.address}
                        className="border rounded-lg overflow-hidden"
                      >
                        <div 
                          className="p-4 cursor-pointer hover:bg-gray-50"
                          onClick={() => setExpandedRow(expandedRow === result.address ? null : result.address)}
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex-1">
                              <p className="font-mono text-sm">{result.address}</p>
                              {result.balance && (
                                <p className="text-sm text-gray-500">Balance: {formatNumber(result.balance)} SOL</p>
                              )}
                            </div>
                            <div className="flex items-center gap-4">
                              {result.type && (
                                <span className="px-2 py-1 text-xs rounded bg-gray-100">{result.type}</span>
                              )}
                              {result.status && (
                                <span className={`px-2 py-1 text-xs rounded ${
                                  result.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {result.status}
                                </span>
                              )}
                              {result.amount && (
                                <span className="text-sm font-medium">{formatNumber(result.amount)} SOL</span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Expanded Details */}
                        {expandedRow === result.address && (
                          <div className="p-4 bg-gray-50 border-t">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <h4 className="text-sm font-medium text-gray-500">Timestamp</h4>
                                <p className="text-sm">{result.timestamp || 'N/A'}</p>
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-gray-500">Type</h4>
                                <p className="text-sm">{result.type || 'N/A'}</p>
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-gray-500">Status</h4>
                                <p className="text-sm">{result.status || 'N/A'}</p>
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-gray-500">Amount</h4>
                                <p className="text-sm">{result.amount ? `${formatNumber(result.amount)} SOL` : 'N/A'}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-gray-500">No results found</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold mb-6">Loading...</h1>
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Loading Results</h2>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        </div>
      }
    >
      <SearchResults />
    </Suspense>
  );
}