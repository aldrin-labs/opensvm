/**
 * API endpoint for tracking profile views
 */

import { NextResponse } from 'next/server';
import { qdrantClient } from '@/lib/qdrant';
import { getSessionFromCookie } from '@/lib/auth-server';
import { checkSVMAIAccess } from '@/lib/token-gating';

export async function POST(request: Request) {
  try {
    const { targetAddress } = await request.json();

    if (!targetAddress || typeof targetAddress !== 'string') {
      return NextResponse.json({ error: 'Invalid target address' }, { status: 400 });
    }

    // Get viewer address if authenticated
    let viewerAddress: string | undefined = undefined;
    try {
      const session = getSessionFromCookie();
      if (session && session.walletAddress) {
        viewerAddress = session.walletAddress;
      }
    } catch {}

    // Check token gating for the viewer (if authenticated)
    if (viewerAddress) {
      try {
        const tokenAccess = await checkSVMAIAccess(viewerAddress);
        if (!tokenAccess.hasAccess) {
          return NextResponse.json({ 
            error: 'Insufficient SVMAI tokens to view profiles. Minimum 100,000 $SVMAI required.',
            requiredBalance: 100000,
            currentBalance: tokenAccess.balance
          }, { status: 403 });
        }
      } catch (tokenError) {
        console.error('Error checking token access:', tokenError);
        // In production, you might want to deny access on error
        // For now, we'll allow the view to proceed with a warning
      }
    }

    // Don't count self-views
    if (viewerAddress && viewerAddress === targetAddress) {
      return NextResponse.json({ success: true, message: 'Self-view not counted' });
    }

    // Store the view in Qdrant (deduplicate by viewer per hour)
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    let alreadyViewed = false;
    
    // For authenticated users, check if they already viewed recently
    if (viewerAddress) {
      try {
        // Check if this viewer already viewed recently using user_profiles collection
        const recentViews = await qdrantClient.search('user_profiles', {
          vector: new Array(384).fill(0),
          filter: {
            must: [
              { key: 'walletAddress', match: { value: targetAddress } },
              { key: 'lastViewers', match: { any: [viewerAddress] } },
              { key: 'lastViewTime', range: { gte: hourAgo } }
            ]
          },
          limit: 1,
          with_payload: true
        });
        if (recentViews && recentViews.length > 0) {
          alreadyViewed = true;
        }
      } catch (error) {
        // If error checking recent views, assume not viewed
        console.log('Could not check recent views, proceeding with view tracking');
      }
    }
    
    if (!alreadyViewed) {
      // Increment profileViews in user_profiles
      try {
        const targetProfileResult = await qdrantClient.search('user_profiles', {
          vector: new Array(384).fill(0),
          filter: {
            must: [{ key: 'walletAddress', match: { value: targetAddress } }]
          },
          limit: 1,
          with_payload: true
        });
        
        if (targetProfileResult && targetProfileResult.length > 0) {
          const targetProfile = targetProfileResult[0].payload as any;
          const pointId = targetProfileResult[0].id; // Use the existing UUID point ID
          
          const currentSocialStats = targetProfile.socialStats || {
            visitsByUsers: 0,
            followers: 0,
            following: 0,
            likes: 0,
            profileViews: 0
          };
          
          const updatedProfile = {
            ...targetProfile,
            socialStats: {
              ...currentSocialStats,
              profileViews: (currentSocialStats.profileViews || 0) + 1
            },
            lastViewTime: now,
            lastViewers: viewerAddress ? [viewerAddress] : []
          };
          
          await qdrantClient.upsert('user_profiles', {
            wait: true,
            points: [
              {
                id: pointId, // Use the existing UUID point ID
                vector: Array(384).fill(0),
                payload: updatedProfile
              }
            ]
          });
          
          console.log(`Updated profile view count for ${targetAddress}: ${updatedProfile.socialStats.profileViews}`);
        } else {
          console.log(`No profile found for ${targetAddress}, creating new profile with view count`);
          
          // Create new profile if it doesn't exist
          const newProfile = {
            walletAddress: targetAddress,
            isPublic: true,
            createdAt: now,
            lastActive: now,
            socialStats: {
              visitsByUsers: 0,
              followers: 0,
              following: 0,
              likes: 0,
              profileViews: 1
            },
            lastViewTime: now,
            lastViewers: viewerAddress ? [viewerAddress] : []
          };
          
          await qdrantClient.upsert('user_profiles', {
            wait: true,
            points: [
              {
                id: crypto.randomUUID(), // Generate new UUID for new profile
                vector: Array(384).fill(0),
                payload: newProfile
              }
            ]
          });
          
          console.log(`Created new profile for ${targetAddress} with initial view count: 1`);
        }
      } catch (profileError) {
        console.error('Error updating profile view count:', profileError);
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error tracking profile view:', error);
    // Don't fail the page load if view tracking fails
    return NextResponse.json({ success: true });
  }
}
