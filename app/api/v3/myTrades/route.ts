// Binance-compatible My Trades endpoint
// GET /api/v3/myTrades - Get trades for a specific account

import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/solana/solana-connection-server';
import { getDexAggregator } from '@/lib/trading/dex-aggregator';
import { getOrderManager } from '@/lib/trading/order-manager';
import { BinanceError } from '@/lib/trading/binance-types';

export const runtime = 'nodejs';

function getServices() {
  const connection = getConnection();
  const aggregator = getDexAggregator(connection);
  const orderManager = getOrderManager(connection, aggregator);
  return { orderManager };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol');
  const limit = Math.min(parseInt(searchParams.get('limit') || '500'), 1000);

  if (!symbol) {
    return NextResponse.json(
      { code: -1102, msg: 'Mandatory parameter \'symbol\' was not sent.' } as BinanceError,
      { status: 400 }
    );
  }

  try {
    const { orderManager } = getServices();
    const trades = await orderManager.getMyTrades(symbol.toUpperCase(), limit);

    // Convert to Binance format
    const formattedTrades = trades.map(trade => ({
      symbol: trade.symbol,
      id: trade.id,
      orderId: trade.orderId,
      price: trade.price,
      qty: trade.qty,
      quoteQty: trade.quoteQty,
      commission: trade.commission,
      commissionAsset: trade.commissionAsset,
      time: trade.time,
      isBuyer: trade.isBuyer,
      isMaker: trade.isMaker,
      isBestMatch: trade.isBestMatch,
    }));

    return NextResponse.json(formattedTrades);
  } catch (error) {
    console.error('My trades error:', error);
    return NextResponse.json(
      { code: -1000, msg: error instanceof Error ? error.message : 'Unknown error' } as BinanceError,
      { status: 500 }
    );
  }
}
