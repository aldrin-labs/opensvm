/**
 * User Profile Page
 * Displays user's public browsing history with fancy UI/UX
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { UserProfile } from '@/types/user-history';
import { validateWalletAddress } from '@/lib/user-history-utils';
import { UserHistoryDisplay } from '@/components/user-history/UserHistoryDisplay';
import { UserHistoryStats } from '@/components/user-history/UserHistoryStats';
import { UserActivityCalendar } from '@/components/user-history/UserActivityCalendar';
import { UserFollowersList } from '@/components/user-history/UserFollowersList';
import { UserHistoryExport } from '@/components/user-history/UserHistoryExport';
import { UserFeedDisplay } from '@/components/user-history/UserFeedDisplay';
import { ShareButton } from '@/components/ShareButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCurrentUser } from '@/contexts/AuthContext';
import { 
  ReferralLinkSection, 
  ReferralStatsSection, 
  ReferralProgramDetails 
} from '@/components/referrals/ReferralComponents';
import { TokenBalance } from '@/components/referrals/TokenBalance';
import {
  User,
  Activity,
  BarChart3,
  Calendar,
  Eye,
  Globe,
  Loader2,
  AlertCircle,
  UserPlus,
  UserMinus,
  Heart,
  Users,
  Lock,
  Coins,
  Share2,
  MessageSquare
} from 'lucide-react';

export default function UserProfilePage() {
  const params = useParams();
  const rawWalletAddress = params?.walletAddress as string;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeTab = 'history'; // Default tab, no state needed since it never changes
  const [validatedWalletAddress, setValidatedWalletAddress] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialError, setSocialError] = useState<string | null>(null);
  const { walletAddress: myWallet } = useCurrentUser(); // Use auth context instead of direct API call
  const [tokenGating, setTokenGating] = useState<{
    hasAccess: boolean;
    balance: number;
    loading: boolean;
    error?: string;
  }>({
    hasAccess: false,
    balance: 0,
    loading: true
  });

  // Validate wallet address on mount
  useEffect(() => {
    if (rawWalletAddress) {
      const validated = validateWalletAddress(rawWalletAddress);
      if (!validated) {
        setError('Invalid wallet address format');
        setLoading(false);
        return;
      }
      setValidatedWalletAddress(validated);
    }
  }, [rawWalletAddress]);

  // Check token gating access
  useEffect(() => {
    const checkTokenAccess = async () => {
      // If no wallet is connected, this is a public view - no access to restricted content
      if (!myWallet) {
        setTokenGating(prev => ({ ...prev, loading: false, hasAccess: false }));
        return;
      }

      // If viewing your own profile, always grant access (no token gating for own profile)
      if (validatedWalletAddress && myWallet === validatedWalletAddress) {
        setTokenGating({
          hasAccess: true,
          balance: 0, // Balance irrelevant for own profile
          loading: false
        });
        return;
      }
      
      // Only apply token gating when viewing OTHER people's profiles
      try {
        const response = await fetch(`/api/token-gating/check`);
        if (response.ok) {
          const data = await response.json();
          setTokenGating({
            hasAccess: data.data.hasAccess,
            balance: data.data.balance,
            loading: false,
            error: data.data.error
          });
        } else if (response.status === 401) {
          // User is not authenticated
          setTokenGating({
            hasAccess: false,
            balance: 0,
            loading: false,
            error: 'Please connect your wallet to view restricted content'
          });
        } else {
          setTokenGating(prev => ({ 
            ...prev, 
            loading: false, 
            hasAccess: false,
            error: 'Failed to check token balance'
          }));
        }
      } catch (error) {
        console.error('Error checking token access:', error);
        setTokenGating(prev => ({ 
          ...prev, 
          loading: false, 
          hasAccess: false,
          error: 'Network error checking token balance'
        }));
      }
    };

    checkTokenAccess();
  }, [myWallet, validatedWalletAddress]);

  const handleFollowToggle = async () => {
    if (!validatedWalletAddress || socialLoading || (myWallet && validatedWalletAddress === myWallet)) return;
    try {
      setSocialLoading(true);
      setSocialError(null);
      const action = isFollowing ? 'unfollow' : 'follow';
      const response = await fetch(`/api/user-social/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetAddress: validatedWalletAddress })
      });
      if (response.ok) {
        setIsFollowing(!isFollowing);
        if (profile) {
          setProfile({
            ...profile,
            socialStats: {
              ...profile.socialStats,
              followers: profile.socialStats.followers + (isFollowing ? -1 : 1)
            }
          });
        }
      } else {
        // Handle token gating errors
        const responseData = await response.json();
        if (response.status === 403 && responseData.tokenGating) {
          setSocialError(`You need at least 100,000 SVMAI tokens to follow users. Your current balance: ${responseData.tokenGating.current.toLocaleString()}`);
        } else {
          setSocialError(responseData.error || 'Failed to follow user');
        }
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      setSocialError('Network error occurred');
    } finally {
      setSocialLoading(false);
    }
  };

  const handleLikeToggle = async () => {
    if (!validatedWalletAddress || socialLoading || (myWallet && validatedWalletAddress === myWallet)) return;
    try {
      setSocialLoading(true);
      setSocialError(null);
      const action = isLiked ? 'unlike' : 'like';
      const response = await fetch(`/api/user-social/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetAddress: validatedWalletAddress })
      });
      if (response.ok) {
        setIsLiked(!isLiked);
        if (profile) {
          setProfile({
            ...profile,
            socialStats: {
              ...profile.socialStats,
              likes: profile.socialStats.likes + (isLiked ? -1 : 1)
            }
          });
        }
      } else {
        // Handle token gating errors
        const responseData = await response.json();
        if (response.status === 403 && responseData.tokenGating) {
          setSocialError(`You need at least 100,000 SVMAI tokens to like users. Your current balance: ${responseData.tokenGating.current.toLocaleString()}`);
        } else {
          setSocialError(responseData.error || 'Failed to like user');
        }
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      setSocialError('Network error occurred');
    } finally {
      setSocialLoading(false);
    }
  };

  const fetchUserProfile = useCallback(async () => {
    if (!validatedWalletAddress) return;
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/user-profile/${validatedWalletAddress}`);
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch user profile: ${response.status} ${errorData}`);
      }
      const data = await response.json();
      if (!data.profile) {
        throw new Error('No profile data in response');
      }
      setProfile(data.profile);
      // Track profile view (increment view count) if not my own profile
      if (!myWallet || validatedWalletAddress !== myWallet) {
        try {
          await fetch(`/api/user-social/view`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ targetAddress: validatedWalletAddress })
          });
        } catch (error) {
          console.warn('Failed to track profile view:', error);
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load user profile');
    } finally {
      setLoading(false);
    }
  }, [validatedWalletAddress, myWallet]);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Loading user profile...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <AlertCircle className="h-8 w-8 mx-auto mb-4 text-destructive" />
              <p className="text-destructive mb-2">Error loading profile</p>
              <p className="text-muted-foreground text-sm">{error}</p>
              <Button 
                onClick={fetchUserProfile} 
                variant="outline" 
                className="mt-4"
              >
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <User className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No profile found</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const formatWalletAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const isMyProfile = myWallet && validatedWalletAddress &&
    validatedWalletAddress.toLowerCase() === myWallet.toLowerCase();
  return (
    <div className="min-h-screen bg-background p-3 sm:p-4">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Profile Header */}
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20" />
          <CardHeader className="relative">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border-4 border-background shadow-lg">
                  <AvatarImage src={profile.avatar} alt={profile.displayName || 'User avatar'} />
                  <AvatarFallback className="text-lg font-bold bg-gradient-to-r from-primary to-secondary text-primary-foreground">
                    {profile.displayName?.[0] || formatWalletAddress(profile.walletAddress)[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-foreground">
                      {profile.displayName || formatWalletAddress(profile.walletAddress)}
                    </h1>
                    {isMyProfile && (
                      <Badge variant="default" className="bg-primary text-primary-foreground">
                        <User className="h-3 w-3 mr-1" />
                        My Profile
                      </Badge>
                    )}
                    {profile.isPublic && (
                      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        <Globe className="h-3 w-3 mr-1" />
                        Public
                      </Badge>
                    )}
                  </div>
                  <Link
                    href={`/account/${profile.walletAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground font-mono cursor-pointer hover:text-primary transition-colors underline-offset-4 hover:underline"
                    title="Click to view account details in new tab"
                  >
                    {profile.walletAddress}
                  </Link>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>Joined {formatDate(profile.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Activity className="h-4 w-4" />
                      <span>Last active {formatDate(profile.lastActive)}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Social interaction buttons - hide for own profile */}
                {!isMyProfile && (
                  <>
                    <Button
                      variant={isFollowing ? "default" : "outline"}
                      size="sm"
                      onClick={handleFollowToggle}
                      disabled={socialLoading}
                      className="gap-1"
                    >
                      {isFollowing ? <UserMinus className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                      {isFollowing ? 'Unfollow' : 'Follow'}
                    </Button>
                    <Button
                      variant={isLiked ? "default" : "outline"}
                      size="sm"
                      onClick={handleLikeToggle}
                      disabled={socialLoading}
                      className="gap-1"
                    >
                      <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
                      {isLiked ? 'Liked' : 'Like'}
                    </Button>
                  </>
                )}
                <ShareButton entityType="user" entityId={profile.walletAddress} />
                <UserHistoryExport profile={profile} />
                <Badge variant="outline" className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {profile.socialStats.profileViews} views
                </Badge>
              </div>
            </div>
          </CardHeader>
          
          {/* Display social action error */}
          {socialError && (
            <CardContent className="pt-0 pb-4">
              <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="text-sm text-destructive">{socialError}</div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Visits</p>
                  <p className="text-2xl font-bold text-foreground">
                    {profile.stats.totalVisits.toLocaleString()}
                  </p>
                </div>
                <Activity className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Profile Views</p>
                  <p className="text-2xl font-bold text-foreground">
                    {profile.socialStats.profileViews.toLocaleString()}
                  </p>
                </div>
                <Eye className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Followers</p>
                  <p className="text-2xl font-bold text-foreground">
                    {profile.socialStats.followers}
                  </p>
                </div>
                <Users className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Likes</p>
                  <p className="text-2xl font-bold text-foreground">
                    {profile.socialStats.likes}
                  </p>
                </div>
                <Heart className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Days Active</p>
                  <p className="text-2xl font-bold text-foreground">
                    {profile.stats.dailyActivity.length}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Token Gating Notice - Only show for other people's profiles */}
        {!tokenGating.loading && !tokenGating.hasAccess && !isMyProfile && (
          <Card className="border-destructive/50 bg-destructive/5 dark:border-destructive/30 dark:bg-destructive/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-destructive">
                <Coins className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Token Gating Active: 100,000+ $SVMAI required to view other users' profile history and statistics
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content Tabs */}
        <Tabs defaultValue={activeTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6 overflow-x-auto">
            <TabsTrigger value="history" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3">
              <Activity className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">History</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3">
              <BarChart3 className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Stats</span>
            </TabsTrigger>
            <TabsTrigger value="social" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3">
              <Users className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Social</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3">
              <Activity className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Activity</span>
            </TabsTrigger>
            <TabsTrigger value="referrals" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3">
              <Share2 className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Referrals</span>
            </TabsTrigger>
            <TabsTrigger value="feed" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3">
              <MessageSquare className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Feed</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="history" className="space-y-4">
            {tokenGating.loading ? (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>Checking access permissions...</span>
                  </div>
                </CardContent>
              </Card>
            ) : !tokenGating.hasAccess && !isMyProfile ? (
              <Card className="border-destructive/50 bg-destructive/5 dark:border-destructive/30 dark:bg-destructive/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <Lock className="h-5 w-5" />
                    Access Restricted - Token Gating Active
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Coins className="h-5 w-5 text-destructive mt-1" />
                    <div className="space-y-2">
                      <p className="text-foreground">
                        You need to hold at least <strong>100,000 $SVMAI tokens</strong> to view other users' profile history.
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Current balance: <strong>{tokenGating.balance.toLocaleString()}</strong> $SVMAI
                      </p>
                      {tokenGating.error && (
                        <p className="text-sm text-destructive">
                          Error: {tokenGating.error}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      This restriction only applies when viewing other users' profiles.
                      Your own profile is always accessible to you.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <UserHistoryDisplay history={profile.history} />
            )}
          </TabsContent>
          
          <TabsContent value="stats" className="space-y-4">
            {tokenGating.loading ? (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>Checking access permissions...</span>
                  </div>
                </CardContent>
              </Card>
            ) : !tokenGating.hasAccess && !isMyProfile ? (
              <Card className="border-destructive/50 bg-destructive/5 dark:border-destructive/30 dark:bg-destructive/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <Lock className="h-5 w-5" />
                    Statistics Access Restricted
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground">
                    Statistics and activity data require <strong>100,000+ $SVMAI tokens</strong> to view for other users.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Current balance: <strong>{tokenGating.balance.toLocaleString()}</strong> $SVMAI
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <UserHistoryStats stats={profile.stats} />
                <UserActivityCalendar history={profile.history} />
              </>
            )}
          </TabsContent>
          
          <TabsContent value="social" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {validatedWalletAddress && (
                <>
                  <UserFollowersList walletAddress={validatedWalletAddress} type="followers" />
                  <UserFollowersList walletAddress={validatedWalletAddress} type="following" />
                </>
              )}
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5" />
                  Social Stats Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{profile.socialStats.likes}</p>
                    <p className="text-sm text-muted-foreground">Total Likes</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{profile.socialStats.profileViews}</p>
                    <p className="text-sm text-muted-foreground">Profile Views</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="activity" className="space-y-4">
            {tokenGating.loading ? (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>Checking access permissions...</span>
                  </div>
                </CardContent>
              </Card>
            ) : !tokenGating.hasAccess && !isMyProfile ? (
              <Card className="border-destructive/50 bg-destructive/5 dark:border-destructive/30 dark:bg-destructive/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <Lock className="h-5 w-5" />
                    Activity Feed Access Restricted
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground">
                    Activity feed requires <strong>100,000+ $SVMAI tokens</strong> to view for other users.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Current balance: <strong>{tokenGating.balance.toLocaleString()}</strong> $SVMAI
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Recent Activity Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {profile.history.slice(0, 10).map((entry) => (
                      <div key={entry.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{entry.pageTitle}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(entry.timestamp).toLocaleString()} • {entry.pageType}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Referrals Tab Content */}
          <TabsContent value="referrals" className="space-y-4">
            <Card className="overflow-hidden">
              <CardHeader className="sm:px-6">
                <CardTitle className="flex items-center gap-2 break-words">
                  <Share2 className="h-5 w-5 text-primary flex-shrink-0" />
                  <span className="truncate">Refer Friends & Earn Rewards</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 px-4 sm:px-6">
                <div className="w-full overflow-hidden">
                  <ReferralLinkSection walletAddress={profile.walletAddress} />
                </div>

                <ReferralStatsSection socialStats={profile.socialStats} />
                
                <TokenBalance
                  walletAddress={profile.walletAddress}
                  isMyProfile={isMyProfile === true}
                />

                <ReferralProgramDetails />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Feed Tab Content */}
          <TabsContent value="feed" className="space-y-4">
            <UserFeedDisplay
              walletAddress={validatedWalletAddress || ''}
              isMyProfile={isMyProfile === true}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
