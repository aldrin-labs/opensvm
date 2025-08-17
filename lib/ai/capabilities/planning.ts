import { BaseCapability } from './base';
import type { CapabilityType, Message, ToolParams } from '../types';
import { Connection } from '@solana/web3.js';

/**
 * PlanningCapability
 * Uses LLM backend to convert a natural language user request into a structured plan:
 * [{ tool: string; reason: string; input?: string }]
 * Only emits tools that actually exist in the agent tool registry (validated upstream).
 */
export class PlanningCapability extends BaseCapability {
    type: CapabilityType = 'planning';

    constructor(connection: Connection) {
        super(connection);
    }

    tools = [
        this.createToolExecutor(
            'plan',
            'Generates an execution plan (list of tool invocations) for a user query',
            async ({ message }: ToolParams) => {
                const prompt = `You are a Solana analysis planning assistant. Convert the USER QUERY into a short JSON array of steps.
Each step: {"tool":"<exactToolName>","reason":"why this step","input":"optional adjusted input"}.
Return ONLY JSON. Known tool examples (partial list): analyzeNetworkLoad, getNetworkStatus, getValidatorInfo, getTransaction, getAccountInfo, getBalance, estimateTokenUsage, walletPathFind, analyzeEvent, getAnomalyAlerts, getAnomalyStats, generateAnswer.
Omit tools that are irrelevant. Prefer at most 3 steps.
USER QUERY: ${message.content}`;
                try {
                    const res = await fetch('/api/getAnswer', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ question: prompt, sources: [] })
                    });
                    const text = await res.text();
                    // Attempt to extract JSON
                    const jsonMatch = text.match(/\[.*\]/s);
                    if (jsonMatch) {
                        try {
                            const parsed = JSON.parse(jsonMatch[0]);
                            if (Array.isArray(parsed)) {
                                return { plan: parsed };
                            }
                        } catch { }
                    }
                    return { plan: [] };
                } catch (e) {
                    return { plan: [] };
                }
            }
        )
    ];

    canHandle(message: Message): boolean {
        // Always can attempt to plan user messages; agent decides when to use
        return message.role === 'user';
    }
}
