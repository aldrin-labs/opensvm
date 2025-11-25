// Binance-compatible Order Book Depth endpoint
// GET /api/v3/depth - Order book for a symbol

import { NextRequest, NextResponse } from 'next/server';
import { OrderBook, BinanceError } from '@/lib/trading/binance-types';

export const runtime = 'edge';

// Cache for depth data
const depthCache = new Map<string, { data: OrderBook; timestamp: number }>();
const CACHE_TTL = 2000; // 2 seconds (order book changes frequently)

// Token mint addresses
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

function parseSymbol(symbol: string): { base: string; quote: string } | null {
  const quotes = ['USDC', 'USDT', 'SOL'];
  for (const quote of quotes) {
    if (symbol.endsWith(quote)) {
      return { base: symbol.slice(0, -quote.length), quote };
    }
  }
  return null;
}

// Fetch order book from Jupiter
async function fetchJupiterOrderBook(
  inputMint: string,
  outputMint: string,
  limit: number
): Promise<{ bids: [string, string][]; asks: [string, string][] }> {
  try {
    // Get quotes at different amounts to simulate order book depth
    const amounts = [
      1, 10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000,
    ].slice(0, limit / 2);

    const bidPromises = amounts.map(async (amount) => {
      try {
        // Quote for buying base with quote (bid)
        const amountInLamports = Math.floor(amount * 1e6).toString(); // Assume USDC decimals
        const response = await fetch(
          `https://quote-api.jup.ag/v6/quote?inputMint=${outputMint}&outputMint=${inputMint}&amount=${amountInLamports}&slippageBps=10`
        );
        if (!response.ok) return null;
        const data = await response.json();
        const price = Number(data.inAmount) / Number(data.outAmount);
        return [price.toFixed(8), (Number(data.outAmount) / 1e9).toFixed(8)] as [string, string];
      } catch {
        return null;
      }
    });

    const askPromises = amounts.map(async (amount) => {
      try {
        // Quote for selling base for quote (ask)
        const amountInLamports = Math.floor(amount * 1e9).toString(); // Assume SOL decimals
        const response = await fetch(
          `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountInLamports}&slippageBps=10`
        );
        if (!response.ok) return null;
        const data = await response.json();
        const price = Number(data.outAmount) / Number(data.inAmount);
        return [price.toFixed(8), (Number(data.inAmount) / 1e9).toFixed(8)] as [string, string];
      } catch {
        return null;
      }
    });

    const [bidsResults, asksResults] = await Promise.all([
      Promise.all(bidPromises),
      Promise.all(askPromises),
    ]);

    const bids = bidsResults.filter((b): b is [string, string] => b !== null);
    const asks = asksResults.filter((a): a is [string, string] => a !== null);

    // Sort: bids descending, asks ascending
    bids.sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]));
    asks.sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]));

    return { bids, asks };
  } catch {
    return { bids: [], asks: [] };
  }
}

// Generate simulated order book based on current price
async function generateOrderBook(
  symbol: string,
  limit: number
): Promise<OrderBook | null> {
  const parsed = parseSymbol(symbol);
  if (!parsed) return null;

  const { base, quote } = parsed;
  const baseMint = TOKEN_MINTS[base];
  const quoteMint = TOKEN_MINTS[quote];

  if (!baseMint || !quoteMint) return null;

  // Try to get real order book data from Jupiter
  const jupiterBook = await fetchJupiterOrderBook(baseMint, quoteMint, limit);

  if (jupiterBook.bids.length > 0 || jupiterBook.asks.length > 0) {
    return {
      lastUpdateId: Date.now(),
      bids: jupiterBook.bids.slice(0, limit),
      asks: jupiterBook.asks.slice(0, limit),
    };
  }

  // Fallback: Generate simulated order book
  const apiKey = process.env.BIRDEYE_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://public-api.birdeye.so/defi/price?address=${baseMint}`,
      {
        headers: {
          'Accept': 'application/json',
          'X-API-KEY': apiKey,
          'x-chain': 'solana',
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    let currentPrice = data.data?.value || 0;

    // Adjust price if quote is not USD
    if (quote === 'SOL') {
      const solResponse = await fetch(
        `https://public-api.birdeye.so/defi/price?address=${quoteMint}`,
        {
          headers: {
            'Accept': 'application/json',
            'X-API-KEY': apiKey,
            'x-chain': 'solana',
          },
        }
      );
      if (solResponse.ok) {
        const solData = await solResponse.json();
        const solPrice = solData.data?.value || 1;
        currentPrice = currentPrice / solPrice;
      }
    }

    // Generate synthetic order book levels
    const bids: [string, string][] = [];
    const asks: [string, string][] = [];
    const spread = 0.001; // 0.1% spread

    for (let i = 0; i < limit; i++) {
      const bidPrice = currentPrice * (1 - spread - i * 0.0005);
      const askPrice = currentPrice * (1 + spread + i * 0.0005);
      const quantity = 10 + Math.random() * 100;

      bids.push([bidPrice.toFixed(8), quantity.toFixed(8)]);
      asks.push([askPrice.toFixed(8), quantity.toFixed(8)]);
    }

    return {
      lastUpdateId: Date.now(),
      bids,
      asks,
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol')?.toUpperCase();
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 5000);

  if (!symbol) {
    return NextResponse.json(
      { code: -1102, msg: 'Mandatory parameter \'symbol\' was not sent.' } as BinanceError,
      { status: 400 }
    );
  }

  try {
    // Check cache
    const cacheKey = `${symbol}-${limit}`;
    const cached = depthCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const orderBook = await generateOrderBook(symbol, limit);
    if (!orderBook) {
      return NextResponse.json(
        { code: -1121, msg: 'Invalid symbol.' } as BinanceError,
        { status: 400 }
      );
    }

    depthCache.set(cacheKey, { data: orderBook, timestamp: Date.now() });
    return NextResponse.json(orderBook);
  } catch (error) {
    console.error('Depth error:', error);
    return NextResponse.json(
      { code: -1000, msg: 'Internal error' } as BinanceError,
      { status: 500 }
    );
  }
}
