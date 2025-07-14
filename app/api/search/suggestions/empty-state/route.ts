export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

// In-memory storage for demonstration - in production, use a database
const recentPrompts: { query: string; timestamp: number; count: number }[] = [
  { query: 'Jupiter exchange transactions', timestamp: Date.now() - 3600000, count: 15 },
  { query: 'Solana validator performance', timestamp: Date.now() - 7200000, count: 8 },
  { query: 'NFT marketplace activity', timestamp: Date.now() - 10800000, count: 12 },
  { query: 'DeFi protocol analytics', timestamp: Date.now() - 14400000, count: 20 },
  { query: 'Token transfer patterns', timestamp: Date.now() - 18000000, count: 6 },
];

const latestItems = [
  {
    type: 'transaction',
    value: '5KqpLwEwXNRYg8ytGCBYYHm2kyKWHPd1VBKUEgPPyv3yEzfQJhWcfM3y8VrjdAj9wGP7',
    label: 'Large SOL Transfer',
    amount: 1250.5,
    timestamp: Date.now() - 300000, // 5 minutes ago
    success: true,
    description: 'High-value SOL transfer transaction'
  },
  {
    type: 'token',
    value: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    label: 'USDC',
    name: 'USD Coin',
    symbol: 'USDC',
    price: 1.00,
    priceChange24h: 0.02,
    timestamp: Date.now() - 600000, // 10 minutes ago
    description: 'Recently active stablecoin'
  },
  {
    type: 'address',
    value: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    label: 'High Activity Wallet',
    balance: 45.8,
    recentTxCount: 23,
    timestamp: Date.now() - 900000, // 15 minutes ago
    description: 'Wallet with high recent activity'
  },
  {
    type: 'program',
    value: '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
    label: 'Serum DEX v3',
    usageCount: 15420,
    weeklyInvocations: 2340,
    timestamp: Date.now() - 1200000, // 20 minutes ago
    description: 'Recently active DEX program'
  },
  {
    type: 'transaction',
    value: '3MpWKxvBxhqYT5kHhEeZHN4QpjNzGPQGNrjyL2tJ8vN6PxRsKpWcfM3y8VrjdAj9wGP7',
    label: 'NFT Mint Transaction',
    amount: 0.1,
    timestamp: Date.now() - 1500000, // 25 minutes ago
    success: true,
    description: 'Recent NFT minting activity'
  }
];

const popularSearches = [
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
  },
  {
    query: 'Raydium liquidity pools',
    searchCount: 234,
    category: 'DeFi',
    description: 'AMM and liquidity provision',
    trending: false
  },
  {
    query: 'Phantom wallet transactions',
    searchCount: 198,
    category: 'Wallet',
    description: 'Popular Solana wallet activity',
    trending: true
  }
];

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
    // const { searchParams } = new URL(request.url);
    // const networks = searchParams.get('networks')?.split(',') || ['solana'];

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

    // Section 2: Latest Items (5 most recently accessed/viewed content pieces)
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

    // Section 3: Popular Searches (5 most frequently searched terms across platform)
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
