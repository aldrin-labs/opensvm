import { NextResponse } from 'next/server';
import { Connection } from '@solana/web3.js';
import { memoryCache } from '@/lib/cache';
import { TOKEN_MINTS, TOKEN_MULTIPLIERS, MAX_BURN_AMOUNTS } from '@/lib/config/tokens';
import { boostMutex } from '@/lib/mutex';
import { burnRateLimiter, generalRateLimiter } from '@/lib/rate-limiter';
import { getClientIP } from '@/lib/utils/client-ip';

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

interface TrendingValidator {
  voteAccount: string;
  name: string;
  commission: number;
  activatedStake: number;
  depositVolume24h: number;
  boostEndTime?: number;
  boostAmount?: number;
  trendingScore: number;
  trendingReason: 'volume' | 'boost';
  rank: number;
}

interface BoostPurchase {
  voteAccount: string;
  burnAmount: number; // $SVMAI amount burned
  totalBurned: number; // Total $SVMAI burned for this validator
  purchaseTime: number;
  burnSignature: string;
  burnerWallet: string;
  duration: number; // hours (always 24)
}

// Cache keys
const TRENDING_CACHE_KEY = 'trending_validators';
const BOOSTS_CACHE_KEY = 'validator_boosts';
const USED_SIGNATURES_CACHE_KEY = 'used_burn_signatures';

// Mock deposit volume data - in a real implementation, this would track actual on-chain deposits
const getMockDepositVolume = (voteAccount: string): number => {
  // Generate deterministic but varying deposit volumes based on vote account
  const hash = voteAccount.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);

  const baseVolume = Math.abs(hash) % 10000;
  const timeVariation = Math.sin(Date.now() / 86400000) * 2000; // Daily variation
  return Math.max(0, baseVolume + timeVariation);
};

// Calculate trending score based on deposit volume and boosts
const calculateTrendingScore = (validator: any, depositVolume: number, boost?: BoostPurchase): number => {
  let score = 0;

  // Base score from deposit volume (0-1000 points)
  score += Math.min(depositVolume / 10, 1000);

  // Stake bonus (0-500 points)
  score += Math.min(validator.activatedStake / 1e12, 500);

  // Performance bonus (0-200 points)
  if (validator.uptimePercent) {
    score += (validator.uptimePercent / 100) * 200;
  }

  // Boost multiplier based on total burned $SVMAI
  if (boost && boost.purchaseTime + (boost.duration * 3600000) > Date.now()) {
    // More aggressive multiplier for burned tokens
    // 1000 $SVMAI = 1.5x, 5000 $SVMAI = 2.5x, 10000 $SVMAI = 4x, etc.
    const multiplier = 1 + (boost.totalBurned / 2000); // Every 2000 $SVMAI adds 1x
    score *= multiplier;
  }

  return Math.round(score);
};

// Verify burn transaction on-chain
async function verifyBurnTransaction(
  connection: Connection,
  signature: string,
  expectedBurner: string,
  expectedAmount: number
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Get transaction details
    const tx = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0
    });

    if (!tx) {
      return { valid: false, error: 'Transaction not found' };
    }

    if (!tx.meta) {
      return { valid: false, error: 'Transaction metadata not available' };
    }

    // Check if transaction was successful
    if (tx.meta.err !== null) {
      return { valid: false, error: 'Transaction failed on-chain' };
    }

    // Find the burn instruction
    let burnFound = false;
    let burnAmount = 0;
    let burnerAccount = '';

    // Check all instructions in the transaction
    // Handle VersionedMessage properly
    let messageInstructions: any[] = [];
    let messageAccountKeys: any[] = [];

    if ('instructions' in tx.transaction.message) {
      messageInstructions = tx.transaction.message.instructions || [];
      messageAccountKeys = tx.transaction.message.accountKeys || [];
    } else {
      // For VersionedMessage, we need to use different approach
      console.warn('VersionedMessage detected, using fallback approach');
      return { valid: false, error: 'VersionedMessage not supported for burn verification' };
    }

    for (let i = 0; i < messageInstructions.length; i++) {
      const ix = messageInstructions[i];
      const programId = messageAccountKeys[ix.programIdIndex]?.toBase58();

      // Check if this is a token program instruction
      if (programId === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') {
        // Decode the instruction data to check if it's a burn instruction
        const data = ix.data;

        // Burn instruction has first byte = 8
        if (data && data[0] === 8) {
          // Extract burn amount (8 bytes starting at position 1)
          const amountBytes = data.slice(1, 9);
          const amount = Buffer.from(amountBytes).readBigUInt64LE();
          burnAmount = Number(amount) / TOKEN_MULTIPLIERS.SVMAI;

          // Get the token account and verify its owner
          if (ix.accounts && ix.accounts.length > 0) {
            const tokenAccountIndex = ix.accounts[0];
            const tokenAccountPubkey = messageAccountKeys[tokenAccountIndex];

            // Get the token account info to verify owner and mint
            try {
              const tokenAccountInfo = await connection.getParsedAccountInfo(tokenAccountPubkey);
              if (tokenAccountInfo.value && tokenAccountInfo.value.data && 'parsed' in tokenAccountInfo.value.data) {
                const parsedData = tokenAccountInfo.value.data.parsed;
                if (parsedData.type === 'account') {
                  // Verify this is the correct token mint
                  if (parsedData.info.mint !== TOKEN_MINTS.SVMAI.toBase58()) {
                    return { valid: false, error: 'Burn transaction is for wrong token mint' };
                  }
                  // Get the owner from parsed data
                  burnerAccount = parsedData.info.owner;
                } else {
                  throw new Error('Invalid token account type');
                }
              } else {
                // Fallback to transaction signer if we can't get parsed account info
                // Use the first signer as the burner (fee payer is typically the token account owner)
                const signers = messageAccountKeys.filter((_: any, idx: number) =>
                  tx.transaction.message.header.numRequiredSignatures > idx
                );
                if (signers.length > 0) {
                  burnerAccount = signers[0].toBase58();
                } else {
                  throw new Error('No signers found in transaction');
                }
              }
            } catch (error) {
              console.error('Error getting token account info:', error);
              // Fallback to transaction signer (with validation)
              const signers = messageAccountKeys.filter((_: any, idx: number) =>
                tx.transaction.message.header.numRequiredSignatures > idx
              );
              if (signers.length > 0) {
                burnerAccount = signers[0].toBase58();
              } else {
                return { valid: false, error: 'Could not determine burner account from transaction' };
              }
            }
          }

          burnFound = true;
          break;
        }
      }
    }

    if (!burnFound) {
      return { valid: false, error: 'No burn instruction found in transaction' };
    }

    // Verify the burner matches
    if (burnerAccount !== expectedBurner) {
      return { valid: false, error: `Burner mismatch: expected ${expectedBurner}, got ${burnerAccount}` };
    }

    // Verify the amount matches (with small tolerance for rounding)
    const tolerance = 0.01; // Allow 0.01 $SVMAI tolerance for rounding
    if (Math.abs(burnAmount - expectedAmount) > tolerance) {
      return { valid: false, error: `Amount mismatch: expected ${expectedAmount}, got ${burnAmount}` };
    }

    // Additional check: verify the mint address in the transaction
    // This requires checking the token account's mint, which we can do by looking at pre/post balances
    const preTokenBalances = tx.meta.preTokenBalances || [];
    const postTokenBalances = tx.meta.postTokenBalances || [];

    // Find a token balance change for our mint
    let mintVerified = false;
    for (let i = 0; i < preTokenBalances.length; i++) {
      const pre = preTokenBalances[i];
      const post = postTokenBalances.find(p => p.accountIndex === pre.accountIndex);

      if (pre.mint === TOKEN_MINTS.SVMAI.toBase58() && post) {
        const preBal = Number(pre.uiTokenAmount.amount);
        const postBal = Number(post.uiTokenAmount.amount);
        const burned = (preBal - postBal) / TOKEN_MULTIPLIERS.SVMAI;

        if (Math.abs(burned - expectedAmount) < tolerance) {
          mintVerified = true;
          break;
        }
      }
    }

    if (!mintVerified) {
      return { valid: false, error: 'Could not verify $SVMAI token burn' };
    }

    return { valid: true };
  } catch (error) {
    console.error('Error verifying burn transaction:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown verification error'
    };
  }
}

export async function GET(request: Request) {
  try {
    // Rate limiting
    const clientIP = getClientIP(request);
    const rateLimitResult = await generalRateLimiter.checkLimit(clientIP);
    if (!rateLimitResult.allowed) {
      return NextResponse.json({
        success: false,
        error: 'Rate limit exceeded. Please try again later.',
        retryAfter: rateLimitResult.retryAfter
      }, {
        status: 429,
        headers: {
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
          'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
        }
      });
    }

    // Check cache first
    const cached = memoryCache.get<TrendingValidator[]>(TRENDING_CACHE_KEY);
    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached,
        cached: true,
        timestamp: Date.now()
      });
    }

    // Fetch validator data from main endpoint
    const validatorsResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/analytics/validators`);
    const validatorsData = await validatorsResponse.json();

    if (!validatorsData.success) {
      throw new Error('Failed to fetch validator data');
    }

    const validators = validatorsData.data.validators;
    const activeBoosts = memoryCache.get<BoostPurchase[]>(BOOSTS_CACHE_KEY) || [];

    // Calculate trending validators
    const trendingValidators: TrendingValidator[] = validators
      .slice(0, 100) // Only consider top 100 validators for trending
      .map((validator: any) => {
        const depositVolume = getMockDepositVolume(validator.voteAccount);
        const boost = activeBoosts.find(b => b.voteAccount === validator.voteAccount);
        const trendingScore = calculateTrendingScore(validator, depositVolume, boost);

        return {
          voteAccount: validator.voteAccount,
          name: validator.name,
          commission: validator.commission,
          activatedStake: validator.activatedStake,
          depositVolume24h: depositVolume,
          boostEndTime: boost ? boost.purchaseTime + (boost.duration * 3600000) : undefined,
          boostAmount: boost?.totalBurned,
          trendingScore,
          trendingReason: boost && boost.purchaseTime + (boost.duration * 3600000) > Date.now() ? 'boost' : 'volume',
          rank: 0 // Will be set after sorting
        };
      })
      .sort((a: TrendingValidator, b: TrendingValidator) => b.trendingScore - a.trendingScore)
      .slice(0, 10) // Top 10 trending validators
      .map((validator: TrendingValidator, index: number) => ({
        ...validator,
        rank: index + 1
      }));

    // Cache for 5 minutes
    memoryCache.set(TRENDING_CACHE_KEY, trendingValidators, 300);

    return NextResponse.json({
      success: true,
      data: trendingValidators,
      cached: false,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Error fetching trending validators:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Rate limiting for burn operations
    const clientIP = getClientIP(request);
    const burnRateLimitResult = await burnRateLimiter.checkLimit(clientIP);
    if (!burnRateLimitResult.allowed) {
      return NextResponse.json({
        success: false,
        error: 'Rate limit exceeded for burn operations. Please try again later.',
        retryAfter: burnRateLimitResult.retryAfter
      }, {
        status: 429,
        headers: {
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': burnRateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': new Date(burnRateLimitResult.resetTime).toISOString(),
          'X-RateLimit-Burst-Remaining': burnRateLimitResult.burstRemaining?.toString() || '0',
          'Retry-After': burnRateLimitResult.retryAfter?.toString() || '60'
        }
      });
    }

    const { voteAccount, burnAmount, burnSignature, burnerWallet } = await request.json();

    if (!voteAccount || !burnAmount || !burnSignature || !burnerWallet) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters'
      }, { status: 400 });
    }

    if (burnAmount < 1000) {
      return NextResponse.json({
        success: false,
        error: 'Minimum burn amount is 1000 $SVMAI'
      }, { status: 400 });
    }

    if (burnAmount > MAX_BURN_AMOUNTS.SVMAI) {
      return NextResponse.json({
        success: false,
        error: `Maximum burn amount is ${MAX_BURN_AMOUNTS.SVMAI.toLocaleString()} $SVMAI`
      }, { status: 400 });
    }

    // Create connection for verification
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

    // Verify burn transaction on-chain
    const verification = await verifyBurnTransaction(
      connection,
      burnSignature,
      burnerWallet,
      burnAmount
    );

    if (!verification.valid) {
      return NextResponse.json({
        success: false,
        error: `Burn verification failed: ${verification.error}`
      }, { status: 400 });
    }

    // Acquire mutex to prevent race conditions FIRST
    const release = await boostMutex.acquire();

    try {
      // Check if this signature has already been used (inside mutex)
      const usedSignatures = memoryCache.get<Set<string>>(USED_SIGNATURES_CACHE_KEY) || new Set();
      if (usedSignatures.has(burnSignature)) {
        return NextResponse.json({
          success: false,
          error: 'This burn transaction has already been used for a boost'
        }, { status: 400 });
      }

      // Add signature to used set with safe TTL calculation
      usedSignatures.add(burnSignature);
      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60; // Calculate in seconds to avoid overflow

      // Limit cache size to prevent memory exhaustion
      if (usedSignatures.size > 10000) {
        // Create a new set with recent signatures (last 5000)
        const entries = Array.from(usedSignatures);
        const recentEntries = entries.slice(-5000); // Keep the last 5000 entries
        const newUsedSignatures = new Set(recentEntries);
        memoryCache.set(USED_SIGNATURES_CACHE_KEY, newUsedSignatures, THIRTY_DAYS_MS);
      } else {
        memoryCache.set(USED_SIGNATURES_CACHE_KEY, usedSignatures, THIRTY_DAYS_MS);
      }

      // Get current boosts
      const currentBoosts = memoryCache.get<BoostPurchase[]>(BOOSTS_CACHE_KEY) || [];

      // Check if there's an existing boost for this validator
      const existingBoostIndex = currentBoosts.findIndex(b => b.voteAccount === voteAccount);

      let totalBurned = burnAmount;

      if (existingBoostIndex >= 0) {
        // Add to existing boost - amounts stack up and timer resets
        const existingBoost = currentBoosts[existingBoostIndex];
        totalBurned = existingBoost.totalBurned + burnAmount;

        // Update existing boost with new totals and reset timer
        currentBoosts[existingBoostIndex] = {
          voteAccount,
          burnAmount,
          totalBurned,
          purchaseTime: Date.now(), // Reset timer to 24h
          burnSignature,
          burnerWallet,
          duration: 24
        };
      } else {
        // Create new boost
        const newBoost: BoostPurchase = {
          voteAccount,
          burnAmount,
          totalBurned,
          purchaseTime: Date.now(),
          burnSignature,
          burnerWallet,
          duration: 24
        };
        currentBoosts.push(newBoost);
      }

      // Clean up expired boosts
      const activeBoosts = currentBoosts.filter(
        boost => boost.purchaseTime + (boost.duration * 3600000) > Date.now()
      );

      // Cache updated boosts for 25 hours
      memoryCache.set(BOOSTS_CACHE_KEY, activeBoosts, 25 * 3600);

      // Clear trending cache to force recalculation
      memoryCache.delete(TRENDING_CACHE_KEY);

      return NextResponse.json({
        success: true,
        data: {
          burnAmount,
          totalBurned,
          message: `Successfully burned ${burnAmount} $SVMAI. Total burned for this validator: ${totalBurned} $SVMAI. Timer reset to 24 hours.`
        }
      });
    } finally {
      // Always release the mutex
      release();
    }

  } catch (error) {
    console.error('Error processing burn:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}