import { NextRequest, NextResponse } from 'next/server';
import { qdrantClient } from '@/lib/search/qdrant';
import { getSessionFromCookie } from '@/lib/api-auth/auth-server';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { PriceAggregator, fetchTokenMetadata } from '@/lib/bank/price-aggregator';

const COLLECTION_NAME = 'svm_bank_wallets';

interface TokenBalance {
  mint: string;
  amount: string;
  decimals: number;
  uiAmount: number;
  usdValue: number;
  symbol?: string;
  name?: string;
  logoURI?: string;
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

    // Get SOL balance and token accounts in parallel
    const [lamports, tokenAccounts, token2022Accounts] = await Promise.all([
      connection.getBalance(publicKey),
      connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: TOKEN_PROGRAM_ID
      }),
      connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: TOKEN_2022_PROGRAM_ID
      })
    ]);

    const balance = lamports / LAMPORTS_PER_SOL;

    // Combine accounts from both token programs
    const allAccounts = [
      ...tokenAccounts.value,
      ...token2022Accounts.value
    ];

    const tokens: TokenBalance[] = allAccounts
      .map((accountInfo) => {
        const parsedInfo = accountInfo.account.data.parsed.info;
        return {
          mint: parsedInfo.mint,
          amount: parsedInfo.tokenAmount.amount,
          decimals: parsedInfo.tokenAmount.decimals,
          uiAmount: parsedInfo.tokenAmount.uiAmount || 0,
          usdValue: 0, // Will be enriched with price data
          symbol: undefined,
          name: undefined,
          logoURI: undefined
        };
      })
      .filter((token) => token.uiAmount > 0);

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
        total: 0,
        portfolio: {
          totalSOL: 0,
          totalTokenTypes: 0,
          totalWallets: 0,
          totalUsdValue: 0,
          solPrice: 0
        }
      });
    }

    // Fetch balances for each wallet in parallel
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

    // Collect all unique mints for price fetching
    const allMints = new Set<string>();
    walletsWithBalances.forEach(wallet => {
      wallet.tokens.forEach(token => allMints.add(token.mint));
    });

    // Fetch prices and metadata in parallel
    const priceAggregator = new PriceAggregator();
    const [priceData, tokenMetadata, solPrice] = await Promise.all([
      priceAggregator.fetchReliablePrices(Array.from(allMints)),
      fetchTokenMetadata(Array.from(allMints)),
      priceAggregator.fetchSolPrice()
    ]);

    // Enrich tokens with prices and metadata
    let totalUsdValue = 0;
    for (const wallet of walletsWithBalances) {
      // Add SOL value
      const walletSolValue = wallet.balance * solPrice;
      totalUsdValue += walletSolValue;

      for (const token of wallet.tokens) {
        // Add metadata
        const meta = tokenMetadata.get(token.mint);
        if (meta) {
          token.symbol = meta.symbol;
          token.name = meta.name;
          token.logoURI = meta.logoURI;
        } else {
          token.symbol = token.mint.slice(0, 4) + '...' + token.mint.slice(-4);
          token.name = 'Unknown Token';
        }

        // Add price
        const price = priceData.get(token.mint);
        if (price) {
          token.usdValue = token.uiAmount * price.price;
        } else {
          token.usdValue = 0;
        }
        totalUsdValue += token.usdValue;
      }

      // Sort tokens by USD value (highest first)
      wallet.tokens.sort((a, b) => b.usdValue - a.usdValue);
    }

    // Calculate portfolio metrics
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
        totalWallets: walletsWithBalances.length,
        totalUsdValue,
        solPrice
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
