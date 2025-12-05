/**
 * DeFi Event Stream SSE Endpoint
 *
 * Real-time streaming of DeFi events:
 * - LP position updates
 * - IL warnings
 * - Cross-chain arbitrage opportunities
 * - Oracle price feeds
 *
 * GET /api/prediction-markets/defi-stream?filters=lp_position_update,arb_opportunity&chains=solana,polygon
 */

import { NextRequest } from 'next/server';

// Types matching the DeFi streaming module
type DeFiEventType =
  | 'lp_position_update'
  | 'lp_il_warning'
  | 'lp_breakeven_reached'
  | 'arb_opportunity'
  | 'arb_expired'
  | 'oracle_update'
  | 'oracle_divergence'
  | 'market_resolved'
  | 'liquidity_change'
  | 'heartbeat';

type Chain = 'solana' | 'polygon' | 'ethereum' | 'arbitrum';

interface DeFiEvent {
  type: DeFiEventType;
  timestamp: number;
  data: Record<string, unknown>;
  severity: 'info' | 'warning' | 'critical';
}

// In-memory state for demo (in production, use Redis or similar)
interface StreamState {
  subscribers: Map<string, {
    controller: ReadableStreamDefaultController;
    filters: DeFiEventType[];
    chains: Chain[];
  }>;
  mockInterval: NodeJS.Timeout | null;
}

const state: StreamState = {
  subscribers: new Map(),
  mockInterval: null,
};

// Generate mock events for demonstration
function generateMockEvent(): DeFiEvent | null {
  const eventTypes: DeFiEventType[] = [
    'lp_position_update',
    'lp_il_warning',
    'arb_opportunity',
    'oracle_update',
    'heartbeat',
  ];

  const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];
  const chains: Chain[] = ['solana', 'polygon'];
  const chain = chains[Math.floor(Math.random() * chains.length)];

  switch (type) {
    case 'lp_position_update':
      return {
        type,
        timestamp: Date.now(),
        severity: 'info',
        data: {
          positionId: `${chain}:drift:market_${Math.floor(Math.random() * 100)}`,
          chain,
          protocol: 'drift',
          market: 'Will BTC reach $100k by EOY?',
          currentValue: 1000 + Math.random() * 500,
          pnl: (Math.random() - 0.5) * 100,
          pnlPercent: (Math.random() - 0.5) * 10,
          impermanentLoss: Math.random() * 8,
          feesEarned: Math.random() * 50,
          apy: 10 + Math.random() * 40,
          yesPrice: 0.4 + Math.random() * 0.2,
          noPrice: 0.4 + Math.random() * 0.2,
        },
      };

    case 'lp_il_warning':
      const il = 5 + Math.random() * 10;
      return {
        type,
        timestamp: Date.now(),
        severity: il > 10 ? 'critical' : 'warning',
        data: {
          positionId: `${chain}:polymarket:market_${Math.floor(Math.random() * 100)}`,
          chain,
          protocol: 'polymarket',
          market: 'US Election 2024 Winner',
          impermanentLoss: il,
          feesEarned: Math.random() * 30,
          netPnl: (Math.random() - 0.5) * 100,
          recommendation: il > 10
            ? 'CONSIDER EXIT - IL exceeds fee earnings'
            : 'HOLD - Monitor closely',
        },
      };

    case 'arb_opportunity':
      const divergence = 0.03 + Math.random() * 0.07;
      const netProfit = divergence * 1000 - 15; // $1000 trade - $15 bridge
      return {
        type,
        timestamp: Date.now(),
        severity: netProfit >= 50 ? 'critical' : netProfit >= 20 ? 'warning' : 'info',
        data: {
          market: 'Fed Rate Decision December 2024',
          buyChain: 'solana',
          buyProtocol: 'drift',
          buyPrice: 0.45,
          sellChain: 'polygon',
          sellProtocol: 'polymarket',
          sellPrice: 0.45 + divergence,
          priceDivergence: divergence,
          estimatedProfit: divergence * 1000,
          bridgeCost: 5,
          netProfit,
          executable: netProfit > 0,
          strategy: `Buy YES on solana/drift @ ${(0.45 * 100).toFixed(1)}%, Sell on polygon/polymarket @ ${((0.45 + divergence) * 100).toFixed(1)}%`,
        },
      };

    case 'oracle_update':
      return {
        type,
        timestamp: Date.now(),
        severity: 'info',
        data: {
          marketAddress: `0x${Math.random().toString(16).slice(2, 10)}`,
          source: ['pyth', 'switchboard', 'chainlink'][Math.floor(Math.random() * 3)],
          yesPrice: 0.4 + Math.random() * 0.2,
          noPrice: 0.4 + Math.random() * 0.2,
          confidence: 0.9 + Math.random() * 0.1,
        },
      };

    case 'heartbeat':
      return {
        type,
        timestamp: Date.now(),
        severity: 'info',
        data: {
          subscribers: state.subscribers.size,
          uptime: Math.floor(Math.random() * 86400),
        },
      };

    default:
      return null;
  }
}

// Start mock event generation
function startMockEvents() {
  if (state.mockInterval) return;

  state.mockInterval = setInterval(() => {
    if (state.subscribers.size === 0) return;

    const event = generateMockEvent();
    if (!event) return;

    // Send to all matching subscribers
    for (const [id, sub] of Array.from(state.subscribers.entries())) {
      // Check event type filter
      if (sub.filters.length > 0 && !sub.filters.includes(event.type)) {
        continue;
      }
      // Check chain filter
      const eventChain = (event.data as Record<string, unknown>).chain as Chain | undefined;
      if (sub.chains.length > 0 && eventChain && !sub.chains.includes(eventChain)) {
        continue;
      }

      try {
        const encoder = new TextEncoder();
        sub.controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      } catch {
        // Controller closed, remove subscriber
        state.subscribers.delete(id);
      }
    }
  }, 5000); // Generate event every 5 seconds
}

// Stop mock events when no subscribers
function stopMockEventsIfEmpty() {
  if (state.subscribers.size === 0 && state.mockInterval) {
    clearInterval(state.mockInterval);
    state.mockInterval = null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Parse filters
  const filterParam = searchParams.get('filters') || '';
  const filters = filterParam
    ? (filterParam.split(',') as DeFiEventType[])
    : [];

  // Parse chains
  const chainParam = searchParams.get('chains') || '';
  const chains = chainParam
    ? (chainParam.split(',') as Chain[])
    : [];

  const subscriberId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Register subscriber
      state.subscribers.set(subscriberId, {
        controller,
        filters,
        chains,
      });

      // Start mock events if first subscriber
      startMockEvents();

      // Send initial connection message
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({
          type: 'connected',
          timestamp: Date.now(),
          subscriberId,
          filters: filters.length > 0 ? filters : 'all',
          chains: chains.length > 0 ? chains : 'all',
        })}\n\n`)
      );
    },
    cancel() {
      // Remove subscriber
      state.subscribers.delete(subscriberId);
      stopMockEventsIfEmpty();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

// Configuration endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    return Response.json({
      message: 'DeFi Stream Configuration',
      currentSubscribers: state.subscribers.size,
      availableFilters: [
        'lp_position_update',
        'lp_il_warning',
        'lp_breakeven_reached',
        'arb_opportunity',
        'arb_expired',
        'oracle_update',
        'oracle_divergence',
        'heartbeat',
      ],
      availableChains: ['solana', 'polygon', 'ethereum', 'arbitrum'],
      usage: {
        subscribe: 'GET /api/prediction-markets/defi-stream',
        withFilters: 'GET /api/prediction-markets/defi-stream?filters=lp_position_update,arb_opportunity',
        withChains: 'GET /api/prediction-markets/defi-stream?chains=solana,polygon',
      },
    });
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
}
