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
    plan?: Array<{ tool: string; reason?: string; input?: string }>;
    final?: string;
}

/**
 * Pure function to parse assistant message content into visible, reasoning, plan, and final sections
 * @param content Raw message content from assistant
 * @returns Parsed message with visible content and optional reasoning, plan, and final answer
 */
export function parseAssistantMessage(content: string): ParsedMessage {
    if (!content || typeof content !== 'string') {
        return { visible: content || '' };
    }

    // Check if this is a simple text response without any structured elements
    // If it doesn't contain reasoning tags, plan markers, or object patterns, treat as plain text
    const hasStructuredElements =
        content.includes('<REASONING>') ||
        content.includes('</REASONING>') ||
        content.includes('&lt;REASONING&gt;') ||
        content.includes('&lt;/REASONING&gt;') ||
        content.includes('plan:') ||
        /(?:^|\n)(?:#+\s*)?(?:Plan|Action Plan|Execution Plan)(?:\s*:)?/im.test(content) ||
        /(?:^|\n)(?:#+\s*)?(?:Final Answer|Answer|Result|Conclusion)(?:\s*:)?/im.test(content);

    // For simple text responses (like from /api/getAnswer), return as-is
    if (!hasStructuredElements) {
        return { visible: content };
    }

    let parsedContent = content;
    let reasoning: { text: string; tokensEst: number } | undefined;
    let plan: Array<{ tool: string; reason?: string; input?: string }> | undefined;
    let final: string | undefined;

    // Extract and parse plan objects that appear as "plan: [object Object]"
    const planObjectMatch = parsedContent.match(/plan:\s*(\[object Object\](?:,\s*\[object Object\])*)/g);
    if (planObjectMatch) {
        // Replace the [object Object] with a helpful message since the actual plan data was lost
        parsedContent = parsedContent.replace(/plan:\s*(\[object Object\](?:,\s*\[object Object\])*)/g,
            'The AI generated an execution plan, but there was an issue with the response formatting. The system should have executed the planned tools and returned the results.');

        // Try to extract plan from the raw content if it contains JSON-like structures
        const jsonMatch = parsedContent.match(/\[{[^}]*"tool"[^}]*}[^\]]*\]/);
        if (jsonMatch) {
            try {
                const planArray = JSON.parse(jsonMatch[0]);
                if (Array.isArray(planArray)) {
                    plan = planArray;
                }
            } catch {
                // If JSON parsing fails, continue with the replacement message
                console.warn('Failed to parse plan JSON, using replacement message');
            }
        }
    }

    // Look for plan in various text formats
    if (!plan) {
        // Look for plan sections in markdown format
        const planSectionMatch = parsedContent.match(/(?:^|\n)(?:#+\s*)?(?:Plan|Action Plan|Execution Plan)(?:\s*:)?\s*\n((?:(?:\d+\.|\*|-)\s*[^\n]+\n?)+)/im);
        if (planSectionMatch) {
            const planText = planSectionMatch[1];
            const steps = planText.split(/\n(?=\d+\.|\*|-)/).filter(step => step.trim());
            plan = steps.map((step, idx) => {
                const cleanStep = step.replace(/^\d+\.|\*|-/, '').trim();
                return {
                    tool: `step_${idx + 1}`,
                    reason: cleanStep
                };
            });
            // Remove plan section from visible content
            parsedContent = parsedContent.replace(planSectionMatch[0], '').trim();
        }
    }

    // Extract final answer sections
    const finalMatch = parsedContent.match(/(?:^|\n)(?:#+\s*)?(?:Final Answer|Answer|Result|Conclusion)(?:\s*:)?\s*\n([\s\S]*?)(?=\n#+|\n\*\*|$)/im);
    if (finalMatch) {
        final = finalMatch[1].trim();
        // Remove final section from visible content
        parsedContent = parsedContent.replace(finalMatch[0], '').trim();
    }

    // Normalize any HTML-escaped reasoning delimiters to raw tags so parsing works
    if (
        parsedContent.includes('<REASONING>') ||
        parsedContent.includes('</REASONING>') ||
        parsedContent.includes('&lt;REASONING&gt;') ||
        parsedContent.includes('&lt;/REASONING&gt;')
    ) {
        // Normalize escaped tags (single or double-escaped) to raw delimiters
        parsedContent = parsedContent
            .replace(/&lt;REASONING&gt;/g, '<REASONING>')
            .replace(/&lt;\/REASONING&gt;/g, '</REASONING>')
            .replace(/<REASONING>/g, '<REASONING>')
            .replace(/<\/REASONING>/g, '</REASONING>');
    }

    // Look for <REASONING>...</REASONING> tags (handle nested tags properly)
    const startIndex = parsedContent.indexOf('<REASONING>');
    if (startIndex !== -1) {
        let depth = 0;
        let i = startIndex + '<REASONING>'.length;
        let endIndex = -1;

        // Find the matching closing tag, handling nested tags
        while (i < parsedContent.length) {
            if (parsedContent.slice(i, i + '<REASONING>'.length) === '<REASONING>') {
                depth++;
                i += '<REASONING>'.length;
            } else if (parsedContent.slice(i, i + '</REASONING>'.length) === '</REASONING>') {
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
            const reasoningContent = parsedContent.slice(startIndex + '<REASONING>'.length, endIndex);
            const reasoningText = reasoningContent.trim();

            // Remove the entire reasoning block from content
            let visible = parsedContent.slice(0, startIndex) + parsedContent.slice(endIndex + '</REASONING>'.length);
            visible = visible.replace(/\n\s*\n\s*\n/g, '\n\n').trim();

            // Only return reasoning if it has actual content (not just whitespace)
            if (reasoningText) {
                reasoning = {
                    text: reasoningText,
                    tokensEst: estimateTokens(reasoningText)
                };
            }

            parsedContent = visible;
        }
    }

    // Fallback: Look for legacy **Reasoning:** ... **Answer:** format
    const legacyMatch = parsedContent.match(/^\*\*Reasoning:\*\*\s*(.*?)\s*\*\*Answer:\*\*\s*(.*?)$/s);
    if (legacyMatch) {
        const [, reasoningContent, answerContent] = legacyMatch;
        const reasoningText = reasoningContent.trim();
        const visible = answerContent.trim();

        if (reasoningText && visible) {
            reasoning = {
                text: reasoningText,
                tokensEst: estimateTokens(reasoningText)
            };
            parsedContent = visible;
        }
    }

    // Clean up the final visible content
    const cleanVisible = parsedContent.trim() || 'No visible content provided.';

    const result: ParsedMessage = { visible: cleanVisible };
    if (reasoning) result.reasoning = reasoning;
    if (plan) result.plan = plan;
    if (final) result.final = final;

    return result;
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
