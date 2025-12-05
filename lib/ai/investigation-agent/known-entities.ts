/**
 * Known Entity Labels Database
 *
 * Maps Solana addresses to known entities for context-rich insights.
 * Categories: exchanges, DEXes, bridges, protocols, known scammers, whales
 */

export type EntityCategory =
  | 'exchange'
  | 'dex'
  | 'bridge'
  | 'protocol'
  | 'nft_marketplace'
  | 'staking'
  | 'lending'
  | 'oracle'
  | 'wallet_provider'
  | 'known_scammer'
  | 'known_whale'
  | 'team_wallet'
  | 'treasury'
  | 'burn_address'
  | 'mixer';

export interface KnownEntity {
  address: string;
  name: string;
  category: EntityCategory;
  description?: string;
  risk?: 'safe' | 'neutral' | 'caution' | 'dangerous';
  tags?: string[];
}

/**
 * Known Solana addresses database
 * This is a subset - in production, this would be fetched from an API
 */
export const KNOWN_ENTITIES: KnownEntity[] = [
  // Major Exchanges
  { address: 'FWznbcNXWQuHTawe9RxvQ2LdCENssh12dsznf4RiouN5', name: 'Kraken', category: 'exchange', risk: 'safe' },
  { address: '2AQdpHJ2JpcEgPiATUXjQxA8QmafFegfQwSLWSprPicm', name: 'Coinbase', category: 'exchange', risk: 'safe' },
  { address: '5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9', name: 'Binance Hot Wallet', category: 'exchange', risk: 'safe' },
  { address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', name: 'Binance Cold', category: 'exchange', risk: 'safe' },
  { address: 'H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS', name: 'FTX (Defunct)', category: 'exchange', risk: 'caution', description: 'Defunct exchange - funds may be frozen' },
  { address: 'ASTyfSima4LLAdDgoFGkgqoKowG1LZFDr9fAQrg7iaJZ', name: 'OKX', category: 'exchange', risk: 'safe' },
  { address: 'GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE', name: 'Bybit', category: 'exchange', risk: 'safe' },

  // DEXes
  { address: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', name: 'Jupiter Aggregator', category: 'dex', risk: 'safe', tags: ['aggregator'] },
  { address: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', name: 'Orca Whirlpool', category: 'dex', risk: 'safe' },
  { address: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', name: 'Raydium AMM', category: 'dex', risk: 'safe' },
  { address: 'srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX', name: 'Serum/OpenBook', category: 'dex', risk: 'safe' },
  { address: 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK', name: 'Raydium CLMM', category: 'dex', risk: 'safe' },
  { address: 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo', name: 'Meteora DLMM', category: 'dex', risk: 'safe' },
  { address: 'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB', name: 'Meteora Pools', category: 'dex', risk: 'safe' },

  // Bridges
  { address: 'wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb', name: 'Wormhole', category: 'bridge', risk: 'safe', tags: ['cross-chain'] },
  { address: 'WnFt12ZrnzZrFZkt2xsNsaNWoQribnuQ5B5FrDbwDhD', name: 'Portal Bridge', category: 'bridge', risk: 'safe' },
  { address: 'DTYuh7gAGGZg2okM7hdFfU1yMY9LUemCiPyD5Z5GCs6Z', name: 'Allbridge', category: 'bridge', risk: 'safe' },

  // Lending/DeFi Protocols
  { address: 'So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo', name: 'Solend', category: 'lending', risk: 'safe' },
  { address: 'MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA', name: 'Marginfi', category: 'lending', risk: 'safe' },
  { address: 'KLend2g3cP87ber41GS9NTP2xTkjdMJZ1VgYiDsco5', name: 'Kamino Lend', category: 'lending', risk: 'safe' },
  { address: 'DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1', name: 'Drift Protocol', category: 'protocol', risk: 'safe', tags: ['perps'] },

  // NFT Marketplaces
  { address: 'M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K', name: 'Magic Eden', category: 'nft_marketplace', risk: 'safe' },
  { address: 'TSWAPaqyCSx2KABk68Shruf4rp7CxcNi8hAsbdwmHbN', name: 'Tensor', category: 'nft_marketplace', risk: 'safe' },

  // Staking
  { address: 'Stake11111111111111111111111111111111111111', name: 'Native Staking', category: 'staking', risk: 'safe' },
  { address: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', name: 'Marinade (mSOL)', category: 'staking', risk: 'safe' },
  { address: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', name: 'Jito (JitoSOL)', category: 'staking', risk: 'safe' },
  { address: 'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1', name: 'BlazeStake (bSOL)', category: 'staking', risk: 'safe' },

  // Oracles
  { address: 'FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH', name: 'Pyth Network', category: 'oracle', risk: 'safe' },
  { address: 'SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f', name: 'Switchboard', category: 'oracle', risk: 'safe' },

  // System Programs
  { address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', name: 'Token Program', category: 'protocol', risk: 'safe' },
  { address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', name: 'Associated Token', category: 'protocol', risk: 'safe' },
  { address: '11111111111111111111111111111111', name: 'System Program', category: 'protocol', risk: 'safe' },
  { address: 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s', name: 'Metaplex', category: 'protocol', risk: 'safe' },
  { address: 'ComputeBudget111111111111111111111111111111', name: 'Compute Budget', category: 'protocol', risk: 'safe' },

  // Known Mixers/Tumblers (DANGEROUS)
  { address: 'TornadoCash0000000000000000000000000000000', name: 'Tornado Cash Clone', category: 'mixer', risk: 'dangerous', description: 'Mixing service - funds may be from illicit sources' },

  // Burn Addresses
  { address: '1nc1nerator11111111111111111111111111111111', name: 'Burn Address', category: 'burn_address', risk: 'safe' },

  // Known Scam Addresses (examples - would be from API in production)
  { address: 'ScamWa11et000000000000000000000000000000001', name: 'Known Scam Wallet', category: 'known_scammer', risk: 'dangerous', description: 'Associated with multiple rug pulls' },

  // Famous Whales
  { address: 'mv3ekLzLbnVPNxjSKvqBpU3ZeZXPQdEC3bp5MDEBG68', name: 'Jump Trading', category: 'known_whale', risk: 'neutral', tags: ['market_maker'] },
  { address: 'CuieVDEDtLo7FypA9SbLM9saXFdb1dsshEkyErMqkRQq', name: 'Alameda Research', category: 'known_whale', risk: 'caution', description: 'Defunct - associated with FTX collapse' },
];

// Index by address for fast lookups
const entityIndex = new Map<string, KnownEntity>();
for (const entity of KNOWN_ENTITIES) {
  entityIndex.set(entity.address, entity);
}

/**
 * Look up an entity by address
 */
export function lookupEntity(address: string): KnownEntity | null {
  return entityIndex.get(address) || null;
}

/**
 * Check if address is a known exchange
 */
export function isExchange(address: string): boolean {
  const entity = entityIndex.get(address);
  return entity?.category === 'exchange';
}

/**
 * Check if address is a known DEX
 */
export function isDEX(address: string): boolean {
  const entity = entityIndex.get(address);
  return entity?.category === 'dex';
}

/**
 * Check if address is dangerous (scammer, mixer)
 */
export function isDangerous(address: string): boolean {
  const entity = entityIndex.get(address);
  return entity?.risk === 'dangerous';
}

/**
 * Get human-readable label for an address
 */
export function getEntityLabel(address: string): string | null {
  const entity = entityIndex.get(address);
  if (!entity) return null;

  const riskBadge = entity.risk === 'dangerous' ? ' [DANGEROUS]' :
                    entity.risk === 'caution' ? ' [CAUTION]' : '';
  return `${entity.name}${riskBadge}`;
}

/**
 * Describe an entity for narration
 */
export function describeEntity(address: string): string | null {
  const entity = entityIndex.get(address);
  if (!entity) return null;

  const parts = [entity.name];

  switch (entity.category) {
    case 'exchange':
      parts.push('(centralized exchange)');
      break;
    case 'dex':
      parts.push('(decentralized exchange)');
      break;
    case 'bridge':
      parts.push('(cross-chain bridge)');
      break;
    case 'mixer':
      parts.push('(MIXING SERVICE - HIGH RISK)');
      break;
    case 'known_scammer':
      parts.push('(KNOWN SCAMMER - DANGER)');
      break;
    case 'lending':
      parts.push('(lending protocol)');
      break;
    case 'staking':
      parts.push('(staking protocol)');
      break;
  }

  if (entity.description) {
    parts.push(`- ${entity.description}`);
  }

  return parts.join(' ');
}

/**
 * Analyze counterparty relationships
 */
export function analyzeCounterparties(addresses: string[]): {
  exchanges: string[];
  dexes: string[];
  dangerous: string[];
  unknown: string[];
  summary: string;
} {
  const exchanges: string[] = [];
  const dexes: string[] = [];
  const dangerous: string[] = [];
  const unknown: string[] = [];

  for (const addr of addresses) {
    const entity = entityIndex.get(addr);
    if (!entity) {
      unknown.push(addr);
    } else if (entity.category === 'exchange') {
      exchanges.push(entity.name);
    } else if (entity.category === 'dex') {
      dexes.push(entity.name);
    } else if (entity.risk === 'dangerous') {
      dangerous.push(entity.name);
    }
  }

  const parts: string[] = [];
  if (exchanges.length > 0) {
    parts.push(`Exchanges: ${[...new Set(exchanges)].join(', ')}`);
  }
  if (dexes.length > 0) {
    parts.push(`DEXes: ${[...new Set(dexes)].join(', ')}`);
  }
  if (dangerous.length > 0) {
    parts.push(`DANGEROUS: ${dangerous.join(', ')}`);
  }
  if (unknown.length > addresses.length * 0.8) {
    parts.push(`${unknown.length} unknown wallets`);
  }

  return {
    exchanges,
    dexes,
    dangerous,
    unknown,
    summary: parts.join('. ') || 'No known entities identified',
  };
}
