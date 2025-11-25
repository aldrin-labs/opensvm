// Binance-compatible API Documentation endpoint
// GET /api/v3 - API overview and documentation

import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  return NextResponse.json({
    name: 'OpenSVM Binance-Compatible Trading API',
    version: '3.0.0',
    description: 'Binance Spot API compatible trading interface for Solana DEXs with smart order routing',
    baseUrl: '/api/v3',
    documentation: 'https://docs.opensvm.com/api/trading',

    features: [
      'Smart order routing via Jupiter aggregation',
      'Real-time market data from Birdeye',
      'Support for 14+ Solana trading pairs',
      'WebSocket-style streaming via SSE',
      'Wallet-based authentication',
      'Multi-DEX liquidity aggregation',
    ],

    supportedDexes: [
      'Jupiter',
      'Raydium',
      'Orca',
      'Phoenix',
      'Meteora',
      'Lifinity',
    ],

    endpoints: {
      // General
      'GET /ping': 'Test connectivity',
      'GET /time': 'Get server time',
      'GET /exchangeInfo': 'Exchange trading rules and symbol information',

      // Market Data
      'GET /depth': 'Order book depth',
      'GET /trades': 'Recent trades list',
      'GET /klines': 'Kline/candlestick data',
      'GET /ticker/24hr': '24hr ticker price change statistics',
      'GET /ticker/price': 'Symbol price ticker',
      'GET /ticker/bookTicker': 'Symbol order book ticker',

      // Trading
      'POST /order': 'Create new order',
      'GET /order': 'Query order',
      'DELETE /order': 'Cancel order',
      'GET /openOrders': 'Get all open orders',
      'DELETE /openOrders': 'Cancel all open orders',
      'GET /allOrders': 'Get all orders',
      'GET /myTrades': 'Get account trade list',

      // Swap (Solana-specific)
      'GET /swap': 'Get swap quote',
      'POST /swap': 'Get swap transaction for signing',

      // Account
      'GET /account': 'Account information and balances',

      // Streaming
      'GET /ws': 'WebSocket-style streaming (SSE)',
    },

    tradingPairs: [
      { symbol: 'SOLUSDC', baseAsset: 'SOL', quoteAsset: 'USDC' },
      { symbol: 'SOLUSDT', baseAsset: 'SOL', quoteAsset: 'USDT' },
      { symbol: 'BONKUSDC', baseAsset: 'BONK', quoteAsset: 'USDC' },
      { symbol: 'BONKSOL', baseAsset: 'BONK', quoteAsset: 'SOL' },
      { symbol: 'JUPUSDC', baseAsset: 'JUP', quoteAsset: 'USDC' },
      { symbol: 'JUPSOL', baseAsset: 'JUP', quoteAsset: 'SOL' },
      { symbol: 'RAYUSDC', baseAsset: 'RAY', quoteAsset: 'USDC' },
      { symbol: 'RAYSOL', baseAsset: 'RAY', quoteAsset: 'SOL' },
      { symbol: 'ORCAUSDC', baseAsset: 'ORCA', quoteAsset: 'USDC' },
      { symbol: 'WIFUSDC', baseAsset: 'WIF', quoteAsset: 'USDC' },
      { symbol: 'WIFSOL', baseAsset: 'WIF', quoteAsset: 'SOL' },
      { symbol: 'PYTHUSDC', baseAsset: 'PYTH', quoteAsset: 'USDC' },
      { symbol: 'MSOLSOL', baseAsset: 'MSOL', quoteAsset: 'SOL' },
      { symbol: 'MSOLUSDC', baseAsset: 'MSOL', quoteAsset: 'USDC' },
    ],

    wsStreams: {
      'symbol@trade': 'Trade stream',
      'symbol@kline_interval': 'Kline stream (1m, 5m, 15m, 1h, 4h, 1d)',
      'symbol@depth': 'Partial Book Depth stream',
      'symbol@ticker': '24hr Ticker stream',
      'symbol@bookTicker': 'Book Ticker stream',
    },

    examples: {
      getPrice: {
        request: 'GET /api/v3/ticker/price?symbol=SOLUSDC',
        response: { symbol: 'SOLUSDC', price: '175.50000000' },
      },
      placeOrder: {
        request: 'POST /api/v3/order',
        body: {
          symbol: 'SOLUSDC',
          side: 'BUY',
          type: 'MARKET',
          quantity: '1',
          timestamp: 1699999999999,
          walletAddress: 'YourWalletPublicKey',
        },
        response: {
          symbol: 'SOLUSDC',
          orderId: 1,
          status: 'FILLED',
          executedQty: '1.00000000',
          price: '175.50000000',
        },
      },
      getSwapTransaction: {
        request: 'POST /api/v3/swap',
        body: {
          symbol: 'SOLUSDC',
          side: 'BUY',
          quantity: '100',
          walletAddress: 'YourWalletPublicKey',
          slippageBps: 50,
        },
        response: {
          success: true,
          swapTransaction: 'base64EncodedTransaction...',
          inputAmount: '100000000',
          outputAmount: '570000000',
        },
      },
      streamTrades: {
        request: 'GET /api/v3/ws?streams=solusdc@trade/solusdc@ticker',
        note: 'Returns Server-Sent Events (SSE) stream',
      },
    },

    rateLimits: {
      requestWeight: { limit: 1200, interval: '1m' },
      orders: { limit: 100, interval: '10s' },
      rawRequests: { limit: 6100, interval: '5m' },
    },

    serverTime: Date.now(),
  });
}
