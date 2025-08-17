/**
 * Parser utility for extracting reasoning sections from assistant messages
 * Based on the reasoning format specification in docs/ai/reasoning-format.md
 */

export interface ParsedMessage {
    visible: string;
    reasoning?: {
        text: string;
        tokensEst: number;
    };
}

/**
 * Pure function to parse assistant message content into visible and reasoning sections
 * @param content Raw message content from assistant
 * @returns Parsed message with visible content and optional reasoning
 */
export function parseAssistantMessage(content: string): ParsedMessage {
    if (!content || typeof content !== 'string') {
        return { visible: content || '' };
    }

    // Look for <REASONING>...</REASONING> tags (handle nested tags properly)
    const startIndex = content.indexOf('<REASONING>');
    if (startIndex !== -1) {
        let depth = 0;
        let i = startIndex + '<REASONING>'.length;
        let endIndex = -1;

        // Find the matching closing tag, handling nested tags
        while (i < content.length) {
            if (content.slice(i, i + '<REASONING>'.length) === '<REASONING>') {
                depth++;
                i += '<REASONING>'.length;
            } else if (content.slice(i, i + '</REASONING>'.length) === '</REASONING>') {
                if (depth === 0) {
                    endIndex = i;
                    break;
                }
                depth--;
                i += '</REASONING>'.length;
            } else {
                i++;
            }
        }

        if (endIndex !== -1) {
            const reasoningContent = content.slice(startIndex + '<REASONING>'.length, endIndex);
            const reasoning = reasoningContent.trim();

            // Remove the entire reasoning block from content
            let visible = content.slice(0, startIndex) + content.slice(endIndex + '</REASONING>'.length);
            visible = visible.replace(/\n\s*\n\s*\n/g, '\n\n').trim();

            // Only return reasoning if it has actual content (not just whitespace)
            if (reasoning) {
                return {
                    visible: visible || 'No visible content provided.',
                    reasoning: {
                        text: reasoning,
                        tokensEst: estimateTokens(reasoning)
                    }
                };
            } else {
                // Empty reasoning block - remove it but don't include reasoning
                return { visible: visible };
            }
        }
    }

    // Fallback: Look for legacy **Reasoning:** ... **Answer:** format
    const legacyMatch = content.match(/^\*\*Reasoning:\*\*\s*(.*?)\s*\*\*Answer:\*\*\s*(.*?)$/s);

    if (legacyMatch) {
        const [, reasoningContent, answerContent] = legacyMatch;
        const reasoning = reasoningContent.trim();
        const visible = answerContent.trim();

        if (reasoning && visible) {
            return {
                visible,
                reasoning: {
                    text: reasoning,
                    tokensEst: estimateTokens(reasoning)
                }
            };
        }
    }

    // No delimiters found or malformed - treat entire content as visible
    return { visible: content.trim() };
}

/**
 * Check if a message contains reasoning delimiters
 * @param content Message content to check
 * @returns True if reasoning delimiters are present
 */
export function hasReasoning(content: string): boolean {
    if (!content || typeof content !== 'string') {
        return false;
    }

    return content.includes('<REASONING>') || content.includes('**Reasoning:**');
}

/**
 * Estimate token count for a text string
 * @param text Text to estimate tokens for
 * @returns Rough token count estimate
 */
export function estimateTokens(text: string): number {
    if (!text || typeof text !== 'string') {
        return 0;
    }

    // Simple approximation: 4 characters ≈ 1 token (matching test expectations)
    return Math.ceil(text.length / 4);
}
