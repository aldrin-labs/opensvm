'use client';

import { useState, useCallback, useRef } from 'react';
import cytoscape from 'cytoscape';

interface SearchQuery {
  original: string;
  parsed: ParsedQuery;
  timestamp: number;
}

interface ParsedQuery {
  action: 'find' | 'filter' | 'highlight' | 'analyze' | 'count' | 'summarize';
  target: 'accounts' | 'transactions' | 'edges' | 'paths' | 'clusters';
  conditions: QueryCondition[];
  limit?: number;
  orderBy?: string;
  timeRange?: { start?: Date; end?: Date };
}

interface QueryCondition {
  field: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'contains' | 'between';
  value: any;
}

interface SearchResult {
  query: SearchQuery;
  results: any[];
  summary: string;
  suggestions: string[];
  executionTime: number;
}

// Common query patterns
const QUERY_PATTERNS = [
  {
    pattern: /show\s+(?:me\s+)?(?:all\s+)?accounts?\s+(?:that\s+)?sent\s+more\s+than\s+(\d+(?:\.\d+)?)\s*(sol|usdc)?/i,
    parse: (match: RegExpMatchArray): ParsedQuery => ({
      action: 'find',
      target: 'accounts',
      conditions: [{
        field: 'outgoingVolume',
        operator: 'gt',
        value: parseFloat(match[1])
      }]
    })
  },
  {
    pattern: /find\s+(?:all\s+)?wallets?\s+with\s+more\s+than\s+(\d+)\s+transactions?/i,
    parse: (match: RegExpMatchArray): ParsedQuery => ({
      action: 'find',
      target: 'accounts',
      conditions: [{
        field: 'transactionCount',
        operator: 'gt',
        value: parseInt(match[1])
      }]
    })
  },
  {
    pattern: /show\s+(?:me\s+)?(?:the\s+)?largest\s+(\d+)?\s*transactions?/i,
    parse: (match: RegExpMatchArray): ParsedQuery => ({
      action: 'find',
      target: 'edges',
      conditions: [],
      orderBy: 'amount',
      limit: parseInt(match[1]) || 10
    })
  },
  {
    pattern: /find\s+(?:all\s+)?whales?/i,
    parse: (): ParsedQuery => ({
      action: 'find',
      target: 'accounts',
      conditions: [{
        field: 'totalVolume',
        operator: 'gt',
        value: 10000
      }]
    })
  },
  {
    pattern: /highlight\s+suspicious\s+(?:accounts?|wallets?)/i,
    parse: (): ParsedQuery => ({
      action: 'highlight',
      target: 'accounts',
      conditions: [{
        field: 'riskScore',
        operator: 'gt',
        value: 50
      }]
    })
  },
  {
    pattern: /find\s+path\s+(?:from\s+)?([a-zA-Z0-9]+)\s+to\s+([a-zA-Z0-9]+)/i,
    parse: (match: RegExpMatchArray): ParsedQuery => ({
      action: 'find',
      target: 'paths',
      conditions: [
        { field: 'source', operator: 'eq', value: match[1] },
        { field: 'target', operator: 'eq', value: match[2] }
      ]
    })
  },
  {
    pattern: /show\s+(?:me\s+)?(?:all\s+)?transactions?\s+(?:from\s+)?(?:the\s+)?last\s+(\d+)\s+(day|week|month|hour)s?/i,
    parse: (match: RegExpMatchArray): ParsedQuery => {
      const amount = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      const msPerUnit: Record<string, number> = {
        hour: 60 * 60 * 1000,
        day: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000
      };
      const startTime = Date.now() - (amount * msPerUnit[unit]);

      return {
        action: 'filter',
        target: 'edges',
        conditions: [],
        timeRange: { start: new Date(startTime) }
      };
    }
  },
  {
    pattern: /count\s+(?:all\s+)?(?:the\s+)?(accounts?|wallets?|transactions?)/i,
    parse: (match: RegExpMatchArray): ParsedQuery => ({
      action: 'count',
      target: match[1].startsWith('account') || match[1].startsWith('wallet') ? 'accounts' : 'transactions',
      conditions: []
    })
  },
  {
    pattern: /summarize\s+(?:this\s+)?(?:the\s+)?graph/i,
    parse: (): ParsedQuery => ({
      action: 'summarize',
      target: 'accounts',
      conditions: []
    })
  },
  {
    pattern: /find\s+(?:all\s+)?connected\s+(?:to\s+)?([a-zA-Z0-9]+)/i,
    parse: (match: RegExpMatchArray): ParsedQuery => ({
      action: 'find',
      target: 'accounts',
      conditions: [{
        field: 'connectedTo',
        operator: 'eq',
        value: match[1]
      }]
    })
  }
];

/**
 * Hook for natural language graph search
 */
export function useAISearch() {
  const [isSearching, setIsSearching] = useState(false);
  const [lastResult, setLastResult] = useState<SearchResult | null>(null);
  const [searchHistory, setSearchHistory] = useState<SearchQuery[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  /**
   * Parse natural language query
   */
  const parseQuery = useCallback((query: string): ParsedQuery | null => {
    const normalizedQuery = query.toLowerCase().trim();

    for (const { pattern, parse } of QUERY_PATTERNS) {
      const match = normalizedQuery.match(pattern);
      if (match) {
        return parse(match);
      }
    }

    // Default: try to find addresses in query
    const addressMatch = query.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g);
    if (addressMatch) {
      return {
        action: 'find',
        target: 'accounts',
        conditions: [{
          field: 'address',
          operator: 'contains',
          value: addressMatch[0]
        }]
      };
    }

    return null;
  }, []);

  /**
   * Execute search query on graph
   */
  const executeQuery = useCallback((
    cy: cytoscape.Core,
    parsed: ParsedQuery
  ): any[] => {
    let results: any[] = [];

    switch (parsed.action) {
      case 'find':
      case 'filter':
      case 'highlight':
        if (parsed.target === 'accounts') {
          results = cy.nodes('[type="account"]').filter(node => {
            return parsed.conditions.every(cond => {
              let value: any;

              switch (cond.field) {
                case 'outgoingVolume':
                  value = node.outgoers('edge').reduce((sum, e) => sum + (e.data('amount') || 0), 0);
                  break;
                case 'incomingVolume':
                  value = node.incomers('edge').reduce((sum, e) => sum + (e.data('amount') || 0), 0);
                  break;
                case 'totalVolume':
                  value = node.connectedEdges().reduce((sum, e) => sum + (e.data('amount') || 0), 0);
                  break;
                case 'transactionCount':
                  value = node.connectedEdges().length;
                  break;
                case 'address':
                  value = node.id();
                  break;
                case 'connectedTo':
                  value = node.neighborhood('node').map(n => n.id());
                  if (Array.isArray(value)) {
                    return value.some(v => v.includes(cond.value));
                  }
                  break;
                case 'riskScore':
                  value = node.data('riskScore') || 0;
                  break;
                default:
                  value = node.data(cond.field);
              }

              switch (cond.operator) {
                case 'gt': return value > cond.value;
                case 'lt': return value < cond.value;
                case 'gte': return value >= cond.value;
                case 'lte': return value <= cond.value;
                case 'eq': return value === cond.value;
                case 'contains':
                  if (typeof value === 'string') {
                    return value.toLowerCase().includes(cond.value.toLowerCase());
                  }
                  return false;
                default: return true;
              }
            });
          }).map(node => ({
            id: node.id(),
            type: 'account',
            data: node.data()
          }));
        } else if (parsed.target === 'edges' || parsed.target === 'transactions') {
          results = cy.edges().filter(edge => {
            // Apply time range if specified
            if (parsed.timeRange?.start) {
              const timestamp = edge.data('timestamp') || edge.data('blockTime');
              if (timestamp) {
                const time = typeof timestamp === 'number' ? timestamp * 1000 : new Date(timestamp).getTime();
                if (time < parsed.timeRange.start.getTime()) return false;
              }
            }
            return parsed.conditions.every(cond => {
              const value = edge.data(cond.field);
              switch (cond.operator) {
                case 'gt': return value > cond.value;
                case 'lt': return value < cond.value;
                default: return true;
              }
            });
          }).map(edge => ({
            id: edge.id(),
            type: 'edge',
            data: edge.data()
          }));

          // Sort by amount if requested
          if (parsed.orderBy === 'amount') {
            results.sort((a, b) => (b.data.amount || 0) - (a.data.amount || 0));
          }
        }

        // Apply limit
        if (parsed.limit && results.length > parsed.limit) {
          results = results.slice(0, parsed.limit);
        }
        break;

      case 'count':
        if (parsed.target === 'accounts') {
          results = [{ count: cy.nodes('[type="account"]').length }];
        } else {
          results = [{ count: cy.edges().length }];
        }
        break;

      case 'summarize':
        const accountCount = cy.nodes('[type="account"]').length;
        const txCount = cy.edges().length;
        const totalVolume = cy.edges().reduce((sum, e) => sum + (e.data('amount') || 0), 0);
        const avgDegree = accountCount > 0 ? (2 * txCount) / accountCount : 0;

        results = [{
          summary: true,
          accountCount,
          transactionCount: txCount,
          totalVolume,
          averageDegree: avgDegree.toFixed(2)
        }];
        break;
    }

    return results;
  }, []);

  /**
   * Search graph with natural language query
   */
  const search = useCallback(async (
    cy: cytoscape.Core,
    query: string
  ): Promise<SearchResult> => {
    setIsSearching(true);
    const startTime = Date.now();

    try {
      const parsed = parseQuery(query);

      if (!parsed) {
        // Query not understood - return helpful suggestions
        return {
          query: { original: query, parsed: { action: 'find', target: 'accounts', conditions: [] }, timestamp: Date.now() },
          results: [],
          summary: "I couldn't understand that query. Try something like:",
          suggestions: [
            "Show me all accounts that sent more than 100 SOL",
            "Find wallets with more than 50 transactions",
            "Show the largest 10 transactions",
            "Find all whales",
            "Highlight suspicious accounts",
            "Show transactions from the last 7 days",
            "Summarize this graph"
          ],
          executionTime: Date.now() - startTime
        };
      }

      const searchQuery: SearchQuery = {
        original: query,
        parsed,
        timestamp: Date.now()
      };

      const results = executeQuery(cy, parsed);

      // Generate summary
      let summary = '';
      if (parsed.action === 'count') {
        summary = `Found ${results[0].count} ${parsed.target}`;
      } else if (parsed.action === 'summarize') {
        const r = results[0];
        summary = `Graph contains ${r.accountCount} accounts with ${r.transactionCount} transactions. Total volume: ${r.totalVolume.toFixed(2)} SOL. Average connections per account: ${r.averageDegree}`;
      } else {
        summary = `Found ${results.length} ${parsed.target}`;
      }

      // Generate follow-up suggestions
      const followUpSuggestions: string[] = [];
      if (results.length > 0 && parsed.target === 'accounts') {
        followUpSuggestions.push("Analyze the risk profile of these accounts");
        followUpSuggestions.push("Find common funders between these accounts");
        followUpSuggestions.push("Detect wash trading patterns");
      }

      const result: SearchResult = {
        query: searchQuery,
        results,
        summary,
        suggestions: followUpSuggestions,
        executionTime: Date.now() - startTime
      };

      setLastResult(result);
      setSearchHistory(prev => [...prev, searchQuery].slice(-20)); // Keep last 20 queries

      // Highlight results if applicable
      if (parsed.action === 'highlight' || parsed.action === 'find') {
        cy.elements().removeClass('search-result');
        results.forEach(r => {
          cy.getElementById(r.id).addClass('search-result');
        });
      }

      return result;

    } finally {
      setIsSearching(false);
    }
  }, [parseQuery, executeQuery]);

  /**
   * Get autocomplete suggestions
   */
  const getAutocompleteSuggestions = useCallback((partial: string): string[] => {
    const suggestions: string[] = [];
    const lower = partial.toLowerCase();

    const templates = [
      "show me all accounts that sent more than {amount} SOL",
      "find wallets with more than {count} transactions",
      "show the largest {count} transactions",
      "find all whales",
      "highlight suspicious accounts",
      "show transactions from the last {count} days",
      "summarize this graph",
      "find path from {address} to {address}",
      "count all accounts",
      "find all connected to {address}"
    ];

    templates.forEach(template => {
      if (template.toLowerCase().includes(lower) || lower.includes(template.split(' ')[0])) {
        suggestions.push(template);
      }
    });

    return suggestions.slice(0, 5);
  }, []);

  /**
   * Clear search results
   */
  const clearSearch = useCallback((cy: cytoscape.Core) => {
    cy.elements().removeClass('search-result');
    setLastResult(null);
  }, []);

  /**
   * Generate AI-powered investigation suggestions
   */
  const getInvestigationSuggestions = useCallback((cy: cytoscape.Core): string[] => {
    const suggestions: string[] = [];
    const accountCount = cy.nodes('[type="account"]').length;
    const edgeCount = cy.edges().length;

    if (accountCount > 10) {
      suggestions.push("Run cluster detection to identify wallet groups");
    }

    if (edgeCount > 50) {
      suggestions.push("Detect potential wash trading patterns");
    }

    // Check for high-degree nodes
    const highDegreeNodes = cy.nodes('[type="account"]').filter(n => n.degree() > 10);
    if (highDegreeNodes.length > 0) {
      suggestions.push(`Analyze ${highDegreeNodes.length} high-activity wallets`);
    }

    suggestions.push("Calculate PageRank to find influential accounts");
    suggestions.push("Trace first funder for selected wallets");
    suggestions.push("Export investigation report");

    return suggestions;
  }, []);

  return {
    // State
    isSearching,
    lastResult,
    searchHistory,
    suggestions,

    // Actions
    search,
    parseQuery,
    getAutocompleteSuggestions,
    clearSearch,
    getInvestigationSuggestions,
    setSuggestions
  };
}

export default useAISearch;
