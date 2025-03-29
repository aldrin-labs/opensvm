'use client';

import React from 'react';
import { cn } from "@/lib/utils";

interface SearchButtonProps {
  isLoading: boolean;
}

export const SearchButton: React.FC<SearchButtonProps> = ({ isLoading }) => {
  return (
    <button
      type="submit"
      disabled={isLoading}
      className={cn(
        "rounded-r-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 flex items-center justify-center",
        isLoading ? "opacity-50 cursor-not-allowed" : ""
      )}
    >
      {isLoading ? (
        <div className="flex items-center">
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-primary-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Searching...
        </div>
      ) : 'Search'}
    </button>
  );
};