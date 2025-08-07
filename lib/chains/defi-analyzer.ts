/**
 * DeFi protocol interaction analysis system
 * 
 * This module provides comprehensive analysis of DeFi protocol interactions
 * across multiple blockchains, including AMM, lending, yield farming,
 * and advanced DeFi strategies.
 */

import {
  ChainId,
  UnifiedTransaction,
  DeFiInteraction,
  TokenTransfer,
  LiquidityData,
  FlashLoan
} from './types';
import { ethers } from 'ethers';

// DeFi Protocol Registry
export interface DeFiProtocol {
  name: string;
  chainId: ChainId;
  category: 'amm' | 'lending' | 'farming' | 'staking' | 'derivatives' | 'insurance';
  version: string;
  addresses: {
    router?: string;
    factory?: string;
    pool?: string;
    vault?: string;
    [key: string]: string | undefined;
  };
  abi: {
    [method: string]: string[];
  };
  tokens: {
    governance?: string;
    reward?: string;
    native?: string;
  };
}

export interface AMMInteraction {
  type: 'swap' | 'add_liquidity' | 'remove_liquidity' | 'create_pair';
  protocol: string;
  chainId: ChainId;
  
  // Swap details
  tokenIn?: {
    address: string;
    symbol: string;
    amount: string;
    valueUsd: number;
  };
  tokenOut?: {
    address: string;
    symbol: string;
    amount: string;
    valueUsd: number;
  };
  
  // Liquidity details
  liquidityTokens?: Array<{
    address: string;
    symbol: string;
    amount: string;
    valueUsd: number;
  }>;
  lpTokens?: {
    address: string;
    amount: string;
    valueUsd: number;
  };
  
  // Metrics
  slippage?: number;
  priceImpact?: number;
  fees?: {
    protocol: number;
    lp: number;
    total: number;
  };
  
  // Pool information
  poolAddress?: string;
  poolReserves?: {
    token0: string;
    token1: string;
    reserve0: string;
    reserve1: string;
  };
  
  timestamp: number;
  blockNumber: number;
  transactionHash: string;
}

export interface LendingInteraction {
  type: 'deposit' | 'withdraw' | 'borrow' | 'repay' | 'liquidation';
  protocol: string;
  chainId: ChainId;
  
  // Asset details
  asset: {
    address: string;
    symbol: string;
    amount: string;
    valueUsd: number;
  };
  
  // Lending metrics
  apy?: number;
  borrowRate?: number;
  collateralFactor?: number;
  healthFactor?: number;
  
  // Position details
  totalDeposited?: number;
  totalBorrowed?: number;
  collateralValue?: number;
  liquidationThreshold?: number;
  
  // Rewards
  rewards?: Array<{
    token: string;
    amount: string;
    valueUsd: number;
  }>;
  
  timestamp: number;
  blockNumber: number;
  transactionHash: string;
}

export interface YieldFarmingInteraction {
  type: 'stake' | 'unstake' | 'harvest' | 'compound';
  protocol: string;
  chainId: ChainId;
  
  // Farming details
  pool: {
    address: string;
    name: string;
    tokens: string[];
  };
  
  // Stake details
  stakedTokens?: Array<{
    address: string;
    symbol: string;
    amount: string;
    valueUsd: number;
  }>;
  
  // Rewards
  rewards?: Array<{
    token: string;
    symbol: string;
    amount: string;
    valueUsd: number;
  }>;
  
  // Metrics
  apy?: number;
  apr?: number;
  totalValueLocked?: number;
  poolShare?: number;
  
  // Compounding details
  compoundFrequency?: number;
  compoundedAmount?: number;
  
  timestamp: number;
  blockNumber: number;
  transactionHash: string;
}

export interface DeFiPosition {
  id: string;
  protocol: string;
  type: 'amm_liquidity' | 'lending_deposit' | 'lending_borrow' | 'farming_stake';
  chainId: ChainId;
  userAddress: string;
  
  // Position value
  currentValue: number; // USD
  initialValue?: number; // USD
  pnl?: number; // USD
  pnlPercentage?: number;
  
  // Assets
  assets: Array<{
    token: string;
    amount: string;
    valueUsd: number;
  }>;
  
  // Metrics
  apy?: number;
  apr?: number;
  yield?: number;
  impermanentLoss?: number;
  
  // Risk metrics
  liquidationRisk?: number; // 0-100
  impermanentLossRisk?: number; // 0-100
  smartContractRisk?: number; // 0-100
  
  // Timestamps
  entryTime: number;
  lastUpdate: number;
  
  // Additional metadata
  metadata: {
    poolAddress?: string;
    tokenIds?: string[];
    rewards?: any[];
    [key: string]: any;
  };
}

export interface DeFiAnalytics {
  totalValueLocked: number; // Total USD value across all protocols
  protocolBreakdown: Array<{
    protocol: string;
    chainId: ChainId;
    category: string;
    valueUsd: number;
    allocation: number; // Percentage
    apy: number;
    risk: number;
  }>;
  
  // Performance metrics
  totalYield: number; // USD earned
  averageAPY: number;
  bestPerforming: {
    protocol: string;
    apy: number;
    valueUsd: number;
  };
  
  // Risk analysis
  riskProfile: {
    overall: 'low' | 'medium' | 'high' | 'extreme';
    impermanentLoss: number;
    smartContract: number;
    liquidity: number;
  };
  
  // Activity analysis
  activitySummary: {
    totalTransactions: number;
    totalFees: number;
    mostUsedProtocol: string;
    chainDistribution: Array<{ chainId: ChainId; percentage: number }>;
  };
}

// Protocol definitions
const DEFI_PROTOCOLS: Record<string, DeFiProtocol> = {
  // Ethereum protocols
  uniswap_v2: {
    name: 'Uniswap V2',
    chainId: 'ethereum',
    category: 'amm',
    version: '2.0',
    addresses: {
      router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
      factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f'
    },
    abi: {
      swap: ['function swapExactTokensForTokens(uint,uint,address[],address,uint)'],
      addLiquidity: ['function addLiquidity(address,address,uint,uint,uint,uint,address,uint)']
    },
    tokens: {
      governance: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'
    }
  },
  uniswap_v3: {
    name: 'Uniswap V3',
    chainId: 'ethereum',
    category: 'amm',
    version: '3.0',
    addresses: {
      router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984'
    },
    abi: {
      swap: ['function exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))']
    },
    tokens: {
      governance: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'
    }
  },
  aave_v3: {
    name: 'Aave V3',
    chainId: 'ethereum',
    category: 'lending',
    version: '3.0',
    addresses: {
      pool: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2'
    },
    abi: {
      deposit: ['function supply(address,uint256,address,uint16)'],
      withdraw: ['function withdraw(address,uint256,address)'],
      borrow: ['function borrow(address,uint256,uint256,uint16,address)']
    },
    tokens: {
      governance: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9'
    }
  },
  // Polygon protocols
  quickswap: {
    name: 'QuickSwap',
    chainId: 'polygon',
    category: 'amm',
    version: '1.0',
    addresses: {
      router: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',
      factory: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32'
    },
    abi: {
      swap: ['function swapExactTokensForTokens(uint,uint,address[],address,uint)']
    },
    tokens: {
      governance: '0x831753DD7087CaC61aB5644b308642cc1c33Dc13'
    }
  },
  // Add more protocols...
};

// Event signatures for common DeFi operations
const DEFI_EVENT_SIGNATURES = {
  // Uniswap V2/V3 events
  swap: '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822', // Swap event
  mint: '0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f', // Mint (add liquidity)
  burn: '0xdccd412f0b1252819cb1fd330b93224ca42612892bb3f4f789976e6d81936496', // Burn (remove liquidity)
  
  // Aave events
  deposit: '0xde6857219544bb5b7746f48ed30be6386fefc61b2f864cacf559893bf50fd951', // Supply
  withdraw: '0x3115d1449a7b732c986cba18244e897a450f61e1bb8d589cd2e69e6c8924f9f7', // Withdraw
  borrow: '0xb3d084820fb1a9decffb176436bd02558d15fac9b0ddfed8c465bc7359d7dce0', // Borrow
  repay: '0xa534c8dbe71f871f9f3530e97a74601fea17b426cae02e1c5aee42c96c784051', // Repay
  
  // Generic events
  transfer: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
};

// Main DeFi Analyzer class
export class DeFiAnalyzer {
  private protocolCache: Map<string, DeFiProtocol> = new Map();
  private positionCache: Map<string, DeFiPosition[]> = new Map();
  
  constructor() {
    this.initializeProtocols();
  }
  
  /**
   * Analyze a transaction for DeFi interactions
   */
  async analyzeTransaction(transaction: UnifiedTransaction): Promise<{
    ammInteractions: AMMInteraction[];
    lendingInteractions: LendingInteraction[];
    farmingInteractions: YieldFarmingInteraction[];
    flashLoans: FlashLoan[];
  }> {
    try {
      const results = {
        ammInteractions: [] as AMMInteraction[],
        lendingInteractions: [] as LendingInteraction[],
        farmingInteractions: [] as YieldFarmingInteraction[],
        flashLoans: [] as FlashLoan[]
      };

      // Parse transaction logs if available
      const logs = this.extractLogsFromTransaction(transaction);
      
      for (const log of logs) {
        // Identify protocol based on contract address
        const protocol = await this.identifyProtocol(log.address, transaction.chainId);
        
        if (!protocol) continue;

        switch (protocol.category) {
          case 'amm':
            const ammInteraction = await this.parseAMMInteraction(log, protocol, transaction);
            if (ammInteraction) results.ammInteractions.push(ammInteraction);
            break;
            
          case 'lending':
            const lendingInteraction = await this.parseLendingInteraction(log, protocol, transaction);
            if (lendingInteraction) results.lendingInteractions.push(lendingInteraction);
            break;
            
          case 'farming':
            const farmingInteraction = await this.parseFarmingInteraction(log, protocol, transaction);
            if (farmingInteraction) results.farmingInteractions.push(farmingInteraction);
            break;
        }
        
        // Check for flash loans
        const flashLoan = await this.parseFlashLoan(log, protocol, transaction);
        if (flashLoan) results.flashLoans.push(flashLoan);
      }

      return results;
    } catch (error) {
      console.error('Error analyzing DeFi transaction:', error);
      throw error;
    }
  }

  /**
   * Get DeFi positions for an address
   */
  async getDeFiPositions(
    address: string,
    chainIds?: ChainId[]
  ): Promise<DeFiPosition[]> {
    try {
      const cacheKey = `${address}:${chainIds?.join(',') || 'all'}`;
      
      if (this.positionCache.has(cacheKey)) {
        return this.positionCache.get(cacheKey)!;
      }

      const positions: DeFiPosition[] = [];

      // Query each supported chain
      const chains = chainIds || ['ethereum', 'polygon', 'bitcoin', 'solana'] as ChainId[];
      
      for (const chainId of chains) {
        // Get AMM liquidity positions
        const ammPositions = await this.getAMMPositions(address, chainId);
        positions.push(...ammPositions);
        
        // Get lending positions
        const lendingPositions = await this.getLendingPositions(address, chainId);
        positions.push(...lendingPositions);
        
        // Get farming positions
        const farmingPositions = await this.getFarmingPositions(address, chainId);
        positions.push(...farmingPositions);
      }

      // Calculate current values and PnL
      await this.updatePositionValues(positions);

      this.positionCache.set(cacheKey, positions);
      return positions;
    } catch (error) {
      console.error('Error getting DeFi positions:', error);
      throw error;
    }
  }

  /**
   * Calculate comprehensive DeFi analytics
   */
  async calculateDeFiAnalytics(
    addresses: Array<{ chainId: ChainId; address: string }>,
    timeframe?: number // milliseconds
  ): Promise<DeFiAnalytics> {
    try {
      let allPositions: DeFiPosition[] = [];
      
      // Collect all positions
      for (const { chainId, address } of addresses) {
        const positions = await this.getDeFiPositions(address, [chainId]);
        allPositions.push(...positions);
      }

      // Filter by timeframe if specified
      if (timeframe) {
        const cutoff = Date.now() - timeframe;
        allPositions = allPositions.filter(pos => pos.lastUpdate > cutoff);
      }

      // Calculate total value locked
      const totalValueLocked = allPositions.reduce((sum, pos) => sum + pos.currentValue, 0);

      // Group by protocol
      const protocolGroups = new Map<string, DeFiPosition[]>();
      allPositions.forEach(pos => {
        const key = `${pos.protocol}:${pos.chainId}`;
        if (!protocolGroups.has(key)) {
          protocolGroups.set(key, []);
        }
        protocolGroups.get(key)!.push(pos);
      });

      // Calculate protocol breakdown
      const protocolBreakdown = Array.from(protocolGroups.entries()).map(([key, positions]) => {
        const [protocol, chainId] = key.split(':') as [string, ChainId];
        const value = positions.reduce((sum, pos) => sum + pos.currentValue, 0);
        const avgAPY = positions.reduce((sum, pos) => sum + (pos.apy || 0), 0) / positions.length;
        const avgRisk = this.calculateProtocolRisk(positions);
        
        const protocolInfo = this.getProtocolInfo(protocol);
        
        return {
          protocol,
          chainId,
          category: protocolInfo?.category || 'unknown',
          valueUsd: value,
          allocation: (value / totalValueLocked) * 100,
          apy: avgAPY,
          risk: avgRisk
        };
      }).sort((a, b) => b.valueUsd - a.valueUsd);

      // Calculate performance metrics
      const totalYield = allPositions.reduce((sum, pos) => sum + (pos.yield || 0), 0);
      const averageAPY = allPositions.reduce((sum, pos) => sum + (pos.apy || 0), 0) / allPositions.length;
      
      const bestPerforming = protocolBreakdown.reduce((best, current) => 
        current.apy > best.apy ? current : best, protocolBreakdown[0]
      );

      // Risk analysis
      const riskProfile = this.calculateOverallRisk(allPositions);

      // Activity analysis
      const activitySummary = this.calculateActivitySummary(allPositions, addresses);

      return {
        totalValueLocked,
        protocolBreakdown,
        totalYield,
        averageAPY,
        bestPerforming: {
          protocol: bestPerforming.protocol,
          apy: bestPerforming.apy,
          valueUsd: bestPerforming.valueUsd
        },
        riskProfile,
        activitySummary
      };
    } catch (error) {
      console.error('Error calculating DeFi analytics:', error);
      throw error;
    }
  }

  /**
   * Calculate impermanent loss for AMM positions
   */
  async calculateImpermanentLoss(
    position: DeFiPosition,
    currentPrices: Record<string, number>,
    initialPrices: Record<string, number>
  ): Promise<{
    impermanentLoss: number;
    impermanentLossPercentage: number;
    hodlValue: number;
    lpValue: number;
  }> {
    if (position.type !== 'amm_liquidity' || position.assets.length !== 2) {
      throw new Error('Invalid position for impermanent loss calculation');
    }

    const token0 = position.assets[0];
    const token1 = position.assets[1];

    // Current prices
    const p0_current = currentPrices[token0.token];
    const p1_current = currentPrices[token1.token];
    
    // Initial prices
    const p0_initial = initialPrices[token0.token];
    const p1_initial = initialPrices[token1.token];

    if (!p0_current || !p1_current || !p0_initial || !p1_initial) {
      throw new Error('Missing price data for impermanent loss calculation');
    }

    // Price ratio change
    const priceRatio = (p0_current / p1_current) / (p0_initial / p1_initial);

    // Impermanent loss formula: 2 * sqrt(priceRatio) / (1 + priceRatio) - 1
    const impermanentLossMultiplier = 2 * Math.sqrt(priceRatio) / (1 + priceRatio) - 1;
    
    // Calculate values
    const initialValue = position.initialValue || position.currentValue;
    const hodlValue = initialValue * (p0_current / p0_initial + p1_current / p1_initial) / 2;
    const lpValue = position.currentValue;
    
    const impermanentLoss = hodlValue - lpValue;
    const impermanentLossPercentage = (impermanentLoss / hodlValue) * 100;

    return {
      impermanentLoss,
      impermanentLossPercentage,
      hodlValue,
      lpValue
    };
  }

  /**
   * Detect and analyze flash loans
   */
  async analyzeFlashLoan(transaction: UnifiedTransaction): Promise<FlashLoan | null> {
    try {
      const logs = this.extractLogsFromTransaction(transaction);
      
      // Look for flash loan patterns
      for (const log of logs) {
        const protocol = await this.identifyProtocol(log.address, transaction.chainId);
        if (!protocol) continue;

        // Check for flash loan events
        if (this.isFlashLoanEvent(log)) {
          const flashLoan = await this.parseFlashLoan(log, protocol, transaction);
          if (flashLoan) {
            // Analyze the flash loan strategy
            flashLoan.strategy = await this.analyzeFlashLoanStrategy(transaction, flashLoan);
            return flashLoan;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error analyzing flash loan:', error);
      return null;
    }
  }

  // Private helper methods

  private initializeProtocols(): void {
    Object.values(DEFI_PROTOCOLS).forEach(protocol => {
      const key = `${protocol.chainId}:${protocol.name}`;
      this.protocolCache.set(key, protocol);
    });
  }

  private extractLogsFromTransaction(transaction: UnifiedTransaction): any[] {
    // Extract logs from transaction receipt
    if (transaction.raw?.receipt?.logs) {
      return transaction.raw.receipt.logs;
    }
    
    // For other chains, extract from different formats
    return [];
  }

  private async identifyProtocol(address: string, chainId: ChainId): Promise<DeFiProtocol | null> {
    // Check known protocol addresses
    for (const [key, protocol] of this.protocolCache) {
      if (protocol.chainId !== chainId) continue;
      
      const addresses = Object.values(protocol.addresses).filter(Boolean);
      if (addresses.includes(address.toLowerCase())) {
        return protocol;
      }
    }

    return null;
  }

  private async parseAMMInteraction(
    log: any,
    protocol: DeFiProtocol,
    transaction: UnifiedTransaction
  ): Promise<AMMInteraction | null> {
    try {
      const signature = log.topics[0];
      
      if (signature === DEFI_EVENT_SIGNATURES.swap) {
        return this.parseSwapEvent(log, protocol, transaction);
      } else if (signature === DEFI_EVENT_SIGNATURES.mint) {
        return this.parseAddLiquidityEvent(log, protocol, transaction);
      } else if (signature === DEFI_EVENT_SIGNATURES.burn) {
        return this.parseRemoveLiquidityEvent(log, protocol, transaction);
      }

      return null;
    } catch (error) {
      console.error('Error parsing AMM interaction:', error);
      return null;
    }
  }

  private async parseLendingInteraction(
    log: any,
    protocol: DeFiProtocol,
    transaction: UnifiedTransaction
  ): Promise<LendingInteraction | null> {
    try {
      const signature = log.topics[0];
      
      if (signature === DEFI_EVENT_SIGNATURES.deposit) {
        return this.parseDepositEvent(log, protocol, transaction);
      } else if (signature === DEFI_EVENT_SIGNATURES.withdraw) {
        return this.parseWithdrawEvent(log, protocol, transaction);
      } else if (signature === DEFI_EVENT_SIGNATURES.borrow) {
        return this.parseBorrowEvent(log, protocol, transaction);
      } else if (signature === DEFI_EVENT_SIGNATURES.repay) {
        return this.parseRepayEvent(log, protocol, transaction);
      }

      return null;
    } catch (error) {
      console.error('Error parsing lending interaction:', error);
      return null;
    }
  }

  private async parseFarmingInteraction(
    log: any,
    protocol: DeFiProtocol,
    transaction: UnifiedTransaction
  ): Promise<YieldFarmingInteraction | null> {
    // Simplified farming interaction parsing
    // Would implement specific logic for each farming protocol
    return null;
  }

  private async parseFlashLoan(
    log: any,
    protocol: DeFiProtocol,
    transaction: UnifiedTransaction
  ): Promise<FlashLoan | null> {
    // Simplified flash loan parsing
    return null;
  }

  private parseSwapEvent(
    log: any,
    protocol: DeFiProtocol,
    transaction: UnifiedTransaction
  ): AMMInteraction {
    // Simplified swap event parsing
    return {
      type: 'swap',
      protocol: protocol.name,
      chainId: protocol.chainId,
      timestamp: transaction.timestamp,
      blockNumber: transaction.blockNumber || 0,
      transactionHash: transaction.id
    };
  }

  private parseAddLiquidityEvent(
    log: any,
    protocol: DeFiProtocol,
    transaction: UnifiedTransaction
  ): AMMInteraction {
    return {
      type: 'add_liquidity',
      protocol: protocol.name,
      chainId: protocol.chainId,
      timestamp: transaction.timestamp,
      blockNumber: transaction.blockNumber || 0,
      transactionHash: transaction.id
    };
  }

  private parseRemoveLiquidityEvent(
    log: any,
    protocol: DeFiProtocol,
    transaction: UnifiedTransaction
  ): AMMInteraction {
    return {
      type: 'remove_liquidity',
      protocol: protocol.name,
      chainId: protocol.chainId,
      timestamp: transaction.timestamp,
      blockNumber: transaction.blockNumber || 0,
      transactionHash: transaction.id
    };
  }

  private parseDepositEvent(
    log: any,
    protocol: DeFiProtocol,
    transaction: UnifiedTransaction
  ): LendingInteraction {
    return {
      type: 'deposit',
      protocol: protocol.name,
      chainId: protocol.chainId,
      asset: {
        address: '',
        symbol: '',
        amount: '0',
        valueUsd: 0
      },
      timestamp: transaction.timestamp,
      blockNumber: transaction.blockNumber || 0,
      transactionHash: transaction.id
    };
  }

  private parseWithdrawEvent(
    log: any,
    protocol: DeFiProtocol,
    transaction: UnifiedTransaction
  ): LendingInteraction {
    return {
      type: 'withdraw',
      protocol: protocol.name,
      chainId: protocol.chainId,
      asset: {
        address: '',
        symbol: '',
        amount: '0',
        valueUsd: 0
      },
      timestamp: transaction.timestamp,
      blockNumber: transaction.blockNumber || 0,
      transactionHash: transaction.id
    };
  }

  private parseBorrowEvent(
    log: any,
    protocol: DeFiProtocol,
    transaction: UnifiedTransaction
  ): LendingInteraction {
    return {
      type: 'borrow',
      protocol: protocol.name,
      chainId: protocol.chainId,
      asset: {
        address: '',
        symbol: '',
        amount: '0',
        valueUsd: 0
      },
      timestamp: transaction.timestamp,
      blockNumber: transaction.blockNumber || 0,
      transactionHash: transaction.id
    };
  }

  private parseRepayEvent(
    log: any,
    protocol: DeFiProtocol,
    transaction: UnifiedTransaction
  ): LendingInteraction {
    return {
      type: 'repay',
      protocol: protocol.name,
      chainId: protocol.chainId,
      asset: {
        address: '',
        symbol: '',
        amount: '0',
        valueUsd: 0
      },
      timestamp: transaction.timestamp,
      blockNumber: transaction.blockNumber || 0,
      transactionHash: transaction.id
    };
  }

  private async getAMMPositions(address: string, chainId: ChainId): Promise<DeFiPosition[]> {
    // Would implement AMM position detection
    return [];
  }

  private async getLendingPositions(address: string, chainId: ChainId): Promise<DeFiPosition[]> {
    // Would implement lending position detection
    return [];
  }

  private async getFarmingPositions(address: string, chainId: ChainId): Promise<DeFiPosition[]> {
    // Would implement farming position detection
    return [];
  }

  private async updatePositionValues(positions: DeFiPosition[]): Promise<void> {
    // Would implement position value updates using current prices
    for (const position of positions) {
      // Update current value, PnL, etc.
      position.lastUpdate = Date.now();
    }
  }

  private calculateProtocolRisk(positions: DeFiPosition[]): number {
    return positions.reduce((sum, pos) => {
      const liquidationRisk = pos.liquidationRisk || 0;
      const ilRisk = pos.impermanentLossRisk || 0;
      const scRisk = pos.smartContractRisk || 0;
      
      return sum + (liquidationRisk + ilRisk + scRisk) / 3;
    }, 0) / positions.length;
  }

  private getProtocolInfo(protocolName: string): DeFiProtocol | undefined {
    return Object.values(DEFI_PROTOCOLS).find(p => p.name === protocolName);
  }

  private calculateOverallRisk(positions: DeFiPosition[]): DeFiAnalytics['riskProfile'] {
    const avgILRisk = positions.reduce((sum, pos) => sum + (pos.impermanentLossRisk || 0), 0) / positions.length;
    const avgSCRisk = positions.reduce((sum, pos) => sum + (pos.smartContractRisk || 0), 0) / positions.length;
    const avgLiquidityRisk = positions.reduce((sum, pos) => sum + (pos.liquidationRisk || 0), 0) / positions.length;
    
    const overallScore = (avgILRisk + avgSCRisk + avgLiquidityRisk) / 3;
    
    let overall: 'low' | 'medium' | 'high' | 'extreme';
    if (overallScore < 25) overall = 'low';
    else if (overallScore < 50) overall = 'medium';
    else if (overallScore < 75) overall = 'high';
    else overall = 'extreme';

    return {
      overall,
      impermanentLoss: avgILRisk,
      smartContract: avgSCRisk,
      liquidity: avgLiquidityRisk
    };
  }

  private calculateActivitySummary(
    positions: DeFiPosition[],
    addresses: Array<{ chainId: ChainId; address: string }>
  ): DeFiAnalytics['activitySummary'] {
    const chainCounts = new Map<ChainId, number>();
    
    positions.forEach(pos => {
      chainCounts.set(pos.chainId, (chainCounts.get(pos.chainId) || 0) + 1);
    });

    const totalPositions = positions.length;
    const chainDistribution = Array.from(chainCounts.entries()).map(([chainId, count]) => ({
      chainId,
      percentage: (count / totalPositions) * 100
    }));

    return {
      totalTransactions: 0, // Would count from transaction history
      totalFees: 0, // Would sum from transaction history
      mostUsedProtocol: positions.length > 0 ? positions[0].protocol : '',
      chainDistribution
    };
  }

  private isFlashLoanEvent(log: any): boolean {
    // Simplified flash loan detection
    return false;
  }

  private async analyzeFlashLoanStrategy(
    transaction: UnifiedTransaction,
    flashLoan: FlashLoan
  ): Promise<string> {
    // Analyze the flash loan strategy based on transaction patterns
    const interactions = transaction.defiInteractions;
    
    if (interactions.some(i => i.type === 'swap')) {
      return 'arbitrage';
    }
    
    if (interactions.some(i => i.type === 'lending' || i.type === 'borrowing')) {
      return 'refinancing';
    }
    
    return 'unknown';
  }
}

// Export utility functions
export const DeFiUtils = {
  /**
   * Calculate APY from APR and compounding frequency
   */
  calculateAPY(apr: number, compoundingFrequency: number): number {
    return Math.pow(1 + apr / compoundingFrequency, compoundingFrequency) - 1;
  },

  /**
   * Calculate impermanent loss percentage
   */
  calculateImpermanentLossPercentage(priceRatio: number): number {
    return 2 * Math.sqrt(priceRatio) / (1 + priceRatio) - 1;
  },

  /**
   * Calculate liquidity pool share
   */
  calculatePoolShare(lpTokens: number, totalLpTokens: number): number {
    return (lpTokens / totalLpTokens) * 100;
  },

  /**
   * Estimate gas costs for DeFi operations
   */
  estimateGasCosts(operation: string, chainId: ChainId): number {
    const gasEstimates: Record<ChainId, Record<string, number>> = {
      ethereum: {
        swap: 150000,
        addLiquidity: 200000,
        removeLiquidity: 120000,
        deposit: 100000,
        withdraw: 80000,
        borrow: 150000,
        repay: 100000
      },
      polygon: {
        swap: 150000,
        addLiquidity: 200000,
        removeLiquidity: 120000,
        deposit: 100000,
        withdraw: 80000,
        borrow: 150000,
        repay: 100000
      },
      bitcoin: {},
      solana: {}
    };

    return gasEstimates[chainId]?.[operation] || 100000;
  }
};