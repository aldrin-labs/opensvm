import { Connection } from '@solana/web3.js';
import { BaseCapability } from './base';
import { ExecutionMode } from '../types';

export class SonicCapability extends BaseCapability {
  type = 'network';
  executionMode = ExecutionMode.Sequential;

  constructor(connection) {
    super(connection);
  }

  tools = [
    this.createToolExecutor(
      'getSonicStats',
      'Get statistics about Sonic protocol',
      async ({ message }) => {
        // This is a placeholder implementation
        return {
          totalLiquidity: '$124,500,000',
          dailyVolume: '$8,200,000',
          pools: 156,
          tokens: 87
        };
      }
    ),
    this.createToolExecutor(
      'getSonicPools',
      'Get information about Sonic liquidity pools',
      async ({ message }) => {
        // This is a placeholder implementation
        return {
          topPools: [
            { name: 'SOL-USDC', liquidity: '$42,300,000', volume24h: '$3,100,000' },
            { name: 'SOL-USDT', liquidity: '$28,700,000', volume24h: '$1,900,000' },
            { name: 'mSOL-SOL', liquidity: '$15,400,000', volume24h: '$900,000' }
          ]
        };
      }
    )
  ];

  canHandle(message) {
    return message.content.toLowerCase().includes('sonic') ||
           message.content.toLowerCase().includes('liquidity pool');
  }
}