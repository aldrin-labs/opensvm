'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Search,
  Clock,
  ChevronRight,
  ArrowRight,
  Lightbulb,
  History,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchResult {
  query: { original: string };
  results: any[];
  summary: string;
  suggestions: string[];
  executionTime: number;
}

interface AISearchPanelProps {
  isSearching: boolean;
  lastResult: SearchResult | null;
  searchHistory: Array<{ original: string; timestamp: number }>;
  suggestions: string[];
  onSearch: (query: string) => void;
  onClearSearch: () => void;
  onGetSuggestions: () => string[];
  className?: string;
}

const EXAMPLE_QUERIES = [
  "Show me all accounts that sent more than 100 SOL",
  "Find wallets with more than 50 transactions",
  "Show the largest 10 transactions",
  "Find all whales",
  "Highlight suspicious accounts",
  "Show transactions from the last 7 days",
  "Summarize this graph",
  "Count all accounts",
  "Find all connected to [address]"
];

export const AISearchPanel: React.FC<AISearchPanelProps> = ({
  isSearching,
  lastResult,
  searchHistory,
  suggestions,
  onSearch,
  onClearSearch,
  onGetSuggestions,
  className
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [autocomplete, setAutocomplete] = useState<string[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setSelectedSuggestion(-1);

    // Generate autocomplete suggestions
    if (value.length > 2) {
      const matches = EXAMPLE_QUERIES.filter(q =>
        q.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 5);
      setAutocomplete(matches);
    } else {
      setAutocomplete([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query) {
      if (selectedSuggestion >= 0 && autocomplete[selectedSuggestion]) {
        handleSearch(autocomplete[selectedSuggestion]);
      } else {
        handleSearch(query);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestion(prev => Math.min(prev + 1, autocomplete.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestion(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Escape') {
      setAutocomplete([]);
      setSelectedSuggestion(-1);
    }
  };

  const handleSearch = (searchQuery: string) => {
    onSearch(searchQuery);
    setQuery('');
    setAutocomplete([]);
    setSelectedSuggestion(-1);
  };

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <div className={cn(
      'absolute top-32 left-4 z-20 bg-background/95 backdrop-blur-sm',
      'border border-border rounded-xl shadow-lg transition-all duration-300',
      isExpanded ? 'w-96' : 'w-auto',
      className
    )}>
      {/* Collapsed */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2 p-3 rounded-xl hover:bg-muted/50 transition-colors"
        >
          <Sparkles className="w-5 h-5 text-primary" />
          <span className="text-sm font-medium">AI Search</span>
        </button>
      )}

      {/* Expanded */}
      {isExpanded && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="font-medium">Natural Language Search</span>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search Input */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about the graph..."
                className="w-full px-4 py-2.5 pr-10 text-sm rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/50 focus:border-primary"
              />
              <button
                onClick={() => query && handleSearch(query)}
                disabled={!query || isSearching}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isSearching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </button>

              {/* Autocomplete dropdown */}
              {autocomplete.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg overflow-hidden z-50">
                  {autocomplete.map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => handleSearch(suggestion)}
                      className={cn(
                        'w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2',
                        selectedSuggestion === i && 'bg-muted'
                      )}
                    >
                      <Search className="w-3 h-3 text-muted-foreground" />
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick suggestions */}
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={cn(
                  'p-1.5 rounded hover:bg-muted',
                  showHistory && 'bg-muted'
                )}
              >
                <History className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              <button
                onClick={() => handleSearch('summarize this graph')}
                className="px-2 py-1 text-xs rounded bg-muted hover:bg-muted/80"
              >
                Summarize
              </button>
              <button
                onClick={() => handleSearch('find all whales')}
                className="px-2 py-1 text-xs rounded bg-muted hover:bg-muted/80"
              >
                Whales
              </button>
              <button
                onClick={() => handleSearch('highlight suspicious accounts')}
                className="px-2 py-1 text-xs rounded bg-muted hover:bg-muted/80"
              >
                Suspicious
              </button>
            </div>
          </div>

          {/* Results / History */}
          <div className="p-3 max-h-80 overflow-y-auto">
            {/* Search History */}
            {showHistory && searchHistory.length > 0 && (
              <div className="mb-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Recent Searches
                </p>
                {searchHistory.slice(-5).reverse().map((item, i) => (
                  <button
                    key={i}
                    onClick={() => handleSearch(item.original)}
                    className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted flex items-center gap-2"
                  >
                    <ChevronRight className="w-3 h-3 text-muted-foreground" />
                    <span className="truncate">{item.original}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Last Result */}
            {lastResult && (
              <div className="space-y-3">
                {/* Query */}
                <div className="p-2 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-xs text-muted-foreground">Query</p>
                  <p className="text-sm font-medium">{lastResult.query.original}</p>
                </div>

                {/* Summary */}
                <div className="p-2 rounded-lg bg-muted/50">
                  <p className="text-sm">{lastResult.summary}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {lastResult.executionTime}ms
                  </p>
                </div>

                {/* Results */}
                {lastResult.results.length > 0 && lastResult.results[0].id && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Results</p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {lastResult.results.slice(0, 10).map((result, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm"
                        >
                          <span className="font-mono">{formatAddress(result.id)}</span>
                          <span className="text-xs text-muted-foreground">
                            {result.type}
                          </span>
                        </div>
                      ))}
                      {lastResult.results.length > 10 && (
                        <p className="text-xs text-muted-foreground text-center">
                          +{lastResult.results.length - 10} more results
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Follow-up suggestions */}
                {lastResult.suggestions.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Lightbulb className="w-3 h-3" />
                      Try next
                    </p>
                    {lastResult.suggestions.map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => handleSearch(suggestion)}
                        className="w-full text-left px-2 py-1.5 text-xs rounded bg-muted/50 hover:bg-muted flex items-center gap-2"
                      >
                        <ArrowRight className="w-3 h-3 text-primary" />
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}

                {/* Clear */}
                <button
                  onClick={onClearSearch}
                  className="w-full text-xs text-muted-foreground hover:text-foreground py-1"
                >
                  Clear results
                </button>
              </div>
            )}

            {/* Empty state */}
            {!lastResult && !showHistory && (
              <div className="space-y-3">
                <div className="text-center py-4">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 text-primary/50" />
                  <p className="text-sm text-muted-foreground">
                    Ask questions in plain English
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Example queries</p>
                  {EXAMPLE_QUERIES.slice(0, 5).map((example, i) => (
                    <button
                      key={i}
                      onClick={() => handleSearch(example)}
                      className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted flex items-center gap-2"
                    >
                      <Search className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{example}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AISearchPanel;
