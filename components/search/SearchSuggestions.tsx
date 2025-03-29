'use client';

import React from 'react';
import { SearchSuggestion } from './types';

interface SearchSuggestionsProps {
  showSuggestions: boolean;
  suggestions: SearchSuggestion[];
  suggestionsRef: React.RefObject<HTMLDivElement>;
  setQuery: (query: string) => void;
  setShowSuggestions: (show: boolean) => void;
  handleSubmit: (e: React.FormEvent) => void;
}

export const SearchSuggestions: React.FC<SearchSuggestionsProps> = ({
  showSuggestions,
  suggestions,
  suggestionsRef,
  setQuery,
  setShowSuggestions,
  handleSubmit,
}) => {
  if (!showSuggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div ref={suggestionsRef} className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
      {suggestions.map((suggestion, index) => (
        <button
          key={index}
          type="button"
          onClick={() => {
            setQuery(suggestion.value);
            setShowSuggestions(false);
            handleSubmit({ preventDefault: () => {} } as React.FormEvent);
          }}
          className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
        >
          <span className="text-xs text-gray-500 uppercase">{suggestion.type}</span>
          <span className="flex-1 truncate">{suggestion.label || suggestion.value}</span>
        </button>
      ))}
    </div>
  );
};