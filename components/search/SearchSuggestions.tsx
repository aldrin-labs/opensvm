'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, Coins, Building2, BarChart, RotateCw, DollarSign, Palette, 
  Clock, TrendingUp, TrendingDown, Gem, Users, Hash, CheckCircle, 
  Wrench, Tag, Rocket, User, X, Fuel, Package, FileText, 
  Globe, Bot, Zap 
} from 'lucide-react';
import { SearchSuggestion } from './types';

interface SearchSuggestionsProps {
  showSuggestions: boolean;
  suggestions: SearchSuggestion[];
  suggestionsRef: React.RefObject<HTMLDivElement>;
  setQuery: (query: string) => void;
  setShowSuggestions: (show: boolean) => void;
  handleSubmit: (e: React.FormEvent) => void;
  onSubmitValue?: (value: string) => void;
  isLoading?: boolean;
  isAISearching?: boolean;
  aiAnswer?: string;
  currentTip?: string;
  query?: string;
}

// Helper function to format currency values
const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return '$0.00';
  }
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toFixed(2)}`;
};

// Helper function to format numbers
const formatNumber = (value: number): string => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
};

// Helper function to format dates
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 7) {
    return date.toLocaleDateString();
  } else if (diffDays > 0) {
    return `${diffDays}d ago`;
  } else if (diffHours > 0) {
    return `${diffHours}h ago`;
  } else {
    return 'Recently';
  }
};

export const SearchSuggestions: React.FC<SearchSuggestionsProps> = ({
  showSuggestions,
  suggestions,
  suggestionsRef,
  setQuery,
  setShowSuggestions,
  handleSubmit,
  onSubmitValue,
  isLoading = false,
  isAISearching = false,
  aiAnswer = '',
  currentTip = '',
  query = '',
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!showSuggestions) {
    return null;
  }

  // Group suggestions by section if they have section metadata
  const groupedSuggestions = suggestions.reduce((acc, suggestion, index) => {
    const section = suggestion.metadata?.section || 'general';
    if (!acc[section]) {
      acc[section] = {
        title: suggestion.metadata?.sectionTitle || 'Suggestions',
        icon: suggestion.metadata?.sectionIcon || <Search className="w-4 h-4" />,
        description: suggestion.metadata?.sectionDescription || '',
        suggestions: []
      };
    }
    acc[section].suggestions.push({ ...suggestion, originalIndex: index });
    return acc;
  }, {} as Record<string, { title: string; icon: string | React.ReactElement; description: string; suggestions: any[] }>);

  const hasGroupedSections = Object.keys(groupedSuggestions).length > 1 ||
    (Object.keys(groupedSuggestions).length === 1 && !groupedSuggestions['general']);

  const renderSuggestionMetadata = (suggestion: SearchSuggestion) => {
    const primaryMetadata = [];
    const secondaryMetadata = [];
    const detailMetadata = [];

    switch (suggestion.type) {
      case 'address':
        // Primary info
        if (suggestion.balance !== undefined) {
          primaryMetadata.push(
            <span className="flex items-center gap-1">
              <Coins className="w-3 h-3" />
              {suggestion.balance.toFixed(4)} SOL
            </span>
          );
        }
        if (suggestion.stakeBalance !== undefined && suggestion.stakeBalance > 0) {
          primaryMetadata.push(
            <span className="flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              {suggestion.stakeBalance.toFixed(2)} SOL staked
            </span>
          );
        }

        // Secondary info
        if (suggestion.actionCount !== undefined) {
          secondaryMetadata.push(
            <span className="flex items-center gap-1">
              <BarChart className="w-3 h-3" />
              {formatNumber(suggestion.actionCount)} total txns
            </span>
          );
        }
        if (suggestion.recentTxCount !== undefined) {
          secondaryMetadata.push(
            <span className="flex items-center gap-1">
              <RotateCw className="w-3 h-3" />
              {suggestion.recentTxCount} recent (7d)
            </span>
          );
        }

        // Detail info
        if (suggestion.tokensHeld !== undefined) {
          detailMetadata.push(
            <span className="flex items-center gap-1">
              <Coins className="w-3 h-3" />
              {suggestion.tokensHeld} tokens
            </span>
          );
        }
        if (suggestion.nftCount !== undefined) {
          detailMetadata.push(
            <span className="flex items-center gap-1">
              <Palette className="w-3 h-3" />
              {suggestion.nftCount} NFTs
            </span>
          );
        }
        if (suggestion.lastUpdate) {
          detailMetadata.push(
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Active {formatDate(suggestion.lastUpdate)}
            </span>
          );
        }
        break;

      case 'token':
        // Primary info
        if (suggestion.price !== undefined) {
          primaryMetadata.push(
            <span className="flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              {formatCurrency(suggestion.price)}
            </span>
          );
        }
        if (suggestion.priceChange24h !== undefined) {
          const ChangeIcon = suggestion.priceChange24h >= 0 ? TrendingUp : TrendingDown;
          primaryMetadata.push(
            <span className="flex items-center gap-1">
              <ChangeIcon className="w-3 h-3" />
              {suggestion.priceChange24h.toFixed(2)}%
            </span>
          );
        }

        // Secondary info
        if (suggestion.volume !== undefined) {
          secondaryMetadata.push(
            <span className="flex items-center gap-1">
              <BarChart className="w-3 h-3" />
              Vol: {formatCurrency(suggestion.volume)}
            </span>
          );
        }
        if (suggestion.marketCap !== undefined) {
          secondaryMetadata.push(
            <span className="flex items-center gap-1">
              <Gem className="w-3 h-3" />
              MCap: {formatCurrency(suggestion.marketCap)}
            </span>
          );
        }

        // Detail info
        if (suggestion.holders !== undefined) {
          detailMetadata.push(
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {formatNumber(suggestion.holders)} holders
            </span>
          );
        }
        if (suggestion.supply !== undefined) {
          detailMetadata.push(
            <span className="flex items-center gap-1">
              <Hash className="w-3 h-3" />
              Supply: {formatNumber(suggestion.supply)}
            </span>
          );
        }
        if (suggestion.metadata?.verified) {
          detailMetadata.push(
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Verified
            </span>
          );
        }
        if (suggestion.lastUpdate) {
          detailMetadata.push(
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(suggestion.lastUpdate)}
            </span>
          );
        }
        break;

      case 'program':
        // Primary info
        if (suggestion.usageCount !== undefined) {
          primaryMetadata.push(
            <span className="flex items-center gap-1">
              <Wrench className="w-3 h-3" />
              {formatNumber(suggestion.usageCount)} total calls
            </span>
          );
        }
        if (suggestion.weeklyInvocations !== undefined) {
          primaryMetadata.push(
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {formatNumber(suggestion.weeklyInvocations)} weekly
            </span>
          );
        }

        // Secondary info
        if (suggestion.programType) {
          secondaryMetadata.push(
            <span className="flex items-center gap-1">
              <Tag className="w-3 h-3" />
              {suggestion.programType}
            </span>
          );
        }
        if (suggestion.deploymentDate) {
          secondaryMetadata.push(
            <span className="flex items-center gap-1">
              <Rocket className="w-3 h-3" />
              Deployed {formatDate(suggestion.deploymentDate)}
            </span>
          );
        }

        // Detail info
        if (suggestion.deployer) {
          detailMetadata.push(
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {suggestion.deployer.slice(0, 8)}...
            </span>
          );
        }
        if (suggestion.metadata?.verified) {
          detailMetadata.push(
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Verified
            </span>
          );
        }
        if (suggestion.lastUpdate) {
          detailMetadata.push(
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Updated {formatDate(suggestion.lastUpdate)}
            </span>
          );
        }
        break;

      case 'transaction':
        // Primary info
        if (suggestion.success !== undefined) {
          const StatusIcon = suggestion.success ? CheckCircle : X;
          primaryMetadata.push(
            <span className="flex items-center gap-1">
              <StatusIcon className="w-3 h-3" />
              {suggestion.success ? 'Success' : 'Failed'}
            </span>
          );
        }
        if (suggestion.amount !== undefined && suggestion.amount > 0) {
          primaryMetadata.push(
            <span className="flex items-center gap-1">
              <Coins className="w-3 h-3" />
              {suggestion.amount.toFixed(4)} SOL
            </span>
          );
        }

        // Secondary info
        if (suggestion.fees !== undefined) {
          secondaryMetadata.push(
            <span className="flex items-center gap-1">
              <Fuel className="w-3 h-3" />
              {suggestion.fees.toFixed(6)} SOL fees
            </span>
          );
        }
        if (suggestion.blockHeight !== undefined) {
          secondaryMetadata.push(
            <span className="flex items-center gap-1">
              <Package className="w-3 h-3" />
              Block {formatNumber(suggestion.blockHeight)}
            </span>
          );
        }

        // Detail info
        if (suggestion.instructions !== undefined) {
          detailMetadata.push(
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {suggestion.instructions} instructions
            </span>
          );
        }
        if (suggestion.participants && suggestion.participants.length > 0) {
          detailMetadata.push(
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {suggestion.participants.length} participants
            </span>
          );
        }
        if (suggestion.lastUpdate) {
          detailMetadata.push(
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(suggestion.lastUpdate)}
            </span>
          );
        }
        break;

      case 'recent_global':
        primaryMetadata.push(
          <span className="flex items-center gap-1">
            <Globe className="w-3 h-3" />
            Popular search
          </span>
        );
        if (suggestion.lastUpdate) {
          secondaryMetadata.push(`Searched ${formatDate(suggestion.lastUpdate)}`);
        }
        break;

      case 'recent_user':
        primaryMetadata.push(
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            Your recent search
          </span>
        );
        if (suggestion.lastUpdate) {
          secondaryMetadata.push(`Searched ${formatDate(suggestion.lastUpdate)}`);
        }
        break;
    }

    return { primaryMetadata, secondaryMetadata, detailMetadata };
  };

  return (
    <div
      ref={suggestionsRef}
      data-suggestions-container
      className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border hover:scrollbar-thumb-border/80 scrollbar-thumb-rounded-full"
      style={{
        scrollbarWidth: 'thin',
        scrollbarColor: 'hsl(var(--border)) transparent'
      }}
    >
      {isLoading ? (
        <div className="px-4 py-3 text-center text-muted-foreground">
          <div className="flex items-center justify-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
            <div className="w-2 h-2 rounded-full bg-info animate-pulse delay-150"></div>
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse delay-300"></div>
          </div>
          <p className="mt-1 text-sm text-foreground">Loading suggestions...</p>
        </div>
      ) : suggestions.length === 0 ? (
        <>
          {isAISearching ? (
            <div className="px-6 py-6">
              {/* AI Search Header */}
              <div className="text-center mb-4">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-[#00DC82] animate-pulse"></div>
                  <div className="w-2 h-2 rounded-full bg-[#00DC82] animate-pulse delay-150"></div>
                  <div className="w-2 h-2 rounded-full bg-[#00DC82] animate-pulse delay-300"></div>
                </div>
                <h3 className="text-sm font-medium text-foreground mb-1 flex items-center gap-2 justify-center">
                  <Bot className="w-4 h-4" />
                  AI Assistant is searching...
                </h3>
                <p className="text-xs text-muted-foreground">
                  Analyzing "{query}" with advanced blockchain intelligence
                </p>
              </div>

              {/* Rotating Tips */}
              {currentTip && (
                <div className="bg-muted/30 rounded-lg p-3 border border-border/30">
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00DC82] animate-ping"></div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {currentTip}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : aiAnswer ? (
            <div className="px-4 py-3">
              {/* AI Answer Header */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-full bg-[#00DC82] flex items-center justify-center">
                  <Bot className="w-3 h-3 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground">AI Assistant</h3>
                  <p className="text-xs text-muted-foreground">Found information about "{query}"</p>
                </div>
              </div>

              {/* AI Answer Content */}
              <div className="bg-muted/20 rounded-lg p-3 border border-border/30">
                <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {aiAnswer}
                </div>
              </div>

              {/* Action Footer */}
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Powered by OpenSVM AI</span>
                <span>Need more details? Try the AI chat →</span>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <>
          {hasGroupedSections ? (
            // Render grouped sections without headers
            Object.entries(groupedSuggestions).map(([sectionKey, section], _sectionIndex) => (
              <div key={sectionKey}>
                {/* Section Items */}
                {section.suggestions.map((suggestion, _index) => {
                  const { primaryMetadata, secondaryMetadata, detailMetadata: _detailMetadata } = renderSuggestionMetadata(suggestion);
                  const globalIndex = suggestion.originalIndex;
                  const isHovered = hoveredIndex === globalIndex;

                  return (
                    <button
                      key={`${suggestion.type}-${suggestion.value}-${globalIndex}`}
                      type="button"
                      onClick={() => {
                        setQuery(suggestion.value);
                        setShowSuggestions(false);
                        console.log("Suggestion selected:", suggestion.value);

                        if (onSubmitValue) {
                          onSubmitValue(suggestion.value);
                        } else if (typeof document !== 'undefined') {
                          // Fallback: create a simple form submit event
                          setTimeout(() => {
                            const form = document.createElement('form');
                            const input = document.createElement('input');
                            input.value = suggestion.value;
                            form.appendChild(input);

                            const event = new Event('submit', { bubbles: true, cancelable: true });
                            Object.defineProperty(event, 'target', { value: input, enumerable: true });

                            handleSubmit(event as unknown as React.FormEvent);
                          }, 0);
                        }
                      }}
                      className={`w-full px-3 py-2 text-left hover:bg-muted/50 transition-all duration-200 relative border-b border-border/30 last:border-b-0 ${isHovered ? 'bg-muted/70' : ''}`}
                      onMouseEnter={() => setHoveredIndex(globalIndex)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      {isHovered && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r" />
                      )}

                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            {suggestion.metadata?.icon && (
                              <span className="text-sm">{suggestion.metadata.icon}</span>
                            )}
                            {suggestion.metadata?.trending && (
                              <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 px-1.5 py-0.5 rounded font-medium">
                                TRENDING
                              </span>
                            )}
                            {suggestion.metadata?.timeAgo && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {suggestion.metadata.timeAgo}
                              </span>
                            )}
                          </div>

                          {/* Value/Path only */}
                          <div className="text-sm font-medium text-foreground mb-1 font-mono break-all">
                            {suggestion.value}
                          </div>

                          {/* Usage count and last visit */}
                          <div className="flex flex-wrap gap-2 text-xs">
                            {suggestion.usageCount && (
                              <span className="text-muted-foreground flex items-center gap-1">
                                <BarChart className="w-3 h-3" />
                                {suggestion.usageCount} visits
                              </span>
                            )}
                            {suggestion.lastUpdate && (
                              <span className="text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDate(suggestion.lastUpdate)}
                              </span>
                            )}
                          </div>

                          {/* Primary and secondary metadata combined */}
                          {(primaryMetadata.length > 0 || secondaryMetadata.length > 0) && (
                            <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                              {[...primaryMetadata, ...secondaryMetadata].map((item, idx) => (
                                <span key={idx}>{item}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          ) : (
            // Render standard suggestions without sections
            suggestions.map((suggestion, index) => {
              const { primaryMetadata, secondaryMetadata, detailMetadata } = renderSuggestionMetadata(suggestion);
              const isHovered = hoveredIndex === index;

              return (
                <button
                  key={`${suggestion.type}-${suggestion.value}`}
                  type="button"
                  onClick={() => {
                    setQuery(suggestion.value);
                    setShowSuggestions(false);
                    console.log("Suggestion selected:", suggestion.value);

                    if (onSubmitValue) {
                      onSubmitValue(suggestion.value);
                    } else if (typeof document !== 'undefined') {
                      // Fallback: create a simple form submit event
                      setTimeout(() => {
                        const form = document.createElement('form');
                        const input = document.createElement('input');
                        input.value = suggestion.value;
                        form.appendChild(input);

                        const event = new Event('submit', { bubbles: true, cancelable: true });
                        Object.defineProperty(event, 'target', { value: input, enumerable: true });

                        handleSubmit(event as unknown as React.FormEvent);
                      }, 0);
                    }
                  }}
                  className={`w-full px-3 py-2 text-left hover:bg-muted/50 transition-all duration-200 relative border-b border-border/30 last:border-b-0 ${isHovered ? 'bg-muted/70' : ''}`}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {isHovered && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r" />
                  )}

                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${suggestion.type === 'address' ? 'bg-info/10 text-info border border-info/30' :
                            suggestion.type === 'token' ? 'bg-success/10 text-success border border-success/30' :
                              suggestion.type === 'program' ? 'bg-primary/10 text-primary border border-primary/30' :
                                suggestion.type === 'recent_global' ? 'bg-muted text-muted-foreground border border-border' :
                                  suggestion.type === 'recent_user' ? 'bg-info/10 text-info border border-info/30' :
                                    'bg-warning/10 text-warning border border-warning/30'
                          }`}>
                          {suggestion.type === 'recent_global' ? 'POPULAR' :
                            suggestion.type === 'recent_user' ? 'RECENT' :
                              suggestion.type.toUpperCase()}
                        </span>
                        {suggestion.metadata?.verified && (
                          <span className="text-xs bg-success/10 text-success border border-success/30 px-1.5 py-0.5 rounded">
                            VERIFIED
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-medium text-foreground mb-1">
                        {suggestion.name || suggestion.label || suggestion.value}
                      </div>

                      {suggestion.symbol && suggestion.symbol !== suggestion.value && (
                        <div className="text-xs text-muted-foreground mb-1">
                          {suggestion.symbol}
                        </div>
                      )}

                      {/* Combined metadata */}
                      {(primaryMetadata.length > 0 || secondaryMetadata.length > 0 || detailMetadata.length > 0) && (
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {[...primaryMetadata, ...secondaryMetadata, ...detailMetadata.slice(0, 2)].map((item, idx) => (
                            <span key={idx}>{item}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}

          <div className="px-3 py-2 border-t border-border text-xs text-muted-foreground bg-muted/30">
            <div className="flex justify-between items-center">
              <span>Press <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-xs font-mono">↑</kbd> <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-xs font-mono">↓</kbd> to navigate</span>
              <span>Press <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-xs font-mono">Enter</kbd> to select</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
