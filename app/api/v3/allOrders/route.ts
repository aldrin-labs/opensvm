// Binance-compatible All Orders endpoint
// GET /api/v3/allOrders - Get all orders (open, filled, cancelled)

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

// GET - Get all orders
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol');
    const limit = parseInt(searchParams.get('limit') || '500');

    if (!symbol) {
      return NextResponse.json(
        { code: -1102, msg: 'Mandatory parameter \'symbol\' was not sent.' } as BinanceError,
        { status: 400 }
      );
    }

    const { orderManager } = getServices();

    const allOrders = await orderManager.getAllOrders(symbol.toUpperCase(), Math.min(limit, 1000));

    return NextResponse.json(allOrders);
  } catch (error) {
    console.error('All orders query error:', error);
    return NextResponse.json(
      {
        code: -1000,
        msg: error instanceof Error ? error.message : 'Unknown error occurred',
      } as BinanceError,
      { status: 500 }
    );
  }
}
