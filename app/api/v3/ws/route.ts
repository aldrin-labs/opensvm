// Binance-compatible WebSocket-style streaming endpoint
// GET /api/v3/ws - Server-Sent Events for real-time updates
// Supports: trade, kline, depth, ticker, bookTicker streams

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// Token mints
const TOKEN_MINTS: Record<string, string> = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  RAY: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  ORCA: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
  WIF: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  PYTH: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
  MSOL: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
};

function parseSymbol(symbol: string): { base: string; quote: string } | null {
  const quotes = ['usdc', 'usdt', 'sol'];
  const lowerSymbol = symbol.toLowerCase();
  for (const quote of quotes) {
    if (lowerSymbol.endsWith(quote)) {
      return {
        base: lowerSymbol.slice(0, -quote.length).toUpperCase(),
        quote: quote.toUpperCase(),
      };
    }
  }
  return null;
}

// Parse stream name to get type and symbol
function parseStream(stream: string): {
  type: 'trade' | 'kline' | 'depth' | 'ticker' | 'bookTicker' | 'aggTrade';
  symbol: string;
  interval?: string;
} | null {
  // Format: symbol@streamType or symbol@kline_interval
  const parts = stream.split('@');
  if (parts.length !== 2) return null;

  const symbol = parts[0].toUpperCase();
  const streamType = parts[1].toLowerCase();

  if (streamType === 'trade' || streamType === 'aggtrade') {
    return { type: streamType === 'aggtrade' ? 'aggTrade' : 'trade', symbol };
  }
  if (streamType === 'depth' || streamType === 'depth20' || streamType === 'depth5') {
    return { type: 'depth', symbol };
  }
  if (streamType === 'ticker' || streamType === '24hrticker') {
    return { type: 'ticker', symbol };
  }
  if (streamType === 'bookticker') {
    return { type: 'bookTicker', symbol };
  }
  if (streamType.startsWith('kline_')) {
    const interval = streamType.replace('kline_', '');
    return { type: 'kline', symbol, interval };
  }

  return null;
}

// Fetch current price from Birdeye
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

// Generate trade event
function generateTradeEvent(symbol: string, price: number): string {
  const now = Date.now();
  const qty = 0.1 + Math.random() * 10;
  const isBuyerMaker = Math.random() > 0.5;

  return JSON.stringify({
    e: 'trade',
    E: now,
    s: symbol,
    t: Math.floor(now / 1000),
    p: price.toFixed(8),
    q: qty.toFixed(8),
    b: Math.floor(Math.random() * 1000000),
    a: Math.floor(Math.random() * 1000000),
    T: now,
    m: isBuyerMaker,
    M: true,
  });
}

// Generate ticker event
function generateTickerEvent(symbol: string, price: number): string {
  const now = Date.now();
  const change = (Math.random() - 0.5) * 10;
  const changePercent = change / price * 100;

  return JSON.stringify({
    e: '24hrTicker',
    E: now,
    s: symbol,
    p: change.toFixed(8),
    P: changePercent.toFixed(2),
    w: price.toFixed(8),
    x: (price - change).toFixed(8),
    c: price.toFixed(8),
    Q: (Math.random() * 10).toFixed(8),
    b: (price * 0.999).toFixed(8),
    B: (Math.random() * 100).toFixed(8),
    a: (price * 1.001).toFixed(8),
    A: (Math.random() * 100).toFixed(8),
    o: (price - change).toFixed(8),
    h: (price * 1.02).toFixed(8),
    l: (price * 0.98).toFixed(8),
    v: (Math.random() * 100000).toFixed(8),
    q: (Math.random() * 10000000).toFixed(8),
    O: now - 86400000,
    C: now,
    F: 0,
    L: Math.floor(Math.random() * 1000),
    n: Math.floor(Math.random() * 10000),
  });
}

// Generate book ticker event
function generateBookTickerEvent(symbol: string, price: number): string {
  return JSON.stringify({
    u: Date.now(),
    s: symbol,
    b: (price * 0.999).toFixed(8),
    B: (Math.random() * 100).toFixed(8),
    a: (price * 1.001).toFixed(8),
    A: (Math.random() * 100).toFixed(8),
  });
}

// Generate depth event
function generateDepthEvent(symbol: string, price: number): string {
  const bids: [string, string][] = [];
  const asks: [string, string][] = [];

  for (let i = 0; i < 5; i++) {
    bids.push([
      (price * (1 - 0.001 * (i + 1))).toFixed(8),
      (Math.random() * 100).toFixed(8),
    ]);
    asks.push([
      (price * (1 + 0.001 * (i + 1))).toFixed(8),
      (Math.random() * 100).toFixed(8),
    ]);
  }

  return JSON.stringify({
    e: 'depthUpdate',
    E: Date.now(),
    s: symbol,
    U: Date.now() - 1,
    u: Date.now(),
    b: bids,
    a: asks,
  });
}

// Generate kline event
function generateKlineEvent(symbol: string, price: number, interval: string): string {
  const now = Date.now();
  const intervalMs: Record<string, number> = {
    '1m': 60000,
    '5m': 300000,
    '15m': 900000,
    '1h': 3600000,
    '4h': 14400000,
    '1d': 86400000,
  };
  const ms = intervalMs[interval] || 60000;
  const klineStart = Math.floor(now / ms) * ms;

  const open = price * (1 + (Math.random() - 0.5) * 0.01);
  const close = price;
  const high = Math.max(open, close) * (1 + Math.random() * 0.005);
  const low = Math.min(open, close) * (1 - Math.random() * 0.005);

  return JSON.stringify({
    e: 'kline',
    E: now,
    s: symbol,
    k: {
      t: klineStart,
      T: klineStart + ms - 1,
      s: symbol,
      i: interval,
      f: 0,
      L: Math.floor(Math.random() * 100),
      o: open.toFixed(8),
      c: close.toFixed(8),
      h: high.toFixed(8),
      l: low.toFixed(8),
      v: (Math.random() * 1000).toFixed(8),
      n: Math.floor(Math.random() * 100),
      x: false,
      q: (Math.random() * 100000).toFixed(8),
      V: (Math.random() * 500).toFixed(8),
      Q: (Math.random() * 50000).toFixed(8),
    },
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const streams = searchParams.get('streams')?.split('/') || [];

  if (streams.length === 0) {
    return NextResponse.json(
      { error: 'No streams specified. Use format: streams=symbol@streamType' },
      { status: 400 }
    );
  }

  // Parse and validate streams
  const parsedStreams = streams.map(parseStream).filter(Boolean) as Array<{
    type: 'trade' | 'kline' | 'depth' | 'ticker' | 'bookTicker' | 'aggTrade';
    symbol: string;
    interval?: string;
  }>;

  if (parsedStreams.length === 0) {
    return NextResponse.json(
      { error: 'Invalid stream format. Use: symbol@trade, symbol@ticker, symbol@depth, symbol@kline_1m, etc.' },
      { status: 400 }
    );
  }

  // Get initial prices for all symbols
  const symbolPrices = new Map<string, number>();
  for (const stream of parsedStreams) {
    const parsed = parseSymbol(stream.symbol);
    if (parsed && !symbolPrices.has(stream.symbol)) {
      const mint = TOKEN_MINTS[parsed.base];
      if (mint) {
        const price = await fetchPrice(mint);
        if (price) {
          // Adjust for quote currency
          if (parsed.quote === 'SOL') {
            const solMint = TOKEN_MINTS['SOL'];
            const solPrice = await fetchPrice(solMint);
            if (solPrice) {
              symbolPrices.set(stream.symbol, price / solPrice);
            }
          } else {
            symbolPrices.set(stream.symbol, price);
          }
        }
      }
    }
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: 'connected', streams: streams })}\n\n`));

      // Stream updates
      intervalId = setInterval(() => {
        for (const streamConfig of parsedStreams) {
          let price = symbolPrices.get(streamConfig.symbol) || 100;
          // Add small price variation
          price = price * (1 + (Math.random() - 0.5) * 0.001);
          symbolPrices.set(streamConfig.symbol, price);

          let event: string;
          switch (streamConfig.type) {
            case 'trade':
            case 'aggTrade':
              event = generateTradeEvent(streamConfig.symbol, price);
              break;
            case 'ticker':
              event = generateTickerEvent(streamConfig.symbol, price);
              break;
            case 'bookTicker':
              event = generateBookTickerEvent(streamConfig.symbol, price);
              break;
            case 'depth':
              event = generateDepthEvent(streamConfig.symbol, price);
              break;
            case 'kline':
              event = generateKlineEvent(streamConfig.symbol, price, streamConfig.interval || '1m');
              break;
            default:
              continue;
          }

          controller.enqueue(encoder.encode(`data: ${event}\n\n`));
        }
      }, 1000); // Update every second
    },
    cancel() {
      if (intervalId) {
        clearInterval(intervalId);
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
