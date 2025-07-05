'use client';

/**
 * Convert lamports to SOL
 * @param lamports Amount in lamports
 * @returns Amount in SOL
 */
export const lamportsToSol = (lamports: number): number => lamports / 1_000_000_000;

/**
 * Format SOL amount with + or - prefix
 * @param lamports Amount in lamports
 * @returns Formatted SOL string
 */
export const formatSolChange = (lamports: number): string => {
  const sol = lamportsToSol(lamports);
  return sol > 0 ? `+${sol.toFixed(4)} SOL` : `${sol.toFixed(4)} SOL`;
};

/**
 * Get short version of address or signature
 * @param str String to shorten
 * @param length Number of characters to keep at start and end
 * @returns Shortened string
 */
export const shortenString = (str: string, length = 4): string => {
  if (!str) return '';
  return `${str.slice(0, length)}...${str.slice(-length)}`;
};

/**
 * Format timestamp to locale string
 * @param timestamp Unix timestamp
 * @returns Formatted date string
 */
export const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString();
};

/**
 * Create a function to check if an address should be excluded from the graph
 * @param excludedAccounts Set of accounts to exclude
 * @param excludedProgramSubstrings Array of substrings to exclude
 * @returns Function that checks if an address should be excluded
 */
export const createAddressFilter = (
  excludedAccounts: Set<string>,
  excludedProgramSubstrings: string[]
) => {
  /**
   * Check if an address should be excluded from the graph
   * @param address Address to check
   * @returns True if address should be excluded
   */
  return (address: string): boolean => {
    // Check for direct matches with excluded accounts
    // Add safety check to ensure excludedAccounts is defined before calling .has()
    if (excludedAccounts && excludedAccounts.has(address)) {
      return true;
    }
    
    // Check for substring matches with program identifiers
    // Add safety check to ensure excludedProgramSubstrings is defined
    for (const substring of (excludedProgramSubstrings || [])) {
      if (address.includes(substring)) {
        return true;
      }
    }
    
    return false;
  };
};

/**
 * Create a function to check if a transaction should be included based on accounts involved
 * @param shouldExcludeAddress Function that checks if an address should be excluded
 * @returns Function that checks if a transaction should be included
 */
export const createTransactionFilter = (
  shouldExcludeAddress: (address: string) => boolean
) => {
  /**
   * Check if a transaction should be included based on accounts involved
   * @param accounts Array of accounts in the transaction
   * @returns True if transaction should be included, false otherwise
   */
  return (accounts: {pubkey: string}[] | any): boolean => {
    // Type guard: Check if accounts is an array 
    if (!Array.isArray(accounts)) {
      // Log the issue for debugging
      console.warn('Transaction filter received non-array accounts:', accounts);
      // Default to including the transaction as the safer option
      return true;
    }

    // Type guard: Check if it's an empty array
    if (accounts.length === 0) {
      return true;
    }

    try {
      return !accounts.some(acc => acc && typeof acc === 'object' && 'pubkey' in acc && shouldExcludeAddress(acc.pubkey));
    } catch (error) {
      console.error('Error in transaction filter:', error, 'accounts:', accounts);
      return true; // Include by default on error
    }
  };
};

/**
 * Debug logging utility that respects environment variables
 * @param message The debug message to log
 * @param data Optional data to log with the message
 */
export const debugLog = (message: string, ...data: any[]): void => {
  // Check for environment-based debug toggle
  const isDebugEnabled = 
    process.env.NODE_ENV === 'development' || 
    process.env.NEXT_PUBLIC_DEBUG_TRANSACTION_GRAPH === 'true' ||
    (typeof window !== 'undefined' && window.localStorage?.getItem('debug-transaction-graph') === 'true');
  
  if (isDebugEnabled) {
    console.log(`[TransactionGraph] ${message}`, ...data);
  }
};

/**
 * Error logging utility for production environments
 * @param message The error message to log
 * @param error Optional error object
 * @param data Optional additional data
 */
export const errorLog = (message: string, error?: any, ...data: any[]): void => {
  console.error(`[TransactionGraph] ${message}`, error, ...data);
};