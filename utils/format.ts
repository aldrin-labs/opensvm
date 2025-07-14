/**
 * Utility functions for formatting numbers, currencies, and percentages
 */

/**
 * Format a number with appropriate suffixes (K, M, B, T)
 */
export function formatNumber(value: number, decimals: number = 2): string {
  if (value === 0) return '0';
  if (value < 0.01) return '<0.01';
  
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  
  if (absValue >= 1e12) {
    return `${sign}${(absValue / 1e12).toFixed(decimals)}T`;
  } else if (absValue >= 1e9) {
    return `${sign}${(absValue / 1e9).toFixed(decimals)}B`;
  } else if (absValue >= 1e6) {
    return `${sign}${(absValue / 1e6).toFixed(decimals)}M`;
  } else if (absValue >= 1e3) {
    return `${sign}${(absValue / 1e3).toFixed(decimals)}K`;
  } else {
    return `${sign}${absValue.toFixed(decimals)}`;
  }
}

/**
 * Format a value as currency
 */
export function formatCurrency(value: number, abbreviated: boolean = false): string {
  if (value === 0) return '$0.00';
  
  if (abbreviated) {
    return `$${formatNumber(value)}`;
  }
  
  if (value < 0.01) {
    return '<$0.01';
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: value >= 1 ? 2 : 6,
    maximumFractionDigits: value >= 1 ? 2 : 6,
  }).format(value);
}

/**
 * Format a percentage
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  if (value === 0) return '0.00%';
  
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Format a large number with commas
 */
export function formatLargeNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

/**
 * Format time ago (e.g., "2 hours ago")
 */
export function formatTimeAgo(date: string | Date): string {
  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`;
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}m ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days}d ago`;
  }
}

/**
 * Format address for display (truncate middle)
 */
export function formatAddress(address: string, startChars: number = 4, endChars: number = 4): string {
  if (address.length <= startChars + endChars) {
    return address;
  }
  
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}