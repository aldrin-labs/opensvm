#!/usr/bin/env bun
/**
 * Prediction Markets DeFi Streaming Module
 *
 * Real-time SSE streaming for:
 * 1. LP Position Updates - IL changes, fee accumulation, APY changes
 * 2. Cross-Chain Arbitrage Alerts - New opportunities, price divergence
 * 3. Oracle Price Feeds - Real-time price updates from multiple sources
 * 4. Market Events - Resolution, large trades, liquidity changes
 */

import {
  LPAnalytics,
  CrossChainArbitrage,
  OracleNetwork,
  type LPPosition,
  type CrossChainOpportunity,
  type OracleUpdate,
  type Chain,
} from './prediction-defi.js';

// ============================================================================
// Types
// ============================================================================

export type DeFiEventType =
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

export interface DeFiEvent {
  type: DeFiEventType;
  timestamp: number;
  data: any;
  severity: 'info' | 'warning' | 'critical';
}

export interface StreamConfig {
  lpPositionInterval: number;  // ms between LP position updates
  arbScanInterval: number;     // ms between arbitrage scans
  oracleInterval: number;      // ms between oracle checks
  ilWarningThreshold: number;  // IL % to trigger warning
  arbMinProfit: number;        // minimum profit for arb alerts
}

export interface Subscriber {
  id: string;
  callback: (event: DeFiEvent) => void;
  filters: DeFiEventType[];
  chains?: Chain[];
}

// ============================================================================
// DeFi Event Stream
// ============================================================================

export class DeFiEventStream {
  private lpAnalytics: LPAnalytics;
  private crossChainArb: CrossChainArbitrage;
  private oracleNetwork: OracleNetwork;
  private subscribers: Map<string, Subscriber> = new Map();
  private intervals: NodeJS.Timeout[] = [];
  private running = false;
  private lastArbOpportunities: Map<string, CrossChainOpportunity> = new Map();
  private config: StreamConfig;

  constructor(
    lpAnalytics: LPAnalytics,
    crossChainArb: CrossChainArbitrage,
    oracleNetwork: OracleNetwork,
    config?: Partial<StreamConfig>
  ) {
    this.lpAnalytics = lpAnalytics;
    this.crossChainArb = crossChainArb;
    this.oracleNetwork = oracleNetwork;
    this.config = {
      lpPositionInterval: 30000,   // 30 seconds
      arbScanInterval: 60000,      // 1 minute
      oracleInterval: 15000,       // 15 seconds
      ilWarningThreshold: 5,       // 5% IL warning
      arbMinProfit: 10,            // $10 minimum profit
      ...config,
    };
  }

  // Subscribe to events
  subscribe(
    callback: (event: DeFiEvent) => void,
    filters: DeFiEventType[] = [],
    chains?: Chain[]
  ): string {
    const id = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.subscribers.set(id, {
      id,
      callback,
      filters: filters.length > 0 ? filters : ['lp_position_update', 'lp_il_warning', 'arb_opportunity', 'oracle_update'],
      chains,
    });
    return id;
  }

  // Unsubscribe
  unsubscribe(id: string): boolean {
    return this.subscribers.delete(id);
  }

  // Emit event to subscribers
  private emit(event: DeFiEvent): void {
    for (const subscriber of Array.from(this.subscribers.values())) {
      // Filter by event type
      if (subscriber.filters.length > 0 && !subscriber.filters.includes(event.type)) {
        continue;
      }
      // Filter by chain if specified
      if (subscriber.chains && event.data?.chain && !subscriber.chains.includes(event.data.chain)) {
        continue;
      }
      try {
        subscriber.callback(event);
      } catch (e) {
        console.error(`Error in subscriber ${subscriber.id}:`, e);
      }
    }
  }

  // Start streaming
  start(): void {
    if (this.running) return;
    this.running = true;

    // LP Position Updates
    this.intervals.push(
      setInterval(() => this.checkLPPositions(), this.config.lpPositionInterval)
    );

    // Arbitrage Scanning
    this.intervals.push(
      setInterval(() => this.scanArbitrage(), this.config.arbScanInterval)
    );

    // Heartbeat
    this.intervals.push(
      setInterval(() => {
        this.emit({
          type: 'heartbeat',
          timestamp: Date.now(),
          data: {
            subscribers: this.subscribers.size,
            lpPositions: this.lpAnalytics.getAllPositions().length,
          },
          severity: 'info',
        });
      }, 60000)
    );

    console.error('[DeFi Stream] Started');
  }

  // Stop streaming
  stop(): void {
    this.running = false;
    this.intervals.forEach(clearInterval);
    this.intervals = [];
    console.error('[DeFi Stream] Stopped');
  }

  // Check LP positions for updates
  private async checkLPPositions(): Promise<void> {
    const positions = this.lpAnalytics.getAllPositions();

    for (const position of positions) {
      // Check for IL warning
      if (position.impermanentLoss >= this.config.ilWarningThreshold) {
        this.emit({
          type: 'lp_il_warning',
          timestamp: Date.now(),
          data: {
            positionId: position.id,
            chain: position.chain,
            protocol: position.protocol,
            market: position.marketTitle,
            impermanentLoss: position.impermanentLoss,
            feesEarned: position.feesEarned,
            netPnl: position.pnl,
            recommendation: position.feesEarned > (position.totalValue * position.impermanentLoss / 100)
              ? 'HOLD - Fees exceed IL'
              : 'CONSIDER EXIT - IL exceeds fee earnings',
          },
          severity: position.impermanentLoss >= 10 ? 'critical' : 'warning',
        });
      }

      // Check for breakeven
      const daysHeld = (Date.now() - position.createdAt) / (1000 * 60 * 60 * 24);
      const dailyFeeRate = position.feesEarned / daysHeld;
      const ilInDollars = position.totalValue * (position.impermanentLoss / 100);

      if (position.feesEarned >= ilInDollars && ilInDollars > 0) {
        this.emit({
          type: 'lp_breakeven_reached',
          timestamp: Date.now(),
          data: {
            positionId: position.id,
            chain: position.chain,
            protocol: position.protocol,
            market: position.marketTitle,
            feesEarned: position.feesEarned,
            impermanentLoss: ilInDollars,
            daysToBreakeven: daysHeld,
            projectedMonthlyYield: dailyFeeRate * 30,
          },
          severity: 'info',
        });
      }

      // Regular position update
      this.emit({
        type: 'lp_position_update',
        timestamp: Date.now(),
        data: {
          positionId: position.id,
          chain: position.chain,
          protocol: position.protocol,
          market: position.marketTitle.slice(0, 50),
          currentValue: position.totalValue,
          pnl: position.pnl,
          pnlPercent: position.pnlPercent,
          impermanentLoss: position.impermanentLoss,
          feesEarned: position.feesEarned,
          apy: position.apy,
          yesPrice: position.currentYesPrice,
          noPrice: position.currentNoPrice,
        },
        severity: 'info',
      });
    }
  }

  // Scan for arbitrage opportunities
  private async scanArbitrage(): Promise<void> {
    try {
      const opportunities = await this.crossChainArb.findOpportunities(this.config.arbMinProfit);
      const currentOpps = new Map<string, CrossChainOpportunity>();

      for (const opp of opportunities) {
        const key = `${opp.chain1.marketAddress}-${opp.chain2.marketAddress}`;
        currentOpps.set(key, opp);

        // Check if this is a new opportunity
        const existing = this.lastArbOpportunities.get(key);
        if (!existing) {
          this.emit({
            type: 'arb_opportunity',
            timestamp: Date.now(),
            data: {
              market: opp.marketTitle,
              buyChain: opp.chain1.chain,
              buyProtocol: opp.chain1.protocol,
              buyPrice: opp.chain1.yesPrice,
              sellChain: opp.chain2.chain,
              sellProtocol: opp.chain2.protocol,
              sellPrice: opp.chain2.yesPrice,
              priceDivergence: opp.priceDivergence,
              estimatedProfit: opp.estimatedProfit,
              bridgeCost: opp.bridgeCost,
              netProfit: opp.netProfit,
              executable: opp.executable,
              strategy: opp.strategy,
            },
            severity: opp.netProfit >= 50 ? 'critical' : opp.netProfit >= 20 ? 'warning' : 'info',
          });
        }
      }

      // Check for expired opportunities
      for (const [key, opp] of Array.from(this.lastArbOpportunities.entries())) {
        if (!currentOpps.has(key)) {
          this.emit({
            type: 'arb_expired',
            timestamp: Date.now(),
            data: {
              market: opp.marketTitle,
              buyChain: opp.chain1.chain,
              sellChain: opp.chain2.chain,
              reason: 'Price divergence closed',
            },
            severity: 'info',
          });
        }
      }

      this.lastArbOpportunities = currentOpps;
    } catch (e) {
      console.error('[DeFi Stream] Arbitrage scan error:', e);
    }
  }

  // Record and stream oracle update
  recordOracleUpdate(
    marketAddress: string,
    source: string,
    yesPrice: number,
    noPrice: number,
    confidence: number
  ): void {
    const update = this.oracleNetwork.recordUpdate(
      marketAddress,
      source,
      yesPrice,
      noPrice,
      confidence
    );

    this.emit({
      type: 'oracle_update',
      timestamp: Date.now(),
      data: {
        marketAddress: update.marketAddress,
        source: update.source,
        yesPrice: update.yesPrice,
        noPrice: update.noPrice,
        confidence: update.confidence,
      },
      severity: 'info',
    });

    // Check for oracle divergence
    const aggregated = this.oracleNetwork.getAggregatedPrice(marketAddress);
    if (aggregated && aggregated.sources >= 2) {
      const divergence = Math.abs(yesPrice - aggregated.yesPrice);
      if (divergence > 0.05) { // 5% divergence
        this.emit({
          type: 'oracle_divergence',
          timestamp: Date.now(),
          data: {
            marketAddress,
            reportingSource: source,
            reportedPrice: yesPrice,
            aggregatedPrice: aggregated.yesPrice,
            divergence,
            confidence: aggregated.confidence,
          },
          severity: divergence > 0.1 ? 'critical' : 'warning',
        });
      }
    }
  }

  // Get current stream stats
  getStats(): {
    running: boolean;
    subscribers: number;
    lpPositions: number;
    activeArbs: number;
    config: StreamConfig;
  } {
    return {
      running: this.running,
      subscribers: this.subscribers.size,
      lpPositions: this.lpAnalytics.getAllPositions().length,
      activeArbs: this.lastArbOpportunities.size,
      config: this.config,
    };
  }
}

// ============================================================================
// SSE Response Generator
// ============================================================================

export function createSSEResponse(stream: DeFiEventStream, filters?: DeFiEventType[], chains?: Chain[]): Response {
  const encoder = new TextEncoder();

  let subscriberId: string | null = null;

  const readable = new ReadableStream({
    start(controller) {
      // Send initial connection message
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`));

      // Subscribe to events
      subscriberId = stream.subscribe(
        (event) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          } catch {
            // Stream closed
          }
        },
        filters,
        chains
      );
    },
    cancel() {
      if (subscriberId) {
        stream.unsubscribe(subscriberId);
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
