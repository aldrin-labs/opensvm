import { Connection } from '@solana/web3.js';
import { BaseCapability } from './base';
import type { Message, CapabilityType, ToolParams } from '../types';

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
                    // Fast path for greetings / very short inputs
                    // Fast path for greetings / very short inputs
                    if (/^(hi|hello|hey|yo|gm|hi there)$/i.test(trimmed)) {
                        return { role: 'assistant', content: 'Hi! Paste a transaction signature, an account address, or ask about TPS / validators / balances. How can I help?' };
                    }
                    try {
                        const res = await fetch('/api/getAnswer', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ question: trimmed, sources: [] })
                        });

                        // The getAnswer route now returns JSON responses
                        const json = await res.json();
                        // Ensure 'text' is always a string, especially if 'error' is an object
                        let text: string;
                        if (typeof json.message === 'string') {
                            text = json.message;
                        } else if (typeof json.error === 'string') {
                            text = json.error;
                        } else if (typeof json.error === 'object' && json.error !== null) {
                            // Stringify error objects to prevent "[object Object]" display
                            text = `Error details: ${JSON.stringify(json.error)}`;
                        } else {
                            text = 'No content generated.';
                        }
                        const processedText = this.postProcessResponse(text.trim());
                        return { role: 'assistant', content: processedText || 'No content generated.' };
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
    postProcessResponse(text: string): string {
        if (!text) return text;

        // Check if the ENTIRE response is a bare JSON array of tool plans (this is unwanted)
        try {
            const trimmed = text.trim();
            // Only process if it's ONLY a JSON array with no other content
            if (trimmed.startsWith('[') && trimmed.endsWith(']') && !trimmed.includes('```') && !trimmed.includes('curl')) {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(item =>
                    item && typeof item === 'object' && item.tool && typeof item.tool === 'string'
                )) {
                    // This is likely an unwanted bare tool execution plan
                    const toolCount = parsed.length;
                    const toolNames = parsed.map((item: any) => item.tool).join(', ');

                    return `I've identified ${toolCount} step${toolCount !== 1 ? 's' : ''} to analyze this request: ${toolNames}. However, the tool execution system is currently not functioning properly. The system should execute these tools and provide you with a comprehensive analysis, but it's only returning the execution plan instead of the results.

This appears to be a backend configuration issue where the AI planning system is working correctly, but the tool execution and result synthesis components are not functioning as expected.`;
                }
            }
        } catch (e) {
            // Not JSON or parsing failed, continue with other processing
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
    canHandle(_message: Message): boolean {
        // Always return true so this serves as a fallback capability. Specialized
        // capabilities earlier in the list will short-circuit first if they match.
        return true;
    }
}
