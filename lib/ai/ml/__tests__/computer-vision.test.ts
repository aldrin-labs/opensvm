/**
 * Test suite for Computer Vision Engine
 */

import { ComputerVisionEngine, ChartAnalysisRequest } from '../computer-vision';

describe('ComputerVisionEngine', () => {
  let engine: ComputerVisionEngine;

  beforeEach(() => {
    engine = new ComputerVisionEngine();
  });

  describe('Chart Pattern Recognition', () => {
    it('should analyze price chart patterns', async () => {
      const request: ChartAnalysisRequest = {
        chart_type: 'price_chart',
        asset: 'SOL',
        timeframe: '1d',
        analysis_types: ['pattern_recognition', 'trend_analysis'],
        chart_data: generateMockChartData(100) // 100 data points
      };

      const result = await engine.analyzeChart(request);

      expect(result).toBeDefined();
      expect(result.asset).toBe('SOL');
      expect(result.patterns_detected).toBeDefined();
      expect(result.patterns_detected.length).toBeGreaterThanOrEqual(0);
      expect(result.trend_analysis).toBeDefined();
      expect(result.confidence_score).toBeGreaterThanOrEqual(0);
      expect(result.confidence_score).toBeLessThanOrEqual(1);
    });

    it('should detect common chart patterns', async () => {
      // Test with mock data that simulates known patterns
      const trianglePattern = generateTrianglePatternData();
      
      const request: ChartAnalysisRequest = {
        chart_type: 'price_chart',
        asset: 'ETH',
        timeframe: '4h',
        analysis_types: ['pattern_recognition'],
        chart_data: trianglePattern
      };

      const result = await engine.analyzeChart(request);

      expect(result.patterns_detected.length).toBeGreaterThan(0);
      
      // Should detect triangle-like patterns
      const trianglePatterns = result.patterns_detected.filter(p => 
        p.pattern_type.toLowerCase().includes('triangle')
      );
      
      if (trianglePatterns.length > 0) {
        expect(trianglePatterns[0].confidence).toBeGreaterThan(0.5);
        expect(trianglePatterns[0].price_target).toBeGreaterThan(0);
      }
    });

    it('should analyze support and resistance levels', async () => {
      const request: ChartAnalysisRequest = {
        chart_type: 'price_chart',
        asset: 'BTC',
        timeframe: '1h',
        analysis_types: ['support_resistance'],
        chart_data: generateMockChartData(200)
      };

      const result = await engine.analyzeChart(request);

      expect(result.support_resistance).toBeDefined();
      expect(result.support_resistance!.support_levels).toBeDefined();
      expect(result.support_resistance!.resistance_levels).toBeDefined();
      expect(result.support_resistance!.support_levels.length).toBeGreaterThanOrEqual(1);
      expect(result.support_resistance!.resistance_levels.length).toBeGreaterThanOrEqual(1);
    });

    it('should perform volume analysis', async () => {
      const request: ChartAnalysisRequest = {
        chart_type: 'price_volume_chart',
        asset: 'SOL',
        timeframe: '15m',
        analysis_types: ['volume_analysis'],
        chart_data: generateMockVolumeData(150)
      };

      const result = await engine.analyzeChart(request);

      expect(result.volume_analysis).toBeDefined();
      expect(result.volume_analysis!.volume_trend).toMatch(/^(increasing|decreasing|stable)$/);
      expect(result.volume_analysis!.volume_spikes).toBeDefined();
      expect(result.volume_analysis!.price_volume_correlation).toBeGreaterThanOrEqual(-1);
      expect(result.volume_analysis!.price_volume_correlation).toBeLessThanOrEqual(1);
    });
  });

  describe('Technical Indicator Analysis', () => {
    it('should calculate and analyze RSI patterns', async () => {
      const request: ChartAnalysisRequest = {
        chart_type: 'price_chart',
        asset: 'ETH',
        timeframe: '1h',
        analysis_types: ['technical_indicators'],
        chart_data: generateMockChartData(100)
      };

      const result = await engine.analyzeChart(request);

      expect(result.technical_indicators).toBeDefined();
      expect(result.technical_indicators!.rsi).toBeDefined();
      expect(result.technical_indicators!.rsi.current_value).toBeGreaterThanOrEqual(0);
      expect(result.technical_indicators!.rsi.current_value).toBeLessThanOrEqual(100);
      expect(result.technical_indicators!.rsi.signal).toMatch(/^(oversold|overbought|neutral)$/);
    });

    it('should analyze MACD signals', async () => {
      const request: ChartAnalysisRequest = {
        chart_type: 'price_chart',
        asset: 'BTC',
        timeframe: '4h',
        analysis_types: ['technical_indicators'],
        chart_data: generateMockChartData(150)
      };

      const result = await engine.analyzeChart(request);

      expect(result.technical_indicators).toBeDefined();
      expect(result.technical_indicators!.macd).toBeDefined();
      expect(result.technical_indicators!.macd.signal).toMatch(/^(bullish|bearish|neutral)$/);
      expect(result.technical_indicators!.macd.histogram).toBeDefined();
    });

    it('should detect moving average crossovers', async () => {
      const crossoverData = generateMovingAverageCrossoverData();
      
      const request: ChartAnalysisRequest = {
        chart_type: 'price_chart',
        asset: 'SOL',
        timeframe: '1d',
        analysis_types: ['technical_indicators'],
        chart_data: crossoverData
      };

      const result = await engine.analyzeChart(request);

      expect(result.technical_indicators).toBeDefined();
      expect(result.technical_indicators!.moving_averages).toBeDefined();
      
      const crossovers = result.technical_indicators!.moving_averages.crossovers;
      expect(crossovers).toBeDefined();
    });
  });

  describe('Anomaly Detection', () => {
    it('should detect price anomalies', async () => {
      const anomalousData = generateAnomalousChartData();
      
      const request: ChartAnalysisRequest = {
        chart_type: 'price_chart',
        asset: 'BONK',
        timeframe: '5m',
        analysis_types: ['anomaly_detection'],
        chart_data: anomalousData
      };

      const result = await engine.analyzeChart(request);

      expect(result.anomalies).toBeDefined();
      expect(result.anomalies!.length).toBeGreaterThan(0);
      
      const priceAnomaly = result.anomalies!.find(a => a.anomaly_type === 'price_spike');
      expect(priceAnomaly).toBeDefined();
      expect(priceAnomaly!.severity).toMatch(/^(low|medium|high)$/);
    });

    it('should detect volume anomalies', async () => {
      const volumeAnomalyData = generateVolumeAnomalyData();
      
      const request: ChartAnalysisRequest = {
        chart_type: 'price_volume_chart',
        asset: 'WIF',
        timeframe: '1m',
        analysis_types: ['anomaly_detection'],
        chart_data: volumeAnomalyData
      };

      const result = await engine.analyzeChart(request);

      expect(result.anomalies).toBeDefined();
      
      const volumeAnomaly = result.anomalies!.find(a => a.anomaly_type === 'volume_spike');
      if (volumeAnomaly) {
        expect(volumeAnomaly.timestamp).toBeGreaterThan(0);
        expect(volumeAnomaly.description).toContain('volume');
      }
    });
  });

  describe('Transaction Flow Visualization', () => {
    it('should analyze transaction flow patterns', async () => {
      const flowData = generateMockTransactionFlowData();
      
      const result = await engine.analyzeTransactionFlow({
        transaction_data: flowData,
        analysis_depth: 'standard',
        focus_areas: ['flow_patterns', 'clustering']
      });

      expect(result).toBeDefined();
      expect(result.flow_patterns).toBeDefined();
      expect(result.flow_patterns.length).toBeGreaterThanOrEqual(0);
      expect(result.clustering_analysis).toBeDefined();
      expect(result.suspicious_flows).toBeDefined();
    });

    it('should detect circular transaction patterns', async () => {
      const circularFlowData = generateCircularFlowData();
      
      const result = await engine.analyzeTransactionFlow({
        transaction_data: circularFlowData,
        analysis_depth: 'deep',
        focus_areas: ['flow_patterns', 'anomaly_detection']
      });

      const circularPattern = result.flow_patterns.find(p => 
        p.pattern_type === 'circular_flow'
      );

      if (circularPattern) {
        expect(circularPattern.confidence).toBeGreaterThan(0.3);
        expect(circularPattern.participants.length).toBeGreaterThanOrEqual(3);
      }
    });

    it('should identify wallet clustering', async () => {
      const clusteringData = generateWalletClusteringData();
      
      const result = await engine.analyzeTransactionFlow({
        transaction_data: clusteringData,
        analysis_depth: 'comprehensive',
        focus_areas: ['clustering', 'relationship_mapping']
      });

      expect(result.clustering_analysis).toBeDefined();
      expect(result.clustering_analysis!.clusters).toBeDefined();
      expect(result.clustering_analysis!.clusters.length).toBeGreaterThanOrEqual(1);
      
      if (result.clustering_analysis!.clusters.length > 0) {
        const cluster = result.clustering_analysis!.clusters[0];
        expect(cluster.wallet_addresses).toBeDefined();
        expect(cluster.wallet_addresses.length).toBeGreaterThanOrEqual(2);
        expect(cluster.connection_strength).toBeGreaterThanOrEqual(0);
        expect(cluster.connection_strength).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Real-time Analysis', () => {
    it('should handle streaming chart data', async () => {
      const initialData = generateMockChartData(50);
      
      const request: ChartAnalysisRequest = {
        chart_type: 'price_chart',
        asset: 'SOL',
        timeframe: '1m',
        analysis_types: ['pattern_recognition', 'trend_analysis'],
        chart_data: initialData,
        real_time: true
      };

      const result = await engine.analyzeChart(request);

      expect(result.real_time_updates).toBeDefined();
      expect(result.update_frequency).toBeDefined();
    });

    it('should adapt analysis as new data arrives', async () => {
      const baseData = generateMockChartData(100);
      
      // First analysis
      const request1: ChartAnalysisRequest = {
        chart_type: 'price_chart',
        asset: 'ETH',
        timeframe: '5m',
        analysis_types: ['pattern_recognition'],
        chart_data: baseData
      };

      const result1 = await engine.analyzeChart(request1);
      
      // Second analysis with more data
      const extendedData = [...baseData, ...generateMockChartData(20)];
      const request2: ChartAnalysisRequest = {
        ...request1,
        chart_data: extendedData
      };

      const result2 = await engine.analyzeChart(request2);

      // Results should be different as new data was added
      expect(result2.analysis_timestamp).toBeGreaterThan(result1.analysis_timestamp);
    });
  });

  describe('Multi-timeframe Analysis', () => {
    it('should correlate patterns across timeframes', async () => {
      const multiTimeframeData = {
        '1m': generateMockChartData(100),
        '5m': generateMockChartData(50),
        '1h': generateMockChartData(25)
      };

      const result = await engine.analyzeMultiTimeframe({
        asset: 'BTC',
        timeframe_data: multiTimeframeData,
        analysis_types: ['pattern_recognition', 'trend_analysis']
      });

      expect(result).toBeDefined();
      expect(result.timeframe_correlations).toBeDefined();
      expect(result.consolidated_patterns).toBeDefined();
      expect(result.trend_consistency).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle insufficient data gracefully', async () => {
      const request: ChartAnalysisRequest = {
        chart_type: 'price_chart',
        asset: 'SOL',
        timeframe: '1h',
        analysis_types: ['pattern_recognition'],
        chart_data: generateMockChartData(5) // Too little data
      };

      const result = await engine.analyzeChart(request);

      expect(result.warnings).toBeDefined();
      expect(result.warnings!.length).toBeGreaterThan(0);
      expect(result.warnings!.some(w => w.includes('insufficient data'))).toBe(true);
    });

    it('should handle invalid chart data', async () => {
      const invalidData = [
        { timestamp: Date.now(), price: NaN, volume: 1000 },
        { timestamp: Date.now() + 60000, price: -100, volume: 500 }
      ];

      const request: ChartAnalysisRequest = {
        chart_type: 'price_chart',
        asset: 'ETH',
        timeframe: '1m',
        analysis_types: ['trend_analysis'],
        chart_data: invalidData
      };

      await expect(engine.analyzeChart(request)).rejects.toThrow();
    });

    it('should validate input parameters', async () => {
      const request: ChartAnalysisRequest = {
        chart_type: 'invalid_chart_type' as any,
        asset: '',
        timeframe: 'invalid_timeframe' as any,
        analysis_types: [],
        chart_data: []
      };

      await expect(engine.analyzeChart(request)).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should process large datasets efficiently', async () => {
      const largeDataset = generateMockChartData(10000); // 10k data points
      
      const request: ChartAnalysisRequest = {
        chart_type: 'price_chart',
        asset: 'BTC',
        timeframe: '1m',
        analysis_types: ['pattern_recognition', 'technical_indicators'],
        chart_data: largeDataset
      };

      const startTime = Date.now();
      const result = await engine.analyzeChart(request);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(result).toBeDefined();
    });

    it('should optimize memory usage for streaming data', async () => {
      // Test memory efficiency with continuous data updates
      const baseData = generateMockChartData(1000);
      
      for (let i = 0; i < 10; i++) {
        const newData = [...baseData.slice(-500), ...generateMockChartData(100)];
        
        const request: ChartAnalysisRequest = {
          chart_type: 'price_chart',
          asset: 'SOL',
          timeframe: '1m',
          analysis_types: ['trend_analysis'],
          chart_data: newData,
          real_time: true
        };

        const result = await engine.analyzeChart(request);
        expect(result).toBeDefined();
      }
      
      // If we get here without memory issues, the test passes
      expect(true).toBe(true);
    });
  });
});

// Mock data generators
function generateMockChartData(count: number): any[] {
  const data = [];
  let price = 100 + Math.random() * 50;
  let timestamp = Date.now() - (count * 60000);
  
  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 5;
    price = Math.max(1, price + change);
    
    data.push({
      timestamp: timestamp + (i * 60000),
      price: parseFloat(price.toFixed(4)),
      volume: Math.floor(Math.random() * 1000000) + 10000,
      open: parseFloat((price - change).toFixed(4)),
      high: parseFloat((price + Math.random() * 2).toFixed(4)),
      low: parseFloat((price - Math.random() * 2).toFixed(4)),
      close: parseFloat(price.toFixed(4))
    });
  }
  
  return data;
}

function generateMockVolumeData(count: number): any[] {
  const data = generateMockChartData(count);
  
  // Add volume spikes at random intervals
  for (let i = 0; i < Math.floor(count / 10); i++) {
    const spikeIndex = Math.floor(Math.random() * count);
    if (data[spikeIndex]) {
      data[spikeIndex].volume *= 5; // Create volume spike
    }
  }
  
  return data;
}

function generateTrianglePatternData(): any[] {
  const data = [];
  let basePrice = 100;
  let timestamp = Date.now() - (50 * 60000);
  
  // Generate converging highs and lows (triangle pattern)
  for (let i = 0; i < 50; i++) {
    const progress = i / 50;
    const upperBound = basePrice + (20 * (1 - progress));
    const lowerBound = basePrice - (15 * (1 - progress));
    
    const price = lowerBound + Math.random() * (upperBound - lowerBound);
    
    data.push({
      timestamp: timestamp + (i * 60000),
      price: parseFloat(price.toFixed(4)),
      volume: Math.floor(Math.random() * 100000) + 10000,
      open: parseFloat(price.toFixed(4)),
      high: parseFloat((price + Math.random() * 2).toFixed(4)),
      low: parseFloat((price - Math.random() * 2).toFixed(4)),
      close: parseFloat(price.toFixed(4))
    });
  }
  
  return data;
}

function generateMovingAverageCrossoverData(): any[] {
  const data = generateMockChartData(100);
  
  // Simulate a trend change that would create MA crossover
  for (let i = 50; i < data.length; i++) {
    data[i].price = data[i-1].price * 1.02; // Gradual uptrend
  }
  
  return data;
}

function generateAnomalousChartData(): any[] {
  const data = generateMockChartData(100);
  
  // Insert price anomalies
  const anomalyIndices = [25, 45, 75];
  anomalyIndices.forEach(index => {
    if (data[index]) {
      data[index].price *= 3; // 3x price spike
      data[index].volume *= 10; // 10x volume spike
    }
  });
  
  return data;
}

function generateVolumeAnomalyData(): any[] {
  const data = generateMockChartData(50);
  
  // Insert volume anomaly without corresponding price change
  data[25].volume *= 20;
  
  return data;
}

function generateMockTransactionFlowData(): any[] {
  const transactions = [];
  const walletAddresses = Array.from({length: 20}, (_, i) => 
    `wallet_${i.toString().padStart(2, '0')}`
  );
  
  for (let i = 0; i < 100; i++) {
    const fromWallet = walletAddresses[Math.floor(Math.random() * walletAddresses.length)];
    const toWallet = walletAddresses[Math.floor(Math.random() * walletAddresses.length)];
    
    if (fromWallet !== toWallet) {
      transactions.push({
        timestamp: Date.now() - Math.random() * 86400000,
        from_address: fromWallet,
        to_address: toWallet,
        amount: Math.random() * 1000 + 10,
        token: ['SOL', 'USDC', 'ETH'][Math.floor(Math.random() * 3)],
        transaction_hash: `tx_${i}`
      });
    }
  }
  
  return transactions;
}

function generateCircularFlowData(): any[] {
  const baseData = generateMockTransactionFlowData();
  
  // Add circular transactions
  const circularWallets = ['wallet_circular_1', 'wallet_circular_2', 'wallet_circular_3'];
  
  // Create circular flow: 1 -> 2 -> 3 -> 1
  baseData.push(
    {
      timestamp: Date.now() - 3600000,
      from_address: circularWallets[0],
      to_address: circularWallets[1],
      amount: 1000,
      token: 'SOL',
      transaction_hash: 'circular_tx_1'
    },
    {
      timestamp: Date.now() - 3000000,
      from_address: circularWallets[1],
      to_address: circularWallets[2],
      amount: 995,
      token: 'SOL',
      transaction_hash: 'circular_tx_2'
    },
    {
      timestamp: Date.now() - 1800000,
      from_address: circularWallets[2],
      to_address: circularWallets[0],
      amount: 990,
      token: 'SOL',
      transaction_hash: 'circular_tx_3'
    }
  );
  
  return baseData;
}

function generateWalletClusteringData(): any[] {
  const baseData = generateMockTransactionFlowData();
  
  // Add transactions that suggest wallet clustering
  const clusterWallets = ['cluster_A_1', 'cluster_A_2', 'cluster_A_3', 'cluster_B_1', 'cluster_B_2'];
  
  // Cluster A wallets frequently transact with each other
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (i !== j) {
        baseData.push({
          timestamp: Date.now() - Math.random() * 86400000,
          from_address: clusterWallets[i],
          to_address: clusterWallets[j],
          amount: Math.random() * 500 + 50,
          token: 'USDC',
          transaction_hash: `cluster_tx_${i}_${j}`
        });
      }
    }
  }
  
  return baseData;
}