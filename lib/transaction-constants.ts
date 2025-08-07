// Transaction filtering constants and utilities

export const MIN_TRANSFER_SOL = 0.01;
export const MAX_TRANSFER_COUNT = 10;
export const AI_MODEL = 'gpt-4o-mini';
export const AI_MAX_TOKENS = 500;
export const AI_TEMPERATURE = 0.1;

export const SPAM_TOKEN_KEYWORDS = [
  'SPAM', 'TEST', 'SCAM', 'FAKE', 'BOT', 'AIRDROP', 'FREE',
  'PONZI', 'PYRAMID', 'DOUBLER', 'MOON', 'PUMP', 'DUMP'
];

// Known spam addresses (example list)
const SPAM_ADDRESSES = new Set([
  '11111111111111111111111111111111', // System program
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Token program
]);

// Known DEX and trading addresses (example list)
const DEX_ADDRESSES = new Set([
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter
  '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP', // Orca
  'EhpADApTihyCdwMHxTJK5PQDtaPTLEq3c9UQJcLx2rj3', // Raydium
]);

export function isSpamAddress(address: string): boolean {
  return SPAM_ADDRESSES.has(address);
}

export function isSpamToken(tokenSymbol: string): boolean {
  if (!tokenSymbol) return true;
  const upperSymbol = tokenSymbol.toUpperCase();
  return SPAM_TOKEN_KEYWORDS.some(keyword => upperSymbol.includes(keyword));
}

export function isDexLikeAddress(address: string): boolean {
  return DEX_ADDRESSES.has(address);
}

export function isAboveDustThreshold(amount: number, threshold: number): boolean {
  return amount >= threshold;
}
// Transaction batch and retry constants for account transfer API
export const TRANSACTION_BATCH_SIZE = 100;
export const MAX_RETRIES = 5;
export const INITIAL_BACKOFF_MS = 500;
export const BATCH_DELAY_MS = 200;
export const MAX_SIGNATURES_LIMIT = 1000;
export const MIN_WALLET_ADDRESS_LENGTH = 32;