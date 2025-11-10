/**
 * API Method Presets
 * Provides clickable preset examples for all API methods
 * Total: 98 Core API Routes organized by category
 */

export interface ApiPreset {
  name: string;
  description: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  params?: Record<string, any>;
  body?: Record<string, any>;
  queryParams?: Record<string, string>;
}

export interface ApiMethod {
  id: string;
  name: string;
  description: string;
  category: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  presets: ApiPreset[];
}

// Create example presets for testing
const createExamplePresets = (method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH', endpoint: string): ApiPreset[] => {
  const basePresets: ApiPreset[] = [];
  
  // Generate 5 contextual presets based on endpoint pattern
  if (endpoint.includes('{address}') || endpoint.includes('{walletAddress}')) {
    basePresets.push(
      {
        name: 'Popular Wallet',
        description: 'Test with a popular wallet address',
        method,
        path: endpoint.replace(/\{address\}|\{walletAddress\}/g, '7aDTuuAN98tBanLcJQgq2oVaXztBzMgLNRu84iVqnVVH'),
      },
      {
        name: 'System Program',
        description: 'Test with system program address',
        method,
        path: endpoint.replace(/\{address\}|\{walletAddress\}/g, '11111111111111111111111111111111'),
      },
      {
        name: 'Token Mint',
        description: 'Test with token mint address',
        method,
        path: endpoint.replace(/\{address\}|\{walletAddress\}/g, 'So11111111111111111111111111111111111111112'),
      },
      {
        name: 'High Activity',
        description: 'Test with high-activity address',
        method,
        path: endpoint.replace(/\{address\}|\{walletAddress\}/g, '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1'),
      },
      {
        name: 'NFT Collection',
        description: 'Test with NFT collection address',
        method,
        path: endpoint.replace(/\{address\}|\{walletAddress\}/g, 'DezQQPSbqb9cqfF4BwnwJWqkWsZTdQfQcMqJsW1g9dBu'),
      }
    );
  } else if (endpoint.includes('{signature}')) {
    basePresets.push(
      {
        name: 'Recent Transfer',
        description: 'Test with recent transfer signature',
        method,
        path: endpoint.replace('{signature}', '5vYsYWPF4gdN1imxLpJAWi9QKpN3MSrFTFXK8pfmPogFjQNPiAkxFQCGzEEWNto16mWnwmdwNQH7KPCnkMcZ9Ba5'),
      },
      {
        name: 'Token Swap',
        description: 'Test with token swap signature',
        method,
        path: endpoint.replace('{signature}', '4XH9TKRnobJWnSFtZjDNc2zXJYP7y4BnmJKVzGP8p6mf7rGas2JJhTzbFQGHGCBwyLFzBrNhqFtAwtDpKgKQYfAQ'),
      },
      {
        name: 'NFT Transaction',
        description: 'Test with NFT transaction signature',
        method,
        path: endpoint.replace('{signature}', '2rMhDdJGhHHZfxP1vTQQoGQBBFKZMJFZ1GJQcVPGKJaKYmcAfngXD9wWNpoRxvKzFdqVfQZgQhVha3FQBrJQBcZc'),
      },
      {
        name: 'DeFi Transaction',
        description: 'Test with DeFi transaction signature', 
        method,
        path: endpoint.replace('{signature}', '3pMvTLUA9NzZQd4gi725p89mvND1wRNQM3C8XEv1hTdA'),
      },
      {
        name: 'Failed Transaction',
        description: 'Test with failed transaction signature',
        method,
        path: endpoint.replace('{signature}', '4Nd1mLK8MJqxz9KjJQpVJBzFVfUnNfadbBWECoLXUZ3o'),
      }
    );
  } else if (endpoint.includes('{slot}')) {
    basePresets.push(
      {
        name: 'Recent Slot',
        description: 'Test with recent slot number',
        method,
        path: endpoint.replace('{slot}', '290000000'),
      },
      {
        name: 'Historical Slot',
        description: 'Test with historical slot',
        method,
        path: endpoint.replace('{slot}', '280000000'),
      },
      {
        name: 'Early Slot',
        description: 'Test with early slot',
        method,
        path: endpoint.replace('{slot}', '1000000'),
      },
      {
        name: 'Mid-Range Slot',
        description: 'Test with mid-range slot',
        method,
        path: endpoint.replace('{slot}', '285000000'),
      },
      {
        name: 'High Activity Slot',
        description: 'Test with high activity slot',
        method,
        path: endpoint.replace('{slot}', '289500000'),
      }
    );
  } else if (method === 'POST') {
    // For POST endpoints, create body examples
    basePresets.push(
      {
        name: 'Basic Request',
        description: 'Basic POST request example',
        method,
        path: endpoint,
        body: { example: 'data' },
      },
      {
        name: 'With Parameters',
        description: 'POST with parameters',
        method,
        path: endpoint,
        body: { param1: 'value1', param2: 'value2' },
      },
      {
        name: 'Complex Data',
        description: 'POST with complex data',
        method,
        path: endpoint,
        body: { data: { nested: 'value' }, options: { limit: 10 } },
      },
      {
        name: 'Minimal Request',
        description: 'Minimal POST request',
        method,
        path: endpoint,
        body: {},
      },
      {
        name: 'Full Options',
        description: 'POST with all options',
        method,
        path: endpoint,
        body: { includeAll: true, detailed: true, limit: 100 },
      }
    );
  } else {
    // For GET endpoints, create query parameter examples
    basePresets.push(
      {
        name: 'Default Request',
        description: 'Default GET request',
        method,
        path: endpoint,
      },
      {
        name: 'With Limit',
        description: 'GET with limit parameter',
        method,
        path: endpoint + '?limit=10',
      },
      {
        name: 'With Pagination',
        description: 'GET with pagination',
        method,
        path: endpoint + '?limit=20&offset=0',
      },
      {
        name: 'Filtered Results',
        description: 'GET with filters',
        method,
        path: endpoint + '?sort=desc&type=all',
      },
      {
        name: 'Full Parameters',
        description: 'GET with all parameters',
        method,
        path: endpoint + '?limit=50&offset=0&sort=desc&includeDetails=true',
      }
    );
  }
  
  return basePresets.slice(0, 5); // Ensure exactly 5 presets
};

export const apiMethods: ApiMethod[] = [
  // ============= SEARCH & DISCOVERY (9 methods) =============
  {
    id: 'universal-search',
    name: 'Universal Search',
    description: 'Search across all blockchain data types',
    category: 'Search & Discovery',
    endpoint: '/api/search',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/search'),
  },
  {
    id: 'search-accounts',
    name: 'Search Accounts',
    description: 'Search for specific accounts',
    category: 'Search & Discovery',
    endpoint: '/api/search/accounts',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/search/accounts'),
  },
  {
    id: 'filtered-search',
    name: 'Advanced Filtered Search',
    description: 'Search with advanced filtering',
    category: 'Search & Discovery',
    endpoint: '/api/search/filtered',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/search/filtered'),
  },
  {
    id: 'search-suggestions',
    name: 'Search Suggestions',
    description: 'Get search suggestions',
    category: 'Search & Discovery',
    endpoint: '/api/search/suggestions',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/search/suggestions'),
  },
  {
    id: 'program-discovery',
    name: 'Discover Programs',
    description: 'Find Solana programs',
    category: 'Search & Discovery',
    endpoint: '/api/program-discovery',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/program-discovery'),
  },
  {
    id: 'program-registry',
    name: 'Program Registry',
    description: 'List registered programs',
    category: 'Search & Discovery',
    endpoint: '/api/program-registry',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/program-registry'),
  },
  {
    id: 'get-program',
    name: 'Get Program Details',
    description: 'Get program information',
    category: 'Search & Discovery',
    endpoint: '/api/program/{address}',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/program/{address}'),
  },
  {
    id: 'program-metadata',
    name: 'Program Metadata',
    description: 'Get batch program metadata',
    category: 'Search & Discovery',
    endpoint: '/api/program-metadata',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/program-metadata'),
  },

  // ============= ACCOUNT & WALLET (14 methods) =============
  {
    id: 'account-stats',
    name: 'Account Statistics',
    description: 'Get comprehensive account statistics',
    category: 'Account & Wallet',
    endpoint: '/api/account-stats/{address}',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/account-stats/{address}'),
  },
  {
    id: 'account-portfolio',
    name: 'Portfolio Overview',
    description: 'Get portfolio overview',
    category: 'Account & Wallet',
    endpoint: '/api/account-portfolio/{address}',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/account-portfolio/{address}'),
  },
  {
    id: 'check-account-type',
    name: 'Check Account Type',
    description: 'Determine account type',
    category: 'Account & Wallet',
    endpoint: '/api/check-account-type',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/check-account-type'),
  },
  {
    id: 'account-transactions',
    name: 'Account Transactions',
    description: 'Get transaction history',
    category: 'Account & Wallet',
    endpoint: '/api/account-transactions/{address}',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/account-transactions/{address}'),
  },
  {
    id: 'account-transfers',
    name: 'Account Transfers',
    description: 'Get SOL/token transfers',
    category: 'Account & Wallet',
    endpoint: '/api/account-transfers/{address}',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/account-transfers/{address}'),
  },
  {
    id: 'user-history',
    name: 'User History',
    description: 'Get user transaction history',
    category: 'Account & Wallet',
    endpoint: '/api/user-history/{walletAddress}',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/user-history/{walletAddress}'),
  },
  {
    id: 'account-token-stats',
    name: 'Token Statistics',
    description: 'Get token-specific stats',
    category: 'Account & Wallet',
    endpoint: '/api/account-token-stats/{address}/{mint}',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/account-token-stats/{address}/{mint}'),
  },
  {
    id: 'user-profile',
    name: 'User Profile',
    description: 'Get user profile',
    category: 'Account & Wallet',
    endpoint: '/api/user-profile/{walletAddress}',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/user-profile/{walletAddress}'),
  },

  // ============= TRANSACTIONS (17 methods) =============
  {
    id: 'get-transaction',
    name: 'Get Transaction',
    description: 'Get transaction details',
    category: 'Transactions',
    endpoint: '/api/transaction/{signature}',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/transaction/{signature}'),
  },
  {
    id: 'transaction-analysis',
    name: 'AI Transaction Analysis',
    description: 'Analyze transaction with AI',
    category: 'Transactions',
    endpoint: '/api/transaction/{signature}/analysis',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/transaction/{signature}/analysis'),
  },
  {
    id: 'transaction-explain',
    name: 'Explain Transaction',
    description: 'Get human-readable explanation',
    category: 'Transactions',
    endpoint: '/api/transaction/{signature}/explain',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/transaction/{signature}/explain'),
  },
  {
    id: 'transaction-metrics',
    name: 'Transaction Metrics',
    description: 'Get performance metrics',
    category: 'Transactions',
    endpoint: '/api/transaction/{signature}/metrics',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/transaction/{signature}/metrics'),
  },
  {
    id: 'related-transactions',
    name: 'Related Transactions',
    description: 'Find related transactions',
    category: 'Transactions',
    endpoint: '/api/transaction/{signature}/related',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/transaction/{signature}/related'),
  },
  {
    id: 'failure-analysis',
    name: 'Failure Analysis',
    description: 'Analyze transaction failures',
    category: 'Transactions',
    endpoint: '/api/transaction/{signature}/failure-analysis',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/transaction/{signature}/failure-analysis'),
  },
  {
    id: 'batch-transactions',
    name: 'Batch Transactions',
    description: 'Fetch multiple transactions',
    category: 'Transactions',
    endpoint: '/api/transaction/batch',
    method: 'POST',
    presets: createExamplePresets('POST', '/api/transaction/batch'),
  },
  {
    id: 'filter-transactions',
    name: 'Filter Transactions',
    description: 'Filter by criteria',
    category: 'Transactions',
    endpoint: '/api/filter-transactions',
    method: 'POST',
    presets: createExamplePresets('POST', '/api/filter-transactions'),
  },
  {
    id: 'analyze-transaction',
    name: 'Analyze Transaction',
    description: 'Deep AI analysis',
    category: 'Transactions',
    endpoint: '/api/analyze-transaction',
    method: 'POST',
    presets: createExamplePresets('POST', '/api/analyze-transaction'),
  },

  // ============= BLOCKCHAIN (8 methods) =============
  {
    id: 'recent-blocks',
    name: 'Recent Blocks',
    description: 'Get recent blocks',
    category: 'Blockchain',
    endpoint: '/api/blocks',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/blocks'),
  },
  {
    id: 'get-block',
    name: 'Get Block',
    description: 'Get specific block',
    category: 'Blockchain',
    endpoint: '/api/blocks/{slot}',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/blocks/{slot}'),
  },
  {
    id: 'block-stats',
    name: 'Block Statistics',
    description: 'Get block statistics',
    category: 'Blockchain',
    endpoint: '/api/blocks/stats',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/blocks/stats'),
  },
  {
    id: 'slots',
    name: 'Slot Information',
    description: 'Get current slot info',
    category: 'Blockchain',
    endpoint: '/api/slots',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/slots'),
  },
  {
    id: 'solana-rpc',
    name: 'Solana RPC',
    description: 'Direct RPC calls',
    category: 'Blockchain',
    endpoint: '/api/solana-rpc',
    method: 'POST',
    presets: createExamplePresets('POST', '/api/solana-rpc'),
  },
  {
    id: 'solana-proxy',
    name: 'Solana Proxy',
    description: 'Proxied RPC with caching',
    category: 'Blockchain',
    endpoint: '/api/solana-proxy',
    method: 'POST',
    presets: createExamplePresets('POST', '/api/solana-proxy'),
  },

  // ============= TOKENS & NFTs (7 methods) =============
  {
    id: 'token-info',
    name: 'Token Information',
    description: 'Get token details',
    category: 'Tokens & NFTs',
    endpoint: '/api/token/{address}',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/token/{address}'),
  },
  {
    id: 'token-metadata',
    name: 'Token Metadata',
    description: 'Batch token metadata',
    category: 'Tokens & NFTs',
    endpoint: '/api/token-metadata',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/token-metadata'),
  },
  {
    id: 'check-token',
    name: 'Check Token',
    description: 'Validate token mint',
    category: 'Tokens & NFTs',
    endpoint: '/api/check-token',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/check-token'),
  },
  {
    id: 'nft-collections',
    name: 'NFT Collections',
    description: 'List NFT collections',
    category: 'Tokens & NFTs',
    endpoint: '/api/nft-collections',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/nft-collections'),
  },
  {
    id: 'trending-nfts',
    name: 'Trending NFTs',
    description: 'Get trending collections',
    category: 'Tokens & NFTs',
    endpoint: '/api/nft-collections/trending',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/nft-collections/trending'),
  },
  {
    id: 'new-collections',
    name: 'New Collections',
    description: 'Get new NFT collections',
    category: 'Tokens & NFTs',
    endpoint: '/api/nft-collections/new',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/nft-collections/new'),
  },

  // ============= ANALYTICS (13 methods) =============
  {
    id: 'defi-overview',
    name: 'DeFi Overview',
    description: 'Get DeFi ecosystem overview',
    category: 'Analytics',
    endpoint: '/api/analytics/overview',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/analytics/overview'),
  },
  {
    id: 'dex-analytics',
    name: 'DEX Analytics',
    description: 'Get DEX analytics',
    category: 'Analytics',
    endpoint: '/api/analytics/dex',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/analytics/dex'),
  },
  {
    id: 'defi-health',
    name: 'DeFi Health',
    description: 'Get DeFi health metrics',
    category: 'Analytics',
    endpoint: '/api/analytics/defi-health',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/analytics/defi-health'),
  },
  {
    id: 'validators',
    name: 'Validator Analytics',
    description: 'Get validator analytics',
    category: 'Analytics',
    endpoint: '/api/analytics/validators',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/analytics/validators'),
  },
  {
    id: 'trending-validators',
    name: 'Trending Validators',
    description: 'Get top validators',
    category: 'Analytics',
    endpoint: '/api/analytics/trending-validators',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/analytics/trending-validators'),
  },
  {
    id: 'marketplaces',
    name: 'NFT Marketplaces',
    description: 'Get marketplace analytics',
    category: 'Analytics',
    endpoint: '/api/analytics/marketplaces',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/analytics/marketplaces'),
  },
  {
    id: 'aggregators',
    name: 'DeFi Aggregators',
    description: 'Get aggregator analytics',
    category: 'Analytics',
    endpoint: '/api/analytics/aggregators',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/analytics/aggregators'),
  },
  {
    id: 'launchpads',
    name: 'Token Launchpads',
    description: 'Get launchpad analytics',
    category: 'Analytics',
    endpoint: '/api/analytics/launchpads',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/analytics/launchpads'),
  },
  {
    id: 'bots',
    name: 'Trading Bots',
    description: 'Get bot activity',
    category: 'Analytics',
    endpoint: '/api/analytics/bots',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/analytics/bots'),
  },
  {
    id: 'socialfi',
    name: 'SocialFi Metrics',
    description: 'Get SocialFi analytics',
    category: 'Analytics',
    endpoint: '/api/analytics/socialfi',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/analytics/socialfi'),
  },
  {
    id: 'market-data',
    name: 'Token Market Data & OHLCV',
    description: 'Get comprehensive token market data with OHLCV candles, pool info, and technical indicators',
    category: 'Analytics',
    endpoint: '/api/market-data',
    method: 'GET',
    presets: [
      {
        name: 'OSVM Token OHLCV (1H)',
        description: 'Get hourly OHLCV data for OSVM token',
        method: 'GET',
        path: '/api/market-data?mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263&endpoint=ohlcv&type=1H',
      },
      {
        name: 'BONK Daily Chart',
        description: 'Get daily OHLCV data for BONK',
        method: 'GET',
        path: '/api/market-data?mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263&endpoint=ohlcv&type=1D',
      },
      {
        name: 'Token Overview',
        description: 'Get token overview with price, volume, market cap',
        method: 'GET',
        path: '/api/market-data?mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263&endpoint=overview',
      },
      {
        name: 'Token Security Analysis',
        description: 'Get token security metrics (holder concentration, authorities)',
        method: 'GET',
        path: '/api/market-data?mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263&endpoint=security',
      },
      {
        name: 'Specific Pool OHLCV',
        description: 'Get OHLCV data for specific DEX pool',
        method: 'GET',
        path: '/api/market-data?mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263&endpoint=ohlcv&type=15m&poolAddress=8kJqxAbqbPAvJKuomNFtWfJZMh3ZPSFMaGw2JTJfhHqe',
      },
    ],
  },
  {
    id: 'chart',
    name: 'Chart Data (OHLCV Alias)',
    description: 'Clean alias for OHLCV candlestick data with automatic batch fetching for large time ranges',
    category: 'Analytics',
    endpoint: '/api/chart',
    method: 'GET',
    presets: [
      {
        name: 'Default Hourly Chart',
        description: 'Get default hourly OHLCV candles',
        method: 'GET',
        path: '/api/chart?mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      },
      {
        name: '1-Minute Chart (20h)',
        description: 'Get 1-minute candles with batching',
        method: 'GET',
        path: '/api/chart?mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263&type=1m',
      },
      {
        name: '15-Minute Chart (10d)',
        description: 'Get 15-minute candles for 10 days',
        method: 'GET',
        path: '/api/chart?mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263&type=15m',
      },
      {
        name: 'Daily Chart',
        description: 'Get daily OHLCV candles',
        method: 'GET',
        path: '/api/chart?mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263&type=1D',
      },
      {
        name: 'Custom Time Range',
        description: 'Get chart data for custom time range',
        method: 'GET',
        path: '/api/chart?mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263&type=1H&time_from=1699401600&time_to=1699488000',
      },
    ],
  },
  {
    id: 'trades',
    name: 'Recent Trades',
    description: 'Fetch recent trades/swaps for any token with wallet addresses and DEX info',
    category: 'Analytics',
    endpoint: '/api/trades',
    method: 'GET',
    presets: [
      {
        name: 'Last 50 Trades',
        description: 'Get last 50 trades for token',
        method: 'GET',
        path: '/api/trades?mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      },
      {
        name: 'Last 100 Trades',
        description: 'Get maximum trades (100)',
        method: 'GET',
        path: '/api/trades?mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263&limit=100',
      },
      {
        name: 'Only Swaps',
        description: 'Filter to show only swap transactions',
        method: 'GET',
        path: '/api/trades?mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263&type=swap&limit=50',
      },
      {
        name: 'Liquidity Additions',
        description: 'Show liquidity add transactions',
        method: 'GET',
        path: '/api/trades?mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263&type=add&limit=50',
      },
      {
        name: 'Paginated Results',
        description: 'Get trades with pagination (page 2)',
        method: 'GET',
        path: '/api/trades?mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263&limit=50&offset=50',
      },
    ],
  },

  // ============= AI-POWERED (6 methods) =============
  {
    id: 'get-answer',
    name: 'AI Question Answering',
    description: 'Ask questions about blockchain data',
    category: 'AI-Powered',
    endpoint: '/api/getAnswer',
    method: 'POST',
    presets: [
      {
        name: 'Current SOL Price',
        description: 'Ask about SOL price',
        method: 'POST',
        path: '/api/getAnswer',
        body: { question: 'What is the current price of SOL?' },
      },
      {
        name: 'DeFi Analysis',
        description: 'Analyze DeFi ecosystem',
        method: 'POST',
        path: '/api/getAnswer',
        body: { question: 'What are the top DeFi protocols by TVL on Solana?' },
      },
      {
        name: 'NFT Market',
        description: 'NFT market analysis',
        method: 'POST',
        path: '/api/getAnswer',
        body: { question: 'What is the current state of the NFT market on Solana?' },
      },
      {
        name: 'Transaction Explain',
        description: 'Explain a transaction',
        method: 'POST',
        path: '/api/getAnswer',
        body: { question: 'Explain transaction 5vYsYWPF4gdN1imxLpJAWi9QKpN3MSrFTFXK8pfmPogFjQNPiAkxFQCGzEEWNto16mWnwmdwNQH7KPCnkMcZ9Ba5' },
      },
      {
        name: 'Wallet Analysis',
        description: 'Analyze trading patterns',
        method: 'POST',
        path: '/api/getAnswer',
        body: { question: 'Analyze wallet 7aDTuuAN98tBanLcJQgq2oVaXztBzMgLNRu84iVqnVVH' },
      },
    ]
  },
  {
    id: 'similar-questions',
    name: 'Similar Questions',
    description: 'Find similar questions',
    category: 'AI-Powered',
    endpoint: '/api/getSimilarQuestions',
    method: 'POST',
    presets: createExamplePresets('POST', '/api/getSimilarQuestions'),
  },
  {
    id: 'get-sources',
    name: 'Data Sources',
    description: 'Get available data sources',
    category: 'AI-Powered',
    endpoint: '/api/getSources',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/getSources'),
  },
  {
    id: 'ai-analyze',
    name: 'General Analysis',
    description: 'General AI analysis',
    category: 'AI-Powered',
    endpoint: '/api/analyze',
    method: 'POST',
    presets: createExamplePresets('POST', '/api/analyze'),
  },
  {
    id: 'ai-response',
    name: 'AI Response',
    description: 'Generate AI responses',
    category: 'AI-Powered',
    endpoint: '/api/ai-response',
    method: 'POST',
    presets: createExamplePresets('POST', '/api/ai-response'),
  },
  {
    id: 'ai-context',
    name: 'AI Context',
    description: 'Get conversation context',
    category: 'AI-Powered',
    endpoint: '/api/ai-context',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/ai-context'),
  },

  // ============= REAL-TIME (6 methods) =============
  {
    id: 'sse-feed',
    name: 'Transaction Feed',
    description: 'Real-time transaction stream',
    category: 'Real-Time',
    endpoint: '/api/sse-feed',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/sse-feed'),
  },
  {
    id: 'sse-events',
    name: 'Event Feed',
    description: 'Real-time event stream',
    category: 'Real-Time',
    endpoint: '/api/sse-events/feed',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/sse-events/feed'),
  },
  {
    id: 'sse-alerts',
    name: 'Real-Time Alerts',
    description: 'Alert notifications',
    category: 'Real-Time',
    endpoint: '/api/sse-alerts',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/sse-alerts'),
  },
  {
    id: 'stream',
    name: 'Data Stream',
    description: 'General data streaming',
    category: 'Real-Time',
    endpoint: '/api/stream',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/stream'),
  },
  {
    id: 'create-stream',
    name: 'Create Stream',
    description: 'Create subscription',
    category: 'Real-Time',
    endpoint: '/api/stream',
    method: 'POST',
    presets: createExamplePresets('POST', '/api/stream'),
  },
  {
    id: 'scan',
    name: 'Blockchain Scan',
    description: 'Blockchain scanning',
    category: 'Real-Time',
    endpoint: '/api/scan',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/scan'),
  },

  // ============= USER SERVICES (14 methods) =============
  {
    id: 'user-feed',
    name: 'User Feed',
    description: 'Personal activity feed',
    category: 'User Services',
    endpoint: '/api/user-feed/{walletAddress}',
    method: 'GET',
    presets: createExamplePresets('GET', '/api/user-feed/{walletAddress}'),
  },
  {
    id: 'update-profile',
    name: 'Update Profile',
    description: 'Update user profile',
    category: 'User Services',
    endpoint: '/api/user-profile/{walletAddress}',
    method: 'PUT',
    presets: createExamplePresets('PUT', '/api/user-profile/{walletAddress}'),
  },
];

// Export helper functions
export const getMethodsByCategory = (category: string): ApiMethod[] => {
  return apiMethods.filter(m => m.category === category);
};

export const getAllCategories = (): string[] => {
  return Array.from(new Set(apiMethods.map(m => m.category)));
};
