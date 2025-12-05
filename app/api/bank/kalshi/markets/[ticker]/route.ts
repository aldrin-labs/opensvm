import { NextRequest, NextResponse } from 'next/server';
import {
  getMarket,
  getOrderbook,
  getEvent,
} from '@/lib/bank/kalshi-client';

/**
 * GET /api/bank/kalshi/markets/[ticker]
 * Get detailed market information
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;

    if (!ticker) {
      return NextResponse.json({ error: 'Ticker required' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const includeOrderbook = searchParams.get('orderbook') === 'true';
    const includeEvent = searchParams.get('event') === 'true';

    // Fetch market data
    const marketData = await getMarket(ticker);

    const response: Record<string, unknown> = {
      market: marketData.market,
    };

    // Optionally include orderbook
    if (includeOrderbook) {
      try {
        const orderbookData = await getOrderbook(ticker);
        response.orderbook = orderbookData.orderbook;
      } catch {
        response.orderbook = null;
      }
    }

    // Optionally include parent event
    if (includeEvent && marketData.market.event_ticker) {
      try {
        const eventData = await getEvent(marketData.market.event_ticker);
        response.event = eventData.event;
      } catch {
        response.event = null;
      }
    }

    // Calculate implied probabilities and other metrics
    const market = marketData.market;
    response.analytics = {
      yesImpliedProbability: market.yes_bid,
      noImpliedProbability: market.no_bid,
      spread: market.yes_ask - market.yes_bid,
      midPrice: (market.yes_bid + market.yes_ask) / 2,
      volumeUSD: (market.volume * market.last_price) / 100,
      openInterestUSD: (market.open_interest * market.last_price) / 100,
      timeToExpiry: new Date(market.expiration_time).getTime() - Date.now(),
      isExpired: new Date(market.expiration_time).getTime() < Date.now(),
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Kalshi market error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch market' },
      { status: 500 }
    );
  }
}
