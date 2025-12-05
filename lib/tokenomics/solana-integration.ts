/**
 * SVMAI Tokenomics - Solana On-Chain Integration
 *
 * Connects tokenomics to actual Solana blockchain state:
 * - Token balance lookups
 * - Staking program interaction
 * - Transaction building and signing
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from '@solana/spl-token';
import {
  TokenAmount,
  toTokenAmount,
  fromTokenAmount,
  AccessTier,
  StakePosition,
  StakeDuration,
  STAKE_CONFIGS,
} from './types';
import { calculateTier } from './access-tiers';

// ============================================================================
// Configuration
// ============================================================================

// SVMAI Token Configuration
export const SVMAI_CONFIG = {
  // Token mint address (replace with actual mint)
  mint: new PublicKey('SVMAi7EgLXUMBcxSwc9LzJEsLftPTLPBpK1c8YPqRXg'),

  // Decimals
  decimals: 9,

  // Staking program ID (replace with actual program)
  stakingProgram: new PublicKey('SVMStake111111111111111111111111111111111'),

  // Governance program ID
  governanceProgram: new PublicKey('SVMGov1111111111111111111111111111111111'),

  // Treasury wallet
  treasury: new PublicKey('SVMTreasury11111111111111111111111111111'),

  // RPC endpoints
  rpcEndpoints: [
    'https://api.mainnet-beta.solana.com',
    'https://solana-mainnet.g.alchemy.com/v2/demo',
  ],
};

// ============================================================================
// Connection Management
// ============================================================================

let connectionPool: Connection[] = [];
let currentConnectionIndex = 0;

export function initializeConnections(endpoints: string[] = SVMAI_CONFIG.rpcEndpoints): void {
  connectionPool = endpoints.map(endpoint => new Connection(endpoint, 'confirmed'));
}

export function getConnection(): Connection {
  if (connectionPool.length === 0) {
    initializeConnections();
  }
  const connection = connectionPool[currentConnectionIndex];
  currentConnectionIndex = (currentConnectionIndex + 1) % connectionPool.length;
  return connection;
}

// ============================================================================
// Token Balance Lookups
// ============================================================================

/**
 * Get SVMAI token balance for a wallet
 */
export async function getTokenBalance(wallet: string | PublicKey): Promise<TokenAmount> {
  const connection = getConnection();
  const walletPubkey = typeof wallet === 'string' ? new PublicKey(wallet) : wallet;

  try {
    const ata = await getAssociatedTokenAddress(SVMAI_CONFIG.mint, walletPubkey);
    const account = await getAccount(connection, ata);
    return BigInt(account.amount.toString());
  } catch (error) {
    // Account doesn't exist or has no tokens
    return BigInt(0);
  }
}

/**
 * Get multiple token balances in batch
 */
export async function getTokenBalances(
  wallets: (string | PublicKey)[]
): Promise<Map<string, TokenAmount>> {
  const results = new Map<string, TokenAmount>();

  // Process in batches of 100
  const batchSize = 100;
  for (let i = 0; i < wallets.length; i += batchSize) {
    const batch = wallets.slice(i, i + batchSize);
    const promises = batch.map(async wallet => {
      const key = typeof wallet === 'string' ? wallet : wallet.toBase58();
      const balance = await getTokenBalance(wallet);
      return { key, balance };
    });

    const batchResults = await Promise.all(promises);
    for (const { key, balance } of batchResults) {
      results.set(key, balance);
    }
  }

  return results;
}

/**
 * Get wallet tier based on on-chain balance
 */
export async function getWalletTier(wallet: string | PublicKey): Promise<{
  tier: AccessTier;
  balance: TokenAmount;
  effectiveBalance: TokenAmount;
}> {
  const balance = await getTokenBalance(wallet);
  const stakedBalance = await getStakedBalance(wallet);

  // Calculate effective balance (balance + staked with multipliers)
  const effectiveBalance = balance + stakedBalance.effective;
  const tier = calculateTier(effectiveBalance);

  return {
    tier,
    balance,
    effectiveBalance,
  };
}

// ============================================================================
// On-Chain Staking
// ============================================================================

/**
 * Staking account structure (matches on-chain program)
 */
export interface OnChainStakeAccount {
  owner: PublicKey;
  amount: bigint;
  startTime: number;
  endTime: number;
  duration: StakeDuration;
  multiplier: number;
  rewards: bigint;
  claimed: bigint;
  bump: number;
}

/**
 * Get staked balance for a wallet
 */
export async function getStakedBalance(wallet: string | PublicKey): Promise<{
  staked: TokenAmount;
  effective: TokenAmount;
  positions: OnChainStakeAccount[];
}> {
  const connection = getConnection();
  const walletPubkey = typeof wallet === 'string' ? new PublicKey(wallet) : wallet;

  try {
    // Find all stake accounts for this wallet
    const accounts = await connection.getProgramAccounts(SVMAI_CONFIG.stakingProgram, {
      filters: [
        { memcmp: { offset: 8, bytes: walletPubkey.toBase58() } }, // Owner filter
      ],
    });

    let totalStaked = BigInt(0);
    let totalEffective = BigInt(0);
    const positions: OnChainStakeAccount[] = [];

    for (const { account } of accounts) {
      const data = parseStakeAccount(account.data);
      if (data) {
        totalStaked += data.amount;
        totalEffective += BigInt(Math.floor(Number(data.amount) * data.multiplier));
        positions.push(data);
      }
    }

    return {
      staked: totalStaked,
      effective: totalEffective,
      positions,
    };
  } catch (error) {
    return {
      staked: BigInt(0),
      effective: BigInt(0),
      positions: [],
    };
  }
}

/**
 * Parse stake account data
 */
function parseStakeAccount(data: Buffer): OnChainStakeAccount | null {
  try {
    // Account discriminator (8 bytes)
    const discriminator = data.slice(0, 8);

    // Owner pubkey (32 bytes)
    const owner = new PublicKey(data.slice(8, 40));

    // Amount (8 bytes, u64)
    const amount = data.readBigUInt64LE(40);

    // Start time (8 bytes, i64)
    const startTime = Number(data.readBigInt64LE(48));

    // End time (8 bytes, i64)
    const endTime = Number(data.readBigInt64LE(56));

    // Duration enum (1 byte)
    const durationIndex = data.readUInt8(64);
    const durations: StakeDuration[] = ['7d', '30d', '90d', '180d', '365d'];
    const duration = durations[durationIndex] || '7d';

    // Multiplier (stored as basis points, 2 bytes)
    const multiplierBps = data.readUInt16LE(65);
    const multiplier = multiplierBps / 10000;

    // Rewards (8 bytes, u64)
    const rewards = data.readBigUInt64LE(67);

    // Claimed (8 bytes, u64)
    const claimed = data.readBigUInt64LE(75);

    // Bump (1 byte)
    const bump = data.readUInt8(83);

    return {
      owner,
      amount,
      startTime,
      endTime,
      duration,
      multiplier,
      rewards,
      claimed,
      bump,
    };
  } catch {
    return null;
  }
}

/**
 * Build stake transaction
 */
export async function buildStakeTransaction(
  wallet: PublicKey,
  amount: TokenAmount,
  duration: StakeDuration
): Promise<Transaction> {
  const connection = getConnection();

  // Find stake account PDA
  const [stakeAccount, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('stake'), wallet.toBuffer(), Buffer.from(duration)],
    SVMAI_CONFIG.stakingProgram
  );

  // Get user's token account
  const userTokenAccount = await getAssociatedTokenAddress(SVMAI_CONFIG.mint, wallet);

  // Get stake vault PDA
  const [stakeVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault')],
    SVMAI_CONFIG.stakingProgram
  );

  // Build instruction data
  const instructionData = Buffer.alloc(17);
  instructionData.writeUInt8(0, 0); // Instruction: Stake
  instructionData.writeBigUInt64LE(BigInt(amount), 1);
  const durationIndex = ['7d', '30d', '90d', '180d', '365d'].indexOf(duration);
  instructionData.writeUInt8(durationIndex, 9);

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: wallet, isSigner: true, isWritable: true },
      { pubkey: stakeAccount, isSigner: false, isWritable: true },
      { pubkey: userTokenAccount, isSigner: false, isWritable: true },
      { pubkey: stakeVault, isSigner: false, isWritable: true },
      { pubkey: SVMAI_CONFIG.mint, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: SVMAI_CONFIG.stakingProgram,
    data: instructionData,
  });

  const transaction = new Transaction().add(instruction);
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  transaction.feePayer = wallet;

  return transaction;
}

/**
 * Build unstake transaction
 */
export async function buildUnstakeTransaction(
  wallet: PublicKey,
  stakeAccountPubkey: PublicKey
): Promise<Transaction> {
  const connection = getConnection();

  // Get user's token account
  const userTokenAccount = await getAssociatedTokenAddress(SVMAI_CONFIG.mint, wallet);

  // Get stake vault PDA
  const [stakeVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault')],
    SVMAI_CONFIG.stakingProgram
  );

  // Build instruction data
  const instructionData = Buffer.alloc(1);
  instructionData.writeUInt8(1, 0); // Instruction: Unstake

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: wallet, isSigner: true, isWritable: true },
      { pubkey: stakeAccountPubkey, isSigner: false, isWritable: true },
      { pubkey: userTokenAccount, isSigner: false, isWritable: true },
      { pubkey: stakeVault, isSigner: false, isWritable: true },
      { pubkey: SVMAI_CONFIG.mint, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: SVMAI_CONFIG.stakingProgram,
    data: instructionData,
  });

  const transaction = new Transaction().add(instruction);
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  transaction.feePayer = wallet;

  return transaction;
}

/**
 * Build claim rewards transaction
 */
export async function buildClaimRewardsTransaction(
  wallet: PublicKey,
  stakeAccountPubkey: PublicKey
): Promise<Transaction> {
  const connection = getConnection();

  // Get user's token account
  const userTokenAccount = await getAssociatedTokenAddress(SVMAI_CONFIG.mint, wallet);

  // Get rewards vault PDA
  const [rewardsVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('rewards')],
    SVMAI_CONFIG.stakingProgram
  );

  // Build instruction data
  const instructionData = Buffer.alloc(1);
  instructionData.writeUInt8(2, 0); // Instruction: ClaimRewards

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: wallet, isSigner: true, isWritable: true },
      { pubkey: stakeAccountPubkey, isSigner: false, isWritable: true },
      { pubkey: userTokenAccount, isSigner: false, isWritable: true },
      { pubkey: rewardsVault, isSigner: false, isWritable: true },
      { pubkey: SVMAI_CONFIG.mint, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: SVMAI_CONFIG.stakingProgram,
    data: instructionData,
  });

  const transaction = new Transaction().add(instruction);
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  transaction.feePayer = wallet;

  return transaction;
}

// ============================================================================
// Token Transfer
// ============================================================================

/**
 * Build token transfer transaction
 */
export async function buildTransferTransaction(
  from: PublicKey,
  to: PublicKey,
  amount: TokenAmount
): Promise<Transaction> {
  const connection = getConnection();

  const fromTokenAccount = await getAssociatedTokenAddress(SVMAI_CONFIG.mint, from);
  const toTokenAccount = await getAssociatedTokenAddress(SVMAI_CONFIG.mint, to);

  const transaction = new Transaction();

  // Check if recipient has token account
  try {
    await getAccount(connection, toTokenAccount);
  } catch {
    // Create ATA for recipient
    transaction.add(
      createAssociatedTokenAccountInstruction(from, toTokenAccount, to, SVMAI_CONFIG.mint)
    );
  }

  // Add transfer instruction
  // Note: Using raw instruction instead of createTransferInstruction for compatibility
  const transferData = Buffer.alloc(9);
  transferData.writeUInt8(3, 0); // Transfer instruction
  transferData.writeBigUInt64LE(BigInt(amount), 1);

  transaction.add(
    new TransactionInstruction({
      keys: [
        { pubkey: fromTokenAccount, isSigner: false, isWritable: true },
        { pubkey: toTokenAccount, isSigner: false, isWritable: true },
        { pubkey: from, isSigner: true, isWritable: false },
      ],
      programId: TOKEN_PROGRAM_ID,
      data: transferData,
    })
  );

  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  transaction.feePayer = from;

  return transaction;
}

// ============================================================================
// Global Stats
// ============================================================================

/**
 * Get global staking statistics from on-chain
 */
export async function getGlobalStakingStats(): Promise<{
  totalStaked: TokenAmount;
  totalStakers: number;
  rewardsVaultBalance: TokenAmount;
  averageStakeDuration: number;
}> {
  const connection = getConnection();

  try {
    // Get all stake accounts
    const accounts = await connection.getProgramAccounts(SVMAI_CONFIG.stakingProgram);

    let totalStaked = BigInt(0);
    let totalDurationDays = 0;
    const stakers = new Set<string>();

    for (const { account } of accounts) {
      const data = parseStakeAccount(account.data);
      if (data) {
        totalStaked += data.amount;
        stakers.add(data.owner.toBase58());

        const config = STAKE_CONFIGS.find(c => c.duration === data.duration);
        if (config) {
          totalDurationDays += config.durationDays;
        }
      }
    }

    // Get rewards vault balance
    const [rewardsVault] = PublicKey.findProgramAddressSync(
      [Buffer.from('rewards')],
      SVMAI_CONFIG.stakingProgram
    );

    let rewardsBalance = BigInt(0);
    try {
      const vaultAta = await getAssociatedTokenAddress(SVMAI_CONFIG.mint, rewardsVault, true);
      const vaultAccount = await getAccount(connection, vaultAta);
      rewardsBalance = BigInt(vaultAccount.amount.toString());
    } catch {
      // Vault doesn't exist yet
    }

    return {
      totalStaked,
      totalStakers: stakers.size,
      rewardsVaultBalance: rewardsBalance,
      averageStakeDuration: accounts.length > 0 ? totalDurationDays / accounts.length : 0,
    };
  } catch (error) {
    return {
      totalStaked: BigInt(0),
      totalStakers: 0,
      rewardsVaultBalance: BigInt(0),
      averageStakeDuration: 0,
    };
  }
}

/**
 * Get token supply information
 */
export async function getTokenSupply(): Promise<{
  total: TokenAmount;
  circulating: TokenAmount;
  burned: TokenAmount;
  staked: TokenAmount;
  treasury: TokenAmount;
}> {
  const connection = getConnection();

  try {
    const supplyInfo = await connection.getTokenSupply(SVMAI_CONFIG.mint);
    const total = BigInt(supplyInfo.value.amount);

    // Get treasury balance
    const treasuryAta = await getAssociatedTokenAddress(SVMAI_CONFIG.mint, SVMAI_CONFIG.treasury);
    let treasuryBalance = BigInt(0);
    try {
      const treasuryAccount = await getAccount(connection, treasuryAta);
      treasuryBalance = BigInt(treasuryAccount.amount.toString());
    } catch {
      // Treasury doesn't exist yet
    }

    // Get staking stats
    const stakingStats = await getGlobalStakingStats();

    // Burned = initial supply - current supply (simplified)
    const burned = BigInt(0); // Track separately or use burn address

    const circulating = total - treasuryBalance - stakingStats.totalStaked;

    return {
      total,
      circulating,
      burned,
      staked: stakingStats.totalStaked,
      treasury: treasuryBalance,
    };
  } catch (error) {
    return {
      total: BigInt(0),
      circulating: BigInt(0),
      burned: BigInt(0),
      staked: BigInt(0),
      treasury: BigInt(0),
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

export default {
  SVMAI_CONFIG,
  initializeConnections,
  getConnection,
  getTokenBalance,
  getTokenBalances,
  getWalletTier,
  getStakedBalance,
  buildStakeTransaction,
  buildUnstakeTransaction,
  buildClaimRewardsTransaction,
  buildTransferTransaction,
  getGlobalStakingStats,
  getTokenSupply,
};
