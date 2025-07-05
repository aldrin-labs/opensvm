import { Connection, VoteAccountStatus } from '@solana/web3.js';
import { BaseAnalytics } from './base-analytics';
import {
  ValidatorMetrics,
  ValidatorPerformance,
  NetworkDecentralization,
  AnalyticsCallback,
  AnalyticsResponse,
  AnalyticsConfig
} from '@/lib/types/solana-analytics';

export class FixedValidatorAnalytics extends BaseAnalytics {
  private connection: Connection;
  private validators: Map<string, ValidatorMetrics> = new Map();
  private initializationTimeout = 30000; // 30 second timeout
  private rpcTimeout = 15000; // 15 second timeout for RPC calls

  constructor(config: AnalyticsConfig) {
    super(config);
    // Use a more reliable RPC endpoint with timeout
    const rpcEndpoints = config.rpcEndpoints?.solana || ['https://api.mainnet-beta.solana.com'];
    const rpcEndpoint = rpcEndpoints[0] || 'https://api.mainnet-beta.solana.com';
    this.connection = new Connection(rpcEndpoint, {
      commitment: 'confirmed',
      httpAgent: false,
      fetch: (url, options) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.rpcTimeout);
        
        return fetch(url, {
          ...options,
          signal: controller.signal
        }).finally(() => clearTimeout(timeoutId));
      }
    });
  }

  protected getAnalyticsName(): string {
    return 'Fixed Validator Analytics';
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
      console.warn('Failed to initialize with real data, using fallback:', error);
      await this.initializeWithMockData();
    }
  }

  private async initializeWithFallback(): Promise<void> {
    try {
      await this.fetchValidatorData();
    } catch (error) {
      console.warn('Real validator data fetch failed, using mock data:', error);
      throw error;
    }
  }

  private async initializeWithMockData(): Promise<void> {
    // Provide realistic mock data as fallback
    const mockValidators: ValidatorMetrics[] = [
      {
        voteAccount: '7K8DVxtNJGnMtUY1CQJT5jcs8sFGSZTDiG7kowvFpECh',
        nodePubkey: '7K8DVxtNJGnMtUY1CQJT5jcs8sFGSZTDiG7kowvFpECh',
        name: 'Coinbase Cloud',
        commission: 5,
        activatedStake: 12500000000000000, // 12.5M SOL
        lastVote: 276543210,
        rootSlot: 276543200,
        credits: 450000,
        epochCredits: 450000,
        version: '1.18.22',
        status: 'active' as const,
        datacenter: 'Google Cloud (us-central1)',
        country: 'United States',
        apy: 6.8,
        performanceScore: 0.98,
        uptimePercent: 99.95,
        skipRate: 0.002,
        voteDistance: 1.2
      },
      {
        voteAccount: '9QU2QSxhb24FUX3Tu2FpczXjpK3VYrvRudywSZaM29mF',
        nodePubkey: '9QU2QSxhb24FUX3Tu2FpczXjpK3VYrvRudywSZaM29mF',
        name: 'Lido',
        commission: 7,
        activatedStake: 11200000000000000,
        lastVote: 276543211,
        rootSlot: 276543201,
        credits: 448500,
        epochCredits: 448500,
        version: '1.18.22',
        status: 'active' as const,
        datacenter: 'AWS (eu-west-1)',
        country: 'Ireland',
        apy: 6.5,
        performanceScore: 0.96,
        uptimePercent: 99.88,
        skipRate: 0.004,
        voteDistance: 1.5
      },
      {
        voteAccount: 'J1to3PQfXidUUhprQWgdKkQAMWPJAEqSJ7amkBDE9qhF',
        nodePubkey: 'J1to3PQfXidUUhprQWgdKkQAMWPJAEqSJ7amkBDE9qhF',
        name: 'Jito',
        commission: 4,
        activatedStake: 10800000000000000,
        lastVote: 276543212,
        rootSlot: 276543202,
        credits: 451200,
        epochCredits: 451200,
        version: '1.18.23',
        status: 'active' as const,
        datacenter: 'Hetzner (fsn1)',
        country: 'Germany',
        apy: 7.1,
        performanceScore: 0.99,
        uptimePercent: 99.98,
        skipRate: 0.001,
        voteDistance: 0.8
      },
      // Add more mock validators...
      ...Array.from({ length: 17 }, (_, i) => ({
        voteAccount: `validator_${i + 4}_pubkey_mock_${Date.now()}`,
        nodePubkey: `node_${i + 4}_pubkey_mock_${Date.now()}`,
        name: `Validator ${i + 4}`,
        commission: Math.floor(Math.random() * 10) + 1,
        activatedStake: Math.floor(Math.random() * 5000000000000000) + 1000000000000000,
        lastVote: 276543210 + Math.floor(Math.random() * 10),
        rootSlot: 276543200 + Math.floor(Math.random() * 10),
        credits: Math.floor(Math.random() * 50000) + 400000,
        epochCredits: Math.floor(Math.random() * 50000) + 400000,
        version: Math.random() > 0.7 ? '1.18.23' : '1.18.22',
        status: Math.random() > 0.1 ? 'active' as const : 'delinquent' as const,
        datacenter: ['AWS (us-east-1)', 'Google Cloud (us-west2)', 'Azure (eastus)', 'Hetzner (nbg1)', 'DigitalOcean (nyc3)'][Math.floor(Math.random() * 5)],
        country: ['United States', 'Germany', 'Singapore', 'Netherlands', 'Japan'][Math.floor(Math.random() * 5)],
        apy: Math.random() * 3 + 5, // 5-8% APY
        performanceScore: Math.random() * 0.2 + 0.85, // 85-100%
        uptimePercent: Math.random() * 5 + 95, // 95-100%
        skipRate: Math.random() * 0.01,
        voteDistance: Math.random() * 3 + 0.5
      }))
    ];

    // Update cache with mock data
    this.validators.clear();
    mockValidators.forEach(validator => {
      this.validators.set(validator.voteAccount, validator);
    });

    this.emit('validators', mockValidators);
    console.log(`${this.getAnalyticsName()} initialized with mock data (${mockValidators.length} validators)`);
  }

  protected async onStartMonitoring(): Promise<void> {
    // Validator data updates (every 2 minutes) with error handling
    this.createInterval(async () => {
      try {
        await this.fetchAndUpdateValidatorData();
      } catch (error) {
        console.warn('Failed to update validator data, keeping existing data:', error);
      }
    }, 2 * 60 * 1000);

    // Performance metrics updates (every 30 seconds)
    this.createInterval(async () => {
      try {
        await this.updatePerformanceMetrics();
      } catch (error) {
        console.warn('Failed to update performance metrics:', error);
      }
    }, 30 * 1000);

    // Decentralization analysis (every 5 minutes)
    this.createInterval(async () => {
      try {
        await this.analyzeNetworkDecentralization();
      } catch (error) {
        console.warn('Failed to analyze decentralization:', error);
      }
    }, 5 * 60 * 1000);
  }

  // Event-driven callback system
  onValidatorUpdate(callback: AnalyticsCallback<ValidatorMetrics[]>): void {
    this.registerCallback('validators', callback);
  }

  onPerformanceUpdate(callback: AnalyticsCallback<ValidatorPerformance>): void {
    this.registerCallback('performance', callback);
  }

  onDecentralizationUpdate(callback: AnalyticsCallback<NetworkDecentralization>): void {
    this.registerCallback('decentralization', callback);
  }

  // API Methods
  async getValidators(): Promise<AnalyticsResponse<ValidatorMetrics[]>> {
    try {
      const validators = Array.from(this.validators.values());
      return {
        success: true,
        data: validators,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get validators',
        timestamp: Date.now()
      };
    }
  }

  async getNetworkStats(): Promise<AnalyticsResponse<any>> {
    try {
      const validators = Array.from(this.validators.values());
      const activeValidators = validators.filter(v => v.status === 'active');
      const delinquentValidators = validators.filter(v => v.status === 'delinquent');
      const totalStake = validators.reduce((sum, v) => sum + v.activatedStake, 0);
      const avgCommission = validators.reduce((sum, v) => sum + v.commission, 0) / validators.length;
      const avgUptime = validators.reduce((sum, v) => sum + v.uptimePercent, 0) / validators.length;

      // Simple Nakamoto coefficient calculation (top validators controlling >33% stake)
      const sortedByStake = validators.sort((a, b) => b.activatedStake - a.activatedStake);
      let cumulativeStake = 0;
      let nakamotoCoefficient = 0;
      const thresholdStake = totalStake * 0.33;
      
      for (const validator of sortedByStake) {
        cumulativeStake += validator.activatedStake;
        nakamotoCoefficient++;
        if (cumulativeStake >= thresholdStake) break;
      }

      const networkHealth = avgUptime > 99 ? 'excellent' : avgUptime > 97 ? 'good' : avgUptime > 95 ? 'fair' : 'poor';

      return {
        success: true,
        data: {
          totalValidators: validators.length,
          activeValidators: activeValidators.length,
          delinquentValidators: delinquentValidators.length,
          totalStake,
          averageCommission: avgCommission,
          nakamotoCoefficient,
          averageUptime: avgUptime,
          networkHealth
        },
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get network stats',
        timestamp: Date.now()
      };
    }
  }

  async getDecentralizationMetrics(): Promise<AnalyticsResponse<any>> {
    try {
      const validators = Array.from(this.validators.values());
      
      // Geographic distribution
      const countryMap = new Map<string, { count: number, stake: number }>();
      const datacenterMap = new Map<string, { count: number, stake: number }>();
      const versionMap = new Map<string, number>();
      
      const totalStake = validators.reduce((sum, v) => sum + v.activatedStake, 0);
      
      validators.forEach(validator => {
        // Country distribution
        if (validator.country) {
          const current = countryMap.get(validator.country) || { count: 0, stake: 0 };
          countryMap.set(validator.country, {
            count: current.count + 1,
            stake: current.stake + validator.activatedStake
          });
        }
        
        // Datacenter distribution
        if (validator.datacenter) {
          const current = datacenterMap.get(validator.datacenter) || { count: 0, stake: 0 };
          datacenterMap.set(validator.datacenter, {
            count: current.count + 1,
            stake: current.stake + validator.activatedStake
          });
        }
        
        // Client version distribution
        const current = versionMap.get(validator.version) || 0;
        versionMap.set(validator.version, current + 1);
      });

      const geograficDistribution = Array.from(countryMap.entries()).map(([country, data]) => ({
        country,
        validatorCount: data.count,
        stakePercent: (data.stake / totalStake) * 100
      }));

      const datacenterDistribution = Array.from(datacenterMap.entries()).map(([datacenter, data]) => ({
        datacenter,
        validatorCount: data.count,
        stakePercent: (data.stake / totalStake) * 100
      }));

      const clientDistribution = Array.from(versionMap.entries()).map(([version, count]) => ({
        version,
        validatorCount: count,
        percent: (count / validators.length) * 100
      }));

      return {
        success: true,
        data: {
          geograficDistribution,
          datacenterDistribution,
          clientDistribution
        },
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get decentralization metrics',
        timestamp: Date.now()
      };
    }
  }

  getHealthStatus() {
    const validators = Array.from(this.validators.values());
    const activeCount = validators.filter(v => v.status === 'active').length;
    const issues = [];
    
    if (activeCount < 1000) {
      issues.push('Low validator count detected');
    }
    
    const avgPerformance = validators.reduce((sum, v) => sum + v.performanceScore, 0) / validators.length;
    if (avgPerformance < 0.9) {
      issues.push('Below average network performance');
    }

    return {
      isHealthy: issues.length === 0,
      lastUpdate: Date.now(),
      monitoredValidators: validators.length,
      issues
    };
  }

  // Private implementation methods with error handling
  private async fetchValidatorData(): Promise<void> {
    try {
      console.log('Fetching validator data from Solana RPC...');
      
      // Use Promise.race to add timeout
      const fetchPromise = this.performRPCFetch();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('RPC fetch timeout')), this.rpcTimeout);
      });

      await Promise.race([fetchPromise, timeoutPromise]);
      
    } catch (error) {
      console.error('Error fetching validator data:', error);
      throw error;
    }
  }

  private async performRPCFetch(): Promise<void> {
    // Get vote accounts (current validators)
    const voteAccounts = await this.connection.getVoteAccounts();
    
    // Get epoch info for performance calculations
    const epochInfo = await this.connection.getEpochInfo();
    
    // Get cluster nodes for network topology data
    const clusterNodes = await this.connection.getClusterNodes();
    
    // Process validator data
    const validatorMetrics = await this.processValidatorData(
      voteAccounts,
      epochInfo,
      clusterNodes
    );
    
    // Update cache
    this.validators.clear();
    validatorMetrics.forEach(validator => {
      this.validators.set(validator.voteAccount, validator);
    });
    
    this.emit('validators', validatorMetrics);
  }

  private async fetchAndUpdateValidatorData(): Promise<void> {
    await this.fetchValidatorData();
  }

  private async processValidatorData(
    voteAccounts: VoteAccountStatus,
    epochInfo: any,
    clusterNodes: any[]
  ): Promise<ValidatorMetrics[]> {
    const allValidators = [...voteAccounts.current, ...voteAccounts.delinquent];
    const validatorMetrics: ValidatorMetrics[] = [];

    for (const validator of allValidators.slice(0, 50)) { // Limit to first 50 to avoid timeout
      try {
        // Get validator identity from cluster nodes
        const nodeInfo = clusterNodes.find(node => 
          node.pubkey === validator.nodePubkey
        );

        // Calculate performance metrics
        const performance = this.calculateValidatorPerformance(validator, epochInfo);
        
        // Get geographic/datacenter info (limited in base RPC)
        const geoInfo = await this.getValidatorGeoInfo(validator.nodePubkey, nodeInfo);
        
        const metrics: ValidatorMetrics = {
          voteAccount: validator.votePubkey,
          nodePubkey: validator.nodePubkey,
          name: await this.getValidatorName(validator.votePubkey),
          commission: validator.commission,
          activatedStake: validator.activatedStake,
          lastVote: validator.lastVote,
          rootSlot: validator.rootSlot,
          credits: validator.epochCredits,
          epochCredits: validator.epochCredits,
          version: nodeInfo?.version || 'unknown',
          status: voteAccounts.current.includes(validator) ? 'active' : 'delinquent',
          datacenter: geoInfo.datacenter,
          country: geoInfo.country,
          apy: this.calculateValidatorAPY(validator),
          performanceScore: performance.score,
          uptimePercent: performance.uptime,
          skipRate: performance.skipRate,
          voteDistance: performance.voteDistance
        };

        validatorMetrics.push(metrics);
      } catch (error) {
        console.warn(`Error processing validator ${validator.votePubkey}:`, error);
      }
    }

    return validatorMetrics;
  }

  private calculateValidatorPerformance(validator: any, epochInfo: any) {
    // Mock performance calculation - in real implementation would use historical data
    const score = Math.random() * 0.15 + 0.85; // 85-100%
    const uptime = Math.random() * 5 + 95; // 95-100%
    const skipRate = Math.random() * 0.02; // 0-2%
    const voteDistance = Math.random() * 3 + 0.5; // 0.5-3.5
    
    return { score, uptime, skipRate, voteDistance };
  }

  private async getValidatorGeoInfo(nodePubkey: string, nodeInfo: any) {
    // Mock geo info - in real implementation would use geo IP services
    const datacenters = ['AWS (us-east-1)', 'Google Cloud (us-west2)', 'Azure (eastus)', 'Hetzner (nbg1)', 'DigitalOcean (nyc3)'];
    const countries = ['United States', 'Germany', 'Singapore', 'Netherlands', 'Japan'];
    
    return {
      datacenter: datacenters[Math.floor(Math.random() * datacenters.length)],
      country: countries[Math.floor(Math.random() * countries.length)]
    };
  }

  private async getValidatorName(votePubkey: string): Promise<string> {
    // Mock validator names - in real implementation would use validator registry
    const names = ['Coinbase Cloud', 'Lido', 'Jito', 'Marinade', 'Everstake', 'Staked', 'P2P', 'Chorus One'];
    return names[Math.floor(Math.random() * names.length)] || `Validator ${votePubkey.slice(0, 8)}`;
  }

  private calculateValidatorAPY(validator: any): number {
    // Mock APY calculation - in real implementation would use actual staking rewards
    return Math.random() * 3 + 5; // 5-8% APY
  }

  private async updatePerformanceMetrics(): Promise<void> {
    // Mock performance update
    const validators = Array.from(this.validators.values());
    if (validators.length > 0) {
      // Emit performance update for first validator as example
      this.emit('performance', {
        averagePerformance: validators.reduce((sum, v) => sum + v.performanceScore, 0) / validators.length,
        networkUptime: validators.reduce((sum, v) => sum + v.uptimePercent, 0) / validators.length,
        avgSkipRate: validators.reduce((sum, v) => sum + v.skipRate, 0) / validators.length,
        timestamp: Date.now()
      });
    }
  }

  private async analyzeNetworkDecentralization(): Promise<void> {
    // Mock decentralization analysis
    const decentralizationData = await this.getDecentralizationMetrics();
    if (decentralizationData.success) {
      this.emit('decentralization', decentralizationData.data);
    }
  }
}

// Singleton pattern for validator analytics
let validatorAnalyticsInstance: FixedValidatorAnalytics | null = null;

export function getFixedValidatorAnalytics(config?: AnalyticsConfig): FixedValidatorAnalytics {
  if (!validatorAnalyticsInstance) {
    const defaultConfig: AnalyticsConfig = {
      rpcEndpoints: {
        solana: [
          'https://api.mainnet-beta.solana.com',
          'https://solana-api.projectserum.com',
          'https://rpc.ankr.com/solana'
        ],
        ethereum: [
          'https://cloudflare-eth.com'
        ]
      },
      refreshIntervals: {
        dexData: 30 * 1000,    // 30 seconds
        crossChainData: 2 * 60 * 1000,  // 2 minutes
        rpcData: 5 * 60 * 1000,     // 5 minutes
        validatorData: 2 * 60 * 1000 // 2 minutes
      },
      apiKeys: {}
    };
    
    validatorAnalyticsInstance = new FixedValidatorAnalytics(config || defaultConfig);
  }
  return validatorAnalyticsInstance;
}