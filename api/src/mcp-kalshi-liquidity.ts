#!/usr/bin/env bun
/**
 * Kalshi Liquidity Heatmap & Analysis
 *
 * Visualize and analyze liquidity across all Kalshi markets.
 * Features:
 * - Real-time liquidity scoring
 * - Spread analysis and opportunity detection
 * - Volume profiling
 * - Market depth visualization data
 * - Easy money opportunity finder
 * - Liquidity alerts
 */

import { EventEmitter } from 'events';
import type { AggregatedMarketData, OrderbookUpdate } from './mcp-kalshi-streaming.js';

// ============================================================================
// Types
// ============================================================================

export interface LiquidityScore {
  ticker: string;
  overall: number;          // 0-100 composite score
  spread: number;           // Spread in cents
  spreadScore: number;      // 0-100 (lower spread = higher score)
  depth: number;            // Total contracts in orderbook
  depthScore: number;       // 0-100 (more depth = higher score)
  volume24h: number;        // 24h volume
  volumeScore: number;      // 0-100 (more volume = higher score)
  efficiency: number;       // Market efficiency score
  timestamp: number;
}

export interface SpreadOpportunity {
  ticker: string;
  title: string;
  spread: number;
  midPrice: number;
  yesBid: number;
  yesAsk: number;
  noBid: number;
  noAsk: number;
  depth: number;
  profitPotential: number;  // Expected profit from spread capture
  riskLevel: 'low' | 'medium' | 'high';
  category: string;
  timestamp: number;
}

export interface MarketDepthLevel {
  price: number;
  quantity: number;
  cumulative: number;
}

export interface MarketDepthProfile {
  ticker: string;
  yesBids: MarketDepthLevel[];
  yesAsks: MarketDepthLevel[];
  noBids: MarketDepthLevel[];
  noAsks: MarketDepthLevel[];
  imbalance: number;        // Positive = more buy pressure, negative = more sell
  wallPrice?: number;       // Price level with large resting order
  timestamp: number;
}

export interface VolumeProfile {
  ticker: string;
  hourlyVolume: number[];   // 24 hours of volume data
  avgHourlyVolume: number;
  peakHour: number;
  currentHourRatio: number; // Current hour vs average
  trend: 'increasing' | 'decreasing' | 'stable';
  timestamp: number;
}

export interface HeatmapCell {
  ticker: string;
  category: string;
  liquidityScore: number;
  spreadScore: number;
  volumeScore: number;
  color: string;            // Hex color for visualization
  size: number;             // Relative size for treemap
}

export interface LiquidityAlert {
  id: string;
  type: 'spread_widened' | 'spread_narrowed' | 'volume_spike' | 'depth_change' | 'opportunity';
  ticker: string;
  message: string;
  severity: 'info' | 'warning' | 'opportunity';
  data: Record<string, any>;
  timestamp: number;
}

// ============================================================================
// Liquidity Analyzer
// ============================================================================

export class LiquidityAnalyzer extends EventEmitter {
  private scores: Map<string, LiquidityScore> = new Map();
  private depthProfiles: Map<string, MarketDepthProfile> = new Map();
  private volumeProfiles: Map<string, VolumeProfile> = new Map();
  private alerts: LiquidityAlert[] = [];
  private opportunities: SpreadOpportunity[] = [];

  // Thresholds
  private spreadThreshold = 5;        // Cents - spreads wider than this are opportunities
  private depthThreshold = 100;       // Contracts - minimum depth for good liquidity
  private volumeThreshold = 50;       // Contracts - minimum 24h volume
  private opportunityMinSpread = 3;   // Minimum spread for opportunity alert

  private alertCounter = 0;
  private previousSpreads: Map<string, number> = new Map();

  constructor() {
    super();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Core Analysis
  // ─────────────────────────────────────────────────────────────────────────

  analyzeMarket(market: AggregatedMarketData): LiquidityScore {
    const spread = market.orderbook.spread;
    const depth = this.calculateTotalDepth(market);
    const volume24h = market.volume1m * 60 * 24; // Extrapolate from 1m

    // Calculate individual scores (0-100)
    const spreadScore = this.calculateSpreadScore(spread);
    const depthScore = this.calculateDepthScore(depth);
    const volumeScore = this.calculateVolumeScore(volume24h);
    const efficiency = this.calculateEfficiency(spread, depth, volume24h);

    // Composite score (weighted average)
    const overall = (
      spreadScore * 0.4 +
      depthScore * 0.3 +
      volumeScore * 0.2 +
      efficiency * 0.1
    );

    const score: LiquidityScore = {
      ticker: market.ticker,
      overall,
      spread,
      spreadScore,
      depth,
      depthScore,
      volume24h,
      volumeScore,
      efficiency,
      timestamp: Date.now(),
    };

    // Check for alerts
    this.checkForAlerts(market, score);

    // Store and emit
    this.scores.set(market.ticker, score);
    this.emit('score_updated', score);

    return score;
  }

  private calculateTotalDepth(market: AggregatedMarketData): number {
    const yesDepth = market.orderbook.yes.reduce((sum, level) => sum + level.quantity, 0);
    const noDepth = market.orderbook.no.reduce((sum, level) => sum + level.quantity, 0);
    return yesDepth + noDepth;
  }

  private calculateSpreadScore(spread: number): number {
    // Tighter spread = higher score
    // 1c spread = 100, 10c+ spread = 0
    return Math.max(0, Math.min(100, 100 - (spread - 1) * 11));
  }

  private calculateDepthScore(depth: number): number {
    // More depth = higher score
    // 0 contracts = 0, 500+ contracts = 100
    return Math.min(100, (depth / 500) * 100);
  }

  private calculateVolumeScore(volume24h: number): number {
    // More volume = higher score
    // 0 = 0, 1000+ = 100
    return Math.min(100, (volume24h / 1000) * 100);
  }

  private calculateEfficiency(spread: number, depth: number, volume: number): number {
    // Market efficiency: low spread, high depth, high volume
    if (depth === 0 || volume === 0) return 0;
    const turnover = volume / depth; // How often depth turns over
    const tightness = 10 / Math.max(1, spread); // Inverse of spread
    return Math.min(100, turnover * tightness * 10);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Depth Analysis
  // ─────────────────────────────────────────────────────────────────────────

  analyzeDepth(market: AggregatedMarketData): MarketDepthProfile {
    const yesBids = this.buildDepthLevels(market.orderbook.yes, true);
    const noBids = this.buildDepthLevels(market.orderbook.no, true);

    // Calculate imbalance
    const totalBidDepth = yesBids.reduce((sum, l) => sum + l.quantity, 0) +
                          noBids.reduce((sum, l) => sum + l.quantity, 0);

    // Imbalance based on which side has more depth near the mid
    const yesBidNearMid = yesBids.filter(l => l.price >= market.orderbook.midPrice - 5)
                                  .reduce((sum, l) => sum + l.quantity, 0);
    const noBidNearMid = noBids.filter(l => l.price >= (100 - market.orderbook.midPrice) - 5)
                                .reduce((sum, l) => sum + l.quantity, 0);

    const imbalance = totalBidDepth > 0
      ? ((yesBidNearMid - noBidNearMid) / totalBidDepth) * 100
      : 0;

    // Find wall (large resting order)
    const allLevels = [...yesBids, ...noBids];
    const avgQuantity = allLevels.reduce((sum, l) => sum + l.quantity, 0) / Math.max(1, allLevels.length);
    const wall = allLevels.find(l => l.quantity > avgQuantity * 3);

    const profile: MarketDepthProfile = {
      ticker: market.ticker,
      yesBids,
      yesAsks: [], // Would need ask data
      noBids,
      noAsks: [],
      imbalance,
      wallPrice: wall?.price,
      timestamp: Date.now(),
    };

    this.depthProfiles.set(market.ticker, profile);
    this.emit('depth_updated', profile);

    return profile;
  }

  private buildDepthLevels(orders: { price: number; quantity: number }[], isBid: boolean): MarketDepthLevel[] {
    const sorted = [...orders].sort((a, b) => isBid ? b.price - a.price : a.price - b.price);

    let cumulative = 0;
    return sorted.map(order => {
      cumulative += order.quantity;
      return {
        price: order.price,
        quantity: order.quantity,
        cumulative,
      };
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Opportunity Detection
  // ─────────────────────────────────────────────────────────────────────────

  findSpreadOpportunities(markets: AggregatedMarketData[]): SpreadOpportunity[] {
    this.opportunities = [];

    for (const market of markets) {
      const spread = market.orderbook.spread;

      if (spread >= this.opportunityMinSpread) {
        const yesBid = market.orderbook.yes[0]?.price || 0;
        const noBid = market.orderbook.no[0]?.price || 0;
        const yesAsk = 100 - noBid; // Implied ask
        const noAsk = 100 - yesBid; // Implied ask
        const depth = this.calculateTotalDepth(market);

        // Profit potential: capture half the spread on round trip
        const profitPotential = (spread / 2) * Math.min(10, depth / 10);

        // Risk level based on depth and spread stability
        let riskLevel: 'low' | 'medium' | 'high' = 'medium';
        if (depth > 200 && spread < 8) riskLevel = 'low';
        else if (depth < 50 || spread > 15) riskLevel = 'high';

        const opportunity: SpreadOpportunity = {
          ticker: market.ticker,
          title: market.ticker, // Would need market title lookup
          spread,
          midPrice: market.orderbook.midPrice,
          yesBid,
          yesAsk,
          noBid,
          noAsk,
          depth,
          profitPotential,
          riskLevel,
          category: this.categorizeMarket(market.ticker),
          timestamp: Date.now(),
        };

        this.opportunities.push(opportunity);
      }
    }

    // Sort by profit potential
    this.opportunities.sort((a, b) => b.profitPotential - a.profitPotential);

    this.emit('opportunities_updated', this.opportunities);
    return this.opportunities;
  }

  private categorizeMarket(ticker: string): string {
    // Simple categorization based on ticker prefix
    if (ticker.startsWith('KXBTC') || ticker.startsWith('KXETH')) return 'Crypto';
    if (ticker.includes('PRES') || ticker.includes('ELECT')) return 'Politics';
    if (ticker.includes('FED') || ticker.includes('RATE')) return 'Economics';
    if (ticker.includes('NFL') || ticker.includes('NBA') || ticker.includes('MLB')) return 'Sports';
    return 'Other';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Alerts
  // ─────────────────────────────────────────────────────────────────────────

  private checkForAlerts(market: AggregatedMarketData, score: LiquidityScore): void {
    const prevSpread = this.previousSpreads.get(market.ticker);
    this.previousSpreads.set(market.ticker, score.spread);

    if (prevSpread !== undefined) {
      // Spread change alerts
      const spreadChange = score.spread - prevSpread;

      if (spreadChange > 3) {
        this.createAlert('spread_widened', market.ticker, 'warning',
          `Spread widened from ${prevSpread}c to ${score.spread}c`,
          { prevSpread, newSpread: score.spread, change: spreadChange }
        );
      } else if (spreadChange < -3) {
        this.createAlert('spread_narrowed', market.ticker, 'info',
          `Spread narrowed from ${prevSpread}c to ${score.spread}c`,
          { prevSpread, newSpread: score.spread, change: spreadChange }
        );
      }
    }

    // Opportunity alerts
    if (score.spread >= this.spreadThreshold && score.depth >= this.depthThreshold) {
      this.createAlert('opportunity', market.ticker, 'opportunity',
        `Wide spread opportunity: ${score.spread}c spread with ${score.depth} contracts depth`,
        { spread: score.spread, depth: score.depth, score: score.overall }
      );
    }

    // Volume spike detection (would need historical comparison)
    if (market.volume1m > 100) {
      this.createAlert('volume_spike', market.ticker, 'info',
        `High volume detected: ${market.volume1m} contracts in last minute`,
        { volume1m: market.volume1m }
      );
    }
  }

  private createAlert(
    type: LiquidityAlert['type'],
    ticker: string,
    severity: LiquidityAlert['severity'],
    message: string,
    data: Record<string, any>
  ): void {
    const alert: LiquidityAlert = {
      id: `LA-${++this.alertCounter}`,
      type,
      ticker,
      message,
      severity,
      data,
      timestamp: Date.now(),
    };

    this.alerts.push(alert);
    this.emit('alert', alert);

    // Keep last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Heatmap Generation
  // ─────────────────────────────────────────────────────────────────────────

  generateHeatmap(): HeatmapCell[] {
    const cells: HeatmapCell[] = [];

    for (const [ticker, score] of Array.from(this.scores.entries())) {
      cells.push({
        ticker,
        category: this.categorizeMarket(ticker),
        liquidityScore: score.overall,
        spreadScore: score.spreadScore,
        volumeScore: score.volumeScore,
        color: this.scoreToColor(score.overall),
        size: Math.max(1, score.volumeScore), // Size based on volume
      });
    }

    // Sort by category then score
    cells.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return b.liquidityScore - a.liquidityScore;
    });

    return cells;
  }

  private scoreToColor(score: number): string {
    // Red (0) -> Yellow (50) -> Green (100)
    if (score <= 50) {
      // Red to Yellow
      const r = 255;
      const g = Math.round((score / 50) * 255);
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}00`;
    } else {
      // Yellow to Green
      const r = Math.round(((100 - score) / 50) * 255);
      const g = 255;
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}00`;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Summary Statistics
  // ─────────────────────────────────────────────────────────────────────────

  getSummary(): {
    totalMarkets: number;
    avgLiquidity: number;
    avgSpread: number;
    topLiquidMarkets: string[];
    widestSpreadMarkets: string[];
    opportunityCount: number;
    alertCount24h: number;
  } {
    const scores = Array.from(this.scores.values());

    if (scores.length === 0) {
      return {
        totalMarkets: 0,
        avgLiquidity: 0,
        avgSpread: 0,
        topLiquidMarkets: [],
        widestSpreadMarkets: [],
        opportunityCount: 0,
        alertCount24h: 0,
      };
    }

    const avgLiquidity = scores.reduce((sum, s) => sum + s.overall, 0) / scores.length;
    const avgSpread = scores.reduce((sum, s) => sum + s.spread, 0) / scores.length;

    const sortedByLiquidity = [...scores].sort((a, b) => b.overall - a.overall);
    const sortedBySpread = [...scores].sort((a, b) => b.spread - a.spread);

    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const alertCount24h = this.alerts.filter(a => a.timestamp >= dayAgo).length;

    return {
      totalMarkets: scores.length,
      avgLiquidity,
      avgSpread,
      topLiquidMarkets: sortedByLiquidity.slice(0, 5).map(s => s.ticker),
      widestSpreadMarkets: sortedBySpread.slice(0, 5).map(s => s.ticker),
      opportunityCount: this.opportunities.length,
      alertCount24h,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Getters
  // ─────────────────────────────────────────────────────────────────────────

  getScore(ticker: string): LiquidityScore | undefined {
    return this.scores.get(ticker);
  }

  getAllScores(): LiquidityScore[] {
    return Array.from(this.scores.values());
  }

  getDepthProfile(ticker: string): MarketDepthProfile | undefined {
    return this.depthProfiles.get(ticker);
  }

  getOpportunities(): SpreadOpportunity[] {
    return this.opportunities;
  }

  getAlerts(options: {
    type?: LiquidityAlert['type'];
    ticker?: string;
    severity?: LiquidityAlert['severity'];
    since?: number;
    limit?: number;
  } = {}): LiquidityAlert[] {
    let filtered = this.alerts;

    if (options.type) {
      filtered = filtered.filter(a => a.type === options.type);
    }
    if (options.ticker) {
      filtered = filtered.filter(a => a.ticker === options.ticker);
    }
    if (options.severity) {
      filtered = filtered.filter(a => a.severity === options.severity);
    }
    if (options.since) {
      filtered = filtered.filter(a => a.timestamp >= options.since);
    }

    filtered = filtered.sort((a, b) => b.timestamp - a.timestamp);

    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Configuration
  // ─────────────────────────────────────────────────────────────────────────

  setThresholds(thresholds: {
    spreadThreshold?: number;
    depthThreshold?: number;
    volumeThreshold?: number;
    opportunityMinSpread?: number;
  }): void {
    if (thresholds.spreadThreshold !== undefined) {
      this.spreadThreshold = thresholds.spreadThreshold;
    }
    if (thresholds.depthThreshold !== undefined) {
      this.depthThreshold = thresholds.depthThreshold;
    }
    if (thresholds.volumeThreshold !== undefined) {
      this.volumeThreshold = thresholds.volumeThreshold;
    }
    if (thresholds.opportunityMinSpread !== undefined) {
      this.opportunityMinSpread = thresholds.opportunityMinSpread;
    }
  }
}

// ============================================================================
// MCP Tools
// ============================================================================

export const LIQUIDITY_TOOLS = [
  {
    name: 'liquidity_analyze_market',
    description: 'Analyze liquidity for a specific market',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', description: 'Market ticker' },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'liquidity_heatmap',
    description: 'Get liquidity heatmap data for all markets',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filter by category (optional)' },
        min_score: { type: 'number', description: 'Minimum liquidity score (0-100)' },
      },
    },
  },
  {
    name: 'liquidity_opportunities',
    description: 'Find wide spread opportunities ("easy money" trades)',
    inputSchema: {
      type: 'object',
      properties: {
        min_spread: { type: 'number', description: 'Minimum spread in cents' },
        max_risk: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Maximum risk level' },
        limit: { type: 'number', description: 'Max opportunities to return' },
      },
    },
  },
  {
    name: 'liquidity_depth_profile',
    description: 'Get market depth profile showing bid/ask levels',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', description: 'Market ticker' },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'liquidity_alerts',
    description: 'Get liquidity alerts (spread changes, opportunities)',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['spread_widened', 'spread_narrowed', 'volume_spike', 'opportunity'] },
        ticker: { type: 'string', description: 'Filter by ticker' },
        severity: { type: 'string', enum: ['info', 'warning', 'opportunity'] },
        limit: { type: 'number', description: 'Max alerts to return' },
      },
    },
  },
  {
    name: 'liquidity_summary',
    description: 'Get overall liquidity summary across all markets',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'liquidity_top_markets',
    description: 'Get top markets by liquidity score',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of markets to return' },
        category: { type: 'string', description: 'Filter by category' },
      },
    },
  },
  {
    name: 'liquidity_worst_spreads',
    description: 'Get markets with widest spreads (potential opportunities)',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of markets to return' },
        min_depth: { type: 'number', description: 'Minimum depth to filter thin markets' },
      },
    },
  },
  {
    name: 'liquidity_set_thresholds',
    description: 'Configure liquidity analysis thresholds',
    inputSchema: {
      type: 'object',
      properties: {
        spread_threshold: { type: 'number', description: 'Spread threshold for opportunities (cents)' },
        depth_threshold: { type: 'number', description: 'Minimum depth for good liquidity' },
        volume_threshold: { type: 'number', description: 'Minimum 24h volume' },
      },
    },
  },
];

// ============================================================================
// Factory
// ============================================================================

export function createLiquidityAnalyzer(): LiquidityAnalyzer {
  return new LiquidityAnalyzer();
}
