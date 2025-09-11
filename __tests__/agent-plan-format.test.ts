import { SolanaAgent } from '../lib/ai/core/agent';
import type { AgentCapability, Message } from '../lib/ai/types';

// Minimal mock capability that always returns a plan
const planningCapability: AgentCapability = {
    type: 'planning',
    tools: [{
        name: 'mockPlan',
        description: 'Returns a static plan',
        required: true,
        execute: async () => ({
            plan: [
                { tool: 'getEpochInfo', reason: 'Get epoch data' },
                { tool: 'getRecentPerformanceSamples', reason: 'Network performance window' }
            ]
        })
    }],
    canHandle: (_msg: Message) => true
};

const agent = new SolanaAgent({
    capabilities: [planningCapability],
    systemPrompt: 'system'
});

test('formats plan steps instead of [object Object]', async () => {
    const response = await agent.processMessage({ role: 'user', content: 'plan please' });
    expect(response.content).toMatch(/Execution Plan/);
    expect(response.content).toMatch(/getEpochInfo/);
    expect(response.content).not.toMatch(/\[object Object\]/);
});
