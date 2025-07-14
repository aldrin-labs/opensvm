import { Connection, PublicKey } from '@solana/web3.js';
import { BaseAnalytics } from './base-analytics';
import {
  CrossChainFlow,
  EcosystemMigration,
  CrossChainArbitrage,
  AnalyticsCallback,
  AnalyticsResponse,
  AnalyticsConfig
} from '@/lib/types/solana-analytics';

export class CrossChainAnalytics extends BaseAnalytics {
  // Monitored bridge protocols
  private readonly SUPPORTED_BRIDGES = [
    'Wormhole',
    'Portal',
    'Allbridge',
    'Multichain',
    'Satellite'
  ];

  // Supported chains for cross-chain analysis
  private readonly SUPPORTED_CHAINS = [
    'Solana',
    'Ethereum',
    'Polygon',
    'Avalanche',
    'BSC',
    'Arbitrum',
    'Optimism'
  ];

  constructor(config: AnalyticsConfig) {
    super(config);
  }

  protected getAnalyticsName(): string {
    return 'Cross-Chain Analytics';
  }

  protected async onInitialize(): Promise<void> {
    // Custom initialization for cross-chain analytics
  }

  protected async onStartMonitoring(): Promise<void> {
    // Cross-chain API data monitoring (60-120 seconds)
    this.createInterval(async () => {
      await this.fetchAndUpdateCrossChainData();
    }, this.config.refreshIntervals.crossChainData);
  }

  // Event-driven callback system
  onFlowUpdate(callback: AnalyticsCallback<CrossChainFlow[]>): void {
    this.registerCallback('flows', callback);
  }

  onMigrationUpdate(callback: AnalyticsCallback<EcosystemMigration[]>): void {
    this.registerCallback('migrations', callback);
  }

  onArbitrageUpdate(callback: AnalyticsCallback<CrossChainArbitrage[]>): void {
    this.registerCallback('crossChainArbitrage', callback);
  }

  // Fetch cross-chain data from multiple bridge APIs
  private async fetchAndUpdateCrossChainData(): Promise<void> {
    const promises = this.SUPPORTED_BRIDGES.map(bridge => this.fetchBridgeSpecificData(bridge));
    const results = await Promise.allSettled(promises);
    
    const flowData: CrossChainFlow[] = [];
    const migrationData: EcosystemMigration[] = [];
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        flowData.push(...result.value.flows);
        migrationData.push(...result.value.migrations);
      } else {
        console.warn(`Failed to fetch data for ${this.SUPPORTED_BRIDGES[index]}:`, result.reason);
      }
    });

    if (flowData.length > 0) {
      await this.cache.insertCrossChainFlows(flowData);
      this.emit('flows', flowData);
    }

    // Calculate cross-chain arbitrage opportunities
    const arbitrageOpportunities = await this.calculateCrossChainArbitrage(flowData);
    if (arbitrageOpportunities.length > 0) {
      this.emit('crossChainArbitrage', arbitrageOpportunities);
    }
  }

  private async fetchBridgeSpecificData(bridge: string): Promise<{
    flows: CrossChainFlow[];
    migrations: EcosystemMigration[];
  } | null> {
    const timestamp = Date.now();
    
    try {
      switch (bridge) {
        case 'Wormhole':
          return await this.fetchWormholeData(timestamp);
        case 'Portal':
          return await this.fetchPortalData(timestamp);
        case 'Allbridge':
          return await this.fetchAllbridgeData(timestamp);
        default:
          return await this.fetchGenericBridgeData(bridge, timestamp);
      }
    } catch (error) {
      console.error(`Error fetching ${bridge} data:`, error);
      return null;
    }
  }

  private async fetchWormholeData(timestamp: number): Promise<{
    flows: CrossChainFlow[];
    migrations: EcosystemMigration[];
  }> {
    try {
      // Fetch real Wormhole data from on-chain program accounts
      const wormholeProgramId = new PublicKey('worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth');
      const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
      
      const programAccounts = await connection.getProgramAccounts(wormholeProgramId, {
        commitment: 'confirmed',
        encoding: 'base64',
        dataSlice: { offset: 0, length: 0 }
      });
      
      // Estimate bridge activity based on program account activity
      const accountCount = programAccounts.length;
      const estimatedVolumePerAccount = 25000; // $25k average per bridge account
      
      const flows: CrossChainFlow[] = [{
        bridgeProtocol: 'Wormhole',
        sourceChain: 'Ethereum',
        targetChain: 'Solana',
        asset: 'USDC',
        volume24h: accountCount * estimatedVolumePerAccount * 0.4, // 40% ETH->SOL
        volumeChange: 0, // Would need historical data
        avgTransactionSize: estimatedVolumePerAccount,
        transactionCount: Math.floor(accountCount * 0.4),
        bridgeFees: accountCount * estimatedVolumePerAccount * 0.4 * 0.001, // 0.1% fees
        timestamp
      }, {
        bridgeProtocol: 'Wormhole',
        sourceChain: 'Solana',
        targetChain: 'Ethereum',
        asset: 'SOL',
        volume24h: accountCount * estimatedVolumePerAccount * 0.3, // 30% SOL->ETH
        volumeChange: 0,
        avgTransactionSize: estimatedVolumePerAccount * 0.8,
        transactionCount: Math.floor(accountCount * 0.3),
        bridgeFees: accountCount * estimatedVolumePerAccount * 0.3 * 0.001,
        timestamp
      }];

      // Migrations would need additional data analysis
      const migrations: EcosystemMigration[] = [];

      return { flows, migrations };
    } catch (error) {
      console.error('Error fetching Wormhole on-chain data:', error);
      return {
        flows: [],
        migrations: []
      };
    }
  }

  private getChainName(chainId: number): string {
    const chains: { [key: number]: string } = {
      1: 'Solana',
      2: 'Ethereum',
      3: 'Terra',
      4: 'BSC',
      5: 'Polygon',
      6: 'Avalanche',
      7: 'Oasis',
      8: 'Algorand',
      9: 'Aurora',
      10: 'Fantom',
      11: 'Karura',
      12: 'Acala',
      13: 'Klaytn',
      14: 'Celo',
      15: 'Near',
      16: 'Moonbeam',
      17: 'Neon',
      18: 'Terra2',
      19: 'Injective',
      20: 'Osmosis',
      21: 'Sui',
      22: 'Aptos',
      23: 'Arbitrum',
      24: 'Optimism',
      25: 'Gnosis',
      26: 'Pythnet'
    };
    return chains[chainId] || `Chain ${chainId}`;
  }

  private async fetchPortalData(timestamp: number): Promise<{
    flows: CrossChainFlow[];
    migrations: EcosystemMigration[];
  }> {
    try {
      // Portal Bridge doesn't have a public API, so we'll use generic approach
      // Real implementation would need to parse on-chain data or use a bridge aggregator
      console.warn('Portal Bridge API not available, returning empty data');
      return {
        flows: [],
        migrations: []
      };
    } catch (error) {
      console.error('Error fetching Portal data:', error);
      throw error;
    }
  }

  private async fetchAllbridgeData(timestamp: number): Promise<{
    flows: CrossChainFlow[];
    migrations: EcosystemMigration[];
  }> {
    try {
      // Allbridge API integration would go here
      // For now, return empty data as their API documentation is limited
      console.warn('Allbridge API integration not available, returning empty data');
      return {
        flows: [],
        migrations: []
      };
    } catch (error) {
      console.error('Error fetching Allbridge data:', error);
      throw error;
    }
  }

  private async fetchGenericBridgeData(bridge: string, timestamp: number): Promise<{
    flows: CrossChainFlow[];
    migrations: EcosystemMigration[];
  }> {
    // For bridges without specific API integration, return empty data
    // Real implementation would integrate with each bridge's specific API
    console.warn(`No specific API integration for ${bridge}, returning empty data`);
    
    return {
      flows: [],
      migrations: []
    };
  }

  private async calculateCrossChainArbitrage(flowData: CrossChainFlow[]): Promise<CrossChainArbitrage[]> {
    const opportunities: CrossChainArbitrage[] = [];
    const timestamp = Date.now();

    // Group flows by asset
    const assetFlows = new Map<string, CrossChainFlow[]>();
    flowData.forEach(flow => {
      if (!assetFlows.has(flow.asset)) {
        assetFlows.set(flow.asset, []);
      }
      assetFlows.get(flow.asset)!.push(flow);
    });

    // Calculate arbitrage opportunities for each asset across different chains
    for (const [asset, flows] of assetFlows) {
      if (flows.length < 2) continue;

      for (let i = 0; i < flows.length; i++) {
        for (let j = i + 1; j < flows.length; j++) {
          const flow1 = flows[i];
          const flow2 = flows[j];

          // Simple price calculation based on average transaction size differences
          const price1 = flow1.avgTransactionSize;
          const price2 = flow2.avgTransactionSize;
          
          const priceDifference = Math.abs(price1 - price2) / Math.min(price1, price2);
          
          if (priceDifference > 0.01) { // 1% threshold
            const potentialProfit = priceDifference * Math.min(flow1.volume24h, flow2.volume24h) * 0.1;
            
            // Estimate bridge time and cost
            const bridgeTime = Math.random() * 30 + 5; // 5-35 minutes
            const bridgeCost = Math.max(flow1.bridgeFees, flow2.bridgeFees);
            const riskScore = this.calculateRiskScore(flow1, flow2);

            opportunities.push({
              asset,
              sourceChain: price1 < price2 ? flow1.sourceChain : flow2.sourceChain,
              targetChain: price1 < price2 ? flow2.targetChain : flow1.targetChain,
              priceDifference,
              potentialProfit,
              bridgeTime,
              bridgeCost,
              riskScore
            });
          }
        }
      }
    }

    return opportunities.sort((a, b) => b.potentialProfit - a.potentialProfit).slice(0, 10);
  }

  private calculateRiskScore(flow1: CrossChainFlow, flow2: CrossChainFlow): number {
    // Calculate risk score based on various factors
    let riskScore = 0;

    // Bridge reliability (lower for well-known bridges)
    const reliableBridges = ['Wormhole', 'Portal'];
    if (!reliableBridges.includes(flow1.bridgeProtocol) || !reliableBridges.includes(flow2.bridgeProtocol)) {
      riskScore += 0.2;
    }

    // Volume volatility
    const volumeVolatility = Math.abs(flow1.volumeChange) + Math.abs(flow2.volumeChange);
    riskScore += volumeVolatility * 0.5;

    // Transaction count (lower risk with higher activity)
    const minTransactions = Math.min(flow1.transactionCount, flow2.transactionCount);
    if (minTransactions < 100) {
      riskScore += 0.3;
    }

    return Math.min(riskScore, 1); // Cap at 1
  }

  // Public API methods
  async getCrossChainFlows(bridgeProtocol?: string): Promise<AnalyticsResponse<CrossChainFlow[]>> {
    try {
      const data = await this.cache.getCrossChainFlows(bridgeProtocol);
      return {
        success: true,
        data,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
    }
  }

  async getBridgeRankings(): Promise<AnalyticsResponse<{ bridge: string; totalVolume: number; marketShare: number }[]>> {
    try {
      const flowData = await this.cache.getCrossChainFlows();
      
      // Calculate rankings
      const bridgeVolumes = new Map<string, number>();
      flowData.forEach(data => {
        const current = bridgeVolumes.get(data.bridgeProtocol) || 0;
        bridgeVolumes.set(data.bridgeProtocol, current + data.volume24h);
      });

      const totalVolume = Array.from(bridgeVolumes.values()).reduce((sum, vol) => sum + vol, 0);
      
      const rankings = Array.from(bridgeVolumes.entries())
        .map(([bridge, volume]) => ({
          bridge,
          totalVolume: volume,
          marketShare: volume / totalVolume
        }))
        .sort((a, b) => b.totalVolume - a.totalVolume);

      return {
        success: true,
        data: rankings,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
    }
  }

  async getTopAssets(): Promise<AnalyticsResponse<{ asset: string; totalVolume: number; bridgeCount: number }[]>> {
    try {
      const flowData = await this.cache.getCrossChainFlows();
      
      const assetStats = new Map<string, { volume: number; bridges: Set<string> }>();
      flowData.forEach(flow => {
        if (!assetStats.has(flow.asset)) {
          assetStats.set(flow.asset, { volume: 0, bridges: new Set() });
        }
        const stats = assetStats.get(flow.asset)!;
        stats.volume += flow.volume24h;
        stats.bridges.add(flow.bridgeProtocol);
      });

      const topAssets = Array.from(assetStats.entries())
        .map(([asset, stats]) => ({
          asset,
          totalVolume: stats.volume,
          bridgeCount: stats.bridges.size
        }))
        .sort((a, b) => b.totalVolume - a.totalVolume)
        .slice(0, 10);

      return {
        success: true,
        data: topAssets,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
    }
  }

  // Health check
  async getHealthStatus(): Promise<{
    isHealthy: boolean;
    lastUpdate: number;
    connectedBridges: number;
    dataPoints: number;
  }> {
    try {
      const flowData = await this.cache.getCrossChainFlows(undefined, 10);
      
      const lastUpdate = Math.max(...flowData.map(d => d.timestamp));
      const connectedBridges = new Set(flowData.map(d => d.bridgeProtocol)).size;

      return {
        isHealthy: Date.now() - lastUpdate < 10 * 60 * 1000, // 10 minutes
        lastUpdate,
        connectedBridges,
        dataPoints: flowData.length
      };
    } catch (error) {
      return {
        isHealthy: false,
        lastUpdate: 0,
        connectedBridges: 0,
        dataPoints: 0
      };
    }
  }
}

// Singleton instance
let crossChainAnalyticsInstance: CrossChainAnalytics | null = null;

export function getCrossChainAnalytics(config?: AnalyticsConfig): CrossChainAnalytics {
  if (!crossChainAnalyticsInstance) {
    const defaultConfig: AnalyticsConfig = {
      refreshIntervals: {
        dexData: 60000,
        crossChainData: 120000, // 2 minutes
        rpcData: 10000,
        validatorData: 120000
      },
      apiKeys: {},
      rpcEndpoints: {
        solana: ['https://api.mainnet-beta.solana.com'],
        ethereum: ['https://eth-mainnet.g.alchemy.com/v2/demo']
      }
    };
    
    crossChainAnalyticsInstance = new CrossChainAnalytics(config || defaultConfig);
  }
  
  return crossChainAnalyticsInstance;
}

export default CrossChainAnalytics;