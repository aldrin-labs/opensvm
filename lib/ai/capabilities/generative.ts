import { Connection } from '@solana/web3.js';
import { BaseCapability } from './base';
import type { Message, CapabilityType, ToolParams } from '../types';
import { aiServiceClient } from '@/lib/ai/ai-service-client';

// Fallback / general LLM answer capability using server-side Together AI proxy (/api/getAnswer)
export class GenerativeCapability extends BaseCapability {
    type: CapabilityType = 'general';

    constructor() {
        // No blockchain connection required
        super(null as unknown as Connection);
    }

    tools = [
        {
            ...this.createToolExecutor(
                'generateAnswer',
                'Generates a natural language answer using the LLM backend',
                async ({ message }: ToolParams) => {
                    const trimmed = message.content.trim();
                    if (/^(hi|hello|hey|yo|gm|hi there)$/i.test(trimmed)) {
                        return { role: 'assistant', content: 'Hello! How can I help you today?' };
                    }
                    try {
                        // Use the AI service client with retry logic and circuit breaker
                        const result = await aiServiceClient.callAIService(
                            '/api/getAnswer',
                            { question: trimmed, sources: [] },
                            { timeout: 45000 } // 45 second timeout for complex queries
                        );

                        if (!result.success) {
                            // Return user-friendly error message
                            return { 
                                role: 'assistant', 
                                content: result.error || 'I encountered an error while processing your request. Please try again.' 
                            };
                        }

                        // Handle both text and JSON responses
                        const text = typeof result.data === 'string' 
                            ? result.data 
                            : result.data?.answer || 'No content generated.';
                        
                        const processed = this.postProcessResponse(text.trim());

                        if (typeof processed === 'object' && 'plan' in processed) {
                            return {
                                role: 'assistant',
                                content: `Executing plan...`,
                                metadata: {
                                    type: 'execution_plan',
                                    data: {
                                        plan: processed.plan
                                    }
                                }
                            };
                        }

                        return { role: 'assistant', content: processed || 'No content generated.' };
                    } catch (e) {
                        // Ensure error messages also conform to the Message interface, and are strings.
                        // Handle potential non-string error objects by stringifying them.
                        const errorMessage = e instanceof Error
                            ? e.message
                            : (typeof e === 'object' && e !== null ? JSON.stringify(e) : String(e));
                        return { role: 'assistant', content: `Generation failed: ${errorMessage}` };
                    }
                }
            ),
            // Ensure the tool is considered even if no keyword match logic
            required: true,
            matches: () => true
        }
    ];

    /**
     * Post-process AI response to handle unwanted plan objects while preserving legitimate content
     */
    postProcessResponse(text: string): string | { plan: any[] } {
        if (!text) return text;

        // Check if the ENTIRE response is a bare JSON array of tool plans
        try {
            const trimmed = text.trim();
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(item => item && typeof item === 'object' && item.tool && typeof item.tool === 'string')) {
                    // It's a plan, return it as an object
                    return { plan: parsed };
                }
            }
        } catch (e) {
            // Not a plan, continue
        }

        // Only handle obvious serialization issues, not legitimate structured content
        let processed = text;

        // Handle the specific case where the response contains "plan: [object Object]" (serialization error)
        if (processed.includes('plan: [object Object]')) {
            // This indicates the AI returned a plan object that wasn't properly serialized
            processed = processed.replace(/plan:\s*\[object Object\](?:,\s*\[object Object\])*/g,
                'The AI generated an execution plan but there was an issue displaying it. The system should execute the planned tools and return results, but the plan object serialization failed.');
        }

        // Only replace obvious object serialization errors, not legitimate content
        // Be more conservative - only replace if it's clearly a serialization issue
        if (processed.includes('plan: [object Object]') ||
            (processed.includes('[object Object]') && !processed.includes('curl') && !processed.includes('```'))) {

            processed = processed.replace(/plan:\s*\[object Object\](?:,\s*\[object Object\])*/g, (match) => {
                const objectCount = (match.match(/\[object Object\]/g) || []).length;
                return `📋 **Execution Plan** (${objectCount} step${objectCount !== 1 ? 's' : ''})`;
            });

            // Only replace isolated [object Object] references that aren't part of code examples
            processed = processed.replace(/(?<!\w)\[object Object\](?!\w)/g, '[Plan Step]');

            // Clean up any remaining formatting issues
            processed = processed.replace(/plan:\s*\[Plan Step\](?:,\s*\[Plan Step\])*/g, '📋 **Execution Plan**');
        }

        return processed;
    }

    // Handle broad questions not clearly matched by other capabilities
    canHandle(message: Message): boolean {
        if (message.role !== 'user') return false;

        const content = message.content.toLowerCase().trim();

        // Don't handle analytical/blockchain queries - let other capabilities handle those
        const analyticalKeywords = [
            'analyze', 'transaction', 'account', 'balance', 'validator',
            'network', 'block', 'epoch', 'program', 'defi', 'dex'
        ];

        if (analyticalKeywords.some(keyword => content.includes(keyword))) {
            return false;
        }

        // Handle simple greetings and conversational queries
        if (/^(hi|hello|hey|yo|gm|hi there|ok|yes|no|thanks|thank you|why|how|what|when|where|who)$/i.test(content)) {
            return true;
        }

        // Handle general questions and explanations
        if (content.includes('what is') ||
            content.includes('how to') ||
            content.includes('explain') ||
            content.includes('tell me') ||
            content.includes('can you') ||
            content.includes('example') ||
            content.includes('tutorial') ||
            content.includes('guide')) {
            return true;
        }

        // Handle short general queries that aren't blockchain-specific
        if (content.length < 20 && !content.includes(' ')) {
            // Check if it's NOT a blockchain address
            if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(content)) {
                return true;
            }
        }

        // Fallback for other conversational queries
        return true;
    }
}
