/**
 * Phase 3.3.1: Conversation Metadata Schema
 * Formal thread persistence interface with version property for migrations
 */

export interface ConversationMetadata {
    /** Unique identifier for the conversation thread */
    id: string;

    /** Creation timestamp (ISO string) */
    createdAt: string;

    /** Last update timestamp (ISO string) */
    updatedAt: string;

    /** User-defined or auto-generated title */
    title: string;

    /** Auto-generated summary of conversation */
    summary?: string;

    /** Whether this thread is pinned to top */
    pinned: boolean;

    /** Version for schema migrations */
    version: number;

    /** Message count for quick display */
    messageCount: number;

    /** Estimated total tokens in conversation */
    tokenCount?: number;

    /** Tags for organization */
    tags?: string[];

    /** Last message preview for list display */
    lastMessage?: {
        role: 'user' | 'assistant' | 'system';
        content: string; // Truncated to ~100 chars
        timestamp: string;
    };

    /** Custom metadata for future extensibility */
    metadata?: Record<string, any>;
}

export interface ConversationThread {
    /** Metadata about the conversation */
    meta: ConversationMetadata;

    /** Array of messages in the conversation */
    messages: ConversationMessage[];
}

export interface ConversationMessage {
    /** Unique message ID */
    id: string;

    /** Message role */
    role: 'user' | 'assistant' | 'system';

    /** Message content */
    content: string;

    /** Message timestamp (ISO string) */
    timestamp: string;

    /** Estimated token count for this message */
    tokenCount?: number;

    /** Whether this message is from saved knowledge */
    isKnowledge?: boolean;

    /** Message-specific metadata */
    metadata?: Record<string, any>;
}

// Current schema version for migrations
export const CONVERSATION_SCHEMA_VERSION = 1;

// Default metadata for new conversations
export function createDefaultMetadata(id?: string): ConversationMetadata {
    const now = new Date().toISOString();

    return {
        id: id || generateConversationId(),
        createdAt: now,
        updatedAt: now,
        title: 'New Conversation',
        pinned: false,
        version: CONVERSATION_SCHEMA_VERSION,
        messageCount: 0
    };
}

// Generate unique conversation ID using timestamp + random
export function generateConversationId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `conv_${timestamp}_${random}`;
}

// Generate unique message ID
export function generateMessageId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `msg_${timestamp}_${random}`;
}

// Create auto-summary from conversation
export function generateAutoSummary(messages: ConversationMessage[]): string {
    if (messages.length === 0) return 'Empty conversation';

    // Get first user message and last assistant message
    const firstUserMessage = messages.find(m => m.role === 'user');
    const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');

    let summary = '';

    if (firstUserMessage) {
        // Use first 40 characters of first user message
        const firstPart = firstUserMessage.content.substring(0, 40).trim();
        summary = firstPart + (firstUserMessage.content.length > 40 ? '...' : '');
    }

    if (lastAssistantMessage && messages.length > 1) {
        // Add snippet from last assistant response
        const lastPart = lastAssistantMessage.content.substring(0, 20).trim();
        if (lastPart) {
            summary += ` → ${lastPart}${lastAssistantMessage.content.length > 20 ? '...' : ''}`;
        }
    }

    return summary || 'New conversation';
}

// Update conversation metadata based on current messages
export function updateConversationMetadata(
    meta: ConversationMetadata,
    messages: ConversationMessage[]
): ConversationMetadata {
    const lastMessage = messages[messages.length - 1];

    return {
        ...meta,
        updatedAt: new Date().toISOString(),
        messageCount: messages.length,
        tokenCount: messages.reduce((sum, msg) => sum + (msg.tokenCount || 0), 0),
        summary: generateAutoSummary(messages),
        lastMessage: lastMessage ? {
            role: lastMessage.role,
            content: lastMessage.content.substring(0, 100) +
                (lastMessage.content.length > 100 ? '...' : ''),
            timestamp: lastMessage.timestamp
        } : undefined
    };
}

// Validate conversation metadata schema
export function validateConversationMetadata(data: any): data is ConversationMetadata {
    return (
        typeof data === 'object' &&
        typeof data.id === 'string' &&
        typeof data.createdAt === 'string' &&
        typeof data.updatedAt === 'string' &&
        typeof data.title === 'string' &&
        typeof data.pinned === 'boolean' &&
        typeof data.version === 'number' &&
        typeof data.messageCount === 'number'
    );
}

// Migration helper for schema upgrades
export function migrateConversationMetadata(data: any): ConversationMetadata {
    if (validateConversationMetadata(data) && data.version === CONVERSATION_SCHEMA_VERSION) {
        return data;
    }

    // Handle version 0 or missing version (legacy data)
    if (data.version === undefined || data.version === 0) {
        return {
            ...createDefaultMetadata(data.id),
            title: data.title || 'Migrated Conversation',
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString(),
            pinned: data.pinned || false,
            messageCount: data.messageCount || 0,
            tokenCount: data.tokenCount,
            summary: data.summary
        };
    }

    // Future version migrations would go here
    // if (data.version === 2) { ... }

    console.warn('Unknown conversation metadata version:', data.version);
    return createDefaultMetadata();
}
