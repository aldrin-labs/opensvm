/**
 * Investigation Strategies
 *
 * Defines investigation workflows and planning logic for different
 * investigation types. Each strategy produces a sequence of tool calls.
 */

import type {
  InvestigationType,
  InvestigationTarget,
  InvestigationConfig,
  InvestigationPlan,
  InvestigationStep,
} from './types';

/**
 * Generate a unique step ID
 */
function generateStepId(): string {
  return `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create an investigation step
 */
function createStep(
  tool: string,
  params: Record<string, any>,
  purpose: string
): InvestigationStep {
  return {
    id: generateStepId(),
    tool,
    params,
    purpose,
    status: 'pending',
  };
}

/**
 * Wallet Forensics Strategy
 *
 * Comprehensive analysis of a wallet including:
 * - Portfolio holdings
 * - Transaction history
 * - Connected wallets
 * - Behavioral patterns
 */
export function createWalletForensicsStrategy(
  target: InvestigationTarget,
  config: InvestigationConfig
): InvestigationStep[] {
  const steps: InvestigationStep[] = [];
  const address = target.address;

  // 1. Get wallet portfolio
  steps.push(
    createStep(
      'get_account_portfolio',
      { address },
      'Gather current holdings and token balances'
    )
  );

  // 2. Get account statistics
  steps.push(
    createStep(
      'get_account_stats',
      { address },
      'Analyze account activity statistics'
    )
  );

  // 3. Get recent transactions
  steps.push(
    createStep(
      'get_account_transactions',
      { address, limit: Math.min(config.maxTransactions, 100) },
      'Retrieve recent transaction history'
    )
  );

  // 4. Analyze key transactions for patterns
  steps.push(
    createStep(
      'analyze_transactions_batch',
      { address, analyze_count: 10 },
      'Deep analysis of significant transactions'
    )
  );

  // 5. If connection mapping enabled, find related wallets
  if (config.enableConnectionMapping) {
    steps.push(
      createStep(
        'find_connected_wallets',
        { address, depth: Math.min(config.maxDepth, 3) },
        'Map connected wallets through token transfers'
      )
    );
  }

  // 6. Anomaly detection on collected data
  if (config.enableAnomalyDetection) {
    steps.push(
      createStep(
        'detect_wallet_anomalies',
        { address },
        'Detect suspicious patterns in wallet activity'
      )
    );
  }

  return steps;
}

/**
 * Transaction Tracing Strategy
 *
 * Follow a transaction's fund flow:
 * - Analyze the transaction itself
 * - Trace source and destination wallets
 * - Follow token flows
 */
export function createTransactionTracingStrategy(
  target: InvestigationTarget,
  config: InvestigationConfig
): InvestigationStep[] {
  const steps: InvestigationStep[] = [];
  const signature = target.address;

  // 1. Get full transaction details
  steps.push(
    createStep(
      'get_transaction',
      { signature },
      'Retrieve complete transaction data'
    )
  );

  // 2. Explain what the transaction does
  steps.push(
    createStep(
      'explain_transaction',
      { signature },
      'Get AI explanation of transaction purpose'
    )
  );

  // 3. Deep analysis of the transaction
  steps.push(
    createStep(
      'analyze_transaction',
      { signature },
      'Perform deep analysis of transaction patterns'
    )
  );

  // 4. Get related transactions
  steps.push(
    createStep(
      'get_related_transactions',
      { signature },
      'Find transactions related to this one'
    )
  );

  // 5. Analyze involved wallets
  steps.push(
    createStep(
      'analyze_involved_wallets',
      { signature },
      'Profile wallets involved in this transaction'
    )
  );

  // 6. If following token flows, trace the tokens
  if (config.followTokenFlows) {
    steps.push(
      createStep(
        'trace_token_flow',
        { signature, depth: config.maxDepth },
        'Trace token movements from this transaction'
      )
    );
  }

  return steps;
}

/**
 * Token Flow Analysis Strategy
 *
 * Analyze how a specific token moves through the network:
 * - Token metadata
 * - Major holders
 * - Trading patterns
 * - Concentration analysis
 */
export function createTokenFlowStrategy(
  target: InvestigationTarget,
  config: InvestigationConfig
): InvestigationStep[] {
  const steps: InvestigationStep[] = [];
  const mint = target.address;

  // 1. Get token metadata
  steps.push(
    createStep(
      'get_token_metadata',
      { mint },
      'Retrieve token information and supply'
    )
  );

  // 2. Get market data
  steps.push(
    createStep(
      'get_token_ohlcv',
      { mint, type: '1H' },
      'Get price history and trading volume'
    )
  );

  // 3. Get markets/pools
  steps.push(
    createStep(
      'get_token_markets',
      { mint },
      'Find DEX pools and liquidity sources'
    )
  );

  // 4. Analyze holder distribution
  steps.push(
    createStep(
      'analyze_token_holders',
      { mint, limit: 100 },
      'Analyze top holders and concentration'
    )
  );

  // 5. Detect suspicious trading patterns
  if (config.enableAnomalyDetection) {
    steps.push(
      createStep(
        'detect_trading_anomalies',
        { mint, timeframe: config.timeRangeHours },
        'Detect wash trading, pump patterns, etc.'
      )
    );
  }

  return steps;
}

/**
 * Anomaly Detection Strategy
 *
 * Focus specifically on finding suspicious activity:
 * - Unusual transaction patterns
 * - Time-based anomalies
 * - Volume spikes
 * - Circular flows
 */
export function createAnomalyDetectionStrategy(
  target: InvestigationTarget,
  config: InvestigationConfig
): InvestigationStep[] {
  const steps: InvestigationStep[] = [];
  const address = target.address;

  // 1. Get baseline data
  steps.push(
    createStep(
      'get_account_portfolio',
      { address },
      'Establish baseline wallet state'
    )
  );

  // 2. Get transaction history for analysis
  steps.push(
    createStep(
      'get_account_transactions',
      { address, limit: config.maxTransactions },
      'Gather transactions for anomaly analysis'
    )
  );

  // 3. Detect timing anomalies
  steps.push(
    createStep(
      'detect_timing_anomalies',
      { address, window_hours: config.timeRangeHours },
      'Find unusual timing patterns (bot activity, coordinated txs)'
    )
  );

  // 4. Detect volume anomalies
  steps.push(
    createStep(
      'detect_volume_anomalies',
      { address },
      'Find unusual volume spikes or patterns'
    )
  );

  // 5. Detect circular flows (potential wash trading)
  steps.push(
    createStep(
      'detect_circular_flows',
      { address, depth: config.maxDepth },
      'Find funds returning to origin (wash trading indicator)'
    )
  );

  // 6. Check for known bad actors
  steps.push(
    createStep(
      'check_known_bad_actors',
      { address },
      'Cross-reference with known scam/exploit addresses'
    )
  );

  return steps;
}

/**
 * Connection Mapping Strategy
 *
 * Map relationships between wallets:
 * - Direct transfers
 * - Shared token holdings
 * - Common counterparties
 */
export function createConnectionMappingStrategy(
  target: InvestigationTarget,
  config: InvestigationConfig
): InvestigationStep[] {
  const steps: InvestigationStep[] = [];
  const address = target.address;

  // 1. Get direct connections
  steps.push(
    createStep(
      'get_direct_connections',
      { address, limit: 50 },
      'Find wallets with direct token transfers'
    )
  );

  // 2. Build connection graph
  steps.push(
    createStep(
      'build_connection_graph',
      { address, depth: config.maxDepth },
      'Build graph of wallet relationships'
    )
  );

  // 3. Find shared counterparties
  steps.push(
    createStep(
      'find_shared_counterparties',
      { address },
      'Identify common counterparties (exchanges, pools)'
    )
  );

  // 4. Cluster analysis
  steps.push(
    createStep(
      'cluster_wallets',
      { address },
      'Group wallets by behavioral similarity'
    )
  );

  // 5. Find funding sources
  steps.push(
    createStep(
      'trace_funding_sources',
      { address, depth: 5 },
      'Trace original funding sources'
    )
  );

  return steps;
}

/**
 * Full Investigation Strategy
 *
 * Comprehensive investigation combining all strategies
 */
export function createFullInvestigationStrategy(
  target: InvestigationTarget,
  config: InvestigationConfig
): InvestigationStep[] {
  const steps: InvestigationStep[] = [];

  // Start with forensics
  steps.push(...createWalletForensicsStrategy(target, config));

  // Add anomaly detection
  steps.push(...createAnomalyDetectionStrategy(target, {
    ...config,
    enableAnomalyDetection: true,
  }));

  // Add connection mapping
  steps.push(...createConnectionMappingStrategy(target, {
    ...config,
    enableConnectionMapping: true,
  }));

  return steps;
}

/**
 * Select the appropriate strategy based on investigation type
 */
export function selectStrategy(
  type: InvestigationType,
  target: InvestigationTarget,
  config: InvestigationConfig
): InvestigationStep[] {
  switch (type) {
    case 'wallet_forensics':
      return createWalletForensicsStrategy(target, config);
    case 'transaction_tracing':
      return createTransactionTracingStrategy(target, config);
    case 'token_flow_analysis':
      return createTokenFlowStrategy(target, config);
    case 'anomaly_detection':
      return createAnomalyDetectionStrategy(target, config);
    case 'connection_mapping':
      return createConnectionMappingStrategy(target, config);
    case 'full_investigation':
      return createFullInvestigationStrategy(target, config);
    default:
      return createWalletForensicsStrategy(target, config);
  }
}

/**
 * Create an investigation plan
 */
export function createInvestigationPlan(
  type: InvestigationType,
  target: InvestigationTarget,
  config: InvestigationConfig
): InvestigationPlan {
  const steps = selectStrategy(type, target, config);

  // Estimate duration based on number of steps (avg 3 seconds per step)
  const estimatedDuration = steps.length * 3000;

  return {
    id: `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    target,
    steps,
    estimatedDuration,
    createdAt: Date.now(),
  };
}

/**
 * Default investigation configuration
 */
export const DEFAULT_CONFIG: InvestigationConfig = {
  maxDepth: 3,
  maxTransactions: 50,
  timeRangeHours: 168, // 1 week
  enableAnomalyDetection: true,
  enableConnectionMapping: true,
  followTokenFlows: true,
  riskThreshold: 'medium',
};
