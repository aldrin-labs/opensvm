#!/usr/bin/env bun
/**
 * Prediction Aggregator SDK
 *
 * TypeScript SDK for interacting with the on-chain Prediction Aggregator program.
 * Provides high-level methods for:
 * - Vault management (create, deposit, withdraw)
 * - Position management (open, close, settle)
 * - Market operations (register, update prices, resolve)
 * - Oracle coordination
 */

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { BN } from 'bn.js';

// ============================================================================
// Types
// ============================================================================

export type Platform = 'kalshi' | 'polymarket' | 'manifold';
export type Side = 'yes' | 'no';
export type Outcome = 'yes' | 'no' | 'invalid';

export interface VaultAccount {
  owner: PublicKey;
  balanceLamports: bigint;
  totalDeposited: bigint;
  totalWithdrawn: bigint;
  totalPnl: bigint;
  positionCount: number;
  createdAt: number;
  bump: number;
}

export interface MarketAccount {
  marketId: string;
  platform: Platform;
  title: string;
  yesPrice: number;       // Basis points (0-10000)
  noPrice: number;
  totalVolume: bigint;
  resolved: boolean;
  outcome: Outcome | null;
  closeTimestamp: number;
  oracle: PublicKey;
  bump: number;
}

export interface PositionAccount {
  vault: PublicKey;
  market: PublicKey;
  side: Side;
  quantity: bigint;
  entryPrice: number;
  amountInvested: bigint;
  settled: boolean;
  pnl: bigint;
  createdAt: number;
  bump: number;
}

export interface SDKConfig {
  connection: Connection;
  programId: PublicKey;
  wallet?: Keypair;
}

// ============================================================================
// PDA Derivation
// ============================================================================

const PROGRAM_ID = new PublicKey('PRED111111111111111111111111111111111111111');

export function deriveProtocolPDA(programId: PublicKey = PROGRAM_ID): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('protocol')],
    programId
  );
}

export function deriveVaultPDA(owner: PublicKey, programId: PublicKey = PROGRAM_ID): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), owner.toBuffer()],
    programId
  );
}

export function deriveMarketPDA(marketId: string, programId: PublicKey = PROGRAM_ID): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('market'), Buffer.from(marketId)],
    programId
  );
}

export function derivePositionPDA(
  vault: PublicKey,
  market: PublicKey,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('position'), vault.toBuffer(), market.toBuffer()],
    programId
  );
}

export function deriveOraclePDA(oracle: PublicKey, programId: PublicKey = PROGRAM_ID): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('oracle'), oracle.toBuffer()],
    programId
  );
}

// ============================================================================
// Instruction Builders
// ============================================================================

function platformToByte(platform: Platform): number {
  switch (platform) {
    case 'kalshi': return 0;
    case 'polymarket': return 1;
    case 'manifold': return 2;
  }
}

function sideToByte(side: Side): number {
  return side === 'yes' ? 0 : 1;
}

function outcomeToByte(outcome: Outcome): number {
  switch (outcome) {
    case 'yes': return 0;
    case 'no': return 1;
    case 'invalid': return 2;
  }
}

// Instruction discriminators (first 8 bytes of sha256 hash of instruction name)
const DISCRIMINATORS = {
  initialize: Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]),
  createVault: Buffer.from([29, 237, 247, 208, 193, 82, 54, 135]),
  deposit: Buffer.from([242, 35, 198, 137, 82, 225, 242, 182]),
  withdraw: Buffer.from([183, 18, 70, 156, 148, 109, 161, 34]),
  registerMarket: Buffer.from([151, 119, 18, 159, 241, 143, 228, 30]),
  updatePrice: Buffer.from([98, 151, 21, 85, 144, 202, 95, 14]),
  openPosition: Buffer.from([135, 128, 47, 77, 15, 152, 240, 49]),
  closePosition: Buffer.from([123, 134, 81, 0, 49, 68, 98, 98]),
  resolveMarket: Buffer.from([155, 23, 42, 241, 144, 225, 137, 83]),
  settlePosition: Buffer.from([107, 131, 68, 15, 192, 160, 187, 93]),
  addOracle: Buffer.from([250, 234, 127, 148, 93, 66, 101, 45]),
};

// ============================================================================
// SDK Class
// ============================================================================

export class PredictionAggregatorSDK {
  private connection: Connection;
  private programId: PublicKey;
  private wallet?: Keypair;

  constructor(config: SDKConfig) {
    this.connection = config.connection;
    this.programId = config.programId || PROGRAM_ID;
    this.wallet = config.wallet;
  }

  // --------------------------------------------------------------------------
  // Protocol Operations
  // --------------------------------------------------------------------------

  async initialize(
    authority: Keypair,
    treasury: PublicKey,
    protocolFeeBps: number
  ): Promise<string> {
    const [protocolPDA] = deriveProtocolPDA(this.programId);

    const data = Buffer.concat([
      DISCRIMINATORS.initialize,
      Buffer.from(new Uint16Array([protocolFeeBps]).buffer),
    ]);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: protocolPDA, isSigner: false, isWritable: true },
        { pubkey: authority.publicKey, isSigner: true, isWritable: true },
        { pubkey: treasury, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });

    const tx = new Transaction().add(ix);
    return sendAndConfirmTransaction(this.connection, tx, [authority]);
  }

  // --------------------------------------------------------------------------
  // Vault Operations
  // --------------------------------------------------------------------------

  async createVault(owner: Keypair): Promise<{ signature: string; vault: PublicKey }> {
    const [protocolPDA] = deriveProtocolPDA(this.programId);
    const [vaultPDA] = deriveVaultPDA(owner.publicKey, this.programId);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: protocolPDA, isSigner: false, isWritable: true },
        { pubkey: vaultPDA, isSigner: false, isWritable: true },
        { pubkey: owner.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: DISCRIMINATORS.createVault,
    });

    const tx = new Transaction().add(ix);
    const signature = await sendAndConfirmTransaction(this.connection, tx, [owner]);

    return { signature, vault: vaultPDA };
  }

  async deposit(owner: Keypair, amountLamports: bigint): Promise<string> {
    const [vaultPDA] = deriveVaultPDA(owner.publicKey, this.programId);

    const data = Buffer.concat([
      DISCRIMINATORS.deposit,
      Buffer.from(new BigUint64Array([amountLamports]).buffer),
    ]);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: vaultPDA, isSigner: false, isWritable: true },
        { pubkey: owner.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });

    const tx = new Transaction().add(ix);
    return sendAndConfirmTransaction(this.connection, tx, [owner]);
  }

  async withdraw(
    owner: Keypair,
    treasury: PublicKey,
    amountLamports: bigint
  ): Promise<string> {
    const [protocolPDA] = deriveProtocolPDA(this.programId);
    const [vaultPDA] = deriveVaultPDA(owner.publicKey, this.programId);

    const data = Buffer.concat([
      DISCRIMINATORS.withdraw,
      Buffer.from(new BigUint64Array([amountLamports]).buffer),
    ]);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: protocolPDA, isSigner: false, isWritable: false },
        { pubkey: vaultPDA, isSigner: false, isWritable: true },
        { pubkey: owner.publicKey, isSigner: true, isWritable: true },
        { pubkey: treasury, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });

    const tx = new Transaction().add(ix);
    return sendAndConfirmTransaction(this.connection, tx, [owner]);
  }

  async getVault(owner: PublicKey): Promise<VaultAccount | null> {
    const [vaultPDA] = deriveVaultPDA(owner, this.programId);

    try {
      const accountInfo = await this.connection.getAccountInfo(vaultPDA);
      if (!accountInfo) return null;

      // Deserialize account data (skip 8-byte discriminator)
      const data = accountInfo.data.slice(8);
      return {
        owner: new PublicKey(data.slice(0, 32)),
        balanceLamports: data.readBigUInt64LE(32),
        totalDeposited: data.readBigUInt64LE(40),
        totalWithdrawn: data.readBigUInt64LE(48),
        totalPnl: data.readBigInt64LE(56),
        positionCount: data.readUInt32LE(64),
        createdAt: Number(data.readBigInt64LE(68)),
        bump: data[76],
      };
    } catch (e) {
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // Market Operations
  // --------------------------------------------------------------------------

  async registerMarket(
    authority: Keypair,
    oracle: PublicKey,
    marketId: string,
    platform: Platform,
    title: string,
    closeTimestamp: number
  ): Promise<{ signature: string; market: PublicKey }> {
    const [marketPDA] = deriveMarketPDA(marketId, this.programId);

    // Encode string lengths and data
    const marketIdBuffer = Buffer.from(marketId);
    const titleBuffer = Buffer.from(title);

    const data = Buffer.concat([
      DISCRIMINATORS.registerMarket,
      Buffer.from(new Uint32Array([marketIdBuffer.length]).buffer),
      marketIdBuffer,
      Buffer.from([platformToByte(platform)]),
      Buffer.from(new Uint32Array([titleBuffer.length]).buffer),
      titleBuffer,
      Buffer.from(new BigInt64Array([BigInt(closeTimestamp)]).buffer),
    ]);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: marketPDA, isSigner: false, isWritable: true },
        { pubkey: oracle, isSigner: false, isWritable: false },
        { pubkey: authority.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });

    const tx = new Transaction().add(ix);
    const signature = await sendAndConfirmTransaction(this.connection, tx, [authority]);

    return { signature, market: marketPDA };
  }

  async updatePrice(
    oracle: Keypair,
    marketId: string,
    yesPrice: number,
    noPrice: number
  ): Promise<string> {
    const [marketPDA] = deriveMarketPDA(marketId, this.programId);

    const data = Buffer.concat([
      DISCRIMINATORS.updatePrice,
      Buffer.from(new Uint16Array([yesPrice]).buffer),
      Buffer.from(new Uint16Array([noPrice]).buffer),
    ]);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: marketPDA, isSigner: false, isWritable: true },
        { pubkey: oracle.publicKey, isSigner: true, isWritable: false },
      ],
      data,
    });

    const tx = new Transaction().add(ix);
    return sendAndConfirmTransaction(this.connection, tx, [oracle]);
  }

  async resolveMarket(
    oracle: Keypair,
    marketId: string,
    outcome: Outcome
  ): Promise<string> {
    const [marketPDA] = deriveMarketPDA(marketId, this.programId);

    const data = Buffer.concat([
      DISCRIMINATORS.resolveMarket,
      Buffer.from([outcomeToByte(outcome)]),
    ]);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: marketPDA, isSigner: false, isWritable: true },
        { pubkey: oracle.publicKey, isSigner: true, isWritable: false },
      ],
      data,
    });

    const tx = new Transaction().add(ix);
    return sendAndConfirmTransaction(this.connection, tx, [oracle]);
  }

  // --------------------------------------------------------------------------
  // Position Operations
  // --------------------------------------------------------------------------

  async openPosition(
    owner: Keypair,
    marketId: string,
    side: Side,
    amountLamports: bigint
  ): Promise<{ signature: string; position: PublicKey }> {
    const [vaultPDA] = deriveVaultPDA(owner.publicKey, this.programId);
    const [marketPDA] = deriveMarketPDA(marketId, this.programId);
    const [positionPDA] = derivePositionPDA(vaultPDA, marketPDA, this.programId);

    const data = Buffer.concat([
      DISCRIMINATORS.openPosition,
      Buffer.from([sideToByte(side)]),
      Buffer.from(new BigUint64Array([amountLamports]).buffer),
    ]);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: vaultPDA, isSigner: false, isWritable: true },
        { pubkey: marketPDA, isSigner: false, isWritable: false },
        { pubkey: positionPDA, isSigner: false, isWritable: true },
        { pubkey: owner.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });

    const tx = new Transaction().add(ix);
    const signature = await sendAndConfirmTransaction(this.connection, tx, [owner]);

    return { signature, position: positionPDA };
  }

  async closePosition(owner: Keypair, marketId: string): Promise<string> {
    const [vaultPDA] = deriveVaultPDA(owner.publicKey, this.programId);
    const [marketPDA] = deriveMarketPDA(marketId, this.programId);
    const [positionPDA] = derivePositionPDA(vaultPDA, marketPDA, this.programId);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: vaultPDA, isSigner: false, isWritable: true },
        { pubkey: marketPDA, isSigner: false, isWritable: false },
        { pubkey: positionPDA, isSigner: false, isWritable: true },
        { pubkey: owner.publicKey, isSigner: true, isWritable: true },
      ],
      data: DISCRIMINATORS.closePosition,
    });

    const tx = new Transaction().add(ix);
    return sendAndConfirmTransaction(this.connection, tx, [owner]);
  }

  async settlePosition(owner: Keypair, marketId: string): Promise<string> {
    const [vaultPDA] = deriveVaultPDA(owner.publicKey, this.programId);
    const [marketPDA] = deriveMarketPDA(marketId, this.programId);
    const [positionPDA] = derivePositionPDA(vaultPDA, marketPDA, this.programId);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: vaultPDA, isSigner: false, isWritable: true },
        { pubkey: marketPDA, isSigner: false, isWritable: false },
        { pubkey: positionPDA, isSigner: false, isWritable: true },
        { pubkey: owner.publicKey, isSigner: true, isWritable: true },
      ],
      data: DISCRIMINATORS.settlePosition,
    });

    const tx = new Transaction().add(ix);
    return sendAndConfirmTransaction(this.connection, tx, [owner]);
  }

  // --------------------------------------------------------------------------
  // Oracle Operations
  // --------------------------------------------------------------------------

  async addOracle(authority: Keypair, oracle: PublicKey): Promise<string> {
    const [protocolPDA] = deriveProtocolPDA(this.programId);
    const [oraclePDA] = deriveOraclePDA(oracle, this.programId);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: protocolPDA, isSigner: false, isWritable: false },
        { pubkey: oraclePDA, isSigner: false, isWritable: true },
        { pubkey: oracle, isSigner: false, isWritable: false },
        { pubkey: authority.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: DISCRIMINATORS.addOracle,
    });

    const tx = new Transaction().add(ix);
    return sendAndConfirmTransaction(this.connection, tx, [authority]);
  }

  // --------------------------------------------------------------------------
  // Helper Methods
  // --------------------------------------------------------------------------

  /**
   * Get all positions for a vault
   */
  async getVaultPositions(owner: PublicKey): Promise<PositionAccount[]> {
    const [vaultPDA] = deriveVaultPDA(owner, this.programId);

    // Get all program accounts with position prefix
    const accounts = await this.connection.getProgramAccounts(this.programId, {
      filters: [
        { memcmp: { offset: 8, bytes: vaultPDA.toBase58() } }, // Match vault pubkey
      ],
    });

    return accounts.map(({ account }) => {
      const data = account.data.slice(8);
      return {
        vault: new PublicKey(data.slice(0, 32)),
        market: new PublicKey(data.slice(32, 64)),
        side: data[64] === 0 ? 'yes' : 'no',
        quantity: data.readBigUInt64LE(65),
        entryPrice: data.readUInt16LE(73),
        amountInvested: data.readBigUInt64LE(75),
        settled: data[83] === 1,
        pnl: data.readBigInt64LE(84),
        createdAt: Number(data.readBigInt64LE(92)),
        bump: data[100],
      } as PositionAccount;
    });
  }

  /**
   * Calculate current portfolio value
   */
  async getPortfolioValue(owner: PublicKey): Promise<{
    cash: bigint;
    positions: bigint;
    total: bigint;
    pnl: bigint;
    pnlPercent: number;
  }> {
    const vault = await this.getVault(owner);
    if (!vault) throw new Error('Vault not found');

    const positions = await this.getVaultPositions(owner);

    let positionsValue = BigInt(0);
    for (const pos of positions) {
      if (!pos.settled) {
        // Would need to fetch current market price here
        positionsValue += pos.amountInvested;
      }
    }

    const total = vault.balanceLamports + positionsValue;
    const pnlPercent = vault.totalDeposited > 0
      ? Number((vault.totalPnl * BigInt(10000)) / vault.totalDeposited) / 100
      : 0;

    return {
      cash: vault.balanceLamports,
      positions: positionsValue,
      total,
      pnl: vault.totalPnl,
      pnlPercent,
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

export default {
  PredictionAggregatorSDK,
  deriveProtocolPDA,
  deriveVaultPDA,
  deriveMarketPDA,
  derivePositionPDA,
  deriveOraclePDA,
  PROGRAM_ID,
};
