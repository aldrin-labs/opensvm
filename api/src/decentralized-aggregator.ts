#!/usr/bin/env bun
/**
 * Decentralized Prediction Market Aggregator Protocol
 *
 * Architecture:
 * 1. Users deposit SOL into OpenSVM Bank vault
 * 2. Protocol distributes funds across platforms based on best odds
 * 3. Settlement happens on Solana with automatic profit distribution
 *
 * Supported Platforms:
 * - Kalshi (CFTC-regulated, requires KYC)
 * - Polymarket (Crypto-native, USDC)
 * - Manifold (Play money, converted to real value)
 *
 * Flow:
 * 1. Deposit SOL -> USDC conversion via Jupiter
 * 2. Route to platform with best price
 * 3. Track positions across all platforms
 * 4. Auto-rebalance when arbitrage detected
 * 5. Settle profits on Solana
 */

import { PublicKey, Connection, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

// ============================================================================
// Types
// ============================================================================

export type Platform = 'kalshi' | 'polymarket' | 'manifold';

export interface AggregatorConfig {
  /** Solana RPC endpoint */
  rpcUrl: string;
  /** OpenSVM Bank API URL */
  bankApiUrl: string;
  /** Minimum deposit in SOL */
  minDeposit: number;
  /** Maximum deposit in SOL */
  maxDeposit: number;
  /** Protocol fee (e.g., 0.01 = 1%) */
  protocolFee: number;
  /** Auto-rebalance threshold (spread difference) */
  rebalanceThreshold: number;
}

export interface Vault {
  id: string;
  owner: string;           // Solana wallet pubkey
  balanceSOL: number;
  balanceUSDC: number;
  allocations: PlatformAllocation[];
  positions: AggregatedPosition[];
  totalPnl: number;
  createdAt: number;
}

export interface PlatformAllocation {
  platform: Platform;
  balanceUSD: number;
  percentage: number;
  positions: number;
}

export interface AggregatedPosition {
  id: string;
  marketQuery: string;      // Common identifier across platforms
  side: 'yes' | 'no';
  allocations: {
    platform: Platform;
    marketId: string;
    quantity: number;
    avgPrice: number;
    currentPrice: number;
  }[];
  totalQuantity: number;
  avgPrice: number;
  unrealizedPnl: number;
  createdAt: number;
}

export interface AggregatorOrder {
  id: string;
  vaultId: string;
  marketQuery: string;
  side: 'yes' | 'no';
  amountUSD: number;
  routing: {
    platform: Platform;
    marketId: string;
    price: number;
    allocation: number;   // Percentage of order
    expectedQuantity: number;
  }[];
  status: 'pending' | 'executing' | 'completed' | 'failed';
  createdAt: number;
  executedAt?: number;
}

export interface ArbitrageOpportunity {
  marketQuery: string;
  buyPlatform: Platform;
  buyMarketId: string;
  buyPrice: number;
  sellPlatform: Platform;
  sellMarketId: string;
  sellPrice: number;
  spread: number;
  expectedProfit: number;   // Per $100 invested
}

// ============================================================================
// Platform Price Fetchers
// ============================================================================

interface PlatformPrice {
  platform: Platform;
  marketId: string;
  title: string;
  yesPrice: number;
  noPrice: number;
  liquidity: number;
}

async function fetchKalshiPrices(query: string): Promise<PlatformPrice[]> {
  try {
    const response = await fetch(
      `https://api.elections.kalshi.com/trade-api/v2/markets?status=open&limit=50`,
      { signal: AbortSignal.timeout(30000) }
    );
    const data = await response.json();

    return data.markets
      .filter((m: any) => m.title.toLowerCase().includes(query.toLowerCase()))
      .map((m: any) => ({
        platform: 'kalshi' as Platform,
        marketId: m.ticker,
        title: m.title,
        yesPrice: m.yes_bid / 100,
        noPrice: m.no_bid / 100,
        liquidity: m.liquidity || 0,
      }));
  } catch (e) {
    console.error('Kalshi fetch error:', e);
    return [];
  }
}

async function fetchPolymarketPrices(query: string): Promise<PlatformPrice[]> {
  try {
    const response = await fetch(
      `https://gamma-api.polymarket.com/markets?closed=false&limit=50`,
      { signal: AbortSignal.timeout(30000) }
    );
    const data = await response.json();

    return (data || [])
      .filter((m: any) => (m.question || m.title || '').toLowerCase().includes(query.toLowerCase()))
      .map((m: any) => ({
        platform: 'polymarket' as Platform,
        marketId: m.conditionId || m.id,
        title: m.question || m.title,
        yesPrice: parseFloat(m.outcomePrices?.[0] || '0.5'),
        noPrice: parseFloat(m.outcomePrices?.[1] || '0.5'),
        liquidity: parseFloat(m.liquidity || '0'),
      }));
  } catch (e) {
    console.error('Polymarket fetch error:', e);
    return [];
  }
}

async function fetchManifoldPrices(query: string): Promise<PlatformPrice[]> {
  try {
    const response = await fetch(
      `https://api.manifold.markets/v0/search-markets?term=${encodeURIComponent(query)}&limit=50`,
      { signal: AbortSignal.timeout(30000) }
    );
    const data = await response.json();

    return (data || [])
      .filter((m: any) => m.outcomeType === 'BINARY')
      .map((m: any) => ({
        platform: 'manifold' as Platform,
        marketId: m.id,
        title: m.question,
        yesPrice: m.probability || 0.5,
        noPrice: 1 - (m.probability || 0.5),
        liquidity: m.totalLiquidity || 0,
      }));
  } catch (e) {
    console.error('Manifold fetch error:', e);
    return [];
  }
}

// ============================================================================
// Smart Order Router
// ============================================================================

export class SmartOrderRouter {
  private config: AggregatorConfig;

  constructor(config: AggregatorConfig) {
    this.config = config;
  }

  /**
   * Find best prices across all platforms for a market query
   */
  async findBestPrices(query: string): Promise<{
    query: string;
    prices: PlatformPrice[];
    bestYes: PlatformPrice | null;
    bestNo: PlatformPrice | null;
    arbitrageOpportunity: ArbitrageOpportunity | null;
  }> {
    // Fetch from all platforms in parallel
    const [kalshiPrices, polymarketPrices, manifoldPrices] = await Promise.all([
      fetchKalshiPrices(query),
      fetchPolymarketPrices(query),
      fetchManifoldPrices(query),
    ]);

    const allPrices = [...kalshiPrices, ...polymarketPrices, ...manifoldPrices];

    if (allPrices.length === 0) {
      return {
        query,
        prices: [],
        bestYes: null,
        bestNo: null,
        arbitrageOpportunity: null,
      };
    }

    // Find best YES price (lowest = cheapest to buy)
    const sortedByYes = [...allPrices].sort((a, b) => a.yesPrice - b.yesPrice);
    const bestYes = sortedByYes[0];

    // Find best NO price (lowest = cheapest to buy)
    const sortedByNo = [...allPrices].sort((a, b) => a.noPrice - b.noPrice);
    const bestNo = sortedByNo[0];

    // Check for arbitrage (can we buy both YES and NO for less than $1?)
    let arbitrageOpportunity: ArbitrageOpportunity | null = null;

    if (bestYes && bestNo && bestYes.platform !== bestNo.platform) {
      const totalCost = bestYes.yesPrice + bestNo.noPrice;
      if (totalCost < 0.98) { // 2% margin for fees
        arbitrageOpportunity = {
          marketQuery: query,
          buyPlatform: bestYes.platform,
          buyMarketId: bestYes.marketId,
          buyPrice: bestYes.yesPrice,
          sellPlatform: bestNo.platform,
          sellMarketId: bestNo.marketId,
          sellPrice: bestNo.noPrice,
          spread: 1 - totalCost,
          expectedProfit: ((1 - totalCost) / totalCost) * 100, // % return
        };
      }
    }

    return {
      query,
      prices: allPrices,
      bestYes,
      bestNo,
      arbitrageOpportunity,
    };
  }

  /**
   * Route an order to optimal platforms based on price and liquidity
   */
  async routeOrder(
    marketQuery: string,
    side: 'yes' | 'no',
    amountUSD: number
  ): Promise<AggregatorOrder['routing']> {
    const { prices } = await this.findBestPrices(marketQuery);

    if (prices.length === 0) {
      throw new Error(`No markets found for query: ${marketQuery}`);
    }

    // Sort by price (lowest first for buying)
    const sorted = side === 'yes'
      ? [...prices].sort((a, b) => a.yesPrice - b.yesPrice)
      : [...prices].sort((a, b) => a.noPrice - b.noPrice);

    // Allocate based on liquidity-weighted best prices
    const routing: AggregatorOrder['routing'] = [];
    let remainingAmount = amountUSD;

    for (const price of sorted) {
      if (remainingAmount <= 0) break;

      const priceValue = side === 'yes' ? price.yesPrice : price.noPrice;

      // Limit allocation based on liquidity (max 20% of market liquidity)
      const maxFromLiquidity = price.liquidity * 0.2;
      const allocation = Math.min(remainingAmount, maxFromLiquidity || remainingAmount);

      if (allocation > 0) {
        routing.push({
          platform: price.platform,
          marketId: price.marketId,
          price: priceValue,
          allocation: allocation / amountUSD,
          expectedQuantity: Math.floor(allocation / priceValue),
        });
        remainingAmount -= allocation;
      }
    }

    // If we couldn't allocate everything, put rest in best price
    if (remainingAmount > 0 && routing.length > 0) {
      routing[0].allocation += remainingAmount / amountUSD;
      routing[0].expectedQuantity += Math.floor(remainingAmount / routing[0].price);
    }

    return routing;
  }

  /**
   * Find all arbitrage opportunities across platforms
   */
  async scanArbitrage(queries: string[]): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];

    for (const query of queries) {
      const result = await this.findBestPrices(query);
      if (result.arbitrageOpportunity) {
        opportunities.push(result.arbitrageOpportunity);
      }
    }

    return opportunities.sort((a, b) => b.expectedProfit - a.expectedProfit);
  }
}

// ============================================================================
// Vault Manager
// ============================================================================

export class VaultManager {
  private config: AggregatorConfig;
  private connection: Connection;
  private vaults = new Map<string, Vault>();
  private router: SmartOrderRouter;
  private orderCounter = 0;

  constructor(config: AggregatorConfig) {
    this.config = config;
    this.connection = new Connection(config.rpcUrl);
    this.router = new SmartOrderRouter(config);
  }

  /**
   * Create a new vault for a user
   */
  createVault(owner: string): Vault {
    const vault: Vault = {
      id: `VAULT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      owner,
      balanceSOL: 0,
      balanceUSDC: 0,
      allocations: [],
      positions: [],
      totalPnl: 0,
      createdAt: Date.now(),
    };
    this.vaults.set(vault.id, vault);
    return vault;
  }

  /**
   * Get vault by ID
   */
  getVault(vaultId: string): Vault | null {
    return this.vaults.get(vaultId) || null;
  }

  /**
   * Deposit SOL into vault (simulated - in production would verify on-chain)
   */
  async deposit(vaultId: string, amountSOL: number): Promise<{
    vault: Vault;
    usdcReceived: number;
    txSignature: string;
  }> {
    const vault = this.vaults.get(vaultId);
    if (!vault) throw new Error('Vault not found');

    if (amountSOL < this.config.minDeposit) {
      throw new Error(`Minimum deposit is ${this.config.minDeposit} SOL`);
    }
    if (amountSOL > this.config.maxDeposit) {
      throw new Error(`Maximum deposit is ${this.config.maxDeposit} SOL`);
    }

    // Simulate SOL to USDC conversion (would use Jupiter in production)
    const solPrice = 100; // Simulated SOL price
    const usdcReceived = amountSOL * solPrice * (1 - 0.001); // 0.1% swap fee

    vault.balanceSOL += amountSOL;
    vault.balanceUSDC += usdcReceived;

    return {
      vault,
      usdcReceived,
      txSignature: `SIM-${Date.now()}`, // Would be real tx signature
    };
  }

  /**
   * Withdraw from vault
   */
  async withdraw(vaultId: string, amountUSDC: number): Promise<{
    vault: Vault;
    solReceived: number;
    txSignature: string;
  }> {
    const vault = this.vaults.get(vaultId);
    if (!vault) throw new Error('Vault not found');

    if (amountUSDC > vault.balanceUSDC) {
      throw new Error(`Insufficient balance. Have ${vault.balanceUSDC} USDC`);
    }

    // Simulate USDC to SOL conversion
    const solPrice = 100;
    const fee = amountUSDC * this.config.protocolFee;
    const solReceived = (amountUSDC - fee) / solPrice * (1 - 0.001);

    vault.balanceUSDC -= amountUSDC;
    vault.balanceSOL = Math.max(0, vault.balanceSOL - solReceived);

    return {
      vault,
      solReceived,
      txSignature: `SIM-${Date.now()}`,
    };
  }

  /**
   * Place an aggregated order across platforms
   */
  async placeOrder(
    vaultId: string,
    marketQuery: string,
    side: 'yes' | 'no',
    amountUSD: number
  ): Promise<AggregatorOrder> {
    const vault = this.vaults.get(vaultId);
    if (!vault) throw new Error('Vault not found');

    if (amountUSD > vault.balanceUSDC) {
      throw new Error(`Insufficient balance. Have ${vault.balanceUSDC} USDC`);
    }

    // Get optimal routing
    const routing = await this.router.routeOrder(marketQuery, side, amountUSD);

    this.orderCounter++;
    const order: AggregatorOrder = {
      id: `ORDER-${this.orderCounter}`,
      vaultId,
      marketQuery,
      side,
      amountUSD,
      routing,
      status: 'pending',
      createdAt: Date.now(),
    };

    // Execute order (simulated - would interact with platform APIs)
    order.status = 'executing';

    try {
      // Deduct from vault
      vault.balanceUSDC -= amountUSD;

      // Create aggregated position
      const position: AggregatedPosition = {
        id: `POS-${Date.now()}`,
        marketQuery,
        side,
        allocations: routing.map(r => ({
          platform: r.platform,
          marketId: r.marketId,
          quantity: r.expectedQuantity,
          avgPrice: r.price,
          currentPrice: r.price,
        })),
        totalQuantity: routing.reduce((sum, r) => sum + r.expectedQuantity, 0),
        avgPrice: amountUSD / routing.reduce((sum, r) => sum + r.expectedQuantity, 0),
        unrealizedPnl: 0,
        createdAt: Date.now(),
      };

      vault.positions.push(position);

      // Update allocations
      for (const r of routing) {
        const existing = vault.allocations.find(a => a.platform === r.platform);
        if (existing) {
          existing.balanceUSD += r.allocation * amountUSD;
          existing.positions++;
        } else {
          vault.allocations.push({
            platform: r.platform,
            balanceUSD: r.allocation * amountUSD,
            percentage: r.allocation,
            positions: 1,
          });
        }
      }

      // Recalculate percentages
      const totalAllocated = vault.allocations.reduce((sum, a) => sum + a.balanceUSD, 0);
      for (const a of vault.allocations) {
        a.percentage = a.balanceUSD / totalAllocated;
      }

      order.status = 'completed';
      order.executedAt = Date.now();
    } catch (e) {
      order.status = 'failed';
      vault.balanceUSDC += amountUSD; // Refund
    }

    return order;
  }

  /**
   * Execute arbitrage across platforms
   */
  async executeArbitrage(
    vaultId: string,
    opportunity: ArbitrageOpportunity,
    amountUSD: number
  ): Promise<{
    orders: AggregatorOrder[];
    expectedProfit: number;
  }> {
    const vault = this.vaults.get(vaultId);
    if (!vault) throw new Error('Vault not found');

    // Need 2x the amount to buy both sides
    const totalRequired = amountUSD * 2;
    if (totalRequired > vault.balanceUSDC) {
      throw new Error(`Need ${totalRequired} USDC for arbitrage, have ${vault.balanceUSDC}`);
    }

    // Buy YES on cheap platform
    const buyYes = await this.placeOrder(
      vaultId,
      opportunity.marketQuery,
      'yes',
      amountUSD
    );

    // Buy NO on cheap platform
    const buyNo = await this.placeOrder(
      vaultId,
      opportunity.marketQuery,
      'no',
      amountUSD
    );

    // When market resolves, one side pays out $1 per contract
    // Profit = $1 payout - (cost of YES + cost of NO)
    const totalCost = opportunity.buyPrice + opportunity.sellPrice;
    const expectedProfit = (1 - totalCost) * (amountUSD / opportunity.buyPrice);

    return {
      orders: [buyYes, buyNo],
      expectedProfit,
    };
  }

  /**
   * Get vault portfolio summary
   */
  getPortfolio(vaultId: string): {
    vault: Vault;
    summary: {
      totalValueUSD: number;
      cashUSD: number;
      positionsUSD: number;
      pnlUSD: number;
      pnlPercent: number;
      platformBreakdown: PlatformAllocation[];
    };
  } {
    const vault = this.vaults.get(vaultId);
    if (!vault) throw new Error('Vault not found');

    const positionsValue = vault.positions.reduce((sum, p) => {
      return sum + p.allocations.reduce((pSum, a) => {
        return pSum + a.currentPrice * a.quantity;
      }, 0);
    }, 0);

    const totalValue = vault.balanceUSDC + positionsValue;
    const initialValue = vault.balanceSOL * 100; // Simulated initial SOL value

    return {
      vault,
      summary: {
        totalValueUSD: totalValue,
        cashUSD: vault.balanceUSDC,
        positionsUSD: positionsValue,
        pnlUSD: vault.totalPnl,
        pnlPercent: initialValue > 0 ? (vault.totalPnl / initialValue) * 100 : 0,
        platformBreakdown: vault.allocations,
      },
    };
  }
}

// ============================================================================
// Protocol (Main Entry Point)
// ============================================================================

export class DecentralizedAggregatorProtocol {
  public config: AggregatorConfig;
  public vaultManager: VaultManager;
  public router: SmartOrderRouter;

  constructor(config?: Partial<AggregatorConfig>) {
    this.config = {
      rpcUrl: config?.rpcUrl || 'https://api.mainnet-beta.solana.com',
      bankApiUrl: config?.bankApiUrl || 'https://osvm.ai/api/bank',
      minDeposit: config?.minDeposit || 0.1,
      maxDeposit: config?.maxDeposit || 1000,
      protocolFee: config?.protocolFee || 0.01,
      rebalanceThreshold: config?.rebalanceThreshold || 0.05,
    };

    this.vaultManager = new VaultManager(this.config);
    this.router = new SmartOrderRouter(this.config);
  }

  /**
   * Quick setup for a new user
   */
  async onboard(walletAddress: string, depositSOL: number): Promise<{
    vault: Vault;
    usdcBalance: number;
  }> {
    const vault = this.vaultManager.createVault(walletAddress);
    const { usdcReceived } = await this.vaultManager.deposit(vault.id, depositSOL);

    return {
      vault,
      usdcBalance: usdcReceived,
    };
  }

  /**
   * Find best opportunity for a market
   */
  async analyze(marketQuery: string): Promise<{
    bestYes: PlatformPrice | null;
    bestNo: PlatformPrice | null;
    arbitrage: ArbitrageOpportunity | null;
    recommendation: string;
  }> {
    const result = await this.router.findBestPrices(marketQuery);

    let recommendation = 'No markets found';

    if (result.arbitrageOpportunity) {
      recommendation = `ARBITRAGE: Buy YES on ${result.arbitrageOpportunity.buyPlatform} at ${(result.arbitrageOpportunity.buyPrice * 100).toFixed(1)}%, buy NO on ${result.arbitrageOpportunity.sellPlatform} at ${(result.arbitrageOpportunity.sellPrice * 100).toFixed(1)}% for ${result.arbitrageOpportunity.expectedProfit.toFixed(2)}% profit`;
    } else if (result.bestYes) {
      recommendation = `Best YES price: ${(result.bestYes.yesPrice * 100).toFixed(1)}% on ${result.bestYes.platform}`;
    }

    return {
      bestYes: result.bestYes,
      bestNo: result.bestNo,
      arbitrage: result.arbitrageOpportunity,
      recommendation,
    };
  }

  /**
   * Execute optimal trade
   */
  async trade(
    vaultId: string,
    marketQuery: string,
    side: 'yes' | 'no',
    amountUSD: number
  ): Promise<AggregatorOrder> {
    return this.vaultManager.placeOrder(vaultId, marketQuery, side, amountUSD);
  }

  /**
   * Auto-arbitrage scan and execute
   */
  async autoArbitrage(
    vaultId: string,
    searchTerms: string[],
    maxAmountPerTrade: number
  ): Promise<{
    scanned: number;
    opportunities: ArbitrageOpportunity[];
    executed: AggregatorOrder[];
    totalExpectedProfit: number;
  }> {
    const opportunities = await this.router.scanArbitrage(searchTerms);
    const executed: AggregatorOrder[] = [];
    let totalExpectedProfit = 0;

    // Execute top opportunities
    for (const opp of opportunities.slice(0, 3)) {
      if (opp.expectedProfit > 2) { // Only if > 2% profit
        try {
          const result = await this.vaultManager.executeArbitrage(
            vaultId,
            opp,
            maxAmountPerTrade
          );
          executed.push(...result.orders);
          totalExpectedProfit += result.expectedProfit;
        } catch (e) {
          console.error('Arbitrage execution failed:', e);
        }
      }
    }

    return {
      scanned: searchTerms.length,
      opportunities,
      executed,
      totalExpectedProfit,
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

let protocolInstance: DecentralizedAggregatorProtocol | null = null;

export function getAggregatorProtocol(config?: Partial<AggregatorConfig>): DecentralizedAggregatorProtocol {
  if (!protocolInstance) {
    protocolInstance = new DecentralizedAggregatorProtocol(config);
  }
  return protocolInstance;
}

export default {
  DecentralizedAggregatorProtocol,
  getAggregatorProtocol,
  SmartOrderRouter,
  VaultManager,
};
