/**
 * Shared constants for transaction filtering and processing
 */

// Minimum transaction amounts to avoid dust
export const MIN_DUST_SOL = 0.001;
export const MIN_TRANSFER_SOL = 0.01;

// Processing limits and batch sizes
export const MAX_TRANSFER_COUNT = 10;
export const TRANSACTION_BATCH_SIZE = 10;
export const MAX_SIGNATURES_LIMIT = 50;

// Retry and backoff settings
export const MAX_RETRIES = 3;
export const INITIAL_BACKOFF_MS = 1000;
export const BATCH_DELAY_MS = 100;

// Known spam/analytics addresses to filter out
export const SPAM_ADDRESSES = new Set([
  // Flipside/analytics addresses
  'FetTyW8xAYfd33x4GMHoE7hTuEdWLj1fNnhJuyVMUGGa',
  'WaLLeTaS7qTaSnKFTYJNGAeu7VzoLMUV9QCMfKxFsgt', 
  'RecipienTEKQQQQQQQQQQQQQQQQQQQQQQQQQQFrThs',
  'ComputeBudget111111111111111111111111111111',
  // System and token programs
  '11111111111111111111111111111112', // System program
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Token program
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', // Associated Token program
  // Other known spam/bot addresses
  'SysvarRent111111111111111111111111111111111',
  'SysvarC1ock11111111111111111111111111111111',
  'Sysvar1nstructions1111111111111111111111111'
]);

// Known spam/analytics tokens to filter out
export const SPAM_TOKENS = new Set([
  'FLiP', 'FLIP', 'flipside',
  'Bot', 'BOT', 'SPAM', 'DUST',
  'Airdrop', 'AIRDROP', 'FREE',
  'Test', 'TEST', 'DEMO',
  'Analytics', 'ANALYTICS'
]);

// Spam token keywords for substring matching
export const SPAM_TOKEN_KEYWORDS = [
  'flip', 'bot', 'spam', 'dust', 
  'airdrop', 'free', 'test', 'demo',
  'analytics', 'flipside'
];

// OpenAI model configuration
export const AI_MODEL = 'gpt-4o-mini'; // Use available model instead of non-existent gpt-4.1-nano
export const AI_MAX_TOKENS = 32000;
export const AI_TEMPERATURE = 0.1;

// Validation constants
export const MIN_WALLET_ADDRESS_LENGTH = 32;
export const SOLANA_SIGNATURE_LENGTH = 88;

/**
 * Check if an address is spam/analytics related
 */
export function isSpamAddress(address: string): boolean {
  return SPAM_ADDRESSES.has(address);
}

/**
 * Check if a token symbol is spam related
 */
export function isSpamToken(tokenSymbol: string): boolean {
  if (!tokenSymbol) return false;
  
  const lowerSymbol = tokenSymbol.toLowerCase();
  
  // Check exact matches
  if (SPAM_TOKENS.has(tokenSymbol)) return true;
  
  // Check keyword matches
  return SPAM_TOKEN_KEYWORDS.some(keyword => lowerSymbol.includes(keyword));
}

/**
 * Check if an address looks like a DEX/program address
 */
export function isDexLikeAddress(address: string): boolean {
  if (!address) return true;
  
  return address.length < MIN_WALLET_ADDRESS_LENGTH || 
         address.includes('Program') || 
         address.includes('111111111'); // System programs
}

/**
 * Check if transfer amount is above dust threshold
 */
export function isAboveDustThreshold(amount: number, minThreshold = MIN_DUST_SOL): boolean {
  return amount >= minThreshold;
}