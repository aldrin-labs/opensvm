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
                    if (/^(hi|hello|hey|yo|gm|hi there)$/i.test(trimmed)) {
                        return { message: 'Hi! Paste a transaction signature, an account address, or ask about TPS / validators / balances. How can I help?' };
                    }
                    try {
                        const res = await fetch('/api/getAnswer', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ question: trimmed, sources: [] })
                        });

                        // Streaming aggregation (route returns SSE-like data lines: data: {"text":"..."})
                        if (res.body) {
                            const reader = res.body.getReader();
                            const decoder = new TextDecoder();
                            let full = '';
                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) break;
                                const chunk = decoder.decode(value, { stream: true });
                                chunk.split(/\n/).forEach(line => {
                                    const trimmedLine = line.trim();
                                    if (trimmedLine.startsWith('data:')) {
                                        const jsonPart = trimmedLine.slice(5).trim();
                                        try {
                                            const payload = JSON.parse(jsonPart);
                                            if (payload.text) full += payload.text;
                                        } catch { /* ignore partial line parse errors */ }
                                    }
                                });
                            }
                            return { message: full.trim() || 'No content generated.' };
                        }

                        const text = await res.text();
                        return { message: text.trim() || 'No content generated.' };
                    } catch (e) {
                        return { message: 'Generation failed: ' + (e instanceof Error ? e.message : String(e)) };
                    }
                }
            ),
            // Ensure the tool is considered even if no keyword match logic
            required: true,
            matches: () => true
        }
    ];

    // Handle broad questions not clearly matched by other capabilities
    canHandle(_message: Message): boolean {
        // Always return true so this serves as a fallback capability. Specialized
        // capabilities earlier in the list will short-circuit first if they match.
        return true;
    }
}
