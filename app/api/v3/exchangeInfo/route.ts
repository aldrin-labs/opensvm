// Binance-compatible Exchange Info endpoint
// GET /api/v3/exchangeInfo

import { NextRequest, NextResponse } from 'next/server';
import {
  BinanceExchangeInfo,
  SymbolInfo,
  OrderType,
} from '@/lib/trading/binance-types';

export const runtime = 'edge';

// Common Solana trading pairs
const TRADING_PAIRS: Array<{
  base: string;
  quote: string;
  baseMint: string;
  quoteMint: string;
  baseDecimals: number;
  quoteDecimals: number;
}> = [
  {
    base: 'SOL',
    quote: 'USDC',
    baseMint: 'So11111111111111111111111111111111111111112',
    quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    baseDecimals: 9,
    quoteDecimals: 6,
  },
  {
    base: 'SOL',
    quote: 'USDT',
    baseMint: 'So11111111111111111111111111111111111111112',
    quoteMint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    baseDecimals: 9,
    quoteDecimals: 6,
  },
  {
    base: 'BONK',
    quote: 'USDC',
    baseMint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    baseDecimals: 5,
    quoteDecimals: 6,
  },
  {
    base: 'BONK',
    quote: 'SOL',
    baseMint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    quoteMint: 'So11111111111111111111111111111111111111112',
    baseDecimals: 5,
    quoteDecimals: 9,
  },
  {
    base: 'JUP',
    quote: 'USDC',
    baseMint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    baseDecimals: 6,
    quoteDecimals: 6,
  },
  {
    base: 'JUP',
    quote: 'SOL',
    baseMint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    quoteMint: 'So11111111111111111111111111111111111111112',
    baseDecimals: 6,
    quoteDecimals: 9,
  },
  {
    base: 'RAY',
    quote: 'USDC',
    baseMint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    baseDecimals: 6,
    quoteDecimals: 6,
  },
  {
    base: 'RAY',
    quote: 'SOL',
    baseMint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    quoteMint: 'So11111111111111111111111111111111111111112',
    baseDecimals: 6,
    quoteDecimals: 9,
  },
  {
    base: 'ORCA',
    quote: 'USDC',
    baseMint: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
    quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    baseDecimals: 6,
    quoteDecimals: 6,
  },
  {
    base: 'WIF',
    quote: 'USDC',
    baseMint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    baseDecimals: 6,
    quoteDecimals: 6,
  },
  {
    base: 'WIF',
    quote: 'SOL',
    baseMint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    quoteMint: 'So11111111111111111111111111111111111111112',
    baseDecimals: 6,
    quoteDecimals: 9,
  },
  {
    base: 'PYTH',
    quote: 'USDC',
    baseMint: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
    quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    baseDecimals: 6,
    quoteDecimals: 6,
  },
  {
    base: 'MSOL',
    quote: 'SOL',
    baseMint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
    quoteMint: 'So11111111111111111111111111111111111111112',
    baseDecimals: 9,
    quoteDecimals: 9,
  },
  {
    base: 'MSOL',
    quote: 'USDC',
    baseMint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
    quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    baseDecimals: 9,
    quoteDecimals: 6,
  },
];

// Supported DEX sources
const DEX_SOURCES = ['Jupiter', 'Raydium', 'Orca', 'Phoenix', 'Meteora', 'Lifinity'];

function createSymbolInfo(pair: typeof TRADING_PAIRS[0]): SymbolInfo {
  const tickSize = Math.pow(10, -pair.quoteDecimals).toString();
  const stepSize = Math.pow(10, -pair.baseDecimals).toString();

  return {
    symbol: `${pair.base}${pair.quote}`,
    status: 'TRADING',
    baseAsset: pair.base,
    baseAssetPrecision: pair.baseDecimals,
    quoteAsset: pair.quote,
    quotePrecision: pair.quoteDecimals,
    quoteAssetPrecision: pair.quoteDecimals,
    orderTypes: ['LIMIT', 'MARKET', 'LIMIT_MAKER'] as OrderType[],
    icebergAllowed: false,
    ocoAllowed: false,
    isSpotTradingAllowed: true,
    isMarginTradingAllowed: false,
    filters: [
      {
        filterType: 'PRICE_FILTER',
        minPrice: tickSize,
        maxPrice: '100000000',
        tickSize,
      },
      {
        filterType: 'LOT_SIZE',
        minQty: stepSize,
        maxQty: '100000000',
        stepSize,
      },
      {
        filterType: 'MIN_NOTIONAL',
        minNotional: '0.1',
        applyToMarket: true,
        avgPriceMins: 5,
      },
      {
        filterType: 'MAX_NUM_ORDERS',
        maxNumOrders: 200,
      },
    ],
    permissions: ['SPOT'],
    baseMint: pair.baseMint,
    quoteMint: pair.quoteMint,
    dexSources: DEX_SOURCES,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol');
  const symbols = searchParams.get('symbols');

  let filteredPairs = TRADING_PAIRS;

  // Filter by symbol if provided
  if (symbol) {
    filteredPairs = TRADING_PAIRS.filter(
      p => `${p.base}${p.quote}` === symbol.toUpperCase()
    );
  }

  // Filter by symbols array if provided
  if (symbols) {
    try {
      const symbolList = JSON.parse(symbols) as string[];
      const upperSymbols = symbolList.map(s => s.toUpperCase());
      filteredPairs = TRADING_PAIRS.filter(
        p => upperSymbols.includes(`${p.base}${p.quote}`)
      );
    } catch {
      // Invalid JSON, ignore filter
    }
  }

  const exchangeInfo: BinanceExchangeInfo = {
    timezone: 'UTC',
    serverTime: Date.now(),
    rateLimits: [
      {
        rateLimitType: 'REQUEST_WEIGHT',
        interval: 'MINUTE',
        intervalNum: 1,
        limit: 1200,
      },
      {
        rateLimitType: 'ORDERS',
        interval: 'SECOND',
        intervalNum: 10,
        limit: 100,
      },
      {
        rateLimitType: 'ORDERS',
        interval: 'DAY',
        intervalNum: 1,
        limit: 200000,
      },
      {
        rateLimitType: 'RAW_REQUESTS',
        interval: 'MINUTE',
        intervalNum: 5,
        limit: 6100,
      },
    ],
    symbols: filteredPairs.map(createSymbolInfo),
  };

  return NextResponse.json(exchangeInfo);
}
