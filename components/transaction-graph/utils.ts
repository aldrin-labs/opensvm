/**
 * Transaction Graph Utilities
 * Common utility functions for transaction graph components
 */

import cytoscape from 'cytoscape';
import { debugLog, errorLog } from '@/lib/debug-logger';

export { debugLog, errorLog };

// Export the logger functions for backward compatibility
export function resizeGraph(cy: cytoscape.Core): void {
  if (!cy) return;
  
  try {
    cy.resize();
    cy.fit();
  } catch (error) {
    errorLog('Error resizing graph:', error);
  }
}

export async function fetchTransactionData(signature: string): Promise<any> {
  try {
    debugLog('Fetching transaction data for:', signature);
    
    const response = await fetch(`/api/transaction/${signature}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch transaction: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    debugLog('Transaction data fetched successfully');
    return data;
    
  } catch (error) {
    errorLog('Error fetching transaction data:', error);
    throw error;
  }
}

export async function fetchAccountTransactions(address: string): Promise<any[]> {
  try {
    debugLog('Fetching account transactions for:', address);
    
    const response = await fetch(`/api/account-transactions/${address}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch account transactions: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    debugLog('Account transactions fetched successfully');
    return data.transactions || [];
    
  } catch (error) {
    errorLog('Error fetching account transactions:', error);
    throw error;
  }
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

export function generateNodeId(type: string, identifier: string): string {
  return `${type}:${identifier}`;
}

export function parseNodeId(nodeId: string): { type: string; identifier: string } | null {
  const [type, identifier] = nodeId.split(':');
  if (!type || !identifier) return null;
  return { type, identifier };
}

export function formatAddress(address: string, length: number = 8): string {
  if (!address || address.length <= length) return address;
  const start = Math.floor(length / 2);
  const end = length - start;
  return `${address.substring(0, start)}...${address.substring(address.length - end)}`;
}

export function formatTransactionSignature(signature: string, length: number = 8): string {
  return formatAddress(signature, length);
}

export function getNodeColor(nodeType: string, status?: string): string {
  switch (nodeType) {
    case 'transaction':
      return status === 'success' ? '#10b981' : '#ef4444';
    case 'account':
      return '#8b5cf6';
    case 'program':
      return '#f59e0b';
    default:
      return '#6b7280';
  }
}

export function getEdgeColor(edgeType: string): string {
  switch (edgeType) {
    case 'account_interaction':
      return '#6b7280';
    case 'token_transfer':
      return '#10b981';
    case 'program_call':
      return '#f59e0b';
    default:
      return '#9ca3af';
  }
}

export function calculateNodeSize(nodeType: string, data?: any): number {
  const baseSizes = {
    transaction: 20,
    account: 15,
    program: 18,
    token: 16
  };
  
  let size = baseSizes[nodeType as keyof typeof baseSizes] || 15;
  
  // Adjust size based on data if available
  if (data) {
    if (nodeType === 'account' && data.balance) {
      size += Math.min(data.balance / 1000000, 10); // Max +10 for high balance
    }
    if (nodeType === 'transaction' && data.fee) {
      size += Math.min(data.fee * 100, 5); // Max +5 for high fee
    }
  }
  
  return Math.round(size);
}

export function isValidSolanaAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  
  // Basic Solana address validation
  if (address.length < 32 || address.length > 44) return false;
  
  // Check for valid base58 characters
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  return base58Regex.test(address);
}

export function isValidTransactionSignature(signature: string): boolean {
  if (!signature || typeof signature !== 'string') return false;
  
  // Solana transaction signatures are 88 characters long
  if (signature.length !== 88) return false;
  
  // Check for valid base58 characters
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  return base58Regex.test(signature);
}
