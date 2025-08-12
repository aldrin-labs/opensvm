import type { Message, ToolParams, CapabilityType } from '../types';
import { ExecutionMode } from '../types';
import { BaseCapability } from './base';

export class TransactionCapability extends BaseCapability {
    type: CapabilityType = 'transaction';
    executionMode = ExecutionMode.Sequential;

    private readonly SIGNATURE_PATTERN = /[1-9A-HJ-NP-Za-km-z]{87,88}/;

    tools = [
        this.createToolExecutor(
            'fetchTransaction',
            'Fetches transaction details by signature',
            async ({ message }: ToolParams) => {
                const signature = this.extractSignature(message.content);
                if (!signature) throw new Error('No transaction signature found in message');

                return this.executeWithConnection(async (connection) => {
                    return connection.getTransaction(signature, {
                        maxSupportedTransactionVersion: 0
                    });
                });
            }
        )
    ];

    canHandle(message: Message): boolean {
        return message.content.toLowerCase().includes('transaction') || this.extractSignature(message.content) !== null;
    }

    private extractSignature(content: string | null): string | null {
        if (content === null) return null;
        const match = content.match(this.SIGNATURE_PATTERN);
        return match ? match[0] : null;
    }
}


