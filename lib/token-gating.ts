import { PublicKey } from '@solana/web3.js';
import { getConnection } from './solana-connection';

// SVMAI token mint address
export const SVMAI_MINT_ADDRESS = 'Cpzvdx6pppc9TNArsGsqgShCsKC9NCCjA2gtzHvUpump';

// Minimum required SVMAI balance for token gating (100,000 tokens)
export const MIN_SVMAI_BALANCE = 100000;

// Development mode - set to true to bypass token gating for testing
const DEV_MODE = process.env.NODE_ENV === 'development';
const BYPASS_TOKEN_GATING = process.env.NEXT_PUBLIC_BYPASS_TOKEN_GATING === 'true';

// For development/testing when NODE_ENV is not set
const IS_DEVELOPMENT = DEV_MODE || !process.env.NODE_ENV || process.env.NODE_ENV !== 'production';

/**
 * Check if a wallet has sufficient SVMAI tokens to access gated features
 * @param walletAddress The wallet address to check
 * @returns Promise<{ hasAccess: boolean; balance: number; error?: string }>
 */
export async function checkSVMAIAccess(walletAddress: string): Promise<{
  hasAccess: boolean;
  balance: number;
  error?: string;
}> {
  try {
    console.log(`[Token Gating] Checking SVMAI access for wallet: ${walletAddress}`);
    console.log(`[Token Gating] Target mint: ${SVMAI_MINT_ADDRESS}`);
    
    // Allow bypass in development or when explicitly enabled
    if (IS_DEVELOPMENT || BYPASS_TOKEN_GATING) {
      console.log(`[Token Gating] Bypassing token check (dev mode: ${DEV_MODE}, is_dev: ${IS_DEVELOPMENT}, bypass: ${BYPASS_TOKEN_GATING})`);
      return {
        hasAccess: true,
        balance: MIN_SVMAI_BALANCE + 1000 // Simulate having enough tokens
      };
    }

    const connection = await getConnection();
    const walletPubkey = new PublicKey(walletAddress);
    const svmaiMint = new PublicKey(SVMAI_MINT_ADDRESS);
    
    console.log(`[Token Gating] Getting token accounts for wallet: ${walletPubkey.toString()}`);
    console.log(`[Token Gating] Connection endpoint: ${connection.rpcEndpoint || 'unknown'}`);
    
    // Method 1: Try getParsedTokenAccountsByOwner
    let totalBalance = 0;
    try {
      console.log(`[Token Gating] Attempting getParsedTokenAccountsByOwner...`);
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        walletPubkey,
        { mint: svmaiMint }
      );

      console.log(`[Token Gating] Found ${tokenAccounts.value.length} token accounts`);
      
      // Sum up balances from all token accounts
      for (const tokenAccount of tokenAccounts.value) {
        const accountInfo = tokenAccount.account.data.parsed.info;
        console.log(`[Token Gating] Token account details:`, {
          mint: accountInfo.mint,
          tokenAmount: accountInfo.tokenAmount
        });
        
        // Double check the mint address and use exact string comparison
        if (accountInfo.mint === SVMAI_MINT_ADDRESS) {
          const uiAmount = accountInfo.tokenAmount.uiAmount;
          const amount = accountInfo.tokenAmount.amount;
          const decimals = accountInfo.tokenAmount.decimals;
          
          // Use uiAmount if available, otherwise calculate from amount and decimals
          if (uiAmount !== null && uiAmount !== undefined) {
            totalBalance += parseFloat(uiAmount);
          } else if (amount && decimals !== undefined) {
            totalBalance += parseFloat(amount) / Math.pow(10, decimals);
          }
          
          console.log(`[Token Gating] Token account found: mint=${accountInfo.mint}, uiAmount=${uiAmount}, amount=${amount}, decimals=${decimals}`);
        }
      }
    } catch (parseError) {
      console.warn(`[Token Gating] getParsedTokenAccountsByOwner failed:`, parseError);
      
      // Method 2: Fallback to getTokenAccountsByOwner (unparsed)
      try {
        console.log(`[Token Gating] Trying fallback method getTokenAccountsByOwner`);
        const tokenAccounts = await connection.getTokenAccountsByOwner(
          walletPubkey,
          { mint: svmaiMint }
        );
        
        console.log(`[Token Gating] Found ${tokenAccounts.value.length} token accounts (unparsed)`);
        
        for (const tokenAccount of tokenAccounts.value) {
          const accountInfo = await connection.getParsedAccountInfo(tokenAccount.pubkey);
          if (accountInfo.value?.data && 'parsed' in accountInfo.value.data) {
            const parsedInfo = accountInfo.value.data.parsed.info;
            if (parsedInfo.mint === SVMAI_MINT_ADDRESS) {
              const uiAmount = parsedInfo.tokenAmount.uiAmount;
              if (uiAmount !== null && uiAmount !== undefined) {
                totalBalance += parseFloat(uiAmount);
              }
              console.log(`[Token Gating] Fallback method found balance: ${uiAmount}`);
            }
          }
        }
      } catch (fallbackError) {
        console.error(`[Token Gating] Both methods failed:`, fallbackError);
        // Instead of throwing, continue with balance 0 and provide detailed error
        return {
          hasAccess: false,
          balance: 0,
          error: `Failed to fetch token balance: ${fallbackError.message}`
        };
      }
    }
    
    console.log(`[Token Gating] Total SVMAI balance for ${walletAddress}: ${totalBalance}`);
    console.log(`[Token Gating] Required balance: ${MIN_SVMAI_BALANCE}`);
    console.log(`[Token Gating] Has access: ${totalBalance >= MIN_SVMAI_BALANCE}`);

    return {
      hasAccess: totalBalance >= MIN_SVMAI_BALANCE,
      balance: totalBalance
    };
  } catch (error) {
    console.error('Error checking SVMAI balance:', error);
    
    // In development, allow access even if there's an error
    if (IS_DEVELOPMENT || BYPASS_TOKEN_GATING) {
      return {
        hasAccess: true,
        balance: MIN_SVMAI_BALANCE + 1000,
        error: 'Development mode - bypassing token check'
      };
    }
    
    return {
      hasAccess: false,
      balance: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get SVMAI token balance for a wallet address
 * @param walletAddress The wallet address to check
 * @returns Promise<number> The token balance
 */
export async function getSVMAIBalance(walletAddress: string): Promise<number> {
  const result = await checkSVMAIAccess(walletAddress);
  return result.balance;
}

/**
 * Check if a user has access to view profile history based on SVMAI holdings
 * @param walletAddress The wallet address to check
 * @returns Promise<boolean> Whether the user has access
 */
export async function hasProfileHistoryAccess(walletAddress: string): Promise<boolean> {
  const result = await checkSVMAIAccess(walletAddress);
  return result.hasAccess;
}
