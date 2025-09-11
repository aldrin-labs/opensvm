/**
 * Comprehensive API Knowledge System
 * Maps both Solana RPC API and OpenSVM API methods for intelligent planning
 */

export interface APIParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  example?: any;
}

export interface APIMethod {
  name: string;
  type: 'solana-rpc' | 'opensvm-api';
  endpoint?: string; // For OpenSVM APIs
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; // HTTP method for OpenSVM
  description: string;
  parameters: APIParameter[];
  returns: string;
  examples: string[];
  informationTypes: string[]; // What information this method provides
  category: string; // Grouping category
  dependencies?: string[]; // Other methods this depends on
}

export interface InformationPattern {
  name: string;
  description: string;
  apiSequence: APICall[];
  dependencies: string[];
  useCase: string;
  examples: string[];
}

export interface APICall {
  method: string;
  reason: string;
  input?: string;
  parameters?: Record<string, any>;
}

// Complete Solana RPC API specification from docs/solana-rpc-llms.md
export const SOLANA_RPC_METHODS: APIMethod[] = [
  // Account Methods
  {
    name: 'getAccountInfo',
    type: 'solana-rpc',
    description: 'Returns all information associated with the account of provided Pubkey',
    parameters: [
      { name: 'pubkey', type: 'string', required: true, description: 'Pubkey of account to query, as base-58 encoded string' },
      { name: 'commitment', type: 'string', required: false, description: 'The commitment level' },
      { name: 'encoding', type: 'string', required: false, description: 'Encoding format for Account data' }
    ],
    returns: 'Account information including lamports, owner, data, executable status',
    examples: ['Get account details for a wallet', 'Check if account exists', 'Retrieve account data'],
    informationTypes: ['account-data', 'balance', 'ownership', 'program-data'],
    category: 'account'
  },
  {
    name: 'getBalance',
    type: 'solana-rpc',
    description: 'Returns the lamport balance of the account of provided Pubkey',
    parameters: [
      { name: 'pubkey', type: 'string', required: true, description: 'Pubkey of account to query' },
      { name: 'commitment', type: 'string', required: false, description: 'The commitment level' }
    ],
    returns: 'Lamport balance as u64',
    examples: ['Check wallet balance', 'Verify account has sufficient funds'],
    informationTypes: ['balance', 'lamports'],
    category: 'account'
  },
  {
    name: 'getMultipleAccounts',
    type: 'solana-rpc',
    description: 'Returns the account information for a list of Pubkeys',
    parameters: [
      { name: 'pubkeys', type: 'array', required: true, description: 'Array of Pubkeys to query (max 100)' },
      { name: 'commitment', type: 'string', required: false, description: 'The commitment level' },
      { name: 'encoding', type: 'string', required: false, description: 'Encoding format' }
    ],
    returns: 'Array of account information objects',
    examples: ['Batch account queries', 'Check multiple wallet balances'],
    informationTypes: ['batch-account-data', 'multi-balance'],
    category: 'account'
  },

  // Transaction Methods
  {
    name: 'getTransaction',
    type: 'solana-rpc',
    description: 'Returns transaction details for a confirmed transaction',
    parameters: [
      { name: 'signature', type: 'string', required: true, description: 'Transaction signature as base-58 encoded string' },
      { name: 'commitment', type: 'string', required: false, description: 'The commitment level' },
      { name: 'maxSupportedTransactionVersion', type: 'number', required: false, description: 'Max transaction version to return' },
      { name: 'encoding', type: 'string', required: false, description: 'Encoding format' }
    ],
    returns: 'Transaction details including metadata, accounts, and instructions',
    examples: ['Analyze specific transaction', 'Get transaction status', 'Decode transaction instructions'],
    informationTypes: ['transaction-details', 'instruction-data', 'account-changes'],
    category: 'transaction'
  },
  {
    name: 'getSignaturesForAddress',
    type: 'solana-rpc',
    description: 'Returns signatures for confirmed transactions that include the given address',
    parameters: [
      { name: 'address', type: 'string', required: true, description: 'Account address as base-58 encoded string' },
      { name: 'limit', type: 'number', required: false, description: 'Maximum signatures to return (1-1000)' },
      { name: 'before', type: 'string', required: false, description: 'Start searching backwards from this signature' },
      { name: 'until', type: 'string', required: false, description: 'Search until this signature' }
    ],
    returns: 'Array of transaction signature information',
    examples: ['Get transaction history for address', 'Find recent transactions', 'Track address activity'],
    informationTypes: ['transaction-history', 'address-activity', 'signature-list'],
    category: 'transaction'
  },
  {
    name: 'simulateTransaction',
    type: 'solana-rpc',
    description: 'Simulate sending a transaction',
    parameters: [
      { name: 'transaction', type: 'string', required: true, description: 'Transaction as encoded string' },
      { name: 'commitment', type: 'string', required: false, description: 'Commitment level' },
      { name: 'encoding', type: 'string', required: false, description: 'Encoding format' },
      { name: 'replaceRecentBlockhash', type: 'boolean', required: false, description: 'Replace blockhash' }
    ],
    returns: 'Simulation result with logs and effects',
    examples: ['Test transaction before sending', 'Estimate fees and effects', 'Debug transaction issues'],
    informationTypes: ['simulation-results', 'transaction-effects', 'fee-estimation'],
    category: 'transaction'
  },

  // Network Methods
  {
    name: 'getEpochInfo',
    type: 'solana-rpc',
    description: 'Returns information about the current epoch',
    parameters: [
      { name: 'commitment', type: 'string', required: false, description: 'The commitment level' }
    ],
    returns: 'Current epoch information including slot and block height',
    examples: ['Get current epoch data', 'Check network progress'],
    informationTypes: ['epoch-data', 'network-status', 'slot-info'],
    category: 'network'
  },
  {
    name: 'getSlot',
    type: 'solana-rpc',
    description: 'Returns the slot that has reached the given or default commitment level',
    parameters: [
      { name: 'commitment', type: 'string', required: false, description: 'The commitment level' }
    ],
    returns: 'Current slot number',
    examples: ['Get current slot', 'Track network progress'],
    informationTypes: ['current-slot', 'network-progress'],
    category: 'network'
  },
  {
    name: 'getBlockHeight',
    type: 'solana-rpc',
    description: 'Returns the current block height of the node',
    parameters: [
      { name: 'commitment', type: 'string', required: false, description: 'The commitment level' }
    ],
    returns: 'Current block height',
    examples: ['Get block height', 'Track chain progress'],
    informationTypes: ['block-height', 'chain-progress'],
    category: 'network'
  },
  {
    name: 'getRecentPerformanceSamples',
    type: 'solana-rpc',
    description: 'Returns a list of recent performance samples',
    parameters: [
      { name: 'limit', type: 'number', required: false, description: 'Number of samples to return (max 720)' }
    ],
    returns: 'Array of performance sample objects with TPS and timing data',
    examples: ['Analyze network performance', 'Get TPS data', 'Monitor network health'],
    informationTypes: ['performance-metrics', 'tps-data', 'network-health'],
    category: 'network'
  },
  {
    name: 'getVoteAccounts',
    type: 'solana-rpc',
    description: 'Returns account info and associated stake for all voting accounts',
    parameters: [
      { name: 'commitment', type: 'string', required: false, description: 'The commitment level' },
      { name: 'votePubkey', type: 'string', required: false, description: 'Only return this validator' }
    ],
    returns: 'Current and delinquent validators with stake information',
    examples: ['Get validator information', 'Check validator status', 'Analyze stake distribution'],
    informationTypes: ['validator-data', 'stake-info', 'validator-status'],
    category: 'network'
  },

  // Block Methods  
  {
    name: 'getBlock',
    type: 'solana-rpc',
    description: 'Returns identity and transaction information about a confirmed block',
    parameters: [
      { name: 'slot', type: 'number', required: true, description: 'Slot number' },
      { name: 'commitment', type: 'string', required: false, description: 'The commitment level' },
      { name: 'encoding', type: 'string', required: false, description: 'Encoding format' },
      { name: 'transactionDetails', type: 'string', required: false, description: 'Level of transaction detail' },
      { name: 'maxSupportedTransactionVersion', type: 'number', required: false, description: 'Max transaction version' }
    ],
    returns: 'Block information including transactions and metadata',
    examples: ['Get block details', 'Analyze block transactions', 'Check block timing'],
    informationTypes: ['block-data', 'block-transactions', 'block-metadata'],
    category: 'block'
  },

  // Token Methods
  {
    name: 'getTokenAccountBalance',
    type: 'solana-rpc',
    description: 'Returns the token balance of an SPL Token account',
    parameters: [
      { name: 'pubkey', type: 'string', required: true, description: 'Pubkey of Token account to query' },
      { name: 'commitment', type: 'string', required: false, description: 'The commitment level' }
    ],
    returns: 'Token balance with amount and UI amount',
    examples: ['Check token balance', 'Get SPL token amount'],
    informationTypes: ['token-balance', 'spl-token-data'],
    category: 'token'
  },
  {
    name: 'getTokenAccountsByOwner',
    type: 'solana-rpc',
    description: 'Returns all SPL Token accounts by token owner',
    parameters: [
      { name: 'pubkey', type: 'string', required: true, description: 'Pubkey of account owner' },
      { name: 'mint', type: 'string', required: false, description: 'Pubkey of specific token mint' },
      { name: 'programId', type: 'string', required: false, description: 'Pubkey of Token program' },
      { name: 'commitment', type: 'string', required: false, description: 'The commitment level' },
      { name: 'encoding', type: 'string', required: false, description: 'Encoding format' }
    ],
    returns: 'Array of token accounts owned by the address',
    examples: ['Get all tokens owned by wallet', 'Find specific token accounts'],
    informationTypes: ['token-accounts', 'token-holdings', 'spl-tokens'],
    category: 'token'
  },
  {
    name: 'getTokenLargestAccounts',
    type: 'solana-rpc',
    description: 'Returns the 20 largest accounts of a particular SPL Token type',
    parameters: [
      { name: 'pubkey', type: 'string', required: true, description: 'Pubkey of token Mint to query' },
      { name: 'commitment', type: 'string', required: false, description: 'The commitment level' }
    ],
    returns: 'Array of largest token holders',
    examples: ['Find top token holders', 'Analyze token distribution'],
    informationTypes: ['token-holders', 'token-distribution', 'whale-analysis'],
    category: 'token'
  },
  {
    name: 'getTokenSupply',
    type: 'solana-rpc',
    description: 'Returns the total supply of an SPL Token type',
    parameters: [
      { name: 'pubkey', type: 'string', required: true, description: 'Pubkey of token Mint to query' },
      { name: 'commitment', type: 'string', required: false, description: 'The commitment level' }
    ],
    returns: 'Total token supply with amount and UI amount',
    examples: ['Get token supply', 'Check total tokens minted'],
    informationTypes: ['token-supply', 'total-supply'],
    category: 'token'
  }
];

// OpenSVM API methods discovered from the codebase
export const OPENSVM_API_METHODS: APIMethod[] = [
  {
    name: 'walletPathFinding',
    type: 'opensvm-api',
    endpoint: '/api/wallet-path-finding',
    method: 'POST',
    description: 'Find path between wallets by tracking transfers using advanced graph traversal',
    parameters: [
      { name: 'sourceWallet', type: 'string', required: true, description: 'Source wallet address' },
      { name: 'targetWallet', type: 'string', required: true, description: 'Target wallet address' },
      { name: 'maxDepth', type: 'number', required: false, description: 'Maximum search depth (default: 42)' }
    ],
    returns: 'Streaming response with path finding progress and results',
    examples: ['Find connection between wallets', 'Track fund flows', 'Investigate wallet relationships'],
    informationTypes: ['wallet-relationships', 'fund-flows', 'transaction-paths'],
    category: 'analysis'
  },
  {
    name: 'analyzeTransaction',
    type: 'opensvm-api',
    endpoint: '/api/analyze-transaction',
    method: 'POST',
    description: 'AI-powered transaction analysis using LLM to explain transaction logs and purpose',
    parameters: [
      { name: 'logs', type: 'array', required: true, description: 'Transaction logs array' },
      { name: 'type', type: 'string', required: false, description: 'Transaction type' },
      { name: 'status', type: 'string', required: false, description: 'Transaction status' },
      { name: 'amount', type: 'number', required: false, description: 'Transaction amount' },
      { name: 'from', type: 'string', required: false, description: 'From address' },
      { name: 'to', type: 'string', required: false, description: 'To address' }
    ],
    returns: 'Natural language analysis of the transaction',
    examples: ['Explain complex transaction', 'Understand DeFi operations', 'Decode program interactions'],
    informationTypes: ['transaction-analysis', 'log-interpretation', 'transaction-purpose'],
    category: 'analysis'
  },
  {
    name: 'accountStats',
    type: 'opensvm-api',
    endpoint: '/api/account-stats',
    method: 'GET',
    description: 'Comprehensive account statistics and analytics',
    parameters: [
      { name: 'address', type: 'string', required: true, description: 'Account address to analyze' }
    ],
    returns: 'Detailed account statistics including transaction patterns',
    examples: ['Get account analytics', 'Analyze wallet behavior', 'Track account activity'],
    informationTypes: ['account-analytics', 'transaction-patterns', 'activity-metrics'],
    category: 'analytics'
  },
  {
    name: 'tokenStats',
    type: 'opensvm-api',
    endpoint: '/api/token-stats',
    method: 'GET',
    description: 'Token statistics and market data',
    parameters: [
      { name: 'mint', type: 'string', required: true, description: 'Token mint address' }
    ],
    returns: 'Token statistics including holder count, distribution, etc.',
    examples: ['Get token metrics', 'Analyze token distribution', 'Market data'],
    informationTypes: ['token-analytics', 'market-data', 'holder-statistics'],
    category: 'analytics'
  },
  {
    name: 'anomalyDetection',
    type: 'opensvm-api',
    endpoint: '/api/anomaly',
    method: 'GET',
    description: 'Detect anomalous patterns in accounts and transactions',
    parameters: [
      { name: 'type', type: 'string', required: false, description: 'Type of anomaly to detect' },
      { name: 'address', type: 'string', required: false, description: 'Specific address to analyze' }
    ],
    returns: 'Anomaly detection results and alerts',
    examples: ['Detect suspicious activity', 'Find unusual patterns', 'Security analysis'],
    informationTypes: ['anomaly-data', 'suspicious-activity', 'security-alerts'],
    category: 'security'
  },
  {
    name: 'programRegistry',
    type: 'opensvm-api',
    endpoint: '/api/program-registry',
    method: 'GET',
    description: 'Registry of known programs with metadata and analysis',
    parameters: [
      { name: 'programId', type: 'string', required: false, description: 'Specific program ID' }
    ],
    returns: 'Program metadata and usage statistics',
    examples: ['Identify program', 'Get program info', 'Analyze program usage'],
    informationTypes: ['program-metadata', 'program-usage', 'program-identification'],
    category: 'program'
  },
  {
    name: 'nftCollections',
    type: 'opensvm-api',
    endpoint: '/api/nft-collections',
    method: 'GET',
    description: 'NFT collection analysis and metadata',
    parameters: [
      { name: 'collection', type: 'string', required: false, description: 'Collection identifier' }
    ],
    returns: 'NFT collection data and statistics',
    examples: ['Analyze NFT collections', 'Get collection metadata', 'Track NFT activity'],
    informationTypes: ['nft-data', 'collection-metadata', 'nft-analytics'],
    category: 'nft'
  },
  {
    name: 'dexAnalytics',
    type: 'opensvm-api',
    endpoint: '/api/dex',
    method: 'GET',
    description: 'DEX trading analytics and liquidity data',
    parameters: [
      { name: 'pair', type: 'string', required: false, description: 'Trading pair' }
    ],
    returns: 'DEX analytics including volume, liquidity, and price data',
    examples: ['DEX trading analysis', 'Liquidity tracking', 'Price analytics'],
    informationTypes: ['dex-data', 'trading-analytics', 'liquidity-data'],
    category: 'defi'
  }
];

// Pre-defined information retrieval patterns
export const INFORMATION_PATTERNS: InformationPattern[] = [
  {
    name: 'comprehensive-wallet-analysis',
    description: 'Complete analysis of a wallet including balance, tokens, transaction history, and relationships',
    apiSequence: [
      { method: 'getAccountInfo', reason: 'Get basic account information and verify existence' },
      { method: 'getBalance', reason: 'Get SOL balance' },
      { method: 'getTokenAccountsByOwner', reason: 'Get all SPL token holdings' },
      { method: 'getSignaturesForAddress', reason: 'Get recent transaction history', input: 'limit=50' },
      { method: 'accountStats', reason: 'Get comprehensive analytics from OpenSVM' }
    ],
    dependencies: [],
    useCase: 'When user asks for complete wallet analysis or profile',
    examples: ['Analyze this wallet completely', 'Full wallet report', 'Comprehensive wallet overview']
  },
  {
    name: 'token-ecosystem-analysis',
    description: 'Analyze a token including supply, holders, distribution, and market data',
    apiSequence: [
      { method: 'getTokenSupply', reason: 'Get total token supply' },
      { method: 'getTokenLargestAccounts', reason: 'Get top holders' },
      { method: 'tokenStats', reason: 'Get detailed analytics from OpenSVM' }
    ],
    dependencies: [],
    useCase: 'When user wants to analyze a specific token',
    examples: ['Analyze this token', 'Token deep dive', 'Token distribution analysis']
  },
  {
    name: 'transaction-investigation',
    description: 'Deep dive into a specific transaction with AI analysis',
    apiSequence: [
      { method: 'getTransaction', reason: 'Get full transaction details' },
      { method: 'analyzeTransaction', reason: 'Get AI-powered analysis of the transaction' }
    ],
    dependencies: [],
    useCase: 'When user wants to understand a specific transaction',
    examples: ['Analyze this transaction', 'What happened in this tx?', 'Explain this transaction']
  },
  {
    name: 'network-health-analysis',
    description: 'Comprehensive network performance and health analysis',
    apiSequence: [
      { method: 'getEpochInfo', reason: 'Get current epoch information' },
      { method: 'getRecentPerformanceSamples', reason: 'Get TPS and performance data' },
      { method: 'getVoteAccounts', reason: 'Get validator status and stake distribution' }
    ],
    dependencies: [],
    useCase: 'When user asks about network status, TPS, or overall health',
    examples: ['How is the network performing?', 'Network status', 'Current TPS']
  },
  {
    name: 'wallet-relationship-mapping',
    description: 'Find and analyze relationships between wallets',
    apiSequence: [
      { method: 'walletPathFinding', reason: 'Find direct path between wallets' },
      { method: 'getSignaturesForAddress', reason: 'Get transaction history for source wallet' },
      { method: 'getSignaturesForAddress', reason: 'Get transaction history for target wallet' }
    ],
    dependencies: [],
    useCase: 'When user wants to find connections between wallets',
    examples: ['How are these wallets connected?', 'Find path between wallets', 'Wallet relationships']
  },
  {
    name: 'security-analysis',
    description: 'Security-focused analysis including anomaly detection',
    apiSequence: [
      { method: 'anomalyDetection', reason: 'Check for anomalous patterns' },
      { method: 'getSignaturesForAddress', reason: 'Get recent transaction activity' },
      { method: 'accountStats', reason: 'Get behavioral analytics' }
    ],
    dependencies: [],
    useCase: 'When user asks about suspicious activity or security concerns',
    examples: ['Is this wallet suspicious?', 'Security analysis', 'Detect anomalies']
  }
];

// All available API methods combined
export const ALL_API_METHODS = [...SOLANA_RPC_METHODS, ...OPENSVM_API_METHODS];

// Helper functions
export function findMethodsByInformationType(informationType: string): APIMethod[] {
  return ALL_API_METHODS.filter(method => 
    method.informationTypes.includes(informationType)
  );
}

export function findMethodsByCategory(category: string): APIMethod[] {
  return ALL_API_METHODS.filter(method => method.category === category);
}

export function getMethodByName(name: string): APIMethod | undefined {
  return ALL_API_METHODS.find(method => method.name === name);
}

export function findRelevantPatterns(query: string): InformationPattern[] {
  const queryLower = query.toLowerCase();
  return INFORMATION_PATTERNS.filter(pattern => 
    pattern.examples.some(example => 
      queryLower.includes(example.toLowerCase()) ||
      example.toLowerCase().includes(queryLower)
    ) ||
    queryLower.includes(pattern.name.toLowerCase()) ||
    queryLower.includes(pattern.description.toLowerCase())
  );
}
