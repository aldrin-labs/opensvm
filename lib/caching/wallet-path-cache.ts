/**
 * WalletPathCache - A utility for preserving wallet path finding results
 * 
 * This module extends the GraphStateCache concept to specifically handle
 * wallet-to-wallet path finding results, enabling efficient reuse of
 * previously computed paths.
 */

// Maximum size of the in-memory cache
const MAX_CACHE_SIZE = 1000;
// Cache TTL in milliseconds (30 minutes)
const CACHE_TTL = 30 * 60 * 1000;
// Storage key prefix
const WALLET_PATH_STORAGE_KEY = 'opensvm-wallet-path';

/**
 * Interface for a wallet path finding result
 */
export interface WalletPathResult {
  sourceWallet: string;
  targetWallet: string;
  path: string[];          // The wallet addresses forming the path
  transferIds: string[];   // Transaction IDs of the transfers connecting wallets
  found: boolean;          // Whether a path was found
  timestamp: number;       // When this result was computed
  depth: number;           // Search depth used/reached
  visitedCount: number;    // Number of wallets visited during search
}

/**
 * Cache for wallet path finding results
 */
export class WalletPathCache {
  // In-memory cache for faster access during user session
  private static memoryCache: Map<string, WalletPathResult> = new Map();
  
  /**
   * Generate a cache key for a wallet path query
   */
  static generateKey(sourceWallet: string, targetWallet: string): string {
    return `${sourceWallet}-to-${targetWallet}`;
  }
  
  /**
   * Save a wallet path finding result to cache
   */
  static savePathResult(result: WalletPathResult): void {
    try {
      const key = WalletPathCache.generateKey(result.sourceWallet, result.targetWallet);
      
      // Update timestamp
      const resultWithTimestamp = {
        ...result,
        timestamp: Date.now()
      };
      
      // Store in memory cache
      WalletPathCache.memoryCache.set(key, resultWithTimestamp);
      
      // Store in local storage
      const storageKey = `${WALLET_PATH_STORAGE_KEY}-${key}`;
      localStorage.setItem(storageKey, JSON.stringify(resultWithTimestamp));
      
      // Keep cache size in check
      WalletPathCache.trimCache();
    } catch (error) {
      console.error('Failed to save wallet path result:', error);
    }
  }
  
  /**
   * Get a wallet path finding result from cache
   */
  static getPathResult(sourceWallet: string, targetWallet: string): WalletPathResult | null {
    try {
      const key = WalletPathCache.generateKey(sourceWallet, targetWallet);
      
      // First check memory cache
      if (WalletPathCache.memoryCache.has(key)) {
        const result = WalletPathCache.memoryCache.get(key)!;
        
        // Check if cache entry is still valid
        if (Date.now() - result.timestamp < CACHE_TTL) {
          return result;
        }
        
        // Cache expired, remove it
        WalletPathCache.memoryCache.delete(key);
      }
      
      // Check local storage
      const storageKey = `${WALLET_PATH_STORAGE_KEY}-${key}`;
      const storedResult = localStorage.getItem(storageKey);
      
      if (storedResult) {
        const result = JSON.parse(storedResult) as WalletPathResult;
        
        // Check if cache entry is still valid
        if (Date.now() - result.timestamp < CACHE_TTL) {
          // Add to memory cache for faster access next time
          WalletPathCache.memoryCache.set(key, result);
          return result;
        }
        
        // Cache expired, remove it
        localStorage.removeItem(storageKey);
      }
      
      // No valid cache entry found
      return null;
    } catch (error) {
      console.error('Failed to get wallet path result:', error);
      return null;
    }
  }
  
  /**
   * Get all cached wallet path results
   */
  static getAllPathResults(): WalletPathResult[] {
    try {
      const results: WalletPathResult[] = [];
      
      // Find all keys related to wallet path
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(WALLET_PATH_STORAGE_KEY)) {
          try {
            const storedResult = localStorage.getItem(key);
            if (storedResult) {
              const result = JSON.parse(storedResult) as WalletPathResult;
              
              // Check if cache entry is still valid
              if (Date.now() - result.timestamp < CACHE_TTL) {
                results.push(result);
              } else {
                // Cache expired, remove it
                localStorage.removeItem(key);
              }
            }
          } catch (e) {
            // Skip invalid entries
            console.error('Invalid wallet path cache entry:', e);
          }
        }
      }
      
      // Sort by timestamp descending (newest first)
      return results.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Failed to get all wallet path results:', error);
      return [];
    }
  }
  
  /**
   * Clear all wallet path cache entries
   */
  static clearCache(): void {
    try {
      // Clear memory cache
      WalletPathCache.memoryCache.clear();
      
      // Find all keys related to wallet path
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(WALLET_PATH_STORAGE_KEY)) {
          keysToRemove.push(key);
        }
      }
      
      // Remove all found keys
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.error('Failed to clear wallet path cache:', error);
    }
  }
  
  /**
   * Trim the memory cache to prevent excessive memory usage
   * Uses LRU strategy based on timestamp
   */
  private static trimCache(): void {
    if (WalletPathCache.memoryCache.size <= MAX_CACHE_SIZE) return;
    
    // Convert to array and sort by timestamp (oldest first)
    const entries = Array.from(WalletPathCache.memoryCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
    // Remove oldest entries until we're under the limit
    while (entries.length > MAX_CACHE_SIZE) {
      const oldest = entries.shift();
      if (oldest) {
        WalletPathCache.memoryCache.delete(oldest[0]);
      }
    }
  }
  
  /**
   * Check if result is cached for the given wallets
   */
  static hasPathResult(sourceWallet: string, targetWallet: string): boolean {
    const key = WalletPathCache.generateKey(sourceWallet, targetWallet);
    
    // Check memory cache first
    if (WalletPathCache.memoryCache.has(key)) {
      const result = WalletPathCache.memoryCache.get(key)!;
      if (Date.now() - result.timestamp < CACHE_TTL) {
        return true;
      }
    }
    
    // Check local storage
    const storageKey = `${WALLET_PATH_STORAGE_KEY}-${key}`;
    const storedResult = localStorage.getItem(storageKey);
    
    if (storedResult) {
      try {
        const result = JSON.parse(storedResult) as WalletPathResult;
        return Date.now() - result.timestamp < CACHE_TTL;
      } catch {
        return false;
      }
    }
    
    return false;
  }
}
