/**
 * Format timestamp to relative time (e.g., "2m ago", "1h ago")
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted relative time string
 */
export function formatTradeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  
  return new Date(timestamp).toLocaleString();
}

/**
 * Format timestamp to short relative time (e.g., "2s ago", "5m ago")
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted short relative time string
 */
export function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Format timestamp to full date and time
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted full date and time string
 */
export function formatFullDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

/**
 * Format timestamp to ISO string for datetime attribute
 * @param timestamp - Unix timestamp in milliseconds
 * @returns ISO 8601 formatted string
 */
export function formatISODateTime(timestamp: number): string {
  return new Date(timestamp).toISOString();
}
