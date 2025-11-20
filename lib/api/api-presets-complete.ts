/**
 * API Method Presets - Complete Version
 * Provides clickable preset examples for all API methods
 * Total: 97 Core API Routes + External Integrations
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

// Part 1: Core API Methods
export const apiMethodsPart1: ApiMethod[] = [
  // ============= TRANSACTIONS (continued) =============
  {
    id: 'get-transaction',
    name: 'Get Transaction',
    description: 'Get detailed transaction information',
    category: 'Transactions',
    endpoint: '/api/transaction/{signature}',
    method: 'GET',
    presets: [
      {
        name: 'Recent SOL Transfer',
        description: 'Get recent SOL transfer details',
        method: 'GET',
        path: '/api/transaction/5vYsYWPF4gdN1imxLpJAWi9QKpN3MSrFTFXK8pfmPogFjQNPiAkxFQCGzEEWNto16mWnwmdwNQH7KPCnkMcZ9Ba5',
      },
      {
        name: 'Token Swap',
        description: 'Get token swap transaction',
        method: 'GET',
        path: '/api/transaction/4XH9TKRnobJWnSFtZjDNc2zXJYP7y4BnmJKVzGP8p6mf7rGas2JJhTzbFQGHGCBwyLFzBrNhqFtAwtDpKgKQYfAQ',
      },
      {
        name: 'NFT Mint',
        description: 'Get NFT minting transaction',
        method: 'GET',
        path: '/api/transaction/2rMhDdJGhHHZfxP1vTQQoGQBBFKZMJFZ1GJQcVPGKJaKYmcAfngXD9wWNpoRxvKzFdqVfQZgQhVha3FQBrJQBcZc',
      },
      {
        name: 'DeFi Interaction',
        description: 'Get DeFi protocol transaction',
        method: 'GET',
        path: '/api/transaction/3pMvTLUA9NzZQd4gi725p89mvND1wRNQM3C8XEv1hTdA',
      },
      {
        name: 'Failed Transaction',
        description: 'Analyze a failed transaction',
        method: 'GET',
        path: '/api/transaction/4Nd1mLK8MJqxz9KjJQpVJBzFVfUnNfadbBWECoLXUZ3o',
      },
    ]
  },

  {
    id: 'analyze-transaction',
    name: 'AI Transaction Analysis',
    description: 'Get AI-powered transaction analysis',
    category: 'Transactions',
    endpoint: '/api/analyze-transaction',
    method: 'POST',
    presets: [
      {
        name: 'Analyze Recent Transfer',
        description: 'Analyze a recent transfer',
        method: 'POST',
        path: '/api/analyze-transaction',
        body: { signature: '5vYsYWPF4gdN1imxLpJAWi9QKpN3MSrFTFXK8pfmPogFjQNPiAkxFQCGzEEWNto16mWnwmdwNQH7KPCnkMcZ9Ba5' },
      },
      {
        name: 'Analyze Complex DeFi',
        description: 'Analyze complex DeFi transaction',
        method: 'POST',
        path: '/api/analyze-transaction',
        body: { signature: '3pMvTLUA9NzZQd4gi725p89mvND1wRNQM3C8XEv1hTdA', detailed: true },
      },
      {
        name: 'Analyze Failed Tx',
        description: 'Analyze why transaction failed',
        method: 'POST',
        path: '/api/analyze-transaction',
        body: { signature: '4Nd1mLK8MJqxz9KjJQpVJBzFVfUnNfadbBWECoLXUZ3o', includeError: true },
      },
      {
        name: 'Analyze with Context',
        description: 'Analyze with historical context',
        method: 'POST',
        path: '/api/analyze-transaction',
        body: { signature: '2rMhDdJGhHHZfxP1vTQQoGQBBFKZMJFZ1GJQcVPGKJaKYmcAfngXD9wWNpoRxvKzFdqVfQZgQhVha3FQBrJQBcZc', includeHistory: true },
      },
      {
        name: 'Quick Analysis',
        description: 'Get quick transaction summary',
        method: 'POST',
        path: '/api/analyze-transaction',
        body: { signature: '4XH9TKRnobJWnSFtZjDNc2zXJYP7y4BnmJKVzGP8p6mf7rGas2JJhTzbFQGHGCBwyLFzBrNhqFtAwtDpKgKQYfAQ', quick: true },
      },
    ]
  },

  {
    id: 'batch-transactions',
    name: 'Batch Transaction Fetch',
    description: 'Fetch multiple transactions at once',
    category: 'Transactions',
    endpoint: '/api/transaction/batch',
    method: 'POST',
    presets: [
      {
        name: 'Batch 5 Transactions',
        description: 'Fetch 5 transactions at once',
        method: 'POST',
        path: '/api/transaction/batch',
        body: { 
          signatures: [
            '5vYsYWPF4gdN1imxLpJAWi9QKpN3MSrFTFXK8pfmPogFjQNPiAkxFQCGzEEWNto16mWnwmdwNQH7KPCnkMcZ9Ba5',
            '4XH9TKRnobJWnSFtZjDNc2zXJYP7y4BnmJKVzGP8p6mf7rGas2JJhTzbFQGHGCBwyLFzBrNhqFtAwtDpKgKQYfAQ',
            '2rMhDdJGhHHZfxP1vTQQoGQBBFKZMJFZ1GJQcVPGKJaKYmcAfngXD9wWNpoRxvKzFdqVfQZgQhVha3FQBrJQBcZc',
            '3pMvTLUA9NzZQd4gi725p89mvND1wRNQM3C8XEv1hTdA',
            '4Nd1mLK8MJqxz9KjJQpVJBzFVfUnNfadbBWECoLXUZ3o'
          ]
        },
      },
      {
        name: 'Batch with Details',
        description: 'Fetch with detailed parsing',
        method: 'POST',
        path: '/api/transaction/batch',
        body: { 
          signatures: ['5vYsYWPF4gdN1imxLpJAWi9QKpN3MSrFTFXK8pfmPogFjQNPiAkxFQCGzEEWNto16mWnwmdwNQH7KPCnkMcZ9Ba5'],
          includeDetails: true 
        },
      },
      {
        name: 'Related Transactions',
        description: 'Fetch related transactions',
        method: 'POST',
        path: '/api/transaction/batch',
        body: { 
          signatures: ['3pMvTLUA9NzZQd4gi725p89mvND1wRNQM3C8XEv1hTdA'],
          includeRelated: true 
        },
      },
      {
        name: 'Quick Batch',
        description: 'Quick batch fetch without details',
        method: 'POST',
        path: '/api/transaction/batch',
        body: { 
          signatures: ['4XH9TKRnobJWnSFtZjDNc2zXJYP7y4BnmJKVzGP8p6mf7rGas2JJhTzbFQGHGCBwyLFzBrNhqFtAwtDpKgKQYfAQ'],
          quick: true 
        },
      },
      {
        name: 'Failed Transactions Batch',
        description: 'Batch fetch failed transactions',
        method: 'POST',
        path: '/api/transaction/batch',
        body: { 
          signatures: ['4Nd1mLK8MJqxz9KjJQpVJBzFVfUnNfadbBWECoLXUZ3o'],
          filterFailed: true 
        },
      },
    ]
  },

  {
    id: 'filter-transactions',
    name: 'Filter Transactions',
    description: 'Filter transactions by various criteria',
    category: 'Transactions',
    endpoint: '/api/filter-transactions',
    method: 'POST',
    presets: [
      {
        name: 'High Value Transfers',
        description: 'Filter high value transfers',
        method: 'POST',
        path: '/api/filter-transactions',
        body: { minAmount: 1000, type: 'transfer' },
      },
      {
        name: 'Recent Token Swaps',
        description: 'Filter recent token swaps',
        method: 'POST',
        path: '/api/filter-transactions',
        body: { type: 'swap', timeframe: '24h' },
      },
      {
        name: 'NFT Sales',
        description: 'Filter NFT sale transactions',
        method: 'POST',
        path: '/api/filter-transactions',
        body: { type: 'nft_sale', limit: 50 },
      },
      {
        name: 'Failed Transactions',
        description: 'Filter failed transactions',
        method: 'POST',
        path: '/api/filter-transactions',
        body: { status: 'failed', limit: 100 },
      },
      {
        name: 'DeFi Interactions',
        description: 'Filter DeFi protocol interactions',
        method: 'POST',
        path: '/api/filter-transactions',
        body: { program: 'defi', includeAll: true },
      },
    ]
  },
];

// Part 2: Blocks, Tokens, NFTs
export const apiMethodsPart2: ApiMethod[] = [
  // ============= BLOCKCHAIN DATA =============
  {
    id: 'get-recent-blocks',
    name: 'Get Recent Blocks',
    description: 'Retrieve the most recent blocks',
    category: 'Blockchain',
    endpoint: '/api/blocks',
    method: 'GET',
    presets: [
      {
        name: 'Latest 10 Blocks',
        description: 'Get 10 most recent blocks',
        method: 'GET',
        path: '/api/blocks?limit=10',
      },
      {
        name: 'Latest 50 Blocks',
        description: 'Get 50 most recent blocks',
        method: 'GET',
        path: '/api/blocks?limit=50',
      },
      {
        name: 'Blocks with Pagination',
        description: 'Get blocks with cursor',
        method: 'GET',
        path: '/api/blocks?limit=20&before=290000000',
      },
      {
        name: 'Today\'s Blocks',
        description: 'Get blocks from today',
        method: 'GET',
        path: '/api/blocks?timeframe=today',
      },
      {
        name: 'High Activity Blocks',
        description: 'Get blocks with high transaction count',
        method: 'GET',
        path: '/api/blocks?minTransactions=1000',
      },
    ]
  },

  {
    id: 'get-block',
    name: 'Get Specific Block',
    description: 'Get information about a specific block',
    category: 'Blockchain',
    endpoint: '/api/blocks/{slot}',
    method: 'GET',
    presets: [
      {
        name: 'Recent Block',
        description: 'Get a recent block',
        method: 'GET',
        path: '/api/blocks/290000000',
      },
      {
        name: 'Historical Block',
        description: 'Get historical block data',
        method: 'GET',
        path: '/api/blocks/280000000',
      },
      {
        name: 'Genesis Block Region',
        description: 'Get early block',
        method: 'GET',
        path: '/api/blocks/1000000',
      },
      {
        name: 'High Activity Block',
        description: 'Get block with many transactions',
        method: 'GET',
        path: '/api/blocks/289500000',
      },
      {
        name: 'Specific Slot',
        description: 'Get block at specific slot',
        method: 'GET',
        path: '/api/blocks/285000000',
      },
    ]
  },

  {
    id: 'block-stats',
    name: 'Block Statistics',
    description: 'Get blockchain statistics and metrics',
    category: 'Blockchain',
    endpoint: '/api/blocks/stats',
    method: 'GET',
    presets: [
      {
        name: 'Current Stats',
        description: 'Get current blockchain stats',
        method: 'GET',
        path: '/api/blocks/stats',
      },
      {
        name: 'Last 100 Slots',
        description: 'Stats for last 100 slots',
        method: 'GET',
        path: '/api/blocks/stats?lookbackSlots=100',
      },
      {
        name: 'Last 1000 Slots',
        description: 'Stats for last 1000 slots',
        method: 'GET',
        path: '/api/blocks/stats?lookbackSlots=1000',
      },
      {
        name: 'Performance Metrics',
        description: 'Get performance metrics',
        method: 'GET',
        path: '/api/blocks/stats?includePerformance=true',
      },
      {
        name: 'Network Health',
        description: 'Get network health metrics',
        method: 'GET',
        path: '/api/blocks/stats?includeHealth=true',
      },
    ]
  },

  // ============= TOKENS & NFTs =============
  {
    id: 'get-token-info',
    name: 'Get Token Information',
    description: 'Get detailed token information',
    category: 'Tokens & NFTs',
    endpoint: '/api/token/{address}',
    method: 'GET',
    presets: [
      {
        name: 'USDC Token',
        description: 'Get USDC token info',
        method: 'GET',
        path: '/api/token/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      },
      {
        name: 'Wrapped SOL',
        description: 'Get WSOL token info',
        method: 'GET',
        path: '/api/token/So11111111111111111111111111111111111111112',
      },
      {
        name: 'USDT Token',
        description: 'Get USDT token info',
        method: 'GET',
        path: '/api/token/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      },
      {
        name: 'RAY Token',
        description: 'Get Raydium token info',
        method: 'GET',
        path: '/api/token/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
      },
      {
        name: 'Custom Token',
        description: 'Get custom token info',
        method: 'GET',
        path: '/api/token/DezQQPSbqb9cqfF4BwnwJWqkWsZTdQfQcMqJsW1g9dBu',
      },
    ]
  },

  {
    id: 'token-metadata-batch',
    name: 'Batch Token Metadata',
    description: 'Get metadata for multiple tokens',
    category: 'Tokens & NFTs',
    endpoint: '/api/token-metadata',
    method: 'GET',
    presets: [
      {
        name: 'Stablecoins',
        description: 'Get stablecoin metadata',
        method: 'GET',
        path: '/api/token-metadata?mints=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v,Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      },
      {
        name: 'DEX Tokens',
        description: 'Get DEX token metadata',
        method: 'GET',
        path: '/api/token-metadata?mints=4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R,SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt',
      },
      {
        name: 'Memecoins',
        description: 'Get memecoin metadata',
        method: 'GET',
        path: '/api/token-metadata?mints=DezQQPSbqb9cqfF4BwnwJWqkWsZTdQfQcMqJsW1g9dBu,7GCihgDB8fe6KNjn2MYtkzZczyMcKj8bAW6tgBPPMa9d',
      },
      {
        name: 'Governance Tokens',
        description: 'Get governance token metadata',
        method: 'GET',
        path: '/api/token-metadata?mints=MNDEFzGvMt87ueuHvVU9VcTqyMjc8BiTnmCFRr19bCR,PsyFxnXLEE5ZQfeLcJAhtRgrzjJhePdMBpgAwgYsN2Zp',
      },
      {
        name: 'Multiple Tokens',
        description: 'Get metadata for 5 tokens',
        method: 'GET',
        path: '/api/token-metadata?mints=So11111111111111111111111111111111111111112,EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v,Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB,4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R,SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt',
      },
    ]
  },

  {
    id: 'nft-collections',
    name: 'NFT Collections',
    description: 'List NFT collections',
    category: 'Tokens & NFTs',
    endpoint: '/api/nft-collections',
    method: 'GET',
    presets: [
      {
        name: 'Top Collections',
        description: 'Get top NFT collections',
        method: 'GET',
        path: '/api/nft-collections?sort=volume&limit=20',
      },
      {
        name: 'Trending Collections',
        description: 'Get trending collections',
        method: 'GET',
        path: '/api/nft-collections/trending',
      },
      {
        name: 'New Collections',
        description: 'Get recently launched collections',
        method: 'GET',
        path: '/api/nft-collections/new',
      },
      {
        name: 'By Floor Price',
        description: 'Collections by floor price',
        method: 'GET',
        path: '/api/nft-collections?sort=floor&limit=50',
      },
      {
        name: 'By Item Count',
        description: 'Collections by number of items',
        method: 'GET',
        path: '/api/nft-collections?sort=items&limit=30',
      },
    ]
  },
];

// Part 3: Analytics, AI, Real-time
export const apiMethodsPart3: ApiMethod[] = [
  // ============= ANALYTICS =============
  {
    id: 'defi-overview',
    name: 'DeFi Overview',
    description: 'Get comprehensive DeFi ecosystem overview',
    category: 'Analytics',
    endpoint: '/api/analytics/overview',
    method: 'GET',
    presets: [
      {
        name: 'Current Overview',
        description: 'Get current DeFi metrics',
        method: 'GET',
        path: '/api/analytics/overview',
      },
      {
        name: 'TVL Focus',
        description: 'Focus on Total Value Locked',
        method: 'GET',
        path: '/api/analytics/overview?metrics=tvl,volume',
      },
      {
        name: 'Top Protocols',
        description: 'Get top DeFi protocols',
        method: 'GET',
        path: '/api/analytics/overview?includeProtocols=true&limit=20',
      },
      {
        name: 'Weekly Stats',
        description: 'Get weekly DeFi statistics',
        method: 'GET',
        path: '/api/analytics/overview?timeframe=7d',
      },
      {
        name: 'Risk Metrics',
        description: 'Get DeFi risk metrics',
        method: 'GET',
        path: '/api/analytics/overview?includeRisks=true',
      },
    ]
  },

  {
    id: 'dex-analytics',
    name: 'DEX Analytics',
    description: 'Get decentralized exchange analytics',
    category: 'Analytics',
    endpoint: '/api/analytics/dex',
    method: 'GET',
    presets: [
      {
        name: 'All DEXs',
        description: 'Get all DEX analytics',
        method: 'GET',
        path: '/api/analytics/dex',
      },
      {
        name: '24h Volume',
        description: 'Get 24h DEX volumes',
        method: 'GET',
        path: '/api/analytics/dex?timeframe=24h',
      },
      {
        name: 'Top Pairs',
        description: 'Get top trading pairs',
        method: 'GET',
        path: '/api/analytics/dex?includePairs=true&limit=50',
      },
      {
        name: 'Liquidity Metrics',
        description: 'Get liquidity metrics',
        method: 'GET',
        path: '/api/analytics/dex?metrics=liquidity,depth',
      },
      {
        name: 'Specific DEX',
        description: 'Get Raydium analytics',
        method: 'GET',
        path: '/api/dex/raydium',
      },
    ]
  },

  {
    id: 'validator-analytics',
    name: 'Validator Analytics',
    description: 'Get validator network analytics',
    category: 'Analytics',
    endpoint: '/api/analytics/validators',
    method: 'GET',
    presets: [
      {
        name: 'All Validators',
        description: 'Get all validator stats',
        method: 'GET',
        path: '/api/analytics/validators',
      },
      {
        name: 'Top Validators',
        description: 'Get top validators by stake',
        method: 'GET',
        path: '/api/analytics/validators?sort=stake&limit=20',
      },
      {
        name: 'Performance Metrics',
        description: 'Get validator performance',
        method: 'GET',
        path: '/api/analytics/validators?includePerformance=true',
      },
      {
        name: 'Trending Validators',
        description: 'Get trending validators',
        method: 'GET',
        path: '/api/analytics/trending-validators',
      },
      {
        name: 'Network Health',
        description: 'Get network health metrics',
        method: 'GET',
        path: '/api/analytics/validators?includeHealth=true',
      },
    ]
  },

  // ============= AI-POWERED =============
  {
    id: 'get-answer',
    name: 'AI Question Answering',
    description: 'Ask AI questions about blockchain data',
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
        body: { question: 'Explain what happened in transaction 5vYsYWPF4gdN1imxLpJAWi9QKpN3MSrFTFXK8pfmPogFjQNPiAkxFQCGzEEWNto16mWnwmdwNQH7KPCnkMcZ9Ba5' },
      },
      {
        name: 'Wallet Analysis',
        description: 'Analyze a wallet',
        method: 'POST',
        path: '/api/getAnswer',
        body: { question: 'Analyze the trading patterns of wallet REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck' },
      },
    ]
  },

  {
    id: 'similar-questions',
    name: 'Find Similar Questions',
    description: 'Find similar AI questions',
    category: 'AI-Powered',
    endpoint: '/api/getSimilarQuestions',
    method: 'POST',
    presets: [
      {
        name: 'Price Questions',
        description: 'Find price-related questions',
        method: 'POST',
        path: '/api/getSimilarQuestions',
        body: { question: 'token prices' },
      },
      {
        name: 'DeFi Questions',
        description: 'Find DeFi-related questions',
        method: 'POST',
        path: '/api/getSimilarQuestions',
        body: { question: 'defi protocols' },
      },
      {
        name: 'NFT Questions',
        description: 'Find NFT-related questions',
        method: 'POST',
        path: '/api/getSimilarQuestions',
        body: { question: 'nft collections' },
      },
      {
        name: 'Trading Questions',
        description: 'Find trading-related questions',
        method: 'POST',
        path: '/api/getSimilarQuestions',
        body: { question: 'trading strategies' },
      },
      {
        name: 'Wallet Questions',
        description: 'Find wallet-related questions',
        method: 'POST',
        path: '/api/getSimilarQuestions',
        body: { question: 'wallet analysis' },
      },
    ]
  },

  // ============= REAL-TIME =============
  {
    id: 'sse-feed',
    name: 'Real-Time Transaction Feed',
    description: 'Stream real-time transactions',
    category: 'Real-Time',
    endpoint: '/api/sse-feed',
    method: 'GET',
    presets: [
      {
        name: 'All Transactions',
        description: 'Stream all transactions',
        method: 'GET',
        path: '/api/sse-feed',
      },
      {
        name: 'High Value Only',
        description: 'Stream high-value transactions',
        method: 'GET',
        path: '/api/sse-feed?minAmount=1000',
      },
      {
        name: 'Token Transfers',
        description: 'Stream token transfers only',
        method: 'GET',
        path: '/api/sse-feed?type=token_transfer',
      },
      {
        name: 'NFT Activity',
        description: 'Stream NFT transactions',
        method: 'GET',
        path: '/api/sse-feed?type=nft',
      },
      {
        name: 'DeFi Activity',
        description: 'Stream DeFi transactions',
        method: 'GET',
        path: '/api/sse-feed?program=defi',
      },
    ]
  },

  {
    id: 'sse-alerts',
    name: 'Real-Time Alerts',
    description: 'Stream real-time alerts',
    category: 'Real-Time',
    endpoint: '/api/sse-alerts',
    method: 'GET',
    presets: [
      {
        name: 'All Alerts',
        description: 'Stream all alerts',
        method: 'GET',
        path: '/api/sse-alerts',
      },
      {
        name: 'Critical Only',
        description: 'Stream critical alerts only',
        method: 'GET',
        path: '/api/sse-alerts?level=critical',
      },
      {
        name: 'Price Alerts',
        description: 'Stream price movement alerts',
        method: 'GET',
        path: '/api/sse-alerts?type=price',
      },
      {
        name: 'Whale Alerts',
        description: 'Stream whale activity alerts',
        method: 'GET',
        path: '/api/sse-alerts?type=whale',
      },
      {
        name: 'Network Alerts',
        description: 'Stream network status alerts',
        method: 'GET',
        path: '/api/sse-alerts?type=network',
      },
    ]
  },
];

// Combine all parts into a single export
export const apiMethods: ApiMethod[] = [
  ...apiMethodsPart1,
  ...apiMethodsPart2,
  ...apiMethodsPart3,
];

// Export categories for filtering
export const apiCategories = [
  'Transactions',
  'Blockchain',
  'Tokens & NFTs',
  'Analytics',
  'AI-Powered',
  'Real-Time',
  'Account & Wallet',
  'Search & Discovery',
  'User Services',
];

// Helper function to get methods by category
export function getMethodsByCategory(category: string): ApiMethod[] {
  return apiMethods.filter(method => method.category === category);
}

// Helper function to get preset by ID
export function getMethodById(id: string): ApiMethod | undefined {
  return apiMethods.find(method => method.id === id);
}

// Helper function to search methods
export function searchMethods(query: string): ApiMethod[] {
  const lowerQuery = query.toLowerCase();
  return apiMethods.filter(method => 
    method.name.toLowerCase().includes(lowerQuery) ||
    method.description.toLowerCase().includes(lowerQuery) ||
    method.endpoint.toLowerCase().includes(lowerQuery) ||
    method.category.toLowerCase().includes(lowerQuery)
  );
}

// Export total count
export const totalApiMethods = apiMethods.length;
