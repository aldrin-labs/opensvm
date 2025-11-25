// Smart Order Router and DEX Aggregator for Solana
// Aggregates liquidity from Jupiter, Raydium, Orca, and other DEXs

import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';

// Supported DEX protocols
export type DexProtocol = 'jupiter' | 'raydium' | 'orca' | 'phoenix' | 'meteora' | 'lifinity';

// Quote response from a DEX
export interface DexQuote {
  dex: DexProtocol;
  inputMint: string;
  outputMint: string;
  inputAmount: string;
  outputAmount: string;
  priceImpact: number;
  fee: number;
  route: RouteStep[];
  estimatedGas: number;
  expiresAt: number;
}

// Single step in a route
export interface RouteStep {
  dex: DexProtocol;
  poolAddress: string;
  inputMint: string;
  outputMint: string;
  inputAmount: string;
  outputAmount: string;
  fee: number;
}

// Aggregated quote with best route
export interface AggregatedQuote {
  bestQuote: DexQuote;
  allQuotes: DexQuote[];
  savings: number; // Percentage saved vs worst quote
  timestamp: number;
}

// Order execution result
export interface ExecutionResult {
  success: boolean;
  txSignature?: string;
  inputAmount: string;
  outputAmount: string;
  executedPrice: number;
  priceImpact: number;
  fees: {
    network: number;
    protocol: number;
    total: number;
  };
  route: RouteStep[];
  error?: string;
}

// Token info cache
interface TokenInfo {
  mint: string;
  symbol: string;
  decimals: number;
  name: string;
}

// Jupiter API response types
interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
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

interface JupiterSwapResponse {
  swapTransaction: string;
  lastValidBlockHeight: number;
}

// Smart Order Router
export class DexAggregator {
  private connection: Connection;
  private tokenCache: Map<string, TokenInfo> = new Map();
  private quoteCache: Map<string, { quote: AggregatedQuote; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 10000; // 10 seconds
  private readonly JUPITER_API = 'https://quote-api.jup.ag/v6';

  constructor(connection: Connection) {
    this.connection = connection;
    this.initializeTokenCache();
  }

  private initializeTokenCache() {
    // Pre-populate common tokens
    const commonTokens: TokenInfo[] = [
      { mint: 'So11111111111111111111111111111111111111112', symbol: 'SOL', decimals: 9, name: 'Solana' },
      { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC', decimals: 6, name: 'USD Coin' },
      { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', symbol: 'USDT', decimals: 6, name: 'Tether USD' },
      { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', symbol: 'BONK', decimals: 5, name: 'Bonk' },
      { mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', symbol: 'JUP', decimals: 6, name: 'Jupiter' },
      { mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', symbol: 'RAY', decimals: 6, name: 'Raydium' },
      { mint: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE', symbol: 'ORCA', decimals: 6, name: 'Orca' },
      { mint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', symbol: 'MSOL', decimals: 9, name: 'Marinade SOL' },
      { mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', symbol: 'WIF', decimals: 6, name: 'dogwifhat' },
      { mint: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', symbol: 'PYTH', decimals: 6, name: 'Pyth Network' },
    ];

    commonTokens.forEach(token => {
      this.tokenCache.set(token.mint, token);
      this.tokenCache.set(token.symbol.toUpperCase(), token);
    });
  }

  // Resolve token symbol or mint to TokenInfo
  async resolveToken(symbolOrMint: string): Promise<TokenInfo | null> {
    const key = symbolOrMint.toUpperCase();
    if (this.tokenCache.has(key)) {
      return this.tokenCache.get(key)!;
    }
    if (this.tokenCache.has(symbolOrMint)) {
      return this.tokenCache.get(symbolOrMint)!;
    }

    // Try to fetch from Jupiter token list
    try {
      const response = await fetch(`https://token.jup.ag/strict`);
      if (response.ok) {
        const tokens = await response.json();
        const token = tokens.find((t: any) =>
          t.symbol.toUpperCase() === key ||
          t.address === symbolOrMint
        );
        if (token) {
          const tokenInfo: TokenInfo = {
            mint: token.address,
            symbol: token.symbol,
            decimals: token.decimals,
            name: token.name,
          };
          this.tokenCache.set(token.address, tokenInfo);
          this.tokenCache.set(token.symbol.toUpperCase(), tokenInfo);
          return tokenInfo;
        }
      }
    } catch (error) {
      console.error('Failed to resolve token:', error);
    }

    return null;
  }

  // Get aggregated quote from multiple DEXs
  async getQuote(
    inputMint: string,
    outputMint: string,
    amount: string,
    slippageBps: number = 50
  ): Promise<AggregatedQuote> {
    const cacheKey = `${inputMint}-${outputMint}-${amount}-${slippageBps}`;
    const cached = this.quoteCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.quote;
    }

    const quotes: DexQuote[] = [];

    // Fetch quotes from multiple sources in parallel
    const quotePromises = [
      this.getJupiterQuote(inputMint, outputMint, amount, slippageBps),
      // Add more DEX quote fetchers here as needed
    ];

    const results = await Promise.allSettled(quotePromises);

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        quotes.push(result.value);
      }
    }

    if (quotes.length === 0) {
      throw new Error('No quotes available for this trade');
    }

    // Sort by output amount (best first)
    quotes.sort((a, b) => BigInt(b.outputAmount) > BigInt(a.outputAmount) ? 1 : -1);

    const bestQuote = quotes[0];
    const worstQuote = quotes[quotes.length - 1];

    const savings = quotes.length > 1
      ? ((BigInt(bestQuote.outputAmount) - BigInt(worstQuote.outputAmount)) * BigInt(10000) / BigInt(worstQuote.outputAmount))
      : BigInt(0);

    const aggregatedQuote: AggregatedQuote = {
      bestQuote,
      allQuotes: quotes,
      savings: Number(savings) / 100,
      timestamp: Date.now(),
    };

    this.quoteCache.set(cacheKey, { quote: aggregatedQuote, timestamp: Date.now() });
    return aggregatedQuote;
  }

  // Get quote from Jupiter
  private async getJupiterQuote(
    inputMint: string,
    outputMint: string,
    amount: string,
    slippageBps: number
  ): Promise<DexQuote | null> {
    try {
      const url = new URL(`${this.JUPITER_API}/quote`);
      url.searchParams.set('inputMint', inputMint);
      url.searchParams.set('outputMint', outputMint);
      url.searchParams.set('amount', amount);
      url.searchParams.set('slippageBps', slippageBps.toString());
      url.searchParams.set('onlyDirectRoutes', 'false');
      url.searchParams.set('asLegacyTransaction', 'false');

      const response = await fetch(url.toString());
      if (!response.ok) {
        console.error('Jupiter quote failed:', response.status);
        return null;
      }

      const data: JupiterQuoteResponse = await response.json();

      // Convert Jupiter route to our format
      const route: RouteStep[] = data.routePlan.map(step => ({
        dex: this.mapJupiterLabel(step.swapInfo.label),
        poolAddress: step.swapInfo.ammKey,
        inputMint: step.swapInfo.inputMint,
        outputMint: step.swapInfo.outputMint,
        inputAmount: step.swapInfo.inAmount,
        outputAmount: step.swapInfo.outAmount,
        fee: Number(step.swapInfo.feeAmount),
      }));

      return {
        dex: 'jupiter',
        inputMint: data.inputMint,
        outputMint: data.outputMint,
        inputAmount: data.inAmount,
        outputAmount: data.outAmount,
        priceImpact: parseFloat(data.priceImpactPct),
        fee: route.reduce((sum, step) => sum + step.fee, 0),
        route,
        estimatedGas: 5000, // Approximate lamports
        expiresAt: Date.now() + 30000, // 30 seconds
      };
    } catch (error) {
      console.error('Jupiter quote error:', error);
      return null;
    }
  }

  // Map Jupiter AMM labels to our DexProtocol
  private mapJupiterLabel(label: string): DexProtocol {
    const labelLower = label.toLowerCase();
    if (labelLower.includes('raydium')) return 'raydium';
    if (labelLower.includes('orca')) return 'orca';
    if (labelLower.includes('phoenix')) return 'phoenix';
    if (labelLower.includes('meteora')) return 'meteora';
    if (labelLower.includes('lifinity')) return 'lifinity';
    return 'jupiter';
  }

  // Get swap transaction from Jupiter
  async getSwapTransaction(
    quote: DexQuote,
    userPublicKey: string,
    wrapUnwrapSOL: boolean = true
  ): Promise<VersionedTransaction | Transaction> {
    if (quote.dex !== 'jupiter') {
      throw new Error(`Swap transaction not supported for ${quote.dex}`);
    }

    // First get a fresh quote
    const url = new URL(`${this.JUPITER_API}/quote`);
    url.searchParams.set('inputMint', quote.inputMint);
    url.searchParams.set('outputMint', quote.outputMint);
    url.searchParams.set('amount', quote.inputAmount);
    url.searchParams.set('slippageBps', '50');

    const quoteResponse = await fetch(url.toString());
    if (!quoteResponse.ok) {
      throw new Error('Failed to get quote for swap');
    }
    const quoteData = await quoteResponse.json();

    // Get swap transaction
    const swapResponse = await fetch(`${this.JUPITER_API}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quoteData,
        userPublicKey,
        wrapAndUnwrapSol: wrapUnwrapSOL,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto',
      }),
    });

    if (!swapResponse.ok) {
      const error = await swapResponse.text();
      throw new Error(`Failed to get swap transaction: ${error}`);
    }

    const swapData: JupiterSwapResponse = await swapResponse.json();

    // Decode the transaction
    const transactionBuf = Buffer.from(swapData.swapTransaction, 'base64');

    try {
      return VersionedTransaction.deserialize(transactionBuf);
    } catch {
      return Transaction.from(transactionBuf);
    }
  }

  // Execute a swap
  async executeSwap(
    quote: DexQuote,
    signTransaction: (tx: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>,
    userPublicKey: string
  ): Promise<ExecutionResult> {
    try {
      // Get the swap transaction
      const transaction = await this.getSwapTransaction(quote, userPublicKey);

      // Sign the transaction
      const signedTx = await signTransaction(transaction);

      // Send and confirm
      let txSignature: string;
      if (signedTx instanceof VersionedTransaction) {
        txSignature = await this.connection.sendTransaction(signedTx);
      } else {
        txSignature = await this.connection.sendRawTransaction(signedTx.serialize());
      }

      // Wait for confirmation
      const latestBlockhash = await this.connection.getLatestBlockhash();
      await this.connection.confirmTransaction({
        signature: txSignature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      });

      // Calculate executed price
      const inputAmount = BigInt(quote.inputAmount);
      const outputAmount = BigInt(quote.outputAmount);
      const executedPrice = Number(outputAmount) / Number(inputAmount);

      return {
        success: true,
        txSignature,
        inputAmount: quote.inputAmount,
        outputAmount: quote.outputAmount,
        executedPrice,
        priceImpact: quote.priceImpact,
        fees: {
          network: quote.estimatedGas,
          protocol: quote.fee,
          total: quote.estimatedGas + quote.fee,
        },
        route: quote.route,
      };
    } catch (error) {
      return {
        success: false,
        inputAmount: quote.inputAmount,
        outputAmount: '0',
        executedPrice: 0,
        priceImpact: 0,
        fees: { network: 0, protocol: 0, total: 0 },
        route: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Get best route for a trade
  async getBestRoute(
    inputToken: string,
    outputToken: string,
    amount: number,
    slippageBps: number = 50
  ): Promise<{ quote: DexQuote; route: RouteStep[] }> {
    // Resolve tokens
    const inputInfo = await this.resolveToken(inputToken);
    const outputInfo = await this.resolveToken(outputToken);

    if (!inputInfo || !outputInfo) {
      throw new Error(`Could not resolve tokens: ${inputToken} or ${outputToken}`);
    }

    // Convert amount to smallest unit
    const amountInSmallestUnit = Math.floor(amount * Math.pow(10, inputInfo.decimals)).toString();

    const aggregated = await this.getQuote(
      inputInfo.mint,
      outputInfo.mint,
      amountInSmallestUnit,
      slippageBps
    );

    return {
      quote: aggregated.bestQuote,
      route: aggregated.bestQuote.route,
    };
  }

  // Get price for a token pair
  async getPrice(baseToken: string, quoteToken: string = 'USDC'): Promise<number> {
    const baseInfo = await this.resolveToken(baseToken);
    const quoteInfo = await this.resolveToken(quoteToken);

    if (!baseInfo || !quoteInfo) {
      throw new Error(`Could not resolve tokens: ${baseToken} or ${quoteToken}`);
    }

    // Get quote for 1 unit of base token
    const amount = Math.pow(10, baseInfo.decimals).toString();

    try {
      const aggregated = await this.getQuote(
        baseInfo.mint,
        quoteInfo.mint,
        amount,
        10 // Low slippage for price check
      );

      const outputAmount = BigInt(aggregated.bestQuote.outputAmount);
      return Number(outputAmount) / Math.pow(10, quoteInfo.decimals);
    } catch {
      return 0;
    }
  }
}

// Singleton instance
let aggregatorInstance: DexAggregator | null = null;

export function getDexAggregator(connection: Connection): DexAggregator {
  if (!aggregatorInstance) {
    aggregatorInstance = new DexAggregator(connection);
  }
  return aggregatorInstance;
}

export default DexAggregator;
