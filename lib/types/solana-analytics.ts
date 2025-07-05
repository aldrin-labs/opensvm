// Solana Ecosystem Analytics Type Definitions

export interface SolanaLiquidityData {
  dex: string;
  poolAddress: string;
  tokenA: string;
  tokenB: string;
  liquidityUSD: number;
  volume24h: number;
  fees24h: number;
  tvl: number;
  timestamp: number;
}

export interface DEXVolumeMetrics {
  dex: string;
  volume24h: number;
  volumeChange: number;
  activeUsers: number;
  transactions: number;
  avgTransactionSize: number;
  timestamp: number;
}

export interface CrossDEXArbitrage {
  tokenPair: string;
  sourceDEX: string;
  targetDEX: string;
  priceDifference: number;
  profitOpportunity: number;
  liquidityDepth: number;
  timestamp: number;
}

// Cross-Chain Analytics Types
export interface CrossChainFlow {
  bridgeProtocol: string;
  sourceChain: string;
  targetChain: string;
  asset: string;
  volume24h: number;
  volumeChange: number;
  avgTransactionSize: number;
  transactionCount: number;
  bridgeFees: number;
  timestamp: number;
}

export interface EcosystemMigration {
  protocol: string;
  fromChain: string;
  toChain: string;
  tvlMigrated: number;
  usersMigrated: number;
  migrationRate: number;
  timeframe: string;
  catalysts: string[];
}

export interface CrossChainArbitrage {
  asset: string;
  sourceChain: string;
  targetChain: string;
  priceDifference: number;
  potentialProfit: number;
  bridgeTime: number;
  bridgeCost: number;
  riskScore: number;
}

// DeFi Health Monitoring Types
export interface ProtocolHealth {
  protocol: string;
  category: 'dex' | 'lending' | 'yield' | 'derivatives' | 'insurance';
  tvl: number;
  tvlChange24h: number;
  tvlChange7d: number;
  riskScore: number;
  healthScore: number;
  exploitAlerts: ExploitAlert[];
  treasuryHealth: TreasuryMetrics;
  governanceActivity: GovernanceMetrics;
  tokenomics: TokenomicsHealth;
}

export interface ExploitAlert {
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: 'flash_loan' | 'oracle_manipulation' | 'governance_attack' | 'bridge_exploit' | 'reentrancy';
  description: string;
  affectedAmount: number;
  protocolsAffected: string[];
  mitigationStatus: 'active' | 'patched' | 'investigating';
  timestamp: number;
}

export interface TreasuryMetrics {
  treasuryValue: number;
  runwayMonths: number;
  diversificationScore: number;
  burnRate: number;
  sustainabilityRisk: 'low' | 'medium' | 'high' | 'critical';
}

export interface GovernanceMetrics {
  activeProposals: number;
  voterParticipation: number;
  tokenDistribution: number;
  governanceHealth: number;
  recentDecisions: GovernanceDecision[];
}

export interface GovernanceDecision {
  proposalId: string;
  title: string;
  description: string;
  status: 'active' | 'passed' | 'rejected' | 'executed';
  votesFor: number;
  votesAgainst: number;
  timestamp: number;
}

export interface TokenomicsHealth {
  tokenSupply: number;
  circulatingSupply: number;
  inflationRate: number;
  emissionSchedule: EmissionPeriod[];
  vestingSchedule: VestingEvent[];
  tokenUtility: string[];
}

export interface EmissionPeriod {
  startDate: number;
  endDate: number;
  tokensEmitted: number;
  emissionRate: number;
}

export interface VestingEvent {
  beneficiary: string;
  tokensVesting: number;
  vestingDate: number;
  type: 'team' | 'investors' | 'community' | 'foundation';
}

// Validator Analytics Types
export interface ValidatorMetrics {
  validatorAddress: string;
  name?: string;
  totalStake: number;
  ownStake: number;
  delegatedStake: number;
  commission: number;
  performance: ValidatorPerformance;
  votingBehavior: VotingMetrics;
  decentralizationScore: number;
  rewardsGenerated: number;
  uptimeScore: number;
}

export interface ValidatorPerformance {
  blocksProduced: number;
  expectedBlocks: number;
  missedBlocks: number;
  productionRate: number;
  voteAccuracy: number;
  skipRate: number;
  slashingEvents: number;
  performanceScore: number;
}

export interface VotingMetrics {
  voteSuccessRate: number;
  averageVoteLatency: number;
  consensusParticipation: number;
  governanceParticipation: number;
}

export interface NetworkDecentralization {
  nakamotoCoefficient: number;
  topValidatorsStakeShare: number;
  herfindahlIndex: number;
  geographicDistribution: GeographicMetrics;
  clientDiversity: ClientDiversityMetrics;
  stakingRatio: number;
  validatorCount: number;
}

export interface GeographicMetrics {
  continents: Record<string, number>;
  countries: Record<string, number>;
  regions: Record<string, number>;
  diversityScore: number;
}

export interface ClientDiversityMetrics {
  clients: Record<string, number>;
  diversityScore: number;
  majorityConcern: boolean;
}

export interface StakeDistribution {
  totalStaked: number;
  averageStakePerValidator: number;
  medianStake: number;
  stakeConcentration: number;
  newValidators24h: number;
  exitedValidators24h: number;
}

// Validator Analytics Types
export interface ValidatorMetrics {
  voteAccount: string;
  nodePubkey: string;
  name: string;
  commission: number;
  activatedStake: number;
  lastVote: number;
  rootSlot: number;
  credits: number;
  epochCredits: number;
  version: string;
  status: 'active' | 'delinquent' | 'inactive';
  datacenter?: string;
  country?: string;
  apy: number;
  performanceScore: number;
  uptimePercent: number;
  skipRate?: number;
  voteDistance?: number;
}

export interface ValidatorPerformance {
  totalValidators: number;
  activeValidators: number;
  delinquentValidators: number;
  totalStake: number;
  averageCommission: number;
  nakamotoCoefficient: number;
  averageUptime: number;
  networkHealth: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface NetworkDecentralization {
  geograficDistribution: Array<{
    country: string;
    validatorCount: number;
    stakePercent: number;
  }>;
  datacenterDistribution: Array<{
    datacenter: string;
    validatorCount: number;
    stakePercent: number;
  }>;
  clientDistribution: Array<{
    version: string;
    validatorCount: number;
    percent: number;
  }>;
  herfindahlIndex: number;
  nakamotoCoefficient: number;
}

// Callback types for real-time updates
export type AnalyticsCallback<T> = (data: T) => void;

// API Response wrapper
export interface AnalyticsResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

// Configuration interfaces
export interface AnalyticsConfig {
  refreshIntervals: {
    dexData: number;
    crossChainData: number;
    rpcData: number;
    validatorData: number;
  };
  apiKeys: {
    jupiter?: string;
    birdeye?: string;
    solscan?: string;
    defiLlama?: string;
    dune?: string;
  };
  rpcEndpoints: {
    solana: string[];
    ethereum: string[];
  };
}