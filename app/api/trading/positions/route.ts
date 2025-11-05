import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  amount: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  stopLoss?: number;
  takeProfit?: number;
  openedAt: number;
  closedAt?: number;
  status: 'open' | 'closed';
  leverage?: number;
  margin?: number;
}

// In-memory position storage (in production, use a database)
const positionsStore = new Map<string, Position>();

/**
 * Calculate current PnL for a position
 */
async function calculatePnL(position: Position): Promise<{ pnl: number; pnlPercent: number; currentPrice: number }> {
  // Get current market price (in production, fetch from actual market data)
  // For now, use a simulated price to avoid circular dependencies
  let currentPrice = position.symbol.includes('SOL') ? 199.17 : position.entryPrice;
  
  // Add some random variation to simulate price movement
  const variation = (Math.random() - 0.5) * 0.02; // ±1% variation
  currentPrice = currentPrice * (1 + variation);
  
  // Calculate PnL based on position side
  let pnl: number;
  if (position.side === 'long') {
    pnl = (currentPrice - position.entryPrice) * position.amount;
  } else {
    pnl = (position.entryPrice - currentPrice) * position.amount;
  }
  
  const pnlPercent = (pnl / (position.entryPrice * position.amount)) * 100;
  
  return { pnl, pnlPercent, currentPrice };
}

/**
 * Check if stop loss or take profit is triggered
 */
function checkTriggers(position: Position, currentPrice: number): { 
  triggered: boolean; 
  type?: 'stopLoss' | 'takeProfit';
  closePrice?: number;
} {
  if (position.side === 'long') {
    if (position.stopLoss && currentPrice <= position.stopLoss) {
      return { triggered: true, type: 'stopLoss', closePrice: position.stopLoss };
    }
    if (position.takeProfit && currentPrice >= position.takeProfit) {
      return { triggered: true, type: 'takeProfit', closePrice: position.takeProfit };
    }
  } else {
    if (position.stopLoss && currentPrice >= position.stopLoss) {
      return { triggered: true, type: 'stopLoss', closePrice: position.stopLoss };
    }
    if (position.takeProfit && currentPrice <= position.takeProfit) {
      return { triggered: true, type: 'takeProfit', closePrice: position.takeProfit };
    }
  }
  
  return { triggered: false };
}

/**
 * GET - Get positions
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const positionId = searchParams.get('id');
    const status = searchParams.get('status') as 'open' | 'closed' | null;
    const symbol = searchParams.get('symbol');
    
    if (positionId) {
      // Get specific position
      const position = positionsStore.get(positionId);
      if (!position) {
        return NextResponse.json(
          { error: 'Position not found' },
          { status: 404 }
        );
      }
      
      // Update current values
      const { pnl, pnlPercent, currentPrice } = await calculatePnL(position);
      position.currentPrice = currentPrice;
      position.pnl = pnl;
      position.pnlPercent = pnlPercent;
      
      return NextResponse.json(position);
    }
    
    // Get all positions with filters
    let positions = Array.from(positionsStore.values());
    
    // Filter by status
    if (status) {
      positions = positions.filter(p => p.status === status);
    }
    
    // Filter by symbol
    if (symbol) {
      positions = positions.filter(p => p.symbol === symbol);
    }
    
    // Update current values for all positions
    const updatedPositions = await Promise.all(
      positions.map(async (position) => {
        const { pnl, pnlPercent, currentPrice } = await calculatePnL(position);
        return {
          ...position,
          currentPrice,
          pnl,
          pnlPercent
        };
      })
    );
    
    // Calculate summary statistics
    const openPositions = updatedPositions.filter(p => p.status === 'open');
    const totalPnL = openPositions.reduce((sum, p) => sum + p.pnl, 0);
    const totalValue = openPositions.reduce((sum, p) => sum + (p.amount * p.currentPrice), 0);
    
    return NextResponse.json({
      positions: updatedPositions,
      summary: {
        totalPositions: updatedPositions.length,
        openPositions: openPositions.length,
        totalPnL,
        totalValue,
        avgPnLPercent: openPositions.length > 0 
          ? openPositions.reduce((sum, p) => sum + p.pnlPercent, 0) / openPositions.length 
          : 0
      }
    });
    
  } catch (error) {
    console.error('Get positions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch positions' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create or update a position
 */
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    
    // Validate required fields
    if (!data.symbol || !data.side || !data.amount || !data.entryPrice) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Generate position ID if not provided
    const positionId = data.id || `pos-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Calculate initial PnL
    const { pnl, pnlPercent, currentPrice } = await calculatePnL({
      ...data,
      id: positionId,
      status: 'open'
    });
    
    // Create position object
    const position: Position = {
      id: positionId,
      symbol: data.symbol,
      side: data.side,
      amount: data.amount,
      entryPrice: data.entryPrice,
      currentPrice,
      pnl,
      pnlPercent,
      stopLoss: data.stopLoss,
      takeProfit: data.takeProfit,
      openedAt: data.openedAt || Date.now(),
      status: 'open',
      leverage: data.leverage || 1,
      margin: data.margin
    };
    
    // Store position
    positionsStore.set(positionId, position);
    
    return NextResponse.json({
      success: true,
      position
    });
    
  } catch (error) {
    console.error('Create position error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create position',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update a position (modify stop loss, take profit, etc.)
 */
export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const positionId = searchParams.get('id');
    
    if (!positionId) {
      return NextResponse.json(
        { error: 'Position ID required' },
        { status: 400 }
      );
    }
    
    const position = positionsStore.get(positionId);
    if (!position) {
      return NextResponse.json(
        { error: 'Position not found' },
        { status: 404 }
      );
    }
    
    const updates = await req.json();
    
    // Update allowed fields
    if (updates.stopLoss !== undefined) {
      position.stopLoss = updates.stopLoss;
    }
    if (updates.takeProfit !== undefined) {
      position.takeProfit = updates.takeProfit;
    }
    if (updates.amount !== undefined && updates.amount > 0) {
      position.amount = updates.amount;
    }
    
    // Recalculate PnL
    const { pnl, pnlPercent, currentPrice } = await calculatePnL(position);
    position.currentPrice = currentPrice;
    position.pnl = pnl;
    position.pnlPercent = pnlPercent;
    
    // Check if any triggers are hit
    const triggerCheck = checkTriggers(position, currentPrice);
    if (triggerCheck.triggered && updates.autoClose) {
      position.status = 'closed';
      position.closedAt = Date.now();
      position.currentPrice = triggerCheck.closePrice || currentPrice;
      
      // Recalculate final PnL
      if (position.side === 'long') {
        position.pnl = (position.currentPrice - position.entryPrice) * position.amount;
      } else {
        position.pnl = (position.entryPrice - position.currentPrice) * position.amount;
      }
      position.pnlPercent = (position.pnl / (position.entryPrice * position.amount)) * 100;
    }
    
    // Save updated position
    positionsStore.set(positionId, position);
    
    return NextResponse.json({
      success: true,
      position,
      triggered: triggerCheck.triggered ? triggerCheck.type : null
    });
    
  } catch (error) {
    console.error('Update position error:', error);
    return NextResponse.json(
      { error: 'Failed to update position' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Close a position
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const positionId = searchParams.get('id');
    const closeAll = searchParams.get('closeAll') === 'true';
    
    if (closeAll) {
      // Close all open positions
      const closedPositions: Position[] = [];
      
      for (const [id, position] of positionsStore.entries()) {
        if (position.status === 'open') {
          // Calculate final PnL
          const { pnl, pnlPercent, currentPrice } = await calculatePnL(position);
          
          position.status = 'closed';
          position.closedAt = Date.now();
          position.currentPrice = currentPrice;
          position.pnl = pnl;
          position.pnlPercent = pnlPercent;
          
          positionsStore.set(id, position);
          closedPositions.push(position);
        }
      }
      
      return NextResponse.json({
        success: true,
        closedPositions,
        totalClosed: closedPositions.length,
        totalPnL: closedPositions.reduce((sum, p) => sum + p.pnl, 0)
      });
    }
    
    if (!positionId) {
      return NextResponse.json(
        { error: 'Position ID required' },
        { status: 400 }
      );
    }
    
    const position = positionsStore.get(positionId);
    if (!position) {
      return NextResponse.json(
        { error: 'Position not found' },
        { status: 404 }
      );
    }
    
    if (position.status === 'closed') {
      return NextResponse.json(
        { error: 'Position already closed' },
        { status: 400 }
      );
    }
    
    // Calculate final PnL
    const { pnl, pnlPercent, currentPrice } = await calculatePnL(position);
    
    // Close position
    position.status = 'closed';
    position.closedAt = Date.now();
    position.currentPrice = currentPrice;
    position.pnl = pnl;
    position.pnlPercent = pnlPercent;
    
    positionsStore.set(positionId, position);
    
    return NextResponse.json({
      success: true,
      position,
      finalPnL: pnl,
      finalPnLPercent: pnlPercent
    });
    
  } catch (error) {
    console.error('Close position error:', error);
    return NextResponse.json(
      { error: 'Failed to close position' },
      { status: 500 }
    );
  }
}
