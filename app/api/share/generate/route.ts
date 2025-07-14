/**
 * Share Generation API
 * Generates shareable links with OG images for any entity
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  generateShareCode, 
  generateShareUrl, 
  generateOgImageUrl,
  validateShareRequest,
  generateTitle,
  generateDescriptionFallback,
  calculateShareExpiration,
  generateAIPrompt,
  extractHashtags
} from '@/lib/share-utils';
import { storeShareEntry } from '@/lib/qdrant';
import { 
  EntityType, 
  ShareEntry, 
  GenerateShareRequest, 
  GenerateShareResponse,
  TransactionOGData,
  AccountOGData,
  ProgramOGData,
  UserOGData,
  BlockOGData,
  ValidatorOGData,
  TokenOGData
} from '@/types/share';
import { cookies } from 'next/headers';
import { Connection, PublicKey } from '@solana/web3.js';

// Initialize Solana connection
const connection = new Connection(
  process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com'
);

/**
 * Fetch entity data based on type
 */
async function fetchEntityData(
  entityType: EntityType,
  entityId: string
): Promise<TransactionOGData | AccountOGData | ProgramOGData | UserOGData | BlockOGData | ValidatorOGData | TokenOGData | null> {
  try {
    switch (entityType) {
      case 'transaction': {
        // Fetch transaction data
        const tx = await connection.getTransaction(entityId, { maxSupportedTransactionVersion: 0 });
        if (!tx) return null;
        
        return {
          hash: entityId,
          status: tx.meta?.err ? 'error' : 'success',
          fee: (tx.meta?.fee || 0) / 1e9, // Convert lamports to SOL
          timestamp: tx.blockTime || Date.now() / 1000,
          programCount: tx.transaction.message.compiledInstructions?.length || 0,
          amount: 0 // Would need to parse instructions for actual amount
        } as TransactionOGData;
      }
      
      case 'account': {
        // Fetch account data
        const pubkey = new PublicKey(entityId);
        const balance = await connection.getBalance(pubkey);
        
        // Get transaction count (approximate)
        const signatures = await connection.getSignaturesForAddress(pubkey, { limit: 1 });
        
        return {
          address: entityId,
          balance: balance / 1e9, // Convert lamports to SOL
          tokenCount: 0, // Would need to fetch token accounts
          transactionCount: signatures.length,
          lastActivity: Date.now()
        } as AccountOGData;
      }
      
      case 'program': {
        // For programs, we'd need more complex logic
        // This is a simplified version
        return {
          programId: entityId,
          name: 'Solana Program',
          transactionCount: 0,
          userCount: 0,
          successRate: 95,
          volume: 0
        } as ProgramOGData;
      }
      
      case 'user': {
        // Try to fetch user profile from our database, with fallback
        try {
          const qdrantModule = await import('@/lib/qdrant');
          const profile = await qdrantModule.getUserProfile(entityId);
          
          if (profile) {
            return {
              walletAddress: profile.walletAddress,
              displayName: profile.displayName,
              avatar: profile.avatar,
              followers: profile.socialStats?.followers || 0,
              following: profile.socialStats?.following || 0,
              pageViews: profile.socialStats?.profileViews || 0,
              totalVisits: profile.stats?.totalVisits || 0,
              joinDate: profile.createdAt
            } as UserOGData;
          }
        } catch (error) {
          console.warn('Could not fetch user profile from Qdrant, using fallback:', error instanceof Error ? error.message : error);
        }
        
        // Fallback: create basic user data
        return {
          walletAddress: entityId,
          displayName: `${entityId.slice(0, 6)}...${entityId.slice(-4)}`,
          followers: 0,
          following: 0,
          pageViews: 0,
          totalVisits: 0,
          joinDate: Date.now()
        } as UserOGData;
      }

      case 'block': {
        // Fetch block data
        // This is a simplified implementation
        try {
          const slotNumber = parseInt(entityId, 10);
          const blockInfo = await connection.getBlockTime(slotNumber);
          
          return {
            slot: slotNumber,
            timestamp: blockInfo || Date.now() / 1000,
            transactionCount: 0, // Would need to fetch the block
            successRate: 98,
            totalSolVolume: 0,
            totalFees: 0,
            blockTime: blockInfo || Date.now() / 1000
          } as BlockOGData;
        } catch (err) {
          console.error('Error fetching block data:', err);
          return null;
        }
      }
      
      case 'validator': {
        // Fetch validator data
        // This is a simplified implementation
        try {
          return {
            voteAccount: entityId,
            name: 'Solana Validator',
            commission: 8,
            activatedStake: 100000,
            apy: 5.5,
            status: 'active',
            performanceScore: 98,
            uptimePercent: 99.9
          } as ValidatorOGData;
        } catch (err) {
          console.error('Error fetching validator data:', err);
          return null;
        }
      }
      
      case 'token': {
        // Fetch token data
        try {
          // Here we fetch the basic token info from the blockchain
          const tokenModule = await import('@/lib/solana');
          const tokenInfo = await tokenModule.getTokenInfo(entityId);
          
          if (!tokenInfo) return null;
          
          // In a real implementation, you'd fetch additional data from your database
          // For now, we'll use the basic blockchain data and add placeholders
          return {
            mint: entityId,
            name: tokenInfo.name || 'Unknown Token',
            symbol: tokenInfo.symbol || '',
            image: '', // Would come from metadata service
            price: 0, // Would come from price feed
            priceChange24h: 0,
            marketCap: 0,
            supply: tokenInfo.totalSupply,
            holders: 0,
            decimals: tokenInfo.decimals,
            volume24h: 0
          } as TokenOGData;
        } catch (err) {
          console.error('Error fetching token data:', err);
          return null;
        }
      }
      
      default:
        return null;
    }
  } catch (error) {
    console.error('Error fetching entity data:', error);
    return null;
  }
}

/**
 * Generate AI-powered description (placeholder for now)
 */
async function generateAIDescription(_prompt: string): Promise<string | null> {
  // TODO: Integrate with OpenAI or other AI service
  // For now, return null to use fallback
  return null;
}

export async function POST(req: NextRequest) {
  try {
    console.log('Share generation request received');
    
    const body: GenerateShareRequest = await req.json();
    const { entityType, entityId, referrerAddress } = body;
    
    console.log('Request data:', { entityType, entityId, referrerAddress });
    
    // Validate request
    const validation = validateShareRequest(entityType, entityId, referrerAddress);
    if (!validation.isValid) {
      console.error('Validation failed:', validation.error);
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }
    
    // Get session if referrer not provided
    let finalReferrerAddress = referrerAddress;
    if (!finalReferrerAddress) {
      try {
        // Try to get wallet from cookie
        const cookieStore = cookies();
        const walletCookie = cookieStore.get('wallet-address');
        if (walletCookie?.value) {
          finalReferrerAddress = walletCookie.value;
        }
      } catch (error) {
        console.warn('Could not access cookies:', error);
      }
    }
    
    // Fetch entity data with better error handling
    let entityData;
    try {
      entityData = await fetchEntityData(entityType, entityId);
    } catch (error) {
      console.error('Error fetching entity data:', error);
      // Create fallback data for user type
      if (entityType === 'user') {
        entityData = {
          walletAddress: entityId,
          displayName: entityId.slice(0, 6) + '...' + entityId.slice(-4),
          followers: 0,
          following: 0,
          pageViews: 0,
          totalVisits: 0,
          joinDate: Date.now()
        };
      }
    }
    
    if (!entityData) {
      console.error('Entity data not found for:', { entityType, entityId });
      return NextResponse.json(
        { error: 'Entity not found' },
        { status: 404 }
      );
    }
    
    // Generate share code
    const shareCode = generateShareCode(entityType, entityId);
    const shareUrl = generateShareUrl(shareCode);
    const ogImageUrl = generateOgImageUrl(entityType, entityId);
    
    // Generate title and description
    const title = generateTitle(entityType, entityData);
    
    // Try AI description first, fallback to generated
    let aiDescription: string | null = null;
    try {
      const aiPrompt = generateAIPrompt(entityType, entityData);
      aiDescription = await generateAIDescription(aiPrompt);
    } catch (error) {
      console.warn('AI description failed:', error);
    }
    
    const description = aiDescription || generateDescriptionFallback(entityType, entityData);
    
    // Extract hashtags from description
    const hashtags = extractHashtags(description);
    
    // Create share entry
    const shareEntry: ShareEntry = {
      id: crypto.randomUUID(),
      shareCode,
      referrerAddress: finalReferrerAddress || 'anonymous',
      entityType,
      entityId,
      ogImageUrl,
      title,
      description,
      aiAnalysis: aiDescription || undefined,
      metadata: {
        hashtags,
        stats: entityData
      },
      clicks: 0,
      conversions: 0,
      timestamp: Date.now(),
      expiresAt: calculateShareExpiration()
    };
    
    // Store in database with error handling
    try {
      await storeShareEntry(shareEntry);
      console.log('Share entry stored successfully');
    } catch (error) {
      console.warn('Failed to store share entry in database:', error);
      // Continue anyway - we can still return the share URL
    }
    
    // Return response
    const response: GenerateShareResponse = {
      shareUrl,
      shareCode,
      ogImageUrl,
      title,
      description,
      aiInsights: aiDescription || undefined,
      preview: {
        type: entityType,
        data: entityData
      }
    };
    
    console.log('Share generation successful:', shareCode);
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Error generating share:', error);
    return NextResponse.json(
      { error: 'Failed to generate share link', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
