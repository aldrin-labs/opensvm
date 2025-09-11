import { PublicKey } from '@solana/web3.js';
import type { Message, ToolParams, CapabilityType } from '../types';
import { ExecutionMode } from '../types';
import { BaseCapability } from './base';

export class TransactionCapability extends BaseCapability {
  type: CapabilityType = 'transaction';
  executionMode = ExecutionMode.Sequential; // Transaction tools should run sequentially

  private readonly SIGNATURE_PATTERN = /[1-9A-HJ-NP-Za-km-z]{87,88}/;

  // Common Solana program IDs
  private static readonly TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
  private static readonly SYSTEM_PROGRAM_ID = '11111111111111111111111111111111';
  private static readonly ASSOCIATED_TOKEN_PROGRAM_ID = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';

  tools = [
    {
      name: 'fetchTransaction',
      description: 'Fetches transaction details by signature',
      matches: (message: Message) => this.extractSignature(message.content) !== null,
      execute: async ({ message }: ToolParams) => {
        const signature = this.extractSignature(message.content);
        if (!signature) throw new Error('No transaction signature found in message');
        
        return this.executeWithConnection(async (connection) => {
          return connection.getTransaction(signature, {
            maxSupportedTransactionVersion: 0,
          });
        });
      },
    },
    {
      name: 'analyzeTransaction',
      description: 'Analyzes transaction details for patterns and key information',
      dependencies: ['fetchTransaction'],
      execute: async ({ context }: ToolParams) => {
        const tx = context.activeAnalysis?.data;
        if (!tx) throw new Error('No transaction data available for analysis');

        return {
          type: this.classifyTransaction(tx),
          tokenTransfers: this.extractTokenTransfers(tx),
          programInteractions: this.extractProgramInteractions(tx),
          fees: tx.meta?.fee,
          status: tx.meta?.err ? 'failed' : 'success'
        };
      },
    }
  ];

  canHandle(message: Message): boolean {
    return message.content.toLowerCase().includes('transaction') ||
           this.extractSignature(message.content) !== null;
  }

  private extractSignature(content: string | null): string | null {
    if (content === null) return null;
    const match = content.match(this.SIGNATURE_PATTERN);
    return match ? match[0] : null;
  }

  private classifyTransaction(tx: any): string {
    // Attempt to classify transaction based on instructions and program interactions
    const instructions = tx.transaction.message.instructions;
    const programIds = new Set(instructions.map((ix: any) => ix.programId.toString()));

    if (programIds.has(TransactionCapability.TOKEN_PROGRAM_ID)) {
      // Check for specific token-related instructions
      const tokenInstructions = instructions.filter((ix: any) => 
        ix.programId.toString() === TransactionCapability.TOKEN_PROGRAM_ID
      );

      if (tokenInstructions.some((ix: any) => ix.parsed?.type === 'transfer')) {
        return 'token_transfer';
      }
    }

    if (programIds.has(TransactionCapability.SYSTEM_PROGRAM_ID)) {
      return 'system_transaction';
    }

    if (programIds.has(TransactionCapability.ASSOCIATED_TOKEN_PROGRAM_ID)) {
      return 'associated_token_account';
    }

    return 'unknown';
  }

  private extractTokenTransfers(tx: any): any[] {
    // Extract token transfers from the transaction
    const transfers: any[] = [];

    // Check pre and post token balances
    const preTokenBalances = tx.meta?.preTokenBalances || [];
    const postTokenBalances = tx.meta?.postTokenBalances || [];

    preTokenBalances.forEach((preBal: any) => {
      // Ensure the balance is for the token program
      if (preBal.programId !== TransactionCapability.TOKEN_PROGRAM_ID) return;

      const postBal = postTokenBalances.find((postBal: any) => 
        postBal.accountIndex === preBal.accountIndex && 
        postBal.mint === preBal.mint
      );

      if (postBal) {
        const preAmount = preBal.uiTokenAmount?.uiAmount || 0;
        const postAmount = postBal.uiTokenAmount?.uiAmount || 0;
        const change = postAmount - preAmount;

        if (change !== 0) {
          transfers.push({
            mint: preBal.mint,
            from: preBal.owner,
            to: postBal.owner,
            amount: Math.abs(change),
            direction: change > 0 ? 'IN' : 'OUT'
          });
        }
      }
    });

    return transfers;
  }

  private extractProgramInteractions(tx: any): string[] {
    return tx.transaction.message.accountKeys.map((key: PublicKey) => key.toString());
  }
}
