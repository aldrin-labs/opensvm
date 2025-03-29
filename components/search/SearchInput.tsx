'use client';

import React from 'react';

interface SearchInputProps {
  query: string;
  setQuery: (query: string) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  setShowSuggestions: (show: boolean) => void;
  clearSearch: () => void;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  query,
  setQuery,
  showSettings,
  setShowSettings,
  setShowSuggestions,
  clearSearch,
}) => {
  return (
    <div className="relative flex w-full">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setShowSuggestions(true);
        }}
        placeholder="Search by address, transaction, block or token"
        className="w-full rounded-l-md border border-r-0 border-input bg-background px-4 py-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      {query && (
        <button
          type="button"
          onClick={clearSearch}
          className="absolute right-[96px] top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </button>
      )}
      <button
        type="button"
        onClick={() => setShowSettings(!showSettings)}
        className="settings-toggle px-4 py-3 border border-r-0 border-input bg-background text-muted-foreground hover:text-foreground flex items-center justify-center"
        aria-label="Customize Search"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
};