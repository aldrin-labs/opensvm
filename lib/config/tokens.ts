import { PublicKey } from '@solana/web3.js';

// Token mint addresses
export const TOKEN_MINTS = {
  // TODO: Replace with actual $SVMAI token mint address
  SVMAI: new PublicKey('11111111111111111111111111111112'), // Placeholder - update with real mint
} as const;

// Token decimals
export const TOKEN_DECIMALS = {
  SVMAI: 9, // Most SPL tokens use 9 decimals
} as const;

// Minimum burn amounts
export const MIN_BURN_AMOUNTS = {
  SVMAI: 1000,
} as const;