import { aggregateDEXData, detectArbitrageOpportunities } from '../lib/dex-integration';

describe('DEX Integration', () => {
  it('should aggregate DEX data with fallback', async () => {
    const result = await aggregateDEXData();
    
    expect(result).toBeDefined();
    expect(result.prices).toBeDefined();
    expect(result.pools).toBeDefined();
    expect(result.totalLiquidity).toBeGreaterThanOrEqual(0);
    expect(result.totalVolume24h).toBeGreaterThanOrEqual(0);
    expect(result.prices.length).toBeGreaterThan(0);
    expect(result.pools.length).toBeGreaterThan(0);
  });

  it('should detect arbitrage opportunities', () => {
    const mockPrices = [
      {
        mint: 'So11111111111111111111111111111111111111112',
        symbol: 'SOL',
        price: 100,
        priceUsd: 100,
        volume24h: 1000000,
        change24h: 2.5,
        source: 'Jupiter',
        timestamp: Date.now(),
      },
      {
        mint: 'So11111111111111111111111111111111111111112',
        symbol: 'SOL',
        price: 101,
        priceUsd: 101,
        volume24h: 900000,
        change24h: 2.5,
        source: 'Raydium',
        timestamp: Date.now(),
      },
    ];

    const opportunities = detectArbitrageOpportunities(mockPrices);
    
    expect(opportunities).toBeDefined();
    expect(opportunities.length).toBe(1);
    expect(opportunities[0].profitPercentage).toBe(1);
    expect(opportunities[0].buyDEX).toBe('Jupiter');
    expect(opportunities[0].sellDEX).toBe('Raydium');
  });

  it('should handle empty price data gracefully', () => {
    const opportunities = detectArbitrageOpportunities([]);
    
    expect(opportunities).toBeDefined();
    expect(opportunities.length).toBe(0);
  });

  it('should filter out small arbitrage opportunities', () => {
    const mockPrices = [
      {
        mint: 'So11111111111111111111111111111111111111112',
        symbol: 'SOL',
        price: 100,
        priceUsd: 100,
        volume24h: 1000000,
        change24h: 2.5,
        source: 'Jupiter',
        timestamp: Date.now(),
      },
      {
        mint: 'So11111111111111111111111111111111111111112',
        symbol: 'SOL',
        price: 100.1, // Only 0.1% difference
        priceUsd: 100.1,
        volume24h: 900000,
        change24h: 2.5,
        source: 'Raydium',
        timestamp: Date.now(),
      },
    ];

    const opportunities = detectArbitrageOpportunities(mockPrices);
    
    expect(opportunities.length).toBe(0); // Should filter out <0.5% opportunities
  });
});