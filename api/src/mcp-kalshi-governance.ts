/**
 * Kalshi API Integration for Governance Voting
 *
 * Uses REAL Kalshi prediction market data to inform governance decisions.
 * Kalshi is a CFTC-regulated prediction market platform.
 *
 * Features:
 * 1. Fetch real market prices from Kalshi API
 * 2. Link governance proposals to Kalshi markets
 * 3. Use market sentiment to weight votes
 * 4. Track prediction accuracy for reputation
 *
 * API: https://api.elections.kalshi.com/trade-api/v2
 * Docs: https://docs.kalshi.com
 */

// ============================================================================
// Kalshi API Types (Based on official API)
// ============================================================================

export interface KalshiSeries {
  ticker: string;
  title: string;
  category: string;
  frequency: string;
  tags: string[];
}

export interface KalshiEvent {
  event_ticker: string;
  series_ticker: string;
  title: string;
  subtitle?: string;
  category: string;
  mutually_exclusive: boolean;
  strike_date?: string;
  markets: string[];
}

export interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  title: string;
  subtitle?: string;
  status: 'open' | 'closed' | 'settled';
  yes_bid: number;      // In cents (0-100)
  yes_ask: number;
  no_bid: number;
  no_ask: number;
  last_price: number;   // In cents
  volume: number;
  volume_24h: number;
  open_interest: number;
  result?: 'yes' | 'no';
  close_time?: string;
  expiration_time?: string;
}

export interface KalshiOrderbook {
  yes: Array<{ price: number; quantity: number }>;
  no: Array<{ price: number; quantity: number }>;
}

export interface KalshiTrade {
  trade_id: string;
  ticker: string;
  side: 'yes' | 'no';
  yes_price: number;
  no_price: number;
  count: number;
  created_time: string;
  taker_side: 'yes' | 'no';
}

// ============================================================================
// Kalshi API Client
// ============================================================================

export class KalshiAPIClient {
  private baseUrl: string;
  private timeout: number;
  private apiKey?: string;
  private accessToken?: string;
  private tokenExpiry?: number;

  constructor(options: {
    baseUrl?: string;
    timeout?: number;
    apiKey?: string;
  } = {}) {
    // Note: Despite "elections" in URL, this provides ALL markets
    this.baseUrl = options.baseUrl || 'https://api.elections.kalshi.com/trade-api/v2';
    this.timeout = options.timeout || 30000;
    this.apiKey = options.apiKey;
  }

  /**
   * Make authenticated request (for private endpoints)
   */
  private async request<T>(
    method: string,
    path: string,
    options: {
      params?: Record<string, string | number | boolean>;
      body?: any;
      authenticated?: boolean;
    } = {}
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    // Add query parameters
    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // Add authentication if required
    if (options.authenticated && this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Kalshi API error: ${response.status} - ${error}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  // ==========================================================================
  // Public Endpoints (No Auth Required)
  // ==========================================================================

  /**
   * Get series information
   */
  async getSeries(ticker: string): Promise<KalshiSeries> {
    const response = await this.request<{ series: KalshiSeries }>('GET', `/series/${ticker}`);
    return response.series;
  }

  /**
   * List all series
   */
  async listSeries(options: {
    status?: 'open' | 'closed';
    cursor?: string;
    limit?: number;
  } = {}): Promise<{ series: KalshiSeries[]; cursor?: string }> {
    return this.request('GET', '/series', { params: options as any });
  }

  /**
   * Get event details
   */
  async getEvent(eventTicker: string): Promise<KalshiEvent> {
    const response = await this.request<{ event: KalshiEvent }>('GET', `/events/${eventTicker}`);
    return response.event;
  }

  /**
   * List events
   */
  async listEvents(options: {
    series_ticker?: string;
    status?: 'open' | 'closed' | 'settled';
    cursor?: string;
    limit?: number;
  } = {}): Promise<{ events: KalshiEvent[]; cursor?: string }> {
    return this.request('GET', '/events', { params: options as any });
  }

  /**
   * Get market details
   */
  async getMarket(ticker: string): Promise<KalshiMarket> {
    const response = await this.request<{ market: KalshiMarket }>('GET', `/markets/${ticker}`);
    return response.market;
  }

  /**
   * List markets
   */
  async listMarkets(options: {
    event_ticker?: string;
    series_ticker?: string;
    status?: 'open' | 'closed' | 'settled';
    cursor?: string;
    limit?: number;
  } = {}): Promise<{ markets: KalshiMarket[]; cursor?: string }> {
    return this.request('GET', '/markets', { params: options as any });
  }

  /**
   * Get market orderbook
   */
  async getOrderbook(ticker: string): Promise<KalshiOrderbook> {
    const response = await this.request<{ orderbook: KalshiOrderbook }>('GET', `/markets/${ticker}/orderbook`);
    return response.orderbook;
  }

  /**
   * Get recent trades for a market
   */
  async getTrades(ticker: string, options: {
    cursor?: string;
    limit?: number;
  } = {}): Promise<{ trades: KalshiTrade[]; cursor?: string }> {
    return this.request('GET', `/markets/${ticker}/trades`, { params: options as any });
  }

  /**
   * Search markets by query
   */
  async searchMarkets(query: string, options: {
    status?: 'open' | 'closed' | 'settled';
    limit?: number;
  } = {}): Promise<{ markets: KalshiMarket[] }> {
    return this.request('GET', '/markets', {
      params: { ...options, search: query } as any,
    });
  }

  // ==========================================================================
  // Convenience Methods
  // ==========================================================================

  /**
   * Get current price for a market (YES probability as 0-1)
   */
  async getMarketPrice(ticker: string): Promise<{
    ticker: string;
    yesPrice: number;
    noPrice: number;
    midPrice: number;
    spread: number;
    volume24h: number;
  }> {
    const market = await this.getMarket(ticker);

    const yesPrice = market.yes_bid / 100; // Convert cents to decimal
    const noPrice = market.no_bid / 100;
    const midPrice = (market.yes_bid + market.yes_ask) / 200;
    const spread = (market.yes_ask - market.yes_bid) / 100;

    return {
      ticker: market.ticker,
      yesPrice,
      noPrice,
      midPrice,
      spread,
      volume24h: market.volume_24h,
    };
  }

  /**
   * Get multiple market prices at once
   */
  async getMarketPrices(tickers: string[]): Promise<Map<string, {
    yesPrice: number;
    noPrice: number;
    volume24h: number;
  }>> {
    const results = new Map();

    // Batch requests (Kalshi may have rate limits)
    for (const ticker of tickers) {
      try {
        const price = await this.getMarketPrice(ticker);
        results.set(ticker, price);
      } catch (error) {
        console.error(`Failed to fetch price for ${ticker}:`, error);
      }
    }

    return results;
  }
}

// ============================================================================
// Governance Integration
// ============================================================================

export interface KalshiGovernanceProposal {
  id: string;
  title: string;
  description: string;
  proposer: string;

  // Kalshi market link
  kalshiTicker?: string;        // Direct market ticker
  kalshiEventTicker?: string;   // Event with multiple markets

  // Market data (cached)
  marketPrice?: number;         // YES price as probability
  marketVolume?: number;
  lastUpdated?: number;

  // Voting influence
  marketWeight: number;         // 0-1, how much market influences decision
  voterWeight: number;          // 0-1, how much votes influence decision

  // Decision
  votesFor: bigint;
  votesAgainst: bigint;
  marketSignal: 'bullish' | 'bearish' | 'neutral';
  combinedScore: number;        // Weighted combination of votes + market

  status: 'active' | 'passed' | 'failed' | 'executed';
  createdAt: number;
  endsAt: number;
}

export interface MarketVoteWeight {
  // Market prices affect vote multipliers
  // If you vote WITH market sentiment, your vote counts more
  // This rewards informed voting
  withMarketMultiplier: number;   // e.g., 1.5x
  againstMarketMultiplier: number; // e.g., 0.75x
  neutralMultiplier: number;       // e.g., 1.0x
}

export class KalshiGovernance {
  private client: KalshiAPIClient;
  private proposals = new Map<string, KalshiGovernanceProposal>();
  private proposalCounter = 0;

  // Configuration
  private marketWeight: number;
  private voterWeight: number;
  private voteMultipliers: MarketVoteWeight;

  constructor(options: {
    apiKey?: string;
    marketWeight?: number;  // How much market prices influence decisions
    voterWeight?: number;   // How much votes influence decisions
    voteMultipliers?: Partial<MarketVoteWeight>;
  } = {}) {
    this.client = new KalshiAPIClient({ apiKey: options.apiKey });

    // Default: 30% market, 70% votes
    this.marketWeight = options.marketWeight ?? 0.3;
    this.voterWeight = options.voterWeight ?? 0.7;

    this.voteMultipliers = {
      withMarketMultiplier: options.voteMultipliers?.withMarketMultiplier ?? 1.25,
      againstMarketMultiplier: options.voteMultipliers?.againstMarketMultiplier ?? 0.8,
      neutralMultiplier: options.voteMultipliers?.neutralMultiplier ?? 1.0,
    };
  }

  // ==========================================================================
  // Market Discovery
  // ==========================================================================

  /**
   * Search Kalshi for markets related to a topic
   */
  async findRelevantMarkets(query: string): Promise<KalshiMarket[]> {
    const result = await this.client.searchMarkets(query, { status: 'open', limit: 10 });
    return result.markets;
  }

  /**
   * Get all crypto/blockchain related markets
   */
  async getCryptoMarkets(): Promise<KalshiMarket[]> {
    const queries = ['bitcoin', 'crypto', 'ethereum', 'blockchain', 'solana'];
    const markets: KalshiMarket[] = [];

    for (const query of queries) {
      try {
        const result = await this.client.searchMarkets(query, { status: 'open' });
        markets.push(...result.markets);
      } catch (e) {
        // Ignore search failures
      }
    }

    // Dedupe by ticker
    const seen = new Set<string>();
    return markets.filter(m => {
      if (seen.has(m.ticker)) return false;
      seen.add(m.ticker);
      return true;
    });
  }

  // ==========================================================================
  // Proposal Management
  // ==========================================================================

  /**
   * Create a proposal linked to a Kalshi market
   */
  async createProposal(
    proposer: string,
    params: {
      title: string;
      description: string;
      kalshiTicker?: string;
      kalshiEventTicker?: string;
      durationMs?: number;
      marketWeight?: number;
      voterWeight?: number;
    }
  ): Promise<KalshiGovernanceProposal> {
    this.proposalCounter++;
    const id = `KALSHI-GOV-${this.proposalCounter}`;
    const now = Date.now();

    // Fetch initial market data if linked
    let marketPrice: number | undefined;
    let marketVolume: number | undefined;

    if (params.kalshiTicker) {
      try {
        const price = await this.client.getMarketPrice(params.kalshiTicker);
        marketPrice = price.yesPrice;
        marketVolume = price.volume24h;
      } catch (e) {
        console.warn(`Could not fetch Kalshi market ${params.kalshiTicker}:`, e);
      }
    }

    const proposal: KalshiGovernanceProposal = {
      id,
      title: params.title,
      description: params.description,
      proposer,
      kalshiTicker: params.kalshiTicker,
      kalshiEventTicker: params.kalshiEventTicker,
      marketPrice,
      marketVolume,
      lastUpdated: marketPrice ? now : undefined,
      marketWeight: params.marketWeight ?? this.marketWeight,
      voterWeight: params.voterWeight ?? this.voterWeight,
      votesFor: BigInt(0),
      votesAgainst: BigInt(0),
      marketSignal: this.getMarketSignal(marketPrice),
      combinedScore: 0,
      status: 'active',
      createdAt: now,
      endsAt: now + (params.durationMs ?? 7 * 24 * 60 * 60 * 1000),
    };

    this.proposals.set(id, proposal);
    console.log(`[Kalshi Gov] Proposal created: ${id} (linked to ${params.kalshiTicker || 'no market'})`);

    return proposal;
  }

  /**
   * Cast a vote with market-informed weighting
   */
  async vote(
    proposalId: string,
    voter: string,
    support: boolean,
    votingPower: bigint
  ): Promise<{
    effectiveVotingPower: bigint;
    multiplier: number;
    marketInfluence: string;
  }> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error('Proposal not found');
    if (proposal.status !== 'active') throw new Error('Proposal not active');

    // Refresh market data
    await this.refreshMarketData(proposalId);

    // Calculate vote multiplier based on market alignment
    let multiplier = this.voteMultipliers.neutralMultiplier;
    let marketInfluence = 'neutral';

    if (proposal.marketPrice !== undefined) {
      const marketBullish = proposal.marketPrice > 0.55;
      const marketBearish = proposal.marketPrice < 0.45;

      if (marketBullish && support) {
        multiplier = this.voteMultipliers.withMarketMultiplier;
        marketInfluence = 'aligned (bullish)';
      } else if (marketBearish && !support) {
        multiplier = this.voteMultipliers.withMarketMultiplier;
        marketInfluence = 'aligned (bearish)';
      } else if ((marketBullish && !support) || (marketBearish && support)) {
        multiplier = this.voteMultipliers.againstMarketMultiplier;
        marketInfluence = 'contrarian';
      }
    }

    const effectiveVotingPower = BigInt(Math.floor(Number(votingPower) * multiplier));

    if (support) {
      proposal.votesFor += effectiveVotingPower;
    } else {
      proposal.votesAgainst += effectiveVotingPower;
    }

    // Update combined score
    this.updateCombinedScore(proposal);

    console.log(`[Kalshi Gov] Vote: ${voter} voted ${support ? 'FOR' : 'AGAINST'} with ${multiplier}x multiplier (${marketInfluence})`);

    return { effectiveVotingPower, multiplier, marketInfluence };
  }

  /**
   * Refresh market data for a proposal
   */
  async refreshMarketData(proposalId: string): Promise<void> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || !proposal.kalshiTicker) return;

    try {
      const price = await this.client.getMarketPrice(proposal.kalshiTicker);
      proposal.marketPrice = price.yesPrice;
      proposal.marketVolume = price.volume24h;
      proposal.lastUpdated = Date.now();
      proposal.marketSignal = this.getMarketSignal(price.yesPrice);
      this.updateCombinedScore(proposal);
    } catch (e) {
      console.warn(`Failed to refresh market data for ${proposalId}:`, e);
    }
  }

  /**
   * Finalize a proposal and determine outcome
   */
  async finalizeProposal(proposalId: string): Promise<KalshiGovernanceProposal> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error('Proposal not found');
    if (proposal.status !== 'active') throw new Error('Proposal already finalized');

    const now = Date.now();
    if (now < proposal.endsAt) {
      throw new Error('Voting period not ended');
    }

    // Final market refresh
    await this.refreshMarketData(proposalId);
    this.updateCombinedScore(proposal);

    // Decision based on combined score
    // Score > 0.5 = pass, < 0.5 = fail
    proposal.status = proposal.combinedScore > 0.5 ? 'passed' : 'failed';

    console.log(`[Kalshi Gov] Proposal ${proposalId} finalized: ${proposal.status} (score: ${proposal.combinedScore.toFixed(3)})`);

    return proposal;
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private getMarketSignal(price?: number): 'bullish' | 'bearish' | 'neutral' {
    if (price === undefined) return 'neutral';
    if (price > 0.55) return 'bullish';
    if (price < 0.45) return 'bearish';
    return 'neutral';
  }

  private updateCombinedScore(proposal: KalshiGovernanceProposal): void {
    // Vote score: votesFor / (votesFor + votesAgainst) as 0-1
    const totalVotes = proposal.votesFor + proposal.votesAgainst;
    const voteScore = totalVotes > BigInt(0)
      ? Number(proposal.votesFor) / Number(totalVotes)
      : 0.5;

    // Market score: directly from price (already 0-1)
    const marketScore = proposal.marketPrice ?? 0.5;

    // Weighted combination
    proposal.combinedScore =
      (voteScore * proposal.voterWeight) +
      (marketScore * proposal.marketWeight);
  }

  // ==========================================================================
  // Queries
  // ==========================================================================

  getProposal(id: string): KalshiGovernanceProposal | null {
    return this.proposals.get(id) || null;
  }

  getActiveProposals(): KalshiGovernanceProposal[] {
    return Array.from(this.proposals.values())
      .filter(p => p.status === 'active');
  }

  getStats(): {
    totalProposals: number;
    activeProposals: number;
    passedProposals: number;
    averageMarketAccuracy: number;
    config: {
      marketWeight: number;
      voterWeight: number;
      voteMultipliers: MarketVoteWeight;
    };
  } {
    const all = Array.from(this.proposals.values());
    const passed = all.filter(p => p.status === 'passed');
    const decided = all.filter(p => p.status === 'passed' || p.status === 'failed');

    // Track how often market predicted correctly
    let correctPredictions = 0;
    for (const p of decided) {
      const marketPredictedPass = (p.marketPrice ?? 0.5) > 0.5;
      const actuallyPassed = p.status === 'passed';
      if (marketPredictedPass === actuallyPassed) {
        correctPredictions++;
      }
    }

    return {
      totalProposals: all.length,
      activeProposals: all.filter(p => p.status === 'active').length,
      passedProposals: passed.length,
      averageMarketAccuracy: decided.length > 0
        ? correctPredictions / decided.length
        : 0,
      config: {
        marketWeight: this.marketWeight,
        voterWeight: this.voterWeight,
        voteMultipliers: this.voteMultipliers,
      },
    };
  }

  /**
   * Get the Kalshi API client for direct market access
   */
  getClient(): KalshiAPIClient {
    return this.client;
  }
}

// ============================================================================
// Singleton & Exports
// ============================================================================

let instance: KalshiGovernance | null = null;

export function getKalshiGovernance(options?: {
  apiKey?: string;
  marketWeight?: number;
  voterWeight?: number;
}): KalshiGovernance {
  if (!instance) {
    instance = new KalshiGovernance(options);
  }
  return instance;
}

export default {
  KalshiAPIClient,
  KalshiGovernance,
  getKalshiGovernance,
};
