// Swap Execution endpoint
// POST /api/v3/swap - Get swap transaction for signing
// This endpoint returns a transaction that the user can sign with their wallet

import { NextRequest, NextResponse } from 'next/server';
import { BinanceError } from '@/lib/trading/binance-types';

export const runtime = 'nodejs';

// Token mints
const TOKEN_MINTS: Record<string, string> = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  RAY: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  ORCA: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
  WIF: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  PYTH: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
  MSOL: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
};

const TOKEN_DECIMALS: Record<string, number> = {
  SOL: 9,
  USDC: 6,
  USDT: 6,
  BONK: 5,
  JUP: 6,
  RAY: 6,
  ORCA: 6,
  WIF: 6,
  PYTH: 6,
  MSOL: 9,
};

function parseSymbol(symbol: string): { base: string; quote: string } | null {
  const quotes = ['USDC', 'USDT', 'SOL'];
  for (const quote of quotes) {
    if (symbol.endsWith(quote)) {
      return { base: symbol.slice(0, -quote.length), quote };
    }
  }
  return null;
}

interface SwapRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: string;
  walletAddress: string;
  slippageBps?: number;
}

interface SwapQuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  slippageBps: number;
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

// GET - Get swap quote
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol')?.toUpperCase();
  const side = searchParams.get('side')?.toUpperCase() as 'BUY' | 'SELL';
  const quantity = searchParams.get('quantity');
  const slippageBps = parseInt(searchParams.get('slippageBps') || '50');

  if (!symbol || !side || !quantity) {
    return NextResponse.json(
      { code: -1102, msg: 'Missing required parameters: symbol, side, quantity' } as BinanceError,
      { status: 400 }
    );
  }

  const parsed = parseSymbol(symbol);
  if (!parsed) {
    return NextResponse.json(
      { code: -1121, msg: 'Invalid symbol' } as BinanceError,
      { status: 400 }
    );
  }

  const { base, quote } = parsed;
  const baseMint = TOKEN_MINTS[base];
  const quoteMint = TOKEN_MINTS[quote];
  const baseDecimals = TOKEN_DECIMALS[base] || 6;
  const quoteDecimals = TOKEN_DECIMALS[quote] || 6;

  if (!baseMint || !quoteMint) {
    return NextResponse.json(
      { code: -1121, msg: 'Unsupported token' } as BinanceError,
      { status: 400 }
    );
  }

  // Determine input/output based on side
  const inputMint = side === 'BUY' ? quoteMint : baseMint;
  const outputMint = side === 'BUY' ? baseMint : quoteMint;
  const inputDecimals = side === 'BUY' ? quoteDecimals : baseDecimals;

  // Convert quantity to smallest unit
  const amountInSmallestUnit = Math.floor(parseFloat(quantity) * Math.pow(10, inputDecimals)).toString();

  try {
    // Get quote from Jupiter
    const quoteUrl = new URL('https://quote-api.jup.ag/v6/quote');
    quoteUrl.searchParams.set('inputMint', inputMint);
    quoteUrl.searchParams.set('outputMint', outputMint);
    quoteUrl.searchParams.set('amount', amountInSmallestUnit);
    quoteUrl.searchParams.set('slippageBps', slippageBps.toString());

    const quoteResponse = await fetch(quoteUrl.toString());
    if (!quoteResponse.ok) {
      const error = await quoteResponse.text();
      return NextResponse.json(
        { code: -1000, msg: `Jupiter quote failed: ${error}` } as BinanceError,
        { status: 500 }
      );
    }

    const quoteData: SwapQuoteResponse = await quoteResponse.json();

    // Calculate human-readable amounts
    const outputDecimals = side === 'BUY' ? baseDecimals : quoteDecimals;
    const inAmountHuman = parseFloat(quoteData.inAmount) / Math.pow(10, inputDecimals);
    const outAmountHuman = parseFloat(quoteData.outAmount) / Math.pow(10, outputDecimals);
    const price = side === 'BUY'
      ? inAmountHuman / outAmountHuman
      : outAmountHuman / inAmountHuman;

    return NextResponse.json({
      symbol,
      side,
      inputMint: quoteData.inputMint,
      outputMint: quoteData.outputMint,
      inputAmount: quoteData.inAmount,
      outputAmount: quoteData.outAmount,
      inputAmountHuman: inAmountHuman.toString(),
      outputAmountHuman: outAmountHuman.toString(),
      price: price.toString(),
      priceImpact: quoteData.priceImpactPct,
      slippageBps,
      route: quoteData.routePlan.map(r => ({
        dex: r.swapInfo.label,
        pool: r.swapInfo.ammKey,
        percent: r.percent,
      })),
      quoteData, // Include raw quote for swap transaction
      expiresAt: Date.now() + 30000, // 30 seconds
    });
  } catch (error) {
    console.error('Swap quote error:', error);
    return NextResponse.json(
      { code: -1000, msg: error instanceof Error ? error.message : 'Unknown error' } as BinanceError,
      { status: 500 }
    );
  }
}

// POST - Get swap transaction for signing
export async function POST(req: NextRequest) {
  try {
    const body: SwapRequest = await req.json();
    const { symbol, side, quantity, walletAddress, slippageBps = 50 } = body;

    if (!symbol || !side || !quantity || !walletAddress) {
      return NextResponse.json(
        { code: -1102, msg: 'Missing required parameters' } as BinanceError,
        { status: 400 }
      );
    }

    const parsed = parseSymbol(symbol.toUpperCase());
    if (!parsed) {
      return NextResponse.json(
        { code: -1121, msg: 'Invalid symbol' } as BinanceError,
        { status: 400 }
      );
    }

    const { base, quote } = parsed;
    const baseMint = TOKEN_MINTS[base];
    const quoteMint = TOKEN_MINTS[quote];
    const baseDecimals = TOKEN_DECIMALS[base] || 6;
    const quoteDecimals = TOKEN_DECIMALS[quote] || 6;

    if (!baseMint || !quoteMint) {
      return NextResponse.json(
        { code: -1121, msg: 'Unsupported token' } as BinanceError,
        { status: 400 }
      );
    }

    // Determine input/output based on side
    const inputMint = side === 'BUY' ? quoteMint : baseMint;
    const outputMint = side === 'BUY' ? baseMint : quoteMint;
    const inputDecimals = side === 'BUY' ? quoteDecimals : baseDecimals;

    // Convert quantity to smallest unit
    const amountInSmallestUnit = Math.floor(parseFloat(quantity) * Math.pow(10, inputDecimals)).toString();

    // Step 1: Get quote
    const quoteUrl = new URL('https://quote-api.jup.ag/v6/quote');
    quoteUrl.searchParams.set('inputMint', inputMint);
    quoteUrl.searchParams.set('outputMint', outputMint);
    quoteUrl.searchParams.set('amount', amountInSmallestUnit);
    quoteUrl.searchParams.set('slippageBps', slippageBps.toString());

    const quoteResponse = await fetch(quoteUrl.toString());
    if (!quoteResponse.ok) {
      return NextResponse.json(
        { code: -1000, msg: 'Failed to get quote' } as BinanceError,
        { status: 500 }
      );
    }

    const quoteData = await quoteResponse.json();

    // Step 2: Get swap transaction
    const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quoteData,
        userPublicKey: walletAddress,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto',
      }),
    });

    if (!swapResponse.ok) {
      const error = await swapResponse.text();
      return NextResponse.json(
        { code: -1000, msg: `Failed to create swap transaction: ${error}` } as BinanceError,
        { status: 500 }
      );
    }

    const swapData = await swapResponse.json();

    // Calculate human-readable amounts
    const outputDecimals = side === 'BUY' ? baseDecimals : quoteDecimals;
    const inAmountHuman = parseFloat(quoteData.inAmount) / Math.pow(10, inputDecimals);
    const outAmountHuman = parseFloat(quoteData.outAmount) / Math.pow(10, outputDecimals);

    return NextResponse.json({
      success: true,
      symbol: symbol.toUpperCase(),
      side,
      inputMint,
      outputMint,
      inputAmount: quoteData.inAmount,
      outputAmount: quoteData.outAmount,
      inputAmountHuman: inAmountHuman.toString(),
      outputAmountHuman: outAmountHuman.toString(),
      priceImpact: quoteData.priceImpactPct,
      // The base64 encoded transaction for the client to sign
      swapTransaction: swapData.swapTransaction,
      lastValidBlockHeight: swapData.lastValidBlockHeight,
      // Route info
      route: quoteData.routePlan?.map((r: any) => ({
        dex: r.swapInfo.label,
        pool: r.swapInfo.ammKey,
        percent: r.percent,
      })) || [],
    });
  } catch (error) {
    console.error('Swap transaction error:', error);
    return NextResponse.json(
      { code: -1000, msg: error instanceof Error ? error.message : 'Unknown error' } as BinanceError,
      { status: 500 }
    );
  }
}
