/**
 * Token utilities for trading terminal
 * Provides dynamic token mint resolution and pool information
 */

// Solana mint addresses for common tokens
export const MINT_ADDRESSES: Record<string, string> = {
  'SOL': 'So11111111111111111111111111111111111111112',
  'BONK': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  'JUP': 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  'PYTH': 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
  'ORCA': 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
  'RAY': '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  'MNGO': 'MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac',
  'SRM': 'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt',
};

/**
 * Extract base token from market pair (e.g., "SOL/USDC" -> "SOL")
 */
export function getBaseToken(market: string): string {
  return market.split('/')[0];
}

/**
 * Get token mint address from market pair
 * @param market - Market pair like "SOL/USDC"
 * @returns Token mint address or null if not found
 */
export function getTokenMint(market: string): string | null {
  const baseToken = getBaseToken(market);
  return MINT_ADDRESSES[baseToken] || null;
}

/**
 * Fetch pool information for a token from Birdeye API
 * Returns the most liquid pool by default
 */
export async function fetchTokenPools(mint: string): Promise<any[]> {
  try {
    const response = await fetch(
      `/api/trading/pools?mint=${mint}&limit=5`
    );
    
    if (response.ok) {
      const data = await response.json();
      return data.pools || [];
    }
  } catch (error) {
    console.warn('Failed to fetch token pools:', error);
  }
  
  return [];
}

/**
 * Get the most liquid pool for a token
 */
export async function getMostLiquidPool(mint: string): Promise<string | null> {
  const pools = await fetchTokenPools(mint);
  
  if (pools.length > 0) {
    // Pools are already sorted by liquidity from the API
    return pools[0].address;
  }
  
  return null;
}
