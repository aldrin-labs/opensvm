import { PublicKey } from '@solana/web3.js';

// Token mint addresses
export const TOKEN_MINTS = {
  // $SVMAI token mint address (pump.fun token)
  SVMAI: new PublicKey('Cpzvdx6pppc9TNArsGsqgShCsKC9NCCjA2gtzHvUpump'),
} as const;

// Token decimals
export const TOKEN_DECIMALS = {
  SVMAI: 6, // pump.fun tokens typically use 6 decimals
} as const;

// Decimal multipliers for precise calculations
export const TOKEN_MULTIPLIERS = {
  SVMAI: 1000000, // 10^6 for 6 decimals
} as const;

// Minimum burn amounts
export const MIN_BURN_AMOUNTS = {
  SVMAI: 1000,
} as const;

// Maximum burn amounts per single boost (users can boost multiple times)
export const MAX_BURN_AMOUNTS = {
  SVMAI: 69000, // 69k SVMAI maximum per single boost
} as const;