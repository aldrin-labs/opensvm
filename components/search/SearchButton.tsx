'use client';

import React from 'react';
import { Search, Loader2 } from 'lucide-react';

interface SearchButtonProps {
  isLoading: boolean;
}

export const SearchButton: React.FC<SearchButtonProps> = ({ isLoading }) => {
  return (
    <button
      type="submit"
      disabled={isLoading}
      className={`h-9 w-9 ml-2 bg-background border border-border/40 rounded-lg flex items-center justify-center transition-all duration-200 active:scale-95 ${
        isLoading 
          ? 'border-primary/40 bg-primary/5 cursor-not-allowed' 
          : 'hover:border-border/60 hover:bg-muted/50 active:bg-muted/70'
      }`}
      aria-label={isLoading ? "Searching..." : "Search"}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 text-primary animate-spin" />
      ) : (
        <Search className="h-4 w-4 text-muted-foreground" />
      )}
    </button>
  );
};
