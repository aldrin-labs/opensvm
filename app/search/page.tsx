// Modify existing search page to include AI enhancements
'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import EnhancedSearchBar from '@/components/EnhancedSearchBar';
import { Select } from '@/components/ui/select';
import { sanitizeSearchQuery, formatNumber, isValidSolanaAddress, isValidTransactionSignature } from '@/lib/utils';

// Helper functions for search result display
const getTypeLabel = (type: string): string => {
  const typeMap: Record<string, string> = {
    'transaction': 'Transaction',
    'tx': 'Transaction',
    'program': 'Program',
    'token': 'Token',
    'nft': 'NFT',
    'account': 'Account',
    'block': 'Block',
    'native': 'Native Token'
  };
  return typeMap[type.toLowerCase()] || type;
};

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
  return typeStyles[type.toLowerCase()] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
};

const getTypeIcon = (type: string, additionalClasses: string = ''): JSX.Element => {
  // Type-specific icons
  const className = `h-3.5 w-3.5 ${additionalClasses}`;
  
  switch(type.toLowerCase()) {
    case 'transaction':
    case 'tx':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      );
    case 'program':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      );
    case 'token':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'nft':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case 'account':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'block':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      );
    case 'native':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 8h6m-5 0a3 3 0 110 6H9l3 3m-3-6h6m6 1a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    default:
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
};

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
  
  // AI Response States
  const [aiResponse, setAiResponse] = useState<string>('');
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const [isAiStreaming, setIsAiStreaming] = useState<boolean>(false);
  const [aiStreamComplete, setAiStreamComplete] = useState<boolean>(false);
  const [aiSources, setAiSources] = useState<{title: string, url: string}[]>([]);
  const [showAiPanel, setShowAiPanel] = useState<boolean>(true);

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
  
  // AI Response Generation
  useEffect(() => {
    if (!query) return;
    
    // Reset AI states
    setAiResponse('');
    setAiSources([]);
    setAiStreamComplete(false);
    
    // Simulate AI thinking state
    setIsAiThinking(true);
    
    // Simulate API call delay
    const thinkingTimer = setTimeout(() => {
      setIsAiThinking(false);
      setIsAiStreaming(true);
      
      // Simulate streaming response
      let fullResponse = generateAiResponseForQuery(query);
      let currentIndex = 0;
      
      const streamInterval = setInterval(() => {
        if (currentIndex < fullResponse.length) {
          setAiResponse(prev => prev + fullResponse[currentIndex]);
          currentIndex++;
        } else {
          clearInterval(streamInterval);
          setIsAiStreaming(false);
          setAiStreamComplete(true);
          
          // Add sources after streaming completes
          setAiSources([
            { title: 'Solana Documentation', url: 'https://docs.solana.com' },
            { title: 'Solana Explorer', url: 'https://explorer.solana.com' },
            { title: 'OpenSVM GitHub', url: 'https://github.com/aldrin-labs/opensvm' }
          ]);
        }
      }, 15); // Stream characters at a natural typing speed
      
      return () => {
        clearTimeout(thinkingTimer);
        clearInterval(streamInterval);
      };
    }, 1500);
    
    return () => clearTimeout(thinkingTimer);
  }, [query]);
  
  // Function to generate a response based on the query
  const generateAiResponseForQuery = (query: string): string => {
    // This would be replaced with actual AI response generation
    return `Based on your search for "${query}", I found relevant information in the Solana blockchain.

The query appears to be related to ${query.includes('transaction') ? 'a transaction' : query.includes('token') ? 'a token' : 'an account or program'} on the Solana network.

Here's what you should know:
- Solana is a high-performance blockchain supporting smart contracts and decentralized applications
- Transactions on Solana are processed quickly with low fees
- The Solana Virtual Machine (SVM) executes programs written in Rust, C, and C++

For more detailed information, you can explore the search results below or check the provided sources.`;
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
                
                {/* Type Legend */}
                <div className="mt-8 border-t pt-4">
                  <h3 className="text-sm font-medium mb-2">Search Result Types</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { type: 'transaction', label: 'Transaction' },
                      { type: 'account', label: 'Account' },
                      { type: 'token', label: 'Token' },
                      { type: 'program', label: 'Program' },
                      { type: 'block', label: 'Block' },
                      { type: 'nft', label: 'NFT' }
                    ].map(item => (
                      <div key={item.type} className="flex items-center">
                        <div className={`w-2 h-2 rounded-full mr-2 ${getTypeStyles(item.type).split(' ')[0]}`}></div>
                        <div className="flex items-center">
                          {getTypeIcon(item.type, "mr-1.5 h-3 w-3")}
                          <span className="text-xs">{item.label}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
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
          
          {/* Search Source Tabs */}
          <div className="flex border rounded-lg overflow-hidden">
            <button className="px-3 py-1 bg-primary text-primary-foreground">SVM</button>
            <button className="px-3 py-1 hover:bg-muted transition-colors duration-200">Telegram</button>
            <button className="px-3 py-1 hover:bg-muted transition-colors duration-200">DuckDuckGo</button>
            <button className="px-3 py-1 hover:bg-muted transition-colors duration-200">X.com</button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            Page {searchState.currentPage} of {Math.ceil((searchResults?.length || 0) / searchState.itemsPerPage)}
          </span>
          <button
            onClick={() => handlePageChange(searchState.currentPage - 1)}
            disabled={searchState.currentPage === 1}
            className="px-3 py-1 rounded border disabled:opacity-50 transition-opacity duration-200"
          >
            Previous
          </button>
          <button
            onClick={() => handlePageChange(searchState.currentPage + 1)}
            disabled={searchState.currentPage >= Math.ceil((searchResults?.length || 0) / searchState.itemsPerPage)}
            className="px-3 py-1 rounded border disabled:opacity-50 transition-opacity duration-200"
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
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold">Results</h2>
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleSort('timestamp')}
                      className="flex items-center gap-1 px-2 py-1 rounded hover:bg-muted text-sm transition-colors duration-200"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Date {searchState.sortField === 'timestamp' && (searchState.sortDirection === 'asc' ? '↑' : '↓')}
                    </button>
                    <button
                      onClick={() => handleSort('amount')}
                      className="flex items-center gap-1 px-2 py-1 rounded hover:bg-muted text-sm transition-colors duration-200"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Amount {searchState.sortField === 'amount' && (searchState.sortDirection === 'asc' ? '↑' : '↓')}
                    </button>
                    <button
                      onClick={() => handleSort('type')}
                      className="flex items-center gap-1 px-2 py-1 rounded hover:bg-muted text-sm transition-colors duration-200"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      Type {searchState.sortField === 'type' && (searchState.sortDirection === 'asc' ? '↑' : '↓')}
                    </button>
                  </div>
                </div>
                
                {/* Results Summary */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-sm text-muted-foreground bg-muted/40 p-3 rounded-md">
                  <div className="flex flex-col sm:flex-row gap-1 sm:gap-4">
                    <div>
                      <span className="font-medium text-foreground">{searchResults?.length || 0}</span> results found
                    </div>
                    
                    <div className="hidden sm:block text-muted-foreground">|</div>
                    
                    <div className="flex gap-1 flex-wrap">
                      <span>Data types:</span>
                      {(['transactions', 'blocks', 'programs', 'tokens'] as const).map(type => {
                        const searchParams = new URLSearchParams(window.location.search);
                        const types = searchParams.get('types')?.split(',') || [];
                        const isActive = types.includes(type) || types.length === 0;
                        
                        return (
                          <span key={type} className={`${isActive ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                            {type}
                            {type !== 'tokens' && <span className="mx-0.5">·</span>}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div className="flex items-center">
                    <button 
                      onClick={() => {
                        // Find the enhanced search bar and toggle its settings
                        const settingsToggle = document.querySelector('.settings-toggle') as HTMLButtonElement;
                        if (settingsToggle) {
                          settingsToggle.click();
                        }
                      }}
                      className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                      </svg>
                      Refine search
                    </button>
                  </div>
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
                        className="border rounded-lg overflow-hidden transition-all duration-200 hover:shadow-md"
                      >
                        <div 
                          className="p-4 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
                          onClick={() => setExpandedRow(expandedRow === result.address ? null : result.address)}
                        >
                          {/* Type Indicator */}
                          <div className="flex items-center mb-2">
                            {result.type && (
                              <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${getTypeStyles(result.type)}`}>
                                {getTypeIcon(result.type)}
                                <span>{getTypeLabel(result.type)}</span>
                              </div>
                            )}
                            {result.status && (
                              <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                                result.status === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                              } transition-colors duration-200`}>
                                {result.status}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <div className="flex-1">
                              <div className="flex items-center">
                                <h3 className="font-medium text-sm mr-2">Address:</h3>
                                <p className="font-mono text-sm truncate">{result.address}</p>
                              </div>
                              {result.balance && (
                                <div className="flex items-center mt-1">
                                  <h3 className="font-medium text-sm mr-2">Balance:</h3>
                                  <p className="text-sm">{formatNumber(result.balance)} SOL</p>
                                </div>
                              )}
                              {result.timestamp && (
                                <div className="flex items-center mt-1">
                                  <h3 className="font-medium text-sm mr-2">Date:</h3>
                                  <p className="text-sm">{result.timestamp}</p>
                                </div>
                              )}
                            </div>
                            
                            <div className="flex flex-col items-end">
                              {result.amount && (
                                <div className="flex flex-col items-end">
                                  <span className="text-xs text-gray-500 dark:text-gray-400">Amount</span>
                                  <span className="text-sm font-medium">{formatNumber(result.amount)} SOL</span>
                                </div>
                              )}
                              <button 
                                className="mt-2 text-xs text-primary hover:underline flex items-center"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedRow(expandedRow === result.address ? null : result.address);
                                }}
                              >
                                {expandedRow === result.address ? 'Show less' : 'View details'}
                                <svg 
                                  xmlns="http://www.w3.org/2000/svg" 
                                  className={`ml-1 h-3 w-3 transition-transform ${expandedRow === result.address ? 'rotate-180' : ''}`} 
                                  fill="none" 
                                  viewBox="0 0 24 24" 
                                  stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        {/* Expanded Details */}
                        {expandedRow === result.address && (
                          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t animate-in fade-in-0 slide-in-from-top-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="p-3 bg-white dark:bg-gray-800 rounded-md shadow-sm">
                                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Timestamp</h4>
                                <p className="text-sm">{result.timestamp || 'N/A'}</p>
                              </div>
                              <div className="p-3 bg-white dark:bg-gray-800 rounded-md shadow-sm">
                                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Type</h4>
                                <p className="text-sm flex items-center">
                                  {result.type ? (
                                    <>
                                      {getTypeIcon(result.type, "mr-1")}
                                      {getTypeLabel(result.type)}
                                    </>
                                  ) : 'N/A'}
                                </p>
                              </div>
                              <div className="p-3 bg-white dark:bg-gray-800 rounded-md shadow-sm">
                                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Status</h4>
                                <p className="text-sm">
                                  {result.status ? (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                      result.status === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                                    }`}>
                                      {result.status === 'success' ? (
                                        <svg className="mr-1.5 h-2 w-2 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 8 8">
                                          <circle cx="4" cy="4" r="3" />
                                        </svg>
                                      ) : (
                                        <svg className="mr-1.5 h-2 w-2 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 8 8">
                                          <circle cx="4" cy="4" r="3" />
                                        </svg>
                                      )}
                                      {result.status}
                                    </span>
                                  ) : 'N/A'}
                                </p>
                              </div>
                              <div className="p-3 bg-white dark:bg-gray-800 rounded-md shadow-sm">
                                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Amount</h4>
                                <p className="text-sm">{result.amount ? `${formatNumber(result.amount)} SOL` : 'N/A'}</p>
                              </div>
                              
                              {/* View on Explorer Link */}
                              <div className="md:col-span-2 mt-2 flex justify-end">
                                <a 
                                  href={`https://explorer.solana.com/address/${result.address}`} 
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline flex items-center"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  View on Solana Explorer
                                  <svg className="ml-1 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                
                  {/* Type Legend for search results */}
                  <div className="mt-8 border-t pt-4">
                    <h3 className="text-sm font-medium mb-2">Search Result Types</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { type: 'transaction', label: 'Transaction' },
                        { type: 'account', label: 'Account' },
                        { type: 'token', label: 'Token' },
                        { type: 'program', label: 'Program' },
                        { type: 'block', label: 'Block' },
                        { type: 'nft', label: 'NFT' }
                      ].map(item => (
                        <div key={item.type} className="flex items-center">
                          <div className={`w-2 h-2 rounded-full mr-2 ${getTypeStyles(item.type).split(' ')[0]}`}></div>
                          <div className="flex items-center">
                            {getTypeIcon(item.type, "mr-1.5 h-3 w-3")}
                            <span className="text-xs">{item.label}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <div className="mx-auto w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium mb-2">No results found</h3>
                  <p className="text-muted-foreground max-w-md mx-auto mb-4">
                    We couldn't find any matching results for your search. Try adjusting your search terms or filters.  
                  </p>
                  <div className="text-sm text-muted-foreground">
                    <p className="mb-1">Try searching for:</p>
                    <ul className="list-disc list-inside space-y-1 text-left max-w-xs mx-auto">
                      <li>A specific transaction signature</li>
                      <li>A wallet address</li>
                      <li>A token name or symbol</li>
                      <li>A program ID</li>
                    </ul>
                  </div>
                </div>
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
