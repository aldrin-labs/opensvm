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
    
    console.log(`[Token Gating] Getting token accounts for wallet: ${walletPubkey.toString()}`);
    console.log(`[Token Gating] Connection endpoint: ${connection.rpcEndpoint || 'unknown'}`);
    console.log(`[Token Gating] Target mint: ${SVMAI_MINT_ADDRESS}`);
    
    let totalBalance = 0;
    
    // Method 1: Fetch ALL token accounts and search for SVMAI token
    // This is more robust than using mint filter which may not work with all RPC endpoints
    try {
      console.log(`[Token Gating] Method 1: Fetching ALL token accounts for wallet...`);
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        walletPubkey,
        { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
      );

      console.log(`[Token Gating] Found ${tokenAccounts.value.length} total token accounts`);
      
      // Search through all token accounts to find SVMAI tokens
      for (const tokenAccount of tokenAccounts.value) {
        const accountInfo = tokenAccount.account.data.parsed.info;
        console.log(`[Token Gating] Checking token account - mint: ${accountInfo.mint}`);
        
        // Check if this token account holds SVMAI tokens
        if (accountInfo.mint === SVMAI_MINT_ADDRESS) {
          const uiAmount = accountInfo.tokenAmount.uiAmount;
          const amount = accountInfo.tokenAmount.amount;
          const decimals = accountInfo.tokenAmount.decimals;
          
          console.log(`[Token Gating] ✓ SVMAI token account found!`, {
            mint: accountInfo.mint,
            tokenAmount: accountInfo.tokenAmount
          });
          
          // Use uiAmount if available, otherwise calculate from amount and decimals
          if (uiAmount !== null && uiAmount !== undefined) {
            totalBalance += parseFloat(uiAmount);
          } else if (amount && decimals !== undefined) {
            totalBalance += parseFloat(amount) / Math.pow(10, decimals);
          }
          
          console.log(`[Token Gating] Added to balance: uiAmount=${uiAmount}, amount=${amount}, decimals=${decimals}`);
        }
      }
    } catch (parseError) {
      console.warn(`[Token Gating] Method 1 failed:`, parseError);
      
      // Method 2: Fallback to mint-filtered approach (original method)
      try {
        console.log(`[Token Gating] Method 2: Trying mint-filtered approach...`);
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
          walletPubkey,
          { mint: new PublicKey(SVMAI_MINT_ADDRESS) }
        );
        
        console.log(`[Token Gating] Found ${tokenAccounts.value.length} SVMAI token accounts`);
        
        for (const tokenAccount of tokenAccounts.value) {
          const accountInfo = tokenAccount.account.data.parsed.info;
          console.log(`[Token Gating] Token account details:`, {
            mint: accountInfo.mint,
            tokenAmount: accountInfo.tokenAmount
          });
          
          const uiAmount = accountInfo.tokenAmount.uiAmount;
          const amount = accountInfo.tokenAmount.amount;
          const decimals = accountInfo.tokenAmount.decimals;
          
          // Use uiAmount if available, otherwise calculate from amount and decimals
          if (uiAmount !== null && uiAmount !== undefined) {
            totalBalance += parseFloat(uiAmount);
          } else if (amount && decimals !== undefined) {
            totalBalance += parseFloat(amount) / Math.pow(10, decimals);
          }
          
          console.log(`[Token Gating] Method 2 found balance: ${uiAmount}`);
        }
      } catch (mintFilterError) {
        console.warn(`[Token Gating] Method 2 failed:`, mintFilterError);
        
        // Method 3: Fallback to unparsed token accounts
        try {
          console.log(`[Token Gating] Method 3: Trying unparsed token accounts...`);
          const tokenAccounts = await connection.getTokenAccountsByOwner(
            walletPubkey,
            { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
          );
          
          console.log(`[Token Gating] Found ${tokenAccounts.value.length} unparsed token accounts`);
          
          for (const tokenAccount of tokenAccounts.value) {
            const accountInfo = await connection.getParsedAccountInfo(tokenAccount.pubkey);
            if (accountInfo.value?.data && 'parsed' in accountInfo.value.data) {
              const parsedInfo = accountInfo.value.data.parsed.info;
              if (parsedInfo.mint === SVMAI_MINT_ADDRESS) {
                const uiAmount = parsedInfo.tokenAmount.uiAmount;
                if (uiAmount !== null && uiAmount !== undefined) {
                  totalBalance += parseFloat(uiAmount);
                }
                console.log(`[Token Gating] Method 3 found balance: ${uiAmount}`);
              }
            }
          }
        } catch (unparsedError) {
          console.error(`[Token Gating] All methods failed:`, unparsedError);
          // Instead of throwing, continue with balance 0 and provide detailed error
          return {
            hasAccess: false,
            balance: 0,
            error: `Failed to fetch token balance: ${unparsedError.message}`
          };
        }
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
