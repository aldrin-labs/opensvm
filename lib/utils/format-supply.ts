/**
 * Format supply numbers with smart abbreviation and hover tooltip support
 */

export interface FormattedSupply {
  display: string;      // Short display value (e.g., "999.71M")
  full: string;         // Full value with commas (e.g., "999,710,524")
  tooltip: string;      // Full value for tooltip (e.g., "999,710,524.005056")
  shouldAbbreviate: boolean; // Whether the number was abbreviated
}

/**
 * Format a supply number for display
 * - Numbers >= 10M show as millions (e.g., "999.71M")
 * - Numbers >= 1B show as billions (e.g., "1.23B")
 * - Smaller numbers show full value without decimals
 * - On hover, show full number with all decimals
 */
export function formatSupply(supply: number, decimals: number = 6): FormattedSupply {
  const TEN_MILLION = 10_000_000;
  const ONE_BILLION = 1_000_000_000;
  
  // Full value with all decimals for tooltip
  const fullWithDecimals = supply.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  });
  
  // Full value without decimals for display
  const fullWithoutDecimals = Math.floor(supply).toLocaleString('en-US');
  
  // Determine display format
  let display: string;
  let shouldAbbreviate: boolean;
  
  if (supply >= ONE_BILLION) {
    // Show as billions (e.g., "1.23B")
    display = (supply / ONE_BILLION).toFixed(2) + 'B';
    shouldAbbreviate = true;
  } else if (supply >= TEN_MILLION) {
    // Show as millions (e.g., "999.71M")
    display = (supply / 1_000_000).toFixed(2) + 'M';
    shouldAbbreviate = true;
  } else {
    // Show full number without decimals
    display = fullWithoutDecimals;
    shouldAbbreviate = false;
  }
  
  return {
    display,
    full: fullWithoutDecimals,
    tooltip: fullWithDecimals,
    shouldAbbreviate
  };
}

/**
 * Format a number for display with smart abbreviation
 * Similar to formatSupply but for general numbers
 */
export function formatLargeNumber(value: number): FormattedSupply {
  return formatSupply(value, 0);
}
