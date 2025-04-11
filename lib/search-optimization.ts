/**
 * Search Optimization Module
 * 
 * This module provides functions to optimize search results by:
 * - Scoring results based on relevance to query
 * - Deduplicating similar results
 * - Prioritizing results based on source reliability
 * - Optimizing performance with caching and batching
 */

import { UnifiedSearchResult } from './unified-search';

// LRU Cache for search optimization
const optimizationCache: Map<string, { results: UnifiedSearchResult[], timestamp: number }> = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

/**
 * Optimize search results based on relevance to query
 * @param results - Search results to optimize
 * @param query - Original search query
 * @returns Optimized search results with relevance scores
 */
export function optimizeSearchResults(
  results: UnifiedSearchResult[],
  query: string
): UnifiedSearchResult[] {
  // Check cache first
  const cacheKey = `${query}:${results.map(r => r.id).join(',')}`;
  const cachedResults = optimizationCache.get(cacheKey);
  
  if (cachedResults && Date.now() - cachedResults.timestamp < CACHE_DURATION) {
    return cachedResults.results;
  }
  
  // Process in batches to avoid blocking the main thread
  const batchSize = 50;
  const batches = [];
  
  for (let i = 0; i < results.length; i += batchSize) {
    batches.push(results.slice(i, i + batchSize));
  }
  
  let optimizedResults: UnifiedSearchResult[] = [];
  
  // Process each batch
  batches.forEach(batch => {
    const batchResults = batch.map(result => {
      // Calculate relevance score
      const relevance = calculateRelevanceScore(result, query);
      
      // Add relevance score to result
      return {
        ...result,
        relevance
      };
    });
    
    optimizedResults = [...optimizedResults, ...batchResults];
  });
  
  // Deduplicate similar results
  optimizedResults = deduplicateSimilarResults(optimizedResults);
  
  // Cache the results
  optimizationCache.set(cacheKey, {
    results: optimizedResults,
    timestamp: Date.now()
  });
  
  // Limit cache size to prevent memory leaks
  if (optimizationCache.size > 100) {
    const oldestKey = [...optimizationCache.entries()]
      .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
    optimizationCache.delete(oldestKey);
  }
  
  return optimizedResults;
}

/**
 * Calculate relevance score for a search result
 * @param result - Search result to score
 * @param query - Original search query
 * @returns Relevance score between 0 and 1
 */
function calculateRelevanceScore(result: UnifiedSearchResult, query: string): number {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
  
  if (queryTerms.length === 0) {
    return 0.5; // Default score for empty or very short queries
  }
  
  // Base score based on result type
  let score = 0;
  
  switch (result.type) {
    case 'svm':
      score = 0.8; // Prioritize blockchain results
      break;
    case 'telegram':
    case 'x_com':
      score = 0.6; // Social media results
      break;
    case 'web':
      score = 0.5; // Web results
      break;
    default:
      score = 0.4;
  }
  
  // Content matching score
  const content = `${result.title} ${result.content}`.toLowerCase();
  let matchScore = 0;
  
  queryTerms.forEach(term => {
    // Exact match bonus
    if (content.includes(term)) {
      matchScore += 0.2;
    }
    
    // Title match bonus
    if (result.title.toLowerCase().includes(term)) {
      matchScore += 0.3;
    }
    
    // Word boundary match bonus (whole word match)
    const wordBoundaryRegex = new RegExp(`\\b${term}\\b`, 'i');
    if (wordBoundaryRegex.test(content)) {
      matchScore += 0.1;
    }
  });
  
  // Normalize match score
  matchScore = Math.min(matchScore / queryTerms.length, 1);
  
  // Recency bonus for results with timestamps
  let recencyScore = 0;
  if (result.timestamp) {
    const resultDate = new Date(result.timestamp);
    const now = new Date();
    const ageInDays = (now.getTime() - resultDate.getTime()) / (1000 * 60 * 60 * 24);
    
    // Higher score for more recent results
    recencyScore = Math.max(0, 0.2 - (ageInDays / 30) * 0.2); // Max 0.2 bonus, decreasing over 30 days
  }
  
  // Combine scores
  const finalScore = score * 0.4 + matchScore * 0.5 + recencyScore * 0.1;
  
  // Ensure score is between 0 and 1
  return Math.max(0, Math.min(1, finalScore));
}

/**
 * Deduplicate similar results
 * @param results - Search results to deduplicate
 * @returns Deduplicated search results
 */
function deduplicateSimilarResults(results: UnifiedSearchResult[]): UnifiedSearchResult[] {
  const uniqueResults: UnifiedSearchResult[] = [];
  const contentHashes = new Set<string>();
  
  results.forEach(result => {
    // Create a simple hash of the content
    const contentHash = `${result.type}:${result.title.substring(0, 50)}:${result.content.substring(0, 100)}`;
    
    // Check if we've seen this content before
    if (!contentHashes.has(contentHash)) {
      contentHashes.add(contentHash);
      uniqueResults.push(result);
    } else {
      // If we have a duplicate, keep the one with higher relevance
      const existingIndex = uniqueResults.findIndex(r => {
        const existingHash = `${r.type}:${r.title.substring(0, 50)}:${r.content.substring(0, 100)}`;
        return existingHash === contentHash;
      });
      
      if (existingIndex !== -1 && (result.relevance || 0) > (uniqueResults[existingIndex].relevance || 0)) {
        uniqueResults[existingIndex] = result;
      }
    }
  });
  
  return uniqueResults;
}

/**
 * Clear the optimization cache
 */
export function clearOptimizationCache() {
  optimizationCache.clear();
}

/**
 * Get cache statistics
 * @returns Cache statistics
 */
export function getOptimizationCacheStats() {
  return {
    size: optimizationCache.size,
    keys: [...optimizationCache.keys()],
    oldestTimestamp: Math.min(...[...optimizationCache.values()].map(v => v.timestamp)),
    newestTimestamp: Math.max(...[...optimizationCache.values()].map(v => v.timestamp))
  };
}

/**
 * Batch process search results to improve performance
 * @param results - Search results to process
 * @param processFn - Processing function
 * @param batchSize - Size of each batch
 * @returns Processed search results
 */
export function batchProcessResults<T>(
  results: T[],
  processFn: (batch: T[]) => T[],
  batchSize: number = 50
): T[] {
  const batches = [];
  
  for (let i = 0; i < results.length; i += batchSize) {
    batches.push(results.slice(i, i + batchSize));
  }
  
  let processedResults: T[] = [];
  
  batches.forEach(batch => {
    const batchResults = processFn(batch);
    processedResults = [...processedResults, ...batchResults];
  });
  
  return processedResults;
}
