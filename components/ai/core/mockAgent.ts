import type { AgentConfig, AgentContext, Message } from '../types';

// Minimal mock agent that returns deterministic responses and never hits the network.
export class MockSolanaAgent {
    private config: AgentConfig;
    private context: AgentContext;

    constructor(config: AgentConfig) {
        this.config = config;
        this.context = {
            messages: [
                {
                    role: 'system',
                    content: config.systemPrompt,
                },
            ],
        };
    }

    public getContext(): AgentContext {
        return this.context;
    }

    public clearContext() {
        this.context = {
            messages: [
                {
                    role: 'system',
                    content: this.config.systemPrompt,
                },
            ],
        };
    }

    private async delay(ms: number) {
        await new Promise((res) => setTimeout(res, ms));
    }

    async processMessage(message: Message): Promise<Message> {
        // Record in context
        this.context.messages.push(message);

        // Add a slightly longer delay to surface processing UI and allow cancel tests to act reliably
        await this.delay(1200);

        if (message.role === 'system') {
            // In mock mode, provide a simple plan note without ACTION tags so UI falls back to direct processing
            const plan: Message = {
                role: 'assistant',
                content: 'Plan (mock): respond deterministically without executing network actions.',
                metadata: { type: 'general', data: { planning: true, mock: true } as any },
            };
            this.context.messages.push(plan);
            return plan;
        }

        const content = (message.content || '').toLowerCase();

        // Deterministic branches for common prompts used in tests
        if (content.includes('tps') || content.includes('transactions per second') || content.includes('network load') || content.includes('analyze tps')) {
            const resp: Message = {
                role: 'assistant',
                content:
                    'Mock Network Metrics\n\n- TPS: ~5,500\n- Network load: moderate\n- Notes: Deterministic mock data for tests',
                metadata: {
                    type: 'network',
                    data: { tps: 5500, load: 'moderate', mock: true },
                },
            };
            this.context.messages.push(resp);
            return resp;
        }

        if (content.includes('explain this transaction') || content.includes('/tx')) {
            const resp: Message = {
                role: 'assistant',
                content:
                    'This transaction transfers SOL and updates an account (mock explanation).',
                metadata: { type: 'transaction', data: { mock: true } as any },
            };
            this.context.messages.push(resp);
            return resp;
        }

        if (content.includes('/help')) {
            const resp: Message = {
                role: 'assistant',
                content:
                    'Try /tps for performance, /tx <sig> to explain a transaction, /wallet <address> for wallet summary.',
                metadata: { type: 'general', data: { mock: true } as any },
            };
            this.context.messages.push(resp);
            return resp;
        }

        if (content.includes('/wallet') || content.includes('wallet summary') || content.includes('account info') || content.includes('token balances')) {
            const resp: Message = {
                role: 'assistant',
                content: 'Account info (mock)\n\n- address: 11111111111111111111111111111111\n- balance: 0.00 SOL\n- token balances: none',
                metadata: { type: 'account', data: { address: '11111111111111111111111111111111', balance: 0, tokens: [], mock: true } as any },
            };
            this.context.messages.push(resp);
            return resp;
        }

        if (content.includes('get transaction details') || content.includes('transaction details')) {
            const resp: Message = {
                role: 'assistant',
                content:
                    'Transaction details (mock): could not fetch transaction. Error: Invalid signature or unavailable in mock mode.',
                metadata: { type: 'transaction', data: { ok: false, reason: 'mock', mock: true } as any },
            };
            this.context.messages.push(resp);
            return resp;
        }

        if (content.includes('research program') || content.includes('program')) {
            const resp: Message = {
                role: 'assistant',
                content: 'Program research (mock)\n\nprogramId: 11111111111111111111111111111111\naccounts: 0\nrecent signature: 3xMockSignature111',
                metadata: { type: 'general', data: { accounts: 0, signatures: ['3xMockSignature111'], mock: true } as any },
            };
            this.context.messages.push(resp);
            return resp;
        }

        if (content.includes('subscribe to logs') || content.includes('logs subscription')) {
            const resp: Message = {
                role: 'assistant',
                content: 'Started logs subscription (mock). Logs subscription ended.',
                metadata: { type: 'general', data: { started: true, ended: true, mock: true } as any },
            };
            this.context.messages.push(resp);
            return resp;
        }

        // Default safe response
        const resp: Message = {
            role: 'assistant',
            content: "I'm a mock AI responding deterministically for tests.",
            metadata: { type: 'general', data: { mock: true } as any },
        };
        this.context.messages.push(resp);
        return resp;
    }
}
