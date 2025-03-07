import { useSWRLike } from './useSWRLike';
import { getConnection, getRPCLatency } from '@/lib/solana';

export interface NetworkStats {
  epoch: number;
  epochProgress: number;
  blockHeight: number;
  activeValidators: number | null;
  tps: number;
  successRate: number;
}

export interface Block {
  slot: number;
  transactions?: {
    signature: string;
    type: 'Success' | 'Failed';
    timestamp: number | null;
  }[];
}

export interface NetworkData {
  timestamp: number;
  successRate: number;
  latency: number;
}

// Hook for fetching network stats
export function useNetworkStats(refreshInterval = 30000) {
  return useSWRLike<NetworkStats>(
    'network-stats',
    async () => {
      const connection = await getConnection();
      const latency = await getRPCLatency();
      
      // Get epoch info and other stats in parallel
      const [epochInfo, validators, perfSamples] = await Promise.all([
        connection.getEpochInfo(),
        connection.getVoteAccounts(),
        connection.getRecentPerformanceSamples(1)
      ]);
      
      const tps = perfSamples[0] ? Math.round(perfSamples[0].numTransactions / perfSamples[0].samplePeriodSecs) : 0;
      
      return {
        epoch: epochInfo.epoch,
        epochProgress: (epochInfo.slotIndex / epochInfo.slotsInEpoch) * 100,
        blockHeight: epochInfo.absoluteSlot,
        activeValidators: validators.current.length + validators.delinquent.length,
        tps,
        successRate: 100,
      };
    },
    { refreshInterval }
  );
}

// Hook for fetching recent blocks
export function useRecentBlocks(refreshInterval = 30000) {
  return useSWRLike<Block[]>(
    'recent-blocks',
    async () => {
      const connection = await getConnection();
      
      // Get current slot and blocks
      const slot = await connection.getSlot();
      const startSlot = Math.max(0, slot - 9);
      const slots = await connection.getBlocks(startSlot, slot);
      
      // Return block data
      return slots.map(slot => ({ slot }));
    },
    { refreshInterval }
  );
}

// Hook for fetching block details
export function useBlockDetails(blockSlot: number | null) {
  return useSWRLike<Block | null>(
    blockSlot ? `block-${blockSlot}` : null,
    async () => {
      if (!blockSlot) return null;
      
      const connection = await getConnection();
      const blockInfo = await connection.getBlock(blockSlot, {
        maxSupportedTransactionVersion: 0
      });
      
      if (!blockInfo) return null;
      
      return {
        slot: blockSlot,
        transactions: blockInfo.transactions.map(tx => {
          const signature = tx.transaction.signatures[0];
          if (!signature) {
            throw new Error('Transaction signature not found');
          }
          return {
            signature,
            type: tx.meta?.err ? 'Failed' : 'Success',
            timestamp: blockInfo.blockTime
          };
        })
      };
    }
  );
}

// Hook for fetching network performance data
export function useNetworkPerformance(maxDataPoints = 30, refreshInterval = 30000) {
  const { data: stats } = useNetworkStats(refreshInterval);
  
  return useSWRLike<NetworkData[]>(
    'network-performance',
    async () => {
      const latency = await getRPCLatency();
      
      return [{
        timestamp: Date.now(),
        successRate: stats?.successRate || 100,
        latency
      }];
    },
    {
      refreshInterval,
      initialData: [],
      onSuccess: (newDataPoint) => {
        // This will be handled by the mutate function to append to existing data
        // No return needed as onSuccess is defined to return void
      }
    }
  );
}