import { NextRequest, NextResponse } from 'next/server';
import { qdrantClient } from '@/lib/search/qdrant';
import { getSessionFromCookie } from '@/lib/api-auth/auth-server';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

const COLLECTION_NAME = 'svm_bank_wallets';

interface TokenBalance {
  mint: string;
  amount: string;
  decimals: number;
  uiAmount: number;
  symbol?: string;
  name?: string;
}

interface WalletBalance {
  id: string;
  address: string;
  name: string;
  balance: number;
  tokens: TokenBalance[];
  createdAt: number;
}

/**
 * Get Solana connection
 */
function getSolanaConnection(): Connection {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

/**
 * Fetch SOL balance and token balances for a wallet
 */
async function fetchWalletBalances(address: string): Promise<{ balance: number; tokens: TokenBalance[] }> {
  try {
    const connection = getSolanaConnection();
    const publicKey = new PublicKey(address);
    
    // Get SOL balance
    const lamports = await connection.getBalance(publicKey);
    const balance = lamports / LAMPORTS_PER_SOL;
    
    // Get token accounts
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
      programId: TOKEN_PROGRAM_ID
    });
    
    const tokens: TokenBalance[] = tokenAccounts.value
      .map((accountInfo) => {
        const parsedInfo = accountInfo.account.data.parsed.info;
        return {
          mint: parsedInfo.mint,
          amount: parsedInfo.tokenAmount.amount,
          decimals: parsedInfo.tokenAmount.decimals,
          uiAmount: parsedInfo.tokenAmount.uiAmount || 0,
          symbol: undefined, // Will be enriched later if needed
          name: undefined
        };
      })
      .filter((token) => token.uiAmount > 0); // Only include tokens with balance
    
    return { balance, tokens };
  } catch (error) {
    console.error(`Error fetching balances for ${address}:`, error);
    return { balance: 0, tokens: [] };
  }
}

/**
 * POST /api/bank/wallets/refresh
 * Refresh balances for all managed wallets
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
    
    // Get user's wallets from Qdrant
    const results = await qdrantClient.scroll(COLLECTION_NAME, {
      filter: {
        must: [
          {
            key: 'userWallet',
            match: { value: userWallet }
          }
        ]
      },
      limit: 100,
      with_payload: true
    });
    
    if (results.points.length === 0) {
      return NextResponse.json({
        wallets: [],
        total: 0
      });
    }
    
    // Fetch balances for each wallet
    const walletsWithBalances: WalletBalance[] = await Promise.all(
      results.points.map(async (point: any) => {
        const walletData = point.payload;
        const { balance, tokens } = await fetchWalletBalances(walletData.address);
        
        return {
          id: walletData.id,
          address: walletData.address,
          name: walletData.name,
          balance,
          tokens,
          createdAt: walletData.createdAt
        };
      })
    );
    
    // Calculate total portfolio value
    const totalSOL = walletsWithBalances.reduce((sum, wallet) => sum + wallet.balance, 0);
    const totalTokenTypes = new Set(
      walletsWithBalances.flatMap(wallet => wallet.tokens.map(t => t.mint))
    ).size;
    
    return NextResponse.json({
      wallets: walletsWithBalances,
      total: walletsWithBalances.length,
      portfolio: {
        totalSOL,
        totalTokenTypes,
        totalWallets: walletsWithBalances.length
      }
    });
    
  } catch (error) {
    console.error('Error refreshing wallet balances:', error);
    return NextResponse.json(
      { error: 'Failed to refresh balances', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
