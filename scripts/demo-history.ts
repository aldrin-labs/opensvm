/**
 * Demo Script for User History Feature
 * Creates sample history data for testing
 */

import { UserHistoryEntry, UserProfile } from '@/types/user-history';

// Sample wallet address for demo
const DEMO_WALLET = '11111111111111111111111111111111';

// Sample history entries
const sampleHistory: Omit<UserHistoryEntry, 'id' | 'timestamp'>[] = [
  {
    walletAddress: DEMO_WALLET,
    path: '/tx/5J7XcVTjW2VZ9dEzWGP1BYvQKN5zKrJ3nEkRmW5LGz4M8D7c6V',
    pageType: 'transaction',
    pageTitle: 'Transaction 5J7XcVTj...',
    metadata: {
      transactionId: '5J7XcVTjW2VZ9dEzWGP1BYvQKN5zKrJ3nEkRmW5LGz4M8D7c6V'
    },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    referrer: 'https://opensvm.com'
  },
  {
    walletAddress: DEMO_WALLET,
    path: '/account/So11111111111111111111111111111111111111112',
    pageType: 'account',
    pageTitle: 'Account So111111...',
    metadata: {
      accountAddress: 'So11111111111111111111111111111111111111112'
    },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    referrer: 'https://opensvm.com/tx/5J7XcVTjW2VZ9dEzWGP1BYvQKN5zKrJ3nEkRmW5LGz4M8D7c6V'
  },
  {
    walletAddress: DEMO_WALLET,
    path: '/token/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    pageType: 'token',
    pageTitle: 'Token USDC',
    metadata: {
      tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
    },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    referrer: 'https://opensvm.com/account/So11111111111111111111111111111111111111112'
  },
  {
    walletAddress: DEMO_WALLET,
    path: '/analytics?tab=dex',
    pageType: 'analytics',
    pageTitle: 'DEX Analytics',
    metadata: {},
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    referrer: 'https://opensvm.com/token/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
  },
  {
    walletAddress: DEMO_WALLET,
    path: '/search?q=USDC',
    pageType: 'search',
    pageTitle: 'Search Results',
    metadata: {
      searchQuery: 'USDC'
    },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    referrer: 'https://opensvm.com/analytics?tab=dex'
  }
];

// Function to add sample data to localStorage
export function addSampleHistoryData() {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  const historyWithTimestamps: UserHistoryEntry[] = sampleHistory.map((entry, index) => ({
    ...entry,
    id: `${DEMO_WALLET}_${now - (index * oneHour)}_demo${index}`,
    timestamp: now - (index * oneHour) // Each entry 1 hour apart
  }));

  // Store in localStorage
  localStorage.setItem(
    `opensvm_user_history_${DEMO_WALLET}`,
    JSON.stringify(historyWithTimestamps)
  );

  // Create profile
  const profile: Omit<UserProfile, 'stats' | 'history'> = {
    walletAddress: DEMO_WALLET,
    displayName: `User ${DEMO_WALLET.slice(0, 6)}`,
    isPublic: true,
    createdAt: Date.now() - 86400000 * Math.floor(Math.random() * 30), // Random creation within last 30 days
    lastActive: Date.now() - Math.floor(Math.random() * 86400000), // Random activity within last day
    socialStats: {
      visitsByUsers: Math.floor(Math.random() * 100),
      followers: Math.floor(Math.random() * 50),
      following: Math.floor(Math.random() * 50),
      likes: Math.floor(Math.random() * 200),
      profileViews: Math.floor(Math.random() * 150)
    }
  };

  localStorage.setItem(
    `opensvm_user_profiles_${DEMO_WALLET}`,
    JSON.stringify(profile)
  );

  console.log('Sample history data added for wallet:', DEMO_WALLET);
  console.log('Added', historyWithTimestamps.length, 'history entries');
  
  return historyWithTimestamps;
}

// Function to clear sample data
export function clearSampleHistoryData() {
  localStorage.removeItem(`opensvm_user_history_${DEMO_WALLET}`);
  localStorage.removeItem(`opensvm_user_profiles_${DEMO_WALLET}`);
  console.log('Sample history data cleared for wallet:', DEMO_WALLET);
}

// Execute if running in browser
if (typeof window !== 'undefined') {
  (window as any).addSampleHistoryData = addSampleHistoryData;
  (window as any).clearSampleHistoryData = clearSampleHistoryData;
  console.log('Demo functions available: addSampleHistoryData(), clearSampleHistoryData()');
}
