/**
 * History Tracking Hook
 * Tracks user page visits for authenticated users with improved error handling
 */

'use client';

import { useEffect, useCallback, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { UserHistoryEntry } from '@/types/user-history';
import { validateWalletAddress } from '@/lib/user-history-utils';
import { useAuthContext } from '@/contexts/AuthContext';

// Retry function with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff: wait 1s, 2s, 4s
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

// Helper function to determine page type from path
function getPageType(path: string): UserHistoryEntry['pageType'] {
  if (path.includes('/tx/') || path.includes('/transaction/')) return 'transaction';
  if (path.includes('/account/') || path.includes('/address/')) return 'account';
  if (path.includes('/block/') || path.includes('/blocks/')) return 'block';
  if (path.includes('/program/')) return 'program';
  if (path.includes('/token/')) return 'token';
  if (path.includes('/validator/')) return 'validator';
  if (path.includes('/analytics')) return 'analytics';
  if (path.includes('/search')) return 'search';
  return 'other';
}

// Helper function to extract metadata from path
function extractMetadata(path: string, pageType: UserHistoryEntry['pageType']) {
  const metadata: UserHistoryEntry['metadata'] = {};
  
  switch (pageType) {
    case 'transaction':
      const txMatch = path.match(/\/tx\/([^\/]+)|\/transaction\/([^\/]+)/);
      if (txMatch) {
        metadata.transactionId = txMatch[1] || txMatch[2];
      }
      break;
    case 'account':
      const accountMatch = path.match(/\/account\/([^\/]+)|\/address\/([^\/]+)/);
      if (accountMatch) {
        metadata.accountAddress = accountMatch[1] || accountMatch[2];
      }
      break;
    case 'block':
      const blockMatch = path.match(/\/block\/(\d+)/);
      if (blockMatch) {
        metadata.blockNumber = parseInt(blockMatch[1], 10);
      }
      break;
    case 'program':
      const programMatch = path.match(/\/program\/([^\/]+)/);
      if (programMatch) {
        metadata.programId = programMatch[1];
      }
      break;
    case 'token':
      const tokenMatch = path.match(/\/token\/([^\/]+)/);
      if (tokenMatch) {
        metadata.tokenMint = tokenMatch[1];
      }
      break;
    case 'validator':
      const validatorMatch = path.match(/\/validator\/([^\/]+)/);
      if (validatorMatch) {
        metadata.validatorAddress = validatorMatch[1];
      }
      break;
  }
  
  return metadata;
}

// Helper function to get page title from document or path
function getPageTitle(path: string, pageType: UserHistoryEntry['pageType']): string {
  // Try to get from document title first
  if (typeof document !== 'undefined' && document.title) {
    return document.title;
  }
  
  // Fallback to generating title from path
  switch (pageType) {
    case 'transaction':
      const txId = extractMetadata(path, 'transaction').transactionId;
      return txId ? `Transaction ${txId.slice(0, 8)}...` : 'Transaction';
    case 'account':
      const accountId = extractMetadata(path, 'account').accountAddress;
      return accountId ? `Account ${accountId.slice(0, 8)}...` : 'Account';
    case 'block':
      const blockNum = extractMetadata(path, 'block').blockNumber;
      return blockNum ? `Block ${blockNum}` : 'Block';
    case 'program':
      const programId = extractMetadata(path, 'program').programId;
      return programId ? `Program ${programId.slice(0, 8)}...` : 'Program';
    case 'token':
      const tokenMint = extractMetadata(path, 'token').tokenMint;
      return tokenMint ? `Token ${tokenMint.slice(0, 8)}...` : 'Token';
    case 'validator':
      const validatorId = extractMetadata(path, 'validator').validatorAddress;
      return validatorId ? `Validator ${validatorId.slice(0, 8)}...` : 'Validator';
    case 'analytics':
      return 'Analytics';
    case 'search':
      return 'Search';
    default:
      return 'OpenSVM Explorer';
  }
}

export function useHistoryTracking() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { publicKey, connected } = useWallet();
  const { isAuthenticated } = useAuthContext();
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error' | 'auth_required'>('idle');

  const trackPageVisit = useCallback(async (path: string, searchQuery?: string) => {
    if (!connected || !publicKey) return;

    // Only require authentication for user profile pages
    const isUserProfilePage = path.includes('/user/');
    
    // Skip tracking entirely if on user profile page and not authenticated
    if (isUserProfilePage && !isAuthenticated) {
      // Don't automatically authenticate on user pages - let the user decide
      console.log('Skipping history tracking on user profile page - authentication required');
      return;
    }

    const walletAddress = publicKey.toBase58();
    
    // Validate wallet address
    const validatedAddress = validateWalletAddress(walletAddress);
    if (!validatedAddress) {
      console.error('Invalid wallet address');
      return;
    }

    const pageType = getPageType(path);
    const metadata = extractMetadata(path, pageType);
    
    // Add search query to metadata if present
    if (searchQuery) {
      metadata.searchQuery = searchQuery;
    }

    const historyEntry: Omit<UserHistoryEntry, 'id' | 'timestamp'> = {
      walletAddress: validatedAddress,
      path,
      pageType,
      pageTitle: getPageTitle(path, pageType),
      metadata,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      referrer: typeof document !== 'undefined' ? document.referrer : undefined
    };

    try {
      // Store locally first (immediate feedback)
      const existingHistory = JSON.parse(
        localStorage.getItem(`opensvm_user_history_${validatedAddress}`) || '[]'
      );
      
      const newEntry = {
        ...historyEntry,
        id: `${validatedAddress}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now()
      };
      
      const updatedHistory = [newEntry, ...existingHistory].slice(0, 10000);
      localStorage.setItem(`opensvm_user_history_${validatedAddress}`, JSON.stringify(updatedHistory));

      // Sync to server with retry logic (only if authenticated or for non-user pages)
      if (isAuthenticated || !isUserProfilePage) {
        setSyncStatus('syncing');
        
        try {
          await retryWithBackoff(async () => {
            const response = await fetch(`/api/user-history/${validatedAddress}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include', // Include cookies for authentication
              body: JSON.stringify(historyEntry)
            });
            
            if (!response.ok) {
              // For non-user pages, don't require authentication
              if (response.status === 401 && !isUserProfilePage) {
                console.log('Skipping server sync for non-authenticated user on public page');
                return { success: true, skipped: true };
              }
              if (response.status === 401) {
                throw new Error('Authentication required');
              }
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return response.json();
          });
          
          setSyncStatus('success');
          
          // Clear success status after a short delay
          setTimeout(() => setSyncStatus('idle'), 2000);
          
        } catch (syncError) {
          console.warn('Failed to sync history to server after retries:', syncError);
          setSyncStatus('error');
          
          // Clear error status after a delay
          setTimeout(() => setSyncStatus('idle'), 5000);
        }
      }

    } catch (error) {
      console.error('Error tracking page visit:', error);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 5000);
    }
  }, [connected, publicKey, isAuthenticated]);

  // Track page visits
  useEffect(() => {
    if (!connected || !publicKey) return;

    const path = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');
    const searchQuery = searchParams.get('q') || searchParams.get('search') || undefined;
    const refCode = searchParams.get('ref') || undefined;
    
    // Small delay to ensure page is fully loaded
    const timer = setTimeout(() => {
      trackPageVisit(path, searchQuery);
      
      // Track referral conversion if ref parameter exists
      if (refCode) {
        trackReferralConversion(refCode);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [pathname, searchParams, trackPageVisit, connected, publicKey]);

  const trackReferralConversion = async (shareCode: string) => {
    try {
      await fetch('/api/share/conversion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shareCode,
          converterAddress: publicKey?.toBase58()
        })
      });
    } catch (error) {
      console.warn('Failed to track referral conversion:', error);
    }
  };

  return { trackPageVisit, syncStatus };
}
