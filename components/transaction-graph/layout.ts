'use client';

// Constants for graph size thresholds
export const SMALL_GRAPH_THRESHOLD = 50;
export const MEDIUM_GRAPH_THRESHOLD = 150;
export const LARGE_GRAPH_THRESHOLD = 300;

// Color scheme for ECharts
export const COLORS = {
  transaction: '#4a5568',
  account: '#3182ce',
  success: '#38a169',
  error: '#e53e3e',
  highlight: '#f6ad55',
  edge: '#a0aec0',
  background: '#1a202c'
};

// Node categories
export const CATEGORIES = [
  { name: 'Transaction' },
  { name: 'Account' },
  { name: 'Success' },
  { name: 'Error' }
];

/**
 * Clear layout cache
 */
export const clearLayoutCache = (): void => {
  // This is now a no-op since we're using ECharts
  console.log('Layout cache clearing is not needed with ECharts');
};