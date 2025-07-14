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
  onSubmitValue?: (value: string) => void;
  isLoading?: boolean;
}

// Helper function to format currency values
const formatCurrency = (value: number): string => {
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
        icon: suggestion.metadata?.sectionIcon || '🔍',
        description: suggestion.metadata?.sectionDescription || '',
        suggestions: []
      };
    }
    acc[section].suggestions.push({ ...suggestion, originalIndex: index });
    return acc;
  }, {} as Record<string, { title: string; icon: string; description: string; suggestions: any[] }>);

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
          primaryMetadata.push(`💰 ${suggestion.balance.toFixed(4)} SOL`);
        }
        if (suggestion.stakeBalance !== undefined && suggestion.stakeBalance > 0) {
          primaryMetadata.push(`🏛️ ${suggestion.stakeBalance.toFixed(2)} SOL staked`);
        }
        
        // Secondary info
        if (suggestion.actionCount !== undefined) {
          secondaryMetadata.push(`📊 ${formatNumber(suggestion.actionCount)} total txns`);
        }
        if (suggestion.recentTxCount !== undefined) {
          secondaryMetadata.push(`🔄 ${suggestion.recentTxCount} recent (7d)`);
        }
        
        // Detail info
        if (suggestion.tokensHeld !== undefined) {
          detailMetadata.push(`🪙 ${suggestion.tokensHeld} tokens`);
        }
        if (suggestion.nftCount !== undefined) {
          detailMetadata.push(`🎨 ${suggestion.nftCount} NFTs`);
        }
        if (suggestion.lastUpdate) {
          detailMetadata.push(`⏰ Active ${formatDate(suggestion.lastUpdate)}`);
        }
        break;

      case 'token':
        // Primary info
        if (suggestion.price !== undefined) {
          primaryMetadata.push(`💵 ${formatCurrency(suggestion.price)}`);
        }
        if (suggestion.priceChange24h !== undefined) {
          const changeIcon = suggestion.priceChange24h >= 0 ? '📈' : '📉';
          primaryMetadata.push(`${changeIcon} ${suggestion.priceChange24h.toFixed(2)}%`);
        }
        
        // Secondary info
        if (suggestion.volume !== undefined) {
          secondaryMetadata.push(`📊 Vol: ${formatCurrency(suggestion.volume)}`);
        }
        if (suggestion.marketCap !== undefined) {
          secondaryMetadata.push(`💎 MCap: ${formatCurrency(suggestion.marketCap)}`);
        }
        
        // Detail info
        if (suggestion.holders !== undefined) {
          detailMetadata.push(`👥 ${formatNumber(suggestion.holders)} holders`);
        }
        if (suggestion.supply !== undefined) {
          detailMetadata.push(`🔢 Supply: ${formatNumber(suggestion.supply)}`);
        }
        if (suggestion.metadata?.verified) {
          detailMetadata.push('✅ Verified');
        }
        if (suggestion.lastUpdate) {
          detailMetadata.push(`⏰ ${formatDate(suggestion.lastUpdate)}`);
        }
        break;

      case 'program':
        // Primary info
        if (suggestion.usageCount !== undefined) {
          primaryMetadata.push(`🔧 ${formatNumber(suggestion.usageCount)} total calls`);
        }
        if (suggestion.weeklyInvocations !== undefined) {
          primaryMetadata.push(`📈 ${formatNumber(suggestion.weeklyInvocations)} weekly`);
        }
        
        // Secondary info
        if (suggestion.programType) {
          secondaryMetadata.push(`🏷️ ${suggestion.programType}`);
        }
        if (suggestion.deploymentDate) {
          secondaryMetadata.push(`🚀 Deployed ${formatDate(suggestion.deploymentDate)}`);
        }
        
        // Detail info
        if (suggestion.deployer) {
          detailMetadata.push(`👨‍💻 ${suggestion.deployer.slice(0, 8)}...`);
        }
        if (suggestion.metadata?.verified) {
          detailMetadata.push('✅ Verified');
        }
        if (suggestion.lastUpdate) {
          detailMetadata.push(`⏰ Updated ${formatDate(suggestion.lastUpdate)}`);
        }
        break;

      case 'transaction':
        // Primary info
        if (suggestion.success !== undefined) {
          primaryMetadata.push(suggestion.success ? '✅ Success' : '❌ Failed');
        }
        if (suggestion.amount !== undefined && suggestion.amount > 0) {
          primaryMetadata.push(`💰 ${suggestion.amount.toFixed(4)} SOL`);
        }
        
        // Secondary info
        if (suggestion.fees !== undefined) {
          secondaryMetadata.push(`⛽ ${suggestion.fees.toFixed(6)} SOL fees`);
        }
        if (suggestion.blockHeight !== undefined) {
          secondaryMetadata.push(`📦 Block ${formatNumber(suggestion.blockHeight)}`);
        }
        
        // Detail info
        if (suggestion.instructions !== undefined) {
          detailMetadata.push(`📝 ${suggestion.instructions} instructions`);
        }
        if (suggestion.participants && suggestion.participants.length > 0) {
          detailMetadata.push(`👥 ${suggestion.participants.length} participants`);
        }
        if (suggestion.lastUpdate) {
          detailMetadata.push(`⏰ ${formatDate(suggestion.lastUpdate)}`);
        }
        break;

      case 'recent_global':
        primaryMetadata.push('🌐 Popular search');
        if (suggestion.lastUpdate) {
          secondaryMetadata.push(`Searched ${formatDate(suggestion.lastUpdate)}`);
        }
        break;

      case 'recent_user':
        primaryMetadata.push('👤 Your recent search');
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
      className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto"
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
          {hasGroupedSections ? (
            // Render grouped sections with headers
            Object.entries(groupedSuggestions).map(([sectionKey, section], _sectionIndex) => (
              <div key={sectionKey}>
                {/* Section Header */}
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{section.icon}</span>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {section.title}
                      </h3>
                      {section.description && (
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {section.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                
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
                        } else {
                          // Fallback: create a simple form submit event
                          setTimeout(() => {
                            const form = document.createElement('form');
                            const input = document.createElement('input');
                            input.value = suggestion.value;
                            form.appendChild(input);
                            
                            const event = new Event('submit', { bubbles: true, cancelable: true });
                            Object.defineProperty(event, 'target', { value: input, enumerable: true });
                            
                            handleSubmit(event as unknown as React.FormEvent);
                          }, 50);
                        }
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200 relative border-b border-gray-100 dark:border-gray-800 last:border-b-0 ${
                        isHovered ? 'bg-gray-50 dark:bg-gray-800' : ''
                      }`}
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
                          
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                            {suggestion.name || suggestion.label || suggestion.value}
                          </div>
                          
                          {suggestion.symbol && suggestion.symbol !== suggestion.value && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                              {suggestion.symbol}
                            </div>
                          )}
                          
                          {/* Primary metadata - most important info */}
                          {primaryMetadata.length > 0 && (
                            <div className="flex flex-wrap gap-3 mb-1">
                              {primaryMetadata.map((item, idx) => (
                                <span key={idx} className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {item}
                                </span>
                              ))}
                            </div>
                          )}
                          
                          {/* Secondary metadata - additional important info */}
                          {secondaryMetadata.length > 0 && (
                            <div className="flex flex-wrap gap-3 mb-1">
                              {secondaryMetadata.map((item, idx) => (
                                <span key={idx} className="text-xs text-gray-600 dark:text-gray-400">
                                  {item}
                                </span>
                              ))}
                            </div>
                          )}
                          
                          {suggestion.metadata?.description && (
                            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1 line-clamp-2">
                              {suggestion.metadata.description}
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
                    } else {
                      // Fallback: create a simple form submit event
                      setTimeout(() => {
                        const form = document.createElement('form');
                        const input = document.createElement('input');
                        input.value = suggestion.value;
                        form.appendChild(input);
                        
                        const event = new Event('submit', { bubbles: true, cancelable: true });
                        Object.defineProperty(event, 'target', { value: input, enumerable: true });
                        
                        handleSubmit(event as unknown as React.FormEvent);
                      }, 50);
                    }
                  }}
                  className={`w-full px-4 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200 relative border-b border-gray-100 dark:border-gray-800 last:border-b-0 ${
                    isHovered ? 'bg-gray-50 dark:bg-gray-800' : ''
                  }`}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {isHovered && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r" />
                  )}
                  
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          suggestion.type === 'address' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                          suggestion.type === 'token' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                          suggestion.type === 'program' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' :
                          suggestion.type === 'recent_global' ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' :
                          suggestion.type === 'recent_user' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' :
                          'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                        }`}>
                          {suggestion.type === 'recent_global' ? 'POPULAR' :
                           suggestion.type === 'recent_user' ? 'RECENT' :
                           suggestion.type.toUpperCase()}
                        </span>
                        {suggestion.metadata?.verified && (
                          <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 px-1.5 py-0.5 rounded">
                            VERIFIED
                          </span>
                        )}
                      </div>
                      
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                        {suggestion.name || suggestion.label || suggestion.value}
                      </div>
                      
                      {suggestion.symbol && suggestion.symbol !== suggestion.value && (
                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                          {suggestion.symbol}
                        </div>
                      )}
                      
                      {/* Primary metadata - most important info */}
                      {primaryMetadata.length > 0 && (
                        <div className="flex flex-wrap gap-3 mb-1">
                          {primaryMetadata.map((item, idx) => (
                            <span key={idx} className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {item}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      {/* Secondary metadata - additional important info */}
                      {secondaryMetadata.length > 0 && (
                        <div className="flex flex-wrap gap-3 mb-1">
                          {secondaryMetadata.map((item, idx) => (
                            <span key={idx} className="text-xs text-gray-600 dark:text-gray-400">
                              {item}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      {/* Detail metadata - supplementary info */}
                      {detailMetadata.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {detailMetadata.map((item, idx) => (
                            <span key={idx} className="text-xs text-gray-500 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                              {item}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      {suggestion.metadata?.description && (
                        <div className="text-xs text-gray-500 dark:text-gray-500 mt-1 line-clamp-2">
                          {suggestion.metadata.description}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
          
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900">
            <div className="flex justify-between items-center">
              <span>Press <kbd className="px-1 py-0.5 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-xs">↑</kbd> <kbd className="px-1 py-0.5 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-xs">↓</kbd> to navigate</span>
              <span>Press <kbd className="px-1 py-0.5 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-xs">Enter</kbd> to select</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
