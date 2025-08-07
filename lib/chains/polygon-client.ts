/**
 * Polygon blockchain client implementation
 * 
 * This module provides Polygon-specific functionality for interacting with
 * the Polygon blockchain, including transaction parsing, DeFi protocol analysis,
 * and cross-chain bridge detection.
 */

import { ethers } from 'ethers';
import {
  BaseBlockchainClient,
  ChainClientConfig,
  SearchParams,
  NetworkStats
} from './base-client';
import {
  ChainId,
  UnifiedTransaction,
  UnifiedAccount,
  UnifiedBlock,
  TokenBalance,
  TokenTransfer,
  DeFiInteraction,
  MEVData,
  FlashLoan,
  GovernanceProposal,
  BridgeTransaction
} from './types';

// ERC-20 Token ABI (minimal)
const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)'
];

// Polygon-specific protocol addresses
const POLYGON_PROTOCOLS = {
  QUICKSWAP: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff', // QuickSwap Router
  SUSHISWAP: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', // SushiSwap Router
  AAVE: '0x8dFf5E27EA6b7AC08EbFdf9eB090F32ee9a30fcf', // Aave Lending Pool
  CURVE: '0x445FE580eF8d70FF569aB36e80c647af338db351', // Curve Registry
  BALANCER: '0xBA12222222228d8Ba445958a75a0704d566BF2C8', // Balancer Vault
  POLYGON_BRIDGE: '0xA0c68C638235ee32657e8f720a23ceC1bFc77C77' // Polygon PoS Bridge
};

export class PolygonClient extends BaseBlockchainClient {
  private provider: ethers.JsonRpcProvider;
  private readonly NATIVE_TOKEN = '0x0000000000000000000000000000000000000000';

  constructor(config: ChainClientConfig) {
    super(config);
    
    // Initialize ethers provider with Polygon-specific configuration
    this.provider = new ethers.FallbackProvider(
      config.rpcUrls.map((url, index) => ({
        provider: new ethers.JsonRpcProvider(url, {
          name: 'polygon',
          chainId: 137,
          ensAddress: undefined
        }),
        priority: index,
        weight: 1
      })),
      1
    );
  }

  async getTransaction(txHash: string): Promise<UnifiedTransaction> {
    try {
      const [tx, receipt] = await Promise.all([
        this.provider.getTransaction(txHash),
        this.provider.getTransactionReceipt(txHash)
      ]);

      if (!tx) {
        throw new Error(`Transaction not found: ${txHash}`);
      }

      const block = receipt ? await this.provider.getBlock(receipt.blockNumber) : null;

      // Parse token transfers from logs
      const tokenTransfers = receipt ? await this.parseTokenTransfers(receipt.logs) : [];

      // Analyze DeFi interactions (Polygon has many DeFi protocols)
      const defiInteractions = receipt ? await this.analyzeDeFiInteractions(receipt) : [];

      // Detect bridge transactions
      const bridgeData = receipt ? await this.detectBridgeTransaction(receipt) : undefined;

      // Calculate risk score with Polygon-specific considerations
      const riskScore = await this.calculatePolygonRiskScore(tx, receipt);

      return {
        id: txHash,
        chainId: 'polygon',
        blockNumber: receipt?.blockNumber || null,
        blockHash: receipt?.blockHash || null,
        timestamp: block?.timestamp ? block.timestamp * 1000 : Date.now(),
        status: receipt ? (receipt.status === 1 ? 'success' : 'failed') : 'pending',
        from: tx.from,
        to: tx.to || null,
        value: tx.value.toString(),
        fee: receipt ? (BigInt(receipt.gasUsed) * BigInt(tx.gasPrice || 0)).toString() : '0',
        gasUsed: receipt ? Number(receipt.gasUsed) : undefined,
        gasPrice: tx.gasPrice?.toString(),
        tokenTransfers,
        defiInteractions,
        riskScore,
        analytics: {
          category: this.categorizeTransaction(tx, receipt, tokenTransfers, defiInteractions),
          complexity: this.calculateComplexity(tx, receipt),
          patterns: await this.identifyPolygonPatterns(tx, receipt),
          labels: await this.generatePolygonLabels(tx, receipt, bridgeData)
        },
        raw: { tx, receipt, bridgeData }
      };
    } catch (error) {
      console.error('Error fetching Polygon transaction:', error);
      throw error;
    }
  }

  async getAccount(address: string): Promise<UnifiedAccount> {
    try {
      const [balance, nonce, code] = await Promise.all([
        this.provider.getBalance(address),
        this.provider.getTransactionCount(address),
        this.provider.getCode(address)
      ]);

      const isContract = code !== '0x';
      const tokenBalances = await this.getTokenBalances(address);

      // Calculate total USD value
      const totalValueUsd = tokenBalances.reduce((sum, token) => 
        sum + (token.usdValue || 0), 0
      );

      // Analyze Polygon-specific activity
      const polygonActivity = await this.analyzePolygonActivity(address);

      return {
        address,
        chainId: 'polygon',
        balance: balance.toString(),
        tokenBalances,
        transactionCount: nonce,
        firstSeen: polygonActivity.firstSeen,
        lastSeen: polygonActivity.lastSeen,
        labels: await this.generateAccountLabels(address, isContract, polygonActivity),
        type: this.determineAccountType(code, tokenBalances),
        analytics: {
          totalValueUsd,
          transactionVolume: polygonActivity.volume,
          avgTransactionSize: polygonActivity.avgTxSize,
          activeProtocols: polygonActivity.protocols,
          behaviorPattern: polygonActivity.pattern,
          riskFlags: polygonActivity.riskFlags
        },
        relatedAddresses: polygonActivity.relatedAddresses
      };
    } catch (error) {
      console.error('Error fetching Polygon account:', error);
      throw error;
    }
  }

  async getBlock(blockNumber: number): Promise<UnifiedBlock> {
    try {
      const block = await this.provider.getBlock(blockNumber, true);
      
      if (!block) {
        throw new Error(`Block not found: ${blockNumber}`);
      }

      // Calculate block analytics with Polygon's fast block times
      const totalValueTransferred = block.transactions.reduce((sum, tx) => {
        if (typeof tx === 'string') return sum;
        return sum + BigInt(tx.value);
      }, BigInt(0));

      const totalFees = block.transactions.reduce((sum, tx) => {
        if (typeof tx === 'string') return sum;
        return sum + (BigInt(tx.gasLimit) * BigInt(tx.gasPrice || 0));
      }, BigInt(0));

      return {
        chainId: 'polygon',
        blockNumber: block.number,
        blockHash: block.hash || '',
        parentHash: block.parentHash,
        timestamp: block.timestamp * 1000,
        transactionCount: block.transactions.length,
        gasUsed: block.gasUsed.toString(),
        gasLimit: block.gasLimit.toString(),
        miner: block.miner,
        size: block.length || 0,
        totalValueTransferred: totalValueTransferred.toString(),
        totalFees: totalFees.toString(),
        avgGasPrice: this.calculateAverageGasPrice(block),
        transactions: block.transactions.map(tx => 
          typeof tx === 'string' ? tx : tx.hash
        )
      };
    } catch (error) {
      console.error('Error fetching Polygon block:', error);
      throw error;
    }
  }

  async getLatestBlock(): Promise<UnifiedBlock> {
    const blockNumber = await this.provider.getBlockNumber();
    return this.getBlock(blockNumber);
  }

  async getTokenBalances(address: string): Promise<TokenBalance[]> {
    try {
      const balances: TokenBalance[] = [];
      
      // Add MATIC balance
      const maticBalance = await this.provider.getBalance(address);
      balances.push({
        tokenAddress: this.NATIVE_TOKEN,
        symbol: 'MATIC',
        name: 'Polygon',
        decimals: 18,
        balance: maticBalance.toString(),
        usdValue: undefined // Would integrate with price feeds
      });

      // Would add common Polygon tokens here (USDC, USDT, WETH, etc.)
      const commonTokens = [
        '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC
        '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // USDT
        '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', // WETH
        '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6'  // WBTC
      ];

      for (const tokenAddress of commonTokens) {
        try {
          const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
          const [balance, symbol, name, decimals] = await Promise.all([
            tokenContract.balanceOf(address),
            tokenContract.symbol(),
            tokenContract.name(),
            tokenContract.decimals()
          ]);

          if (balance > 0) {
            balances.push({
              tokenAddress,
              symbol,
              name,
              decimals,
              balance: balance.toString()
            });
          }
        } catch (error) {
          console.warn(`Error fetching token balance for ${tokenAddress}:`, error);
        }
      }

      return balances;
    } catch (error) {
      console.error('Error fetching token balances:', error);
      return [];
    }
  }

  async searchTransactions(params: SearchParams): Promise<UnifiedTransaction[]> {
    try {
      // Would use Polygon's subgraph or indexing services
      // For now, return empty array with structure
      return [];
    } catch (error) {
      console.error('Error searching transactions:', error);
      return [];
    }
  }

  async getNetworkStats(): Promise<NetworkStats> {
    try {
      const [blockNumber, gasPrice] = await Promise.all([
        this.provider.getBlockNumber(),
        this.provider.getFeeData()
      ]);

      // Get recent blocks to calculate Polygon's fast block times
      const recentBlocks = await Promise.all([
        this.provider.getBlock(blockNumber),
        this.provider.getBlock(blockNumber - 1),
        this.provider.getBlock(blockNumber - 2),
        this.provider.getBlock(blockNumber - 3),
        this.provider.getBlock(blockNumber - 4)
      ]);

      const validBlocks = recentBlocks.filter(Boolean);
      const avgBlockTime = validBlocks.reduce((sum, block, index) => {
        if (index === 0 || !block) return sum;
        return sum + (validBlocks[index - 1]!.timestamp - block.timestamp);
      }, 0) / (validBlocks.length - 1);

      const avgTransactionsPerBlock = validBlocks.reduce((sum, block) => 
        sum + (block?.transactions.length || 0), 0
      ) / validBlocks.length;

      const tps = avgTransactionsPerBlock / avgBlockTime;

      return {
        chainId: 'polygon',
        blockHeight: blockNumber,
        blockTime: avgBlockTime,
        tps,
        gasPrice: gasPrice.gasPrice?.toString(),
        totalAccounts: 0, // Would need external data
        totalTransactions: 0, // Would need external data
        marketCap: 0, // Would need external data
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error fetching network stats:', error);
      throw error;
    }
  }

  // Polygon-specific enhanced methods

  async getBridgeTransactions(address: string, limit = 100): Promise<BridgeTransaction[]> {
    try {
      const bridgeTransactions: BridgeTransaction[] = [];
      
      // Analyze transactions for Polygon bridge interactions
      // This would monitor the official Polygon PoS Bridge and other bridges
      
      return bridgeTransactions.slice(0, limit);
    } catch (error) {
      console.error('Error getting bridge transactions:', error);
      return [];
    }
  }

  async getDeFiInteractions(address: string, limit = 100): Promise<DeFiInteraction[]> {
    try {
      const interactions: DeFiInteraction[] = [];
      
      // Analyze for Polygon DeFi protocols
      // QuickSwap, SushiSwap, Aave, Curve, etc.
      
      return interactions.slice(0, limit);
    } catch (error) {
      console.error('Error getting DeFi interactions:', error);
      return [];
    }
  }

  // Private helper methods specific to Polygon

  private async parseTokenTransfers(logs: Array<any>): Promise<TokenTransfer[]> {
    const transfers: TokenTransfer[] = [];
    
    const transferTopic = ethers.id('Transfer(address,address,uint256)');
    
    for (const log of logs) {
      if (log.topics[0] === transferTopic && log.topics.length === 3) {
        try {
          const from = ethers.getAddress('0x' + log.topics[1].slice(26));
          const to = ethers.getAddress('0x' + log.topics[2].slice(26));
          const amount = BigInt(log.data).toString();
          
          // Get token info (would be cached in production)
          const tokenContract = new ethers.Contract(log.address, ERC20_ABI, this.provider);
          const [symbol, name, decimals] = await Promise.all([
            tokenContract.symbol().catch(() => 'UNKNOWN'),
            tokenContract.name().catch(() => 'Unknown Token'),
            tokenContract.decimals().catch(() => 18)
          ]);

          transfers.push({
            tokenAddress: log.address,
            symbol,
            name,
            decimals,
            from,
            to,
            amount,
            logIndex: log.logIndex
          });
        } catch (error) {
          console.warn('Error parsing token transfer:', error);
        }
      }
    }
    
    return transfers;
  }

  private async analyzeDeFiInteractions(receipt: any): Promise<DeFiInteraction[]> {
    const interactions: DeFiInteraction[] = [];
    
    for (const log of receipt.logs) {
      // QuickSwap interactions
      if (this.isQuickSwapInteraction(log)) {
        interactions.push(await this.parseQuickSwapInteraction(log));
      }
      
      // Aave interactions
      if (this.isAavePolygonInteraction(log)) {
        interactions.push(await this.parseAavePolygonInteraction(log));
      }
      
      // Other Polygon DeFi protocols
    }
    
    return interactions;
  }

  private async detectBridgeTransaction(receipt: any): Promise<any> {
    // Detect Polygon bridge transactions
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === POLYGON_PROTOCOLS.POLYGON_BRIDGE.toLowerCase()) {
        return {
          type: 'polygon-bridge',
          direction: this.determineBridgeDirection(log),
          metadata: log
        };
      }
    }
    return null;
  }

  private async calculatePolygonRiskScore(tx: any, receipt: any): Promise<number> {
    let score = 0;
    
    // High value transactions (in MATIC)
    if (BigInt(tx.value) > ethers.parseEther('10000')) score += 15;
    
    // Bridge transactions have inherent risk
    if (receipt && await this.detectBridgeTransaction(receipt)) {
      score += 10;
    }
    
    // Complex DeFi interactions
    if (receipt && receipt.logs.length > 15) score += 10;
    
    // Failed transactions
    if (receipt && receipt.status === 0) score += 25;
    
    return Math.min(score, 100);
  }

  private categorizeTransaction(
    tx: any, 
    receipt: any, 
    tokenTransfers: TokenTransfer[], 
    defiInteractions: DeFiInteraction[]
  ): 'transfer' | 'defi' | 'nft' | 'contract' | 'bridge' | 'unknown' {
    if (defiInteractions.length > 0) return 'defi';
    
    // Check for bridge activity
    if (receipt && this.detectBridgeTransaction(receipt)) return 'bridge';
    
    if (tokenTransfers.length > 0) return 'transfer';
    if (tx.to === null) return 'contract';
    if (tx.data && tx.data !== '0x') return 'contract';
    return 'transfer';
  }

  private calculateComplexity(tx: any, receipt: any): 'simple' | 'medium' | 'complex' {
    const gasUsed = receipt ? Number(receipt.gasUsed) : 21000;
    const logCount = receipt ? receipt.logs.length : 0;
    
    // Polygon has lower gas costs, so adjust thresholds
    if (gasUsed < 30000 && logCount === 0) return 'simple';
    if (gasUsed < 100000 && logCount < 8) return 'medium';
    return 'complex';
  }

  private async identifyPolygonPatterns(tx: any, receipt: any): Promise<string[]> {
    const patterns: string[] = [];
    
    // Low gas price (Polygon's advantage)
    if (tx.gasPrice && BigInt(tx.gasPrice) < ethers.parseUnits('50', 'gwei')) {
      patterns.push('low-gas-polygon');
    }
    
    // Fast confirmation (Polygon's ~2s blocks)
    patterns.push('fast-confirmation');
    
    return patterns;
  }

  private async generatePolygonLabels(tx: any, receipt: any, bridgeData: any): Promise<string[]> {
    const labels: string[] = [];
    
    if (bridgeData) {
      labels.push('bridge-transaction');
      labels.push(`bridge-${bridgeData.direction}`);
    }
    
    if (BigInt(tx.value) > ethers.parseEther('1000')) {
      labels.push('high-value-matic');
    }
    
    return labels;
  }

  private async analyzePolygonActivity(address: string): Promise<{
    firstSeen: number;
    lastSeen: number;
    volume: number;
    avgTxSize: number;
    protocols: string[];
    pattern: 'trader' | 'hodler' | 'defi_user' | 'bot' | 'bridge' | 'unknown';
    riskFlags: string[];
    relatedAddresses: any[];
  }> {
    // Would implement comprehensive activity analysis
    return {
      firstSeen: 0,
      lastSeen: Date.now(),
      volume: 0,
      avgTxSize: 0,
      protocols: [],
      pattern: 'unknown',
      riskFlags: [],
      relatedAddresses: []
    };
  }

  private async generateAccountLabels(address: string, isContract: boolean, activity: any): Promise<string[]> {
    const labels: string[] = [];
    
    if (isContract) {
      labels.push('polygon-contract');
    } else {
      labels.push('polygon-eoa');
    }
    
    if (activity.protocols.includes('bridge')) {
      labels.push('bridge-user');
    }
    
    return labels;
  }

  private determineAccountType(code: string, tokenBalances: TokenBalance[]): 'eoa' | 'contract' | 'multisig' | 'unknown' {
    if (code === '0x') return 'eoa';
    
    // Detect multisig patterns on Polygon
    if (tokenBalances.length > 50) {
      return 'multisig';
    }
    
    return 'contract';
  }

  private calculateAverageGasPrice(block: any): string {
    if (!block.transactions || block.transactions.length === 0) return '0';
    
    const totalGasPrice = block.transactions.reduce((sum: bigint, tx: any) => {
      if (typeof tx === 'string') return sum;
      return sum + BigInt(tx.gasPrice || 0);
    }, BigInt(0));
    
    return (totalGasPrice / BigInt(block.transactions.length)).toString();
  }

  private isQuickSwapInteraction(log: any): boolean {
    const swapTopic = ethers.id('Swap(address,uint256,uint256,uint256,uint256,address)');
    return log.topics[0] === swapTopic;
  }

  private async parseQuickSwapInteraction(log: any): Promise<DeFiInteraction> {
    return {
      protocol: 'QuickSwap',
      type: 'swap',
      poolAddress: log.address,
      metadata: {
        logIndex: log.logIndex,
        topics: log.topics,
        data: log.data
      }
    };
  }

  private isAavePolygonInteraction(log: any): boolean {
    // Check for Aave Polygon-specific events
    return false; // Placeholder
  }

  private async parseAavePolygonInteraction(log: any): Promise<DeFiInteraction> {
    return {
      protocol: 'Aave Polygon',
      type: 'lending',
      metadata: {}
    };
  }

  private determineBridgeDirection(log: any): 'deposit' | 'withdrawal' {
    // Analyze log to determine bridge direction
    return 'deposit'; // Placeholder
  }
}