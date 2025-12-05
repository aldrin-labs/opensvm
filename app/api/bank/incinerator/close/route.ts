import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/api-auth/auth-server';
import { 
  Connection, 
  PublicKey, 
  Transaction,
  TransactionInstruction
} from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  TOKEN_2022_PROGRAM_ID,
  createCloseAccountInstruction,
  createBurnInstruction,
  getAccount
} from '@solana/spl-token';

interface CloseRequest {
  accounts: string[]; // Array of token account pubkeys to close
  burnDust?: boolean; // Whether to burn dust tokens before closing
}

interface CloseResponse {
  transaction: string; // Base64 encoded serialized transaction
  accountsToClose: number;
  estimatedRentReclaim: number;
  message: string;
}

/**
 * Get Solana connection
 */
function getSolanaConnection(): Connection {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

/**
 * POST /api/bank/incinerator/close
 * Build a transaction to close selected token accounts
 * Returns a serialized transaction for the user to sign
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

    const walletAddress = session.walletAddress;
    const walletPubkey = new PublicKey(walletAddress);
    const connection = getSolanaConnection();
    
    // Parse request body
    const body: CloseRequest = await req.json();
    const { accounts, burnDust = false } = body;
    
    if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
      return NextResponse.json(
        { error: 'No accounts provided' },
        { status: 400 }
      );
    }
    
    // Limit to max 20 accounts per transaction (to avoid transaction size limits)
    if (accounts.length > 20) {
      return NextResponse.json(
        { error: 'Too many accounts. Maximum 20 accounts per transaction.' },
        { status: 400 }
      );
    }
    
    // Validate all accounts and check ownership
    const instructions: TransactionInstruction[] = [];
    let validAccountsCount = 0;
    
    for (const accountPubkeyStr of accounts) {
      try {
        const tokenAccountPubkey = new PublicKey(accountPubkeyStr);
        
        // Fetch the token account info - try both TOKEN_PROGRAM_ID and TOKEN_2022_PROGRAM_ID
        let tokenAccountInfo;
        let programId = TOKEN_PROGRAM_ID;
        
        try {
          tokenAccountInfo = await getAccount(connection, tokenAccountPubkey, 'confirmed', TOKEN_PROGRAM_ID);
        } catch {
          // Try Token-2022 program
          try {
            tokenAccountInfo = await getAccount(connection, tokenAccountPubkey, 'confirmed', TOKEN_2022_PROGRAM_ID);
            programId = TOKEN_2022_PROGRAM_ID;
          } catch (e) {
            console.error(`Account ${accountPubkeyStr} not found in either token program`);
            continue;
          }
        }
        
        // Verify the owner is the authenticated user
        if (tokenAccountInfo.owner.toString() !== walletAddress) {
          console.warn(`Token account ${accountPubkeyStr} not owned by ${walletAddress}`);
          continue;
        }
        
        // Check if account is frozen - frozen accounts cannot be closed
        if (tokenAccountInfo.isFrozen) {
          console.warn(`Token account ${accountPubkeyStr} is frozen, skipping`);
          continue;
        }
        
        // If there's a balance and burnDust is true, add burn instruction first
        if (tokenAccountInfo.amount > BigInt(0)) {
          if (burnDust) {
            // Add burn instruction to destroy the dust tokens
            const burnIx = createBurnInstruction(
              tokenAccountPubkey,
              tokenAccountInfo.mint,
              walletPubkey,
              tokenAccountInfo.amount,
              [],
              programId
            );
            instructions.push(burnIx);
          } else {
            // Skip accounts with balance if burnDust is false
            console.warn(`Token account ${accountPubkeyStr} has balance, skipping (burnDust=false)`);
            continue;
          }
        }
        
        // Add close account instruction
        // The rent lamports will be sent to the wallet owner
        const closeIx = createCloseAccountInstruction(
          tokenAccountPubkey,
          walletPubkey, // destination for rent lamports
          walletPubkey, // authority (must be the owner)
          [],
          programId
        );
        instructions.push(closeIx);
        validAccountsCount++;
        
      } catch (accountError) {
        console.error(`Error processing account ${accountPubkeyStr}:`, accountError);
        // Skip invalid accounts
        continue;
      }
    }
    
    if (instructions.length === 0) {
      return NextResponse.json(
        { error: 'No valid accounts to close' },
        { status: 400 }
      );
    }
    
    // Create transaction
    const transaction = new Transaction();
    transaction.add(...instructions);
    
    // Get latest blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = walletPubkey;
    
    // Serialize the transaction
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });
    
    // Estimate rent reclaim (approximately 0.00203928 SOL per account)
    const rentPerAccount = 0.00203928;
    const estimatedRentReclaim = validAccountsCount * rentPerAccount;
    
    const response: CloseResponse = {
      transaction: serializedTransaction.toString('base64'),
      accountsToClose: validAccountsCount,
      estimatedRentReclaim,
      message: `Transaction ready to close ${validAccountsCount} token account(s). Estimated rent reclaim: ~${estimatedRentReclaim.toFixed(6)} SOL`
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Error building close transaction:', error);
    return NextResponse.json(
      { error: 'Failed to build close transaction', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
