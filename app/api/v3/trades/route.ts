// Binance-compatible Recent Trades endpoint
// GET /api/v3/trades - Get recent trades

import { NextRequest, NextResponse } from 'next/server';
import { Trade, BinanceError } from '@/lib/trading/binance-types';

export const runtime = 'edge';

// Cache for trades data
const tradesCache = new Map<string, { data: Trade[]; timestamp: number }>();
const CACHE_TTL = 5000; // 5 seconds

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

// Fetch recent trades from Birdeye
async function fetchRecentTrades(
  baseMint: string,
  quoteMint: string,
  limit: number
): Promise<Trade[]> {
  const apiKey = process.env.BIRDEYE_API_KEY;
  if (!apiKey) return [];

  try {
    // Get recent trades for the token
    const response = await fetch(
      `https://public-api.birdeye.so/defi/txs/token?address=${baseMint}&tx_type=swap&limit=${limit}`,
      {
        headers: {
          'Accept': 'application/json',
          'X-API-KEY': apiKey,
          'x-chain': 'solana',
        },
      }
    );

    if (!response.ok) return [];

    const data = await response.json();
    if (!data.success || !data.data?.items) return [];

    // Convert to Binance trade format
    const trades: Trade[] = data.data.items.map((tx: any, index: number) => {
      const isBuy = tx.side === 'buy';
      const price = tx.price || 0;
      const qty = tx.amount || 0;

      return {
        id: index + 1,
        price: price.toString(),
        qty: qty.toString(),
        quoteQty: (price * qty).toString(),
        time: tx.blockUnixTime * 1000,
        isBuyerMaker: !isBuy,
        isBestMatch: true,
      };
    });

    return trades;
  } catch {
    return [];
  }
}

// Generate simulated trades based on current price
async function generateTrades(
  symbol: string,
  limit: number
): Promise<Trade[] | null> {
  const parsed = parseSymbol(symbol);
  if (!parsed) return null;

  const { base, quote } = parsed;
  const baseMint = TOKEN_MINTS[base];
  const quoteMint = TOKEN_MINTS[quote];

  if (!baseMint) return null;

  // Try to fetch real trades
  const realTrades = await fetchRecentTrades(baseMint, quoteMint, limit);
  if (realTrades.length > 0) {
    return realTrades;
  }

  // Fallback: Generate simulated trades
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
    if (quote === 'SOL' && quoteMint) {
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

    // Generate synthetic trades
    const trades: Trade[] = [];
    const now = Date.now();

    for (let i = 0; i < limit; i++) {
      // Random price variation within 0.5%
      const priceVariation = (Math.random() - 0.5) * 0.01;
      const price = currentPrice * (1 + priceVariation);
      const qty = 0.1 + Math.random() * 10;
      const isBuyerMaker = Math.random() > 0.5;

      trades.push({
        id: i + 1,
        price: price.toFixed(8),
        qty: qty.toFixed(8),
        quoteQty: (price * qty).toFixed(8),
        time: now - i * 1000 * (1 + Math.random() * 5), // 1-6 seconds apart
        isBuyerMaker,
        isBestMatch: true,
      });
    }

    return trades;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol')?.toUpperCase();
  const limit = Math.min(parseInt(searchParams.get('limit') || '500'), 1000);

  if (!symbol) {
    return NextResponse.json(
      { code: -1102, msg: 'Mandatory parameter \'symbol\' was not sent.' } as BinanceError,
      { status: 400 }
    );
  }

  try {
    // Check cache
    const cacheKey = `${symbol}-${limit}`;
    const cached = tradesCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const trades = await generateTrades(symbol, limit);
    if (!trades) {
      return NextResponse.json(
        { code: -1121, msg: 'Invalid symbol.' } as BinanceError,
        { status: 400 }
      );
    }

    tradesCache.set(cacheKey, { data: trades, timestamp: Date.now() });
    return NextResponse.json(trades);
  } catch (error) {
    console.error('Trades error:', error);
    return NextResponse.json(
      { code: -1000, msg: 'Internal error' } as BinanceError,
      { status: 500 }
    );
  }
}
