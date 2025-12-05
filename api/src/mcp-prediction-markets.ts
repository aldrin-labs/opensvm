#!/usr/bin/env bun
/**
 * Multi-Platform Prediction Markets Trading System
 *
 * Features:
 * 1. Paper Trading Mode - Safe simulation with virtual balances
 * 2. Market Alerts - Price/volume threshold monitoring
 * 3. Auto-Trading Strategies - Arbitrage, momentum, mean reversion
 * 4. Multi-Platform - Kalshi, Polymarket, Manifold Markets
 *
 * Supported Platforms:
 * - Kalshi (CFTC-regulated, US only)
 * - Polymarket (Crypto-native, global)
 * - Manifold Markets (Play money, global)
 */

// ============================================================================
// Types
// ============================================================================

export type Platform = 'kalshi' | 'polymarket' | 'manifold';
export type TradingMode = 'paper' | 'live';
export type AlertType = 'price_above' | 'price_below' | 'volume_spike' | 'spread_narrow';
export type StrategyType = 'arbitrage' | 'momentum' | 'mean_reversion' | 'market_making';

export interface Market {
  id: string;
  platform: Platform;
  ticker: string;
  title: string;
  description?: string;
  yesPrice: number;      // 0-1
  noPrice: number;       // 0-1
  volume24h: number;
  liquidity: number;
  closeTime?: Date;
  resolved: boolean;
  outcome?: 'yes' | 'no';
}

export interface Position {
  id: string;
  platform: Platform;
  marketId: string;
  side: 'yes' | 'no';
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  createdAt: number;
}

export interface Trade {
  id: string;
  platform: Platform;
  marketId: string;
  side: 'yes' | 'no';
  action: 'buy' | 'sell';
  quantity: number;
  price: number;
  total: number;
  fee: number;
  pnl?: number;
  timestamp: number;
  mode: TradingMode;
}

export interface Alert {
  id: string;
  platform: Platform;
  marketId: string;
  type: AlertType;
  threshold: number;
  triggered: boolean;
  triggeredAt?: number;
  createdAt: number;
  callback?: (market: Market) => void;
}

export interface Strategy {
  id: string;
  type: StrategyType;
  name: string;
  enabled: boolean;
  config: Record<string, any>;
  platforms: Platform[];
  performance: {
    trades: number;
    wins: number;
    pnl: number;
  };
}

export interface PaperAccount {
  id: string;
  balance: number;
  initialBalance: number;
  positions: Map<string, Position>;
  trades: Trade[];
  pnl: number;
  createdAt: number;
}

// ============================================================================
// Platform API Clients
// ============================================================================

class KalshiClient {
  private baseUrl = 'https://api.elections.kalshi.com/trade-api/v2';
  private timeout = 30000;

  async fetchMarkets(status: string = 'open', limit: number = 50): Promise<Market[]> {
    const response = await fetch(
      `${this.baseUrl}/markets?status=${status}&limit=${limit}`,
      { signal: AbortSignal.timeout(this.timeout) }
    );
    const data = await response.json();

    return data.markets.map((m: any) => ({
      id: m.ticker,
      platform: 'kalshi' as Platform,
      ticker: m.ticker,
      title: m.title,
      description: m.subtitle,
      yesPrice: m.yes_bid / 100,
      noPrice: m.no_bid / 100,
      volume24h: m.volume_24h,
      liquidity: m.liquidity || 0,
      closeTime: m.close_time ? new Date(m.close_time) : undefined,
      resolved: m.result !== '',
      outcome: m.result === 'yes' ? 'yes' : m.result === 'no' ? 'no' : undefined,
    }));
  }

  async fetchMarket(ticker: string): Promise<Market> {
    const response = await fetch(
      `${this.baseUrl}/markets/${ticker}`,
      { signal: AbortSignal.timeout(this.timeout) }
    );
    const data = await response.json();
    const m = data.market;

    return {
      id: m.ticker,
      platform: 'kalshi',
      ticker: m.ticker,
      title: m.title,
      description: m.subtitle,
      yesPrice: m.yes_bid / 100,
      noPrice: m.no_bid / 100,
      volume24h: m.volume_24h,
      liquidity: m.liquidity || 0,
      closeTime: m.close_time ? new Date(m.close_time) : undefined,
      resolved: m.result !== '',
      outcome: m.result === 'yes' ? 'yes' : m.result === 'no' ? 'no' : undefined,
    };
  }
}

class PolymarketClient {
  private baseUrl = 'https://clob.polymarket.com';
  private gammaUrl = 'https://gamma-api.polymarket.com';
  private timeout = 30000;

  async fetchMarkets(limit: number = 50): Promise<Market[]> {
    try {
      // Polymarket uses CLOB API
      const response = await fetch(
        `${this.gammaUrl}/markets?closed=false&limit=${limit}`,
        { signal: AbortSignal.timeout(this.timeout) }
      );
      const data = await response.json();

      return (data || []).slice(0, limit).map((m: any) => ({
        id: m.conditionId || m.id,
        platform: 'polymarket' as Platform,
        ticker: m.conditionId || m.id,
        title: m.question || m.title,
        description: m.description,
        yesPrice: parseFloat(m.outcomePrices?.[0] || '0.5'),
        noPrice: parseFloat(m.outcomePrices?.[1] || '0.5'),
        volume24h: parseFloat(m.volume24hr || '0'),
        liquidity: parseFloat(m.liquidity || '0'),
        closeTime: m.endDate ? new Date(m.endDate) : undefined,
        resolved: m.closed || false,
        outcome: undefined,
      }));
    } catch (e) {
      console.error('Polymarket API error:', e);
      return [];
    }
  }

  async fetchMarket(conditionId: string): Promise<Market | null> {
    try {
      const response = await fetch(
        `${this.gammaUrl}/markets/${conditionId}`,
        { signal: AbortSignal.timeout(this.timeout) }
      );
      const m = await response.json();

      return {
        id: m.conditionId || m.id,
        platform: 'polymarket',
        ticker: m.conditionId || m.id,
        title: m.question || m.title,
        description: m.description,
        yesPrice: parseFloat(m.outcomePrices?.[0] || '0.5'),
        noPrice: parseFloat(m.outcomePrices?.[1] || '0.5'),
        volume24h: parseFloat(m.volume24hr || '0'),
        liquidity: parseFloat(m.liquidity || '0'),
        closeTime: m.endDate ? new Date(m.endDate) : undefined,
        resolved: m.closed || false,
        outcome: undefined,
      };
    } catch (e) {
      return null;
    }
  }
}

class ManifoldClient {
  private baseUrl = 'https://api.manifold.markets/v0';
  private timeout = 30000;

  async fetchMarkets(limit: number = 50): Promise<Market[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/markets?limit=${limit}`,
        { signal: AbortSignal.timeout(this.timeout) }
      );
      const data = await response.json();

      return data.filter((m: any) => m.outcomeType === 'BINARY').map((m: any) => ({
        id: m.id,
        platform: 'manifold' as Platform,
        ticker: m.id,
        title: m.question,
        description: m.description,
        yesPrice: m.probability || 0.5,
        noPrice: 1 - (m.probability || 0.5),
        volume24h: m.volume24Hours || 0,
        liquidity: m.totalLiquidity || 0,
        closeTime: m.closeTime ? new Date(m.closeTime) : undefined,
        resolved: m.isResolved || false,
        outcome: m.resolution === 'YES' ? 'yes' : m.resolution === 'NO' ? 'no' : undefined,
      }));
    } catch (e) {
      console.error('Manifold API error:', e);
      return [];
    }
  }

  async fetchMarket(id: string): Promise<Market | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/market/${id}`,
        { signal: AbortSignal.timeout(this.timeout) }
      );
      const m = await response.json();

      return {
        id: m.id,
        platform: 'manifold',
        ticker: m.id,
        title: m.question,
        description: m.description,
        yesPrice: m.probability || 0.5,
        noPrice: 1 - (m.probability || 0.5),
        volume24h: m.volume24Hours || 0,
        liquidity: m.totalLiquidity || 0,
        closeTime: m.closeTime ? new Date(m.closeTime) : undefined,
        resolved: m.isResolved || false,
        outcome: m.resolution === 'YES' ? 'yes' : m.resolution === 'NO' ? 'no' : undefined,
      };
    } catch (e) {
      return null;
    }
  }
}

// ============================================================================
// Paper Trading Engine
// ============================================================================

export class PaperTradingEngine {
  private accounts = new Map<string, PaperAccount>();
  private defaultBalance = 10000; // $10,000 starting balance

  createAccount(id: string, initialBalance?: number): PaperAccount {
    const balance = initialBalance || this.defaultBalance;
    const account: PaperAccount = {
      id,
      balance,
      initialBalance: balance,
      positions: new Map(),
      trades: [],
      pnl: 0,
      createdAt: Date.now(),
    };
    this.accounts.set(id, account);
    return account;
  }

  getAccount(id: string): PaperAccount | null {
    return this.accounts.get(id) || null;
  }

  deposit(accountId: string, amount: number): number {
    const account = this.accounts.get(accountId);
    if (!account) throw new Error('Account not found');
    account.balance += amount;
    return account.balance;
  }

  executeTrade(
    accountId: string,
    market: Market,
    side: 'yes' | 'no',
    action: 'buy' | 'sell',
    quantity: number,
    price?: number
  ): Trade {
    const account = this.accounts.get(accountId);
    if (!account) throw new Error('Account not found');

    const tradePrice = price || (side === 'yes' ? market.yesPrice : market.noPrice);
    const total = tradePrice * quantity;
    const fee = total * 0.01; // 1% fee

    if (action === 'buy') {
      if (account.balance < total + fee) {
        throw new Error(`Insufficient balance. Have $${account.balance.toFixed(2)}, need $${(total + fee).toFixed(2)}`);
      }
      account.balance -= (total + fee);

      // Update position
      const posKey = `${market.platform}-${market.id}-${side}`;
      const existing = account.positions.get(posKey);

      if (existing) {
        const newQty = existing.quantity + quantity;
        existing.avgPrice = ((existing.avgPrice * existing.quantity) + (tradePrice * quantity)) / newQty;
        existing.quantity = newQty;
        existing.currentPrice = tradePrice;
      } else {
        account.positions.set(posKey, {
          id: posKey,
          platform: market.platform,
          marketId: market.id,
          side,
          quantity,
          avgPrice: tradePrice,
          currentPrice: tradePrice,
          unrealizedPnl: 0,
          createdAt: Date.now(),
        });
      }
    } else {
      // Sell
      const posKey = `${market.platform}-${market.id}-${side}`;
      const position = account.positions.get(posKey);

      if (!position || position.quantity < quantity) {
        throw new Error(`Insufficient position. Have ${position?.quantity || 0}, need ${quantity}`);
      }

      const pnl = (tradePrice - position.avgPrice) * quantity - fee;
      account.balance += (total - fee);
      account.pnl += pnl;

      position.quantity -= quantity;
      if (position.quantity === 0) {
        account.positions.delete(posKey);
      }
    }

    const trade: Trade = {
      id: `PAPER-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      platform: market.platform,
      marketId: market.id,
      side,
      action,
      quantity,
      price: tradePrice,
      total,
      fee,
      pnl: action === 'sell' ? (tradePrice - (account.positions.get(`${market.platform}-${market.id}-${side}`)?.avgPrice || tradePrice)) * quantity - fee : undefined,
      timestamp: Date.now(),
      mode: 'paper',
    };

    account.trades.push(trade);
    return trade;
  }

  getPortfolioValue(accountId: string): {
    cash: number;
    positions: number;
    total: number;
    pnl: number;
    pnlPercent: number;
  } {
    const account = this.accounts.get(accountId);
    if (!account) throw new Error('Account not found');

    let positionsValue = 0;
    for (const pos of account.positions.values()) {
      positionsValue += pos.currentPrice * pos.quantity;
    }

    const total = account.balance + positionsValue;
    const pnl = total - account.initialBalance;
    const pnlPercent = (pnl / account.initialBalance) * 100;

    return { cash: account.balance, positions: positionsValue, total, pnl, pnlPercent };
  }

  getLeaderboard(): Array<{ accountId: string; pnl: number; pnlPercent: number; trades: number }> {
    return Array.from(this.accounts.entries())
      .map(([id, account]) => {
        const portfolio = this.getPortfolioValue(id);
        return {
          accountId: id,
          pnl: portfolio.pnl,
          pnlPercent: portfolio.pnlPercent,
          trades: account.trades.length,
        };
      })
      .sort((a, b) => b.pnl - a.pnl);
  }
}

// ============================================================================
// Market Alerts System
// ============================================================================

export class AlertManager {
  private alerts = new Map<string, Alert>();
  private alertCounter = 0;
  private checkInterval: Timer | null = null;
  private clients: { kalshi: KalshiClient; polymarket: PolymarketClient; manifold: ManifoldClient };

  constructor() {
    this.clients = {
      kalshi: new KalshiClient(),
      polymarket: new PolymarketClient(),
      manifold: new ManifoldClient(),
    };
  }

  createAlert(
    platform: Platform,
    marketId: string,
    type: AlertType,
    threshold: number,
    callback?: (market: Market) => void
  ): Alert {
    this.alertCounter++;
    const alert: Alert = {
      id: `ALERT-${this.alertCounter}`,
      platform,
      marketId,
      type,
      threshold,
      triggered: false,
      createdAt: Date.now(),
      callback,
    };
    this.alerts.set(alert.id, alert);
    return alert;
  }

  removeAlert(id: string): boolean {
    return this.alerts.delete(id);
  }

  async checkAlerts(): Promise<Alert[]> {
    const triggered: Alert[] = [];

    for (const alert of this.alerts.values()) {
      if (alert.triggered) continue;

      try {
        let market: Market | null = null;

        switch (alert.platform) {
          case 'kalshi':
            market = await this.clients.kalshi.fetchMarket(alert.marketId);
            break;
          case 'polymarket':
            market = await this.clients.polymarket.fetchMarket(alert.marketId);
            break;
          case 'manifold':
            market = await this.clients.manifold.fetchMarket(alert.marketId);
            break;
        }

        if (!market) continue;

        let shouldTrigger = false;

        switch (alert.type) {
          case 'price_above':
            shouldTrigger = market.yesPrice >= alert.threshold;
            break;
          case 'price_below':
            shouldTrigger = market.yesPrice <= alert.threshold;
            break;
          case 'volume_spike':
            shouldTrigger = market.volume24h >= alert.threshold;
            break;
          case 'spread_narrow':
            const spread = Math.abs(market.yesPrice - (1 - market.noPrice));
            shouldTrigger = spread <= alert.threshold;
            break;
        }

        if (shouldTrigger) {
          alert.triggered = true;
          alert.triggeredAt = Date.now();
          triggered.push(alert);

          if (alert.callback) {
            alert.callback(market);
          }
        }
      } catch (e) {
        // Skip on error
      }
    }

    return triggered;
  }

  startMonitoring(intervalMs: number = 60000): void {
    if (this.checkInterval) return;
    this.checkInterval = setInterval(() => this.checkAlerts(), intervalMs);
    console.log(`[Alerts] Monitoring started (every ${intervalMs / 1000}s)`);
  }

  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('[Alerts] Monitoring stopped');
    }
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(a => !a.triggered);
  }

  getTriggeredAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(a => a.triggered);
  }
}

// ============================================================================
// Auto-Trading Strategies
// ============================================================================

export class StrategyEngine {
  private strategies = new Map<string, Strategy>();
  private paperEngine: PaperTradingEngine;
  private clients: { kalshi: KalshiClient; polymarket: PolymarketClient; manifold: ManifoldClient };
  private strategyCounter = 0;

  constructor(paperEngine: PaperTradingEngine) {
    this.paperEngine = paperEngine;
    this.clients = {
      kalshi: new KalshiClient(),
      polymarket: new PolymarketClient(),
      manifold: new ManifoldClient(),
    };
  }

  // --------------------------------------------------------------------------
  // Strategy: Cross-Platform Arbitrage
  // --------------------------------------------------------------------------
  createArbitrageStrategy(
    name: string,
    config: {
      minSpread: number;      // Minimum price difference (e.g., 0.05 = 5%)
      maxPosition: number;    // Max $ per position
      platforms: Platform[];
    }
  ): Strategy {
    this.strategyCounter++;
    const strategy: Strategy = {
      id: `STRAT-ARB-${this.strategyCounter}`,
      type: 'arbitrage',
      name,
      enabled: false,
      config,
      platforms: config.platforms,
      performance: { trades: 0, wins: 0, pnl: 0 },
    };
    this.strategies.set(strategy.id, strategy);
    return strategy;
  }

  async runArbitrage(strategyId: string, accountId: string): Promise<{
    opportunities: Array<{
      market: string;
      platforms: { platform: Platform; price: number }[];
      spread: number;
      action: string;
    }>;
    trades: Trade[];
  }> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy || strategy.type !== 'arbitrage') {
      throw new Error('Arbitrage strategy not found');
    }

    const opportunities: Array<{
      market: string;
      platforms: { platform: Platform; price: number }[];
      spread: number;
      action: string;
    }> = [];
    const trades: Trade[] = [];

    // Fetch markets from all platforms
    const marketsByTitle = new Map<string, { platform: Platform; market: Market }[]>();

    for (const platform of strategy.platforms) {
      try {
        let markets: Market[] = [];
        switch (platform) {
          case 'kalshi':
            markets = await this.clients.kalshi.fetchMarkets('open', 100);
            break;
          case 'polymarket':
            markets = await this.clients.polymarket.fetchMarkets(100);
            break;
          case 'manifold':
            markets = await this.clients.manifold.fetchMarkets(100);
            break;
        }

        for (const market of markets) {
          const key = market.title.toLowerCase().slice(0, 50);
          if (!marketsByTitle.has(key)) {
            marketsByTitle.set(key, []);
          }
          marketsByTitle.get(key)!.push({ platform, market });
        }
      } catch (e) {
        console.error(`Failed to fetch ${platform} markets:`, e);
      }
    }

    // Find arbitrage opportunities
    for (const [title, platformMarkets] of marketsByTitle) {
      if (platformMarkets.length < 2) continue;

      // Sort by YES price
      platformMarkets.sort((a, b) => a.market.yesPrice - b.market.yesPrice);

      const lowest = platformMarkets[0];
      const highest = platformMarkets[platformMarkets.length - 1];
      const spread = highest.market.yesPrice - lowest.market.yesPrice;

      if (spread >= strategy.config.minSpread) {
        opportunities.push({
          market: title,
          platforms: platformMarkets.map(pm => ({
            platform: pm.platform,
            price: pm.market.yesPrice,
          })),
          spread,
          action: `Buy YES on ${lowest.platform} at ${(lowest.market.yesPrice * 100).toFixed(1)}%, Sell YES on ${highest.platform} at ${(highest.market.yesPrice * 100).toFixed(1)}%`,
        });

        // Execute paper trade if enabled
        if (strategy.enabled) {
          const quantity = Math.floor(strategy.config.maxPosition / lowest.market.yesPrice);

          try {
            const buyTrade = this.paperEngine.executeTrade(
              accountId,
              lowest.market,
              'yes',
              'buy',
              quantity
            );
            trades.push(buyTrade);
            strategy.performance.trades++;
          } catch (e) {
            // Insufficient funds or other error
          }
        }
      }
    }

    return { opportunities, trades };
  }

  // --------------------------------------------------------------------------
  // Strategy: Momentum
  // --------------------------------------------------------------------------
  createMomentumStrategy(
    name: string,
    config: {
      lookbackHours: number;  // Hours to look back for trend
      minChange: number;      // Minimum price change to trigger (e.g., 0.1 = 10%)
      positionSize: number;   // $ per trade
      platforms: Platform[];
    }
  ): Strategy {
    this.strategyCounter++;
    const strategy: Strategy = {
      id: `STRAT-MOM-${this.strategyCounter}`,
      type: 'momentum',
      name,
      enabled: false,
      config,
      platforms: config.platforms,
      performance: { trades: 0, wins: 0, pnl: 0 },
    };
    this.strategies.set(strategy.id, strategy);
    return strategy;
  }

  // --------------------------------------------------------------------------
  // Strategy: Mean Reversion
  // --------------------------------------------------------------------------
  createMeanReversionStrategy(
    name: string,
    config: {
      threshold: number;      // How far from 0.5 to trigger (e.g., 0.3 = trade when < 0.2 or > 0.8)
      positionSize: number;
      platforms: Platform[];
    }
  ): Strategy {
    this.strategyCounter++;
    const strategy: Strategy = {
      id: `STRAT-MR-${this.strategyCounter}`,
      type: 'mean_reversion',
      name,
      enabled: false,
      config,
      platforms: config.platforms,
      performance: { trades: 0, wins: 0, pnl: 0 },
    };
    this.strategies.set(strategy.id, strategy);
    return strategy;
  }

  async runMeanReversion(strategyId: string, accountId: string): Promise<{
    signals: Array<{ market: Market; signal: 'buy_yes' | 'buy_no'; reason: string }>;
    trades: Trade[];
  }> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy || strategy.type !== 'mean_reversion') {
      throw new Error('Mean reversion strategy not found');
    }

    const signals: Array<{ market: Market; signal: 'buy_yes' | 'buy_no'; reason: string }> = [];
    const trades: Trade[] = [];

    for (const platform of strategy.platforms) {
      try {
        let markets: Market[] = [];
        switch (platform) {
          case 'kalshi':
            markets = await this.clients.kalshi.fetchMarkets('open', 50);
            break;
          case 'polymarket':
            markets = await this.clients.polymarket.fetchMarkets(50);
            break;
          case 'manifold':
            markets = await this.clients.manifold.fetchMarkets(50);
            break;
        }

        for (const market of markets) {
          const deviation = Math.abs(market.yesPrice - 0.5);

          if (deviation >= strategy.config.threshold) {
            const signal = market.yesPrice < 0.5 ? 'buy_yes' : 'buy_no';
            signals.push({
              market,
              signal,
              reason: `Price ${(market.yesPrice * 100).toFixed(1)}% deviates ${(deviation * 100).toFixed(1)}% from 50%`,
            });

            if (strategy.enabled) {
              const side = signal === 'buy_yes' ? 'yes' : 'no';
              const price = side === 'yes' ? market.yesPrice : market.noPrice;
              const quantity = Math.floor(strategy.config.positionSize / price);

              try {
                const trade = this.paperEngine.executeTrade(accountId, market, side, 'buy', quantity);
                trades.push(trade);
                strategy.performance.trades++;
              } catch (e) {
                // Skip on error
              }
            }
          }
        }
      } catch (e) {
        console.error(`Failed to run mean reversion on ${platform}:`, e);
      }
    }

    return { signals, trades };
  }

  // --------------------------------------------------------------------------
  // Strategy Management
  // --------------------------------------------------------------------------
  enableStrategy(id: string): void {
    const strategy = this.strategies.get(id);
    if (strategy) strategy.enabled = true;
  }

  disableStrategy(id: string): void {
    const strategy = this.strategies.get(id);
    if (strategy) strategy.enabled = false;
  }

  getStrategy(id: string): Strategy | null {
    return this.strategies.get(id) || null;
  }

  getAllStrategies(): Strategy[] {
    return Array.from(this.strategies.values());
  }

  getPerformance(): Array<{ strategy: string; type: StrategyType; trades: number; pnl: number }> {
    return Array.from(this.strategies.values()).map(s => ({
      strategy: s.name,
      type: s.type,
      trades: s.performance.trades,
      pnl: s.performance.pnl,
    }));
  }
}

// ============================================================================
// Multi-Platform Aggregator
// ============================================================================

export class MarketAggregator {
  private clients: { kalshi: KalshiClient; polymarket: PolymarketClient; manifold: ManifoldClient };

  constructor() {
    this.clients = {
      kalshi: new KalshiClient(),
      polymarket: new PolymarketClient(),
      manifold: new ManifoldClient(),
    };
  }

  async fetchAllMarkets(options: {
    platforms?: Platform[];
    limit?: number;
  } = {}): Promise<Market[]> {
    const platforms = options.platforms || ['kalshi', 'polymarket', 'manifold'];
    const limit = options.limit || 50;
    const markets: Market[] = [];

    const fetches = platforms.map(async (platform) => {
      try {
        switch (platform) {
          case 'kalshi':
            return await this.clients.kalshi.fetchMarkets('open', limit);
          case 'polymarket':
            return await this.clients.polymarket.fetchMarkets(limit);
          case 'manifold':
            return await this.clients.manifold.fetchMarkets(limit);
        }
      } catch (e) {
        console.error(`Failed to fetch ${platform}:`, e);
        return [];
      }
    });

    const results = await Promise.all(fetches);
    for (const result of results) {
      if (result) markets.push(...result);
    }

    return markets;
  }

  async searchMarkets(query: string, platforms?: Platform[]): Promise<Market[]> {
    const allMarkets = await this.fetchAllMarkets({ platforms, limit: 100 });
    const q = query.toLowerCase();

    return allMarkets.filter(m =>
      m.title.toLowerCase().includes(q) ||
      m.description?.toLowerCase().includes(q)
    );
  }

  async getBestPrices(query: string): Promise<{
    query: string;
    results: Array<{
      title: string;
      prices: { platform: Platform; yesPrice: number; noPrice: number }[];
      bestYes: { platform: Platform; price: number };
      bestNo: { platform: Platform; price: number };
      arbitrageOpportunity: boolean;
    }>;
  }> {
    const markets = await this.searchMarkets(query);

    // Group by similar titles
    const grouped = new Map<string, Market[]>();
    for (const market of markets) {
      const key = market.title.toLowerCase().slice(0, 40);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(market);
    }

    const results = Array.from(grouped.entries()).map(([title, markets]) => {
      const prices = markets.map(m => ({
        platform: m.platform,
        yesPrice: m.yesPrice,
        noPrice: m.noPrice,
      }));

      const sortedByYes = [...prices].sort((a, b) => a.yesPrice - b.yesPrice);
      const sortedByNo = [...prices].sort((a, b) => a.noPrice - b.noPrice);

      const bestYes = sortedByYes[0];
      const bestNo = sortedByNo[0];

      // Check for arbitrage (can buy YES cheap and NO cheap, totaling < $1)
      const arbitrageOpportunity = bestYes.yesPrice + bestNo.noPrice < 0.98;

      return {
        title: markets[0].title,
        prices,
        bestYes: { platform: bestYes.platform, price: bestYes.yesPrice },
        bestNo: { platform: bestNo.platform, price: bestNo.noPrice },
        arbitrageOpportunity,
      };
    });

    return { query, results };
  }

  getStats(): Promise<{
    platforms: Array<{
      platform: Platform;
      markets: number;
      totalVolume: number;
      avgLiquidity: number;
    }>;
  }> {
    return this.fetchAllMarkets({ limit: 100 }).then(markets => {
      const byPlatform = new Map<Platform, Market[]>();
      for (const m of markets) {
        if (!byPlatform.has(m.platform)) byPlatform.set(m.platform, []);
        byPlatform.get(m.platform)!.push(m);
      }

      const platforms = Array.from(byPlatform.entries()).map(([platform, markets]) => ({
        platform,
        markets: markets.length,
        totalVolume: markets.reduce((sum, m) => sum + m.volume24h, 0),
        avgLiquidity: markets.reduce((sum, m) => sum + m.liquidity, 0) / markets.length,
      }));

      return { platforms };
    });
  }
}

// ============================================================================
// Main Trading System
// ============================================================================

export class PredictionMarketsTradingSystem {
  public paper: PaperTradingEngine;
  public alerts: AlertManager;
  public strategies: StrategyEngine;
  public aggregator: MarketAggregator;

  constructor() {
    this.paper = new PaperTradingEngine();
    this.alerts = new AlertManager();
    this.strategies = new StrategyEngine(this.paper);
    this.aggregator = new MarketAggregator();
  }

  // Quick setup for common use cases
  setupDemoAccount(accountId: string = 'demo'): PaperAccount {
    return this.paper.createAccount(accountId, 10000);
  }

  setupArbitrageBot(accountId: string): Strategy {
    return this.strategies.createArbitrageStrategy('Cross-Platform Arbitrage', {
      minSpread: 0.05,
      maxPosition: 500,
      platforms: ['kalshi', 'polymarket', 'manifold'],
    });
  }

  setupMeanReversionBot(accountId: string): Strategy {
    return this.strategies.createMeanReversionStrategy('Mean Reversion', {
      threshold: 0.3,
      positionSize: 200,
      platforms: ['kalshi', 'manifold'],
    });
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let instance: PredictionMarketsTradingSystem | null = null;

export function getTradingSystem(): PredictionMarketsTradingSystem {
  if (!instance) {
    instance = new PredictionMarketsTradingSystem();
  }
  return instance;
}

export default {
  PredictionMarketsTradingSystem,
  getTradingSystem,
  PaperTradingEngine,
  AlertManager,
  StrategyEngine,
  MarketAggregator,
};
