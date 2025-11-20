import { NextRequest, NextResponse } from 'next/server';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


export const runtime = 'edge';

interface OrderRequest {
  type: 'market' | 'limit';
  side: 'buy' | 'sell';
  amount: number;
  price?: number;
  market: string;
  stopLoss?: number;
  takeProfit?: number;
  userId?: string;
}

interface OrderResponse {
  orderId: string;
  status: 'pending' | 'filled' | 'partial' | 'cancelled' | 'failed';
  type: 'market' | 'limit';
  side: 'buy' | 'sell';
  amount: number;
  price?: number;
  executedAmount?: number;
  executedPrice?: number;
  timestamp: number;
  fees?: number;
  txHash?: string;
  message?: string;
}

interface PositionUpdate {
  symbol: string;
  side: 'long' | 'short';
  amount: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  stopLoss?: number;
  takeProfit?: number;
}

// In-memory order storage (in production, use a database)
const orders = new Map<string, OrderResponse>();
const positions = new Map<string, PositionUpdate>();

/**
 * Generate a unique order ID
 */
function generateOrderId(): string {
  return `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Simulate order execution
 * In production, this would interact with Solana blockchain
 */
async function executeOrder(order: OrderRequest): Promise<OrderResponse> {
  const orderId = generateOrderId();
  
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Get current price (in production, fetch from actual market data)
  // For now, use a simulated price to avoid circular dependencies
  let currentPrice = 199.17; // Default SOL price
  
  // You could also fetch from an external API directly here
  // or use a shared service/cache for market data
  
  // Determine execution price
  const executionPrice = order.type === 'market' 
    ? currentPrice 
    : (order.price || currentPrice);
  
  // Check if order can be filled
  let status: OrderResponse['status'] = 'pending';
  let executedAmount = 0;
  let executedPrice = 0;
  
  if (order.type === 'market') {
    // Market orders fill immediately
    status = 'filled';
    executedAmount = order.amount;
    executedPrice = executionPrice;
  } else if (order.type === 'limit') {
    // Check if limit order can fill
    if (order.side === 'buy' && executionPrice <= (order.price || 0)) {
      status = 'filled';
      executedAmount = order.amount;
      executedPrice = executionPrice;
    } else if (order.side === 'sell' && executionPrice >= (order.price || 0)) {
      status = 'filled';
      executedAmount = order.amount;
      executedPrice = executionPrice;
    } else {
      // Order remains pending
      status = 'pending';
    }
  }
  
  // Calculate fees (0.1% for example)
  const fees = executedAmount * executedPrice * 0.001;
  
  // Create order response
  const orderResponse: OrderResponse = {
    orderId,
    status,
    type: order.type,
    side: order.side,
    amount: order.amount,
    price: order.price,
    executedAmount: status === 'filled' ? executedAmount : undefined,
    executedPrice: status === 'filled' ? executedPrice : undefined,
    timestamp: Date.now(),
    fees: status === 'filled' ? fees : undefined,
    txHash: status === 'filled' ? `tx-${orderId}` : undefined,
    message: status === 'filled' 
      ? `Order filled at $${executedPrice.toFixed(2)}` 
      : 'Order pending execution'
  };
  
  // Store order
  orders.set(orderId, orderResponse);
  
  // Update position if order was filled
  if (status === 'filled' && executedAmount > 0) {
    updatePosition(order, executedPrice, executedAmount);
  }
  
  return orderResponse;
}

/**
 * Update or create position
 */
function updatePosition(
  order: OrderRequest,
  executedPrice: number,
  executedAmount: number
): void {
  const positionKey = `${order.market}-${order.side}`;
  const existingPosition = positions.get(positionKey);
  
  if (existingPosition) {
    // Update existing position
    const newAmount = existingPosition.amount + executedAmount;
    const newEntryPrice = 
      (existingPosition.entryPrice * existingPosition.amount + executedPrice * executedAmount) / 
      newAmount;
    
    existingPosition.amount = newAmount;
    existingPosition.entryPrice = newEntryPrice;
    existingPosition.currentPrice = executedPrice;
    existingPosition.pnl = (executedPrice - newEntryPrice) * newAmount;
    existingPosition.pnlPercent = ((executedPrice - newEntryPrice) / newEntryPrice) * 100;
    
    if (order.stopLoss) {
      existingPosition.stopLoss = order.stopLoss;
    }
    if (order.takeProfit) {
      existingPosition.takeProfit = order.takeProfit;
    }
  } else {
    // Create new position
    const newPosition: PositionUpdate = {
      symbol: order.market,
      side: order.side === 'buy' ? 'long' : 'short',
      amount: executedAmount,
      entryPrice: executedPrice,
      currentPrice: executedPrice,
      pnl: 0,
      pnlPercent: 0,
      stopLoss: order.stopLoss,
      takeProfit: order.takeProfit
    };
    
    positions.set(positionKey, newPosition);
  }
}

/**
 * POST - Execute a trade order
 */
export async function POST(req: NextRequest) {
  try {
    const order: OrderRequest = await req.json();
    
    // Validate order
    if (!order.type || !order.side || !order.amount || !order.market) {
      return NextResponse.json(
        { error: 'Invalid order parameters' },
        { status: 400 }
      );
    }
    
    if (order.type === 'limit' && !order.price) {
      return NextResponse.json(
        { error: 'Limit orders require a price' },
        { status: 400 }
      );
    }
    
    if (order.amount <= 0) {
      return NextResponse.json(
        { error: 'Order amount must be positive' },
        { status: 400 }
      );
    }
    
    // Execute the order
    const result = await executeOrder(order);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Order execution error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to execute order',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Get order status or list of orders
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');
    
    if (orderId) {
      // Get specific order
      const order = orders.get(orderId);
      if (!order) {
        return NextResponse.json(
          { error: 'Order not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(order);
    } else {
      // Get all orders (last 100)
      const allOrders = Array.from(orders.values())
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 100);
      
      return NextResponse.json({
        orders: allOrders,
        total: allOrders.length
      });
    }
  } catch (error) {
    console.error('Get orders error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Cancel an order
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');
    
    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID required' },
        { status: 400 }
      );
    }
    
    const order = orders.get(orderId);
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }
    
    if (order.status === 'filled' || order.status === 'cancelled') {
      return NextResponse.json(
        { error: `Cannot cancel ${order.status} order` },
        { status: 400 }
      );
    }
    
    // Update order status
    order.status = 'cancelled';
    order.message = 'Order cancelled by user';
    orders.set(orderId, order);
    
    return NextResponse.json({
      success: true,
      order
    });
    
  } catch (error) {
    console.error('Cancel order error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel order' },
      { status: 500 }
    );
  }
}
