import { BaseAnalytics } from './base-analytics';
import {
  ProtocolHealth,
  ExploitAlert,
  TreasuryMetrics,
  GovernanceMetrics,
  TokenomicsHealth,
  AnalyticsCallback,
  AnalyticsResponse,
  AnalyticsConfig
} from '@/lib/types/solana-analytics';

export class FastDeFiHealthMonitor extends BaseAnalytics {
  private initializationTimeout = 15000; // 15 second timeout
  private maxProtocolsToProcess = 20; // Limit processing to avoid timeouts

  // Monitored protocols by category (limited for faster loading)
  private readonly MONITORED_PROTOCOLS = {
    dex: [
      'Raydium', 'Orca', 'Serum', 'Jupiter'
    ],
    lending: [
      'Solend', 'Mango Markets', 'Tulip Protocol'
    ],
    yield: [
      'Quarry', 'Sunny Aggregator', 'Friktion'
    ],
    derivatives: [
      'Drift Protocol', 'Zeta Markets'
    ],
    insurance: [
      'UXD Protocol', 'Hedge Protocol'
    ]
  };

  private protocols: Map<string, ProtocolHealth> = new Map();

  constructor(config: AnalyticsConfig) {
    super(config);
  }

  protected getAnalyticsName(): string {
    return 'Fast DeFi Health Monitor';
  }

  protected async onInitialize(): Promise<void> {
    // Add timeout to initialization
    const initPromise = this.initializeWithFallback();
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Initialization timeout')), this.initializationTimeout);
    });

    try {
      await Promise.race([initPromise, timeoutPromise]);
    } catch (error) {
      console.warn('Failed to initialize with real data, using fast mock data:', error);
      await this.initializeWithFastMockData();
    }
  }

  private async initializeWithFallback(): Promise<void> {
    try {
      await this.fetchProtocolHealthBatch();
    } catch (error) {
      console.warn('Real protocol data fetch failed, using mock data:', error);
      throw error;
    }
  }

  private async initializeWithFastMockData(): Promise<void> {
    const allProtocols = Object.values(this.MONITORED_PROTOCOLS).flat();
    const healthData: ProtocolHealth[] = [];

    // Generate realistic mock data quickly
    for (const [index, protocol] of allProtocols.slice(0, this.maxProtocolsToProcess).entries()) {
      const category = this.getProtocolCategory(protocol);
      const tvlBase = this.getTVLBase(protocol);
      const tvl = tvlBase + (Math.random() - 0.5) * tvlBase * 0.2; // ±20% variation
      
      const mockHealth: ProtocolHealth = {
        protocol,
        category,
        tvl,
        tvlChange24h: (Math.random() - 0.5) * 0.3, // ±30%
        tvlChange7d: (Math.random() - 0.5) * 0.5, // ±50%
        riskScore: Math.random() * 0.3 + 0.1, // 10-40% risk
        healthScore: Math.random() * 0.3 + 0.7, // 70-100% health
        exploitAlerts: Math.random() > 0.9 ? [this.generateMockAlert()] : [],
        treasuryHealth: this.generateMockTreasury(protocol),
        governanceActivity: this.generateMockGovernance(),
        tokenomics: this.generateMockTokenomics(),
        lastUpdate: Date.now()
      };

      healthData.push(mockHealth);
      this.protocols.set(protocol, mockHealth);
    }

    this.emit('health', healthData);
    console.log(`${this.getAnalyticsName()} initialized with fast mock data (${healthData.length} protocols)`);
  }

  protected async onStartMonitoring(): Promise<void> {
    // Faster intervals with error handling
    this.createInterval(async () => {
      try {
        await this.fetchAndUpdateProtocolHealth();
      } catch (error) {
        console.warn('Failed to update protocol health, keeping existing data:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes

    // Less frequent exploit detection to avoid overload
    this.createInterval(async () => {
      try {
        await this.detectAndAlertExploits();
      } catch (error) {
        console.warn('Failed to detect exploits:', error);
      }
    }, 60 * 1000); // 1 minute
  }

  // API Methods with fast responses
  async getProtocolHealth(protocol?: string): Promise<AnalyticsResponse<ProtocolHealth[]>> {
    try {
      let protocols: ProtocolHealth[];
      
      if (protocol) {
        const protocolHealth = this.protocols.get(protocol);
        protocols = protocolHealth ? [protocolHealth] : [];
      } else {
        protocols = Array.from(this.protocols.values());
      }

      return {
        success: true,
        data: protocols,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get protocol health',
        timestamp: Date.now()
      };
    }
  }

  async getExploitAlerts(): Promise<AnalyticsResponse<ExploitAlert[]>> {
    try {
      const alerts: ExploitAlert[] = [];
      
      // Collect alerts from all protocols
      for (const protocol of this.protocols.values()) {
        alerts.push(...protocol.exploitAlerts);
      }

      // Sort by severity and timestamp
      alerts.sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const aSeverity = severityOrder[a.severity] || 0;
        const bSeverity = severityOrder[b.severity] || 0;
        
        if (aSeverity !== bSeverity) {
          return bSeverity - aSeverity; // Higher severity first
        }
        return b.timestamp - a.timestamp; // Most recent first
      });

      return {
        success: true,
        data: alerts.slice(0, 10), // Limit to 10 most important alerts
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get exploit alerts',
        timestamp: Date.now()
      };
    }
  }

  async getProtocolRankings(): Promise<AnalyticsResponse<any[]>> {
    try {
      const protocols = Array.from(this.protocols.values());
      
      // Sort by TVL descending
      const rankings = protocols
        .sort((a, b) => b.tvl - a.tvl)
        .map(protocol => ({
          protocol: protocol.protocol,
          tvl: protocol.tvl,
          healthScore: protocol.healthScore,
          riskScore: protocol.riskScore
        }));

      return {
        success: true,
        data: rankings,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get protocol rankings',
        timestamp: Date.now()
      };
    }
  }

  async getEcosystemHealth(): Promise<AnalyticsResponse<any>> {
    try {
      const protocols = Array.from(this.protocols.values());
      
      if (protocols.length === 0) {
        return {
          success: true,
          data: {
            totalTvl: 0,
            avgHealthScore: 0,
            avgRiskScore: 0,
            criticalAlerts: 0,
            protocolCount: 0
          },
          timestamp: Date.now()
        };
      }

      const totalTvl = protocols.reduce((sum, p) => sum + p.tvl, 0);
      const avgHealthScore = protocols.reduce((sum, p) => sum + p.healthScore, 0) / protocols.length;
      const avgRiskScore = protocols.reduce((sum, p) => sum + p.riskScore, 0) / protocols.length;
      
      let criticalAlerts = 0;
      for (const protocol of protocols) {
        criticalAlerts += protocol.exploitAlerts.filter(alert => alert.severity === 'critical').length;
      }

      return {
        success: true,
        data: {
          totalTvl,
          avgHealthScore,
          avgRiskScore,
          criticalAlerts,
          protocolCount: protocols.length
        },
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get ecosystem health',
        timestamp: Date.now()
      };
    }
  }

  getHealthStatus() {
    const protocols = Array.from(this.protocols.values());
    const avgHealth = protocols.length > 0 
      ? protocols.reduce((sum, p) => sum + p.healthScore, 0) / protocols.length 
      : 0;
    
    let criticalAlerts = 0;
    for (const protocol of protocols) {
      criticalAlerts += protocol.exploitAlerts.filter(alert => alert.severity === 'critical').length;
    }

    return {
      isHealthy: avgHealth > 0.7 && criticalAlerts === 0,
      lastUpdate: Date.now(),
      monitoredProtocols: protocols.length,
      activeAlerts: criticalAlerts
    };
  }

  // Event-driven callback system
  onHealthUpdate(callback: AnalyticsCallback<ProtocolHealth[]>): void {
    this.registerCallback('health', callback);
  }

  onExploitAlert(callback: AnalyticsCallback<ExploitAlert[]>): void {
    this.registerCallback('exploits', callback);
  }

  // Private helper methods
  private getProtocolCategory(protocol: string): 'dex' | 'lending' | 'yield' | 'derivatives' | 'insurance' {
    for (const [category, protocols] of Object.entries(this.MONITORED_PROTOCOLS)) {
      if (protocols.includes(protocol)) {
        return category as any;
      }
    }
    return 'dex'; // Default
  }

  private getTVLBase(protocol: string): number {
    // Base TVL amounts for realistic mock data
    const tvlMap: Record<string, number> = {
      'Raydium': 2_500_000_000,
      'Orca': 800_000_000,
      'Serum': 300_000_000,
      'Jupiter': 150_000_000,
      'Solend': 400_000_000,
      'Mango Markets': 200_000_000,
      'Tulip Protocol': 50_000_000,
      'Quarry': 100_000_000,
      'Sunny Aggregator': 80_000_000,
      'Friktion': 60_000_000,
      'Drift Protocol': 120_000_000,
      'Zeta Markets': 40_000_000,
      'UXD Protocol': 30_000_000,
      'Hedge Protocol': 20_000_000
    };
    
    return tvlMap[protocol] || 10_000_000; // Default 10M
  }

  private generateMockAlert(): ExploitAlert {
    const severities: ('critical' | 'high' | 'medium' | 'low')[] = ['critical', 'high', 'medium', 'low'];
    const types = ['Flash loan attack', 'Oracle manipulation', 'Governance attack', 'Smart contract bug', 'Bridge exploit'];
    
    return {
      severity: severities[Math.floor(Math.random() * severities.length)],
      type: types[Math.floor(Math.random() * types.length)],
      description: 'Automated detection of unusual activity patterns',
      affectedAmount: Math.random() * 10_000_000,
      timestamp: Date.now() - Math.random() * 86400000, // Within last 24h
      protocolsAffected: [Object.values(this.MONITORED_PROTOCOLS).flat()[0]], // Random protocol
      riskLevel: Math.random() * 0.8 + 0.2 // 20-100%
    };
  }

  private generateMockTreasury(protocol: string): TreasuryMetrics {
    const baseValue = this.getTVLBase(protocol) * 0.01; // 1% of TVL as treasury
    
    return {
      treasuryValue: baseValue * (0.5 + Math.random()),
      runwayMonths: Math.random() * 30 + 6, // 6-36 months
      diversificationScore: Math.random() * 0.4 + 0.4, // 40-80%
      burnRate: baseValue * 0.1 * Math.random(), // Random burn rate
      sustainabilityRisk: Math.random() > 0.7 ? 'high' : Math.random() > 0.4 ? 'medium' : 'low'
    };
  }

  private generateMockGovernance(): GovernanceMetrics {
    return {
      activeProposals: Math.floor(Math.random() * 5),
      voterParticipation: Math.random() * 0.4 + 0.1, // 10-50%
      tokenDistribution: Math.random() * 0.6 + 0.3, // 30-90%
      governanceHealth: Math.random() * 0.4 + 0.5, // 50-90%
      recentDecisions: []
    };
  }

  private generateMockTokenomics(): TokenomicsHealth {
    const totalSupply = Math.random() * 1_000_000_000 + 100_000_000;
    const circulatingSupply = totalSupply * (0.4 + Math.random() * 0.4); // 40-80% circulating
    
    return {
      tokenSupply: totalSupply,
      circulatingSupply,
      inflationRate: Math.random() * 0.1, // 0-10%
      emissionSchedule: [],
      vestingSchedule: [],
      tokenUtility: ['governance', 'staking', 'fees']
    };
  }

  // Fast batch operations
  private async fetchProtocolHealthBatch(): Promise<void> {
    const allProtocols = Object.values(this.MONITORED_PROTOCOLS).flat();
    const promises = allProtocols.slice(0, this.maxProtocolsToProcess).map(protocol => 
      this.fetchProtocolHealthWithTimeout(protocol)
    );
    
    const results = await Promise.allSettled(promises);
    const healthData: ProtocolHealth[] = [];
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        healthData.push(result.value);
        this.protocols.set(result.value.protocol, result.value);
      } else {
        console.warn(`Failed to fetch health data for ${allProtocols[index]}:`, 
          result.status === 'rejected' ? result.reason : 'Unknown error');
      }
    });

    if (healthData.length > 0) {
      this.emit('health', healthData);
    }
  }

  private async fetchProtocolHealthWithTimeout(protocol: string): Promise<ProtocolHealth | null> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Fetch timeout')), 5000); // 5 second timeout per protocol
    });

    const fetchPromise = this.fetchProtocolHealth(protocol);

    try {
      return await Promise.race([fetchPromise, timeoutPromise]);
    } catch (error) {
      console.warn(`Timeout or error fetching ${protocol}:`, error);
      return null;
    }
  }

  private async fetchProtocolHealth(protocol: string): Promise<ProtocolHealth | null> {
    // This would normally fetch real data from APIs
    // For now, return mock data with realistic delays
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500)); // 0.5-2.5s delay
    
    const category = this.getProtocolCategory(protocol);
    const tvlBase = this.getTVLBase(protocol);
    const tvl = tvlBase + (Math.random() - 0.5) * tvlBase * 0.2;
    
    return {
      protocol,
      category,
      tvl,
      tvlChange24h: (Math.random() - 0.5) * 0.3,
      tvlChange7d: (Math.random() - 0.5) * 0.5,
      riskScore: Math.random() * 0.3 + 0.1,
      healthScore: Math.random() * 0.3 + 0.7,
      exploitAlerts: Math.random() > 0.95 ? [this.generateMockAlert()] : [],
      treasuryHealth: this.generateMockTreasury(protocol),
      governanceActivity: this.generateMockGovernance(),
      tokenomics: this.generateMockTokenomics(),
      lastUpdate: Date.now()
    };
  }

  private async fetchAndUpdateProtocolHealth(): Promise<void> {
    await this.fetchProtocolHealthBatch();
  }

  private async detectAndAlertExploits(): Promise<void> {
    // Mock exploit detection - in real implementation would analyze on-chain data
    const alerts: ExploitAlert[] = [];
    
    // Random chance of new alert
    if (Math.random() > 0.95) { // 5% chance
      alerts.push(this.generateMockAlert());
    }

    if (alerts.length > 0) {
      this.emit('exploits', alerts);
    }
  }
}

// Singleton pattern
let fastDeFiHealthMonitorInstance: FastDeFiHealthMonitor | null = null;

export function getFastDeFiHealthMonitor(config?: AnalyticsConfig): FastDeFiHealthMonitor {
  if (!fastDeFiHealthMonitorInstance) {
    const defaultConfig: AnalyticsConfig = {
      rpcEndpoints: {
        solana: [
          'https://api.mainnet-beta.solana.com',
          'https://solana-api.projectserum.com'
        ],
        ethereum: [
          'https://cloudflare-eth.com'
        ]
      },
      refreshIntervals: {
        dexData: 30 * 1000,
        crossChainData: 2 * 60 * 1000,
        rpcData: 5 * 60 * 1000,
        validatorData: 2 * 60 * 1000
      },
      apiKeys: {}
    };
    
    fastDeFiHealthMonitorInstance = new FastDeFiHealthMonitor(config || defaultConfig);
  }
  return fastDeFiHealthMonitorInstance;
}