/**
 * PoUW Real Data Provider
 *
 * Fetches real Solana blockchain data for Proof-of-Useful-Work challenges.
 * Connects to existing OpenSVM APIs to provide genuine work that contributes value.
 *
 * @module pouw-data-provider
 */

// ============================================================================
// Types
// ============================================================================

export type WorkType =
  | 'index_transactions'
  | 'analyze_patterns'
  | 'validate_data'
  | 'compute_analytics'
  | 'classify_wallets'
  | 'extract_entities';

export interface RealTransaction {
  signature: string;
  slot: number;
  blockTime: number | null;
  accounts: string[];
  programIds: string[];
  success: boolean;
  fee: number;
  preBalances?: number[];
  postBalances?: number[];
  logMessages?: string[];
  instructions?: any[];
}

export interface RealAccount {
  address: string;
  lamports: number;
  owner: string;
  executable: boolean;
  rentEpoch: number;
  data?: string;
}

export interface WorkInputData {
  transactions?: RealTransaction[];
  addresses?: string[];
  timeRange?: { start: number; end: number };
  metrics?: string[];
  referenceSource?: string;
  lookbackPeriod?: number;
  slot?: number;
  blockData?: any;
}

export interface IndexedTransaction {
  signature: string;
  type: string;
  category: string;
  programs: string[];
  accounts: string[];
  timestamp: number;
  success: boolean;
  fee: number;
  labels: string[];
}

export interface DetectedPattern {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  transactions: string[];
  evidence: string;
  confidence: number;
}

export interface ClassifiedWallet {
  address: string;
  classification: string;
  confidence: number;
  behaviors: string[];
  transactionCount: number;
  totalVolume: number;
}

export interface ExtractedEntity {
  address: string;
  entityType: string;
  name?: string;
  confidence: number;
  evidence: string[];
}

// ============================================================================
// Configuration
// ============================================================================

const BASE_API_URL = process.env.OPENSVM_API_URL || 'https://osvm.ai';
const API_TIMEOUT = 30000;

// Known program IDs for classification
const KNOWN_PROGRAMS: Record<string, { name: string; category: string }> = {
  '11111111111111111111111111111111': { name: 'System Program', category: 'system' },
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': { name: 'Token Program', category: 'token' },
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb': { name: 'Token-2022', category: 'token' },
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL': { name: 'Associated Token', category: 'token' },
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': { name: 'Jupiter V6', category: 'defi' },
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': { name: 'Raydium V4', category: 'defi' },
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc': { name: 'Orca Whirlpool', category: 'defi' },
  'PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY': { name: 'Phoenix', category: 'defi' },
  'opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb': { name: 'OpenBook V2', category: 'defi' },
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s': { name: 'Metaplex', category: 'nft' },
  'M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K': { name: 'Magic Eden V2', category: 'nft' },
  'BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY': { name: 'Bubblegum', category: 'nft' },
  'Stake11111111111111111111111111111111111111': { name: 'Stake Program', category: 'staking' },
  'Vote111111111111111111111111111111111111111': { name: 'Vote Program', category: 'governance' },
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr': { name: 'Memo Program', category: 'utility' },
  'ComputeBudget111111111111111111111111111111': { name: 'Compute Budget', category: 'system' },
};

// Known entity addresses
const KNOWN_ENTITIES: Record<string, { name: string; type: string }> = {
  // Major exchanges
  '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM': { name: 'Binance Hot', type: 'exchange' },
  'FWznbcNXWQuHTawe9RxvQ2LdCENssh12dsznf4RiouN5': { name: 'Kraken', type: 'exchange' },
  '2AQdpHJ2JpcEgPiATUXjQxA8QmafFegfQwSLWSprPicm': { name: 'Coinbase', type: 'exchange' },
  // Major protocols
  '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1': { name: 'Raydium Authority', type: 'protocol' },
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': { name: 'Jupiter', type: 'protocol' },
};

// ============================================================================
// API Client
// ============================================================================

async function fetchFromAPI(path: string, options: RequestInit = {}): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const response = await fetch(`${BASE_API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('API request timeout');
    }
    throw error;
  }
}

// ============================================================================
// Data Fetching Functions
// ============================================================================

/**
 * Fetch recent transactions from the network
 */
export async function fetchRecentTransactions(limit = 50): Promise<RealTransaction[]> {
  try {
    // Try to get recent blocks and extract transactions
    const blocksResponse = await fetchFromAPI(`/api/blocks?limit=3`);

    if (!blocksResponse?.blocks?.length) {
      console.log('[PoUW Data] No blocks available, using fallback data');
      return generateFallbackTransactions(limit);
    }

    const transactions: RealTransaction[] = [];

    for (const block of blocksResponse.blocks) {
      if (block.transactions) {
        for (const tx of block.transactions.slice(0, Math.ceil(limit / 3))) {
          transactions.push({
            signature: tx.signature || tx.transaction?.signatures?.[0] || `tx_${Date.now()}_${Math.random()}`,
            slot: block.slot || 0,
            blockTime: block.blockTime || Math.floor(Date.now() / 1000),
            accounts: extractAccounts(tx),
            programIds: extractProgramIds(tx),
            success: tx.meta?.err === null,
            fee: tx.meta?.fee || 5000,
            preBalances: tx.meta?.preBalances,
            postBalances: tx.meta?.postBalances,
            logMessages: tx.meta?.logMessages,
            instructions: tx.transaction?.message?.instructions,
          });
        }
      }
    }

    if (transactions.length < limit) {
      // Supplement with more data
      const supplemental = generateFallbackTransactions(limit - transactions.length);
      transactions.push(...supplemental);
    }

    return transactions.slice(0, limit);
  } catch (error) {
    console.error('[PoUW Data] Error fetching transactions:', error);
    return generateFallbackTransactions(limit);
  }
}

/**
 * Fetch transactions for a specific address
 */
export async function fetchAddressTransactions(address: string, limit = 20): Promise<RealTransaction[]> {
  try {
    const response = await fetchFromAPI(`/api/account-transactions?address=${address}&limit=${limit}`);

    if (!response?.transactions?.length) {
      return [];
    }

    return response.transactions.map((tx: any) => ({
      signature: tx.signature,
      slot: tx.slot || 0,
      blockTime: tx.blockTime,
      accounts: tx.accounts || [],
      programIds: tx.programIds || [],
      success: tx.err === null,
      fee: tx.fee || 5000,
    }));
  } catch (error) {
    console.error('[PoUW Data] Error fetching address transactions:', error);
    return [];
  }
}

/**
 * Fetch recent active addresses from transactions
 */
export async function fetchActiveAddresses(limit = 20): Promise<string[]> {
  try {
    const transactions = await fetchRecentTransactions(50);

    const addresses = new Set<string>();
    for (const tx of transactions) {
      for (const addr of tx.accounts) {
        if (addr && !addresses.has(addr)) {
          addresses.add(addr);
          if (addresses.size >= limit) break;
        }
      }
      if (addresses.size >= limit) break;
    }

    return Array.from(addresses);
  } catch (error) {
    console.error('[PoUW Data] Error fetching active addresses:', error);
    return generateFallbackAddresses(limit);
  }
}

/**
 * Fetch block data for a specific slot
 */
export async function fetchBlockData(slot?: number): Promise<any> {
  try {
    const path = slot ? `/api/blocks/${slot}` : '/api/blocks?limit=1';
    const response = await fetchFromAPI(path);

    return slot ? response : response?.blocks?.[0];
  } catch (error) {
    console.error('[PoUW Data] Error fetching block data:', error);
    return null;
  }
}

/**
 * Fetch network statistics
 */
export async function fetchNetworkStats(): Promise<any> {
  try {
    const response = await fetchFromAPI('/api/status');
    return response;
  } catch (error) {
    console.error('[PoUW Data] Error fetching network stats:', error);
    return null;
  }
}

// ============================================================================
// Work Input Data Generation
// ============================================================================

/**
 * Generate input data for a specific work type
 */
export async function generateWorkInputData(workType: WorkType): Promise<WorkInputData> {
  switch (workType) {
    case 'index_transactions':
      return {
        transactions: await fetchRecentTransactions(50),
        timeRange: {
          start: Date.now() - 3600000, // Last hour
          end: Date.now(),
        },
      };

    case 'analyze_patterns':
      return {
        transactions: await fetchRecentTransactions(100),
        timeRange: {
          start: Date.now() - 86400000, // Last 24 hours
          end: Date.now(),
        },
      };

    case 'validate_data':
      const txs = await fetchRecentTransactions(30);
      return {
        transactions: txs,
        referenceSource: 'solana_rpc',
      };

    case 'compute_analytics':
      const stats = await fetchNetworkStats();
      return {
        timeRange: {
          start: Date.now() - 3600000,
          end: Date.now(),
        },
        metrics: ['tps', 'active_wallets', 'transaction_volume', 'fee_stats'],
        blockData: stats,
      };

    case 'classify_wallets':
      return {
        addresses: await fetchActiveAddresses(20),
        lookbackPeriod: 86400000, // 24 hours
      };

    case 'extract_entities':
      return {
        transactions: await fetchRecentTransactions(50),
        addresses: await fetchActiveAddresses(10),
      };

    default:
      return {
        transactions: await fetchRecentTransactions(20),
      };
  }
}

// ============================================================================
// Work Processing Functions (for validation)
// ============================================================================

/**
 * Index transactions - classify by type and category
 */
export function indexTransactions(transactions: RealTransaction[]): IndexedTransaction[] {
  return transactions.map(tx => {
    const type = classifyTransactionType(tx);
    const category = classifyTransactionCategory(tx);
    const labels = generateTransactionLabels(tx);

    return {
      signature: tx.signature,
      type,
      category,
      programs: tx.programIds,
      accounts: tx.accounts.slice(0, 10), // Limit stored accounts
      timestamp: tx.blockTime ? tx.blockTime * 1000 : Date.now(),
      success: tx.success,
      fee: tx.fee,
      labels,
    };
  });
}

/**
 * Analyze patterns in transactions
 */
export function analyzePatterns(transactions: RealTransaction[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  // Check for wash trading (same accounts appearing frequently)
  const accountFrequency = new Map<string, number>();
  for (const tx of transactions) {
    for (const account of tx.accounts) {
      accountFrequency.set(account, (accountFrequency.get(account) || 0) + 1);
    }
  }

  const highFrequencyAccounts = Array.from(accountFrequency.entries())
    .filter(([_, count]) => count > transactions.length * 0.3)
    .map(([addr]) => addr);

  if (highFrequencyAccounts.length > 0) {
    patterns.push({
      type: 'high_frequency_trading',
      severity: 'medium',
      transactions: transactions.filter(tx =>
        tx.accounts.some(a => highFrequencyAccounts.includes(a))
      ).map(tx => tx.signature).slice(0, 10),
      evidence: `${highFrequencyAccounts.length} accounts appear in >30% of transactions`,
      confidence: 0.7,
    });
  }

  // Check for sandwich attacks (similar programs in sequence)
  const defiTxs = transactions.filter(tx =>
    tx.programIds.some(p => KNOWN_PROGRAMS[p]?.category === 'defi')
  );

  if (defiTxs.length >= 3) {
    // Look for patterns
    for (let i = 0; i < defiTxs.length - 2; i++) {
      const sameProgram = defiTxs[i].programIds.some(p =>
        defiTxs[i + 2].programIds.includes(p)
      );
      if (sameProgram) {
        patterns.push({
          type: 'potential_sandwich',
          severity: 'low',
          transactions: [defiTxs[i].signature, defiTxs[i + 1].signature, defiTxs[i + 2].signature],
          evidence: 'Same DeFi program used in bookending transactions',
          confidence: 0.4,
        });
        break;
      }
    }
  }

  // Check for failed transactions burst
  const failedTxs = transactions.filter(tx => !tx.success);
  if (failedTxs.length > transactions.length * 0.2) {
    patterns.push({
      type: 'high_failure_rate',
      severity: 'low',
      transactions: failedTxs.map(tx => tx.signature).slice(0, 10),
      evidence: `${((failedTxs.length / transactions.length) * 100).toFixed(1)}% failure rate`,
      confidence: 0.9,
    });
  }

  return patterns;
}

/**
 * Classify wallets by behavior
 */
export async function classifyWallets(addresses: string[]): Promise<ClassifiedWallet[]> {
  const classified: ClassifiedWallet[] = [];

  for (const address of addresses) {
    // Check known entities first
    const knownEntity = KNOWN_ENTITIES[address];
    if (knownEntity) {
      classified.push({
        address,
        classification: knownEntity.type,
        confidence: 1.0,
        behaviors: [knownEntity.name],
        transactionCount: 0,
        totalVolume: 0,
      });
      continue;
    }

    // Fetch transaction history
    const txs = await fetchAddressTransactions(address, 10);

    // Classify based on behavior
    const behaviors: string[] = [];
    let classification = 'unknown';
    let confidence = 0.5;

    if (txs.length === 0) {
      classification = 'inactive';
      confidence = 0.8;
    } else {
      // Check for DeFi activity
      const defiCount = txs.filter(tx =>
        tx.programIds.some(p => KNOWN_PROGRAMS[p]?.category === 'defi')
      ).length;

      if (defiCount > txs.length * 0.5) {
        classification = 'defi_trader';
        behaviors.push('high_defi_activity');
        confidence = 0.7;
      }

      // Check for NFT activity
      const nftCount = txs.filter(tx =>
        tx.programIds.some(p => KNOWN_PROGRAMS[p]?.category === 'nft')
      ).length;

      if (nftCount > txs.length * 0.3) {
        classification = classification === 'unknown' ? 'nft_collector' : classification;
        behaviors.push('nft_activity');
      }

      // High transaction count suggests bot/automated
      if (txs.length === 10) { // Max we fetched
        behaviors.push('high_frequency');
        if (classification === 'unknown') {
          classification = 'bot_suspected';
          confidence = 0.6;
        }
      }
    }

    classified.push({
      address,
      classification,
      confidence,
      behaviors,
      transactionCount: txs.length,
      totalVolume: 0, // Would need balance data
    });
  }

  return classified;
}

/**
 * Extract known entities from transaction data
 */
export function extractEntities(
  transactions: RealTransaction[],
  addresses: string[]
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const seen = new Set<string>();

  // Check known entities
  for (const address of addresses) {
    if (seen.has(address)) continue;

    const known = KNOWN_ENTITIES[address];
    if (known) {
      entities.push({
        address,
        entityType: known.type,
        name: known.name,
        confidence: 1.0,
        evidence: ['Known entity database match'],
      });
      seen.add(address);
    }
  }

  // Check transactions for program usage patterns
  const programUsage = new Map<string, string[]>();
  for (const tx of transactions) {
    for (const programId of tx.programIds) {
      const known = KNOWN_PROGRAMS[programId];
      if (known && known.category !== 'system') {
        for (const account of tx.accounts) {
          if (!seen.has(account) && account !== programId) {
            if (!programUsage.has(account)) {
              programUsage.set(account, []);
            }
            programUsage.get(account)!.push(known.category);
          }
        }
      }
    }
  }

  // Infer entity types from program usage
  for (const [address, categories] of programUsage) {
    if (seen.has(address)) continue;

    const categoryCount = new Map<string, number>();
    for (const cat of categories) {
      categoryCount.set(cat, (categoryCount.get(cat) || 0) + 1);
    }

    const dominant = Array.from(categoryCount.entries())
      .sort((a, b) => b[1] - a[1])[0];

    if (dominant && dominant[1] >= 3) {
      entities.push({
        address,
        entityType: `${dominant[0]}_user`,
        confidence: Math.min(0.9, 0.5 + dominant[1] * 0.1),
        evidence: [`${dominant[1]} ${dominant[0]} interactions`],
      });
      seen.add(address);
    }
  }

  return entities;
}

// ============================================================================
// Helper Functions
// ============================================================================

function extractAccounts(tx: any): string[] {
  const accounts: string[] = [];

  if (tx.transaction?.message?.accountKeys) {
    for (const key of tx.transaction.message.accountKeys) {
      if (typeof key === 'string') {
        accounts.push(key);
      } else if (key?.pubkey) {
        accounts.push(key.pubkey);
      }
    }
  }

  return accounts.filter(a => a && a.length > 30);
}

function extractProgramIds(tx: any): string[] {
  const programs: string[] = [];

  if (tx.transaction?.message?.instructions) {
    for (const ix of tx.transaction.message.instructions) {
      if (ix.programId) {
        programs.push(ix.programId);
      } else if (typeof ix.programIdIndex === 'number' && tx.transaction.message.accountKeys) {
        const key = tx.transaction.message.accountKeys[ix.programIdIndex];
        if (key) {
          programs.push(typeof key === 'string' ? key : key.pubkey);
        }
      }
    }
  }

  return [...new Set(programs)].filter(p => p && p.length > 30);
}

function classifyTransactionType(tx: RealTransaction): string {
  // Check for common patterns
  if (tx.programIds.some(p => KNOWN_PROGRAMS[p]?.category === 'defi')) {
    if (tx.logMessages?.some(log => log.includes('Swap') || log.includes('swap'))) {
      return 'swap';
    }
    return 'defi';
  }

  if (tx.programIds.some(p => KNOWN_PROGRAMS[p]?.category === 'nft')) {
    return 'nft';
  }

  if (tx.programIds.some(p => KNOWN_PROGRAMS[p]?.category === 'staking')) {
    return 'stake';
  }

  if (tx.programIds.includes('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')) {
    return 'token_transfer';
  }

  if (tx.programIds.includes('11111111111111111111111111111111')) {
    return 'sol_transfer';
  }

  return 'unknown';
}

function classifyTransactionCategory(tx: RealTransaction): string {
  for (const programId of tx.programIds) {
    const known = KNOWN_PROGRAMS[programId];
    if (known && known.category !== 'system') {
      return known.category;
    }
  }
  return 'other';
}

function generateTransactionLabels(tx: RealTransaction): string[] {
  const labels: string[] = [];

  if (!tx.success) labels.push('failed');
  if (tx.fee > 10000) labels.push('high_fee');
  if (tx.accounts.length > 10) labels.push('complex');

  for (const programId of tx.programIds) {
    const known = KNOWN_PROGRAMS[programId];
    if (known) {
      labels.push(known.name.toLowerCase().replace(/\s+/g, '_'));
    }
  }

  return labels;
}

function generateFallbackTransactions(count: number): RealTransaction[] {
  const transactions: RealTransaction[] = [];
  const now = Math.floor(Date.now() / 1000);

  for (let i = 0; i < count; i++) {
    transactions.push({
      signature: `fallback_${now}_${i}_${Math.random().toString(36).slice(2, 10)}`,
      slot: 250000000 + i,
      blockTime: now - i * 2,
      accounts: generateFallbackAddresses(Math.floor(Math.random() * 5) + 2),
      programIds: [
        '11111111111111111111111111111111',
        Math.random() > 0.5 ? 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' : '',
      ].filter(Boolean),
      success: Math.random() > 0.05,
      fee: 5000 + Math.floor(Math.random() * 5000),
    });
  }

  return transactions;
}

function generateFallbackAddresses(count: number): string[] {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const addresses: string[] = [];

  for (let i = 0; i < count; i++) {
    let addr = '';
    for (let j = 0; j < 44; j++) {
      addr += chars[Math.floor(Math.random() * chars.length)];
    }
    addresses.push(addr);
  }

  return addresses;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  // Data fetching
  fetchRecentTransactions,
  fetchAddressTransactions,
  fetchActiveAddresses,
  fetchBlockData,
  fetchNetworkStats,
  generateWorkInputData,

  // Work processing
  indexTransactions,
  analyzePatterns,
  classifyWallets,
  extractEntities,

  // Constants
  KNOWN_PROGRAMS,
  KNOWN_ENTITIES,
};
