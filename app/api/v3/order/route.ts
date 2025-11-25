// Binance-compatible Order endpoint
// POST /api/v3/order - Create new order
// GET /api/v3/order - Query order
// DELETE /api/v3/order - Cancel order

import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/solana/solana-connection-server';
import { getDexAggregator } from '@/lib/trading/dex-aggregator';
import { getOrderManager } from '@/lib/trading/order-manager';
import { NewOrderRequest, BinanceError } from '@/lib/trading/binance-types';

export const runtime = 'nodejs';

// Initialize services
function getServices() {
  const connection = getConnection();
  const aggregator = getDexAggregator(connection);
  const orderManager = getOrderManager(connection, aggregator);
  return { connection, aggregator, orderManager };
}

// Validate order request
function validateOrderRequest(params: URLSearchParams | Record<string, any>): {
  valid: boolean;
  error?: BinanceError;
  request?: NewOrderRequest;
} {
  const getValue = (key: string) => {
    if (params instanceof URLSearchParams) {
      return params.get(key);
    }
    return params[key];
  };

  const symbol = getValue('symbol');
  const side = getValue('side')?.toUpperCase();
  const type = getValue('type')?.toUpperCase();
  const quantity = getValue('quantity');
  const timestamp = getValue('timestamp');

  // Required parameters
  if (!symbol) {
    return { valid: false, error: { code: -1102, msg: 'Mandatory parameter \'symbol\' was not sent.' } };
  }
  if (!side || !['BUY', 'SELL'].includes(side)) {
    return { valid: false, error: { code: -1102, msg: 'Mandatory parameter \'side\' was not sent or invalid.' } };
  }
  if (!type || !['LIMIT', 'MARKET', 'LIMIT_MAKER'].includes(type)) {
    return { valid: false, error: { code: -1102, msg: 'Mandatory parameter \'type\' was not sent or invalid.' } };
  }
  if (!quantity) {
    return { valid: false, error: { code: -1102, msg: 'Mandatory parameter \'quantity\' was not sent.' } };
  }
  if (!timestamp) {
    return { valid: false, error: { code: -1102, msg: 'Mandatory parameter \'timestamp\' was not sent.' } };
  }

  // Validate quantity
  const qty = parseFloat(quantity);
  if (isNaN(qty) || qty <= 0) {
    return { valid: false, error: { code: -1013, msg: 'Invalid quantity.' } };
  }

  // LIMIT orders require price and timeInForce
  const price = getValue('price');
  const timeInForce = getValue('timeInForce')?.toUpperCase() || 'GTC';

  if (type === 'LIMIT' && !price) {
    return { valid: false, error: { code: -1102, msg: 'Mandatory parameter \'price\' was not sent.' } };
  }

  if (price && (isNaN(parseFloat(price)) || parseFloat(price) <= 0)) {
    return { valid: false, error: { code: -1013, msg: 'Invalid price.' } };
  }

  const request: NewOrderRequest = {
    symbol: symbol.toUpperCase(),
    side: side as 'BUY' | 'SELL',
    type: type as any,
    quantity,
    timestamp: parseInt(timestamp),
    timeInForce: timeInForce as any,
    price: price || undefined,
    newClientOrderId: getValue('newClientOrderId') || undefined,
    stopPrice: getValue('stopPrice') || undefined,
    newOrderRespType: (getValue('newOrderRespType')?.toUpperCase() || 'FULL') as any,
    walletAddress: getValue('walletAddress') || undefined,
    slippageBps: getValue('slippageBps') ? parseInt(getValue('slippageBps')!) : 50,
  };

  return { valid: true, request };
}

// POST - Create new order
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateOrderRequest(body);

    if (!validation.valid) {
      return NextResponse.json(validation.error, { status: 400 });
    }

    const { orderManager } = getServices();

    // Create order (without signing - user will need to sign on client side)
    const order = await orderManager.createOrder(validation.request!);

    return NextResponse.json(order);
  } catch (error) {
    console.error('Order creation error:', error);
    return NextResponse.json(
      {
        code: -1000,
        msg: error instanceof Error ? error.message : 'Unknown error occurred',
      } as BinanceError,
      { status: 500 }
    );
  }
}

// GET - Query order
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol');
    const orderId = searchParams.get('orderId');
    const origClientOrderId = searchParams.get('origClientOrderId');

    if (!symbol) {
      return NextResponse.json(
        { code: -1102, msg: 'Mandatory parameter \'symbol\' was not sent.' } as BinanceError,
        { status: 400 }
      );
    }

    if (!orderId && !origClientOrderId) {
      return NextResponse.json(
        { code: -1102, msg: 'Either orderId or origClientOrderId must be sent.' } as BinanceError,
        { status: 400 }
      );
    }

    const { orderManager } = getServices();

    const order = await orderManager.getOrder(
      symbol.toUpperCase(),
      orderId ? parseInt(orderId) : undefined,
      origClientOrderId || undefined
    );

    if (!order) {
      return NextResponse.json(
        { code: -2013, msg: 'Order does not exist.' } as BinanceError,
        { status: 400 }
      );
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('Order query error:', error);
    return NextResponse.json(
      {
        code: -1000,
        msg: error instanceof Error ? error.message : 'Unknown error occurred',
      } as BinanceError,
      { status: 500 }
    );
  }
}

// DELETE - Cancel order
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol');
    const orderId = searchParams.get('orderId');
    const origClientOrderId = searchParams.get('origClientOrderId');

    if (!symbol) {
      return NextResponse.json(
        { code: -1102, msg: 'Mandatory parameter \'symbol\' was not sent.' } as BinanceError,
        { status: 400 }
      );
    }

    if (!orderId && !origClientOrderId) {
      return NextResponse.json(
        { code: -1102, msg: 'Either orderId or origClientOrderId must be sent.' } as BinanceError,
        { status: 400 }
      );
    }

    const { orderManager } = getServices();

    const order = await orderManager.cancelOrder(
      symbol.toUpperCase(),
      orderId ? parseInt(orderId) : undefined,
      origClientOrderId || undefined
    );

    if (!order) {
      return NextResponse.json(
        { code: -2011, msg: 'Unknown order sent.' } as BinanceError,
        { status: 400 }
      );
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('Order cancel error:', error);
    return NextResponse.json(
      {
        code: -1000,
        msg: error instanceof Error ? error.message : 'Unknown error occurred',
      } as BinanceError,
      { status: 500 }
    );
  }
}
