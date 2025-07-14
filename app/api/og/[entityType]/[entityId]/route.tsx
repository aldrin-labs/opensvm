/**
 * OG Image Generation API
 * Dynamically generates Open Graph images for different entity types
 */

import { ImageResponse } from 'next/og';

// Edge runtime for better performance
export const runtime = 'edge';

interface Params {
  entityType: string;
  entityId: string;
}

export async function GET(
  { params }: { params: Params }
) {
  try {
    const { entityType, entityId } = params;
    
    // Fetch entity data based on type
    // For now, we'll use mock data - in production, fetch from blockchain/database
    const entityData = await fetchEntityDataForOG(entityType, entityId);
    
    // Select appropriate template based on entity type
    switch (entityType) {
      case 'transaction':
        return generateTransactionOG(entityData);
      case 'account':
        return generateAccountOG(entityData);
      case 'program':
        return generateProgramOG(entityData);
      case 'user':
        return generateUserOG(entityData);
      default:
        return generateDefaultOG();
    }
  } catch (error) {
    console.error('Error generating OG image:', error);
    return generateDefaultOG();
  }
}

async function fetchEntityDataForOG(entityType: string, entityId: string): Promise<any> {
  try {
    switch (entityType) {
      case 'transaction': {
        // Fetch real transaction data from Solana
        const connection = new (await import('@solana/web3.js')).Connection(
          process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com'
        );
        
        const tx = await connection.getTransaction(entityId, { 
          maxSupportedTransactionVersion: 0 
        });
        
        if (!tx) {
          throw new Error('Transaction not found');
        }
        
        return {
          hash: entityId,
          status: tx.meta?.err ? 'error' : 'success',
          amount: 0, // Would need instruction parsing for actual amount
          fee: (tx.meta?.fee || 0) / 1e9,
          timestamp: tx.blockTime || Date.now() / 1000,
          programCount: tx.transaction.message.compiledInstructions?.length || 0
        };
      }
      
      case 'account': {
        // Fetch real account data from Solana
        const { Connection, PublicKey } = await import('@solana/web3.js');
        const connection = new Connection(
          process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com'
        );
        
        const pubkey = new PublicKey(entityId);
        const balance = await connection.getBalance(pubkey);
        const signatures = await connection.getSignaturesForAddress(pubkey, { limit: 1 });
        
        return {
          address: entityId,
          balance: balance / 1e9,
          tokenCount: 0, // Would need token account fetching
          transactionCount: signatures.length,
          lastActivity: Date.now()
        };
      }
      
      case 'program': {
        // For programs, we need to query our own analytics
        // This would typically come from our database of program stats
        return {
          programId: entityId,
          name: 'Solana Program',
          transactionCount: 0,
          userCount: 0,
          successRate: 95
        };
      }
      
      case 'user': {
        // Fetch user profile from our database
        const qdrantModule = await import('@/lib/qdrant');
        const profile = await qdrantModule.getUserProfile(entityId);
        
        if (!profile) {
          throw new Error('User profile not found');
        }
        
        return {
          walletAddress: profile.walletAddress,
          displayName: profile.displayName,
          followers: profile.socialStats.followers,
          pageViews: profile.socialStats.profileViews,
          totalVisits: profile.stats.totalVisits
        };
      }
      
      default:
        throw new Error('Unknown entity type');
    }
  } catch (error) {
    console.error('Error fetching entity data for OG:', error);
    // Return minimal fallback data
    return {
      entityId,
      entityType,
      error: true
    };
  }
}

function generateTransactionOG(data: any) {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0a',
          backgroundImage: 'linear-gradient(to bottom right, #0a0a0a, #1a1a2a)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 60, color: '#9333ea', marginRight: 20 }}>
            {data.status === 'success' ? '✅' : '❌'}
          </div>
          <div style={{ fontSize: 48, fontWeight: 'bold', color: 'white' }}>
            Transaction Details
          </div>
        </div>
        
        {/* Transaction Hash */}
        <div style={{ 
          fontSize: 24, 
          color: '#a78bfa',
          fontFamily: 'monospace',
          marginBottom: 30,
          padding: '10px 20px',
          backgroundColor: 'rgba(147, 51, 234, 0.1)',
          borderRadius: 8,
          border: '1px solid rgba(147, 51, 234, 0.3)'
        }}>
          {data.hash.slice(0, 8)}...{data.hash.slice(-6)}
        </div>
        
        {/* Stats Grid */}
        <div style={{ display: 'flex', gap: 40, marginTop: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 18, color: '#6b7280', marginBottom: 8 }}>Amount</div>
            <div style={{ fontSize: 36, fontWeight: 'bold', color: 'white' }}>
              {data.amount} SOL
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 18, color: '#6b7280', marginBottom: 8 }}>Fee</div>
            <div style={{ fontSize: 36, fontWeight: 'bold', color: 'white' }}>
              {data.fee} SOL
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div style={{ 
          position: 'absolute',
          bottom: 40,
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          <div style={{ fontSize: 24, color: '#9333ea', fontWeight: 'bold' }}>
            OpenSVM
          </div>
          <div style={{ fontSize: 18, color: '#6b7280' }}>
            Solana Explorer
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}

function generateAccountOG(data: any) {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0a',
          backgroundImage: 'linear-gradient(to bottom right, #0a0a0a, #1a1a2a)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 60, marginRight: 20 }}>🔍</div>
          <div style={{ fontSize: 48, fontWeight: 'bold', color: 'white' }}>
            Account Overview
          </div>
        </div>
        
        {/* Account Address */}
        <div style={{ 
          fontSize: 24, 
          color: '#a78bfa',
          fontFamily: 'monospace',
          marginBottom: 30,
          padding: '10px 20px',
          backgroundColor: 'rgba(147, 51, 234, 0.1)',
          borderRadius: 8,
          border: '1px solid rgba(147, 51, 234, 0.3)'
        }}>
          {data.address.slice(0, 8)}...{data.address.slice(-6)}
        </div>
        
        {/* Stats Grid */}
        <div style={{ display: 'flex', gap: 60, marginTop: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 18, color: '#6b7280', marginBottom: 8 }}>Balance</div>
            <div style={{ fontSize: 36, fontWeight: 'bold', color: 'white' }}>
              {data.balance.toLocaleString()} SOL
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 18, color: '#6b7280', marginBottom: 8 }}>Tokens</div>
            <div style={{ fontSize: 36, fontWeight: 'bold', color: 'white' }}>
              {data.tokenCount}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 18, color: '#6b7280', marginBottom: 8 }}>Transactions</div>
            <div style={{ fontSize: 36, fontWeight: 'bold', color: 'white' }}>
              {data.transactionCount}
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div style={{ 
          position: 'absolute',
          bottom: 40,
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          <div style={{ fontSize: 24, color: '#9333ea', fontWeight: 'bold' }}>
            OpenSVM
          </div>
          <div style={{ fontSize: 18, color: '#6b7280' }}>
            Solana Explorer
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}

function generateProgramOG(data: any) {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0a',
          backgroundImage: 'linear-gradient(to bottom right, #0a0a0a, #1a1a2a)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 60, marginRight: 20 }}>📦</div>
          <div style={{ fontSize: 48, fontWeight: 'bold', color: 'white' }}>
            {data.name}
          </div>
        </div>
        
        {/* Program ID */}
        <div style={{ 
          fontSize: 20, 
          color: '#a78bfa',
          fontFamily: 'monospace',
          marginBottom: 40,
          padding: '10px 20px',
          backgroundColor: 'rgba(147, 51, 234, 0.1)',
          borderRadius: 8,
          border: '1px solid rgba(147, 51, 234, 0.3)'
        }}>
          {data.programId.slice(0, 8)}...{data.programId.slice(-6)}
        </div>
        
        {/* Stats Grid */}
        <div style={{ display: 'flex', gap: 50, marginTop: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 18, color: '#6b7280', marginBottom: 8 }}>Transactions</div>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: 'white' }}>
              {(data.transactionCount / 1000000).toFixed(1)}M
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 18, color: '#6b7280', marginBottom: 8 }}>Users</div>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: 'white' }}>
              {(data.userCount / 1000).toFixed(1)}K
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 18, color: '#6b7280', marginBottom: 8 }}>Success Rate</div>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#10b981' }}>
              {data.successRate}%
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div style={{ 
          position: 'absolute',
          bottom: 40,
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          <div style={{ fontSize: 24, color: '#9333ea', fontWeight: 'bold' }}>
            OpenSVM
          </div>
          <div style={{ fontSize: 18, color: '#6b7280' }}>
            Solana Explorer
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}

function generateUserOG(data: any) {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0a',
          backgroundImage: 'linear-gradient(to bottom right, #0a0a0a, #1a1a2a)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 60, marginRight: 20 }}>👤</div>
          <div style={{ fontSize: 48, fontWeight: 'bold', color: 'white' }}>
            {data.displayName || 'Solana Explorer'}
          </div>
        </div>
        
        {/* Wallet Address */}
        <div style={{ 
          fontSize: 20, 
          color: '#a78bfa',
          fontFamily: 'monospace',
          marginBottom: 40,
          padding: '10px 20px',
          backgroundColor: 'rgba(147, 51, 234, 0.1)',
          borderRadius: 8,
          border: '1px solid rgba(147, 51, 234, 0.3)'
        }}>
          {data.walletAddress.slice(0, 8)}...{data.walletAddress.slice(-6)}
        </div>
        
        {/* Stats Grid */}
        <div style={{ display: 'flex', gap: 50, marginTop: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 18, color: '#6b7280', marginBottom: 8 }}>Followers</div>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: 'white' }}>
              {data.followers}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 18, color: '#6b7280', marginBottom: 8 }}>Page Views</div>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: 'white' }}>
              {data.pageViews.toLocaleString()}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 18, color: '#6b7280', marginBottom: 8 }}>Total Visits</div>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: 'white' }}>
              {data.totalVisits.toLocaleString()}
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div style={{ 
          position: 'absolute',
          bottom: 40,
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          <div style={{ fontSize: 24, color: '#9333ea', fontWeight: 'bold' }}>
            OpenSVM
          </div>
          <div style={{ fontSize: 18, color: '#6b7280' }}>
            Explorer Profile
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}

function generateDefaultOG() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0a',
          backgroundImage: 'linear-gradient(to bottom right, #0a0a0a, #1a1a2a)',
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 'bold', color: '#9333ea', marginBottom: 20 }}>
          OpenSVM
        </div>
        <div style={{ fontSize: 32, color: '#a78bfa' }}>
          Solana Explorer
        </div>
        <div style={{ fontSize: 20, color: '#6b7280', marginTop: 40 }}>
          Explore the Solana blockchain with advanced analytics
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
