'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { isValidTransactionSignature, isValidSolanaAddress } from '@/lib/utils';
import { SearchInput } from './SearchInput';
import { SearchButton } from './SearchButton';
import { SearchSettings } from './SearchSettings';
import { SearchSuggestions } from './SearchSuggestions';
import { SearchSettings as SearchSettingsType, SearchSuggestion } from './types';

interface EnhancedSearchBarProps {
  onFocusChange?: (isFocused: boolean) => void;
}

// Move tips outside component to prevent recreation on every render
const SEARCH_TIPS = [
  "💡 Did you know? Solana can process over 65,000 transactions per second!",
  "🚀 Fun fact: Solana uses Proof of History for faster consensus.",
  "💰 Tip: You can search by transaction signature, wallet address, or token name.",
  "🔍 Pro tip: Use specific addresses for more accurate results.",
  "⚡ Lightning fast: Solana's block time is just 400 milliseconds!",
  "🌟 Cool fact: Solana uses a unique clock for network synchronization.",
  "🎯 Search hint: Try searching for popular tokens like 'SOL' or 'USDC'.",
  "🔗 Blockchain magic: Each transaction is cryptographically linked to the previous one.",
  "💎 Fun fact: Solana's native token SOL is used for transaction fees and staking.",
  "🎨 Creative: Many NFT projects are built on Solana's fast network!"
];

export default function EnhancedSearchBar({ onFocusChange }: EnhancedSearchBarProps = {}) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isAISearching, setIsAISearching] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string>('');
  const [currentTip, setCurrentTip] = useState('');
  const [detectedType, setDetectedType] = useState<string | null>(null);

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

  // Memoize the outside click handler to prevent recreation
  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
      setShowSuggestions(false);
    }
    if (settingsRef.current && !settingsRef.current.contains(event.target as Node) &&
      !(event.target as HTMLElement).closest('.settings-toggle')) {
      setShowSettings(false);
    }
  }, []);

  useEffect(() => {
    // Close suggestions and settings on outside click
    if (typeof document !== 'undefined') {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('mousedown', handleClickOutside);
      }
    };
  }, [handleClickOutside]);

  // Memoize the fetch function to prevent recreation
  const fetchSuggestions = useCallback(async () => {
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
  }, [query, searchSettings.networks]);

  useEffect(() => {
    const debounceTimeout = setTimeout(fetchSuggestions, query.length === 0 ? 0 : 300);
    return () => clearTimeout(debounceTimeout);
  }, [fetchSuggestions]);

  // Real-time input type detection
  useEffect(() => {
    const trimmedQuery = query.trim();
    
    if (!trimmedQuery) {
      setDetectedType(null);
      return;
    }

    // Check if query is a block number
    if (/^\d+$/.test(trimmedQuery)) {
      setDetectedType('block');
      return;
    }

    // Check if query is a transaction signature
    if (isValidTransactionSignature(trimmedQuery)) {
      setDetectedType('transaction');
      return;
    }

    // Check if query is a valid Solana address
    if (isValidSolanaAddress(trimmedQuery)) {
      setDetectedType('address');
      return;
    }

    // If it's a reasonably long string but not recognized, it might be a token name
    if (trimmedQuery.length >= 2) {
      setDetectedType('search');
    } else {
      setDetectedType(null);
    }
  }, [query]);

  // AI search when no regular suggestions found - memoized to prevent infinite loops
  const performAISearch = useCallback(async () => {
    setIsAISearching(true);
    setAiAnswer('');
    
    // Set initial tip
    const randomTip = SEARCH_TIPS[Math.floor(Math.random() * SEARCH_TIPS.length)];
    setCurrentTip(randomTip);
    
    // Rotate tips every 2 seconds
    const tipRotationInterval = setInterval(() => {
      const randomTip = SEARCH_TIPS[Math.floor(Math.random() * SEARCH_TIPS.length)];
      setCurrentTip(randomTip);
    }, 2000);

    try {
      console.log('No suggestions found, calling AI API...');
      const response = await fetch('/api/getAnswer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: query }),
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();
      setAiAnswer(data.answer || 'Sorry, I couldn\'t find information about that.');
    } catch (error) {
      console.error('Error calling AI API:', error);
      setAiAnswer('Sorry, I encountered an error while searching. Please try again.');
    } finally {
      setIsAISearching(false);
      clearInterval(tipRotationInterval);
    }
  }, [query]);

  useEffect(() => {
    let aiSearchTimeout: NodeJS.Timeout;

    if (query.length >= 3 && suggestions.length === 0 && !isLoading && !isAISearching && detectedType === 'search') {
      // Start AI search after a short delay to avoid triggering too quickly
      aiSearchTimeout = setTimeout(performAISearch, 800);
    } else {
      // Clear AI answer if query changes or suggestions are found
      setAiAnswer('');
      setIsAISearching(false);
    }

    return () => {
      clearTimeout(aiSearchTimeout);
    };
  }, [query, suggestions, isLoading, isAISearching, detectedType, performAISearch]);

  const buildAndNavigateToSearchUrl = useCallback((queryParam: string) => {
    let searchUrl = `/search?q=${encodeURIComponent(queryParam)}`;

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
  }, [router, searchSettings]);

  const handleSubmitValue = useCallback(async (value: string) => {
    const trimmedQuery = value.trim();
    if (!trimmedQuery || isSubmitting) {
      return;
    }

    console.log("Processing search value:", trimmedQuery, "Detected type:", detectedType);

    // Set loading state
    setIsSubmitting(true);

    try {
      // Use router.push instead of router.replace for better navigation
      switch (detectedType) {
        case 'block':
          console.log("Navigating to block page");
          router.push(`/block/${trimmedQuery}`);
          break;

        case 'transaction':
          console.log("Navigating to transaction page");
          router.push(`/tx/${trimmedQuery}`);
          break;

        case 'address':
          console.log("Detected Solana address - checking account type and search settings");
          
          // Check if programs are disabled in search settings
          if (!searchSettings.dataTypes.includes('programs')) {
            console.log("Programs disabled in search settings - routing to account page");
            router.push(`/account/${trimmedQuery}`);
            break;
          }
          
          // Check account type using API to determine the correct route
          try {
            const response = await fetch(`/api/check-account-type?address=${encodeURIComponent(trimmedQuery)}`);
            const data = await response.json();

            switch (data.type) {
              case 'token':
                console.log('Redirecting to token page:', trimmedQuery);
                router.push(`/token/${trimmedQuery}`);
                break;
              case 'program':
                console.log('Redirecting to program page:', trimmedQuery);
                router.push(`/program/${trimmedQuery}`);
                break;
              case 'account':
              default:
                console.log('Redirecting to account page:', trimmedQuery);
                router.push(`/account/${trimmedQuery}`);
                break;
            }
          } catch (error) {
            console.error('Error checking account type:', error);
            // On error, default to account page
            router.push(`/account/${trimmedQuery}`);
          }
          break;

        default:
          console.log("Using general search page");
          buildAndNavigateToSearchUrl(trimmedQuery);
          break;
      }
    } catch (error) {
      console.error("Navigation error:", error);
      setIsSubmitting(false);
    }
  }, [detectedType, router, buildAndNavigateToSearchUrl, isSubmitting]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    handleSubmitValue(query);
  }, [query, handleSubmitValue]);

  const toggleNetwork = useCallback((networkId: string) => {
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
  }, []);

  const toggleDataType = useCallback((dataType: 'transactions' | 'blocks' | 'programs' | 'tokens') => {
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
  }, []);

  // Reset submitting state when navigation completes
  useEffect(() => {
    const handleRouteChange = () => {
      setIsSubmitting(false);
    };

    // Listen for route changes to reset loading state
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleRouteChange);
      // Also reset after a timeout as fallback
      const timeout = setTimeout(() => {
        setIsSubmitting(false);
      }, 3000);

      return () => {
        window.removeEventListener('beforeunload', handleRouteChange);
        clearTimeout(timeout);
      };
    }
  }, []);

  const clearSearch = useCallback(() => {
    setQuery('');
    setShowSuggestions(false);
  }, []);

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
            isSearching={isSubmitting}
            detectedType={detectedType}
            onFocusChange={(focused) => {
              onFocusChange?.(focused);
            }}
          />
          <SearchButton isLoading={isSubmitting} />
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
          isLoading={query.length >= 3 && suggestions.length === 0 && !isAISearching && !aiAnswer}
          isAISearching={isAISearching}
          aiAnswer={aiAnswer}
          currentTip={currentTip}
          query={query}
        />
      </form>
    </div>
  );
}
