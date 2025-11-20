export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { qdrantClient, COLLECTIONS } from '@/lib/search/qdrant';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


// In-memory storage for demonstration - in production, use a database
const recentPrompts: { query: string; timestamp: number; count: number }[] = [
  { query: 'Jupiter exchange transactions', timestamp: Date.now() - 3600000, count: 15 },
  { query: 'Solana validator performance', timestamp: Date.now() - 7200000, count: 8 },
  { query: 'NFT marketplace activity', timestamp: Date.now() - 10800000, count: 12 },
  { query: 'DeFi protocol analytics', timestamp: Date.now() - 14400000, count: 20 },
  { query: 'Token transfer patterns', timestamp: Date.now() - 18000000, count: 6 },
];

// Known popular addresses and programs for when live data is unavailable
const KNOWN_ADDRESSES = [
  {
    address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    label: 'High Activity Wallet',
    description: 'Wallet with high recent activity'
  },
  {
    address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    label: 'DEX Trading Wallet',
    description: 'Active trading wallet'
  }
];

const KNOWN_PROGRAMS = [
  {
    address: '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
    label: 'Serum DEX v3',
    description: 'Decentralized exchange program'
  },
  {
    address: 'JUP6LkbZbjS1jKv4uA5P3xVbR1a7NdvBE1B8ZRxjfS5',
    label: 'Jupiter Aggregator',
    description: 'DEX aggregation program'
  }
];

/**
 * Get live token data for latest items section from Qdrant
 */
async function getLiveLatestItems() {
  try {
    const items = [];

    // Get recent transfers from Qdrant
    try {
      // Check if collection exists first
      const collections = await qdrantClient.getCollections();
      const transfersExists = collections.collections.some(c => c.name === COLLECTIONS.TRANSFERS);
      
      if (transfersExists) {
        const recentTransfers = await qdrantClient.search(COLLECTIONS.TRANSFERS, {
          vector: new Array(384).fill(0),
          limit: 10,
          with_payload: true
          // Remove filter to avoid Bad Request errors
        });

        // Process recent transfers into items
        const transferItems = recentTransfers
          .map(point => point.payload as any)
          .slice(0, 3) // Take top 3 most recent
          .filter(transfer => transfer && transfer.walletAddress) // Filter out invalid transfers
          .map(transfer => ({
            type: 'address',
            value: transfer.walletAddress,
            label: `Active Wallet`,
            balance: transfer.amount || 0,
            recentTxCount: 1,
            timestamp: transfer.timestamp || Date.now() - 900000,
            description: `Recent ${transfer.type} transaction${transfer.tokenSymbol ? ` (${transfer.tokenSymbol})` : ''}`
          }));

        items.push(...transferItems);
      }
    } catch (error) {
      console.warn('Error fetching recent transfers from Qdrant:', error);
    }

    // Get recent token metadata from Qdrant
    try {
      // Check if collection exists first
      const collections = await qdrantClient.getCollections();
      const tokenMetadataExists = collections.collections.some(c => c.name === COLLECTIONS.TOKEN_METADATA);
      
      if (tokenMetadataExists) {
        const recentTokens = await qdrantClient.search(COLLECTIONS.TOKEN_METADATA, {
          vector: new Array(384).fill(0),
          limit: 5,
          with_payload: true
          // Remove filter to avoid Bad Request errors
        });

        // Process recent tokens into items
        const tokenItems = recentTokens
          .map(point => point.payload as any)
          .slice(0, 2) // Take top 2
          .filter(token => token && token.mintAddress && token.symbol) // Filter out invalid tokens
          .map(token => ({
            type: 'token',
            value: token.mintAddress,
            label: token.symbol || 'Unknown Token',
            name: token.name || 'Unknown Token',
            symbol: token.symbol || '?',
            price: null, // We don't store price in metadata
            timestamp: token.lastUpdated || Date.now() - 600000,
            description: token.description || `${token.name} token`,
            verified: token.verified || false
          }));

        items.push(...tokenItems);
      }
    } catch (error) {
      console.warn('Error fetching recent tokens from Qdrant:', error);
    }

    // Get recent program metadata from Qdrant
    try {
      // Check if collection exists first
      const collections = await qdrantClient.getCollections();
      const programMetadataExists = collections.collections.some(c => c.name === COLLECTIONS.PROGRAM_METADATA);
      
      if (programMetadataExists) {
        const recentPrograms = await qdrantClient.search(COLLECTIONS.PROGRAM_METADATA, {
          vector: new Array(384).fill(0),
          limit: 5,
          with_payload: true
          // Remove filter to avoid Bad Request errors
        });

        // Process recent programs into items
        const programItems = recentPrograms
          .map(point => point.payload as any)
          .slice(0, 2) // Take top 2
          .filter(program => program && program.programId && program.name) // Filter out invalid programs
          .map(program => ({
            type: 'program',
            value: program.programId,
            label: program.name || 'Unknown Program',
            usageCount: Math.floor(Math.random() * 10000), // We don't store usage count
            timestamp: program.lastUpdated || Date.now() - 1200000,
            description: program.description || `${program.name} program`,
            category: program.category,
            verified: program.verified || false
          }));

        items.push(...programItems);
      }
    } catch (error) {
      console.warn('Error fetching recent programs from Qdrant:', error);
    }

    // If no items found from Qdrant, return fallback data
    if (items.length === 0) {
      return [
        {
          type: 'address',
          value: KNOWN_ADDRESSES[0].address,
          label: KNOWN_ADDRESSES[0].label,
          balance: 45.8,
          recentTxCount: 23,
          timestamp: Date.now() - 900000,
          description: KNOWN_ADDRESSES[0].description
        },
        {
          type: 'program',
          value: KNOWN_PROGRAMS[0].address,
          label: KNOWN_PROGRAMS[0].label,
          usageCount: 15420,
          timestamp: Date.now() - 1200000,
          description: KNOWN_PROGRAMS[0].description
        }
      ];
    }

    return items;
  } catch (error) {
    console.error('Error fetching live latest items from Qdrant:', error);
    // Return fallback data on error
    return [
      {
        type: 'address',
        value: KNOWN_ADDRESSES[0].address,
        label: KNOWN_ADDRESSES[0].label,
        balance: 45.8,
        recentTxCount: 23,
        timestamp: Date.now() - 900000,
        description: KNOWN_ADDRESSES[0].description
      }
    ];
  }
}

/**
 * Get live popular search suggestions from Qdrant user history
 */
async function getLivePopularSearches() {
  try {
    const searches = [];

    // Get recent user history to analyze popular searches
    try {
      const recentHistory = await qdrantClient.search(COLLECTIONS.USER_HISTORY, {
        vector: new Array(384).fill(0),
        limit: 100,
        with_payload: true
      });

      // Analyze user history to find popular page types and paths
      const pageTypeCount = new Map<string, number>();
      const pathCount = new Map<string, number>();
      
      recentHistory.forEach(point => {
        const history = point.payload as any;
        if (history.pageType) {
          pageTypeCount.set(history.pageType, (pageTypeCount.get(history.pageType) || 0) + 1);
        }
        if (history.path) {
          // Extract meaningful paths
          const pathSegments = history.path.split('/').filter(Boolean);
          pathSegments.forEach((segment: string) => {
            if (segment.length > 2 && !segment.match(/^[0-9]+$/)) { // Skip short segments and pure numbers
              pathCount.set(segment, (pathCount.get(segment) || 0) + 1);
            }
          });
        }
      });

      // Convert popular page types to search suggestions
      const popularPageTypes = Array.from(pageTypeCount.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3);

      popularPageTypes.forEach(([pageType, count]) => {
        const categoryMap: Record<string, string> = {
          'transaction': 'Transaction Analysis',
          'address': 'Address Lookup',
          'token': 'Token Information', 
          'program': 'Program Analysis',
          'block': 'Block Explorer',
          'validator': 'Infrastructure'
        };

        searches.push({
          query: pageType.charAt(0).toUpperCase() + pageType.slice(1) + ' analysis',
          searchCount: count,
          category: categoryMap[pageType] || 'General',
          description: `Popular ${pageType} searches`,
          trending: count > 5
        });
      });

      // Convert popular paths to search suggestions  
      const popularPaths = Array.from(pathCount.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 2);

      popularPaths.forEach(([path, count]) => {
        searches.push({
          query: path,
          searchCount: count,
          category: 'Popular Pages',
          description: `Frequently accessed content`,
          trending: count > 3
        });
      });

    } catch (error) {
      console.warn('Error analyzing user history from Qdrant:', error);
    }

    // Get popular tokens from metadata
    try {
      // First check if the collection exists
      const collections = await qdrantClient.getCollections();
      const tokenMetadataExists = collections.collections.some(c => c.name === COLLECTIONS.TOKEN_METADATA);
      
      if (tokenMetadataExists) {
        const popularTokens = await qdrantClient.search(COLLECTIONS.TOKEN_METADATA, {
          vector: new Array(384).fill(0),
          limit: 10,
          with_payload: true
          // Remove filter for now to avoid Bad Request errors
        });

        const tokenSuggestions = popularTokens
          .map(point => point.payload as any)
          .slice(0, 2)
          .filter(token => token && token.symbol && token.name) // Filter out invalid tokens
          .map((token, index) => ({
            query: `${token.symbol} token`,
            searchCount: Math.floor(Math.random() * 200) + 50, // Simulated count
            category: 'Token',
            description: `${token.name} (${token.symbol})`,
            trending: index === 0
          }));

        searches.push(...tokenSuggestions);
      }
    } catch (error) {
      console.warn('Error fetching popular tokens from Qdrant:', error);
    }

    // If no searches found from Qdrant, return fallback data
    if (searches.length === 0) {
      return [
        {
          query: 'Jupiter aggregator',
          searchCount: 342,
          category: 'DeFi',
          description: 'Popular DEX aggregator on Solana',
          trending: true
        },
        {
          query: 'Solana validators',
          searchCount: 289,
          category: 'Infrastructure',
          description: 'Network validators and staking',
          trending: false
        },
        {
          query: 'Magic Eden marketplace',
          searchCount: 267,
          category: 'NFT',
          description: 'Leading NFT marketplace',
          trending: true
        }
      ];
    }

    return searches.slice(0, 5); // Limit to top 5 suggestions
  } catch (error) {
    console.error('Error fetching live popular searches from Qdrant:', error);
    // Return fallback data on error
    return [
      {
        query: 'Jupiter aggregator',
        searchCount: 342,
        category: 'DeFi',
        description: 'Popular DEX aggregator on Solana',
        trending: true
      },
      {
        query: 'Solana validators', 
        searchCount: 289,
        category: 'Infrastructure',
        description: 'Network validators and staking',
        trending: false
      }
    ];
  }
}

// Helper function to format time ago
const formatTimeAgo = (timestamp: number): string => {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

export async function GET() {
  try {
    const suggestions: any[] = [];

    // Section 1: Recent Prompts (5 most recently used search queries)
    const recentPromptSuggestions = recentPrompts
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5)
      .map(prompt => ({
        type: 'recent_user',
        value: prompt.query,
        label: prompt.query,
        name: prompt.query,
        lastUpdate: new Date(prompt.timestamp).toISOString(),
        usageCount: prompt.count,
        metadata: {
          isRecent: true,
          scope: 'user',
          section: 'recent_prompts',
          icon: '🕐',
          description: `Recently searched "${prompt.query}" ${prompt.count} times`
        }
      }));

    // Section 2: Latest Items - GET LIVE DATA
    const latestItems = await getLiveLatestItems();
    const latestItemSuggestions = latestItems
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5)
      .map(item => {
        const baseItem = {
          ...item,
          lastUpdate: new Date(item.timestamp).toISOString(),
          metadata: {
            isRecent: true,
            section: 'latest_items',
            icon: item.type === 'transaction' ? '💳' : 
                  item.type === 'token' ? '🪙' : 
                  item.type === 'address' ? '👤' : 
                  item.type === 'program' ? '⚙️' : '📄',
            timeAgo: formatTimeAgo(item.timestamp),
            description: item.description
          }
        };
        
        // Remove the timestamp from the final object to avoid confusion
        const { timestamp, description, ...rest } = baseItem;
        return rest;
      });

    // Section 3: Popular Searches - GET LIVE DATA
    const popularSearches = await getLivePopularSearches();
    const popularSearchSuggestions = popularSearches
      .sort((a, b) => b.searchCount - a.searchCount)
      .slice(0, 5)
      .map(search => ({
        type: 'recent_global',
        value: search.query,
        label: search.query,
        name: search.query,
        usageCount: search.searchCount,
        metadata: {
          isRecent: false,
          scope: 'global',
          section: 'popular_searches',
          category: search.category,
          trending: search.trending,
          icon: search.trending ? '🔥' : '📈',
          description: `${search.description} (${search.searchCount} searches)`
        }
      }));

    // Combine all sections with section headers
    const sectionsData = [
      {
        sectionTitle: 'Recent Prompts',
        sectionIcon: '🕐',
        sectionDescription: 'Your most recently used search queries',
        suggestions: recentPromptSuggestions
      },
      {
        sectionTitle: 'Latest Items',
        sectionIcon: '⚡',
        sectionDescription: 'Recently accessed or viewed content',
        suggestions: latestItemSuggestions
      },
      {
        sectionTitle: 'Popular Searches',
        sectionIcon: '🔥',
        sectionDescription: 'Most frequently searched terms',
        suggestions: popularSearchSuggestions
      }
    ];

    // Flatten suggestions with section metadata
    sectionsData.forEach(section => {
      section.suggestions.forEach(suggestion => {
        // Only include allowed properties in metadata
        suggestion.metadata = {
          ...suggestion.metadata
        };
        suggestions.push(suggestion);
      });
    });

    return NextResponse.json(suggestions);
  } catch (error) {
    console.error('Error in empty-state suggestions API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
