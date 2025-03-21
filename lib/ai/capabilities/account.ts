import { PublicKey } from '@solana/web3.js';
import type { Message, ToolParams } from '../types';
import { BaseCapability } from './base';

export class AccountCapability extends BaseCapability {
  type = 'account' as const;

  tools = [
    this.createToolExecutor(
      'fetchAccountInfo',
      'Fetches account information and balance',
      async ({ message }: ToolParams) => {
        const address = this.extractAddress(message.content);
        if (!address) throw new Error('No account address found in message');

        return this.executeWithConnection(async (connection) => {
          const pubkey = new PublicKey(address);
          const [accountInfo, balance] = await Promise.all([
            connection.getAccountInfo(pubkey),
            connection.getBalance(pubkey)
          ]);

          return {
            address,
            balance,
            owner: accountInfo?.owner.toString(),
            executable: accountInfo?.executable,
            rentEpoch: accountInfo?.rentEpoch,
            data: accountInfo?.data
          };
        });
      }
    ),
    this.createToolExecutor(
      'analyzeAccountActivity',
      'Analyzes recent account activity and patterns',
      async ({ message }: ToolParams) => {
        const address = this.extractAddress(message.content);
        if (!address) throw new Error('No account address found in message');

        return this.executeWithConnection(async (connection) => {
          const signatures = await connection.getSignaturesForAddress(
            new PublicKey(address),
            { limit: 10 }
          );

          return {
            recentActivity: signatures.map(sig => ({
              signature: sig.signature,
              slot: sig.slot,
              err: sig.err,
              memo: sig.memo,
              blockTime: sig.blockTime
            })),
            activityPattern: this.analyzeActivityPattern(signatures)
          };
        });
      }
    ),
    this.createToolExecutor(
      'getTokenBalances',
      'Fetches token balances for an account',
      async ({ message }: ToolParams) => {
        const address = this.extractAddress(message.content);
        if (!address) throw new Error('No account address found in message');

        return this.executeWithConnection(async (connection) => {
          const tokens = await connection.getParsedTokenAccountsByOwner(
            new PublicKey(address),
            { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
          );

          return tokens.value.map(token => ({
            mint: token.account.data.parsed.info.mint,
            amount: token.account.data.parsed.info.tokenAmount.amount,
            decimals: token.account.data.parsed.info.tokenAmount.decimals
          }));
        });
      }
    )
  ];

  canHandle(message: Message): boolean {
    return message.content.toLowerCase().includes('account') ||
           this.extractAddress(message.content) !== null;
  }

  private extractAddress(content: string): string | null {
    const words = content.split(' ');
    return words.find(word => {
      try {
        new PublicKey(word);
        return true;
      } catch {
        return false;
      }
    }) || null;
  }

  private analyzeActivityPattern(signatures: any[]): string {
    if (signatures.length === 0) {
      return 'no recent activity';
    }

    // Sort signatures by blockTime
    const sortedSigs = [...signatures].sort((a, b) => 
      (b.blockTime || 0) - (a.blockTime || 0)
    );

    // Calculate time between transactions
    const timeDiffs = sortedSigs.slice(1).map((sig, i) => 
      ((sortedSigs[i].blockTime || 0) - (sig.blockTime || 0)) / 60 // Convert to minutes
    );

    // Calculate average time between transactions
    const avgTimeDiff = timeDiffs.reduce((sum, diff) => sum + diff, 0) / timeDiffs.length;

    // Count errors
    const errorCount = signatures.filter(sig => sig.err).length;

    // Determine pattern
    if (errorCount > signatures.length / 2) {
      return 'high error rate activity';
    } else if (avgTimeDiff < 5) {
      return 'frequent transactions';
    } else if (avgTimeDiff > 60) {
      return 'infrequent transactions';
    } else {
      return 'moderate activity';
    }
  }
}
