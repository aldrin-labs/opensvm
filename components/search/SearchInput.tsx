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
  detectedType?: string | null;
  onFocusChange?: (isFocused: boolean) => void;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  query,
  setQuery,
  showSettings,
  setShowSettings,
  setShowSuggestions,
  clearSearch,
  isSearching = false,
  detectedType = null,
  onFocusChange,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus search input with / key when not already focused on an input
      if (e.key === '/' && typeof document !== 'undefined' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
      }

      // Clear search with Escape key when input is focused
      if (e.key === 'Escape' && typeof document !== 'undefined' && document.activeElement === inputRef.current && query) {
        clearSearch();
      }
    };

    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', handleKeyDown);
      }
    };
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
      <div className="relative group flex w-full">
        <div className={`relative flex w-full bg-background border border-border/40 rounded-lg overflow-hidden transition-all duration-200 hover:border-border/60 ${
          isFocused ? 'border-border ring-1 ring-primary/20' : ''
        }`}>
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
              setShowSuggestions(true);
              onFocusChange?.(true);
            }}
            onBlur={(e) => {
              // Check if the blur is happening because we're clicking on a suggestion
              const relatedTarget = e.relatedTarget as HTMLElement;
              const isClickingOnSuggestion = relatedTarget && (
                relatedTarget.closest('[data-suggestions-container]') ||
                relatedTarget.closest('button[type="button"]') && relatedTarget.closest('.absolute')
              );
              
              if (isClickingOnSuggestion) {
                // Don't lose focus if clicking on suggestions
                return;
              }
              
              // Use a small delay for other cases to ensure proper cleanup
              setTimeout(() => {
                setIsFocused(false);
                onFocusChange?.(false);
              }, 50);
            }}
            placeholder="Search by address, transaction, block or token"
            className={`w-full h-9 px-3 bg-transparent border-0 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-0 transition-all duration-200 ${
              isFocused ? 'placeholder:text-muted-foreground/40' : ''
            }`}
            aria-label="Search input"
          />

          {isSearching && (
            <div className="absolute right-[70px] top-1/2 -translate-y-1/2 flex items-center">
              <div className="flex space-x-1 mr-2">
                <div className="w-1 h-1 rounded-full bg-muted-foreground animate-pulse"></div>
                <div className="w-1 h-1 rounded-full bg-muted-foreground animate-pulse delay-150"></div>
                <div className="w-1 h-1 rounded-full bg-muted-foreground animate-pulse delay-300"></div>
              </div>
            </div>
          )}

          {query && !isSearching && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-[70px] top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground transition-colors duration-200 p-1"
              aria-label="Clear search"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </button>
          )}

          <div className="flex items-center px-2 border-l border-border/30">
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className={`settings-toggle h-7 w-7 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 flex items-center justify-center transition-all duration-200 ${
                showSettings ? 'text-primary bg-primary/10' : ''
              }`}
              aria-label="Customize Search"
              aria-expanded={showSettings}
            >
              <div className={`transform transition-transform duration-200 ${showSettings ? 'rotate-90' : ''}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Detected type indicator */}
      {detectedType && query && (
        <div className="absolute -bottom-6 left-0 text-xs text-muted-foreground/60">
          {detectedType === 'block' && '📦 Block number detected'}
          {detectedType === 'transaction' && '📝 Transaction signature detected'}
          {detectedType === 'address' && '🔑 Solana address detected'}
          {detectedType === 'search' && '🔍 General search'}
        </div>
      )}

      {/* Keyboard shortcut hint */}
      {!isFocused && !detectedType && (
        <div className="absolute -bottom-6 right-0 text-xs text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          Press <kbd className="px-1.5 py-0.5 bg-muted/30 rounded text-xs font-mono">/</kbd> to focus
        </div>
      )}
    </div>
  );
};
