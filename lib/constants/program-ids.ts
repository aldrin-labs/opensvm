/**
 * Known Solana Program IDs for DEX and DeFi protocols
 * Centralized mapping to avoid duplication across codebase
 */

export const KNOWN_PROGRAM_IDS = {
  // Pump.fun protocol
  pumpswap: ['6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'],
  
  // Meteora protocol  
  meteora: ['METAewgxyPbgwsseH8T16a39CQ5VyVxZi9zXiDPY18m'],
  
  // Bonk.fun protocol
  bonkfun: ['BonkfunjxcXSo3Nvvv8YKxVy1jqhfNyVSKngkHa8EgD'],
  
  // Solend
  solend: ['So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo'],
  
  // System Program
  system: ['11111111111111111111111111111112'],
  
  // SPL Token Program
  spl_token: ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'],
  
  // Serum DEX
  serum: ['9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'],
  
  // Raydium AMM
  raydium: ['675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8']
} as const;

export type KnownProtocol = keyof typeof KNOWN_PROGRAM_IDS;

/**
 * Get program IDs for a specific protocol
 */
export function getProgramIds(protocol: KnownProtocol): readonly string[] {
  return KNOWN_PROGRAM_IDS[protocol] || [];
}

/**
 * Get all known program IDs
 */
export function getAllKnownProgramIds(): string[] {
  const result: string[] = [];
  for (const key in KNOWN_PROGRAM_IDS) {
    const ids = KNOWN_PROGRAM_IDS[key as KnownProtocol];
    result.push(...ids);
  }
  return result;
}

/**
 * Check if a program ID belongs to a known protocol
 */
export function getProtocolFromProgramId(programId: string): KnownProtocol | null {
  for (const key in KNOWN_PROGRAM_IDS) {
    const protocol = key as KnownProtocol;
    const ids = KNOWN_PROGRAM_IDS[protocol];
    for (let i = 0; i < ids.length; i++) {
      if (ids[i] === programId) {
        return protocol;
      }
    }
  }
  return null;
}

/**
 * Get display name for a protocol
 */
export function getProtocolDisplayName(protocol: KnownProtocol): string {
  const displayNames: Record<KnownProtocol, string> = {
    pumpswap: 'Pump.fun',
    meteora: 'Meteora',
    bonkfun: 'Bonk.fun',
    solend: 'Solend',
    system: 'System Program',
    spl_token: 'SPL Token',
    serum: 'Serum DEX',
    raydium: 'Raydium'
  };
  
  return displayNames[protocol] || protocol;
}