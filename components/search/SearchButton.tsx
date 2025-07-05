'use client';

import React from 'react';

interface SearchButtonProps {
  isLoading: boolean;
}

export const SearchButton: React.FC<SearchButtonProps> = ({ isLoading }) => {
  return (
    <button
      type="submit"
      disabled={isLoading}
      className={`rounded-r-md h-12 bg-primary px-6 text-base font-medium text-white hover:bg-primary/90 flex items-center justify-center transition-colors ${isLoading ? 'opacity-80 cursor-not-allowed' : ''}`}
      aria-label="Search"
    >
      {isLoading ? (
        <div className="flex items-center">
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Searching...</span>
        </div>
      ) : (
        <span className="flex items-center">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-4 w-4 mr-1" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Search
        </span>
      )}
    </button>
  );
};
