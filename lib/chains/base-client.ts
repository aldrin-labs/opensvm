/**
 * Base blockchain client interface
 * 
 * This module defines the abstract base class and interface that all
 * blockchain implementations must follow for consistency across chains.
 */

import {
  ChainId,
  UnifiedTransaction,
  UnifiedAccount,
  UnifiedBlock,
  TokenBalance,
  DeFiInteraction,
  MEVData,
  FlashLoan,
  GovernanceProposal,
  ComplianceData,
  PatternRecognition,
  BridgeTransaction
} from './types';

// Base configuration interface for blockchain clients
export interface ChainClientConfig {
  chainId: ChainId;
  rpcUrls: string[];
  apiKeys?: Record<string, string>;
  timeout?: number;
  retryAttempts?: number;
  rateLimitConfig?: {
    requestsPerSecond: number;
    burstLimit: number;
  };
}

// Base abstract class for blockchain clients
export abstract class BaseBlockchainClient {
  protected config: ChainClientConfig;
  protected currentRpcIndex = 0;

  constructor(config: ChainClientConfig) {
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      rateLimitConfig: {
        requestsPerSecond: 10,
        burstLimit: 20
      },
      ...config
    };
  }

  // Abstract methods that must be implemented by each chain
  abstract getTransaction(txHash: string): Promise<UnifiedTransaction>;
  abstract getAccount(address: string): Promise<UnifiedAccount>;
  abstract getBlock(blockNumber: number): Promise<UnifiedBlock>;
  abstract getLatestBlock(): Promise<UnifiedBlock>;
  abstract getTokenBalances(address: string): Promise<TokenBalance[]>;
  abstract searchTransactions(params: SearchParams): Promise<UnifiedTransaction[]>;
  abstract getNetworkStats(): Promise<NetworkStats>;

  // Optional methods with default implementations
  async getDeFiInteractions(address: string, limit?: number): Promise<DeFiInteraction[]> {
    // Default implementation returns empty array
    return [];
  }

  async getMEVData(txHash: string): Promise<MEVData | null> {
    // Default implementation returns null
    return null;
  }

  async getFlashLoans(address: string, limit?: number): Promise<FlashLoan[]> {
    // Default implementation returns empty array
    return [];
  }

  async getGovernanceProposals(protocol: string, limit?: number): Promise<GovernanceProposal[]> {
    // Default implementation returns empty array
    return [];
  }

  async getComplianceData(address: string): Promise<ComplianceData | null> {
    // Default implementation returns null
    return null;
  }

  async analyzePatterns(txHash: string): Promise<PatternRecognition | null> {
    // Default implementation returns null
    return null;
  }

  async getBridgeTransactions(address: string, limit?: number): Promise<BridgeTransaction[]> {
    // Default implementation returns empty array
    return [];
  }

  // Utility methods for RPC management
  protected async makeRpcRequest<T>(
    method: string,
    params: any[] = [],
    customEndpoint?: string
  ): Promise<T> {
    const endpoint = customEndpoint || this.getCurrentRpcUrl();
    const requestBody = {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params
    };

    let lastError: Error;
    
    for (let attempt = 0; attempt < this.config.retryAttempts!; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.getAuthHeaders()
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.error) {
          throw new Error(data.error.message || 'RPC error');
        }

        return data.result;
      } catch (error) {
        lastError = error as Error;
        console.warn(`RPC attempt ${attempt + 1} failed:`, error);
        
        // Try next RPC endpoint on failure
        if (attempt < this.config.retryAttempts! - 1) {
          this.rotateRpcEndpoint();
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    throw lastError!;
  }

  protected getCurrentRpcUrl(): string {
    return this.config.rpcUrls[this.currentRpcIndex];
  }

  protected rotateRpcEndpoint(): void {
    this.currentRpcIndex = (this.currentRpcIndex + 1) % this.config.rpcUrls.length;
  }

  protected getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    
    if (this.config.apiKeys) {
      // Add chain-specific auth headers
      Object.entries(this.config.apiKeys).forEach(([key, value]) => {
        if (key === 'authorization') {
          headers['Authorization'] = `Bearer ${value}`;
        } else if (key === 'api-key') {
          headers['X-API-Key'] = value;
        } else {
          headers[key] = value;
        }
      });
    }

    return headers;
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      await this.getLatestBlock();
      return true;
    } catch {
      return false;
    }
  }

  // Get chain info
  getChainId(): ChainId {
    return this.config.chainId;
  }
}

// Search parameters interface
export interface SearchParams {
  address?: string;
  fromBlock?: number;
  toBlock?: number;
  tokenAddress?: string;
  limit?: number;
  offset?: number;
  category?: 'transfer' | 'defi' | 'nft' | 'contract';
}

// Network statistics interface
export interface NetworkStats {
  chainId: ChainId;
  blockHeight: number;
  blockTime: number; // Average block time in seconds
  tps: number; // Transactions per second
  gasPrice?: string; // For EVM chains
  networkHashRate?: string; // For PoW chains
  totalAccounts: number;
  totalTransactions: number;
  marketCap: number; // USD
  timestamp: number;
}

// Blockchain client factory
export class BlockchainClientFactory {
  private static clients: Map<ChainId, BaseBlockchainClient> = new Map();

  static registerClient(chainId: ChainId, client: BaseBlockchainClient): void {
    this.clients.set(chainId, client);
  }

  static getClient(chainId: ChainId): BaseBlockchainClient {
    const client = this.clients.get(chainId);
    if (!client) {
      throw new Error(`No client registered for chain: ${chainId}`);
    }
    return client;
  }

  static getAllClients(): Map<ChainId, BaseBlockchainClient> {
    return new Map(this.clients);
  }

  static getSupportedChains(): ChainId[] {
    return Array.from(this.clients.keys());
  }

  static async healthCheckAll(): Promise<Record<ChainId, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const [chainId, client] of this.clients) {
      results[chainId] = await client.healthCheck();
    }

    return results as Record<ChainId, boolean>;
  }
}

// Multi-chain query helper
export class MultiChainQuery {
  static async executeParallel<T>(
    chains: ChainId[],
    operation: (client: BaseBlockchainClient) => Promise<T>
  ): Promise<Record<ChainId, T | Error>> {
    const results: Record<string, T | Error> = {};
    
    const promises = chains.map(async (chainId) => {
      try {
        const client = BlockchainClientFactory.getClient(chainId);
        const result = await operation(client);
        results[chainId] = result;
      } catch (error) {
        results[chainId] = error as Error;
      }
    });

    await Promise.allSettled(promises);
    return results as Record<ChainId, T | Error>;
  }

  static async executeSequential<T>(
    chains: ChainId[],
    operation: (client: BaseBlockchainClient) => Promise<T>
  ): Promise<Record<ChainId, T | Error>> {
    const results: Record<string, T | Error> = {};
    
    for (const chainId of chains) {
      try {
        const client = BlockchainClientFactory.getClient(chainId);
        const result = await operation(client);
        results[chainId] = result;
      } catch (error) {
        results[chainId] = error as Error;
      }
    }

    return results as Record<ChainId, T | Error>;
  }
}

// Error classes for better error handling
export class ChainError extends Error {
  constructor(
    public chainId: ChainId,
    message: string,
    public originalError?: Error
  ) {
    super(`[${chainId}] ${message}`);
    this.name = 'ChainError';
  }
}

export class RpcError extends ChainError {
  constructor(
    chainId: ChainId,
    public endpoint: string,
    message: string,
    originalError?: Error
  ) {
    super(chainId, `RPC Error (${endpoint}): ${message}`, originalError);
    this.name = 'RpcError';
  }
}

export class TransactionNotFoundError extends ChainError {
  constructor(
    chainId: ChainId,
    public txHash: string
  ) {
    super(chainId, `Transaction not found: ${txHash}`);
    this.name = 'TransactionNotFoundError';
  }
}

export class BlockNotFoundError extends ChainError {
  constructor(
    chainId: ChainId,
    public blockNumber: number
  ) {
    super(chainId, `Block not found: ${blockNumber}`);
    this.name = 'BlockNotFoundError';
  }
}