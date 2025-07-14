'use client';

import React, { useState, useEffect, useRef } from 'react';

interface SearchInputProps {
  query: string;
  setQuery: (query: string) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  setShowSuggestions: (show: boolean) => void;
  clearSearch: () => void;
  isSearching?: boolean;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  query,
  setQuery,
  showSettings,
  setShowSettings,
  setShowSuggestions,
  clearSearch,
  isSearching = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus search input with / key when not already focused on an input
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      
      // Clear search with Escape key when input is focused
      if (e.key === 'Escape' && document.activeElement === inputRef.current && query) {
        clearSearch();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearSearch, query]);

  // Handle typing debounce for suggestions
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    
    // Clear previous timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    
    // Set new timeout for showing suggestions
    const timeout = setTimeout(() => {
      // Always show suggestions when focused, regardless of value
      if (isFocused) {
        setShowSuggestions(true);
      } else {
        setShowSuggestions(!!value);
      }
    }, 300);
    
    setTypingTimeout(timeout);
  };

  return (
    <div className="relative flex w-full">
      <div className="relative flex w-full shadow-sm">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onMouseEnter={() => {
            // Show suggestions on hover
            setShowSuggestions(true);
          }}
          onFocus={() => {
            setIsFocused(true);
            setShowSuggestions(true); // Always show suggestions on focus
          }}
          onBlur={() => {
            setIsFocused(false);
          }}
          placeholder="Search by address, transaction, block or token"
          className={`w-full h-12 rounded-l-md border ${
            isFocused ? 'border-primary ring-1 ring-primary/30' : 'border-gray-200 dark:border-gray-700'
          } bg-white dark:bg-gray-900 px-4 text-base text-gray-900 dark:text-gray-100 focus:outline-none transition-colors duration-200`}
          aria-label="Search input"
        />
        
        {isSearching && (
          <div className="absolute right-[96px] top-1/2 -translate-y-1/2 flex items-center">
            <div className="flex space-x-1 mr-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse delay-150"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse delay-300"></div>
            </div>
          </div>
        )}
        
        {query && !isSearching && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-[96px] top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
            aria-label="Clear search"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>
      
      <button
        type="button"
        onClick={() => setShowSettings(!showSettings)}
        className={`settings-toggle h-12 px-4 border border-r-0 ${
          isFocused ? 'border-primary' : 'border-gray-200 dark:border-gray-700'
        } bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center justify-center transition-colors ${showSettings ? 'text-primary' : ''}`}
        aria-label="Customize Search"
        aria-expanded={showSettings}
      >
        <div className={`transform transition-transform duration-200 ${showSettings ? 'rotate-90' : ''}`}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
        </div>
      </button>
      
      {/* Keyboard shortcut hint */}
      <div className="absolute -bottom-6 right-0 text-xs text-gray-500 dark:text-gray-400 opacity-70">
        Press <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-xs">/</kbd> to focus
      </div>
    </div>
  );
};
