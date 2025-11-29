export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getSearchSuggestions, storeSearchQuery, type SearchSuggestion } from '@/lib/search/qdrant-search-suggestions';

// Lightweight base58 check (characters only)
const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]+$/;

function isLikelyBase58(str: string) {
  return BASE58_REGEX.test(str);
}

// Token symbol pattern (3-5 uppercase chars like SOL, USDC, BONK)
const TOKEN_SYMBOL_REGEX = /^[A-Z]{3,5}$/;

// Check if query is a specific blockchain entity for optimized routing
function isBlockchainEntity(query: string): { isEntity: boolean; type: 'address' | 'token' | 'block' | 'keyword' | null } {
  const trimmed = query.trim();
  const lowercased = trimmed.toLowerCase();

  // Check for base58 addresses/transactions (32+ chars) - case sensitive check
  if (trimmed.length >= 32 && isLikelyBase58(trimmed)) {
    return { isEntity: true, type: 'address' };
  }

  // Check for block/slot numbers
  if (/^\d+$/.test(trimmed) && parseInt(trimmed) > 0) {
    return { isEntity: true, type: 'block' };
  }

  // Check for common token symbols (3-5 uppercase chars)
  if (TOKEN_SYMBOL_REGEX.test(trimmed)) {
    return { isEntity: true, type: 'token' };
  }

  // Check for blockchain/protocol keywords
  const blockchainKeywords = [
    'solana', 'sol', 'jupiter', 'raydium', 'orca', 'serum', 'marinade', 'lido',
    'usdc', 'usdt', 'bonk', 'jup', 'ray', 'kin', 'samo', 'cope', 'step',
    'srm', 'ftt', 'rope', 'atlas', 'polis', 'tulip', 'sunny', 'saber',
    'aldrin', 'mercurial', 'port', 'socean', 'larix', 'quarry', 'friktion'
  ];

  if (blockchainKeywords.some(keyword => lowercased === keyword || lowercased.includes(keyword))) {
    return { isEntity: true, type: 'keyword' };
  }

  return { isEntity: false, type: null };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const qParam = searchParams.get('q') ?? searchParams.get('query') ?? '';
    const networksParam = searchParams.get('networks') ?? 'solana';
    const userIdParam = searchParams.get('userId'); // Optional user ID for personalization

    const query = qParam.trim();
    const networks = networksParam.split(',').map(n => n.trim()).filter(Boolean);

    if (!query || query.length < 1) {
      return NextResponse.json([]);
    }

    // Detect if query is a blockchain entity for optimized handling
    const entityCheck = isBlockchainEntity(query);

    // Log network context for observability (multi-chain filtering to be implemented)
    if (networks.length > 0 && networks[0] !== 'solana') {
      console.log(`Search suggestions requested for networks: ${networks.join(', ')}`);
    }

    const nowIso = new Date().toISOString();

    // For token symbols, provide token-specific suggestions
    if (entityCheck.isEntity && entityCheck.type === 'token') {
      const suggestions: SearchSuggestion[] = [
        {
          type: 'token',
          value: query.toUpperCase(),
          label: query.toUpperCase(),
          name: `${query.toUpperCase()} Token`,
          lastUpdate: nowIso,
          metadata: {
            section: 'token',
            sectionTitle: 'Token Lookup',
            sectionIcon: '🪙',
            sectionDescription: 'Search for token information'
          }
        }
      ];
      return NextResponse.json(suggestions);
    }

    // For base58 addresses/transactions, provide immediate lookup suggestions
    if (entityCheck.isEntity && entityCheck.type === 'address') {
      const suggestions: SearchSuggestion[] = [
        {
          type: 'address',
          value: query,
          label: `${query.slice(0, 4)}...${query.slice(-4)}`,
          name: 'Solana Address',
          balance: 0,
          recentTxCount: 0,
          lastUpdate: nowIso,
          metadata: { 
            verified: false,
            section: 'address',
            sectionTitle: 'Address & Transaction',
            sectionIcon: '🏠',
            sectionDescription: 'Direct blockchain address lookup'
          }
        },
        {
          type: 'transaction',
          value: query,
          label: `${query.slice(0, 4)}...${query.slice(-4)}`,
          name: 'Transaction Signature',
          success: true,
          fees: 0.000005,
          lastUpdate: nowIso,
          metadata: {
            section: 'transaction',
            sectionTitle: 'Address & Transaction', 
            sectionIcon: '🏠',
            sectionDescription: 'Direct blockchain transaction lookup'
          }
        }
      ];

      return NextResponse.json(suggestions);
    }

    // For semantic queries, use Qdrant vector search with prioritization
    try {
      const suggestionGroups = await getSearchSuggestions(query, userIdParam || undefined, {
        maxPerSection: 5,
        includeEmpty: false
      });

      // Check if any suggestions were returned
      const totalSuggestions = suggestionGroups.reduce((total, group) => total + group.suggestions.length, 0);
      
      if (totalSuggestions === 0) {
        // Force fallback if no suggestions were returned
        throw new Error('No suggestions returned from Qdrant');
      }

      // Flatten the grouped suggestions into the format expected by the UI
      const flattenedSuggestions: SearchSuggestion[] = [];
      
      for (const group of suggestionGroups) {
        // Add up to maxVisible suggestions from each group
        const visibleSuggestions = group.suggestions.slice(0, group.maxVisible);
        
        for (const suggestion of visibleSuggestions) {
          flattenedSuggestions.push({
            ...suggestion,
            lastUpdate: suggestion.timestamp ? new Date(suggestion.timestamp).toISOString() : nowIso,
            metadata: {
              ...suggestion.metadata,
              sectionTitle: group.title,
              sectionIcon: group.icon,
              sectionDescription: group.description,
              expandable: group.expandable,
              totalInGroup: group.suggestions.length
            }
          });
        }
      }

      // Store this query for future suggestions (async, non-blocking)
      if (query.length >= 2) {
        storeSearchQuery(query, userIdParam || undefined).catch(error => {
          console.error('Failed to store search query:', error);
        });
      }

      return NextResponse.json(flattenedSuggestions);

    } catch (qdrantError) {
      console.error('Qdrant search failed, falling back to existing user history:', qdrantError);
      
      // Try to get suggestions from existing user history in other Qdrant collections
      const fallbackSuggestions: SearchSuggestion[] = [];
      
      try {
        // Try to search existing user_history collection for any data
        const { qdrantClient } = await import('../../../../lib/qdrant');
        
        // Search user_history collection
        const historyResults = await qdrantClient.search('user_history', {
          vector: new Array(384).fill(0.1), // Simple vector for search
          limit: 3,
          filter: undefined // No filters to get any available data
        });

        for (const result of historyResults) {
          if (result.payload?.query) {
            fallbackSuggestions.push({
              type: 'recent_user',
              value: String(result.payload.query),
              label: String(result.payload.query),
              name: String(result.payload.query),
              lastUpdate: nowIso,
              metadata: {
                section: 'history',
                sectionTitle: 'Recent History',
                sectionIcon: '🕐',
                sectionDescription: 'From existing search history'
              }
            });
          }
        }

        // Search for any stored queries in other collections
        if (fallbackSuggestions.length === 0) {
          const transferResults = await qdrantClient.search('transfers', {
            vector: new Array(384).fill(0.1),
            limit: 2,
            filter: undefined
          });

          for (const result of transferResults) {
            if (result.payload?.fromAddress || result.payload?.toAddress) {
              const address = result.payload.fromAddress || result.payload.toAddress;
              fallbackSuggestions.push({
                type: 'address',
                value: String(address),
                label: `${String(address).slice(0, 4)}...${String(address).slice(-4)}`,
                name: 'Blockchain Address',
                lastUpdate: nowIso,
                metadata: {
                  section: 'addresses',
                  sectionTitle: 'Recent Addresses',
                  sectionIcon: '🏠',
                  sectionDescription: 'From recent blockchain activity'
                }
              });
            }
          }
        }

      } catch (fallbackError) {
        console.error('Fallback search also failed:', fallbackError);
      }

      // Return empty if no real data found
      if (fallbackSuggestions.length === 0) {
        return NextResponse.json([]);
      }
      
      return NextResponse.json(fallbackSuggestions);
    }

  } catch (err) {
    console.error('Error in suggestions API:', err);

    // Emergency fallback - return empty array to let UI handle gracefully
    return NextResponse.json([]);
  }
}
