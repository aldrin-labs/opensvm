import { PublicKey } from '@solana/web3.js';
import type { Message, ToolParams } from '../types';
import { BaseCapability } from './base';

export class ProgramCapability extends BaseCapability {
    type = 'research' as const;

    tools = [
        this.createToolExecutor(
            'fetchProgramAccounts',
            'Fetches a summary of accounts owned by a program (sampled)',
            async ({ message }: ToolParams) => {
                const programId = this.extractAddress(message.content);
                if (!programId) throw new Error('No program address found in message');

                return this.executeWithConnection(async (connection) => {
                    const accounts = await connection.getProgramAccounts(new PublicKey(programId), {
                        dataSlice: { offset: 0, length: 0 }
                    });
                    const count = accounts.length;
                    const sample = accounts.slice(0, Math.min(10, accounts.length)).map(a => a.pubkey.toBase58());
                    return { programId, accounts: count, sample };
                });
            }
        ),
        this.createToolExecutor(
            'recentProgramSignatures',
            'Fetches recent signatures involving a program address (heuristic via getSignaturesForAddress)',
            async ({ message }: ToolParams) => {
                const programId = this.extractAddress(message.content);
                if (!programId) throw new Error('No program address found in message');

                return this.executeWithConnection(async (connection) => {
                    const sigs = await connection.getSignaturesForAddress(new PublicKey(programId), { limit: 20 });
                    return sigs.map(s => ({ signature: s.signature, slot: s.slot, err: s.err, blockTime: s.blockTime }));
                });
            }
        )
    ];

    canHandle(message: Message): boolean {
        const content = message.content.toLowerCase();
        return content.includes('program') || this.extractAddress(message.content) !== null;
    }

    private extractAddress(content: string): string | null {
        const words = content.split(/\s|,|;|\n/);
        for (const word of words) {
            try {
                new PublicKey(word);
                return word;
            } catch { }
        }
        return null;
    }
}


