#!/usr/bin/env bun
/**
 * Kalshi Multi-Agent Competition Framework
 *
 * Runs multiple trading agents with different strategies competing
 * on the same markets. Features:
 * - Agent registration with unique configurations
 * - Shared market data feed
 * - Isolated paper trading accounts per agent
 * - Real-time leaderboard and rankings
 * - Performance comparison and analysis
 * - Genetic algorithm for strategy evolution
 * - Tournament modes (elimination, round-robin)
 */

import { EventEmitter } from 'events';
import {
  KalshiWebSocketClient,
  MarketDataAggregator,
  createStreamingClient,
} from './mcp-kalshi-streaming.js';
import {
  KalshiTradingAgent,
  type AgentConfig,
  type Strategy,
  type Signal,
  MeanReversionStrategy,
  MomentumStrategy,
  SpreadStrategy,
  ArbitrageStrategy,
  DEFAULT_AGENT_CONFIG,
} from './mcp-kalshi-agent.js';
import {
  PaperTradingEngine,
  type PaperTradingConfig,
  type PerformanceMetrics,
  DEFAULT_PAPER_CONFIG,
} from './mcp-kalshi-paper-trading.js';

// ============================================================================
// Types
// ============================================================================

export interface CompetitorConfig {
  id: string;
  name: string;
  strategy: Strategy | Strategy[];
  agentConfig: Partial<AgentConfig>;
  paperConfig: Partial<PaperTradingConfig>;
  enabled: boolean;
}

export interface CompetitorState {
  id: string;
  name: string;
  status: 'running' | 'paused' | 'stopped' | 'eliminated';
  balance: number;
  equity: number;
  pnl: number;
  pnlPercent: number;
  positions: number;
  trades: number;
  winRate: number;
  sharpe: number;
  maxDrawdown: number;
  rank: number;
  score: number;
}

export interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  equity: number;
  pnlPercent: number;
  sharpe: number;
  winRate: number;
  trades: number;
  score: number;
  trend: 'up' | 'down' | 'stable';
  previousRank: number;
}

export interface CompetitionConfig {
  name: string;
  mode: 'continuous' | 'timed' | 'elimination' | 'tournament';
  duration?: number;              // Duration in milliseconds (for timed mode)
  eliminationThreshold?: number;  // Equity % below start to eliminate
  roundDuration?: number;         // Duration per round (tournament mode)
  rounds?: number;                // Number of rounds (tournament mode)
  markets: string[];              // Markets to trade
  startingBalance: number;        // Starting balance for all competitors
  scoreWeights: {
    returns: number;
    sharpe: number;
    winRate: number;
    consistency: number;
  };
}

export interface CompetitionResult {
  competitionId: string;
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  winner: CompetitorState;
  finalLeaderboard: LeaderboardEntry[];
  marketsSummary: {
    ticker: string;
    totalVolume: number;
    priceChange: number;
  }[];
  statistics: {
    totalTrades: number;
    totalVolume: number;
    avgReturn: number;
    bestReturn: number;
    worstReturn: number;
  };
}

// ============================================================================
// Competition Engine
// ============================================================================

export class CompetitionEngine extends EventEmitter {
  private config: CompetitionConfig;
  private wsClient: KalshiWebSocketClient;
  private aggregator: MarketDataAggregator;

  private competitors: Map<string, {
    config: CompetitorConfig;
    paperEngine: PaperTradingEngine;
    strategies: Strategy[];
    state: CompetitorState;
  }> = new Map();

  private leaderboard: LeaderboardEntry[] = [];
  private previousRanks: Map<string, number> = new Map();

  private status: 'idle' | 'running' | 'paused' | 'finished' = 'idle';
  private startTime = 0;
  private endTime = 0;
  private competitionId: string;
  private updateInterval?: ReturnType<typeof setInterval>;
  private analysisInterval?: ReturnType<typeof setInterval>;

  constructor(config: CompetitionConfig) {
    super();
    this.config = config;
    this.competitionId = `COMP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Create shared market data infrastructure
    const { wsClient, aggregator } = createStreamingClient();
    this.wsClient = wsClient;
    this.aggregator = aggregator;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Competitor Management
  // ─────────────────────────────────────────────────────────────────────────

  registerCompetitor(config: CompetitorConfig): void {
    if (this.status === 'running') {
      throw new Error('Cannot register competitors while competition is running');
    }

    // Create paper trading engine for this competitor
    const paperEngine = new PaperTradingEngine(
      {
        ...DEFAULT_PAPER_CONFIG,
        startingBalance: this.config.startingBalance,
        ...config.paperConfig,
      },
      this.wsClient,
      this.aggregator
    );

    // Convert single strategy to array
    const strategies = Array.isArray(config.strategy) ? config.strategy : [config.strategy];

    const state: CompetitorState = {
      id: config.id,
      name: config.name,
      status: 'stopped',
      balance: this.config.startingBalance,
      equity: this.config.startingBalance,
      pnl: 0,
      pnlPercent: 0,
      positions: 0,
      trades: 0,
      winRate: 0,
      sharpe: 0,
      maxDrawdown: 0,
      rank: 0,
      score: 0,
    };

    this.competitors.set(config.id, {
      config,
      paperEngine,
      strategies,
      state,
    });

    // Setup event listeners
    paperEngine.on('fill', (data) => {
      this.emit('competitor_trade', { competitorId: config.id, ...data });
    });

    paperEngine.on('position_opened', (position) => {
      this.emit('competitor_position', { competitorId: config.id, action: 'open', position });
    });

    paperEngine.on('position_closed', (position) => {
      this.emit('competitor_position', { competitorId: config.id, action: 'close', position });
    });

    this.emit('competitor_registered', { id: config.id, name: config.name });
  }

  unregisterCompetitor(id: string): boolean {
    if (this.status === 'running') {
      throw new Error('Cannot unregister competitors while competition is running');
    }

    return this.competitors.delete(id);
  }

  getCompetitors(): CompetitorState[] {
    return Array.from(this.competitors.values()).map(c => c.state);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Competition Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.status === 'running') return;
    if (this.competitors.size < 2) {
      throw new Error('Need at least 2 competitors to start');
    }

    this.status = 'running';
    this.startTime = Date.now();

    // Connect to market data
    await this.wsClient.connect();

    // Subscribe to markets
    this.aggregator.subscribe(this.config.markets);

    // Start all competitors
    for (const competitor of Array.from(this.competitors.values())) {
      competitor.state.status = 'running';
    }

    // Start update loop
    this.updateInterval = setInterval(() => {
      this.updateStates();
      this.updateLeaderboard();
      this.checkEliminations();
    }, 1000);

    // Start analysis loop (generate signals)
    this.analysisInterval = setInterval(() => {
      this.runAnalysis();
    }, 500);

    // Set end timer for timed mode
    if (this.config.mode === 'timed' && this.config.duration) {
      setTimeout(() => {
        this.finish();
      }, this.config.duration);
    }

    this.emit('competition_started', {
      id: this.competitionId,
      name: this.config.name,
      competitors: this.competitors.size,
      markets: this.config.markets,
    });
  }

  pause(): void {
    if (this.status !== 'running') return;

    this.status = 'paused';
    for (const competitor of Array.from(this.competitors.values())) {
      if (competitor.state.status === 'running') {
        competitor.state.status = 'paused';
      }
    }

    this.emit('competition_paused');
  }

  resume(): void {
    if (this.status !== 'paused') return;

    this.status = 'running';
    for (const competitor of Array.from(this.competitors.values())) {
      if (competitor.state.status === 'paused') {
        competitor.state.status = 'running';
      }
    }

    this.emit('competition_resumed');
  }

  finish(): CompetitionResult {
    this.status = 'finished';
    this.endTime = Date.now();

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }

    // Final update
    this.updateStates();
    this.updateLeaderboard();

    // Disconnect WebSocket
    this.wsClient.disconnect();

    const result = this.generateResult();
    this.emit('competition_finished', result);

    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Analysis & Trading
  // ─────────────────────────────────────────────────────────────────────────

  private runAnalysis(): void {
    if (this.status !== 'running') return;

    for (const ticker of this.config.markets) {
      const marketData = this.aggregator.getMarketData(ticker);
      if (!marketData) continue;

      // Each competitor analyzes independently
      for (const competitor of Array.from(this.competitors.values())) {
        if (competitor.state.status !== 'running') continue;

        this.analyzeForCompetitor(competitor, marketData);
      }
    }
  }

  private analyzeForCompetitor(
    competitor: {
      config: CompetitorConfig;
      paperEngine: PaperTradingEngine;
      strategies: Strategy[];
      state: CompetitorState;
    },
    market: any
  ): void {
    const positions = competitor.paperEngine.getPositions();

    for (const strategy of competitor.strategies) {
      const signal = strategy.analyze(market, positions as any);
      if (!signal) continue;

      // Only act on strong signals
      if (signal.strength >= 60 && signal.confidence >= 60) {
        this.executeSignal(competitor, signal);
      }
    }
  }

  private async executeSignal(
    competitor: {
      config: CompetitorConfig;
      paperEngine: PaperTradingEngine;
      state: CompetitorState;
    },
    signal: Signal
  ): Promise<void> {
    const marketData = this.aggregator.getMarketData(signal.ticker);
    if (!marketData) return;

    const price = signal.side === 'yes'
      ? marketData.orderbook.yes[0]?.price || 50
      : marketData.orderbook.no[0]?.price || 50;

    // Calculate position size based on signal strength
    const maxPosition = competitor.config.agentConfig.maxTradeSize || 10;
    const quantity = Math.ceil((signal.strength / 100) * maxPosition);

    try {
      await competitor.paperEngine.submitOrder({
        ticker: signal.ticker,
        side: signal.side,
        action: signal.type === 'buy' ? 'buy' : 'sell',
        type: 'limit',
        quantity,
        price,
      });
    } catch (error) {
      // Order validation failed, ignore
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // State Management
  // ─────────────────────────────────────────────────────────────────────────

  private updateStates(): void {
    for (const competitor of Array.from(this.competitors.values())) {
      const metrics = competitor.paperEngine.getMetrics();
      const equity = competitor.paperEngine.getEquity();
      const balance = competitor.paperEngine.getBalance();

      competitor.state.balance = balance;
      competitor.state.equity = equity;
      competitor.state.pnl = equity - this.config.startingBalance;
      competitor.state.pnlPercent = (competitor.state.pnl / this.config.startingBalance) * 100;
      competitor.state.positions = competitor.paperEngine.getPositions().length;
      competitor.state.trades = metrics.totalTrades;
      competitor.state.winRate = metrics.winRate;
      competitor.state.sharpe = metrics.sharpeRatio;
      competitor.state.maxDrawdown = metrics.maxDrawdownPercent;
      competitor.state.score = this.calculateScore(competitor.state, metrics);
    }
  }

  private calculateScore(state: CompetitorState, metrics: PerformanceMetrics): number {
    const weights = this.config.scoreWeights;

    // Normalize metrics to 0-100 scale
    const normalizedReturn = Math.min(100, Math.max(-100, state.pnlPercent * 10));
    const normalizedSharpe = Math.min(100, Math.max(0, metrics.sharpeRatio * 33));
    const normalizedWinRate = metrics.winRate;
    const normalizedConsistency = 100 - Math.min(100, metrics.maxDrawdownPercent * 2);

    return (
      normalizedReturn * weights.returns +
      normalizedSharpe * weights.sharpe +
      normalizedWinRate * weights.winRate +
      normalizedConsistency * weights.consistency
    );
  }

  private updateLeaderboard(): void {
    // Store previous ranks
    for (const entry of this.leaderboard) {
      this.previousRanks.set(entry.id, entry.rank);
    }

    // Sort competitors by score
    const sorted = Array.from(this.competitors.values())
      .filter(c => c.state.status !== 'eliminated')
      .sort((a, b) => b.state.score - a.state.score);

    this.leaderboard = sorted.map((c, index) => {
      const previousRank = this.previousRanks.get(c.config.id) || index + 1;
      const currentRank = index + 1;

      c.state.rank = currentRank;

      return {
        rank: currentRank,
        id: c.config.id,
        name: c.config.name,
        equity: c.state.equity,
        pnlPercent: c.state.pnlPercent,
        sharpe: c.state.sharpe,
        winRate: c.state.winRate,
        trades: c.state.trades,
        score: c.state.score,
        trend: currentRank < previousRank ? 'up' : currentRank > previousRank ? 'down' : 'stable',
        previousRank,
      };
    });

    this.emit('leaderboard_updated', this.leaderboard);
  }

  private checkEliminations(): void {
    if (this.config.mode !== 'elimination' || !this.config.eliminationThreshold) {
      return;
    }

    for (const competitor of Array.from(this.competitors.values())) {
      if (competitor.state.status === 'eliminated') continue;

      const dropPercent = -competitor.state.pnlPercent;
      if (dropPercent >= this.config.eliminationThreshold) {
        competitor.state.status = 'eliminated';
        this.emit('competitor_eliminated', {
          id: competitor.config.id,
          name: competitor.config.name,
          finalEquity: competitor.state.equity,
          pnlPercent: competitor.state.pnlPercent,
        });
      }
    }

    // Check if only one competitor remains
    const remaining = Array.from(this.competitors.values())
      .filter(c => c.state.status !== 'eliminated');

    if (remaining.length <= 1) {
      this.finish();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Results
  // ─────────────────────────────────────────────────────────────────────────

  private generateResult(): CompetitionResult {
    const winner = this.leaderboard[0];
    const winnerState = this.competitors.get(winner.id)!.state;

    // Calculate market summaries
    const marketsSummary = this.config.markets.map(ticker => {
      const data = this.aggregator.getMarketData(ticker);
      return {
        ticker,
        totalVolume: data?.volume1m || 0,
        priceChange: data?.priceChange1m || 0,
      };
    });

    // Calculate aggregate statistics
    const allStates = Array.from(this.competitors.values()).map(c => c.state);
    const totalTrades = allStates.reduce((sum, s) => sum + s.trades, 0);
    const returns = allStates.map(s => s.pnlPercent);

    return {
      competitionId: this.competitionId,
      name: this.config.name,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.endTime - this.startTime,
      winner: winnerState,
      finalLeaderboard: this.leaderboard,
      marketsSummary,
      statistics: {
        totalTrades,
        totalVolume: marketsSummary.reduce((sum, m) => sum + m.totalVolume, 0),
        avgReturn: returns.reduce((a, b) => a + b, 0) / returns.length,
        bestReturn: Math.max(...returns),
        worstReturn: Math.min(...returns),
      },
    };
  }

  getLeaderboard(): LeaderboardEntry[] {
    return this.leaderboard;
  }

  getStatus(): {
    status: string;
    competitionId: string;
    name: string;
    elapsed: number;
    remaining?: number;
    competitors: number;
    activeCompetitors: number;
  } {
    const elapsed = this.status === 'running' ? Date.now() - this.startTime : 0;
    const remaining = this.config.duration ? Math.max(0, this.config.duration - elapsed) : undefined;

    return {
      status: this.status,
      competitionId: this.competitionId,
      name: this.config.name,
      elapsed,
      remaining,
      competitors: this.competitors.size,
      activeCompetitors: Array.from(this.competitors.values())
        .filter(c => c.state.status === 'running').length,
    };
  }
}

// ============================================================================
// Genetic Algorithm for Strategy Evolution
// ============================================================================

export interface StrategyGene {
  strategyName: string;
  parameters: Record<string, number>;
  fitness: number;
}

export class StrategyEvolver extends EventEmitter {
  private populationSize: number;
  private mutationRate: number;
  private crossoverRate: number;
  private elitismCount: number;
  private population: StrategyGene[] = [];
  private generation = 0;

  constructor(options: {
    populationSize?: number;
    mutationRate?: number;
    crossoverRate?: number;
    elitismCount?: number;
  } = {}) {
    super();
    this.populationSize = options.populationSize || 20;
    this.mutationRate = options.mutationRate || 0.1;
    this.crossoverRate = options.crossoverRate || 0.7;
    this.elitismCount = options.elitismCount || 2;
  }

  initializePopulation(baseParameters: Record<string, { min: number; max: number }>): void {
    this.population = [];

    for (let i = 0; i < this.populationSize; i++) {
      const gene: StrategyGene = {
        strategyName: `evolved_${i}`,
        parameters: {},
        fitness: 0,
      };

      for (const [param, range] of Object.entries(baseParameters)) {
        gene.parameters[param] = range.min + Math.random() * (range.max - range.min);
      }

      this.population.push(gene);
    }

    this.emit('population_initialized', this.population.length);
  }

  updateFitness(strategyName: string, fitness: number): void {
    const gene = this.population.find(g => g.strategyName === strategyName);
    if (gene) {
      gene.fitness = fitness;
    }
  }

  evolve(): StrategyGene[] {
    this.generation++;

    // Sort by fitness (descending)
    this.population.sort((a, b) => b.fitness - a.fitness);

    const newPopulation: StrategyGene[] = [];

    // Keep elite individuals
    for (let i = 0; i < this.elitismCount; i++) {
      newPopulation.push({ ...this.population[i] });
    }

    // Create rest of population through selection, crossover, mutation
    while (newPopulation.length < this.populationSize) {
      // Tournament selection
      const parent1 = this.tournamentSelect();
      const parent2 = this.tournamentSelect();

      let child: StrategyGene;

      // Crossover
      if (Math.random() < this.crossoverRate) {
        child = this.crossover(parent1, parent2);
      } else {
        child = { ...parent1 };
      }

      // Mutation
      child = this.mutate(child);
      child.strategyName = `evolved_g${this.generation}_${newPopulation.length}`;
      child.fitness = 0;

      newPopulation.push(child);
    }

    this.population = newPopulation;
    this.emit('generation_complete', { generation: this.generation, bestFitness: this.population[0].fitness });

    return this.population;
  }

  private tournamentSelect(tournamentSize: number = 3): StrategyGene {
    const tournament: StrategyGene[] = [];
    for (let i = 0; i < tournamentSize; i++) {
      const idx = Math.floor(Math.random() * this.population.length);
      tournament.push(this.population[idx]);
    }
    return tournament.reduce((best, current) => current.fitness > best.fitness ? current : best);
  }

  private crossover(parent1: StrategyGene, parent2: StrategyGene): StrategyGene {
    const child: StrategyGene = {
      strategyName: '',
      parameters: {},
      fitness: 0,
    };

    for (const param of Object.keys(parent1.parameters)) {
      // Uniform crossover - randomly pick from either parent
      child.parameters[param] = Math.random() < 0.5
        ? parent1.parameters[param]
        : parent2.parameters[param];
    }

    return child;
  }

  private mutate(gene: StrategyGene): StrategyGene {
    const mutated = { ...gene, parameters: { ...gene.parameters } };

    for (const param of Object.keys(mutated.parameters)) {
      if (Math.random() < this.mutationRate) {
        // Gaussian mutation
        const currentValue = mutated.parameters[param];
        const mutation = (Math.random() * 2 - 1) * currentValue * 0.2; // 20% max change
        mutated.parameters[param] = currentValue + mutation;
      }
    }

    return mutated;
  }

  getBestGene(): StrategyGene {
    return this.population.reduce((best, current) =>
      current.fitness > best.fitness ? current : best
    );
  }

  getPopulation(): StrategyGene[] {
    return this.population;
  }

  getGeneration(): number {
    return this.generation;
  }
}

// ============================================================================
// Pre-built Strategy Variants
// ============================================================================

export function createStrategyVariant(
  baseStrategy: Strategy,
  parameters: Record<string, number>
): Strategy {
  return {
    name: `${baseStrategy.name}_variant`,
    description: `${baseStrategy.description} (parameterized)`,
    analyze: (market, positions) => {
      const signal = baseStrategy.analyze(market, positions);
      if (!signal) return null;

      // Adjust signal based on parameters
      return {
        ...signal,
        strength: signal.strength * (parameters.strengthMultiplier || 1),
        confidence: signal.confidence * (parameters.confidenceMultiplier || 1),
      };
    },
  };
}

export const STRATEGY_VARIANTS = {
  conservative_mean_reversion: createStrategyVariant(MeanReversionStrategy, {
    strengthMultiplier: 0.7,
    confidenceMultiplier: 1.2,
  }),
  aggressive_mean_reversion: createStrategyVariant(MeanReversionStrategy, {
    strengthMultiplier: 1.3,
    confidenceMultiplier: 0.8,
  }),
  conservative_momentum: createStrategyVariant(MomentumStrategy, {
    strengthMultiplier: 0.7,
    confidenceMultiplier: 1.2,
  }),
  aggressive_momentum: createStrategyVariant(MomentumStrategy, {
    strengthMultiplier: 1.3,
    confidenceMultiplier: 0.8,
  }),
  tight_spread: createStrategyVariant(SpreadStrategy, {
    strengthMultiplier: 0.8,
    confidenceMultiplier: 1.5,
  }),
  wide_spread: createStrategyVariant(SpreadStrategy, {
    strengthMultiplier: 1.2,
    confidenceMultiplier: 0.7,
  }),
};

// ============================================================================
// MCP Tools for Competition
// ============================================================================

export const COMPETITION_TOOLS = [
  {
    name: 'competition_create',
    description: 'Create a new multi-agent trading competition',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Competition name' },
        mode: { type: 'string', enum: ['continuous', 'timed', 'elimination', 'tournament'] },
        duration: { type: 'number', description: 'Duration in milliseconds (for timed mode)' },
        eliminationThreshold: { type: 'number', description: 'Loss % to eliminate (for elimination mode)' },
        markets: { type: 'array', items: { type: 'string' }, description: 'Market tickers to trade' },
        startingBalance: { type: 'number', description: 'Starting balance per competitor' },
      },
      required: ['name', 'mode', 'markets'],
    },
  },
  {
    name: 'competition_register',
    description: 'Register a competitor in the competition',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Unique competitor ID' },
        name: { type: 'string', description: 'Display name' },
        strategy: {
          type: 'string',
          enum: ['mean_reversion', 'momentum', 'spread', 'arbitrage', 'mixed'],
          description: 'Trading strategy',
        },
        variant: { type: 'string', enum: ['conservative', 'aggressive', 'balanced'], description: 'Strategy variant' },
      },
      required: ['id', 'name', 'strategy'],
    },
  },
  {
    name: 'competition_start',
    description: 'Start the competition',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'competition_pause',
    description: 'Pause the competition',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'competition_resume',
    description: 'Resume paused competition',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'competition_stop',
    description: 'Stop and finalize the competition',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'competition_leaderboard',
    description: 'Get current leaderboard',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'competition_status',
    description: 'Get competition status',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'competition_competitor_details',
    description: 'Get detailed stats for a specific competitor',
    inputSchema: {
      type: 'object',
      properties: {
        competitor_id: { type: 'string', description: 'Competitor ID' },
      },
      required: ['competitor_id'],
    },
  },
  {
    name: 'evolution_start',
    description: 'Start genetic algorithm evolution of strategies',
    inputSchema: {
      type: 'object',
      properties: {
        generations: { type: 'number', description: 'Number of generations to evolve' },
        populationSize: { type: 'number', description: 'Population size' },
      },
    },
  },
  {
    name: 'evolution_status',
    description: 'Get evolution status and best strategies',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// ============================================================================
// Factory
// ============================================================================

export function createCompetition(config: Partial<CompetitionConfig>): CompetitionEngine {
  const fullConfig: CompetitionConfig = {
    name: 'Kalshi Trading Competition',
    mode: 'continuous',
    markets: [],
    startingBalance: 100000, // $1000
    scoreWeights: {
      returns: 0.4,
      sharpe: 0.3,
      winRate: 0.2,
      consistency: 0.1,
    },
    ...config,
  };

  return new CompetitionEngine(fullConfig);
}

// ============================================================================
// Quick Start Helper
// ============================================================================

export function createQuickCompetition(
  markets: string[],
  competitorCount: number = 4
): CompetitionEngine {
  const competition = createCompetition({
    name: 'Quick Competition',
    mode: 'timed',
    duration: 5 * 60 * 1000, // 5 minutes
    markets,
  });

  // Register default competitors
  const strategies = [
    { strategy: MeanReversionStrategy, name: 'Mean Reverter' },
    { strategy: MomentumStrategy, name: 'Momentum Trader' },
    { strategy: SpreadStrategy, name: 'Spread Hunter' },
    { strategy: ArbitrageStrategy, name: 'Arbitrageur' },
  ];

  for (let i = 0; i < Math.min(competitorCount, strategies.length); i++) {
    competition.registerCompetitor({
      id: `bot-${i + 1}`,
      name: strategies[i].name,
      strategy: strategies[i].strategy,
      agentConfig: DEFAULT_AGENT_CONFIG,
      paperConfig: DEFAULT_PAPER_CONFIG,
      enabled: true,
    });
  }

  return competition;
}
