'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { isValidTransactionSignature, isValidSolanaAddress } from '@/lib/utils';
import { SearchInput } from './SearchInput';
import { SearchButton } from './SearchButton';
import { SearchSettings } from './SearchSettings';
import { SearchSuggestions } from './SearchSuggestions';
import { SearchSettings as SearchSettingsType, SearchSuggestion } from './types';

export default function EnhancedSearchBar() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [searchSettings, setSearchSettings] = useState<SearchSettingsType>({
    networks: ['solana'], // Default to Solana network
    dataTypes: ['transactions', 'blocks', 'programs', 'tokens'], // Default to all data types
    sortBy: 'relevance',
    sortOrder: 'desc',
  });
  const router = useRouter();
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Close suggestions and settings on outside click
    function handleClickOutside(event: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node) && 
          !(event.target as HTMLElement).closest('.settings-toggle')) {
        setShowSettings(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (query.length < 3 || searchSettings.networks.length === 0) {
        setSuggestions([]);
        return;
      }

      try {
        // Fetch suggestions based on the query and selected networks
        const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}&networks=${searchSettings.networks.join(',')}`);
        if (!response.ok) { throw new Error('Failed to fetch suggestions'); }
        const data = await response.json();
        setSuggestions(data);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        setSuggestions([]);
      }
    };

    const debounceTimeout = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounceTimeout);
  }, [query, searchSettings.networks]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery || isLoading) {
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Check if query is a block number
      if (/^\d+$/.test(trimmedQuery)) {
        router.push(`/block/${trimmedQuery}`);
        return;
      }
      
      // Check if query is a transaction signature
      if (isValidTransactionSignature(trimmedQuery)) {
        window.location.href = `/tx/${trimmedQuery}`;
        return;
      }
      
      // Check if query is a valid Solana address
      if (isValidSolanaAddress(trimmedQuery)) {
        const response = await fetch(`/api/check-account-type?address=${encodeURIComponent(trimmedQuery)}`);
        const data = await response.json();
        
        // Store search results in localStorage for the destination page to access
        localStorage.setItem('lastSearchQuery', trimmedQuery);
        localStorage.setItem('searchSettings', JSON.stringify(searchSettings));
        
        switch (data.type) {
          case 'token':
            window.location.href = `/token/${trimmedQuery}?fromSearch=true`;
            break;
          case 'program':
            window.location.href = `/program/${trimmedQuery}?fromSearch=true`;
            break;
          case 'account':
            window.location.href = `/account/${trimmedQuery}?fromSearch=true`;
            break;
          default:
            // Build search URL with settings
            buildAndNavigateToSearchUrl(trimmedQuery);
        }
      } else {
        // Check if query is a user freeform message or specific entity
        // If it's a specific entity type that we can identify, navigate directly
        const lowerQuery = trimmedQuery.toLowerCase();
        if (lowerQuery.includes('account') && lowerQuery.match(/\b[a-zA-Z0-9]{32,44}\b/)) {
          // Extract the address from the query
          const addressMatch = lowerQuery.match(/\b[a-zA-Z0-9]{32,44}\b/);
          if (addressMatch) {
            localStorage.setItem('lastSearchQuery', trimmedQuery);
            localStorage.setItem('searchSettings', JSON.stringify(searchSettings));
            window.location.href = `/account/${addressMatch[0]}?fromSearch=true`;
            return;
          }
        }
        
        // For other types of queries, use search page
        buildAndNavigateToSearchUrl(trimmedQuery);
      }
    } catch (error) {
      console.error('Error processing search:', error);
      buildAndNavigateToSearchUrl(trimmedQuery);
    } finally {
      setIsLoading(false);
    }
  };

  const buildAndNavigateToSearchUrl = (query: string) => {
    let searchUrl = `/search?q=${encodeURIComponent(query)}`;
    
    // Add networks - ensure we have at least one network
    if (searchSettings.networks.length > 0) {
      searchUrl += `&networks=${searchSettings.networks.join(',')}`;
    }
    
    // Add data types - only add if there are selected data types
    if (searchSettings.dataTypes.length > 0) {
      searchUrl += `&types=${searchSettings.dataTypes.join(',')}`;
    } else {
      // Default to all data types if none selected
      searchUrl += `&types=transactions,blocks,programs,tokens`;
    }
    
    // Add sort options
    searchUrl += `&sortBy=${searchSettings.sortBy}&sortOrder=${searchSettings.sortOrder}`;
    
    // Add date range
    if (searchSettings.dateRange?.start && searchSettings.dateRange?.end) {
      searchUrl += `&start=${searchSettings.dateRange.start}&end=${searchSettings.dateRange.end}`;
    }
    
    // Add status
    if (searchSettings.status) {
      searchUrl += `&status=${searchSettings.status}`;
    }
    
    // Add amount range
    if (searchSettings.minAmount !== undefined) {
      searchUrl += `&min=${searchSettings.minAmount}`;
    }
    if (searchSettings.maxAmount !== undefined) {
      searchUrl += `&max=${searchSettings.maxAmount}`;
    }
    
    router.push(searchUrl);
  };

  const toggleNetwork = (networkId: string) => {
    setSearchSettings(prev => {
      const networks = [...prev.networks];
      const index = networks.indexOf(networkId);
      
      if (index === -1) {
        // Add the network
        networks.push(networkId);
      } else if (networks.length > 1) {
        // Only remove if there's more than one network selected
        networks.splice(index, 1);
      } else {
        // Don't allow removing the last network
        return prev;
      }
      
      return {
        ...prev,
        networks
      };
    });
  };

  const toggleDataType = (dataType: 'transactions' | 'blocks' | 'programs' | 'tokens') => {
    setSearchSettings(prev => {
      const dataTypes = [...prev.dataTypes];
      const index = dataTypes.indexOf(dataType);
      
      if (index === -1) {
        // Add the data type
        dataTypes.push(dataType);
      } else if (dataTypes.length > 1) {
        // Only remove if there's more than one data type selected
        dataTypes.splice(index, 1);
      } else {
        // Don't allow removing the last data type
        return prev;
      }
      
      return {
        ...prev,
        dataTypes
      };
    });
  };

  const clearSearch = () => {
    setQuery('');
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="relative flex flex-col w-full gap-4">
        <div className="relative flex w-full">
          <SearchInput 
            query={query}
            setQuery={setQuery}
            showSettings={showSettings}
            setShowSettings={setShowSettings}
            setShowSuggestions={setShowSuggestions}
            clearSearch={clearSearch}
          />
          <SearchButton isLoading={isLoading} />
        </div>

        {/* Search Settings Panel */}
        <SearchSettings 
          showSettings={showSettings}
          settingsRef={settingsRef}
          searchSettings={searchSettings}
          setSearchSettings={setSearchSettings}
          setShowSettings={setShowSettings}
          toggleNetwork={toggleNetwork}
          toggleDataType={toggleDataType}
        />

        {/* Autocomplete Suggestions */}
        <SearchSuggestions 
          showSuggestions={showSuggestions}
          suggestions={suggestions}
          suggestionsRef={suggestionsRef}
          setQuery={setQuery}
          setShowSuggestions={setShowSuggestions}
          handleSubmit={handleSubmit}
        />
      </form>
    </div>
  );
}