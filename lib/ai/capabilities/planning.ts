import { BaseCapability } from './base';
import type { CapabilityType, Message, ToolParams } from '../types';
import { Connection } from '@solana/web3.js';
import {
    ALL_API_METHODS,
    SOLANA_RPC_METHODS,
    OPENSVM_API_METHODS,
    INFORMATION_PATTERNS,
    findRelevantPatterns
} from '../core/api-knowledge';

/**
 * Enhanced PlanningCapability
 * Uses comprehensive API knowledge to convert user requests into optimal execution plans
 * Leverages both Solana RPC and OpenSVM API methods for intelligent planning
 */
export class PlanningCapability extends BaseCapability {
    type: CapabilityType = 'planning';

    constructor(connection: Connection) {
        super(connection);
    }

    tools = [
        {
            ...this.createToolExecutor(
                'plan',
                'Generates an execution plan using comprehensive Solana RPC and OpenSVM API knowledge',
                async ({ message }: ToolParams) => {
                    // First check for pre-defined information patterns
                    const relevantPatterns = findRelevantPatterns(message.content);

                    if (relevantPatterns.length > 0) {
                        // Use the most relevant pattern
                        const selectedPattern = relevantPatterns[0];
                        console.log(`Using information pattern: ${selectedPattern.name}`);
                        return {
                            plan: selectedPattern.apiSequence.map(step => ({
                                tool: step.method,
                                reason: step.reason,
                                input: step.input
                            }))
                        };
                    }

                    // Create a focused planning request for the server
                    // Server-side context already includes comprehensive Solana RPC knowledge
                    const planningRequest = `Create an execution plan for: ${message.content}

Return a JSON array of steps where each step has:
- "tool": exact API method name
- "reason": explanation for this step  
- "input": optional specific input

Focus on using appropriate Solana RPC and OpenSVM API methods. Return ONLY the JSON array.`;

                    try {
                        const res = await fetch('/api/getAnswer', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ question: planningRequest, sources: [] })
                        });
                        const text = await res.text();

                        // Attempt to extract JSON
                        const jsonMatch = text.match(/\[.*\]/s);
                        if (jsonMatch) {
                            try {
                                const parsed = JSON.parse(jsonMatch[0]);
                                if (Array.isArray(parsed)) {
                                    // Validate that all tools exist in our API registry
                                    const validatedPlan = this.validateAndFilterPlan(parsed);
                                    return { plan: validatedPlan };
                                }
                            } catch (e) {
                                console.warn('Failed to parse LLM response as JSON:', e);
                            }
                        }

                        // Fallback: generate basic plan based on query analysis
                        return { plan: this.generateFallbackPlan(message.content) };

                    } catch (e) {
                        console.error('Planning API call failed:', e);
                        return { plan: this.generateFallbackPlan(message.content) };
                    }
                }
            ),
            // Ensure the planner always runs when this capability is selected
            required: true,
            matches: () => true
        }
    ];

    canHandle(message: Message): boolean {
        if (message.role !== 'user') return false;

        const content = message.content.toLowerCase().trim();

        // Don't handle simple greetings or very short messages
        if (/^(hi|hello|hey|yo|gm|hi there|ok|yes|no|thanks|thank you)$/i.test(content)) {
            return false;
        }

        // Don't handle if it's clearly a random string without context
        if (content.length < 20 &&
            !content.includes(' ') &&
            !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(content) && // Not a valid base58 address
            !content.includes('get') &&
            !content.includes('find') &&
            !content.includes('show') &&
            !content.includes('analyze') &&
            !content.includes('check') &&
            !content.includes('fetch') &&
            !content.includes('list') &&
            !content.includes('transaction') &&
            !content.includes('account') &&
            !content.includes('balance') &&
            !content.includes('token') &&
            !content.includes('network') &&
            !content.includes('validator') &&
            !content.includes('block') &&
            !content.includes('epoch')) {
            return false;
        }

        // Handle explicit planning requests
        if (content.includes('plan') || content.includes('step') || content.includes('execute')) {
            return true;
        }

        // Handle analytical queries that benefit from planning
        const analyticalKeywords = [
            'analyze', 'analysis', 'investigate', 'research', 'explore',
            'compare', 'track', 'monitor', 'audit', 'inspect',
            'breakdown', 'summary', 'overview', 'report',
            'transaction', 'account', 'balance', 'token', 'transfer',
            'validator', 'network', 'performance', 'tps', 'epoch',
            'block', 'slot', 'program', 'defi', 'dex', 'swap'
        ];

        const hasAnalyticalKeywords = analyticalKeywords.some(keyword => content.includes(keyword));

        // Handle potential Solana addresses (but only if they look legitimate)
        const base58Pattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
        const isPotentialAddress = base58Pattern.test(content.replace(/\s+/g, ''));

        // Handle multi-step queries (questions with multiple parts)
        const hasMultipleQuestions = content.includes('?') && content.split('?').length > 2;
        const hasMultipleClauses = content.includes(' and ') || content.includes(' then ') || content.includes(' also ');

        return hasAnalyticalKeywords || isPotentialAddress || hasMultipleQuestions || hasMultipleClauses;
    }

    /**
     * Generate API context for LLM based on query content
     */
    private generateAPIContext(query: string): string {
        const queryLower = query.toLowerCase();
        let context = '';

        // Add relevant method details based on query content
        if (queryLower.includes('transaction') || queryLower.includes('tx')) {
            const txMethods = ALL_API_METHODS.filter(m => m.category === 'transaction');
            context += '\nTransaction Methods:\n' + txMethods.map(m =>
                `- ${m.name}: ${m.description}`
            ).join('\n');
        }

        if (queryLower.includes('account') || queryLower.includes('wallet') || queryLower.includes('balance')) {
            const accountMethods = ALL_API_METHODS.filter(m => m.category === 'account');
            context += '\nAccount Methods:\n' + accountMethods.map(m =>
                `- ${m.name}: ${m.description}`
            ).join('\n');
        }

        if (queryLower.includes('token')) {
            const tokenMethods = ALL_API_METHODS.filter(m => m.category === 'token');
            context += '\nToken Methods:\n' + tokenMethods.map(m =>
                `- ${m.name}: ${m.description}`
            ).join('\n');
        }

        if (queryLower.includes('network') || queryLower.includes('tps') || queryLower.includes('performance')) {
            const networkMethods = ALL_API_METHODS.filter(m => m.category === 'network');
            context += '\nNetwork Methods:\n' + networkMethods.map(m =>
                `- ${m.name}: ${m.description}`
            ).join('\n');
        }

        return context;
    }

    /**
     * Validate plan steps against available API methods
     */
    private validateAndFilterPlan(plan: any[]): Array<{ tool: string; reason: string; input?: string }> {
        const validatedPlan: Array<{ tool: string; reason: string; input?: string }> = [];

        for (const step of plan) {
            if (typeof step === 'object' && step.tool && step.reason) {
                // Check if the tool exists in our API registry
                const method = ALL_API_METHODS.find(m =>
                    m.name.toLowerCase() === step.tool.toLowerCase()
                );

                if (method) {
                    validatedPlan.push({
                        tool: method.name, // Use exact method name
                        reason: step.reason,
                        input: step.input
                    });
                } else {
                    console.warn(`Unknown API method in plan: ${step.tool}`);
                }
            }
        }

        return validatedPlan;
    }

    /**
     * Generate fallback plan when LLM planning fails
     */
    private generateFallbackPlan(query: string): Array<{ tool: string; reason: string; input?: string }> {
        const queryLower = query.toLowerCase();
        const plan: Array<{ tool: string; reason: string; input?: string }> = [];

        // Basic heuristics for common queries
        if (queryLower.includes('tps') || queryLower.includes('performance')) {
            plan.push({
                tool: 'getRecentPerformanceSamples',
                reason: 'Get network TPS and performance metrics'
            });
        }

        if (queryLower.includes('network')) {
            plan.push({
                tool: 'getEpochInfo',
                reason: 'Get current network status'
            });
        }

        if (queryLower.includes('transaction')) {
            plan.push({
                tool: 'getTransaction',
                reason: 'Get transaction details'
            });
        }

        if (queryLower.includes('balance') || queryLower.includes('account')) {
            plan.push({
                tool: 'getAccountInfo',
                reason: 'Get account information'
            });
            plan.push({
                tool: 'getBalance',
                reason: 'Get account balance'
            });
        }

        if (queryLower.includes('token')) {
            plan.push({
                tool: 'getTokenAccountsByOwner',
                reason: 'Get token holdings'
            });
        }

        // If no specific plan generated, provide general analysis
        if (plan.length === 0) {
            plan.push({
                tool: 'getEpochInfo',
                reason: 'Get current network status as starting point'
            });
        }

        return plan;
    }

    /**
     * Determines if this capability should handle the given message
     * Only handles queries that require analytical planning, not greetings or random strings
     */
    canHandle(message: Message): boolean {
        const content = message.content?.toLowerCase().trim() || '';

        // Skip empty or very short messages
        if (content.length < 3) return false;

        // Skip simple greetings and conversational phrases
        const greetings = ['hello', 'hi', 'hey', 'thanks', 'thank you', 'ok', 'okay', 'yes', 'no'];
        if (greetings.includes(content)) return false;

        // Skip random strings - check for lack of meaningful words
        const words = content.split(/\s+/);
        const meaningfulWords = words.filter(word =>
            word.length > 2 &&
            /^[a-zA-Z0-9]+$/.test(word) &&
            !(/^[a-z]{8,}$/.test(word) && !/[aeiou]/.test(word))
        );

        // If it's mostly meaningless characters or very few meaningful words, skip
        if (meaningfulWords.length < words.length * 0.5 && words.length > 1) return false;

        // Check for analytical keywords that suggest need for planning
        const analyticalKeywords = [
            'tps', 'performance', 'network', 'transaction', 'balance', 'account',
            'token', 'analyze', 'check', 'get', 'find', 'show', 'what', 'how',
            'when', 'where', 'why', 'status', 'info', 'data', 'current',
            'recent', 'latest', 'epoch', 'block', 'slot', 'validator'
        ];

        const hasAnalyticalKeywords = analyticalKeywords.some(keyword =>
            content.includes(keyword)
        );

        // Check for base58 addresses (potential Solana addresses)
        const base58Pattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
        const hasAddress = words.some(word => base58Pattern.test(word));

        // Check for multi-step request patterns
        const hasMultiStep = content.includes(' and ') || content.includes(' then ') || content.includes(',');

        // Accept if it has analytical keywords, addresses, or multi-step patterns
        return hasAnalyticalKeywords || hasAddress || hasMultiStep;
    }
}
