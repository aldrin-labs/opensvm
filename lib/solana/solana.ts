/**
 * Solana blockchain integration library
 * 
 * This module provides core functionality for interacting with the Solana blockchain,
 * including account management, transaction parsing, and data retrieval.
 * 
 * @see docs/architecture/system-overview.md#blockchain-integration-layer
 * @see docs/architecture/adr/001-vector-database-selection.md
 * @see docs/architecture/components.md#data-layer
 */

import {
  PublicKey,
  ParsedTransactionWithMeta,
  AccountInfo as SolanaAccountInfo,
  VersionedBlockResponse
} from '@solana/web3.js';
// Note: Connection, AccountMeta, ParsedMessageAccount, BlockResponse, ParsedInstruction, PartiallyDecodedInstruction removed as they're not currently used
// Import server-side connection for API routes
import { getConnection as getProxyConnection } from './solana-connection-server';

// Type definitions
export type AccountData = {
  lamports: number;
  owner: string;
  executable: boolean;
  tokenAccounts: Array<TokenAccount>;
  isSystemProgram: boolean;
};

export type TokenAccount = {
  mint: string;
  owner: string;
  amount: number;
  decimals: number;
  uiAmount: number;
  symbol?: string;
  icon?: string;
  usdValue?: number;
  address?: string;
  name?: string;
  txCount?: number;
  volume?: number;
  isLoading?: boolean;
};

export type TokenInfo = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  totalSupply: number;
  owner: string;
  frozen: boolean;
  mintAuthority?: string;
  freezeAuthority?: string;
};

export type Transaction = {
  signature: string;
  type: 'Success' | 'Failed';
  timestamp: number | null;
};

export type BlockDetails = {
  slot: number;
  blockhash: string;
  parentSlot: number;
  blockTime: number | null;
  previousBlockhash: string;
  timestamp: number;
  transactions: Transaction[];
  transactionCount: number;
  successCount: number;
  failureCount: number;
  totalSolVolume: number;
  totalFees: number;
  rewards: {
    pubkey: string;
    lamports: number;
    postBalance: number;
    rewardType: string;
  }[];
  programs: {
    address: string;
    count: number;
    name?: string;
  }[];
  blockTimeDelta?: number;
  tokenTransfers: {
    mint: string;
    symbol?: string;
    amount: number;
  }[];
};

export type NetworkStats = {
  tps: number;
  successRate: number;
  blockTime: number;
  slot: number;
};

export type BaseTransactionInfo = {
  signature: string;
  timestamp: number;
  slot: number;
  success: boolean;
  type: 'sol' | 'token' | 'unknown';
  amount?: number;
  symbol?: string;
  mint?: string;
};

export type ParsedInstructionWithAccounts = {
  program: string;
  programId: string;
  parsed: any;
  accounts: number[];
  data: string;
  computeUnits?: number;
  computeUnitsConsumed?: number;
};

export type PartiallyDecodedInstructionWithAccounts = {
  programId: string;
  accounts: number[];
  data: string;
  computeUnits?: number;
  computeUnitsConsumed?: number;
};

export type InstructionWithAccounts = ParsedInstructionWithAccounts | PartiallyDecodedInstructionWithAccounts;

export type InnerInstructions = {
  index: number;
  instructions: InstructionWithAccounts[];
};

export type DetailedTransactionInfo = BaseTransactionInfo & {
  transaction?: {
    message: {
      accountKeys: any[];
      instructions: any[];
    };
  };
  meta?: {
    err: any;
    fee: number;
    preBalances: number[];
    postBalances: number[];
    preTokenBalances?: any[];
    postTokenBalances?: any[];
    logMessages?: string[];
    innerInstructions?: any[];
  };
  blockTime?: number;
  details?: {
    instructions: InstructionWithAccounts[];
    accounts: {
      pubkey: string;
      signer: boolean;
      writable: boolean;
    }[];
    preBalances: number[];
    postBalances: number[];
    preTokenBalances?: any[];
    postTokenBalances?: any[];
    logs?: string[];
    innerInstructions?: InnerInstructions[];
    tokenChanges?: {
      mint: string;
      preAmount: number;
      postAmount: number;
      change: number;
    }[];
    solChanges?: {
      accountIndex: number;
      preBalance: number;
      postBalance: number;
      change: number;
    }[];
  };
  relatedTransactions?: any[];
};

export function validateSolanaAddress(address: string): PublicKey {
  try {
    const pubkey = new PublicKey(address);
    // Remove isOnCurve check as it rejects valid PDAs and other off-curve addresses
    return pubkey;
  } catch (error) {
    throw new Error('Invalid Solana address');
  }
}

export async function getAccountInfo(address: string): Promise<SolanaAccountInfo<Buffer> | null> {
  try {
    const connection = getProxyConnection();
    const pubkey = validateSolanaAddress(address);

    // Try each endpoint until one succeeds
    let lastError;
    for (let i = 0; i < 3; i++) {
      try {
        const accountInfo = await connection.getAccountInfo(pubkey);
        return accountInfo;
      } catch (error) {
        console.warn(`Attempt ${i + 1} failed:`, error);
        lastError = error;
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw lastError;
  } catch (error) {
    console.error('Error fetching account info:', error);
    throw new Error('Failed to fetch account info');
  }
}

export async function getNetworkStats(): Promise<NetworkStats> {
  try {
    const connection = getProxyConnection();
    const [currentSlot, performance] = await Promise.all([
      connection.getSlot(),
      connection.getRecentPerformanceSamples(1)
    ]);

    const sample = performance[0];
    if (!sample) {
      throw new Error('No performance sample available');
    }

    // Calculate TPS from total transactions in the sample period
    const tps = sample.numTransactions / sample.samplePeriodSecs;

    // Assume 100% success rate since we don't have failed transaction count
    const successRate = 100;

    // Calculate average block time
    const blockTime = sample.samplePeriodSecs;

    return {
      tps,
      successRate,
      blockTime,
      slot: currentSlot
    };
  } catch (error) {
    console.error('Error fetching network stats:', error);
    return {
      tps: 0,
      successRate: 100,
      blockTime: 0.4,
      slot: 0
    };
  }
}

export async function getTokenInfo(mintAddress: string): Promise<TokenInfo> {
  try {
    const connection = getProxyConnection();
    const pubkey = validateSolanaAddress(mintAddress);

    const accountInfo = await connection.getAccountInfo(pubkey);
    if (!accountInfo) {
      throw new Error('Token not found');
    }

    // Parse mint data
    const data = accountInfo.data;
    const mintAuthority = data.slice(0, 32);
    const supply = data.slice(36, 44);
    const decimals = data[44];
    const freezeAuthority = data.slice(46, 78);

    return {
      address: mintAddress,
      symbol: '', // Would need token registry integration for these
      name: '',
      decimals: decimals,
      totalSupply: Number(supply.readBigUInt64LE(0)),
      owner: accountInfo.owner.toString(),
      frozen: false,
      mintAuthority: new PublicKey(mintAuthority).toString(),
      freezeAuthority: new PublicKey(freezeAuthority).toString()
    };
  } catch (error) {
    console.error('Error fetching token info:', error);
    throw new Error('Failed to fetch token info');
  }
}

export async function getBlockDetails(slot: number): Promise<BlockDetails> {
  console.log(`Fetching block details for slot ${slot}`);
  let connection;
  try {
    connection = getProxyConnection();
    const currentSlot = await connection.getSlot();
    console.log(`Current slot: ${currentSlot}`);

    if (slot < currentSlot - 500000) {
      console.log(`Requested slot ${slot} is too old, using more recent slot`);
      slot = currentSlot - 10;
    }

    console.log(`Fetching block for slot ${slot}`);
    const block = await connection.getBlock(slot, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed'
    });

    if (!block) {
      throw new Error(`Block not found for slot ${slot}`);
    }

    const blockResponse = block as VersionedBlockResponse;

    const blockTime = blockResponse.blockTime || null;
    let totalSolVolume = 0;
    let totalFees = 0;
    const programCounts = new Map<string, number>();
    const tokenTransfers = new Map<string, number>();

    const transactions = (blockResponse.transactions || []).map(tx => {
      // Process program invocations
      if (tx.meta?.logMessages) {
        const programInvokes = tx.meta.logMessages
          .filter(log => log.includes('Program') && log.includes('invoke'))
          .map(log => {
            const match = log.match(/Program (\w+) invoke/);
            return match?.[1];
          })
          .filter((address): address is string => !!address);

        programInvokes.forEach(address => {
          programCounts.set(address, (programCounts.get(address) ?? 0) + 1);
        });

        // Process token transfers
        const tokenLogs = tx.meta.logMessages.filter(log =>
          log.includes('Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA invoke'));

        if (tokenLogs.length > 0) {
          tx.meta.logMessages
            .filter(log => log.includes('Transfer') && log.includes('tokens'))
            .forEach(log => {
              const match = log.match(/Transfer (\d+) tokens/);
              if (match) {
                const amount = parseInt(match[1]);
                const accountKeys = tx.transaction.message.getAccountKeys?.();
                const mintAddress = accountKeys?.get(1)?.toString();
                if (mintAddress) {
                  tokenTransfers.set(
                    mintAddress,
                    (tokenTransfers.get(mintAddress) ?? 0) + amount
                  );
                }
              }
            });
        }
      }

      // Process fees and balances
      if (tx.meta) {
        totalFees += tx.meta.fee ?? 0;
        tx.meta.preBalances?.forEach((pre, index) => {
          const post = tx.meta!.postBalances?.[index];
          if (post !== undefined && post < pre) {
            totalSolVolume += (pre - post);
          }
        });
      }

      // Return transaction with strict typing
      const transaction: Transaction = {
        signature: tx.transaction.signatures[0]?.toString() || '',
        type: tx.meta?.err ? 'Failed' : 'Success',
        timestamp: blockTime
      };

      return transaction;
    });

    const { successCount, failureCount } = transactions.reduce(
      (acc, tx) => ({
        successCount: acc.successCount + (tx.type === 'Success' ? 1 : 0),
        failureCount: acc.failureCount + (tx.type === 'Failed' ? 1 : 0)
      }),
      { successCount: 0, failureCount: 0 }
    );

    return {
      slot,
      blockhash: blockResponse.blockhash || '',
      parentSlot: blockResponse.parentSlot || slot - 1,
      blockTime,
      previousBlockhash: blockResponse.previousBlockhash || '',
      timestamp: blockTime ? blockTime * 1000 : Date.now(),
      transactions: transactions || [],
      transactionCount: transactions?.length || 0,
      successCount,
      failureCount,
      totalSolVolume: totalSolVolume / 1e9,
      totalFees: totalFees / 1e9,
      rewards: blockResponse.rewards?.map(reward => ({
        pubkey: reward.pubkey || '',
        lamports: reward.lamports || 0,
        postBalance: reward.postBalance || 0,
        rewardType: reward.rewardType || ''
      })) || [],
      programs: Array.from(programCounts.entries())
        .map(([address, count]) => ({
          address,
          count,
          name: undefined
        }))
        .sort((a, b) => b.count - a.count),
      tokenTransfers: Array.from(tokenTransfers.entries())
        .map(([mint, amount]) => ({
          mint,
          amount,
          symbol: undefined
        }))
        .sort((a, b) => b.amount - a.amount)
    };
  } catch (error: any) {
    console.error('Error in getBlockDetails:', {
      error: error.message || error,
      stack: error.stack,
      slot,
      endpoint: connection?.rpcEndpoint || 'unknown'
    });

    if (error.message?.includes('429') || error.message?.includes('Too many requests')) {
      throw new Error('Rate limit exceeded. Please try again in a few moments.');
    }
    if (error.message?.includes('skipped, or missing')) {
      throw new Error('Block not available. Try a more recent block number.');
    }
    if (error.message?.includes('block not available')) {
      throw new Error(`Block ${slot} is not available. The block may be too old or not yet confirmed.`);
    }
    if (error.message?.includes('failed to get')) {
      throw new Error(`Failed to fetch block ${slot}. The RPC node may be experiencing issues.`);
    }

    throw new Error(`Failed to fetch block details: ${error.message || 'Unknown error'}`);
  }
}

export async function getRPCLatency(): Promise<number> {
  try {
    const connection = getProxyConnection();
    const start = Date.now();
    await connection.getSlot();
    return Date.now() - start;
  } catch (error) {
    console.warn('Error measuring RPC latency:', error);
    return -1;
  }
}

export async function getTransactionDetails(signature: string): Promise<DetailedTransactionInfo> {
  try {
    const connection = getProxyConnection();
    const tx: ParsedTransactionWithMeta | null = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed'
    });

    if (!tx) {
      throw new Error('Transaction not found');
    }

    const timestamp = tx.blockTime ? new Date(tx.blockTime * 1000) : new Date();
    const success = tx.meta?.err === null;

    return {
      signature,
      timestamp: timestamp.getTime(),
      slot: tx.slot,
      success,
      type: 'unknown',
      details: {
        instructions: [],
        accounts: [],
        preBalances: tx.meta?.preBalances || [],
        postBalances: tx.meta?.postBalances || [],
        preTokenBalances: tx.meta?.preTokenBalances || [],
        postTokenBalances: tx.meta?.postTokenBalances || [],
        logs: tx.meta?.logMessages || [],
        innerInstructions: []
      }
    };
  } catch (error) {
    console.error('Error fetching transaction details:', error);
    throw new Error('Failed to fetch transaction details');
  }
}

// Get recent transactions for a given address
export async function getRecentTransactions(address: string, limit: number = 100): Promise<{
  signature: string;
  timestamp: string;
  from: string;
  to: string;
  amount: number;
  tokenSymbol?: string;
  type: string;
  status: 'success' | 'failed';
}[]> {
  try {
    const connection = getProxyConnection();
    const publicKey = new PublicKey(address);

    // Get signatures for the address
    const signatures = await connection.getSignaturesForAddress(publicKey, {
      limit: Math.min(limit, 1000) // Solana RPC limit
    });

    // Fetch transaction details for each signature
    const transactions = await Promise.all(
      signatures.slice(0, limit).map(async (sig) => {
        try {
          const tx: ParsedTransactionWithMeta | null = await connection.getParsedTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed'
          });

          if (!tx || !tx.meta) {
            return null;
          }

          const timestamp = new Date((sig.blockTime || Date.now() / 1000) * 1000).toISOString();
          const status: 'success' | 'failed' = tx.meta.err === null ? 'success' : 'failed';

          // Parse transaction for transfer details
          let from = '';
          let to = '';
          let amount = 0;
          let tokenSymbol = 'SOL';
          let type = 'transfer';

          // Check for SOL transfers in pre/post balances
          const accountKeys = tx.transaction.message.accountKeys || [];
          if (tx.meta.preBalances && tx.meta.postBalances) {
            for (let i = 0; i < accountKeys.length; i++) {
              const preBalance = tx.meta.preBalances[i] || 0;
              const postBalance = tx.meta.postBalances[i] || 0;
              const balanceChange = postBalance - preBalance;

              if (Math.abs(balanceChange) > 0) {
                const accountAddress = accountKeys[i]?.pubkey?.toString() || '';

                if (balanceChange < 0) {
                  // This account sent SOL
                  from = accountAddress;
                  amount = Math.abs(balanceChange) / 1e9;
                } else if (balanceChange > 0 && accountAddress === address) {
                  // This account received SOL
                  to = accountAddress;
                  if (amount === 0) amount = balanceChange / 1e9;
                }
              }
            }
          }

          // Check for token transfers in instructions
          const instructions = tx.transaction.message.instructions || [];
          for (const instruction of instructions) {
            if ('parsed' in instruction && instruction.parsed?.type === 'transfer') {
              const info = instruction.parsed.info;
              if (info) {
                from = info.source || from;
                to = info.destination || to;
                amount = parseFloat(info.amount || '0') / 1e9;
                type = 'transfer';
              }
            } else if ('parsed' in instruction && instruction.parsed?.type === 'transferChecked') {
              const info = instruction.parsed.info;
              if (info) {
                from = info.source || from;
                to = info.destination || to;
                amount = parseFloat(info.tokenAmount?.amount || '0') / Math.pow(10, info.tokenAmount?.decimals || 9);
                tokenSymbol = info.mint ? 'TOKEN' : tokenSymbol;
                type = 'transfer';
              }
            }
          }

          // If we still don't have from/to, use first and last account keys as fallbacks
          if (!from && accountKeys.length > 0) {
            from = accountKeys[0]?.pubkey?.toString() || '';
          }
          if (!to && accountKeys.length > 1) {
            to = accountKeys[accountKeys.length - 1]?.pubkey?.toString() || '';
          }

          // Determine transaction type based on address involvement
          if (from === address) {
            type = 'send';
          } else if (to === address) {
            type = 'receive';
          }

          return {
            signature: sig.signature,
            timestamp,
            from,
            to,
            amount,
            tokenSymbol,
            type,
            status
          };
        } catch (error) {
          console.warn(`Failed to parse transaction ${sig.signature}:`, error);
          return null;
        }
      })
    );

    // Filter out null transactions and return
    return transactions.filter((tx): tx is NonNullable<typeof tx> => tx !== null);
  } catch (error) {
    console.error('Error fetching recent transactions:', error);
    throw new Error(`Failed to fetch transactions for ${address}`);
  }
}
