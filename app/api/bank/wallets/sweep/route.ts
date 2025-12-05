import { NextRequest, NextResponse } from 'next/server';
import { qdrantClient } from '@/lib/search/qdrant';
import { getSessionFromCookie } from '@/lib/api-auth/auth-server';
import { decryptPrivateKey } from '@/lib/bank/encryption';
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  Keypair,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  ComputeBudgetProgram
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  createCloseAccountInstruction,
  getAccount
} from '@solana/spl-token';

const COLLECTION_NAME = 'svm_bank_wallets';

interface SweepRequest {
  sourceWalletIds: string[]; // Wallets to sweep from
  destinationWalletId?: string; // Destination managed wallet (if internal)
  destinationAddress?: string; // External destination address
  sweepTokens?: boolean; // Also sweep SPL tokens (default: true)
  closeEmptyAccounts?: boolean; // Close empty token accounts after sweep (default: true)
  leaveMinimumSOL?: number; // Leave minimum SOL for rent (default: 0.001)
}

interface WalletPayload {
  id: string;
  userWallet: string;
  address: string;
  encryptedPrivateKey: string;
  name: string;
  requiresHardwareSignature?: boolean;
}

interface SweepResult {
  walletId: string;
  walletName: string;
  walletAddress: string;
  success: boolean;
  signature?: string;
  solSwept: number;
  tokensSwept: Array<{ mint: string; amount: number }>;
  accountsClosed: number;
  error?: string;
}

function getSolanaConnection(): Connection {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

/**
 * POST /api/bank/wallets/sweep
 * Sweep all assets from multiple wallets to a single destination
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromCookie();
    if (!session?.walletAddress) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const userWallet = session.walletAddress;
    const body: SweepRequest = await req.json();
    const {
      sourceWalletIds,
      destinationWalletId,
      destinationAddress,
      sweepTokens = true,
      closeEmptyAccounts = true,
      leaveMinimumSOL = 0.001
    } = body;

    // Validate request
    if (!sourceWalletIds || sourceWalletIds.length === 0) {
      return NextResponse.json(
        { error: 'No source wallets provided' },
        { status: 400 }
      );
    }

    if (!destinationWalletId && !destinationAddress) {
      return NextResponse.json(
        { error: 'No destination provided' },
        { status: 400 }
      );
    }

    // Resolve destination address
    let destAddress: string;
    let destName: string | null = null;

    if (destinationWalletId) {
      const destResult = await qdrantClient.retrieve(COLLECTION_NAME, {
        ids: [destinationWalletId],
        with_payload: true
      });

      if (destResult.length === 0) {
        return NextResponse.json(
          { error: 'Destination wallet not found' },
          { status: 404 }
        );
      }

      const destWallet = destResult[0].payload as WalletPayload;

      if (destWallet.userWallet !== userWallet) {
        return NextResponse.json(
          { error: 'Not authorized to sweep to this wallet' },
          { status: 403 }
        );
      }

      destAddress = destWallet.address;
      destName = destWallet.name;
    } else {
      try {
        new PublicKey(destinationAddress!);
        destAddress = destinationAddress!;
      } catch {
        return NextResponse.json(
          { error: 'Invalid destination address' },
          { status: 400 }
        );
      }
    }

    // Fetch all source wallets
    const sourceResult = await qdrantClient.retrieve(COLLECTION_NAME, {
      ids: sourceWalletIds,
      with_payload: true
    });

    if (sourceResult.length === 0) {
      return NextResponse.json(
        { error: 'No source wallets found' },
        { status: 404 }
      );
    }

    const sourceWallets = sourceResult.map(r => r.payload as WalletPayload);

    // Verify ownership and check for hardware wallets
    for (const wallet of sourceWallets) {
      if (wallet.userWallet !== userWallet) {
        return NextResponse.json(
          { error: `Not authorized to sweep from wallet ${wallet.id}` },
          { status: 403 }
        );
      }

      if (wallet.requiresHardwareSignature) {
        return NextResponse.json(
          { error: `Wallet "${wallet.name}" requires hardware signature. Cannot be included in batch sweep.` },
          { status: 400 }
        );
      }

      if (wallet.address === destAddress) {
        return NextResponse.json(
          { error: `Cannot sweep wallet "${wallet.name}" to itself` },
          { status: 400 }
        );
      }
    }

    const connection = getSolanaConnection();
    const destPubkey = new PublicKey(destAddress);
    const results: SweepResult[] = [];
    let totalSolSwept = 0;
    let totalTokensSwept = 0;
    let totalAccountsClosed = 0;

    // Process each source wallet
    for (const sourceWallet of sourceWallets) {
      const result: SweepResult = {
        walletId: sourceWallet.id,
        walletName: sourceWallet.name,
        walletAddress: sourceWallet.address,
        success: false,
        solSwept: 0,
        tokensSwept: [],
        accountsClosed: 0
      };

      try {
        // Decrypt private key
        const privateKeyBytes = decryptPrivateKey(sourceWallet.encryptedPrivateKey, userWallet);
        const sourceKeypair = Keypair.fromSecretKey(privateKeyBytes);
        const sourcePubkey = new PublicKey(sourceWallet.address);

        const transaction = new Transaction();

        // Add priority fee for faster processing
        transaction.add(
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 })
        );

        let instructionCount = 0;

        // Get SOL balance
        const solBalance = await connection.getBalance(sourcePubkey);
        const availableSOL = (solBalance / LAMPORTS_PER_SOL) - leaveMinimumSOL;

        // Sweep tokens first (if enabled)
        if (sweepTokens) {
          // Fetch token accounts
          const [tokenAccounts, token2022Accounts] = await Promise.all([
            connection.getParsedTokenAccountsByOwner(sourcePubkey, { programId: TOKEN_PROGRAM_ID }),
            connection.getParsedTokenAccountsByOwner(sourcePubkey, { programId: TOKEN_2022_PROGRAM_ID })
          ]);

          const allTokenAccounts = [
            ...tokenAccounts.value.map(a => ({ ...a, programId: TOKEN_PROGRAM_ID })),
            ...token2022Accounts.value.map(a => ({ ...a, programId: TOKEN_2022_PROGRAM_ID }))
          ];

          for (const { pubkey, account, programId } of allTokenAccounts) {
            const parsedInfo = account.data.parsed.info;
            const mint = parsedInfo.mint;
            const amount = BigInt(parsedInfo.tokenAmount.amount);
            const decimals = parsedInfo.tokenAmount.decimals;
            const uiAmount = parsedInfo.tokenAmount.uiAmount || 0;

            if (amount > BigInt(0)) {
              // Get or create destination ATA
              const destAta = await getAssociatedTokenAddress(
                new PublicKey(mint),
                destPubkey,
                false,
                programId
              );

              const destAtaInfo = await connection.getAccountInfo(destAta);
              if (!destAtaInfo) {
                transaction.add(
                  createAssociatedTokenAccountInstruction(
                    sourcePubkey,
                    destAta,
                    destPubkey,
                    new PublicKey(mint),
                    programId
                  )
                );
                instructionCount++;
              }

              // Transfer tokens
              transaction.add(
                createTransferInstruction(
                  pubkey,
                  destAta,
                  sourcePubkey,
                  amount,
                  [],
                  programId
                )
              );
              instructionCount++;

              result.tokensSwept.push({ mint, amount: uiAmount });

              // Close empty account after transfer
              if (closeEmptyAccounts) {
                transaction.add(
                  createCloseAccountInstruction(
                    pubkey,
                    sourcePubkey,
                    sourcePubkey,
                    [],
                    programId
                  )
                );
                instructionCount++;
                result.accountsClosed++;
              }
            } else if (closeEmptyAccounts) {
              // Close empty token account
              transaction.add(
                createCloseAccountInstruction(
                  pubkey,
                  sourcePubkey,
                  sourcePubkey,
                  [],
                  programId
                )
              );
              instructionCount++;
              result.accountsClosed++;
            }

            // Limit instructions per transaction
            if (instructionCount >= 15) break;
          }
        }

        // Sweep SOL (leave minimum for rent/fees)
        if (availableSOL > 0.0001) {
          // Calculate fee estimate
          const estimatedFee = 0.00005 + (instructionCount * 0.000005);
          const solToSweep = Math.max(0, availableSOL - estimatedFee);

          if (solToSweep > 0.0001) {
            const lamportsToSweep = Math.floor(solToSweep * LAMPORTS_PER_SOL);

            transaction.add(
              SystemProgram.transfer({
                fromPubkey: sourcePubkey,
                toPubkey: destPubkey,
                lamports: lamportsToSweep
              })
            );

            result.solSwept = solToSweep;
          }
        }

        // Skip if no instructions
        if (transaction.instructions.length <= 1) {
          result.success = true;
          result.error = 'Nothing to sweep';
          results.push(result);
          continue;
        }

        // Send transaction
        const signature = await sendAndConfirmTransaction(
          connection,
          transaction,
          [sourceKeypair],
          { commitment: 'confirmed' }
        );

        result.success = true;
        result.signature = signature;
        totalSolSwept += result.solSwept;
        totalTokensSwept += result.tokensSwept.length;
        totalAccountsClosed += result.accountsClosed;

      } catch (error) {
        result.error = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Sweep failed for wallet ${sourceWallet.id}:`, error);
      }

      results.push(result);
    }

    const successCount = results.filter(r => r.success && !r.error?.includes('Nothing to sweep')).length;
    const failedCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: failedCount === 0,
      message: `Sweep complete: ${successCount} wallet(s) swept, ${failedCount} failed`,
      destination: {
        address: destAddress,
        name: destName
      },
      results,
      summary: {
        totalWalletsProcessed: results.length,
        successfulSweeps: successCount,
        failedSweeps: failedCount,
        totalSolSwept,
        totalTokensSwept,
        totalAccountsClosed
      }
    });

  } catch (error) {
    console.error('Sweep error:', error);
    return NextResponse.json(
      { error: 'Sweep failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/bank/wallets/sweep
 * Preview what would be swept from selected wallets
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookie();
    if (!session?.walletAddress) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const userWallet = session.walletAddress;
    const walletIds = req.nextUrl.searchParams.get('walletIds')?.split(',') || [];

    if (walletIds.length === 0) {
      return NextResponse.json(
        { error: 'No wallet IDs provided' },
        { status: 400 }
      );
    }

    // Fetch wallets
    const result = await qdrantClient.retrieve(COLLECTION_NAME, {
      ids: walletIds,
      with_payload: true
    });

    const wallets = result.map(r => r.payload as WalletPayload);

    // Verify ownership
    for (const wallet of wallets) {
      if (wallet.userWallet !== userWallet) {
        return NextResponse.json(
          { error: 'Not authorized' },
          { status: 403 }
        );
      }
    }

    const connection = getSolanaConnection();
    const preview: Array<{
      walletId: string;
      walletName: string;
      walletAddress: string;
      solBalance: number;
      tokens: Array<{ mint: string; symbol: string; amount: number; usdValue: number }>;
      emptyAccounts: number;
      requiresHardwareSignature: boolean;
    }> = [];

    let totalSol = 0;
    let totalTokenAccounts = 0;
    let totalEmptyAccounts = 0;

    for (const wallet of wallets) {
      const pubkey = new PublicKey(wallet.address);

      // Get SOL balance
      const solBalance = await connection.getBalance(pubkey);
      const solAmount = solBalance / LAMPORTS_PER_SOL;
      totalSol += solAmount;

      // Get token accounts
      const [tokenAccounts, token2022Accounts] = await Promise.all([
        connection.getParsedTokenAccountsByOwner(pubkey, { programId: TOKEN_PROGRAM_ID }),
        connection.getParsedTokenAccountsByOwner(pubkey, { programId: TOKEN_2022_PROGRAM_ID })
      ]);

      const allAccounts = [...tokenAccounts.value, ...token2022Accounts.value];
      const tokens: Array<{ mint: string; symbol: string; amount: number; usdValue: number }> = [];
      let emptyAccounts = 0;

      for (const { account } of allAccounts) {
        const parsedInfo = account.data.parsed.info;
        const amount = parsedInfo.tokenAmount.uiAmount || 0;

        if (amount > 0) {
          tokens.push({
            mint: parsedInfo.mint,
            symbol: parsedInfo.mint.slice(0, 4) + '...',
            amount,
            usdValue: 0 // Would need price lookup
          });
          totalTokenAccounts++;
        } else {
          emptyAccounts++;
          totalEmptyAccounts++;
        }
      }

      preview.push({
        walletId: wallet.id,
        walletName: wallet.name,
        walletAddress: wallet.address,
        solBalance: solAmount,
        tokens,
        emptyAccounts,
        requiresHardwareSignature: wallet.requiresHardwareSignature || false
      });
    }

    return NextResponse.json({
      preview,
      summary: {
        totalWallets: preview.length,
        totalSol,
        totalTokenAccounts,
        totalEmptyAccounts,
        estimatedRentReclaim: totalEmptyAccounts * 0.00203928,
        walletsRequiringHardware: preview.filter(p => p.requiresHardwareSignature).length
      }
    });

  } catch (error) {
    console.error('Sweep preview error:', error);
    return NextResponse.json(
      { error: 'Failed to generate preview' },
      { status: 500 }
    );
  }
}
