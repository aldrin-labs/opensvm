/**
 * Phase 2.4: Enhanced Slash Command System
 * Provides rich slash command metadata, contextual suggestions, and completion logic
 */

export interface SlashCommand {
    cmd: string;
    desc: string;
    context?: 'tx' | 'account' | 'general';
    category?: 'query' | 'action' | 'help';
    example?: string;
}

// Phase 2.4.1: Add metadata descriptions
export const SLASH_COMMANDS: SlashCommand[] = [
    {
        cmd: 'tps',
        desc: 'Get current network transactions per second',
        context: 'general',
        category: 'query',
        example: '/tps'
    },
    {
        cmd: 'tx',
        desc: 'Analyze a specific transaction by signature',
        context: 'tx',
        category: 'query',
        example: '/tx 5KJp...'
    },
    {
        cmd: 'wallet',
        desc: 'Get wallet overview and recent activity',
        context: 'account',
        category: 'query',
        example: '/wallet 9WzDXw...'
    },
    {
        cmd: 'path',
        desc: 'Find transaction paths between wallets',
        context: 'account',
        category: 'query',
        example: '/path from:9WzDXw... to:4VGh...'
    },
    {
        cmd: 'help',
        desc: 'Show available commands and usage guide',
        context: 'general',
        category: 'help',
        example: '/help'
    },
    {
        cmd: 'explain',
        desc: 'Explain current transaction or account in detail',
        context: 'tx',
        category: 'action',
        example: '/explain'
    },
    {
        cmd: 'analyze',
        desc: 'Deep analysis of patterns and relationships',
        context: 'general',
        category: 'action',
        example: '/analyze defi trends'
    },
    {
        cmd: 'search',
        desc: 'Search across transactions, accounts, and programs',
        context: 'general',
        category: 'query',
        example: '/search token:SOL'
    },
    {
        cmd: 'ref',
        desc: 'Reference a knowledge note in your message',
        context: 'general',
        category: 'action',
        example: '/ref solana architecture'
    }
];

// Phase 2.4.3: Contextual suggestions based on page context  
export function getContextualSuggestions(
    query: string,
    pageContext?: { kind: 'tx' | 'account'; value: string } | null
): SlashCommand[] {
    const trimmedQuery = query.toLowerCase();

    // Filter commands that match the query
    let filtered = SLASH_COMMANDS.filter(cmd =>
        cmd.cmd.toLowerCase().startsWith(trimmedQuery) ||
        cmd.desc.toLowerCase().includes(trimmedQuery)
    );

    // If no query, show all commands
    if (!trimmedQuery) {
        filtered = [...SLASH_COMMANDS];
    }

    // Phase 2.4.3: Prioritize context-relevant commands
    if (pageContext) {
        const contextualCommands = filtered.filter(cmd =>
            cmd.context === pageContext.kind || cmd.context === 'general'
        );
        const otherCommands = filtered.filter(cmd =>
            cmd.context !== pageContext.kind && cmd.context !== 'general'
        );

        // Sort contextual commands first
        return [...contextualCommands, ...otherCommands];
    }

    return filtered;
}

// Phase 2.4.2: Completion logic for right arrow and tab
export function completeSlashCommand(
    input: string,
    selectedIndex: number,
    suggestions: SlashCommand[],
    method: 'tab' | 'right' | 'enter'
): { completed: string; shouldSubmit: boolean } {
    const suggestion = suggestions[selectedIndex];
    if (!suggestion) {
        return { completed: input, shouldSubmit: false };
    }

    const inputTrimmed = input.trim();
    const afterSlash = inputTrimmed.startsWith('/') ? inputTrimmed.slice(1) : inputTrimmed;
    const parts = afterSlash.split(/\s+/);
    const currentToken = parts[0] || '';
    const restTokens = parts.slice(1);

    // Check if current token is already complete
    const isExactMatch = currentToken.toLowerCase() === suggestion.cmd.toLowerCase();

    if (method === 'enter' && isExactMatch) {
        // For exact matches on Enter, submit the command
        return { completed: input, shouldSubmit: true };
    }

    // Replace the first token with the completed command
    const restText = restTokens.length > 0 ? ' ' + restTokens.join(' ') : '';
    const completed = `/${suggestion.cmd}${restText}${!restText ? ' ' : ''}`;

    return {
        completed,
        shouldSubmit: method === 'enter' && isExactMatch
    };
}

// Phase 2.4.4: Telemetry helper
export function trackSlashUsage(
    command: string,
    method: 'tab' | 'right' | 'enter',
    context?: string
) {
    if (typeof window !== 'undefined' && (window as any).track) {
        (window as any).track('slash_used', {
            cmd: command,
            method,
            context,
            timestamp: Date.now()
        });
    }
}

// Export for agent automation
export function getSlashCommandByName(name: string): SlashCommand | undefined {
    return SLASH_COMMANDS.find(cmd => cmd.cmd.toLowerCase() === name.toLowerCase());
}

// Helper for rendering
export function formatSlashCommand(cmd: SlashCommand): string {
    return `/${cmd.cmd} - ${cmd.desc}`;
}

// Context badge helper
export function getContextBadge(cmd: SlashCommand, currentContext?: string): string | null {
    if (cmd.context === currentContext) {
        return '📍'; // Context-relevant badge
    }

    switch (cmd.context) {
        case 'tx': return '🔗';
        case 'account': return '👤';
        case 'general': return '⚡';
        default: return null;
    }
}
