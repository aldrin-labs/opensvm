/**
 * $OMCP Token - On-Chain MCP Points
 *
 * SPL token implementation for the MCP federation reward system.
 * Tokens are minted when PoW challenges are solved and can be:
 * - Staked for trust boost in the federation
 * - Traded on DEXes
 * - Used to pay for premium MCP features
 * - Burned to register servers with higher initial trust
 *
 * Token Economics:
 * - Total Supply Cap: 1,000,000,000 OMCP (1 billion)
 * - Mining Rewards: 70% allocated to PoW mining
 * - Protocol Treasury: 20% for development and grants
 * - Initial Liquidity: 10% for DEX listing
 *
 * @module api/src/mcp-omcp-token
 */

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';

import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  createBurnInstruction,
  createTransferInstruction,
  getMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
} from '@solana/spl-token';

// ============================================================================
// Types
// ============================================================================

export interface OmcpTokenConfig {
  rpcUrl: string;
  mintAuthority?: string;        // Base58 encoded private key
  tokenMint?: string;            // Existing token mint address
  decimals: number;
  maxSupply: bigint;
  miningAllocation: bigint;      // Max tokens for mining
  treasuryAllocation: bigint;
  liquidityAllocation: bigint;
}

export interface MintResult {
  success: boolean;
  signature?: string;
  amount: bigint;
  recipient: string;
  error?: string;
}

export interface TokenBalance {
  address: string;
  balance: bigint;
  uiBalance: number;
}

export interface TokenStats {
  mint: string;
  totalSupply: bigint;
  circulatingSupply: bigint;
  miningRemaining: bigint;
  treasuryBalance: bigint;
  decimals: number;
  holders: number;
}

export interface StakeInfo {
  staker: string;
  amount: bigint;
  lockedUntil: number;
  trustBoost: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: OmcpTokenConfig = {
  rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  decimals: 9,
  maxSupply: 1_000_000_000n * 10n ** 9n,              // 1B tokens
  miningAllocation: 700_000_000n * 10n ** 9n,          // 700M for mining
  treasuryAllocation: 200_000_000n * 10n ** 9n,        // 200M for treasury
  liquidityAllocation: 100_000_000n * 10n ** 9n,       // 100M for liquidity
};

// Reward schedule - halving every epoch
const REWARD_SCHEDULE = [
  { epoch: 0, rewardPerChallenge: 1000n * 10n ** 9n },      // 1000 OMCP
  { epoch: 1, rewardPerChallenge: 500n * 10n ** 9n },       // 500 OMCP
  { epoch: 2, rewardPerChallenge: 250n * 10n ** 9n },       // 250 OMCP
  { epoch: 3, rewardPerChallenge: 125n * 10n ** 9n },       // 125 OMCP
  { epoch: 4, rewardPerChallenge: 62n * 10n ** 9n + 500_000_000n }, // 62.5 OMCP
  { epoch: 5, rewardPerChallenge: 31n * 10n ** 9n + 250_000_000n }, // ~31 OMCP
];

const CHALLENGES_PER_EPOCH = 100_000; // Halving every 100k challenges

// Trust boost costs
const TRUST_COSTS = {
  1: 1_000n * 10n ** 9n,           // 1,000 OMCP for +1 trust
  5: 4_500n * 10n ** 9n,           // 4,500 OMCP for +5 trust
  10: 8_000n * 10n ** 9n,          // 8,000 OMCP for +10 trust
  20: 14_000n * 10n ** 9n,         // 14,000 OMCP for +20 trust
  30: 18_000n * 10n ** 9n,         // 18,000 OMCP for +30 trust (max)
};

// ============================================================================
// Token Manager Class
// ============================================================================

export class OmcpTokenManager {
  private config: OmcpTokenConfig;
  private connection: Connection;
  private mintAuthority?: Keypair;
  private mintAddress?: PublicKey;
  private treasuryAddress?: PublicKey;

  // Local state tracking
  private totalMinted: bigint = 0n;
  private challengeCount: number = 0;
  private stakes = new Map<string, StakeInfo>();

  constructor(config: Partial<OmcpTokenConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.connection = new Connection(this.config.rpcUrl, 'confirmed');

    if (this.config.mintAuthority) {
      try {
        const secretKey = Buffer.from(this.config.mintAuthority, 'base64');
        this.mintAuthority = Keypair.fromSecretKey(secretKey);
      } catch {
        console.warn('[OMCP] Invalid mint authority key');
      }
    }

    if (this.config.tokenMint) {
      this.mintAddress = new PublicKey(this.config.tokenMint);
    }
  }

  // ==========================================================================
  // Token Initialization
  // ==========================================================================

  /**
   * Initialize a new OMCP token mint
   * Only needed once to create the token
   */
  async initializeToken(payer: Keypair): Promise<{
    mint: string;
    treasury: string;
    signature: string;
  }> {
    if (!this.mintAuthority) {
      throw new Error('Mint authority not configured');
    }

    // Generate new mint address
    const mintKeypair = Keypair.generate();
    const mintRent = await this.connection.getMinimumBalanceForRentExemption(82);

    // Create mint account
    const createMintTx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: 82,
        lamports: mintRent,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        this.config.decimals,
        this.mintAuthority.publicKey,
        this.mintAuthority.publicKey, // Freeze authority (can be null)
        TOKEN_PROGRAM_ID
      )
    );

    const signature = await sendAndConfirmTransaction(
      this.connection,
      createMintTx,
      [payer, mintKeypair]
    );

    this.mintAddress = mintKeypair.publicKey;

    // Create treasury account
    const treasuryAccount = await getOrCreateAssociatedTokenAccount(
      this.connection,
      payer,
      this.mintAddress,
      this.mintAuthority.publicKey
    );

    this.treasuryAddress = treasuryAccount.address;

    // Mint treasury allocation
    await this.mintTo(
      this.mintAuthority.publicKey.toBase58(),
      this.config.treasuryAllocation,
      'Treasury allocation'
    );

    console.log(`[OMCP] Token initialized: ${this.mintAddress.toBase58()}`);

    return {
      mint: this.mintAddress.toBase58(),
      treasury: this.treasuryAddress.toBase58(),
      signature,
    };
  }

  // ==========================================================================
  // Mining Rewards
  // ==========================================================================

  /**
   * Mint tokens as reward for completing a PoW challenge
   */
  async mintMiningReward(
    recipientWallet: string,
    challengeId: string,
    difficulty: number
  ): Promise<MintResult> {
    if (!this.mintAddress || !this.mintAuthority) {
      // Fallback to off-chain tracking
      return this.trackOffChainReward(recipientWallet, challengeId, difficulty);
    }

    try {
      // Calculate reward based on epoch and difficulty
      const reward = this.calculateMiningReward(difficulty);

      // Check mining allocation remaining
      if (this.totalMinted + reward > this.config.miningAllocation) {
        return {
          success: false,
          amount: 0n,
          recipient: recipientWallet,
          error: 'Mining allocation exhausted',
        };
      }

      const result = await this.mintTo(recipientWallet, reward, `PoW reward: ${challengeId}`);

      if (result.success) {
        this.totalMinted += reward;
        this.challengeCount++;
      }

      return result;
    } catch (error) {
      return {
        success: false,
        amount: 0n,
        recipient: recipientWallet,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Calculate mining reward based on current epoch and difficulty
   */
  calculateMiningReward(difficulty: number): bigint {
    const epoch = Math.floor(this.challengeCount / CHALLENGES_PER_EPOCH);
    const scheduleEntry = REWARD_SCHEDULE[Math.min(epoch, REWARD_SCHEDULE.length - 1)];

    // Base reward from schedule
    let reward = scheduleEntry.rewardPerChallenge;

    // Difficulty multiplier (1x to 3x)
    const difficultyMultiplier = 1 + (difficulty - 4) * 0.5;
    reward = BigInt(Math.floor(Number(reward) * Math.min(3, difficultyMultiplier)));

    return reward;
  }

  /**
   * Track reward off-chain when token not deployed
   */
  private trackOffChainReward(
    recipient: string,
    challengeId: string,
    difficulty: number
  ): MintResult {
    const reward = this.calculateMiningReward(difficulty);
    this.totalMinted += reward;
    this.challengeCount++;

    console.log(`[OMCP] Off-chain reward: ${recipient} earned ${reward} for ${challengeId}`);

    return {
      success: true,
      amount: reward,
      recipient,
    };
  }

  // ==========================================================================
  // Trust Staking
  // ==========================================================================

  /**
   * Stake tokens for trust boost
   * Tokens are burned to increase server trust score
   */
  async stakeForTrust(
    serverWallet: string,
    amount: bigint,
    targetTrustBoost: number
  ): Promise<{
    success: boolean;
    trustBoost: number;
    tokensBurned: bigint;
    signature?: string;
    error?: string;
  }> {
    // Validate trust boost level
    const validBoosts = Object.keys(TRUST_COSTS).map(Number);
    if (!validBoosts.includes(targetTrustBoost)) {
      return {
        success: false,
        trustBoost: 0,
        tokensBurned: 0n,
        error: `Invalid trust boost. Valid levels: ${validBoosts.join(', ')}`,
      };
    }

    const cost = TRUST_COSTS[targetTrustBoost as keyof typeof TRUST_COSTS];

    if (amount < cost) {
      return {
        success: false,
        trustBoost: 0,
        tokensBurned: 0n,
        error: `Insufficient tokens. Need ${cost}, have ${amount}`,
      };
    }

    // Check existing stake
    const existingStake = this.stakes.get(serverWallet);
    if (existingStake && existingStake.trustBoost >= targetTrustBoost) {
      return {
        success: false,
        trustBoost: existingStake.trustBoost,
        tokensBurned: 0n,
        error: 'Already at or above this trust level',
      };
    }

    // For on-chain: burn tokens
    let signature: string | undefined;
    if (this.mintAddress && this.mintAuthority) {
      try {
        signature = await this.burnTokens(serverWallet, cost);
      } catch (error) {
        return {
          success: false,
          trustBoost: 0,
          tokensBurned: 0n,
          error: error instanceof Error ? error.message : 'Burn failed',
        };
      }
    }

    // Record stake
    this.stakes.set(serverWallet, {
      staker: serverWallet,
      amount: cost,
      lockedUntil: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 day lock
      trustBoost: targetTrustBoost,
    });

    console.log(`[OMCP] ${serverWallet} staked ${cost} for +${targetTrustBoost} trust`);

    return {
      success: true,
      trustBoost: targetTrustBoost,
      tokensBurned: cost,
      signature,
    };
  }

  /**
   * Get stake info for a server
   */
  getStakeInfo(serverWallet: string): StakeInfo | null {
    return this.stakes.get(serverWallet) || null;
  }

  /**
   * Get trust boost for a server
   */
  getTrustBoost(serverWallet: string): number {
    const stake = this.stakes.get(serverWallet);
    return stake?.trustBoost || 0;
  }

  // ==========================================================================
  // Token Operations
  // ==========================================================================

  /**
   * Mint tokens to an address
   */
  async mintTo(
    recipient: string,
    amount: bigint,
    memo?: string
  ): Promise<MintResult> {
    if (!this.mintAddress || !this.mintAuthority) {
      return {
        success: false,
        amount: 0n,
        recipient,
        error: 'Token not initialized',
      };
    }

    try {
      const recipientPubkey = new PublicKey(recipient);

      // Get or create associated token account
      const ata = await getAssociatedTokenAddress(
        this.mintAddress,
        recipientPubkey
      );

      // Check if ATA exists
      let createAtaIx;
      try {
        await getAccount(this.connection, ata);
      } catch {
        createAtaIx = createAssociatedTokenAccountInstruction(
          this.mintAuthority.publicKey,
          ata,
          recipientPubkey,
          this.mintAddress
        );
      }

      const mintIx = createMintToInstruction(
        this.mintAddress,
        ata,
        this.mintAuthority.publicKey,
        amount
      );

      const tx = new Transaction();
      if (createAtaIx) tx.add(createAtaIx);
      tx.add(mintIx);

      const signature = await sendAndConfirmTransaction(
        this.connection,
        tx,
        [this.mintAuthority]
      );

      console.log(`[OMCP] Minted ${amount} to ${recipient}: ${signature}`);

      return {
        success: true,
        signature,
        amount,
        recipient,
      };
    } catch (error) {
      return {
        success: false,
        amount: 0n,
        recipient,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Burn tokens from an address
   */
  async burnTokens(owner: string, amount: bigint): Promise<string> {
    if (!this.mintAddress || !this.mintAuthority) {
      throw new Error('Token not initialized');
    }

    const ownerPubkey = new PublicKey(owner);
    const ata = await getAssociatedTokenAddress(this.mintAddress, ownerPubkey);

    const burnIx = createBurnInstruction(
      ata,
      this.mintAddress,
      ownerPubkey,
      amount
    );

    // Note: In production, this would require the owner's signature
    // Here we assume delegated authority or off-chain tracking
    const tx = new Transaction().add(burnIx);

    const signature = await sendAndConfirmTransaction(
      this.connection,
      tx,
      [this.mintAuthority]
    );

    console.log(`[OMCP] Burned ${amount} from ${owner}: ${signature}`);

    return signature;
  }

  /**
   * Get token balance for an address
   */
  async getBalance(wallet: string): Promise<TokenBalance> {
    if (!this.mintAddress) {
      return { address: wallet, balance: 0n, uiBalance: 0 };
    }

    try {
      const walletPubkey = new PublicKey(wallet);
      const ata = await getAssociatedTokenAddress(this.mintAddress, walletPubkey);
      const account = await getAccount(this.connection, ata);

      const balance = BigInt(account.amount.toString());
      const uiBalance = Number(balance) / 10 ** this.config.decimals;

      return { address: wallet, balance, uiBalance };
    } catch {
      return { address: wallet, balance: 0n, uiBalance: 0 };
    }
  }

  /**
   * Get token statistics
   */
  async getTokenStats(): Promise<TokenStats> {
    if (!this.mintAddress) {
      return {
        mint: 'not_initialized',
        totalSupply: this.totalMinted,
        circulatingSupply: this.totalMinted,
        miningRemaining: this.config.miningAllocation - this.totalMinted,
        treasuryBalance: this.config.treasuryAllocation,
        decimals: this.config.decimals,
        holders: this.stakes.size,
      };
    }

    try {
      const mintInfo = await getMint(this.connection, this.mintAddress);

      let treasuryBalance = 0n;
      if (this.treasuryAddress) {
        try {
          const treasuryAccount = await getAccount(this.connection, this.treasuryAddress);
          treasuryBalance = BigInt(treasuryAccount.amount.toString());
        } catch {}
      }

      return {
        mint: this.mintAddress.toBase58(),
        totalSupply: BigInt(mintInfo.supply.toString()),
        circulatingSupply: BigInt(mintInfo.supply.toString()) - treasuryBalance,
        miningRemaining: this.config.miningAllocation - this.totalMinted,
        treasuryBalance,
        decimals: mintInfo.decimals,
        holders: this.stakes.size,
      };
    } catch (error) {
      return {
        mint: this.mintAddress.toBase58(),
        totalSupply: 0n,
        circulatingSupply: 0n,
        miningRemaining: this.config.miningAllocation,
        treasuryBalance: 0n,
        decimals: this.config.decimals,
        holders: 0,
      };
    }
  }

  // ==========================================================================
  // Getters
  // ==========================================================================

  getMintAddress(): string | null {
    return this.mintAddress?.toBase58() || null;
  }

  getTotalMinted(): bigint {
    return this.totalMinted;
  }

  getChallengeCount(): number {
    return this.challengeCount;
  }

  getCurrentEpoch(): number {
    return Math.floor(this.challengeCount / CHALLENGES_PER_EPOCH);
  }

  getCurrentRewardRate(): bigint {
    return this.calculateMiningReward(4); // Base difficulty reward
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalTokenManager: OmcpTokenManager | null = null;

export function getOmcpToken(): OmcpTokenManager {
  if (!globalTokenManager) {
    globalTokenManager = new OmcpTokenManager();
  }
  return globalTokenManager;
}

export function createOmcpToken(config?: Partial<OmcpTokenConfig>): OmcpTokenManager {
  globalTokenManager = new OmcpTokenManager(config);
  return globalTokenManager;
}

// ============================================================================
// API Handler
// ============================================================================

export function createTokenHandler(token: OmcpTokenManager) {
  return {
    /**
     * GET /token/stats
     */
    getStats: async () => {
      const stats = await token.getTokenStats();
      return {
        ...stats,
        totalSupply: stats.totalSupply.toString(),
        circulatingSupply: stats.circulatingSupply.toString(),
        miningRemaining: stats.miningRemaining.toString(),
        treasuryBalance: stats.treasuryBalance.toString(),
        currentEpoch: token.getCurrentEpoch(),
        challengeCount: token.getChallengeCount(),
        currentRewardRate: token.getCurrentRewardRate().toString(),
      };
    },

    /**
     * GET /token/balance/:wallet
     */
    getBalance: async (wallet: string) => {
      const balance = await token.getBalance(wallet);
      return {
        ...balance,
        balance: balance.balance.toString(),
      };
    },

    /**
     * POST /token/stake
     */
    stakeForTrust: async (serverWallet: string, amount: string, trustBoost: number) => {
      const result = await token.stakeForTrust(serverWallet, BigInt(amount), trustBoost);
      return {
        ...result,
        tokensBurned: result.tokensBurned.toString(),
      };
    },

    /**
     * GET /token/stake/:wallet
     */
    getStakeInfo: (wallet: string) => {
      const info = token.getStakeInfo(wallet);
      if (!info) return null;
      return {
        ...info,
        amount: info.amount.toString(),
      };
    },

    /**
     * GET /token/trust-costs
     */
    getTrustCosts: () => {
      return Object.entries(TRUST_COSTS).map(([boost, cost]) => ({
        trustBoost: Number(boost),
        cost: cost.toString(),
        costUi: Number(cost) / 10 ** 9,
      }));
    },

    /**
     * GET /token/reward-schedule
     */
    getRewardSchedule: () => {
      return REWARD_SCHEDULE.map((entry, i) => ({
        epoch: entry.epoch,
        challengeStart: i * CHALLENGES_PER_EPOCH,
        challengeEnd: (i + 1) * CHALLENGES_PER_EPOCH - 1,
        rewardPerChallenge: entry.rewardPerChallenge.toString(),
        rewardUi: Number(entry.rewardPerChallenge) / 10 ** 9,
      }));
    },
  };
}

// ============================================================================
// Exports
// ============================================================================

export default {
  OmcpTokenManager,
  getOmcpToken,
  createOmcpToken,
  createTokenHandler,
  TRUST_COSTS,
  REWARD_SCHEDULE,
  CHALLENGES_PER_EPOCH,
};
