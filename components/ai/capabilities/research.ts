import { PublicKey } from '@solana/web3.js';
import type { Message, ToolParams } from '../types';
import { BaseCapability } from './base';

export class ResearchCapability extends BaseCapability {
    type = 'research' as const;

    tools = [
        this.createToolExecutor(
            'subscribeProgramLogs',
            'Subscribes to program logs for a short duration and streams events',
            async ({ message, context }: ToolParams) => {
                const programId = this.extractAddress(message.content);
                if (!programId) throw new Error('No program address found in message');
                // Return an action hint to the UI actions layer
                return { actionName: 'logs_subscribe_program', params: { programId, commitment: 'confirmed', durationMs: 45000 } };
            }
        ),
        this.createToolExecutor(
            'subscribeBlocks',
            'Subscribes to block (slot) changes and streams slots for a short duration',
            async () => {
                return { actionName: 'block_subscribe', params: { durationMs: 30000 } };
            }
        ),
        this.createToolExecutor(
            'recentSignaturesForAddress',
            'Fetch recent signatures for an address (wallet or program)',
            async ({ message }: ToolParams) => {
                const address = this.extractAddress(message.content);
                if (!address) throw new Error('No address found in message');
                return this.executeWithConnection(async (connection) => {
                    const sigs = await connection.getSignaturesForAddress(new PublicKey(address), { limit: 20 });
                    return sigs.map(s => ({ signature: s.signature, slot: s.slot, err: s.err, blockTime: s.blockTime }));
                });
            }
        )
    ];

    canHandle(message: Message): boolean {
        const c = message.content.toLowerCase();
        return c.includes('research') || c.includes('monitor') || c.includes('subscribe') || this.extractAddress(message.content) !== null;
    }

    private extractAddress(content: string): string | null {
        const words = content.split(/\s|,|;|\n/);
        for (const word of words) {
            try { new PublicKey(word); return word; } catch { }
        }
        return null;
    }
}


