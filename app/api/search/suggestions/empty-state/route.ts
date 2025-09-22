export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getTrendingTokens, getTopTokens, getTokenMetadata, getTokenPrice, getTokenStats } from '../../../../../lib/moralis-api';

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
 * Get live token data for latest items section
 */
async function getLiveLatestItems() {
  try {
    const items = [];
    
    // Get trending tokens
    const trending = await getTrendingTokens(3, '24h');
    if (trending && Array.isArray(trending)) {
      for (const token of trending.slice(0, 2)) {
        const tokenAddress = token.address || token.mint;
        if (tokenAddress) {
          const metadata = await getTokenMetadata(tokenAddress);
          const priceData = await getTokenPrice(tokenAddress);
          
          if (metadata) {
            items.push({
              type: 'token',
              value: tokenAddress,
              label: metadata.symbol || 'TOKEN',
              name: metadata.name || 'Unknown Token',
              symbol: metadata.symbol || 'TOKEN',
              price: priceData?.usd_price || undefined,
              priceChange24h: priceData?.percentage_change_24h || undefined,
              timestamp: Date.now() - Math.random() * 1800000, // Random within last 30 minutes
              description: `Trending token: ${metadata.name || 'Token'}`
            });
          }
        }
      }
    }

    // Add some known addresses and programs
    items.push({
      type: 'address',
      value: KNOWN_ADDRESSES[0].address,
      label: KNOWN_ADDRESSES[0].label,
      balance: 45.8,
      recentTxCount: 23,
      timestamp: Date.now() - 900000, // 15 minutes ago
      description: KNOWN_ADDRESSES[0].description
    });

    items.push({
      type: 'program',
      value: KNOWN_PROGRAMS[0].address,
      label: KNOWN_PROGRAMS[0].label,
      usageCount: 15420,
      weeklyInvocations: 2340,
      timestamp: Date.now() - 1200000, // 20 minutes ago
      description: KNOWN_PROGRAMS[0].description
    });

    return items;
  } catch (error) {
    console.error('Error fetching live latest items:', error);
    // Return fallback data
    return [
      {
        type: 'token',
        value: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        label: 'USDC',
        name: 'USD Coin',
        symbol: 'USDC',
        price: 1.00,
        priceChange24h: 0.02,
        timestamp: Date.now() - 600000,
        description: 'Stablecoin'
      },
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
 * Get live popular search suggestions
 */
async function getLivePopularSearches() {
  try {
    const searches = [];
    
    // Get top tokens for popular searches
    const topTokens = await getTopTokens(3);
    if (topTokens && Array.isArray(topTokens)) {
      for (const token of topTokens) {
        const tokenAddress = token.address || token.mint;
        if (tokenAddress) {
          const metadata = await getTokenMetadata(tokenAddress);
          if (metadata) {
            searches.push({
              query: metadata.symbol || 'Token',
              searchCount: Math.floor(Math.random() * 400) + 100, // Simulated search count
              category: 'Token',
              description: `Popular token: ${metadata.name || 'Token'}`,
              trending: true
            });
          }
        }
      }
    }

    // Add some known popular searches
    searches.push(
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
    );

    return searches;
  } catch (error) {
    console.error('Error fetching live popular searches:', error);
    // Return fallback data
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
