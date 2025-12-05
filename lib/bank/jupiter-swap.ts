/**
 * Jupiter DEX Aggregator Integration for SVM Bank
 * Provides swap functionality for DCA and automated trading
 */

import {
  Connection,
  PublicKey,
  VersionedTransaction,
  Keypair,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';

// Jupiter API endpoints
const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6/quote';
const JUPITER_SWAP_API = 'https://quote-api.jup.ag/v6/swap';
const JUPITER_PRICE_API = 'https://price.jup.ag/v6/price';
const JUPITER_TOKENS_API = 'https://token.jup.ag/all';

// Common token mints
export const COMMON_TOKENS = {
  SOL: 'So11111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  JUP: 'JUPyiWrYvFmk5uBTwu1kggV38pSakeUtp8rK',
  BONK: 'DezXAZ8z7PnyWe8fgJHR2A2fTQHYPT7YdN3rG',
  WIF: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  PYTH: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
  RAY: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  ORCA: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
  MSOL: 'mSoLzYCxHdYgdzU16g5QSh3iRYKsLFqvu4',
  JITOSOL: 'J1toso1uCk8GZcmGqWXsLtfD9LsJWiZA8L'
} as const;

export interface QuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee: null | { amount: string; feeBps: number };
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
}

export interface SwapResult {
  success: boolean;
  signature?: string;
  inputAmount: number;
  outputAmount: number;
  inputMint: string;
  outputMint: string;
  priceImpact: number;
  error?: string;
}

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
}

// Cache for token list
let tokenListCache: Map<string, TokenInfo> | null = null;
let tokenListCacheTime = 0;
const TOKEN_CACHE_TTL = 3600000; // 1 hour

/**
 * Get Solana connection
 */
function getConnection(): Connection {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
                 process.env.SOLANA_RPC_URL ||
                 'https://api.mainnet-beta.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

/**
 * Fetch and cache Jupiter token list
 */
export async function getTokenList(): Promise<Map<string, TokenInfo>> {
  const now = Date.now();

  if (tokenListCache && now - tokenListCacheTime < TOKEN_CACHE_TTL) {
    return tokenListCache;
  }

  try {
    const response = await fetch(JUPITER_TOKENS_API, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error('Failed to fetch token list');
    }

    const tokens: TokenInfo[] = await response.json();
    tokenListCache = new Map(tokens.map(t => [t.address, t]));
    tokenListCacheTime = now;

    return tokenListCache;
  } catch (error) {
    console.error('Failed to fetch token list:', error);
    // Return cached or empty
    return tokenListCache || new Map();
  }
}

/**
 * Get token info by mint address
 */
export async function getTokenInfo(mint: string): Promise<TokenInfo | null> {
  const tokens = await getTokenList();
  return tokens.get(mint) || null;
}

/**
 * Fetch current price for a token
 */
export async function getTokenPrice(mint: string): Promise<number | null> {
  try {
    const response = await fetch(`${JUPITER_PRICE_API}?ids=${mint}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.data?.[mint]?.price || null;
  } catch (error) {
    console.error('Failed to fetch price:', error);
    return null;
  }
}

/**
 * Fetch prices for multiple tokens
 */
export async function getTokenPrices(mints: string[]): Promise<Map<string, number>> {
  const prices = new Map<string, number>();

  try {
    const response = await fetch(`${JUPITER_PRICE_API}?ids=${mints.join(',')}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000)
    });

    if (response.ok) {
      const data = await response.json();
      for (const mint of mints) {
        if (data.data?.[mint]?.price) {
          prices.set(mint, data.data[mint].price);
        }
      }
    }
  } catch (error) {
    console.error('Failed to fetch prices:', error);
  }

  return prices;
}

/**
 * Get a swap quote from Jupiter
 */
export async function getSwapQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  inputDecimals: number = 9,
  slippageBps: number = 50 // 0.5% default slippage
): Promise<QuoteResponse | null> {
  try {
    const inputAmount = Math.floor(amount * Math.pow(10, inputDecimals));

    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount: inputAmount.toString(),
      slippageBps: slippageBps.toString(),
      onlyDirectRoutes: 'false',
      asLegacyTransaction: 'false'
    });

    const response = await fetch(`${JUPITER_QUOTE_API}?${params}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Quote API error:', error);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to get swap quote:', error);
    return null;
  }
}

/**
 * Build and execute a swap transaction
 */
export async function executeSwap(
  quote: QuoteResponse,
  userPublicKey: PublicKey,
  userKeypair: Keypair,
  priorityFee?: number
): Promise<SwapResult> {
  const connection = getConnection();

  try {
    // Get swap transaction from Jupiter
    const swapResponse = await fetch(JUPITER_SWAP_API, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: userPublicKey.toString(),
        wrapAndUnwrapSol: true,
        computeUnitPriceMicroLamports: priorityFee || 1000,
        dynamicComputeUnitLimit: true
      }),
      signal: AbortSignal.timeout(30000)
    });

    if (!swapResponse.ok) {
      const error = await swapResponse.text();
      throw new Error(`Swap API error: ${error}`);
    }

    const swapData = await swapResponse.json();
    const swapTransaction = swapData.swapTransaction;

    // Deserialize the transaction
    const transactionBuf = Buffer.from(swapTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(transactionBuf);

    // Sign with user keypair
    transaction.sign([userKeypair]);

    // Send transaction
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: 3
    });

    // Confirm transaction
    const latestBlockhash = await connection.getLatestBlockhash('confirmed');
    await connection.confirmTransaction({
      signature,
      ...latestBlockhash
    }, 'confirmed');

    // Get token info for decimals
    const inputToken = await getTokenInfo(quote.inputMint);
    const outputToken = await getTokenInfo(quote.outputMint);

    const inputDecimals = inputToken?.decimals || 9;
    const outputDecimals = outputToken?.decimals || 9;

    return {
      success: true,
      signature,
      inputAmount: parseInt(quote.inAmount) / Math.pow(10, inputDecimals),
      outputAmount: parseInt(quote.outAmount) / Math.pow(10, outputDecimals),
      inputMint: quote.inputMint,
      outputMint: quote.outputMint,
      priceImpact: parseFloat(quote.priceImpactPct)
    };

  } catch (error) {
    console.error('Swap execution failed:', error);
    return {
      success: false,
      inputAmount: 0,
      outputAmount: 0,
      inputMint: quote.inputMint,
      outputMint: quote.outputMint,
      priceImpact: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Calculate the expected output amount for a swap
 */
export async function estimateSwapOutput(
  inputMint: string,
  outputMint: string,
  inputAmount: number,
  inputDecimals: number = 9
): Promise<{
  outputAmount: number;
  priceImpact: number;
  route: string[];
} | null> {
  const quote = await getSwapQuote(inputMint, outputMint, inputAmount, inputDecimals);

  if (!quote) return null;

  const outputToken = await getTokenInfo(outputMint);
  const outputDecimals = outputToken?.decimals || 9;

  return {
    outputAmount: parseInt(quote.outAmount) / Math.pow(10, outputDecimals),
    priceImpact: parseFloat(quote.priceImpactPct),
    route: quote.routePlan.map(r => r.swapInfo.label)
  };
}

/**
 * Get popular trading pairs
 */
export function getPopularPairs(): Array<{ input: string; output: string; name: string }> {
  return [
    { input: COMMON_TOKENS.SOL, output: COMMON_TOKENS.USDC, name: 'SOL → USDC' },
    { input: COMMON_TOKENS.USDC, output: COMMON_TOKENS.SOL, name: 'USDC → SOL' },
    { input: COMMON_TOKENS.SOL, output: COMMON_TOKENS.JUP, name: 'SOL → JUP' },
    { input: COMMON_TOKENS.SOL, output: COMMON_TOKENS.BONK, name: 'SOL → BONK' },
    { input: COMMON_TOKENS.SOL, output: COMMON_TOKENS.WIF, name: 'SOL → WIF' },
    { input: COMMON_TOKENS.SOL, output: COMMON_TOKENS.PYTH, name: 'SOL → PYTH' },
    { input: COMMON_TOKENS.USDC, output: COMMON_TOKENS.JUP, name: 'USDC → JUP' },
    { input: COMMON_TOKENS.USDC, output: COMMON_TOKENS.BONK, name: 'USDC → BONK' },
    { input: COMMON_TOKENS.SOL, output: COMMON_TOKENS.MSOL, name: 'SOL → mSOL' },
    { input: COMMON_TOKENS.SOL, output: COMMON_TOKENS.JITOSOL, name: 'SOL → JitoSOL' }
  ];
}

/**
 * Search tokens by name or symbol
 */
export async function searchTokens(query: string, limit: number = 20): Promise<TokenInfo[]> {
  const tokens = await getTokenList();
  const results: TokenInfo[] = [];
  const lowerQuery = query.toLowerCase();

  for (const token of tokens.values()) {
    if (
      token.symbol.toLowerCase().includes(lowerQuery) ||
      token.name.toLowerCase().includes(lowerQuery) ||
      token.address.toLowerCase() === lowerQuery
    ) {
      results.push(token);
      if (results.length >= limit) break;
    }
  }

  // Sort by relevance (exact symbol match first)
  results.sort((a, b) => {
    const aExact = a.symbol.toLowerCase() === lowerQuery;
    const bExact = b.symbol.toLowerCase() === lowerQuery;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;
    return 0;
  });

  return results;
}
