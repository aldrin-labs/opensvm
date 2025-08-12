import { PublicKey } from '@solana/web3.js';
import type { Message, ToolParams } from '../types';
import { BaseCapability } from './base';

export class AccountCapability extends BaseCapability {
    type = 'account' as const;

    tools = [
        {
            ...this.createToolExecutor(
                'fetchAccountInfo',
                'Fetches account information and SOL balance',
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
                            dataLen: accountInfo?.data?.length ?? 0
                        };
                    });
                }
            ),
            matches: (message: Message) => this.extractAddress(message.content) !== null
        },
        {
            ...this.createToolExecutor(
                'analyzeAccountActivity',
                'Analyzes recent account activity and patterns',
                async ({ message }: ToolParams) => {
                    const address = this.extractAddress(message.content);
                    if (!address) throw new Error('No account address found in message');

                    return this.executeWithConnection(async (connection) => {
                        const signatures = await connection.getSignaturesForAddress(
                            new PublicKey(address),
                            { limit: 20 }
                        );

                        return {
                            recentActivity: signatures.map(sig => ({
                                signature: sig.signature,
                                slot: sig.slot,
                                err: sig.err,
                                memo: sig.memo,
                                blockTime: sig.blockTime
                            })),
                            errorRate: signatures.filter(s => s.err).length / Math.max(1, signatures.length)
                        };
                    });
                }
            ),
            matches: (message: Message) => message.content.toLowerCase().includes('activity') || this.extractAddress(message.content) !== null
        },
        {
            ...this.createToolExecutor(
                'getTokenBalances',
                'Fetches SPL token balances for an account',
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
            ),
            matches: (message: Message) => message.content.toLowerCase().includes('token') || this.extractAddress(message.content) !== null
        }
    ];

    canHandle(message: Message): boolean {
        const content = message.content.toLowerCase();
        return content.includes('account') || this.extractAddress(message.content) !== null;
    }

    private extractAddress(content: string): string | null {
        const words = content.split(/\s|,|;|\n/);
        for (const word of words) {
            try {
                new PublicKey(word);
                return word;
            } catch {
                // continue
            }
        }
        return null;
    }
}


