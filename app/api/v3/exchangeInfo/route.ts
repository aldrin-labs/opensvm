// Binance-compatible Exchange Info endpoint
// GET /api/v3/exchangeInfo

import { NextRequest, NextResponse } from 'next/server';
import {
  BinanceExchangeInfo,
  SymbolInfo,
  OrderType,
} from '@/lib/trading/binance-types';
import solanaTokens from '@/data/tokens/solana-tokens.json';

// Quote assets for trading pairs
const QUOTE_TOKENS = {
  USDC: {
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
  },
  USDT: {
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    decimals: 6,
  },
  SOL: {
    mint: 'So11111111111111111111111111111111111111112',
    decimals: 9,
  },
};

// Token interface
interface SolanaToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  verified?: boolean;
}

// Load tokens from local JSON file (781 tokens from Jupiter validated list)
function getTokenList(): SolanaToken[] {
  return solanaTokens as SolanaToken[];
}

// Generate trading pairs from tokens
function generateTradingPairs(tokens: SolanaToken[]): Array<{
  base: string;
  quote: string;
  baseMint: string;
  quoteMint: string;
  baseDecimals: number;
  quoteDecimals: number;
  baseName: string;
  logoURI?: string;
  tags?: string[];
}> {
  const pairs: Array<{
    base: string;
    quote: string;
    baseMint: string;
    quoteMint: string;
    baseDecimals: number;
    quoteDecimals: number;
    baseName: string;
    logoURI?: string;
    tags?: string[];
  }> = [];

  const quoteMints = new Set(Object.values(QUOTE_TOKENS).map(q => q.mint));

  for (const token of tokens) {
    // Skip if token is a quote token itself
    if (quoteMints.has(token.address)) continue;

    // Skip tokens without symbols or with very long symbols
    if (!token.symbol || token.symbol.length > 10) continue;

    // Create pairs with each quote token
    for (const [quoteSymbol, quoteInfo] of Object.entries(QUOTE_TOKENS)) {
      // Don't create SOL/SOL pair
      if (token.address === quoteInfo.mint) continue;

      pairs.push({
        base: token.symbol.toUpperCase(),
        quote: quoteSymbol,
        baseMint: token.address,
        quoteMint: quoteInfo.mint,
        baseDecimals: token.decimals,
        quoteDecimals: quoteInfo.decimals,
        baseName: token.name,
        logoURI: token.logoURI,
        tags: token.tags,
      });
    }
  }

  return pairs;
}

// Supported DEX sources
const DEX_SOURCES = ['Jupiter', 'Raydium', 'Orca', 'Phoenix', 'Meteora', 'Lifinity'];

type TradingPair = {
  base: string;
  quote: string;
  baseMint: string;
  quoteMint: string;
  baseDecimals: number;
  quoteDecimals: number;
  baseName?: string;
  logoURI?: string;
  tags?: string[];
};

function createSymbolInfo(pair: TradingPair): SymbolInfo {
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
    // Extended info
    baseAssetName: pair.baseName,
    logoURI: pair.logoURI,
    tags: pair.tags,
  } as SymbolInfo;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol');
  const symbols = searchParams.get('symbols');
  const baseAsset = searchParams.get('baseAsset');
  const quoteAsset = searchParams.get('quoteAsset');
  const limit = parseInt(searchParams.get('limit') || '0', 10);

  // Load tokens from local JSON file
  const tokenList = getTokenList();
  let tradingPairs = generateTradingPairs(tokenList);

  // Filter by specific symbol
  if (symbol) {
    tradingPairs = tradingPairs.filter(
      p => `${p.base}${p.quote}`.toUpperCase() === symbol.toUpperCase()
    );
  }

  // Filter by symbols array
  if (symbols) {
    try {
      const symbolList = JSON.parse(symbols) as string[];
      const upperSymbols = symbolList.map(s => s.toUpperCase());
      tradingPairs = tradingPairs.filter(
        p => upperSymbols.includes(`${p.base}${p.quote}`.toUpperCase())
      );
    } catch {
      // Invalid JSON, ignore filter
    }
  }

  // Filter by base asset
  if (baseAsset) {
    tradingPairs = tradingPairs.filter(
      p => p.base.toUpperCase() === baseAsset.toUpperCase()
    );
  }

  // Filter by quote asset
  if (quoteAsset) {
    tradingPairs = tradingPairs.filter(
      p => p.quote.toUpperCase() === quoteAsset.toUpperCase()
    );
  }

  // Apply limit
  if (limit > 0) {
    tradingPairs = tradingPairs.slice(0, limit);
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
    symbols: tradingPairs.map(createSymbolInfo),
    // Extended info
    totalSymbols: tradingPairs.length,
    tokenCount: tokenList.length,
  };

  return NextResponse.json(exchangeInfo);
}
