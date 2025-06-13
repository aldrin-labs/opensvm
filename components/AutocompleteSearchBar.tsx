'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { isValidTransactionSignature, isValidSolanaAddress } from '@/lib/utils';
import { Card } from './ui/card';

interface SearchSuggestion {
  type: 'address' | 'transaction' | 'token' | 'program';
  value: string;
  label?: string;
}

interface AdvancedSearchFilters {
  dateRange?: {
    start: string;
    end: string;
  };
  type?: 'SOL' | 'TOKEN';
  status?: 'success' | 'failed';
  minAmount?: number;
  maxAmount?: number;
}

export default function AutocompleteSearchBar() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filters, setFilters] = useState<AdvancedSearchFilters>({});
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const router = useRouter();
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Close suggestions on outside click
    function handleClickOutside(event: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (query.length < 3) {
        setSuggestions([]);
        return;
      }

      try {
        // Fetch recent addresses and transactions matching the query
        const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`);
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
  }, [query]);

  // Update filters when dateRange changes
  useEffect(() => {
    if (dateRange.start && dateRange.end) {
      setFilters(prev => ({
        ...prev,
        dateRange: {
          start: dateRange.start,
          end: dateRange.end
        }
      }));
    }
  }, [dateRange]);

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
        
        // Include network in URL if available
        const networkParam = data.network ? `?network=${data.network}` : '';
        
        switch (data.type) {
          case 'token':
            window.location.href = `/token/${trimmedQuery}${networkParam}`;
            break;
          case 'program':
            window.location.href = `/program/${trimmedQuery}${networkParam}`;
            break;
          case 'account':
            window.location.href = `/account/${trimmedQuery}${networkParam}`;
            break;
          default:
            // Build search URL with filters
            let searchUrl = `/search?q=${encodeURIComponent(trimmedQuery)}`;
            if (filters.dateRange) {
              searchUrl += `&start=${filters.dateRange.start}&end=${filters.dateRange.end}`;
            }
            if (filters.type) {
              searchUrl += `&type=${filters.type}`;
            }
            if (filters.status) {
              searchUrl += `&status=${filters.status}`;
            }
            if (filters.minAmount) {
              searchUrl += `&min=${filters.minAmount}`;
            }
            if (filters.maxAmount) {
              searchUrl += `&max=${filters.maxAmount}`;
            }
            router.push(searchUrl);
        }
      } else {
        // Use search page with filters
        let searchUrl = `/search?q=${encodeURIComponent(trimmedQuery)}`;
        if (filters.dateRange) {
          searchUrl += `&start=${filters.dateRange.start}&end=${filters.dateRange.end}`;
        }
        if (filters.type) {
          searchUrl += `&type=${filters.type}`;
        }
        if (filters.status) {
          searchUrl += `&status=${filters.status}`;
        }
        if (filters.minAmount) {
          searchUrl += `&min=${filters.minAmount}`;
        }
        if (filters.maxAmount) {
          searchUrl += `&max=${filters.maxAmount}`;
        }
        router.push(searchUrl);
      }
    } catch (error) {
      console.error('Error processing search:', error);
      router.push(`/search?q=${encodeURIComponent(trimmedQuery)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="relative flex flex-col w-full gap-4">
        <div className="relative flex w-full">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(true);
            }}
            placeholder="Search by address, transaction, block or token"
            className="w-full rounded-l-lg border border-r-0 border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:border-[#00ffbd] focus:outline-none focus:ring-1 focus:ring-[#00ffbd]"
          />
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="px-4 py-3 border border-r-0 border-gray-200 bg-white text-gray-600 hover:text-gray-900"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className={`rounded-r-lg bg-[#00ffbd] px-6 py-3 text-sm font-medium text-black hover:bg-[#00e6aa] flex items-center justify-center ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* Advanced Search Filters */}
        {showAdvanced && (
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Date Range</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
                  />
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Type</label>
                <select
                  onChange={(e) => setFilters({
                    ...filters,
                    type: e.target.value as 'SOL' | 'TOKEN'
                  })}
                  className="rounded border border-gray-200 px-2 py-1 text-sm"
                >
                  <option value="">All</option>
                  <option value="SOL">SOL</option>
                  <option value="TOKEN">Token</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Status</label>
                <select
                  onChange={(e) => setFilters({
                    ...filters,
                    status: e.target.value as 'success' | 'failed'
                  })}
                  className="rounded border border-gray-200 px-2 py-1 text-sm"
                >
                  <option value="">All</option>
                  <option value="success">Success</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Amount Range</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    onChange={(e) => setFilters({
                      ...filters,
                      minAmount: parseFloat(e.target.value)
                    })}
                    className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    onChange={(e) => setFilters({
                      ...filters,
                      maxAmount: parseFloat(e.target.value)
                    })}
                    className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
                  />
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Autocomplete Suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <div ref={suggestionsRef} className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => {
                  // If it's a transaction suggestion, just use the value
                  if (suggestion.type === 'transaction') {
                    setQuery(suggestion.value);
                    setShowSuggestions(false);
                    window.location.href = `/tx/${suggestion.value}${suggestion.network ? `?network=${suggestion.network}` : ''}`;
                  } 
                  // If it's a token or program suggestion, include the network
                  else if (suggestion.type === 'token') {
                    setQuery(suggestion.value);
                    setShowSuggestions(false);
                    window.location.href = `/token/${suggestion.value}${suggestion.network ? `?network=${suggestion.network}` : ''}`;
                  }
                  else if (suggestion.type === 'program') {
                    setQuery(suggestion.value);
                    setShowSuggestions(false);
                    window.location.href = `/program/${suggestion.value}${suggestion.network ? `?network=${suggestion.network}` : ''}`;
                  }
                  // Otherwise, use the regular search
                  else {
                    setQuery(suggestion.value);
                    setShowSuggestions(false);
                    handleSubmit({ preventDefault: () => {} } as React.FormEvent);
                  }
                }}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
              >
                <span className="text-xs text-gray-500 uppercase">{suggestion.type}</span>
                <span className="flex-1 truncate">{suggestion.label || suggestion.value}</span>
                {suggestion.network && (
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">{suggestion.network}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </form>
    </div>
  );
}