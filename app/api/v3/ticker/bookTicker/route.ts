// Binance-compatible Book Ticker endpoint
// GET /api/v3/ticker/bookTicker - Best price/qty on the order book

import { NextRequest, NextResponse } from 'next/server';
import { BookTicker, BinanceError } from '@/lib/trading/binance-types';

export const runtime = 'edge';

// Cache
const tickerCache = new Map<string, { data: BookTicker; timestamp: number }>();
const CACHE_TTL = 2000; // 2 seconds

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

const SUPPORTED_SYMBOLS = [
  'SOLUSDC', 'SOLUSDT', 'BONKUSDC', 'BONKSOL', 'JUPUSDC', 'JUPSOL',
  'RAYUSDC', 'RAYSOL', 'ORCAUSDC', 'WIFUSDC', 'WIFSOL', 'PYTHUSDC',
  'MSOLSOL', 'MSOLUSDC',
];

function parseSymbol(symbol: string): { base: string; quote: string } | null {
  const quotes = ['USDC', 'USDT', 'SOL'];
  for (const quote of quotes) {
    if (symbol.endsWith(quote)) {
      return { base: symbol.slice(0, -quote.length), quote };
    }
  }
  return null;
}

async function fetchPrice(mint: string): Promise<number | null> {
  const apiKey = process.env.BIRDEYE_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://public-api.birdeye.so/defi/price?address=${mint}`,
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
    return data.data?.value || null;
  } catch {
    return null;
  }
}

async function getBookTicker(symbol: string): Promise<BookTicker | null> {
  const parsed = parseSymbol(symbol);
  if (!parsed) return null;

  const { base, quote } = parsed;
  const baseMint = TOKEN_MINTS[base];
  const quoteMint = TOKEN_MINTS[quote];

  if (!baseMint) return null;

  const basePrice = await fetchPrice(baseMint);
  if (basePrice === null) return null;

  let price = basePrice;
  if (quote !== 'USDC' && quote !== 'USDT' && quoteMint) {
    const quotePrice = await fetchPrice(quoteMint);
    if (quotePrice) {
      price = basePrice / quotePrice;
    }
  }

  // Simulate bid/ask spread (0.1%)
  const spread = 0.001;
  const bidPrice = price * (1 - spread / 2);
  const askPrice = price * (1 + spread / 2);

  return {
    symbol,
    bidPrice: bidPrice.toFixed(8),
    bidQty: (Math.random() * 100 + 10).toFixed(8),
    askPrice: askPrice.toFixed(8),
    askQty: (Math.random() * 100 + 10).toFixed(8),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol')?.toUpperCase();
  const symbols = searchParams.get('symbols');

  try {
    // Single symbol
    if (symbol) {
      const cached = tickerCache.get(symbol);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return NextResponse.json(cached.data);
      }

      const ticker = await getBookTicker(symbol);
      if (!ticker) {
        return NextResponse.json(
          { code: -1121, msg: 'Invalid symbol.' } as BinanceError,
          { status: 400 }
        );
      }

      tickerCache.set(symbol, { data: ticker, timestamp: Date.now() });
      return NextResponse.json(ticker);
    }

    // Multiple symbols
    let symbolList = SUPPORTED_SYMBOLS;
    if (symbols) {
      try {
        symbolList = JSON.parse(symbols).map((s: string) => s.toUpperCase());
      } catch {
        // Invalid JSON
      }
    }

    const tickerPromises = symbolList.map(async (sym) => {
      const cached = tickerCache.get(sym);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
      }

      const ticker = await getBookTicker(sym);
      if (ticker) {
        tickerCache.set(sym, { data: ticker, timestamp: Date.now() });
      }
      return ticker;
    });

    const tickers = (await Promise.all(tickerPromises)).filter(Boolean);
    return NextResponse.json(tickers);
  } catch (error) {
    console.error('Book ticker error:', error);
    return NextResponse.json(
      { code: -1000, msg: 'Internal error' } as BinanceError,
      { status: 500 }
    );
  }
}
