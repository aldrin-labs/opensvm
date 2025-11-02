import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/solana-connection-server';
import { cache } from '@/lib/cache';
import { TOKEN_MINTS, TOKEN_MULTIPLIERS, MAX_BURN_AMOUNTS } from '@/lib/config/tokens';
import { boostMutex } from '@/lib/mutex';
import { burnRateLimiter, generalRateLimiter } from '@/lib/rate-limiter';
import { getClientIP } from '@/lib/utils/client-ip';
import { PublicKey } from '@solana/web3.js';

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

// Calculate trending score based on real validator performance metrics
const calculateTrendingScore = (validator: any, _depositVolume: number, boost?: BoostPurchase): number => {
  let score = 0;

  // Base score from actual validator performance metrics (0-1000 points)
  // This replaces the mock deposit volume with real validator performance

  // 1. Stake growth scoring (0-300 points)
  // Higher activated stake indicates validator popularity and trust
  const stakeScore = Math.min(validator.activatedStake / 1e12, 300);
  score += stakeScore;

  // 2. Performance scoring (0-400 points)
  // High uptime and low commission are key indicators
  if (validator.uptimePercent) {
    score += (validator.uptimePercent / 100) * 200; // Up to 200 points for perfect uptime
  }

  // Lower commission is better for stakers
  const commissionBonus = Math.max(0, (10 - validator.commission) * 20); // Up to 200 points for 0% commission
  score += Math.min(commissionBonus, 200);

  // 3. APY scoring (0-200 points)
  // Higher APY attracts more stakers
  if (validator.apy) {
    score += Math.min(validator.apy * 25, 200); // Up to 200 points for 8% APY
  }

  // 4. Performance score from validator analytics (0-100 points)
  if (validator.performanceScore) {
    score += validator.performanceScore; // Direct performance score from analytics
  }

  // Boost multiplier based on total burned $SVMAI (promotional system)
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
  signature: string,
  expectedBurner: string,
  expectedAmount: number
): Promise<{ valid: boolean; error?: string }> {
  try {
    // 🔒 SECURITY: Input validation first
    if (!signature || typeof signature !== 'string' || signature.length !== 88) {
      return { valid: false, error: 'Invalid transaction signature format' };
    }

    if (!expectedBurner || typeof expectedBurner !== 'string') {
      return { valid: false, error: 'Invalid burner address' };
    }

    if (!expectedAmount || typeof expectedAmount !== 'number' || expectedAmount <= 0) {
      return { valid: false, error: 'Invalid burn amount' };
    }

    // Validate expected burner address format
    try {
      const burnerPubkey = new PublicKey(expectedBurner);
      if (!burnerPubkey) {
        return { valid: false, error: 'Invalid burner public key format' };
      }
    } catch (error) {
      return { valid: false, error: 'Invalid burner public key' };
    }

    const connection = await getConnection();

    // Get transaction details with timeout protection
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    let tx;
    try {
      tx = await connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });
      clearTimeout(timeoutId);
    } catch (error) {
      clearTimeout(timeoutId);
      return { valid: false, error: 'Failed to fetch transaction from blockchain' };
    }

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

      // 🔒 SECURITY: Validate instruction structure
      if (!ix || typeof ix.programIdIndex !== 'number') {
        continue;
      }

      const programId = messageAccountKeys[ix.programIdIndex]?.toBase58();

      // Check if this is a token program instruction
      if (programId === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') {
        // Decode the instruction data to check if it's a burn instruction
        const data = ix.data;

        // 🔒 SECURITY: Validate instruction data
        if (!data || !Array.isArray(data) || data.length < 9) {
          continue;
        }

        // Burn instruction has first byte = 8
        if (data[0] === 8) {
          try {
            // Extract burn amount (8 bytes starting at position 1)
            const amountBytes = data.slice(1, 9);
            if (amountBytes.length !== 8) {
              continue;
            }

            const amount = Buffer.from(amountBytes).readBigUInt64LE();
            burnAmount = Number(amount) / TOKEN_MULTIPLIERS.SVMAI;

            // 🔒 SECURITY: Validate burn amount range
            if (burnAmount < 0 || burnAmount > 1000000000) { // Max 1B tokens
              return { valid: false, error: 'Burn amount out of valid range' };
            }

            // Get the token account and verify its owner
            if (ix.accounts && ix.accounts.length > 0) {
              const tokenAccountIndex = ix.accounts[0];

              // 🔒 SECURITY: Validate account index
              if (typeof tokenAccountIndex !== 'number' || tokenAccountIndex < 0 || tokenAccountIndex >= messageAccountKeys.length) {
                return { valid: false, error: 'Invalid token account index in burn instruction' };
              }

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
          } catch (parseError) {
            console.error('Error parsing burn instruction:', parseError);
            continue;
          }
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

        // 🔒 SECURITY: Validate balance values
        if (isNaN(preBal) || isNaN(postBal) || preBal < 0 || postBal < 0) {
          continue;
        }

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
    const cached = await cache.get<TrendingValidator[]>(TRENDING_CACHE_KEY);
    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached,
        cached: true,
        timestamp: Date.now()
      });
    }

    // Fetch validator data from main endpoint with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    let validatorsData;
    try {
      const validatorsResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/analytics/validators`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!validatorsResponse.ok) {
        throw new Error(`HTTP ${validatorsResponse.status}: ${validatorsResponse.statusText}`);
      }

      validatorsData = await validatorsResponse.json();

      if (!validatorsData.success) {
        throw new Error(`Failed to fetch validator data: ${validatorsData.error || 'Unknown error'}`);
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.warn('Validator data fetch failed, returning empty trending list:', fetchError);

      // Return empty array instead of fallback validators
      return NextResponse.json({
        success: true,
        data: [],
        cached: false,
        fallback: false,
        error: fetchError instanceof Error ? fetchError.message : 'Unknown error',
        timestamp: Date.now()
      });
    }

    const validators = validatorsData.data.validators;
    const activeBoosts = await cache.get<BoostPurchase[]>(BOOSTS_CACHE_KEY) || [];

    // Calculate trending validators based on real metrics instead of mock data
    const trendingValidators: TrendingValidator[] = await Promise.all(
      validators
        .slice(0, 100) // Only consider top 100 validators for trending
        .map(async (validator: any) => {
          // Calculate real trending score based on validator performance metrics
          const boost = activeBoosts.find(b => b.voteAccount === validator.voteAccount);
          const trendingScore = calculateTrendingScore(validator, 0, boost);

          // Use actual validator performance to determine trending reason
          let trendingReason: 'volume' | 'boost' = 'volume';
          if (boost && boost.purchaseTime + (boost.duration * 3600000) > Date.now()) {
            trendingReason = 'boost';
          }

          return {
            voteAccount: validator.voteAccount,
            name: validator.name,
            commission: validator.commission,
            activatedStake: validator.activatedStake,
            depositVolume24h: 0, // Real implementation would track actual staking deposits
            boostEndTime: boost ? boost.purchaseTime + (boost.duration * 3600000) : undefined,
            boostAmount: boost?.totalBurned,
            trendingScore,
            trendingReason,
            rank: 0 // Will be set after sorting
          };
        })
    );

    // Sort and rank the validators
    const rankedTrendingValidators = trendingValidators
      .sort((a: TrendingValidator, b: TrendingValidator) => b.trendingScore - a.trendingScore)
      .slice(0, 20) // Top 20 trending validators for better variety
      .map((validator: TrendingValidator, index: number) => ({
        ...validator,
        rank: index + 1
      }));

    // Cache for 5 minutes
    await cache.set(TRENDING_CACHE_KEY, rankedTrendingValidators, 300);

    return NextResponse.json({
      success: true,
      data: rankedTrendingValidators,
      cached: false,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Error fetching trending validators:', error);
    return NextResponse.json({
      success: false,
      data: null,
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
        retryAfter: burnRateLimitResult.retryAfter,
        data: null
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

    // 🔒 SECURITY: Parse and validate request body
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'Invalid JSON in request body',
        data: null
      }, { status: 400 });
    }

    const { voteAccount, burnAmount, burnSignature, burnerWallet } = requestBody;

    // 🔒 SECURITY: Comprehensive input validation
    if (!voteAccount || typeof voteAccount !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Invalid or missing voteAccount parameter',
        data: null
      }, { status: 400 });
    }

    if (!burnAmount || typeof burnAmount !== 'number' || isNaN(burnAmount)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid or missing burnAmount parameter',
        data: null
      }, { status: 400 });
    }

    if (!burnSignature || typeof burnSignature !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Invalid or missing burnSignature parameter',
        data: null
      }, { status: 400 });
    }

    if (!burnerWallet || typeof burnerWallet !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Invalid or missing burnerWallet parameter',
        data: null
      }, { status: 400 });
    }

    // 🔒 SECURITY: Validate Solana address formats
    try {
      new PublicKey(voteAccount);
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'Invalid voteAccount format',
        data: null
      }, { status: 400 });
    }

    try {
      new PublicKey(burnerWallet);
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'Invalid burnerWallet format',
        data: null
      }, { status: 400 });
    }

    // 🔒 SECURITY: Validate transaction signature format
    if (burnSignature.length !== 88 || !/^[1-9A-HJ-NP-Za-km-z]+$/.test(burnSignature)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid transaction signature format',
        data: null
      }, { status: 400 });
    }

    // 📊 BUSINESS LOGIC: Validate burn amount ranges
    if (burnAmount < 1000) {
      return NextResponse.json({
        success: false,
        error: 'Minimum burn amount is 1000 $SVMAI',
        data: null
      }, { status: 400 });
    }

    if (burnAmount > MAX_BURN_AMOUNTS.SVMAI) {
      return NextResponse.json({
        success: false,
        error: `Maximum burn amount is ${MAX_BURN_AMOUNTS.SVMAI.toLocaleString()} $SVMAI`,
        data: null
      }, { status: 400 });
    }

    // 🔒 SECURITY: Additional amount validation
    if (!Number.isFinite(burnAmount) || burnAmount <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Burn amount must be a positive finite number',
        data: null
      }, { status: 400 });
    }

    // Verify burn transaction on-chain
    const verification = await verifyBurnTransaction(
      burnSignature,
      burnerWallet,
      burnAmount
    );

    if (!verification.valid) {
      return NextResponse.json({
        success: false,
        error: `Burn verification failed: ${verification.error}`,
        data: null
      }, { status: 400 });
    }

    // Acquire mutex to prevent race conditions FIRST
    const release = await boostMutex.acquire();

    try {
      // Check if this signature has already been used (inside mutex)
      const usedSignaturesCached = await cache.get<string[]>(USED_SIGNATURES_CACHE_KEY) || [];
      const usedSignatures = new Set(usedSignaturesCached);
      if (usedSignatures.has(burnSignature)) {
        return NextResponse.json({
          success: false,
          error: 'This burn transaction has already been used for a boost',
          data: null
        }, { status: 400 });
      }

      // Add signature to used set with safe TTL calculation
      usedSignatures.add(burnSignature);
      const THIRTY_DAYS_SECS = 30 * 24 * 60 * 60; // Calculate in seconds

      // 📊 PERFORMANCE: Limit cache size to prevent memory exhaustion
      let signaturesToCache = Array.from(usedSignatures);
      if (signaturesToCache.length > 10000) {
        // Keep the last 5000 entries
        signaturesToCache = signaturesToCache.slice(-5000);
      }
      await cache.set(USED_SIGNATURES_CACHE_KEY, signaturesToCache, THIRTY_DAYS_SECS);

      // Get current boosts
      const currentBoosts = await cache.get<BoostPurchase[]>(BOOSTS_CACHE_KEY) || [];

      // Check if there's an existing boost for this validator
      const existingBoostIndex = currentBoosts.findIndex(b => b.voteAccount === voteAccount);

      let totalBurned = burnAmount;

      if (existingBoostIndex >= 0) {
        // 📊 BUSINESS LOGIC: Add to existing boost - amounts stack up and timer resets
        const existingBoost = currentBoosts[existingBoostIndex];
        totalBurned = existingBoost.totalBurned + burnAmount;

        // 🔒 SECURITY: Validate total burn amount doesn't exceed limits
        if (totalBurned > MAX_BURN_AMOUNTS.SVMAI * 10) { // Allow 10x max for cumulative
          return NextResponse.json({
            success: false,
            error: `Total burned amount would exceed maximum limit`,
            data: null
          }, { status: 400 });
        }

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
      const now = Date.now();
      const activeBoosts = currentBoosts.filter(
        boost => boost.purchaseTime + (boost.duration * 3600000) > now
      );

      // 📊 PERFORMANCE: Limit the number of active boosts to prevent memory issues
      if (activeBoosts.length > 1000) {
        // Keep only the most recent 500 boosts
        activeBoosts.sort((a, b) => b.purchaseTime - a.purchaseTime);
        activeBoosts.splice(500);
      }

      // Cache updated boosts for 25 hours
      await cache.set(BOOSTS_CACHE_KEY, activeBoosts, 25 * 3600);

      // Clear trending cache to force recalculation
      await cache.del(TRENDING_CACHE_KEY);

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
      error: error instanceof Error ? error.message : 'Unknown error',
      data: null
    }, { status: 500 });
  }
}
