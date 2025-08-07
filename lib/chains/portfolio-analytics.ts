/**
 * Multi-chain portfolio tracking and analytics
 * 
 * This module provides comprehensive portfolio analysis across multiple
 * blockchains, including asset allocation, performance tracking, risk analysis,
 * and yield farming analytics.
 */

import {
  ChainId,
  UnifiedTransaction,
  UnifiedAccount,
  TokenBalance,
  DeFiInteraction,
  PriceData,
  LiquidityData,
  CHAIN_INFO
} from './types';

// Portfolio interfaces
export interface Portfolio {
  id: string;
  name: string;
  owner: string;
  addresses: Array<{ chainId: ChainId; address: string; label?: string }>;
  totalValueUsd: number;
  lastUpdated: number;
  created: number;
  
  // Asset breakdown
  assets: PortfolioAsset[];
  
  // Performance metrics
  performance: PerformanceMetrics;
  
  // Risk analysis
  riskAnalysis: RiskAnalysis;
  
  // DeFi positions
  defiPositions: DeFiPosition[];
  
  // Analytics
  analytics: PortfolioAnalytics;
}

export interface PortfolioAsset {
  chainId: ChainId;
  tokenAddress: string;
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  priceUsd: number;
  valueUsd: number;
  allocation: number; // Percentage of total portfolio
  change24h: number; // Percentage change in 24h
  
  // Position details
  positions: AssetPosition[];
}

export interface AssetPosition {
  type: 'wallet' | 'defi' | 'staking' | 'farming' | 'lending';
  address: string;
  chainId: ChainId;
  balance: string;
  valueUsd: number;
  apy?: number; // Annual percentage yield
  protocol?: string;
  metadata: any;
}

export interface PerformanceMetrics {
  totalReturn: number; // Total return percentage
  totalReturnUsd: number; // Total return in USD
  
  // Time-based returns
  return24h: number;
  return7d: number;
  return30d: number;
  return1y: number;
  
  // Risk-adjusted returns
  sharpeRatio: number;
  maxDrawdown: number;
  volatility: number;
  
  // Performance history
  history: PerformanceDataPoint[];
}

export interface PerformanceDataPoint {
  timestamp: number;
  totalValueUsd: number;
  return24h: number;
  assets: Array<{ symbol: string; valueUsd: number; allocation: number }>;
}

export interface RiskAnalysis {
  overallRisk: 'low' | 'medium' | 'high' | 'extreme';
  riskScore: number; // 0-100
  
  // Risk factors
  concentration: ConcentrationRisk;
  liquidity: LiquidityRisk;
  defi: DeFiRisk;
  bridge: BridgeRisk;
  
  // Risk metrics
  valueAtRisk: number; // VaR at 95% confidence
  betaToMarket: number; // Beta relative to crypto market
  correlations: Array<{ symbol: string; correlation: number }>;
}

export interface ConcentrationRisk {
  score: number;
  topAssetAllocation: number;
  top3AssetsAllocation: number;
  chainConcentration: Array<{ chainId: ChainId; allocation: number }>;
  riskFactors: string[];
}

export interface LiquidityRisk {
  score: number;
  illiquidAssets: number; // Percentage of portfolio in illiquid assets
  averageDailyVolume: number;
  riskFactors: string[];
}

export interface DeFiRisk {
  score: number;
  protocolsUsed: string[];
  totalValueLocked: number;
  impermanentLossRisk: number;
  smartContractRisk: number;
  riskFactors: string[];
}

export interface BridgeRisk {
  score: number;
  bridgedAssets: number; // Percentage of assets that are bridged
  bridgeProtocols: string[];
  riskFactors: string[];
}

export interface DeFiPosition {
  id: string;
  protocol: string;
  type: 'lending' | 'borrowing' | 'farming' | 'staking' | 'liquidity_provision';
  chainId: ChainId;
  
  // Position details
  principal: number; // USD value of principal
  currentValue: number; // Current USD value
  apy: number; // Current APY
  
  // Assets involved
  assets: Array<{
    symbol: string;
    amount: string;
    valueUsd: number;
  }>;
  
  // Risks
  impermanentLoss?: number; // Current IL percentage
  liquidationRisk?: number; // Risk of liquidation (0-100)
  
  // Rewards
  pendingRewards: Array<{
    symbol: string;
    amount: string;
    valueUsd: number;
  }>;
  
  // Metadata
  poolAddress?: string;
  created: number;
  lastUpdated: number;
}

export interface PortfolioAnalytics {
  // Diversification metrics
  diversification: DiversificationAnalysis;
  
  // Yield analysis
  yieldAnalysis: YieldAnalysis;
  
  // Transaction analysis
  transactionAnalysis: TransactionAnalysis;
  
  // Tax analysis
  taxAnalysis: TaxAnalysis;
  
  // Recommendations
  recommendations: Recommendation[];
}

export interface DiversificationAnalysis {
  score: number; // 0-100, higher is better diversified
  assetDiversification: number;
  chainDiversification: number;
  protocolDiversification: number;
  sectorDiversification: Array<{ sector: string; allocation: number }>;
}

export interface YieldAnalysis {
  totalYieldUsd: number;
  averageApy: number;
  yieldSources: Array<{
    protocol: string;
    chainId: ChainId;
    yieldUsd: number;
    apy: number;
  }>;
  compoundingOpportunities: Array<{
    protocol: string;
    potentialYield: number;
    riskScore: number;
  }>;
}

export interface TransactionAnalysis {
  totalTransactions: number;
  totalFees: number; // USD spent on fees
  avgTransactionSize: number;
  chainUsage: Array<{ chainId: ChainId; txCount: number; fees: number }>;
  patterns: string[];
}

export interface TaxAnalysis {
  realizedGains: number;
  realizedLosses: number;
  unrealizedGains: number;
  unrealizedLosses: number;
  taxLoss: Array<{
    symbol: string;
    amount: number;
    potentialTaxSaving: number;
  }>;
}

export interface Recommendation {
  type: 'rebalance' | 'reduce_risk' | 'increase_yield' | 'tax_optimization' | 'diversification';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  expectedImpact: string;
  actions: Array<{
    action: string;
    chainId?: ChainId;
    asset?: string;
    amount?: number;
  }>;
}

// Main portfolio tracker class
export class PortfolioTracker {
  private portfolios: Map<string, Portfolio> = new Map();
  private priceCache: Map<string, PriceData> = new Map();
  private performanceCache: Map<string, PerformanceDataPoint[]> = new Map();

  /**
   * Create a new portfolio
   */
  async createPortfolio(
    name: string,
    owner: string,
    addresses: Array<{ chainId: ChainId; address: string; label?: string }>
  ): Promise<Portfolio> {
    const portfolioId = `portfolio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const portfolio: Portfolio = {
      id: portfolioId,
      name,
      owner,
      addresses,
      totalValueUsd: 0,
      lastUpdated: Date.now(),
      created: Date.now(),
      assets: [],
      performance: this.createEmptyPerformanceMetrics(),
      riskAnalysis: this.createEmptyRiskAnalysis(),
      defiPositions: [],
      analytics: this.createEmptyAnalytics()
    };

    // Initial portfolio analysis
    await this.updatePortfolio(portfolioId, portfolio);
    
    this.portfolios.set(portfolioId, portfolio);
    return portfolio;
  }

  /**
   * Update portfolio with latest data
   */
  async updatePortfolio(portfolioId: string, portfolio?: Portfolio): Promise<Portfolio> {
    const existingPortfolio = portfolio || this.portfolios.get(portfolioId);
    if (!existingPortfolio) {
      throw new Error(`Portfolio not found: ${portfolioId}`);
    }

    // Fetch current balances and prices
    const assets = await this.fetchPortfolioAssets(existingPortfolio.addresses);
    const defiPositions = await this.fetchDeFiPositions(existingPortfolio.addresses);

    // Calculate total value
    const totalValueUsd = assets.reduce((sum, asset) => sum + asset.valueUsd, 0) +
                         defiPositions.reduce((sum, position) => sum + position.currentValue, 0);

    // Update performance history
    await this.updatePerformanceHistory(portfolioId, totalValueUsd, assets);

    // Calculate performance metrics
    const performance = await this.calculatePerformanceMetrics(portfolioId);

    // Analyze risks
    const riskAnalysis = await this.analyzeRisks(assets, defiPositions);

    // Generate analytics and recommendations
    const analytics = await this.generateAnalytics(assets, defiPositions, existingPortfolio.addresses);

    const updatedPortfolio: Portfolio = {
      ...existingPortfolio,
      assets,
      defiPositions,
      totalValueUsd,
      performance,
      riskAnalysis,
      analytics,
      lastUpdated: Date.now()
    };

    this.portfolios.set(portfolioId, updatedPortfolio);
    return updatedPortfolio;
  }

  /**
   * Get portfolio by ID
   */
  getPortfolio(portfolioId: string): Portfolio | undefined {
    return this.portfolios.get(portfolioId);
  }

  /**
   * Compare multiple portfolios
   */
  async comparePortfolios(portfolioIds: string[]): Promise<PortfolioComparison> {
    const portfolios = portfolioIds.map(id => this.portfolios.get(id)).filter(Boolean) as Portfolio[];
    
    if (portfolios.length < 2) {
      throw new Error('At least 2 portfolios required for comparison');
    }

    return {
      portfolios: portfolios.map(p => ({
        id: p.id,
        name: p.name,
        totalValue: p.totalValueUsd,
        return24h: p.performance.return24h,
        return30d: p.performance.return30d,
        riskScore: p.riskAnalysis.riskScore,
        sharpeRatio: p.performance.sharpeRatio,
        diversificationScore: p.analytics.diversification.score
      })),
      bestPerformer: portfolios.reduce((best, current) => 
        current.performance.return30d > best.performance.return30d ? current : best
      ).id,
      lowestRisk: portfolios.reduce((lowest, current) => 
        current.riskAnalysis.riskScore < lowest.riskAnalysis.riskScore ? current : lowest
      ).id,
      recommendations: this.generatePortfolioComparisonRecommendations(portfolios)
    };
  }

  // Private helper methods

  private async fetchPortfolioAssets(
    addresses: Array<{ chainId: ChainId; address: string; label?: string }>
  ): Promise<PortfolioAsset[]> {
    const allAssets = new Map<string, PortfolioAsset>();

    for (const addressInfo of addresses) {
      try {
        // This would use the blockchain clients to fetch token balances
        const tokenBalances = await this.fetchTokenBalances(addressInfo.chainId, addressInfo.address);
        
        for (const balance of tokenBalances) {
          const key = `${addressInfo.chainId}:${balance.tokenAddress}`;
          
          if (!allAssets.has(key)) {
            const priceData = await this.fetchTokenPrice(addressInfo.chainId, balance.tokenAddress);
            
            allAssets.set(key, {
              chainId: addressInfo.chainId,
              tokenAddress: balance.tokenAddress,
              symbol: balance.symbol,
              name: balance.name,
              balance: '0',
              decimals: balance.decimals,
              priceUsd: priceData?.price || 0,
              valueUsd: 0,
              allocation: 0,
              change24h: priceData?.change24h || 0,
              positions: []
            });
          }

          const asset = allAssets.get(key)!;
          const balanceNumber = parseFloat(balance.balance) / Math.pow(10, balance.decimals);
          const valueUsd = balanceNumber * asset.priceUsd;

          asset.balance = (parseFloat(asset.balance) + balanceNumber).toString();
          asset.valueUsd += valueUsd;
          
          asset.positions.push({
            type: 'wallet',
            address: addressInfo.address,
            chainId: addressInfo.chainId,
            balance: balance.balance,
            valueUsd,
            metadata: { label: addressInfo.label }
          });
        }
      } catch (error) {
        console.error(`Error fetching assets for ${addressInfo.chainId}:${addressInfo.address}:`, error);
      }
    }

    // Calculate allocations
    const totalValue = Array.from(allAssets.values()).reduce((sum, asset) => sum + asset.valueUsd, 0);
    
    for (const asset of allAssets.values()) {
      asset.allocation = totalValue > 0 ? (asset.valueUsd / totalValue) * 100 : 0;
    }

    return Array.from(allAssets.values()).sort((a, b) => b.valueUsd - a.valueUsd);
  }

  private async fetchDeFiPositions(
    addresses: Array<{ chainId: ChainId; address: string; label?: string }>
  ): Promise<DeFiPosition[]> {
    const positions: DeFiPosition[] = [];

    for (const addressInfo of addresses) {
      try {
        // This would analyze DeFi protocol interactions
        const defiInteractions = await this.fetchDeFiInteractions(addressInfo.chainId, addressInfo.address);
        
        // Convert interactions to positions
        const addressPositions = await this.convertInteractionsToPositions(defiInteractions, addressInfo);
        positions.push(...addressPositions);
      } catch (error) {
        console.error(`Error fetching DeFi positions for ${addressInfo.chainId}:${addressInfo.address}:`, error);
      }
    }

    return positions;
  }

  private async fetchTokenBalances(chainId: ChainId, address: string): Promise<TokenBalance[]> {
    // This would use the appropriate blockchain client
    // For now, return empty array
    return [];
  }

  private async fetchTokenPrice(chainId: ChainId, tokenAddress: string): Promise<PriceData | null> {
    const key = `${chainId}:${tokenAddress}`;
    
    if (this.priceCache.has(key)) {
      const cached = this.priceCache.get(key)!;
      if (Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 minute cache
        return cached;
      }
    }

    // This would fetch from price APIs (CoinGecko, CoinMarketCap, etc.)
    const priceData: PriceData = {
      tokenAddress,
      chainId,
      symbol: 'UNKNOWN',
      price: 0,
      change24h: 0,
      volume24h: 0,
      marketCap: 0,
      timestamp: Date.now(),
      source: 'mock'
    };

    this.priceCache.set(key, priceData);
    return priceData;
  }

  private async fetchDeFiInteractions(chainId: ChainId, address: string): Promise<DeFiInteraction[]> {
    // This would use blockchain clients to fetch DeFi interactions
    return [];
  }

  private async convertInteractionsToPositions(
    interactions: DeFiInteraction[],
    addressInfo: { chainId: ChainId; address: string; label?: string }
  ): Promise<DeFiPosition[]> {
    // Convert DeFi interactions to position format
    return [];
  }

  private async updatePerformanceHistory(
    portfolioId: string,
    totalValueUsd: number,
    assets: PortfolioAsset[]
  ): Promise<void> {
    if (!this.performanceCache.has(portfolioId)) {
      this.performanceCache.set(portfolioId, []);
    }

    const history = this.performanceCache.get(portfolioId)!;
    const now = Date.now();

    // Calculate 24h return
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const previousDataPoint = history.find(point => Math.abs(point.timestamp - dayAgo) < 60 * 60 * 1000);
    const return24h = previousDataPoint ? ((totalValueUsd - previousDataPoint.totalValueUsd) / previousDataPoint.totalValueUsd) * 100 : 0;

    const dataPoint: PerformanceDataPoint = {
      timestamp: now,
      totalValueUsd,
      return24h,
      assets: assets.map(asset => ({
        symbol: asset.symbol,
        valueUsd: asset.valueUsd,
        allocation: asset.allocation
      }))
    };

    history.push(dataPoint);

    // Keep only last 365 days of data
    const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
    this.performanceCache.set(
      portfolioId,
      history.filter(point => point.timestamp > oneYearAgo)
    );
  }

  private async calculatePerformanceMetrics(portfolioId: string): Promise<PerformanceMetrics> {
    const history = this.performanceCache.get(portfolioId) || [];
    
    if (history.length < 2) {
      return this.createEmptyPerformanceMetrics();
    }

    const latest = history[history.length - 1];
    const returns = this.calculateReturns(history);

    return {
      totalReturn: returns.total,
      totalReturnUsd: 0, // Would calculate based on initial investment
      return24h: returns.day1,
      return7d: returns.week1,
      return30d: returns.month1,
      return1y: returns.year1,
      sharpeRatio: this.calculateSharpeRatio(history),
      maxDrawdown: this.calculateMaxDrawdown(history),
      volatility: this.calculateVolatility(history),
      history
    };
  }

  private async analyzeRisks(assets: PortfolioAsset[], defiPositions: DeFiPosition[]): Promise<RiskAnalysis> {
    const concentration = this.analyzeConcentrationRisk(assets);
    const liquidity = this.analyzeLiquidityRisk(assets);
    const defi = this.analyzeDeFiRisk(defiPositions);
    const bridge = this.analyzeBridgeRisk(assets);

    const overallScore = (concentration.score + liquidity.score + defi.score + bridge.score) / 4;
    
    return {
      overallRisk: this.scoreToRiskLevel(overallScore),
      riskScore: overallScore,
      concentration,
      liquidity,
      defi,
      bridge,
      valueAtRisk: this.calculateVaR(assets),
      betaToMarket: 0.8, // Would calculate based on historical correlations
      correlations: []
    };
  }

  private async generateAnalytics(
    assets: PortfolioAsset[],
    defiPositions: DeFiPosition[],
    addresses: Array<{ chainId: ChainId; address: string; label?: string }>
  ): Promise<PortfolioAnalytics> {
    return {
      diversification: this.analyzeDiversification(assets),
      yieldAnalysis: this.analyzeYield(defiPositions),
      transactionAnalysis: await this.analyzeTransactions(addresses),
      taxAnalysis: this.analyzeTax(assets),
      recommendations: this.generateRecommendations(assets, defiPositions)
    };
  }

  // Helper methods for calculations
  private createEmptyPerformanceMetrics(): PerformanceMetrics {
    return {
      totalReturn: 0,
      totalReturnUsd: 0,
      return24h: 0,
      return7d: 0,
      return30d: 0,
      return1y: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      volatility: 0,
      history: []
    };
  }

  private createEmptyRiskAnalysis(): RiskAnalysis {
    return {
      overallRisk: 'low',
      riskScore: 0,
      concentration: { score: 0, topAssetAllocation: 0, top3AssetsAllocation: 0, chainConcentration: [], riskFactors: [] },
      liquidity: { score: 0, illiquidAssets: 0, averageDailyVolume: 0, riskFactors: [] },
      defi: { score: 0, protocolsUsed: [], totalValueLocked: 0, impermanentLossRisk: 0, smartContractRisk: 0, riskFactors: [] },
      bridge: { score: 0, bridgedAssets: 0, bridgeProtocols: [], riskFactors: [] },
      valueAtRisk: 0,
      betaToMarket: 0,
      correlations: []
    };
  }

  private createEmptyAnalytics(): PortfolioAnalytics {
    return {
      diversification: { score: 0, assetDiversification: 0, chainDiversification: 0, protocolDiversification: 0, sectorDiversification: [] },
      yieldAnalysis: { totalYieldUsd: 0, averageApy: 0, yieldSources: [], compoundingOpportunities: [] },
      transactionAnalysis: { totalTransactions: 0, totalFees: 0, avgTransactionSize: 0, chainUsage: [], patterns: [] },
      taxAnalysis: { realizedGains: 0, realizedLosses: 0, unrealizedGains: 0, unrealizedLosses: 0, taxLoss: [] },
      recommendations: []
    };
  }

  private calculateReturns(history: PerformanceDataPoint[]): {
    total: number;
    day1: number;
    week1: number;
    month1: number;
    year1: number;
  } {
    const now = Date.now();
    const latest = history[history.length - 1];
    
    const findClosestDataPoint = (targetTime: number) => {
      return history.reduce((closest, point) => {
        const currentDiff = Math.abs(point.timestamp - targetTime);
        const closestDiff = Math.abs(closest.timestamp - targetTime);
        return currentDiff < closestDiff ? point : closest;
      });
    };

    const day1Point = findClosestDataPoint(now - 24 * 60 * 60 * 1000);
    const week1Point = findClosestDataPoint(now - 7 * 24 * 60 * 60 * 1000);
    const month1Point = findClosestDataPoint(now - 30 * 24 * 60 * 60 * 1000);
    const year1Point = findClosestDataPoint(now - 365 * 24 * 60 * 60 * 1000);
    const firstPoint = history[0];

    const calculateReturn = (from: PerformanceDataPoint, to: PerformanceDataPoint) => {
      return from.totalValueUsd > 0 ? ((to.totalValueUsd - from.totalValueUsd) / from.totalValueUsd) * 100 : 0;
    };

    return {
      total: calculateReturn(firstPoint, latest),
      day1: calculateReturn(day1Point, latest),
      week1: calculateReturn(week1Point, latest),
      month1: calculateReturn(month1Point, latest),
      year1: calculateReturn(year1Point, latest)
    };
  }

  private calculateSharpeRatio(history: PerformanceDataPoint[]): number {
    if (history.length < 30) return 0;

    const returns = history.slice(1).map((point, i) => point.return24h);
    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    // Assuming risk-free rate of 3% annually (0.0082% daily)
    const riskFreeRate = 0.0082;
    
    return stdDev > 0 ? (avgReturn - riskFreeRate) / stdDev : 0;
  }

  private calculateMaxDrawdown(history: PerformanceDataPoint[]): number {
    let maxDrawdown = 0;
    let peak = 0;

    for (const point of history) {
      if (point.totalValueUsd > peak) {
        peak = point.totalValueUsd;
      }
      const drawdown = (peak - point.totalValueUsd) / peak;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }

    return maxDrawdown * 100;
  }

  private calculateVolatility(history: PerformanceDataPoint[]): number {
    if (history.length < 2) return 0;

    const returns = history.slice(1).map(point => point.return24h);
    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  private analyzeConcentrationRisk(assets: PortfolioAsset[]): ConcentrationRisk {
    if (assets.length === 0) {
      return { score: 0, topAssetAllocation: 0, top3AssetsAllocation: 0, chainConcentration: [], riskFactors: [] };
    }

    const sortedAssets = [...assets].sort((a, b) => b.allocation - a.allocation);
    const topAssetAllocation = sortedAssets[0]?.allocation || 0;
    const top3AssetsAllocation = sortedAssets.slice(0, 3).reduce((sum, asset) => sum + asset.allocation, 0);

    // Calculate chain concentration
    const chainAllocation = new Map<ChainId, number>();
    assets.forEach(asset => {
      chainAllocation.set(asset.chainId, (chainAllocation.get(asset.chainId) || 0) + asset.allocation);
    });

    const chainConcentration = Array.from(chainAllocation.entries())
      .map(([chainId, allocation]) => ({ chainId, allocation }))
      .sort((a, b) => b.allocation - a.allocation);

    // Calculate risk score
    let score = 0;
    const riskFactors: string[] = [];

    if (topAssetAllocation > 50) {
      score += 40;
      riskFactors.push(`Top asset represents ${topAssetAllocation.toFixed(1)}% of portfolio`);
    } else if (topAssetAllocation > 30) {
      score += 20;
      riskFactors.push(`Top asset represents ${topAssetAllocation.toFixed(1)}% of portfolio`);
    }

    if (top3AssetsAllocation > 80) {
      score += 30;
      riskFactors.push(`Top 3 assets represent ${top3AssetsAllocation.toFixed(1)}% of portfolio`);
    }

    const topChainAllocation = chainConcentration[0]?.allocation || 0;
    if (topChainAllocation > 80) {
      score += 30;
      riskFactors.push(`Over-concentrated in ${chainConcentration[0].chainId} (${topChainAllocation.toFixed(1)}%)`);
    }

    return {
      score: Math.min(score, 100),
      topAssetAllocation,
      top3AssetsAllocation,
      chainConcentration,
      riskFactors
    };
  }

  private analyzeLiquidityRisk(assets: PortfolioAsset[]): LiquidityRisk {
    // Simplified liquidity analysis
    return {
      score: 10,
      illiquidAssets: 5,
      averageDailyVolume: 1000000,
      riskFactors: []
    };
  }

  private analyzeDeFiRisk(positions: DeFiPosition[]): DeFiRisk {
    const protocolsUsed = [...new Set(positions.map(p => p.protocol))];
    const totalValueLocked = positions.reduce((sum, p) => sum + p.currentValue, 0);
    
    let score = 0;
    const riskFactors: string[] = [];

    if (positions.length > 0) {
      score += 20; // Base DeFi risk
      
      const avgImpermanentLoss = positions
        .filter(p => p.impermanentLoss !== undefined)
        .reduce((sum, p, _, arr) => sum + (p.impermanentLoss! / arr.length), 0);
      
      if (avgImpermanentLoss > 10) {
        score += 30;
        riskFactors.push(`High impermanent loss risk (${avgImpermanentLoss.toFixed(1)}%)`);
      }
    }

    return {
      score,
      protocolsUsed,
      totalValueLocked,
      impermanentLossRisk: 0,
      smartContractRisk: protocolsUsed.length * 5, // Simple calculation
      riskFactors
    };
  }

  private analyzeBridgeRisk(assets: PortfolioAsset[]): BridgeRisk {
    // Simplified bridge risk analysis
    return {
      score: 5,
      bridgedAssets: 10,
      bridgeProtocols: [],
      riskFactors: []
    };
  }

  private calculateVaR(assets: PortfolioAsset[]): number {
    // Simplified Value at Risk calculation
    const totalValue = assets.reduce((sum, asset) => sum + asset.valueUsd, 0);
    return totalValue * 0.05; // 5% VaR
  }

  private scoreToRiskLevel(score: number): 'low' | 'medium' | 'high' | 'extreme' {
    if (score < 25) return 'low';
    if (score < 50) return 'medium';
    if (score < 75) return 'high';
    return 'extreme';
  }

  private analyzeDiversification(assets: PortfolioAsset[]): DiversificationAnalysis {
    const uniqueChains = new Set(assets.map(asset => asset.chainId)).size;
    const totalChains = Object.keys(CHAIN_INFO).length;
    const chainDiversification = (uniqueChains / totalChains) * 100;

    return {
      score: Math.min((assets.length * 2) + chainDiversification, 100),
      assetDiversification: Math.min(assets.length * 5, 100),
      chainDiversification,
      protocolDiversification: 50, // Placeholder
      sectorDiversification: []
    };
  }

  private analyzeYield(positions: DeFiPosition[]): YieldAnalysis {
    const totalYieldUsd = positions.reduce((sum, pos) => {
      return sum + pos.pendingRewards.reduce((rewardSum, reward) => rewardSum + reward.valueUsd, 0);
    }, 0);

    const averageApy = positions.length > 0 
      ? positions.reduce((sum, pos) => sum + pos.apy, 0) / positions.length 
      : 0;

    return {
      totalYieldUsd,
      averageApy,
      yieldSources: positions.map(pos => ({
        protocol: pos.protocol,
        chainId: pos.chainId,
        yieldUsd: pos.pendingRewards.reduce((sum, reward) => sum + reward.valueUsd, 0),
        apy: pos.apy
      })),
      compoundingOpportunities: []
    };
  }

  private async analyzeTransactions(
    addresses: Array<{ chainId: ChainId; address: string; label?: string }>
  ): Promise<TransactionAnalysis> {
    return {
      totalTransactions: 0,
      totalFees: 0,
      avgTransactionSize: 0,
      chainUsage: [],
      patterns: []
    };
  }

  private analyzeTax(assets: PortfolioAsset[]): TaxAnalysis {
    return {
      realizedGains: 0,
      realizedLosses: 0,
      unrealizedGains: 0,
      unrealizedLosses: 0,
      taxLoss: []
    };
  }

  private generateRecommendations(assets: PortfolioAsset[], defiPositions: DeFiPosition[]): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Check for concentration risk
    const topAsset = assets.reduce((max, asset) => asset.allocation > max.allocation ? asset : max, assets[0]);
    if (topAsset && topAsset.allocation > 40) {
      recommendations.push({
        type: 'diversification',
        priority: 'high',
        title: 'Reduce concentration risk',
        description: `Your portfolio is over-concentrated in ${topAsset.symbol} (${topAsset.allocation.toFixed(1)}%). Consider diversifying.`,
        expectedImpact: 'Reduced portfolio volatility and risk',
        actions: [{
          action: `Reduce ${topAsset.symbol} allocation to under 30%`,
          chainId: topAsset.chainId,
          asset: topAsset.symbol,
          amount: (topAsset.allocation - 30) / 100
        }]
      });
    }

    return recommendations;
  }

  private generatePortfolioComparisonRecommendations(portfolios: Portfolio[]): string[] {
    return [
      'Consider rebalancing underperforming portfolios',
      'Diversify high-risk concentrated positions',
      'Optimize yield opportunities across portfolios'
    ];
  }
}

// Supporting interfaces
export interface PortfolioComparison {
  portfolios: Array<{
    id: string;
    name: string;
    totalValue: number;
    return24h: number;
    return30d: number;
    riskScore: number;
    sharpeRatio: number;
    diversificationScore: number;
  }>;
  bestPerformer: string;
  lowestRisk: string;
  recommendations: string[];
}