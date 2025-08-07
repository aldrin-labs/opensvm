'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Search, Mic, MicOff, Loader2, X, Clock, Trending, Filter } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useAccessibility } from '@/lib/accessibility';
import { useResponsive } from '@/lib/design-system/responsive';
import { useUserExpertise } from '@/lib/user-expertise';
import { EnhancedButton } from '@/components/ui/enhanced-button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Search result types
export interface SearchSuggestion {
  id: string;
  type: 'transaction' | 'block' | 'account' | 'program' | 'token' | 'query';
  title: string;
  subtitle?: string;
  description?: string;
  metadata?: Record<string, any>;
  confidence: number; // 0-1 confidence score
  category?: string;
  icon?: React.ReactNode;
  highlighted?: boolean;
}

// Search filters
export interface SearchFilters {
  types: string[];
  dateRange?: {
    from: Date;
    to: Date;
  };
  network?: string;
  minAmount?: number;
  maxAmount?: number;
  status?: string[];
  programs?: string[];
}

// Voice recognition support
interface VoiceRecognition {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  confidence: number;
  error?: string;
}

// Search context and state
interface SmartSearchContextType {
  query: string;
  suggestions: SearchSuggestion[];
  recentSearches: SearchSuggestion[];
  trendingSearches: SearchSuggestion[];
  filters: SearchFilters;
  isLoading: boolean;
  isVoiceActive: boolean;
  voiceRecognition: VoiceRecognition;
  selectedIndex: number;
  showSuggestions: boolean;
  
  // Actions
  setQuery: (query: string) => void;
  updateFilters: (filters: Partial<SearchFilters>) => void;
  executeSearch: (query?: string) => Promise<void>;
  clearSearch: () => void;
  selectSuggestion: (suggestion: SearchSuggestion) => void;
  toggleVoiceSearch: () => void;
  navigateResults: (direction: 'up' | 'down') => void;
}

// Mock search service (in real app, this would be an API)
class SearchService {
  private static mockData: SearchSuggestion[] = [
    {
      id: '1',
      type: 'transaction',
      title: '5VK8y7Ly...x9W2nD',
      subtitle: 'Transaction',
      description: 'Successful SOL transfer • 2.5 SOL',
      confidence: 0.95,
      metadata: { amount: 2.5, status: 'success' },
    },
    {
      id: '2',
      type: 'account',
      title: 'EPjFWdd5...fGUGe',
      subtitle: 'Token Account (USDC)',
      description: 'Balance: 15,432.50 USDC',
      confidence: 0.92,
      metadata: { balance: 15432.50, token: 'USDC' },
    },
    {
      id: '3',
      type: 'program',
      title: 'Raydium AMM',
      subtitle: '675kPX9M...hXPiq',
      description: 'Automated Market Maker',
      confidence: 0.88,
      metadata: { category: 'DeFi' },
    },
    {
      id: '4',
      type: 'block',
      title: 'Block #234,567,890',
      subtitle: 'Block',
      description: '2,847 transactions • 2 minutes ago',
      confidence: 0.85,
      metadata: { transactions: 2847, timestamp: Date.now() - 120000 },
    },
  ];

  static async search(query: string, filters: SearchFilters): Promise<SearchSuggestion[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    if (!query.trim()) return [];

    // Filter and score results based on query
    return this.mockData
      .filter(item => 
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.description?.toLowerCase().includes(query.toLowerCase()) ||
        item.subtitle?.toLowerCase().includes(query.toLowerCase())
      )
      .filter(item => filters.types.length === 0 || filters.types.includes(item.type))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);
  }

  static async getTrendingSearches(): Promise<SearchSuggestion[]> {
    return [
      {
        id: 'trending-1',
        type: 'query',
        title: 'Solana ecosystem tokens',
        confidence: 1,
        category: 'trending',
      },
      {
        id: 'trending-2',
        type: 'query',
        title: 'DeFi transactions today',
        confidence: 0.95,
        category: 'trending',
      },
      {
        id: 'trending-3',
        type: 'query',
        title: 'Jupiter aggregator swaps',
        confidence: 0.9,
        category: 'trending',
      },
    ];
  }

  static getSearchHistory(): SearchSuggestion[] {
    const saved = localStorage.getItem('opensvm-search-history');
    if (!saved) return [];
    
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  }

  static saveSearchHistory(searches: SearchSuggestion[]) {
    const recent = searches.slice(0, 10); // Keep only last 10
    localStorage.setItem('opensvm-search-history', JSON.stringify(recent));
  }
}

// Voice recognition hook
function useVoiceRecognition(): VoiceRecognition & {
  startListening: () => void;
  stopListening: () => void;
} {
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [error, setError] = useState<string>();

  const isSupported = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }, []);

  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setError(undefined);
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
          setConfidence(result[0].confidence);
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      setTranscript(finalTranscript || interimTranscript);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      setError(event.error);
      setIsListening(false);
    };

    setRecognition(recognition);

    return () => {
      recognition.abort();
    };
  }, [isSupported]);

  const startListening = useCallback(() => {
    if (recognition && !isListening) {
      setTranscript('');
      setError(undefined);
      recognition.start();
    }
  }, [recognition, isListening]);

  const stopListening = useCallback(() => {
    if (recognition && isListening) {
      recognition.stop();
    }
  }, [recognition, isListening]);

  return {
    isSupported,
    isListening,
    transcript,
    confidence,
    error,
    startListening,
    stopListening,
  };
}

// Main smart search component
export function SmartSearchSystem({ 
  onSearch,
  onSuggestionSelect,
  placeholder = "Search transactions, blocks, programs and tokens...",
  className = "",
}: {
  onSearch?: (query: string, filters: SearchFilters) => void;
  onSuggestionSelect?: (suggestion: SearchSuggestion) => void;
  placeholder?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const { announceToScreenReader } = useAccessibility();
  const { isMobile } = useResponsive();
  const { trackAction, shouldShowFeature } = useUserExpertise();

  // State
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [recentSearches, setRecentSearches] = useState<SearchSuggestion[]>([]);
  const [trendingSearches, setTrendingSearches] = useState<SearchSuggestion[]>([]);
  const [filters, setFilters] = useState<SearchFilters>({ types: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionRefs = useRef<(HTMLElement | null)[]>([]);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Voice recognition
  const voice = useVoiceRecognition();
  const [isVoiceActive, setIsVoiceActive] = useState(false);

  // Load initial data
  useEffect(() => {
    setRecentSearches(SearchService.getSearchHistory());
    SearchService.getTrendingSearches().then(setTrendingSearches);
  }, []);

  // Update query from voice recognition
  useEffect(() => {
    if (voice.transcript && isVoiceActive) {
      setQuery(voice.transcript);
      if (!voice.isListening && voice.transcript.length > 2) {
        handleSearch(voice.transcript);
        setIsVoiceActive(false);
      }
    }
  }, [voice.transcript, voice.isListening, isVoiceActive]);

  // Debounced search
  const debouncedSearch = useCallback(async (searchQuery: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        setIsLoading(true);
        try {
          const results = await SearchService.search(searchQuery, filters);
          setSuggestions(results);
          setSelectedIndex(-1);
          
          if (results.length > 0) {
            announceToScreenReader(
              `${results.length} search suggestions available`,
              'polite'
            );
          }
        } catch (error) {
          console.error('Search error:', error);
          setSuggestions([]);
        } finally {
          setIsLoading(false);
        }
      } else {
        setSuggestions([]);
        setSelectedIndex(-1);
      }
    }, 300);
  }, [filters, announceToScreenReader]);

  // Handle query changes
  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    setShowSuggestions(true);
    trackAction('search-input');
    
    if (value.trim()) {
      debouncedSearch(value);
    } else {
      setSuggestions([]);
      setSelectedIndex(-1);
    }
  }, [debouncedSearch, trackAction]);

  // Execute search
  const handleSearch = useCallback(async (searchQuery?: string) => {
    const queryToSearch = searchQuery || query;
    if (!queryToSearch.trim()) return;

    trackAction('search-execute');
    setShowSuggestions(false);

    // Add to search history
    const searchItem: SearchSuggestion = {
      id: Date.now().toString(),
      type: 'query',
      title: queryToSearch,
      confidence: 1,
      category: 'recent',
    };

    const newHistory = [searchItem, ...recentSearches.filter(s => s.title !== queryToSearch)];
    setRecentSearches(newHistory);
    SearchService.saveSearchHistory(newHistory);

    // Execute search callback
    onSearch?.(queryToSearch, filters);

    announceToScreenReader(`Searching for ${queryToSearch}`, 'assertive');
  }, [query, filters, recentSearches, onSearch, trackAction, announceToScreenReader]);

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback((suggestion: SearchSuggestion) => {
    setQuery(suggestion.title);
    setShowSuggestions(false);
    trackAction('search-suggestion-select');
    
    onSuggestionSelect?.(suggestion);
    announceToScreenReader(`Selected ${suggestion.title}`, 'assertive');
  }, [onSuggestionSelect, trackAction, announceToScreenReader]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const allSuggestions = [
      ...suggestions,
      ...(query.length === 0 ? [...recentSearches, ...trendingSearches] : [])
    ];

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, allSuggestions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && allSuggestions[selectedIndex]) {
          handleSuggestionSelect(allSuggestions[selectedIndex]);
        } else {
          handleSearch();
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
      case 'Tab':
        if (showSuggestions) {
          e.preventDefault();
          setShowSuggestions(false);
        }
        break;
    }
  }, [suggestions, recentSearches, trendingSearches, query, selectedIndex, handleSearch, handleSuggestionSelect, showSuggestions]);

  // Voice search toggle
  const toggleVoiceSearch = useCallback(() => {
    if (!voice.isSupported) {
      announceToScreenReader('Voice search is not supported in your browser', 'assertive');
      return;
    }

    if (voice.isListening) {
      voice.stopListening();
      setIsVoiceActive(false);
    } else {
      voice.startListening();
      setIsVoiceActive(true);
      announceToScreenReader('Voice search activated. Start speaking...', 'assertive');
    }
    
    trackAction('voice-search-toggle');
  }, [voice, trackAction, announceToScreenReader]);

  // Clear search
  const clearSearch = useCallback(() => {
    setQuery('');
    setSuggestions([]);
    setSelectedIndex(-1);
    setShowSuggestions(false);
    inputRef.current?.focus();
    trackAction('search-clear');
  }, [trackAction]);

  // Combined suggestions for display
  const displaySuggestions = useMemo(() => {
    if (query.length > 0) {
      return suggestions;
    }
    return [
      ...recentSearches.slice(0, 3),
      ...trendingSearches.slice(0, 3),
    ];
  }, [query, suggestions, recentSearches, trendingSearches]);

  return (
    <div className={cn("relative w-full max-w-2xl mx-auto", className)}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
          <Search className="h-5 w-5" />
        </div>
        
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          placeholder={placeholder}
          className="w-full h-12 pl-12 pr-24 text-base"
          aria-label="Search"
          aria-expanded={showSuggestions}
          aria-describedby="search-suggestions"
          aria-activedescendant={selectedIndex >= 0 ? `suggestion-${selectedIndex}` : undefined}
        />

        {/* Action Buttons */}
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
          {/* Voice Search Button */}
          {voice.isSupported && shouldShowFeature('ai-analysis') && (
            <EnhancedButton
              variant="ghost"
              size="icon-sm"
              onClick={toggleVoiceSearch}
              aria-label={voice.isListening ? t('search.stopVoice') : t('search.startVoice')}
              className={cn(
                "h-8 w-8",
                isVoiceActive && "bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400"
              )}
            >
              {voice.isListening ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </EnhancedButton>
          )}

          {/* Advanced Filters Toggle */}
          {shouldShowFeature('advanced-search') && (
            <EnhancedButton
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowFilters(!showFilters)}
              aria-label={t('search.filters')}
              className={cn("h-8 w-8", showFilters && "bg-accent")}
            >
              <Filter className="h-4 w-4" />
            </EnhancedButton>
          )}

          {/* Clear Button */}
          {query && (
            <EnhancedButton
              variant="ghost"
              size="icon-sm"
              onClick={clearSearch}
              aria-label={t('common.clear')}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </EnhancedButton>
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="h-8 w-8 flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </div>

      {/* Voice Recognition Status */}
      {isVoiceActive && (
        <div className="absolute top-full left-0 right-0 mt-1 p-2 bg-accent rounded-md border text-sm">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
            {voice.isListening ? 'Listening...' : 'Processing...'}
            {voice.transcript && (
              <span className="text-muted-foreground">
                "{voice.transcript}"
              </span>
            )}
          </div>
        </div>
      )}

      {/* Search Suggestions */}
      {showSuggestions && (displaySuggestions.length > 0 || query.length === 0) && (
        <Card className="absolute top-full left-0 right-0 mt-1 py-2 max-h-96 overflow-y-auto z-50 shadow-lg">
          <div id="search-suggestions" role="listbox" aria-label="Search suggestions">
            {/* Recent Searches */}
            {query.length === 0 && recentSearches.length > 0 && (
              <div className="px-3 py-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                  <Clock className="h-3 w-3" />
                  {t('search.recent', 'Recent')}
                </div>
                {recentSearches.slice(0, 3).map((suggestion, index) => (
                  <SuggestionItem
                    key={suggestion.id}
                    suggestion={suggestion}
                    isSelected={selectedIndex === index}
                    onClick={() => handleSuggestionSelect(suggestion)}
                    ref={el => suggestionRefs.current[index] = el}
                  />
                ))}
              </div>
            )}

            {/* Trending Searches */}
            {query.length === 0 && trendingSearches.length > 0 && (
              <div className="px-3 py-2 border-t">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                  <Trending className="h-3 w-3" />
                  {t('search.trending', 'Trending')}
                </div>
                {trendingSearches.slice(0, 3).map((suggestion, index) => {
                  const adjustedIndex = index + (query.length === 0 ? recentSearches.slice(0, 3).length : 0);
                  return (
                    <SuggestionItem
                      key={suggestion.id}
                      suggestion={suggestion}
                      isSelected={selectedIndex === adjustedIndex}
                      onClick={() => handleSuggestionSelect(suggestion)}
                      ref={el => suggestionRefs.current[adjustedIndex] = el}
                    />
                  );
                })}
              </div>
            )}

            {/* Search Results */}
            {suggestions.length > 0 && (
              <div className="px-3 py-2">
                {suggestions.map((suggestion, index) => (
                  <SuggestionItem
                    key={suggestion.id}
                    suggestion={suggestion}
                    isSelected={selectedIndex === index}
                    onClick={() => handleSuggestionSelect(suggestion)}
                    ref={el => suggestionRefs.current[index] = el}
                    query={query}
                  />
                ))}
              </div>
            )}

            {/* No Results */}
            {query.length > 2 && suggestions.length === 0 && !isLoading && (
              <div className="px-3 py-8 text-center text-muted-foreground text-sm">
                {t('search.noResults', 'No results found')}
                <p className="text-xs mt-1">
                  {t('search.tryDifferent', 'Try a different search term')}
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Advanced Filters Panel */}
      {showFilters && shouldShowFeature('advanced-search') && (
        <Card className="absolute top-full left-0 right-0 mt-1 p-4 z-40 shadow-lg">
          <div className="space-y-4">
            <h3 className="font-medium text-sm">{t('search.advancedFilters', 'Advanced Filters')}</h3>
            
            {/* Type Filters */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {t('search.types', 'Types')}
              </label>
              <div className="flex flex-wrap gap-2 mt-1">
                {['transaction', 'block', 'account', 'program', 'token'].map(type => (
                  <Badge
                    key={type}
                    variant={filters.types.includes(type) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => {
                      const newTypes = filters.types.includes(type)
                        ? filters.types.filter(t => t !== type)
                        : [...filters.types, type];
                      setFilters({ ...filters, types: newTypes });
                    }}
                  >
                    {type}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Clear Filters */}
            <div className="flex justify-end">
              <EnhancedButton
                variant="outline"
                size="sm"
                onClick={() => setFilters({ types: [] })}
              >
                {t('common.clear', 'Clear')}
              </EnhancedButton>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// Suggestion item component
const SuggestionItem = React.forwardRef<HTMLDivElement, {
  suggestion: SearchSuggestion;
  isSelected: boolean;
  onClick: () => void;
  query?: string;
}>(({ suggestion, isSelected, onClick, query }, ref) => {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'transaction':
        return '⚡';
      case 'block':
        return '🧱';
      case 'account':
        return '👤';
      case 'program':
        return '⚙️';
      case 'token':
        return '🪙';
      case 'query':
        return '🔍';
      default:
        return '📄';
    }
  };

  const highlightText = (text: string, highlight?: string) => {
    if (!highlight) return text;
    
    const regex = new RegExp(`(${highlight})`, 'gi');
    return text.split(regex).map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
          {part}
        </mark>
      ) : part
    );
  };

  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer transition-colors",
        "hover:bg-accent focus:bg-accent",
        isSelected && "bg-accent"
      )}
      onClick={onClick}
      role="option"
      aria-selected={isSelected}
      id={`suggestion-${suggestion.id}`}
    >
      <div className="text-lg flex-shrink-0">
        {suggestion.icon || getTypeIcon(suggestion.type)}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">
          {highlightText(suggestion.title, query)}
        </div>
        {suggestion.subtitle && (
          <div className="text-xs text-muted-foreground truncate">
            {highlightText(suggestion.subtitle, query)}
          </div>
        )}
        {suggestion.description && (
          <div className="text-xs text-muted-foreground truncate">
            {highlightText(suggestion.description, query)}
          </div>
        )}
      </div>
      
      {suggestion.confidence < 1 && (
        <div className="text-xs text-muted-foreground flex-shrink-0">
          {Math.round(suggestion.confidence * 100)}%
        </div>
      )}
    </div>
  );
});

SuggestionItem.displayName = 'SuggestionItem';

export default SmartSearchSystem;