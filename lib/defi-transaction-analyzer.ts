'use client';

import type { DetailedTransactionInfo } from '@/lib/solana';
import type { ParsedInstruction } from '@solana/web3.js';

// DeFi Protocol Registry
export interface DeFiProtocol {
  name: string;
  programId: string;
  category: 'dex' | 'lending' | 'yield_farming' | 'staking' | 'derivatives' | 'insurance' | 'bridge';
  description: string;
  website?: string;
  documentation?: string;
  riskLevel: 'low' | 'medium' | 'high';
  tvl?: number; // Total Value Locked in USD
  fees?: {
    trading?: number; // percentage
    withdrawal?: number; // percentage
    deposit?: number; // percentage
  };
}

export interface DeFiAction {
  type: 'swap' | 'add_liquidity' | 'remove_liquidity' | 'lend' | 'borrow' | 'stake' | 'unstake' | 'claim_rewards' | 'bridge' | 'farm' | 'harvest';
  protocol: DeFiProtocol;
  description: string;
  inputTokens: TokenAmount[];
  outputTokens: TokenAmount[];
  fees: FeeBreakdown[];
  priceImpact?: number; // percentage
  slippage?: number; // percentage
  apr?: number; // Annual Percentage Rate
  apy?: number; // Annual Percentage Yield
  liquidityProvided?: number; // USD value
  rewards?: TokenAmount[];
}

export interface TokenAmount {
  mint: string;
  symbol: string;
  amount: string;
  decimals: number;
  usdValue?: number;
  pricePerToken?: number;
}

export interface FeeBreakdown {
  type: 'trading' | 'protocol' | 'liquidity_provider' | 'platform' | 'gas';
  amount: TokenAmount;
  percentage?: number;
  recipient?: string;
}

export interface DeFiAnalysis {
  isDefi: boolean;
  protocols: DeFiProtocol[];
  actions: DeFiAction[];
  financialImpact: FinancialImpact;
  riskAssessment: DeFiRiskAssessment;
  yieldAnalysis?: YieldAnalysis;
  liquidityAnalysis?: LiquidityAnalysis;
  recommendations: string[];
  marketContext?: MarketContext;
}

export interface FinancialImpact {
  totalValueIn: number; // USD
  totalValueOut: number; // USD
  netValue: number; // USD (positive = gain, negative = loss)
  totalFees: number; // USD
  feePercentage: number; // percentage of total value
  priceImpact?: number; // percentage
  slippage?: number; // percentage
  impermanentLoss?: number; // USD (for liquidity provision)
}

export interface DeFiRiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'extreme';
  riskScore: number; // 0-10
  factors: RiskFactor[];
  protocolRisks: string[];
  marketRisks: string[];
  technicalRisks: string[];
  mitigationStrategies: string[];
}

export interface RiskFactor {
  type: 'protocol' | 'market' | 'technical' | 'regulatory';
  severity: 'low' | 'medium' | 'high';
  description: string;
  impact: string;
}

export interface YieldAnalysis {
  currentApr?: number;
  currentApy?: number;
  projectedReturns: {
    daily: number;
    weekly: number;
    monthly: number;
    yearly: number;
  };
  rewardTokens: TokenAmount[];
  compoundingFrequency?: 'daily' | 'weekly' | 'monthly' | 'manual';
  yieldSource: 'trading_fees' | 'lending_interest' | 'staking_rewards' | 'farming_rewards' | 'mixed';
  sustainability: 'high' | 'medium' | 'low';
}

export interface LiquidityAnalysis {
  poolSize: number; // USD
  userShare: number; // percentage
  impermanentLossRisk: 'low' | 'medium' | 'high';
  liquidityUtilization: number; // percentage
  tradingVolume24h?: number; // USD
  feesEarned24h?: number; // USD
  priceRange?: {
    min: number;
    max: number;
    current: number;
  };
}

export interface MarketContext {
  marketCondition: 'bullish' | 'bearish' | 'sideways' | 'volatile';
  volatilityIndex: number; // 0-100
  liquidityCondition: 'high' | 'medium' | 'low';
  recommendedActions: string[];
  warnings: string[];
}

// DeFi Protocol Registry
const DEFI_PROTOCOLS: Record<string, DeFiProtocol> = {
  // DEX Protocols
  'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB': {
    name: 'Jupiter',
    programId: 'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB',
    category: 'dex',
    description: 'Leading DEX aggregator on Solana',
    website: 'https://jup.ag',
    riskLevel: 'low',
    fees: { trading: 0.1 }
  },
  '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM': {
    name: 'Raydium',
    programId: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    category: 'dex',
    description: 'Automated Market Maker and DEX on Solana',
    website: 'https://raydium.io',
    riskLevel: 'low',
    fees: { trading: 0.25 }
  },
  'CLMM9tUoggJu2wagPkkqs9eFG4BWhVBZWkP1qv3Sp7tR': {
    name: 'Raydium CLMM',
    programId: 'CLMM9tUoggJu2wagPkkqs9eFG4BWhVBZWkP1qv3Sp7tR',
    category: 'dex',
    description: 'Concentrated Liquidity Market Maker',
    website: 'https://raydium.io',
    riskLevel: 'medium',
    fees: { trading: 0.05 }
  },
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc': {
    name: 'Orca Whirlpools',
    programId: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
    category: 'dex',
    description: 'Concentrated liquidity AMM',
    website: 'https://orca.so',
    riskLevel: 'low',
    fees: { trading: 0.3 }
  },

  // Lending Protocols
  'So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo': {
    name: 'Solend',
    programId: 'So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo',
    category: 'lending',
    description: 'Decentralized lending protocol',
    website: 'https://solend.fi',
    riskLevel: 'medium'
  },
  'M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K': {
    name: 'Mango Markets',
    programId: 'M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K',
    category: 'derivatives',
    description: 'Decentralized trading platform',
    website: 'https://mango.markets',
    riskLevel: 'high'
  },

  // Staking Protocols
  'StakeSSzfxn391k3LvdKbZP5WVwWd6AsY39qhURmHYgD': {
    name: 'Lido',
    programId: 'StakeSSzfxn391k3LvdKbZP5WVwWd6AsY39qhURmHYgD',
    category: 'staking',
    description: 'Liquid staking protocol',
    website: 'https://lido.fi',
    riskLevel: 'low'
  },
  'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD': {
    name: 'Marinade',
    programId: 'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD',
    category: 'staking',
    description: 'Non-custodial liquid staking',
    website: 'https://marinade.finance',
    riskLevel: 'low'
  },

  // Yield Farming
  'EhhTKczWMGQt46ynNeRX1WfeagwwJd7ufHvCDjRxjo5Q': {
    name: 'Orca Farms',
    programId: 'EhhTKczWMGQt46ynNeRX1WfeagwwJd7ufHvCDjRxjo5Q',
    category: 'yield_farming',
    description: 'Yield farming on Orca',
    website: 'https://orca.so',
    riskLevel: 'medium'
  }
};

// Instruction patterns for DeFi actions
const DEFI_INSTRUCTION_PATTERNS = {
  swap: ['swap', 'exchange', 'trade'],
  add_liquidity: ['addLiquidity', 'deposit', 'mint'],
  remove_liquidity: ['removeLiquidity', 'withdraw', 'burn'],
  lend: ['supply', 'deposit', 'lend'],
  borrow: ['borrow', 'loan'],
  stake: ['stake', 'delegate'],
  unstake: ['unstake', 'undelegate', 'withdraw'],
  claim_rewards: ['claim', 'harvest', 'collect'],
  bridge: ['bridge', 'transfer', 'wrap'],
  farm: ['farm', 'stake', 'deposit'],
  harvest: ['harvest', 'claim', 'collect']
};

class DeFiTransactionAnalyzer {
  private tokenPriceCache = new Map<string, number>();
  private protocolDataCache = new Map<string, any>();

  async analyzeDeFiTransaction(transaction: DetailedTransactionInfo): Promise<DeFiAnalysis> {
    try {
      // Identify DeFi protocols used
      const protocols = this.identifyProtocols(transaction);

      if (protocols.length === 0) {
        return {
          isDefi: false,
          protocols: [],
          actions: [],
          financialImpact: this.createEmptyFinancialImpact(),
          riskAssessment: this.createLowRiskAssessment(),
          recommendations: ['This transaction does not appear to involve DeFi protocols.']
        };
      }

      // Analyze DeFi actions
      const actions = await this.analyzeDeFiActions(transaction, protocols);

      // Calculate financial impact
      const financialImpact = await this.calculateFinancialImpact(transaction, actions);

      // Assess risks
      const riskAssessment = this.assessDeFiRisks(protocols, actions, financialImpact);

      // Analyze yield opportunities
      const yieldAnalysis = await this.analyzeYieldOpportunities(actions);

      // Analyze liquidity provision
      const liquidityAnalysis = await this.analyzeLiquidityProvision(actions);

      // Get market context
      const marketContext = await this.getMarketContext(actions);

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        protocols,
        actions,
        financialImpact,
        riskAssessment,
        marketContext
      );

      return {
        isDefi: true,
        protocols,
        actions,
        financialImpact,
        riskAssessment,
        yieldAnalysis,
        liquidityAnalysis,
        recommendations,
        marketContext
      };

    } catch (error) {
      console.error('Error analyzing DeFi transaction:', error);
      return {
        isDefi: false,
        protocols: [],
        actions: [],
        financialImpact: this.createEmptyFinancialImpact(),
        riskAssessment: this.createLowRiskAssessment(),
        recommendations: ['Unable to analyze DeFi aspects of this transaction.']
      };
    }
  }

  private identifyProtocols(transaction: DetailedTransactionInfo): DeFiProtocol[] {
    const protocols: DeFiProtocol[] = [];
    const seenPrograms = new Set<string>();

    // Check instructions for known DeFi program IDs
    const parsedInstructions = (transaction as any).parsedInstructions;
    parsedInstructions?.forEach((instruction: any) => {
      const programId = instruction.programId;

      if (!seenPrograms.has(programId)) {
        // Check cache first
        let protocol = this.protocolDataCache.get(programId);
        if (!protocol && DEFI_PROTOCOLS[programId]) {
          protocol = DEFI_PROTOCOLS[programId];
          this.protocolDataCache.set(programId, protocol);
        }
        if (protocol) {
          protocols.push(protocol);
          seenPrograms.add(programId);
        }
      }
    });

    // Check account keys for known programs
    transaction.transaction?.message.accountKeys.forEach(account => {
      const accountKey = account.pubkey.toString();

      if (!seenPrograms.has(accountKey)) {
        // Check cache first
        let protocol = this.protocolDataCache.get(accountKey);
        if (!protocol && DEFI_PROTOCOLS[accountKey]) {
          protocol = DEFI_PROTOCOLS[accountKey];
          this.protocolDataCache.set(accountKey, protocol);
        }
        if (protocol) {
          protocols.push(protocol);
          seenPrograms.add(accountKey);
        }
      }
    });

    return protocols;
  }
  private async analyzeDeFiActions(
    transaction: DetailedTransactionInfo,
    protocols: DeFiProtocol[]
  ): Promise<DeFiAction[]> {
    const actions: DeFiAction[] = [];

    for (const protocol of protocols) {
      const protocolActions = await this.analyzeProtocolActions(transaction, protocol);
      actions.push(...protocolActions);
    }

    return actions;
  }

  private async analyzeProtocolActions(
    transaction: DetailedTransactionInfo,
    protocol: DeFiProtocol
  ): Promise<DeFiAction[]> {
    const actions: DeFiAction[] = [];

    // Get instructions for this protocol
    const parsedInstructions = (transaction as any).parsedInstructions;
    const protocolInstructions = parsedInstructions?.filter(
      (instruction: any) => instruction.programId === protocol.programId
    ) || [];

    for (const instruction of protocolInstructions) {
      const action = await this.parseInstructionToAction(instruction, protocol, transaction);
      if (action) {
        actions.push(action);
      }
    }

    return actions;
  }

  private async parseInstructionToAction(
    instruction: ParsedInstruction,
    protocol: DeFiProtocol,
    transaction: DetailedTransactionInfo
  ): Promise<DeFiAction | null> {
    try {
      const instructionName = instruction.parsed?.type || instruction.parsed?.info?.instruction || 'unknown';
      const actionType = this.determineActionType(instructionName, protocol);

      if (!actionType) return null;

      // Extract token amounts from instruction
      const { inputTokens, outputTokens } = await this.extractTokenAmounts(instruction, transaction);

      // Calculate fees
      const fees = this.calculateActionFees(inputTokens, outputTokens, protocol);

      // Get additional metrics based on action type
      const additionalMetrics = await this.getActionMetrics(actionType, instruction, protocol);

      return {
        type: actionType,
        protocol,
        description: this.generateActionDescription(actionType, protocol, inputTokens, outputTokens),
        inputTokens,
        outputTokens,
        fees,
        ...additionalMetrics
      };

    } catch (error) {
      console.error('Error parsing instruction to action:', error);
      return null;
    }
  }

  private determineActionType(instructionName: string, protocol: DeFiProtocol): DeFiAction['type'] | null {
    const lowerName = instructionName.toLowerCase();

    for (const [actionType, patterns] of Object.entries(DEFI_INSTRUCTION_PATTERNS)) {
      if (patterns.some(pattern => lowerName.includes(pattern))) {
        return actionType as DeFiAction['type'];
      }
    }

    // Protocol-specific mappings
    if (protocol.category === 'dex') {
      if (lowerName.includes('swap') || lowerName.includes('route')) return 'swap';
      if (lowerName.includes('add') || lowerName.includes('deposit')) return 'add_liquidity';
      if (lowerName.includes('remove') || lowerName.includes('withdraw')) return 'remove_liquidity';
    }

    if (protocol.category === 'lending') {
      if (lowerName.includes('supply') || lowerName.includes('deposit')) return 'lend';
      if (lowerName.includes('borrow')) return 'borrow';
    }

    if (protocol.category === 'staking') {
      if (lowerName.includes('stake') || lowerName.includes('delegate')) return 'stake';
      if (lowerName.includes('unstake') || lowerName.includes('withdraw')) return 'unstake';
    }

    return null;
  }

  private async extractTokenAmounts(
    instruction: ParsedInstruction,
    transaction: DetailedTransactionInfo
  ): Promise<{ inputTokens: TokenAmount[]; outputTokens: TokenAmount[] }> {
    const inputTokens: TokenAmount[] = [];
    const outputTokens: TokenAmount[] = [];

    try {
      // Extract from parsed instruction data
      const info = instruction.parsed?.info;

      if (info) {
        // Handle different instruction formats
        if (info.amount && info.mint) {
          // Simple token transfer
          const tokenAmount = await this.createTokenAmount(info.mint, info.amount);
          if (tokenAmount) {
            inputTokens.push(tokenAmount);
          }
        }

        if (info.tokenAmountA && info.tokenAmountB) {
          // Liquidity pool operations
          const tokenA = await this.createTokenAmount(info.mintA, info.tokenAmountA);
          const tokenB = await this.createTokenAmount(info.mintB, info.tokenAmountB);

          if (tokenA) inputTokens.push(tokenA);
          if (tokenB) inputTokens.push(tokenB);
        }
      }

      // Extract from account balance changes
      const balanceChanges = (transaction as any).accountChanges || [];

      for (const change of balanceChanges) {
        if (change.tokenChanges) {
          for (const tokenChange of change.tokenChanges) {
            const tokenAmount = await this.createTokenAmount(
              tokenChange.mint,
              Math.abs(tokenChange.change).toString()
            );

            if (tokenAmount) {
              if (tokenChange.change < 0) {
                inputTokens.push(tokenAmount);
              } else {
                outputTokens.push(tokenAmount);
              }
            }
          }
        }
      }

    } catch (error) {
      console.error('Error extracting token amounts:', error);
    }

    return { inputTokens, outputTokens };
  }

  private async createTokenAmount(mint: string, amount: string): Promise<TokenAmount | null> {
    try {
      // Get token metadata (this would typically come from a token registry)
      const tokenInfo = await this.getTokenInfo(mint);
      const price = await this.getTokenPrice(mint);

      const numericAmount = parseFloat(amount) / Math.pow(10, tokenInfo.decimals);

      return {
        mint,
        symbol: tokenInfo.symbol,
        amount: numericAmount.toString(),
        decimals: tokenInfo.decimals,
        usdValue: price ? numericAmount * price : undefined,
        pricePerToken: price ?? undefined
      };
    } catch (error) {
      console.error('Error creating token amount:', error);
      return null;
    }
  }

  private async getTokenInfo(mint: string): Promise<{ symbol: string; decimals: number }> {
    // Mock token info - in production, this would query a token registry
    const knownTokens: Record<string, { symbol: string; decimals: number }> = {
      'So11111111111111111111111111111111111111112': { symbol: 'SOL', decimals: 9 },
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', decimals: 6 },
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', decimals: 6 },
      'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': { symbol: 'mSOL', decimals: 9 },
    };

    return knownTokens[mint] || { symbol: 'UNKNOWN', decimals: 9 };
  }

  private async getTokenPrice(mint: string): Promise<number | null> {
    // Check cache first
    if (this.tokenPriceCache.has(mint)) {
      return this.tokenPriceCache.get(mint)!;
    }

    try {
      // Mock price data - in production, this would query a price API
      const mockPrices: Record<string, number> = {
        'So11111111111111111111111111111111111111112': 100, // SOL
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 1, // USDC
        'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 1, // USDT
        'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 95, // mSOL
      };

      const price = mockPrices[mint] || null;
      if (price) {
        this.tokenPriceCache.set(mint, price);
      }

      return price;
    } catch (error) {
      console.error('Error fetching token price:', error);
      return null;
    }
  }

  private calculateActionFees(
    inputTokens: TokenAmount[],
    outputTokens: TokenAmount[],
    protocol: DeFiProtocol
  ): FeeBreakdown[] {
    const fees: FeeBreakdown[] = [];

    // Calculate protocol fees
    if (protocol.fees?.trading) {
      const totalInputValue = inputTokens.reduce((sum, token) => sum + (token.usdValue || 0), 0);
      const totalOutputValue = outputTokens.reduce((sum, token) => sum + (token.usdValue || 0), 0);

      // Use the higher value for fee calculation (more accurate for some protocols)
      const feeBaseValue = Math.max(totalInputValue, totalOutputValue);
      const feeAmount = feeBaseValue * (protocol.fees.trading / 100);

      if (feeAmount > 0) {
        fees.push({
          type: 'trading',
          amount: {
            mint: 'USD',
            symbol: 'USD',
            amount: feeAmount.toString(),
            decimals: 2,
            usdValue: feeAmount
          },
          percentage: protocol.fees.trading,
          recipient: protocol.name
        });
      }
    }

    return fees;
  }

  private generateActionDescription(
    actionType: DeFiAction['type'],
    protocol: DeFiProtocol,
    inputTokens: TokenAmount[],
    outputTokens: TokenAmount[]
  ): string {
    const inputDesc = inputTokens.map(t => `${t.amount} ${t.symbol}`).join(' + ');
    const outputDesc = outputTokens.map(t => `${t.amount} ${t.symbol}`).join(' + ');

    switch (actionType) {
      case 'swap':
        return `Swap ${inputDesc} for ${outputDesc} on ${protocol.name}`;
      case 'add_liquidity':
        return `Add liquidity (${inputDesc}) to ${protocol.name} pool`;
      case 'remove_liquidity':
        return `Remove liquidity from ${protocol.name} pool, receiving ${outputDesc}`;
      case 'lend':
        return `Lend ${inputDesc} on ${protocol.name}`;
      case 'borrow':
        return `Borrow ${outputDesc} from ${protocol.name}`;
      case 'stake':
        return `Stake ${inputDesc} on ${protocol.name}`;
      case 'unstake':
        return `Unstake from ${protocol.name}, receiving ${outputDesc}`;
      case 'claim_rewards':
        return `Claim rewards (${outputDesc}) from ${protocol.name}`;
      default:
        return `${actionType.replace('_', ' ')} on ${protocol.name}`;
    }
  }

  private async getActionMetrics(
    actionType: DeFiAction['type'],
    instruction: ParsedInstruction,
    protocol: DeFiProtocol
  ): Promise<Partial<DeFiAction>> {
    const metrics: Partial<DeFiAction> = {};

    try {
      switch (actionType) {
        case 'swap':
          // Calculate price impact and slippage for swaps
          metrics.priceImpact = await this.calculatePriceImpact(instruction);
          metrics.slippage = await this.calculateSlippage(instruction);
          break;

        case 'add_liquidity':
        case 'remove_liquidity':
          // Calculate liquidity metrics
          metrics.liquidityProvided = await this.calculateLiquidityValue(instruction);
          break;

        case 'stake':
        case 'lend':
          // Calculate yield metrics
          const yieldData = await this.getYieldMetrics(protocol);
          metrics.apr = yieldData.apr;
          metrics.apy = yieldData.apy;
          break;

        case 'claim_rewards':
        case 'harvest':
          // Calculate rewards
          metrics.rewards = await this.calculateRewards(instruction);
          break;
      }
    } catch (error) {
      console.error('Error calculating action metrics:', error);
    }

    return metrics;
  }

  private async calculatePriceImpact(instruction: ParsedInstruction): Promise<number | undefined> {
    // Mock price impact calculation based on instruction data
    // In production, this would calculate based on pool size and trade amount
    const info = instruction.parsed?.info;
    if (info && info.amount) {
      // Simulate price impact based on trade size
      const amount = parseFloat(info.amount);
      return Math.min(amount / 1000000, 0.02); // Scale with amount, max 2%
    }
    return Math.random() * 0.02; // 0-2% price impact
  }

  private async calculateSlippage(instruction: ParsedInstruction): Promise<number | undefined> {
    // Mock slippage calculation based on instruction
    const info = instruction.parsed?.info;
    if (info && info.slippage) {
      return parseFloat(info.slippage);
    }
    return Math.random() * 1; // 0-1% slippage
  }

  private async calculateLiquidityValue(instruction: ParsedInstruction): Promise<number | undefined> {
    // Mock liquidity value calculation based on instruction
    const info = instruction.parsed?.info;
    if (info && info.liquidityAmount) {
      return parseFloat(info.liquidityAmount);
    }
    return Math.random() * 10000; // $0-$10,000
  }

  private async getYieldMetrics(protocol: DeFiProtocol): Promise<{ apr?: number; apy?: number }> {
    // Mock yield data based on protocol
    const yieldRanges: Record<string, { apr: number; apy: number }> = {
      lending: { apr: 3, apy: 3.1 },
      staking: { apr: 7, apy: 7.3 },
      yield_farming: { apr: 15, apy: 16.2 },
      dex: { apr: 5, apy: 5.1 },
      derivatives: { apr: 10, apy: 10.5 },
      insurance: { apr: 2, apy: 2.0 },
      bridge: { apr: 0, apy: 0 }
    };

    return yieldRanges[protocol.category] || {};
  }

  private async calculateRewards(_instruction: ParsedInstruction): Promise<TokenAmount[] | undefined> {
    // Mock rewards calculation
    return [];
  }

  private async calculateFinancialImpact(
    _transaction: DetailedTransactionInfo,
    actions: DeFiAction[]
  ): Promise<FinancialImpact> {
    let totalValueIn = 0;
    let totalValueOut = 0;
    let totalFees = 0;
    let totalPriceImpact = 0;
    let totalSlippage = 0;
    let impermanentLoss = 0;

    for (const action of actions) {
      // Sum input values
      totalValueIn += action.inputTokens.reduce((sum, token) => sum + (token.usdValue || 0), 0);

      // Sum output values
      totalValueOut += action.outputTokens.reduce((sum, token) => sum + (token.usdValue || 0), 0);

      // Sum fees
      totalFees += action.fees.reduce((sum, fee) => sum + (fee.amount.usdValue || 0), 0);

      // Aggregate price impact and slippage
      if (action.priceImpact) totalPriceImpact += action.priceImpact;
      if (action.slippage) totalSlippage += action.slippage;

      // Calculate impermanent loss for liquidity actions
      if (action.type === 'add_liquidity' || action.type === 'remove_liquidity') {
        impermanentLoss += await this.calculateImpermanentLoss(action);
      }
    }

    const netValue = totalValueOut - totalValueIn;
    const feePercentage = totalValueIn > 0 ? (totalFees / totalValueIn) * 100 : 0;

    return {
      totalValueIn,
      totalValueOut,
      netValue,
      totalFees,
      feePercentage,
      priceImpact: totalPriceImpact > 0 ? totalPriceImpact / actions.length : undefined,
      slippage: totalSlippage > 0 ? totalSlippage / actions.length : undefined,
      impermanentLoss: impermanentLoss > 0 ? impermanentLoss : undefined
    };
  }

  private async calculateImpermanentLoss(action: DeFiAction): Promise<number> {
    // Mock impermanent loss calculation
    // In production, this would calculate based on price changes since liquidity provision
    if (action.type === 'add_liquidity') {
      return Math.random() * 100; // $0-$100 potential impermanent loss
    }
    return 0;
  }

  private assessDeFiRisks(
    protocols: DeFiProtocol[],
    actions: DeFiAction[],
    financialImpact: FinancialImpact
  ): DeFiRiskAssessment {
    const factors: RiskFactor[] = [];
    const protocolRisks: string[] = [];
    const marketRisks: string[] = [];
    const technicalRisks: string[] = [];
    const mitigationStrategies: string[] = [];

    let riskScore = 0;

    // Assess protocol risks
    for (const protocol of protocols) {
      const protocolRisk = this.assessProtocolRisk(protocol);
      riskScore += protocolRisk.score;
      factors.push(...protocolRisk.factors);
      protocolRisks.push(...protocolRisk.risks);
    }

    // Assess action-specific risks
    for (const action of actions) {
      const actionRisk = this.assessActionRisk(action);
      riskScore += actionRisk.score;
      factors.push(...actionRisk.factors);
    }

    // Assess financial risks
    const financialRisk = this.assessFinancialRisk(financialImpact);
    riskScore += financialRisk.score;
    factors.push(...financialRisk.factors);

    // Market risks
    if (financialImpact.priceImpact && financialImpact.priceImpact > 1) {
      marketRisks.push('High price impact detected');
      riskScore += 1;
    }

    if (financialImpact.impermanentLoss && financialImpact.impermanentLoss > 50) {
      marketRisks.push('Significant impermanent loss risk');
      riskScore += 1;
    }

    // Technical risks
    if (actions.some(a => a.protocol.riskLevel === 'high')) {
      technicalRisks.push('Using high-risk protocols');
      riskScore += 2;
    }

    // Generate mitigation strategies
    mitigationStrategies.push(...this.generateMitigationStrategies(factors, protocols, actions));

    // Determine overall risk level
    const overallRisk = this.determineOverallRisk(riskScore);

    return {
      overallRisk,
      riskScore: Math.min(riskScore, 10),
      factors,
      protocolRisks,
      marketRisks,
      technicalRisks,
      mitigationStrategies
    };
  }

  private assessProtocolRisk(protocol: DeFiProtocol): { score: number; factors: RiskFactor[]; risks: string[] } {
    const factors: RiskFactor[] = [];
    const risks: string[] = [];
    let score = 0;

    switch (protocol.riskLevel) {
      case 'high':
        score += 3;
        factors.push({
          type: 'protocol',
          severity: 'high',
          description: `${protocol.name} is classified as high-risk`,
          impact: 'Potential for significant losses'
        });
        risks.push(`High-risk protocol: ${protocol.name}`);
        break;
      case 'medium':
        score += 1;
        factors.push({
          type: 'protocol',
          severity: 'medium',
          description: `${protocol.name} has moderate risk`,
          impact: 'Some risk of losses'
        });
        break;
      case 'low':
        factors.push({
          type: 'protocol',
          severity: 'low',
          description: `${protocol.name} is well-established`,
          impact: 'Low risk of protocol failure'
        });
        break;
    }

    return { score, factors, risks };
  }

  private assessActionRisk(action: DeFiAction): { score: number; factors: RiskFactor[] } {
    const factors: RiskFactor[] = [];
    let score = 0;

    // High-risk actions
    if (['borrow', 'farm'].includes(action.type)) {
      score += 1;
      factors.push({
        type: 'market',
        severity: 'medium',
        description: `${action.type} operations carry additional risks`,
        impact: 'Potential for liquidation or loss'
      });
    }

    // Price impact risk
    if (action.priceImpact && action.priceImpact > 2) {
      score += 1;
      factors.push({
        type: 'market',
        severity: 'medium',
        description: 'High price impact detected',
        impact: 'Unfavorable execution price'
      });
    }

    return { score, factors };
  }

  private assessFinancialRisk(financialImpact: FinancialImpact): { score: number; factors: RiskFactor[] } {
    const factors: RiskFactor[] = [];
    let score = 0;

    // High fee percentage
    if (financialImpact.feePercentage > 2) {
      score += 1;
      factors.push({
        type: 'technical',
        severity: 'medium',
        description: 'High fee percentage',
        impact: 'Reduced profitability'
      });
    }

    // Large transaction value
    if (financialImpact.totalValueIn > 10000) {
      score += 1;
      factors.push({
        type: 'market',
        severity: 'medium',
        description: 'Large transaction value',
        impact: 'Higher exposure to market risks'
      });
    }

    return { score, factors };
  }

  private generateMitigationStrategies(
    factors: RiskFactor[],
    protocols: DeFiProtocol[],
    actions: DeFiAction[]
  ): string[] {
    const strategies: string[] = [];

    // Risk factor-specific strategies
    if (factors.some(f => f.severity === 'high')) {
      strategies.push('High risk detected - consider reducing position size or using additional risk management tools');
    }
    if (factors.some(f => f.type === 'market')) {
      strategies.push('Monitor market conditions and consider using limit orders');
    }

    // Protocol-specific strategies
    if (protocols.some(p => p.riskLevel === 'high')) {
      strategies.push('Consider using more established protocols with lower risk profiles');
      strategies.push('Start with smaller amounts to test protocol behavior');
    }

    // Action-specific strategies
    if (actions.some(a => a.type === 'borrow')) {
      strategies.push('Monitor collateralization ratio to avoid liquidation');
      strategies.push('Set up price alerts for collateral assets');
    }

    if (actions.some(a => a.type === 'add_liquidity')) {
      strategies.push('Monitor for impermanent loss, especially in volatile markets');
      strategies.push('Consider single-sided staking alternatives');
    }

    // General strategies
    strategies.push('Diversify across multiple protocols to reduce concentration risk');
    strategies.push('Keep track of protocol updates and security audits');
    strategies.push('Use stop-loss mechanisms where available');

    return strategies;
  }

  private determineOverallRisk(riskScore: number): 'low' | 'medium' | 'high' | 'extreme' {
    if (riskScore >= 8) return 'extreme';
    if (riskScore >= 5) return 'high';
    if (riskScore >= 2) return 'medium';
    return 'low';
  }

  private async analyzeYieldOpportunities(actions: DeFiAction[]): Promise<YieldAnalysis | undefined> {
    const yieldActions = actions.filter(a =>
      ['stake', 'lend', 'add_liquidity', 'farm'].includes(a.type)
    );

    if (yieldActions.length === 0) return undefined;

    // Calculate weighted average APR/APY
    let totalValue = 0;
    let weightedApr = 0;
    let weightedApy = 0;
    const rewardTokens: TokenAmount[] = [];

    for (const action of yieldActions) {
      const actionValue = action.inputTokens.reduce((sum, token) => sum + (token.usdValue || 0), 0);
      totalValue += actionValue;

      if (action.apr) {
        weightedApr += action.apr * actionValue;
      }
      if (action.apy) {
        weightedApy += action.apy * actionValue;
      }
      if (action.rewards) {
        rewardTokens.push(...action.rewards);
      }
    }

    const currentApr = totalValue > 0 ? weightedApr / totalValue : undefined;
    const currentApy = totalValue > 0 ? weightedApy / totalValue : undefined;

    // Calculate projected returns
    const projectedReturns = {
      daily: totalValue * (currentApr || 0) / 365 / 100,
      weekly: totalValue * (currentApr || 0) / 52 / 100,
      monthly: totalValue * (currentApr || 0) / 12 / 100,
      yearly: totalValue * (currentApr || 0) / 100
    };

    return {
      currentApr,
      currentApy,
      projectedReturns,
      rewardTokens,
      compoundingFrequency: 'daily',
      yieldSource: this.determineYieldSource(yieldActions),
      sustainability: this.assessYieldSustainability(yieldActions)
    };
  }

  private determineYieldSource(actions: DeFiAction[]): YieldAnalysis['yieldSource'] {
    const actionTypes = actions.map(a => a.type);

    if (actionTypes.includes('add_liquidity')) return 'trading_fees';
    if (actionTypes.includes('lend')) return 'lending_interest';
    if (actionTypes.includes('stake')) return 'staking_rewards';
    if (actionTypes.includes('farm')) return 'farming_rewards';

    return 'mixed';
  }

  private assessYieldSustainability(actions: DeFiAction[]): 'high' | 'medium' | 'low' {
    // Assess based on protocol maturity and yield source
    const hasHighRiskProtocols = actions.some(a => a.protocol.riskLevel === 'high');
    const hasHighYield = actions.some(a => (a.apr || 0) > 20);

    if (hasHighRiskProtocols || hasHighYield) return 'low';
    if (actions.some(a => a.protocol.riskLevel === 'medium')) return 'medium';

    return 'high';
  }

  private async analyzeLiquidityProvision(actions: DeFiAction[]): Promise<LiquidityAnalysis | undefined> {
    const liquidityActions = actions.filter(a =>
      ['add_liquidity', 'remove_liquidity'].includes(a.type)
    );

    if (liquidityActions.length === 0) return undefined;

    // Mock liquidity analysis
    return {
      poolSize: 1000000, // $1M pool
      userShare: 0.1, // 0.1%
      impermanentLossRisk: 'medium',
      liquidityUtilization: 75, // 75%
      tradingVolume24h: 50000, // $50K
      feesEarned24h: 125, // $125
      priceRange: {
        min: 95,
        max: 105,
        current: 100
      }
    };
  }

  private async getMarketContext(actions: DeFiAction[]): Promise<MarketContext | undefined> {
    // Mock market context based on actions
    const hasHighValueActions = actions.some(a => a.inputTokens.some(t => (t.usdValue || 0) > 10000));
    const volatilityIndex = hasHighValueActions ? 65 : 45;

    return {
      marketCondition: hasHighValueActions ? 'volatile' : 'sideways',
      volatilityIndex,
      liquidityCondition: 'medium',
      recommendedActions: [
        'Consider dollar-cost averaging for large positions',
        'Monitor market conditions before adding more liquidity'
      ],
      warnings: [
        'Market volatility is elevated',
        'Some protocols showing reduced liquidity'
      ]
    };
  }

  private generateRecommendations(
    protocols: DeFiProtocol[],
    actions: DeFiAction[],
    financialImpact: FinancialImpact,
    riskAssessment: DeFiRiskAssessment,
    marketContext?: MarketContext
  ): string[] {
    const recommendations: string[] = [];

    // Action-specific recommendations
    if (actions.some(a => a.type === 'swap' && a.inputTokens.some(t => (t.usdValue || 0) > 5000))) {
      recommendations.push('Large swap detected - consider breaking into smaller transactions to reduce price impact');
    }
    if (actions.some(a => a.type === 'add_liquidity')) {
      recommendations.push('Monitor impermanent loss when providing liquidity');
    }

    // Risk-based recommendations
    if (riskAssessment.overallRisk === 'high' || riskAssessment.overallRisk === 'extreme') {
      recommendations.push('⚠️ High risk detected - consider reducing position size');
      recommendations.push('📊 Review risk factors carefully before proceeding');
    }

    // Fee optimization
    if (financialImpact.feePercentage > 1) {
      recommendations.push('💰 Consider optimizing for lower fees by batching transactions');
    }

    // Protocol-specific recommendations
    if (protocols.some(p => p.category === 'dex')) {
      recommendations.push('🔄 Consider using DEX aggregators for better prices');
    }

    if (protocols.some(p => p.category === 'lending')) {
      recommendations.push('📈 Monitor interest rates for better lending opportunities');
    }

    // Market-based recommendations
    if (marketContext?.marketCondition === 'volatile') {
      recommendations.push('⚡ High volatility - consider smaller position sizes');
    }

    // General DeFi recommendations
    recommendations.push('🔐 Always verify contract addresses before interacting');
    recommendations.push('📚 Stay updated with protocol announcements and updates');
    recommendations.push('💡 Consider diversifying across multiple protocols');

    return recommendations;
  }

  private createEmptyFinancialImpact(): FinancialImpact {
    return {
      totalValueIn: 0,
      totalValueOut: 0,
      netValue: 0,
      totalFees: 0,
      feePercentage: 0
    };
  }

  private createLowRiskAssessment(): DeFiRiskAssessment {
    return {
      overallRisk: 'low',
      riskScore: 0,
      factors: [],
      protocolRisks: [],
      marketRisks: [],
      technicalRisks: [],
      mitigationStrategies: []
    };
  }

  // Public utility methods
  async getProtocolInfo(programId: string): Promise<DeFiProtocol | null> {
    return DEFI_PROTOCOLS[programId] || null;
  }

  getAllProtocols(): DeFiProtocol[] {
    return Object.values(DEFI_PROTOCOLS);
  }

  getProtocolsByCategory(category: DeFiProtocol['category']): DeFiProtocol[] {
    return Object.values(DEFI_PROTOCOLS).filter(p => p.category === category);
  }
}

// Export singleton instance
export const defiTransactionAnalyzer = new DeFiTransactionAnalyzer();

// Export utility functions
export function formatDeFiAmount(amount: TokenAmount): string {
  const numAmount = parseFloat(amount.amount);
  const formatted = numAmount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6
  });

  const usdDisplay = amount.usdValue
    ? ` (~$${amount.usdValue.toLocaleString()})`
    : '';

  return `${formatted} ${amount.symbol}${usdDisplay}`;
}

export function getDeFiActionIcon(actionType: DeFiAction['type']): string {
  const icons = {
    swap: '🔄',
    add_liquidity: '💧',
    remove_liquidity: '💸',
    lend: '🏦',
    borrow: '💳',
    stake: '🔒',
    unstake: '🔓',
    claim_rewards: '🎁',
    bridge: '🌉',
    farm: '🚜',
    harvest: '🌾'
  };

  return icons[actionType] || '❓';
}

export function getRiskLevelColor(riskLevel: 'low' | 'medium' | 'high' | 'extreme'): string {
  const colors = {
    low: 'text-green-600 dark:text-green-400',
    medium: 'text-yellow-600 dark:text-yellow-400',
    high: 'text-red-600 dark:text-red-400',
    extreme: 'text-red-800 dark:text-red-300'
  };

  return colors[riskLevel];
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function formatUsdValue(value: number): string {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}