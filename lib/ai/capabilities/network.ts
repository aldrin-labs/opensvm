import type { Message } from '../types';
import { BaseCapability } from './base';
import type { VoteAccountStatus, PerfSample } from '@solana/web3.js';
import { NETWORK_PERFORMANCE_KNOWLEDGE } from '../core/knowledge';

export class NetworkCapability extends BaseCapability {
  type = 'network' as const;

  private readonly NETWORK_TERMS = ['network', 'tps', 'transactions per second', 'validator', 'performance', 'block time'];

  tools = [
    {
      ...this.createToolExecutor(
        'getNetworkStatus',
        'Fetches current network status and performance metrics',
        async () => {
          return this.executeWithConnection(async (connection) => {
            const slot = await connection.getSlot();
            const [blockTime, performance] = await Promise.all([
              connection.getBlockTime(slot),
              connection.getRecentPerformanceSamples(1)
            ]);

            return {
              currentSlot: slot,
              blockTime,
              performance: performance.length > 0 ? performance[0] : null
            };
          });
        }
      ),
      matches: (message: Message) => message.content.toLowerCase().includes('status')
    },
    {
      ...this.createToolExecutor(
        'getValidatorInfo',
        'Fetches information about network validators',
        async () => {
          return this.executeWithConnection(async (connection) => {
            const validators = (await connection.getVoteAccounts()) as VoteAccountStatus;
            const currentValidators = validators?.current ?? [];
            const delinquentValidators = validators?.delinquent ?? [];
            
            return {
              current: currentValidators.length,
              delinquent: delinquentValidators.length,
              totalActive: currentValidators.length,
              topValidators: currentValidators
                .sort((a, b) => (b.activatedStake ?? 0) - (a.activatedStake ?? 0))
                .slice(0, 5)
                .map(v => ({
                  votePubkey: v.votePubkey ?? '',
                  stake: v.activatedStake ?? 0,
                  commission: v.commission ?? 0
                }))
            };
          });
        }
      ),
      matches: (message: Message) => message.content.toLowerCase().includes('validator')
    },
    {
      ...this.createToolExecutor(
        'analyzeNetworkLoad',
        'Analyzes current network load and performance',
        async () => {
          return this.executeWithConnection(async (connection) => {
            const samples = await connection.getRecentPerformanceSamples(60);
            
            if (!Array.isArray(samples) || samples.length === 0) {
              return {
                message: 'Unable to retrieve network performance data.'
              };
            }

            // Filter out any samples that don't have the required properties
            const validSamples = samples.filter((sample): sample is PerfSample => 
              sample !== null &&
              typeof sample === 'object' &&
              'numTransactions' in sample &&
              'samplePeriodSecs' in sample &&
              'slot' in sample &&
              'numSlots' in sample &&
              typeof sample.numTransactions === 'number' && 
              typeof sample.samplePeriodSecs === 'number' &&
              sample.samplePeriodSecs > 0
            );

            if (validSamples.length === 0) {
              return {
                message: 'No valid performance samples available.'
              };
            }

            const avgTps = validSamples.reduce((acc, sample) => 
              acc + (sample.numTransactions / sample.samplePeriodSecs), 0
            ) / validSamples.length;

            const maxTps = Math.max(...validSamples.map(
              sample => sample.numTransactions / sample.samplePeriodSecs
            ));

            const networkLoad = this.calculateNetworkLoad(avgTps);
            const tpsRange = this.getTpsRange(avgTps);
            const loadDescription = NETWORK_PERFORMANCE_KNOWLEDGE.networkLoad.ranges[networkLoad];

            return {
              averageTps: Math.round(avgTps),
              maxTps: Math.round(maxTps),
              load: networkLoad,
              loadDescription,
              tpsRange,
              message: `Current TPS is ${Math.round(avgTps)} (${tpsRange}). Network load is ${networkLoad} (${loadDescription}).`
            };
          });
        }
      ),
      matches: (message: Message) => {
        const content = message.content.toLowerCase();
        return content.includes('tps') || 
               content.includes('transactions per second') ||
               content.includes('performance') ||
               content.includes('network load');
      },
      required: true // Always include this tool for network-related queries
    }
  ];

  canHandle(message: Message): boolean {
    const content = message.content.toLowerCase();
    return this.NETWORK_TERMS.some(term => content.includes(term));
  }

  private calculateNetworkLoad(tps: number): keyof typeof NETWORK_PERFORMANCE_KNOWLEDGE.networkLoad.ranges {
    const maxTps = 3000; // Theoretical max TPS
    const loadPercentage = (tps / maxTps) * 100;

    if (loadPercentage < 30) return 'light';
    if (loadPercentage < 60) return 'moderate';
    if (loadPercentage < 80) return 'heavy';
    return 'congested';
  }

  private getTpsRange(tps: number): string {
    if (tps < 500) return NETWORK_PERFORMANCE_KNOWLEDGE.tps.ranges.low;
    if (tps < 1500) return NETWORK_PERFORMANCE_KNOWLEDGE.tps.ranges.moderate;
    if (tps < 3000) return NETWORK_PERFORMANCE_KNOWLEDGE.tps.ranges.high;
    return NETWORK_PERFORMANCE_KNOWLEDGE.tps.ranges.veryHigh;
  }
}
