import { qdrantChatService } from './QdrantChatService';
import type {
    AIChatModel,
    AIMessageModel,
    ChatSearchResult,
    MessageSearchResult
} from '../models/ChatModels';
import type { ChatTab } from '../../../components/ai/hooks/useChatTabs';

export interface ChatPersistenceConfig {
    autoSave: boolean;
    userId?: string;
    enableSearch: boolean;
}

class ChatPersistenceService {
    private config: ChatPersistenceConfig = {
        autoSave: false,
        enableSearch: false
    };

    private messageCounter = new Map<string, number>();

    configure(config: ChatPersistenceConfig) {
        this.config = { ...config };

        if (config.autoSave) {
            // Initialize Qdrant collections when auto-save is enabled
            qdrantChatService.initializeCollections().catch(console.error);
        }
    }

    async saveChatFromTab(chatTab: ChatTab): Promise<boolean> {
        if (!this.config.autoSave || !this.config.userId) {
            return false;
        }

        try {
            // Convert ChatTab to AIChatModel
            const chat: AIChatModel = {
                id: chatTab.id,
                user_id: this.config.userId,
                title: chatTab.name || 'Untitled Chat',
                mode: chatTab.mode || 'assistant',
                created_at: Date.now(),
                updated_at: Date.now(),
                last_activity: chatTab.lastActivity || Date.now(),
                status: chatTab.status || 'active',
                pinned: chatTab.pinned || false,
                metadata: {
                    total_messages: chatTab.messages?.length || 0,
                    estimated_tokens: chatTab.messages?.reduce((sum, msg) => sum + (msg.content?.length || 0), 0) || 0,
                    tags: [],
                    summary: this.generateChatSummary(chatTab)
                }
            };            // Generate embeddings for title and summary
            const titleEmbedding = await this.generateEmbedding(chat.title);
            const summaryEmbedding = chat.metadata.summary ?
                await this.generateEmbedding(chat.metadata.summary) : undefined;

            const result = await qdrantChatService.saveChat(chat, titleEmbedding, summaryEmbedding);

            if (result.success) {
                // Save all messages
                await this.saveMessagesFromTab(chatTab, chat.id);
                return true;
            }

            return false;
        } catch (error) {
            console.error('Error saving chat:', error);
            return false;
        }
    }

    private async saveMessagesFromTab(chatTab: ChatTab, chatId: string): Promise<void> {
        if (!chatTab.messages || !this.config.userId) return;

        let messageIndex = this.messageCounter.get(chatId) || 0;

        for (const message of chatTab.messages) {
            try {
                const aiMessage: AIMessageModel = {
                    id: `${chatId}_${messageIndex}`,
                    chat_id: chatId,
                    user_id: this.config.userId,
                    role: message.role as 'user' | 'assistant' | 'system',
                    content: message.content || '',
                    timestamp: Date.now(),
                    tokens_estimate: message.content?.length || 0,
                    metadata: {
                        message_index: messageIndex,
                        intent: this.detectIntent(message.content || ''),
                        entities: [],
                        sentiment: 'neutral',
                        topics: this.extractTopics(message.content || '')
                    }
                };

                const contentEmbedding = await this.generateEmbedding(aiMessage.content);
                await qdrantChatService.saveMessage(aiMessage, contentEmbedding);

                messageIndex++;
            } catch (error) {
                console.error('Error saving message:', error);
            }
        }

        this.messageCounter.set(chatId, messageIndex);
    }

    async searchUserChats(query: string, limit = 10): Promise<MessageSearchResult[]> {
        if (!this.config.enableSearch || !this.config.userId) {
            return [];
        }

        return await qdrantChatService.searchChatHistory({
            query,
            user_id: this.config.userId,
            limit,
            include_context: true
        });
    }

    async getUserChatHistory(limit = 50): Promise<AIChatModel[]> {
        if (!this.config.userId) {
            return [];
        }

        return await qdrantChatService.getUserChats(this.config.userId, limit);
    }

    async deleteUserChat(chatId: string): Promise<boolean> {
        if (!this.config.userId) {
            return false;
        }

        const result = await qdrantChatService.deleteChat(chatId, this.config.userId);
        return result.success;
    }

    // Auto-save functionality
    async autoSaveChat(chatTab: ChatTab): Promise<void> {
        if (!this.config.autoSave) return;

        // Debounce auto-save to avoid too frequent saves
        const debounceKey = `autosave_${chatTab.id}`;
        clearTimeout((globalThis as any)[debounceKey]);

        (globalThis as any)[debounceKey] = setTimeout(async () => {
            await this.saveChatFromTab(chatTab);
        }, 2000); // 2 second debounce
    }

    // Get all chats for a user
    async getUserChats(userId: string): Promise<AIChatModel[]> {
        if (!this.config.enableSearch) {
            return [];
        }

        try {
            return await qdrantChatService.getUserChats(userId);
        } catch (error) {
            console.error('Error getting user chats:', error);
            return [];
        }
    }

    // Search through chat history (messages)
    async searchChatHistory(options: {
        query: string;
        user_id: string;
        limit?: number;
        include_context?: boolean;
    }): Promise<MessageSearchResult[]> {
        if (!this.config.enableSearch) {
            return [];
        }

        try {
            return await qdrantChatService.searchChatHistory(options);
        } catch (error) {
            console.error('Error searching chat history:', error);
            return [];
        }
    }

    // Search for chats by title and summary (chat-level search)
    async searchChats(options: {
        query: string;
        user_id: string;
        limit?: number;
        search_titles?: boolean;
        search_summaries?: boolean;
    }): Promise<ChatSearchResult[]> {
        if (!this.config.enableSearch) {
            return [];
        }

        try {
            return await qdrantChatService.searchChats(options);
        } catch (error) {
            console.error('Error searching chats:', error);
            return [];
        }
    }

    // Real-time search as user types
    async realtimeSearch(query: string): Promise<MessageSearchResult[]> {
        if (!this.config.enableSearch || query.length < 3) {
            return [];
        }

        // Debounce search to avoid too many requests
        const debounceKey = 'realtime_search';
        clearTimeout((globalThis as any)[debounceKey]);

        return new Promise((resolve) => {
            (globalThis as any)[debounceKey] = setTimeout(async () => {
                const results = await this.searchChatHistory({
                    query,
                    user_id: this.config.userId!,
                    limit: 5,
                    include_context: false
                });
                resolve(results);
            }, 300); // 300ms debounce
        });
    }

    private generateChatSummary(chatTab: ChatTab): string {
        if (!chatTab.messages || chatTab.messages.length === 0) {
            return 'Empty chat';
        }

        const firstUserMessage = chatTab.messages.find(m => m.role === 'user');
        if (firstUserMessage && firstUserMessage.content) {
            // Take first 100 characters of first user message as summary
            return firstUserMessage.content.substring(0, 100) +
                (firstUserMessage.content.length > 100 ? '...' : '');
        }

        return `Chat with ${chatTab.messages.length} messages`;
    }

    private detectIntent(content: string): string {
        // Simple intent detection - could be enhanced with ML
        if (content.includes('?')) return 'question';
        if (content.toLowerCase().includes('help')) return 'help_request';
        if (content.toLowerCase().includes('explain')) return 'explanation';
        if (content.toLowerCase().includes('code')) return 'code_request';
        return 'general';
    }

    private extractTopics(content: string): string[] {
        // Simple topic extraction - could be enhanced with NLP
        const topics: string[] = [];
        const lowerContent = content.toLowerCase();

        if (lowerContent.includes('react') || lowerContent.includes('jsx')) topics.push('react');
        if (lowerContent.includes('typescript') || lowerContent.includes('ts')) topics.push('typescript');
        if (lowerContent.includes('javascript') || lowerContent.includes('js')) topics.push('javascript');
        if (lowerContent.includes('python')) topics.push('python');
        if (lowerContent.includes('api')) topics.push('api');
        if (lowerContent.includes('database') || lowerContent.includes('db')) topics.push('database');

        return topics;
    }

    private async generateEmbedding(text: string): Promise<number[]> {
        // TODO: Implement with OpenAI embeddings API
        // For now, return a simple hash-based embedding simulation
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
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

export const chatPersistenceService = new ChatPersistenceService();
