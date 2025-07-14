'use client';

import { useState, useEffect } from 'react';
import { Wallet, Clock, WifiOff, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MINIMUM_BALANCE_REQUIRED } from './ReferralComponents';

interface TokenBalanceProps {
  walletAddress: string;
  isMyProfile: boolean;
}

interface BalanceResponse {
  balance: number;
  updatedAt: number;
  isOwner?: boolean;
  recentRewards?: any[];
  lastClaimAt?: number;
  nextClaimAt?: number;
  canClaim?: boolean;
  minimumBalanceRequired?: number;
  hasMinimumBalance?: boolean;
  timeAllowsClaim?: boolean;
  requiredBalance?: number;
  error?: string;
}

export function TokenBalance({ walletAddress, isMyProfile }: TokenBalanceProps) {
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceData, setBalanceData] = useState<BalanceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isClaimingTokens, setIsClaimingTokens] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  
  // Simple toast replacement since useToast is not available
  const toast = {
    success: (message: string) => {
      console.log('Success:', message);
      setClaimSuccess(message);
      setTimeout(() => setClaimSuccess(null), 5000);
    },
    error: (message: string) => console.error('Error:', message)
  };

  // Check for online/offline status
  useEffect(() => {
    // Set initial offline state
    setIsOffline(!navigator.onLine);
    
    // Add event listeners for online/offline status changes
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Listen for refresh-balance event (triggered by service worker)
  useEffect(() => {
    const handleRefreshBalance = () => {
      console.log('Refreshing balance from service worker event');
      setRefreshKey(prev => prev + 1);
    };
    
    window.addEventListener('refresh-balance', handleRefreshBalance);
    
    return () => {
      window.removeEventListener('refresh-balance', handleRefreshBalance);
    };
  }, []);

  useEffect(() => {
    const fetchTokenBalance = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch(`/api/referrals/balance?walletAddress=${walletAddress}`, {
          method: 'GET',
          credentials: 'include',
        });
        
        const responseData = await response.json();
        
        if (!response.ok) {
          throw new Error(responseData.error || 'Failed to fetch token balance');
        }
        
        const data: BalanceResponse = responseData;
        setBalance(data.balance);
        setBalanceData(data);
      } catch (err) {
        console.error('Error fetching token balance:', err);
        setError(err instanceof Error ? err.message : 'Failed to load token balance');
      } finally {
        setIsLoading(false);
      }
    };

    if (walletAddress) {
      fetchTokenBalance();
    }
  }, [walletAddress, refreshKey]);

  // Format the next claim time
  const getNextClaimTime = () => {
    if (!balanceData?.nextClaimAt) return null;
    
    const nextClaimDate = new Date(balanceData.nextClaimAt);
    return nextClaimDate.toLocaleString();
  };

  // Format the last claim time
  const getLastClaimTime = () => {
    if (!balanceData?.lastClaimAt) return null;
    
    const lastClaimDate = new Date(balanceData.lastClaimAt);
    return lastClaimDate.toLocaleString();
  };

  // Handle token claim
  // Handle token claim with offline support
  const handleClaimTokens = async () => {
    if (!isMyProfile) return;
    // Check if the user meets minimum balance requirement
    if (balanceData && balanceData.balance < MINIMUM_BALANCE_REQUIRED) {
      setError(`You need at least ${MINIMUM_BALANCE_REQUIRED.toLocaleString()} SVMAI to claim rewards. Current balance: ${balanceData.balance.toLocaleString()} SVMAI`);
      return;
    }
    
    if (!balanceData?.canClaim) {
      const nextTime = balanceData?.nextClaimAt ? new Date(balanceData.nextClaimAt).toLocaleString() : 'unknown time';
      setError(`You cannot claim rewards yet. Next claim available at ${nextTime}`);
      return;
    }
    
    // Handle offline claims by storing them for later sync
    if (isOffline) {
      try {
        setIsClaimingTokens(true);
        setError(null);
        
        // Store claim for later if browser supports localStorage
        if (typeof window !== 'undefined' && window.localStorage) {
          const pendingClaims = JSON.parse(localStorage.getItem('pendingReferralClaims') || '[]');
          
          // Add this claim to pending list
          pendingClaims.push({
            walletAddress,
            timestamp: Date.now(),
            attempted: true
          });
          
          localStorage.setItem('pendingReferralClaims', JSON.stringify(pendingClaims));
          
          // Register for background sync if service worker is available
          if ('serviceWorker' in navigator && 'SyncManager' in window) {
            const registration = await navigator.serviceWorker.ready;
            // Use type assertion for sync property
            if ('sync' in registration) {
              await (registration as any).sync.register('referralClaimSync');
            }
          }
          
          toast.success("Claim queued for processing when you're back online");
          setClaimSuccess("Claim queued for when you're back online");
        } else {
          setError('Your browser does not support offline claiming');
        }
        
        setTimeout(() => {
          setIsClaimingTokens(false);
        }, 1000);
        
        return;
      } catch (err) {
        console.error('Error storing offline claim:', err);
        setError('Failed to store offline claim');
        setIsClaimingTokens(false);
        return;
      }
    }
    
    // Online claim process
    try {
      setIsClaimingTokens(true);
      setError(null);
      
      const response = await fetch('/api/referrals/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ walletAddress })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        const errorMessage = data.error || 'Failed to claim rewards';
        const cooldownMessage = data.code === 'CLAIM_COOLDOWN' && data.nextClaimTimeFormatted
          ? `Next claim available at ${data.nextClaimTimeFormatted}`
          : '';
        
        setError(`${errorMessage}${cooldownMessage ? ` - ${cooldownMessage}` : ''}`);
        toast.error(errorMessage);
        return;
      }
      
      toast.success(`Successfully claimed ${data.amount} SVMAI tokens! New balance: ${data.newBalance.toFixed(1)} SVMAI`);
      // Refresh the balance data
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error('Error claiming tokens:', err);
      setError('Failed to claim rewards. Please try again.');
      toast.error('Failed to claim rewards. Please try again.');
    } finally {
      setIsClaimingTokens(false);
    }
  };

  return (
    <div className="bg-muted/30 p-4 rounded-lg border border-border relative">
      {claimSuccess && (
        <div className="absolute top-0 right-0 left-0 bg-green-500/90 text-white py-2 px-4 text-sm rounded-t-lg animate-in fade-in slide-in-from-top z-10">
          {claimSuccess}
        </div>
      )}
      
      <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
        <Wallet className="h-4 w-4 text-primary" />
        <span className="truncate">SVMAI Token Balance</span>
      </h3>
      
      <div className="flex flex-col">
        {isLoading ? (
          <div className="flex items-center space-x-2 py-6">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span className="text-sm">Loading balance...</span>
          </div>
        ) : error ? (
          <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">{error}</div>
        ) : (
          <>
            <div className="text-2xl font-bold break-words" data-balance-display="true">
              {balance !== null ? `${balance.toFixed(1)} SVMAI` : '0 SVMAI'}
            </div>
            
            {balanceData?.updatedAt && (
              <div className="text-xs text-muted-foreground mt-1">
                Updated: {new Date(balanceData.updatedAt).toLocaleString()}
              </div>
            )}
            
            {isMyProfile && balanceData && (
              <div className="mt-3 space-y-2">
                {balanceData.lastClaimAt && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Last claimed: {getLastClaimTime()}
                  </div>
                )}
                
                {/* Time requirement message */}
                {balanceData.timeAllowsClaim === false && balanceData.nextClaimAt && (
                  <div className="text-xs text-muted-foreground bg-muted p-2 rounded mt-2 flex items-center gap-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span>Next claim available: {getNextClaimTime()}</span>
                  </div>
                )}
                
                {/* Show the claim button only if user has enough tokens and can claim */}
                {balanceData.canClaim && balanceData.balance >= MINIMUM_BALANCE_REQUIRED && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleClaimTokens}
                    disabled={isClaimingTokens}
                    className="mt-2 w-full min-h-[40px]"
                    aria-label="Claim available tokens"
                    data-offline-claim={true}
                    data-offline-action={isOffline ? "true" : "false"}
                  >
                    {isClaimingTokens ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                        Claiming...
                      </>
                    ) : isOffline ? (
                      <>
                        <WifiOff className="h-4 w-4 mr-2" />
                        Claim (Will Queue Offline)
                      </>
                    ) : (
                      "Claim Available Tokens"
                    )}
                  </Button>
                )}
                
                {/* Show minimum balance warning if applicable */}
                {isMyProfile && balanceData && balanceData.balance < MINIMUM_BALANCE_REQUIRED && (
                  <div className="mt-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 dark:bg-amber-900/20 p-2 rounded text-xs">
                    <p className="font-medium flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Minimum Balance Requirement
                    </p>
                    <p className="mt-1">You need at least {MINIMUM_BALANCE_REQUIRED.toLocaleString()} SVMAI to claim rewards.</p>
                    <p className="mt-1">Current balance: {balanceData.balance.toLocaleString()} SVMAI</p>
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                      {balanceData.balance > 0
                        ? `You need ${(MINIMUM_BALANCE_REQUIRED - balanceData.balance).toLocaleString()} more SVMAI`
                        : "Earn SVMAI by getting more followers and engagement"}
                    </p>
                  </div>
                )}
                
                {isOffline && (
                  <div className="mt-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 dark:bg-amber-900/20 p-2 rounded text-xs flex items-center gap-1">
                    <WifiOff className="h-3 w-3" />
                    <span>You're offline. Claims will sync when you're back online.</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
        
        <p className="text-xs text-muted-foreground mt-2 max-w-full break-words">
          {isMyProfile ?
            `This is your current SVMAI token balance. You need at least ${MINIMUM_BALANCE_REQUIRED.toLocaleString()} SVMAI to claim rewards.` :
            `This user's current SVMAI token balance. Users need at least ${MINIMUM_BALANCE_REQUIRED.toLocaleString()} SVMAI to claim rewards.`}
        </p>
      </div>
    </div>
  );
}