#!/usr/bin/env bun
/**
 * Prediction Markets DeFi Module
 *
 * On-chain integration for prediction markets:
 * 1. Solana Prediction Aggregator - On-chain trading and settlement
 * 2. LP Analytics - Liquidity provider performance tracking
 * 3. Cross-Chain Arbitrage - Solana vs Polygon/Ethereum opportunities
 * 4. Wallet Integration - Connect and trade with real wallets
 * 5. Oracle Network - Price feeds and resolution
 */

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
} from '@solana/web3.js';

// ============================================================================
// Types
// ============================================================================

export type Chain = 'solana' | 'polygon' | 'ethereum' | 'arbitrum';
export type DeFiProtocol = 'drift' | 'polymarket' | 'omen' | 'augur';

export interface OnChainMarket {
  address: string;
  chain: Chain;
  protocol: DeFiProtocol;
  title: string;
  yesTokenMint?: string;
  noTokenMint?: string;
  yesPrice: number;
  noPrice: number;
  totalLiquidity: number;
  volume24h: number;
  tvl: number;
  resolved: boolean;
  outcome?: 'yes' | 'no';
  expirationTimestamp?: number;
}

export interface LPPosition {
  id: string;
  protocol: DeFiProtocol;
  chain: Chain;
  marketAddress: string;
  marketTitle: string;
  lpTokenBalance: number;
  yesTokensProvided: number;
  noTokensProvided: number;
  entryYesPrice: number;
  entryNoPrice: number;
  currentYesPrice: number;
  currentNoPrice: number;
  feesEarned: number;
  impermanentLoss: number;
  totalValue: number;
  pnl: number;
  pnlPercent: number;
  apy: number;
  createdAt: number;
}

export interface CrossChainOpportunity {
  marketTitle: string;
  normalizedQuestion: string;
  chain1: {
    chain: Chain;
    protocol: DeFiProtocol;
    marketAddress: string;
    yesPrice: number;
    liquidity: number;
  };
  chain2: {
    chain: Chain;
    protocol: DeFiProtocol;
    marketAddress: string;
    yesPrice: number;
    liquidity: number;
  };
  priceDivergence: number;
  estimatedProfit: number;
  bridgeCost: number;
  netProfit: number;
  executable: boolean;
  strategy: string;
}

export interface WalletState {
  address: string;
  chain: Chain;
  balance: number;
  positions: LPPosition[];
  pendingTx: string[];
}

export interface OracleUpdate {
  marketAddress: string;
  source: string;
  yesPrice: number;
  noPrice: number;
  timestamp: number;
  confidence: number;
}

// ============================================================================
// Solana Prediction Program SDK
// ============================================================================

const PREDICTION_PROGRAM_ID = new PublicKey('PRED111111111111111111111111111111111111111');

// Instruction discriminators
const INSTRUCTIONS = {
  initializeMarket: Buffer.from([0]),
  deposit: Buffer.from([1]),
  withdraw: Buffer.from([2]),
  buyYes: Buffer.from([3]),
  buyNo: Buffer.from([4]),
  sellYes: Buffer.from([5]),
  sellNo: Buffer.from([6]),
  resolveMarket: Buffer.from([7]),
  claimWinnings: Buffer.from([8]),
  addLiquidity: Buffer.from([9]),
  removeLiquidity: Buffer.from([10]),
};

export class SolanaPredictionSDK {
  private connection: Connection;
  private programId: PublicKey;

  constructor(rpcUrl: string = 'https://api.mainnet-beta.solana.com') {
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.programId = PREDICTION_PROGRAM_ID;
  }

  // PDA derivation
  deriveMarketPDA(marketId: string): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('market'), Buffer.from(marketId)],
      this.programId
    );
  }

  deriveVaultPDA(marketAddress: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), marketAddress.toBuffer()],
      this.programId
    );
  }

  deriveUserPositionPDA(marketAddress: PublicKey, user: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('position'), marketAddress.toBuffer(), user.toBuffer()],
      this.programId
    );
  }

  deriveLpTokenMintPDA(marketAddress: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('lp_mint'), marketAddress.toBuffer()],
      this.programId
    );
  }

  // Create market instruction
  createInitializeMarketIx(
    authority: PublicKey,
    marketId: string,
    title: string,
    expirationTimestamp: number,
    oracleFeed?: PublicKey
  ): TransactionInstruction {
    const [marketPDA] = this.deriveMarketPDA(marketId);
    const [vaultPDA] = this.deriveVaultPDA(marketPDA);

    const titleBuffer = Buffer.from(title.slice(0, 200));
    const data = Buffer.concat([
      INSTRUCTIONS.initializeMarket,
      Buffer.from(new Uint32Array([marketId.length]).buffer),
      Buffer.from(marketId),
      Buffer.from(new Uint32Array([titleBuffer.length]).buffer),
      titleBuffer,
      Buffer.from(new BigInt64Array([BigInt(expirationTimestamp)]).buffer),
    ]);

    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: marketPDA, isSigner: false, isWritable: true },
        { pubkey: vaultPDA, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: true },
        { pubkey: oracleFeed || SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
  }

  // Buy YES tokens
  createBuyYesIx(
    user: PublicKey,
    marketAddress: PublicKey,
    amountLamports: bigint
  ): TransactionInstruction {
    const [vaultPDA] = this.deriveVaultPDA(marketAddress);
    const [positionPDA] = this.deriveUserPositionPDA(marketAddress, user);

    const data = Buffer.concat([
      INSTRUCTIONS.buyYes,
      Buffer.from(new BigUint64Array([amountLamports]).buffer),
    ]);

    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: marketAddress, isSigner: false, isWritable: true },
        { pubkey: vaultPDA, isSigner: false, isWritable: true },
        { pubkey: positionPDA, isSigner: false, isWritable: true },
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
  }

  // Buy NO tokens
  createBuyNoIx(
    user: PublicKey,
    marketAddress: PublicKey,
    amountLamports: bigint
  ): TransactionInstruction {
    const [vaultPDA] = this.deriveVaultPDA(marketAddress);
    const [positionPDA] = this.deriveUserPositionPDA(marketAddress, user);

    const data = Buffer.concat([
      INSTRUCTIONS.buyNo,
      Buffer.from(new BigUint64Array([amountLamports]).buffer),
    ]);

    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: marketAddress, isSigner: false, isWritable: true },
        { pubkey: vaultPDA, isSigner: false, isWritable: true },
        { pubkey: positionPDA, isSigner: false, isWritable: true },
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
  }

  // Add liquidity
  createAddLiquidityIx(
    user: PublicKey,
    marketAddress: PublicKey,
    amountLamports: bigint
  ): TransactionInstruction {
    const [vaultPDA] = this.deriveVaultPDA(marketAddress);
    const [lpMintPDA] = this.deriveLpTokenMintPDA(marketAddress);

    const data = Buffer.concat([
      INSTRUCTIONS.addLiquidity,
      Buffer.from(new BigUint64Array([amountLamports]).buffer),
    ]);

    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: marketAddress, isSigner: false, isWritable: true },
        { pubkey: vaultPDA, isSigner: false, isWritable: true },
        { pubkey: lpMintPDA, isSigner: false, isWritable: true },
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
  }

  // Remove liquidity
  createRemoveLiquidityIx(
    user: PublicKey,
    marketAddress: PublicKey,
    lpTokenAmount: bigint
  ): TransactionInstruction {
    const [vaultPDA] = this.deriveVaultPDA(marketAddress);
    const [lpMintPDA] = this.deriveLpTokenMintPDA(marketAddress);

    const data = Buffer.concat([
      INSTRUCTIONS.removeLiquidity,
      Buffer.from(new BigUint64Array([lpTokenAmount]).buffer),
    ]);

    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: marketAddress, isSigner: false, isWritable: true },
        { pubkey: vaultPDA, isSigner: false, isWritable: true },
        { pubkey: lpMintPDA, isSigner: false, isWritable: true },
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
  }

  // Resolve market
  createResolveMarketIx(
    authority: PublicKey,
    marketAddress: PublicKey,
    outcome: 'yes' | 'no'
  ): TransactionInstruction {
    const data = Buffer.concat([
      INSTRUCTIONS.resolveMarket,
      Buffer.from([outcome === 'yes' ? 1 : 0]),
    ]);

    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: marketAddress, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: false },
      ],
      data,
    });
  }

  // Claim winnings after resolution
  createClaimWinningsIx(
    user: PublicKey,
    marketAddress: PublicKey
  ): TransactionInstruction {
    const [vaultPDA] = this.deriveVaultPDA(marketAddress);
    const [positionPDA] = this.deriveUserPositionPDA(marketAddress, user);

    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: marketAddress, isSigner: false, isWritable: true },
        { pubkey: vaultPDA, isSigner: false, isWritable: true },
        { pubkey: positionPDA, isSigner: false, isWritable: true },
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: INSTRUCTIONS.claimWinnings,
    });
  }

  // Fetch market data
  async getMarket(marketAddress: PublicKey): Promise<OnChainMarket | null> {
    try {
      const accountInfo = await this.connection.getAccountInfo(marketAddress);
      if (!accountInfo) return null;

      // Deserialize market data (simplified)
      const data = accountInfo.data;
      // Skip 8-byte discriminator
      const titleLen = data.readUInt32LE(8);
      const title = data.slice(12, 12 + titleLen).toString();

      return {
        address: marketAddress.toBase58(),
        chain: 'solana',
        protocol: 'drift',
        title,
        yesPrice: data.readUInt16LE(12 + titleLen) / 10000,
        noPrice: data.readUInt16LE(14 + titleLen) / 10000,
        totalLiquidity: Number(data.readBigUInt64LE(16 + titleLen)) / LAMPORTS_PER_SOL,
        volume24h: Number(data.readBigUInt64LE(24 + titleLen)) / LAMPORTS_PER_SOL,
        tvl: Number(data.readBigUInt64LE(32 + titleLen)) / LAMPORTS_PER_SOL,
        resolved: data[40 + titleLen] === 1,
        outcome: data[41 + titleLen] === 1 ? 'yes' : data[41 + titleLen] === 2 ? 'no' : undefined,
        expirationTimestamp: Number(data.readBigInt64LE(42 + titleLen)),
      };
    } catch (e) {
      console.error('Failed to fetch market:', e);
      return null;
    }
  }

  // Get user position
  async getUserPosition(marketAddress: PublicKey, user: PublicKey): Promise<{
    yesTokens: number;
    noTokens: number;
    lpTokens: number;
    averageYesCost: number;
    averageNoCost: number;
  } | null> {
    try {
      const [positionPDA] = this.deriveUserPositionPDA(marketAddress, user);
      const accountInfo = await this.connection.getAccountInfo(positionPDA);
      if (!accountInfo) return null;

      const data = accountInfo.data;
      return {
        yesTokens: Number(data.readBigUInt64LE(8)) / LAMPORTS_PER_SOL,
        noTokens: Number(data.readBigUInt64LE(16)) / LAMPORTS_PER_SOL,
        lpTokens: Number(data.readBigUInt64LE(24)) / LAMPORTS_PER_SOL,
        averageYesCost: data.readUInt16LE(32) / 10000,
        averageNoCost: data.readUInt16LE(34) / 10000,
      };
    } catch {
      return null;
    }
  }

  // Get connection
  getConnection(): Connection {
    return this.connection;
  }
}

// ============================================================================
// LP Analytics Engine
// ============================================================================

export class LPAnalytics {
  private positions: Map<string, LPPosition> = new Map();

  // Calculate impermanent loss for binary outcome AMM
  calculateImpermanentLoss(
    entryYesPrice: number,
    entryNoPrice: number,
    currentYesPrice: number,
    currentNoPrice: number
  ): number {
    // For binary outcome markets, IL occurs when price moves away from entry
    // IL = 2 * sqrt(P_current / P_entry) / (1 + P_current / P_entry) - 1

    const priceRatio = currentYesPrice / entryYesPrice;

    if (priceRatio === 1) return 0;

    const ilFactor = (2 * Math.sqrt(priceRatio)) / (1 + priceRatio) - 1;
    return Math.abs(ilFactor) * 100; // Return as percentage
  }

  // Estimate LP APY based on volume and fees
  calculateAPY(
    dailyVolume: number,
    totalLiquidity: number,
    feeRate: number = 0.02 // 2% typical fee
  ): number {
    if (totalLiquidity === 0) return 0;

    const dailyFees = dailyVolume * feeRate;
    const dailyYield = dailyFees / totalLiquidity;
    const apy = (Math.pow(1 + dailyYield, 365) - 1) * 100;

    return Math.min(apy, 10000); // Cap at 10000% APY
  }

  // Track a new LP position
  trackPosition(
    protocol: DeFiProtocol,
    chain: Chain,
    marketAddress: string,
    marketTitle: string,
    lpTokenBalance: number,
    yesTokensProvided: number,
    noTokensProvided: number,
    currentYesPrice: number,
    currentNoPrice: number
  ): LPPosition {
    const id = `${chain}:${protocol}:${marketAddress}`;

    const position: LPPosition = {
      id,
      protocol,
      chain,
      marketAddress,
      marketTitle,
      lpTokenBalance,
      yesTokensProvided,
      noTokensProvided,
      entryYesPrice: currentYesPrice,
      entryNoPrice: currentNoPrice,
      currentYesPrice,
      currentNoPrice,
      feesEarned: 0,
      impermanentLoss: 0,
      totalValue: (yesTokensProvided * currentYesPrice) + (noTokensProvided * currentNoPrice),
      pnl: 0,
      pnlPercent: 0,
      apy: 0,
      createdAt: Date.now(),
    };

    this.positions.set(id, position);
    return position;
  }

  // Update position with current prices
  updatePosition(
    id: string,
    currentYesPrice: number,
    currentNoPrice: number,
    feesEarned: number,
    dailyVolume: number,
    totalLiquidity: number
  ): LPPosition | null {
    const position = this.positions.get(id);
    if (!position) return null;

    position.currentYesPrice = currentYesPrice;
    position.currentNoPrice = currentNoPrice;
    position.feesEarned = feesEarned;

    position.impermanentLoss = this.calculateImpermanentLoss(
      position.entryYesPrice,
      position.entryNoPrice,
      currentYesPrice,
      currentNoPrice
    );

    const currentValue = (position.yesTokensProvided * currentYesPrice) +
      (position.noTokensProvided * currentNoPrice) +
      feesEarned;
    const initialValue = position.totalValue;

    position.totalValue = currentValue;
    position.pnl = currentValue - initialValue;
    position.pnlPercent = (position.pnl / initialValue) * 100;
    position.apy = this.calculateAPY(dailyVolume, totalLiquidity);

    return position;
  }

  // Get all positions
  getAllPositions(): LPPosition[] {
    return Array.from(this.positions.values());
  }

  // Get position by ID
  getPosition(id: string): LPPosition | null {
    return this.positions.get(id) || null;
  }

  // Get positions by chain
  getPositionsByChain(chain: Chain): LPPosition[] {
    return Array.from(this.positions.values()).filter(p => p.chain === chain);
  }

  // Get total portfolio stats
  getPortfolioStats(): {
    totalValue: number;
    totalPnl: number;
    totalPnlPercent: number;
    totalFeesEarned: number;
    avgImpermanentLoss: number;
    positionCount: number;
    byChain: Record<Chain, { value: number; pnl: number }>;
  } {
    const positions = this.getAllPositions();
    const byChain: Record<Chain, { value: number; pnl: number }> = {
      solana: { value: 0, pnl: 0 },
      polygon: { value: 0, pnl: 0 },
      ethereum: { value: 0, pnl: 0 },
      arbitrum: { value: 0, pnl: 0 },
    };

    let totalValue = 0;
    let totalPnl = 0;
    let totalFeesEarned = 0;
    let totalIL = 0;
    let initialValue = 0;

    for (const pos of positions) {
      totalValue += pos.totalValue;
      totalPnl += pos.pnl;
      totalFeesEarned += pos.feesEarned;
      totalIL += pos.impermanentLoss;
      initialValue += pos.totalValue - pos.pnl;

      byChain[pos.chain].value += pos.totalValue;
      byChain[pos.chain].pnl += pos.pnl;
    }

    return {
      totalValue,
      totalPnl,
      totalPnlPercent: initialValue > 0 ? (totalPnl / initialValue) * 100 : 0,
      totalFeesEarned,
      avgImpermanentLoss: positions.length > 0 ? totalIL / positions.length : 0,
      positionCount: positions.length,
      byChain,
    };
  }

  // Simulate adding liquidity
  simulateAddLiquidity(
    amount: number,
    currentYesPrice: number,
    currentNoPrice: number,
    estimatedDailyVolume: number,
    totalLiquidityAfter: number
  ): {
    yesTokens: number;
    noTokens: number;
    lpTokens: number;
    estimatedDailyFees: number;
    estimatedAPY: number;
    breakEvenDays: number;
  } {
    // In a constant product AMM, liquidity is split based on prices
    const yesWeight = 1 - currentYesPrice;
    const noWeight = 1 - currentNoPrice;
    const totalWeight = yesWeight + noWeight;

    const yesTokens = (amount * yesWeight) / totalWeight / currentYesPrice;
    const noTokens = (amount * noWeight) / totalWeight / currentNoPrice;
    const lpTokens = Math.sqrt(yesTokens * noTokens);

    const estimatedAPY = this.calculateAPY(estimatedDailyVolume, totalLiquidityAfter);
    const estimatedDailyFees = (amount / totalLiquidityAfter) * estimatedDailyVolume * 0.02;

    // Break even considering typical IL of ~2-5%
    const avgIL = 0.03;
    const dailyYield = estimatedDailyFees / amount;
    const breakEvenDays = dailyYield > 0 ? avgIL / dailyYield : Infinity;

    return {
      yesTokens,
      noTokens,
      lpTokens,
      estimatedDailyFees,
      estimatedAPY,
      breakEvenDays: Math.ceil(breakEvenDays),
    };
  }
}

// ============================================================================
// Cross-Chain Arbitrage Detector
// ============================================================================

export class CrossChainArbitrage {
  private solanaSdk: SolanaPredictionSDK;
  private polymarketUrl = 'https://gamma-api.polymarket.com';
  private bridgeCosts: Record<string, number> = {
    'solana-polygon': 5, // $5 estimated bridge cost
    'solana-ethereum': 15,
    'solana-arbitrum': 3,
    'polygon-ethereum': 10,
    'polygon-arbitrum': 2,
  };

  constructor(solanaRpcUrl?: string) {
    this.solanaSdk = new SolanaPredictionSDK(solanaRpcUrl);
  }

  // Fetch markets from multiple chains
  async fetchMultiChainMarkets(): Promise<OnChainMarket[]> {
    const markets: OnChainMarket[] = [];

    // Fetch Polymarket (Polygon)
    try {
      const response = await fetch(`${this.polymarketUrl}/markets?closed=false&limit=100`, {
        signal: AbortSignal.timeout(15000),
      });
      if (response.ok) {
        const data = await response.json();
        for (const m of data || []) {
          markets.push({
            address: m.conditionId || m.id,
            chain: 'polygon',
            protocol: 'polymarket',
            title: m.question || m.title,
            yesPrice: parseFloat(m.outcomePrices?.[0] || '0.5'),
            noPrice: parseFloat(m.outcomePrices?.[1] || '0.5'),
            totalLiquidity: parseFloat(m.liquidity || '0'),
            volume24h: parseFloat(m.volume24hr || '0'),
            tvl: parseFloat(m.liquidity || '0'),
            resolved: m.closed || false,
          });
        }
      }
    } catch (e) {
      console.error('Failed to fetch Polymarket:', e);
    }

    // Fetch Drift/Solana markets
    try {
      const response = await fetch('https://prediction-markets-api.dflow.net/api/v1/events?limit=100', {
        signal: AbortSignal.timeout(15000),
      });
      if (response.ok) {
        const data = await response.json();
        for (const m of data.events || []) {
          markets.push({
            address: m.ticker,
            chain: 'solana',
            protocol: 'drift',
            title: m.title,
            yesPrice: m.yesPrice || 0.5,
            noPrice: m.noPrice || 0.5,
            totalLiquidity: m.liquidity || 0,
            volume24h: m.volume24h || 0,
            tvl: m.liquidity || 0,
            resolved: m.resolved || false,
          });
        }
      }
    } catch (e) {
      console.error('Failed to fetch Drift:', e);
    }

    return markets;
  }

  // Normalize question for matching
  private normalizeQuestion(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60);
  }

  // Find cross-chain arbitrage opportunities
  async findOpportunities(minProfit: number = 1): Promise<CrossChainOpportunity[]> {
    const markets = await this.fetchMultiChainMarkets();
    const opportunities: CrossChainOpportunity[] = [];

    // Group markets by normalized question
    const byQuestion = new Map<string, OnChainMarket[]>();
    for (const market of markets) {
      const normalized = this.normalizeQuestion(market.title);
      if (!byQuestion.has(normalized)) {
        byQuestion.set(normalized, []);
      }
      byQuestion.get(normalized)!.push(market);
    }

    // Find markets on different chains
    for (const [normalizedQuestion, marketGroup] of Array.from(byQuestion.entries())) {
      if (marketGroup.length < 2) continue;

      // Check for cross-chain pairs
      for (let i = 0; i < marketGroup.length; i++) {
        for (let j = i + 1; j < marketGroup.length; j++) {
          const m1 = marketGroup[i];
          const m2 = marketGroup[j];

          if (m1.chain === m2.chain) continue;

          const priceDiff = Math.abs(m1.yesPrice - m2.yesPrice);
          const bridgeKey = [m1.chain, m2.chain].sort().join('-');
          const bridgeCost = this.bridgeCosts[bridgeKey] || 10;

          // Estimate profit (simplified)
          // Assume $1000 trade size
          const tradeSize = 1000;
          const grossProfit = priceDiff * tradeSize;
          const fees = tradeSize * 0.02; // 2% trading fees
          const netProfit = grossProfit - fees - bridgeCost;

          if (netProfit >= minProfit) {
            const buyChain = m1.yesPrice < m2.yesPrice ? m1 : m2;
            const sellChain = m1.yesPrice < m2.yesPrice ? m2 : m1;

            opportunities.push({
              marketTitle: m1.title,
              normalizedQuestion,
              chain1: {
                chain: buyChain.chain,
                protocol: buyChain.protocol,
                marketAddress: buyChain.address,
                yesPrice: buyChain.yesPrice,
                liquidity: buyChain.totalLiquidity,
              },
              chain2: {
                chain: sellChain.chain,
                protocol: sellChain.protocol,
                marketAddress: sellChain.address,
                yesPrice: sellChain.yesPrice,
                liquidity: sellChain.totalLiquidity,
              },
              priceDivergence: priceDiff,
              estimatedProfit: grossProfit,
              bridgeCost,
              netProfit,
              executable: Math.min(buyChain.totalLiquidity, sellChain.totalLiquidity) >= tradeSize,
              strategy: `Buy YES on ${buyChain.chain}/${buyChain.protocol} @ ${(buyChain.yesPrice * 100).toFixed(1)}%, ` +
                `Sell on ${sellChain.chain}/${sellChain.protocol} @ ${(sellChain.yesPrice * 100).toFixed(1)}%`,
            });
          }
        }
      }
    }

    return opportunities.sort((a, b) => b.netProfit - a.netProfit);
  }

  // Estimate bridge costs
  getBridgeCost(fromChain: Chain, toChain: Chain): number {
    const key = [fromChain, toChain].sort().join('-');
    return this.bridgeCosts[key] || 10;
  }

  // Get optimal route for arbitrage
  getOptimalRoute(
    buyChain: Chain,
    sellChain: Chain,
    amount: number
  ): {
    steps: string[];
    totalCost: number;
    estimatedTime: string;
  } {
    const bridgeCost = this.getBridgeCost(buyChain, sellChain);
    const tradingFees = amount * 0.02;

    const steps = [
      `1. Buy YES tokens on ${buyChain} ($${(amount * 0.01).toFixed(2)} fee)`,
      `2. Bridge tokens from ${buyChain} to ${sellChain} ($${bridgeCost} + ~10 min)`,
      `3. Sell YES tokens on ${sellChain} ($${(amount * 0.01).toFixed(2)} fee)`,
    ];

    const timeEstimates: Record<string, string> = {
      'solana-polygon': '15-30 min',
      'solana-ethereum': '30-60 min',
      'polygon-ethereum': '20-40 min',
    };

    const timeKey = [buyChain, sellChain].sort().join('-');

    return {
      steps,
      totalCost: bridgeCost + tradingFees,
      estimatedTime: timeEstimates[timeKey] || '30-60 min',
    };
  }
}

// ============================================================================
// Wallet Manager
// ============================================================================

export class WalletManager {
  private wallets: Map<string, WalletState> = new Map();
  private solanaSdk: SolanaPredictionSDK;

  constructor(solanaRpcUrl?: string) {
    this.solanaSdk = new SolanaPredictionSDK(solanaRpcUrl);
  }

  // Connect a wallet (address only, no private key for security)
  async connectWallet(address: string, chain: Chain): Promise<WalletState> {
    const id = `${chain}:${address}`;

    let balance = 0;
    if (chain === 'solana') {
      try {
        const pubkey = new PublicKey(address);
        balance = await this.solanaSdk.getConnection().getBalance(pubkey) / LAMPORTS_PER_SOL;
      } catch {
        balance = 0;
      }
    }

    const wallet: WalletState = {
      address,
      chain,
      balance,
      positions: [],
      pendingTx: [],
    };

    this.wallets.set(id, wallet);
    return wallet;
  }

  // Get wallet state
  getWallet(address: string, chain: Chain): WalletState | null {
    return this.wallets.get(`${chain}:${address}`) || null;
  }

  // Refresh wallet balance
  async refreshBalance(address: string, chain: Chain): Promise<number> {
    const wallet = this.getWallet(address, chain);
    if (!wallet) throw new Error('Wallet not connected');

    if (chain === 'solana') {
      try {
        const pubkey = new PublicKey(address);
        wallet.balance = await this.solanaSdk.getConnection().getBalance(pubkey) / LAMPORTS_PER_SOL;
      } catch {
        // Keep existing balance
      }
    }

    return wallet.balance;
  }

  // Get all connected wallets
  getAllWallets(): WalletState[] {
    return Array.from(this.wallets.values());
  }

  // Disconnect wallet
  disconnectWallet(address: string, chain: Chain): boolean {
    return this.wallets.delete(`${chain}:${address}`);
  }

  // Get total portfolio value across all chains
  getTotalPortfolioValue(): {
    total: number;
    byChain: Record<Chain, number>;
  } {
    const byChain: Record<Chain, number> = {
      solana: 0,
      polygon: 0,
      ethereum: 0,
      arbitrum: 0,
    };

    let total = 0;
    for (const wallet of Array.from(this.wallets.values())) {
      byChain[wallet.chain] += wallet.balance;
      total += wallet.balance;
    }

    return { total, byChain };
  }
}

// ============================================================================
// Oracle Network
// ============================================================================

export class OracleNetwork {
  private updates: Map<string, OracleUpdate[]> = new Map();
  private sources = ['pyth', 'switchboard', 'chainlink', 'api3'];

  // Record oracle update
  recordUpdate(
    marketAddress: string,
    source: string,
    yesPrice: number,
    noPrice: number,
    confidence: number
  ): OracleUpdate {
    const update: OracleUpdate = {
      marketAddress,
      source,
      yesPrice,
      noPrice,
      timestamp: Date.now(),
      confidence,
    };

    if (!this.updates.has(marketAddress)) {
      this.updates.set(marketAddress, []);
    }

    const updates = this.updates.get(marketAddress)!;
    updates.push(update);

    // Keep last 100 updates per market
    if (updates.length > 100) {
      updates.shift();
    }

    return update;
  }

  // Get aggregated price from multiple sources
  getAggregatedPrice(marketAddress: string): {
    yesPrice: number;
    noPrice: number;
    confidence: number;
    sources: number;
    lastUpdate: number;
  } | null {
    const updates = this.updates.get(marketAddress);
    if (!updates || updates.length === 0) return null;

    // Get most recent update from each source
    const latestBySource = new Map<string, OracleUpdate>();
    for (const update of updates) {
      const existing = latestBySource.get(update.source);
      if (!existing || update.timestamp > existing.timestamp) {
        latestBySource.set(update.source, update);
      }
    }

    // Filter updates from last 5 minutes
    const recentUpdates = Array.from(latestBySource.values())
      .filter(u => Date.now() - u.timestamp < 5 * 60 * 1000);

    if (recentUpdates.length === 0) return null;

    // Weighted average by confidence
    let totalWeight = 0;
    let weightedYes = 0;
    let weightedNo = 0;

    for (const update of recentUpdates) {
      totalWeight += update.confidence;
      weightedYes += update.yesPrice * update.confidence;
      weightedNo += update.noPrice * update.confidence;
    }

    return {
      yesPrice: weightedYes / totalWeight,
      noPrice: weightedNo / totalWeight,
      confidence: totalWeight / recentUpdates.length,
      sources: recentUpdates.length,
      lastUpdate: Math.max(...recentUpdates.map(u => u.timestamp)),
    };
  }

  // Get price history
  getPriceHistory(marketAddress: string, limit = 50): OracleUpdate[] {
    const updates = this.updates.get(marketAddress);
    if (!updates) return [];
    return updates.slice(-limit);
  }

  // Simulate oracle feed (for testing)
  simulateOracleFeed(marketAddress: string, baseYesPrice: number): void {
    for (const source of this.sources) {
      // Add slight variation per source
      const variation = (Math.random() - 0.5) * 0.02;
      const yesPrice = Math.max(0, Math.min(1, baseYesPrice + variation));

      this.recordUpdate(
        marketAddress,
        source,
        yesPrice,
        1 - yesPrice,
        0.8 + Math.random() * 0.2 // 80-100% confidence
      );
    }
  }
}

// ============================================================================
// Exports
// ============================================================================

export default {
  SolanaPredictionSDK,
  LPAnalytics,
  CrossChainArbitrage,
  WalletManager,
  OracleNetwork,
};
