/**
 * Token estimation utility for knowledge management
 * Provides approximate token counts for content planning and metrics
 */

// Rough estimation: ~4 characters per token for English text
const CHARS_PER_TOKEN = 4;

// More accurate estimation considering word patterns
const WORD_TOKEN_RATIO = 0.75; // Most words are less than 1 token

/**
 * Estimates the number of tokens in a text string
 * Uses character-based and word-based heuristics for reasonable approximation
 */
export function estimateTokens(text: string): number {
    if (!text || text.trim().length === 0) return 0;

    const trimmedText = text.trim();

    // Character-based estimation
    const charEstimate = Math.ceil(trimmedText.length / CHARS_PER_TOKEN);

    // Word-based estimation with adjustments for common patterns
    const words = trimmedText.split(/\s+/);
    const wordEstimate = Math.ceil(words.length * WORD_TOKEN_RATIO);

    // Take the higher estimate to be conservative
    const estimate = Math.max(charEstimate, wordEstimate);

    // Apply adjustments for different content types
    if (isCodeLike(trimmedText)) {
        // Code typically has more tokens due to symbols and syntax
        return Math.ceil(estimate * 1.2);
    }

    if (hasLongWords(trimmedText)) {
        // Technical content with long words often maps to more tokens
        return Math.ceil(estimate * 1.1);
    }

    return estimate;
}

/**
 * Estimates tokens with additional metadata about content characteristics
 */
export function estimateTokensWithDetails(text: string) {
    const tokens = estimateTokens(text);
    const chars = text.length;
    const words = text.trim().split(/\s+/).length;

    return {
        tokens,
        chars,
        words,
        avgCharsPerToken: chars > 0 ? Math.round(chars / tokens) : 0,
        avgWordsPerToken: words > 0 ? (words / tokens).toFixed(2) : '0',
        contentType: getContentType(text)
    };
}

/**
 * Calculates total tokens for an array of text strings
 */
export function estimateTokensForArray(texts: string[]): number {
    return texts.reduce((total, text) => total + estimateTokens(text), 0);
}

/**
 * Estimates tokens for structured content with different weights
 */
export function estimateTokensForStructured(content: {
    title?: string;
    body: string;
    metadata?: string;
}): number {
    let total = 0;

    if (content.title) {
        // Titles often compress well
        total += Math.ceil(estimateTokens(content.title) * 0.9);
    }

    total += estimateTokens(content.body);

    if (content.metadata) {
        // Metadata is often repetitive and compresses well
        total += Math.ceil(estimateTokens(content.metadata) * 0.8);
    }

    return total;
}

// Helper functions

function isCodeLike(text: string): boolean {
    // Check for common code patterns
    const codeIndicators = [
        /[\{\}\[\]\(\)]/g,  // Brackets and parentheses
        /[;=<>]/g,          // Common operators
        /\b(function|const|let|var|if|else|return|import|export)\b/g, // Keywords
        /\.[a-zA-Z]+\(/g,   // Method calls
        /\/\/|\/\*|\*\//g   // Comments
    ];

    const matches = codeIndicators.reduce((count, pattern) => {
        return count + (text.match(pattern) || []).length;
    }, 0);

    // If we have more than 10% code indicators relative to text length
    return matches > text.length * 0.1;
}

function hasLongWords(text: string): boolean {
    const words = text.split(/\s+/);
    const longWords = words.filter(word => word.length > 10);
    return longWords.length > words.length * 0.1;
}

function getContentType(text: string): 'code' | 'technical' | 'conversational' | 'mixed' {
    if (isCodeLike(text)) return 'code';
    if (hasLongWords(text)) return 'technical';

    // Check for conversational patterns
    const conversationalWords = text.match(/\b(I|you|we|they|can|should|would|like|think|feel)\b/gi);
    if (conversationalWords && conversationalWords.length > text.split(/\s+/).length * 0.1) {
        return 'conversational';
    }

    return 'mixed';
}

/**
 * Format token count for display
 */
export function formatTokenCount(count: number): string {
    if (count < 1000) return count.toString();
    if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
    return `${(count / 1000000).toFixed(1)}M`;
}

/**
 * Estimate cost based on token count (using rough OpenAI pricing)
 */
export function estimateTokenCost(tokens: number, model: 'gpt-3.5' | 'gpt-4' = 'gpt-3.5'): number {
    const rates = {
        'gpt-3.5': 0.002 / 1000, // $0.002 per 1K tokens
        'gpt-4': 0.03 / 1000     // $0.03 per 1K tokens
    };

    return tokens * rates[model];
}
