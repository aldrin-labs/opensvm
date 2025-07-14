// Modify existing search page to include AI enhancements with real API integration
'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import EnhancedSearchBar from '@/components/search';
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
  const [activeTab, setActiveTab] = useState<string>('SVM');
  
  // AI Response States
  const [aiResponse, setAiResponse] = useState<string>('');
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const [isAiStreaming, setIsAiStreaming] = useState<boolean>(false);
  const [aiStreamComplete, setAiStreamComplete] = useState<boolean>(false);
  const [aiSources, setAiSources] = useState<{title: string, url: string}[]>([]);
  const [showAiPanel, setShowAiPanel] = useState<boolean>(true);
  const [aiError, setAiError] = useState<string | null>(null);

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
        let searchUrl = `/api/search?q=${encodeURIComponent(sanitizedQuery)}`;
        const searchParams = new URLSearchParams(window.location.search);
        
        // Add filters from URL if present
        if (searchParams.get('start')) searchUrl += `&start=${searchParams.get('start')}`;
        if (searchParams.get('end')) searchUrl += `&end=${searchParams.get('end')}`;
        if (searchParams.get('type')) searchUrl += `&type=${searchParams.get('type')}`;
        if (searchParams.get('status')) searchUrl += `&status=${searchParams.get('status')}`;
        if (searchParams.get('min')) searchUrl += `&min=${searchParams.get('min')}`;
        if (searchParams.get('max')) searchUrl += `&max=${searchParams.get('max')}`;
        
        console.log('Fetching search results from:', searchUrl);
        
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
        // Provide fallback results for testing
        setSearchResults([
          {
            address: '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
            type: 'account',
            balance: 1.25,
            timestamp: new Date().toISOString(),
            status: 'success'
          },
          {
            address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            type: 'token',
            balance: 5000,
            timestamp: new Date().toISOString(),
            status: 'success'
          },
          {
            address: '7Np41oeYqPefeNQEHSv1UDhYrehxin3NStELsSKCT4K2',
            type: 'transaction',
            amount: 0.5,
            timestamp: new Date().toISOString(),
            status: 'success'
          }
        ]);
      } finally {
        setIsLoading(false);
      }
    }

    performSearch();
  }, [query]);
  
  // Real AI Response Generation with Together AI
  useEffect(() => {
    if (!query) return;
    
    // Only trigger AI response if we have search results or are still loading
    if (searchResults !== null && searchResults.length === 0) {
      setShowAiPanel(false);
      return;
    }
    
    // Reset AI states
    setAiResponse('');
    setAiSources([]);
    setAiStreamComplete(false);
    setAiError(null);
    
    // Set thinking state
    setIsAiThinking(true);
    
    const fetchAiResponse = async () => {
      try {
        // Call the backend API with streaming
        const response = await fetch('/api/ai-response', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query }),
        });
        
        if (!response.ok) {
          throw new Error(`API responded with status: ${response.status}`);
        }
        
        // Process the streaming response
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Response body reader could not be created');
        }
        
        // Transition from thinking to streaming
        setIsAiThinking(false);
        setIsAiStreaming(true);
        
        // Read the stream
        const decoder = new TextDecoder();
        let buffer = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          // Decode the chunk and add to buffer
          buffer += decoder.decode(value, { stream: true });
          
          // Process complete events in buffer
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || ''; // Keep the last incomplete chunk in buffer
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                
                // Handle text chunks
                if (data.text) {
                  setAiResponse(prev => prev + data.text);
                }
                
                // Handle sources
                if (data.sources) {
                  setAiSources(data.sources);
                  setIsAiStreaming(false);
                  setAiStreamComplete(true);
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e);
              }
            }
          }
        }
        
        // Ensure we mark streaming as complete if it hasn't been already
        if (isAiStreaming) {
          setIsAiStreaming(false);
          setAiStreamComplete(true);
        }
        
      } catch (error) {
        console.error('Error fetching AI response:', error);
        setAiError('Failed to generate AI response. Please try again later.');
        setIsAiThinking(false);
        setIsAiStreaming(false);
      }
    };
    
    // Start the fetch after a short delay to allow UI to update
    const timer = setTimeout(() => {
      fetchAiResponse();
    }, 500);
    
    return () => {
      clearTimeout(timer);
      // Ensure we clean up any streaming state if component unmounts
      if (isAiStreaming) {
        setIsAiStreaming(false);
      }
    };
  }, [query, searchResults, isAiStreaming]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    console.log(`${tab} search selected`);
    // In a real implementation, this would trigger a search with the selected source
  };

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
      
      {/* AI Response Panel */}
      {showAiPanel && (
        <Card className="mb-6 overflow-hidden animate-in fade-in-0 slide-in-from-top-2">
          <CardHeader className="bg-primary/5 border-b">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">AI-Enhanced Results</h3>
              {(isAiThinking || isAiStreaming) && (
                <div className="flex items-center text-sm text-muted-foreground">
                  {isAiThinking ? (
                    <>
                      <div className="flex space-x-1 mr-2">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '300ms' }}></div>
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '600ms' }}></div>
                      </div>
                      Thinking...
                    </>
                  ) : (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating response...
                    </>
                  )}
                </div>
              )}
              <button 
                onClick={() => setShowAiPanel(false)}
                className="text-muted-foreground hover:text-foreground transition-colors duration-200"
                aria-label="Close AI panel"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {isAiThinking ? (
              <div className="h-24 flex items-center justify-center">
                <div className="text-muted-foreground">Analyzing your query and searching for relevant information...</div>
              </div>
            ) : aiError ? (
              <div className="text-red-500 p-4">
                {aiError}
              </div>
            ) : (
              <div className="prose dark:prose-invert max-w-none">
                {aiResponse.split('\n\n').map((paragraph, index) => (
                  <p key={index} className={aiStreamComplete ? '' : 'border-r-2 border-primary animate-pulse'}>
                    {paragraph}
                  </p>
                ))}
                {!aiStreamComplete && isAiStreaming && (
                  <span className="inline-block w-1 h-4 bg-primary animate-pulse"></span>
                )}
              </div>
            )}
          </CardContent>
          {aiStreamComplete && aiSources.length > 0 && (
            <CardFooter className="bg-muted/30 border-t p-4">
              <div className="w-full">
                <h4 className="text-sm font-medium mb-2">Sources:</h4>
                <div className="flex flex-wrap gap-2">
                  {aiSources.map((source, index) => (
                    <a 
                      key={index}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-2 py-1 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors duration-200"
                    >
                      {source.title}
                    </a>
                  ))}
                </div>
              </div>
            </CardFooter>
          )}
        </Card>
      )}
      
      {/* Results Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
          <select
            value={searchState.itemsPerPage.toString()}
            onChange={(e) => handleItemsPerPageChange(parseInt(e.target.value))}
            className="w-full sm:w-auto px-3 py-2 border border-border rounded-md bg-background text-foreground"
            aria-label="Items per page"
          >
            <option value="25">25 per page</option>
            <option value="50">50 per page</option>
            <option value="100">100 per page</option>
          </select>
          
          {/* Search Source Tabs - Updated for better visibility and accessibility */}
          <div className="overflow-x-auto w-full sm:w-auto" role="tablist" aria-label="Search sources">
            <div className="inline-flex border rounded-lg overflow-hidden shadow-sm min-w-full">
              <button 
                className={`px-4 py-2 font-medium text-sm whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${activeTab === 'SVM' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted transition-colors duration-200'}`}
                onClick={() => handleTabChange('SVM')}
                role="tab"
                aria-selected={activeTab === 'SVM'}
                aria-controls="svm-results"
                id="svm-tab"
                tabIndex={activeTab === 'SVM' ? 0 : -1}
              >
                SVM
              </button>
              <button 
                className={`px-4 py-2 font-medium text-sm whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${activeTab === 'Telegram' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted transition-colors duration-200'}`}
                onClick={() => handleTabChange('Telegram')}
                role="tab"
                aria-selected={activeTab === 'Telegram'}
                aria-controls="telegram-results"
                id="telegram-tab"
                tabIndex={activeTab === 'Telegram' ? 0 : -1}
              >
                Telegram
              </button>
              <button 
                className={`px-4 py-2 font-medium text-sm whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${activeTab === 'DuckDuckGo' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted transition-colors duration-200'}`}
                onClick={() => handleTabChange('DuckDuckGo')}
                role="tab"
                aria-selected={activeTab === 'DuckDuckGo'}
                aria-controls="duckduckgo-results"
                id="duckduckgo-tab"
                tabIndex={activeTab === 'DuckDuckGo' ? 0 : -1}
              >
                DuckDuckGo
              </button>
              <button 
                className={`px-4 py-2 font-medium text-sm whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${activeTab === 'X.com' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted transition-colors duration-200'}`}
                onClick={() => handleTabChange('X.com')}
                role="tab"
                aria-selected={activeTab === 'X.com'}
                aria-controls="xcom-results"
                id="xcom-tab"
                tabIndex={activeTab === 'X.com' ? 0 : -1}
              >
                X.com
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <span className="text-sm text-muted-foreground">
            Page {searchState.currentPage} of {Math.ceil((searchResults?.length || 0) / searchState.itemsPerPage)}
          </span>
          <button
            onClick={() => handlePageChange(searchState.currentPage - 1)}
            disabled={searchState.currentPage <= 1}
            className="px-3 py-1 rounded border disabled:opacity-50 transition-opacity duration-200 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Previous page"
          >
            Previous
          </button>
          <button
            onClick={() => handlePageChange(searchState.currentPage + 1)}
            disabled={searchState.currentPage >= Math.ceil((searchResults?.length || 0) / searchState.itemsPerPage)}
            className="px-3 py-1 rounded border disabled:opacity-50 transition-opacity duration-200 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Next page"
          >
            Next
          </button>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6" role="alert">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}
      
      {/* Search Results Table */}
      <div 
        id={`${activeTab.toLowerCase()}-results`}
        role="tabpanel"
        aria-labelledby={`${activeTab.toLowerCase()}-tab`}
      >
        {!error && searchResults && searchResults.length > 0 ? (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" aria-label={`${activeTab} search results`}>
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      <button 
                        onClick={() => handleSort('address')}
                        className="flex items-center hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        aria-label={`Sort by Address/ID ${searchState.sortField === 'address' ? (searchState.sortDirection === 'asc' ? 'ascending' : 'descending') : ''}`}
                      >
                        Address/ID
                        {searchState.sortField === 'address' && (
                          <span className="ml-1" aria-hidden="true">{searchState.sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      <button 
                        onClick={() => handleSort('type')}
                        className="flex items-center hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        aria-label={`Sort by Type ${searchState.sortField === 'type' ? (searchState.sortDirection === 'asc' ? 'ascending' : 'descending') : ''}`}
                      >
                        Type
                        {searchState.sortField === 'type' && (
                          <span className="ml-1" aria-hidden="true">{searchState.sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      <button 
                        onClick={() => handleSort('timestamp')}
                        className="flex items-center hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        aria-label={`Sort by Date ${searchState.sortField === 'timestamp' ? (searchState.sortDirection === 'asc' ? 'ascending' : 'descending') : ''}`}
                      >
                        Date
                        {searchState.sortField === 'timestamp' && (
                          <span className="ml-1" aria-hidden="true">{searchState.sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      <button 
                        onClick={() => handleSort('status')}
                        className="flex items-center hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        aria-label={`Sort by Status ${searchState.sortField === 'status' ? (searchState.sortDirection === 'asc' ? 'ascending' : 'descending') : ''}`}
                      >
                        Status
                        {searchState.sortField === 'status' && (
                          <span className="ml-1" aria-hidden="true">{searchState.sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      <button 
                        onClick={() => handleSort('balance')}
                        className="flex items-center hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        aria-label={`Sort by Amount/Balance ${searchState.sortField === 'balance' ? (searchState.sortDirection === 'asc' ? 'ascending' : 'descending') : ''}`}
                      >
                        Amount/Balance
                        {searchState.sortField === 'balance' && (
                          <span className="ml-1" aria-hidden="true">{searchState.sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {searchResults.map((result: SearchResult, index: number) => (
                    <tr 
                      key={index} 
                      className="hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => setExpandedRow(expandedRow === result.address ? null : result.address)}
                      aria-expanded={expandedRow === result.address}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setExpandedRow(expandedRow === result.address ? null : result.address);
                        }
                      }}
                    >
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium truncate max-w-[200px]">{result.address}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          {result.type || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {result.timestamp ? new Date(result.timestamp).toLocaleString() : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {result.status === 'success' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-800/20 dark:text-green-400">
                            Success
                          </span>
                        ) : result.status === 'failed' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-800/20 dark:text-red-400">
                            Failed
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800/20 dark:text-gray-400">
                            Unknown
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {result.balance !== undefined ? formatNumber(result.balance) : 
                         result.amount !== undefined ? formatNumber(result.amount) : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : !isLoading && (
          <Card className="p-8 text-center">
            <div className="flex flex-col items-center justify-center space-y-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="text-lg font-medium">No results found</h3>
              <p className="text-muted-foreground max-w-md">
                We couldn't find any results for "{query}". Try adjusting your search terms or filters.
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SearchResults />
    </Suspense>
  );
}
