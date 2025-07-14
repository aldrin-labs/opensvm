/**
 * Utility functions for consistent percentage calculations across analytics
 */

export interface PercentageCalculationOptions {
  decimals?: number;
  clampMin?: number;
  clampMax?: number;
  showSign?: boolean;
}

/**
 * Format a decimal or percentage value as a percentage string
 * @param value - The value to format (can be decimal 0-1 or percentage 0-100)
 * @param isAlreadyPercent - Whether the value is already a percentage (0-100) vs decimal (0-1)
 * @param options - Formatting options
 */
export function formatPercent(
  value: number | undefined | null,
  isAlreadyPercent: boolean = false,
  options: PercentageCalculationOptions = {}
): string {
  const {
    decimals = 2,
    clampMin = -100,
    clampMax = 100,
    showSign = false
  } = options;

  if (value == null || isNaN(value)) return '0.00%';
  
  // Convert to percentage if needed
  const percent = isAlreadyPercent ? value : value * 100;
  
  // Clamp to reasonable bounds
  const clampedPercent = Math.min(Math.max(percent, clampMin), clampMax);
  
  // Format with specified decimals
  const formatted = clampedPercent.toFixed(decimals);
  
  // Add sign if requested
  if (showSign && clampedPercent >= 0) {
    return `+${formatted}%`;
  }
  
  return `${formatted}%`;
}

/**
 * Calculate market share percentages from values and normalize to sum to 100%
 * @param items - Array of items with numeric values
 * @param valueKey - Key to extract the value from each item
 * @returns Array of items with normalized marketShare property
 */
export function calculateNormalizedMarketShares<T extends Record<string, any>>(
  items: T[],
  valueKey: keyof T
): Array<T & { marketShare: number }> {
  if (items.length === 0) return [];
  
  // Calculate total
  const total = items.reduce((sum, item) => {
    const value = Number(item[valueKey]) || 0;
    return sum + value;
  }, 0);
  
  if (total === 0) {
    return items.map(item => ({ ...item, marketShare: 0 }));
  }
  
  // Calculate initial market shares
  const withMarketShares = items.map(item => {
    const value = Number(item[valueKey]) || 0;
    return {
      ...item,
      marketShare: value / total
    };
  });
  
  // Normalize to ensure sum equals exactly 1.0 (avoid floating point errors)
  const totalMarketShare = withMarketShares.reduce((sum, item) => sum + item.marketShare, 0);
  
  if (Math.abs(totalMarketShare - 1.0) > 0.001) {
    withMarketShares.forEach(item => {
      item.marketShare = item.marketShare / totalMarketShare;
    });
  }
  
  return withMarketShares;
}

/**
 * Validate that an array of percentages sums to approximately 100%
 * @param percentages - Array of percentage values (0-100)
 * @param tolerance - Acceptable deviation from 100% (default 0.1%)
 */
export function validatePercentageSum(
  percentages: number[],
  tolerance: number = 0.1
): { isValid: boolean; actualSum: number; deviation: number } {
  const actualSum = percentages.reduce((sum, p) => sum + p, 0);
  const deviation = Math.abs(actualSum - 100);
  const isValid = deviation <= tolerance;
  
  return {
    isValid,
    actualSum,
    deviation
  };
}

/**
 * Calculate percentage change between two values
 * @param current - Current value
 * @param previous - Previous value
 * @param asDecimal - Return as decimal (0-1) instead of percentage (0-100)
 */
export function calculatePercentageChange(
  current: number,
  previous: number,
  asDecimal: boolean = false
): number {
  if (previous === 0) {
    return current > 0 ? (asDecimal ? 1 : 100) : 0;
  }
  
  const change = ((current - previous) / previous);
  return asDecimal ? change : change * 100;
}

/**
 * Clamp percentage values to valid ranges
 * @param value - The percentage value to clamp
 * @param min - Minimum allowed value (default 0)
 * @param max - Maximum allowed value (default 100)
 */
export function clampPercentage(
  value: number,
  min: number = 0,
  max: number = 100
): number {
  return Math.min(Math.max(value, min), max);
}