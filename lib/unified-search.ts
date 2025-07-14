/**
 * Unified Search Interface
 * 
 * This module integrates all search sources (SVM, Moralis, Telegram, DuckDuckGo, X.com)
 * into a unified search interface with consistent result formatting and display.
 */

import { getComprehensiveBlockchainData } from './moralis-api';
import { searchTelegramChats, formatTelegramResults } from './telegram-search';
import { searchDuckDuckGo, formatDuckDuckGoResults } from './duckduckgo-search';
import { searchXCom, formatXComResults } from './xcom-search';
import { optimizeSearchResults } from './search-optimization';

// Search source types
export type SearchSource = 'svm' | 'telegram' | 'duckduckgo' | 'xcom' | 'all';

// Unified search result interface
export interface UnifiedSearchResult {
  id: string;
  type: string;
  title: string;
  content: string;
  url?: string;
  timestamp?: string;
  metadata?: any;
  score?: number;
  relevance?: number;
}

// Search options interface
export interface SearchOptions {
  sources?: SearchSource[];
  limit?: number;
  sortBy?: 'relevance' | 'date';
  sortOrder?: 'asc' | 'desc';
  includeBlockchainData?: boolean;
  filterByType?: string[];
  timeRange?: 'day' | 'week' | 'month' | 'year' | 'all';
}

// Cache for recent search results to improve performance
const searchCache: Record<string, { results: any; timestamp: number }> = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Perform a unified search across all specified sources
 * @param query - Search query
 * @param options - Search options
 * @returns Promise with search results from all sources
 */
export async function unifiedSearch(query: string, options: SearchOptions = {}) {
  const {
    sources = ['all'],
    limit = 10,
    sortBy = 'relevance',
    sortOrder = 'desc',
    includeBlockchainData = true,
    filterByType = [],
    timeRange = 'all'
  } = options;
  
  // Create cache key based on query and options
  const cacheKey = `${query}:${JSON.stringify(options)}`;
  
  // Check cache for recent results
  if (searchCache[cacheKey] && Date.now() - searchCache[cacheKey].timestamp < CACHE_DURATION) {
    console.log('Using cached search results for:', query);
    return searchCache[cacheKey].results;
  }
  
  // Determine which sources to search
  const searchSVM = sources.includes('all') || sources.includes('svm');
  const searchTelegram = sources.includes('all') || sources.includes('telegram');
  const searchDuckDuckGo = sources.includes('all') || sources.includes('duckduckgo');
  const searchX = sources.includes('all') || sources.includes('xcom');
  
  try {
    // Initialize results object
    const results: {
      svm: UnifiedSearchResult[];
      telegram: UnifiedSearchResult[];
      duckduckgo: UnifiedSearchResult[];
      xcom: UnifiedSearchResult[];
      blockchainData?: any;
    } = {
      svm: [],
      telegram: [],
      duckduckgo: [],
      xcom: []
    };
    
    // Perform searches in parallel
    const searchPromises: Promise<any>[] = [];
    
    // Fetch blockchain data if requested
    if (includeBlockchainData) {
      const blockchainDataPromise = getComprehensiveBlockchainData(query)
        .then((data: any) => {
          if (data) {
            results.blockchainData = data;
          }
        })
        .catch((error: any) => {
          console.error('Error fetching blockchain data:', error);
        });
      
      searchPromises.push(blockchainDataPromise);
    }
    
    // SVM search (using existing API)
    if (searchSVM) {
      const svmSearchPromise = fetch(`/api/search/filtered?q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(data => {
          // Format SVM results
          results.svm = data.map((result: any) => ({
            id: result.address || `svm_${Math.random().toString(36).substring(2, 15)}`,
            type: 'svm',
            title: result.type ? `${result.type.charAt(0).toUpperCase() + result.type.slice(1)}` : 'Solana Address',
            content: result.address,
            timestamp: result.timestamp,
            metadata: {
              ...result,
              blockchainData: results.blockchainData
            }
          }));
        })
        .catch(error => {
          console.error('Error in SVM search:', error);
          results.svm = [];
        });
      
      searchPromises.push(svmSearchPromise);
    }
    
    // Telegram search
    if (searchTelegram) {
      const telegramSearchPromise = searchTelegramChats(query, limit)
        .then(data => {
          results.telegram = formatTelegramResults(data);
        })
        .catch(error => {
          console.error('Error in Telegram search:', error);
          results.telegram = [];
        });
      
      searchPromises.push(telegramSearchPromise);
    }
    
    // DuckDuckGo search
    if (sources.includes('duckduckgo') || sources.includes('all')) {
      const duckDuckGoSearchPromise = searchDuckDuckGo(query, limit)
        .then((data: any) => {
          results.duckduckgo = formatDuckDuckGoResults(data);
        })
        .catch((error: any) => {
          console.error('Error in DuckDuckGo search:', error);
          results.duckduckgo = [];
        });
      
      searchPromises.push(duckDuckGoSearchPromise);
    }
    
    // X.com search
    if (searchX) {
      const xSearchPromise = searchXCom(query, limit)
        .then(data => {
          results.xcom = formatXComResults(data);
        })
        .catch(error => {
          console.error('Error in X.com search:', error);
          results.xcom = [];
        });
      
      searchPromises.push(xSearchPromise);
    }
    
    // Wait for all searches to complete
    await Promise.all(searchPromises);
    
    // Apply time range filter if specified
    if (timeRange !== 'all') {
      const cutoffDate = getTimeRangeCutoff(timeRange);
      
      Object.keys(results).forEach(key => {
        if (key !== 'blockchainData' && Array.isArray(results[key as keyof typeof results])) {
          const resultsArray = results[key as keyof typeof results] as UnifiedSearchResult[];
          results[key as keyof typeof results] = resultsArray.filter(result => {
            if (!result.timestamp) return true;
            const resultDate = new Date(result.timestamp);
            return resultDate >= cutoffDate;
          }) as any;
        }
      });
    }
    
    // Apply type filter if specified
    if (filterByType.length > 0) {
      Object.keys(results).forEach(key => {
        if (key !== 'blockchainData' && Array.isArray(results[key as keyof typeof results])) {
          const resultsArray = results[key as keyof typeof results] as UnifiedSearchResult[];
          results[key as keyof typeof results] = resultsArray.filter(result => 
            filterByType.includes(result.type)
          ) as any;
        }
      });
    }
    
    // Combine and sort results
    let allResults: UnifiedSearchResult[] = [
      ...results.svm,
      ...results.telegram,
      ...results.duckduckgo,
      ...results.xcom
    ];
    
    // Optimize and score results based on relevance to query
    allResults = optimizeSearchResults(allResults, query);
    
    // Sort results
    allResults = sortResults(allResults, sortBy, sortOrder);
    
    // Limit total results if specified
    if (limit > 0 && allResults.length > limit) {
      allResults = allResults.slice(0, limit);
    }
    
    // Prepare final result object
    const finalResults = {
      query,
      sources: {
        svm: results.svm,
        telegram: results.telegram,
        duckduckgo: results.duckduckgo,
        xcom: results.xcom
      },
      blockchainData: results.blockchainData,
      combined: allResults,
      timestamp: new Date().toISOString()
    };
    
    // Cache the results
    searchCache[cacheKey] = {
      results: finalResults,
      timestamp: Date.now()
    };
    
    return finalResults;
  } catch (error) {
    console.error('Error in unified search:', error);
    throw error;
  }
}

/**
 * Get cutoff date for time range filter
 * @param timeRange - Time range to filter by
 * @returns Date object representing the cutoff
 */
function getTimeRangeCutoff(timeRange: string): Date {
  const now = new Date();
  switch (timeRange) {
    case 'day':
      return new Date(now.setDate(now.getDate() - 1));
    case 'week':
      return new Date(now.setDate(now.getDate() - 7));
    case 'month':
      return new Date(now.setMonth(now.getMonth() - 1));
    case 'year':
      return new Date(now.setFullYear(now.getFullYear() - 1));
    default:
      return new Date(0); // Beginning of time
  }
}

/**
 * Sort search results based on specified criteria
 * @param results - Search results to sort
 * @param sortBy - Field to sort by
 * @param sortOrder - Sort order (asc or desc)
 * @returns Sorted results
 */
function sortResults(
  results: UnifiedSearchResult[],
  sortBy: 'relevance' | 'date',
  sortOrder: 'asc' | 'desc'
): UnifiedSearchResult[] {
  if (sortBy === 'date' && results.some(r => r.timestamp)) {
    return results.sort((a, b) => {
      const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
  }
  
  // For relevance sorting, use the relevance score if available
  return results.sort((a, b) => {
    const scoreA = a.relevance || 0;
    const scoreB = b.relevance || 0;
    
    return sortOrder === 'asc' ? scoreA - scoreB : scoreB - scoreA;
  });
}

/**
 * Clear the search cache
 */
export function clearSearchCache() {
  Object.keys(searchCache).forEach(key => delete searchCache[key]);
}

/**
 * Get appropriate icon for result type
 * @param type - Result type
 * @returns Icon JSX
 */
export function getResultTypeIcon(type: string): string {
  switch (type) {
    case 'svm':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path><line x1="16" y1="8" x2="2" y2="22"></line><line x1="17.5" y1="15" x2="9" y2="15"></line></svg>`;
    case 'telegram':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 12a9.5 9.5 0 1 1-9.5-9.5 9.46 9.46 0 0 1 9.5 9.5v0Z"></path><path d="m7 15 3-3a4.24 4.24 0 0 1 6 0l1 1"></path><path d="m17 13-5 5.5a4.24 4.24 0 0 1-6 0l-1-1"></path></svg>`;
    case 'web':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`;
    case 'x_com':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></svg>`;
    default:
      return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
  }
}

/**
 * Get appropriate background and text colors for result type
 * @param type - Result type
 * @returns Object with background and text color classes
 */
export function getResultTypeColors(type: string): { bg: string; text: string } {
  switch (type) {
    case 'svm':
      return {
        bg: 'bg-purple-100 dark:bg-purple-900/20',
        text: 'text-purple-500 dark:text-purple-300'
      };
    case 'telegram':
      return {
        bg: 'bg-blue-100 dark:bg-blue-900/20',
        text: 'text-blue-500 dark:text-blue-300'
      };
    case 'web':
      return {
        bg: 'bg-green-100 dark:bg-green-900/20',
        text: 'text-green-500 dark:text-green-300'
      };
    case 'x_com':
      return {
        bg: 'bg-gray-100 dark:bg-gray-800',
        text: 'text-gray-700 dark:text-gray-300'
      };
    default:
      return {
        bg: 'bg-primary/10',
        text: 'text-primary'
      };
  }
}

/**
 * Render a unified search result
 * @param result - Search result to render
 * @returns HTML string for the result card
 */
export function renderUnifiedSearchResult(result: UnifiedSearchResult): string {
  const icon = getResultTypeIcon(result.type);
  const date = result.timestamp ? new Date(result.timestamp) : null;
  const formattedDate = date ? `${date.toLocaleDateString()} ${date.toLocaleTimeString()}` : '';
  const colors = getResultTypeColors(result.type);
  
  return `
    <div class="border rounded-lg p-4 hover:bg-muted/30 transition-colors duration-200 animate-in fade-in-0" style="animation-delay: ${Math.random() * 300}ms">
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0 w-10 h-10 ${colors.bg} rounded-full flex items-center justify-center ${colors.text}">
          ${icon}
        </div>
        <div class="flex-1">
          <div class="flex justify-between items-start">
            <h3 class="font-medium text-sm">${result.title}</h3>
            ${date ? `<span class="text-xs text-muted-foreground">${formattedDate}</span>` : ''}
          </div>
          <p class="mt-1 text-sm">${result.content}</p>
          ${result.url ? `
            <div class="mt-2">
              <a href="${result.url}" target="_blank" rel="noopener noreferrer" class="text-xs text-primary hover:underline">
                View source
              </a>
            </div>
          ` : ''}
          ${result.relevance ? `
            <div class="mt-1">
              <span class="text-xs text-muted-foreground">Relevance: ${Math.round(result.relevance * 100)}%</span>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

/**
 * Group search results by source type
 * @param results - Combined search results
 * @returns Object with results grouped by source
 */
export function groupResultsBySource(results: UnifiedSearchResult[]): Record<string, UnifiedSearchResult[]> {
  const grouped: Record<string, UnifiedSearchResult[]> = {
    svm: [],
    telegram: [],
    web: [],
    x_com: []
  };
  
  results.forEach(result => {
    const type = result.type;
    if (!grouped[type]) {
      grouped[type] = [];
    }
    grouped[type].push(result);
  });
  
  return grouped;
}

/**
 * Get source name for display
 * @param source - Source type
 * @returns Formatted source name
 */
export function getSourceDisplayName(source: string): string {
  switch (source) {
    case 'svm':
      return 'Solana VM';
    case 'telegram':
      return 'Telegram';
    case 'web':
      return 'Web (DuckDuckGo)';
    case 'x_com':
      return 'X.com';
    default:
      return source.charAt(0).toUpperCase() + source.slice(1);
  }
}
