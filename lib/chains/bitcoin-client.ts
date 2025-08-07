/**
 * Bitcoin blockchain client implementation
 * 
 * This module provides Bitcoin-specific functionality for interacting with
 * the Bitcoin blockchain, including UTXO analysis, transaction parsing,
 * and address clustering.
 */

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
  ComplianceData
} from './types';

// Bitcoin-specific interfaces
interface BitcoinUTXO {
  txid: string;
  vout: number;
  value: number; // satoshis
  scriptPubKey: {
    asm: string;
    hex: string;
    address?: string;
    type: string;
  };
  confirmations: number;
}

interface BitcoinTransactionInput {
  txid: string;
  vout: number;
  scriptSig: {
    asm: string;
    hex: string;
  };
  sequence: number;
  addresses?: string[];
  value?: number;
}

interface BitcoinTransactionOutput {
  value: number; // satoshis
  n: number;
  scriptPubKey: {
    asm: string;
    hex: string;
    addresses?: string[];
    type: string;
  };
}

interface BitcoinRawTransaction {
  txid: string;
  hash: string;
  version: number;
  size: number;
  vsize: number;
  weight: number;
  locktime: number;
  vin: BitcoinTransactionInput[];
  vout: BitcoinTransactionOutput[];
  hex: string;
  blockhash?: string;
  confirmations?: number;
  time?: number;
  blocktime?: number;
}

export class BitcoinClient extends BaseBlockchainClient {
  private readonly SATOSHIS_PER_BTC = 100000000;

  constructor(config: ChainClientConfig) {
    super(config);
  }

  async getTransaction(txHash: string): Promise<UnifiedTransaction> {
    try {
      // Get raw transaction data
      const rawTx = await this.makeRpcRequest<BitcoinRawTransaction>(
        'getrawtransaction',
        [txHash, true]
      );

      // Get block info if transaction is confirmed
      let blockInfo: any = null;
      if (rawTx.blockhash) {
        blockInfo = await this.makeRpcRequest('getblock', [rawTx.blockhash]);
      }

      // Calculate total input and output values
      const inputValue = rawTx.vin.reduce((sum, input) => sum + (input.value || 0), 0);
      const outputValue = rawTx.vout.reduce((sum, output) => sum + output.value, 0);
      const fee = inputValue - outputValue;

      // Get primary addresses
      const fromAddresses = this.extractInputAddresses(rawTx.vin);
      const toAddresses = this.extractOutputAddresses(rawTx.vout);

      // Analyze transaction patterns
      const patterns = await this.analyzeTransactionPatterns(rawTx);
      const riskScore = this.calculateBitcoinRiskScore(rawTx, patterns);

      // Create token transfers (Bitcoin only has native BTC transfers)
      const tokenTransfers: TokenTransfer[] = rawTx.vout
        .filter(output => output.scriptPubKey.addresses && output.scriptPubKey.addresses.length > 0)
        .map((output, index) => ({
          tokenAddress: '0x0000000000000000000000000000000000000000', // Native BTC
          symbol: 'BTC',
          name: 'Bitcoin',
          decimals: 8,
          from: fromAddresses[0] || '',
          to: output.scriptPubKey.addresses![0],
          amount: output.value.toString()
        }));

      return {
        id: txHash,
        chainId: 'bitcoin',
        blockNumber: blockInfo?.height || null,
        blockHash: rawTx.blockhash || null,
        timestamp: (rawTx.blocktime || rawTx.time || Date.now() / 1000) * 1000,
        status: rawTx.confirmations && rawTx.confirmations > 0 ? 'success' : 'pending',
        from: fromAddresses[0] || '',
        to: toAddresses[0] || null,
        value: outputValue.toString(),
        fee: fee.toString(),
        tokenTransfers,
        defiInteractions: [], // Bitcoin doesn't have DeFi in the traditional sense
        riskScore,
        riskFactors: patterns.riskFactors,
        analytics: {
          category: this.categorizeBitcoinTransaction(rawTx, patterns),
          complexity: this.calculateBitcoinComplexity(rawTx),
          patterns: patterns.patterns,
          labels: patterns.labels
        },
        raw: rawTx
      };
    } catch (error) {
      console.error('Error fetching Bitcoin transaction:', error);
      throw error;
    }
  }

  async getAccount(address: string): Promise<UnifiedAccount> {
    try {
      // Get address info and UTXOs
      const [utxos, addressInfo] = await Promise.all([
        this.getAddressUTXOs(address),
        this.getAddressInfo(address)
      ]);

      // Calculate balance from UTXOs
      const balance = utxos.reduce((sum, utxo) => sum + utxo.value, 0);

      // Get transaction history for analytics
      const transactions = await this.getAddressTransactions(address, 100);

      // Analyze address behavior
      const analytics = await this.analyzeAddressBehavior(address, transactions);

      return {
        address,
        chainId: 'bitcoin',
        balance: balance.toString(),
        tokenBalances: [{
          tokenAddress: '0x0000000000000000000000000000000000000000',
          symbol: 'BTC',
          name: 'Bitcoin',
          decimals: 8,
          balance: balance.toString()
        }],
        transactionCount: transactions.length,
        firstSeen: transactions.length > 0 ? Math.min(...transactions.map(tx => tx.timestamp)) : 0,
        lastSeen: transactions.length > 0 ? Math.max(...transactions.map(tx => tx.timestamp)) : 0,
        labels: analytics.labels,
        riskScore: analytics.riskScore,
        type: this.determineAddressType(address, addressInfo, utxos),
        analytics: {
          totalValueUsd: balance / this.SATOSHIS_PER_BTC * 50000, // Would use real price
          transactionVolume: analytics.totalVolume,
          avgTransactionSize: analytics.avgTransactionSize,
          activeProtocols: [], // Bitcoin doesn't have protocols like Ethereum
          behaviorPattern: analytics.behaviorPattern,
          riskFlags: analytics.riskFlags
        },
        relatedAddresses: analytics.relatedAddresses
      };
    } catch (error) {
      console.error('Error fetching Bitcoin account:', error);
      throw error;
    }
  }

  async getBlock(blockNumber: number): Promise<UnifiedBlock> {
    try {
      // Get block hash first, then block data
      const blockHash = await this.makeRpcRequest<string>('getblockhash', [blockNumber]);
      const block = await this.makeRpcRequest('getblock', [blockHash, 2]); // Verbosity 2 for full transaction data

      // Calculate block statistics
      const totalValueTransferred = block.tx.reduce((sum: number, tx: any) => {
        return sum + tx.vout.reduce((txSum: number, output: any) => txSum + output.value, 0);
      }, 0);

      const totalFees = block.tx.reduce((sum: number, tx: any) => {
        const inputValue = tx.vin.reduce((vinSum: number, input: any) => vinSum + (input.prevout?.value || 0), 0);
        const outputValue = tx.vout.reduce((voutSum: number, output: any) => voutSum + output.value, 0);
        return sum + (inputValue - outputValue);
      }, 0);

      return {
        chainId: 'bitcoin',
        blockNumber: block.height,
        blockHash: block.hash,
        parentHash: block.previousblockhash || '',
        timestamp: block.time * 1000,
        transactionCount: block.tx.length,
        difficulty: block.difficulty.toString(),
        size: block.size,
        totalValueTransferred: totalValueTransferred.toString(),
        totalFees: totalFees.toString(),
        transactions: block.tx.map((tx: any) => tx.txid)
      };
    } catch (error) {
      console.error('Error fetching Bitcoin block:', error);
      throw error;
    }
  }

  async getLatestBlock(): Promise<UnifiedBlock> {
    const blockCount = await this.makeRpcRequest<number>('getblockcount', []);
    return this.getBlock(blockCount);
  }

  async getTokenBalances(address: string): Promise<TokenBalance[]> {
    // Bitcoin only has native BTC, but we include it for consistency
    const utxos = await this.getAddressUTXOs(address);
    const balance = utxos.reduce((sum, utxo) => sum + utxo.value, 0);

    return [{
      tokenAddress: '0x0000000000000000000000000000000000000000',
      symbol: 'BTC',
      name: 'Bitcoin',
      decimals: 8,
      balance: balance.toString()
    }];
  }

  async searchTransactions(params: SearchParams): Promise<UnifiedTransaction[]> {
    try {
      if (!params.address) {
        throw new Error('Address required for Bitcoin transaction search');
      }

      const transactions = await this.getAddressTransactions(
        params.address,
        params.limit || 100
      );

      // Filter by block range if specified
      if (params.fromBlock || params.toBlock) {
        return transactions.filter(tx => {
          const blockNumber = tx.blockNumber;
          if (!blockNumber) return false;
          
          if (params.fromBlock && blockNumber < params.fromBlock) return false;
          if (params.toBlock && blockNumber > params.toBlock) return false;
          
          return true;
        });
      }

      return transactions;
    } catch (error) {
      console.error('Error searching Bitcoin transactions:', error);
      return [];
    }
  }

  async getNetworkStats(): Promise<NetworkStats> {
    try {
      const [blockchainInfo, networkInfo, mempoolInfo] = await Promise.all([
        this.makeRpcRequest('getblockchaininfo', []),
        this.makeRpcRequest('getnetworkinfo', []),
        this.makeRpcRequest('getmempoolinfo', []).catch(() => ({ size: 0 }))
      ]);

      // Calculate network hash rate
      const networkHashRate = await this.makeRpcRequest('getnetworkhashps', []).catch(() => '0');

      // Get recent blocks to calculate average block time
      const recentBlocks = await Promise.all([
        this.getBlock(blockchainInfo.blocks),
        this.getBlock(blockchainInfo.blocks - 1),
        this.getBlock(blockchainInfo.blocks - 2)
      ]);

      const avgBlockTime = recentBlocks.reduce((sum, block, index) => {
        if (index === 0) return sum;
        return sum + (recentBlocks[index - 1].timestamp - block.timestamp) / 1000;
      }, 0) / (recentBlocks.length - 1);

      const avgTransactionsPerBlock = recentBlocks.reduce((sum, block) => 
        sum + block.transactionCount, 0
      ) / recentBlocks.length;

      const tps = avgTransactionsPerBlock / avgBlockTime;

      return {
        chainId: 'bitcoin',
        blockHeight: blockchainInfo.blocks,
        blockTime: avgBlockTime,
        tps,
        networkHashRate: networkHashRate.toString(),
        totalAccounts: 0, // Bitcoin doesn't have accounts in the traditional sense
        totalTransactions: 0, // Would need external indexing service
        marketCap: 0, // Would need external price data
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error fetching Bitcoin network stats:', error);
      throw error;
    }
  }

  // Bitcoin-specific helper methods

  private async getAddressUTXOs(address: string): Promise<BitcoinUTXO[]> {
    try {
      // This would typically use a service like BlockCypher or Blockstream API
      // For now, implementing basic version
      return [];
    } catch (error) {
      console.error('Error fetching UTXOs:', error);
      return [];
    }
  }

  private async getAddressInfo(address: string): Promise<any> {
    try {
      // Get address information (if using Bitcoin Core with address indexing)
      return {};
    } catch (error) {
      console.error('Error fetching address info:', error);
      return {};
    }
  }

  private async getAddressTransactions(address: string, limit: number): Promise<UnifiedTransaction[]> {
    try {
      // This would require an indexing service to efficiently get address transactions
      // For now, return empty array
      return [];
    } catch (error) {
      console.error('Error fetching address transactions:', error);
      return [];
    }
  }

  private extractInputAddresses(inputs: BitcoinTransactionInput[]): string[] {
    const addresses: string[] = [];
    
    for (const input of inputs) {
      if (input.addresses) {
        addresses.push(...input.addresses);
      }
    }
    
    return [...new Set(addresses)]; // Remove duplicates
  }

  private extractOutputAddresses(outputs: BitcoinTransactionOutput[]): string[] {
    const addresses: string[] = [];
    
    for (const output of outputs) {
      if (output.scriptPubKey.addresses) {
        addresses.push(...output.scriptPubKey.addresses);
      }
    }
    
    return [...new Set(addresses)]; // Remove duplicates
  }

  private async analyzeTransactionPatterns(tx: BitcoinRawTransaction): Promise<{
    patterns: string[];
    labels: string[];
    riskFactors: string[];
  }> {
    const patterns: string[] = [];
    const labels: string[] = [];
    const riskFactors: string[] = [];

    // Mixing patterns
    if (tx.vin.length > 10 && tx.vout.length > 10) {
      patterns.push('mixing');
      riskFactors.push('potential-mixing');
    }

    // High-value transaction
    const totalOutput = tx.vout.reduce((sum, output) => sum + output.value, 0);
    if (totalOutput > 100 * this.SATOSHIS_PER_BTC) {
      patterns.push('high-value');
      labels.push('high-value');
    }

    // Consolidation pattern
    if (tx.vin.length > 20 && tx.vout.length === 1) {
      patterns.push('consolidation');
      labels.push('consolidation');
    }

    // Distribution pattern
    if (tx.vin.length === 1 && tx.vout.length > 20) {
      patterns.push('distribution');
      labels.push('distribution');
    }

    // Round number detection (potential exchange)
    for (const output of tx.vout) {
      if (output.value % (0.01 * this.SATOSHIS_PER_BTC) === 0) {
        patterns.push('round-numbers');
        labels.push('exchange-like');
        break;
      }
    }

    return { patterns, labels, riskFactors };
  }

  private calculateBitcoinRiskScore(
    tx: BitcoinRawTransaction, 
    patterns: { patterns: string[]; riskFactors: string[] }
  ): number {
    let score = 0;

    // High input/output count (mixing behavior)
    if (tx.vin.length > 20 || tx.vout.length > 20) score += 30;

    // Unusual transaction patterns
    if (patterns.patterns.includes('mixing')) score += 50;
    if (patterns.riskFactors.includes('potential-mixing')) score += 25;

    // Low confirmation count
    if (!tx.confirmations || tx.confirmations < 6) score += 10;

    return Math.min(score, 100);
  }

  private categorizeBitcoinTransaction(
    tx: BitcoinRawTransaction, 
    patterns: { patterns: string[] }
  ): 'transfer' | 'defi' | 'nft' | 'contract' | 'bridge' | 'unknown' {
    // Bitcoin transactions are primarily transfers
    if (patterns.patterns.includes('consolidation') || patterns.patterns.includes('distribution')) {
      return 'transfer';
    }

    // Check for potential bridge activity (would need more sophisticated detection)
    if (patterns.patterns.includes('bridge-like')) {
      return 'bridge';
    }

    return 'transfer';
  }

  private calculateBitcoinComplexity(tx: BitcoinRawTransaction): 'simple' | 'medium' | 'complex' {
    const inputCount = tx.vin.length;
    const outputCount = tx.vout.length;
    const totalIOs = inputCount + outputCount;

    if (totalIOs <= 4) return 'simple';
    if (totalIOs <= 20) return 'medium';
    return 'complex';
  }

  private async analyzeAddressBehavior(address: string, transactions: UnifiedTransaction[]): Promise<{
    labels: string[];
    riskScore: number;
    totalVolume: number;
    avgTransactionSize: number;
    behaviorPattern: 'trader' | 'hodler' | 'defi_user' | 'bot' | 'bridge' | 'unknown';
    riskFlags: string[];
    relatedAddresses: any[];
  }> {
    const labels: string[] = [];
    const riskFlags: string[] = [];
    const relatedAddresses: any[] = [];
    
    let totalVolume = 0;
    let riskScore = 0;

    // Analyze transaction patterns
    if (transactions.length === 0) {
      return {
        labels: ['inactive'],
        riskScore: 0,
        totalVolume: 0,
        avgTransactionSize: 0,
        behaviorPattern: 'unknown',
        riskFlags: [],
        relatedAddresses: []
      };
    }

    // Calculate volume and average transaction size
    totalVolume = transactions.reduce((sum, tx) => sum + parseFloat(tx.value), 0);
    const avgTransactionSize = totalVolume / transactions.length;

    // Determine behavior pattern
    let behaviorPattern: 'trader' | 'hodler' | 'defi_user' | 'bot' | 'bridge' | 'unknown' = 'unknown';
    
    const txFrequency = transactions.length / 30; // Assuming 30-day period
    if (txFrequency > 10) {
      behaviorPattern = 'trader';
      labels.push('active-trader');
    } else if (txFrequency < 1) {
      behaviorPattern = 'hodler';
      labels.push('hodler');
    }

    // Check for bot-like behavior
    const timeIntervals = transactions.slice(1).map((tx, i) => 
      tx.timestamp - transactions[i].timestamp
    );
    const avgInterval = timeIntervals.reduce((sum, interval) => sum + interval, 0) / timeIntervals.length;
    const intervalVariance = timeIntervals.reduce((sum, interval) => 
      sum + Math.pow(interval - avgInterval, 2), 0
    ) / timeIntervals.length;
    
    if (intervalVariance < avgInterval * 0.1 && transactions.length > 10) {
      behaviorPattern = 'bot';
      labels.push('bot-like');
      riskFlags.push('automated-activity');
    }

    return {
      labels,
      riskScore,
      totalVolume,
      avgTransactionSize,
      behaviorPattern,
      riskFlags,
      relatedAddresses
    };
  }

  private determineAddressType(
    address: string,
    addressInfo: any,
    utxos: BitcoinUTXO[]
  ): 'eoa' | 'contract' | 'multisig' | 'unknown' {
    // Bitcoin address type detection based on format
    if (address.startsWith('1')) {
      return 'eoa'; // P2PKH
    } else if (address.startsWith('3')) {
      return 'multisig'; // P2SH (often multisig)
    } else if (address.startsWith('bc1')) {
      return 'eoa'; // Bech32 (native SegWit)
    }
    
    return 'unknown';
  }
}