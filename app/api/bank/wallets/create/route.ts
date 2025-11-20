import { NextRequest, NextResponse } from 'next/server';
import { qdrantClient } from '@/lib/search/qdrant';
import { getSessionFromCookie } from '@/lib/api-auth/auth-server';
import { Keypair } from '@solana/web3.js';
import { encryptPrivateKey } from '@/lib/bank/encryption';
import { v4 as uuidv4 } from 'uuid';
import bs58 from 'bs58';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


const COLLECTION_NAME = 'svm_bank_wallets';

interface CreateWalletRequest {
  name?: string;
}

interface StoredWallet {
  id: string;
  userWallet: string;
  address: string;
  encryptedPrivateKey: string;
  name: string;
  createdAt: number;
}

/**
 * Initialize bank wallets collection if it doesn't exist
 */
async function ensureBankWalletsCollection(): Promise<void> {
  try {
    const exists = await qdrantClient.getCollection(COLLECTION_NAME).catch(() => null);
    
    if (!exists) {
      await qdrantClient.createCollection(COLLECTION_NAME, {
        vectors: {
          size: 384,
          distance: 'Cosine'
        }
      });
      
      // Create indexes
      await qdrantClient.createPayloadIndex(COLLECTION_NAME, {
        field_name: 'userWallet',
        field_schema: 'keyword'
      });
      
      await qdrantClient.createPayloadIndex(COLLECTION_NAME, {
        field_name: 'address',
        field_schema: 'keyword'
      });
      
      console.log('Created bank wallets collection');
    }
  } catch (error) {
    console.error('Error ensuring bank wallets collection:', error);
    throw error;
  }
}

/**
 * Generate a simple embedding for the wallet
 */
function generateSimpleEmbedding(text: string): number[] {
  const hash = text.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  const vector = new Array(384).fill(0);
  for (let i = 0; i < 384; i++) {
    vector[i] = Math.sin(hash + i) * 0.1;
  }
  
  return vector;
}

/**
 * POST /api/bank/wallets/create
 * Create a new managed wallet
 */
export async function POST(req: NextRequest) {
  try {
    // Get authenticated user from session
    const session = await getSessionFromCookie();
    if (!session?.walletAddress) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const userWallet = session.walletAddress;
    
    // Parse request body
    const body = await req.json() as CreateWalletRequest;
    
    // Generate new Solana keypair
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey.toBase58();
    const privateKeyBytes = keypair.secretKey;
    
    // Encrypt the private key (pass bytes directly)
    const encryptedPrivateKey = await encryptPrivateKey(privateKeyBytes, userWallet);
    
    // Ensure collection exists
    await ensureBankWalletsCollection();
    
    // Create wallet entry
    const walletId = uuidv4();
    const walletData: StoredWallet = {
      id: walletId,
      userWallet,
      address: publicKey,
      encryptedPrivateKey,
      name: body.name || `Wallet ${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`,
      createdAt: Date.now()
    };
    
    // Generate embedding
    const textContent = `${walletData.userWallet} ${walletData.address} ${walletData.name}`;
    const vector = generateSimpleEmbedding(textContent);
    
    // Store in Qdrant
    await qdrantClient.upsert(COLLECTION_NAME, {
      wait: true,
      points: [{
        id: walletId,
        vector,
        payload: walletData as any
      }]
    });
    
    console.log(`Created wallet ${publicKey} for user ${userWallet}`);
    
    return NextResponse.json({
      success: true,
      wallet: {
        id: walletData.id,
        address: walletData.address,
        name: walletData.name,
        balance: 0,
        tokens: [],
        createdAt: walletData.createdAt
      }
    });
    
  } catch (error) {
    console.error('Error creating wallet:', error);
    return NextResponse.json(
      { error: 'Failed to create wallet', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
