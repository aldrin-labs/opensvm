// Binance-compatible Account endpoint
// GET /api/v3/account - Get account information

import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/solana/solana-connection-server';
import { getDexAggregator } from '@/lib/trading/dex-aggregator';
import { getOrderManager } from '@/lib/trading/order-manager';
import { AccountInfo, BinanceError } from '@/lib/trading/binance-types';

export const runtime = 'nodejs';

function getServices() {
  const connection = getConnection();
  const aggregator = getDexAggregator(connection);
  const orderManager = getOrderManager(connection, aggregator);
  return { orderManager };
}

// GET - Get account information
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json(
        { code: -1102, msg: 'Mandatory parameter \'walletAddress\' was not sent.' } as BinanceError,
        { status: 400 }
      );
    }

    // Validate wallet address format (basic Solana public key check)
    if (walletAddress.length < 32 || walletAddress.length > 44) {
      return NextResponse.json(
        { code: -1102, msg: 'Invalid wallet address format.' } as BinanceError,
        { status: 400 }
      );
    }

    const { orderManager } = getServices();

    // Get wallet balances
    const balances = await orderManager.getAccountBalances(walletAddress);

    const accountInfo: AccountInfo = {
      makerCommission: 10,  // 0.1%
      takerCommission: 10,  // 0.1%
      buyerCommission: 0,
      sellerCommission: 0,
      canTrade: true,
      canWithdraw: true,
      canDeposit: true,
      updateTime: Date.now(),
      accountType: 'SPOT',
      balances,
      permissions: ['SPOT'],
      walletAddress,
    };

    return NextResponse.json(accountInfo);
  } catch (error) {
    console.error('Account query error:', error);
    return NextResponse.json(
      {
        code: -1000,
        msg: error instanceof Error ? error.message : 'Unknown error occurred',
      } as BinanceError,
      { status: 500 }
    );
  }
}
