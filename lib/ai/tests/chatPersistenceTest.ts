/**
 * Simple test to         {
            role: 'assistant', 
            content: 'Neural networks are computational models inspired by biological neural networks. They consist of interconnected nodes (neurons) that process information.'
        },
        {
            role: 'user',
            content: 'What about deep learning specifically?'
        },
        {
            role: 'assistant',
            content: 'Deep learning is a subset of machine learning that uses neural networks with multiple hidden layers to learn complex patterns in data.'
        }sistence integration
 */

import { chatPersistenceService } from '../services/ChatPersistenceService';
import { qdrantChatService } from '../services/QdrantChatService';
import type { ChatTab } from '../../../components/ai/hooks/useChatTabs';
import type { Message } from '../../../components/ai/types';

// Mock ChatTab for testing
const mockChatTab: ChatTab = {
    id: 'test-chat-1',
    name: 'Test Chat - Machine Learning Discussion',
    mode: 'assistant',
    status: 'active',
    pinned: false,
    lastActivity: Date.now(),
    input: '',
    isProcessing: false,
    notes: [],
    agentActions: [],
    messages: [
        {
            role: 'user',
            content: 'Can you explain how neural networks work?'
        },
        {
            role: 'assistant',
            content: 'Neural networks are computational models inspired by biological neural networks. They consist of interconnected nodes (neurons) that process information.'
        },
        {
            role: 'user',
            content: 'What about deep learning specifically?'
        },
        {
            role: 'assistant',
            content: 'Deep learning is a subset of machine learning that uses neural networks with multiple hidden layers to learn complex patterns in data.'
        }
    ]
};

// Test configuration and basic functionality
async function testChatPersistence() {
    console.log('🧪 Starting Chat Persistence Tests...');

    try {
        // Test 1: Configure service
        console.log('1. Configuring persistence service...');
        chatPersistenceService.configure({
            autoSave: true,
            userId: 'test-user-123',
            enableSearch: true
        });
        console.log('✅ Service configured');

        // Test 2: Initialize collections
        console.log('2. Initializing Qdrant collections...');
        await qdrantChatService.initializeCollections();
        console.log('✅ Collections initialized');

        // Test 3: Save a chat
        console.log('3. Saving test chat...');
        const saveResult = await chatPersistenceService.saveChatFromTab(mockChatTab);
        console.log('✅ Chat save result:', saveResult);

        // Test 4: Retrieve user chats
        console.log('4. Retrieving user chats...');
        const userChats = await chatPersistenceService.getUserChats('test-user-123');
        console.log('✅ Retrieved chats:', userChats.length);

        // Test 5: Search messages
        console.log('5. Testing message search...');
        const messageResults = await chatPersistenceService.searchChatHistory({
            query: 'neural networks',
            user_id: 'test-user-123',
            limit: 5,
            include_context: true
        });
        console.log('✅ Message search results:', messageResults.length);

        // Test 6: Search chats
        console.log('6. Testing chat search...');
        const chatResults = await chatPersistenceService.searchChats({
            query: 'machine learning',
            user_id: 'test-user-123',
            limit: 5,
            search_titles: true,
            search_summaries: true
        });
        console.log('✅ Chat search results:', chatResults.length);

        // Test 7: Real-time search
        console.log('7. Testing real-time search...');
        const realtimeResults = await chatPersistenceService.realtimeSearch('deep learning');
        console.log('✅ Real-time search results:', realtimeResults.length);

        console.log('🎉 All tests completed successfully!');
        return true;

    } catch (error) {
        console.error('❌ Test failed:', error);
        return false;
    }
}

// Test with mock data (doesn't require actual Qdrant connection)
function testModelsAndTypes() {
    console.log('🧪 Testing data models and types...');

    try {
        // Test chat tab to AI model conversion logic
        const testService = chatPersistenceService as any;
        const summary = testService.generateChatSummary(mockChatTab);
        console.log('✅ Generated summary:', summary);

        const intent = testService.detectIntent('Can you help me with this code?');
        console.log('✅ Detected intent:', intent);

        const topics = testService.extractTopics('I need help with React TypeScript and API integration');
        console.log('✅ Extracted topics:', topics);

        console.log('🎉 Model tests completed successfully!');
        return true;
    } catch (error) {
        console.error('❌ Model test failed:', error);
        return false;
    }
}

// Export for use in development/testing
if (typeof window !== 'undefined') {
    (window as any).testChatPersistence = testChatPersistence;
    (window as any).testModelsAndTypes = testModelsAndTypes;
}

export { testChatPersistence, testModelsAndTypes };
