'use client';

import { useState, useEffect } from 'react';
import { Copy, Link as LinkIcon, CheckCircle, WifiOff, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Referral Link component
export function ReferralLinkSection({ walletAddress }: { walletAddress: string }) {
  const [referralLink, setReferralLink] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  
  // Simple toast replacement since useToast is not available
  const toast = {
    success: (message: string) => {
      console.log('Success:', message);
      setCopySuccess(message);
      setTimeout(() => setCopySuccess(null), 3000);
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
  
  useEffect(() => {
    // Try to load cached link from localStorage first (for offline support)
    if (typeof window !== 'undefined' && window.localStorage && walletAddress) {
      const cachedLink = localStorage.getItem(`referralLink_${walletAddress}`);
      if (cachedLink) {
        setReferralLink(cachedLink);
        setIsGenerating(false);
      }
    }
    
    // Generate share link using the same system as ShareButton
    const generateReferralLink = async () => {
      try {
        setIsGenerating(true);
        const response = await fetch('/api/share/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entityType: 'user',
            entityId: walletAddress,
            referrerAddress: walletAddress
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to generate referral link');
        }
        
        const data = await response.json();
        setReferralLink(data.shareUrl);
        
        // Cache the link for offline use
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(`referralLink_${walletAddress}`, data.shareUrl);
        }
      } catch (error) {
        console.error('Error generating referral link:', error);
        
        // If offline and no cached link, show a message
        if (isOffline && !referralLink) {
          toast.error('Cannot generate link while offline');
        }
      } finally {
        setIsGenerating(false);
      }
    };

    if (walletAddress && !isOffline) {
      generateReferralLink();
    }
  }, [walletAddress, isOffline]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success("Referral link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };
  
  const handleShare = async () => {
    // Use Web Share API if available
    if (navigator.share && referralLink) {
      try {
        await navigator.share({
          title: 'Check out OpenSVM',
          text: 'Join me on OpenSVM!',
          url: referralLink
        });
        toast.success("Successfully shared!");
      } catch (error) {
        console.error('Error sharing:', error);
        // Fall back to copy if sharing fails
        handleCopyLink();
      }
    } else {
      // Fall back to copying the link
      handleCopyLink();
    }
  };

  return (
    <div className="bg-muted/30 p-4 rounded-lg border border-border relative">
      {copySuccess && (
        <div className="absolute top-0 right-0 left-0 bg-green-500/90 text-white py-2 px-4 text-sm rounded-t-lg animate-in fade-in slide-in-from-top z-10">
          {copySuccess}
        </div>
      )}
      
      <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
        <LinkIcon className="h-4 w-4 text-primary" />
        <span className="truncate">Your Referral Link</span>
        {isOffline && <WifiOff className="h-3 w-3 ml-auto text-amber-500" />}
      </h3>
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
        {isGenerating ? (
          <div className="bg-background p-2 rounded border flex-1 w-full flex items-center justify-center h-10">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
            <span className="text-sm">Generating link...</span>
          </div>
        ) : (
          <div className="bg-background p-2 rounded border flex-1 w-full font-mono text-xs sm:text-sm overflow-x-auto whitespace-nowrap">
            <div className="truncate max-w-full">{referralLink}</div>
          </div>
        )}
        
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyLink}
            disabled={isGenerating || !referralLink}
            className="flex-1 sm:flex-initial min-h-[36px] min-w-[36px]"
            aria-label={copied ? "Copied to clipboard" : "Copy referral link"}
          >
            {copied ? <CheckCircle className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            <span className="hidden sm:inline">Copy</span>
          </Button>
          
          <Button
            size="sm"
            variant="default"
            onClick={handleShare}
            disabled={isGenerating || !referralLink}
            className="flex-1 sm:flex-initial min-h-[36px]"
            aria-label="Share referral link"
          >
            <Share2 className="h-4 w-4 mr-2" />
            <span>Share</span>
          </Button>
        </div>
      </div>
      
      {isOffline && !referralLink && (
        <div className="mt-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 dark:bg-amber-900/20 p-2 rounded text-xs flex items-center gap-1">
          <WifiOff className="h-3 w-3" />
          <span>You're offline. Referral link will be generated when you're back online.</span>
        </div>
      )}
      
      <p className="text-xs text-muted-foreground mt-2 break-words">
        Share this link with friends. When they sign up, you'll both receive rewards.
      </p>
    </div>
  );
}

// Referral Stats component
export function ReferralStatsSection({ socialStats }: { socialStats: any }) {
  // Calculate rewards based on 5 SVMAI per follower
  const followerCount = socialStats?.followers || 0;
  const potentialRewards = (followerCount * 5).toFixed(1);
  const profileViews = socialStats?.profileViews || 0;
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
      <div className="bg-muted/30 p-4 rounded-lg border border-border">
        <h3 className="text-sm font-medium mb-1 truncate">Profile Views</h3>
        <p className="text-2xl font-bold break-words">
          {profileViews.toLocaleString()}
        </p>
        <p className="text-xs text-muted-foreground mt-1 break-words">
          Total profile page visits
        </p>
      </div>
      
      <div className="bg-muted/30 p-4 rounded-lg border border-border">
        <h3 className="text-sm font-medium mb-1 truncate">Followers</h3>
        <p className="text-2xl font-bold break-words">
          {followerCount.toLocaleString()}
        </p>
        <p className="text-xs text-muted-foreground mt-1 break-words">
          Each follower = 5 SVMAI daily
        </p>
      </div>
      
      <div className="bg-muted/30 p-4 rounded-lg border border-border relative overflow-hidden sm:col-span-2 lg:col-span-1">
        <div className={`absolute inset-0 bg-gradient-to-r from-primary/5 to-primary/10 transition-opacity ${followerCount > 0 ? 'opacity-100' : 'opacity-0'}`}></div>
        <div className="relative">
          <h3 className="text-sm font-medium mb-1 truncate">Potential Rewards</h3>
          <p className="text-2xl font-bold break-words">
            {potentialRewards} SVMAI
          </p>
          <p className="text-xs text-muted-foreground mt-1 break-words">
            Claimable once every 24 hours
          </p>
        </div>
      </div>
    </div>
  );
}

// Referral Program Details component
// Minimum balance required to claim rewards (1,000,000 SVMAI)
export const MINIMUM_BALANCE_REQUIRED = 1000000;

export function ReferralProgramDetails() {
  // Functionality now handled in TokenBalance component

  return (
    <div className="bg-muted/30 p-4 rounded-lg border border-border">
      <h3 className="text-sm font-medium mb-2">How It Works</h3>
      <ol className="space-y-2 pl-5 list-decimal text-sm">
        <li className="break-words">Share your unique referral link with friends</li>
        <li className="break-words">When they sign up using your link, they'll become your referral</li>
        <li className="break-words">Earn 5 SVMAI tokens per follower you have</li>
        <li className="break-words">Claim rewards once every 24 hours</li>
      </ol>
      
      <div className="mt-4 p-3 bg-amber-500/10 border border-amber-200 dark:border-amber-800 rounded-md">
        <h4 className="text-sm font-medium mb-1 flex items-center">
          <span className="text-amber-600 dark:text-amber-400 mr-1">⚠️</span> Requirements
        </h4>
        <ul className="space-y-1 pl-5 list-disc text-xs text-muted-foreground">
          <li className="break-words">Hold at least {MINIMUM_BALANCE_REQUIRED.toLocaleString()} SVMAI tokens in your wallet</li>
          <li className="break-words">Have at least one follower to earn rewards</li>
          <li className="break-words">Wait 24 hours between claims</li>
        </ul>
      </div>
      
      <div className="mt-4 p-2 bg-primary/10 rounded-md">
        <p className="text-xs font-medium break-words">
          💡 Pro Tip: Install this app on your home screen for easier access to your referral program!
        </p>
      </div>
      <p className="text-xs text-muted-foreground mt-4 break-words">
        Note: Use the Token Balance card to claim your available rewards.
      </p>
    </div>
  );
}