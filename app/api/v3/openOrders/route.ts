// Binance-compatible Open Orders endpoint
// GET /api/v3/openOrders - Get all open orders
// DELETE /api/v3/openOrders - Cancel all open orders

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

// GET - Get all open orders
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol');
    const walletAddress = searchParams.get('walletAddress');

    const { orderManager } = getServices();

    const openOrders = await orderManager.getOpenOrders(
      symbol?.toUpperCase(),
      walletAddress || undefined
    );

    return NextResponse.json(openOrders);
  } catch (error) {
    console.error('Open orders query error:', error);
    return NextResponse.json(
      {
        code: -1000,
        msg: error instanceof Error ? error.message : 'Unknown error occurred',
      } as BinanceError,
      { status: 500 }
    );
  }
}

// DELETE - Cancel all open orders for a symbol
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json(
        { code: -1102, msg: 'Mandatory parameter \'symbol\' was not sent.' } as BinanceError,
        { status: 400 }
      );
    }

    const { orderManager } = getServices();

    // Get all open orders for the symbol
    const openOrders = await orderManager.getOpenOrders(symbol.toUpperCase());

    // Cancel each order
    const cancelledOrders = [];
    for (const order of openOrders) {
      const cancelled = await orderManager.cancelOrder(symbol.toUpperCase(), order.orderId);
      if (cancelled) {
        cancelledOrders.push(cancelled);
      }
    }

    return NextResponse.json(cancelledOrders);
  } catch (error) {
    console.error('Cancel all orders error:', error);
    return NextResponse.json(
      {
        code: -1000,
        msg: error instanceof Error ? error.message : 'Unknown error occurred',
      } as BinanceError,
      { status: 500 }
    );
  }
}
