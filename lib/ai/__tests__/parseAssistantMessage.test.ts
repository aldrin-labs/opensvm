import { parseAssistantMessage, hasReasoning, estimateTokens } from '../parseAssistantMessage';

describe('parseAssistantMessage', () => {
    describe('with reasoning delimiters', () => {
        it('should parse basic reasoning block', () => {
            const content = `<REASONING>
Step 1: Analyze the user's question
Step 2: Formulate response
</REASONING>

This is the final answer for the user.`;

            const result = parseAssistantMessage(content);

            expect(result.visible).toBe('This is the final answer for the user.');
            expect(result.reasoning).toEqual({
                text: 'Step 1: Analyze the user\'s question\nStep 2: Formulate response',
                tokensEst: 16
            });
        });

        it('should handle reasoning with content before and after', () => {
            const content = `Introduction text here.

<REASONING>
Internal thinking process
</REASONING>

Final answer content.`;

            const result = parseAssistantMessage(content);

            expect(result.visible).toBe('Introduction text here.\n\nFinal answer content.');
            expect(result.reasoning).toEqual({
                text: 'Internal thinking process',
                tokensEst: 7
            });
        });

        it('should handle legacy reasoning format', () => {
            const content = `**Reasoning:**
This looks like a beginner question about promises.

**Answer:**
JavaScript promises are objects that represent eventual completion.`;

            const result = parseAssistantMessage(content);

            expect(result.visible).toBe('JavaScript promises are objects that represent eventual completion.');
            expect(result.reasoning).toEqual({
                text: 'This looks like a beginner question about promises.',
                tokensEst: 13
            });
        });

        it('should handle inline reasoning tags', () => {
            const content = `Some text <REASONING>quick thought</REASONING> more text.`;

            const result = parseAssistantMessage(content);

            expect(result.visible).toBe('Some text  more text.');
            expect(result.reasoning).toEqual({
                text: 'quick thought',
                tokensEst: 4
            });
        });
    });

    describe('without reasoning delimiters', () => {
        it('should treat entire content as visible when no delimiters', () => {
            const content = 'This is a regular response without any reasoning.';

            const result = parseAssistantMessage(content);

            expect(result.visible).toBe(content);
            expect(result.reasoning).toBeUndefined();
        });

        it('should handle empty content', () => {
            const result = parseAssistantMessage('');

            expect(result.visible).toBe('');
            expect(result.reasoning).toBeUndefined();
        });

        it('should handle null/undefined content', () => {
            const result1 = parseAssistantMessage(null as any);
            const result2 = parseAssistantMessage(undefined as any);

            expect(result1.visible).toBe('');
            expect(result1.reasoning).toBeUndefined();

            expect(result2.visible).toBe('');
            expect(result2.reasoning).toBeUndefined();
        });
    });

    describe('edge cases', () => {
        it('should handle incomplete reasoning tags', () => {
            const content = `<REASONING>
Started thinking but no closing tag
More content here.`;

            const result = parseAssistantMessage(content);

            expect(result.visible).toBe(content);
            expect(result.reasoning).toBeUndefined();
        });

        it('should handle empty reasoning block', () => {
            const content = `<REASONING></REASONING>
Final answer here.`;

            const result = parseAssistantMessage(content);

            expect(result.visible).toBe('Final answer here.');
            expect(result.reasoning).toBeUndefined();
        });

        it('should handle whitespace-only reasoning', () => {
            const content = `<REASONING>   \n  \t  </REASONING>
Final answer here.`;

            const result = parseAssistantMessage(content);

            expect(result.visible).toBe('Final answer here.');
            expect(result.reasoning).toBeUndefined();
        });

        it('should handle nested reasoning tags as literal text', () => {
            const content = `<REASONING>
Thinking about <REASONING>nested</REASONING> tags here.
</REASONING>

Final answer.`;

            const result = parseAssistantMessage(content);

            expect(result.visible).toBe('Final answer.');
            expect(result.reasoning?.text).toBe('Thinking about <REASONING>nested</REASONING> tags here.');
        });

        it('should handle malformed legacy format', () => {
            const content = `**Reasoning:**
Some reasoning here.

**Wrong:**
This should not parse as legacy format.`;

            const result = parseAssistantMessage(content);

            expect(result.visible).toBe(content);
            expect(result.reasoning).toBeUndefined();
        });
    });
});

describe('hasReasoning', () => {
    it('should detect reasoning delimiters', () => {
        expect(hasReasoning('<REASONING>test</REASONING>')).toBe(true);
        expect(hasReasoning('**Reasoning:** test')).toBe(true);
        expect(hasReasoning('no reasoning here')).toBe(false);
        expect(hasReasoning('')).toBe(false);
        expect(hasReasoning(null as any)).toBe(false);
    });
});

describe('estimateTokens', () => {
    it('should estimate tokens correctly', () => {
        expect(estimateTokens('test')).toBe(1); // 4 chars = 1 token
        expect(estimateTokens('testing tokens')).toBe(4); // 14 chars = 4 tokens (ceil)
        expect(estimateTokens('')).toBe(0);
        expect(estimateTokens(null as any)).toBe(0);
    });
});
