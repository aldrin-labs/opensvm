'use client';

import React, { useState } from 'react';
import { SearchSuggestion } from './types';

interface SearchSuggestionsProps {
  showSuggestions: boolean;
  suggestions: SearchSuggestion[];
  suggestionsRef: React.RefObject<HTMLDivElement>;
  setQuery: (query: string) => void;
  setShowSuggestions: (show: boolean) => void;
  handleSubmit: (e: React.FormEvent) => void;
  isLoading?: boolean;
}

export const SearchSuggestions: React.FC<SearchSuggestionsProps> = ({
  showSuggestions,
  suggestions,
  suggestionsRef,
  setQuery,
  setShowSuggestions,
  handleSubmit,
  isLoading = false,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!showSuggestions) {
    return null;
  }

  return (
    <div 
      ref={suggestionsRef} 
      className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto"
    >
      {isLoading ? (
        <div className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">
          <div className="flex items-center justify-center space-x-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse delay-150"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse delay-300"></div>
          </div>
          <p className="mt-1 text-sm">Loading suggestions...</p>
        </div>
      ) : suggestions.length === 0 ? (
        <div className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">
          No suggestions found
        </div>
      ) : (
        <>
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              onClick={() => {
                setQuery(suggestion.value);
                setShowSuggestions(false);
                console.log("Suggestion selected:", suggestion.value);
                // Use a timeout to ensure state is updated before submitting
                setTimeout(() => {
                  handleSubmit({ preventDefault: () => {} } as React.FormEvent);
                }, 50);
              }}
              className={`w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2 transition-colors duration-200 relative ${
                hoveredIndex === index ? 'bg-gray-50 dark:bg-gray-800' : ''
              }`}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {hoveredIndex === index && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r" />
              )}
              <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                {suggestion.type}
              </span>
              <span className="flex-1 truncate text-gray-900 dark:text-gray-100">
                {suggestion.label || suggestion.value}
              </span>
            </button>
          ))}
          
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex justify-between items-center">
              <span>Press <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-xs">↑</kbd> <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-xs">↓</kbd> to navigate</span>
              <span>Press <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-xs">Enter</kbd> to select</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
