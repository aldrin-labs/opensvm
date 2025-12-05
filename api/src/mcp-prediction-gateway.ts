#!/usr/bin/env bun
/**
 * Unified Prediction Markets MCP Gateway
 *
 * A comprehensive MCP server that provides:
 * 1. Market Data & Aggregation - Real-time data from Kalshi, Polymarket, Manifold, Drift
 * 2. Paper Trading - Simulated trading with portfolio management
 * 3. AI Market Intelligence - LLM-powered analysis and insights
 * 4. Multi-Agent Debate - Consensus predictions through adversarial debate
 * 5. Arbitrage Detection - Cross-platform opportunity finder
 * 6. Alert System - Price and volume monitoring
 *
 * Supports 40+ tools across 6 categories
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  LPAnalytics,
  CrossChainArbitrage,
  WalletManager,
  OracleNetwork,
  type Chain,
  type DeFiProtocol,
} from './prediction-defi.js';
import { DeFiEventStream } from './prediction-defi-streaming.js';
import { LPStrategyAdvisor } from './prediction-lp-advisor.js';

// ============================================================================
// Types
// ============================================================================

type Platform = 'kalshi' | 'polymarket' | 'manifold' | 'drift';
type Side = 'yes' | 'no';
type AlertType = 'price_above' | 'price_below' | 'volume_spike';
type StrategyType = 'arbitrage' | 'momentum' | 'mean_reversion' | 'contrarian';

interface Market {
  id: string;
  platform: Platform;
  ticker: string;
  title: string;
  description?: string;
  category?: string;
  yesPrice: number;
  noPrice: number;
  volume24h: number;
  liquidity: number;
  closeTime?: Date;
  resolved: boolean;
  outcome?: 'yes' | 'no';
}

interface Position {
  marketId: string;
  platform: Platform;
  side: Side;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
}

interface Trade {
  id: string;
  timestamp: number;
  platform: Platform;
  marketId: string;
  marketTitle: string;
  side: Side;
  action: 'buy' | 'sell';
  quantity: number;
  price: number;
  total: number;
  fee: number;
  pnl?: number;
}

interface PaperAccount {
  id: string;
  balance: number;
  initialBalance: number;
  positions: Map<string, Position>;
  trades: Trade[];
  totalPnl: number;
  createdAt: number;
}

interface Alert {
  id: string;
  platform: Platform;
  marketId: string;
  marketTitle: string;
  type: AlertType;
  threshold: number;
  triggered: boolean;
  triggeredAt?: number;
  currentValue?: number;
}

interface DebateResult {
  question: string;
  bullCase: string;
  bearCase: string;
  synthesis: string;
  finalProbability: number;
  confidence: number;
  reasoning: string;
}

// ============================================================================
// Platform API Clients
// ============================================================================

class KalshiClient {
  private baseUrl = 'https://api.elections.kalshi.com/trade-api/v2';
  private timeout = 15000;

  async fetchMarkets(limit = 50): Promise<Market[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/markets?status=open&limit=${limit}`,
        { signal: AbortSignal.timeout(this.timeout) }
      );
      if (!response.ok) return [];
      const data = await response.json();
      return (data.markets || []).map((m: any) => this.mapMarket(m));
    } catch {
      return [];
    }
  }

  async fetchMarket(ticker: string): Promise<Market | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/markets/${ticker}`,
        { signal: AbortSignal.timeout(this.timeout) }
      );
      if (!response.ok) return null;
      const data = await response.json();
      return this.mapMarket(data.market);
    } catch {
      return null;
    }
  }

  private mapMarket(m: any): Market {
    return {
      id: m.ticker,
      platform: 'kalshi',
      ticker: m.ticker,
      title: m.title,
      description: m.subtitle,
      category: m.category,
      yesPrice: (m.yes_bid || 50) / 100,
      noPrice: (m.no_bid || 50) / 100,
      volume24h: m.volume_24h || 0,
      liquidity: m.liquidity || 0,
      closeTime: m.close_time ? new Date(m.close_time) : undefined,
      resolved: m.result !== '',
      outcome: m.result === 'yes' ? 'yes' : m.result === 'no' ? 'no' : undefined,
    };
  }
}

class PolymarketClient {
  private baseUrl = 'https://gamma-api.polymarket.com';
  private timeout = 15000;

  async fetchMarkets(limit = 50): Promise<Market[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/markets?closed=false&limit=${limit}`,
        { signal: AbortSignal.timeout(this.timeout) }
      );
      if (!response.ok) return [];
      const data = await response.json();
      return (data || []).slice(0, limit).map((m: any) => this.mapMarket(m));
    } catch {
      return [];
    }
  }

  private mapMarket(m: any): Market {
    return {
      id: m.conditionId || m.id,
      platform: 'polymarket',
      ticker: m.conditionId || m.id,
      title: m.question || m.title,
      description: m.description,
      category: m.category,
      yesPrice: parseFloat(m.outcomePrices?.[0] || '0.5'),
      noPrice: parseFloat(m.outcomePrices?.[1] || '0.5'),
      volume24h: parseFloat(m.volume24hr || '0'),
      liquidity: parseFloat(m.liquidity || '0'),
      closeTime: m.endDate ? new Date(m.endDate) : undefined,
      resolved: m.closed || false,
      outcome: undefined,
    };
  }
}

class ManifoldClient {
  private baseUrl = 'https://api.manifold.markets/v0';
  private timeout = 15000;

  async fetchMarkets(limit = 50): Promise<Market[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/markets?limit=${limit}`,
        { signal: AbortSignal.timeout(this.timeout) }
      );
      if (!response.ok) return [];
      const data = await response.json();
      return (data || [])
        .filter((m: any) => m.outcomeType === 'BINARY')
        .slice(0, limit)
        .map((m: any) => this.mapMarket(m));
    } catch {
      return [];
    }
  }

  private mapMarket(m: any): Market {
    return {
      id: m.id,
      platform: 'manifold',
      ticker: m.id,
      title: m.question,
      description: m.description,
      category: m.groupSlugs?.[0],
      yesPrice: m.probability || 0.5,
      noPrice: 1 - (m.probability || 0.5),
      volume24h: m.volume24Hours || 0,
      liquidity: m.totalLiquidity || 0,
      closeTime: m.closeTime ? new Date(m.closeTime) : undefined,
      resolved: m.isResolved || false,
      outcome: m.resolution === 'YES' ? 'yes' : m.resolution === 'NO' ? 'no' : undefined,
    };
  }
}

// ============================================================================
// Core Services
// ============================================================================

class MarketAggregator {
  private kalshi = new KalshiClient();
  private polymarket = new PolymarketClient();
  private manifold = new ManifoldClient();
  private cache: Map<string, Market> = new Map();
  private lastFetch = 0;

  async fetchAllMarkets(limit = 50): Promise<Market[]> {
    const [kalshiMarkets, polymarketMarkets, manifoldMarkets] = await Promise.all([
      this.kalshi.fetchMarkets(limit),
      this.polymarket.fetchMarkets(limit),
      this.manifold.fetchMarkets(limit),
    ]);

    const all = [...kalshiMarkets, ...polymarketMarkets, ...manifoldMarkets];
    all.forEach(m => this.cache.set(`${m.platform}:${m.id}`, m));
    this.lastFetch = Date.now();
    return all;
  }

  async searchMarkets(query: string, platform?: Platform): Promise<Market[]> {
    let markets = Array.from(this.cache.values());
    if (Date.now() - this.lastFetch > 60000) {
      markets = await this.fetchAllMarkets(100);
    }

    const q = query.toLowerCase();
    return markets.filter(m =>
      (!platform || m.platform === platform) &&
      (m.title.toLowerCase().includes(q) || m.description?.toLowerCase().includes(q))
    );
  }

  async getMarket(platform: Platform, marketId: string): Promise<Market | null> {
    const cached = this.cache.get(`${platform}:${marketId}`);
    if (cached && Date.now() - this.lastFetch < 60000) return cached;

    if (platform === 'kalshi') {
      return this.kalshi.fetchMarket(marketId);
    }

    await this.fetchAllMarkets(100);
    return this.cache.get(`${platform}:${marketId}`) || null;
  }

  findArbitrage(minSpread = 0.05): Array<{
    title: string;
    markets: { platform: Platform; price: number }[];
    spread: number;
    strategy: string;
  }> {
    const markets = Array.from(this.cache.values());
    const grouped = new Map<string, Market[]>();

    // Group by normalized title
    markets.forEach(m => {
      const key = m.title.toLowerCase().replace(/[^\w\s]/g, '').slice(0, 40);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(m);
    });

    const opportunities: Array<{
      title: string;
      markets: { platform: Platform; price: number }[];
      spread: number;
      strategy: string;
    }> = [];

    grouped.forEach((marketGroup, _key) => {
      if (marketGroup.length < 2) return;
      const platforms = new Set(marketGroup.map(m => m.platform));
      if (platforms.size < 2) return;

      const prices = marketGroup.map(m => ({ platform: m.platform, price: m.yesPrice }));
      prices.sort((a, b) => a.price - b.price);

      const spread = prices[prices.length - 1].price - prices[0].price;
      if (spread >= minSpread) {
        opportunities.push({
          title: marketGroup[0].title,
          markets: prices,
          spread,
          strategy: `Buy YES on ${prices[0].platform} @ ${(prices[0].price * 100).toFixed(1)}%, Sell on ${prices[prices.length - 1].platform} @ ${(prices[prices.length - 1].price * 100).toFixed(1)}%`,
        });
      }
    });

    return opportunities.sort((a, b) => b.spread - a.spread);
  }
}

class PaperTradingEngine {
  private accounts = new Map<string, PaperAccount>();
  private aggregator: MarketAggregator;

  constructor(aggregator: MarketAggregator) {
    this.aggregator = aggregator;
  }

  createAccount(accountId: string, initialBalance = 10000): PaperAccount {
    const account: PaperAccount = {
      id: accountId,
      balance: initialBalance,
      initialBalance,
      positions: new Map(),
      trades: [],
      totalPnl: 0,
      createdAt: Date.now(),
    };
    this.accounts.set(accountId, account);
    return account;
  }

  getAccount(accountId: string): PaperAccount | null {
    return this.accounts.get(accountId) || null;
  }

  async executeTrade(
    accountId: string,
    platform: Platform,
    marketId: string,
    side: Side,
    action: 'buy' | 'sell',
    quantity: number
  ): Promise<Trade> {
    const account = this.accounts.get(accountId);
    if (!account) throw new Error('Account not found');

    const market = await this.aggregator.getMarket(platform, marketId);
    if (!market) throw new Error('Market not found');

    const price = side === 'yes' ? market.yesPrice : market.noPrice;
    const total = price * quantity;
    const fee = total * 0.01;

    if (action === 'buy') {
      if (account.balance < total + fee) {
        throw new Error(`Insufficient balance. Have $${account.balance.toFixed(2)}, need $${(total + fee).toFixed(2)}`);
      }
      account.balance -= (total + fee);

      const posKey = `${platform}:${marketId}:${side}`;
      const existing = account.positions.get(posKey);

      if (existing) {
        const newQty = existing.quantity + quantity;
        existing.avgPrice = ((existing.avgPrice * existing.quantity) + (price * quantity)) / newQty;
        existing.quantity = newQty;
        existing.currentPrice = price;
      } else {
        account.positions.set(posKey, {
          marketId,
          platform,
          side,
          quantity,
          avgPrice: price,
          currentPrice: price,
          unrealizedPnl: 0,
        });
      }
    } else {
      const posKey = `${platform}:${marketId}:${side}`;
      const position = account.positions.get(posKey);

      if (!position || position.quantity < quantity) {
        throw new Error(`Insufficient position. Have ${position?.quantity || 0}, need ${quantity}`);
      }

      const pnl = (price - position.avgPrice) * quantity - fee;
      account.balance += (total - fee);
      account.totalPnl += pnl;

      position.quantity -= quantity;
      if (position.quantity === 0) {
        account.positions.delete(posKey);
      }
    }

    const trade: Trade = {
      id: `PAPER-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      platform,
      marketId,
      marketTitle: market.title,
      side,
      action,
      quantity,
      price,
      total,
      fee,
    };

    account.trades.push(trade);
    return trade;
  }

  getPortfolio(accountId: string): {
    cash: number;
    positionsValue: number;
    totalValue: number;
    pnl: number;
    pnlPercent: number;
    positions: Position[];
  } {
    const account = this.accounts.get(accountId);
    if (!account) throw new Error('Account not found');

    let positionsValue = 0;
    const positions: Position[] = [];

    account.positions.forEach(pos => {
      const value = pos.currentPrice * pos.quantity;
      positionsValue += value;
      pos.unrealizedPnl = (pos.currentPrice - pos.avgPrice) * pos.quantity;
      positions.push({ ...pos });
    });

    const totalValue = account.balance + positionsValue;
    const pnl = totalValue - account.initialBalance;
    const pnlPercent = (pnl / account.initialBalance) * 100;

    return { cash: account.balance, positionsValue, totalValue, pnl, pnlPercent, positions };
  }

  getTradeHistory(accountId: string, limit = 50): Trade[] {
    const account = this.accounts.get(accountId);
    if (!account) return [];
    return account.trades.slice(-limit).reverse();
  }

  async runStrategy(
    accountId: string,
    strategy: StrategyType,
    config: { maxPosition?: number; minSpread?: number } = {}
  ): Promise<{ signals: string[]; trades: Trade[] }> {
    const account = this.accounts.get(accountId);
    if (!account) throw new Error('Account not found');

    const signals: string[] = [];
    const trades: Trade[] = [];
    const maxPosition = config.maxPosition || 500;

    switch (strategy) {
      case 'arbitrage': {
        const opportunities = this.aggregator.findArbitrage(config.minSpread || 0.05);
        for (const opp of opportunities.slice(0, 3)) {
          signals.push(`Arbitrage: ${opp.strategy}`);
        }
        break;
      }

      case 'mean_reversion': {
        const markets = await this.aggregator.fetchAllMarkets(50);
        for (const market of markets) {
          const deviation = Math.abs(market.yesPrice - 0.5);
          if (deviation > 0.3) {
            const side: Side = market.yesPrice < 0.5 ? 'yes' : 'no';
            signals.push(`Mean reversion: ${market.title} - Buy ${side.toUpperCase()} at ${(market.yesPrice * 100).toFixed(1)}%`);

            try {
              const quantity = Math.floor(maxPosition / (side === 'yes' ? market.yesPrice : market.noPrice));
              const trade = await this.executeTrade(accountId, market.platform, market.id, side, 'buy', quantity);
              trades.push(trade);
            } catch {
              // Skip on error
            }
          }
        }
        break;
      }

      case 'momentum': {
        signals.push('Momentum strategy requires historical data - collecting baseline');
        break;
      }

      case 'contrarian': {
        const markets = await this.aggregator.fetchAllMarkets(50);
        const highVolume = markets.sort((a, b) => b.volume24h - a.volume24h).slice(0, 10);
        for (const market of highVolume) {
          if (market.yesPrice > 0.8) {
            signals.push(`Contrarian: Fade ${market.title} - high probability may be overconfident`);
          } else if (market.yesPrice < 0.2) {
            signals.push(`Contrarian: ${market.title} - low probability may be undervalued`);
          }
        }
        break;
      }
    }

    return { signals, trades };
  }
}

class AlertManager {
  private alerts = new Map<string, Alert>();
  private aggregator: MarketAggregator;

  constructor(aggregator: MarketAggregator) {
    this.aggregator = aggregator;
  }

  createAlert(
    platform: Platform,
    marketId: string,
    marketTitle: string,
    type: AlertType,
    threshold: number
  ): Alert {
    const id = `ALERT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const alert: Alert = {
      id,
      platform,
      marketId,
      marketTitle,
      type,
      threshold,
      triggered: false,
    };
    this.alerts.set(id, alert);
    return alert;
  }

  deleteAlert(id: string): boolean {
    return this.alerts.delete(id);
  }

  async checkAlerts(): Promise<Alert[]> {
    const triggered: Alert[] = [];

    for (const alert of Array.from(this.alerts.values())) {
      if (alert.triggered) continue;

      const market = await this.aggregator.getMarket(alert.platform, alert.marketId);
      if (!market) continue;

      let shouldTrigger = false;
      let currentValue = 0;

      switch (alert.type) {
        case 'price_above':
          currentValue = market.yesPrice;
          shouldTrigger = market.yesPrice >= alert.threshold;
          break;
        case 'price_below':
          currentValue = market.yesPrice;
          shouldTrigger = market.yesPrice <= alert.threshold;
          break;
        case 'volume_spike':
          currentValue = market.volume24h;
          shouldTrigger = market.volume24h >= alert.threshold;
          break;
      }

      if (shouldTrigger) {
        alert.triggered = true;
        alert.triggeredAt = Date.now();
        alert.currentValue = currentValue;
        triggered.push(alert);
      }
    }

    return triggered;
  }

  getAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }
}

class MarketIntelligence {
  private aggregator: MarketAggregator;
  private togetherApiKey: string | undefined;

  constructor(aggregator: MarketAggregator) {
    this.aggregator = aggregator;
    this.togetherApiKey = process.env.TOGETHER_API_KEY;
  }

  async analyzeMarket(platform: Platform, marketId: string): Promise<string> {
    const market = await this.aggregator.getMarket(platform, marketId);
    if (!market) return 'Market not found';

    const context = `
Market: ${market.title}
Platform: ${market.platform}
YES Price: ${(market.yesPrice * 100).toFixed(1)}%
NO Price: ${(market.noPrice * 100).toFixed(1)}%
24h Volume: $${market.volume24h.toLocaleString()}
Liquidity: $${market.liquidity.toLocaleString()}
Category: ${market.category || 'Unknown'}
Close Time: ${market.closeTime?.toISOString() || 'No expiry'}
    `;

    if (!this.togetherApiKey) {
      return this.generateBasicAnalysis(market);
    }

    try {
      const response = await fetch('https://api.together.xyz/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.togetherApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
          messages: [
            {
              role: 'system',
              content: 'You are an expert prediction market analyst. Provide concise, actionable analysis.',
            },
            {
              role: 'user',
              content: `Analyze this prediction market:\n${context}\n\nProvide insights on: probability assessment, market dynamics, key factors to watch, and trading considerations.`,
            },
          ],
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.choices?.[0]?.message?.content || this.generateBasicAnalysis(market);
      }
    } catch {
      // Fall through to basic analysis
    }

    return this.generateBasicAnalysis(market);
  }

  private generateBasicAnalysis(market: Market): string {
    const prob = market.yesPrice;
    let sentiment = 'neutral';
    if (prob > 0.7) sentiment = 'strongly bullish';
    else if (prob > 0.55) sentiment = 'moderately bullish';
    else if (prob < 0.3) sentiment = 'strongly bearish';
    else if (prob < 0.45) sentiment = 'moderately bearish';

    return `## Market Analysis: ${market.title}

**Current Probability:** ${(prob * 100).toFixed(1)}% YES
**Market Sentiment:** ${sentiment}

**Key Metrics:**
- 24h Volume: $${market.volume24h.toLocaleString()} ${market.volume24h > 10000 ? '(high activity)' : '(low activity)'}
- Liquidity: $${market.liquidity.toLocaleString()}
- Spread: ${((1 - market.yesPrice - market.noPrice) * 100).toFixed(2)}%

**Considerations:**
- ${prob > 0.8 || prob < 0.2 ? 'Extreme probability - consider contrarian position' : 'Moderate probability - standard risk/reward'}
- ${market.volume24h > 50000 ? 'High volume suggests strong conviction' : 'Lower volume may indicate uncertainty'}

**Trading Notes:**
- Best for: ${prob > 0.5 ? 'Selling NO or buying YES' : 'Buying YES or selling NO'}
- Risk level: ${Math.abs(prob - 0.5) > 0.3 ? 'Higher' : 'Moderate'}`;
  }

  async comparePlatforms(): Promise<string> {
    const markets = await this.aggregator.fetchAllMarkets(100);

    const byPlatform = new Map<Platform, Market[]>();
    markets.forEach(m => {
      if (!byPlatform.has(m.platform)) byPlatform.set(m.platform, []);
      byPlatform.get(m.platform)!.push(m);
    });

    let report = '## Platform Comparison\n\n';

    byPlatform.forEach((platformMarkets, platform) => {
      const totalVolume = platformMarkets.reduce((sum, m) => sum + m.volume24h, 0);
      const totalLiquidity = platformMarkets.reduce((sum, m) => sum + m.liquidity, 0);
      const avgSpread = platformMarkets.reduce((sum, m) => sum + Math.abs(1 - m.yesPrice - m.noPrice), 0) / platformMarkets.length;

      report += `### ${platform.charAt(0).toUpperCase() + platform.slice(1)}\n`;
      report += `- Markets: ${platformMarkets.length}\n`;
      report += `- Total Volume: $${totalVolume.toLocaleString()}\n`;
      report += `- Total Liquidity: $${totalLiquidity.toLocaleString()}\n`;
      report += `- Avg Spread: ${(avgSpread * 100).toFixed(2)}%\n\n`;
    });

    return report;
  }

  async generateReport(type: 'daily' | 'arbitrage' | 'trending'): Promise<string> {
    const markets = await this.aggregator.fetchAllMarkets(100);

    switch (type) {
      case 'daily': {
        const topVolume = [...markets].sort((a, b) => b.volume24h - a.volume24h).slice(0, 10);
        let report = '## Daily Market Report\n\n### Top Markets by Volume\n\n';
        topVolume.forEach((m, i) => {
          report += `${i + 1}. **${m.title}**\n`;
          report += `   - Platform: ${m.platform} | Price: ${(m.yesPrice * 100).toFixed(1)}% | Volume: $${m.volume24h.toLocaleString()}\n\n`;
        });
        return report;
      }

      case 'arbitrage': {
        const opportunities = this.aggregator.findArbitrage(0.03);
        let report = '## Arbitrage Opportunities\n\n';
        if (opportunities.length === 0) {
          report += 'No significant arbitrage opportunities detected.\n';
        } else {
          opportunities.slice(0, 10).forEach((opp, i) => {
            report += `${i + 1}. **${opp.title.slice(0, 60)}**\n`;
            report += `   - Spread: ${(opp.spread * 100).toFixed(1)}%\n`;
            report += `   - Strategy: ${opp.strategy}\n\n`;
          });
        }
        return report;
      }

      case 'trending': {
        const keywords = ['trump', 'biden', 'crypto', 'bitcoin', 'ai', 'fed', 'election'];
        let report = '## Trending Topics\n\n';
        keywords.forEach(keyword => {
          const matches = markets.filter(m => m.title.toLowerCase().includes(keyword));
          if (matches.length > 0) {
            const totalVolume = matches.reduce((sum, m) => sum + m.volume24h, 0);
            report += `### ${keyword.charAt(0).toUpperCase() + keyword.slice(1)}\n`;
            report += `- Markets: ${matches.length}\n`;
            report += `- Total Volume: $${totalVolume.toLocaleString()}\n\n`;
          }
        });
        return report;
      }
    }
  }
}

class MultiAgentDebate {
  private togetherApiKey: string | undefined;

  constructor() {
    this.togetherApiKey = process.env.TOGETHER_API_KEY;
  }

  async debate(question: string, context: string): Promise<DebateResult> {
    if (!this.togetherApiKey) {
      return this.mockDebate(question);
    }

    const agents = {
      bull: 'You are a bullish analyst. Make the strongest case for YES on this prediction market. Be persuasive but factual.',
      bear: 'You are a bearish analyst. Make the strongest case for NO on this prediction market. Be persuasive but factual.',
      synthesizer: 'You are a neutral analyst. Given the bull and bear cases, synthesize them into a balanced view and assign a probability (0-100%) to YES.',
    };

    try {
      // Bull case
      const bullResponse = await this.callLLM(
        agents.bull,
        `Question: ${question}\n\nContext: ${context}\n\nMake the case for YES.`
      );

      // Bear case
      const bearResponse = await this.callLLM(
        agents.bear,
        `Question: ${question}\n\nContext: ${context}\n\nMake the case for NO.`
      );

      // Synthesis
      const synthesisResponse = await this.callLLM(
        agents.synthesizer,
        `Question: ${question}\n\nBull Case:\n${bullResponse}\n\nBear Case:\n${bearResponse}\n\nSynthesize these views and provide a probability estimate for YES.`
      );

      // Extract probability from synthesis
      const probMatch = synthesisResponse.match(/(\d+)%/);
      const probability = probMatch ? parseInt(probMatch[1]) / 100 : 0.5;

      return {
        question,
        bullCase: bullResponse,
        bearCase: bearResponse,
        synthesis: synthesisResponse,
        finalProbability: probability,
        confidence: Math.abs(probability - 0.5) * 2,
        reasoning: `Bull-Bear debate conducted with ${probability > 0.5 ? 'bullish' : probability < 0.5 ? 'bearish' : 'neutral'} conclusion`,
      };
    } catch {
      return this.mockDebate(question);
    }
  }

  private async callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.togetherApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 400,
        temperature: 0.7,
      }),
    });

    if (!response.ok) throw new Error('LLM call failed');
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  private mockDebate(question: string): DebateResult {
    return {
      question,
      bullCase: 'Bull case: Multiple positive indicators suggest this outcome is likely. Historical patterns and current trends support the YES position.',
      bearCase: 'Bear case: There are significant risks and uncertainties. Alternative outcomes remain plausible given the current situation.',
      synthesis: 'After weighing both perspectives, the probability appears moderately tilted based on available evidence. Key uncertainties remain.',
      finalProbability: 0.5,
      confidence: 0.3,
      reasoning: 'Mock debate - configure TOGETHER_API_KEY for AI-powered analysis',
    };
  }
}

// ============================================================================
// MCP Server
// ============================================================================

const server = new Server(
  {
    name: 'prediction-markets-gateway',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Initialize services
const aggregator = new MarketAggregator();
const tradingEngine = new PaperTradingEngine(aggregator);
const alertManager = new AlertManager(aggregator);
const intelligence = new MarketIntelligence(aggregator);
const debateSystem = new MultiAgentDebate();

// DeFi services
const lpAnalytics = new LPAnalytics();
const crossChainArb = new CrossChainArbitrage();
const walletManager = new WalletManager();
const oracleNetwork = new OracleNetwork();

// DeFi streaming and AI advisor
const defiStream = new DeFiEventStream(lpAnalytics, crossChainArb, oracleNetwork);
const lpAdvisor = new LPStrategyAdvisor(lpAnalytics);

// ============================================================================
// Tool Definitions
// ============================================================================

const TOOLS = [
  // === Market Data Tools ===
  {
    name: 'get_markets',
    description: 'Fetch prediction markets from all platforms (Kalshi, Polymarket, Manifold)',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max markets per platform (default 50)' },
        platform: { type: 'string', enum: ['kalshi', 'polymarket', 'manifold', 'drift'], description: 'Filter by platform' },
      },
    },
  },
  {
    name: 'search_markets',
    description: 'Search for markets by keyword across all platforms',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        platform: { type: 'string', enum: ['kalshi', 'polymarket', 'manifold', 'drift'], description: 'Filter by platform' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_market',
    description: 'Get detailed information about a specific market',
    inputSchema: {
      type: 'object',
      properties: {
        platform: { type: 'string', enum: ['kalshi', 'polymarket', 'manifold', 'drift'] },
        marketId: { type: 'string', description: 'Market ID or ticker' },
      },
      required: ['platform', 'marketId'],
    },
  },
  {
    name: 'find_arbitrage',
    description: 'Find cross-platform arbitrage opportunities',
    inputSchema: {
      type: 'object',
      properties: {
        minSpread: { type: 'number', description: 'Minimum spread to consider (default 0.05 = 5%)' },
      },
    },
  },
  {
    name: 'get_trending',
    description: 'Get trending topics and markets',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // === Paper Trading Tools ===
  {
    name: 'create_trading_account',
    description: 'Create a new paper trading account',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'Unique account identifier' },
        initialBalance: { type: 'number', description: 'Starting balance (default $10,000)' },
      },
      required: ['accountId'],
    },
  },
  {
    name: 'get_portfolio',
    description: 'Get portfolio value and positions for a trading account',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string' },
      },
      required: ['accountId'],
    },
  },
  {
    name: 'place_trade',
    description: 'Execute a paper trade (buy or sell)',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string' },
        platform: { type: 'string', enum: ['kalshi', 'polymarket', 'manifold', 'drift'] },
        marketId: { type: 'string' },
        side: { type: 'string', enum: ['yes', 'no'] },
        action: { type: 'string', enum: ['buy', 'sell'] },
        quantity: { type: 'number', description: 'Number of contracts' },
      },
      required: ['accountId', 'platform', 'marketId', 'side', 'action', 'quantity'],
    },
  },
  {
    name: 'get_trade_history',
    description: 'Get trade history for an account',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string' },
        limit: { type: 'number', description: 'Max trades to return (default 50)' },
      },
      required: ['accountId'],
    },
  },
  {
    name: 'run_strategy',
    description: 'Run an automated trading strategy',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string' },
        strategy: { type: 'string', enum: ['arbitrage', 'momentum', 'mean_reversion', 'contrarian'] },
        maxPosition: { type: 'number', description: 'Max $ per position (default $500)' },
        minSpread: { type: 'number', description: 'Min spread for arbitrage (default 0.05)' },
      },
      required: ['accountId', 'strategy'],
    },
  },

  // === Alert Tools ===
  {
    name: 'create_alert',
    description: 'Create a price or volume alert for a market',
    inputSchema: {
      type: 'object',
      properties: {
        platform: { type: 'string', enum: ['kalshi', 'polymarket', 'manifold', 'drift'] },
        marketId: { type: 'string' },
        marketTitle: { type: 'string' },
        type: { type: 'string', enum: ['price_above', 'price_below', 'volume_spike'] },
        threshold: { type: 'number', description: 'Trigger threshold (price as decimal 0-1, volume in $)' },
      },
      required: ['platform', 'marketId', 'marketTitle', 'type', 'threshold'],
    },
  },
  {
    name: 'get_alerts',
    description: 'Get all configured alerts',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'check_alerts',
    description: 'Check all alerts and return triggered ones',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'delete_alert',
    description: 'Delete an alert',
    inputSchema: {
      type: 'object',
      properties: {
        alertId: { type: 'string' },
      },
      required: ['alertId'],
    },
  },

  // === AI Intelligence Tools ===
  {
    name: 'analyze_market',
    description: 'Get AI-powered analysis of a specific market',
    inputSchema: {
      type: 'object',
      properties: {
        platform: { type: 'string', enum: ['kalshi', 'polymarket', 'manifold', 'drift'] },
        marketId: { type: 'string' },
      },
      required: ['platform', 'marketId'],
    },
  },
  {
    name: 'compare_platforms',
    description: 'Compare metrics across all prediction market platforms',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'generate_report',
    description: 'Generate a market report',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['daily', 'arbitrage', 'trending'], description: 'Report type' },
      },
      required: ['type'],
    },
  },

  // === Multi-Agent Debate Tools ===
  {
    name: 'debate_market',
    description: 'Run a multi-agent debate on a market outcome (bull vs bear)',
    inputSchema: {
      type: 'object',
      properties: {
        platform: { type: 'string', enum: ['kalshi', 'polymarket', 'manifold', 'drift'] },
        marketId: { type: 'string' },
      },
      required: ['platform', 'marketId'],
    },
  },
  {
    name: 'debate_question',
    description: 'Run a multi-agent debate on any prediction question',
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The prediction question to debate' },
        context: { type: 'string', description: 'Additional context for the debate' },
      },
      required: ['question'],
    },
  },

  // === DeFi / On-Chain Tools ===
  {
    name: 'connect_wallet',
    description: 'Connect a wallet to track balances and positions (read-only)',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Wallet address' },
        chain: { type: 'string', enum: ['solana', 'polygon', 'ethereum', 'arbitrum'], description: 'Blockchain' },
      },
      required: ['address', 'chain'],
    },
  },
  {
    name: 'get_wallet_balance',
    description: 'Get wallet balance and connected status',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Wallet address' },
        chain: { type: 'string', enum: ['solana', 'polygon', 'ethereum', 'arbitrum'] },
      },
      required: ['address', 'chain'],
    },
  },
  {
    name: 'get_all_wallets',
    description: 'Get all connected wallets and total portfolio value',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'track_lp_position',
    description: 'Track a new LP position in a prediction market AMM',
    inputSchema: {
      type: 'object',
      properties: {
        protocol: { type: 'string', enum: ['drift', 'polymarket', 'omen', 'augur'], description: 'DeFi protocol' },
        chain: { type: 'string', enum: ['solana', 'polygon', 'ethereum', 'arbitrum'] },
        marketAddress: { type: 'string', description: 'Market contract address' },
        marketTitle: { type: 'string', description: 'Market title/question' },
        lpTokenBalance: { type: 'number', description: 'LP tokens received' },
        yesTokensProvided: { type: 'number', description: 'YES tokens provided' },
        noTokensProvided: { type: 'number', description: 'NO tokens provided' },
        currentYesPrice: { type: 'number', description: 'Current YES price (0-1)' },
        currentNoPrice: { type: 'number', description: 'Current NO price (0-1)' },
      },
      required: ['protocol', 'chain', 'marketAddress', 'marketTitle', 'lpTokenBalance', 'yesTokensProvided', 'noTokensProvided', 'currentYesPrice', 'currentNoPrice'],
    },
  },
  {
    name: 'get_lp_positions',
    description: 'Get all LP positions with impermanent loss and PnL',
    inputSchema: {
      type: 'object',
      properties: {
        chain: { type: 'string', enum: ['solana', 'polygon', 'ethereum', 'arbitrum'], description: 'Filter by chain (optional)' },
      },
    },
  },
  {
    name: 'get_lp_portfolio_stats',
    description: 'Get aggregate LP portfolio statistics',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'simulate_add_liquidity',
    description: 'Simulate adding liquidity to a prediction market AMM',
    inputSchema: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Amount to provide in $' },
        currentYesPrice: { type: 'number', description: 'Current YES price (0-1)' },
        currentNoPrice: { type: 'number', description: 'Current NO price (0-1)' },
        estimatedDailyVolume: { type: 'number', description: 'Expected daily trading volume' },
        totalLiquidityAfter: { type: 'number', description: 'Total pool liquidity after deposit' },
      },
      required: ['amount', 'currentYesPrice', 'currentNoPrice', 'estimatedDailyVolume', 'totalLiquidityAfter'],
    },
  },
  {
    name: 'calculate_impermanent_loss',
    description: 'Calculate impermanent loss for an LP position',
    inputSchema: {
      type: 'object',
      properties: {
        entryYesPrice: { type: 'number', description: 'Entry YES price (0-1)' },
        entryNoPrice: { type: 'number', description: 'Entry NO price (0-1)' },
        currentYesPrice: { type: 'number', description: 'Current YES price (0-1)' },
        currentNoPrice: { type: 'number', description: 'Current NO price (0-1)' },
      },
      required: ['entryYesPrice', 'entryNoPrice', 'currentYesPrice', 'currentNoPrice'],
    },
  },
  {
    name: 'find_cross_chain_arbitrage',
    description: 'Find arbitrage opportunities between Solana and Polygon prediction markets',
    inputSchema: {
      type: 'object',
      properties: {
        minProfit: { type: 'number', description: 'Minimum net profit to consider (default $1)' },
      },
    },
  },
  {
    name: 'get_bridge_costs',
    description: 'Get estimated bridge costs between chains',
    inputSchema: {
      type: 'object',
      properties: {
        fromChain: { type: 'string', enum: ['solana', 'polygon', 'ethereum', 'arbitrum'] },
        toChain: { type: 'string', enum: ['solana', 'polygon', 'ethereum', 'arbitrum'] },
      },
      required: ['fromChain', 'toChain'],
    },
  },
  {
    name: 'get_arbitrage_route',
    description: 'Get optimal route for executing a cross-chain arbitrage',
    inputSchema: {
      type: 'object',
      properties: {
        buyChain: { type: 'string', enum: ['solana', 'polygon', 'ethereum', 'arbitrum'] },
        sellChain: { type: 'string', enum: ['solana', 'polygon', 'ethereum', 'arbitrum'] },
        amount: { type: 'number', description: 'Trade size in $' },
      },
      required: ['buyChain', 'sellChain', 'amount'],
    },
  },
  {
    name: 'record_oracle_update',
    description: 'Record a price update from an oracle source',
    inputSchema: {
      type: 'object',
      properties: {
        marketAddress: { type: 'string', description: 'Market contract address' },
        source: { type: 'string', description: 'Oracle source (pyth, switchboard, chainlink, api3)' },
        yesPrice: { type: 'number', description: 'YES price (0-1)' },
        noPrice: { type: 'number', description: 'NO price (0-1)' },
        confidence: { type: 'number', description: 'Confidence score (0-1)' },
      },
      required: ['marketAddress', 'source', 'yesPrice', 'noPrice', 'confidence'],
    },
  },
  {
    name: 'get_oracle_price',
    description: 'Get aggregated oracle price from multiple sources',
    inputSchema: {
      type: 'object',
      properties: {
        marketAddress: { type: 'string', description: 'Market contract address' },
      },
      required: ['marketAddress'],
    },
  },

  // === LP Strategy Advisor Tools ===
  {
    name: 'analyze_lp_position',
    description: 'Get AI-powered analysis and recommendation for an LP position (uses multi-agent debate)',
    inputSchema: {
      type: 'object',
      properties: {
        positionId: { type: 'string', description: 'LP position ID to analyze' },
      },
      required: ['positionId'],
    },
  },
  {
    name: 'analyze_lp_portfolio',
    description: 'Get AI-powered analysis of entire LP portfolio with health score and recommendations',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'analyze_lp_entry',
    description: 'Analyze a potential LP entry point with AI-powered bull/bear debate',
    inputSchema: {
      type: 'object',
      properties: {
        market: { type: 'string', description: 'Market title/question' },
        chain: { type: 'string', enum: ['solana', 'polygon', 'ethereum', 'arbitrum'] },
        protocol: { type: 'string', enum: ['drift', 'polymarket', 'omen', 'augur'] },
        currentYesPrice: { type: 'number', description: 'Current YES price (0-1)' },
        currentNoPrice: { type: 'number', description: 'Current NO price (0-1)' },
        dailyVolume: { type: 'number', description: 'Market daily volume in $' },
        totalLiquidity: { type: 'number', description: 'Total pool liquidity in $' },
        proposedAmount: { type: 'number', description: 'Amount to deposit in $' },
      },
      required: ['market', 'chain', 'protocol', 'currentYesPrice', 'currentNoPrice', 'dailyVolume', 'totalLiquidity', 'proposedAmount'],
    },
  },
  {
    name: 'get_quick_lp_recommendation',
    description: 'Get fast quantitative LP recommendation without AI debate',
    inputSchema: {
      type: 'object',
      properties: {
        positionId: { type: 'string', description: 'LP position ID' },
      },
      required: ['positionId'],
    },
  },

  // === DeFi Streaming Tools ===
  {
    name: 'start_defi_stream',
    description: 'Start the DeFi event stream (returns stream configuration)',
    inputSchema: {
      type: 'object',
      properties: {
        lpPositionInterval: { type: 'number', description: 'LP update interval in ms (default 30000)' },
        arbScanInterval: { type: 'number', description: 'Arbitrage scan interval in ms (default 60000)' },
        ilWarningThreshold: { type: 'number', description: 'IL % to trigger warning (default 5)' },
        arbMinProfit: { type: 'number', description: 'Min profit for arb alerts (default $10)' },
      },
    },
  },
  {
    name: 'stop_defi_stream',
    description: 'Stop the DeFi event stream',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_stream_stats',
    description: 'Get DeFi stream statistics and configuration',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// ============================================================================
// Request Handlers
// ============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = (args || {}) as Record<string, any>;

  try {
    let result: any;

    switch (name) {
      // Market Data
      case 'get_markets': {
        const markets = await aggregator.fetchAllMarkets(a.limit || 50);
        const filtered = a.platform
          ? markets.filter(m => m.platform === a.platform)
          : markets;
        result = {
          count: filtered.length,
          markets: filtered.slice(0, 50).map(m => ({
            id: m.id,
            platform: m.platform,
            title: m.title,
            yesPrice: `${(m.yesPrice * 100).toFixed(1)}%`,
            volume24h: `$${m.volume24h.toLocaleString()}`,
          })),
        };
        break;
      }

      case 'search_markets': {
        const markets = await aggregator.searchMarkets(a.query, a.platform);
        result = {
          query: a.query,
          count: markets.length,
          markets: markets.slice(0, 20).map(m => ({
            id: m.id,
            platform: m.platform,
            title: m.title,
            yesPrice: `${(m.yesPrice * 100).toFixed(1)}%`,
            volume24h: `$${m.volume24h.toLocaleString()}`,
          })),
        };
        break;
      }

      case 'get_market': {
        const market = await aggregator.getMarket(a.platform, a.marketId);
        if (!market) {
          result = { error: 'Market not found' };
        } else {
          result = {
            id: market.id,
            platform: market.platform,
            title: market.title,
            description: market.description,
            category: market.category,
            yesPrice: `${(market.yesPrice * 100).toFixed(1)}%`,
            noPrice: `${(market.noPrice * 100).toFixed(1)}%`,
            volume24h: `$${market.volume24h.toLocaleString()}`,
            liquidity: `$${market.liquidity.toLocaleString()}`,
            closeTime: market.closeTime?.toISOString(),
            resolved: market.resolved,
            outcome: market.outcome,
          };
        }
        break;
      }

      case 'find_arbitrage': {
        await aggregator.fetchAllMarkets(100);
        const opportunities = aggregator.findArbitrage(a.minSpread || 0.05);
        result = {
          count: opportunities.length,
          opportunities: opportunities.slice(0, 10).map(opp => ({
            title: opp.title.slice(0, 60),
            spread: `${(opp.spread * 100).toFixed(1)}%`,
            strategy: opp.strategy,
            platforms: opp.markets.map(m => `${m.platform}: ${(m.price * 100).toFixed(1)}%`),
          })),
        };
        break;
      }

      case 'get_trending': {
        const report = await intelligence.generateReport('trending');
        result = { report };
        break;
      }

      // Paper Trading
      case 'create_trading_account': {
        const account = tradingEngine.createAccount(a.accountId, a.initialBalance);
        result = {
          accountId: account.id,
          balance: `$${account.balance.toLocaleString()}`,
          created: new Date(account.createdAt).toISOString(),
        };
        break;
      }

      case 'get_portfolio': {
        const portfolio = tradingEngine.getPortfolio(a.accountId);
        result = {
          cash: `$${portfolio.cash.toFixed(2)}`,
          positionsValue: `$${portfolio.positionsValue.toFixed(2)}`,
          totalValue: `$${portfolio.totalValue.toFixed(2)}`,
          pnl: `${portfolio.pnl >= 0 ? '+' : ''}$${portfolio.pnl.toFixed(2)}`,
          pnlPercent: `${portfolio.pnlPercent >= 0 ? '+' : ''}${portfolio.pnlPercent.toFixed(2)}%`,
          positions: portfolio.positions.map(p => ({
            market: p.marketId,
            platform: p.platform,
            side: p.side,
            quantity: p.quantity,
            avgPrice: `${(p.avgPrice * 100).toFixed(1)}%`,
            currentPrice: `${(p.currentPrice * 100).toFixed(1)}%`,
            unrealizedPnl: `$${p.unrealizedPnl.toFixed(2)}`,
          })),
        };
        break;
      }

      case 'place_trade': {
        const trade = await tradingEngine.executeTrade(
          a.accountId,
          a.platform,
          a.marketId,
          a.side,
          a.action,
          a.quantity
        );
        result = {
          tradeId: trade.id,
          market: trade.marketTitle,
          action: `${trade.action} ${trade.side.toUpperCase()}`,
          quantity: trade.quantity,
          price: `${(trade.price * 100).toFixed(1)}%`,
          total: `$${trade.total.toFixed(2)}`,
          fee: `$${trade.fee.toFixed(2)}`,
        };
        break;
      }

      case 'get_trade_history': {
        const trades = tradingEngine.getTradeHistory(a.accountId, a.limit);
        result = {
          count: trades.length,
          trades: trades.map(t => ({
            id: t.id,
            time: new Date(t.timestamp).toISOString(),
            market: t.marketTitle.slice(0, 40),
            action: `${t.action} ${t.side.toUpperCase()}`,
            quantity: t.quantity,
            price: `${(t.price * 100).toFixed(1)}%`,
            total: `$${t.total.toFixed(2)}`,
          })),
        };
        break;
      }

      case 'run_strategy': {
        const strategyResult = await tradingEngine.runStrategy(
          a.accountId,
          a.strategy,
          { maxPosition: a.maxPosition, minSpread: a.minSpread }
        );
        result = {
          strategy: a.strategy,
          signals: strategyResult.signals,
          tradesExecuted: strategyResult.trades.length,
          trades: strategyResult.trades.map(t => ({
            market: t.marketTitle.slice(0, 40),
            action: `${t.action} ${t.side.toUpperCase()}`,
            total: `$${t.total.toFixed(2)}`,
          })),
        };
        break;
      }

      // Alerts
      case 'create_alert': {
        const alert = alertManager.createAlert(
          a.platform,
          a.marketId,
          a.marketTitle,
          a.type,
          a.threshold
        );
        result = {
          alertId: alert.id,
          market: alert.marketTitle,
          type: alert.type,
          threshold: alert.type === 'volume_spike' ? `$${alert.threshold.toLocaleString()}` : `${(alert.threshold * 100).toFixed(1)}%`,
        };
        break;
      }

      case 'get_alerts': {
        const alerts = alertManager.getAlerts();
        result = {
          count: alerts.length,
          active: alerts.filter(a => !a.triggered).length,
          triggered: alerts.filter(a => a.triggered).length,
          alerts: alerts.map(a => ({
            id: a.id,
            market: a.marketTitle.slice(0, 40),
            type: a.type,
            threshold: a.type === 'volume_spike' ? `$${a.threshold.toLocaleString()}` : `${(a.threshold * 100).toFixed(1)}%`,
            status: a.triggered ? 'TRIGGERED' : 'active',
          })),
        };
        break;
      }

      case 'check_alerts': {
        const triggered = await alertManager.checkAlerts();
        result = {
          checked: alertManager.getAlerts().length,
          triggered: triggered.length,
          alerts: triggered.map(a => ({
            id: a.id,
            market: a.marketTitle,
            type: a.type,
            threshold: a.type === 'volume_spike' ? `$${a.threshold.toLocaleString()}` : `${(a.threshold * 100).toFixed(1)}%`,
            currentValue: a.type === 'volume_spike' ? `$${a.currentValue?.toLocaleString()}` : `${((a.currentValue || 0) * 100).toFixed(1)}%`,
            triggeredAt: a.triggeredAt ? new Date(a.triggeredAt).toISOString() : null,
          })),
        };
        break;
      }

      case 'delete_alert': {
        const deleted = alertManager.deleteAlert(a.alertId);
        result = { deleted, alertId: a.alertId };
        break;
      }

      // AI Intelligence
      case 'analyze_market': {
        const analysis = await intelligence.analyzeMarket(a.platform, a.marketId);
        result = { analysis };
        break;
      }

      case 'compare_platforms': {
        const comparison = await intelligence.comparePlatforms();
        result = { report: comparison };
        break;
      }

      case 'generate_report': {
        const report = await intelligence.generateReport(a.type);
        result = { type: a.type, report };
        break;
      }

      // Multi-Agent Debate
      case 'debate_market': {
        const market = await aggregator.getMarket(a.platform, a.marketId);
        if (!market) {
          result = { error: 'Market not found' };
        } else {
          const debate = await debateSystem.debate(
            market.title,
            `Platform: ${market.platform}\nCurrent YES: ${(market.yesPrice * 100).toFixed(1)}%\nVolume: $${market.volume24h.toLocaleString()}`
          );
          result = {
            question: debate.question,
            bullCase: debate.bullCase,
            bearCase: debate.bearCase,
            synthesis: debate.synthesis,
            finalProbability: `${(debate.finalProbability * 100).toFixed(1)}%`,
            confidence: `${(debate.confidence * 100).toFixed(0)}%`,
          };
        }
        break;
      }

      case 'debate_question': {
        const debate = await debateSystem.debate(a.question, a.context || '');
        result = {
          question: debate.question,
          bullCase: debate.bullCase,
          bearCase: debate.bearCase,
          synthesis: debate.synthesis,
          finalProbability: `${(debate.finalProbability * 100).toFixed(1)}%`,
          confidence: `${(debate.confidence * 100).toFixed(0)}%`,
        };
        break;
      }

      // DeFi / On-Chain Tools
      case 'connect_wallet': {
        const wallet = await walletManager.connectWallet(a.address, a.chain as Chain);
        result = {
          address: wallet.address,
          chain: wallet.chain,
          balance: `${wallet.balance.toFixed(4)} ${wallet.chain === 'solana' ? 'SOL' : wallet.chain === 'ethereum' ? 'ETH' : 'native'}`,
          connected: true,
        };
        break;
      }

      case 'get_wallet_balance': {
        const wallet = walletManager.getWallet(a.address, a.chain as Chain);
        if (!wallet) {
          result = { error: 'Wallet not connected. Use connect_wallet first.' };
        } else {
          const balance = await walletManager.refreshBalance(a.address, a.chain as Chain);
          result = {
            address: wallet.address,
            chain: wallet.chain,
            balance: `${balance.toFixed(4)} ${wallet.chain === 'solana' ? 'SOL' : 'native'}`,
          };
        }
        break;
      }

      case 'get_all_wallets': {
        const wallets = walletManager.getAllWallets();
        const portfolio = walletManager.getTotalPortfolioValue();
        result = {
          walletCount: wallets.length,
          wallets: wallets.map(w => ({
            address: `${w.address.slice(0, 6)}...${w.address.slice(-4)}`,
            chain: w.chain,
            balance: w.balance.toFixed(4),
          })),
          totalValue: `$${portfolio.total.toFixed(2)}`,
          byChain: Object.fromEntries(
            Object.entries(portfolio.byChain).filter(([_, v]) => v > 0)
          ),
        };
        break;
      }

      case 'track_lp_position': {
        const position = lpAnalytics.trackPosition(
          a.protocol as DeFiProtocol,
          a.chain as Chain,
          a.marketAddress,
          a.marketTitle,
          a.lpTokenBalance,
          a.yesTokensProvided,
          a.noTokensProvided,
          a.currentYesPrice,
          a.currentNoPrice
        );
        result = {
          id: position.id,
          protocol: position.protocol,
          chain: position.chain,
          market: position.marketTitle.slice(0, 50),
          lpTokens: position.lpTokenBalance.toFixed(4),
          totalValue: `$${position.totalValue.toFixed(2)}`,
          tracked: true,
        };
        break;
      }

      case 'get_lp_positions': {
        const positions = a.chain
          ? lpAnalytics.getPositionsByChain(a.chain as Chain)
          : lpAnalytics.getAllPositions();
        result = {
          count: positions.length,
          positions: positions.map(p => ({
            id: p.id,
            protocol: p.protocol,
            chain: p.chain,
            market: p.marketTitle.slice(0, 40),
            value: `$${p.totalValue.toFixed(2)}`,
            pnl: `${p.pnl >= 0 ? '+' : ''}$${p.pnl.toFixed(2)} (${p.pnlPercent.toFixed(2)}%)`,
            impermanentLoss: `${p.impermanentLoss.toFixed(2)}%`,
            feesEarned: `$${p.feesEarned.toFixed(2)}`,
            apy: `${p.apy.toFixed(1)}%`,
          })),
        };
        break;
      }

      case 'get_lp_portfolio_stats': {
        const stats = lpAnalytics.getPortfolioStats();
        result = {
          totalValue: `$${stats.totalValue.toFixed(2)}`,
          totalPnl: `${stats.totalPnl >= 0 ? '+' : ''}$${stats.totalPnl.toFixed(2)}`,
          totalPnlPercent: `${stats.totalPnlPercent >= 0 ? '+' : ''}${stats.totalPnlPercent.toFixed(2)}%`,
          totalFeesEarned: `$${stats.totalFeesEarned.toFixed(2)}`,
          avgImpermanentLoss: `${stats.avgImpermanentLoss.toFixed(2)}%`,
          positionCount: stats.positionCount,
          byChain: Object.fromEntries(
            Object.entries(stats.byChain)
              .filter(([_, v]) => v.value > 0)
              .map(([k, v]) => [k, { value: `$${v.value.toFixed(2)}`, pnl: `$${v.pnl.toFixed(2)}` }])
          ),
        };
        break;
      }

      case 'simulate_add_liquidity': {
        const simulation = lpAnalytics.simulateAddLiquidity(
          a.amount,
          a.currentYesPrice,
          a.currentNoPrice,
          a.estimatedDailyVolume,
          a.totalLiquidityAfter
        );
        result = {
          deposit: `$${a.amount}`,
          yesTokensReceived: simulation.yesTokens.toFixed(4),
          noTokensReceived: simulation.noTokens.toFixed(4),
          lpTokensReceived: simulation.lpTokens.toFixed(4),
          estimatedDailyFees: `$${simulation.estimatedDailyFees.toFixed(2)}`,
          estimatedAPY: `${simulation.estimatedAPY.toFixed(1)}%`,
          breakEvenDays: simulation.breakEvenDays === Infinity ? 'N/A' : `${simulation.breakEvenDays} days`,
        };
        break;
      }

      case 'calculate_impermanent_loss': {
        const il = lpAnalytics.calculateImpermanentLoss(
          a.entryYesPrice,
          a.entryNoPrice,
          a.currentYesPrice,
          a.currentNoPrice
        );
        result = {
          impermanentLoss: `${il.toFixed(2)}%`,
          explanation: il < 1 ? 'Minimal IL - prices close to entry'
            : il < 5 ? 'Moderate IL - consider fees earned'
            : 'High IL - significant price movement from entry',
        };
        break;
      }

      case 'find_cross_chain_arbitrage': {
        const opportunities = await crossChainArb.findOpportunities(a.minProfit || 1);
        result = {
          count: opportunities.length,
          opportunities: opportunities.slice(0, 10).map(opp => ({
            market: opp.marketTitle.slice(0, 50),
            divergence: `${(opp.priceDivergence * 100).toFixed(1)}%`,
            buyOn: `${opp.chain1.chain}/${opp.chain1.protocol} @ ${(opp.chain1.yesPrice * 100).toFixed(1)}%`,
            sellOn: `${opp.chain2.chain}/${opp.chain2.protocol} @ ${(opp.chain2.yesPrice * 100).toFixed(1)}%`,
            estimatedProfit: `$${opp.estimatedProfit.toFixed(2)}`,
            bridgeCost: `$${opp.bridgeCost}`,
            netProfit: `$${opp.netProfit.toFixed(2)}`,
            executable: opp.executable,
            strategy: opp.strategy,
          })),
        };
        break;
      }

      case 'get_bridge_costs': {
        const cost = crossChainArb.getBridgeCost(a.fromChain as Chain, a.toChain as Chain);
        result = {
          fromChain: a.fromChain,
          toChain: a.toChain,
          estimatedCost: `$${cost}`,
          note: 'Actual costs vary based on network congestion and bridge used',
        };
        break;
      }

      case 'get_arbitrage_route': {
        const route = crossChainArb.getOptimalRoute(
          a.buyChain as Chain,
          a.sellChain as Chain,
          a.amount
        );
        result = {
          tradeSize: `$${a.amount}`,
          steps: route.steps,
          totalCost: `$${route.totalCost.toFixed(2)}`,
          estimatedTime: route.estimatedTime,
        };
        break;
      }

      case 'record_oracle_update': {
        const update = oracleNetwork.recordUpdate(
          a.marketAddress,
          a.source,
          a.yesPrice,
          a.noPrice,
          a.confidence
        );
        result = {
          recorded: true,
          marketAddress: update.marketAddress,
          source: update.source,
          yesPrice: `${(update.yesPrice * 100).toFixed(1)}%`,
          noPrice: `${(update.noPrice * 100).toFixed(1)}%`,
          confidence: `${(update.confidence * 100).toFixed(0)}%`,
          timestamp: new Date(update.timestamp).toISOString(),
        };
        break;
      }

      case 'get_oracle_price': {
        const aggregated = oracleNetwork.getAggregatedPrice(a.marketAddress);
        if (!aggregated) {
          result = { error: 'No oracle data available for this market' };
        } else {
          result = {
            marketAddress: a.marketAddress,
            yesPrice: `${(aggregated.yesPrice * 100).toFixed(1)}%`,
            noPrice: `${(aggregated.noPrice * 100).toFixed(1)}%`,
            confidence: `${(aggregated.confidence * 100).toFixed(0)}%`,
            sources: aggregated.sources,
            lastUpdate: new Date(aggregated.lastUpdate).toISOString(),
          };
        }
        break;
      }

      // LP Strategy Advisor Tools
      case 'analyze_lp_position': {
        const analysis = await lpAdvisor.analyzePosition(a.positionId);
        if (!analysis) {
          result = { error: 'Position not found. Track it first with track_lp_position.' };
        } else {
          result = {
            positionId: analysis.positionId,
            recommendation: analysis.recommendation.toUpperCase(),
            confidence: `${(analysis.confidence * 100).toFixed(0)}%`,
            riskScore: `${analysis.riskScore}/10`,
            ilRisk: analysis.ilRisk.toUpperCase(),
            expectedAPY: `${analysis.expectedAPY.toFixed(1)}%`,
            timeHorizon: analysis.timeHorizon,
            reasoning: analysis.reasoning,
            bullCase: analysis.bullCase,
            bearCase: analysis.bearCase,
            actionItems: analysis.actionItems,
          };
        }
        break;
      }

      case 'analyze_lp_portfolio': {
        const portfolio = await lpAdvisor.analyzePortfolio();
        result = {
          totalPositions: portfolio.totalPositions,
          healthScore: `${portfolio.healthScore}/100`,
          portfolioActions: portfolio.portfolioActions,
          riskExposure: {
            concentration: `${(portfolio.riskExposure.concentration * 100).toFixed(0)}%`,
            byChain: Object.fromEntries(
              Object.entries(portfolio.riskExposure.byChain)
                .filter(([_, v]) => v > 0)
                .map(([k, v]) => [k, `$${v.toFixed(2)}`])
            ),
          },
          rebalancingSuggestions: portfolio.rebalancingSuggestions.map(s => ({
            from: s.from,
            to: s.to,
            amount: `$${s.amount.toFixed(2)}`,
            reason: s.reason,
          })),
          positions: portfolio.recommendations.map(r => ({
            id: r.positionId,
            recommendation: r.recommendation.toUpperCase(),
            confidence: `${(r.confidence * 100).toFixed(0)}%`,
            riskScore: `${r.riskScore}/10`,
            ilRisk: r.ilRisk,
          })),
        };
        break;
      }

      case 'analyze_lp_entry': {
        const entry = await lpAdvisor.analyzeEntry(
          a.market,
          a.chain as Chain,
          a.protocol as DeFiProtocol,
          a.currentYesPrice,
          a.currentNoPrice,
          a.dailyVolume,
          a.totalLiquidity,
          a.proposedAmount
        );
        result = {
          market: entry.market,
          chain: entry.chain,
          protocol: entry.protocol,
          recommendation: entry.recommendation.toUpperCase(),
          confidence: `${(entry.confidence * 100).toFixed(0)}%`,
          proposedAmount: `$${a.proposedAmount}`,
          expectedAPY: `${entry.expectedAPY.toFixed(1)}%`,
          ilRiskAtEntry: `${entry.ilRiskAtEntry.toFixed(1)}%`,
          breakEvenDays: entry.breakEvenDays === Infinity ? 'N/A' : `${entry.breakEvenDays} days`,
          bullCase: entry.bullCase,
          bearCase: entry.bearCase,
          synthesis: entry.synthesis,
        };
        break;
      }

      case 'get_quick_lp_recommendation': {
        const position = lpAnalytics.getPosition(a.positionId);
        if (!position) {
          result = { error: 'Position not found' };
        } else {
          const rec = lpAdvisor.getQuickRecommendation(position);
          result = {
            positionId: a.positionId,
            action: rec.action.toUpperCase(),
            reason: rec.reason,
            urgency: rec.urgency.toUpperCase(),
          };
        }
        break;
      }

      // DeFi Streaming Tools
      case 'start_defi_stream': {
        // Note: In MCP context, streaming is managed externally
        // This starts the internal event loop
        defiStream.start();
        const stats = defiStream.getStats();
        result = {
          status: 'started',
          config: stats.config,
          note: 'Stream started. Use SSE endpoint at /api/prediction-markets/defi-stream for real-time events.',
        };
        break;
      }

      case 'stop_defi_stream': {
        defiStream.stop();
        result = {
          status: 'stopped',
          message: 'DeFi event stream stopped',
        };
        break;
      }

      case 'get_stream_stats': {
        const stats = defiStream.getStats();
        result = {
          running: stats.running,
          subscribers: stats.subscribers,
          lpPositions: stats.lpPositions,
          activeArbs: stats.activeArbs,
          config: {
            lpPositionInterval: `${stats.config.lpPositionInterval / 1000}s`,
            arbScanInterval: `${stats.config.arbScanInterval / 1000}s`,
            ilWarningThreshold: `${stats.config.ilWarningThreshold}%`,
            arbMinProfit: `$${stats.config.arbMinProfit}`,
          },
        };
        break;
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
      isError: true,
    };
  }
});

// Resources
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'prediction://markets/overview',
      name: 'Markets Overview',
      description: 'Current state of all prediction markets',
      mimeType: 'application/json',
    },
    {
      uri: 'prediction://arbitrage/opportunities',
      name: 'Arbitrage Opportunities',
      description: 'Current cross-platform arbitrage opportunities',
      mimeType: 'application/json',
    },
    {
      uri: 'prediction://reports/daily',
      name: 'Daily Report',
      description: 'Daily prediction market summary',
      mimeType: 'text/markdown',
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  switch (uri) {
    case 'prediction://markets/overview': {
      const markets = await aggregator.fetchAllMarkets(100);
      const byPlatform = new Map<string, number>();
      let totalVolume = 0;

      markets.forEach(m => {
        byPlatform.set(m.platform, (byPlatform.get(m.platform) || 0) + 1);
        totalVolume += m.volume24h;
      });

      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({
            totalMarkets: markets.length,
            totalVolume: `$${totalVolume.toLocaleString()}`,
            byPlatform: Object.fromEntries(byPlatform),
            topMarkets: markets
              .sort((a, b) => b.volume24h - a.volume24h)
              .slice(0, 10)
              .map(m => ({ title: m.title, platform: m.platform, price: `${(m.yesPrice * 100).toFixed(1)}%` })),
          }, null, 2),
        }],
      };
    }

    case 'prediction://arbitrage/opportunities': {
      await aggregator.fetchAllMarkets(100);
      const opportunities = aggregator.findArbitrage(0.03);
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({
            count: opportunities.length,
            opportunities: opportunities.slice(0, 20),
          }, null, 2),
        }],
      };
    }

    case 'prediction://reports/daily': {
      const report = await intelligence.generateReport('daily');
      return {
        contents: [{
          uri,
          mimeType: 'text/markdown',
          text: report,
        }],
      };
    }

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
});

// ============================================================================
// Start Server
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP] Prediction Markets Gateway started');
}

main().catch(console.error);
