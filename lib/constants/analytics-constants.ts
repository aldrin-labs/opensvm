/**
 * Analytics Constants
 * Standardized fee percentages, volume thresholds, and other magic numbers
 * used across the analytics platform to avoid scattered hardcoded values.
 */

// DEX Analytics Constants
export const DEX_CONSTANTS = {
  // Fee percentages (in basis points, 1 bp = 0.01%)
  FEES: {
    JUPITER_FEE_BP: 85,           // 0.85% fee
    RAYDIUM_FEE_BP: 25,           // 0.25% fee  
    ORCA_FEE_BP: 30,              // 0.30% fee
    PHOENIX_FEE_BP: 10,           // 0.10% fee
    METEORA_FEE_BP: 25,           // 0.25% fee
    SERUM_FEE_BP: 22,             // 0.22% fee
    DEFAULT_FEE_BP: 30,           // 0.30% default fee
  },
  
  // Volume thresholds (in USD)
  VOLUME_THRESHOLDS: {
    MINIMAL_DAILY_VOLUME: 1000,       // $1K minimum for inclusion
    LOW_VOLUME_THRESHOLD: 100000,     // $100K low volume threshold
    MEDIUM_VOLUME_THRESHOLD: 1000000, // $1M medium volume threshold
    HIGH_VOLUME_THRESHOLD: 10000000,  // $10M high volume threshold
    WHALE_VOLUME_THRESHOLD: 100000000, // $100M whale volume threshold
  },
  
  // Arbitrage opportunity thresholds
  ARBITRAGE: {
    MIN_PROFIT_USD: 10,               // $10 minimum profit
    MIN_PROFIT_PERCENTAGE: 0.1,       // 0.1% minimum profit percentage
    MAX_SLIPPAGE_PERCENTAGE: 1.0,     // 1.0% maximum acceptable slippage
    GAS_COST_BUFFER_USD: 5,           // $5 gas cost buffer
  },
  
  // Liquidity pool thresholds
  LIQUIDITY: {
    MIN_TVL_USD: 1000,                // $1K minimum TVL
    MIN_APR_PERCENTAGE: 0.1,          // 0.1% minimum APR
    MAX_APR_PERCENTAGE: 10000,        // 10000% maximum realistic APR
    RISK_FREE_RATE_PERCENTAGE: 2.0,   // 2.0% risk-free rate
  }
} as const;

// Cross-Chain Analytics Constants  
export const CROSS_CHAIN_CONSTANTS = {
  // Bridge fee percentages
  BRIDGE_FEES: {
    WORMHOLE_FEE_BP: 0,               // 0% base fee (gas only)
    PORTAL_FEE_BP: 0,                 // 0% base fee (gas only)
    ALLBRIDGE_FEE_BP: 300,            // 3.0% fee
    MULTICHAIN_FEE_BP: 100,           // 1.0% fee
    SATELLITE_FEE_BP: 250,            // 2.5% fee
  },
  
  // Volume distribution weights (used for realistic data simulation)
  CHAIN_WEIGHTS: {
    ethereum: 0.35,    // 35% of cross-chain volume
    polygon: 0.15,     // 15% of cross-chain volume
    avalanche: 0.12,   // 12% of cross-chain volume
    bsc: 0.15,         // 15% of cross-chain volume
    arbitrum: 0.13,    // 13% of cross-chain volume
    optimism: 0.10,    // 10% of cross-chain volume
  },
  
  // Migration thresholds
  MIGRATION: {
    SIGNIFICANT_TVL_CHANGE_PERCENTAGE: 5.0,  // 5% TVL change threshold
    MIN_MIGRATION_AMOUNT_USD: 100000,        // $100K minimum for migration tracking
    ECOSYSTEM_RISK_THRESHOLD_PERCENTAGE: 15.0, // 15% ecosystem risk threshold
  }
} as const;

// DeFi Health Constants
export const DEFI_HEALTH_CONSTANTS = {
  // Risk scoring weights (must sum to 1.0)
  RISK_WEIGHTS: {
    TVL_WEIGHT: 0.25,                 // 25% weight for TVL stability
    TREASURY_WEIGHT: 0.20,            // 20% weight for treasury health
    GOVERNANCE_WEIGHT: 0.15,          // 15% weight for governance quality
    SECURITY_WEIGHT: 0.25,            // 25% weight for security metrics
    ACTIVITY_WEIGHT: 0.15,            // 15% weight for protocol activity
  },
  
  // Health score thresholds (0-100 scale)
  HEALTH_THRESHOLDS: {
    CRITICAL_THRESHOLD: 20,           // Below 20 = Critical
    POOR_THRESHOLD: 40,               // 20-40 = Poor
    MODERATE_THRESHOLD: 60,           // 40-60 = Moderate
    GOOD_THRESHOLD: 80,               // 60-80 = Good
    EXCELLENT_THRESHOLD: 100,         // 80-100 = Excellent
  },
  
  // Treasury analysis constants
  TREASURY: {
    MIN_RUNWAY_MONTHS: 6,             // 6 months minimum runway
    CRITICAL_RUNWAY_MONTHS: 3,        // 3 months critical runway
    MAX_BURN_RATE_PERCENTAGE: 10,     // 10% max monthly burn rate
  },
  
  // Security monitoring intervals (in seconds)
  MONITORING: {
    FAST_INTERVAL: 30,                // 30 seconds for critical monitoring
    NORMAL_INTERVAL: 300,             // 5 minutes for regular monitoring  
    SLOW_INTERVAL: 3600,              // 1 hour for background monitoring
  }
} as const;

// Validator Analytics Constants
export const VALIDATOR_CONSTANTS = {
  // Performance scoring weights
  PERFORMANCE_WEIGHTS: {
    UPTIME_WEIGHT: 0.30,              // 30% weight for uptime
    COMMISSION_WEIGHT: 0.20,          // 20% weight for commission rates
    STAKE_WEIGHT: 0.25,               // 25% weight for stake amount
    GEOGRAPHY_WEIGHT: 0.15,           // 15% weight for geographic distribution
    VERSION_WEIGHT: 0.10,             // 10% weight for software version
  },
  
  // Commission thresholds (in percentage)
  COMMISSION: {
    EXCELLENT_THRESHOLD: 5.0,         // Below 5% = Excellent
    GOOD_THRESHOLD: 7.0,              // 5-7% = Good  
    MODERATE_THRESHOLD: 10.0,         // 7-10% = Moderate
    POOR_THRESHOLD: 15.0,             // 10-15% = Poor (above 15% = Critical)
  },
  
  // Stake thresholds (in SOL)
  STAKE_THRESHOLDS: {
    MIN_STAKE_SOL: 1,                 // 1 SOL minimum stake
    SMALL_VALIDATOR_SOL: 100000,      // 100K SOL small validator
    MEDIUM_VALIDATOR_SOL: 500000,     // 500K SOL medium validator  
    LARGE_VALIDATOR_SOL: 1000000,     // 1M SOL large validator
    WHALE_VALIDATOR_SOL: 5000000,     // 5M SOL whale validator
  },
  
  // Decentralization metrics
  DECENTRALIZATION: {
    NAKAMOTO_COEFFICIENT_TARGET: 100, // Target Nakamoto coefficient
    MAX_SINGLE_VALIDATOR_PERCENTAGE: 10.0, // 10% max single validator stake
    MIN_VALIDATORS_FOR_HEALTH: 1000,  // 1000 minimum validators for network health
  }
} as const;

// Cache and Performance Constants
export const PERFORMANCE_CONSTANTS = {
  // Cache retention (in milliseconds)
  CACHE_RETENTION: {
    REAL_TIME_CACHE_MS: 30000,        // 30 seconds for real-time data
    FAST_CACHE_MS: 300000,            // 5 minutes for fast-changing data
    NORMAL_CACHE_MS: 1800000,         // 30 minutes for normal data
    SLOW_CACHE_MS: 3600000,           // 1 hour for slow-changing data
    DAILY_CACHE_MS: 86400000,         // 24 hours for daily data
  },
  
  // API rate limits
  RATE_LIMITS: {
    REQUESTS_PER_MINUTE: 60,          // 60 requests per minute default
    BURST_LIMIT: 10,                  // 10 requests in burst
    COOLDOWN_MS: 1000,                // 1 second cooldown between requests
  },
  
  // Data freshness thresholds (in milliseconds)
  FRESHNESS: {
    CRITICAL_DATA_MAX_AGE_MS: 60000,  // 1 minute max age for critical data
    NORMAL_DATA_MAX_AGE_MS: 300000,   // 5 minutes max age for normal data
    BACKGROUND_DATA_MAX_AGE_MS: 3600000, // 1 hour max age for background data
  }
} as const;

// UI and UX Constants
export const UI_CONSTANTS = {
  // Animation and transition durations (in milliseconds)
  TRANSITIONS: {
    FAST_TRANSITION_MS: 150,          // 150ms for fast transitions
    NORMAL_TRANSITION_MS: 300,        // 300ms for normal transitions
    SLOW_TRANSITION_MS: 500,          // 500ms for slow transitions
  },
  
  // Pagination and data display
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 25,            // 25 items per page default
    MAX_PAGE_SIZE: 100,               // 100 items per page maximum
    INFINITE_SCROLL_THRESHOLD: 200,   // 200px from bottom to trigger load
  },
  
  // Notification and alert durations (in milliseconds)
  NOTIFICATIONS: {
    SUCCESS_DURATION_MS: 3000,        // 3 seconds for success messages
    ERROR_DURATION_MS: 5000,          // 5 seconds for error messages
    WARNING_DURATION_MS: 4000,        // 4 seconds for warning messages
  }
} as const;

// Launchpad Analytics Constants
export const LAUNCHPAD_CONSTANTS = {
  // Success rate thresholds (in percentage)
  SUCCESS_RATES: {
    EXCELLENT_THRESHOLD: 80,          // Above 80% = Excellent
    GOOD_THRESHOLD: 65,               // 65-80% = Good
    MODERATE_THRESHOLD: 50,           // 50-65% = Moderate
    POOR_THRESHOLD: 35,               // 35-50% = Poor (below 35% = Critical)
  },
  
  // ROI thresholds (in percentage)
  ROI_THRESHOLDS: {
    EXCELLENT_ROI: 500,               // Above 500% = Excellent
    GOOD_ROI: 200,                    // 200-500% = Good
    MODERATE_ROI: 50,                 // 50-200% = Moderate
    POOR_ROI: 0,                      // 0-50% = Poor (below 0% = Loss)
  },
  
  // Fundraising thresholds (in USD)
  FUNDRAISING: {
    MIN_RAISE_USD: 1000,              // $1K minimum raise
    SMALL_RAISE_USD: 100000,          // $100K small raise
    MEDIUM_RAISE_USD: 1000000,        // $1M medium raise
    LARGE_RAISE_USD: 10000000,        // $10M large raise
    MEGA_RAISE_USD: 50000000,         // $50M mega raise
  },
  
  // Memecoin specific constants
  MEMECOIN: {
    PUMP_FUN_FEE_BP: 100,             // 1% pump.fun fee
    MOONSHOT_FEE_BP: 150,             // 1.5% moonshot fee
    MIN_LIQUIDITY_USD: 500,           // $500 minimum liquidity
    MAX_REALISTIC_MCAP_USD: 1000000000, // $1B max realistic market cap
    TYPICAL_HOLD_TIME_HOURS: 24,      // 24 hours typical hold time
  },
  
  // Platform categories
  CATEGORIES: {
    IDO_PLATFORM: 'IDO Platform',
    MEMECOIN_PLATFORM: 'Memecoin Platform',
    GAMING_PLATFORM: 'Gaming Platform',
    TRADING_PLATFORM: 'Trading Platform',
    ECOSYSTEM: 'Ecosystem',
    AGGREGATOR: 'Aggregator'
  }
} as const;

// Utility functions for working with constants
export const getFeeBasisPoints = (feePercentage: number): number => {
  return Math.round(feePercentage * 100);
};

export const getBasisPointsAsPercentage = (basisPoints: number): number => {
  return basisPoints / 100;
};

export const formatFeePercentage = (basisPoints: number): string => {
  return `${getBasisPointsAsPercentage(basisPoints).toFixed(2)}%`;
};

export const isVolumeSignificant = (volumeUSD: number): boolean => {
  return volumeUSD >= DEX_CONSTANTS.VOLUME_THRESHOLDS.MINIMAL_DAILY_VOLUME;
};

export const getVolumeCategory = (volumeUSD: number): 'minimal' | 'low' | 'medium' | 'high' | 'whale' => {
  const thresholds = DEX_CONSTANTS.VOLUME_THRESHOLDS;
  
  if (volumeUSD >= thresholds.WHALE_VOLUME_THRESHOLD) return 'whale';
  if (volumeUSD >= thresholds.HIGH_VOLUME_THRESHOLD) return 'high';
  if (volumeUSD >= thresholds.MEDIUM_VOLUME_THRESHOLD) return 'medium';
  if (volumeUSD >= thresholds.LOW_VOLUME_THRESHOLD) return 'low';
  return 'minimal';
};

export const getHealthCategory = (score: number): 'critical' | 'poor' | 'moderate' | 'good' | 'excellent' => {
  const thresholds = DEFI_HEALTH_CONSTANTS.HEALTH_THRESHOLDS;
  
  if (score >= thresholds.GOOD_THRESHOLD) return 'excellent';
  if (score >= thresholds.MODERATE_THRESHOLD) return 'good';
  if (score >= thresholds.POOR_THRESHOLD) return 'moderate';
  if (score >= thresholds.CRITICAL_THRESHOLD) return 'poor';
  return 'critical';
};