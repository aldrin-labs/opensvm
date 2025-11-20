export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getSearchSuggestions, storeSearchQuery } from '@/lib/search/qdrant-search-suggestions';

// Lightweight base58 check (characters only)
const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]+$/;

function isLikelyBase58(str: string) {
  return BASE58_REGEX.test(str);
}

// Check if query is a specific blockchain entity
function isBlockchainEntity(query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  
  // Check for base58 addresses/transactions (32+ chars)
  if (trimmed.length >= 32 && isLikelyBase58(trimmed)) {
    return true;
  }
  
  // Check for block/slot numbers
  if (/^\d+$/.test(trimmed) && parseInt(trimmed) > 0) {
    return true;
  }
  
  // Check for common token symbols (3-5 uppercase chars)
  if (/^[A-Z]{3,5}$/.test(query.trim())) {
    return true;
  }
  
  // Check for blockchain/protocol keywords
  const blockchainKeywords = [
    'solana', 'sol', 'jupiter', 'raydium', 'orca', 'serum', 'marinade', 'lido',
    'usdc', 'usdt', 'bonk', 'jup', 'ray', 'kin', 'samo', 'cope', 'step',
    'srm', 'ftt', 'rope', 'atlas', 'polis', 'tulip', 'sunny', 'saber',
    'aldrin', 'mercurial', 'port', 'socean', 'larix', 'quarry', 'friktion'
  ];
  
  if (blockchainKeywords.some(keyword => trimmed === keyword || trimmed.includes(keyword))) {
    return true;
  }
  
  return false;
}

// Call AI assistant for general queries
async function getAIResponse(query: string): Promise<any> {
  try {
    const response = await fetch('http://localhost:3000/api/getAnswer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: query
      })
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    // /api/getAnswer returns raw markdown text, not JSON
    const aiResponseText = await response.text();
    
    // Return in a format that matches what the calling code expects
    return {
      response: aiResponseText,
      answer: aiResponseText // Alternative format for compatibility
    };
  } catch (error) {
    console.error('Failed to get AI response:', error);
    return null;
  }
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

    const nowIso = new Date().toISOString();
    
    // If it looks like a long base58 string, provide immediate address/transaction suggestions
    if (query.length >= 32 && isLikelyBase58(query)) {
      const suggestions = [
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
      const flattenedSuggestions: any[] = [];
      
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
      const fallbackSuggestions = [];
      
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
              type: 'user_history',
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

      // No AI responses in suggestions - those go to the result page only
      console.log('Suggestions API only shows Qdrant-based results, not AI responses');

      // Return empty if no real data found - no echoing user's query
      if (fallbackSuggestions.length === 0) {
        return NextResponse.json([]);
      }
      
      return NextResponse.json(fallbackSuggestions);
    }

  } catch (err) {
    console.error('Error in suggestions API:', err);
    
    // Emergency fallback - basic search option without echoing query
    const nowIso = new Date().toISOString();
    
    return NextResponse.json([{
      type: 'recent_global',
      value: '',
      label: 'Search across Solana blockchain',
      name: 'Basic Search',
      usageCount: 1,
      lastUpdate: nowIso,
      metadata: {
        scope: 'global',
        section: 'search',
        sectionTitle: 'Search',
        sectionIcon: '🔍',
        sectionDescription: 'Search transactions, blocks, programs, and tokens'
      }
    }]);
  }
}
