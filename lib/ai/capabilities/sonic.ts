import { Connection } from '@solana/web3.js';
import { BaseCapability } from './base';
import type { Message, ToolParams, CapabilityType } from '../types';
import { ExecutionMode } from '../types';

// This type definition is just for our reference since the SDK doesn't export it directly
interface SonicPool {
  id: string;
  name: string;
  tokens: string[];
  liquidity: number;
  volume24h: number;
  fee: number;
}

interface SonicSwapParams {
  fromToken: string;
  toToken: string;
  amount: number;
  slippage?: number;
}

export class SonicCapability extends BaseCapability {
  type: CapabilityType = 'network';
  executionMode = ExecutionMode.Sequential;
  private sonic: any; // Using any type until we have proper typings

  constructor(connection: Connection) {
    super(connection);
    // Using mock implementation for development
    this.sonic = this.createMockSonic();
  }
  
  private createMockSonic() {
    // Create a mock implementation for development
    return {
      getPools: async () => {
        return [
          {
            id: 'pool-1',
            name: 'SOL-USDC',
            tokens: ['SOL', 'USDC'],
            liquidity: 15000000,
            volume24h: 2500000,
            fee: 0.003
          },
          {
            id: 'pool-2',
            name: 'SOL-SVMAI',
            tokens: ['SOL', 'SVMAI'],
            liquidity: 8500000,
            volume24h: 1200000,
            fee: 0.003
          }
        ].filter(Boolean);
      },
      // Ensure we have a method to wrap the getPool functionality
      getPool: async (id: string) => {
        return await this.getPoolById(id);
      },
      swap: async (params: SonicSwapParams) => {
        return {
          success: true,
          txId: 'simulated-tx-' + Math.random().toString(36).substr(2, 9),
          fromAmount: params.amount,
          toAmount: params.amount * (params.fromToken === 'SOL' ? 30 : 0.03),
          executionPrice: params.fromToken === 'SOL' ? 30 : 0.03,
          fee: params.amount * 0.003
        };
      }
    };
  }
  
  // Add a utility method to get a pool by ID
  private async getPoolById(id: string): Promise<any> {
    try {
      const mockPools = [
        { id: 'pool-1', name: 'SOL-USDC', tokens: ['SOL', 'USDC'], liquidity: 15000000, volume24h: 2500000, fee: 0.003 },
        { id: 'pool-2', name: 'SOL-SVMAI', tokens: ['SOL', 'SVMAI'], liquidity: 8500000, volume24h: 1200000, fee: 0.003 }
      ];
      return mockPools.find(pool => pool.id === id);
    } catch (error) {
      console.error('Error in getPoolById:', error);
      return null;
    }
  }

  tools = [
    this.createToolExecutor(
      'getPools',
      'Fetches information about Sonic pools',
      async () => {
        try {
          const pools = await this.sonic.getPools();
          return JSON.stringify(pools, null, 2);
        } catch (error) {
          console.error('Error fetching Sonic pools:', error);
          return 'Error fetching Sonic pools. Please try again later.';
        }
      }
    ),
    this.createToolExecutor(
      'getPool',
      'Fetches information about a specific Sonic pool',
      async ({ message }: ToolParams) => {
        try {
          // Extract pool ID from the message
          const match = message.content.match(/pool[\s-](?:id[\s:]*)?([\w-]+)/i);
          const poolId = match ? match[1] : 'pool-1'; // Default to pool-1 if not specified
          
          const pool = await this.sonic.getPool(poolId);
          return pool ? JSON.stringify(pool, null, 2) : `Pool with ID ${poolId} not found.`;
        } catch (error) {
          console.error('Error fetching Sonic pool:', error);
          return 'Error fetching Sonic pool. Please try again later.';
        }
      }
    ),
    this.createToolExecutor(
      'swap',
      'Simulates a token swap using Sonic',
      async ({ message }: ToolParams) => {
        try {
          // Extract swap parameters from the message
          const fromTokenMatch = message.content.match(/from[\s:]*([\w\d]+)/i);
          const toTokenMatch = message.content.match(/to[\s:]*([\w\d]+)/i);
          const amountMatch = message.content.match(/amount[\s:]*(\d+(?:\.\d+)?)/i);
          
          if (!fromTokenMatch || !toTokenMatch || !amountMatch) {
            return 'Please specify from token, to token, and amount for swap.';
          }
          
          const params: SonicSwapParams = {
            fromToken: fromTokenMatch[1],
            toToken: toTokenMatch[1],
            amount: parseFloat(amountMatch[1]),
            slippage: 0.01 // Default 1% slippage
          };
          
          const result = await this.sonic.swap(params);
          return JSON.stringify(result, null, 2);
        } catch (error) {
          console.error('Error simulating Sonic swap:', error);
          return 'Error simulating token swap. Please try again later.';
        }
      }
    ),
  ];

  canHandle(message: Message): boolean {
    return message.content.toLowerCase().includes('sonic') ||
           message.content.toLowerCase().includes('pool') ||
           message.content.toLowerCase().includes('swap') ||
           message.content.toLowerCase().includes('liquidity') ||
           false;
  }
}