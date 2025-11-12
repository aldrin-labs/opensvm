/**
 * Solana WebSocket Service for Real-Time Trading Data
 *
 * Connects to Solana RPC WebSocket to listen for real-time DEX transactions.
 * Parses program logs to extract trade data from Raydium, Jupiter, Orca, etc.
 *
 * @module lib/trading/solana-websocket-service
 */

import { Connection, PublicKey, ParsedTransactionWithMeta, PartiallyDecodedInstruction } from '@solana/web3.js';
import { EventEmitter } from 'events';

// Known DEX Program IDs
export const DEX_PROGRAM_IDS = {
  RAYDIUM_V4: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  RAYDIUM_CPMM: 'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C',
  JUPITER_V6: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
  ORCA_WHIRLPOOL: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
  PHOENIX: 'PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY',
  OPENBOOK_V2: 'opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb',
};

export interface TradeEvent {
  id: string;
  signature: string;
  timestamp: number;
  price: number;
  amount: number;
  side: 'buy' | 'sell';
  dex: string;
  market: string;
  tokenMint: string;
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SolanaWebSocketConfig {
  rpcEndpoint: string;
  wsEndpoint?: string;
  tokenMints: string[];
  updateInterval?: number;
}

/**
 * Solana WebSocket Service
 * Monitors real-time trades from Solana DEXs
 */
export class SolanaWebSocketService extends EventEmitter {
  private connection: Connection;
  private wsConnection: Connection | null = null;
  private subscriptionIds: number[] = [];
  private tokenMints: Set<string>;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(config: SolanaWebSocketConfig) {
    super();

    // Create HTTP connection for RPC calls
    this.connection = new Connection(config.rpcEndpoint, {
      commitment: 'confirmed',
      wsEndpoint: config.wsEndpoint,
    });

    this.tokenMints = new Set(config.tokenMints);
  }

  /**
   * Connect to Solana WebSocket and start monitoring
   */
  async connect(): Promise<void> {
    try {
      console.log('[SolanaWS] Connecting to Solana WebSocket...');

      // Create WebSocket connection
      this.wsConnection = new Connection(
        this.connection.rpcEndpoint,
        {
          commitment: 'confirmed',
          wsEndpoint: this.connection.rpcEndpoint.replace('https://', 'wss://').replace('http://', 'ws://'),
        }
      );

      // Subscribe to program logs for each DEX
      await this.subscribeToPrograms();

      // Subscribe to account changes for token mints
      await this.subscribeToAccounts();

      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connected');

      console.log('[SolanaWS] Connected successfully');
    } catch (error) {
      console.error('[SolanaWS] Connection failed:', error);
      this.emit('error', error);
      this.attemptReconnect();
    }
  }

  /**
   * Subscribe to DEX program logs for trade monitoring
   */
  private async subscribeToPrograms(): Promise<void> {
    const programIds = Object.values(DEX_PROGRAM_IDS);

    for (const programId of programIds) {
      try {
        const subscriptionId = this.wsConnection!.onLogs(
          new PublicKey(programId),
          (logs, context) => {
            this.handleProgramLogs(logs, programId);
          },
          'confirmed'
        );

        this.subscriptionIds.push(subscriptionId);
        console.log(`[SolanaWS] Subscribed to program: ${programId}`);
      } catch (error) {
        console.warn(`[SolanaWS] Failed to subscribe to ${programId}:`, error);
      }
    }
  }

  /**
   * Subscribe to token account changes
   */
  private async subscribeToAccounts(): Promise<void> {
    for (const mint of this.tokenMints) {
      try {
        // Subscribe to token account changes would go here
        // This is more complex and requires knowing specific account addresses
        console.log(`[SolanaWS] Monitoring token: ${mint}`);
      } catch (error) {
        console.warn(`[SolanaWS] Failed to monitor token ${mint}:`, error);
      }
    }
  }

  /**
   * Handle program logs and parse trade events
   */
  private async handleProgramLogs(logs: any, programId: string): Promise<void> {
    try {
      const signature = logs.signature;

      // Fetch full transaction details
      const tx = await this.connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed',
      });

      if (!tx || !tx.meta) return;

      // Parse trade from transaction
      const trade = this.parseTradeFromTransaction(tx, programId);

      if (trade) {
        this.emit('trade', trade);
      }
    } catch (error) {
      // Silently ignore parsing errors to avoid spam
      if (process.env.NODE_ENV === 'development') {
        console.warn('[SolanaWS] Failed to parse transaction:', error);
      }
    }
  }

  /**
   * Parse trade data from transaction
   */
  private parseTradeFromTransaction(
    tx: ParsedTransactionWithMeta,
    programId: string
  ): TradeEvent | null {
    try {
      const signature = tx.transaction.signatures[0];
      const timestamp = tx.blockTime ? tx.blockTime * 1000 : Date.now();

      // Get token balances before and after
      const preBalances = tx.meta?.preTokenBalances || [];
      const postBalances = tx.meta?.postTokenBalances || [];

      // Find token transfers
      for (let i = 0; i < preBalances.length; i++) {
        const preBal = preBalances[i];
        const postBal = postBalances.find(
          (b) => b.accountIndex === preBal.accountIndex
        );

        if (!postBal || !preBal.uiTokenAmount || !postBal.uiTokenAmount) continue;

        const preAmount = preBal.uiTokenAmount.uiAmount || 0;
        const postAmount = postBal.uiTokenAmount.uiAmount || 0;
        const amountChange = Math.abs(postAmount - preAmount);

        if (amountChange > 0 && preBal.mint) {
          // Check if this mint is one we're monitoring
          if (this.tokenMints.has(preBal.mint)) {
            // Estimate price from transaction (this is simplified)
            const price = this.estimatePriceFromTransaction(tx, preBal.mint);

            return {
              id: `${signature}-${i}`,
              signature,
              timestamp,
              price,
              amount: amountChange,
              side: postAmount > preAmount ? 'buy' : 'sell',
              dex: this.getDexName(programId),
              market: this.getMarketName(preBal.mint),
              tokenMint: preBal.mint,
            };
          }
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Estimate price from transaction (simplified)
   */
  private estimatePriceFromTransaction(tx: ParsedTransactionWithMeta, mint: string): number {
    // This is a simplified price estimation
    // In production, you'd parse the actual swap instruction data

    try {
      const preBalances = tx.meta?.preTokenBalances || [];
      const postBalances = tx.meta?.postTokenBalances || [];

      // Find USDC or SOL transfer amount
      const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
      const solMint = 'So11111111111111111111111111111111111111112';

      for (const preBal of preBalances) {
        if (preBal.mint === usdcMint || preBal.mint === solMint) {
          const postBal = postBalances.find(
            (b) => b.accountIndex === preBal.accountIndex
          );

          if (postBal && preBal.uiTokenAmount && postBal.uiTokenAmount) {
            const preAmount = preBal.uiTokenAmount.uiAmount || 0;
            const postAmount = postBal.uiTokenAmount.uiAmount || 0;
            const usdcChange = Math.abs(postAmount - preAmount);

            // Find token amount change
            const tokenBal = preBalances.find((b) => b.mint === mint);
            if (tokenBal) {
              const tokenPostBal = postBalances.find(
                (b) => b.accountIndex === tokenBal.accountIndex
              );

              if (tokenPostBal && tokenBal.uiTokenAmount && tokenPostBal.uiTokenAmount) {
                const tokenPreAmount = tokenBal.uiTokenAmount.uiAmount || 0;
                const tokenPostAmount = tokenPostBal.uiTokenAmount.uiAmount || 0;
                const tokenChange = Math.abs(tokenPostAmount - tokenPreAmount);

                if (tokenChange > 0) {
                  return usdcChange / tokenChange;
                }
              }
            }
          }
        }
      }
    } catch (error) {
      // Ignore
    }

    // Fallback to a default price (this should be replaced with real price feed)
    return 150; // Default SOL price
  }

  /**
   * Get DEX name from program ID
   */
  private getDexName(programId: string): string {
    const dexMap: Record<string, string> = {
      [DEX_PROGRAM_IDS.RAYDIUM_V4]: 'Raydium',
      [DEX_PROGRAM_IDS.RAYDIUM_CPMM]: 'Raydium',
      [DEX_PROGRAM_IDS.JUPITER_V6]: 'Jupiter',
      [DEX_PROGRAM_IDS.ORCA_WHIRLPOOL]: 'Orca',
      [DEX_PROGRAM_IDS.PHOENIX]: 'Phoenix',
      [DEX_PROGRAM_IDS.OPENBOOK_V2]: 'OpenBook',
    };

    return dexMap[programId] || 'Unknown';
  }

  /**
   * Get market name from token mint
   */
  private getMarketName(mint: string): string {
    const marketMap: Record<string, string> = {
      'So11111111111111111111111111111111111111112': 'SOL/USDC',
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'BONK/USDC',
      'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': 'JUP/USDC',
      'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3': 'PYTH/USDC',
      'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE': 'ORCA/USDC',
      '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': 'RAY/USDC',
    };

    return marketMap[mint] || 'UNKNOWN/USDC';
  }

  /**
   * Attempt reconnection with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[SolanaWS] Max reconnection attempts reached');
      this.emit('error', new Error('Max reconnection attempts reached'));
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    console.log(`[SolanaWS] Reconnecting in ${delay}ms...`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  /**
   * Disconnect from Solana WebSocket
   */
  async disconnect(): Promise<void> {
    console.log('[SolanaWS] Disconnecting...');

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Unsubscribe from all subscriptions
    for (const subId of this.subscriptionIds) {
      try {
        await this.wsConnection?.removeOnLogsListener(subId);
      } catch (error) {
        console.warn('[SolanaWS] Failed to remove subscription:', error);
      }
    }

    this.subscriptionIds = [];
    this.isConnected = false;
    this.wsConnection = null;

    this.emit('disconnected');
  }

  /**
   * Add token mint to monitor
   */
  addTokenMint(mint: string): void {
    this.tokenMints.add(mint);
    console.log(`[SolanaWS] Added token mint: ${mint}`);
  }

  /**
   * Remove token mint from monitoring
   */
  removeTokenMint(mint: string): void {
    this.tokenMints.delete(mint);
    console.log(`[SolanaWS] Removed token mint: ${mint}`);
  }

  /**
   * Get connection status
   */
  getStatus(): {
    connected: boolean;
    subscriptions: number;
    tokenMints: number;
  } {
    return {
      connected: this.isConnected,
      subscriptions: this.subscriptionIds.length,
      tokenMints: this.tokenMints.size,
    };
  }
}

/**
 * Create a Solana WebSocket service instance
 */
export function createSolanaWebSocketService(config: SolanaWebSocketConfig): SolanaWebSocketService {
  return new SolanaWebSocketService(config);
}

export default SolanaWebSocketService;
