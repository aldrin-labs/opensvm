export interface AIChatModel {
    id: string;
    user_id: string;
    title: string;
    mode: 'agent' | 'assistant';
    created_at: number;
    updated_at: number;
    last_activity: number;
    status?: string;
    pinned: boolean;
    metadata: {
        total_messages: number;
        estimated_tokens: number;
        tags: string[];
        summary?: string;
    };
}

export interface AIMessageModel {
    id: string;
    chat_id: string;
    user_id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    tokens_estimate?: number;
    metadata: {
        message_index: number;
        intent?: string;
        entities?: string[];
        sentiment?: 'positive' | 'negative' | 'neutral';
        topics?: string[];
    };
}

export interface ChatSearchResult {
    chat: AIChatModel;
    messages: AIMessageModel[];
    relevance_score: number;
    matched_content: string[];
}

export interface MessageSearchResult {
    message: AIMessageModel;
    chat: AIChatModel;
    relevance_score: number;
    context_before?: AIMessageModel[];
    context_after?: AIMessageModel[];
}

export interface ChatHistorySearchOptions {
    query: string;
    user_id: string;
    limit?: number;
    include_context?: boolean;
    semantic_search?: boolean;
    literal_search?: boolean;
    date_range?: {
        start: number;
        end: number;
    };
    chat_modes?: ('agent' | 'assistant')[];
}
