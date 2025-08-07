/**
 * Multi-chain blockchain integration types and interfaces
 * 
 * This module defines the core types and interfaces for supporting
 * multiple blockchain networks in OpenSVM.
 */

// Supported blockchain networks
export type ChainId = 'solana' | 'ethereum' | 'bitcoin' | 'polygon';

export const CHAIN_INFO = {
  solana: {
    id: 'solana' as ChainId,
    name: 'Solana',
    symbol: 'SOL',
    decimals: 9,
    rpcUrls: ['https://api.mainnet-beta.solana.com'],
    explorerUrl: 'https://explorer.solana.com',
    color: '#9945FF',
    icon: '/chains/solana.svg'
  },
  ethereum: {
    id: 'ethereum' as ChainId,
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
    rpcUrls: ['https://eth-mainnet.g.alchemy.com/v2/', 'https://mainnet.infura.io/v3/'],
    explorerUrl: 'https://etherscan.io',
    color: '#627EEA',
    icon: '/chains/ethereum.svg'
  },
  bitcoin: {
    id: 'bitcoin' as ChainId,
    name: 'Bitcoin',
    symbol: 'BTC',
    decimals: 8,
    rpcUrls: ['https://bitcoin-mainnet.s.chainbase.online/v1/', 'https://blockstream.info/api/'],
    explorerUrl: 'https://blockstream.info',
    color: '#F7931A',
    icon: '/chains/bitcoin.svg'
  },
  polygon: {
    id: 'polygon' as ChainId,
    name: 'Polygon',
    symbol: 'MATIC',
    decimals: 18,
    rpcUrls: ['https://polygon-rpc.com/', 'https://rpc-mainnet.matic.network'],
    explorerUrl: 'https://polygonscan.com',
    color: '#8247E5',
    icon: '/chains/polygon.svg'
  }
} as const;

// Unified transaction interface for all chains
export interface UnifiedTransaction {
  // Core transaction data
  id: string; // Transaction hash/signature
  chainId: ChainId;
  blockNumber: number | null;
  blockHash: string | null;
  timestamp: number;
  status: 'success' | 'failed' | 'pending';
  
  // Transaction details
  from: string;
  to: string | null;
  value: string; // Amount in wei/lamports/satoshi
  fee: string; // Transaction fee in native token
  gasUsed?: number; // For EVM chains
  gasPrice?: string; // For EVM chains
  
  // Token transfers
  tokenTransfers: TokenTransfer[];
  
  // DeFi interactions
  defiInteractions: DeFiInteraction[];
  
  // MEV data
  mevData?: MEVData;
  
  // Risk scoring
  riskScore?: number;
  riskFactors?: string[];
  
  // Analytics
  analytics?: TransactionAnalytics;
  
  // Raw transaction data (chain-specific)
  raw: any;
}

export interface TokenTransfer {
  tokenAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  from: string;
  to: string;
  amount: string; // Raw amount
  usdValue?: number;
  logIndex?: number; // For EVM chains
}

export interface DeFiInteraction {
  protocol: string;
  type: 'swap' | 'lending' | 'borrowing' | 'staking' | 'farming' | 'governance';
  tokenIn?: {
    address: string;
    symbol: string;
    amount: string;
  };
  tokenOut?: {
    address: string;
    symbol: string;
    amount: string;
  };
  poolAddress?: string;
  apr?: number;
  metadata: Record<string, any>;
}

export interface MEVData {
  type: 'arbitrage' | 'frontrun' | 'backrun' | 'sandwich' | 'liquidation';
  profit: string; // Profit in USD
  bundlePosition?: number;
  relatedTransactions?: string[];
  strategy?: string;
}

export interface TransactionAnalytics {
  category: 'transfer' | 'defi' | 'nft' | 'contract' | 'bridge' | 'unknown';
  complexity: 'simple' | 'medium' | 'complex';
  patterns: string[];
  anomalyScore?: number;
  labels: string[];
}

// Unified account/wallet interface
export interface UnifiedAccount {
  address: string;
  chainId: ChainId;
  balance: string; // Native token balance
  tokenBalances: TokenBalance[];
  transactionCount: number;
  firstSeen: number;
  lastSeen: number;
  labels: string[];
  riskScore?: number;
  type: 'eoa' | 'contract' | 'multisig' | 'unknown';
  
  // Analytics
  analytics: AccountAnalytics;
  
  // Cross-chain relationships
  relatedAddresses: RelatedAddress[];
}

export interface TokenBalance {
  tokenAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  usdValue?: number;
}

export interface AccountAnalytics {
  totalValueUsd: number;
  transactionVolume: number;
  avgTransactionSize: number;
  activeProtocols: string[];
  behaviorPattern: 'trader' | 'hodler' | 'defi_user' | 'bot' | 'bridge' | 'unknown';
  riskFlags: string[];
}

export interface RelatedAddress {
  address: string;
  chainId: ChainId;
  relationship: 'same_owner' | 'frequent_interaction' | 'bridge_pair' | 'similar_pattern';
  confidence: number; // 0-1
  evidence: string[];
}

// Unified block interface
export interface UnifiedBlock {
  chainId: ChainId;
  blockNumber: number;
  blockHash: string;
  parentHash: string;
  timestamp: number;
  transactionCount: number;
  gasUsed?: string; // For EVM chains
  gasLimit?: string; // For EVM chains
  miner?: string; // For PoW chains
  difficulty?: string; // For PoW chains
  size: number; // Block size in bytes
  
  // Analytics
  totalValueTransferred: string;
  totalFees: string;
  avgGasPrice?: string; // For EVM chains
  mevRevenue?: string;
  
  // Transactions
  transactions: string[]; // Transaction hashes
}

// Price data interface
export interface PriceData {
  tokenAddress: string;
  chainId: ChainId;
  symbol: string;
  price: number; // USD price
  change24h: number;
  volume24h: number;
  marketCap: number;
  timestamp: number;
  source: string; // DEX/CEX name
}

// Liquidity data interface
export interface LiquidityData {
  poolAddress: string;
  chainId: ChainId;
  protocol: string;
  token0: {
    address: string;
    symbol: string;
    reserve: string;
  };
  token1: {
    address: string;
    symbol: string;
    reserve: string;
  };
  totalValueLocked: number; // USD
  volume24h: number; // USD
  fees24h: number; // USD
  apr: number;
  timestamp: number;
}

// Cross-chain bridge data
export interface BridgeTransaction {
  sourceChainId: ChainId;
  targetChainId: ChainId;
  sourceTxHash: string;
  targetTxHash?: string;
  protocol: string;
  from: string;
  to: string;
  token: {
    sourceAddress: string;
    targetAddress: string;
    symbol: string;
    amount: string;
  };
  status: 'pending' | 'completed' | 'failed';
  timestamp: number;
  fees: {
    bridgeFee: string;
    gasFees: {
      source: string;
      target?: string;
    };
  };
}

// Flash loan data
export interface FlashLoan {
  chainId: ChainId;
  txHash: string;
  protocol: string;
  borrower: string;
  assets: {
    token: string;
    amount: string;
    fee: string;
  }[];
  profit?: string;
  strategy?: string;
  timestamp: number;
}

// Governance data
export interface GovernanceProposal {
  chainId: ChainId;
  protocol: string;
  proposalId: string;
  title: string;
  description: string;
  proposer: string;
  status: 'pending' | 'active' | 'executed' | 'defeated' | 'cancelled';
  votesFor: string;
  votesAgainst: string;
  totalVotes: string;
  startBlock: number;
  endBlock: number;
  executionBlock?: number;
  timestamp: number;
}

// AML/Compliance data
export interface ComplianceData {
  address: string;
  chainId: ChainId;
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  flags: ComplianceFlag[];
  sanctioned: boolean;
  sanctionSource?: string;
  lastUpdated: number;
}

export interface ComplianceFlag {
  type: 'mixer' | 'darknet' | 'exchange' | 'gambling' | 'scam' | 'phishing' | 'ransomware';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  source: string;
  timestamp: number;
}

// Analytics interfaces for ML-powered insights
export interface PatternRecognition {
  transactionHash: string;
  chainId: ChainId;
  patterns: {
    type: string;
    confidence: number;
    description: string;
    metadata: Record<string, any>;
  }[];
  anomalyScore: number;
  timestamp: number;
}

export interface ArbitrageOpportunity {
  id: string;
  sourceChain: ChainId;
  targetChain: ChainId;
  token: string;
  sourcePrice: number;
  targetPrice: number;
  priceDifference: number; // Percentage
  potentialProfit: number; // USD
  gasCosts: {
    source: number;
    target: number;
  };
  netProfit: number; // USD after gas costs
  confidence: number; // 0-1
  timestamp: number;
  expiresAt: number;
}

// Export utility types
export type ChainConfig = typeof CHAIN_INFO[keyof typeof CHAIN_INFO];
export type SupportedChains = keyof typeof CHAIN_INFO;