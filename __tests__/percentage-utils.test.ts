import { describe, test, expect } from '@jest/globals';
import {
  formatPercent,
  calculateNormalizedMarketShares,
  validatePercentageSum,
  calculatePercentageChange,
  clampPercentage
} from '@/lib/utils/percentage-utils';

describe('Percentage Utils', () => {
  describe('formatPercent', () => {
    test('formats decimal values correctly', () => {
      expect(formatPercent(0.5)).toBe('50.00%');
      expect(formatPercent(0.123)).toBe('12.30%');
      expect(formatPercent(1.0)).toBe('100.00%');
    });

    test('formats percentage values correctly when flagged', () => {
      expect(formatPercent(50, true)).toBe('50.00%');
      expect(formatPercent(12.3, true)).toBe('12.30%');
      expect(formatPercent(100, true)).toBe('100.00%');
    });

    test('clamps values to reasonable bounds', () => {
      expect(formatPercent(1.5)).toBe('100.00%'); // Clamped to 100%
      expect(formatPercent(150, true)).toBe('100.00%'); // Already percentage, clamped
      expect(formatPercent(-0.5)).toBe('-50.00%');
      expect(formatPercent(-200, true)).toBe('-100.00%'); // Clamped to -100%
    });

    test('handles null and undefined values', () => {
      expect(formatPercent(null)).toBe('0.00%');
      expect(formatPercent(undefined)).toBe('0.00%');
      expect(formatPercent(NaN)).toBe('0.00%');
    });

    test('respects custom formatting options', () => {
      expect(formatPercent(0.123, false, { decimals: 1 })).toBe('12.3%');
      expect(formatPercent(0.123, false, { showSign: true })).toBe('+12.30%');
      expect(formatPercent(0.123, false, { clampMax: 10 })).toBe('10.00%');
    });
  });

  describe('calculateNormalizedMarketShares', () => {
    test('calculates market shares correctly', () => {
      const items = [
        { name: 'A', volume: 100 },
        { name: 'B', volume: 200 },
        { name: 'C', volume: 300 }
      ];

      const result = calculateNormalizedMarketShares(items, 'volume');
      
      expect(result[0].marketShare).toBeCloseTo(100/600); // 16.67%
      expect(result[1].marketShare).toBeCloseTo(200/600); // 33.33%
      expect(result[2].marketShare).toBeCloseTo(300/600); // 50%
    });

    test('normalizes market shares to sum to 1.0', () => {
      const items = [
        { name: 'A', volume: 1 },
        { name: 'B', volume: 1 },
        { name: 'C', volume: 1 }
      ];

      const result = calculateNormalizedMarketShares(items, 'volume');
      const totalMarketShare = result.reduce((sum, item) => sum + item.marketShare, 0);
      
      expect(totalMarketShare).toBeCloseTo(1.0, 10); // Very close to 1.0
    });

    test('handles zero total volume', () => {
      const items = [
        { name: 'A', volume: 0 },
        { name: 'B', volume: 0 }
      ];

      const result = calculateNormalizedMarketShares(items, 'volume');
      
      expect(result[0].marketShare).toBe(0);
      expect(result[1].marketShare).toBe(0);
    });

    test('handles empty array', () => {
      const result = calculateNormalizedMarketShares([], 'volume');
      expect(result).toEqual([]);
    });
  });

  describe('validatePercentageSum', () => {
    test('validates correct percentage sums', () => {
      const result = validatePercentageSum([25, 25, 25, 25]);
      expect(result.isValid).toBe(true);
      expect(result.actualSum).toBe(100);
      expect(result.deviation).toBe(0);
    });

    test('detects invalid percentage sums', () => {
      const result = validatePercentageSum([30, 30, 30, 30]);
      expect(result.isValid).toBe(false);
      expect(result.actualSum).toBe(120);
      expect(result.deviation).toBe(20);
    });

    test('allows small deviations within tolerance', () => {
      const result = validatePercentageSum([33.33, 33.33, 33.34]);
      expect(result.isValid).toBe(true); // 100.00% within 0.1% tolerance
    });

    test('respects custom tolerance', () => {
      const result = validatePercentageSum([33, 33, 33], 0.5); // 99% with 0.5% tolerance
      expect(result.isValid).toBe(false); // 1% deviation > 0.5% tolerance
    });
  });

  describe('calculatePercentageChange', () => {
    test('calculates positive percentage change', () => {
      expect(calculatePercentageChange(120, 100)).toBe(20);
      expect(calculatePercentageChange(120, 100, true)).toBeCloseTo(0.2);
    });

    test('calculates negative percentage change', () => {
      expect(calculatePercentageChange(80, 100)).toBe(-20);
      expect(calculatePercentageChange(80, 100, true)).toBeCloseTo(-0.2);
    });

    test('handles zero previous value', () => {
      expect(calculatePercentageChange(100, 0)).toBe(100);
      expect(calculatePercentageChange(100, 0, true)).toBe(1);
      expect(calculatePercentageChange(0, 0)).toBe(0);
    });
  });

  describe('clampPercentage', () => {
    test('clamps values within default range (0-100)', () => {
      expect(clampPercentage(50)).toBe(50);
      expect(clampPercentage(-10)).toBe(0);
      expect(clampPercentage(150)).toBe(100);
    });

    test('clamps values within custom range', () => {
      expect(clampPercentage(50, 10, 90)).toBe(50);
      expect(clampPercentage(5, 10, 90)).toBe(10);
      expect(clampPercentage(95, 10, 90)).toBe(90);
    });
  });

  describe('Real-world analytics scenarios', () => {
    test('DEX market share calculation', () => {
      const dexData = [
        { name: 'Raydium', volume24h: 50000000 },
        { name: 'Jupiter', volume24h: 30000000 },
        { name: 'Orca', volume24h: 20000000 }
      ];

      const result = calculateNormalizedMarketShares(dexData, 'volume24h');
      const marketSharePercentages = result.map(item => item.marketShare * 100);
      
      // Validate that percentages sum to 100%
      const validation = validatePercentageSum(marketSharePercentages);
      expect(validation.isValid).toBe(true);
      
      // Check specific market shares
      expect(result[0].marketShare).toBeCloseTo(0.5); // 50%
      expect(result[1].marketShare).toBeCloseTo(0.3); // 30%
      expect(result[2].marketShare).toBeCloseTo(0.2); // 20%
    });

    test('Validator uptime should never exceed 100%', () => {
      const uptimeValues = [95.5, 99.9, 100.1, 102.5]; // Some invalid values
      
      const clampedValues = uptimeValues.map(value => clampPercentage(value, 0, 100));
      
      expect(clampedValues[0]).toBe(95.5);
      expect(clampedValues[1]).toBe(99.9);
      expect(clampedValues[2]).toBe(100); // Clamped from 100.1
      expect(clampedValues[3]).toBe(100); // Clamped from 102.5
    });

    test('Bridge protocol market share normalization', () => {
      const bridgeData = [
        { name: 'Wormhole', volume: 1000000.123 },
        { name: 'Portal', volume: 2000000.456 },
        { name: 'Allbridge', volume: 3000000.789 }
      ];

      const result = calculateNormalizedMarketShares(bridgeData, 'volume');
      const totalMarketShare = result.reduce((sum, item) => sum + item.marketShare, 0);
      
      // Should sum exactly to 1.0 despite floating point precision
      expect(totalMarketShare).toBeCloseTo(1.0, 10);
      
      // Individual shares should be reasonable
      expect(result[0].marketShare).toBeCloseTo(1/6); // ~16.67%
      expect(result[1].marketShare).toBeCloseTo(2/6); // ~33.33%
      expect(result[2].marketShare).toBeCloseTo(3/6); // ~50%
    });
  });
});