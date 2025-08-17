import { parseAssistantMessage } from '../lib/ai/reasoning/parseAssistantMessage';

describe('parseAssistantMessage', () => {
    it('returns full content as visible when no reasoning delimiters', () => {
        const input = 'Hello world';
        expect(parseAssistantMessage(input)).toEqual({ visible: 'Hello world' });
    });

    it('extracts reasoning and visible text (before + after)', () => {
        const input = 'Answer start. <REASONING>chain of thought here</REASONING> Final visible.';
        expect(parseAssistantMessage(input)).toEqual({
            visible: 'Answer start.\n\nFinal visible.',
            reasoning: { text: 'chain of thought here', tokensEst: Math.ceil('chain of thought here'.length / 4) }
        });
    });

    it('handles malformed (missing closing) gracefully', () => {
        const input = 'Answer <REASONING>oops no end tag';
        expect(parseAssistantMessage(input)).toEqual({ visible: input });
    });

    it('handles multiple reasoning blocks by taking first pair only', () => {
        const input = 'A <REASONING>first</REASONING> mid <REASONING>second</REASONING> end';
        const parsed = parseAssistantMessage(input);
        expect(parsed.reasoning?.text).toBe('first');
        expect(parsed.visible).toBe('A\n\nmid <REASONING>second</REASONING> end');
    });
});
