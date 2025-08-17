export interface ParsedAssistantMessage {
    visible: string;
    reasoning?: { text: string; tokensEst: number };
}

// Parses assistant message content into visible + optional reasoning using <REASONING> delimiters.
export function parseAssistantMessage(content: string): ParsedAssistantMessage {
    if (typeof content !== 'string' || !content.includes('<REASONING>')) {
        return { visible: content };
    }
    const start = content.indexOf('<REASONING>');
    const end = content.indexOf('</REASONING>');
    if (start === -1 || end === -1 || end < start) {
        return { visible: content }; // malformed / missing closing
    }
    const reasoningRaw = content.slice(start + '<REASONING>'.length, end).trim();
    const before = content.slice(0, start).trim();
    const after = content.slice(end + '</REASONING>'.length).trim();
    const visible = [before, after].filter(Boolean).join('\n\n');
    const tokensEst = Math.ceil(reasoningRaw.length / 4);
    return {
        visible: visible || '',
        reasoning: { text: reasoningRaw, tokensEst }
    };
}
