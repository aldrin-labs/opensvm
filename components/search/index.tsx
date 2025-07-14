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
  const formRef = useRef<HTMLFormElement>(null);

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
      if (searchSettings.networks.length === 0) {
        setSuggestions([]);
        return;
      }

      try {
        let response;
        
        if (query.length === 0) {
          // Fetch empty state suggestions (recent prompts, latest items, popular searches)
          console.log('Fetching empty state suggestions...');
          response = await fetch(`/api/search/suggestions/empty-state?networks=${searchSettings.networks.join(',')}`);
        } else if (query.length < 3) {
          // For very short queries, just clear suggestions
          setSuggestions([]);
          return;
        } else {
          // Fetch suggestions based on the query and selected networks
          response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}&networks=${searchSettings.networks.join(',')}`);
        }
        
        if (!response.ok) {
          throw new Error(`Failed to fetch suggestions: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Suggestions fetched:', data);
        setSuggestions(data);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        setSuggestions([]);
      }
    };

    const debounceTimeout = setTimeout(fetchSuggestions, query.length === 0 ? 0 : 300);
    return () => clearTimeout(debounceTimeout);
  }, [query, searchSettings.networks]);

  const handleSubmitValue = async (value: string) => {
    const trimmedQuery = value.trim();
    if (!trimmedQuery || isLoading) {
      return;
    }
    
    try {
      setIsLoading(true);
      console.log("Processing search value:", trimmedQuery);
      
      // Check if query is a block number
      if (/^\d+$/.test(trimmedQuery)) {
        console.log("Detected block number, navigating to block page");
        router.push(`/block/${trimmedQuery}`);
        return;
      }
      
      // Check if query is a transaction signature
      if (isValidTransactionSignature(trimmedQuery)) {
        console.log("Detected transaction signature, navigating to tx page");
        router.push(`/tx/${trimmedQuery}`);
        return;
      }
      
      // Check if query is a valid Solana address
      if (isValidSolanaAddress(trimmedQuery)) {
        console.log("Detected Solana address, checking account type");
        const response = await fetch(`/api/check-account-type?address=${encodeURIComponent(trimmedQuery)}`);
        const data = await response.json();
        console.log("Account type response:", data);
        
        switch (data.type) {
          case 'token':
            console.log("Navigating to token page");
            router.push(`/token/${trimmedQuery}`);
            break;
          case 'program':
            console.log("Navigating to program page");
            router.push(`/program/${trimmedQuery}`);
            break;
          case 'account':
            console.log("Navigating to account page");
            router.push(`/account/${trimmedQuery}`);
            break;
          default:
            console.log("Unknown account type, using search page");
            buildAndNavigateToSearchUrl(trimmedQuery);
        }
      } else {
        console.log("Using general search page");
        buildAndNavigateToSearchUrl(trimmedQuery);
      }
    } catch (error) {
      console.error('Error processing search:', error);
      buildAndNavigateToSearchUrl(trimmedQuery);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSubmitValue(query);
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
    
    console.log("Navigating to search URL:", searchUrl);
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
    setShowSuggestions(false);
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <form ref={formRef} onSubmit={handleSubmit} className="relative flex flex-col w-full gap-4">
        <div className="relative flex w-full">
          <SearchInput 
            query={query}
            setQuery={setQuery}
            showSettings={showSettings}
            setShowSettings={setShowSettings}
            setShowSuggestions={setShowSuggestions}
            clearSearch={clearSearch}
            isSearching={isLoading}
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
          onSubmitValue={handleSubmitValue}
          isLoading={query.length >= 3 && suggestions.length === 0}
        />
      </form>
    </div>
  );
}