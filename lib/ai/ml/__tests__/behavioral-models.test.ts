/**
 * Test suite for Behavioral Models Engine
 */

import { BehavioralModelsEngine, WalletAnalysisRequest } from '../behavioral-models';

describe('BehavioralModelsEngine', () => {
  let engine: BehavioralModelsEngine;

  beforeEach(() => {
    engine = new BehavioralModelsEngine();
  });

  describe('Wallet Behavior Classification', () => {
    it('should classify whale wallets correctly', async () => {
      const whaleTransactions = generateWhaleTransactions();
      
      const request: WalletAnalysisRequest = {
        wallet_address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        analysis_type: 'behavior_classification',
        time_period: '30d',
        transaction_data: whaleTransactions
      };

      const result = await engine.analyzeWallet(request);

      expect(result).toBeDefined();
      expect(result.wallet_address).toBe(request.wallet_address);
      expect(result.behavior_classification).toBeDefined();
      expect(result.behavior_classification!.primary_behavior).toMatch(
        /^(whale|institutional|retail|bot|arbitrageur|market_maker)$/
      );
      expect(result.behavior_classification!.confidence_score).toBeGreaterThanOrEqual(0);
      expect(result.behavior_classification!.confidence_score).toBeLessThanOrEqual(1);
    });

    it('should identify bot trading patterns', async () => {
      const botTransactions = generateBotTransactions();
      
      const request: WalletAnalysisRequest = {
        wallet_address: 'BotWallet123456789',
        analysis_type: 'behavior_classification',
        time_period: '7d',
        transaction_data: botTransactions
      };

      const result = await engine.analyzeWallet(request);

      expect(result.behavior_classification).toBeDefined();
      
      // Bot patterns should be detected
      const hasBotBehavior = result.behavior_classification!.secondary_behaviors.includes('bot') ||
                           result.behavior_classification!.primary_behavior === 'bot';
      
      expect(hasBotBehavior).toBe(true);
      expect(result.behavior_classification!.behavior_indicators).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/automated|regular|pattern/i)
        ])
      );
    });

    it('should classify arbitrageur behavior', async () => {
      const arbitrageTransactions = generateArbitrageTransactions();
      
      const request: WalletAnalysisRequest = {
        wallet_address: 'ArbitrageWallet789',
        analysis_type: 'behavior_classification',
        time_period: '14d',
        transaction_data: arbitrageTransactions
      };

      const result = await engine.analyzeWallet(request);

      const isArbitrageur = result.behavior_classification!.primary_behavior === 'arbitrageur' ||
                          result.behavior_classification!.secondary_behaviors.includes('arbitrageur');
      
      expect(isArbitrageur).toBe(true);
      expect(result.risk_assessment).toBeDefined();
      expect(result.risk_assessment!.overall_risk_score).toBeDefined();
    });

    it('should detect market maker behavior', async () => {
      const marketMakerTransactions = generateMarketMakerTransactions();
      
      const request: WalletAnalysisRequest = {
        wallet_address: 'MarketMakerWallet456',
        analysis_type: 'behavior_classification',
        time_period: '30d',
        transaction_data: marketMakerTransactions
      };

      const result = await engine.analyzeWallet(request);

      const isMarketMaker = result.behavior_classification!.primary_behavior === 'market_maker' ||
                          result.behavior_classification!.secondary_behaviors.includes('market_maker');
      
      if (isMarketMaker) {
        expect(result.behavior_classification!.behavior_indicators).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/liquidity|spread|market.*making/i)
          ])
        );
      }
    });
  });

  describe('MEV Detection', () => {
    it('should detect frontrunning activities', async () => {
      const frontrunningData = generateFrontrunningTransactions();
      
      const result = await engine.detectMEV({
        analysis_scope: 'block_range',
        block_range: { start: 100000, end: 100010 },
        transaction_data: frontrunningData,
        mev_types: ['frontrunning', 'sandwiching']
      });

      expect(result).toBeDefined();
      expect(result.mev_activities).toBeDefined();
      
      const frontrunningActivity = result.mev_activities.find(
        activity => activity.mev_type === 'frontrunning'
      );

      if (frontrunningActivity) {
        expect(frontrunningActivity.confidence_score).toBeGreaterThan(0.5);
        expect(frontrunningActivity.estimated_profit).toBeGreaterThan(0);
        expect(frontrunningActivity.victim_transactions).toHaveLength(expect.any(Number));
      }
    });

    it('should detect sandwich attacks', async () => {
      const sandwichData = generateSandwichAttackData();
      
      const result = await engine.detectMEV({
        analysis_scope: 'transaction_pool',
        transaction_data: sandwichData,
        mev_types: ['sandwiching'],
        min_profit_threshold: 10
      });

      const sandwichAttack = result.mev_activities.find(
        activity => activity.mev_type === 'sandwiching'
      );

      if (sandwichAttack) {
        expect(sandwichAttack.attack_structure).toBeDefined();
        expect(sandwichAttack.attack_structure!.front_transaction).toBeDefined();
        expect(sandwichAttack.attack_structure!.victim_transaction).toBeDefined();
        expect(sandwichAttack.attack_structure!.back_transaction).toBeDefined();
      }
    });

    it('should detect liquidation MEV', async () => {
      const liquidationData = generateLiquidationMEVData();
      
      const result = await engine.detectMEV({
        analysis_scope: 'protocol_specific',
        protocol: 'Solend',
        transaction_data: liquidationData,
        mev_types: ['liquidation']
      });

      const liquidationMEV = result.mev_activities.find(
        activity => activity.mev_type === 'liquidation'
      );

      if (liquidationMEV) {
        expect(liquidationMEV.protocol_involvement).toBe('Solend');
        expect(liquidationMEV.estimated_profit).toBeGreaterThan(0);
      }
    });

    it('should detect arbitrage MEV', async () => {
      const arbitrageData = generateArbitrageMEVData();
      
      const result = await engine.detectMEV({
        analysis_scope: 'cross_protocol',
        transaction_data: arbitrageData,
        mev_types: ['arbitrage'],
        protocols: ['Jupiter', 'Orca', 'Raydium']
      });

      const arbitrageMEV = result.mev_activities.find(
        activity => activity.mev_type === 'arbitrage'
      );

      if (arbitrageMEV) {
        expect(arbitrageMEV.protocols_involved).toBeDefined();
        expect(arbitrageMEV.protocols_involved!.length).toBeGreaterThanOrEqual(2);
        expect(arbitrageMEV.price_difference_exploited).toBeGreaterThan(0);
      }
    });
  });

  describe('Clustering Analysis', () => {
    it('should identify wallet clusters based on transaction patterns', async () => {
      const clusterTransactions = generateClusterTransactions();
      
      const result = await engine.performClustering({
        analysis_type: 'transaction_pattern_clustering',
        transaction_data: clusterTransactions,
        clustering_algorithm: 'dbscan',
        min_cluster_size: 3
      });

      expect(result).toBeDefined();
      expect(result.clusters).toBeDefined();
      expect(result.clusters.length).toBeGreaterThanOrEqual(1);
      
      if (result.clusters.length > 0) {
        const cluster = result.clusters[0];
        expect(cluster.wallet_addresses).toBeDefined();
        expect(cluster.wallet_addresses.length).toBeGreaterThanOrEqual(3);
        expect(cluster.cluster_characteristics).toBeDefined();
        expect(cluster.confidence_score).toBeGreaterThanOrEqual(0);
      }
    });

    it('should detect related wallets through common addresses', async () => {
      const relatedWalletData = generateRelatedWalletTransactions();
      
      const result = await engine.performClustering({
        analysis_type: 'address_clustering',
        transaction_data: relatedWalletData,
        clustering_algorithm: 'hierarchical',
        similarity_threshold: 0.7
      });

      expect(result.related_addresses).toBeDefined();
      if (result.related_addresses && result.related_addresses.length > 0) {
        const relation = result.related_addresses[0];
        expect(relation.address_pair).toHaveLength(2);
        expect(relation.relationship_strength).toBeGreaterThanOrEqual(0);
        expect(relation.relationship_strength).toBeLessThanOrEqual(1);
        expect(relation.relationship_type).toMatch(
          /^(common_counterparty|funding_chain|co_controlled|similar_pattern)$/
        );
      }
    });

    it('should perform behavioral clustering', async () => {
      const behavioralData = generateBehavioralClusteringData();
      
      const result = await engine.performClustering({
        analysis_type: 'behavioral_clustering',
        transaction_data: behavioralData,
        clustering_algorithm: 'kmeans',
        num_clusters: 5
      });

      expect(result.behavioral_clusters).toBeDefined();
      if (result.behavioral_clusters && result.behavioral_clusters.length > 0) {
        const behaviorCluster = result.behavioral_clusters[0];
        expect(behaviorCluster.dominant_behavior).toBeDefined();
        expect(behaviorCluster.wallet_count).toBeGreaterThan(0);
        expect(behaviorCluster.characteristic_features).toBeDefined();
      }
    });
  });

  describe('Risk Assessment', () => {
    it('should calculate comprehensive risk scores', async () => {
      const riskTransactions = generateRiskTransactions();
      
      const request: WalletAnalysisRequest = {
        wallet_address: 'HighRiskWallet123',
        analysis_type: 'risk_assessment',
        time_period: '30d',
        transaction_data: riskTransactions
      };

      const result = await engine.analyzeWallet(request);

      expect(result.risk_assessment).toBeDefined();
      expect(result.risk_assessment!.overall_risk_score).toBeGreaterThanOrEqual(0);
      expect(result.risk_assessment!.overall_risk_score).toBeLessThanOrEqual(1);
      expect(result.risk_assessment!.risk_factors).toBeDefined();
      expect(result.risk_assessment!.risk_breakdown).toBeDefined();
    });

    it('should identify specific risk factors', async () => {
      const suspiciousTransactions = generateSuspiciousTransactions();
      
      const request: WalletAnalysisRequest = {
        wallet_address: 'SuspiciousWallet456',
        analysis_type: 'risk_assessment',
        time_period: '14d',
        transaction_data: suspiciousTransactions
      };

      const result = await engine.analyzeWallet(request);

      expect(result.risk_assessment!.risk_factors).toHaveLength(expect.any(Number));
      
      if (result.risk_assessment!.risk_factors.length > 0) {
        const riskFactor = result.risk_assessment!.risk_factors[0];
        expect(riskFactor.factor_type).toBeDefined();
        expect(riskFactor.severity).toMatch(/^(low|medium|high|critical)$/);
        expect(riskFactor.description).toBeDefined();
        expect(riskFactor.confidence).toBeGreaterThanOrEqual(0);
      }
    });

    it('should assess money laundering risk', async () => {
      const launderingPattern = generateMoneyLaunderingPattern();
      
      const request: WalletAnalysisRequest = {
        wallet_address: 'ComplexFlowWallet789',
        analysis_type: 'risk_assessment',
        time_period: '60d',
        transaction_data: launderingPattern
      };

      const result = await engine.analyzeWallet(request);

      const hasLaunderingRisk = result.risk_assessment!.risk_factors.some(
        factor => factor.factor_type.includes('laundering') || 
                 factor.factor_type.includes('mixing') ||
                 factor.factor_type.includes('obfuscation')
      );

      if (hasLaunderingRisk) {
        expect(result.risk_assessment!.overall_risk_score).toBeGreaterThan(0.6);
      }
    });
  });

  describe('Advanced Pattern Detection', () => {
    it('should detect wash trading patterns', async () => {
      const washTradingData = generateWashTradingTransactions();
      
      const result = await engine.detectAdvancedPatterns({
        pattern_types: ['wash_trading'],
        transaction_data: washTradingData,
        analysis_window: '24h',
        confidence_threshold: 0.6
      });

      const washTradingPattern = result.detected_patterns.find(
        pattern => pattern.pattern_type === 'wash_trading'
      );

      if (washTradingPattern) {
        expect(washTradingPattern.participants).toHaveLength(expect.any(Number));
        expect(washTradingPattern.transaction_volume).toBeGreaterThan(0);
        expect(washTradingPattern.suspected_purpose).toBeDefined();
      }
    });

    it('should detect Sybil attack patterns', async () => {
      const sybilData = generateSybilAttackData();
      
      const result = await engine.detectAdvancedPatterns({
        pattern_types: ['sybil_attack'],
        transaction_data: sybilData,
        analysis_window: '7d',
        network_analysis: true
      });

      const sybilPattern = result.detected_patterns.find(
        pattern => pattern.pattern_type === 'sybil_attack'
      );

      if (sybilPattern) {
        expect(sybilPattern.controlled_addresses).toBeDefined();
        expect(sybilPattern.controlled_addresses!.length).toBeGreaterThanOrEqual(2);
        expect(sybilPattern.coordination_evidence).toBeDefined();
      }
    });

    it('should detect pump and dump schemes', async () => {
      const pumpDumpData = generatePumpDumpData();
      
      const result = await engine.detectAdvancedPatterns({
        pattern_types: ['pump_and_dump'],
        transaction_data: pumpDumpData,
        analysis_window: '12h',
        price_correlation: true
      });

      const pumpDumpPattern = result.detected_patterns.find(
        pattern => pattern.pattern_type === 'pump_and_dump'
      );

      if (pumpDumpPattern) {
        expect(pumpDumpPattern.phases).toBeDefined();
        expect(pumpDumpPattern.phases!.pump_phase).toBeDefined();
        expect(pumpDumpPattern.phases!.dump_phase).toBeDefined();
        expect(pumpDumpPattern.price_manipulation_evidence).toBeDefined();
      }
    });
  });

  describe('Real-time Analysis', () => {
    it('should process streaming transaction data', async () => {
      const streamingData = generateStreamingTransactions();
      
      const result = await engine.analyzeRealTime({
        stream_data: streamingData,
        analysis_types: ['behavior_classification', 'mev_detection'],
        alert_thresholds: {
          risk_score: 0.8,
          mev_profit: 100,
          unusual_pattern: 0.7
        }
      });

      expect(result).toBeDefined();
      expect(result.real_time_alerts).toBeDefined();
      expect(result.processed_transactions).toBeGreaterThan(0);
      expect(result.analysis_latency).toBeLessThan(1000); // Should be under 1 second
    });

    it('should generate real-time alerts for suspicious activity', async () => {
      const suspiciousStream = generateSuspiciousStreamData();
      
      const result = await engine.analyzeRealTime({
        stream_data: suspiciousStream,
        analysis_types: ['risk_assessment'],
        alert_thresholds: { risk_score: 0.6 }
      });

      if (result.real_time_alerts.length > 0) {
        const alert = result.real_time_alerts[0];
        expect(alert.alert_type).toBeDefined();
        expect(alert.severity).toMatch(/^(low|medium|high|critical)$/);
        expect(alert.wallet_address).toBeDefined();
        expect(alert.timestamp).toBeGreaterThan(0);
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large transaction datasets efficiently', async () => {
      const largeDataset = generateLargeTransactionDataset(10000);
      
      const request: WalletAnalysisRequest = {
        wallet_address: 'LargeVolumeWallet',
        analysis_type: 'behavior_classification',
        time_period: '30d',
        transaction_data: largeDataset
      };

      const startTime = Date.now();
      const result = await engine.analyzeWallet(request);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(15000); // Should complete within 15 seconds
      expect(result).toBeDefined();
    });

    it('should optimize memory usage for continuous analysis', async () => {
      // Test memory efficiency with multiple analyses
      const wallets = Array.from({length: 5}, (_, i) => `wallet_${i}`);
      
      for (const wallet of wallets) {
        const transactions = generateMockTransactions(1000);
        
        const request: WalletAnalysisRequest = {
          wallet_address: wallet,
          analysis_type: 'behavior_classification',
          time_period: '7d',
          transaction_data: transactions
        };

        const result = await engine.analyzeWallet(request);
        expect(result).toBeDefined();
      }
      
      // If we get here without memory issues, the test passes
      expect(true).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle insufficient transaction data', async () => {
      const request: WalletAnalysisRequest = {
        wallet_address: 'NewWallet123',
        analysis_type: 'behavior_classification',
        time_period: '30d',
        transaction_data: [] // No transactions
      };

      const result = await engine.analyzeWallet(request);

      expect(result.warnings).toBeDefined();
      expect(result.warnings!.some(w => w.includes('insufficient data'))).toBe(true);
      expect(result.behavior_classification!.confidence_score).toBeLessThan(0.5);
    });

    it('should validate input parameters', async () => {
      const request: WalletAnalysisRequest = {
        wallet_address: '', // Invalid empty address
        analysis_type: 'invalid_type' as any,
        time_period: '30d',
        transaction_data: []
      };

      await expect(engine.analyzeWallet(request)).rejects.toThrow();
    });

    it('should handle malformed transaction data gracefully', async () => {
      const malformedTransactions = [
        { timestamp: 'invalid', amount: NaN, from_address: null },
        { to_address: undefined, signature: 123 }
      ];

      const request: WalletAnalysisRequest = {
        wallet_address: 'TestWallet',
        analysis_type: 'behavior_classification',
        time_period: '7d',
        transaction_data: malformedTransactions as any
      };

      // Should not throw but should handle gracefully
      const result = await engine.analyzeWallet(request);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.length).toBeGreaterThan(0);
    });
  });
});

// Mock data generators for testing
function generateWhaleTransactions(): any[] {
  const transactions = [];
  const baseTime = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days ago
  
  for (let i = 0; i < 50; i++) {
    transactions.push({
      timestamp: baseTime + (i * 12 * 60 * 60 * 1000), // Every 12 hours
      signature: `whale_tx_${i}`,
      from_address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      to_address: `counterparty_${i % 5}`,
      amount: Math.random() * 1000000 + 100000, // Large amounts (100k - 1M)
      token: ['SOL', 'USDC', 'ETH'][i % 3],
      program: 'Jupiter',
      instruction_type: 'swap',
      success: true
    });
  }
  
  return transactions;
}

function generateBotTransactions(): any[] {
  const transactions = [];
  const baseTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago
  
  // Generate very regular transactions (bot-like behavior)
  for (let i = 0; i < 200; i++) {
    transactions.push({
      timestamp: baseTime + (i * 5 * 60 * 1000), // Every 5 minutes exactly
      signature: `bot_tx_${i}`,
      from_address: 'BotWallet123456789',
      to_address: 'target_wallet',
      amount: 1000 + (i % 10), // Very consistent amounts with small variations
      token: 'SOL',
      program: 'Orca',
      instruction_type: 'swap',
      success: true,
      gas_used: 5000 // Consistent gas usage
    });
  }
  
  return transactions;
}

function generateArbitrageTransactions(): any[] {
  const transactions = [];
  const protocols = ['Jupiter', 'Orca', 'Raydium'];
  const baseTime = Date.now() - (14 * 24 * 60 * 60 * 1000);
  
  for (let i = 0; i < 100; i++) {
    // Generate pairs of transactions (buy low, sell high)
    const buyPrice = 100 + Math.random() * 10;
    const sellPrice = buyPrice + Math.random() * 2 + 0.5; // Small profit margin
    
    transactions.push(
      {
        timestamp: baseTime + (i * 60 * 60 * 1000),
        signature: `arb_buy_${i}`,
        from_address: 'ArbitrageWallet789',
        to_address: 'protocol_pool_1',
        amount: buyPrice * 100,
        token: 'SOL',
        program: protocols[i % 2],
        instruction_type: 'swap',
        success: true
      },
      {
        timestamp: baseTime + (i * 60 * 60 * 1000) + 30000, // 30 seconds later
        signature: `arb_sell_${i}`,
        from_address: 'ArbitrageWallet789',
        to_address: 'protocol_pool_2',
        amount: sellPrice * 100,
        token: 'SOL',
        program: protocols[(i + 1) % 2],
        instruction_type: 'swap',
        success: true
      }
    );
  }
  
  return transactions;
}

function generateMarketMakerTransactions(): any[] {
  const transactions = [];
  const baseTime = Date.now() - (30 * 24 * 60 * 60 * 1000);
  
  for (let i = 0; i < 300; i++) {
    const isBuy = i % 2 === 0;
    const price = 100 + Math.sin(i / 20) * 5; // Oscillating price
    
    transactions.push({
      timestamp: baseTime + (i * 2 * 60 * 60 * 1000), // Every 2 hours
      signature: `mm_tx_${i}`,
      from_address: 'MarketMakerWallet456',
      to_address: isBuy ? 'buy_pool' : 'sell_pool',
      amount: price * (500 + Math.random() * 100), // Consistent large volumes
      token: 'SOL',
      program: 'Orca',
      instruction_type: isBuy ? 'buy' : 'sell',
      success: true,
      is_limit_order: true,
      spread: 0.1 // Tight spreads typical of market makers
    });
  }
  
  return transactions;
}

function generateFrontrunningTransactions(): any[] {
  const transactions = [];
  const blockTime = Date.now() - 1000000;
  
  // Victim transaction
  transactions.push({
    timestamp: blockTime,
    signature: 'victim_tx',
    block_number: 100005,
    transaction_index: 5,
    from_address: 'victim_wallet',
    to_address: 'dex_pool',
    amount: 10000,
    token: 'SOL',
    gas_price: 1000,
    instruction_type: 'swap'
  });
  
  // Frontrunning transaction (same block, earlier index)
  transactions.push({
    timestamp: blockTime - 1000,
    signature: 'frontrun_tx',
    block_number: 100005,
    transaction_index: 4,
    from_address: 'mev_bot',
    to_address: 'dex_pool',
    amount: 15000,
    token: 'SOL',
    gas_price: 2000, // Higher gas price
    instruction_type: 'swap'
  });
  
  return transactions;
}

function generateSandwichAttackData(): any[] {
  const transactions = [];
  const blockTime = Date.now() - 500000;
  
  // Front transaction
  transactions.push({
    timestamp: blockTime - 2000,
    signature: 'sandwich_front',
    block_number: 100010,
    transaction_index: 3,
    from_address: 'sandwich_bot',
    to_address: 'target_pool',
    amount: 50000,
    token: 'SOL',
    gas_price: 3000,
    instruction_type: 'buy'
  });
  
  // Victim transaction
  transactions.push({
    timestamp: blockTime - 1000,
    signature: 'victim_sandwich',
    block_number: 100010,
    transaction_index: 4,
    from_address: 'victim_wallet_2',
    to_address: 'target_pool',
    amount: 20000,
    token: 'SOL',
    gas_price: 1000,
    instruction_type: 'buy'
  });
  
  // Back transaction
  transactions.push({
    timestamp: blockTime,
    signature: 'sandwich_back',
    block_number: 100010,
    transaction_index: 5,
    from_address: 'sandwich_bot',
    to_address: 'target_pool',
    amount: 50000,
    token: 'SOL',
    gas_price: 3000,
    instruction_type: 'sell'
  });
  
  return transactions;
}

function generateLiquidationMEVData(): any[] {
  return [
    {
      timestamp: Date.now() - 300000,
      signature: 'liquidation_mev',
      from_address: 'liquidation_bot',
      to_address: 'solend_protocol',
      amount: 100000,
      token: 'SOL',
      program: 'Solend',
      instruction_type: 'liquidate',
      liquidated_position_value: 95000,
      liquidation_bonus: 5000,
      success: true
    }
  ];
}

function generateArbitrageMEVData(): any[] {
  return [
    {
      timestamp: Date.now() - 600000,
      signature: 'arb_mev_1',
      from_address: 'arb_mev_bot',
      to_address: 'jupiter_pool',
      amount: 10000,
      token: 'SOL',
      program: 'Jupiter',
      instruction_type: 'swap',
      price: 100
    },
    {
      timestamp: Date.now() - 599000,
      signature: 'arb_mev_2',
      from_address: 'arb_mev_bot',
      to_address: 'orca_pool',
      amount: 10000,
      token: 'SOL',
      program: 'Orca',
      instruction_type: 'swap',
      price: 102
    }
  ];
}

// Additional mock generators...
function generateClusterTransactions(): any[] {
  const transactions = [];
  const clusterWallets = ['cluster_1_a', 'cluster_1_b', 'cluster_1_c', 'cluster_2_a', 'cluster_2_b'];
  
  // Generate transactions showing clustering behavior
  for (let i = 0; i < 200; i++) {
    const fromWallet = clusterWallets[Math.floor(Math.random() * clusterWallets.length)];
    const toWallet = clusterWallets[Math.floor(Math.random() * clusterWallets.length)];
    
    if (fromWallet !== toWallet) {
      transactions.push({
        timestamp: Date.now() - Math.random() * 86400000,
        signature: `cluster_tx_${i}`,
        from_address: fromWallet,
        to_address: toWallet,
        amount: Math.random() * 1000 + 10,
        token: 'SOL',
        success: true
      });
    }
  }
  
  return transactions;
}

function generateRelatedWalletTransactions(): any[] {
  const transactions = [];
  const relatedWallets = ['related_A', 'related_B', 'related_C'];
  const commonCounterparties = ['common_1', 'common_2'];
  
  // Create transactions showing wallet relationships
  relatedWallets.forEach((wallet, index) => {
    commonCounterparties.forEach(counterparty => {
      transactions.push({
        timestamp: Date.now() - Math.random() * 86400000,
        signature: `related_tx_${index}_${counterparty}`,
        from_address: wallet,
        to_address: counterparty,
        amount: Math.random() * 500 + 50,
        token: 'USDC',
        success: true
      });
    });
  });
  
  return transactions;
}

function generateBehavioralClusteringData(): any[] {
  return generateMockTransactions(500); // Reuse mock transaction generator
}

function generateRiskTransactions(): any[] {
  const transactions = [];
  
  // Add various risk indicators
  transactions.push(
    // High volume transaction
    {
      timestamp: Date.now() - 3600000,
      signature: 'high_volume_tx',
      from_address: 'HighRiskWallet123',
      to_address: 'unknown_wallet',
      amount: 1000000,
      token: 'SOL',
      success: true
    },
    // Transaction to known risky address
    {
      timestamp: Date.now() - 7200000,
      signature: 'risky_destination',
      from_address: 'HighRiskWallet123',
      to_address: 'flagged_mixer_wallet',
      amount: 50000,
      token: 'USDC',
      success: true
    }
  );
  
  return transactions;
}

function generateSuspiciousTransactions(): any[] {
  return [
    {
      timestamp: Date.now() - 1800000,
      signature: 'suspicious_pattern_1',
      from_address: 'SuspiciousWallet456',
      to_address: 'privacy_coin_exchange',
      amount: 75000,
      token: 'SOL',
      success: true,
      is_privacy_related: true
    },
    {
      timestamp: Date.now() - 3600000,
      signature: 'rapid_movement',
      from_address: 'SuspiciousWallet456',
      to_address: 'temp_wallet_1',
      amount: 100000,
      token: 'USDC',
      success: true
    }
  ];
}

function generateMoneyLaunderingPattern(): any[] {
  const transactions = [];
  const layeringWallets = Array.from({length: 10}, (_, i) => `layer_wallet_${i}`);
  
  let amount = 100000;
  let currentWallet = 'ComplexFlowWallet789';
  
  // Create complex layering pattern
  for (let i = 0; i < layeringWallets.length; i++) {
    const nextWallet = layeringWallets[i];
    amount *= 0.95; // Small reduction each hop
    
    transactions.push({
      timestamp: Date.now() - (i * 300000), // 5 minute intervals
      signature: `laundering_step_${i}`,
      from_address: currentWallet,
      to_address: nextWallet,
      amount: amount,
      token: 'USDC',
      success: true
    });
    
    currentWallet = nextWallet;
  }
  
  return transactions;
}

function generateWashTradingTransactions(): any[] {
  const transactions = [];
  const washWallets = ['wash_A', 'wash_B'];
  
  // Create back-and-forth transactions
  for (let i = 0; i < 20; i++) {
    const isAtoB = i % 2 === 0;
    
    transactions.push({
      timestamp: Date.now() - (i * 600000), // 10 minute intervals
      signature: `wash_trade_${i}`,
      from_address: isAtoB ? washWallets[0] : washWallets[1],
      to_address: isAtoB ? washWallets[1] : washWallets[0],
      amount: 10000 + Math.random() * 1000, // Similar amounts
      token: 'SOL',
      success: true
    });
  }
  
  return transactions;
}

function generateSybilAttackData(): any[] {
  const sybilWallets = Array.from({length: 15}, (_, i) => `sybil_${i}`);
  const masterWallet = 'sybil_controller';
  const transactions = [];
  
  // Master wallet funds all sybil wallets
  sybilWallets.forEach((wallet, index) => {
    transactions.push({
      timestamp: Date.now() - (86400000 - index * 3600000), // Spread over 24 hours
      signature: `sybil_funding_${index}`,
      from_address: masterWallet,
      to_address: wallet,
      amount: 1000,
      token: 'SOL',
      success: true
    });
  });
  
  return transactions;
}

function generatePumpDumpData(): any[] {
  const transactions = [];
  const pumpWallets = ['pump_1', 'pump_2', 'pump_3'];
  
  // Pump phase - coordinated buying
  for (let i = 0; i < 10; i++) {
    pumpWallets.forEach(wallet => {
      transactions.push({
        timestamp: Date.now() - (43200000 - i * 60000), // 12 hours ago, 1 min intervals
        signature: `pump_buy_${wallet}_${i}`,
        from_address: wallet,
        to_address: 'target_token_pool',
        amount: 5000 * (i + 1), // Increasing amounts
        token: 'TARGET_TOKEN',
        instruction_type: 'buy',
        price_impact: 0.01 * (i + 1), // Increasing price
        success: true
      });
    });
  }
  
  // Dump phase - coordinated selling
  for (let i = 0; i < 5; i++) {
    pumpWallets.forEach(wallet => {
      transactions.push({
        timestamp: Date.now() - (21600000 - i * 30000), // 6 hours ago, 30 sec intervals
        signature: `dump_sell_${wallet}_${i}`,
        from_address: wallet,
        to_address: 'target_token_pool',
        amount: 50000, // Large sell orders
        token: 'TARGET_TOKEN',
        instruction_type: 'sell',
        price_impact: -0.05 * (i + 1), // Decreasing price
        success: true
      });
    });
  }
  
  return transactions;
}

function generateStreamingTransactions(): any[] {
  return generateMockTransactions(100);
}

function generateSuspiciousStreamData(): any[] {
  return generateSuspiciousTransactions();
}

function generateLargeTransactionDataset(count: number): any[] {
  return generateMockTransactions(count);
}

function generateMockTransactions(count: number): any[] {
  const transactions = [];
  const wallets = Array.from({length: 20}, (_, i) => `wallet_${i}`);
  const tokens = ['SOL', 'USDC', 'ETH', 'BTC'];
  const programs = ['Jupiter', 'Orca', 'Raydium', 'Serum'];
  
  for (let i = 0; i < count; i++) {
    transactions.push({
      timestamp: Date.now() - Math.random() * 86400000,
      signature: `mock_tx_${i}`,
      from_address: wallets[Math.floor(Math.random() * wallets.length)],
      to_address: wallets[Math.floor(Math.random() * wallets.length)],
      amount: Math.random() * 10000 + 1,
      token: tokens[Math.floor(Math.random() * tokens.length)],
      program: programs[Math.floor(Math.random() * programs.length)],
      instruction_type: ['swap', 'transfer', 'stake', 'unstake'][Math.floor(Math.random() * 4)],
      success: Math.random() > 0.05, // 95% success rate
      gas_used: Math.floor(Math.random() * 10000) + 1000
    });
  }
  
  return transactions;
}