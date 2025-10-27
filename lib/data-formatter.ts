/**
 * Data Formatting Utility
 * Provides consistent data presentation across the platform
 */

/**
 * Format numbers with consistent decimal places and thousand separators
 */
export function formatNumber(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }
  
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format currency values consistently
 */
export function formatCurrency(value: number | null | undefined, currency = 'USD', decimals = 2): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '$0.00';
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format SOL amounts consistently
 */
export function formatSOL(lamports: number | null | undefined, decimals = 4): string {
  if (lamports === null || lamports === undefined || isNaN(lamports)) {
    return '0 SOL';
  }
  
  const sol = lamports / 1_000_000_000;
  return `${formatNumber(sol, decimals)} SOL`;
}

/**
 * Format percentage values consistently
 */
export function formatPercentage(value: number | null | undefined, decimals = 2, includeSign = true): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0%';
  }
  
  const sign = includeSign && value > 0 ? '+' : '';
  return `${sign}${formatNumber(value, decimals)}%`;
}

/**
 * Format large numbers with K/M/B suffixes
 */
export function formatCompactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }
  
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  
  if (absValue >= 1_000_000_000) {
    return `${sign}${formatNumber(absValue / 1_000_000_000, 2)}B`;
  }
  if (absValue >= 1_000_000) {
    return `${sign}${formatNumber(absValue / 1_000_000, 2)}M`;
  }
  if (absValue >= 1_000) {
    return `${sign}${formatNumber(absValue / 1_000, 2)}K`;
  }
  
  return `${sign}${formatNumber(absValue, 0)}`;
}

/**
 * Format timestamps consistently
 */
export function formatTimestamp(timestamp: number | null | undefined, format: 'full' | 'date' | 'time' | 'relative' = 'full'): string {
  if (!timestamp) return 'N/A';
  
  const date = new Date(timestamp * (timestamp < 10000000000 ? 1000 : 1)); // Handle both seconds and milliseconds
  
  switch (format) {
    case 'full':
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    
    case 'date':
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    
    case 'time':
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    
    case 'relative':
      return formatRelativeTime(timestamp);
    
    default:
      return date.toLocaleString();
  }
}

/**
 * Format relative time (e.g., "2 minutes ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - (timestamp < 10000000000 ? timestamp * 1000 : timestamp);
  const diffSeconds = Math.floor(diffMs / 1000);
  
  if (diffSeconds < 60) return `${diffSeconds} second${diffSeconds !== 1 ? 's' : ''} ago`;
  
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
  
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
  
  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} year${diffYears !== 1 ? 's' : ''} ago`;
}

/**
 * Format addresses consistently (truncated with ellipsis)
 */
export function formatAddress(address: string | null | undefined, startChars = 8, endChars = 8): string {
  if (!address) return 'N/A';
  
  if (address.length <= startChars + endChars) {
    return address;
  }
  
  return `${address.substring(0, startChars)}...${address.substring(address.length - endChars)}`;
}

/**
 * Format transaction status with consistent colors
 */
export interface StatusFormatResult {
  label: string;
  className: string;
  color: 'green' | 'red' | 'yellow' | 'gray';
}

export function formatStatus(status: 'success' | 'failed' | 'pending' | 'unknown' | null | undefined): StatusFormatResult {
  const statuses = {
    success: {
      label: 'Success',
      className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      color: 'green' as const,
    },
    failed: {
      label: 'Failed',
      className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      color: 'red' as const,
    },
    pending: {
      label: 'Pending',
      className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      color: 'yellow' as const,
    },
    unknown: {
      label: 'Unknown',
      className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
      color: 'gray' as const,
    },
  };
  
  return statuses[status || 'unknown'];
}

/**
 * Format change values with consistent color coding
 */
export interface ChangeFormatResult {
  formatted: string;
  className: string;
  isPositive: boolean;
  isNegative: boolean;
  isNeutral: boolean;
}

export function formatChange(value: number | null | undefined, asPercentage = true): ChangeFormatResult {
  if (value === null || value === undefined || isNaN(value)) {
    return {
      formatted: asPercentage ? '0%' : '0',
      className: 'text-muted-foreground',
      isPositive: false,
      isNegative: false,
      isNeutral: true,
    };
  }
  
  const isPositive = value > 0;
  const isNegative = value < 0;
  const isNeutral = value === 0;
  
  const formatted = asPercentage ? formatPercentage(value) : formatNumber(value);
  
  const className = isPositive
    ? 'text-green-600 dark:text-green-400'
    : isNegative
    ? 'text-red-600 dark:text-red-400'
    : 'text-muted-foreground';
  
  return {
    formatted,
    className,
    isPositive,
    isNegative,
    isNeutral,
  };
}

/**
 * Format bytes to human-readable format
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || isNaN(bytes)) {
    return '0 B';
  }
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let value = bytes;
  
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  
  return `${formatNumber(value, unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

/**
 * Format duration in milliseconds to human-readable format
 */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || isNaN(ms)) {
    return '0ms';
  }
  
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${formatNumber(seconds, 1)}s`;
  }
  
  const minutes = seconds / 60;
  if (minutes < 60) {
    return `${formatNumber(minutes, 1)}m`;
  }
  
  const hours = minutes / 60;
  return `${formatNumber(hours, 1)}h`;
}
