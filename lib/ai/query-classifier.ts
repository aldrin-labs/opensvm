/**
 * Query Classification System
 * 
 * Categorizes user queries to determine optimal routing strategy.
 * Prevents simple queries from getting stuck in planning loops.
 */

export enum QueryType {
  DIRECT_RPC = 'direct_rpc',      // Network stats, TPS, epoch info
  KNOWLEDGE_BASED = 'knowledge',   // General questions about Solana/crypto
  COMPLEX_ANALYSIS = 'analysis',   // Account/transaction analysis
  PLAN_REQUIRED = 'plan'          // Multi-step operations
}

export interface ClassifiedQuery {
  type: QueryType;
  confidence: number;
  suggestedTools: string[];
  requiresPlan: boolean;
  directResponse?: boolean;
}

/**
 * Patterns for direct RPC queries that should bypass planning
 */
const DIRECT_RPC_PATTERNS = [
  // Network statistics
  /\b(?:tps|transactions?\s+per\s+second|throughput)\b/i,
  /\b(?:network\s+stats?|performance|speed)\b/i,
  /\b(?:epoch|slot|block\s+time|confirmation\s+time)\b/i,
  /\b(?:validator\s+count|node\s+count)\b/i,
  
  // Cluster information
  /\b(?:cluster\s+info|network\s+info|chain\s+info)\b/i,
  /\b(?:solana\s+version|rpc\s+version)\b/i,
  /\b(?:health\s+check|status)\b/i,
  
  // Simple balance queries
  /\b(?:balance|sol\s+balance)\s+of\b/i,
  /\bwhat(?:'s|\s+is)\s+the\s+balance\b/i,
  
  // Block information
  /\b(?:latest\s+block|current\s+block|block\s+height)\b/i,
  /\b(?:recent\s+blocks)\b/i
];

/**
 * Patterns for knowledge-based queries
 */
const KNOWLEDGE_PATTERNS = [
  // General Solana questions
  /\b(?:what\s+is\s+solana|about\s+solana)\b/i,
  /\b(?:how\s+does\s+solana\s+work|solana\s+works)\b/i,
  /\b(?:solana\s+features|why\s+solana)\b/i,
  
  // DeFi concepts
  /\b(?:what\s+is\s+defi|about\s+defi|defi\s+explained)\b/i,
  /\b(?:liquidity\s+pool|automated\s+market\s+maker|amm)\b/i,
  /\b(?:yield\s+farming|staking\s+rewards)\b/i,
  
  // NFT concepts
  /\b(?:what\s+are\s+nfts?|about\s+nfts?|nft\s+explained)\b/i,
  /\b(?:digital\s+collectibles|non.fungible\s+tokens?)\b/i,
  
  // General crypto
  /\b(?:what\s+is\s+(?:crypto|blockchain|web3))\b/i,
  /\b(?:how\s+(?:crypto|blockchain)\s+works?)\b/i
];

/**
 * Patterns for complex analysis requiring multiple tools
 */
const ANALYSIS_PATTERNS = [
  // Account analysis
  /\b(?:analyze|analysis|breakdown|detailed?\s+info)\s+(?:of\s+)?(?:account|address|wallet)\b/i,
  /\b(?:transaction\s+history|tx\s+history|activity)\s+(?:of|for)\b/i,
  /\b(?:portfolio|holdings|assets)\s+(?:of|for|in)\b/i,
  
  // Token analysis
  /\b(?:token\s+(?:analysis|info|details|stats))\b/i,
  /\b(?:price\s+(?:analysis|history|chart))\b/i,
  /\b(?:market\s+(?:data|analysis|stats))\b/i,
  
  // Transaction analysis
  /\b(?:transaction|tx)\s+(?:analysis|breakdown|details)\b/i,
  /\b(?:trace|investigate|examine)\s+(?:transaction|tx)\b/i,
  
  // Program analysis
  /\b(?:program\s+(?:analysis|audit|review))\b/i,
  /\b(?:smart\s+contract\s+(?:analysis|review))\b/i
];

/**
 * Classifies a user query to determine optimal routing
 */
export function classifyQuery(query: string): ClassifiedQuery {
  const normalizedQuery = query.toLowerCase().trim();
  
  // Check for direct RPC patterns
  for (const pattern of DIRECT_RPC_PATTERNS) {
    if (pattern.test(normalizedQuery)) {
      return {
        type: QueryType.DIRECT_RPC,
        confidence: 0.9,
        suggestedTools: ['networkStats', 'getBalance', 'getBlock'],
        requiresPlan: false,
        directResponse: true
      };
    }
  }
  
  // Check for knowledge-based patterns
  for (const pattern of KNOWLEDGE_PATTERNS) {
    if (pattern.test(normalizedQuery)) {
      return {
        type: QueryType.KNOWLEDGE_BASED,
        confidence: 0.85,
        suggestedTools: ['knowledgeBase', 'documentRetrieval'],
        requiresPlan: false,
        directResponse: true
      };
    }
  }
  
  // Check for complex analysis patterns
  for (const pattern of ANALYSIS_PATTERNS) {
    if (pattern.test(normalizedQuery)) {
      return {
        type: QueryType.COMPLEX_ANALYSIS,
        confidence: 0.8,
        suggestedTools: ['accountAnalysis', 'transactionAnalysis', 'tokenAnalysis'],
        requiresPlan: true,
        directResponse: false
      };
    }
  }
  
  // Check for specific addresses or signatures (likely analysis)
  const addressPattern = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/;
  const signaturePattern = /\b[1-9A-HJ-NP-Za-km-z]{87,88}\b/;
  
  if (addressPattern.test(query) || signaturePattern.test(query)) {
    return {
      type: QueryType.COMPLEX_ANALYSIS,
      confidence: 0.85,
      suggestedTools: ['accountAnalysis', 'transactionAnalysis'],
      requiresPlan: true,
      directResponse: false
    };
  }
  
  // Default to plan-required for unmatched queries
  return {
    type: QueryType.PLAN_REQUIRED,
    confidence: 0.6,
    suggestedTools: [],
    requiresPlan: true,
    directResponse: false
  };
}

/**
 * Determines if a query should bypass the planning system entirely
 */
export function shouldBypassPlanning(query: string): boolean {
  const classification = classifyQuery(query);
  return classification.directResponse === true;
}

/**
 * Gets suggested tools for a query without full classification
 */
export function getSuggestedTools(query: string): string[] {
  const classification = classifyQuery(query);
  return classification.suggestedTools;
}

/**
 * Validates if a query contains valid Solana addresses or signatures
 */
export function containsSolanaData(query: string): {
  hasAddress: boolean;
  hasSignature: boolean;
  addresses: string[];
  signatures: string[];
} {
  const addressPattern = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
  const signaturePattern = /\b[1-9A-HJ-NP-Za-km-z]{87,88}\b/g;
  
  const addresses = query.match(addressPattern) || [];
  const signatures = query.match(signaturePattern) || [];
  
  return {
    hasAddress: addresses.length > 0,
    hasSignature: signatures.length > 0,
    addresses,
    signatures
  };
}
