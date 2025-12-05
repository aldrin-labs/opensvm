import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/api-auth/auth-server';
import { qdrantClient } from '@/lib/search/qdrant';
import { decryptPrivateKey } from '@/lib/bank/encryption';
import {
  authenticate,
  getBalance,
  getPositions,
  getMarket,
  getOrderbook,
  calculatePnL,
} from '@/lib/bank/kalshi-client';

const KALSHI_CREDENTIALS_COLLECTION = 'svm_bank_kalshi_credentials';

interface StoredCredentials {
  userWallet: string;
  encryptedEmail: string;
  encryptedPassword: string;
  memberId?: string;
  isDemo: boolean;
}

/**
 * Helper to get authenticated token
 */
async function getAuthToken(userWallet: string): Promise<string> {
  const results = await qdrantClient.scroll(KALSHI_CREDENTIALS_COLLECTION, {
    filter: {
      must: [{ key: 'userWallet', match: { value: userWallet } }]
    },
    limit: 1,
    with_payload: true
  });

  if (results.points.length === 0) {
    throw new Error('Kalshi account not connected');
  }

  const stored = results.points[0].payload as StoredCredentials;

  const email = Buffer.from(
    decryptPrivateKey(stored.encryptedEmail, userWallet)
  ).toString('utf-8');
  const password = Buffer.from(
    decryptPrivateKey(stored.encryptedPassword, userWallet)
  ).toString('utf-8');

  const auth = await authenticate({ email, password });
  return auth.token;
}

/**
 * GET /api/bank/kalshi/portfolio
 * Get portfolio balance, positions, and analytics
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookie();
    if (!session?.walletAddress) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'summary';

    const token = await getAuthToken(session.walletAddress);

    switch (action) {
      case 'summary': {
        // Get balance and positions
        const [balanceData, positionsData] = await Promise.all([
          getBalance(token),
          getPositions(token),
        ]);

        // Enrich positions with current prices and P&L
        const enrichedPositions = await Promise.all(
          (positionsData.market_positions || []).map(async (pos) => {
            try {
              const [marketData, orderbookData] = await Promise.all([
                getMarket(pos.ticker),
                getOrderbook(pos.ticker),
              ]);

              const market = marketData.market;
              const isYes = pos.position > 0;
              const currentPrice = isYes ? market.yes_bid : market.no_bid;
              const pnl = calculatePnL(
                pos.position,
                pos.average_cost,
                currentPrice
              );

              return {
                ...pos,
                market_title: market.title,
                market_status: market.status,
                expiration_time: market.expiration_time,
                current_price: currentPrice,
                yes_bid: market.yes_bid,
                yes_ask: market.yes_ask,
                no_bid: market.no_bid,
                no_ask: market.no_ask,
                pnl,
                side: isYes ? 'yes' : 'no',
                contracts: Math.abs(pos.position),
              };
            } catch {
              return {
                ...pos,
                error: 'Failed to fetch market data',
              };
            }
          })
        );

        // Calculate totals
        const totalUnrealizedPnL = enrichedPositions.reduce((sum, p) => {
          return sum + (p.pnl?.unrealized || 0);
        }, 0);

        const totalMaxProfit = enrichedPositions.reduce((sum, p) => {
          return sum + (p.pnl?.maxProfit || 0);
        }, 0);

        const totalMaxLoss = enrichedPositions.reduce((sum, p) => {
          return sum + (p.pnl?.maxLoss || 0);
        }, 0);

        return NextResponse.json({
          balance: {
            available: balanceData.balance / 100,
            portfolioValue: balanceData.portfolio_value / 100,
            total: (balanceData.balance + balanceData.portfolio_value) / 100,
          },
          positions: enrichedPositions,
          positionCount: enrichedPositions.length,
          analytics: {
            totalUnrealizedPnL,
            totalMaxProfit,
            totalMaxLoss,
            riskRewardRatio: totalMaxLoss > 0 ? totalMaxProfit / totalMaxLoss : 0,
          },
        });
      }

      case 'positions': {
        const positionsData = await getPositions(token);
        return NextResponse.json(positionsData);
      }

      case 'balance': {
        const balanceData = await getBalance(token);
        return NextResponse.json({
          available: balanceData.balance / 100,
          portfolioValue: balanceData.portfolio_value / 100,
          total: (balanceData.balance + balanceData.portfolio_value) / 100,
        });
      }

      case 'position': {
        const ticker = searchParams.get('ticker');
        if (!ticker) {
          return NextResponse.json({ error: 'Ticker required' }, { status: 400 });
        }

        const positionsData = await getPositions(token);
        const position = positionsData.market_positions?.find(p => p.ticker === ticker);

        if (!position) {
          return NextResponse.json({ error: 'Position not found' }, { status: 404 });
        }

        // Get market data
        const [marketData, orderbookData] = await Promise.all([
          getMarket(ticker),
          getOrderbook(ticker),
        ]);

        const market = marketData.market;
        const isYes = position.position > 0;
        const currentPrice = isYes ? market.yes_bid : market.no_bid;
        const pnl = calculatePnL(position.position, position.average_cost, currentPrice);

        return NextResponse.json({
          position: {
            ...position,
            market_title: market.title,
            market_status: market.status,
            expiration_time: market.expiration_time,
            current_price: currentPrice,
            yes_bid: market.yes_bid,
            yes_ask: market.yes_ask,
            no_bid: market.no_bid,
            no_ask: market.no_ask,
            pnl,
            side: isYes ? 'yes' : 'no',
            contracts: Math.abs(position.position),
          },
          orderbook: orderbookData.orderbook,
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Kalshi portfolio error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch portfolio' },
      { status: 500 }
    );
  }
}
