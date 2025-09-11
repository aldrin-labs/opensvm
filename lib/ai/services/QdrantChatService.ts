import { QdrantClient } from '@qdrant/js-client-rest';
import type {
    AIChatModel,
    AIMessageModel,
    ChatSearchResult,
    MessageSearchResult,
    ChatHistorySearchOptions
} from '../models/ChatModels';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

const CHATS_COLLECTION = 'ai_chats';
const MESSAGES_COLLECTION = 'ai_messages';

class QdrantChatService {
    private client: QdrantClient;

    constructor() {
        this.client = new QdrantClient({
            url: QDRANT_URL,
            apiKey: QDRANT_API_KEY,
        });
    }

    async initializeCollections() {
        try {
            // Initialize chats collection
            await this.client.createCollection(CHATS_COLLECTION, {
                vectors: {
                    title_embedding: { size: 1536, distance: 'Cosine' },
                    summary_embedding: { size: 1536, distance: 'Cosine' }
                },
                optimizers_config: {
                    default_segment_number: 2
                },
                replication_factor: 1
            });

            // Initialize messages collection  
            await this.client.createCollection(MESSAGES_COLLECTION, {
                vectors: {
                    content_embedding: { size: 1536, distance: 'Cosine' }
                },
                optimizers_config: {
                    default_segment_number: 2
                },
                replication_factor: 1
            });

            console.log('Qdrant collections initialized successfully');
        } catch (error) {
            // Collections might already exist
            console.log('Qdrant collections initialization:', error instanceof Error ? error.message : 'Unknown error');
        }
    }

    async saveChat(chat: AIChatModel, titleEmbedding?: number[], summaryEmbedding?: number[]) {
        try {
            const vectors: any = {};
            if (titleEmbedding) vectors.title_embedding = titleEmbedding;
            if (summaryEmbedding) vectors.summary_embedding = summaryEmbedding;

            await this.client.upsert(CHATS_COLLECTION, {
                wait: true,
                points: [{
                    id: chat.id,
                    vector: vectors,
                    payload: {
                        user_id: chat.user_id,
                        title: chat.title,
                        mode: chat.mode,
                        created_at: chat.created_at,
                        updated_at: chat.updated_at,
                        last_activity: chat.last_activity,
                        status: chat.status,
                        pinned: chat.pinned,
                        total_messages: chat.metadata.total_messages,
                        estimated_tokens: chat.metadata.estimated_tokens,
                        tags: chat.metadata.tags,
                        summary: chat.metadata.summary
                    }
                }]
            });

            return { success: true };
        } catch (error) {
            console.error('Error saving chat to Qdrant:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    async saveMessage(message: AIMessageModel, contentEmbedding?: number[]) {
        try {
            const vectors: any = {};
            if (contentEmbedding) vectors.content_embedding = contentEmbedding;

            await this.client.upsert(MESSAGES_COLLECTION, {
                wait: true,
                points: [{
                    id: message.id,
                    vector: vectors,
                    payload: {
                        chat_id: message.chat_id,
                        user_id: message.user_id,
                        role: message.role,
                        content: message.content,
                        timestamp: message.timestamp,
                        tokens_estimate: message.tokens_estimate,
                        message_index: message.metadata.message_index,
                        intent: message.metadata.intent,
                        entities: message.metadata.entities,
                        sentiment: message.metadata.sentiment,
                        topics: message.metadata.topics
                    }
                }]
            });

            return { success: true };
        } catch (error) {
            console.error('Error saving message to Qdrant:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    async searchChatHistory(options: ChatHistorySearchOptions): Promise<MessageSearchResult[]> {
        try {
            const { query, user_id, limit = 10, include_context = true } = options;

            // Get query embedding (you'll need to implement this with OpenAI or similar)
            const queryEmbedding = await this.getQueryEmbedding(query);

            // Search messages by content
            const searchResults = await this.client.search(MESSAGES_COLLECTION, {
                vector: {
                    name: 'content_embedding',
                    vector: queryEmbedding
                },
                filter: {
                    must: [
                        { key: 'user_id', match: { value: user_id } }
                    ]
                },
                limit,
                with_payload: true,
                score_threshold: 0.7
            });

            const results: MessageSearchResult[] = [];

            for (const result of searchResults) {
                const messagePayload = result.payload as any;

                // Get the chat information
                const chatResult = await this.client.retrieve(CHATS_COLLECTION, {
                    ids: [messagePayload.chat_id],
                    with_payload: true
                });

                if (chatResult.length === 0) continue;

                const chatPayload = chatResult[0].payload as any;

                const chat: AIChatModel = {
                    id: messagePayload.chat_id,
                    user_id: chatPayload.user_id,
                    title: chatPayload.title,
                    mode: chatPayload.mode,
                    created_at: chatPayload.created_at,
                    updated_at: chatPayload.updated_at,
                    last_activity: chatPayload.last_activity,
                    status: chatPayload.status,
                    pinned: chatPayload.pinned,
                    metadata: {
                        total_messages: chatPayload.total_messages,
                        estimated_tokens: chatPayload.estimated_tokens,
                        tags: chatPayload.tags || [],
                        summary: chatPayload.summary
                    }
                };

                const message: AIMessageModel = {
                    id: result.id as string,
                    chat_id: messagePayload.chat_id,
                    user_id: messagePayload.user_id,
                    role: messagePayload.role,
                    content: messagePayload.content,
                    timestamp: messagePayload.timestamp,
                    tokens_estimate: messagePayload.tokens_estimate,
                    metadata: {
                        message_index: messagePayload.message_index,
                        intent: messagePayload.intent,
                        entities: messagePayload.entities,
                        sentiment: messagePayload.sentiment,
                        topics: messagePayload.topics
                    }
                };

                let context_before: AIMessageModel[] = [];
                let context_after: AIMessageModel[] = [];

                if (include_context) {
                    // Get surrounding messages for context
                    const contextResults = await this.client.scroll(MESSAGES_COLLECTION, {
                        filter: {
                            must: [
                                { key: 'chat_id', match: { value: messagePayload.chat_id } },
                                { key: 'user_id', match: { value: user_id } }
                            ]
                        },
                        with_payload: true,
                        limit: 100 // Get more messages to find context
                    });

                    const allMessages = contextResults.points
                        .map(p => ({
                            ...p.payload,
                            id: p.id
                        } as any))
                        .sort((a, b) => a.message_index - b.message_index);

                    const currentIndex = messagePayload.message_index;

                    context_before = allMessages
                        .filter(m => m.message_index < currentIndex && m.message_index >= currentIndex - 3)
                        .map(this.payloadToMessage);

                    context_after = allMessages
                        .filter(m => m.message_index > currentIndex && m.message_index <= currentIndex + 3)
                        .map(this.payloadToMessage);
                }

                results.push({
                    message,
                    chat,
                    relevance_score: result.score || 0,
                    context_before,
                    context_after
                });
            }

            return results.sort((a, b) => b.relevance_score - a.relevance_score);
        } catch (error) {
            console.error('Error searching chat history:', error);
            return [];
        }
    }

    async searchChats(options: {
        query: string;
        user_id: string;
        limit?: number;
        search_titles?: boolean;
        search_summaries?: boolean;
    }): Promise<ChatSearchResult[]> {
        try {
            const { query, user_id, limit = 10, search_titles = true, search_summaries = true } = options;

            const queryEmbedding = await this.getQueryEmbedding(query);
            const results: ChatSearchResult[] = [];

            // Search chat titles if enabled
            if (search_titles) {
                const titleResults = await this.client.search(CHATS_COLLECTION, {
                    vector: {
                        name: 'title_embedding',
                        vector: queryEmbedding
                    },
                    filter: {
                        must: [
                            { key: 'user_id', match: { value: user_id } }
                        ]
                    },
                    limit,
                    with_payload: true,
                    score_threshold: 0.6
                });

                for (const result of titleResults) {
                    const chatPayload = result.payload as any;

                    const chat: AIChatModel = {
                        id: result.id as string,
                        user_id: chatPayload.user_id,
                        title: chatPayload.title,
                        mode: chatPayload.mode,
                        created_at: chatPayload.created_at,
                        updated_at: chatPayload.updated_at,
                        last_activity: chatPayload.last_activity,
                        status: chatPayload.status,
                        pinned: chatPayload.pinned,
                        metadata: {
                            total_messages: chatPayload.total_messages,
                            estimated_tokens: chatPayload.estimated_tokens,
                            tags: chatPayload.tags || [],
                            summary: chatPayload.summary
                        }
                    };

                    // Get all messages for this chat
                    const messagesResult = await this.client.scroll(MESSAGES_COLLECTION, {
                        filter: {
                            must: [
                                { key: 'chat_id', match: { value: result.id } },
                                { key: 'user_id', match: { value: user_id } }
                            ]
                        },
                        with_payload: true,
                        limit: 100
                    });

                    const messages = messagesResult.points
                        .map(p => this.payloadToMessage({ ...p.payload, id: p.id }))
                        .sort((a, b) => a.metadata.message_index - b.metadata.message_index);

                    results.push({
                        chat,
                        messages,
                        relevance_score: result.score || 0,
                        matched_content: [chatPayload.title]
                    });
                }
            }

            // Search chat summaries if enabled
            if (search_summaries) {
                const summaryResults = await this.client.search(CHATS_COLLECTION, {
                    vector: {
                        name: 'summary_embedding',
                        vector: queryEmbedding
                    },
                    filter: {
                        must: [
                            { key: 'user_id', match: { value: user_id } }
                        ]
                    },
                    limit,
                    with_payload: true,
                    score_threshold: 0.6
                });

                for (const result of summaryResults) {
                    // Skip if we already have this chat from title search
                    if (results.find(r => r.chat.id === result.id)) continue;

                    const chatPayload = result.payload as any;

                    const chat: AIChatModel = {
                        id: result.id as string,
                        user_id: chatPayload.user_id,
                        title: chatPayload.title,
                        mode: chatPayload.mode,
                        created_at: chatPayload.created_at,
                        updated_at: chatPayload.updated_at,
                        last_activity: chatPayload.last_activity,
                        status: chatPayload.status,
                        pinned: chatPayload.pinned,
                        metadata: {
                            total_messages: chatPayload.total_messages,
                            estimated_tokens: chatPayload.estimated_tokens,
                            tags: chatPayload.tags || [],
                            summary: chatPayload.summary
                        }
                    };

                    // Get all messages for this chat
                    const messagesResult = await this.client.scroll(MESSAGES_COLLECTION, {
                        filter: {
                            must: [
                                { key: 'chat_id', match: { value: result.id } },
                                { key: 'user_id', match: { value: user_id } }
                            ]
                        },
                        with_payload: true,
                        limit: 100
                    });

                    const messages = messagesResult.points
                        .map(p => this.payloadToMessage({ ...p.payload, id: p.id }))
                        .sort((a, b) => a.metadata.message_index - b.metadata.message_index);

                    results.push({
                        chat,
                        messages,
                        relevance_score: result.score || 0,
                        matched_content: [chatPayload.summary || '']
                    });
                }
            }

            return results.sort((a, b) => b.relevance_score - a.relevance_score);
        } catch (error) {
            console.error('Error searching chats:', error);
            return [];
        }
    } async getUserChats(userId: string, limit = 50): Promise<AIChatModel[]> {
        try {
            const results = await this.client.scroll(CHATS_COLLECTION, {
                filter: {
                    must: [
                        { key: 'user_id', match: { value: userId } }
                    ]
                },
                with_payload: true,
                limit
            });

            return results.points.map(point => ({
                id: point.id as string,
                user_id: point.payload?.user_id as string,
                title: point.payload?.title as string,
                mode: point.payload?.mode as 'agent' | 'assistant',
                created_at: point.payload?.created_at as number,
                updated_at: point.payload?.updated_at as number,
                last_activity: point.payload?.last_activity as number,
                status: point.payload?.status as string,
                pinned: point.payload?.pinned as boolean,
                metadata: {
                    total_messages: point.payload?.total_messages as number,
                    estimated_tokens: point.payload?.estimated_tokens as number,
                    tags: point.payload?.tags as string[] || [],
                    summary: point.payload?.summary as string
                }
            }));
        } catch (error) {
            console.error('Error getting user chats:', error);
            return [];
        }
    }

    async deleteChat(chatId: string, userId: string) {
        try {
            // Delete all messages in the chat
            await this.client.delete(MESSAGES_COLLECTION, {
                wait: true,
                filter: {
                    must: [
                        { key: 'chat_id', match: { value: chatId } },
                        { key: 'user_id', match: { value: userId } }
                    ]
                }
            });

            // Delete the chat
            await this.client.delete(CHATS_COLLECTION, {
                wait: true,
                points: [chatId]
            });

            return { success: true };
        } catch (error) {
            console.error('Error deleting chat:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    private payloadToMessage(payload: any): AIMessageModel {
        return {
            id: payload.id,
            chat_id: payload.chat_id,
            user_id: payload.user_id,
            role: payload.role,
            content: payload.content,
            timestamp: payload.timestamp,
            tokens_estimate: payload.tokens_estimate,
            metadata: {
                message_index: payload.message_index,
                intent: payload.intent,
                entities: payload.entities,
                sentiment: payload.sentiment,
                topics: payload.topics
            }
        };
    }

    private async getQueryEmbedding(query: string): Promise<number[]> {
        // TODO: Implement with OpenAI embeddings or similar
        // For now, return a simple hash-based embedding simulation based on query
        let hash = 0;
        for (let i = 0; i < query.length; i++) {
            const char = query.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }

        // Generate a pseudo-embedding based on hash
        const embedding = new Array(1536);
        for (let i = 0; i < 1536; i++) {
            embedding[i] = Math.sin(hash * (i + 1) / 1000) * 0.1;
        }

        return embedding;
    }
}

export const qdrantChatService = new QdrantChatService();
