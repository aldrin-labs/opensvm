'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

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
  const [hasResults, setHasResults] = useState(false);

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

      // Submit search with Enter key when input is focused
      if (e.key === 'Enter' && document.activeElement === inputRef.current && query) {
        e.preventDefault();
        // The parent form submit handler will handle this
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearSearch, query]);

  // Simulate checking for results when query changes
  useEffect(() => {
    if (!query || query.length < 3) {
      setHasResults(false);
      return;
    }

    // This would normally be part of the fetchSuggestions function
    // For now, we'll just simulate having results after a delay
    const resultCheckTimeout = setTimeout(() => {
      setHasResults(true);
    }, 600);

    return () => clearTimeout(resultCheckTimeout);
  }, [query]);

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
      setShowSuggestions(!!value && value.length >= 3);
    }, 300);
    
    setTypingTimeout(timeout);
  };

  return (
    <div className="relative flex w-full">
      <motion.div 
        className="relative flex w-full"
        initial={{ scale: 1 }}
        animate={{ 
          scale: isFocused ? 1.01 : 1,
          boxShadow: isFocused ? '0 2px 8px rgba(0,0,0,0.05)' : 'none'
        }}
        transition={{ duration: 0.2 }}
      >
        <div className="relative w-full flex items-center">
          {/* Search icon at the left */}
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={() => {
              setIsFocused(true);
              if (query && query.length >= 3) setShowSuggestions(true);
            }}
            onBlur={() => setIsFocused(false)}
            placeholder="Search by address, transaction, block or token"
            className={`w-full rounded-l-lg border border-r-0 border-input ${
              isFocused ? 'border-primary shadow-sm' : 'border-input'
            } bg-background pl-10 pr-12 py-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all duration-300 placeholder:text-muted-foreground/70`}
            aria-label="Search input"
          />
          
          {/* Entity type badges when we have detected results */}
          <AnimatePresence>
            {hasResults && query && query.length >= 3 && !isSearching && (
              <motion.div 
                className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center gap-1"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                transition={{ duration: 0.2 }}
              >
                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 text-[10px] px-1.5 py-0">TX</Badge>
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 text-[10px] px-1.5 py-0">Token</Badge>
              </motion.div>
            )}
          </AnimatePresence>
          
          <AnimatePresence>
            {isSearching && (
              <motion.div 
                className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex space-x-1 mr-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: '300ms' }}></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: '600ms' }}></div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <AnimatePresence>
            {query && !isSearching && (
              <motion.button
                type="button"
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-200"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Clear search"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
      
      <motion.button
        type="button"
        onClick={() => setShowSettings(!showSettings)}
        className={`settings-toggle px-4 py-3 border border-r-0 border-input ${
          isFocused ? 'border-primary' : 'border-input'
        } bg-background text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors duration-200 ${showSettings ? 'text-primary' : ''}`}
        whileHover={{ backgroundColor: 'rgba(var(--primary), 0.1)' }}
        whileTap={{ scale: 0.95 }}
        aria-label="Customize Search"
        aria-expanded={showSettings}
        title="Search settings"
      >
        <motion.div
          animate={{ rotate: showSettings ? 90 : 0 }}
          transition={{ duration: 0.3, type: 'spring', stiffness: 200 }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
        </motion.div>
      </motion.button>
      
      {/* Keyboard shortcut hint with improved styling */}
      <div className="absolute -bottom-6 right-0 text-xs text-muted-foreground opacity-70 flex items-center gap-1">
        <span>Press</span>
        <kbd className="px-1.5 py-0.5 bg-muted/50 rounded border border-border text-[10px] font-medium shadow-sm">/</kbd>
        <span>to focus search</span>
      </div>
    </div>
  );
};
