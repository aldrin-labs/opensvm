// Transaction filtering constants and utilities

export const MIN_TRANSFER_SOL = 0.01;
export const MAX_TRANSFER_COUNT = 1000;
export const AI_MODEL = 'gpt-4.1-mini';
export const AI_MAX_TOKENS = 50000;
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
export const TRANSACTION_BATCH_SIZE = 1000; // MAXIMUM batch size supported by Solana RPC
export const MAX_RETRIES = 3;
export const INITIAL_BACKOFF_MS = 10;
export const BATCH_DELAY_MS = 0;
export const MAX_SIGNATURES_LIMIT = 1000;
export const MIN_WALLET_ADDRESS_LENGTH = 32;

// Rate limiting constants - OpenSVM Business Plan: UNLIMITED/HIGH THROUGHPUT
export const MAX_RPS_LIMIT = 5000; // Target 2500+ TPS
export const MAX_CONCURRENT_BATCHES = 50; // 50 * 1000 = 50,000 transactions in flight
export const RATE_LIMIT_BUFFER = 0.8; // Use 80% of limit for safety margin
export const EFFECTIVE_MAX_RPS = Math.floor(MAX_RPS_LIMIT * RATE_LIMIT_BUFFER); // 240 RPS effective
