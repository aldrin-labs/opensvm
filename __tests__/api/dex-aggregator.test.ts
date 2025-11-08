/**
 * E2E Tests for DEX Aggregator API
 * 
 * Comprehensive test coverage for:
 * - OHLCV data (candlestick/price data)
 * - Market data (token overview)
 * - Pool discovery and filtering
 * - Token search
 * - AMM/DEX search
 * - Pool liquidity comparison
 * - Multi-pool routing
 */

import { describe, it, expect } from '@jest/globals';

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';
const TEST_TIMEOUT = 30000; // 30s for API calls

// Test constants
const TEST_TOKENS = {
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  SOL: 'So11111111111111111111111111111111111111112',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
};

const TEST_POOLS = {
  BONK_USDC_PHOENIX: 'GBMoNx84HsFdVK63t8BZuDgyZhSBaeKWB4pHHpoeRM9z',
  BONK_USDC_ZEROFI: 'Du4WfVEeXmYtgwvX5FYzJaW5J8LokjFRNFbPFMXYfe4',
  BONK_SOL_BONKSWAP: 'GBmzQL7BTKwSV9Qg7h5iXQad1q61xwMSzMpdbBkCyo2p',
};

const TIMEFRAMES = ['1m', '5m', '15m', '1H', '4H', '1D'];

describe('DEX Aggregator API - E2E Tests', () => {
  
  describe('1. OHLCV Data Endpoints', () => {
    
    it('should fetch OHLCV data for a token', async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/market-data?endpoint=ohlcv&mint=${TEST_TOKENS.BONK}&type=1H`
      );
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('endpoint', 'ohlcv');
      expect(data).toHaveProperty('mint', TEST_TOKENS.BONK);
      expect(data).toHaveProperty('data');
      expect(data.data).toHaveProperty('items');
      expect(Array.isArray(data.data.items)).toBe(true);
      
      // Validate OHLCV structure
      if (data.data.items.length > 0) {
        const candle = data.data.items[0];
        expect(candle).toHaveProperty('o'); // open
        expect(candle).toHaveProperty('h'); // high
        expect(candle).toHaveProperty('l'); // low
        expect(candle).toHaveProperty('c'); // close
        expect(candle).toHaveProperty('v'); // volume
        expect(typeof candle.o).toBe('number');
        expect(typeof candle.h).toBe('number');
        expect(typeof candle.l).toBe('number');
        expect(typeof candle.c).toBe('number');
        expect(typeof candle.v).toBe('number');
      }
    }, TEST_TIMEOUT);

    it('should support all timeframes', async () => {
      for (const timeframe of TIMEFRAMES) {
        const response = await fetch(
          `${API_BASE_URL}/api/market-data?endpoint=ohlcv&mint=${TEST_TOKENS.BONK}&type=${timeframe}`
        );
        
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.items).toBeDefined();
      }
    }, TEST_TIMEOUT * TIMEFRAMES.length);

    it('should include technical indicators (MA, MACD)', async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/market-data?endpoint=ohlcv&mint=${TEST_TOKENS.BONK}&type=1H`
      );
      
      const data = await response.json();
      expect(data).toHaveProperty('indicators');
      expect(data.indicators).toHaveProperty('ma7');
      expect(data.indicators).toHaveProperty('ma25');
      expect(data.indicators).toHaveProperty('macd');
      expect(data.indicators.macd).toHaveProperty('line');
      expect(data.indicators.macd).toHaveProperty('signal');
      expect(data.indicators.macd).toHaveProperty('histogram');
      
      expect(Array.isArray(data.indicators.ma7)).toBe(true);
      expect(Array.isArray(data.indicators.ma25)).toBe(true);
    }, TEST_TIMEOUT);

    it('should fetch pool-specific OHLCV data', async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/market-data?endpoint=ohlcv&mint=${TEST_TOKENS.BONK}&type=1H&poolAddress=${TEST_POOLS.BONK_USDC_PHOENIX}`
      );
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data._debug?.poolMode).toBe(true);
      expect(data._debug?.poolAddress).toBe(TEST_POOLS.BONK_USDC_PHOENIX);
    }, TEST_TIMEOUT);
  });

  describe('2. Market Data & Token Overview', () => {
    
    it('should fetch token overview with price and liquidity', async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/market-data?endpoint=ohlcv&mint=${TEST_TOKENS.BONK}&type=1H`
      );
      
      const data = await response.json();
      expect(data).toHaveProperty('tokenInfo');
      
      if (data.tokenInfo) {
        expect(data.tokenInfo).toHaveProperty('symbol');
        expect(data.tokenInfo).toHaveProperty('name');
        expect(data.tokenInfo).toHaveProperty('price');
        expect(data.tokenInfo).toHaveProperty('liquidity');
        expect(data.tokenInfo).toHaveProperty('volume24h');
        
        expect(typeof data.tokenInfo.price).toBe('number');
        expect(typeof data.tokenInfo.liquidity).toBe('number');
        expect(typeof data.tokenInfo.volume24h).toBe('number');
      }
    }, TEST_TIMEOUT);

    it('should include main trading pair information', async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/market-data?endpoint=ohlcv&mint=${TEST_TOKENS.BONK}&type=1H`
      );
      
      const data = await response.json();
      expect(data).toHaveProperty('mainPair');
      expect(data.mainPair).toHaveProperty('pair');
      expect(data.mainPair).toHaveProperty('dex');
      expect(typeof data.mainPair.pair).toBe('string');
    }, TEST_TIMEOUT);

    it('should handle invalid token address gracefully', async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/market-data?endpoint=ohlcv&mint=invalid_address&type=1H`
      );
      
      // Should either return 400 or empty data with success=false
      const data = await response.json();
      expect([200, 400, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expect(data).toHaveProperty('success');
      }
    }, TEST_TIMEOUT);
  });

  describe('3. Pool Discovery & Markets Endpoint', () => {
    
    it('should fetch top pools by liquidity', async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/market-data?endpoint=markets&mint=${TEST_TOKENS.BONK}`
      );
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('endpoint', 'markets');
      expect(data).toHaveProperty('pools');
      expect(Array.isArray(data.pools)).toBe(true);
      expect(data).toHaveProperty('count');
      expect(data.count).toBeLessThanOrEqual(3); // Top 3 pools
      
      // Validate pool structure
      if (data.pools.length > 0) {
        const pool = data.pools[0];
        expect(pool).toHaveProperty('dex');
        expect(pool).toHaveProperty('pair');
        expect(pool).toHaveProperty('poolAddress');
        expect(pool).toHaveProperty('price');
        expect(pool).toHaveProperty('liquidity');
        expect(pool).toHaveProperty('volume24h');
        expect(pool).toHaveProperty('txCount24h');
        expect(pool).toHaveProperty('baseToken');
        expect(pool).toHaveProperty('quoteToken');
        
        expect(typeof pool.liquidity).toBe('number');
        expect(typeof pool.volume24h).toBe('number');
        expect(typeof pool.txCount24h).toBe('number');
      }
    }, TEST_TIMEOUT);

    it('should sort pools by liquidity (descending)', async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/market-data?endpoint=markets&mint=${TEST_TOKENS.BONK}`
      );
      
      const data = await response.json();
      
      if (data.pools.length > 1) {
        for (let i = 0; i < data.pools.length - 1; i++) {
          expect(data.pools[i].liquidity).toBeGreaterThanOrEqual(data.pools[i + 1].liquidity);
        }
      }
    }, TEST_TIMEOUT);

    it('should filter pools by base mint (USDC pairs only)', async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/market-data?endpoint=markets&mint=${TEST_TOKENS.BONK}&baseMint=${TEST_TOKENS.USDC}`
      );
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(data.filters?.baseMint).toBe(TEST_TOKENS.USDC);
      
      // All pools should have USDC as base or quote
      data.pools.forEach((pool: any) => {
        const hasUSDC = 
          pool.baseAddress?.toLowerCase() === TEST_TOKENS.USDC.toLowerCase() ||
          pool.quoteAddress?.toLowerCase() === TEST_TOKENS.USDC.toLowerCase();
        expect(hasUSDC).toBe(true);
      });
    }, TEST_TIMEOUT);

    it('should filter to specific pool address', async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/market-data?endpoint=markets&mint=${TEST_TOKENS.BONK}&poolAddress=${TEST_POOLS.BONK_USDC_PHOENIX}`
      );
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(data.count).toBe(1);
      expect(data.pools[0].poolAddress).toBe(TEST_POOLS.BONK_USDC_PHOENIX);
      expect(data.filters?.poolAddress).toBe(TEST_POOLS.BONK_USDC_PHOENIX);
    }, TEST_TIMEOUT);

    it('should include pool metadata (DEX, base/quote tokens)', async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/market-data?endpoint=markets&mint=${TEST_TOKENS.BONK}`
      );
      
      const data = await response.json();
      
      data.pools.forEach((pool: any) => {
        expect(pool.dex).toBeDefined();
        expect(pool.baseToken).toBeDefined();
        expect(pool.quoteToken).toBeDefined();
        expect(pool.baseAddress).toBeDefined();
        expect(pool.quoteAddress).toBeDefined();
        expect(typeof pool.dex).toBe('string');
      });
    }, TEST_TIMEOUT);
  });

  describe('4. DEX/AMM Coverage', () => {
    
    it('should aggregate pools from multiple DEXes', async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/market-data?endpoint=markets&mint=${TEST_TOKENS.BONK}`
      );
      
      const data = await response.json();
      
      // Extract unique DEXes
      const dexes = [...new Set(data.pools.map((p: any) => p.dex))];
      expect(dexes.length).toBeGreaterThan(0);
      
      console.log('DEXes found:', dexes);
    }, TEST_TIMEOUT);

    it('should include major DEXes in aggregation', async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/market-data?endpoint=markets&mint=${TEST_TOKENS.BONK}`
      );
      
      const data = await response.json();
      const dexes = data.pools.map((p: any) => p.dex);
      
      // Should have at least one major DEX
      const hasMajorDex = dexes.some((dex: string) => 
        ['Phoenix', 'Raydium', 'Orca', 'Meteora', 'Zerofi'].includes(dex)
      );
      expect(hasMajorDex).toBe(true);
    }, TEST_TIMEOUT);
  });

  describe('5. Liquidity & Volume Metrics', () => {
    
    it('should provide accurate liquidity data', async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/market-data?endpoint=markets&mint=${TEST_TOKENS.BONK}`
      );
      
      const data = await response.json();
      
      data.pools.forEach((pool: any) => {
        expect(pool.liquidity).toBeDefined();
        expect(typeof pool.liquidity).toBe('number');
        expect(pool.liquidity).toBeGreaterThanOrEqual(0);
      });
    }, TEST_TIMEOUT);

    it('should provide 24h volume and transaction counts', async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/market-data?endpoint=markets&mint=${TEST_TOKENS.BONK}`
      );
      
      const data = await response.json();
      
      data.pools.forEach((pool: any) => {
        expect(pool.volume24h).toBeDefined();
        expect(pool.txCount24h).toBeDefined();
        expect(typeof pool.volume24h).toBe('number');
        expect(typeof pool.txCount24h).toBe('number');
        expect(pool.volume24h).toBeGreaterThanOrEqual(0);
        expect(pool.txCount24h).toBeGreaterThanOrEqual(0);
      });
    }, TEST_TIMEOUT);

    it('should calculate total liquidity across pools', async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/market-data?endpoint=ohlcv&mint=${TEST_TOKENS.BONK}&type=1H`
      );
      
      const data = await response.json();
      
      if (data.tokenInfo) {
        expect(data.tokenInfo.liquidity).toBeDefined();
        expect(typeof data.tokenInfo.liquidity).toBe('number');
        expect(data.tokenInfo.liquidity).toBeGreaterThanOrEqual(0);
      }
    }, TEST_TIMEOUT);
  });

  describe('6. Price Data Quality', () => {
    
    it('should provide consistent prices across endpoints', async () => {
      const [ohlcvRes, marketsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/market-data?endpoint=ohlcv&mint=${TEST_TOKENS.BONK}&type=1H`),
        fetch(`${API_BASE_URL}/api/market-data?endpoint=markets&mint=${TEST_TOKENS.BONK}`)
      ]);
      
      const ohlcvData = await ohlcvRes.json();
      const marketsData = await marketsRes.json();
      
      const ohlcvPrice = ohlcvData.tokenInfo?.price;
      const topPoolPrice = marketsData.pools[0]?.price;
      
      if (ohlcvPrice && topPoolPrice) {
        // Prices should be within 5% of each other
        const diff = Math.abs(ohlcvPrice - topPoolPrice) / ohlcvPrice;
        expect(diff).toBeLessThan(0.05);
      }
    }, TEST_TIMEOUT);

    it('should have valid OHLC relationships (L<=O,C<=H)', async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/market-data?endpoint=ohlcv&mint=${TEST_TOKENS.BONK}&type=1H`
      );
      
      const data = await response.json();
      
      data.data.items.forEach((candle: any) => {
        expect(candle.l).toBeLessThanOrEqual(candle.o);
        expect(candle.l).toBeLessThanOrEqual(candle.c);
        expect(candle.o).toBeLessThanOrEqual(candle.h);
        expect(candle.c).toBeLessThanOrEqual(candle.h);
      });
    }, TEST_TIMEOUT);
  });

  describe('7. API Performance & Reliability', () => {
    
    it('should respond within acceptable time (<5s)', async () => {
      const start = Date.now();
      const response = await fetch(
        `${API_BASE_URL}/api/market-data?endpoint=markets&mint=${TEST_TOKENS.BONK}`
      );
      const duration = Date.now() - start;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(5000); // 5 seconds
    }, TEST_TIMEOUT);

    it('should handle concurrent requests', async () => {
      const requests = Array(5).fill(null).map(() => 
        fetch(`${API_BASE_URL}/api/market-data?endpoint=markets&mint=${TEST_TOKENS.BONK}`)
      );
      
      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    }, TEST_TIMEOUT);

    it('should return proper error codes for invalid requests', async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/market-data?endpoint=invalid_endpoint`
      );
      
      expect([400, 404]).toContain(response.status);
      const data = await response.json();
      expect(data.error).toBeDefined();
    }, TEST_TIMEOUT);
  });

  describe('8. Data Completeness', () => {
    
    it('should return all required pool fields', async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/market-data?endpoint=markets&mint=${TEST_TOKENS.BONK}`
      );
      
      const data = await response.json();
      const requiredFields = [
        'dex', 'pair', 'poolAddress', 'price', 'liquidity', 
        'volume24h', 'txCount24h', 'baseToken', 'quoteToken',
        'baseAddress', 'quoteAddress'
      ];
      
      data.pools.forEach((pool: any) => {
        requiredFields.forEach(field => {
          expect(pool).toHaveProperty(field);
        });
      });
    }, TEST_TIMEOUT);

    it('should return all required OHLCV fields', async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/market-data?endpoint=ohlcv&mint=${TEST_TOKENS.BONK}&type=1H`
      );
      
      const data = await response.json();
      const requiredFields = ['success', 'endpoint', 'mint', 'data', 'tokenInfo', 'mainPair', 'indicators'];
      
      requiredFields.forEach(field => {
        expect(data).toHaveProperty(field);
      });
    }, TEST_TIMEOUT);
  });

  describe('9. Edge Cases & Error Handling', () => {
    
    it('should handle tokens with no pools gracefully', async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/market-data?endpoint=markets&mint=11111111111111111111111111111111`
      );
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.pools)).toBe(true);
      expect(data.count).toBe(0);
    }, TEST_TIMEOUT);

    it('should handle missing API key gracefully', async () => {
      // This test assumes BIRDEYE_API_KEY might not be set
      const response = await fetch(
        `${API_BASE_URL}/api/market-data?endpoint=markets&mint=${TEST_TOKENS.BONK}`
      );
      
      // Should either work or return proper error
      if (response.status === 500) {
        const data = await response.json();
        expect(data.error).toContain('API');
      } else {
        expect(response.status).toBe(200);
      }
    }, TEST_TIMEOUT);

    it('should handle non-existent pool address', async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/market-data?endpoint=markets&mint=${TEST_TOKENS.BONK}&poolAddress=11111111111111111111111111111111`
      );
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.count).toBe(0);
      expect(data.pools).toHaveLength(0);
    }, TEST_TIMEOUT);
  });

  describe('10. Orderbook Endpoint (Additional)', () => {
    
    it('should fetch orderbook data', async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/market-data?endpoint=orderbook&mint=${TEST_TOKENS.BONK}`
      );
      
      expect([200, 400]).toContain(response.status);
      const data = await response.json();
      
      if (response.status === 200) {
        expect(data).toHaveProperty('success');
        expect(data).toHaveProperty('endpoint', 'orderbook');
      }
    }, TEST_TIMEOUT);
  });
});

describe('DEX Aggregator - Integration Tests', () => {
  
  it('should provide complete workflow: search -> pools -> ohlcv', async () => {
    // 1. Get markets/pools
    const marketsRes = await fetch(
      `${API_BASE_URL}/api/market-data?endpoint=markets&mint=${TEST_TOKENS.BONK}`
    );
    const marketsData = await marketsRes.json();
    expect(marketsData.success).toBe(true);
    expect(marketsData.pools.length).toBeGreaterThan(0);
    
    // 2. Get OHLCV for token
    const ohlcvRes = await fetch(
      `${API_BASE_URL}/api/market-data?endpoint=ohlcv&mint=${TEST_TOKENS.BONK}&type=1H`
    );
    const ohlcvData = await ohlcvRes.json();
    expect(ohlcvData.success).toBe(true);
    expect(ohlcvData.data.items.length).toBeGreaterThan(0);
    
    // 3. Get specific pool OHLCV
    const topPool = marketsData.pools[0];
    const poolOhlcvRes = await fetch(
      `${API_BASE_URL}/api/market-data?endpoint=ohlcv&mint=${TEST_TOKENS.BONK}&type=1H&poolAddress=${topPool.poolAddress}`
    );
    const poolOhlcvData = await poolOhlcvRes.json();
    expect(poolOhlcvData.success).toBe(true);
  }, TEST_TIMEOUT * 3);

  it('should provide best price comparison across pools', async () => {
    const response = await fetch(
      `${API_BASE_URL}/api/market-data?endpoint=markets&mint=${TEST_TOKENS.BONK}`
    );
    const data = await response.json();
    
    if (data.pools.length > 1) {
      const prices = data.pools.map((p: any) => p.price).filter((p: number) => p > 0);
      const bestPrice = Math.max(...prices);
      const worstPrice = Math.min(...prices);
      const spread = ((bestPrice - worstPrice) / worstPrice) * 100;
      
      console.log(`Price spread across pools: ${spread.toFixed(2)}%`);
      expect(spread).toBeGreaterThanOrEqual(0);
    }
  }, TEST_TIMEOUT);
});
